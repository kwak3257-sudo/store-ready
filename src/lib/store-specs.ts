import { StoreId } from '@/lib/types';

export type ScreenshotSize = {
  key: string;
  store: StoreId;
  label: string;
  width: number;
  height: number;
};

// Sources (checked 2026-10-26):
// Apple: https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications
//   - one "iPhone with Dynamic Island (medium display)" screenshot is always required; up to 10 per size; no alpha.
// Google Play: phone screenshots 9:16, each side 320–3840 px, 2–8 screenshots.
export const SCREENSHOT_SIZES: ScreenshotSize[] = [
  { key: 'google-phone', store: 'google', label: '구글 플레이 휴대폰 (1080×1920)', width: 1080, height: 1920 },
  { key: 'apple-6.9', store: 'apple', label: '아이폰 6.9인치 (1320×2868)', width: 1320, height: 2868 },
  { key: 'apple-6.1', store: 'apple', label: '아이폰 6.1인치 필수 (1179×2556)', width: 1179, height: 2556 },
];

export const SCREENSHOT_LIMITS: Record<StoreId, { min: number; max: number }> = {
  google: { min: 2, max: 8 },
  apple: { min: 1, max: 10 },
  microsoft: { min: 1, max: 10 },
};

export const TEXT_LIMITS = {
  googleTitle: 30,
  googleShortDescription: 80,
  googleFullDescription: 4000,
  appleName: 30,
  appleSubtitle: 30,
  appleKeywords: 100,
  appleDescription: 4000,
} as const;
