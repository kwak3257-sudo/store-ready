# store-ready (스토어레디)

앱스토어(구글 플레이·애플 앱스토어·MS 스토어) 출시 준비를 도와주는 모바일 앱입니다. Expo(React Native)로 만들었습니다.

## 1단계 기능

- **앱 정보 입력**: 앱 이름, 기능, 출시할 스토어, 만든 방식(네이티브/웹뷰/PWA), 사용하는 개인정보
- **등록정보 만들기**: AI(Claude)가 앱 이름·설명·키워드·애플 부제·심사 메모·데이터 보안 양식 초안을 한국어와 영어로 작성. 글자 수 제한 표시, 복사 버튼
- **개인정보처리방침**: 입력한 정보로 고정 템플릿 기반 초안 생성 (AI를 쓰지 않아 문구가 예측 가능)
- **스크린샷 만들기**: 앱 화면 캡처에 문구와 배경을 얹어 스토어 규격(구글 1080×1920, 아이폰 6.9인치 1320×2868, 6.1인치 1179×2556) JPG로 저장
- **출시 체크리스트**: 스토어별 단계, 반려되기 쉬운 단계 강조 (구글 테스터 12명·14일, 애플 4.2 웹뷰 반려 위험 등)

앱 데이터는 지금은 휴대폰 안(AsyncStorage)에만 저장됩니다. Supabase가 설정되면 이메일 코드로 로그인해야 앱을 쓸 수 있습니다.

## 실행

```bash
npm install
cp .env.example .env   # 서버 주소 입력
npx expo start         # Expo Go 앱으로 QR 코드 스캔
```

## 서버 설정 (로그인 + AI 등록정보)

Supabase가 로그인과 AI 서버를 맡습니다. Anthropic API 키는 서버에만 두고 앱에는 넣지 않습니다.

```bash
npx supabase login
npx supabase link --project-ref <프로젝트-ref>
npx supabase db push                                  # 사용량·앱 데이터 테이블, 스크린샷 저장소 만들기
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase secrets set FREE_MONTHLY_LIMIT=5         # 선택, 기본 5회
npx supabase functions deploy generate-listing
```

**이메일 코드 로그인 설정**: Supabase 대시보드의 Authentication > Emails > Templates > Magic Link 템플릿에 `{{ .Token }}`을 넣어야 메일에 6자리 코드가 나옵니다. 예: `<p>인증 코드: {{ .Token }}</p>`

`.env.example`을 `.env`로 복사하고 Supabase 주소와 publishable 키를 넣으세요. `.env`가 없으면 앱은 로그인 없이 휴대폰 안에서만 동작하고, AI 등록정보는 쓸 수 없습니다.

**사용량 제한**: 로그인한 사용자만 AI를 부를 수 있고, 한 사람당 최근 30일 `FREE_MONTHLY_LIMIT`회(기본 5회), 1분에 3회까지입니다. 성공한 생성만 셉니다.

**서버 저장**: 로그인하면 앱 데이터가 서버(`projects` 테이블)에 자동 저장되고, 고른 스크린샷 사진은 앱 전용 폴더에 복사된 뒤 서버(`screenshots` 저장소)에 백업됩니다. 인터넷이 없을 때도 그대로 쓸 수 있고, 다시 연결되면 마지막으로 고친 쪽 기준으로 맞춰집니다. 새 휴대폰에서 같은 이메일로 로그인하면 데이터와 사진을 내려받습니다. 처음 로그인하기 전에 만든 앱은 그 계정으로 옮겨지고, 다른 계정으로 로그인하면 휴대폰의 앱 목록이 비워집니다.

## 검사

```bash
npx tsc --noEmit
```
