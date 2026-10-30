import { dayStreak, Join, koreanDay, testingProgress } from '@/lib/exchange';

jest.mock('@/lib/supabase', () => ({ supabase: null }));

const join = (installed: string, left: string | null = null): Join => ({
  id: Math.random().toString(36),
  app_id: 'a',
  tester: 't',
  status: left ? 'left' : 'installed',
  requested_at: installed,
  installed_at: installed,
  left_at: left,
});
const testers = (count: number, installed: string) => Array.from({ length: count }, () => join(installed));

test('12 testers for 14 days in a row meets Google’s rule', () => {
  const p = testingProgress(testers(12, '2026-10-16T03:00:00Z'), 12, '2026-10-29');
  expect(p).toEqual({ testersNow: 12, streak: 14, ready: true, daysLeft: 0 });
});

test('counts the days still to go', () => {
  const p = testingProgress(testers(12, '2026-10-25T03:00:00Z'), 12, '2026-10-29');
  expect(p.streak).toBe(5);
  expect(p.daysLeft).toBe(9);
  expect(p.ready).toBe(false);
});

test('one tester leaving drops below 12 and stops the count', () => {
  const list = testers(12, '2026-10-16T03:00:00Z');
  list[0] = join('2026-10-16T03:00:00Z', '2026-10-28T03:00:00Z');
  const p = testingProgress(list, 12, '2026-10-29');
  expect(p.testersNow).toBe(11);
  expect(p.streak).toBe(0);
  expect(p.daysLeft).toBeNull();
});

test('days follow the Korean calendar', () => {
  // 16:00 UTC on the 28th is 01:00 on the 29th in Korea.
  expect(koreanDay(new Date('2026-10-28T16:00:00Z'))).toBe('2026-10-29');
  expect(testingProgress(testers(12, '2026-10-28T16:00:00Z'), 12, '2026-10-29').streak).toBe(1);
});

test('a check-in streak breaks on a missed day', () => {
  expect(dayStreak(['2026-10-27', '2026-10-28', '2026-10-29'], '2026-10-29')).toBe(3);
  expect(dayStreak(['2026-10-27', '2026-10-29'], '2026-10-29')).toBe(1);
  expect(dayStreak(['2026-10-28'], '2026-10-29')).toBe(0);
});
