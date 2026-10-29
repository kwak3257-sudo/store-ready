import * as Clipboard from 'expo-clipboard';
import { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const Accent = '#208AEF';
export const Danger = '#D93025';

export function Screen({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.title, { color: theme.text }]}>{children}</Text>;
}

export function Body({ children, secondary, style }: { children: ReactNode; secondary?: boolean; style?: object }) {
  const theme = useTheme();
  return (
    <Text style={[styles.body, { color: secondary ? theme.textSecondary : theme.text }, style]}>{children}</Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.backgroundElement }, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const bg = variant === 'primary' ? Accent : variant === 'danger' ? Danger : theme.backgroundSelected;
  const fg = variant === 'secondary' ? theme.text : '#ffffff';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  ...input
}: TextInputProps & { label: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.one }}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.backgroundElement },
          input.multiline && { minHeight: 96, textAlignVertical: 'top' },
        ]}
        {...input}
      />
      {hint ? <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={styles.toggleRow}>
      <View style={[styles.box, { borderColor: value ? Accent : theme.textSecondary, backgroundColor: value ? Accent : 'transparent' }]}>
        {value ? <Text style={styles.check}>✓</Text> : null}
      </View>
      <Text style={[styles.body, { color: theme.text, flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}

export function ChoiceRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ gap: Spacing.two }}>
      {options.map((o) => (
        <Toggle key={o.value} label={o.label} value={o.value === value} onChange={() => onChange(o.value)} />
      ))}
    </View>
  );
}

/** A labeled block of generated text with a character count and a copy button. */
export function CopyBlock({ label, text, limit }: { label: string; text: string; limit?: number }) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const over = limit !== undefined && text.length > limit;
  return (
    <Card style={{ gap: Spacing.two }}>
      <View style={styles.copyHeader}>
        <Text style={[styles.label, { color: theme.text, flex: 1 }]}>{label}</Text>
        <Text style={[styles.hint, { color: over ? Danger : theme.textSecondary }]}>
          {text.length}
          {limit !== undefined ? ` / ${limit}자` : '자'}
        </Text>
      </View>
      <Text selectable style={[styles.body, { color: theme.text }]}>
        {text}
      </Text>
      <Button
        variant="secondary"
        label={copied ? '복사했어요' : '복사'}
        onPress={async () => {
          await Clipboard.setStringAsync(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      />
    </Card>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.two }}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: Spacing.three, paddingBottom: Spacing.six },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.four },
  title: { fontSize: 26, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22 },
  label: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 12, lineHeight: 17 },
  card: { borderRadius: 14, padding: Spacing.three },
  button: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: Spacing.three, alignItems: 'center' },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 4 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  check: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  copyHeader: { flexDirection: 'row', alignItems: 'center' },
});
