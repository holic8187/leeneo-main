const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const BASE_DAILY_SALARY = 300000;
const BASE_DAILY_PASSIVE_EXP = 400;
const BASE_CLICK_EXP = 5;
const BASE_STRESS_PER_SECOND = 1 / 600;
const LUPIN_STRESS_DURATION_MS = 60 * 60 * 1000;
const LUPIN_EXP_DURATION_MS = 2 * 60 * 60 * 1000;
const HOT6_DURATION_MS = 10 * 60 * 1000;

const ITEM_DATA = {
  pen_monami: {
    name: '모나미 볼펜',
    price: 100000,
    type: 'passive',
    desc: '월급 획득량 +0.05%',
    hoverDesc: '보유량 1개마다 월급 획득량이 0.05% 증가합니다.',
    stats: { moneyBonus: 0.05 }
  },
  coffee_mix: {
    name: '맥심 커피믹스',
    price: 50000,
    type: 'passive',
    desc: '스트레스 증가량 2% 감소',
    hoverDesc: '보유량마다 현재 스트레스 증가량의 98%만 받습니다.',
    stats: { stressMultiplier: 0.98 }
  },
  bacchus: {
    name: '박카스',
    price: 100000,
    type: 'consumable',
    desc: '사용 시 행동력 +1',
    hoverDesc: '가방에서 사용하면 행동력을 1 회복합니다.',
    useDesc: '행동력 +1'
  },
  hot6: {
    name: '핫식스',
    price: 100000,
    type: 'consumable',
    desc: '사용 시 스트레스 -10, 10분 버프',
    hoverDesc: '사용 즉시 스트레스를 10 낮추고, 10분 동안 서류작업 클릭마다 스트레스를 0.1 낮춥니다.',
    useDesc: '스트레스 -10, 10분 동안 서류작업 클릭 시 스트레스 -0.1'
  }
};

const TITLE_DATA = {
  beast_heart: {
    name: '야수의 심장',
    desc: '월급 5% 증가',
    unlockDesc: '현재 잔고 50만원 이상일 때 잔고의 90% 이상을 주식 투자',
    stats: { moneyBonus: 5 }
  }
};

if (!MONGO_URI) {
  console.error('❌ MONGO_URI가 .env에 설정되어 있지 않습니다.');
  console.error('MONGO_URI is not configured in .env.');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.warn('⚠️ JWT_SECRET이 없어 개발용 기본값을 사용합니다. 배포 환경에서는 반드시 설정하세요.');
  console.warn('JWT_SECRET is missing, using an unsafe default for development.');
}

app.use(express.json());
});

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));


// --- 아이템 데이터 정의 ---
const ITEM_DATA = {
    'pen_monami': { name: '모나미 볼펜', price: 100000, desc: '월급 +0.05%', stats: { moneyBonus: 0.05 } },
    'coffee_mix': { name: '맥심 커피믹스', price: 50000, desc: '스트레스 감소율 +2%', stats: { stressReduction: 2 } }
};
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// --- 유저 모델 스키마 정의 ---
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
    stamina: { type: Number, default: 10 },
    maxStamina: { type: Number, default: 10 },
    stress: { type: Number, default: 0 },
    moneyCarry: { type: Number, default: 0 },
    passiveExpCarry: { type: Number, default: 0 },
    lastActionTime: { type: Date, default: Date.now },
    lastStaminaResetTime: { type: Date, default: Date.now }
  },
  inventory: [{
      itemId: { type: String, required: true },
      quantity: { type: Number, default: 1 }
    itemId: { type: String, required: true },
    quantity: { type: Number, default: 1 }
  }],
  buffs: [{
      buffId: { type: String, required: true },
      expiresAt: { type: Date, required: true }
    buffId: { type: String, required: true },
    expiresAt: { type: Date, required: true }
  }],
  titles: {
    unlocked: { type: [String], default: [] },
    equipped: { type: String, default: null }
  },
  pendingStockInvestment: {
    amount: { type: Number, default: 0 },
    investedOn: { type: String, default: null }
  },
  pendingNotifications: [{
    type: { type: String, default: 'info' },
    text: { type: String, required: true }
  }]
});

const User = mongoose.model('User', userSchema);


// --- 헬퍼 함수들 ---
function getKSTDateKey(date = new Date()) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isWorkingHour(start, end) {
  const now = new Date();
  const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const currentHour = kstNow.getUTCHours();

  if (start <= end) {
    return currentHour >= start && currentHour < end;
  }
  return currentHour >= start || currentHour < end;
}

function ensureUserDefaults(user) {
  if (!user.nickname) user.nickname = null;
  if (!user.gameState) user.gameState = {};

  user.gameState.money = Number(user.gameState.money ?? 100000);
  user.gameState.level = Number(user.gameState.level ?? 1);
  user.gameState.exp = Number(user.gameState.exp ?? 0);
  user.gameState.stamina = Number(user.gameState.stamina ?? 10);
  user.gameState.maxStamina = Number(user.gameState.maxStamina ?? 10);
  user.gameState.stress = Number(user.gameState.stress ?? 0);
  user.gameState.moneyCarry = Number(user.gameState.moneyCarry ?? 0);
  user.gameState.passiveExpCarry = Number(user.gameState.passiveExpCarry ?? 0);
  user.gameState.lastActionTime = user.gameState.lastActionTime || new Date();
  user.gameState.lastStaminaResetTime = user.gameState.lastStaminaResetTime || new Date();

  if (!Array.isArray(user.inventory)) user.inventory = [];
  if (!Array.isArray(user.buffs)) user.buffs = [];

  if (!user.titles) {
    user.titles = { unlocked: [], equipped: null };
  }
  if (!Array.isArray(user.titles.unlocked)) user.titles.unlocked = [];
  if (!Object.prototype.hasOwnProperty.call(user.titles, 'equipped')) {
    user.titles.equipped = null;
  }

  if (!Array.isArray(user.pendingNotifications)) user.pendingNotifications = [];

  if (!user.pendingStockInvestment || typeof user.pendingStockInvestment !== 'object') {
    user.pendingStockInvestment = { amount: 0, investedOn: null };
  }
  user.pendingStockInvestment.amount = Number(user.pendingStockInvestment.amount ?? 0);
  user.pendingStockInvestment.investedOn = user.pendingStockInvestment.investedOn || null;

  migrateLegacyBuffs(user);
}

function migrateLegacyBuffs(user) {
  const legacyBuff = user.buffs.find((buff) => buff.buffId === 'lupin_buff');
  if (!legacyBuff) return;

  user.buffs = user.buffs.filter((buff) => buff.buffId !== 'lupin_buff');
  user.buffs.push(
    { buffId: 'lupin_stress_buff', expiresAt: legacyBuff.expiresAt },
    { buffId: 'lupin_exp_buff', expiresAt: legacyBuff.expiresAt }
  );
}

function queueNotification(user, type, text) {
  user.pendingNotifications.push({ type, text });
}

function consumeNotifications(user) {
  const notifications = [...user.pendingNotifications];
  user.pendingNotifications = [];
  return notifications;
}

function cleanupExpiredBuffs(user, now = new Date()) {
  user.buffs = user.buffs.filter((buff) => new Date(buff.expiresAt) > now);
}

function hasBuff(user, buffId, now = new Date()) {
  return user.buffs.some((buff) => buff.buffId === buffId && new Date(buff.expiresAt) > now);
}

function getInventoryItem(user, itemId) {
  return user.inventory.find((item) => item.itemId === itemId);
}

function getInventoryQuantity(user, itemId) {
  return getInventoryItem(user, itemId)?.quantity || 0;
}

function addItemToInventory(user, itemId, amount = 1) {
  if (amount <= 0) return;
  const item = getInventoryItem(user, itemId);
  if (item) {
    item.quantity += amount;
  } else {
    user.inventory.push({ itemId, quantity: amount });
  }
}

function removeItemFromInventory(user, itemId, amount = 1) {
  const item = getInventoryItem(user, itemId);
  if (!item || item.quantity < amount) return false;

  item.quantity -= amount;
  if (item.quantity <= 0) {
    user.inventory = user.inventory.filter((entry) => entry.itemId !== itemId);
  }
  return true;
}

function setOrRefreshBuff(user, buffId, durationMs) {
  const expiresAt = new Date(Date.now() + durationMs);
  const existingBuff = user.buffs.find((buff) => buff.buffId === buffId);
  if (existingBuff) {
    existingBuff.expiresAt = expiresAt;
  } else {
    return currentHour >= start || currentHour < end;
    user.buffs.push({ buffId, expiresAt });
  }
}

function getMonamiPriceMultiplier(ownedCount) {
  return Number(Math.pow(1.05, ownedCount).toFixed(2));
}

function getItemPrice(user, itemId) {
  const itemInfo = ITEM_DATA[itemId];
  if (!itemInfo) return 0;
  if (itemId === 'pen_monami') {
    const ownedCount = getInventoryQuantity(user, itemId);
    return Math.round(itemInfo.price * getMonamiPriceMultiplier(ownedCount));
  }
  return itemInfo.price;
}

function getShopPricesForUser(user) {
  const prices = {};
  for (const itemId of Object.keys(ITEM_DATA)) {
    prices[itemId] = getItemPrice(user, itemId);
  }
  return prices;
}

function getTitleInfo(user) {
  if (!user.titles?.equipped) return null;
  return TITLE_DATA[user.titles.equipped] || null;
}

function buildDisplayName(user) {
  const titleInfo = getTitleInfo(user);
  if (!user.nickname) return user.username;
  if (!titleInfo) return user.nickname;
  return `<${titleInfo.name}> ${user.nickname}`;
}

function unlockTitle(user, titleId) {
  if (!TITLE_DATA[titleId]) return false;
  if (user.titles.unlocked.includes(titleId)) return false;
  user.titles.unlocked.push(titleId);
  queueNotification(user, 'title_unlock', `<${TITLE_DATA[titleId].name}> 칭호를 획득하였습니다!`);
  return true;
}

function calculateItemStats(inventory = []) {
  const stats = {
    moneyBonus: 0,
    expBonus: 0,
    stressMultiplier: 1,
    stressReduction: 0,
    clickStressRelief: 0
  };

  inventory.forEach((item) => {
    const data = ITEM_DATA[item.itemId];
    if (!data?.stats) return;

    if (data.stats.moneyBonus) {
      stats.moneyBonus += data.stats.moneyBonus * item.quantity;
    }
    if (data.stats.expBonus) {
      stats.expBonus += data.stats.expBonus * item.quantity;
    }
    if (data.stats.stressMultiplier) {
      stats.stressMultiplier *= Math.pow(data.stats.stressMultiplier, item.quantity);
    }
    if (data.stats.clickStressRelief) {
      stats.clickStressRelief += data.stats.clickStressRelief * item.quantity;
    }
  });

  stats.stressMultiplier = Number(stats.stressMultiplier.toFixed(6));
  stats.stressReduction = Number(((1 - stats.stressMultiplier) * 100).toFixed(2));
  stats.moneyBonus = Number(stats.moneyBonus.toFixed(2));
  stats.expBonus = Number(stats.expBonus.toFixed(2));
  stats.clickStressRelief = Number(stats.clickStressRelief.toFixed(2));
  return stats;
}

// [신규] 레벨업 필요한 경험치 계산 공식: 1000 * (1.1 ^ (레벨-1))
function calculateDerivedStats(user, now = new Date()) {
  cleanupExpiredBuffs(user, now);

  const itemStats = calculateItemStats(user.inventory);
  const titleInfo = getTitleInfo(user);
  const titleMoneyBonus = titleInfo?.stats?.moneyBonus || 0;
  const hot6ClickStressRelief = hasBuff(user, 'hot6_buff', now) ? 0.1 : 0;

  return {
    moneyBonusPercent: Number((itemStats.moneyBonus + titleMoneyBonus).toFixed(2)),
    itemMoneyBonusPercent: itemStats.moneyBonus,
    titleMoneyBonusPercent: Number(titleMoneyBonus.toFixed(2)),
    expBonusPercent: itemStats.expBonus,
    stressMultiplier: itemStats.stressMultiplier,
    stressReductionPercent: itemStats.stressReduction,
    clickStressRelief: Number((itemStats.clickStressRelief + hot6ClickStressRelief).toFixed(2))
  };
}

function getRequiredExp(level) {
    return Math.floor(1000 * Math.pow(1.1, level - 1));
  return Math.floor(1000 * Math.pow(1.1, level - 1));
}

// [신규] 레벨업 체크 함수
function checkLevelUp(user) {
    let requiredExp = getRequiredExp(user.gameState.level);
    let leveledUp = false;
function getPassiveDailyExp(level) {
  return BASE_DAILY_PASSIVE_EXP * Math.pow(1.08, level - 1);
}

    // 경험치가 필요 경험치보다 많으면 레벨업 (혹시 몰라 반복문으로 처리)
    while (user.gameState.exp >= requiredExp) {
        user.gameState.exp -= requiredExp; // 초과분만 남김
        user.gameState.level++;
        leveledUp = true;
        // 레벨업 했으니 다음 레벨 필요 경험치 재계산
        requiredExp = getRequiredExp(user.gameState.level);
        console.log(`[레벨업] ${user.username}님이 ${user.gameState.level}레벨이 되었습니다!`);
    }
    // 프론트엔드에 다음 레벨 필요 경험치를 알려주기 위해 임시 필드 추가 (DB엔 저장 안 함)
    user.gameState.nextLevelExp = requiredExp; 
    return leveledUp;
function getPassiveExpPerSecond(level) {
  return getPassiveDailyExp(level) / (24 * 60 * 60);
}

function getSalaryPerSecond(level, moneyBonusPercent) {
  const basePerSecond = BASE_DAILY_SALARY / (24 * 60 * 60);
  return basePerSecond * Math.pow(1.05, level - 1) * (1 + moneyBonusPercent / 100);
}

function getSalaryPerMinute(level, moneyBonusPercent) {
  return getSalaryPerSecond(level, moneyBonusPercent) * 60;
}

function getClickExp(level) {
  return Math.floor(BASE_CLICK_EXP * Math.pow(1.05, level - 1));
}

function settlePendingStockInvestment(user, now = new Date()) {
  const investment = user.pendingStockInvestment;
  if (!investment?.amount || !investment.investedOn) return;

// 오프라인 보상 및 상태 업데이트 계산
function calculateOfflineGains(user) {
  const now = new Date();
  if (!user.gameState.lastActionTime) user.gameState.lastActionTime = now;
  
  const lastTime = new Date(user.gameState.lastActionTime);
  let elapsedSeconds = (now - lastTime) / 1000;
  if (elapsedSeconds < 0) elapsedSeconds = 0;
  const todayKey = getKSTDateKey(now);
  if (todayKey <= investment.investedOn) return;

  // --- 0. 버프 만료 처리 ---
  user.buffs = user.buffs.filter(buff => new Date(buff.expiresAt) > now);
  const rate = Math.floor(Math.random() * 61) - 30;
  const payout = Math.round(investment.amount * (1 + rate / 100));
  const delta = payout - investment.amount;
  const deltaPrefix = delta >= 0 ? '+' : '';
  const ratePrefix = rate >= 0 ? '+' : '';

  // --- 1. 행동력 충전 ---
  const lastReset = new Date(user.gameState.lastStaminaResetTime);
  const kstNowDate = new Date(now.getTime() + (9 * 60 * 60 * 1000)).getDate();
  const kstLastResetDate = new Date(lastReset.getTime() + (9 * 60 * 60 * 1000)).getDate();
  user.gameState.money += payout;
  user.pendingStockInvestment = { amount: 0, investedOn: null };
  queueNotification(
    user,
    'stock_result',
    `어제의 주식 투자 결과입니다. ${ratePrefix}${rate}% (${deltaPrefix}${delta.toLocaleString()}원), 총 ${payout.toLocaleString()}원을 돌려받았습니다.`
  );
}

  if (kstNowDate !== kstLastResetDate) {
      user.gameState.stamina = user.gameState.maxStamina;
      user.gameState.lastStaminaResetTime = now;
function resetDailyStaminaIfNeeded(user, now = new Date()) {
  const currentKey = getKSTDateKey(now);
  const lastResetKey = getKSTDateKey(new Date(user.gameState.lastStaminaResetTime));

  if (currentKey !== lastResetKey) {
    user.gameState.stamina = user.gameState.maxStamina;
    user.gameState.lastStaminaResetTime = now;
  }
}

function checkLevelUp(user) {
  const requiredExp = getRequiredExp(user.gameState.level);
  if (user.gameState.exp < requiredExp) return false;

  user.gameState.level += 1;
  user.gameState.exp = 0;
  user.gameState.passiveExpCarry = 0;
  addItemToInventory(user, 'bacchus', 1);
  queueNotification(
    user,
    'level_up',
    `레벨 ${user.gameState.level} 달성! 레벨업 보상으로 박카스 1병을 받았습니다.`
  );
  return true;
}

function calculateOfflineGains(user, now = new Date()) {
  ensureUserDefaults(user);
  settlePendingStockInvestment(user, now);
  cleanupExpiredBuffs(user, now);
  resetDailyStaminaIfNeeded(user, now);

  const itemStats = calculateItemStats(user.inventory);
  const lastActionTime = new Date(user.gameState.lastActionTime || now);
  let elapsedSeconds = (now.getTime() - lastActionTime.getTime()) / 1000;
  if (elapsedSeconds < 0) elapsedSeconds = 0;

  // --- 2. 스트레스 자연 증가 ---
  const hasLupinBuff = user.buffs.some(b => b.buffId === 'lupin_buff');
  let gainedStress = 0;
  if (!hasLupinBuff) {
      // 10분에 1 증가 = 600초에 1 증가
      const STRESS_INC_PER_SEC = 1 / 600;
      const stressReductionRate = Math.max(0, 1 - ((itemStats.stressReduction || 0) / 100));
      gainedStress = STRESS_INC_PER_SEC * elapsedSeconds * stressReductionRate;
      user.gameState.stress = Math.min(100, user.gameState.stress + gainedStress);
  if (elapsedSeconds === 0) {
    user.gameState.lastActionTime = now;
    return;
  }

  // --- 3. 돈과 경험치 획득 ---
  // [수정] 하루 30만원 기준 초당 획득량 (300000 / 24시간 / 60분 / 60초 = 약 3.4722)
  const BASE_MONEY_PER_SEC = 3.47222;
  // 하루 경험치 200 기준 초당 획득량 (200 / 24 / 60 / 60 = 약 0.002315)
  const BASE_EXP_PER_SEC = 0.002315;
  
  const levelFactorMoney = Math.pow(1.05, user.gameState.level - 1);
  // 일일 자동 획득 경험치량은 +1 레벨마다 8% 증가
  const levelFactorExp = Math.pow(1.08, user.gameState.level - 1);
  const derivedStats = calculateDerivedStats(user, now);

  const moneyBonusRate = 1 + ((itemStats.moneyBonus || 0) / 100);
  const expBonusRate = 1 + ((itemStats.expBonus || 0) / 100);
  if (!hasBuff(user, 'lupin_stress_buff', now)) {
    const gainedStress = elapsedSeconds * BASE_STRESS_PER_SECOND * derivedStats.stressMultiplier;
    user.gameState.stress = Number(Math.min(100, user.gameState.stress + gainedStress).toFixed(2));
  }

  const moneyPerSec = BASE_MONEY_PER_SEC * levelFactorMoney * moneyBonusRate;
  const expPerSec = BASE_EXP_PER_SEC * levelFactorExp * expBonusRate;
  const rawMoneyGain =
    getSalaryPerSecond(user.gameState.level, derivedStats.moneyBonusPercent) * elapsedSeconds +
    user.gameState.moneyCarry;
  const gainedMoney = Math.floor(rawMoneyGain);
  user.gameState.moneyCarry = Number((rawMoneyGain - gainedMoney).toFixed(6));
  user.gameState.money += gainedMoney;

  // 소수점 단위로 계산하여 누적
  const gainedMoney = moneyPerSec * elapsedSeconds;
  let gainedExp = 0;
  
  // 경험치는 스트레스 100이면 절반
  let currentExpPerSec = expPerSec;
  const passiveExpMultiplier =
    (1 + derivedStats.expBonusPercent / 100) *
    (hasBuff(user, 'lupin_exp_buff', now) ? 1.5 : 1);
  let rawExpGain =
    getPassiveExpPerSecond(user.gameState.level) * passiveExpMultiplier * elapsedSeconds +
    user.gameState.passiveExpCarry;

  if (user.gameState.stress >= 100) {
      currentExpPerSec = expPerSec / 2;
    rawExpGain /= 2;
  }
  gainedExp = currentExpPerSec * elapsedSeconds;

  // DB 저장을 위해 정수로 변환 (돈은 소수점 버림, 경험치는 반올림 등 정책 결정 필요. 여기선 버림)
  user.gameState.money += Math.floor(gainedMoney);
  user.gameState.exp += Math.floor(gainedExp);
  
  // [신규] 레벨업 체크
  const gainedExp = Math.floor(rawExpGain);
  user.gameState.passiveExpCarry = Number((rawExpGain - gainedExp).toFixed(6));
  user.gameState.exp += gainedExp;

  checkLevelUp(user);

  user.gameState.lastActionTime = now;
  
  if (gainedMoney > 1 || gainedExp > 1 || gainedStress > 0.1) {
      console.log(`[오프라인 계산] ${user.username}: +${Math.floor(gainedMoney)}원, +${Math.floor(gainedExp)}EXP, +${gainedStress.toFixed(2)}스트레스`);
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
function buildGameStateResponse(user) {
  const derivedStats = calculateDerivedStats(user, new Date());
  const gameState = user.gameState.toObject ? user.gameState.toObject() : { ...user.gameState };
  gameState.nextLevelExp = getRequiredExp(gameState.level);
  gameState.passiveDailyExp = Number(getPassiveDailyExp(gameState.level).toFixed(2));
  gameState.salaryPerMinute = Number(getSalaryPerMinute(gameState.level, derivedStats.moneyBonusPercent).toFixed(2));
  gameState.clickExp = getClickExp(gameState.level);

  return {
    _id: user._id,
    username: user.username,
    nickname: user.nickname,
    displayName: buildDisplayName(user),
    workHours: user.workHours,
    gameState,
    inventory: user.inventory,
    buffs: user.buffs,
    titles: user.titles,
    pendingStockInvestment: user.pendingStockInvestment,
    itemStats: {
      moneyBonus: derivedStats.moneyBonusPercent,
      itemMoneyBonus: derivedStats.itemMoneyBonusPercent,
      titleMoneyBonus: derivedStats.titleMoneyBonusPercent,
      expBonus: derivedStats.expBonusPercent,
      stressMultiplier: derivedStats.stressMultiplier,
      stressReduction: derivedStats.stressReductionPercent,
      clickStressRelief: derivedStats.clickStressRelief
    },
    shopPrices: getShopPricesForUser(user)
  };
}

// --- API 라우트 ---
function buildUserResponse(user) {
  return {
    user: buildGameStateResponse(user),
    notifications: consumeNotifications(user)
  };
}

// 로그인 및 회원가입
app.post('/api/login', async (req, res) => {
  try {
      const { username, password } = req.body;
      let user = await User.findOne({ username });
      let isNewUser = false;
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
    if (!user) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user = new User({ username, password: hashedPassword });
      ensureUserDefaults(user);
      addItemToInventory(user, 'pen_monami', 1);
      await user.save();
      isNewUser = true;
    } else {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ msg: '비밀번호가 올바르지 않습니다.' });
      }
    }

      if (user.workHours && user.workHours.isSet) {
        if (!isWorkingHour(user.workHours.start, user.workHours.end)) {
          return res.status(403).json({ msg: '아직 근무 시간이 아닙니다.', code: 'NOT_WORKING_HOUR' });
        }
      }
    ensureUserDefaults(user);

      calculateOfflineGains(user);
      // 로그인 시에도 레벨업 체크 후 저장
      checkLevelUp(user);
      await user.save();
    if (user.workHours?.isSet && !isWorkingHour(user.workHours.start, user.workHours.end)) {
      return res.status(403).json({ msg: '아직 근무 시간이 아닙니다.', code: 'NOT_WORKING_HOUR' });
    }

      const itemStats = calculateItemStats(user.inventory);
      const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1d' });
    calculateOfflineGains(user);

      // nextLevelExp 정보도 함께 전송
      const userResponse = user.toObject();
      userResponse.gameState.nextLevelExp = getRequiredExp(user.gameState.level);
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1d' });
    const response = buildUserResponse(user);
    await user.save();

      res.json({ 
          token, 
          user: { 
              _id: userResponse._id,
              username: userResponse.username,
              nickname: userResponse.nickname,
              workHours: userResponse.workHours, 
              gameState: userResponse.gameState,
              inventory: userResponse.inventory,
              buffs: userResponse.buffs,
              itemStats: itemStats
          },
          isNewUser: isNewUser
      });
    res.json({
      token,
      isNewUser,
      ...response
    });
  } catch (err) {
      console.error("서버 에러:", err);
      res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
    console.error('Login error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

// 닉네임 설정 API
app.post('/api/set-nickname', async (req, res) => {
    const { userId, nickname } = req.body;
    if (!userId || !nickname) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });
  const { userId, nickname } = req.body;
  if (!userId || !nickname) {
    return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: '유저를 찾을 수 없습니다.' });
        if (user.nickname) return res.status(400).json({ msg: '이미 닉네임이 설정되어 있습니다.' });
    ensureUserDefaults(user);

        const existingUser = await User.findOne({ nickname: nickname });
        if (existingUser) return res.status(400).json({ msg: '이미 사용 중인 닉네임입니다.' });
    if (user.nickname) {
      return res.status(400).json({ msg: '이미 닉네임이 설정되어 있습니다.' });
    }

        user.nickname = nickname;
        await user.save();
        res.json({ success: true, nickname: user.nickname });
    } catch (err) {
        console.error("닉네임 설정 에러:", err);
        res.status(500).json({ msg: '서버 오류 발생' });
    const existingUser = await User.findOne({ nickname });
    if (existingUser) {
      return res.status(400).json({ msg: '이미 사용 중인 닉네임입니다.' });
    }

    user.nickname = nickname;
    await user.save();
    res.json({ success: true, nickname: user.nickname });
  } catch (err) {
    console.error('Set nickname error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

// "열일하기" 클릭 액션 API
app.post('/api/action/work', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ msg: '유저 ID가 필요합니다.' });
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: '유저를 찾을 수 없습니다.' });
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

        calculateOfflineGains(user);
    calculateOfflineGains(user);
    const now = new Date();
    cleanupExpiredBuffs(user, now);

        user.buffs = user.buffs.filter(buff => new Date(buff.expiresAt) > new Date());
        
        // 스트레스 증가 (최대 100 제한)
        const hasLupinBuff = user.buffs.some(b => b.buffId === 'lupin_buff');
        let stressGain = 0;
        if (!hasLupinBuff) {
            const itemStats = calculateItemStats(user.inventory);
            // 클릭당 스트레스 0.5 증가
            stressGain = 0.5 * (1 - (itemStats.stressReduction || 0) / 100);
            user.gameState.stress = Math.min(100, user.gameState.stress + stressGain);
        }
    const derivedStats = calculateDerivedStats(user, now);
    const hadTooMuchStress = user.gameState.stress >= 100;

        // 경험치 계산: 기본 5, 레벨당 5% 증가
        let baseExpGain = 5;
        
        // "열일하기" 클릭당 경험치는 5%씩 증가함
        const clickLevelFactor = Math.pow(1.05, user.gameState.level - 1);
        baseExpGain = Math.floor(baseExpGain * clickLevelFactor);
    if (!hasBuff(user, 'lupin_stress_buff', now)) {
      const clickStressGain = 0.5 * derivedStats.stressMultiplier;
      user.gameState.stress = Number(Math.min(100, user.gameState.stress + clickStressGain).toFixed(2));
    }

        const itemStats = calculateItemStats(user.inventory);
        const itemExpBonus = 1 + (itemStats.expBonus || 0) / 100;
        const lupinExpBonus = hasLupinBuff ? 1.5 : 1.0;
    if (derivedStats.clickStressRelief > 0) {
      user.gameState.stress = Number(Math.max(0, user.gameState.stress - derivedStats.clickStressRelief).toFixed(2));
    }

        // 스트레스가 100%이면 '열일하기' 클릭으로는 경험치를 획득하지 못함
        let finalExpGain = 0;
        if (user.gameState.stress < 100) {
            finalExpGain = Math.floor(baseExpGain * itemExpBonus * lupinExpBonus);
        }

        user.gameState.exp += finalExpGain;
        user.gameState.lastActionTime = new Date();

        // [신규] 레벨업 체크
        checkLevelUp(user);
    let gainedExp = 0;
    if (!hadTooMuchStress) {
      const expMultiplier = (1 + derivedStats.expBonusPercent / 100) * (hasBuff(user, 'lupin_exp_buff', now) ? 1.5 : 1);
      gainedExp = Math.floor(getClickExp(user.gameState.level) * expMultiplier);
      user.gameState.exp += gainedExp;
    }

        await user.save();
        console.log(`[열일하기] ${user.username}: +${finalExpGain} EXP, +${stressGain.toFixed(1)} 스트레스`);
        
        // 응답에 nextLevelExp 포함
        const userResponse = user.toObject();
        userResponse.gameState.nextLevelExp = getRequiredExp(user.gameState.level);
    checkLevelUp(user);
    user.gameState.lastActionTime = now;

        res.json({
            gameState: userResponse.gameState,
            buffs: userResponse.buffs,
            itemStats: itemStats
        });
    const response = buildUserResponse(user);
    await user.save();

    } catch (err) {
        console.error("액션 처리 중 에러:", err);
        res.status(500).json({ msg: '서버 오류 발생' });
    }
    res.json(response);
  } catch (err) {
    console.error('Work action error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

// "월급루팡" 특수 행동 API
app.post('/api/action/lupin', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ msg: '유저 ID가 필요합니다.' });
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: '유저를 찾을 수 없습니다.' });
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

        calculateOfflineGains(user);
    calculateOfflineGains(user);
    const now = new Date();
    cleanupExpiredBuffs(user, now);

        const STAMINA_COST = 6;
        if (user.gameState.stamina < STAMINA_COST) {
            return res.status(400).json({ msg: '행동력이 부족합니다. (필요: 6)' });
        }
    if (user.gameState.stamina < 6) {
      return res.status(400).json({ msg: '행동력이 부족합니다. (필요: 6)' });
    }

        user.buffs = user.buffs.filter(buff => new Date(buff.expiresAt) > new Date());
        if (user.buffs.some(b => b.buffId === 'lupin_buff')) {
             return res.status(400).json({ msg: '이미 월급루팡 중입니다!' });
        }
    if (hasBuff(user, 'lupin_stress_buff', now) || hasBuff(user, 'lupin_exp_buff', now)) {
      return res.status(400).json({ msg: '이미 월급루팡 효과가 적용 중입니다.' });
    }

        user.gameState.stamina -= STAMINA_COST;
    user.gameState.stamina -= 6;
    setOrRefreshBuff(user, 'lupin_stress_buff', LUPIN_STRESS_DURATION_MS);
    setOrRefreshBuff(user, 'lupin_exp_buff', LUPIN_EXP_DURATION_MS);
    user.gameState.lastActionTime = now;

        const expiresAt = new Date(new Date().getTime() + 1 * 60 * 60 * 1000);
        user.buffs.push({
            buffId: 'lupin_buff',
            expiresAt: expiresAt
        });
    const response = buildUserResponse(user);
    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Lupin action error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

        user.gameState.lastActionTime = new Date();
        
        // 액션 후에도 레벨업 체크 (자동 획득분 반영을 위해)
        checkLevelUp(user);
        await user.save();
app.post('/api/action/nap', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

        console.log(`[월급루팡] ${user.username}: 행동력 -${STAMINA_COST}, 버프 적용 완료`);
        
        const userResponse = user.toObject();
        userResponse.gameState.nextLevelExp = getRequiredExp(user.gameState.level);
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

        res.json({
            gameState: userResponse.gameState,
            buffs: userResponse.buffs,
            itemStats: calculateItemStats(user.inventory)
        });
    calculateOfflineGains(user);
    const now = new Date();

    } catch (err) {
        console.error("액션 처리 중 에러:", err);
        res.status(500).json({ msg: '서버 오류 발생' });
    if (user.gameState.stamina < 3) {
      return res.status(400).json({ msg: '행동력이 부족합니다. (필요: 3)' });
    }

    user.gameState.stamina -= 3;
    user.gameState.stress = Number(Math.max(0, user.gameState.stress - 30).toFixed(2));
    user.gameState.lastActionTime = now;

    const response = buildUserResponse(user);
    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Nap action error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

// "낮잠자기" 특수 행동 API
app.post('/api/action/nap', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ msg: '유저 ID가 필요합니다.' });
app.post('/api/action/stock', async (req, res) => {
  const { userId, amount } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: '유저를 찾을 수 없습니다.' });
  const investAmount = Math.floor(Number(amount));
  if (!Number.isFinite(investAmount) || investAmount <= 0) {
    return res.status(400).json({ msg: '투자 금액을 올바르게 입력해주세요.' });
  }

        calculateOfflineGains(user);
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

        // 행동력 체크 (3 소모)
        const STAMINA_COST = 3;
        if (user.gameState.stamina < STAMINA_COST) {
            return res.status(400).json({ msg: '행동력이 부족합니다. (필요: 3)' });
        }
    calculateOfflineGains(user);
    const now = new Date();

        // 행동력 소모
        user.gameState.stamina -= STAMINA_COST;
    if (user.pendingStockInvestment?.amount > 0) {
      return res.status(400).json({ msg: '이미 정산 대기 중인 주식 투자가 있습니다.' });
    }

        // 스트레스 감소 (30 감소, 최소 0)
        user.gameState.stress = Math.max(0, user.gameState.stress - 30);
    if (user.gameState.stamina < 1) {
      return res.status(400).json({ msg: '행동력이 부족합니다. (필요: 1)' });
    }

        user.gameState.lastActionTime = new Date();
        
        // 액션 후에도 레벨업 체크
        checkLevelUp(user);
        await user.save();
    if (investAmount > user.gameState.money) {
      return res.status(400).json({ msg: '보유 자산보다 많은 금액은 투자할 수 없습니다.' });
    }

        console.log(`[낮잠자기] ${user.username}: 행동력 -${STAMINA_COST}, 스트레스 -30`);
        
        const userResponse = user.toObject();
        userResponse.gameState.nextLevelExp = getRequiredExp(user.gameState.level);
    const moneyBeforeInvestment = user.gameState.money;

        res.json({
            gameState: userResponse.gameState,
            buffs: userResponse.buffs,
            itemStats: calculateItemStats(user.inventory)
        });
    user.gameState.money -= investAmount;
    user.gameState.stamina -= 1;
    user.pendingStockInvestment = {
      amount: investAmount,
      investedOn: getKSTDateKey(now)
    };
    user.gameState.lastActionTime = now;

    } catch (err) {
        console.error("액션 처리 중 에러:", err);
        res.status(500).json({ msg: '서버 오류 발생' });
    if (moneyBeforeInvestment >= 500000 && investAmount >= moneyBeforeInvestment * 0.9) {
      unlockTitle(user, 'beast_heart');
    }

    const response = buildUserResponse(user);
    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Stock action error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

// 상점 구매 API
app.post('/api/shop/buy', async (req, res) => {
    const { userId, itemId } = req.body;
    if (!userId || !itemId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });
  const { userId, itemId } = req.body;
  if (!userId || !itemId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });

    const itemInfo = ITEM_DATA[itemId];
    if (!itemInfo) return res.status(400).json({ msg: '존재하지 않는 아이템입니다.' });
  const itemInfo = ITEM_DATA[itemId];
  if (!itemInfo) return res.status(400).json({ msg: '존재하지 않는 아이템입니다.' });

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: '유저를 찾을 수 없습니다.' });
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

        calculateOfflineGains(user);
    calculateOfflineGains(user);
    const now = new Date();
    const price = getItemPrice(user, itemId);

        if (user.gameState.money < itemInfo.price) {
            return res.status(400).json({ msg: '잔고가 부족합니다.' });
        }
    if (user.gameState.money < price) {
      return res.status(400).json({ msg: '잔고가 부족합니다.' });
    }

        user.gameState.money -= itemInfo.price;
        
        const existingItem = user.inventory.find(item => item.itemId === itemId);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            user.inventory.push({ itemId: itemId, quantity: 1 });
        }
    user.gameState.money -= price;
    addItemToInventory(user, itemId, 1);
    user.gameState.lastActionTime = now;

        user.gameState.lastActionTime = new Date();
        
        // 구매 후에도 레벨업 체크
        checkLevelUp(user);
        await user.save();
    const response = buildUserResponse(user);
    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Shop buy error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

        console.log(`[상점 구매] ${user.username}: ${itemInfo.name} 구매 완료`);
app.post('/api/inventory/use', async (req, res) => {
  const { userId, itemId } = req.body;
  if (!userId || !itemId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });

        const userResponse = user.toObject();
        userResponse.gameState.nextLevelExp = getRequiredExp(user.gameState.level);
        
        res.json({
            gameState: userResponse.gameState,
            inventory: userResponse.inventory,
            itemStats: calculateItemStats(user.inventory)
        });
  const itemInfo = ITEM_DATA[itemId];
  if (!itemInfo || itemInfo.type !== 'consumable') {
    return res.status(400).json({ msg: '사용할 수 없는 아이템입니다.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    calculateOfflineGains(user);
    const now = new Date();

    } catch (err) {
        console.error("구매 처리 중 에러:", err);
        res.status(500).json({ msg: '서버 오류 발생' });
    if (!removeItemFromInventory(user, itemId, 1)) {
      return res.status(400).json({ msg: '해당 아이템이 부족합니다.' });
    }
});

    if (itemId === 'bacchus') {
      user.gameState.stamina = Math.min(user.gameState.maxStamina, user.gameState.stamina + 1);
      queueNotification(user, 'item_use', '박카스를 마셨습니다. 행동력이 1 회복되었습니다.');
    } else if (itemId === 'hot6') {
      user.gameState.stress = Number(Math.max(0, user.gameState.stress - 10).toFixed(2));
      setOrRefreshBuff(user, 'hot6_buff', HOT6_DURATION_MS);
      queueNotification(user, 'item_use', '핫식스를 사용했습니다. 스트레스가 10 감소하고 10분 버프가 적용되었습니다.');
    }

// 현재 상태 동기화 API: 접속 중에도 자동 급여/경험치/스트레스 흐름을 반영
app.post('/api/sync', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ msg: '유저 ID가 필요합니다.' });
    user.gameState.lastActionTime = now;
    const response = buildUserResponse(user);
    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Inventory use error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: '유저를 찾을 수 없습니다.' });
app.post('/api/title/toggle', async (req, res) => {
  const { userId, titleId } = req.body;
  if (!userId || !titleId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });
  if (!TITLE_DATA[titleId]) return res.status(400).json({ msg: '존재하지 않는 칭호입니다.' });

        calculateOfflineGains(user);
        await user.save();
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

        const userResponse = user.toObject();
        userResponse.gameState.nextLevelExp = getRequiredExp(user.gameState.level);
    calculateOfflineGains(user);
    ensureUserDefaults(user);

        res.json({
            gameState: userResponse.gameState,
            inventory: userResponse.inventory,
            buffs: userResponse.buffs,
            itemStats: calculateItemStats(user.inventory)
        });
    } catch (err) {
        console.error("상태 동기화 에러:", err);
        res.status(500).json({ msg: '서버 오류 발생' });
    if (!user.titles.unlocked.includes(titleId)) {
      return res.status(400).json({ msg: '아직 해금하지 않은 칭호입니다.' });
    }

    user.titles.equipped = user.titles.equipped === titleId ? null : titleId;
    const response = buildUserResponse(user);
    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Title toggle error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/sync', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    calculateOfflineGains(user);
    const response = buildUserResponse(user);
    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

// 실시간 랭킹 API
app.get('/api/ranking', async (req, res) => {
    try {
        // 레벨 높은순, 경험치 높은순 정렬 (이미 구현되어 있음)
        const ranking = await User.find({ nickname: { $ne: null } })
            .sort({ 'gameState.level': -1, 'gameState.exp': -1 })
            .limit(20)
            .select('nickname gameState.level');
  try {
    const rankingUsers = await User.find({ nickname: { $ne: null } })
      .sort({ 'gameState.level': -1, 'gameState.exp': -1 })
      .limit(20)
      .select('nickname gameState.level gameState.exp titles');

        res.json(ranking);
    } catch (err) {
        console.error("랭킹 조회 에러:", err);
        res.status(500).json({ msg: '서버 오류 발생' });
    }
    const ranking = rankingUsers.map((user) => ({
      nickname: user.nickname,
      displayName: buildDisplayName(user),
      gameState: {
        level: user.gameState.level,
        exp: user.gameState.exp
      }
    }));

    res.json(ranking);
  } catch (err) {
    console.error('Ranking error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));