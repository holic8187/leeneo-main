require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));


// --- 아이템 데이터 정의 ---
const ITEM_DATA = {
    'pen_monami': { name: '모나미 볼펜', price: 100000, desc: '월급 +0.05%', stats: { moneyBonus: 0.05 } },
    'coffee_mix': { name: '맥심 커피믹스', price: 50000, desc: '스트레스 감소율 +2%', stats: { stressReduction: 2 } }
};

// --- 유저 모델 스키마 정의 ---
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  nickname: { type: String, default: null },
  workHours: {
    start: { type: Number, default: 9 },
    end: { type: Number, default: 18 },
    isSet: { type: Boolean, default: false }
  },
  gameState: {
    money: { type: Number, default: 100000 },
    level: { type: Number, default: 1 },
    exp: { type: Number, default: 0 },
    stamina: { type: Number, default: 10 },
    maxStamina: { type: Number, default: 10 },
    stress: { type: Number, default: 0 },
    lastActionTime: { type: Date, default: Date.now },
    lastStaminaResetTime: { type: Date, default: Date.now }
  },
  inventory: [{
      itemId: { type: String, required: true },
      quantity: { type: Number, default: 1 }
  }],
  buffs: [{
      buffId: { type: String, required: true },
      expiresAt: { type: Date, required: true }
  }]
});

const User = mongoose.model('User', userSchema);


// --- 헬퍼 함수들 ---

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

// 오프라인 보상 및 상태 업데이트 계산
function calculateOfflineGains(user) {
  const now = new Date();
  if (!user.gameState.lastActionTime) user.gameState.lastActionTime = now;
  
  const lastTime = new Date(user.gameState.lastActionTime);
  let elapsedSeconds = (now - lastTime) / 1000;
  if (elapsedSeconds < 0) elapsedSeconds = 0;

  // --- 0. 버프 만료 처리 ---
  user.buffs = user.buffs.filter(buff => new Date(buff.expiresAt) > now);

  // --- 1. 행동력 충전 ---
  const lastReset = new Date(user.gameState.lastStaminaResetTime);
  const kstNowDate = new Date(now.getTime() + (9 * 60 * 60 * 1000)).getDate();
  const kstLastResetDate = new Date(lastReset.getTime() + (9 * 60 * 60 * 1000)).getDate();

  if (kstNowDate !== kstLastResetDate) {
      user.gameState.stamina = user.gameState.maxStamina;
      user.gameState.lastStaminaResetTime = now;
  }

  // --- 2. 스트레스 자연 증가 ---
  const hasLupinBuff = user.buffs.some(b => b.buffId === 'lupin_buff');
  let gainedStress = 0;
  if (!hasLupinBuff) {
      const STRESS_INC_PER_SEC = 1 / 600;
      gainedStress = Math.floor(STRESS_INC_PER_SEC * elapsedSeconds);
      // [수정됨] 최대 100으로 제한
      user.gameState.stress = Math.min(100, user.gameState.stress + gainedStress);
  }

  // --- 3. 돈과 경험치 획득 ---
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
  user.gameState.lastActionTime = now;
  
  if (gainedMoney > 0 || gainedExp > 0 || gainedStress > 0) {
      console.log(`[오프라인 계산] ${user.username}: +${gainedMoney}원, +${gainedExp}EXP, +${gainedStress}스트레스`);
  }
}

function calculateItemStats(inventory) {
    let totalStats = { moneyBonus: 0, expBonus: 0, stressReduction: 0 };
    inventory.forEach(item => {
        const data = ITEM_DATA[item.itemId];
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
      let isNewUser = false;

      if (!user) {
        console.log("신규 유저 회원가입:", username);
        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({ 
            username, 
            password: hashedPassword,
        });
        // [테스트용] 초기 아이템 지급 (나중엔 삭제)
        user.inventory.push({ itemId: 'pen_monami', quantity: 1 });
        await user.save();
        isNewUser = true;
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

      const itemStats = calculateItemStats(user.inventory);
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });

      res.json({ 
          token, 
          user: { 
              _id: user._id,
              username: user.username,
              nickname: user.nickname,
              workHours: user.workHours, 
              gameState: user.gameState,
              inventory: user.inventory,
              buffs: user.buffs,
              itemStats: itemStats
          },
          isNewUser: isNewUser
      });
  } catch (err) {
      console.error("서버 에러:", err);
      res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

// 닉네임 설정 API
app.post('/api/set-nickname', async (req, res) => {
    const { userId, nickname } = req.body;
    if (!userId || !nickname) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: '유저를 찾을 수 없습니다.' });
        if (user.nickname) return res.status(400).json({ msg: '이미 닉네임이 설정되어 있습니다.' });

        const existingUser = await User.findOne({ nickname: nickname });
        if (existingUser) return res.status(400).json({ msg: '이미 사용 중인 닉네임입니다.' });

        user.nickname = nickname;
        await user.save();
        res.json({ success: true, nickname: user.nickname });
    } catch (err) {
        console.error("닉네임 설정 에러:", err);
        res.status(500).json({ msg: '서버 오류 발생' });
    }
});

// "열일하기" 클릭 액션 API
app.post('/api/action/work', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ msg: '유저 ID가 필요합니다.' });

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: '유저를 찾을 수 없습니다.' });

        user.buffs = user.buffs.filter(buff => new Date(buff.expiresAt) > new Date());
        
        // [수정됨] 스트레스 증가 (최대 100 제한)
        const hasLupinBuff = user.buffs.some(b => b.buffId === 'lupin_buff');
        let stressGain = 0;
        if (!hasLupinBuff) {
            const itemStats = calculateItemStats(user.inventory);
            stressGain = 0.5 * (1 - (itemStats.stressReduction || 0) / 100);
            user.gameState.stress = Math.min(100, user.gameState.stress + stressGain);
        }

        // 경험치 계산
        let baseExpGain = 5;
        if (user.gameState.stress >= 100) baseExpGain = Math.floor(baseExpGain / 2);

        const levelFactor = Math.pow(1.05, user.gameState.level - 1);
        const itemStats = calculateItemStats(user.inventory);
        const itemExpBonus = 1 + (itemStats.expBonus || 0) / 100;
        const lupinExpBonus = hasLupinBuff ? 1.5 : 1.0;

        let finalExpGain = Math.floor(baseExpGain * levelFactor * itemExpBonus * lupinExpBonus);

        user.gameState.exp += finalExpGain;
        user.gameState.lastActionTime = new Date();

        // TODO: 레벨업 체크 로직 필요

        await user.save();
        console.log(`[열일하기] ${user.username}: +${finalExpGain} EXP, +${stressGain.toFixed(1)} 스트레스`);
        
        res.json({
            gameState: user.gameState,
            buffs: user.buffs,
            itemStats: itemStats
        });

    } catch (err) {
        console.error("액션 처리 중 에러:", err);
        res.status(500).json({ msg: '서버 오류 발생' });
    }
});

// "월급루팡" 특수 행동 API
app.post('/api/action/lupin', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ msg: '유저 ID가 필요합니다.' });

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: '유저를 찾을 수 없습니다.' });

        const STAMINA_COST = 2;
        if (user.gameState.stamina < STAMINA_COST) {
            return res.status(400).json({ msg: '행동력이 부족합니다.' });
        }

        user.buffs = user.buffs.filter(buff => new Date(buff.expiresAt) > new Date());
        if (user.buffs.some(b => b.buffId === 'lupin_buff')) {
             return res.status(400).json({ msg: '이미 월급루팡 중입니다!' });
        }

        user.gameState.stamina -= STAMINA_COST;

        const expiresAt = new Date(new Date().getTime() + 2 * 60 * 60 * 1000);
        user.buffs.push({
            buffId: 'lupin_buff',
            expiresAt: expiresAt
        });

        user.gameState.lastActionTime = new Date();
        await user.save();

        console.log(`[월급루팡] ${user.username}: 행동력 -${STAMINA_COST}, 버프 적용 완료`);
        
        res.json({
            gameState: user.gameState,
            buffs: user.buffs,
            itemStats: calculateItemStats(user.inventory)
        });

    } catch (err) {
        console.error("액션 처리 중 에러:", err);
        res.status(500).json({ msg: '서버 오류 발생' });
    }
});

// [추가됨] "낮잠자기" 특수 행동 API
app.post('/api/action/nap', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ msg: '유저 ID가 필요합니다.' });

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: '유저를 찾을 수 없습니다.' });

        // 행동력 체크 (3 소모)
        const STAMINA_COST = 3;
        if (user.gameState.stamina < STAMINA_COST) {
            return res.status(400).json({ msg: '행동력이 부족합니다. (필요: 3)' });
        }

        // 행동력 소모
        user.gameState.stamina -= STAMINA_COST;

        // 스트레스 감소 (30 감소, 최소 0)
        user.gameState.stress = Math.max(0, user.gameState.stress - 30);

        user.gameState.lastActionTime = new Date();
        await user.save();

        console.log(`[낮잠자기] ${user.username}: 행동력 -${STAMINA_COST}, 스트레스 -30`);
        
        res.json({
            gameState: user.gameState,
            buffs: user.buffs,
            itemStats: calculateItemStats(user.inventory)
        });

    } catch (err) {
        console.error("액션 처리 중 에러:", err);
        res.status(500).json({ msg: '서버 오류 발생' });
    }
});

// 상점 구매 API
app.post('/api/shop/buy', async (req, res) => {
    const { userId, itemId } = req.body;
    if (!userId || !itemId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });

    const itemInfo = ITEM_DATA[itemId];
    if (!itemInfo) return res.status(400).json({ msg: '존재하지 않는 아이템입니다.' });

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: '유저를 찾을 수 없습니다.' });

        if (user.gameState.money < itemInfo.price) {
            return res.status(400).json({ msg: '잔고가 부족합니다.' });
        }

        user.gameState.money -= itemInfo.price;
        
        const existingItem = user.inventory.find(item => item.itemId === itemId);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            user.inventory.push({ itemId: itemId, quantity: 1 });
        }

        user.gameState.lastActionTime = new Date();
        await user.save();

        console.log(`[상점 구매] ${user.username}: ${itemInfo.name} 구매 완료`);
        
        res.json({
            gameState: user.gameState,
            inventory: user.inventory,
            itemStats: calculateItemStats(user.inventory)
        });

    } catch (err) {
        console.error("구매 처리 중 에러:", err);
        res.status(500).json({ msg: '서버 오류 발생' });
    }
});

// 실시간 랭킹 API
app.get('/api/ranking', async (req, res) => {
    try {
        const ranking = await User.find({ nickname: { $ne: null } })
            .sort({ 'gameState.level': -1, 'gameState.exp': -1 })
            .limit(20)
            .select('nickname gameState.level');

        res.json(ranking);
    } catch (err) {
        console.error("랭킹 조회 에러:", err);
        res.status(500).json({ msg: '서버 오류 발생' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));