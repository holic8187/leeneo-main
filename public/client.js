const API_URL = "https://leeneo-main.onrender.com";

// ========================
// 로그인 버튼 연결
// ========================
document.getElementById("loginBtn").addEventListener("click", login);

// ========================
// 로그인 함수
// ========================
async function login() {
  console.log("로그인 클릭됨");

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  if (!username || !password) {
    alert("아이디와 비밀번호를 입력하세요");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    console.log(data);

    if (!res.ok) {
      alert(data.msg || "로그인 실패");
      return;
    }

    // ✅ 토큰 저장
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    // ✅ 화면 전환
    showGame(data.user);

  } catch (err) {
    console.error(err);
    alert("서버 연결 실패");
  }
}

// ========================
// 게임 화면 표시
// ========================
function showGame(user) {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("game-screen").classList.remove("hidden");

  updateUI(user.gameState);
  startAnimation();
}

// ========================
// UI 업데이트
// ========================
function updateUI(state) {
  document.getElementById("money").textContent = state.money.toLocaleString();
  document.getElementById("level").textContent = state.level;
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

function startAnimation() {
  const animEl = document.getElementById("anim-display");
  let currentAnim = animations[Math.floor(Math.random() * animations.length)];
  let frame = 0;

  setInterval(() => {
    animEl.textContent = currentAnim[frame];
    frame = (frame + 1) % currentAnim.length;
  }, 500);
}

// ========================
// 자동 로그인
// ========================
window.addEventListener("load", () => {
  const user = localStorage.getItem("user");

  if (user) {
    showGame(JSON.parse(user));
  }
});