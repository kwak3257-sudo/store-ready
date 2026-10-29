import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, Danger, Screen, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { useTheme } from '@/hooks/use-theme';
import {
  dayStreak,
  fetchOwnerApp,
  koreanDay,
  markAdded,
  OwnerJoin,
  REQUIRED_DAYS,
  setAppClosed,
  testingProgress,
} from '@/lib/exchange';

export default function OwnerAppScreen() {
  const { appId } = useLocalSearchParams<{ appId: string }>();
  const theme = useTheme();
  const load = useCallback(() => fetchOwnerApp(appId), [appId]);
  const { data, error, reload } = useLoad(load);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setActionError(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  if (error) return <Screen><Body style={{ color: Danger }}>불러오지 못했어요: {error}</Body></Screen>;
  if (!data) return <Screen><Body secondary>불러오는 중…</Body></Screen>;

  const { app, joins } = data;
  const today = koreanDay();
  const progress = testingProgress(joins, app.needed, today);
  const requested = joins.filter((j) => j.status === 'requested');
  const current = joins.filter((j) => j.status === 'added' || j.status === 'installed');
  const left = joins.filter((j) => j.status === 'left');
  const emails = [...requested, ...current].map((j) => j.gmail).filter(Boolean).join(', ');

  return (
    <Screen>
      <View style={{ gap: Spacing.one }}>
        <Text style={[styles.title, { color: theme.text }]}>{app.name}</Text>
        <Body secondary>{app.package_name}</Body>
      </View>

      <Card style={{ gap: Spacing.one }}>
        <Body>
          지금 설치한 테스터 {progress.testersNow}/{app.needed}명
        </Body>
        <Body>
          {app.needed}명 이상 연속 {progress.streak}/{REQUIRED_DAYS}일
        </Body>
        <Body secondary>
          {progress.ready
            ? '조건을 채웠어요! 플레이 콘솔 > 대시보드에서 프로덕션 액세스를 신청하세요.'
            : progress.daysLeft !== null
              ? `이대로 ${progress.daysLeft}일 더 유지하면 신청할 수 있어요.`
              : `${app.needed - progress.testersNow}명이 더 설치해야 14일 계산이 시작돼요.`}
        </Body>
        <Body secondary>테스터가 직접 누른 기록으로 센 예상치예요. 실제 기준은 플레이 콘솔의 숫자예요.</Body>
      </Card>

      {actionError ? <Body style={{ color: Danger }}>{actionError}</Body> : null}

      <Section title={`명단에 넣을 신청 ${requested.length}건`}>
        <Body secondary>
          플레이 콘솔 &gt; 테스트 &gt; 비공개 테스트 &gt; 테스터 탭의 이메일 목록에 주소를 넣고 저장한 뒤 &quot;넣었어요&quot;를 누르세요.
        </Body>
        {emails ? (
          <Button
            variant="secondary"
            label={copied ? '복사했어요' : '이메일 모두 복사 (쉼표로 구분)'}
            onPress={async () => {
              await Clipboard.setStringAsync(emails);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          />
        ) : null}
        {requested.map((j) => (
          <Card key={j.id} style={styles.row}>
            <Body>{j.gmail ?? '(주소 없음)'}</Body>
            <Button label="넣었어요" loading={busy === j.id} onPress={() => act(j.id, () => markAdded(j.id))} />
          </Card>
        ))}
      </Section>

      <Section title={`테스터 ${current.length}명`}>
        {current.map((j) => (
          <TesterRow key={j.id} join={j} today={today} />
        ))}
        {left.length ? <Body secondary>그만둔 사람 {left.length}명</Body> : null}
      </Section>

      <Button
        variant="secondary"
        label={app.closed ? '모집 다시 열기' : '새 신청 그만 받기'}
        loading={busy === 'close'}
        onPress={() => act('close', () => setAppClosed(app.id, !app.closed))}
      />
    </Screen>
  );
}

function TesterRow({ join, today }: { join: OwnerJoin; today: string }) {
  const lastDay = [...join.days].sort().at(-1);
  return (
    <Card style={{ gap: Spacing.one }}>
      <Body>{join.gmail ?? '(주소 없음)'}</Body>
      <Body secondary>
        {join.status === 'added'
          ? '명단에 넣음 · 설치 기다리는 중'
          : `설치함 · 연속 ${dayStreak(join.days, today)}일 열어봄${lastDay ? ` · 마지막 ${lastDay.slice(5)}` : ''}`}
      </Body>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700' },
  row: { gap: Spacing.two },
});
