// Free AI quota shared by every AI feature: FREE_MONTHLY_LIMIT uses per rolling 30 days, plus a per-minute cap.
// Each successful AI answer adds one row to listing_usage.

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseContext } from '@supabase/server';

type AdminClient = SupabaseContext['supabaseAdmin'];

export const FREE_MONTHLY_LIMIT = Number(Deno.env.get('FREE_MONTHLY_LIMIT') ?? '5');
const PER_MINUTE_LIMIT = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export type UsageKind = 'listing' | 'rejection';

export function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

/**
 * Returns how many uses the caller has made in the last 30 days, or a Response to send back when they are over a limit.
 * `admin` bypasses RLS, so every query filters on the caller's id.
 */
export async function checkUsage(admin: AdminClient, userId: string): Promise<number | Response> {
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
    const used = await countSince(new Date(Date.now() - 30 * DAY_MS));
    if (used >= FREE_MONTHLY_LIMIT) {
      return json(
        { error: `최근 30일 무료 사용량(${FREE_MONTHLY_LIMIT}회)을 모두 썼습니다.`, usage: { used, limit: FREE_MONTHLY_LIMIT } },
        429,
      );
    }
    if ((await countSince(new Date(Date.now() - 60 * 1000))) >= PER_MINUTE_LIMIT) {
      return json({ error: '너무 자주 요청했습니다. 1분 뒤에 다시 시도해 주세요.' }, 429);
    }
    return used;
  } catch (err) {
    console.error('usage check failed', err);
    return json({ error: '사용량을 확인하지 못했습니다.' }, 500);
  }
}

/** Only successful answers count toward the limit. */
export async function recordUsage(admin: AdminClient, userId: string, kind: UsageKind) {
  const { error } = await admin.from('listing_usage').insert({ user_id: userId, kind });
  if (error) console.error('usage insert failed', error);
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
