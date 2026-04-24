require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const User = require('./models/User');

const app = express();

// 미들웨어 설정
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// 기본 경로 접속 시 index.html 전송
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// MongoDB 연결
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));


// --- 헬퍼 함수들 ---

// 현재 시간이 근무 시간인지 확인
function isWorkingHour(start, end) {
  const now = new Date();
  const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const currentHour = kstNow.getUTCHours();

  if (start <= end) {
    return currentHour >= start && currentHour < end;
  } else {
    return currentHour >= start || currentHour < end;
  }
}

// [수정됨] 오프라인 보상 계산 (기획 수치 적용)
function calculateOfflineGains(user) {
  const now = new Date();
  if (!user.gameState.lastActionTime) {
      user.gameState.lastActionTime = now;
  }
  
  const lastTime = new Date(user.gameState.lastActionTime);
  let elapsedSeconds = (now - lastTime) / 1000;

  if (elapsedSeconds < 0) elapsedSeconds = 0;

  // --- 기획 데이터 ---
  // 1레벨 기준 하루(86400초) 획득량
  // 돈: 2,000,000원 / 86400초 ≈ 23.148 원/초
  // 경험치: 200 EXP / 86400초 ≈ 0.002315 EXP/초
  const BASE_MONEY_PER_SEC = 23.148;
  const BASE_EXP_PER_SEC = 0.002315;

  // 레벨별 증가율 적용 (돈 5%, 경험치 8% 복리)
  // Math.pow(1.05, 레벨-1) 형태로 계산
  const levelFactorMoney = Math.pow(1.05, user.gameState.level - 1);
  const levelFactorExp = Math.pow(1.08, user.gameState.level - 1);

  // 최종 초당 획득량
  const moneyPerSec = BASE_MONEY_PER_SEC * levelFactorMoney;
  const expPerSec = BASE_EXP_PER_SEC * levelFactorExp;

  // 경과 시간에 따른 총 획득량 계산 (소수점 버림)
  const gainedMoney = Math.floor(moneyPerSec * elapsedSeconds);
  // 경험치는 수치가 작아 최소 1분 이상 지났을 때만 계산 (서버 부하 및 오차 방지용 단순화)
  let gainedExp = 0;
  if (elapsedSeconds >= 60) {
      gainedExp = Math.floor(expPerSec * elapsedSeconds);
      // 너무 적어서 0이 되는 경우 보정 (최소 1은 지급, 기획에 따라 변경 가능)
      if (gainedExp === 0 && elapsedSeconds > 600) gainedExp = 1; 
  }

  user.gameState.money += gainedMoney;
  user.gameState.exp += gainedExp;
  user.gameState.lastActionTime = now;
  
  if (gainedMoney > 0 || gainedExp > 0) {
      console.log(`[오프라인 보상] ${user.username} (Lv.${user.gameState.level}): +${gainedMoney.toLocaleString()}원, +${gainedExp}EXP (${Math.floor(elapsedSeconds)}초 경과)`);
  }
}


// --- API 라우트 ---

// 로그인 및 회원가입
app.post('/api/login', async (req, res) => {
  try {
      const { username, password } = req.body;
      let user = await User.findOne({ username });

      if (!user) {
        console.log("신규 유저 회원가입:", username);
        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({ 
            username, 
            password: hashedPassword,
            gameState: {
                money: 100000, // [수정됨] 초기 자금 10만원 설정
                level: 1,
                exp: 0,
                stamina: 10,
                stress: 0,
                lastActionTime: new Date()
            }
        });
        await user.save();
      } else {
        // 기존 유저 로그인 체크
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: '비밀번호가 틀렸습니다.' });
      }

      // 근무 시간 체크
      if (user.workHours && user.workHours.isSet) {
        if (!isWorkingHour(user.workHours.start, user.workHours.end)) {
          return res.status(403).json({ msg: '아직 근무 시간이 아닙니다.', code: 'NOT_WORKING_HOUR' });
        }
      }

      // 오프라인 보상 계산 및 적용
      calculateOfflineGains(user);
      await user.save();

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
      res.json({ 
          token, 
          user: { 
              _id: user._id, // 클라이언트가 식별할 수 있도록 ID 포함
              username: user.username, 
              workHours: user.workHours, 
              gameState: user.gameState 
          } 
      });
  } catch (err) {
      console.error("서버 에러:", err);
      res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

// 근무 시간 설정 API
app.post('/api/set-work-hours', async (req, res) => {
  const { userId, start, end } = req.body;
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ msg: '유저를 찾을 수 없습니다.' });

  user.workHours = { start, end, isSet: true };
  await user.save();
  res.json({ success: true, workHours: user.workHours });
});

// [수정됨] "열일하기" 클릭 액션 API
app.post('/api/action/work', async (req, res) => {
    // 클라이언트에서 userId를 받아서 처리합니다.
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({ msg: '유저 ID가 필요합니다.' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: '유저를 찾을 수 없습니다.' });
        
        // 스트레스 체크: 100이면 경험치 절반 (기획 반영)
        let baseExpGain = 5;
        if (user.gameState.stress >= 100) baseExpGain = Math.floor(baseExpGain / 2);

        // 레벨별 클릭 경험치 증가량 적용 (5%씩 복리 - 기획 반영)
        // Math.pow(1.05, 레벨-1) 형태로 계산
        const levelFactor = Math.pow(1.05, user.gameState.level - 1);
        let finalExpGain = Math.floor(baseExpGain * levelFactor);

        user.gameState.exp += finalExpGain;
        // 마지막 행동 시간 갱신 (중요: 이걸 해야 오프라인 보상이 중복 계산 안 됨)
        user.gameState.lastActionTime = new Date(); 

        // TODO: 여기서 레벨업 체크 로직이 필요함 (경험치가 1000 넘었는지 등)
        // 일단 경험치만 증가시키고 저장

        await user.save();
        console.log(`[열일하기] ${user.username}: +${finalExpGain} EXP (현재: ${user.gameState.exp})`);
        res.json(user.gameState); // 업데이트된 게임 상태 반환

    } catch (err) {
        console.error("액션 처리 중 에러:", err);
        res.status(500).json({ msg: '서버 오류 발생' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));