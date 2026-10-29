import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Card, ChoiceRow, CopyBlock, Danger, Screen, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { fetchUsage, generateListing, isListingApiConfigured, ListingError, Usage } from '@/lib/api';
import { useProject } from '@/lib/projects';
import { TEXT_LIMITS } from '@/lib/store-specs';

type Lang = 'ko' | 'en';

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { project, update } = useProject(id);
  const [lang, setLang] = useState<Lang>('ko');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    fetchUsage().then(setUsage);
  }, []);

  if (!project) return <Screen><Body>앱을 찾을 수 없어요.</Body></Screen>;

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateListing(project);
      update({ listing: result.listing });
      if (result.usage) setUsage(result.usage);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      if (e instanceof ListingError && e.usage) setUsage(e.usage);
    } finally {
      setLoading(false);
    }
  };

  const listing = project.listing;
  const l = listing?.[lang];

  return (
    <Screen>
      <Body secondary>
        입력한 앱 정보로 스토어에 붙여 넣을 글을 만들어요. 1분 정도 걸릴 수 있어요. 결과는 꼭 읽어 보고, 실제와 다른 내용은 고쳐서 쓰세요.
      </Body>

      {!isListingApiConfigured() ? (
        <Card style={{ borderLeftWidth: 4, borderLeftColor: Danger }}>
          <Body>AI 서버가 아직 연결되지 않았어요. README의 "서버 설정"을 따라 Supabase 주소와 키를 넣어 주세요.</Body>
        </Card>
      ) : null}

      {usage ? (
        <Body secondary>
          최근 30일 무료 사용량 {usage.used}/{usage.limit}회
        </Body>
      ) : null}
      <Button
        label={listing ? '다시 만들기' : '등록정보 만들기'}
        onPress={run}
        loading={loading}
        disabled={usage !== null && usage.used >= usage.limit}
      />
      {error ? <Body style={{ color: Danger }}>{error}</Body> : null}

      {listing && l ? (
        <>
          <ChoiceRow<Lang>
            options={[
              { value: 'ko', label: '한국어' },
              { value: 'en', label: '영어' },
            ]}
            value={lang}
            onChange={setLang}
          />
          <Section title="공통">
            <CopyBlock label="앱 이름" text={l.title} limit={TEXT_LIMITS.googleTitle} />
            <CopyBlock label="자세한 설명" text={l.fullDescription} limit={TEXT_LIMITS.googleFullDescription} />
          </Section>
          {project.stores.includes('google') ? (
            <Section title="구글 플레이">
              <CopyBlock label="간단한 설명" text={l.shortDescription} limit={TEXT_LIMITS.googleShortDescription} />
            </Section>
          ) : null}
          {project.stores.includes('apple') ? (
            <Section title="애플 앱스토어">
              <CopyBlock
                label="부제"
                text={lang === 'ko' ? listing.appleSubtitleKo : listing.appleSubtitleEn}
                limit={TEXT_LIMITS.appleSubtitle}
              />
              <CopyBlock label="키워드 (쉼표로 구분)" text={l.keywords.join(',')} limit={TEXT_LIMITS.appleKeywords} />
              <CopyBlock label="심사 메모 (App Review Information)" text={listing.reviewNotes} />
            </Section>
          ) : null}
          <Section title="데이터 보안·개인정보 라벨 초안">
            <Body secondary>참고용 초안이에요. 실제로 쓰는 SDK가 모으는 정보까지 직접 확인해야 하고, 작성 책임은 개발자에게 있어요.</Body>
            <View style={{ gap: Spacing.two }}>
              {listing.dataSafety.map((d) => (
                <Card key={d.dataType}>
                  <Body>
                    {d.dataType}: 수집 {d.collected ? '예' : '아니오'} · 공유 {d.shared ? '예' : '아니오'}
                  </Body>
                  <Body secondary>{d.purpose}</Body>
                </Card>
              ))}
            </View>
          </Section>
        </>
      ) : null}
    </Screen>
  );
}
