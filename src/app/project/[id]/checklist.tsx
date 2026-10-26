import { useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Accent, Body, Card, Danger, Screen, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { buildChecklist, checklistProgress } from '@/lib/checklist';
import { useProject } from '@/lib/projects';
import { STORE_LABELS } from '@/lib/types';

export default function ChecklistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { project, update } = useProject(id);
  const theme = useTheme();
  if (!project) return <Screen><Body>앱을 찾을 수 없어요.</Body></Screen>;

  const { done, total } = checklistProgress(project);
  const toggle = (itemId: string) =>
    update({ checklist: { ...project.checklist, [itemId]: !project.checklist[itemId] } });

  return (
    <Screen>
      <Body secondary>
        {done}/{total} 완료. 빨간 표시는 첫 출시에서 자주 막히거나 반려되는 단계예요.
      </Body>
      {buildChecklist(project).map((section) => (
        <Section key={section.store} title={STORE_LABELS[section.store]}>
          {section.items.map((item) => {
            const checked = Boolean(project.checklist[item.id]);
            return (
              <Pressable key={item.id} onPress={() => toggle(item.id)} accessibilityRole="checkbox" accessibilityState={{ checked }}>
                <Card style={[styles.item, item.warning ? { borderLeftWidth: 4, borderLeftColor: Danger } : null]}>
                  <View style={[styles.box, { borderColor: checked ? Accent : theme.textSecondary, backgroundColor: checked ? Accent : 'transparent' }]}>
                    {checked ? <Text style={styles.check}>✓</Text> : null}
                  </View>
                  <View style={{ flex: 1, gap: Spacing.one }}>
                    <Text style={[styles.title, { color: theme.text, textDecorationLine: checked ? 'line-through' : 'none' }]}>
                      {item.title}
                    </Text>
                    <Body secondary>{item.detail}</Body>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </Section>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  check: { color: '#ffffff', fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '600' },
});
