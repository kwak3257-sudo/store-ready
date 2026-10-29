import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Body, Button, Card, Danger, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { useTheme } from '@/hooks/use-theme';
import { fetchBoard, joinApp } from '@/lib/exchange';

export default function BrowseScreen() {
  const theme = useTheme();
  const load = useCallback(() => fetchBoard(), []);
  const { data, error, reload } = useLoad(load);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const join = async (appId: string) => {
    setBusy(appId);
    setActionError(null);
    try {
      await joinApp(appId);
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Body secondary>
        참여하면 앱 주인에게 내 Gmail이 전달돼요. 주인이 명단에 넣으면 &quot;내가 테스트하는 앱&quot;에서 참여 링크를 열 수 있어요.
        다른 사람을 많이 돕는 개발자의 앱이 위에 보여요.
      </Body>
      {error ? <Body style={{ color: Danger }}>불러오지 못했어요: {error}</Body> : null}
      {actionError ? <Body style={{ color: Danger }}>{actionError}</Body> : null}
      {data && data.length === 0 ? <Body secondary>지금은 테스터를 찾는 앱이 없어요.</Body> : null}
      {data?.map((app) => (
        <Card key={app.id} style={{ gap: Spacing.one }}>
          <Text style={[styles.name, { color: theme.text }]}>{app.name}</Text>
          <Body secondary>
            테스터 {app.testers}/{app.needed}명 · 주인이 테스트 중인 앱 {app.owner_gives}개
          </Body>
          {app.note ? <Body secondary>“{app.note}”</Body> : null}
          <Button
            label={app.joined ? '참여 중' : '테스트 참여하기'}
            variant={app.joined ? 'secondary' : 'primary'}
            disabled={app.joined}
            loading={busy === app.id}
            onPress={() => join(app.id)}
          />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 17, fontWeight: '700' },
});
