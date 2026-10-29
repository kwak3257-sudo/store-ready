// Supabase Edge Function: writes store listing copy for an app with Claude.
// The Anthropic API key stays here on the server; the mobile app never sees it.
// Only signed-in users can call it, and each user gets FREE_MONTHLY_LIMIT generations per 30 days.
//   supabase secrets set ANTHROPIC_API_KEY=...
//   supabase functions deploy generate-listing

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { withSupabase } from '@supabase/server';
import { z } from 'zod';

const LocalizedListing = z.object({
  title: z.string().describe('앱 이름. 30자 이하'),
  shortDescription: z.string().describe('구글 플레이 간단한 설명. 80자 이하'),
  fullDescription: z.string().describe('자세한 설명. 4000자 이하, 줄바꿈으로 단락 구분'),
  keywords: z.array(z.string()).describe('검색 키워드 5~10개'),
});

const Listing = z.object({
  ko: LocalizedListing,
  en: LocalizedListing,
  appleSubtitleKo: z.string().describe('애플 부제. 30자 이하'),
  appleSubtitleEn: z.string().describe('Apple subtitle. 30 characters max'),
  dataSafety: z.array(
    z.object({
      dataType: z.string(),
      collected: z.boolean(),
      shared: z.boolean(),
      purpose: z.string(),
    }),
  ),
  reviewNotes: z.string().describe('심사관에게 남길 영어 메모'),
});

const Input = z.object({
  name: z.string().min(1).max(100),
  oneLiner: z.string().max(300),
  features: z.string().max(4000),
  category: z.string().max(100),
  targetUsers: z.string().max(300),
  stores: z.array(z.enum(['google', 'apple', 'microsoft'])),
  appKind: z.enum(['native', 'webview', 'pwa']),
  dataUsage: z.record(z.string(), z.boolean()),
});

const SYSTEM = `당신은 한국 앱 개발자의 앱스토어 출시를 돕는 ASO(앱스토어 최적화) 전문가입니다.
주어진 앱 정보로 구글 플레이, 애플 앱스토어, MS 스토어에 바로 붙여 넣을 등록정보를 한국어(ko)와 영어(en)로 씁니다.

지켜야 할 것:
- 글자 수 제한을 반드시 지킵니다: 앱 이름 30자, 간단한 설명 80자, 애플 부제 30자.
- 앱 정보에 없는 기능, 수상 경력, 사용자 수, "1위" 같은 과장 표현을 지어내지 않습니다. 스토어 정책 위반으로 반려될 수 있습니다.
- 다른 앱이나 회사의 상표를 키워드에 넣지 않습니다.
- dataSafety는 사용자가 "사용함"으로 표시한 데이터 항목만 collected=true로 적고, 광고·분석을 쓰면 shared=true로 적습니다. 확실하지 않으면 보수적으로 적습니다.
- reviewNotes는 심사관이 앱의 핵심 기능을 어떻게 확인하는지 영어로 2~4문장 씁니다. 로그인이 필요하면 테스트 계정을 적을 자리를 [TEST ACCOUNT]로 남깁니다.`;

const client = new Anthropic();

const FREE_MONTHLY_LIMIT = Number(Deno.env.get('FREE_MONTHLY_LIMIT') ?? '5');
const PER_MINUTE_LIMIT = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'POST만 지원합니다.' }, 405);
    const userId = ctx.userClaims?.id;
    if (!userId) return json({ error: '로그인이 필요합니다.' }, 401);

    const parsedInput = Input.safeParse(await req.json().catch(() => null));
    if (!parsedInput.success) return json({ error: '앱 정보 형식이 올바르지 않습니다.' }, 400);
    const app = parsedInput.data;

    // supabaseAdmin bypasses RLS, so every query below filters on the caller's id.
    const countSince = async (since: Date) => {
      const { count, error } = await ctx.supabaseAdmin
        .from('listing_usage')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', since.toISOString());
      if (error) throw error;
      return count ?? 0;
    };

    let used: number;
    try {
      used = await countSince(new Date(Date.now() - 30 * DAY_MS));
      if (used >= FREE_MONTHLY_LIMIT) {
        return json(
          { error: `최근 30일 무료 사용량(${FREE_MONTHLY_LIMIT}회)을 모두 썼습니다.`, usage: { used, limit: FREE_MONTHLY_LIMIT } },
          429,
        );
      }
      if ((await countSince(new Date(Date.now() - 60 * 1000))) >= PER_MINUTE_LIMIT) {
        return json({ error: '너무 자주 요청했습니다. 1분 뒤에 다시 시도해 주세요.' }, 429);
      }
    } catch (err) {
      console.error('usage check failed', err);
      return json({ error: '사용량을 확인하지 못했습니다.' }, 500);
    }

    try {
      const response = await client.beta.messages.parse({
        model: 'claude-opus-5-5',
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium', format: betaZodOutputFormat(Listing) },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SYSTEM,
        messages: [{ role: 'user', content: `앱 정보:\n${JSON.stringify(app, null, 2)}` }],
      });

      if (response.stop_reason === 'refusal') {
        return json({ error: '이 앱 정보로는 등록정보를 만들 수 없습니다. 내용을 바꿔 다시 시도해 주세요.' }, 422);
      }
      if (!response.parsed_output) {
        return json({ error: '결과를 읽지 못했습니다. 다시 시도해 주세요.' }, 502);
      }

      // Only successful generations count toward the limit.
      const { error: insertError } = await ctx.supabaseAdmin.from('listing_usage').insert({ user_id: userId });
      if (insertError) console.error('usage insert failed', insertError);

      return json({ listing: response.parsed_output, usage: { used: used + 1, limit: FREE_MONTHLY_LIMIT } });
    } catch (err) {
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
  }),
};
