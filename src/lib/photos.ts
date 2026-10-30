import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { Screenshot } from '@/lib/types';

const FOLDER = 'screenshots';

function folder() {
  const dir = new Directory(Paths.document, FOLDER);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function newName(uri: string) {
  const ext = uri.match(/\.(jpe?g|png|webp|heic)(\?|$)/i)?.[1]?.toLowerCase() ?? 'jpg';
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

/**
 * Copies a picked image into the app's own folder. The picker hands back a cache
 * path that the OS may clear, so keeping only that path loses the photo later.
 * On web there is no app folder, so the picked URI is kept as it is.
 */
export async function keepPhoto(uri: string): Promise<Screenshot> {
  if (Platform.OS === 'web') return { uri, caption: '' };
  const localName = newName(uri);
  const dest = new File(folder(), localName);
  await new File(uri).copy(dest);
  return { uri: dest.uri, caption: '', localName };
}

/** The URI to show for a screenshot. The app folder's path can change between app updates on iOS, so it is rebuilt from the name. */
export function photoUri(shot: Screenshot) {
  if (Platform.OS === 'web' || !shot.localName) return shot.uri;
  return new File(Paths.document, FOLDER, shot.localName).uri;
}

export function localPhoto(shot: Screenshot): File | null {
  if (Platform.OS === 'web' || !shot.localName) return null;
  return new File(Paths.document, FOLDER, shot.localName);
}

export function removePhoto(shot: Screenshot) {
  const file = localPhoto(shot);
  try {
    if (file?.exists) file.delete();
  } catch {
    // Already gone; nothing to clean up.
  }
}

/** Removes every photo kept on this phone, e.g. after the account is deleted. */
export function clearPhotos() {
  if (Platform.OS === 'web') return;
  try {
    const dir = new Directory(Paths.document, FOLDER);
    if (dir.exists) dir.delete();
  } catch {
    // Nothing left to clean up.
  }
}

const BUCKET = 'screenshots';

/** Deletes screenshots on this phone and, when signed in, their server backups. Best effort. */
export function discardPhotos(shots: Screenshot[]) {
  shots.forEach(removePhoto);
  const paths = shots.map((s) => s.remotePath).filter((p): p is string => Boolean(p));
  if (supabase && paths.length) supabase.storage.from(BUCKET).remove(paths).catch(() => {});
}

/** Uploads screenshots that have no server copy yet. Returns the list with remotePath filled in. */
export async function backUpPhotos(userId: string, shots: Screenshot[]): Promise<Screenshot[]> {
  if (!supabase) return shots;
  const out: Screenshot[] = [];
  for (const shot of shots) {
    const file = localPhoto(shot);
    if (shot.remotePath || !file?.exists) {
      out.push(shot);
      continue;
    }
    const path = `${userId}/${shot.localName}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, await file.bytes(), { contentType: file.type || 'image/jpeg', upsert: true });
    if (error) throw error;
    out.push({ ...shot, remotePath: path });
  }
  return out;
}

/** Downloads server copies of screenshots this phone does not have, e.g. after switching phones. */
export async function restorePhotos(shots: Screenshot[]) {
  if (!supabase) return;
  for (const shot of shots) {
    const file = localPhoto(shot);
    if (!file || file.exists || !shot.remotePath) continue;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(shot.remotePath, 60);
    if (error) throw error;
    folder();
    await File.downloadFileAsync(data.signedUrl, file);
  }
}
