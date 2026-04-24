require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path'); // 경로 처리를 위한 모듈 추가
const User = require('./models/User');

const app = express();

// 미들웨어 설정
app.use(express.json());
app.use(cors());

// ★★★ 핵심 수정 부분 ★★★
// 'public' 폴더를 정적 파일 제공 경로로 설정합니다.
// 이제 브라우저가 접속하면 이 폴더 안에 있는 index.html, client.js 등을 자동으로 보여줍니다.
app.use(express.static(path.join(__dirname, 'public')));

// 기본 경로('/') 접속 시 index.html 보내기 (명시적 설정)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// (기존 테스트용 텍스트 전송 코드는 삭제했습니다)
// app.get('/', (req, res) => {
//   res.send('일해라 이네오 서버 정상 작동중 🚀');
// });


// MongoDB 연결 (RailWay 주소 등 환경변수 사용)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));


// --- 헬퍼 함수들 ---

// 현재 시간이 근무 시간인지 확인 (한국 시간 기준 KST UTC+9)
function isWorkingHour(start, end) {
  const now = new Date();
  const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const currentHour = kstNow.getUTCHours();

  if (start <= end) {
    return currentHour >= start && currentHour < end;
  } else {
    // 예: 22시부터 다음날 02시까지인 경우
    return currentHour >= start || currentHour < end;
  }
}

// 오프라인 보상 계산 (간소화 버전)
function calculateOfflineGains(user) {
  const now = new Date();
  // 마지막 행동 시간이 없으면 현재 시간으로 초기화
  if (!user.gameState.lastActionTime) {
      user.gameState.lastActionTime = now;
  }
  
  const lastTime = new Date(user.gameState.lastActionTime);
  const elapsedSeconds = (now - lastTime) / 1000;

  if (elapsedSeconds < 0) return; // 시간 오류 방지

  // 레벨당 보상 계산 (수치 조정 가능)
  // 예: 1초당 10원 * 레벨, 1초당 0.1경험치 * 레벨
  const gainedMoney = Math.floor(elapsedSeconds * 10 * user.gameState.level); 
  const gainedExp = Math.floor(elapsedSeconds * 0.1 * user.gameState.level);

  user.gameState.money += gainedMoney;
  user.gameState.exp += gainedExp;
  user.gameState.lastActionTime = now;
  
  console.log(`[오프라인 보상] ${user.username}: +${gainedMoney}원, +${gainedExp}EXP (경과: ${Math.floor(elapsedSeconds)}초)`);
}


// --- API 라우트 ---

// 로그인 및 회원가입 (자동 처리)
app.post('/api/login', async (req, res) => {
  console.log("POST /api/login 요청 받음:", req.body.username);
  try {
      const { username, password } = req.body;
      let user = await User.findOne({ username });

      if (!user) {
        console.log("신규 유저 회원가입 진행:", username);
        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({ 
            username, 
            password: hashedPassword,
            // 초기 게임 상태 설정
            gameState: {
                money: 0,
                level: 1,
                exp: 0,
                stamina: 10,
                stress: 0,
                lastActionTime: new Date()
            }
        });
        await user.save();
      } else {
        console.log("기존 유저 로그인 시도:", username);
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log("비밀번호 불일치");
            return res.status(400).json({ msg: '비밀번호가 틀렸습니다.' });
        }
      }

      // 근무 시간 체크 (설정된 경우만)
      if (user.workHours && user.workHours.isSet) {
        if (!isWorkingHour(user.workHours.start, user.workHours.end)) {
          console.log("근무 시간 아님 접속 차단");
          return res.status(403).json({ msg: '아직 근무 시간이 아닙니다. 출근해서 다시 오세요.', code: 'NOT_WORKING_HOUR' });
        }
      }

      // 오프라인 보상 계산 적용
      calculateOfflineGains(user);
      // 마지막 접속 시간 갱신
      user.gameState.lastActionTime = new Date();
      await user.save();

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
      console.log("로그인 성공, 토큰 발급 완료");
      res.json({ 
          token, 
          user: { 
              username: user.username, 
              workHours: user.workHours, 
              gameState: user.gameState 
          } 
      });
  } catch (err) {
      console.error("로그인 처리 중 서버 에러:", err);
      res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

// 근무 시간 설정 API
app.post('/api/set-work-hours', async (req, res) => {
  // TODO: 토큰 검증 미들웨어 추가 필요
  const { userId, start, end } = req.body;
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ msg: '유저를 찾을 수 없습니다.' });

  user.workHours = { start, end, isSet: true };
  await user.save();
  res.json({ success: true, workHours: user.workHours });
});

// "열일하기" 클릭 액션 API
app.post('/api/action/work', async (req, res) => {
    // TODO: 토큰 검증 미들웨어 추가 필요
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '유저를 찾을 수 없습니다.' });
    
    // 스트레스 체크: 100이면 경험치 절반
    let expGain = 5;
    if (user.gameState.stress >= 100) expGain = Math.floor(expGain / 2);

    // 레벨별 클릭 경험치 증가량 적용 (5%씩 복리)
    expGain = Math.floor(expGain * Math.pow(1.05, user.gameState.level - 1));

    user.gameState.exp += expGain;
    user.gameState.lastActionTime = new Date(); // 행동 시간 갱신

    // TODO: 레벨업 체크 로직 구현 필요

    await user.save();
    res.json(user.gameState);
});

// ... 월급루팡, 상점 구매 등 다른 API 구현 필요 ...

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));