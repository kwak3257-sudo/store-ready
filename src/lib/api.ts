import { AppProject, GeneratedListing } from '@/lib/types';

const API_URL = process.env.EXPO_PUBLIC_LISTING_API_URL;
const API_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export function isListingApiConfigured() {
  return Boolean(API_URL);
}

export async function generateListing(p: AppProject): Promise<GeneratedListing> {
  if (!API_URL) {
    throw new Error('서버 주소(EXPO_PUBLIC_LISTING_API_URL)가 설정되지 않았습니다. README의 서버 설정을 확인하세요.');
  }
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}`, apikey: API_KEY } : {}),
    },
    body: JSON.stringify({
      name: p.name,
      oneLiner: p.oneLiner,
      features: p.features,
      category: p.category,
      targetUsers: p.targetUsers,
      stores: p.stores,
      appKind: p.appKind,
      dataUsage: p.dataUsage,
    }),
  });
  const body = (await res.json().catch(() => null)) as { listing?: Omit<GeneratedListing, 'generatedAt'>; error?: string } | null;
  if (!res.ok || !body?.listing) {
    throw new Error(body?.error ?? `생성에 실패했습니다 (HTTP ${res.status}).`);
  }
  return { ...body.listing, generatedAt: new Date().toISOString() };
}
