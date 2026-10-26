import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { ProjectsProvider } from '@/lib/projects';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ProjectsProvider>
        <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
          <Stack.Screen name="index" options={{ title: '스토어레디' }} />
          <Stack.Screen name="new" options={{ title: '새 앱 등록', presentation: 'modal' }} />
          <Stack.Screen name="project/[id]/index" options={{ title: '출시 준비' }} />
          <Stack.Screen name="project/[id]/edit" options={{ title: '앱 정보 수정' }} />
          <Stack.Screen name="project/[id]/listing" options={{ title: '등록정보 만들기' }} />
          <Stack.Screen name="project/[id]/privacy" options={{ title: '개인정보처리방침' }} />
          <Stack.Screen name="project/[id]/screenshots" options={{ title: '스크린샷 만들기' }} />
          <Stack.Screen name="project/[id]/checklist" options={{ title: '출시 체크리스트' }} />
        </Stack>
      </ProjectsProvider>
    </ThemeProvider>
  );
}
