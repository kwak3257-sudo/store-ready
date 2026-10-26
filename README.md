# store-ready (스토어레디)

앱스토어(구글 플레이·애플 앱스토어·MS 스토어) 출시 준비를 도와주는 모바일 앱입니다. Expo(React Native)로 만들었습니다.

## 1단계 기능

- **앱 정보 입력**: 앱 이름, 기능, 출시할 스토어, 만든 방식(네이티브/웹뷰/PWA), 사용하는 개인정보
- **등록정보 만들기**: AI(Claude)가 앱 이름·설명·키워드·애플 부제·심사 메모·데이터 보안 양식 초안을 한국어와 영어로 작성. 글자 수 제한 표시, 복사 버튼
- **개인정보처리방침**: 입력한 정보로 고정 템플릿 기반 초안 생성 (AI를 쓰지 않아 문구가 예측 가능)
- **스크린샷 만들기**: 앱 화면 캡처에 문구와 배경을 얹어 스토어 규격(구글 1080×1920, 아이폰 6.9인치 1320×2868, 6.1인치 1179×2556) JPG로 저장
- **출시 체크리스트**: 스토어별 단계, 반려되기 쉬운 단계 강조 (구글 테스터 12명·14일, 애플 4.2 웹뷰 반려 위험 등)

앱 데이터는 지금은 휴대폰 안(AsyncStorage)에만 저장됩니다.

## 실행

```bash
npm install
cp .env.example .env   # 서버 주소 입력
npx expo start         # Expo Go 앱으로 QR 코드 스캔
```

## 서버 설정 (등록정보 생성)

Anthropic API 키가 앱 안에 들어가지 않도록 Supabase Edge Function에서 Claude API를 부릅니다.

```bash
supabase functions deploy generate-listing
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

배포한 함수 주소와 anon 키를 `.env`에 넣으세요.

> 주의: 지금은 로그인이 없어서 anon 키만 있으면 누구나 함수를 부를 수 있습니다. 공개 출시 전에 Supabase 로그인과 사용량 제한을 붙여야 합니다.

## 검사

```bash
npx tsc --noEmit
```
