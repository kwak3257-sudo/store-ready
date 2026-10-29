export type StoreId = 'google' | 'apple' | 'microsoft';

/** How the app is built. Wrapped web apps carry a high Apple rejection risk (guideline 4.2). */
export type AppKind = 'native' | 'webview' | 'pwa';

export type DataUsage = {
  account: boolean;
  location: boolean;
  photos: boolean;
  contacts: boolean;
  payments: boolean;
  analytics: boolean;
  ads: boolean;
};

export type LocalizedListing = {
  title: string;
  shortDescription: string;
  fullDescription: string;
  keywords: string[];
};

export type DataSafetyItem = {
  dataType: string;
  collected: boolean;
  shared: boolean;
  purpose: string;
};

export type GeneratedListing = {
  ko: LocalizedListing;
  en: LocalizedListing;
  appleSubtitleKo: string;
  appleSubtitleEn: string;
  dataSafety: DataSafetyItem[];
  reviewNotes: string;
  generatedAt: string;
};

export type Screenshot = {
  /** Where the picked image was when chosen. Only used as-is on web, where nothing is copied. */
  uri: string;
  caption: string;
  /** File name inside the app's own photo folder, so the image survives the gallery copy being deleted. */
  localName?: string;
  /** Path in the server's screenshots bucket once backed up. */
  remotePath?: string;
};

export type AppProject = {
  id: string;
  name: string;
  oneLiner: string;
  features: string;
  category: string;
  targetUsers: string;
  stores: StoreId[];
  appKind: AppKind;
  dataUsage: DataUsage;
  developerName: string;
  contactEmail: string;
  listing?: GeneratedListing;
  screenshots: Screenshot[];
  screenshotBackground: string;
  checklist: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
};

export const STORE_LABELS: Record<StoreId, string> = {
  google: '구글 플레이',
  apple: '애플 앱스토어',
  microsoft: 'MS 스토어',
};

export const APP_KIND_LABELS: Record<AppKind, string> = {
  native: '네이티브 앱 (Expo, Flutter, Swift, Kotlin 등)',
  webview: '웹사이트를 감싼 앱 (웹뷰)',
  pwa: '웹앱 (PWA)',
};

export const DATA_USAGE_LABELS: Record<keyof DataUsage, string> = {
  account: '회원가입·로그인 (이메일, 이름 등)',
  location: '위치 정보',
  photos: '사진·카메라',
  contacts: '연락처',
  payments: '결제 정보',
  analytics: '사용 기록 분석 (애널리틱스)',
  ads: '광고 표시',
};

export const EMPTY_DATA_USAGE: DataUsage = {
  account: false,
  location: false,
  photos: false,
  contacts: false,
  payments: false,
  analytics: false,
  ads: false,
};
