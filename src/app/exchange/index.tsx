import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, ChoiceRow, Danger, Field, Screen, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import {
  checkIn,
  dayStreak,
  fetchMyApps,
  fetchMyGmail,
  fetchMyJoins,
  koreanDay,
  leaveApp,
  markInstalled,
  MyJoin,
  optInUrl,
  PACKAGE_PATTERN,
  registerApp,
  REQUIRED_DAYS,
  REQUIRED_TESTERS,
  saveGmail,
  storeUrl,
  testingProgress,
} from '@/lib/exchange';
import { useProjects } from '@/lib/projects';

export default function ExchangeScreen() {
  const userId = useAuth().session?.user.id ?? '';
  const theme = useTheme();
  const { projects } = useProjects();
  const googleProjects = projects.filter((p) => p.stores.includes('google'));

  const load = useCallback(
    async () => {
      const [gmail, apps, joins] = await Promise.all([fetchMyGmail(userId), fetchMyApps(userId), fetchMyJoins(userId)]);
      return { gmail, apps, joins };
    },
    [userId],
  );
  const { data, error, reload } = useLoad(load);

  const [gmailDraft, setGmailDraft] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [pkg, setPkg] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  if (!userId) return <Screen><Body>로그인하면 쓸 수 있어요.</Body></Screen>;

  const editingGmail = gmailDraft !== null || (data !== null && !data.gmail);
  const chosen = googleProjects.find((p) => p.id === projectId) ?? googleProjects[0];
  const today = koreanDay();
  const gives = data?.joins.filter((j) => j.status === 'installed').length ?? 0;

  return (
    <Screen>
      <Card style={{ gap: Spacing.one }}>
        <Body>
          2023년 11월 13일 이후 만든 개인 개발자 계정은 구글 플레이에 정식 출시하기 전에 테스터 {REQUIRED_TESTERS}명이{' '}
          {REQUIRED_DAYS}일 동안 계속 참여한 비공개 테스트를 해야 해요.
        </Body>
        <Body secondary>
          여기서는 개발자끼리 서로의 앱을 테스트해 줘요. 다른 앱을 많이 테스트할수록 내 앱이 목록 위쪽에 보여요.
        </Body>
      </Card>

      {error ? <Body style={{ color: Danger }}>불러오지 못했어요: {error}</Body> : null}
      {actionError ? <Body style={{ color: Danger }}>{actionError}</Body> : null}

      <Section title="테스트에 쓸 Gmail">
        {editingGmail ? (
          <>
            <Field
              label="휴대폰 플레이 스토어에 로그인된 Gmail"
              hint="내가 참여한 앱의 주인에게만 보여요. 주인이 이 주소를 테스터 명단에 넣어요."
              value={gmailDraft ?? data?.gmail ?? ''}
              onChangeText={setGmailDraft}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="example@gmail.com"
            />
            <Button
              label="저장"
              loading={busy === 'gmail'}
              disabled={!(gmailDraft ?? '').includes('@')}
              onPress={() => act('gmail', async () => {
                await saveGmail(gmailDraft ?? '');
                setGmailDraft(null);
              })}
            />
          </>
        ) : (
          <View style={styles.row}>
            <Body>{data?.gmail ?? '…'}</Body>
            <Pressable onPress={() => setGmailDraft(data?.gmail ?? '')}>
              <Text style={{ color: theme.textSecondary }}>바꾸기</Text>
            </Pressable>
          </View>
        )}
      </Section>

      <Section title="내 앱 테스터 모으기">
        {data?.apps.map((app) => {
          const progress = testingProgress(app.joins, app.needed, today);
          const waiting = app.joins.filter((j) => j.status === 'requested').length;
          return (
            <Pressable key={app.id} onPress={() => router.push({ pathname: '/exchange/[appId]', params: { appId: app.id } })}>
              <Card style={{ gap: Spacing.one }}>
                <Text style={[styles.name, { color: theme.text }]}>{app.name}</Text>
                <Body secondary>
                  테스터 {progress.testersNow}/{app.needed}명 · {app.needed}명 이상 연속 {progress.streak}/{REQUIRED_DAYS}일
                  {app.closed ? ' · 모집 중지' : ''}
                </Body>
                {progress.ready ? <Body>조건을 채웠어요! 플레이 콘솔에서 프로덕션 액세스를 신청하세요.</Body> : null}
                {waiting ? <Body style={{ color: Danger }}>명단에 넣어야 할 신청 {waiting}건</Body> : null}
              </Card>
            </Pressable>
          );
        })}

        {googleProjects.length === 0 ? (
          <Body secondary>구글 플레이에 낼 앱을 먼저 등록하면 여기서 테스터를 모을 수 있어요.</Body>
        ) : (
          <Card style={{ gap: Spacing.two }}>
            <Body>비공개 테스트 트랙을 만들고 앱을 한 번 올린 뒤에 등록하세요.</Body>
            {googleProjects.length > 1 ? (
              <ChoiceRow
                options={googleProjects.map((p) => ({ value: p.id, label: p.name }))}
                value={chosen?.id ?? ''}
                onChange={setProjectId}
              />
            ) : (
              <Body secondary>앱: {chosen?.name}</Body>
            )}
            <Field
              label="패키지 이름"
              hint="플레이 콘솔 앱 목록에 보이는 이름이에요."
              value={pkg}
              onChangeText={setPkg}
              autoCapitalize="none"
              placeholder="com.mycompany.myapp"
            />
            <Field
              label="테스터에게 한마디 (선택)"
              value={note}
              onChangeText={setNote}
              maxLength={500}
              placeholder="예: 하루에 한 번 물 마신 걸 기록해 주세요"
            />
            <Button
              label="테스터 모집 시작"
              loading={busy === 'register'}
              disabled={!chosen || !PACKAGE_PATTERN.test(pkg.trim())}
              onPress={() =>
                chosen &&
                act('register', async () => {
                  await registerApp(chosen.id, chosen.name, pkg.trim(), note.trim());
                  setPkg('');
                  setNote('');
                })
              }
            />
          </Card>
        )}
      </Section>

      <Section title="내가 테스트하는 앱">
        <Body secondary>지금 {gives}개 앱을 테스트하고 있어요.</Body>
        {data?.joins.map((j) => (
          <TestingCard key={j.id} join={j} today={today} busy={busy} act={act} />
        ))}
        <Button label="테스트할 앱 찾기" onPress={() => router.push('/exchange/browse')} />
      </Section>
    </Screen>
  );
}

function TestingCard({
  join,
  today,
  busy,
  act,
}: {
  join: MyJoin;
  today: string;
  busy: string | null;
  act: (key: string, fn: () => Promise<unknown>) => void;
}) {
  const theme = useTheme();
  const checkedToday = join.days.includes(today);
  const installedDays = join.installed_at
    ? Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${koreanDay(new Date(join.installed_at))}T00:00:00Z`)) / 86400000) + 1
    : 0;

  const leave = () =>
    Alert.alert('테스트를 그만둘까요?', '앱 주인의 14일 기간이 끊길 수 있어요. 14일이 지난 뒤에 그만두는 게 좋아요.', [
      { text: '계속하기', style: 'cancel' },
      { text: '그만두기', style: 'destructive', onPress: () => act(`leave-${join.id}`, () => leaveApp(join.id)) },
    ]);

  return (
    <Card style={{ gap: Spacing.two }}>
      <Text style={[styles.name, { color: theme.text }]}>{join.app.name}</Text>
      {join.app.note ? <Body secondary>“{join.app.note}”</Body> : null}

      {join.status === 'requested' ? (
        <Body>앱 주인이 내 Gmail을 테스터 명단에 넣기를 기다리는 중이에요. 명단에 들어가야 참여 링크가 열려요.</Body>
      ) : null}
      {join.status === 'added' ? (
        <Body>명단에 들어갔어요! 참여 링크에서 &quot;테스터 되기&quot;를 누르고 앱을 설치한 뒤 아래 버튼을 눌러 주세요.</Body>
      ) : null}
      {join.status === 'installed' ? (
        <Body>
          {installedDays}일째 테스트 중 · 연속 {dayStreak(join.days, today)}일 열어봄
          {installedDays >= REQUIRED_DAYS ? ' · 14일을 채웠어요' : ''}
        </Body>
      ) : null}

      {join.status === 'installed' ? (
        <>
          <Button
            label={checkedToday ? '오늘 확인 완료' : '오늘 열어봤어요'}
            disabled={checkedToday}
            loading={busy === `checkin-${join.id}`}
            onPress={() => act(`checkin-${join.id}`, () => checkIn(join.id))}
          />
          <Button variant="secondary" label="플레이 스토어에서 열기" onPress={() => Linking.openURL(storeUrl(join.app.package_name))} />
          <Button variant="secondary" label="그만두기" onPress={leave} />
        </>
      ) : (
        <>
          <Button variant="secondary" label="참여 링크 열기" onPress={() => Linking.openURL(optInUrl(join.app.package_name))} />
          <Button
            label="설치했어요"
            loading={busy === `install-${join.id}`}
            onPress={() => act(`install-${join.id}`, () => markInstalled(join.id))}
          />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
