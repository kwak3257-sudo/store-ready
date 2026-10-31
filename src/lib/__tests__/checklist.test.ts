import { buildChecklist, checklistProgress } from '@/lib/checklist';

import { makeProject } from './fixtures';

test('has one section per chosen store, in the chosen order', () => {
  const sections = buildChecklist(makeProject({ stores: ['apple', 'microsoft'] }));
  expect(sections.map((s) => s.store)).toEqual(['apple', 'microsoft']);
});

test('warns about guideline 4.2 only for apps that wrap a website', () => {
  const ids = (appKind: 'native' | 'webview') =>
    buildChecklist(makeProject({ stores: ['apple'], appKind }))[0].items.map((i) => i.id);
  expect(ids('webview')).toContain('apple-4-2');
  expect(ids('native')).not.toContain('apple-4-2');
});

test('item ids are unique so ticking one never ticks another', () => {
  const ids = buildChecklist(makeProject({ stores: ['google', 'apple', 'microsoft'], appKind: 'webview' })).flatMap((s) =>
    s.items.map((i) => i.id),
  );
  expect(new Set(ids).size).toBe(ids.length);
});

test('progress counts only ticked items of the chosen stores', () => {
  const p = makeProject({ stores: ['google'], checklist: { 'google-account': true, 'apple-account': true } });
  const { done, total } = checklistProgress(p);
  expect(done).toBe(1);
  expect(total).toBe(buildChecklist(p)[0].items.length);
});
