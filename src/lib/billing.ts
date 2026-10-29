import { FunctionsHttpError } from '@supabase/supabase-js';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import {
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  Product,
  Purchase,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
} from 'expo-iap';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/** Store product ids, the same on Google Play and App Store Connect. Credits per product are set on the server. */
export const PRODUCT_IDS = (process.env.EXPO_PUBLIC_IAP_PRODUCT_IDS ?? 'launch_pass')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Expo Go and the web have no store billing; payments need a development or store build. */
export const billingSupported =
  Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

type VerifyResult = { credits: number } | { error: string; final: boolean };

/** Sends the purchase to the server, which checks it with the store and adds credits. */
async function verify(purchase: Purchase): Promise<VerifyResult> {
  if (!supabase) return { error: '서버(Supabase)가 설정되지 않았습니다.', final: false };
  const body =
    Platform.OS === 'ios'
      ? { store: 'apple', productId: purchase.productId, transactionId: 'transactionId' in purchase ? purchase.transactionId : purchase.id }
      : { store: 'google', productId: purchase.productId, token: purchase.purchaseToken };
  const { data, error } = await supabase.functions.invoke<{ credits: number }>('verify-purchase', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const res = error.context as Response;
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      // 409: the store says this purchase can never be credited (refunded, someone else's, ...).
      return { error: payload?.error ?? '구매를 확인하지 못했습니다.', final: res.status === 409 };
    }
    return { error: '서버에 연결하지 못했습니다. 앱을 다시 열면 자동으로 다시 확인해요.', final: false };
  }
  return { credits: data?.credits ?? 0 };
}

/**
 * Store connection, products and the purchase flow. A purchase is finished (consumed) only after the
 * server credited it; unfinished ones are retried every time this screen opens.
 */
export function useBilling(userId: string, onCredits: (credits: number) => void) {
  const [products, setProducts] = useState<Product[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const handled = useRef(new Set<string>());
  const onCreditsRef = useRef(onCredits);
  onCreditsRef.current = onCredits;

  const handle = useCallback(async (purchase: Purchase) => {
    if (purchase.purchaseState !== 'purchased') {
      if (purchase.purchaseState === 'pending') setMessage('결제가 승인되면 이용권이 들어와요.');
      setBusy(false);
      return;
    }
    const key = purchase.purchaseToken ?? purchase.id;
    if (handled.current.has(key)) return;
    handled.current.add(key);
    try {
      const result = await verify(purchase);
      if ('credits' in result) {
        await finishTransaction({ purchase, isConsumable: true });
        onCreditsRef.current(result.credits);
        setMessage('이용권이 들어왔어요.');
      } else {
        if (result.final) await finishTransaction({ purchase, isConsumable: true });
        else handled.current.delete(key);
        setMessage(result.error);
      }
    } catch (e) {
      handled.current.delete(key);
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!billingSupported) return;
    let alive = true;
    const updated = purchaseUpdatedListener((p) => void handle(p));
    const failed = purchaseErrorListener((e) => {
      setBusy(false);
      if (e.code !== 'user-cancelled') setMessage(e.message);
    });
    (async () => {
      try {
        await initConnection();
        const list = await fetchProducts({ skus: PRODUCT_IDS, type: 'in-app' });
        if (!alive) return;
        setProducts((list ?? []) as Product[]);
        setReady(true);
        // Purchases paid for but not yet credited, e.g. the app closed mid-way.
        for (const p of await getAvailablePurchases()) {
          if (PRODUCT_IDS.includes(p.productId)) await handle(p);
        }
      } catch (e) {
        if (alive) setMessage(`스토어에 연결하지 못했어요: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
    return () => {
      alive = false;
      updated.remove();
      failed.remove();
      endConnection().catch(() => {});
    };
  }, [handle]);

  const buy = useCallback(
    async (sku: string) => {
      setBusy(true);
      setMessage(null);
      try {
        await requestPurchase({
          request: {
            // Ties the purchase to this account so the server can refuse it for anyone else.
            apple: { sku, appAccountToken: userId },
            google: { skus: [sku], obfuscatedAccountId: userId },
          },
          type: 'in-app',
        });
      } catch (e) {
        setBusy(false);
        setMessage(e instanceof Error ? e.message : String(e));
      }
    },
    [userId],
  );

  return { products, ready, busy, message, buy };
}
