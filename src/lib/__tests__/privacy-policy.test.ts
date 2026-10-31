import { buildPrivacyPolicy } from '@/lib/privacy-policy';
import { EMPTY_DATA_USAGE } from '@/lib/types';

import { makeProject } from './fixtures';

const date = new Date('2026-10-30T00:00:00Z');

test('says nothing is collected when no data is used', () => {
  const text = buildPrivacyPolicy(makeProject(), date);
  expect(text).toContain('# 물 마시기 알리미 개인정보처리방침');
  expect(text).toContain('앱은 이용자의 개인정보를 수집하지 않습니다.');
  expect(text).toContain('dev@example.com');
  expect(text).toContain('2026-10-30');
});

test('names the companies data goes to when ads, analytics or payments are used', () => {
  const text = buildPrivacyPolicy(
    makeProject({ dataUsage: { ...EMPTY_DATA_USAGE, ads: true, analytics: true, payments: true } }),
    date,
  );
  expect(text).toContain('AdMob');
  expect(text).toContain('Firebase');
  expect(text).toContain('Google Play, App Store');
  expect(text).not.toContain('수집하지 않습니다');
});

test('leaves visible blanks instead of empty names', () => {
  const text = buildPrivacyPolicy(makeProject({ developerName: '', contactEmail: '' }), date);
  expect(text).toContain('(개발자 이름)');
  expect(text).toContain('(연락 이메일)');
});
