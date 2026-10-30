import { AppProject, EMPTY_DATA_USAGE } from '@/lib/types';

export function makeProject(overrides: Partial<AppProject> = {}): AppProject {
  return {
    id: 'p1',
    name: '물 마시기 알리미',
    oneLiner: '하루 물 섭취량을 기록하는 앱',
    features: '- 한 번 눌러 기록',
    category: '건강',
    targetUsers: '직장인',
    stores: ['google', 'apple'],
    appKind: 'native',
    dataUsage: { ...EMPTY_DATA_USAGE },
    developerName: '홍길동',
    contactEmail: 'dev@example.com',
    screenshots: [],
    screenshotBackground: '#208AEF',
    checklist: {},
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}
