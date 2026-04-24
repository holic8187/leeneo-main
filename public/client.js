// ========================
// 환경 설정 및 전역 변수
// ========================
// 로컬 테스트 시 아래 주석을 해제하세요.
const API_URL = "http://localhost:5000";
// 배포 서버 URL (로컬 테스트 시 주석 처리)
//const API_URL = "https://leeneo-main.onrender.com";

console.log("🚀 client.js 파일이 로드되었습니다. API URL:", API_URL);

// ========================
// 초기화 (페이지 로드 완료 후 실행)
// ========================
// DOMContentLoaded 이벤트는 HTML 구조가 다 읽혔을 때 발생합니다.
document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ DOMContentLoaded 이벤트 발생: HTML이 모두 로드되었습니다.");
    initGame();
});

function initGame() {
    console.log("🎮 게임 초기화 시작...");

    // 1. 로그인 버튼 연결
    const loginBtn = document.getElementById("loginBtn");
    if (loginBtn) {
        // 중복 연결 방지를 위해 기존 리스너 제거 후 추가
        loginBtn.removeEventListener("click", handleLoginClick);
        loginBtn.addEventListener("click", handleLoginClick);
        console.log("👍 '출근하기' 버튼(loginBtn)을 찾아 클릭 이벤트를 연결했습니다.");
    } else {
        console.error("❌ 오류: 'loginBtn'이라는 ID를 가진 버튼을 찾을 수 없습니다. HTML을 확인해주세요.");
        alert("치명적 오류: 로그인 버튼을 찾을 수 없어 게임을 시작할 수 없습니다.");
    }

    // 2. 자동 로그인 시도
    tryAutoLogin();
}

// ========================
// 로그인 처리 함수
// ========================
async function handleLoginClick(event) {
    // 폼 제출로 인한 페이지 새로고침 방지
    if (event) event.preventDefault();

    console.log("🖱️ '출근하기' 버튼 클릭됨! 로그인 절차를 시작합니다.");

    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");

    if (!usernameInput || !passwordInput) {
        console.error("❌ 오류: 아이디 또는 비밀번호 입력 필드를 찾을 수 없습니다.");
        return;
    }

    const username = usernameInput.value.trim(); // 공백 제거
    const password = passwordInput.value;

    console.log(`입력된 정보 - ID: '${username}', PW: ${password ? '입력됨' : '비어있음'}`);

    if (!username || !password) {
        alert("아이디와 비밀번호를 모두 입력해주세요.");
        console.warn("⚠️ 로그인 실패: 아이디 또는 비밀번호 미입력");
        return;
    }

    console.log(`📤 서버로 로그인 요청 전송 중... (POST ${API_URL}/api/login)`);

    try {
        const res = await fetch(`${API_URL}/api/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        });

        console.log("📩 서버로부터 응답을 받았습니다. 상태 코드:", res.status);

        const data = await res.json();
        console.log("서버 응답 데이터:", data);

        if (!res.ok) {
            // 로그인 실패 (비밀번호 틀림, 근무 시간 아님 등)
            throw new Error(data.msg || `로그인 실패 (코드: ${res.status})`);
        }

        // 로그인 성공 처리
        console.log("🎉 로그인 성공!");
        processLoginSuccess(data);

    } catch (err) {
        console.error("🔥 로그인 처리 중 에러 발생:", err);
        alert(`로그인에 실패했습니다.\n\n이유: ${err.message}`);
        
        // 특수 에러 코드 처리 (예: 근무 시간 미설정)
        if (err.code === 'NOT_WORKING_HOUR') {
            console.log("근무 시간이 아님. 초기 화면 유지.");
        }
    }
}

// 로그인 성공 시 후속 처리
function processLoginSuccess(data) {
    // 토큰 및 유저 정보 저장
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    console.log("🔑 토큰 및 유저 정보가 로컬 스토리지에 저장되었습니다.");

    alert(`${data.user.username} 사원님, 오늘도 힘내세요!`);

    // 화면 전환
    showGameScreen(data.user);
}


// ========================
// 자동 로그인 기능
// ========================
function tryAutoLogin() {
    console.log("🔄 자동 로그인 시도 중...");
    const userStr = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    if (userStr && token) {
        try {
            const user = JSON.parse(userStr);
            console.log(`✅ 저장된 정보 발견. ${user.username} 계정으로 자동 로그인합니다.`);
            // TODO: 실제 서비스에서는 토큰 유효성 검증 API 호출 필요
            showGameScreen(user);
        } catch (e) {
            console.error("❌ 저장된 유저 정보가 손상되었습니다:", e);
            localStorage.removeItem("user");
            localStorage.removeItem("token");
        }
    } else {
        console.log("ℹ️ 저장된 로그인 정보가 없습니다. 수동 로그인이 필요합니다.");
    }
}


// ========================
// 화면 전환 및 UI 업데이트
// ========================
function showGameScreen(user) {
    console.log("🖥️ 게임 화면으로 전환합니다.");
    const loginScreen = document.getElementById("log