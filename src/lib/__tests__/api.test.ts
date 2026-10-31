import { canUseAi } from '@/lib/api';

jest.mock('@/lib/supabase', () => ({ supabase: null }));

test('AI is allowed while free uses or paid credits remain', () => {
  expect(canUseAi({ used: 4, limit: 5, credits: 0 })).toBe(true);
  expect(canUseAi({ used: 5, limit: 5, credits: 1 })).toBe(true);
  expect(canUseAi({ used: 5, limit: 5, credits: 0 })).toBe(false);
});

test('AI is not blocked before usage has loaded', () => {
  expect(canUseAi(null)).toBe(true);
});
