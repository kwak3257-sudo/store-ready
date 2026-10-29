import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { AuthProvider, useAuth } from '@/lib/auth';
import { ProjectsProvider } from '@/lib/projects';

function RootStack() {
  const { ready, session, required } = useAuth();
  if (!ready) return null;
  const signedIn = !required || Boolean(session);

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="index" options={{ title: '스토어레디' }} />
        <Stack.Screen name="new" options={{ title: '새 앱 등록', presentation: 'modal' }} />
        <Stack.Screen name="project/[id]/index" options={{ title: '출시 준비' }} />
        <Stack.Screen name="project/[id]/edit" options={{ title: '앱 정보 수정' }} />
        <Stack.Screen name="project/[id]/listing" options={{ title: '등록정보 만들기' }} />
        <Stack.Screen name="project/[id]/privacy" options={{ title: '개인정보처리방침' }} />
        <Stack.Screen name="project/[id]/screenshots" options={{ title: '스크린샷 만들기' }} />
        <Stack.Screen name="project/[id]/checklist" options={{ title: '출시 체크리스트' }} />
        <Stack.Screen name="project/[id]/rejection" options={{ title: '반려 해결 도우미' }} />
        <Stack.Screen name="exchange/index" options={{ title: '구글 테스터 품앗이' }} />
        <Stack.Screen name="exchange/browse" options={{ title: '테스트할 앱 찾기' }} />
        <Stack.Screen name="exchange/[appId]" options={{ title: '내 앱 테스터' }} />
        <Stack.Screen name="credits" options={{ title: 'AI 이용권' }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ title: '스토어레디' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <ProjectsProvider>
          <RootStack />
        </ProjectsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
