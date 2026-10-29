import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';

import { Body, Button, Card, Danger, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchUsage, Usage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { billingSupported, useBilling } from '@/lib/billing';

export default function CreditsScreen() {
  const theme = useTheme();
  const userId = useAuth().session?.user.id ?? '';
  const [usage, setUsage] = useState<Usage | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchUsage().then(setUsage);
    }, []),
  );

  const { products, ready, busy, message, buy } = useBilling(userId, (credits) =>
    setUsage((u) => (u ? { ...u, credits } : u)),
  );

  return (
    <Screen>
      <Body secondary>
        AI 등록정보 만들기와 반려 분석은 30일마다 {usage?.limit ?? 5}회까지 무료예요. 그 뒤에는 이용권 1회가 쓰여요. 산 이용권은
        기간 제한 없이 쓸 수 있어요.
      </Body>

      {usage ? (
        <Card style={{ gap: Spacing.one }}>
          <Body>
            무료 {Math.max(0, usage.limit - usage.used)}회 남음 · 이용권 {usage.credits}회 남음
          </Body>
        </Card>
      ) : null}

      {!billingSupported ? (
        <Card style={{ borderLeftWidth: 4, borderLeftColor: Danger }}>
          <Body>
            {Platform.OS === 'web'
              ? '결제는 휴대폰 앱에서만 할 수 있어요.'
              : '결제는 스토어에서 받은 앱이나 개발용 빌드에서만 돼요. Expo Go에서는 결제 화면이 열리지 않아요.'}
          </Body>
        </Card>
      ) : null}

      {billingSupported && ready && products.length === 0 ? (
        <Body secondary>판매 중인 이용권이 없어요. 스토어 콘솔에 상품이 등록됐는지 확인해 주세요.</Body>
      ) : null}

      {products.map((p) => (
        <Card key={p.id} style={{ gap: Spacing.two }}>
          <Text style={[styles.name, { color: theme.text }]}>{p.title}</Text>
          {p.description ? <Body secondary>{p.description}</Body> : null}
          <Button label={`${p.displayPrice}에 사기`} loading={busy} onPress={() => buy(p.id)} />
        </Card>
      ))}

      {message ? <Body>{message}</Body> : null}

      <Body secondary>
        결제는 {Platform.OS === 'ios' ? '애플 앱스토어' : '구글 플레이'} 계정으로 처리되고, 환불은 스토어 정책을 따라요.
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 17, fontWeight: '700' },
});
