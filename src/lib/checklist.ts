import { AppProject, StoreId } from '@/lib/types';

export type ChecklistItem = {
  id: string;
  title: string;
  detail: string;
  /** Shown in red: a step that commonly blocks or rejects a first release. */
  warning?: boolean;
};

export type ChecklistSection = {
  store: StoreId;
  items: ChecklistItem[];
};

function googleItems(p: AppProject): ChecklistItem[] {
  return [
    {
      id: 'google-account',
      title: '개발자 계정 만들기 (1회 25달러)',
      detail: 'play.google.com/console 에서 가입하고 본인 인증을 마칩니다.',
    },
    {
      id: 'google-app',
      title: 'Play Console에서 앱 만들기',
      detail: '첫 빌드(AAB)는 반드시 콘솔에서 직접 올려야 합니다. API 자동 업로드는 그 이후부터 됩니다.',
    },
    {
      id: 'google-listing',
      title: '스토어 등록정보 입력',
      detail: '앱 이름(30자), 간단한 설명(80자), 자세한 설명을 "등록정보 만들기"에서 복사해 붙여 넣으세요.',
    },
    {
      id: 'google-graphics',
      title: '아이콘 512×512, 그래픽 이미지 1024×500, 스크린샷 2장 이상',
      detail: '스크린샷은 "스크린샷 만들기"에서 1080×1920으로 만들 수 있습니다.',
    },
    {
      id: 'google-privacy',
      title: '개인정보처리방침 URL 등록',
      detail: '"등록정보 만들기"의 개인정보처리방침을 웹페이지(노션, 깃허브 페이지 등)에 올리고 주소를 넣으세요.',
    },
    {
      id: 'google-data-safety',
      title: '데이터 보안 양식 작성',
      detail: 'AI 초안을 참고하되, 실제로 쓰는 SDK(광고, 분석 등)가 모으는 데이터까지 직접 확인해야 합니다. 작성 책임은 개발자에게 있습니다.',
    },
    {
      id: 'google-content-rating',
      title: '콘텐츠 등급 설문, 타겟 연령, 광고 포함 여부 응답',
      detail: '앱 콘텐츠 메뉴에서 모두 완료해야 출시 버튼이 열립니다.',
    },
    {
      id: 'google-closed-test',
      title: '비공개 테스트: 테스터 12명이 14일 연속 참여',
      detail:
        '2023년 11월 13일 이후 만든 개인 계정은 필수입니다. 설치만 하고 쓰지 않는 테스터는 거절 사유가 되니, 실제로 써 보고 피드백을 남기게 하세요.',
      warning: true,
    },
    {
      id: 'google-production',
      title: '프로덕션 액세스 신청',
      detail: '테스트 중 받은 피드백과 고친 점을 구체적으로 적으세요. 심사는 보통 7일 안에 끝납니다.',
    },
    ...(p.dataUsage.account
      ? [
          {
            id: 'google-test-account',
            title: '심사용 테스트 계정 정보 입력',
            detail: '로그인이 필요한 앱은 심사관이 쓸 수 있는 아이디와 비밀번호를 콘솔에 적어야 합니다.',
          },
        ]
      : []),
  ];
}

function appleItems(p: AppProject): ChecklistItem[] {
  return [
    ...(p.appKind !== 'native'
      ? [
          {
            id: 'apple-4-2',
            title: '웹사이트를 감싼 앱은 반려 위험이 큽니다 (가이드라인 4.2)',
            detail:
              '웹 브라우저와 다를 게 없으면 "최소 기능" 사유로 반려됩니다. 네이티브 탭·내비게이션, 오프라인 화면, 기기 기능 활용을 넣거나 구글·MS 스토어부터 출시하는 것을 권합니다.',
            warning: true,
          },
        ]
      : []),
    {
      id: 'apple-account',
      title: 'Apple Developer Program 가입 (연 99달러)',
      detail: 'developer.apple.com 에서 가입합니다. 승인까지 며칠 걸릴 수 있습니다.',
    },
    {
      id: 'apple-app-record',
      title: 'App Store Connect에서 앱 만들기',
      detail: '번들 ID를 등록하고 앱 이름(30자)을 정합니다.',
    },
    {
      id: 'apple-build',
      title: '빌드 업로드',
      detail: 'Expo 앱이라면 eas build, eas submit 으로 올릴 수 있습니다.',
    },
    {
      id: 'apple-listing',
      title: '이름, 부제(30자), 키워드(100자), 설명 입력',
      detail: '"등록정보 만들기"의 애플용 부제와 키워드를 쓰세요.',
    },
    {
      id: 'apple-screenshots',
      title: '아이폰 6.1인치 스크린샷 1장 이상 (필수) + 6.9인치 권장',
      detail: '"스크린샷 만들기"에서 1179×2556, 1320×2868로 만들 수 있습니다. 투명 배경은 안 됩니다.',
    },
    {
      id: 'apple-privacy',
      title: '개인정보처리방침 URL과 앱 개인정보 라벨 입력',
      detail: 'AI가 만든 데이터 항목 초안을 참고해 App Privacy 질문에 답하세요.',
    },
    {
      id: 'apple-review-notes',
      title: '심사 메모와 테스트 계정 입력',
      detail: '"등록정보 만들기"의 심사 메모 초안을 붙여 넣으세요. 로그인 앱은 테스트 계정이 꼭 필요합니다.',
    },
    {
      id: 'apple-submit',
      title: '심사 제출',
      detail: '제출의 약 25%가 반려됩니다. 반려되면 메일 내용을 보고 고친 뒤 다시 제출하세요.',
    },
  ];
}

function microsoftItems(p: AppProject): ChecklistItem[] {
  return [
    {
      id: 'ms-account',
      title: 'Partner Center 개인 개발자 가입 (무료)',
      detail: '신분증과 본인 확인용 셀카가 필요합니다. 회사 계정은 99달러입니다.',
    },
    {
      id: 'ms-reserve',
      title: '앱 이름 예약',
      detail: '첫 제출은 Partner Center에서 직접 해야 합니다.',
    },
    {
      id: 'ms-package',
      title: p.appKind === 'pwa' ? 'PWA를 MSIX 패키지로 만들기' : '윈도우용 패키지 준비 (MSIX 또는 MSI/EXE)',
      detail:
        p.appKind === 'pwa'
          ? 'pwabuilder.com 에서 웹앱 주소를 넣으면 스토어용 패키지를 만들 수 있습니다.'
          : '모바일 전용 앱은 MS 스토어에 올릴 수 없습니다. 윈도우에서 돌아가는 버전이 필요합니다.',
      warning: p.appKind === 'native',
    },
    {
      id: 'ms-listing',
      title: '등록정보, 스크린샷, 연령 등급 설문',
      detail: '윈도우 화면 스크린샷(가로)이 필요합니다.',
    },
    {
      id: 'ms-submit',
      title: '제출',
      detail: '두 번째 제출부터는 API로 자동화할 수 있습니다.',
    },
  ];
}

export function buildChecklist(p: AppProject): ChecklistSection[] {
  const builders: Record<StoreId, (p: AppProject) => ChecklistItem[]> = {
    google: googleItems,
    apple: appleItems,
    microsoft: microsoftItems,
  };
  return p.stores.map((store) => ({ store, items: builders[store](p) }));
}

export function checklistProgress(p: AppProject) {
  const items = buildChecklist(p).flatMap((s) => s.items);
  const done = items.filter((i) => p.checklist[i.id]).length;
  return { done, total: items.length };
}
