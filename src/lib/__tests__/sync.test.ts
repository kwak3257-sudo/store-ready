import { applySync, syncProjects, Tombstones } from '@/lib/sync';
import { AppProject } from '@/lib/types';

import { makeProject } from './fixtures';

type Row = { user_id: string; id: string; data: AppProject | object; updated_at: string; deleted: boolean };

// An in-memory stand-in for the projects table, answering only the queries sync.ts makes.
const mockServer = new Map<string, Row>();

jest.mock('@/lib/supabase', () => {
  const summary = () => [...mockServer.values()].map((r) => ({ id: r.id, updated_at: r.updated_at, deleted: r.deleted }));
  return {
    supabase: {
      from: () => ({
        select: (cols: string) =>
          cols === 'data'
            ? {
                in: async (_col: string, ids: string[]) => ({
                  data: [...mockServer.values()].filter((r) => ids.includes(r.id)).map((r) => ({ data: r.data })),
                  error: null,
                }),
              }
            : Promise.resolve({ data: summary(), error: null }),
        upsert: async (rows: Row[]) => {
          rows.forEach((r) => mockServer.set(r.id, r));
          return { error: null };
        },
      }),
    },
  };
});

// Photo backup is tested on a phone; here it just marks each photo as backed up.
jest.mock('@/lib/photos', () => ({
  backUpPhotos: async (userId: string, shots: { localName?: string; remotePath?: string }[]) =>
    shots.map((s) => ({ ...s, remotePath: s.remotePath ?? `${userId}/${s.localName}` })),
  restorePhotos: async () => {},
}));

async function run(local: AppProject[], tombstones: Tombstones = {}) {
  const result = await syncProjects('u1', local, tombstones);
  return { result, ...applySync(local, tombstones, result) };
}

const at = (hour: number) => `2026-10-29T${String(hour).padStart(2, '0')}:00:00.000Z`;
const withPhoto = (p: AppProject) => ({ ...p, screenshots: [{ uri: 'x', caption: '', localName: `${p.id}.jpg` }] });

beforeEach(() => mockServer.clear());

test('uploads a new project and records where its photo was backed up', async () => {
  const phoneA = await run([withPhoto(makeProject({ updatedAt: at(1) }))]);
  expect(mockServer.get('p1')?.deleted).toBe(false);
  expect(phoneA.projects[0].screenshots[0].remotePath).toBe('u1/p1.jpg');
});

test('a second phone downloads projects it does not have', async () => {
  await run([makeProject({ updatedAt: at(1) })]);
  const phoneB = await run([]);
  expect(phoneB.projects.map((p) => p.id)).toEqual(['p1']);
});

test('the later edit wins between two phones', async () => {
  let phoneA = await run([makeProject({ updatedAt: at(1) })]);
  await run([makeProject({ name: '바뀐 이름', updatedAt: at(2) })]);
  phoneA = await run(phoneA.projects);
  expect(phoneA.projects[0].name).toBe('바뀐 이름');
});

test('a deletion on one phone removes the project on the other', async () => {
  let phoneA = await run([makeProject({ updatedAt: at(1) })]);
  const phoneB = await run([], { p1: at(3) });
  expect(phoneB.result.confirmedTombstones).toEqual(['p1']);
  expect(mockServer.get('p1')?.deleted).toBe(true);
  phoneA = await run(phoneA.projects);
  expect(phoneA.projects).toEqual([]);
});

test('an edit made after a deletion brings the project back', async () => {
  await run([makeProject({ updatedAt: at(1) })]);
  await run([], { p1: at(2) });
  await run([makeProject({ name: '되살림', updatedAt: at(3) })]);
  expect(mockServer.get('p1')?.deleted).toBe(false);
});

test('a deletion of something never uploaded is simply forgotten', async () => {
  const phone = await run([], { never: at(1) });
  expect(phone.result.confirmedTombstones).toEqual(['never']);
});

test('nothing is sent or changed when both sides already match', async () => {
  const first = await run([makeProject({ updatedAt: at(1) })]);
  const again = await run(first.projects);
  expect(again.result.pushed).toEqual([]);
  expect(again.changed).toBe(false);
});

test('an edit made on this phone while syncing is not overwritten', async () => {
  const local = [makeProject({ updatedAt: at(1) })];
  const result = await syncProjects('u1', local, {});
  const editedMeanwhile = [makeProject({ name: '방금 고침', updatedAt: at(2) })];
  const { projects } = applySync(editedMeanwhile, {}, result);
  expect(projects[0].name).toBe('방금 고침');
});
