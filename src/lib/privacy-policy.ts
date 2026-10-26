import { AppProject, DataUsage } from '@/lib/types';

// Built from a fixed template rather than AI so the legal wording stays predictable.
// It follows the items the Korean Personal Information Protection Act asks a policy to cover;
// the user must still review it before publishing.

const ITEMS: Record<keyof DataUsage, { item: string; purpose: string }> = {
  account: { item: '이메일 주소, 이름(닉네임), 비밀번호', purpose: '회원 식별, 로그인, 고객 문의 응대' },
  location: { item: '위치 정보', purpose: '위치 기반 기능 제공' },
  photos: { item: '사용자가 선택한 사진 및 카메라 촬영 이미지', purpose: '사진 첨부·편집 등 앱 기능 제공' },
  contacts: { item: '연락처 정보', purpose: '친구 찾기·초대 등 앱 기능 제공' },
  payments: { item: '결제 내역(결제 수단 정보는 결제 대행사가 처리)', purpose: '유료 서비스 결제 및 환불 처리' },
  analytics: { item: '앱 사용 기록, 기기 정보, 오류 기록', purpose: '서비스 개선과 오류 분석' },
  ads: { item: '광고 식별자', purpose: '광고 표시 및 광고 성과 측정' },
};

export function buildPrivacyPolicy(p: AppProject, effectiveDate = new Date()): string {
  const used = (Object.keys(ITEMS) as (keyof DataUsage)[]).filter((k) => p.dataUsage[k]);
  const owner = p.developerName || '(개발자 이름)';
  const email = p.contactEmail || '(연락 이메일)';
  const date = effectiveDate.toISOString().slice(0, 10);

  const collected =
    used.length === 0
      ? '앱은 이용자의 개인정보를 수집하지 않습니다.'
      : used.map((k) => `- ${ITEMS[k].item}: ${ITEMS[k].purpose}`).join('\n');

  const thirdParty: string[] = [];
  if (p.dataUsage.analytics) thirdParty.push('- 앱 사용 분석 도구 제공업체 (예: Google Analytics for Firebase)');
  if (p.dataUsage.ads) thirdParty.push('- 광고 네트워크 (예: Google AdMob)');
  if (p.dataUsage.payments) thirdParty.push('- 결제 대행사 및 앱 마켓 (Google Play, App Store)');

  return `# ${p.name} 개인정보처리방침

${owner}(이하 "개발자")는 「개인정보 보호법」 등 관련 법령을 지키며, ${p.name}(이하 "앱") 이용자의 개인정보를 다음과 같이 처리합니다.

## 1. 수집하는 개인정보 항목과 이용 목적
${collected}

## 2. 보유 및 이용 기간
이용자가 회원 탈퇴를 하거나 앱을 삭제해 이용 목적이 끝나면 지체 없이 파기합니다. 다만 관련 법령에 따라 보관이 필요한 경우 그 기간 동안 보관합니다.

## 3. 제3자 제공 및 처리 위탁
개발자는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다.${
    thirdParty.length ? `\n앱 기능 제공을 위해 다음 서비스가 정보를 처리할 수 있습니다.\n${thirdParty.join('\n')}` : ''
  }

## 4. 개인정보의 파기
보유 기간이 끝난 개인정보는 복구할 수 없는 방법으로 지체 없이 파기합니다.

## 5. 이용자의 권리
이용자는 언제든지 자신의 개인정보 열람, 정정, 삭제, 처리 정지를 요청할 수 있습니다. 아래 연락처로 요청하면 지체 없이 처리합니다.

## 6. 개인정보 보호책임자
- 이름: ${owner}
- 이메일: ${email}

## 7. 시행일
이 개인정보처리방침은 ${date}부터 적용됩니다.
`;
}
