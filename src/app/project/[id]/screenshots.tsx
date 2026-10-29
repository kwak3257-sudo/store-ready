import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { ComponentRef, useRef, useState } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { Body, Button, Card, ChoiceRow, Danger, Field, Screen, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { discardPhotos, keepPhoto, photoUri } from '@/lib/photos';
import { useProject } from '@/lib/projects';
import { SCREENSHOT_LIMITS, SCREENSHOT_SIZES } from '@/lib/store-specs';
import { Screenshot } from '@/lib/types';

const BACKGROUNDS = ['#208AEF', '#111827', '#F97316', '#16A34A', '#9333EA', '#F5F5F4'];
const PREVIEW_WIDTH = 240;

function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 186;
}

export default function ScreenshotsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { project, update } = useProject(id);
  const sizes = SCREENSHOT_SIZES.filter((s) => project?.stores.includes(s.store));
  const [sizeKey, setSizeKey] = useState(sizes[0]?.key ?? SCREENSHOT_SIZES[0].key);
  const [exporting, setExporting] = useState(false);
  const [picking, setPicking] = useState(false);
  const frames = useRef<(ComponentRef<typeof View> | null)[]>([]);

  if (!project) return <Screen><Body>앱을 찾을 수 없어요.</Body></Screen>;

  const size = SCREENSHOT_SIZES.find((s) => s.key === sizeKey) ?? SCREENSHOT_SIZES[0];
  const previewHeight = Math.round((PREVIEW_WIDTH * size.height) / size.width);
  const bg = project.screenshotBackground;
  const textColor = isLight(bg) ? '#111827' : '#ffffff';
  const shots = project.screenshots;
  const limit = SCREENSHOT_LIMITS[size.store];

  const setShots = (next: Screenshot[]) => update({ screenshots: next });

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 1,
    });
    if (result.canceled) return;
    setPicking(true);
    try {
      const room = Math.max(0, 10 - shots.length);
      const kept = await Promise.all(result.assets.slice(0, room).map((a) => keepPhoto(a.uri)));
      setShots([...shots, ...kept]);
    } catch (e) {
      Alert.alert('사진을 가져오지 못했어요', e instanceof Error ? e.message : String(e));
    } finally {
      setPicking(false);
    }
  };

  const exportAll = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('휴대폰 앱에서만 저장할 수 있어요.');
      return;
    }
    setExporting(true);
    try {
      for (let i = 0; i < shots.length; i++) {
        const view = frames.current[i];
        if (!view) continue;
        // JPG because App Store screenshots must not have an alpha channel.
        const uri = await captureRef(view, { width: size.width, height: size.height, format: 'jpg', quality: 0.95 });
        await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: `${i + 1}번 스크린샷 저장` });
      }
    } catch (e) {
      Alert.alert('저장에 실패했어요', e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen>
      <Body secondary>
        앱 화면을 캡처한 사진을 고르고, 위에 들어갈 짧은 문구를 적으세요. 스토어 규격 크기의 이미지로 만들어 저장해요.
      </Body>

      <Section title="크기">
        <ChoiceRow
          options={(sizes.length ? sizes : SCREENSHOT_SIZES).map((s) => ({ value: s.key, label: s.label }))}
          value={sizeKey}
          onChange={setSizeKey}
        />
        {project.stores.includes('microsoft') ? (
          <Body secondary>MS 스토어는 윈도우 화면(가로) 스크린샷이 필요해서 여기서는 만들지 않아요.</Body>
        ) : null}
      </Section>

      <Section title="배경색">
        <View style={styles.swatches}>
          {BACKGROUNDS.map((c) => (
            <Pressable
              key={c}
              accessibilityLabel={`배경색 ${c}`}
              onPress={() => update({ screenshotBackground: c })}
              style={[styles.swatch, { backgroundColor: c, borderWidth: c === bg ? 3 : 1 }]}
            />
          ))}
        </View>
      </Section>

      <Button variant="secondary" label="앱 화면 사진 고르기" onPress={pick} loading={picking} />
      {shots.length > 0 && shots.length < limit.min ? (
        <Body style={{ color: Danger }}>이 스토어는 최소 {limit.min}장이 필요해요.</Body>
      ) : null}

      {shots.map((shot, i) => (
        <Card key={`${shot.localName ?? shot.uri}-${i}`} style={{ gap: Spacing.two }}>
          <View
            ref={(r) => {
              frames.current[i] = r;
            }}
            collapsable={false}
            style={[styles.frame, { width: PREVIEW_WIDTH, height: previewHeight, backgroundColor: bg }]}>
            <Text style={[styles.caption, { color: textColor }]} numberOfLines={3}>
              {shot.caption || '문구를 입력하세요'}
            </Text>
            <Image source={{ uri: photoUri(shot) }} style={styles.shot} resizeMode="contain" />
          </View>
          <Field
            label={`${i + 1}번 문구`}
            value={shot.caption}
            maxLength={40}
            placeholder="예: 버튼 한 번으로 물 마신 양 기록"
            onChangeText={(t) => setShots(shots.map((s, j) => (j === i ? { ...s, caption: t } : s)))}
          />
          <Button
            variant="secondary"
            label="빼기"
            onPress={() => {
              discardPhotos([shot]);
              setShots(shots.filter((_, j) => j !== i));
            }}
          />
        </Card>
      ))}

      {shots.length > 0 ? (
        <Button label={`${shots.length}장 저장하기 (${size.width}×${size.height})`} onPress={exportAll} loading={exporting} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  swatches: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  swatch: { width: 36, height: 36, borderRadius: 18, borderColor: '#9CA3AF' },
  frame: { alignSelf: 'center', alignItems: 'center', paddingTop: 22, paddingHorizontal: 14, overflow: 'hidden' },
  caption: { fontSize: 17, fontWeight: '800', textAlign: 'center', lineHeight: 22, marginBottom: 12 },
  shot: { flex: 1, width: '100%', borderRadius: 14 },
});
