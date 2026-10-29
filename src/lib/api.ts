import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { AppProject, GeneratedListing } from '@/lib/types';

export type Usage = { used: number; limit: number };

export function isListingApiConfigured() {
  return Boolean(supabase);
}

export class ListingError extends Error {
  constructor(
    message: string,
    readonly usage?: Usage,
  ) {
    super(message);
  }
}

/** Calls the generate-listing Edge Function as the signed-in user. */
export async function generateListing(p: AppProject): Promise<{ listing: GeneratedListing; usage?: Usage }> {
  if (!supabase) {
    throw new ListingError('서버(Supabase)가 설정되지 않았습니다. README의 서버 설정을 확인하세요.');
  }
  const { data, error } = await supabase.functions.invoke<{ listing: Omit<GeneratedListing, 'generatedAt'>; usage?: Usage }>(
    'generate-listing',
    {
      body: {
        name: p.name,
        oneLiner: p.oneLiner,
        features: p.features,
        category: p.category,
        targetUsers: p.targetUsers,
        stores: p.stores,
        appKind: p.appKind,
        dataUsage: p.dataUsage,
      },
    },
  );
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = (await (error.context as Response).json().catch(() => null)) as { error?: string; usage?: Usage } | null;
      throw new ListingError(body?.error ?? '생성에 실패했습니다.', body?.usage);
    }
    throw new ListingError('서버에 연결하지 못했습니다. 인터넷 연결을 확인하세요.');
  }
  if (!data?.listing) throw new ListingError('생성에 실패했습니다.');
  return { listing: { ...data.listing, generatedAt: new Date().toISOString() }, usage: data.usage };
}

const FREE_MONTHLY_LIMIT = Number(process.env.EXPO_PUBLIC_FREE_MONTHLY_LIMIT ?? '5');

/** Generations by the signed-in user in the last 30 days (RLS limits rows to the user's own). */
export async function fetchUsage(): Promise<Usage | null> {
  if (!supabase) return null;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('listing_usage')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since);
  if (error) return null;
  return { used: count ?? 0, limit: FREE_MONTHLY_LIMIT };
}
