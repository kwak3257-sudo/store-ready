// Free AI quota shared by every AI feature: FREE_MONTHLY_LIMIT uses per rolling 30 days, plus a per-minute cap.
// Past the free quota, each answer spends one paid credit (bought in the app). Each successful answer adds one row to listing_usage.

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseContext } from '@supabase/server';

type AdminClient = SupabaseContext['supabaseAdmin'];

export const FREE_MONTHLY_LIMIT = Number(Deno.env.get('FREE_MONTHLY_LIMIT') ?? '5');
const PER_MINUTE_LIMIT = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export type UsageKind = 'listing' | 'rejection';

/** What the caller has used and has left; sent back to the app with every answer. */
export type Usage = { used: number; limit: number; credits: number };

async function creditBalance(admin: AdminClient, userId: string) {
  const { data, error } = await admin.from('ai_credit_ledger').select('delta').eq('user_id', userId);
  if (error) throw error;
  return (data as { delta: number }[]).reduce((sum, row) => sum + row.delta, 0);
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

/**
 * Returns the caller's usage, or a Response to send back when they have no free uses or credits left.
 * `admin` bypasses RLS, so every query filters on the caller's id.
 */
export async function checkUsage(admin: AdminClient, userId: string): Promise<Usage | Response> {
  const countSince = async (since: Date) => {
    const { count, error } = await admin
      .from('listing_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since.toISOString());
    if (error) throw error;
    return count ?? 0;
  };

  try {
    const [used, credits] = await Promise.all([
      countSince(new Date(Date.now() - 30 * DAY_MS)),
      creditBalance(admin, userId),
    ]);
    const usage = { used, limit: FREE_MONTHLY_LIMIT, credits };
    if (used >= FREE_MONTHLY_LIMIT && credits <= 0) {
      return json(
        { error: `최근 30일 무료 사용량(${FREE_MONTHLY_LIMIT}회)을 모두 썼습니다. 이용권을 사면 계속 쓸 수 있어요.`, usage },
        429,
      );
    }
    if ((await countSince(new Date(Date.now() - 60 * 1000))) >= PER_MINUTE_LIMIT) {
      return json({ error: '너무 자주 요청했습니다. 1분 뒤에 다시 시도해 주세요.' }, 429);
    }
    return usage;
  } catch (err) {
    console.error('usage check failed', err);
    return json({ error: '사용량을 확인하지 못했습니다.' }, 500);
  }
}

/** Only successful answers count. Returns the usage after this answer. */
export async function recordUsage(admin: AdminClient, userId: string, kind: UsageKind, before: Usage): Promise<Usage> {
  const { error } = await admin.from('listing_usage').insert({ user_id: userId, kind });
  if (error) console.error('usage insert failed', error);
  if (before.used < before.limit) return { ...before, used: before.used + 1 };

  const { data: spent, error: spendError } = await admin.rpc('spend_credit', { p_user: userId, p_reason: kind });
  if (spendError || !spent) console.error('credit spend failed', spendError ?? 'no balance');
  return { ...before, used: before.used + 1, credits: spent ? before.credits - 1 : before.credits };
}

export function aiErrorResponse(err: unknown) {
  if (err instanceof Anthropic.RateLimitError) {
    return json({ error: '요청이 많습니다. 잠시 후 다시 시도해 주세요.' }, 429);
  }
  if (err instanceof Anthropic.APIError) {
    console.error('Anthropic API error', err.status, err.message);
    return json({ error: 'AI 서버 오류가 발생했습니다.' }, 502);
  }
  console.error(err);
  return json({ error: '알 수 없는 오류가 발생했습니다.' }, 500);
}
