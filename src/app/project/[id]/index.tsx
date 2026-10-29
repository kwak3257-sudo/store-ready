import { Href, router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, Danger, Screen, Title } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { checklistProgress } from '@/lib/checklist';
import { useProject, useProjects } from '@/lib/projects';
import { STORE_LABELS } from '@/lib/types';

export default function ProjectHomeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { project, loaded } = useProject(id);
  const { deleteProject } = useProjects();
  const theme = useTheme();

  if (!project) return <Screen>{loaded ? <Body>앱을 찾을 수 없어요.</Body> : null}</Screen>;

  const { done, total } = checklistProgress(project);
  const steps: { title: string; detail: string; status: string; href: Href }[] = [
    {
      title: '1. 등록정보 만들기',
      detail: 'AI가 앱 이름, 설명, 키워드, 심사 메모를 한국어·영어로 써 드려요.',
      status: project.listing ? '완료' : '시작 전',
      href: { pathname: '/project/[id]/listing', params: { id: project.id } },
    },
    {
      title: '2. 개인정보처리방침',
      detail: '입력한 정보로 처리방침 초안을 만들어요. 웹에 올려 주소를 스토어에 넣으세요.',
      status: '바로 사용 가능',
      href: { pathname: '/project/[id]/privacy', params: { id: project.id } },
    },
    {
      title: '3. 스크린샷 만들기',
      detail: '앱 화면 캡처에 문구를 얹어 스토어 규격 이미지로 저장해요.',
      status: `${project.screenshots.length}장`,
      href: { pathname: '/project/[id]/screenshots', params: { id: project.id } },
    },
    {
      title: '4. 출시 체크리스트',
      detail: '스토어별로 해야 할 일과 반려되기 쉬운 부분을 순서대로 알려 드려요.',
      status: `${done}/${total}`,
      href: { pathname: '/project/[id]/checklist', params: { id: project.id } },
    },
    {
      title: '5. 반려됐을 때',
      detail: '받은 반려 메시지를 붙여 넣으면 원인, 고칠 일, 심사관 답장 초안을 알려 드려요.',
      status: project.rejections?.length ? `${project.rejections.length}건` : '필요할 때',
      href: { pathname: '/project/[id]/rejection', params: { id: project.id } },
    },
  ];

  return (
    <Screen>
      <View style={{ gap: Spacing.one }}>
        <Title>{project.name}</Title>
        <Body secondary>{project.stores.map((s) => STORE_LABELS[s]).join(' · ')}</Body>
      </View>

      {project.appKind !== 'native' && project.stores.includes('apple') ? (
        <Card style={{ borderLeftWidth: 4, borderLeftColor: Danger }}>
          <Body>웹사이트를 감싼 앱은 애플 심사에서 "최소 기능(4.2)" 사유로 자주 반려돼요. 체크리스트에서 대처 방법을 확인하세요.</Body>
        </Card>
      ) : null}

      <View style={{ gap: Spacing.two }}>
        {steps.map((s) => (
          <Pressable key={s.title} onPress={() => router.push(s.href)}>
            <Card style={{ gap: Spacing.one }}>
              <View style={styles.row}>
                <Text style={[styles.stepTitle, { color: theme.text }]}>{s.title}</Text>
                <Text style={{ color: theme.textSecondary }}>{s.status}</Text>
              </View>
              <Body secondary>{s.detail}</Body>
            </Card>
          </Pressable>
        ))}
      </View>

      <Button
        variant="secondary"
        label="앱 정보 수정"
        onPress={() => router.push({ pathname: '/project/[id]/edit', params: { id: project.id } })}
      />
      <Button
        variant="danger"
        label="이 앱 삭제"
        onPress={() =>
          Alert.alert('앱을 삭제할까요?', '만든 등록정보와 체크리스트도 함께 지워져요.', [
            { text: '취소', style: 'cancel' },
            {
              text: '삭제',
              style: 'destructive',
              onPress: () => {
                deleteProject(project.id);
                router.back();
              },
            },
          ])
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  stepTitle: { fontSize: 17, fontWeight: '700', flexShrink: 1 },
});
