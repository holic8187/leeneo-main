// ========================
// 서버 URL 설정
// ========================
// 로컬 테스트 시 아래 주석을 해제하고 사용하세요.
// const API_URL = "http://localhost:5000";

// 배포된 서버 URL (로컬 테스트 시에는 주석 처리하는 것이 좋습니다)
const API_URL = "https://leeneo-main.onrender.com";


// ========================
// 로그인 버튼 연결
// ========================
const loginBtn = document.getElementById("loginBtn");
if (loginBtn) {
  loginBtn.addEventListener("click", login);
  console.log("로그인 버튼 이벤트 리스너 연결 성공");
} else {
  console.error("로그인 버튼을 찾을 수 없습니다.");
}


// ========================
// 로그인 함수
// ========================
async function login() {
  console.log("로그인 함수 시작 - 버튼 클릭됨");

  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");

  if (!usernameInput || !passwordInput) {
    console.error("아이디 또는 비밀번호 입력창을 찾을 수 없습니다.");
    return;
  }

  const username = usernameInput.value;
  const password = passwordInput.value;

  console.log(`입력된 아이디: ${username}, 비밀번호: ${password ? "***" : "없음"}`);

  if (!username || !password) {
    alert("아이디와 비밀번호를 입력하세요");
    return;
  }

  console.log(`서버로 요청 보냄: ${API_URL}/api/login`);

  try {
    const res = await fetch(`${API_URL}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    console.log("서버 응답 받음. 상태 코드:", res.status);

    const data = await res.json();
    console.log("서버 응답 데이터:", data);

    if (!res.ok) {
      // 근무 시간이 아닌 경우 등 서버에서 에러 메시지를 보낸 경우
      alert(data.msg || "로그인 실패");
      
      // 근무 시간 설정이 필요한 초기 유저의 경우 처리 (추후 구현 필요)
      if (data.code === 'MK_WORK_HOUR_NOT_SET') { // 예시 코드
          // 근무 시간 설정 화면으로 이동시키는 로직 추가
      }
      return;
    }

    // ✅ 토큰 및 유저 정보 저장
    localStorage.setItem("token", data.token);
    // 편의를 위해 전체 유저 데이터를 저장하지만, 보안상 중요한 정보는 제외하는 것이 좋습니다.
    localStorage.setItem("user", JSON.stringify(data.user));

    console.log("로그인 성공! 게임 화면으로 전환합니다.");

    // ✅ 화면 전환
    showGame(data.user);

  } catch (err) {
    console.error("로그인 처리 중 에러 발생:", err);
    alert(`서버 연결 실패: ${err.message}. 서버가 실행 중인지 확인해주세요.`);
  }
}

// ========================
// 게임 화면 표시
// ========================
function showGame(user) {
  const loginScreen = document.getElementById("login-screen");
  const gameScreen = document.getElementById("game-screen");

  if (loginScreen && gameScreen) {
    loginScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    updateUI(user.gameState);
    startAnimation();
  } else {
    console.error("화면 전환에 필요한 요소를 찾을 수 없습니다.");
  }
}

// ========================
// UI 업데이트
// ========================
function updateUI(state) {
  // 요소가 존재하는지 확인 후 값 업데이트
  const moneyEl = document.getElementById("money");
  if (moneyEl) moneyEl.textContent = state.money.toLocaleString();

  const levelEl = document.getElementById("level");
  if (levelEl) levelEl.textContent = state.level;
  
  // ... 다른 UI 요소 업데이트 코드 추가 ...
}

// ========================
// 애니메이션
// ========================
const animations = [
  [
    "  O   \n /|\\  [PC]\n / \\ ",
    " \\O   \n  |\\  [PC]\n / \\ "
  ],
  [
    "  O   \n /|\\  [서류]\n / \\ ",
    "  O   \n /|\\  ...\n / \\ "
  ]
];

let animationInterval;

function startAnimation() {
  const animEl = document.getElementById("anim-display");
  if (!animEl) return;

  if (animationInterval) clearInterval(animationInterval); // 기존 인터벌 제거

  let currentAnim = animations[Math.floor(Math.random() * animations.length)];
  let frame = 0;

  animationInterval = setInterval(() => {
    animEl.textContent = currentAnim[frame];
    frame = (frame + 1) % currentAnim.length;
  }, 500);
}

// ========================
// 자동 로그인
// ========================
window.addEventListener("load", () => {
  console.log("페이지 로드 완료. 자동 로그인 시도...");
  const userStr = localStorage.getItem("user");
  const token = localStorage.getItem("token");

  if (userStr && token) {
    try {
        const user = JSON.parse(userStr);
        console.log("저장된 유저 정보 발견. 자동 로그인 진행.");
        // 실제로는 토큰 유효성 검사를 서버에 요청해야 합니다.
        // 여기서는 간단히 저장된 정보로 화면을 전환합니다.
        showGame(user);
    } catch (e) {
        console.error("저장된 유저 정보 파싱 실패:", e);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
    }
  } else {
      console.log("저장된 로그인 정보 없음.");
  }
});

// 탭 전환 함수 (index.html에 onclick으로 연결되어 있음)
window.showTab = function(tabName) {
    // 모든 탭 컨텐츠 숨기기
    document.querySelectorAll('.menu-content').forEach(el => el.classList.add('hidden'));
    // 모든 탭 버튼 비활성화
    document.querySelectorAll('.menu-tabs button').forEach(el => el.classList.remove('active'));

    // 선택된 탭 컨텐츠 보이기
    const selectedContent = document.getElementById(`tab-${tabName}`);
    if (selectedContent) selectedContent.classList.remove('hidden');

    // 선택된 탭 버튼 활성화 (event.target을 이용하거나 버튼에 ID를 부여해서 처리)
    // 여기서는 간단하게 구현하기 위해 생략하거나 추가 구현이 필요합니다.
    // 예시: 클릭된 버튼에 active 클래스 추가
    const clickedBtn = document.querySelector(`.menu-tabs button[onclick="showTab('${tabName}')"]`);
    if (clickedBtn) clickedBtn.classList.add('active');
}