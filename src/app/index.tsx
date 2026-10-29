import { Link, router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, Screen, Title } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { checklistProgress } from '@/lib/checklist';
import { useProjects } from '@/lib/projects';
import { STORE_LABELS } from '@/lib/types';

export default function HomeScreen() {
  const { projects, loaded } = useProjects();
  const theme = useTheme();

  return (
    <Screen>
      <View style={{ gap: Spacing.two }}>
        <Title>앱 출시, 여기서 끝내세요</Title>
        <Body secondary>
          앱 정보를 한 번 입력하면 구글 플레이·애플 앱스토어·MS 스토어에 필요한 설명, 개인정보처리방침, 스크린샷, 체크리스트를 만들어 드려요.
        </Body>
      </View>

      <Button label="새 앱 등록하기" onPress={() => router.push('/new')} />

      {!loaded ? (
        <ActivityIndicator />
      ) : projects.length === 0 ? (
        <Body secondary>아직 등록한 앱이 없어요.</Body>
      ) : (
        <View style={{ gap: Spacing.two }}>
          {projects.map((p) => {
            const { done, total } = checklistProgress(p);
            return (
              <Link key={p.id} href={{ pathname: '/project/[id]', params: { id: p.id } }} asChild>
                <Pressable>
                  <Card style={{ gap: Spacing.one }}>
                    <Text style={[styles.name, { color: theme.text }]}>{p.name}</Text>
                    <Body secondary>{p.stores.map((s) => STORE_LABELS[s]).join(' · ')}</Body>
                    <Body secondary>
                      체크리스트 {done}/{total} 완료
                    </Body>
                  </Card>
                </Pressable>
              </Link>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 18, fontWeight: '700' },
});
