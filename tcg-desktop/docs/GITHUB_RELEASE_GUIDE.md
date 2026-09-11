# GitHub Releases 배포 가이드

이 문서는 호이 카드 데스크를 처음 배포하는 사람도 그대로 따라 할 수 있도록 서버 준비부터 GitHub Release 확인, 자동 업데이트 검증, 문제 발생 시 대응까지 설명합니다.

현재 배포 구조는 다음과 같습니다.

1. 계정 서버가 회원가입·로그인 API와 데이터베이스를 제공합니다.
2. GitHub Actions가 데스크톱 앱에 계정 서버의 공개 주소를 포함해 Windows 설치 파일을 만듭니다.
3. GitHub Releases가 설치 파일과 자동 업데이트 메타데이터를 배포합니다.
4. 설치된 앱은 실행할 때 GitHub Releases를 확인하고 더 높은 버전이 있으면 자동으로 적용합니다.

호이상사 계정 연동은 이 배포와 무관하며 추후 별도로 구현합니다.

## 1. 준비 사항

다음 항목이 필요합니다.

- `holic8187/leeneo-main` 저장소에 코드를 올리고 설정을 변경할 수 있는 GitHub 권한
- 인터넷에서 HTTPS로 접근할 수 있는 계정 서버
- 계정 서버가 사용할 MongoDB 연결 문자열
- Windows 설치 확인에 사용할 별도 PC 또는 Windows 사용자 계정

배포용 EXE를 Git 저장소에 직접 커밋하지 않습니다. `tcg-desktop/release`, `tcg-desktop/dist`, `tcg-desktop/node_modules`, `tcg-desktop/.env`는 `.gitignore`에서 제외됩니다. GitHub Actions가 태그의 소스로 결과물을 다시 만들고 Release에 게시합니다.

### 공개 저장소에 남은 기존 `.env` 먼저 처리하기

현재 저장소의 루트 `.env`는 과거 커밋부터 Git에 추적되어 있습니다. 공개 저장소에 한 번 올라간 비밀값은 파일을 지우는 것만으로 안전해지지 않습니다. **배포 태그를 만들기 전에** 다음 순서로 처리합니다.

1. MongoDB에서 기존 계정의 비밀번호를 교체하거나 새 최소 권한 계정을 만들고 기존 자격증명을 폐기합니다.
2. `JWT_SECRET`과 `TCG_JWT_SECRET`을 각각 새 임의값으로 교체합니다. 둘은 서로 다른 값이어야 하며 32자 이상이어야 합니다.
3. 새 값은 서버 호스팅 서비스의 비밀 환경변수와 로컬 `.env`에만 입력합니다.
4. 저장소에는 값이 없는 `.env.example`만 커밋합니다.
5. 통합 브랜치에서 `git rm --cached .env`를 한 번 실행해 로컬 파일은 유지하면서 Git 추적을 해제하고, 삭제 변경을 커밋합니다.
6. 이미 공개된 과거 이력은 GitHub의 [민감한 데이터 제거 안내](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)에 따라 별도로 정리합니다. 이력 정리보다 자격증명 교체를 먼저 해야 합니다.

이번 변경의 `.gitignore`는 루트 `.env`와 데스크톱의 모든 `.env*` 파일을 제외하고, 안전한 `tcg-desktop/.env.example`만 허용합니다.

## 2. 계정 서버 환경변수 설정

계정 서버를 운영하는 서비스의 환경변수 화면에서 다음 값을 설정합니다. Render, Railway, Fly.io, 자체 서버 등 어느 환경에서도 의미는 같습니다.

| 이름 | 필수 여부 | 예시 | 설명 |
| --- | --- | --- | --- |
| `NODE_ENV` | 운영 필수 | `production` | 운영 보안 검사를 활성화합니다. |
| `MONGO_URI` | 필수 | `mongodb+srv://...` | MongoDB 연결 문자열 |
| `JWT_SECRET` | 운영 필수 | 32자 이상의 임의 문자열 | 기존 웹 서버 인증 서명키 |
| `TCG_JWT_SECRET` | 운영 필수 | 별도의 32자 이상 임의 문자열 | TCG 로그인 토큰 전용 서명키 |
| `TCG_JWT_EXPIRES_IN` | 선택 | `7d` | TCG 로그인 토큰 유효기간. 기본값은 `7d`입니다. |
| `TRUST_PROXY_HOPS` | 프록시 환경 필수 | `1` | 앱 서버 앞의 신뢰할 HTTPS 프록시 수. 직접 연결이면 비워 둡니다. |

`MONGO_URI`, `JWT_SECRET`, `TCG_JWT_SECRET`은 비밀값입니다. GitHub Repository Variable, `VITE_TCG_API_BASE`, 데스크톱 `.env`, 문서, 커밋에 입력하지 마세요. 서버 호스팅 서비스의 Secret 또는 Environment Variables 기능에만 저장합니다. 운영 모드에서는 두 JWT 비밀키 중 하나라도 없거나 32자보다 짧으면 서버가 기동을 중단합니다.

Render·Railway처럼 HTTPS 리버스 프록시 뒤에서 실행한다면 해당 서비스의 네트워크 구조를 확인한 뒤 보통 `TRUST_PROXY_HOPS=1`을 설정합니다. 이 설정으로 로그인 횟수 제한이 프록시 한 대가 아니라 실제 사용자 IP별로 적용됩니다. 프록시가 여러 겹이면 실제 신뢰할 홉 수를 사용합니다.

PowerShell에서 64바이트 임의 비밀키를 만들려면 다음 명령을 실행할 수 있습니다. 출력된 값을 서버 설정 화면에 직접 복사하고 파일로 저장하지 않습니다.

```powershell
$secretBytes = New-Object byte[] 64
$secretGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
$secretGenerator.GetBytes($secretBytes)
[Convert]::ToBase64String($secretBytes)
$secretGenerator.Dispose()
```

서버를 다시 배포한 뒤 다음 인증 경로가 같은 HTTPS origin에서 제공되는지 확인합니다.

```text
POST /api/tcg/auth/check-availability
POST /api/tcg/auth/register
POST /api/tcg/auth/login
GET  /api/tcg/auth/me
```

예를 들어 서버 주소가 `https://api.example.com`이면 앱에 넣을 주소는 `https://api.example.com`입니다. `/api/tcg` 같은 경로나 마지막 `/`를 붙이지 않습니다.

## 3. 로컬에서 계정 연결 확인

처음 한 번 다음과 같이 예시 환경 파일을 복사합니다.

```powershell
Set-Location tcg-desktop
Copy-Item .env.example .env
```

로컬 서버를 기본 포트로 실행한다면 `.env`를 다음과 같이 둡니다.

```env
VITE_TCG_API_BASE=http://127.0.0.1:5000
VITE_HOI_API_BASE=
```

`VITE_HOI_API_BASE`는 추후 호이상사 연동용으로 예약된 값이며 현재 배포에서는 비워 둡니다.

`VITE_`로 시작하는 값은 Vite가 앱 코드에 포함하므로 사용자가 설치 파일에서 확인할 수 있습니다. 이곳에는 공개 서버 주소만 넣고 JWT 서명키, MongoDB 주소, 관리자 키를 절대 넣지 않습니다.

## 4. GitHub Repository Variable 등록

운영 설치 파일이 올바른 서버로 연결되도록 GitHub에 공개 API 주소를 등록합니다.

1. GitHub에서 `holic8187/leeneo-main` 저장소를 엽니다.
2. **Settings**를 선택합니다.
3. 왼쪽 메뉴에서 **Secrets and variables → Actions**를 선택합니다.
4. **Variables** 탭을 선택합니다.
5. **New repository variable**을 선택합니다.
6. Name에 `TCG_API_BASE`를 입력합니다.
7. Value에 운영 서버의 HTTPS origin을 입력합니다. 예: `https://api.example.com`
8. **Add variable**을 선택합니다.

이 값은 비밀이 아니며 GitHub Actions가 `VITE_TCG_API_BASE`라는 이름으로 Windows 앱 빌드에 전달합니다. 워크플로는 값이 비어 있거나 HTTPS 절대 주소가 아니면 배포를 중단합니다.

같은 저장소의 **Settings → Actions → General**에서 다음 항목도 확인합니다.

- Actions 사용이 허용되어 있어야 합니다.
- **Workflow permissions**에서 GitHub Actions가 저장소 콘텐츠를 쓸 수 있어야 합니다.

워크플로 자체에도 `contents: write` 권한이 선언되어 있습니다. 실행 중 `Resource not accessible by integration` 오류가 나오면 저장소 또는 조직의 Actions 권한 제한을 확인합니다.

`GH_TOKEN`이나 개인 액세스 토큰을 직접 만들 필요는 없습니다. 워크플로가 GitHub에서 자동 발급하는 `GITHUB_TOKEN`을 게시 과정에 사용합니다.

현재 자동 업데이트기는 이 저장소에서 GitHub가 지정한 **최신 공개 Release**를 확인합니다. `holic8187/leeneo-main`의 공개 Release는 TCG 데스크톱 배포 전용으로 운영하고, 서버 코드 버전 표시는 일반 Git 태그만 사용합니다. 나중에 다른 프로그램도 GitHub Releases로 배포해야 한다면 TCG 전용 Release 저장소를 만든 뒤 `tcg-desktop/package.json`의 `publish.owner`와 `publish.repo`를 그 저장소로 변경합니다.

## 5. 버전 결정과 사전 검증

앱 버전의 기준은 `tcg-desktop/package.json`의 `version`입니다. 현재 모험 보상·오프라인 완료·시작 버튼 수정 배포 버전은 `0.4.2`입니다.

이후 수정 배포는 다음처럼 항상 더 높은 버전을 사용합니다.

- 버그 수정: `0.4.2` → `0.4.3`
- 호환되는 기능 추가: `0.4.2` → `0.5.0`
- 큰 호환성 변경: 안정화 이후 주 버전 증가 검토

pnpm의 lockfile v9는 앱 자체의 버전을 별도 필드로 저장하지 않습니다. 의존성을 바꾸지 않고 앱 버전만 올릴 때 `pnpm-lock.yaml`에 버전 변경이 생기지 않는 것이 정상입니다. 의존성을 추가하거나 변경한 경우에는 반드시 `pnpm install`로 lockfile을 함께 갱신합니다.

태그를 만들기 전에 프로젝트 루트에서 다음 명령을 실행합니다.

```powershell
pnpm -C tcg-desktop install --frozen-lockfile
pnpm -C tcg-desktop test
pnpm -C tcg-desktop build:web
pnpm -C tcg-desktop dist:win
```

모두 성공한 뒤 `tcg-desktop/release`에서 다음 파일을 확인합니다.

```text
Hoi-Card-Desk-0.4.2-x64.exe
Hoi-Card-Desk-0.4.2-x64.exe.blockmap
latest.yml
```

`latest.yml`의 `version`도 `0.4.2`이어야 합니다. 로컬 `release` 폴더는 확인용이며 Git에 추가하지 않습니다.

## 6. 변경사항 커밋과 병합

현재 저장소에는 서로 다른 작업이 함께 있을 수 있으므로 `git add .` 대신 배포할 경로를 명시적으로 추가합니다.

```powershell
git status --short
git rm --cached -- .env
git add -- .gitignore .env.example .github/workflows/tcg-desktop-release.yml tcg-desktop
git diff --cached --name-status
git diff --cached --stat
```

이번 계정 서버 구현은 `server.js`, 루트 `package.json`, `src/tcg`, `test/tcg`도 사용합니다. `git diff`로 내용을 확인한 뒤 다음처럼 경로를 명시해 추가합니다.

```powershell
git add -- server.js package.json .env.v2.example src/tcg test/tcg
git diff --cached --name-status
```

`.env`, 개인 키, MongoDB 연결 문자열, 생성된 EXE가 staged 목록에 없어야 합니다.

배포 브랜치에서 커밋하고 GitHub에 올립니다.

```powershell
git commit -m "feat: add TCG accounts and GitHub release"
git push -u origin HEAD
```

GitHub에서 Pull Request를 만들고 검토 후 `main`에 병합합니다. 태그는 작업 브랜치가 아니라 최종적으로 병합된 `main` 커밋에 만들어야 합니다.

현재 작업 폴더가 원격보다 뒤처졌거나 다른 미완료 변경으로 지저분하다면 그 상태에서 `git pull`, rebase, 태그 생성을 진행하지 않습니다. 먼저 변경사항을 별도 브랜치에 안전하게 커밋한 뒤 최신 `origin/main`에서 통합합니다.

## 7. 배포 태그 생성

Pull Request가 `main`에 병합된 뒤 깨끗한 작업 폴더에서 다음 명령을 실행합니다.

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
$tcgVersion = node -p "require('./tcg-desktop/package.json').version"
Write-Output $tcgVersion
git tag -a "tcg-v$tcgVersion" -m "Hoi Card Desk $tcgVersion"
git push origin "tcg-v$tcgVersion"
```

버전이 `0.4.2`이면 만들어지는 태그는 정확히 `tcg-v0.4.2`이어야 합니다. `v0.4.2`, `tcg-0.4.2`, `tcg-v0.4`는 사용하지 않습니다.

워크플로와 electron-builder 모두 `tcg-v` 접두사를 사용합니다. 태그와 `package.json` 버전이 다르면 워크플로의 검증 단계가 설치 파일을 만들기 전에 실패합니다.

## 8. GitHub Actions 확인

1. GitHub 저장소에서 **Actions**를 선택합니다.
2. 왼쪽에서 **TCG Desktop Release**를 선택합니다.
3. 방금 올린 `tcg-v0.4.2` 실행을 엽니다.
4. `windows-release` 작업이 녹색 체크로 끝날 때까지 기다립니다.
5. 실패했다면 붉게 표시된 첫 단계를 열어 오류를 확인합니다.

대표적인 오류는 다음과 같습니다.

| 오류 | 확인할 내용 |
| --- | --- |
| 태그 불일치 | 태그가 `tcg-v` + `package.json` 버전인지 확인 |
| `TCG_API_BASE is required` | Repository Variable 이름과 값 확인 |
| HTTPS URL 오류 | 값이 `https://`로 시작하는 origin인지 확인 |
| `Resource not accessible by integration` | Actions의 콘텐츠 쓰기 권한 확인 |
| `frozen-lockfile` 오류 | 의존성 변경 후 `pnpm-lock.yaml`이 커밋되었는지 확인 |
| 게시자 관련 Windows 경고 | 코드 서명 인증서가 없는 초기 배포에서 예상되는 동작 |

코드 수정 없이 네트워크 등 일시적인 문제로 실패했다면 같은 실행 화면에서 **Re-run all jobs**를 선택할 수 있습니다. 소스 수정이 필요하다면 이미 공개한 태그를 다른 커밋으로 옮기지 말고 더 높은 패치 버전을 준비합니다.

## 9. GitHub Release 검증과 배포

Actions가 성공하면 저장소의 **Releases**에서 `tcg-v0.4.2` Release를 엽니다. 다음 세 파일이 모두 있어야 합니다.

```text
Hoi-Card-Desk-0.4.2-x64.exe
Hoi-Card-Desk-0.4.2-x64.exe.blockmap
latest.yml
```

- EXE는 신규 설치와 수동 업데이트에 사용합니다.
- `.blockmap`은 변경 부분을 효율적으로 내려받는 데 사용합니다.
- `latest.yml`은 최신 버전, 파일명, 크기, 해시를 알려 주는 자동 업데이트 메타데이터입니다.

세 파일 중 하나라도 없다면 Release 링크를 배포하지 말고 Actions 로그를 확인합니다. 자동 업데이트를 사용할 때 EXE만 별도로 올려서는 안 됩니다.

다른 Windows PC에서 Release의 EXE를 내려받아 다음 항목을 확인합니다.

1. 설치 위치 선택 화면이 정상적으로 나타나는지 확인합니다.
2. 바탕 화면과 시작 메뉴 바로가기가 만들어지는지 확인합니다.
3. 앱을 실행하고 새 계정으로 회원가입합니다.
4. 로그아웃 후 같은 계정으로 다시 로그인합니다.
5. 앱을 완전히 종료하고 다시 실행해 로그인 상태가 복원되는지 확인합니다.
6. 카드, 코인, 카드팩 등 기존 로컬 기록이 유지되는지 확인합니다.

초기 배포에는 Windows 코드 서명이 없으므로 SmartScreen 또는 ‘알 수 없는 게시자’ 경고가 표시될 수 있습니다. 설치 파일이 GitHub의 공식 Release에서 내려받은 것인지 확인한 뒤 진행하도록 사용자에게 안내합니다. 공개 배포 규모가 커지면 Windows 코드 서명 인증서를 Actions에 연결하는 것을 권장합니다.

저장소와 Release는 공개 상태를 유지해야 현재 자동 업데이트 방식이 인증 없이 작동합니다. 저장소를 비공개로 바꾸려면 별도의 업데이트 서버나 안전한 인증 다운로드 구조가 필요합니다. 사용자 앱에 GitHub 개인 토큰을 포함하면 안 됩니다.

## 10. 자동 업데이트 검증

자동 업데이트는 두 개의 서로 다른 버전이 있어야 실제로 검증할 수 있습니다.

1. 테스트 PC에 `0.4.1`을 설치합니다.
2. 작은 수정과 함께 `package.json`을 `0.4.2`로 올립니다.
3. 앞 단계와 동일하게 테스트하고 `tcg-v0.4.2` 태그를 배포합니다.
4. 테스트 PC에서 0.4.1 앱을 완전히 종료했다가 다시 실행합니다.
5. 앱이 업데이트를 확인하고 0.4.2를 내려받는지 확인합니다.
6. 다운로드 후 앱이 저장 상태를 반영하고 설치를 적용한 뒤 다시 실행되는지 확인합니다.
7. 앱에 표시되는 버전과 로그인 상태, 로컬 게임 기록이 유지되는지 확인합니다.

개발 모드에서는 자동 업데이트를 건너뜁니다. 반드시 GitHub Release에서 설치한 패키지 버전으로 확인합니다.

## 11. 문제 배포 중지와 복구

문제가 있는 Release를 발견하면 GitHub Releases에서 `latest.yml`을 포함한 해당 Release 전체를 삭제하는 것이 신규 다운로드와 추가 자동 업데이트를 확실히 중지하는 방법입니다. Release를 삭제해도 이미 다운로드되거나 설치된 파일까지 원격에서 회수할 수는 없습니다.

앱은 더 낮은 버전으로 자동 복귀하지 않도록 설정되어 있습니다. `0.4.1`에 문제가 있다면 `0.4.0`을 다시 최신으로 올리지 말고 수정한 `0.4.2`를 최대한 빨리 배포합니다. 이를 롤포워드 복구라고 합니다.

다음 원칙을 지킵니다.

- 공개된 버전 번호와 태그를 다른 내용으로 재사용하지 않습니다.
- 공개된 태그를 다른 커밋으로 강제로 옮기지 않습니다.
- Release 파일을 수동으로 일부만 교체하지 않습니다.
- 수정 사항은 테스트 후 더 높은 버전으로 다시 빌드합니다.
- 장애 원인과 영향을 Release 설명에 기록합니다.

아무 파일도 게시되지 않은 초기 Actions 실패라면 오류를 고친 뒤 Actions에서 같은 커밋의 작업을 재실행할 수 있습니다. 커밋 자체를 수정해야 한다면 새 패치 버전과 새 태그를 사용하는 편이 안전합니다.

## 12. 배포 체크리스트

- [ ] 운영 서버가 HTTPS로 실행 중이다.
- [ ] 공개되었던 MongoDB/JWT 자격증명을 교체하고 기존 값을 폐기했다.
- [ ] 루트 `.env`를 Git 추적에서 제거하고 과거 이력 정리 계획을 세웠다.
- [ ] 서버에 `NODE_ENV=production`, `MONGO_URI`, 32자 이상의 `JWT_SECRET`, 별도 `TCG_JWT_SECRET`이 비밀 환경변수로 설정되어 있다.
- [ ] 리버스 프록시 환경이면 올바른 `TRUST_PROXY_HOPS`를 설정했다.
- [ ] GitHub Repository Variable `TCG_API_BASE`가 운영 서버 origin과 일치한다.
- [ ] `package.json` 버전과 `tcg-v...` 태그가 정확히 일치한다.
- [ ] 테스트, 웹 빌드, Windows 설치 파일 빌드가 성공했다.
- [ ] `.env`, 비밀키, `release` 폴더가 커밋되지 않았다.
- [ ] Pull Request가 `main`에 병합되었다.
- [ ] GitHub Actions가 성공했다.
- [ ] Release에 EXE, blockmap, `latest.yml`이 모두 있다.
- [ ] 별도 Windows 환경에서 회원가입, 로그인, 재실행을 확인했다.
- [ ] 이전 설치본에서 새 버전으로 자동 업데이트되는지 확인했다.
- [ ] 호이상사 연동은 현재 배포 범위에서 제외되어 있다.

## GitHub 공식 참고 문서

- [GitHub Actions 변수 사용](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables)
- [GitHub Actions 워크플로 문법과 권한](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [GitHub Release 관리](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
- [실패한 Actions 작업 다시 실행](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)
