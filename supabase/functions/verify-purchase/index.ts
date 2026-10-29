// Supabase Edge Function: checks an in-app purchase with Google Play or the App Store and adds AI credits.
// The app only finishes (consumes) a purchase after this succeeds, so a failed check can be retried.
//   supabase secrets set IAP_PRODUCT_CREDITS='{"launch_pass":20}'
//   supabase secrets set ANDROID_PACKAGE_NAME=... GOOGLE_SERVICE_ACCOUNT_JSON="$(cat service-account.json)"
//   supabase secrets set APPLE_BUNDLE_ID=... APPLE_IAP_ISSUER_ID=... APPLE_IAP_KEY_ID=... APPLE_IAP_PRIVATE_KEY="$(cat SubscriptionKey_XXXX.p8)"
//   supabase functions deploy verify-purchase

import { withSupabase } from '@supabase/server';
import { z } from 'zod';

const Input = z.discriminatedUnion('store', [
  z.object({ store: z.literal('google'), productId: z.string().min(1).max(200), token: z.string().min(1).max(4000) }),
  z.object({ store: z.literal('apple'), productId: z.string().min(1).max(200), transactionId: z.string().regex(/^\d+$/) }),
]);

const PRODUCT_CREDITS: Record<string, number> = JSON.parse(Deno.env.get('IAP_PRODUCT_CREDITS') ?? '{"launch_pass":20}');

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlJson = (value: unknown) => b64url(new TextEncoder().encode(JSON.stringify(value)));

function pemToDer(pem: string) {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

async function signJwt(header: object, payload: object, key: CryptoKey, algorithm: AlgorithmIdentifier | EcdsaParams) {
  const input = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  const signature = new Uint8Array(await crypto.subtle.sign(algorithm, key, new TextEncoder().encode(input)));
  return `${input}.${b64url(signature)}`;
}

type Verified = { ok: true; key: string; productId: string; quantity: number } | { ok: false; reason: string };

/** Asks Google Play about the purchase token with the service account. */
async function verifyGoogle(userId: string, productId: string, token: string): Promise<Verified> {
  const account = JSON.parse(env('GOOGLE_SERVICE_ACCOUNT_JSON')) as { client_email: string; private_key: string };
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(account.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwt(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 600,
    },
    key,
    'RSASSA-PKCS1-v1_5',
  );
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!tokenRes.ok) throw new Error(`Google auth failed: ${tokenRes.status} ${await tokenRes.text()}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const pkg = env('ANDROID_PACKAGE_NAME');
  const res = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(pkg)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}`,
    { headers: { Authorization: `Bearer ${access_token}` } },
  );
  if (res.status === 404 || res.status === 400) return { ok: false, reason: '구글 플레이에서 이 구매를 찾지 못했습니다.' };
  if (!res.ok) throw new Error(`Google purchase lookup failed: ${res.status} ${await res.text()}`);
  const purchase = (await res.json()) as { purchaseState?: number; obfuscatedExternalAccountId?: string; quantity?: number };
  if (purchase.purchaseState !== 0) return { ok: false, reason: '결제가 아직 끝나지 않았거나 취소되었습니다.' };
  if (purchase.obfuscatedExternalAccountId && purchase.obfuscatedExternalAccountId !== userId) {
    return { ok: false, reason: '다른 계정의 구매입니다.' };
  }
  return { ok: true, key: token, productId, quantity: purchase.quantity ?? 1 };
}

/** Fetches the transaction from the App Store Server API, trying production then sandbox (TestFlight). */
async function verifyApple(userId: string, productId: string, transactionId: string): Promise<Verified> {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(env('APPLE_IAP_PRIVATE_KEY')),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const now = Math.floor(Date.now() / 1000);
  const bundleId = env('APPLE_BUNDLE_ID');
  const token = await signJwt(
    { alg: 'ES256', kid: env('APPLE_IAP_KEY_ID'), typ: 'JWT' },
    { iss: env('APPLE_IAP_ISSUER_ID'), iat: now, exp: now + 600, aud: 'appstoreconnect-v1', bid: bundleId },
    key,
    { name: 'ECDSA', hash: 'SHA-256' },
  );

  let signed: string | null = null;
  for (const host of ['api.storekit.itunes.apple.com', 'api.storekit-sandbox.itunes.apple.com']) {
    const res = await fetch(`https://${host}/inApps/v1/transactions/${transactionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`App Store lookup failed: ${res.status} ${await res.text()}`);
    signed = ((await res.json()) as { signedTransactionInfo: string }).signedTransactionInfo;
    break;
  }
  if (!signed) return { ok: false, reason: '앱스토어에서 이 구매를 찾지 못했습니다.' };

  // Came straight from Apple over TLS, so the payload is read without re-checking the JWS signature.
  const payloadPart = signed.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const tx = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payloadPart), (c) => c.charCodeAt(0)))) as {
    bundleId: string;
    productId: string;
    transactionId: string;
    appAccountToken?: string;
    revocationDate?: number;
    quantity?: number;
  };
  if (tx.bundleId !== bundleId || tx.productId !== productId) return { ok: false, reason: '이 앱의 구매가 아닙니다.' };
  if (tx.revocationDate) return { ok: false, reason: '환불된 구매입니다.' };
  if (tx.appAccountToken && tx.appAccountToken.toLowerCase() !== userId.toLowerCase()) {
    return { ok: false, reason: '다른 계정의 구매입니다.' };
  }
  return { ok: true, key: tx.transactionId, productId: tx.productId, quantity: tx.quantity ?? 1 };
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'POST만 지원합니다.' }, 405);
    const userId = ctx.userClaims?.id;
    if (!userId) return json({ error: '로그인이 필요합니다.' }, 401);

    const parsed = Input.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: '구매 정보 형식이 올바르지 않습니다.' }, 400);
    const input = parsed.data;
    const perUnit = PRODUCT_CREDITS[input.productId];
    if (!perUnit) return json({ error: '알 수 없는 상품입니다.' }, 400);

    let verified: Verified;
    try {
      verified =
        input.store === 'google'
          ? await verifyGoogle(userId, input.productId, input.token)
          : await verifyApple(userId, input.productId, input.transactionId);
    } catch (err) {
      console.error('store verification failed', err);
      return json({ error: '스토어에 구매를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 502);
    }
    // 409 tells the app this purchase will never be credited, so it can stop retrying.
    if (!verified.ok) return json({ error: verified.reason }, 409);

    const { data: result, error } = await ctx.supabaseAdmin.rpc('grant_purchase', {
      p_user: userId,
      p_store: input.store,
      p_key: verified.key,
      p_product: verified.productId,
      p_credits: perUnit * verified.quantity,
    });
    if (error) {
      console.error('grant failed', error);
      return json({ error: '이용권을 저장하지 못했습니다. 다시 시도해 주세요.' }, 500);
    }
    if (result === 'other_user') return json({ error: '다른 계정에서 이미 사용한 구매입니다.' }, 409);

    const { data: rows, error: balanceError } = await ctx.supabaseAdmin
      .from('ai_credit_ledger')
      .select('delta')
      .eq('user_id', userId);
    if (balanceError) console.error('balance read failed', balanceError);
    const credits = ((rows ?? []) as { delta: number }[]).reduce((sum, r) => sum + r.delta, 0);
    return json({ status: result, credits });
  }),
};
