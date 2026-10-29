import { useLocalSearchParams } from 'expo-router';

import { Body, CopyBlock, Screen } from '@/components/ui';
import { buildPrivacyPolicy } from '@/lib/privacy-policy';
import { useProject } from '@/lib/projects';

export default function PrivacyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { project } = useProject(id);
  if (!project) return <Screen><Body>앱을 찾을 수 없어요.</Body></Screen>;

  return (
    <Screen>
      <Body secondary>
        세 스토어 모두 개인정보처리방침 웹 주소가 필요해요. 아래 글을 복사해 노션이나 깃허브 페이지 같은 곳에 공개로 올리고, 그 주소를 스토어에 넣으세요. 법률 자문이 아니니 내용을 꼭 확인하세요.
      </Body>
      <CopyBlock label="개인정보처리방침 (마크다운)" text={buildPrivacyPolicy(project)} />
    </Screen>
  );
}
