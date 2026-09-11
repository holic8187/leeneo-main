# 모바일 앱 빌드와 배포

카드부의 Windows 앱과 Android 앱은 `src`의 같은 화면과 게임 코드를 사용합니다. Android는 Capacitor가 Vite 결과물인 `dist`를 네이티브 앱으로 감싸며, 계정별 진행 기록은 운영 서버의 클라우드 저장을 사용합니다. iOS도 같은 코드를 사용하고 추후 macOS/Xcode에서 네이티브 프로젝트와 서명 설정만 추가합니다.

## Android 개발 빌드

필요한 환경은 Node.js 22 이상, pnpm 11.19.0, JDK 21, Android SDK 36입니다.

```powershell
cd tcg-desktop
pnpm install --frozen-lockfile
pnpm android:debug
```

디버그 APK는 다음 경로에 생성됩니다.

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

`VITE_TCG_API_BASE`에는 운영 TCG 서버의 HTTPS origin을 설정합니다. 이 값은 앱에 공개되는 서버 주소이므로 비밀키를 넣지 않습니다.

## GitHub Actions 배포

`.github/workflows/tcg-android-release.yml`은 수동 실행 시 테스트용 APK를 만들고, `tcg-android-v0.5.0`과 같은 태그가 올라오면 GitHub Release에도 결과물을 게시합니다. 태그 버전은 `tcg-desktop/package.json`의 버전과 정확히 같아야 합니다.

Repository Variable:

```text
TCG_API_BASE=https://leeneo-main.onrender.com
```

업데이트 가능한 정식 APK/AAB를 만들려면 같은 서명키를 계속 사용해야 합니다. 다음 Repository Secrets를 등록합니다.

```text
ANDROID_RELEASE_KEYSTORE_BASE64
ANDROID_RELEASE_KEYSTORE_PASSWORD
ANDROID_RELEASE_KEY_ALIAS
ANDROID_RELEASE_KEY_PASSWORD
```

네 값이 없을 때도 GitHub Actions artifact에 디버그 APK와 서명되지 않은 릴리스 결과가 생성됩니다. 태그 Release에는 설치 가능한 디버그 APK가 포함되지만, 이 파일은 새 설치를 위한 테스트용입니다. GitHub 실행 환경의 디버그 서명키는 빌드마다 달라질 수 있으므로 다음 디버그 APK나 정식 APK로 바로 덮어쓸 수 없습니다. 정식 배포와 이후 자동 업데이트에는 장기간 보관할 한 서명키로 만든 `android-release.apk`를 사용해야 합니다.

## 클라우드 기록 최초 이전

기존 사용자의 카드와 재화는 이전 PC 버전의 로컬 저장소에만 있습니다. 모바일에서 처음 로그인하기 전에 최신 Windows 앱으로 같은 계정에 한 번 로그인하면 PC 기록이 서버로 최초 이전됩니다. 서버 기록이 생긴 뒤에는 PC와 모바일 중 플레이 권한을 가진 한 기기만 기록을 수정합니다.

다른 기기에서 로그인하면 기존 플레이를 자동으로 빼앗지 않습니다. 새 기기에서 `다시 여기서 플레이하기`를 누르면 최신 서버 기록을 내려받고 플레이 권한을 가져옵니다. 이전 기기는 연결 확인 주기에 화면이 잠깁니다.

## 모바일 업데이트

Android 앱은 실행 및 화면 복귀 때 `tcg-android-v*` GitHub Release를 확인합니다. 정식 새 APK가 있으면 그 실행에서 한 번 자동으로 내려받아 Android 설치 확인 화면을 엽니다. 설치 권한을 허용하지 않았거나 설치를 취소했다면 앱의 `업데이트 받기` 버튼으로 다시 시작할 수 있습니다. Android 보안 정책상 최종 설치는 시스템 화면에서 사용자가 승인해야 합니다.

Google Play에 등록한 뒤에는 Play 인앱 업데이트 흐름으로 교체할 수 있습니다. iOS는 App Store 또는 TestFlight를 통해서만 실행 코드 업데이트를 배포합니다.
