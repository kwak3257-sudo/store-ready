import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { Body, Button, ChoiceRow, Field, Section, Toggle } from '@/components/ui';
import {
  APP_KIND_LABELS,
  AppKind,
  AppProject,
  DATA_USAGE_LABELS,
  DataUsage,
  EMPTY_DATA_USAGE,
  STORE_LABELS,
  StoreId,
} from '@/lib/types';

export type ProjectFormValues = Pick<
  AppProject,
  | 'name'
  | 'oneLiner'
  | 'features'
  | 'category'
  | 'targetUsers'
  | 'stores'
  | 'appKind'
  | 'dataUsage'
  | 'developerName'
  | 'contactEmail'
>;

const EMPTY: ProjectFormValues = {
  name: '',
  oneLiner: '',
  features: '',
  category: '',
  targetUsers: '',
  stores: ['google', 'apple'],
  appKind: 'native',
  dataUsage: EMPTY_DATA_USAGE,
  developerName: '',
  contactEmail: '',
};

export function ProjectForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: ProjectFormValues;
  submitLabel: string;
  onSubmit: (values: ProjectFormValues) => void;
}) {
  const [v, setV] = useState<ProjectFormValues>(initial ?? EMPTY);
  const set = <K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  const toggleStore = (store: StoreId, on: boolean) =>
    set('stores', on ? [...v.stores, store] : v.stores.filter((s) => s !== store));

  const submit = () => {
    if (!v.name.trim()) return Alert.alert('앱 이름을 입력해 주세요.');
    if (v.stores.length === 0) return Alert.alert('출시할 스토어를 하나 이상 골라 주세요.');
    onSubmit({ ...v, name: v.name.trim() });
  };

  return (
    <View style={{ gap: Spacing.four }}>
      <Section title="앱 소개">
        <Field label="앱 이름" value={v.name} onChangeText={(t) => set('name', t)} placeholder="예: 오늘의 물 마시기" maxLength={50} />
        <Field
          label="한 줄 소개"
          value={v.oneLiner}
          onChangeText={(t) => set('oneLiner', t)}
          placeholder="예: 하루 물 섭취량을 기록하고 알림을 보내 주는 앱"
        />
        <Field
          label="주요 기능"
          value={v.features}
          onChangeText={(t) => set('features', t)}
          multiline
          placeholder={'예:\n- 버튼 한 번으로 물 마신 양 기록\n- 2시간마다 알림\n- 주간 통계 그래프'}
          hint="실제로 있는 기능만 적어 주세요. 없는 기능을 적으면 심사에서 반려될 수 있어요."
        />
        <Field label="카테고리" value={v.category} onChangeText={(t) => set('category', t)} placeholder="예: 건강 및 피트니스" />
        <Field label="주요 사용자" value={v.targetUsers} onChangeText={(t) => set('targetUsers', t)} placeholder="예: 물을 잘 안 마시는 직장인" />
      </Section>

      <Section title="출시할 스토어">
        {(Object.keys(STORE_LABELS) as StoreId[]).map((s) => (
          <Toggle key={s} label={STORE_LABELS[s]} value={v.stores.includes(s)} onChange={(on) => toggleStore(s, on)} />
        ))}
      </Section>

      <Section title="앱을 만든 방식">
        <ChoiceRow<AppKind>
          options={(Object.keys(APP_KIND_LABELS) as AppKind[]).map((k) => ({ value: k, label: APP_KIND_LABELS[k] }))}
          value={v.appKind}
          onChange={(k) => set('appKind', k)}
        />
        <Body secondary>바이브 코딩으로 만든 웹사이트를 앱으로 감쌌다면 "웹뷰"를 고르세요. 애플 심사 위험을 미리 알려 드려요.</Body>
      </Section>

      <Section title="앱이 사용하는 정보">
        {(Object.keys(DATA_USAGE_LABELS) as (keyof DataUsage)[]).map((k) => (
          <Toggle
            key={k}
            label={DATA_USAGE_LABELS[k]}
            value={v.dataUsage[k]}
            onChange={(on) => set('dataUsage', { ...v.dataUsage, [k]: on })}
          />
        ))}
        <Body secondary>개인정보처리방침과 데이터 보안 양식에 쓰여요. 광고·분석 SDK가 모으는 정보도 포함해 주세요.</Body>
      </Section>

      <Section title="개발자 정보">
        <Field label="개발자 이름 (개인 또는 회사)" value={v.developerName} onChangeText={(t) => set('developerName', t)} />
        <Field
          label="연락 이메일"
          value={v.contactEmail}
          onChangeText={(t) => set('contactEmail', t)}
          keyboardType="email-address"
          autoCapitalize="none"
          hint="스토어에 공개되고 개인정보처리방침에 들어가요."
        />
      </Section>

      <Button label={submitLabel} onPress={submit} />
    </View>
  );
}
