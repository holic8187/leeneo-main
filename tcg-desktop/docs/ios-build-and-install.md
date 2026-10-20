# iPhone / iPad 앱 제작 및 설치

호이 카드 데스크 0.14.0부터 iOS 네이티브 프로젝트를 함께 관리합니다. 지원 버전은 **iOS / iPadOS 17 이상**입니다. PC·Android와 같은 게임 화면, 카드 데이터, 로그인 및 클라우드 저장 서버를 사용하며, 앱 식별자는 `com.hoicompany.carddesk`입니다.

## 현재 만들어진 것

- Capacitor 8.5.1, Swift Package Manager 기반 Xcode 프로젝트: `ios/App/App.xcodeproj`.
- iPhone과 iPad의 세로·가로 화면, 노치와 홈 표시줄의 안전 영역 대응.
- App / Browser / Preferences 플러그인 연결. 로그인과 진행 기록을 공유 앱의 클라우드 동기화 경로로 유지합니다.
- iOS `GameNotifications` 플러그인: 모험 완료 알림 권한, 알림 켜기·끄기, 22–06시 알림 지연, 알림 탭으로 앱 열기. 알림 예약은 iOS가 맡으므로 게임 화면을 닫아도 유지됩니다. OS 집중 모드·알림 요약 등 사용자의 설정은 그대로 따릅니다.
- 개인정보 매니페스트: 앱 설정 저장 API의 사용 목적과 계정 식별자·게임 진행 정보의 기능상 수집을 명시했습니다.
- GitHub Actions의 Mac 빌드: 게임 검사, Swift 알림 시간 계산 검사, iPhone 시뮬레이터 실행, 기기용 서명 없는 아카이브 생성.

현재 돌발 임무의 모바일 시스템 알림은 Android와 동일하게 지원 대상에서 제외되어 있으며, 모험 완료만 예약합니다. 서버에서 내려오는 신규 돌발 임무를 앱이 종료된 상태에서도 알리려면 별도 푸시 서버/APNs 연동이 필요합니다.

## 일반 Apple ID만 있는 경우

일반 Apple ID로는 **본인의 Mac과 Xcode에서 본인 iPhone에 개발용 앱을 설치**할 수 있습니다. Apple은 Personal Team의 앱 ID·기기 등록·프로비저닝을 7일 단위로 만료시키므로 다시 빌드하고 설치해야 합니다. TestFlight·App Store 배포에는 Apple Developer Program 가입이 필요합니다. [Apple 계정 안내](https://developer.apple.com/help/account/basics/about-your-developer-account)

Windows에서 프로젝트와 웹 게임을 만들고, GitHub의 Mac에서 빌드까지 확인할 수 있습니다. 하지만 시뮬레이터 `.app`이나 서명 없는 `.xcarchive`를 iPhone에 파일처럼 내려받아 설치할 수는 없습니다. 현재 계정 상태에서는 일반 사용자에게 배포 가능한 설치 링크를 만들 수 없습니다.

### 본인 Mac으로 개발용 설치

1. Xcode 26 이상을 설치하고 한 번 실행해 필요한 구성 요소를 설치합니다. Capacitor 8의 Xcode 요구 사항입니다. [Capacitor 개발 환경](https://capacitorjs.com/docs/getting-started/environment-setup)
2. Xcode → Settings → Accounts에서 본인 Apple ID로 로그인합니다. 비밀번호는 채팅이나 저장소에 적지 않습니다.
3. 저장소를 내려받고 `tcg-desktop`에서 다음 명령을 실행합니다.

   ```sh
   pnpm install --frozen-lockfile
   VITE_TCG_API_BASE=https://leeneo-main.onrender.com pnpm run ios:sync
   pnpm run ios:open
   ```

4. Xcode의 App 대상 → Signing & Capabilities에서 Automatically manage signing을 켜고 본인의 Personal Team을 선택합니다. 현재 Bundle Identifier가 다른 팀에서 이미 사용 중이면 **개인 테스트용으로만** 고유한 접미사를 붙입니다. 이 경우 다른 식별자의 앱과는 로컬 저장소가 분리되므로 동일 게임 계정으로 로그인해 클라우드 진행을 불러옵니다.
5. iPhone을 연결하고 기기에서 컴퓨터 신뢰와 개발자 모드를 허용합니다. Xcode 상단의 실행 기기로 본인 iPhone을 선택한 뒤 실행 버튼을 누릅니다.
6. 게임 계정으로 로그인하고, 요청되는 모험 완료 알림 권한을 허용합니다. 설정에서 야간 알림 중지 여부를 바꿀 수 있습니다.
7. 7일이 지나 앱이 실행되지 않으면 같은 Bundle Identifier와 계정으로 Xcode에서 다시 실행합니다.

## GitHub Mac 빌드

`.github/workflows/tcg-ios-build.yml`은 관련 Pull Request와 수동 실행에서 동작합니다. 서명용 비밀 값이 없어도 기본 검증은 전부 실행됩니다.

- `Hoi-Card-Desk-simulator.zip`: Mac의 iPhone Simulator용 앱입니다.
- `Hoi-Card-Desk-unsigned-archive.zip`: 실제 iPhone CPU용으로 컴파일된 **서명 없는 개발 산출물**입니다. iPhone 설치 파일이 아닙니다.
- `iphone-launch.png`: 시뮬레이터 초기 실행 화면입니다. 실제 기기의 로그인·알림 권한·동시 접속 전환 검증을 대신하지 않습니다.
- 빌드 로그: 컴파일 문제를 확인할 수 있습니다.

Windows에서는 `pnpm run ios:sync`까지 가능하지만 Swift 컴파일, Simulator, iPhone 설치는 macOS/Xcode에서 수행합니다. 생성된 프로젝트는 고정된 로컬 경로를 포함하지 않으며 다시 동기화해도 버전과 최소 iOS 17 설정을 유지합니다.

## Developer Program 가입 후 TestFlight 준비

1. Apple Developer Program 가입 후 App Store Connect에 `com.hoicompany.carddesk` 앱을 등록합니다.
2. Apple Distribution 인증서와 앱 전용 App Store 배포 프로비저닝 프로파일을 준비합니다.
3. GitHub 저장소의 Actions secrets에 아래 값을 저장합니다. 키·암호·인증서 원문은 저장소에 커밋하지 않습니다.

   | Secret | 값 |
   |---|---|
   | `IOS_DISTRIBUTION_CERTIFICATE_BASE64` | 개인 키를 포함한 Apple Distribution `.p12`의 Base64 |
   | `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD` | 해당 `.p12` 암호 |
   | `IOS_PROVISIONING_PROFILE_BASE64` | 위 앱 전용 App Store `.mobileprovision`의 Base64 |
   | `IOS_TEAM_ID` | Apple Developer 팀 ID |

4. **TCG iOS Build** 워크플로를 수동 실행하며 `signed_archive`를 켭니다. 유효한 서명 설정이 있는 경우에만 IPA를 내보냅니다. 자동으로 App Store Connect에 업로드하거나 공개하지는 않습니다.
5. 생성한 서명 IPA를 Mac의 Transporter 또는 Xcode Organizer로 App Store Connect에 업로드하고 TestFlight 테스터를 지정합니다. App Store 배포 IPA 역시 파일을 직접 눌러 설치하는 방식은 지원하지 않습니다.
6. TestFlight 초대 URL이 생기면 저장소 변수 `TCG_IOS_TESTFLIGHT_URL`을 설정합니다. App Store 공개 후에는 `TCG_IOS_APP_STORE_ID`를 설정하고 재빌드합니다. 웹 빌드에서는 각각 `VITE_TCG_IOS_TESTFLIGHT_URL`, `VITE_TCG_IOS_APP_STORE_ID` 이름을 사용합니다.

iOS 업데이트는 TestFlight 또는 App Store를 통해 전달합니다. 앱 내부에서 Android APK를 내려받거나 설치하지 않습니다. 설치 경로가 아직 설정되지 않은 개발 빌드는 배포 준비 안내를 표시합니다.

정식 심사 제출 전에는 개인정보처리방침 공개 주소와 App Store 개인정보 항목, 게임 계정 삭제 기능, 실제 기기의 로그인 복원·알림·구매 정책을 추가로 확인해야 합니다. iOS에서는 외부 계좌 이체 패키지 판매 버튼을 표시하지 않습니다. 이 문서는 서명/계정 준비가 완료되었다거나 Apple 심사를 통과했다는 의미가 아닙니다.

## 구현 참고

- [Capacitor iOS 사용자 플러그인 등록](https://capacitorjs.com/docs/ios/custom-code)
- [Preferences의 UserDefaults 사용 및 Privacy Manifest 요구](https://capacitorjs.com/docs/apis/preferences)
- [GitHub macOS 빌드 이미지](https://github.com/actions/runner-images)

알림 예약은 전달할 때마다 고유한 네이티브 식별자를 사용합니다. 권한 응답 또는 이전 예약의 완료 응답이 늦게 도착하더라도 새 예약·야간 지연 설정을 지우지 않습니다. 모험 완료 알림을 탭해 앱이 처음 실행되는 경우에도 초기 AppDelegate에서 이벤트를 보관하고 웹 화면이 준비된 뒤 전달합니다.
