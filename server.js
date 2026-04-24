require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
// [수정됨] 아이템 정의 파일 임포트 (나중에 items.js 파일을 만들어야 함)
// const items = require('./items'); // 일단 주석 처리

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


// --- [수정됨] 유저 모델 스키마 정의 ---
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  workHours: {
    start: { type: Number, default: 9 },
    end: { type: Number, default: 18 },
    isSet: { type: Boolean, default: false }
  },
  gameState: {
    money: { type: Number, default: 100000 },
    level: { type: Number, default: 1 },
    exp: { type: Number, default: 0 },
    stamina: { type: Number, default: 10 }, // 현재 행동력
    maxStamina: { type: Number, default: 10 }, // 최대 행동력
    stress: { type: Number, default: 0 }, // 현재 스트레스
    lastActionTime: { type: Date, default: Date.now },
    lastStaminaResetTime: { type: Date, default: Date.now } // 마지막 행동력 충전 시간
  },
  // [추가됨] 인벤토리 (아이템 ID와 수량 저장)
  inventory: [{
      itemId: { type: String, required: true },
      quantity: { type: Number, default: 1 }
  }]
});

const User = mongoose.model('User', userSchema);


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

// [수정됨] 오프라인 보상 및 상태 업데이트 계산
function calculateOfflineGains(user) {
  const now = new Date();
  if (!user.gameState.lastActionTime) user.gameState.lastActionTime = now;
  
  const lastTime = new Date(user.gameState.lastActionTime);
  let elapsedSeconds = (now - lastTime) / 1000;
  if (elapsedSeconds < 0) elapsedSeconds = 0;

  // --- 1. 행동력 충전 (매일 자정 기준) ---
  const lastReset = new Date(user.gameState.lastStaminaResetTime);
  // KST 기준 날짜 비교
  const kstNowDate = new Date(now.getTime() + (9 * 60 * 60 * 1000)).getDate();
  const kstLastResetDate = new Date(lastReset.getTime() + (9 * 60 * 60 * 1000)).getDate();

  if (kstNowDate !== kstLastResetDate) {
      user.gameState.stamina = user.gameState.maxStamina;
      user.gameState.lastStaminaResetTime = now;
      console.log(`[행동력 충전] ${user.username}: 행동력이 ${user.gameState.maxStamina}로 초기화되었습니다.`);
  }

  // --- 2. 스트레스 자연 증가 (근무 시간 중에만) ---
  // TODO: 근무 시간 체크 로직과 연동 필요. 일단 10분당 1씩 증가로 구현
  const STRESS_INC_PER_SEC = 1 / 600; // 10분(600초)에 1
  const gainedStress = Math.floor(STRESS_INC_PER_SEC * elapsedSeconds);
  user.gameState.stress = Math.min(100, user.gameState.stress + gainedStress); // 최대 100 제한

  // --- 3. 돈과 경험치 획득 (기존 로직) ---
  const BASE_MONEY_PER_SEC = 23.148;
  const BASE_EXP_PER_SEC = 0.002315;
  const levelFactorMoney = Math.pow(1.05, user.gameState.level - 1);
  const levelFactorExp = Math.pow(1.08, user.gameState.level - 1);

  const moneyPerSec = BASE_MONEY_PER_SEC * levelFactorMoney;
  const expPerSec = BASE_EXP_PER_SEC * levelFactorExp;

  const gainedMoney = Math.floor(moneyPerSec * elapsedSeconds);
  let gainedExp = 0;
  if (elapsedSeconds >= 60) {
      gainedExp = Math.floor(expPerSec * elapsedSeconds);
      if (gainedExp === 0 && elapsedSeconds > 600) gainedExp = 1; 
  }

  user.gameState.money += gainedMoney;
  user.gameState.exp += gainedExp;
  
  // 마지막 행동 시간 갱신
  user.gameState.lastActionTime = now;
  
  if (gainedMoney > 0 || gainedExp > 0 || gainedStress > 0) {
      console.log(`[오프라인 계산] ${user.username}: +${gainedMoney.toLocaleString()}원, +${gainedExp}EXP, +${gainedStress}스트레스 (${Math.floor(elapsedSeconds)}초 경과)`);
  }
}

// [추가됨] 아이템 능력치 합산 함수 (임시 구현)
function calculateItemStats(inventory) {
    let totalStats = {
        moneyBonus: 0, // 월급 증가율 (%)
        expBonus: 0,   // 경험치 증가율 (%)
        stressReduction: 0 // 스트레스 감소율 (%)
    };

    // TODO: 나중에 DB에서 아이템 정보를 가져와서 계산해야 함.
    // 지금은 하드코딩된 아이템 정보로 계산
    const itemData = {
        'pen_monami': { name: '모나미 볼펜', stats: { moneyBonus: 0.05 } },
        'coffee_mix': { name: '맥심 커피믹스', stats: { stressReduction: 2 } }
    };

    inventory.forEach(item => {
        const data = itemData[item.itemId];
        if (data && data.stats) {
            if (data.stats.moneyBonus) totalStats.moneyBonus += data.stats.moneyBonus * item.quantity;
            if (data.stats.expBonus) totalStats.expBonus += data.stats.expBonus * item.quantity;
            if (data.stats.stressReduction) totalStats.stressReduction += data.stats.stressReduction * item.quantity;
        }
    });

    return totalStats;
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
            // gameState 초기값은 스키마 default 사용
        });
        // [테스트용] 초기 아이템 지급
        user.inventory.push({ itemId: 'pen_monami', quantity: 5 });
        await user.save();
      } else {
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: '비밀번호가 틀렸습니다.' });
      }

      if (user.workHours && user.workHours.isSet) {
        if (!isWorkingHour(user.workHours.start, user.workHours.end)) {
          return res.status(403).json({ msg: '아직 근무 시간이 아닙니다.', code: 'NOT_WORKING_HOUR' });
        }
      }

      calculateOfflineGains(user);
      await user.save();

      // [추가됨] 아이템 능력치 계산
      const itemStats = calculateItemStats(user.inventory);

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
      res.json({ 
          token, 
          user: { 
              _id: user._id,
              username: user.username, 
              workHours: user.workHours, 
              gameState: user.gameState,
              inventory: user.inventory, // 인벤토리 정보 전송
              itemStats: itemStats // 합산 능력치 전송
          } 
      });
  } catch (err) {
      console.error("서버 에러:", err);
      res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

// [수정됨] "열일하기" 클릭 액션 API
app.post('/api/action/work', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ msg: '유저 ID가 필요합니다.' });

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: '유저를 찾을 수 없습니다.' });
        
        // [추가됨] 행동력 체크
        const STAMINA_COST = 1;
        if (user.gameState.stamina < STAMINA_COST) {
            return res.status(400).json({ msg: '행동력이 부족합니다.' });
        }

        // 행동력 소모
        user.gameState.stamina -= STAMINA_COST;

        // [추가됨] 스트레스 증가 (클릭당 0.5씩 증가, 아이템 효과 적용)
        const itemStats = calculateItemStats(user.inventory);
        let stressGain = 0.5 * (1 - (itemStats.stressReduction || 0) / 100);
        user.gameState.stress = Math.min(100, user.gameState.stress + stressGain);

        // 경험치 계산 (스트레스 페널티 적용)
        let baseExpGain = 5;
        if (user.gameState.stress >= 100) baseExpGain = Math.floor(baseExpGain / 2);

        const levelFactor = Math.pow(1.05, user.gameState.level - 1);
        // [추가됨] 아이템 경험치 보너스 적용
        const itemExpBonus = 1 + (itemStats.expBonus || 0) / 100;
        let finalExpGain = Math.floor(baseExpGain * levelFactor * itemExpBonus);

        user.gameState.exp += finalExpGain;
        user.gameState.lastActionTime = new Date();

        // TODO: 레벨업 체크 로직 필요

        await user.save();
        console.log(`[열일하기] ${user.username}: +${finalExpGain} EXP, -${STAMINA_COST} 행동력, +${stressGain.toFixed(1)} 스트레스`);
        
        // 업데이트된 상태와 능력치 반환
        res.json({
            gameState: user.gameState,
            itemStats: itemStats
        });

    } catch (err) {
        console.error("액션 처리 중 에러:", err);
        res.status(500).json({ msg: '서버 오류 발생' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));