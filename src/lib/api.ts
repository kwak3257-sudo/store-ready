import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { AppProject, GeneratedListing, RejectionAnalysis, StoreId } from '@/lib/types';

export type Usage = { used: number; limit: number };

export function isAiConfigured() {
  return Boolean(supabase);
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly usage?: Usage,
  ) {
    super(message);
  }
}

/** Calls one of the AI Edge Functions as the signed-in user. */
async function invokeAi<T>(name: string, body: object): Promise<T & { usage?: Usage }> {
  if (!supabase) {
    throw new AiError('서버(Supabase)가 설정되지 않았습니다. README의 서버 설정을 확인하세요.');
  }
  const { data, error } = await supabase.functions.invoke<T & { usage?: Usage }>(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const res = (await (error.context as Response).json().catch(() => null)) as { error?: string; usage?: Usage } | null;
      throw new AiError(res?.error ?? '요청에 실패했습니다.', res?.usage);
    }
    throw new AiError('서버에 연결하지 못했습니다. 인터넷 연결을 확인하세요.');
  }
  if (!data) throw new AiError('요청에 실패했습니다.');
  return data;
}

export async function generateListing(p: AppProject): Promise<{ listing: GeneratedListing; usage?: Usage }> {
  const data = await invokeAi<{ listing: Omit<GeneratedListing, 'generatedAt'> }>('generate-listing', {
    name: p.name,
    oneLiner: p.oneLiner,
    features: p.features,
    category: p.category,
    targetUsers: p.targetUsers,
    stores: p.stores,
    appKind: p.appKind,
    dataUsage: p.dataUsage,
  });
  if (!data.listing) throw new AiError('생성에 실패했습니다.');
  return { listing: { ...data.listing, generatedAt: new Date().toISOString() }, usage: data.usage };
}

export async function explainRejection(
  p: AppProject,
  store: StoreId,
  message: string,
): Promise<{ analysis: RejectionAnalysis; usage?: Usage }> {
  const data = await invokeAi<{ analysis: RejectionAnalysis }>('explain-rejection', {
    store,
    message,
    app: { name: p.name, oneLiner: p.oneLiner, features: p.features, appKind: p.appKind, dataUsage: p.dataUsage },
  });
  if (!data.analysis) throw new AiError('분석에 실패했습니다.');
  return { analysis: data.analysis, usage: data.usage };
}

const FREE_MONTHLY_LIMIT = Number(process.env.EXPO_PUBLIC_FREE_MONTHLY_LIMIT ?? '5');

/** AI uses by the signed-in user in the last 30 days (RLS limits rows to the user's own). */
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
