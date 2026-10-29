import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, ChoiceRow, CopyBlock, Danger, Field, Screen, Section, Toggle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AiError, explainRejection, fetchUsage, isAiConfigured, Usage } from '@/lib/api';
import { useProject } from '@/lib/projects';
import { RejectionNote, STORE_LABELS, StoreId } from '@/lib/types';

const WHERE_TO_PASTE: Record<StoreId, string> = {
  apple: 'App Store Connect > 앱 > 앱 심사(Resolution Center)의 메시지',
  google: 'Play Console > 정책 상태(또는 받은 이메일)의 거부 사유',
  microsoft: 'Partner Center > 제출 > 인증 보고서의 실패 사유',
};

export default function RejectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { project, update } = useProject(id);
  const theme = useTheme();
  const [store, setStore] = useState<StoreId>(project?.stores[0] ?? 'apple');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsage().then(setUsage);
  }, []);

  if (!project) return <Screen><Body>앱을 찾을 수 없어요.</Body></Screen>;

  const notes = project.rejections ?? [];
  const shownId = openId ?? notes[0]?.id ?? null;
  const setNotes = (next: RejectionNote[]) => update({ rejections: next });

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await explainRejection(project, store, message.trim());
      const note: RejectionNote = {
        id: `${Date.now().toString(36)}`,
        store,
        message: message.trim(),
        analysis: result.analysis,
        done: {},
        createdAt: new Date().toISOString(),
      };
      setNotes([note, ...notes]);
      setOpenId(note.id);
      setMessage('');
      if (result.usage) setUsage(result.usage);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      if (e instanceof AiError && e.usage) setUsage(e.usage);
    } finally {
      setLoading(false);
    }
  };

  const remove = (note: RejectionNote) =>
    Alert.alert('이 분석을 지울까요?', undefined, [
      { text: '취소', style: 'cancel' },
      { text: '지우기', style: 'destructive', onPress: () => setNotes(notes.filter((n) => n.id !== note.id)) },
    ]);

  const outOfQuota = usage !== null && usage.used >= usage.limit;

  return (
    <Screen>
      <Body secondary>
        스토어에서 받은 반려 메시지를 그대로 붙여 넣으면 왜 반려됐는지, 무엇을 고칠지, 심사관에게 어떻게 답할지 알려 드려요.
      </Body>

      {!isAiConfigured() ? (
        <Card style={{ borderLeftWidth: 4, borderLeftColor: Danger }}>
          <Body>AI 서버가 아직 연결되지 않았어요. README의 "서버 설정"을 따라 Supabase 주소와 키를 넣어 주세요.</Body>
        </Card>
      ) : null}

      <Section title="어느 스토어에서 반려됐나요?">
        <ChoiceRow
          options={project.stores.map((s) => ({ value: s, label: STORE_LABELS[s] }))}
          value={store}
          onChange={setStore}
        />
      </Section>

      <Field
        label="반려 메시지"
        hint={`찾는 곳: ${WHERE_TO_PASTE[store]}`}
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={20000}
        placeholder="예: Guideline 4.2 - Design - Minimum Functionality ..."
      />

      {usage ? (
        <Body secondary>
          최근 30일 AI 무료 사용량 {usage.used}/{usage.limit}회
        </Body>
      ) : null}
      <Button
        label="원인 분석하기"
        onPress={run}
        loading={loading}
        disabled={message.trim().length < 20 || outOfQuota}
      />
      {error ? <Body style={{ color: Danger }}>{error}</Body> : null}

      {notes.map((note) => {
        const a = note.analysis;
        const open = note.id === shownId;
        const doneCount = a.fixes.filter((_, i) => note.done[i]).length;
        return (
          <View key={note.id} style={{ gap: Spacing.three }}>
            <Pressable onPress={() => setOpenId(open ? '' : note.id)}>
              <Card style={{ gap: Spacing.one }}>
                <Text style={[styles.noteTitle, { color: theme.text }]}>
                  {STORE_LABELS[note.store]} · {new Date(note.createdAt).toLocaleDateString('ko-KR')}
                </Text>
                <Body>{a.summary}</Body>
                <Body secondary>
                  고칠 일 {doneCount}/{a.fixes.length} · {open ? '접기' : '자세히 보기'}
                </Body>
              </Card>
            </Pressable>

            {open ? (
              <>
                {a.guideline ? <Body secondary>관련 조항: {a.guideline}</Body> : null}

                <Section title="원인">
                  {a.causes.map((c, i) => (
                    <Card key={i} style={{ gap: Spacing.one }}>
                      <Body>{c.cause}</Body>
                      {c.evidence ? <Body secondary>“{c.evidence}”</Body> : null}
                    </Card>
                  ))}
                </Section>

                <Section title="고칠 일">
                  <Body secondary>
                    {a.needsNewBuild ? '앱을 고쳐서 새로 빌드해 올려야 해요.' : '새로 빌드하지 않고 콘솔이나 등록정보만 고치면 돼요.'}
                  </Body>
                  {a.fixes.map((f, i) => (
                    <Toggle
                      key={i}
                      label={`[${f.where}] ${f.action}`}
                      value={Boolean(note.done[i])}
                      onChange={(v) =>
                        setNotes(notes.map((n) => (n.id === note.id ? { ...n, done: { ...n.done, [i]: v } } : n)))
                      }
                    />
                  ))}
                </Section>

                <Section title="다음 단계">
                  <Card style={{ gap: Spacing.one }}>
                    <Text style={[styles.noteTitle, { color: theme.text }]}>{a.nextStep}</Text>
                    <Body secondary>{a.nextStepReason}</Body>
                  </Card>
                </Section>

                <Section title="심사관에게 보낼 답장">
                  <Body secondary>[대괄호] 부분은 직접 채워 넣고 보내세요. 영어로 보내고, 한국어는 내용 확인용이에요.</Body>
                  <CopyBlock label="영어 답장" text={a.replyEn} />
                  <CopyBlock label="한국어 번역" text={a.replyKo} />
                </Section>

                <Button variant="secondary" label="이 분석 지우기" onPress={() => remove(note)} />
              </>
            ) : null}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  noteTitle: { fontSize: 16, fontWeight: '600' },
});
