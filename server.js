
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const app = express();
app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
  res.send('일해라 이네오 서버 정상 작동중 🚀');
});


// MongoDB 연결
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error(err));

// --- 헬퍼 함수들 ---

// 현재 시간이 근무 시간인지 확인 (한국 시간 기준)
function isWorkingHour(start, end) {
  // 서버 시간은 UTC이므로 한국 시간(KST, UTC+9)으로 변환 필요
  const now = new Date();
  const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const currentHour = kstNow.getUTCHours();

  if (start <= end) {
    return currentHour >= start && currentHour < end;
  } else {
    // 예: 22시부터 다음날 02시까지인 경우 (야근러...)
    return currentHour >= start || currentHour < end;
  }
}

// 오프라인 보상 계산 (핵심!)
function calculateOfflineGains(user) {
  const now = new Date();
  const lastTime = new Date(user.gameState.lastActionTime);
  const elapsedSeconds = (now - lastTime) / 1000;

  // 실제로는 근무 시간과 겹치는 시간만 계산해야 하지만, 프로토타입에서는 단순화합니다.
  // TODO: 근무 시간 중첩 계산 로직 구현 필요.

  // 1레벨 기준: 하루(86400초)에 200만원 -> 초당 약 23.1원
  // 1레벨 기준: 하루에 경험치 200 -> 초당 약 0.0023
  // 레벨업당 증가율 적용 필요.

  // 예시: 단순히 지난 시간만큼 약간의 보상 지급 (버그 방지용 최소치)
  const gainedMoney = Math.floor(elapsedSeconds * 10 * user.gameState.level); 
  const gainedExp = Math.floor(elapsedSeconds * 0.1 * user.gameState.level);

  user.gameState.money += gainedMoney;
  user.gameState.exp += gainedExp;
  user.gameState.lastActionTime = now;
  // 스트레스 증가 로직 등 추가 필요
}


// --- API 라우트 ---

// 로그인 및 회원가입 (자동 처리)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  let user = await User.findOne({ username });

  if (!user) {
    // 회원가입
    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({ username, password: hashedPassword });
    await user.save();
  } else {
    // 로그인 체크
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: '비밀번호가 틀렸습니다.' });
  }

  // 근무 시간 체크 (최초 설정이 아닐 경우)
  if (user.workHours.isSet) {
    if (!isWorkingHour(user.workHours.start, user.workHours.end)) {
      return res.status(403).json({ msg: '아직 근무 시간이 아닙니다. 출근해서 다시 오세요.', code: 'NOT_WORKING_HOUR' });
    }
  }

  // 오프라인 보상 계산 적용
  calculateOfflineGains(user);
  await user.save();

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret');
  res.json({ token, user: { username: user.username, workHours: user.workHours, gameState: user.gameState } });
});

// 근무 시간 설정
app.post('/api/set-work-hours', async (req, res) => {
  // 토큰 검증 미들웨어 필요 (생략)
  const { userId, start, end } = req.body;
  const user = await User.findById(userId);
  user.workHours = { start, end, isSet: true };
  await user.save();
  res.json({ success: true, workHours: user.workHours });
});

// "열일하기" 클릭 액션
app.post('/api/action/work', async (req, res) => {
    const { userId } = req.body;
    const user = await User.findById(userId);
    
    // 스트레스 체크: 100이면 경험치 절반
    let expGain = 5;
    if (user.gameState.stress >= 100) expGain = Math.floor(expGain / 2);

    // 레벨별 클릭 경험치 증가량 적용 (5%씩)
    expGain = Math.floor(expGain * Math.pow(1.05, user.gameState.level - 1));

    user.gameState.exp += expGain;

    // 레벨업 체크 로직 필요

    await user.save();
    res.json(user.gameState);
});

// ... 월급루팡, 상점 구매 등 다른 API 구현 필요 ...

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));