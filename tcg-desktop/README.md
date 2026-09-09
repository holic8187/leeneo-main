# 호이상사 외전: 월급루팡 카드부

독립 계정으로 이용하는 Windows 카드 수집 게임입니다. 호이상사 계정 연동은 추후 별도 기능으로 추가할 예정입니다.

## 현재 들어간 기능

- 신규 카드 76종과 기존 기록 호환 카드 8종
- C/U/R/RR/RRR/SR/HR/UR/SSR 9단계 등급, U 이상 보장, SR 이상 50팩 천장
- 카드 도감, 보유 수량, 상세 능력치와 고유 특성
- 카드 3장 편성 및 시간 기반 자동 모험
- 로컬 시범 비동기 레이드와 기여도 기록
- 앱을 숨긴 동안에도 동작하는 돌발 업무 60종(일반 92%·특수 7%·신화 1%, 12~24분 간격)
- Windows 알림 영역 상주와 선택지를 직접 고를 수 있는 우측 하단 알림창
- 회원가입, 로그인, 로그인 상태 복원
- 서버 계정과 로컬 게임 기록을 분리한 독립 플레이
- GitHub Releases 기반 자동 업데이트와 Windows 설치 파일 빌드

## 실행

Node.js와 pnpm이 설치된 환경에서 `tcg-desktop` 폴더를 기준으로 실행합니다.

```powershell
copy .env.example .env
pnpm install
pnpm dev
```

로컬 서버를 함께 실행할 때 `.env`의 `VITE_TCG_API_BASE`는 기본값인 `http://127.0.0.1:5000`을 사용합니다. 운영 설치 파일에는 GitHub Repository Variable `TCG_API_BASE`에 등록한 HTTPS 주소가 빌드 시 포함됩니다. `VITE_`로 시작하는 값은 설치 파일에서 확인할 수 있으므로 비밀키를 넣으면 안 됩니다.

브라우저 화면만 확인할 때는 다음 명령을 사용합니다.

```bash
pnpm dev:web
```

테스트와 웹 빌드:

```bash
pnpm test
pnpm build:web
```

Windows 설치 파일 생성:

```bash
pnpm dist:win
```

결과물은 `tcg-desktop/release`에 생성됩니다.

## 자동 업데이트

`tcg-v0.3.0`처럼 `tcg-v*` 형식의 태그를 GitHub에 푸시하면 `.github/workflows/tcg-desktop-release.yml`이 Windows 설치 파일과 업데이트 메타데이터를 GitHub Releases에 게시합니다. 태그는 `package.json`의 버전과 정확히 일치해야 하며, 다르면 배포가 중단됩니다. 설치된 앱은 실행할 때마다 새 릴리스를 확인합니다. 새 버전이 있으면 자동으로 내려받고, 진행 기록을 디스크에 저장한 뒤 업데이트를 설치하여 앱을 다시 실행합니다.

GitHub 배포 전에 Repository Variable `TCG_API_BASE`를 실제 인증 서버의 HTTPS origin으로 등록해야 합니다. Actions가 만드는 Release에는 설치 파일, blockmap, `latest.yml`이 함께 올라갑니다. 전체 준비 및 배포 순서는 [GitHub 배포 가이드](docs/GITHUB_RELEASE_GUIDE.md)를 참고하세요.

기존 `0.1.1`은 다운로드 직후 자동 재실행 기능이 없으므로 `0.3.0` 설치 파일은 한 번 직접 설치해야 합니다. 이후 버전부터 위 자동 적용 흐름을 사용합니다.

실제 배포 전에는 Windows 코드 서명 인증서를 CI에 연결하는 편이 좋습니다. 서명 없이도 설치 파일은 만들 수 있지만 Windows의 게시자 경고가 표시될 수 있습니다.

## 계정 서버 설정

데스크톱 앱은 `.env`의 `VITE_TCG_API_BASE`를 통해 회원가입·로그인 API에 연결합니다.

```env
VITE_TCG_API_BASE=https://api.example.com
```

인증 화면은 다음 엔드포인트를 사용합니다.

```http
POST /api/tcg/auth/check-availability
POST /api/tcg/auth/register
POST /api/tcg/auth/login
GET  /api/tcg/auth/me
```

운영 서버에는 `NODE_ENV=production`, `MONGO_URI`, 32자 이상의 `JWT_SECRET`, 그리고 별도의 32자 이상 `TCG_JWT_SECRET`을 설정합니다. `TCG_JWT_EXPIRES_IN`은 선택 항목이며 기본값은 `7d`입니다. Render·Railway처럼 프록시 뒤에서 실행하면 호스팅 구조에 맞는 `TRUST_PROXY_HOPS`도 설정합니다. 비밀값은 서버 환경변수에만 두고 데스크톱 `.env`, GitHub Repository Variable 또는 소스 코드에 넣지 않습니다.

공개 저장소 이력에 포함된 기존 루트 `.env`의 MongoDB/JWT 자격증명은 배포 전에 교체하고 폐기해야 합니다. 자세한 순서는 [GitHub 배포 가이드](docs/GITHUB_RELEASE_GUIDE.md)의 첫 번째 항목을 따릅니다.

호이상사 계정과 TCG 계정을 연결하는 기능은 이번 범위에 포함하지 않으며 추후 구현합니다.

## 코드 구역

- `electron`: 창, 알림 영역, 돌발 알림, 자동 업데이트
- `src/core`: 카드팩, 모험, 레이드, 로컬 저장 규칙
- `src/data`: 카드와 콘텐츠 정의
- `src/services`: 데스크톱 브리지와 계정 서버 어댑터
- `public/assets/cards`: 카드 원화
