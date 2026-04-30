require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();

const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const ADMIN_USERNAME = 'dinguree';
const ADMIN_PASSWORD = 'dinguree';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const BASE_DAILY_SALARY = 300000;
const BASE_DAILY_PASSIVE_EXP = 400;
const BASE_CLICK_EXP = 5;
const IDLE_STRESS_PER_SECOND = 1 / 1800;
const CLICK_STRESS_GAIN = 0.25;
const LUPIN_STRESS_DURATION_MS = 60 * 60 * 1000;
const LUPIN_EXP_DURATION_MS = 2 * 60 * 60 * 1000;
const HOT6_DURATION_MS = 10 * 60 * 1000;
const FIELD_WORK_DURATION_MS = 12 * 60 * 60 * 1000;
const SHOPPING_ADDICT_THRESHOLD = 1500000;
const SHOPPING_ADDICT_LOSE_AFTER_DAYS = 3;
const RICH_THRESHOLD = 5000000;
const BEAST_HEART_UNLOCK_THRESHOLD = 2000000;

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
    hoverDesc: '가방에서 사용하면 행동력을 1 회복합니다.'
  },
  hot6: {
    name: '핫식스',
    price: 100000,
    type: 'consumable',
    desc: '사용 시 스트레스 -10, 10분 버프',
    hoverDesc: '사용 즉시 스트레스를 10 낮추고, 10분 동안 서류작업 클릭마다 스트레스를 0.1 낮춥니다.'
  }
};

const BUFF_DATA = {
  lupin_stress_buff: { name: '월급루팡', durationMs: LUPIN_STRESS_DURATION_MS },
  lupin_exp_buff: { name: '월급루팡 집중', durationMs: LUPIN_EXP_DURATION_MS },
  hot6_buff: { name: '핫식스 버프', durationMs: HOT6_DURATION_MS },
  field_work_buff: { name: '외근 버프', durationMs: FIELD_WORK_DURATION_MS }
};

const TITLE_DATA = {
  newcomer: {
    name: '신입직원',
    unlockDesc: '1회 이상 로그인 시 획득',
    baseDesc: '장착 시 매 60분마다 스트레스 -5',
    effects: { hourlyStressRelief: 5 }
  },
  mental_master: {
    name: '멘탈甲',
    unlockDesc: '스트레스 감소율이 30%를 초과하면 획득',
    baseDesc: '장착 시 매 60분마다 스트레스 -6, 월급 +3.5%',
    effects: { hourlyStressRelief: 6, moneyBonus: 3.5 }
  },
  high_salary: {
    name: '고액연봉자',
    unlockDesc: '1분당 획득 월급이 2000원 이상이면 획득',
    baseDesc: '장착 시 스트레스 감소율 +10%, 월급 +5%',
    effects: { titleStressMultiplier: 0.9, moneyBonus: 5 }
  },
  shopping_addict: {
    name: '쇼핑중독자',
    unlockDesc: '하루 동안 인터넷 쇼핑에 누적 150만원 이상 사용 시 획득',
    baseDesc: '장착 시 쇼핑 구매마다 스트레스 -10, 월급 +3.5%',
    effects: { moneyBonus: 3.5, shopStressRelief: 10 },
    removable: true
  },
  rich: {
    name: '대부호',
    unlockDesc: '보유 자산이 500만원 이상일 때 획득',
    baseDesc: '장착 시 월급 +6%, 스트레스 감소율 +15%',
    effects: { moneyBonus: 6, titleStressMultiplier: 0.85 },
    removable: true
  },
  beast_heart: {
    name: '야수의 심장',
    unlockDesc: '보유 자산이 200만원 이상일 때 현재 보유 자산의 90% 이상을 주식 투자하면 획득',
    baseDesc: '장착 시 매 60분마다 스트레스 -8, 월급 +5%',
    effects: { hourlyStressRelief: 8, moneyBonus: 5 }
  }
};

const ADMIN_GIFT_CATALOG = {
  items: Object.entries(ITEM_DATA).map(([id, item]) => ({
    id,
    name: item.name,
    type: item.type
  })),
  buffs: Object.entries(BUFF_DATA).map(([id, buff]) => ({
    id,
    name: buff.name,
    durationMs: buff.durationMs
  }))
};

if (!MONGO_URI) {
  console.error('MONGO_URI is not configured in .env.');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET is missing, using an unsafe default for development.');
}

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'server is running' });
});

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

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
    moneyCarry: { type: Number, default: 0 },
    passiveExpCarry: { type: Number, default: 0 },
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
  }],
  titles: {
    unlocked: { type: [String], default: [] },
    equipped: { type: String, default: null }
  },
  pendingStockInvestment: {
    amount: { type: Number, default: 0 },
    investedOn: { type: String, default: null }
  },
  shopState: {
    dayKey: { type: String, default: null },
    dailySpend: { type: Number, default: 0 },
    lastShoppingAddictQualifiedDayKey: { type: String, default: null }
  },
  meta: {
    loginCount: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null }
  },
  pendingNotifications: [{
    type: { type: String, default: 'info' },
    text: { type: String, required: true }
  }]
});

const User = mongoose.model('User', userSchema);

function getKSTDateKey(date = new Date()) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateKeyToUtcMillis(dateKey) {
  if (!dateKey) return null;
  return Date.parse(`${dateKey}T00:00:00Z`);
}

function getDateKeyDiff(a, b) {
  const aMs = dateKeyToUtcMillis(a);
  const bMs = dateKeyToUtcMillis(b);
  if (aMs === null || bMs === null) return 0;
  return Math.floor((aMs - bMs) / (24 * 60 * 60 * 1000));
}

function isWorkingHour(start, end) {
  const now = new Date();
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
  if (!Array.isArray(user.pendingNotifications)) user.pendingNotifications = [];

  if (!user.titles) {
    user.titles = { unlocked: [], equipped: null };
  }
  if (!Array.isArray(user.titles.unlocked)) user.titles.unlocked = [];
  if (!Object.prototype.hasOwnProperty.call(user.titles, 'equipped')) {
    user.titles.equipped = null;
  }

  if (!user.pendingStockInvestment || typeof user.pendingStockInvestment !== 'object') {
    user.pendingStockInvestment = { amount: 0, investedOn: null };
  }
  user.pendingStockInvestment.amount = Number(user.pendingStockInvestment.amount ?? 0);
  user.pendingStockInvestment.investedOn = user.pendingStockInvestment.investedOn || null;

  if (!user.shopState) {
    user.shopState = {
      dayKey: null,
      dailySpend: 0,
      lastShoppingAddictQualifiedDayKey: null
    };
  }
  user.shopState.dayKey = user.shopState.dayKey || null;
  user.shopState.dailySpend = Number(user.shopState.dailySpend ?? 0);
  user.shopState.lastShoppingAddictQualifiedDayKey = user.shopState.lastShoppingAddictQualifiedDayKey || null;

  if (!user.meta) {
    user.meta = { loginCount: 0, lastLoginAt: null };
  }
  user.meta.loginCount = Number(user.meta.loginCount ?? 0);
  user.meta.lastLoginAt = user.meta.lastLoginAt || null;

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
    return Math.round(itemInfo.price * getMonamiPriceMultiplier(getInventoryQuantity(user, itemId)));
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

function getEquippedTitleDefinition(user) {
  if (!user.titles?.equipped) return null;
  return TITLE_DATA[user.titles.equipped] || null;
}

function buildDisplayName(user) {
  const titleInfo = getEquippedTitleDefinition(user);
  const baseName = user.nickname || user.username;
  const titlePrefix = titleInfo ? `<${titleInfo.name}>` : '';
  return `${titlePrefix}${baseName}`;
}

function unlockTitle(user, titleId) {
  if (!TITLE_DATA[titleId]) return false;
  if (user.titles.unlocked.includes(titleId)) return false;
  user.titles.unlocked.push(titleId);
  queueNotification(user, 'title_unlock', `<${TITLE_DATA[titleId].name}> 칭호를 획득하였습니다!`);
  return true;
}

function removeTitle(user, titleId) {
  if (!user.titles.unlocked.includes(titleId)) return false;
  user.titles.unlocked = user.titles.unlocked.filter((id) => id !== titleId);
  if (user.titles.equipped === titleId) {
    user.titles.equipped = null;
  }
  return true;
}

function syncDailyShopState(user, now = new Date()) {
  const todayKey = getKSTDateKey(now);
  if (user.shopState.dayKey !== todayKey) {
    user.shopState.dayKey = todayKey;
    user.shopState.dailySpend = 0;
  }
}

function getShoppingDaysWithoutBigSpend(user, now = new Date()) {
  const lastKey = user.shopState.lastShoppingAddictQualifiedDayKey;
  if (!lastKey) return 0;
  return Math.max(0, getDateKeyDiff(getKSTDateKey(now), lastKey));
}

function recordShopSpend(user, amount, now = new Date()) {
  syncDailyShopState(user, now);
  user.shopState.dailySpend += amount;
  if (user.shopState.dailySpend >= SHOPPING_ADDICT_THRESHOLD) {
    user.shopState.lastShoppingAddictQualifiedDayKey = user.shopState.dayKey;
    unlockTitle(user, 'shopping_addict');
  }
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

    if (data.stats.moneyBonus) stats.moneyBonus += data.stats.moneyBonus * item.quantity;
    if (data.stats.expBonus) stats.expBonus += data.stats.expBonus * item.quantity;
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

function calculateDerivedStats(user, now = new Date()) {
  cleanupExpiredBuffs(user, now);

  const itemStats = calculateItemStats(user.inventory);
  const titleDef = getEquippedTitleDefinition(user);
  const titleEffects = titleDef?.effects || {};

  const moneyBonusPercent = itemStats.moneyBonus + (titleEffects.moneyBonus || 0);
  const titleStressMultiplier = titleEffects.titleStressMultiplier || 1;
  const hot6ClickStressRelief = hasBuff(user, 'hot6_buff', now) ? 0.1 : 0;
  const passiveExpMultiplier = hasBuff(user, 'field_work_buff', now) ? 5 : 1;
  const clickExpMultiplier = hasBuff(user, 'field_work_buff', now) ? 0.5 : 1;

  const finalStressMultiplier = Number((itemStats.stressMultiplier * titleStressMultiplier).toFixed(6));

  return {
    moneyBonusPercent: Number(moneyBonusPercent.toFixed(2)),
    itemMoneyBonusPercent: itemStats.moneyBonus,
    titleMoneyBonusPercent: Number((titleEffects.moneyBonus || 0).toFixed(2)),
    expBonusPercent: itemStats.expBonus,
    stressMultiplier: finalStressMultiplier,
    stressReductionPercent: Number(((1 - finalStressMultiplier) * 100).toFixed(2)),
    clickStressRelief: Number((itemStats.clickStressRelief + hot6ClickStressRelief).toFixed(2)),
    hourlyStressRelief: Number((titleEffects.hourlyStressRelief || 0).toFixed(2)),
    shopStressRelief: Number((titleEffects.shopStressRelief || 0).toFixed(2)),
    passiveExpMultiplier,
    clickExpMultiplier
  };
}

function getRequiredExp(level) {
  return Math.floor(1000 * Math.pow(1.1, level - 1));
}

function getPassiveDailyExp(level) {
  return BASE_DAILY_PASSIVE_EXP * Math.pow(1.08, level - 1);
}

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

  const todayKey = getKSTDateKey(now);
  if (todayKey <= investment.investedOn) return;

  const rate = Math.floor(Math.random() * 61) - 30;
  const payout = Math.round(investment.amount * (1 + rate / 100));
  const delta = payout - investment.amount;
  const deltaPrefix = delta >= 0 ? '+' : '';
  const ratePrefix = rate >= 0 ? '+' : '';

  user.gameState.money += payout;
  user.pendingStockInvestment = { amount: 0, investedOn: null };
  queueNotification(
    user,
    'stock_result',
    `어제의 주식 투자 결과입니다. ${ratePrefix}${rate}% (${deltaPrefix}${delta.toLocaleString()}원), 총 ${payout.toLocaleString()}원을 돌려받았습니다.`
  );
}

function resetDailyStaminaIfNeeded(user, now = new Date()) {
  const currentKey = getKSTDateKey(now);
  const lastResetKey = getKSTDateKey(new Date(user.gameState.lastStaminaResetTime));

  if (currentKey !== lastResetKey) {
    user.gameState.stamina = user.gameState.maxStamina;
    user.gameState.lastStaminaResetTime = now;
  }
}

function reconcileTitles(user, now = new Date()) {
  if (user.meta.loginCount > 0) {
    unlockTitle(user, 'newcomer');
  }

  const currentStats = calculateDerivedStats(user, now);
  const currentSalaryPerMinute = getSalaryPerMinute(user.gameState.level, currentStats.moneyBonusPercent);

  if (currentStats.stressReductionPercent > 30) {
    unlockTitle(user, 'mental_master');
  }

  if (currentSalaryPerMinute >= 2000) {
    unlockTitle(user, 'high_salary');
  }

  if (user.gameState.money >= RICH_THRESHOLD) {
    unlockTitle(user, 'rich');
  } else {
    removeTitle(user, 'rich');
  }

  const shoppingDaysWithoutBigSpend = getShoppingDaysWithoutBigSpend(user, now);
  if (shoppingDaysWithoutBigSpend > SHOPPING_ADDICT_LOSE_AFTER_DAYS) {
    removeTitle(user, 'shopping_addict');
  }
}

function checkLevelUp(user) {
  const requiredExp = getRequiredExp(user.gameState.level);
  if (user.gameState.exp < requiredExp) return false;

  user.gameState.level += 1;
  user.gameState.exp = 0;
  user.gameState.passiveExpCarry = 0;
  addItemToInventory(user, 'bacchus', 1);
  queueNotification(user, 'level_up', `레벨 ${user.gameState.level} 달성! 레벨업 보상으로 박카스 1병을 받았습니다.`);
  return true;
}

function calculateOfflineGains(user, now = new Date()) {
  ensureUserDefaults(user);
  syncDailyShopState(user, now);
  settlePendingStockInvestment(user, now);
  cleanupExpiredBuffs(user, now);
  resetDailyStaminaIfNeeded(user, now);
  reconcileTitles(user, now);

  const lastActionTime = new Date(user.gameState.lastActionTime || now);
  let elapsedSeconds = (now.getTime() - lastActionTime.getTime()) / 1000;
  if (elapsedSeconds < 0) elapsedSeconds = 0;

  if (elapsedSeconds === 0) {
    user.gameState.lastActionTime = now;
    return;
  }

  const derivedStats = calculateDerivedStats(user, now);

  if (!hasBuff(user, 'lupin_stress_buff', now)) {
    const gainedStress = elapsedSeconds * IDLE_STRESS_PER_SECOND * derivedStats.stressMultiplier;
    user.gameState.stress = Number(Math.min(100, user.gameState.stress + gainedStress).toFixed(2));
  }

  if (derivedStats.hourlyStressRelief > 0) {
    const stressRelief = (derivedStats.hourlyStressRelief / 3600) * elapsedSeconds;
    user.gameState.stress = Number(Math.max(0, user.gameState.stress - stressRelief).toFixed(2));
  }

  const rawMoneyGain =
    getSalaryPerSecond(user.gameState.level, derivedStats.moneyBonusPercent) * elapsedSeconds +
    user.gameState.moneyCarry;
  const gainedMoney = Math.floor(rawMoneyGain);
  user.gameState.moneyCarry = Number((rawMoneyGain - gainedMoney).toFixed(6));
  user.gameState.money += gainedMoney;

  const passiveExpMultiplier =
    (1 + derivedStats.expBonusPercent / 100) *
    (hasBuff(user, 'lupin_exp_buff', now) ? 1.5 : 1) *
    derivedStats.passiveExpMultiplier;
  let rawExpGain =
    getPassiveExpPerSecond(user.gameState.level) * passiveExpMultiplier * elapsedSeconds +
    user.gameState.passiveExpCarry;

  if (user.gameState.stress >= 100) {
    rawExpGain /= 2;
  }

  const gainedExp = Math.floor(rawExpGain);
  user.gameState.passiveExpCarry = Number((rawExpGain - gainedExp).toFixed(6));
  user.gameState.exp += gainedExp;

  checkLevelUp(user);
  reconcileTitles(user, now);
  user.gameState.lastActionTime = now;
}

function buildTitleDetails(user, now = new Date()) {
  const shoppingDaysWithoutBigSpend = getShoppingDaysWithoutBigSpend(user, now);

  return user.titles.unlocked
    .filter((titleId) => TITLE_DATA[titleId])
    .map((titleId) => {
      const title = TITLE_DATA[titleId];
      let desc = title.baseDesc;

      if (titleId === 'shopping_addict') {
        desc += ` / 현재 누적 ${shoppingDaysWithoutBigSpend}일동안 쇼핑을 하지 않았습니다!`;
        desc += ' / 3일을 초과해 하루 150만원 쇼핑을 달성하지 못하면 사라집니다.';
      }

      if (titleId === 'rich') {
        desc += ' / 보유 자산이 500만원 미만으로 내려가면 사라집니다.';
      }

      if (titleId === 'beast_heart') {
        desc += ' / 보유 자산 200만원 이상에서 자산의 90% 이상을 주식 투자하면 획득합니다.';
      }

      return {
        id: titleId,
        name: title.name,
        desc,
        unlockDesc: title.unlockDesc,
        equipped: user.titles.equipped === titleId
      };
    });
}

function buildGameStateResponse(user, now = new Date()) {
  const derivedStats = calculateDerivedStats(user, now);
  const gameState = user.gameState.toObject ? user.gameState.toObject() : { ...user.gameState };
  gameState.nextLevelExp = getRequiredExp(gameState.level);
  gameState.passiveDailyExp = Number(getPassiveDailyExp(gameState.level).toFixed(2));
  gameState.salaryPerMinute = Number(getSalaryPerMinute(gameState.level, derivedStats.moneyBonusPercent).toFixed(2));
  gameState.clickExp = getClickExp(gameState.level);

  return {
    _id: user._id,
    isAdmin: false,
    username: user.username,
    nickname: user.nickname,
    displayName: buildDisplayName(user),
    workHours: user.workHours,
    gameState,
    inventory: user.inventory,
    buffs: user.buffs,
    titles: user.titles,
    titleDetails: buildTitleDetails(user, now),
    pendingStockInvestment: user.pendingStockInvestment,
    shopState: user.shopState,
    meta: {
      loginCount: user.meta.loginCount
    },
    itemStats: {
      moneyBonus: derivedStats.moneyBonusPercent,
      itemMoneyBonus: derivedStats.itemMoneyBonusPercent,
      titleMoneyBonus: derivedStats.titleMoneyBonusPercent,
      expBonus: derivedStats.expBonusPercent,
      stressMultiplier: derivedStats.stressMultiplier,
      stressReduction: derivedStats.stressReductionPercent,
      clickStressRelief: derivedStats.clickStressRelief,
      hourlyStressRelief: derivedStats.hourlyStressRelief,
      shopStressRelief: derivedStats.shopStressRelief,
      passiveExpMultiplier: derivedStats.passiveExpMultiplier,
      clickExpMultiplier: derivedStats.clickExpMultiplier
    },
    shopPrices: getShopPricesForUser(user)
  };
}

function buildUserResponse(user, now = new Date()) {
  return {
    user: buildGameStateResponse(user, now),
    notifications: consumeNotifications(user)
  };
}

async function buildUserResponseWithGlobals(user, now = new Date()) {
  return buildUserResponse(user, now);
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function requireAdmin(req, res) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      res.status(401).json({ msg: '관리자 인증이 필요합니다.' });
      return null;
    }

    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload?.admin) {
      res.status(403).json({ msg: '관리자 권한이 없습니다.' });
      return null;
    }

    return payload;
  } catch (err) {
    res.status(401).json({ msg: '관리자 인증이 유효하지 않습니다.' });
    return null;
  }
}

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const token = jwt.sign({ admin: true, username: ADMIN_USERNAME }, JWT_SECRET, { expiresIn: '1d' });
      return res.json({
        token,
        isAdmin: true,
        admin: {
          username: ADMIN_USERNAME,
          displayName: '운영자'
        },
        giftCatalog: ADMIN_GIFT_CATALOG
      });
    }

    let user = await User.findOne({ username });
    let isNewUser = false;
    const now = new Date();

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

    ensureUserDefaults(user);
    user.meta.loginCount += 1;
    user.meta.lastLoginAt = now;

    if (user.workHours?.isSet && !isWorkingHour(user.workHours.start, user.workHours.end)) {
      return res.status(403).json({ msg: '아직 근무 시간이 아닙니다.', code: 'NOT_WORKING_HOUR' });
    }

    calculateOfflineGains(user, now);
    reconcileTitles(user, now);

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1d' });
    const response = await buildUserResponseWithGlobals(user, now);
    await user.save();

    res.json({
      token,
      isNewUser,
      isAdmin: false,
      ...response
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/set-nickname', async (req, res) => {
  const { userId, nickname } = req.body;
  if (!userId || !nickname) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    ensureUserDefaults(user);

    if (user.nickname) return res.status(400).json({ msg: '이미 닉네임이 설정되어 있습니다.' });

    const existingUser = await User.findOne({ nickname });
    if (existingUser) return res.status(400).json({ msg: '이미 사용 중인 닉네임입니다.' });

    user.nickname = nickname;
    await user.save();
    res.json({ success: true, nickname: user.nickname });
  } catch (err) {
    console.error('Set nickname error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/action/work', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    calculateOfflineGains(user, now);
    cleanupExpiredBuffs(user, now);

    const derivedStats = calculateDerivedStats(user, now);
    const hadTooMuchStress = user.gameState.stress >= 100;

    if (!hasBuff(user, 'lupin_stress_buff', now)) {
      const clickStressGain = CLICK_STRESS_GAIN * derivedStats.stressMultiplier;
      user.gameState.stress = Number(Math.min(100, user.gameState.stress + clickStressGain).toFixed(2));
    }

    if (derivedStats.clickStressRelief > 0) {
      user.gameState.stress = Number(Math.max(0, user.gameState.stress - derivedStats.clickStressRelief).toFixed(2));
    }

    if (!hadTooMuchStress) {
      const expMultiplier = (1 + derivedStats.expBonusPercent / 100) * (hasBuff(user, 'lupin_exp_buff', now) ? 1.5 : 1);
      user.gameState.exp += Math.floor(getClickExp(user.gameState.level) * expMultiplier * derivedStats.clickExpMultiplier);
    }

    checkLevelUp(user);
    reconcileTitles(user, now);
    user.gameState.lastActionTime = now;

    const response = await buildUserResponseWithGlobals(user, now);
    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Work action error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/action/field-work', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    calculateOfflineGains(user, now);
    cleanupExpiredBuffs(user, now);

    if (user.gameState.stamina < 6) {
      return res.status(400).json({ msg: '행동력이 부족합니다. (필요: 6)' });
    }

    if (hasBuff(user, 'field_work_buff', now)) {
      return res.status(400).json({ msg: '이미 외근 중입니다.' });
    }

    user.gameState.stamina -= 6;
    setOrRefreshBuff(user, 'field_work_buff', FIELD_WORK_DURATION_MS);
    user.gameState.lastActionTime = now;

    const response = await buildUserResponseWithGlobals(user, now);
    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Field work action error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/action/lupin', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    calculateOfflineGains(user, now);
    cleanupExpiredBuffs(user, now);

    if (user.gameState.stamina < 6) {
      return res.status(400).json({ msg: '행동력이 부족합니다. (필요: 6)' });
    }

    if (hasBuff(user, 'lupin_stress_buff', now) || hasBuff(user, 'lupin_exp_buff', now)) {
      return res.status(400).json({ msg: '이미 월급루팡 효과가 적용 중입니다.' });
    }

    user.gameState.stamina -= 6;
    setOrRefreshBuff(user, 'lupin_stress_buff', LUPIN_STRESS_DURATION_MS);
    setOrRefreshBuff(user, 'lupin_exp_buff', LUPIN_EXP_DURATION_MS);
    user.gameState.lastActionTime = now;

    const response = await buildUserResponseWithGlobals(user, now);
    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Lupin action error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/action/nap', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    calculateOfflineGains(user, now);

    if (user.gameState.stamina < 3) {
      return res.status(400).json({ msg: '행동력이 부족합니다. (필요: 3)' });
    }

    user.gameState.stamina -= 3;
    user.gameState.stress = Number(Math.max(0, user.gameState.stress - 30).toFixed(2));
    user.gameState.lastActionTime = now;

    const response = await buildUserResponseWithGlobals(user, now);
    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Nap action error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/action/stock', async (req, res) => {
  const { userId, amount } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  const investAmount = Math.floor(Number(amount));
  if (!Number.isFinite(investAmount) || investAmount <= 0) {
    return res.status(400).json({ msg: '투자 금액을 올바르게 입력해주세요.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    calculateOfflineGains(user, now);

    if (user.pendingStockInvestment?.amount > 0) {
      return res.status(400).json({ msg: '이미 오늘 주식 투자를 완료했습니다. 다음 결과 확인 후 다시 투자할 수 있습니다.' });
    }

    if (investAmount > user.gameState.money) {
      return res.status(400).json({ msg: '보유 자산보다 많은 금액은 투자할 수 없습니다.' });
    }

    const moneyBeforeInvestment = user.gameState.money;
    user.gameState.money -= investAmount;
    user.pendingStockInvestment = {
      amount: investAmount,
      investedOn: getKSTDateKey(now)
    };
    user.gameState.lastActionTime = now;

    if (moneyBeforeInvestment >= BEAST_HEART_UNLOCK_THRESHOLD && investAmount >= moneyBeforeInvestment * 0.9) {
      unlockTitle(user, 'beast_heart');
    }

    reconcileTitles(user, now);
    const response = await buildUserResponseWithGlobals(user, now);
    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Stock action error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/shop/buy', async (req, res) => {
  const { userId, itemId } = req.body;
  if (!userId || !itemId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });

  const itemInfo = ITEM_DATA[itemId];
  if (!itemInfo) return res.status(400).json({ msg: '존재하지 않는 아이템입니다.' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    calculateOfflineGains(user, now);
    const price = getItemPrice(user, itemId);

    if (user.gameState.money < price) {
      return res.status(400).json({ msg: '잔고가 부족합니다.' });
    }

    user.gameState.money -= price;
    addItemToInventory(user, itemId, 1);
    recordShopSpend(user, price, now);

    const derivedStats = calculateDerivedStats(user, now);
    if (derivedStats.shopStressRelief > 0) {
      user.gameState.stress = Number(Math.max(0, user.gameState.stress - derivedStats.shopStressRelief).toFixed(2));
    }

    reconcileTitles(user, now);
    user.gameState.lastActionTime = now;

    const response = await buildUserResponseWithGlobals(user, now);
    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Shop buy error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/inventory/use', async (req, res) => {
  const { userId, itemId } = req.body;
  if (!userId || !itemId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });

  const itemInfo = ITEM_DATA[itemId];
  if (!itemInfo || itemInfo.type !== 'consumable') {
    return res.status(400).json({ msg: '사용할 수 없는 아이템입니다.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    calculateOfflineGains(user, now);

    if (!removeItemFromInventory(user, itemId, 1)) {
      return res.status(400).json({ msg: '해당 아이템이 부족합니다.' });
    }

    if (itemId === 'bacchus') {
      user.gameState.stamina = Math.min(user.gameState.maxStamina, user.gameState.stamina + 1);
      queueNotification(user, 'item_use', '박카스를 마셨습니다. 행동력이 1 회복되었습니다.');
    } else if (itemId === 'hot6') {
      user.gameState.stress = Number(Math.max(0, user.gameState.stress - 10).toFixed(2));
      setOrRefreshBuff(user, 'hot6_buff', HOT6_DURATION_MS);
      queueNotification(user, 'item_use', '핫식스를 사용했습니다. 스트레스가 10 감소하고 10분 버프가 적용되었습니다.');
    }

    reconcileTitles(user, now);
    user.gameState.lastActionTime = now;

    const response = await buildUserResponseWithGlobals(user, now);
    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Inventory use error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/title/toggle', async (req, res) => {
  const { userId, titleId } = req.body;
  if (!userId || !titleId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });
  if (!TITLE_DATA[titleId]) return res.status(400).json({ msg: '존재하지 않는 칭호입니다.' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    calculateOfflineGains(user, now);
    reconcileTitles(user, now);

    if (!user.titles.unlocked.includes(titleId)) {
      return res.status(400).json({ msg: '아직 해금하지 않은 칭호입니다.' });
    }

    user.titles.equipped = user.titles.equipped === titleId ? null : titleId;
    const response = await buildUserResponseWithGlobals(user, now);
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

    const now = new Date();
    calculateOfflineGains(user, now);
    reconcileTitles(user, now);

    const response = await buildUserResponseWithGlobals(user, now);
    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.get('/api/ranking', async (req, res) => {
  try {
    const rankingUsers = await User.find({ nickname: { $ne: null } })
      .sort({ 'gameState.level': -1, 'gameState.exp': -1 })
      .limit(20)
      .select('nickname username gameState.level gameState.exp titles');

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

app.get('/api/admin/users', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const users = await User.find({})
      .sort({ nickname: 1, username: 1 })
      .select('username nickname');

    res.json({
      users: users.map((user) => ({
        id: String(user._id),
        username: user.username,
        nickname: user.nickname,
        label: user.nickname ? `${user.nickname} (${user.username})` : user.username
      })),
      giftCatalog: ADMIN_GIFT_CATALOG
    });
  } catch (err) {
    console.error('Admin user list error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/admin/gift', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { targetMode, targetUserId, giftType, giftId, quantity } = req.body;
  const giftQuantity = Math.max(1, Math.floor(Number(quantity) || 1));

  if (!['all', 'single'].includes(targetMode)) {
    return res.status(400).json({ msg: '대상 지정 방식이 올바르지 않습니다.' });
  }

  if (!['item', 'buff'].includes(giftType)) {
    return res.status(400).json({ msg: '선물 종류가 올바르지 않습니다.' });
  }

  if (giftType === 'item' && !ITEM_DATA[giftId]) {
    return res.status(400).json({ msg: '존재하지 않는 아이템입니다.' });
  }

  if (giftType === 'buff' && !BUFF_DATA[giftId]) {
    return res.status(400).json({ msg: '존재하지 않는 버프입니다.' });
  }

  try {
    const users = targetMode === 'all'
      ? await User.find({})
      : await User.find({ _id: targetUserId });

    if (!users.length) {
      return res.status(404).json({ msg: '선물할 사용자를 찾을 수 없습니다.' });
    }

    const now = new Date();

    for (const user of users) {
      ensureUserDefaults(user);
      calculateOfflineGains(user, now);

      if (giftType === 'item') {
        addItemToInventory(user, giftId, giftQuantity);
        queueNotification(user, 'admin_gift', `운영자로부터 선물이 도착했습니다! <${ITEM_DATA[giftId].name} ${giftQuantity}개>`);
      } else {
        setOrRefreshBuff(user, giftId, BUFF_DATA[giftId].durationMs);
        queueNotification(user, 'admin_gift', `운영자로부터 선물이 도착했습니다! <${BUFF_DATA[giftId].name}>`);
      }

      reconcileTitles(user, now);
      await user.save();
    }

    res.json({
      success: true,
      deliveredCount: users.length
    });
  } catch (err) {
    console.error('Admin gift error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/admin/delete-user', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { targetUserId } = req.body;
  if (!targetUserId) {
    return res.status(400).json({ msg: '삭제할 사용자 ID가 필요합니다.' });
  }

  try {
    const user = await User.findById(targetUserId).select('username nickname');
    if (!user) {
      return res.status(404).json({ msg: '삭제할 사용자를 찾을 수 없습니다.' });
    }

    const deletedLabel = user.nickname ? `${user.nickname} (${user.username})` : user.username;
    await User.deleteOne({ _id: targetUserId });

    res.json({
      success: true,
      deletedLabel
    });
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
