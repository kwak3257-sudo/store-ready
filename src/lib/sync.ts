import { backUpPhotos, restorePhotos } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import { AppProject } from '@/lib/types';

/** Projects deleted on this phone, by id, with when they were deleted. */
export type Tombstones = Record<string, string>;

type RemoteRow = { id: string; updated_at: string; deleted: boolean };

export type SyncResult = {
  /** Server versions newer than what this phone had when the sync started. */
  pulled: AppProject[];
  /** Projects deleted on another phone, with when. */
  removed: Record<string, string>;
  /** Projects uploaded from this phone, with screenshot backup paths filled in. */
  pushed: AppProject[];
  /** Local deletions the server now knows about. */
  confirmedTombstones: string[];
};

const time = (iso: string) => Date.parse(iso);

/**
 * Brings this phone and the server to the same set of projects.
 * Whichever side changed a project last wins; the caller applies the result
 * only where the phone has not changed again while this ran.
 */
export async function syncProjects(
  userId: string,
  local: AppProject[],
  tombstones: Tombstones,
): Promise<SyncResult> {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.');
  const result: SyncResult = { pulled: [], removed: {}, pushed: [], confirmedTombstones: [] };

  const { data, error } = await supabase.from('projects').select('id, updated_at, deleted');
  if (error) throw error;
  const remote = new Map((data as RemoteRow[]).map((r) => [r.id, r]));
  const localById = new Map(local.map((p) => [p.id, p]));

  const toPush = local.filter((p) => {
    const r = remote.get(p.id);
    return !r || time(p.updatedAt) > time(r.updated_at);
  });

  const deletions = Object.entries(tombstones).filter(([id, at]) => {
    const r = remote.get(id);
    // Nothing to delete on the server, it already has this deletion, or a newer edit from another phone wins.
    if (!r || time(r.updated_at) >= time(at)) {
      result.confirmedTombstones.push(id);
      return false;
    }
    return true;
  });

  const toPull: string[] = [];
  for (const r of remote.values()) {
    const mine = localById.get(r.id);
    const deletedHere = tombstones[r.id];
    if (deletedHere && time(deletedHere) > time(r.updated_at)) continue;
    if (r.deleted) {
      if (mine && time(r.updated_at) > time(mine.updatedAt)) result.removed[r.id] = r.updated_at;
    } else if (!mine || time(r.updated_at) > time(mine.updatedAt)) {
      toPull.push(r.id);
    }
  }

  if (toPull.length) {
    const { data: rows, error: pullError } = await supabase.from('projects').select('data').in('id', toPull);
    if (pullError) throw pullError;
    for (const row of rows as { data: AppProject }[]) {
      await restorePhotos(row.data.screenshots ?? []);
      result.pulled.push(row.data);
    }
  }

  for (const p of toPush) {
    result.pushed.push({ ...p, screenshots: await backUpPhotos(userId, p.screenshots) });
  }
  const upserts = [
    ...result.pushed.map((p) => ({ user_id: userId, id: p.id, data: p, updated_at: p.updatedAt, deleted: false })),
    ...deletions.map(([id, at]) => ({ user_id: userId, id, data: {}, updated_at: at, deleted: true })),
  ];
  if (upserts.length) {
    const { error: pushError } = await supabase.from('projects').upsert(upserts);
    if (pushError) throw pushError;
  }
  result.confirmedTombstones.push(...deletions.map(([id]) => id));
  return result;
}

/** Applies a sync result to the phone's current projects without undoing edits made while it ran. */
export function applySync(current: AppProject[], tombstones: Tombstones, r: SyncResult) {
  let changed = false;
  const byId = new Map(current.map((p) => [p.id, p]));

  for (const [id, at] of Object.entries(r.removed)) {
    const mine = byId.get(id);
    if (mine && time(at) > time(mine.updatedAt)) {
      byId.delete(id);
      changed = true;
    }
  }
  for (const p of r.pulled) {
    const mine = byId.get(p.id);
    const deletedHere = tombstones[p.id];
    if (deletedHere && time(deletedHere) > time(p.updatedAt)) continue;
    if (!mine || time(p.updatedAt) > time(mine.updatedAt)) {
      byId.set(p.id, p);
      changed = true;
    }
  }
  for (const p of r.pushed) {
    const mine = byId.get(p.id);
    // Only the screenshot backup paths differ; skip if the user edited it again meanwhile.
    if (mine && mine.updatedAt === p.updatedAt && mine.screenshots !== p.screenshots) {
      const merged = mine.screenshots.map((s) => {
        const backed = p.screenshots.find((b) => b.localName && b.localName === s.localName);
        return backed?.remotePath && !s.remotePath ? { ...s, remotePath: backed.remotePath } : s;
      });
      if (merged.some((s, i) => s !== mine.screenshots[i])) {
        byId.set(p.id, { ...mine, screenshots: merged });
        changed = true;
      }
    }
  }

  const projects = changed
    ? [...byId.values()].sort((a, b) => time(b.createdAt) - time(a.createdAt))
    : current;
  return { projects, changed };
}
