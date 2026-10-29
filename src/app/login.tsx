import { useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Danger, Field, Screen, Title } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

export default function LoginScreen() {
  const { sendCode, verifyCode } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: Spacing.two }}>
        <Title>로그인</Title>
        <Body secondary>이메일로 받은 6자리 코드로 로그인해요. 처음이면 자동으로 가입돼요.</Body>
      </View>

      <Field
        label="이메일"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        editable={!sent}
        placeholder="you@example.com"
      />

      {sent ? (
        <>
          <Field
            label="인증 코드"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
            hint={`${email}로 보낸 메일의 6자리 코드를 입력하세요.`}
          />
          <Button
            label="로그인"
            loading={loading}
            disabled={code.trim().length < 6}
            onPress={() => run(() => verifyCode(email.trim(), code.trim()))}
          />
          <Button
            variant="secondary"
            label="이메일 다시 입력"
            onPress={() => {
              setSent(false);
              setCode('');
            }}
          />
        </>
      ) : (
        <Button
          label="코드 받기"
          loading={loading}
          disabled={!email.includes('@')}
          onPress={() => run(async () => {
            await sendCode(email.trim());
            setSent(true);
          })}
        />
      )}

      {error ? <Body style={{ color: Danger }}>{error}</Body> : null}
    </Screen>
  );
}
