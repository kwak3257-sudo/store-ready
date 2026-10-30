import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Card, Danger, Screen, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useProjects } from '@/lib/projects';

export default function AccountScreen() {
  const { session, signOut, deleteAccount } = useAuth();
  const { clearLocal } = useProjects();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();
      await clearLocal();
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDeleting(false);
    }
  };

  return (
    <Screen>
      <Section title="로그인 정보">
        <Body>{session?.user.email ?? '로그인하지 않았어요.'}</Body>
        <Button variant="secondary" label="로그아웃" onPress={signOut} />
      </Section>

      <Section title="회원 탈퇴">
        <Body secondary>
          탈퇴하면 이 계정의 모든 기록이 서버와 이 휴대폰에서 바로 지워지고 되돌릴 수 없어요. 등록한 앱 정보, 스크린샷 사진, 반려 분석, 테스터
          품앗이 기록, 남은 AI 이용권이 모두 사라져요.
        </Body>
        <Body secondary>
          남은 이용권은 탈퇴로 환불되지 않아요. 결제 환불은 구글 플레이나 애플 앱스토어의 구매 내역에서 신청해 주세요.
        </Body>

        {confirming ? (
          <Card style={{ gap: Spacing.two, borderLeftWidth: 4, borderLeftColor: Danger }}>
            <Body>정말 탈퇴할까요? 지운 기록은 다시 살릴 수 없어요.</Body>
            <View style={{ gap: Spacing.two }}>
              <Button variant="danger" label="탈퇴하고 모든 기록 지우기" loading={deleting} onPress={remove} />
              <Button variant="secondary" label="취소" disabled={deleting} onPress={() => setConfirming(false)} />
            </View>
          </Card>
        ) : (
          <Button variant="danger" label="회원 탈퇴" disabled={!session} onPress={() => setConfirming(true)} />
        )}
        {error ? <Body style={{ color: Danger }}>{error}</Body> : null}
      </Section>
    </Screen>
  );
}
