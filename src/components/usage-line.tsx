import { router } from 'expo-router';

import { Body, Button } from '@/components/ui';
import { canUseAi, Usage } from '@/lib/api';

/** Free AI uses left and paid credits, with a way to buy more once both run out. */
export function UsageLine({ usage }: { usage: Usage | null }) {
  if (!usage) return null;
  return (
    <>
      <Body secondary>
        최근 30일 AI 무료 사용량 {usage.used}/{usage.limit}회{usage.credits > 0 ? ` · 이용권 ${usage.credits}회 남음` : ''}
      </Body>
      {!canUseAi(usage) ? (
        <Button variant="secondary" label="AI 이용권 사기" onPress={() => router.push('/credits')} />
      ) : null}
    </>
  );
}
