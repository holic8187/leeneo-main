const API_URL = "https://leeneo-main.onrender.com";

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

// 로그인 시 랜덤 선택
let currentAnim = animations[Math.floor(Math.random() * animations.length)];

let frame = 0;

setInterval(() => {
  document.getElementById("anim-display").textContent = currentAnim[frame];
  frame = (frame + 1) % currentAnim.length;
}, 500);