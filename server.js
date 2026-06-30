require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const crypto = require('crypto');

const app = express();

const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const APP_MODE = String(process.env.APP_MODE || 'v1').trim().toLowerCase() === 'v2' ? 'v2' : 'v1';
const IS_V2_MODE = APP_MODE === 'v2';

const ADMIN_USERNAME = 'dinguree';
const ADMIN_PASSWORD = 'dinguree';

let newsTypingCache = {
  fetchedAt: 0,
  prompts: [],
  fallback: false,
  stats: []
};
let newsTypingFetchPromise = null;
let newsTypingCursor = 0;
const activeNewsTypingSubmissions = new Set();
const recentNewsTypingSubmissions = new Map();
const newsTypingIpActivity = new Map();
const workClickIpActivity = new Map();

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const BASE_DAILY_SALARY = 300000;
const BASE_DAILY_PASSIVE_EXP = 400;
const BASE_CLICK_EXP = 5;
const NEWS_TYPING_CACHE_TTL_MS = 10 * 60 * 1000;
const NEWS_TYPING_FALLBACK_CACHE_TTL_MS = 30 * 1000;
const NEWS_TYPING_DUPLICATE_WINDOW_MS = 7000;
const NEWS_TYPING_ANTICHEAT_INTERVAL_LIMIT = 16;
const NEWS_TYPING_ANTICHEAT_SPEED_LIMIT = 32;
const NEWS_TYPING_ANTICHEAT_MIN_SUBMIT_MS = 650;
const NEWS_TYPING_ANTICHEAT_IP_WINDOW_MS = 60 * 1000;
const NEWS_TYPING_ANTICHEAT_COOLDOWN_MS = 15 * 1000;
const WORK_CLICK_ANTICHEAT_INTERVAL_LIMIT = 20;
const WORK_CLICK_ANTICHEAT_MIN_INTERVAL_MS = 55;
const WORK_CLICK_ANTICHEAT_IP_WINDOW_MS = 30 * 1000;
const WORK_CLICK_ANTICHEAT_COOLDOWN_MS = 7 * 1000;
const ADVENTURE_COOLDOWN_MS = 1250;
const COMPANY_STOCK_MARKET_SETTING_KEY = 'company_stock_market';
const COMPANY_STOCK_UPDATE_INTERVAL_MS = 10 * 60 * 1000;
const COMPANY_STOCK_HISTORY_LIMIT = 144;
const COMPANY_STOCK_SELL_FEE_RATE = 0.03;
const COMPANY_STOCK_RUMOR_ACCURACY = 0.6;
const COMPANY_STOCK_RUMOR_TTL_MS = 10 * 60 * 1000;
const COMPANY_STOCK_MAX_BACKFILL_TICKS = 288;
const COMPANY_STOCK_MARKET_CACHE_TTL_MS = 10 * 1000;
let companyStockMarketCache = null;
let companyStockMarketCacheExpiresAt = 0;
let companyStockMarketSyncPromise = null;
const STOCK_TOURNAMENT_ID = 'stock_tournament_1';
const STOCK_TOURNAMENT_NAME = '제 1회 주식투자 대회';
const STOCK_TOURNAMENT_START_AT = new Date('2026-06-03T00:00:00.000Z');
const STOCK_TOURNAMENT_END_AT = new Date('2026-06-09T15:00:00.000Z'); // 2026-06-10 00:00 KST
const STOCK_TOURNAMENT_INITIAL_CASH = 100000000;
const STOCK_TOURNAMENT_ADVANCED_INFO_LIMIT = 2;
const STOCK_TOURNAMENT_ADVANCED_INFO_ACCURACY = 0.9;
const INTERVIEW_TOURNAMENT_SETTING_KEY = 'interview_tournament_1';
const INTERVIEW_TOURNAMENT_NAME = '제 1회 면담 토너먼트';
const INTERVIEW_TOURNAMENT_REGISTER_DEADLINE_AT = new Date('2026-06-12T00:00:00.000Z'); // 2026-06-12 09:00 KST
const WORK_REPAIR_COUPON_DROP_CHANCE = 0.0005;
const MARKETPLACE_TRADEABLE_ITEM_IDS = ['raid_entry_ticket', 'hagendaz', 'excavation_repair_coupon'];
const MARKETPLACE_FEE_RATE = 0.1;
const MARKETPLACE_LISTING_TTL_MS = 48 * 60 * 60 * 1000;
const CARD_DRAW_GRADE_RATES = [
  { grade: 'S', rate: 0.005 },
  { grade: 'A', rate: 0.035 },
  { grade: 'B', rate: 0.31 },
  { grade: 'C', rate: 0.65 }
];
const CARD_GRADE_SORT_ORDER = { S: 0, A: 1, B: 2, C: 3 };
const POTATO_REHAB_BASE_DAMAGE = 20000;
const NEWS_TYPING_RSS_FEEDS = [
  'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko',
  'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ko&gl=KR&ceid=KR:ko',
  'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=ko&gl=KR&ceid=KR:ko',
  'https://www.yna.co.kr/rss/news.xml',
  'https://www.hani.co.kr/rss/',
  'https://rss.donga.com/total.xml',
  'https://rss.etnews.com/Section901.xml',
  'https://www.khan.co.kr/rss/rssdata/total_news.xml',
  'https://www.mk.co.kr/rss/30000001/'
];
const NEWS_TYPING_FETCH_TIMEOUT_MS = 8000;
const NEWS_TYPING_FALLBACK_SENTENCES = [
  '오늘 국내 주요 기업들이 신규 서비스 출시 계획을 공개했다.',
  '시장 전문가들은 이번 주 경제 지표 발표에 주목하고 있다.',
  '정부는 중소기업의 디지털 전환을 지원하는 새 정책을 발표했다.',
  '기술 업계는 인공지능 서비스 경쟁이 더 치열해질 것으로 보고 있다.',
  '소비자 물가 흐름을 두고 여러 기관의 전망이 엇갈리고 있다.'
];
const IDLE_STRESS_PER_SECOND = 1 / 1800;
const CLICK_STRESS_GAIN = 0.25;
const LUPIN_STRESS_DURATION_MS = 60 * 60 * 1000;
const LUPIN_EXP_DURATION_MS = 2 * 60 * 60 * 1000;
const HOT6_DURATION_MS = 10 * 60 * 1000;
const FIELD_WORK_DURATION_MS = 12 * 60 * 60 * 1000;
const CONFIDENCE_DURATION_MS = 60 * 60 * 1000;
const FATIGUE_DURATION_MS = 4 * 60 * 60 * 1000;
const CAT_GRATITUDE_DURATION_MS = 60 * 60 * 1000;
const WORK_OPTIMIZATION_DURATION_MS = 60 * 60 * 1000;
const WORK_OPTIMIZATION_COOLDOWN_MS = 7 * 60 * 60 * 1000;
const CHAIRMAN_MOOD_DURATION_MS = 30 * 60 * 1000;
const WORK_OPTIMIZATION_UNLOCK_LEVEL = 200;
const SHOUT_COOLDOWN_MS = 10 * 60 * 1000;
const SHOUT_VISIBLE_DURATION_MS = 36 * 1000;
const ONLINE_THRESHOLD_MS = 25 * 1000;
const SHOPPING_ADDICT_THRESHOLD = 1500000;
const SHOPPING_ADDICT_LOSE_AFTER_DAYS = 3;
const RICH_THRESHOLD = 5000000;
const BEAST_HEART_UNLOCK_THRESHOLD = 2000000;
const TITLE_CHANGE_LIMIT_DAYS = 1;
const RAID_MIN_LEVEL = 10;
const RAID_NORMAL_MIN_LEVEL = 10;
const RAID_NORMAL_HIGH_LEVEL_REWARD_THRESHOLD = 150;
const RAID_NORMAL_HIGH_LEVEL_REWARD_MULTIPLIER = 1 / 3;
const RAID_HARD_MIN_LEVEL = 150;
const RAID_MODE_NORMAL = 'normal';
const RAID_MODE_HARD = 'hard';
const RAID_MODE_CHAOS = 'chaos';
const RAID_MODE_LIST = [RAID_MODE_NORMAL, RAID_MODE_HARD, RAID_MODE_CHAOS];
const RAID_MODE_CONFIG = {
  [RAID_MODE_NORMAL]: {
    id: RAID_MODE_NORMAL,
    label: '노멀',
    minLevel: RAID_NORMAL_MIN_LEVEL,
    maxLevel: Infinity,
    hpMultiplier: 1,
    rewardMultiplier: 1
  },
  [RAID_MODE_HARD]: {
    id: RAID_MODE_HARD,
    label: '하드',
    minLevel: RAID_HARD_MIN_LEVEL,
    maxLevel: Infinity,
    hpMultiplier: 3,
    rewardMultiplier: 2.25
  },
  [RAID_MODE_CHAOS]: {
    id: RAID_MODE_CHAOS,
    label: '카오스',
    minLevel: RAID_HARD_MIN_LEVEL,
    maxLevel: Infinity,
    hpMultiplier: 3,
    rewardMultiplier: 4.5
  }
};
const RAID_PARTY_SIZE = 5;
const RAID_ACTION_DELAY_MS = 2000;
const RAID_COUNTDOWN_SECONDS = 3;
const RAID_COUNTDOWN_BUFFER_MS = 2000;
const RAID_INITIAL_READY_MS = 5000;
const RAID_DAILY_LIMIT = 1;
const RAID_QUEUE_TIMEOUT_MS = 10 * 60 * 1000;
const RAID_MULTI_HIT_DAMAGE_MULTIPLIER = 0.9;
const RAID_SPECIAL_REWARD_CHANCE = 0.05;
const RAID_BOSS_ID = 'burp_queen';
const RAID_BOSS_ID_BALD_MANAGER = 'bald_manager';
const RAID_BOSS_ID_HOI = 'hoi_msj_50';
const RAID_BOSS_ID_OVERTIME_MANAGER = 'overtime_manager_hwang';
const RAID_BOSS_ROTATION_IDS = [RAID_BOSS_ID, RAID_BOSS_ID_BALD_MANAGER, RAID_BOSS_ID_HOI, RAID_BOSS_ID_OVERTIME_MANAGER];
const RAID_BOSS_ROTATION_START_KEY = '2026-05-11';
const RAID_POLL_VERSION_EMPTY = 0;
const PVP_MIN_LEVEL = 50;
const PVP_ACCEPT_MS = 5 * 1000;
const PVP_BAN_TURN_MS = 30000;
const PVP_PICK_TURN_MS = 45000;
const PVP_BATTLE_TURN_MS = 30000;
const PVP_PRACTICE_BOT_TURN_MS = 5 * 1000;
const PVP_START_COUNTDOWN_MS = 5000;
const PVP_DRAFT_AUTO_GRACE_MS = 0;
const PVP_DRAFT_SUBMIT_GRACE_MS = 1500;
const PVP_BANS_PER_PLAYER = 3;
const PVP_PICKS_PER_PLAYER = 5;
const PVP_PICK_SEQUENCE_INDICES = [0, 1, 1, 0, 0, 1, 1, 0, 0, 1];
const PVP_PRACTICE_PICK_SEQUENCE_INDICES = [0, 0, 0, 0, 0];
const PVP_MAX_HP = 300;
const PVP_AUGMENT_MAX_HP = 200;
const PVP_RATING_BASE = 1000;
const PVP_RATING_K = 30;
const PVP_BET_PAYOUT_MULTIPLIER = 1.3;
const PVP_POLL_VERSION_EMPTY = 0;
const PVP_MODE_RANKED = 'ranked';
const PVP_MODE_NORMAL = 'normal';
const PVP_MODE_PRACTICE = 'practice';
const PVP_MODE_AUGMENT_3V3 = 'augment3v3';
const PVP_AUGMENT_QUEUE_SIZE = 4;
const PVP_AUGMENT_PICK_MS = 50 * 1000;
const PVP_AUGMENT_SELECT_MS = 40 * 1000;
const PVP_AUGMENT_TURN_MS = 20 * 1000;
const PVP_AUGMENT_RESERVED_ACTION_FRAME_MS = 1200;
const PVP_AUGMENT_KILL_TARGET = 3;
const PVP_AUGMENT_CANDIDATE_COUNT = 5;
const PVP_AUGMENT_PICK_COUNT = 3;
const PVP_AUGMENT_ROUNDS = [1, 3, 5, 7, 9];
const PVP_AUGMENT_TIER_WEIGHTS = [
  { tier: 'silver', weight: 55 },
  { tier: 'gold', weight: 35 },
  { tier: 'prism', weight: 10 }
];
const PVP_AUGMENT_TIER_LABELS = {
  silver: '실버',
  gold: '골드',
  prism: '프리즘'
};
const DAILY_AUGMENT_OPTION_COUNT = 3;
const DAILY_AUGMENT_VERSION = '2026-06-23-s-fusion-exp-potion-ticket-grant-v1';
const DAILY_AUGMENT_DATA = {
  daily_silver_salary_plus: {
    id: 'daily_silver_salary_plus',
    tier: 'silver',
    name: '월급 루팡의 미소',
    desc: '오늘 자정까지 월급 획득량이 2% 증가합니다.',
    effects: { moneyBonus: 2 }
  },
  daily_silver_overtime_reward: {
    id: 'daily_silver_overtime_reward',
    tier: 'silver',
    name: '야근 수당 영수증',
    desc: '오늘 자정까지 무한야근 보상이 5% 증가합니다.',
    effects: { infiniteOvertimeRewardBonus: 5 }
  },
  daily_silver_stock_fee_half: {
    id: 'daily_silver_stock_fee_half',
    tier: 'silver',
    name: '수수료 깎는 손',
    desc: '오늘 자정까지 주식 판매 수수료가 50% 감소합니다.',
    effects: { stockFeeReduction: 50 }
  },
  daily_silver_random_gold: {
    id: 'daily_silver_random_gold',
    tier: 'silver',
    name: '금빛 야근 복권',
    desc: '오늘 자정까지 무작위 골드 오늘의 증강 1개를 추가로 획득합니다. 운이 좋으면 프리즘 증강까지 이어질 수 있습니다.',
    effects: { grantTier: 'gold' }
  },
  daily_silver_exp_plus: {
    id: 'daily_silver_exp_plus',
    tier: 'silver',
    name: '작은 깨달음',
    desc: '오늘 자정까지 모든 경험치 획득량이 1% 증가합니다.',
    effects: { expBonus: 1 }
  },
  daily_silver_raid_reward_once: {
    id: 'daily_silver_raid_reward_once',
    tier: 'silver',
    name: '회의 보상 첫 단추',
    desc: '오늘 첫 1회에 한해 회의 보상이 10% 증가합니다.',
    effects: { raidRewardOnceBonusPercent: 10 }
  },
  daily_silver_first_adventure_rumor: {
    id: 'daily_silver_first_adventure_rumor',
    tier: 'silver',
    name: '사내 소문',
    desc: '오늘 첫 모험 보상은 2배가 됩니다. 대신 두 번째 모험은 보상을 얻지 못합니다.',
    effects: { adventureFirstRewardMultiplier: 2, adventureSecondRewardBlocked: 1 }
  },
  daily_silver_coffee_sip: {
    id: 'daily_silver_coffee_sip',
    tier: 'silver',
    name: '커피 한 모금',
    desc: '오늘 매 1시간마다 행동력 +1을 얻습니다. 하루 최대 3회까지 적용됩니다.',
    effects: { hourlyStamina: 1, hourlyStaminaLimit: 3 }
  },
  daily_silver_sneaky_logout: {
    id: 'daily_silver_sneaky_logout',
    tier: 'silver',
    name: '눈치껏 퇴근',
    desc: '퇴근하기 시 3% 확률로 박카스 1개를 획득합니다.',
    effects: { logoutBacchusChance: 0.03 }
  },
  daily_silver_fast_hands: {
    id: 'daily_silver_fast_hands',
    tier: 'silver',
    name: '오늘따라 손이 빠름',
    desc: '서류작업 클릭 보상이 5% 증가하지만 스트레스 증가량도 5% 증가합니다.',
    effects: { workClickRewardBonusPercent: 5, workClickStressBonusPercent: 5 }
  },
  daily_silver_tiny_rebellion: {
    id: 'daily_silver_tiny_rebellion',
    tier: 'silver',
    name: '소심한 반항',
    desc: '보스에게 피격 시 10% 확률로 레벨 x10 피해를 반사합니다.',
    effects: { bossHitReflectChance: 0.1, bossHitReflectLevelMultiplier: 10 }
  },
  daily_silver_pork_lunch: {
    id: 'daily_silver_pork_lunch',
    tier: 'silver',
    name: '점심 메뉴 제육볶음',
    desc: '오늘 첫 상점 구매가 5% 할인됩니다.',
    effects: { shopOnceDiscountPercent: 5 }
  },
  daily_silver_company_dj: {
    id: 'daily_silver_company_dj',
    tier: 'silver',
    name: '사내방송 DJ',
    desc: '오늘 전체 외치기 쿨타임이 사라집니다.',
    effects: { shoutNoCooldown: 1 }
  },
  daily_silver_executive_patrol: {
    id: 'daily_silver_executive_patrol',
    tier: 'silver',
    name: '대표님 순찰',
    desc: '모험에서 사장/대표 관련 이벤트 보상이 10% 증가합니다.',
    effects: { adventureExecutiveRewardBonusPercent: 10 }
  },
  daily_silver_afterwork_chicken: {
    id: 'daily_silver_afterwork_chicken',
    tier: 'silver',
    name: '퇴근 후 치킨',
    desc: '오늘 18시부터 24시까지 회의 보상이 5% 증가합니다.',
    effects: { raidEveningRewardBonus: 5 }
  },
  daily_gold_pvp_rating: {
    id: 'daily_gold_pvp_rating',
    tier: 'gold',
    name: '면담 승리 세레머니',
    desc: '오늘 자정까지 랭크 개인면담 승리 시 획득 점수가 10% 증가합니다.',
    effects: { pvpWinRatingBonus: 10 }
  },
  daily_gold_stock_fee_discount: {
    id: 'daily_gold_stock_fee_discount',
    tier: 'gold',
    name: '증권사 친구 찬스',
    desc: '오늘 자정까지 주식 판매 수수료가 80% 감소합니다.',
    effects: { stockFeeReduction: 80 }
  },
  daily_gold_raid_damage: {
    id: 'daily_gold_raid_damage',
    tier: 'gold',
    name: '회의실 죽창',
    desc: '오늘 자정까지 회의에서 자신이 입히는 피해가 2% 증가합니다.',
    effects: { raidDamageBonusPercent: 2 }
  },
  daily_gold_raid_reward: {
    id: 'daily_gold_raid_reward',
    tier: 'gold',
    name: '회의록 보너스 페이지',
    desc: '오늘 자정까지 회의 보상이 1.5% 증가합니다.',
    effects: { raidRewardBonus: 1.5 }
  },
  daily_gold_random_prism: {
    id: 'daily_gold_random_prism',
    tier: 'gold',
    name: '프리즘 결재 서류',
    desc: '오늘 자정까지 무작위 프리즘 오늘의 증강 1개를 추가로 획득합니다.',
    effects: { grantTier: 'prism' }
  },
  daily_gold_raid_recovery: {
    id: 'daily_gold_raid_recovery',
    tier: 'gold',
    name: '탕비실 응급키트',
    desc: '오늘 자정까지 회의에서 받는 회복량과 보호막 획득량이 10% 증가합니다.',
    effects: { raidHealShieldBonusPercent: 10 }
  },
  daily_gold_raid_turn3_damage: {
    id: 'daily_gold_raid_turn3_damage',
    tier: 'gold',
    name: '3턴짜리 결재 타이밍',
    desc: '오늘 회의 입장 시 3번째 턴에 자신이 입히는 피해가 10% 증가합니다.',
    effects: { raidTurn3DamageBonusPercent: 10 }
  },
  daily_gold_shop_once_discount: {
    id: 'daily_gold_shop_once_discount',
    tier: 'gold',
    name: '법카 찬스 1회권',
    desc: '오늘 첫 1회에 한해 모든 상점 물품 가격이 10% 할인됩니다.',
    effects: { shopOnceDiscountPercent: 10 }
  },
  daily_gold_high_stress_exp: {
    id: 'daily_gold_high_stress_exp',
    tier: 'gold',
    name: '벼랑 끝 집중력',
    desc: '오늘 스트레스가 90 이상일 때 모든 경험치 획득량이 5% 증가합니다.',
    effects: { stressHighExpBonus: 5 }
  },
  daily_gold_minutes_forged: {
    id: 'daily_gold_minutes_forged',
    tier: 'gold',
    name: '회의록 조작',
    desc: '보스 클리어 보상 중 하나를 20% 확률로 +1개 획득합니다. 보스 클리어 3회차까지 적용됩니다.',
    effects: { raidItemBonusChance: 0.2, raidItemBonusAmount: 1, raidItemBonusLimit: 3 }
  },
  daily_gold_escape_calculator: {
    id: 'daily_gold_escape_calculator',
    tier: 'gold',
    name: '퇴근각 계산기',
    desc: '행동력이 0이 될 때 하루 1회 한정으로 행동력 +3을 획득합니다.',
    effects: { staminaZeroRestore: 3, staminaZeroRestoreLimit: 1 }
  },
  daily_gold_company_politics: {
    id: 'daily_gold_company_politics',
    tier: 'gold',
    name: '사내 정치',
    desc: '면담 랭킹 1~3위 유저에게 가하는 피해가 3% 증가합니다. 그 외 유저에게는 경험치 2%를 추가 획득합니다.',
    effects: { pvpTopDamageBonusPercent: 3, nonTopExpBonusPercent: 2 }
  },
  daily_gold_not_my_fault: {
    id: 'daily_gold_not_my_fault',
    tier: 'gold',
    name: '아무튼 제 탓 아님',
    desc: '디버프를 받을 때 15% 확률로 무효화합니다.',
    effects: { debuffNullifyChance: 0.15 }
  },
  daily_gold_overtime_body: {
    id: 'daily_gold_overtime_body',
    tier: 'gold',
    name: '야근 체질',
    desc: '오늘 18시부터 24시까지 모든 경험치 획득량이 5% 증가합니다.',
    effects: { eveningExpBonus: 5 }
  },
  daily_gold_office_ghost: {
    id: 'daily_gold_office_ghost',
    tier: 'gold',
    name: '사무실 괴담',
    desc: '모험에서 부정 이벤트 확률이 10% 증가하는 대신 긍정 이벤트 보상이 10% 증가합니다.',
    effects: { adventureNegativeChanceBonus: 10, adventurePositiveRewardBonusPercent: 10 }
  },
  daily_gold_lupin_dignity: {
    id: 'daily_gold_lupin_dignity',
    tier: 'gold',
    name: '월급루팡의 품격',
    desc: '온라인 상태로 10분간 아무 행동도 하지 않을 때마다 전체 경험치통의 1%를 획득합니다.',
    effects: { idleExpPercentPer10m: 1 }
  },
  daily_prism_stock_fee_free: {
    id: 'daily_prism_stock_fee_free',
    tier: 'prism',
    name: '수수료 프리패스',
    desc: '오늘 자정까지 주식 판매 수수료가 무료가 됩니다.',
    effects: { stockFeeReduction: 100 }
  },
  daily_prism_pvp_rating: {
    id: 'daily_prism_pvp_rating',
    tier: 'prism',
    name: '면담왕의 왕관',
    desc: '오늘 자정까지 랭크 개인면담 승리 시 획득 점수가 20% 증가합니다.',
    effects: { pvpWinRatingBonus: 20 }
  },
  daily_prism_raid_damage: {
    id: 'daily_prism_raid_damage',
    tier: 'prism',
    name: '회의실 최종병기',
    desc: '오늘 자정까지 회의에서 자신이 입히는 피해가 5% 증가합니다.',
    effects: { raidDamageBonusPercent: 5 }
  },
  daily_prism_raid_reward: {
    id: 'daily_prism_raid_reward',
    tier: 'prism',
    name: '대표님 사인 보상안',
    desc: '오늘 자정까지 회의 보상이 5% 증가합니다.',
    effects: { raidRewardBonus: 5 }
  },
  daily_prism_raid_recovery: {
    id: 'daily_prism_raid_recovery',
    tier: 'prism',
    name: '사내 의료보험 각성',
    desc: '오늘 자정까지 회의에서 받는 회복량과 보호막 획득량이 20% 증가합니다.',
    effects: { raidHealShieldBonusPercent: 20 }
  },
  daily_prism_item_copy: {
    id: 'daily_prism_item_copy',
    tier: 'prism',
    name: '복사 붙여넣기 요정',
    desc: '오늘 구매를 제외한 아이템 획득 시 10% 확률로 해당 아이템을 1개 더 획득합니다.',
    effects: { itemCopyChance: 0.1 }
  },
  daily_prism_raid_free_entries: {
    id: 'daily_prism_raid_free_entries',
    tier: 'prism',
    name: '회의 입장권 봉투',
    desc: '선택 즉시 회의 추가 입장권 4장을 획득합니다.',
    effects: { raidEntryTicketGrant: 4 }
  },
  daily_prism_main_character: {
    id: 'daily_prism_main_character',
    tier: 'prism',
    name: '오늘의 주인공',
    desc: '하루 1회, 보상을 획득할 때 해당 보상을 2배로 바꿀 수 있는 선택권을 얻습니다.',
    effects: { rewardDoubleChoiceCharges: 1 }
  },
  daily_prism_otherworld_transfer: {
    id: 'daily_prism_otherworld_transfer',
    tier: 'prism',
    name: '이세계 전근',
    desc: '오늘 행동력 최대치가 3 증가하고, 매 60분마다 행동력 1을 회복합니다.',
    effects: { maxStaminaBonus: 3, hourlyStamina: 1, hourlyStaminaLimit: 24 }
  },
  daily_prism_chairman_mood: {
    id: 'daily_prism_chairman_mood',
    tier: 'prism',
    name: '회장님의 기분',
    desc: '접속 중인 모든 유저에게 30분간 경험치 +10%, 자신에게는 +20% 버프를 줄 수 있는 티켓 1장을 획득합니다. 티켓은 24시간 뒤 사라집니다.',
    effects: { chairmanMoodTicket: 1 }
  },
  daily_prism_future_invoice: {
    id: 'daily_prism_future_invoice',
    tier: 'prism',
    name: '미래의 나에게 청구',
    desc: '오늘 첫 보스 보상이 30% 증가하지만 내일 첫 보스 보상이 15% 감소합니다.',
    effects: { raidRewardOnceBonusPercent: 30, raidTomorrowPenaltyPercent: 15 }
  },
  daily_prism_overtime_god: {
    id: 'daily_prism_overtime_god',
    tier: 'prism',
    name: '야근의 신',
    desc: '무한야근 보상이 10% 증가하고, 중간에 패배해도 마지막 층 보상의 30%를 지급합니다.',
    effects: { infiniteOvertimeRewardBonus: 10, infiniteOvertimeDefeatRewardPercent: 30 }
  },
  daily_prism_money_rain: {
    id: 'daily_prism_money_rain',
    tier: 'prism',
    name: '돈으로 맞는 비',
    desc: '오늘 내내 모든 상점 가격이 20% 할인됩니다. 대신 모든 경험치 획득량이 10% 감소합니다.',
    effects: { shopDiscountPercent: 20, expPenaltyPercent: 10 }
  },
  daily_prism_one_shot_life: {
    id: 'daily_prism_one_shot_life',
    tier: 'prism',
    name: '인생 한방이다',
    desc: '모험 부정 이벤트 확률이 50% 증가하지만 즉시 레벨업 확률도 10% 증가합니다.',
    effects: { adventureNegativeChanceBonus: 50, instantLevelUpChanceBonus: 10 }
  },
  daily_prism_chosen_report: {
    id: 'daily_prism_chosen_report',
    tier: 'prism',
    name: '보고서가 나를 선택했다',
    desc: '서류작업 장비/주문서 드랍 판정을 2회 추가합니다.',
    effects: { workDropExtraAttempts: 2 }
  },
  daily_prism_no_quit_order: {
    id: 'daily_prism_no_quit_order',
    tier: 'prism',
    name: '퇴근 금지령',
    desc: '오늘 행동력 최대치가 5 증가하고, 선택 즉시 박카스 20개를 획득합니다.',
    effects: { maxStaminaBonus: 5, bacchusGrant: 20 }
  }
};
const PVP_WEEKLY_SEASON_SETTING_KEY = 'pvp_weekly_season';
const PVP_WEEKLY_SEASON_CHECK_INTERVAL_MS = 60 * 1000;
const PVP_RANKED_ANONYMOUS_OPPONENT_NAME = '익명의 상대';
const INFINITE_OVERTIME_MIN_LEVEL = 30;
const INFINITE_OVERTIME_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
const INFINITE_OVERTIME_MAX_FLOOR = 30;
const INFINITE_OVERTIME_BOT_ATTACK_LEVEL = 1;
const INFINITE_OVERTIME_DEFENSE_MIN_SCORE = 13;
const INFINITE_OVERTIME_DEFENSE_MAX_SCORE = 21;
const INFINITE_OVERTIME_CARD_SCORE = { S: 5, A: 4, B: 3, C: 2 };
const INFINITE_OVERTIME_DRAFT_GRADE_WEIGHTS = [
  { grade: 'S', weight: 10 },
  { grade: 'A', weight: 20 },
  { grade: 'B', weight: 30 },
  { grade: 'C', weight: 40 }
];
const INFINITE_OVERTIME_DRAFT_GRADE_ORDER = ['S', 'A', 'B', 'C'];
const PVP_MODE_LABELS = {
  [PVP_MODE_RANKED]: '랭크',
  [PVP_MODE_NORMAL]: '일반',
  [PVP_MODE_PRACTICE]: '연습모드'
};
PVP_MODE_LABELS[PVP_MODE_AUGMENT_3V3] = '증강 2대2';
const PVP_AUGMENT_DATA = {
  silver_backup_file: { id: 'silver_backup_file', tier: 'silver', name: '백업 파일', desc: '최대 HP +30', effects: { maxHp: 30 } },
  silver_focus_mode: { id: 'silver_focus_mode', tier: 'silver', name: '집중 모드', desc: '공격력 +12%', effects: { attackBonus: 0.12 } },
  silver_coffee_refill: { id: 'silver_coffee_refill', tier: 'silver', name: '커피 리필', desc: '자신의 턴 시작 시 HP 8 회복', effects: { turnHeal: 8 } },
  silver_fast_report: { id: 'silver_fast_report', tier: 'silver', name: '빠른 보고', desc: '선택 즉시 모든 카드 쿨타임 -1', effects: { reduceCooldownNow: 1 } },
  silver_snack_drawer: { id: 'silver_snack_drawer', tier: 'silver', name: '간식 서랍', desc: '최대 HP +15, 자신의 턴 시작 시 HP 4 회복', effects: { maxHp: 15, turnHeal: 4 } },
  silver_safety_helmet: { id: 'silver_safety_helmet', tier: 'silver', name: '안전모', desc: '처음 전투불능 피해를 1회 버티고 HP 1로 생존', effects: { deathCheat: 1 } },
  silver_memo_master: { id: 'silver_memo_master', tier: 'silver', name: '메모왕', desc: '카드 효과 +8%', effects: { cardEffectBonus: 0.08 } },
  silver_quick_patch: { id: 'silver_quick_patch', tier: 'silver', name: '응급 패치', desc: '선택 즉시 HP 35 회복', effects: { healNow: 35 } },
  gold_team_meeting: { id: 'gold_team_meeting', tier: 'gold', name: '팀 미팅', desc: '라운드 시작마다 생존 아군에게 보호막 10', effects: { teamRoundShield: 10 } },
  gold_finishing_touch: { id: 'gold_finishing_touch', tier: 'gold', name: '마무리 보고서', desc: 'HP 50% 이하 적에게 피해 +25%', effects: { executeBonus: 0.25 } },
  gold_second_wind: { id: 'gold_second_wind', tier: 'gold', name: '퇴근 전 각성', desc: '부활 시 HP 80 추가 회복', effects: { respawnHpBonus: 80 } },
  gold_shared_folder: { id: 'gold_shared_folder', tier: 'gold', name: '공유 폴더', desc: '카드 효과 +15%', effects: { cardEffectBonus: 0.15 } },
  gold_lunch_break: { id: 'gold_lunch_break', tier: 'gold', name: '점심시간 활용', desc: '선택 즉시 HP 70 회복, 모든 카드 쿨타임 -1', effects: { healNow: 70, reduceCooldownNow: 1 } },
  gold_emergency_manual: { id: 'gold_emergency_manual', tier: 'gold', name: '비상 매뉴얼', desc: '처음 전투불능 피해를 1회 버티고, 부활 아군에게 보호막 10', effects: { deathCheat: 1, teamRespawnShield: 10 } },
  gold_deadline_runner: { id: 'gold_deadline_runner', tier: 'gold', name: '마감 질주', desc: '처치 시 모든 카드 쿨타임 -1, 자신의 턴 시작 시 HP 3 회복', effects: { cooldownOnKill: 1, turnHeal: 3 } },
  gold_paper_shredder: { id: 'gold_paper_shredder', tier: 'gold', name: '문서 파쇄기', desc: '공격력 +8%, 카드 효과 +8%, 최대 HP +20', effects: { attackBonus: 0.08, cardEffectBonus: 0.08, maxHp: 20 } },
  prism_emergency_order: { id: 'prism_emergency_order', tier: 'prism', name: '긴급 결재', desc: '처치 시 모든 카드 쿨타임 -1', effects: { cooldownOnKill: 1 } },
  prism_iron_will: { id: 'prism_iron_will', tier: 'prism', name: '철야 멘탈', desc: '처음 전투불능 피해를 1회 버티고 HP 1로 생존', effects: { deathCheat: 1 } },
  prism_overtime_engine: { id: 'prism_overtime_engine', tier: 'prism', name: '야근 엔진', desc: '공격력 +35%, 받는 피해 +10%', effects: { attackBonus: 0.35, damageTakenBonus: 0.1 } },
  prism_hr_intervention: { id: 'prism_hr_intervention', tier: 'prism', name: '인사팀 개입', desc: '아군이 부활할 때 보호막 30 부여', effects: { teamRespawnShield: 30 } },
  prism_reset_vacation: { id: 'prism_reset_vacation', tier: 'prism', name: '반차 취소권', desc: '선택 즉시 모든 카드 쿨타임 초기화', effects: { reduceCooldownNow: 99 } },
  prism_glass_ceiling: { id: 'prism_glass_ceiling', tier: 'prism', name: '유리천장 돌파', desc: '최대 HP +80, 카드 효과 +20%', effects: { maxHp: 80, cardEffectBonus: 0.2 } },
  prism_ceo_call: { id: 'prism_ceo_call', tier: 'prism', name: '대표님 호출', desc: '공격력 +18%, 라운드 시작마다 생존 아군에게 보호막 24', effects: { attackBonus: 0.18, teamRoundShield: 24 } },
  prism_miracle_report: { id: 'prism_miracle_report', tier: 'prism', name: '기적의 보고서', desc: '선택 즉시 HP 120 회복, 처음 전투불능 피해를 1회 생존', effects: { healNow: 120, deathCheat: 1 } },
  silver_extra_stapler: { id: 'silver_extra_stapler', tier: 'silver', name: '스테이플러 연타', desc: '기본 공격 횟수 +1, 공격력 -8%', effects: { extraBasicHits: 1, attackBonus: -0.08 } },
  silver_prickly_chair: { id: 'silver_prickly_chair', tier: 'silver', name: '삐죽한 사무의자', desc: '기본 공격으로 피격될 때 공격자에게 4의 반사 피해', effects: { thornsDamage: 4 } },
  silver_last_word: { id: 'silver_last_word', tier: 'silver', name: '마지막 한마디', desc: '전투불능이 될 때 처치자에게 25 피해', effects: { deathExplosionDamage: 25 } },
  silver_late_receipt: { id: 'silver_late_receipt', tier: 'silver', name: '늦게 낸 영수증', desc: '라운드 시작마다 상대 생존자 1명에게 8 피해', effects: { randomEnemyRoundDamage: 8 } },
  silver_paper_cut: { id: 'silver_paper_cut', tier: 'silver', name: '종이에 베임', desc: '기본 공격 피해 +6, 최대 HP -10', effects: { flatBasicDamage: 6, maxHp: -10 } },
  silver_filing_cabinet: { id: 'silver_filing_cabinet', tier: 'silver', name: '철제 캐비닛', desc: '받는 피해 7% 감소, 라운드 시작 회복 -2', effects: { damageReduction: 0.07, turnHeal: -2 } },
  silver_shared_snack: { id: 'silver_shared_snack', tier: 'silver', name: '나눠 먹는 과자', desc: '라운드 시작마다 아군 생존자 전체 HP 3 회복', effects: { teamRoundHeal: 3 } },
  silver_panic_button: { id: 'silver_panic_button', tier: 'silver', name: '비상벨 위치 확인', desc: '처음 HP가 40% 이하로 내려가면 보호막 25를 1회 획득', effects: { lowHpShieldOnce: 25 } },
  gold_double_shift: { id: 'gold_double_shift', tier: 'gold', name: '2교대 투입', desc: '기본 공격 횟수 +1, 공격력 +5%', effects: { extraBasicHits: 1, attackBonus: 0.05 } },
  gold_barbed_badge: { id: 'gold_barbed_badge', tier: 'gold', name: '가시 사원증', desc: '기본 공격으로 피격될 때 공격자에게 9의 반사 피해', effects: { thornsDamage: 9 } },
  gold_resignation_bomb: { id: 'gold_resignation_bomb', tier: 'gold', name: '사직서 폭탄', desc: '전투불능이 될 때 처치자와 적 전체에게 20 피해', effects: { deathExplosionDamage: 20, deathExplosionSplash: 20 } },
  gold_overtime_sniper: { id: 'gold_overtime_sniper', tier: 'gold', name: '야근 저격수', desc: '라운드 시작마다 가장 HP가 낮은 적에게 14 피해', effects: { lowestEnemyRoundDamage: 14 } },
  gold_copier_jam: { id: 'gold_copier_jam', tier: 'gold', name: '복사기 걸림', desc: '처치 시 적 전체 카드 쿨타임 +1', effects: { enemyCooldownOnKill: 1 } },
  gold_caffeine_surge: { id: 'gold_caffeine_surge', tier: 'gold', name: '카페인 과충전', desc: '기본 공격 피해 +12, 라운드 시작마다 HP 4 감소', effects: { flatBasicDamage: 12, selfRoundDamage: 4 } },
  gold_audit_trail: { id: 'gold_audit_trail', tier: 'gold', name: '감사 추적', desc: '라운드 시작마다 이전 라운드에 자신을 공격한 적에게 12 피해', effects: { retaliationMarkDamage: 12 } },
  gold_team_standup: { id: 'gold_team_standup', tier: 'gold', name: '스탠드업 회의', desc: '라운드 시작마다 아군 생존자 전체 공격력 +3% 누적', effects: { teamRoundAttackStack: 0.03 } },
  prism_full_auto_keyboard: { id: 'prism_full_auto_keyboard', tier: 'prism', name: '풀오토 키보드', desc: '기본 공격 횟수 +2, 기본 공격 피해 85%', effects: { extraBasicHits: 2, basicHitMultiplierBonus: -0.15 } },
  prism_razor_nameplate: { id: 'prism_razor_nameplate', tier: 'prism', name: '면도날 명패', desc: '기본 공격으로 피격될 때 공격자에게 16의 반사 피해', effects: { thornsDamage: 16 } },
  prism_deadman_switch: { id: 'prism_deadman_switch', tier: 'prism', name: '데드맨 스위치', desc: '전투불능이 될 때 적 전체에게 45 피해', effects: { deathExplosionSplash: 45 } },
  prism_final_approval: { id: 'prism_final_approval', tier: 'prism', name: '최종 결재 반려', desc: '처치 시 모든 아군의 카드 쿨타임 -2', effects: { teamCooldownOnKill: 2 } },
  prism_rage_timesheet: { id: 'prism_rage_timesheet', tier: 'prism', name: '분노의 근태표', desc: '아군이 사망할 때마다 공격력 +12% 누적', effects: { attackStackOnAllyDeath: 0.12 } },
  prism_phoenix_leave: { id: 'prism_phoenix_leave', tier: 'prism', name: '불사조 연차', desc: '처음 전투불능 피해를 1회 버티고 HP 80 회복', effects: { deathCheat: 1, deathCheatHeal: 80 } },
  prism_expense_blackhole: { id: 'prism_expense_blackhole', tier: 'prism', name: '지출 블랙홀', desc: '라운드 시작마다 적 전체에게 10 피해, 아군 전체에게 보호막 10', effects: { enemyTeamRoundDamage: 10, teamRoundShield: 10 } },
  prism_all_hands: { id: 'prism_all_hands', tier: 'prism', name: '전사 공지사항', desc: '라운드 시작마다 아군 전체 HP 8 회복, 적 전체 HP 5 피해', effects: { teamRoundHeal: 8, enemyTeamRoundDamage: 5 } },
  silver_stack_memo: { id: 'silver_stack_memo', tier: 'silver', name: '누적 메모', desc: '기본공격 명중마다 대상에게 메모 1스택. 이후 내 기본공격은 스택당 +2 피해', effects: { basicStackGain: 1, basicStackDamagePerStack: 2 } },
  silver_lucky_click: { id: 'silver_lucky_click', tier: 'silver', name: '운 좋은 클릭', desc: '기본공격 명중 시 25% 확률로 +10 추가 피해', effects: { basicProcChance: 0.25, basicProcDamage: 10 } },
  silver_self_coaching: { id: 'silver_self_coaching', tier: 'silver', name: '셀프 칭찬', desc: '기본공격 명중마다 HP 3 회복', effects: { basicHealOnHit: 3 } },
  gold_stack_audit: { id: 'gold_stack_audit', tier: 'gold', name: '감사 스택', desc: '기본공격 명중마다 대상에게 감사 1스택. 이후 내 기본공격은 스택당 +4 피해', effects: { basicStackGain: 1, basicStackDamagePerStack: 4 } },
  gold_bouncing_stamp: { id: 'gold_bouncing_stamp', tier: 'gold', name: '튕기는 도장', desc: '기본공격 명중 시 다른 생존 적 1명에게 8 피해', effects: { basicSplashDamage: 8 } },
  gold_muscle_memory: { id: 'gold_muscle_memory', tier: 'gold', name: '손목의 기억', desc: '기본공격 명중 시 35% 확률로 모든 카드 쿨타임 -1', effects: { basicCooldownReduceChance: 0.35, basicCooldownReduce: 1 } },
  prism_stack_accounting: { id: 'prism_stack_accounting', tier: 'prism', name: '복리 회계', desc: '기본공격 명중마다 대상에게 회계 2스택. 이후 내 기본공격은 스택당 +5 피해', effects: { basicStackGain: 2, basicStackDamagePerStack: 5 } },
  prism_aggressive_keyboard: { id: 'prism_aggressive_keyboard', tier: 'prism', name: '공격적 키보드', desc: '기본공격 횟수 +1, 명중마다 HP 6 회복, 다른 적 1명에게 10 피해', effects: { extraBasicHits: 1, basicHealOnHit: 6, basicSplashDamage: 10 } },
  prism_card_switcheroo: { id: 'prism_card_switcheroo', tier: 'prism', name: '카드 바꿔치기', desc: '선택 즉시 내 카드 1장과 무작위 적 카드 1장을 서로 바꿉니다', effects: { swapRandomCardWithEnemy: 1 } }
};
const PVP_WEEKLY_REWARD_TIERS = [
  { rank: 1, bacchus: 100, businessCards: 100 },
  { rank: 2, bacchus: 60, businessCards: 60 },
  { rank: 3, bacchus: 40, businessCards: 40 }
];
const PVP_WEEKLY_PARTICIPATION_REWARD = { bacchus: 20, businessCards: 20 };
const RANKING_CACHE_TTL_MS = 60 * 1000;
const SPECTATOR_TTL_MS = 15000;
const PEN_SHOP_ITEM_IDS = ['pen_monami', 'pen_jetstream', 'pen_applepencil'];
const REWARD_PEN_ITEM_IDS = ['reward_pen_monami', 'reward_pen_jetstream', 'reward_pen_applepencil'];
const PEN_REWARD_ITEM_MAP = {
  pen_monami: 'reward_pen_monami',
  pen_jetstream: 'reward_pen_jetstream',
  pen_applepencil: 'reward_pen_applepencil'
};
const EMBLEM_DATA = {
  neo_office_ledger: {
    id: 'neo_office_ledger',
    name: '사원증',
    price: 100000000000,
    desc: '랭킹 닉네임 칸에 회사 사원증 느낌의 전용 배경과 휘장 아이콘을 표시합니다. 보유 효과: 획득하는 모든 경험치 +1%',
    imageUrl: '',
    className: 'emblem-neo-office-ledger',
    shopType: 'money',
    effects: { expBonus: 1 }
  },
  cat_butler: {
    id: 'cat_butler',
    name: '집사',
    price: 0,
    fragmentCost: 5000,
    desc: '랭킹 닉네임 칸에 고양이 집사 느낌의 전용 배경을 표시합니다. 보유 효과: 보스 클리어 보상 +5%',
    imageUrl: '',
    className: 'emblem-cat-butler',
    shopType: 'fragment',
    effects: { raidRewardBonus: 5 }
  },
  tiger: {
    id: 'tiger',
    name: '호랭이',
    price: 0,
    fragmentCost: 10000,
    desc: '파편 상점에서 구매할 수 있습니다. 보유 효과: 보스 보상 +5%',
    imageUrl: '',
    className: 'emblem-tiger',
    shopType: 'fragment',
    effects: { raidRewardBonus: 5 }
  },
  chik: {
    id: 'chik',
    name: '칰',
    price: 100000000000000000,
    desc: '일반 상점에서 구매할 수 있습니다. 보유 효과: 주식 거래 수수료 5% 감소',
    imageUrl: '',
    className: 'emblem-chik',
    shopType: 'money',
    effects: { stockFeeReduction: 5 }
  },
  chunsik_art: {
    id: 'chunsik_art',
    name: '춘식이 작품',
    price: 0,
    desc: '랭킹 닉네임 칸에 유리 공예 느낌의 전용 배경을 표시합니다. 보유 효과: 월급 +1% / 150레벨 이상 달성 시 자동 해금',
    imageUrl: '',
    className: 'emblem-chunsik-art',
    shopType: 'unlock',
    unlockLevel: 150,
    effects: { moneyBonus: 1 }
  },
  carbon_fiber: {
    id: 'carbon_fiber',
    name: 'CARBON FIBER',
    price: 1000000000000000000,
    desc: '랭킹 닉네임 칸에 카본 파이버 배경을 표시합니다. 보유 효과: 모든 경험치 획득량 +1.5%',
    imageUrl: '',
    className: 'emblem-carbon-fiber',
    shopType: 'money',
    effects: { expBonus: 1.5 }
  },
  winter_manager_season: {
    id: 'winter_manager_season',
    name: '차가운 겨부장의 계절',
    price: 0,
    desc: '개인면담 랭킹 주간 정산 1위에게 최초 1회 지급됩니다. 보유 효과: 회사 유지비 1% 감소',
    imageUrl: '',
    className: 'emblem-winter-manager-season',
    shopType: 'unlock',
    effects: { maintenanceReduction: 1 }
  },
  chunsik_art_2: {
    id: 'chunsik_art_2',
    name: '춘식이 작품2',
    price: 0,
    desc: '고양이에게 참치캔을 300번 이상 건넨 유저에게 1회 지급됩니다. 보유 효과: 주식 거래 수수료 5% 감소',
    imageUrl: '',
    className: 'emblem-chunsik-art-2',
    shopType: 'unlock',
    unlockCatFoodGiven: 300,
    effects: { stockFeeReduction: 5 }
  },
  bitch_not: {
    id: 'bitch_not',
    name: 'BITCH 아닙니다',
    price: 0,
    fragmentCost: 25000,
    desc: '파편 상점에서 구매할 수 있습니다. 보유 효과: 주식 거래 수수료 10% 감소',
    imageUrl: '',
    className: 'emblem-bitch-not',
    shopType: 'fragment',
    effects: { stockFeeReduction: 10 }
  },
  kkolde: {
    id: 'kkolde',
    name: '꼴데',
    price: 2000000000000000000000,
    desc: '일반 상점에서 구매할 수 있습니다. 보유 효과: 보스 경험치 추가 +5%',
    imageUrl: '',
    className: 'emblem-kkolde',
    shopType: 'money',
    effects: { raidExpBonus: 5 }
  },
  ruined_bear: {
    id: 'ruined_bear',
    name: '망x러진곰',
    price: 0,
    fragmentCost: 5000,
    desc: '파편 상점에서 구매할 수 있습니다. 보유 효과: 보스 경험치 획득량 추가 +2%',
    imageUrl: '',
    className: 'emblem-ruined-bear',
    shopType: 'fragment',
    effects: { raidExpBonus: 2 }
  },
  guma_ritual: {
    id: 'guma_ritual',
    name: '구마의식',
    price: 200000000000000000,
    desc: '일반 상점에서 구매할 수 있습니다. 보유 효과: 주식 거래 수수료 5% 감소',
    imageUrl: '',
    className: 'emblem-guma-ritual',
    shopType: 'money',
    effects: { stockFeeReduction: 5 }
  },
  idol: {
    id: 'idol',
    name: 'IDOL',
    price: 0,
    fragmentCost: 20000,
    desc: '파편 상점에서 구매할 수 있습니다. 보유 효과: 무한야근 보상 10% 증가',
    imageUrl: '',
    className: 'emblem-idol',
    shopType: 'fragment',
    effects: { infiniteOvertimeRewardBonus: 10 }
  }
};
const EQUIPMENT_DROP_CHANCE = 0.0005;
const ADVENTURE_SCROLL_DROP_CHANCE = 0.005;
const EQUIPMENT_TYPE_CARD = 'card_effect';
const EQUIPMENT_TYPE_ATTACK = 'basic_attack';
const EQUIPMENT_SCROLL_DROP_WEIGHT = 3;
const EQUIPMENT_GEAR_DROP_WEIGHT = 7;
const CAT_TUNA_CAN_ITEM_IDS = ['cat_tuna_can', 'tuna_can', 'cat_food'];

const BRANCH_OFFICE_ELIGIBLE_LEVEL = 250;
const BRANCH_OFFICE_ELIGIBLE_SALARY_PER_MINUTE = 50000000;
const BRANCH_OFFICE_HIGH_INCOME_TAX_INTERVAL_MS = 6 * 60 * 60 * 1000;
const BRANCH_OFFICE_HIGH_INCOME_TAX_RATE = 0.3;
const BRANCH_OFFICE_FOUND_COST = 50000000000;
const BRANCH_OFFICE_CONTRACT_SALARY_RATIO = 1 / 6;
const BRANCH_OFFICE_MIN_CONTRACT_PERCENT = 0.1;
const BRANCH_EMPLOYEE_SALARY_EFFICIENCY_MIN = 0.85;
const BRANCH_EMPLOYEE_SALARY_EFFICIENCY_RANGE = 0.3;
const BRANCH_EMPLOYEE_GRADE_SALARY_MULTIPLIER = { C: 0.8, B: 1.2, A: 1.7, S: 2.4 };
const BRANCH_OFFICE_MAX_EMPLOYEES = 10;
const BRANCH_OFFICE_COMPANY_VALUE_PER_EXTRA_EMPLOYEE = 2000000000;
const BRANCH_OFFICE_BASE_DIG_COST = 100000000;
const BRANCH_OFFICE_DIG_COST_PER_EMPLOYEE = 50000000;
const BRANCH_OFFICE_SUCCESS_CAP = 15;
const BRANCH_OFFICE_RARE_BONUS_RATE = 0.1;
const BRANCH_OFFICE_BASE_EXCAVATION_MS = 15 * 60 * 1000;
const BRANCH_AUTO_EXCAVATION_MAX_STEPS_PER_REQUEST = 4;
const BRANCH_EXCAVATION_EXTRA_DROP_CHANCE = 0.05;
const BRANCH_EXCAVATION_EXTRA_DROP_MAX_CHANCE = 5;
const BRANCH_EXCAVATION_EXTRA_DROP_RARE_BONUS_SCALE = 100;
const BRANCH_EXCAVATION_EXTRA_DROP_LOG_LIMIT = 12;
const BRANCH_EXCAVATION_EXTRA_DROPS = [
  { itemId: 'infinite_overtime_ticket' },
  { itemId: 'raid_entry_ticket' }
];
const BRANCH_OFFICE_BREAKDOWN_CHANCE = 0.03;
const BRANCH_OFFICE_BREAKDOWN_MS = 6 * 60 * 60 * 1000;
const BRANCH_OFFICE_OVERTIME_START_HOUR = 18;
const BRANCH_OFFICE_OVERTIME_COST_MULTIPLIER = 3;
const BRANCH_OFFICE_BASE_STORAGE_SLOTS = 10;
const BRANCH_OFFICE_MAX_STORAGE_SLOTS = 100;
const BRANCH_OFFICE_STORAGE_BASE_COST = 1000000000;
const BRANCH_OFFICE_MAINTENANCE_RATE = 0.02;
const BRANCH_OFFICE_BANKRUPT_MISSED_DAYS = 5;
const BRANCH_EMPLOYEE_NAME_POOL = [
  '김성실', '박야근', '이보고', '최정산', '정기획', '한발굴', '오자료', '신계약', '윤창고', '강관리',
  '문효율', '서분석', '조인내', '임집요', '권탐색', '백서류', '남집중', '유품질', '장검토', '송성과',
  '고문서', '노정리', '하승인', '배자료', '마보고', '차검수', '허결재', '도기록', '표인수', '심정산',
  '길총무', '명기안', '탁회의', '방보관', '온창고', '류분류', '천인사', '홍예산', '구품의', '선민원',
  '진대응', '민보고', '나확인', '라기획', '공분석', '여감사', '추계약', '변정리', '염발굴', '소관리',
  '설운영', '연효율', '하품질', '양리스크', '문서준', '박결재', '최보관', '정승인', '이검토', '김분류',
  '오현장', '신실적', '유장부', '강영업', '백총무', '남운영', '송기록', '권전표', '서입찰', '조계약',
  '임기안', '장자료', '윤예산', '한정산', '구매진', '관리혁', '자료민', '발굴찬', '효율준', '검토아',
  '품질나', '서류온', '창고율', '보고린', '기안솔', '정산후', '탐색재', '계약봄', '관리라', '검수휘',
  '운영담', '분석준', '자료하', '발굴연', '회의람', '창고빈', '성과찬', '품의결'
];
const BRANCH_EMPLOYEE_GRADE_CONFIG = {
  C: { label: 'C', role: '사원', minPower: 0.2, maxPower: 0.6 },
  B: { label: 'B', role: '대리', minPower: 0.6, maxPower: 1.1 },
  A: { label: 'A', role: '과장', minPower: 1.1, maxPower: 1.8 },
  S: { label: 'S', role: '지사장', minPower: 1.8, maxPower: 2.7 }
};
const BRANCH_ITEM_GRADE_CONFIG = {
  ss: { label: 'SS', valueGain: 500000000000, disposeCost: 100000000000, color: '#d4af37' },
  common: { label: '일반', valueGain: 100000000, disposeCost: 100000000, color: '#607d8b' },
  rare: { label: '희귀', valueGain: 1000000000, disposeCost: 500000000, color: '#1565c0' },
  epic: { label: '영웅', valueGain: 10000000000, disposeCost: 2000000000, color: '#6a1b9a' },
  legendary: { label: '전설', valueGain: 100000000000, disposeCost: 20000000000, color: '#ef6c00' }
};
const BRANCH_COLLECTIBLE_ITEMS = {
  rusty_clip: { id: 'rusty_clip', emoji: '📎', name: '녹슨 클립', grade: 'common', desc: '책상 밑에서 굴러다니던 오래된 클립입니다.', effects: {} },
  cold_coffee: { id: 'cold_coffee', emoji: '☕', name: '식은 커피', grade: 'common', desc: '식었지만 정신은 조금 번쩍 듭니다.', effects: { hourlyExpPercent: 0.3 } },
  lost_pen: { id: 'lost_pen', emoji: '🖊️', name: '잃어버린 볼펜', grade: 'common', desc: '분명 누군가의 것이었지만 이제 지사의 것입니다.', effects: { excavationPowerBonus: 0.1 } },
  unfiled_receipt: { id: 'unfiled_receipt', emoji: '🧾', name: '미제출 영수증', grade: 'common', desc: '정산되지 않은 기묘한 종이입니다.', effects: {} },
  squeaky_chair: { id: 'squeaky_chair', emoji: '🪑', name: '삐걱대는 의자', grade: 'common', desc: '앉을 때마다 존재감을 드러냅니다.', effects: { companyValueBonus: 0.5 } },
  stapler_without_pin: { id: 'stapler_without_pin', emoji: '📌', name: '심 없는 스테이플러', grade: 'common', desc: '누르기만 하고 아무 일도 일어나지 않습니다.', effects: {} },
  dusty_mousepad: { id: 'dusty_mousepad', emoji: '🖱️', name: '먼지 낀 마우스패드', grade: 'common', desc: '오래된 업무의 흔적이 남아 있습니다.', effects: { excavationTimeReductionPercent: 0.5 } },
  cracked_mug: { id: 'cracked_mug', emoji: '🍵', name: '금 간 머그컵', grade: 'common', desc: '새지는 않지만 보는 사람을 불안하게 합니다.', effects: { hourlyExpPercent: 0.4 } },
  bent_name_tag: { id: 'bent_name_tag', emoji: '🏷️', name: '휘어진 명찰', grade: 'common', desc: '누구의 것인지 알 수 없지만 회사 느낌은 납니다.', effects: { companyValueBonus: 0.6 } },
  empty_toner: { id: 'empty_toner', emoji: '🖨️', name: '빈 토너 카트리지', grade: 'common', desc: '분명 버려졌어야 했지만 창고로 들어왔습니다.', effects: {} },
  old_keyboard_key: { id: 'old_keyboard_key', emoji: '⌨️', name: '떨어진 키캡', grade: 'common', desc: 'Enter인지 Ctrl인지 모를 낡은 키캡입니다.', effects: { excavationPowerBonus: 0.12 } },
  parking_receipt: { id: 'parking_receipt', emoji: '🅿️', name: '주차 정산권', grade: 'common', desc: '이미 만료됐지만 묘하게 중요한 느낌입니다.', effects: { excavationTimeReductionPercent: 0.6 } },
  broken_calculator: { id: 'broken_calculator', emoji: '🧮', name: '오답 계산기', grade: 'common', desc: '계산은 틀리지만 자신감은 확실합니다.', effects: { companyValueBonus: 0.7 } },
  meeting_marker: { id: 'meeting_marker', emoji: '🖍️', name: '회의실 마커', grade: 'common', desc: '뚜껑을 열면 아직 조금은 살아 있습니다.', effects: { bossRaidExpBonus: 0.5 } },
  sticky_note_stack: { id: 'sticky_note_stack', emoji: '🗒️', name: '반쯤 남은 포스트잇', grade: 'common', desc: '중요한 할 일을 잊게 만들기에 충분합니다.', effects: { hourlyExpPercent: 0.5 } },
  snack_wrapper: { id: 'snack_wrapper', emoji: '🍬', name: '간식 봉투', grade: 'common', desc: '내용물은 없지만 추억은 남아 있습니다.', effects: {} },
  sealed_stamp: { id: 'sealed_stamp', emoji: '🔖', name: '봉인된 사내 도장', grade: 'rare', desc: '찍으면 왠지 결재가 빨라질 것 같습니다.', effects: { excavationPowerBonus: 0.25 } },
  snack_safe: { id: 'snack_safe', emoji: '🍪', name: '간식 금고', grade: 'rare', desc: '달콤한 이유를 숨겨 놓는 간식 보관함입니다.', effects: { hourlyExpPercent: 0.6 } },
  ancient_fax: { id: 'ancient_fax', emoji: '📠', name: '고대의 팩스기', grade: 'rare', desc: '아직도 어딘가로 서류를 보낼 수 있습니다.', effects: { bossRaidExpBonus: 0.8 } },
  dead_monitor: { id: 'dead_monitor', emoji: '🖥️', name: '죽은 모니터', grade: 'rare', desc: '꺼져 있지만 이상하게 회사 가치가 올라갑니다.', effects: { companyValueBonus: 1 } },
  executive_umbrella: { id: 'executive_umbrella', emoji: '☂️', name: '임원용 우산', grade: 'rare', desc: '비를 피하는 것보다 시선을 끄는 데 능합니다.', effects: { companyValueBonus: 1.2 } },
  unopened_parcel: { id: 'unopened_parcel', emoji: '📦', name: '미개봉 택배', grade: 'rare', desc: '누구 앞으로 온 건지는 모르지만 기대감이 있습니다.', effects: { excavationPowerBonus: 0.28 } },
  mystery_usb: { id: 'mystery_usb', emoji: '💾', name: '정체불명 USB', grade: 'rare', desc: '꽂아보면 안 될 것 같아서 더 가치 있어 보입니다.', effects: { excavationTimeReductionPercent: 1 } },
  archive_key: { id: 'archive_key', emoji: '🗝️', name: '자료실 열쇠', grade: 'rare', desc: '잃어버린 줄 알았던 자료실의 열쇠입니다.', effects: { excavationPowerBonus: 0.3 } },
  overtime_blanket: { id: 'overtime_blanket', emoji: '🛌', name: '야근 담요', grade: 'rare', desc: '책상 밑 생존률을 크게 올려줍니다.', effects: { hourlyExpPercent: 0.7 } },
  approval_stamp_pad: { id: 'approval_stamp_pad', emoji: '🟥', name: '결재 도장 패드', grade: 'rare', desc: '빨간 잉크가 아직 선명합니다.', effects: { companyValueBonus: 1.1 } },
  coffee_coupon_book: { id: 'coffee_coupon_book', emoji: '🎫', name: '커피 쿠폰북', grade: 'rare', desc: '도장을 모으면 기분이 좋아집니다.', effects: { hourlyExpPercent: 0.8 } },
  silent_keyboard: { id: 'silent_keyboard', emoji: '⌨️', name: '무소음 키보드', grade: 'rare', desc: '몰래 일하는 데 최적화되어 있습니다.', effects: { excavationTimeReductionPercent: 1.2 } },
  printer_drum: { id: 'printer_drum', emoji: '⚙️', name: '프린터 드럼', grade: 'rare', desc: '왜 여기 있는지 아무도 설명하지 못합니다.', effects: { bossRaidExpBonus: 1 } },
  emergency_charger: { id: 'emergency_charger', emoji: '🔌', name: '비상 충전기', grade: 'rare', desc: '위기의 순간에만 보이는 물건입니다.', effects: { excavationTimeReductionPercent: 1.4 } },
  missing_remote: { id: 'missing_remote', emoji: '📺', name: '회의실 리모컨', grade: 'rare', desc: '이걸 찾은 것만으로도 지사 실적입니다.', effects: { excavationPowerBonus: 0.35 } },
  golden_nameplate: { id: 'golden_nameplate', emoji: '🏷️', name: '금빛 명패', grade: 'epic', desc: '어느 임원의 책상에서 온 듯한 명패입니다.', effects: { excavationPowerBonus: 0.4, companyValueBonus: 1.5 } },
  legendary_tissue_box: { id: 'legendary_tissue_box', emoji: '🧻', name: '전설의 휴지곽', grade: 'epic', desc: '모든 회의실이 탐내는 휴지곽입니다.', effects: { bossRaidExpBonus: 1.5 } },
  overtime_calendar: { id: 'overtime_calendar', emoji: '📅', name: '야근이 적힌 달력', grade: 'epic', desc: '빨간 날에도 검은 일정이 적혀 있습니다.', effects: { hourlyExpPercent: 1 } },
  diamond_paperclip: { id: 'diamond_paperclip', emoji: '💎', name: '다이아 클립', grade: 'epic', desc: '서류보다 클립이 더 비쌀 것 같습니다.', effects: { companyValueBonus: 2 } },
  black_folder: { id: 'black_folder', emoji: '📁', name: '검은 결재 폴더', grade: 'epic', desc: '열면 안 될 것 같은데 열고 싶습니다.', effects: { excavationPowerBonus: 0.42, bossRaidExpBonus: 1.2 } },
  legendary_whiteboard_marker: { id: 'legendary_whiteboard_marker', emoji: '🖊️', name: '마르지 않는 보드마카', grade: 'epic', desc: '회의가 끝나지 않는 이유입니다.', effects: { excavationTimeReductionPercent: 2 } },
  server_room_keycard: { id: 'server_room_keycard', emoji: '💳', name: '서버실 키카드', grade: 'epic', desc: '들어가면 더 큰 문제가 생길 것 같습니다.', effects: { excavationPowerBonus: 0.45 } },
  golden_calculator: { id: 'golden_calculator', emoji: '🧮', name: '황금 계산기', grade: 'epic', desc: '숫자가 커질수록 빛납니다.', effects: { companyValueBonus: 2.2 } },
  chairman_teacup: { id: 'chairman_teacup', emoji: '🍵', name: '회장님의 찻잔', grade: 'epic', desc: '잔만 봐도 보고서가 공손해집니다.', effects: { hourlyExpPercent: 1.2 } },
  blue_approval_file: { id: 'blue_approval_file', emoji: '📘', name: '파란 결재철', grade: 'epic', desc: '이상하게 모든 결재가 통과될 것 같습니다.', effects: { excavationTimeReductionPercent: 2.3 } },
  hr_secret_list: { id: 'hr_secret_list', emoji: '📋', name: '인사팀 비밀 명단', grade: 'epic', desc: '열람 권한이 없어 더 빛납니다.', effects: { bossRaidExpBonus: 2 } },
  premium_chair: { id: 'premium_chair', emoji: '🪑', name: '프리미엄 의자', grade: 'epic', desc: '앉으면 퇴근 생각이 잠시 사라집니다.', effects: { hourlyExpPercent: 1.3 } },
  no_leave_trophy: { id: 'no_leave_trophy', emoji: '🏆', name: '퇴근 불가 트로피', grade: 'legendary', desc: '보는 순간 회사가 무거워지는 생각이 듭니다.', effects: { hourlyExpPercent: 1.5, companyValueBonus: 3 } },
  ceo_black_card: { id: 'ceo_black_card', emoji: '💳', name: '대표님의 블랙카드 영수증', grade: 'legendary', desc: '영수증만으로도 지사의 격이 올라갑니다.', effects: { bossRaidExpBonus: 3, excavationPowerBonus: 0.5 } },
  founder_contract: { id: 'founder_contract', emoji: '📜', name: '창업자의 계약서', grade: 'legendary', desc: '처음부터 모든 것이 적혀 있었던 문서입니다.', effects: { companyValueBonus: 3, excavationPowerBonus: 0.45 } },
  infinite_overtime_badge: { id: 'infinite_overtime_badge', emoji: '♾️', name: '무한야근 배지', grade: 'legendary', desc: '야근이 끝나지 않는다는 확신을 줍니다.', effects: { hourlyExpPercent: 1.5, excavationTimeReductionPercent: 3 } },
  hidden_bonus_ledger: { id: 'hidden_bonus_ledger', emoji: '📒', name: '숨겨진 상여금 장부', grade: 'legendary', desc: '존재만으로 회사 가치가 출렁입니다.', effects: { companyValueBonus: 3, bossRaidExpBonus: 2.5 } },
  quantum_photocopier: { id: 'quantum_photocopier', emoji: '🖨️', name: '양자 복사기', grade: 'legendary', desc: '복사하기 전에 이미 복사되어 있습니다.', effects: { excavationTimeReductionPercent: 3, excavationPowerBonus: 0.5 } },
  unicorn_parking_pass: { id: 'unicorn_parking_pass', emoji: '🦄', name: '유니콘 주차권', grade: 'legendary', desc: '한 번도 본 적 없는 주차 자리를 보장합니다.', effects: { bossRaidExpBonus: 3, hourlyExpPercent: 1.2 } },
  ceo_sleep_mask: { id: 'ceo_sleep_mask', emoji: '😴', name: '대표님의 수면안대', grade: 'legendary', desc: '회의 중에도 아무 일 없던 척할 수 있습니다.', effects: { excavationTimeReductionPercent: 2.5, companyValueBonus: 2.5 } }
};



Object.assign(BRANCH_COLLECTIBLE_ITEMS, {
  ceo_benz_key: { id: 'ceo_benz_key', emoji: '🚘', name: '사장님의 벤츠 키', grade: 'ss', desc: '만지기만 해도 주차장이 조용해지는 SS급 유물입니다.', effects: { excavationSuccessCapBonus: 2.5 } },
  expired_badge: { id: 'expired_badge', emoji: '🪪', name: '만료된 출입증', grade: 'common', desc: '문은 안 열리지만 소속감은 남아 있습니다.', effects: {} },
  dull_scissors: { id: 'dull_scissors', emoji: '✂️', name: '무딘 가위', grade: 'common', desc: '테이프 하나 자르기에도 회의가 필요합니다.', effects: { companyValueBonus: 0.5 } },
  lonely_binder_clip: { id: 'lonely_binder_clip', emoji: '🗜️', name: '외로운 집게클립', grade: 'common', desc: '서류 한 장을 과하게 붙잡고 있습니다.', effects: { excavationPowerBonus: 0.1 } },
  vending_coin: { id: 'vending_coin', emoji: '🪙', name: '자판기 밑 동전', grade: 'common', desc: '누군가의 절망과 희망이 동시에 느껴집니다.', effects: { hourlyExpPercent: 0.3 } },
  loose_lan_cable: { id: 'loose_lan_cable', emoji: '🔗', name: '헐거운 랜선', grade: 'common', desc: '연결은 되지만 믿음은 가지 않습니다.', effects: { excavationTimeReductionPercent: 0.5 } },
  dried_glue_stick: { id: 'dried_glue_stick', emoji: '🧴', name: '말라붙은 딱풀', grade: 'common', desc: '뚜껑을 열면 세월이 느껴집니다.', effects: {} },
  torn_envelope: { id: 'torn_envelope', emoji: '✉️', name: '찢어진 봉투', grade: 'common', desc: '중요했을지도 모르는 봉투입니다.', effects: { companyValueBonus: 0.6 } },
  old_desk_calendar: { id: 'old_desk_calendar', emoji: '📆', name: '작년 탁상달력', grade: 'common', desc: '이미 지난 일정이 더 무섭습니다.', effects: { hourlyExpPercent: 0.4 } },
  empty_clip_box: { id: 'empty_clip_box', emoji: '📦', name: '빈 클립 상자', grade: 'common', desc: '겉은 멀쩡한데 속이 비어 있습니다.', effects: {} },
  crooked_ruler: { id: 'crooked_ruler', emoji: '📏', name: '휘어진 자', grade: 'common', desc: '정확하지 않아도 업무는 굴러갑니다.', effects: { bossRaidExpBonus: 0.5 } },
  stale_cookie: { id: 'stale_cookie', emoji: '🍪', name: '눅눅한 쿠키', grade: 'common', desc: '먹기는 애매하지만 버리긴 아깝습니다.', effects: { hourlyExpPercent: 0.4 } },
  cracked_phone_stand: { id: 'cracked_phone_stand', emoji: '📱', name: '금 간 휴대폰 거치대', grade: 'common', desc: '버티는 법을 잘 아는 물건입니다.', effects: { excavationPowerBonus: 0.12 } },
  faded_highlighter: { id: 'faded_highlighter', emoji: '🖍️', name: '색 바랜 형광펜', grade: 'common', desc: '강조해도 아무도 보지 않습니다.', effects: { excavationTimeReductionPercent: 0.6 } },
  rubber_band_ball: { id: 'rubber_band_ball', emoji: '🟤', name: '고무줄 뭉치', grade: 'common', desc: '의외로 단단한 사내 유산입니다.', effects: { companyValueBonus: 0.7 } },
  forgotten_lunch_spoon: { id: 'forgotten_lunch_spoon', emoji: '🥄', name: '잊혀진 도시락 숟가락', grade: 'common', desc: '점심시간의 흔적이 남아 있습니다.', effects: {} },
  memo_with_password: { id: 'memo_with_password', emoji: '📝', name: '비밀번호 적힌 메모', grade: 'rare', desc: '보안 교육이 다시 필요해 보입니다.', effects: { excavationPowerBonus: 0.25 } },
  locked_drawer_key: { id: 'locked_drawer_key', emoji: '🔑', name: '잠긴 서랍 열쇠', grade: 'rare', desc: '서랍보다 열쇠가 더 수상합니다.', effects: { companyValueBonus: 1.1 } },
  premium_coffee_filter: { id: 'premium_coffee_filter', emoji: '☕', name: '프리미엄 커피 필터', grade: 'rare', desc: '커피 맛보다 기분이 진해집니다.', effects: { hourlyExpPercent: 0.7 } },
  unused_usb_hub: { id: 'unused_usb_hub', emoji: '🔌', name: '새것 같은 USB 허브', grade: 'rare', desc: '꽂을수록 가능성이 늘어납니다.', effects: { excavationTimeReductionPercent: 1 } },
  quiet_headset: { id: 'quiet_headset', emoji: '🎧', name: '무소음 헤드셋', grade: 'rare', desc: '아무 말도 듣고 싶지 않을 때 좋습니다.', effects: { bossRaidExpBonus: 0.8 } },
  spare_projector_lamp: { id: 'spare_projector_lamp', emoji: '💡', name: '프로젝터 예비 램프', grade: 'rare', desc: '회의를 더 오래 지속시킬 수 있습니다.', effects: { companyValueBonus: 1.2 } },
  blue_lanyard: { id: 'blue_lanyard', emoji: '🔵', name: '파란 사원증 목걸이', grade: 'rare', desc: '왠지 더 정직해 보이는 목걸이입니다.', effects: { excavationPowerBonus: 0.28 } },
  snack_receipt_bundle: { id: 'snack_receipt_bundle', emoji: '🧾', name: '간식 영수증 묶음', grade: 'rare', desc: '복지와 사비 사이의 기록입니다.', effects: { hourlyExpPercent: 0.6 } },
  emergency_exit_map: { id: 'emergency_exit_map', emoji: '🗺️', name: '비상구 지도', grade: 'rare', desc: '퇴근길을 닮아서 더 소중합니다.', effects: { excavationTimeReductionPercent: 1.2 } },
  sealed_document_tube: { id: 'sealed_document_tube', emoji: '📜', name: '봉인된 도면통', grade: 'rare', desc: '열면 일이 커질 것 같습니다.', effects: { companyValueBonus: 1.3 } },
  office_plant_seed: { id: 'office_plant_seed', emoji: '🌱', name: '사무실 화분 씨앗', grade: 'rare', desc: '언젠가 누군가 물을 줄지도 모릅니다.', effects: { hourlyExpPercent: 0.8 } },
  unused_nameplate: { id: 'unused_nameplate', emoji: '🏷️', name: '미사용 명패', grade: 'rare', desc: '승진의 빈자리가 느껴집니다.', effects: { excavationPowerBonus: 0.32 } },
  silver_stamp: { id: 'silver_stamp', emoji: '🔖', name: '은빛 결재 도장', grade: 'epic', desc: '찍히는 순간 서류가 당당해집니다.', effects: { companyValueBonus: 1.8, excavationPowerBonus: 0.35 } },
  executive_keyboard: { id: 'executive_keyboard', emoji: '⌨️', name: '임원용 기계식 키보드', grade: 'epic', desc: '타건음만으로 보고서가 승인될 것 같습니다.', effects: { hourlyExpPercent: 1.1 } },
  glass_meeting_token: { id: 'glass_meeting_token', emoji: '🔷', name: '유리 회의 토큰', grade: 'epic', desc: '회의 참석권보다 묘하게 고급스럽습니다.', effects: { bossRaidExpBonus: 1.4 } },
  gold_plated_mouse: { id: 'gold_plated_mouse', emoji: '🖱️', name: '금도금 마우스', grade: 'epic', desc: '클릭 한 번에도 품격이 묻어납니다.', effects: { companyValueBonus: 2 } },
  confidential_shred_piece: { id: 'confidential_shred_piece', emoji: '📄', name: '대외비 파쇄 조각', grade: 'epic', desc: '조각인데도 비밀스러운 기운이 납니다.', effects: { excavationPowerBonus: 0.4 } },
  night_shift_lantern: { id: 'night_shift_lantern', emoji: '🏮', name: '야근 랜턴', grade: 'epic', desc: '불을 켜면 퇴근이 멀어집니다.', effects: { excavationTimeReductionPercent: 2 } },
  velvet_chair_cushion: { id: 'velvet_chair_cushion', emoji: '🟣', name: '벨벳 의자 쿠션', grade: 'epic', desc: '앉는 순간 잠깐 대표가 된 기분입니다.', effects: { hourlyExpPercent: 1.2 } },
  audit_seal_box: { id: 'audit_seal_box', emoji: '📮', name: '감사팀 봉인함', grade: 'epic', desc: '열면 안 되지만 발견한 것만으로 성과입니다.', effects: { companyValueBonus: 2.3 } },
  platinum_parking_card: { id: 'platinum_parking_card', emoji: '💳', name: '플래티넘 주차카드', grade: 'epic', desc: '주차장이 먼저 길을 비켜줍니다.', effects: { bossRaidExpBonus: 1.8 } },
  whispering_printer: { id: 'whispering_printer', emoji: '🖨️', name: '속삭이는 프린터', grade: 'epic', desc: '출력물보다 소문이 먼저 나옵니다.', effects: { excavationPowerBonus: 0.43 } },
  redline_contract: { id: 'redline_contract', emoji: '📑', name: '빨간줄 계약서', grade: 'legendary', desc: '수정사항이 많을수록 가치가 오릅니다.', effects: { companyValueBonus: 3, excavationPowerBonus: 0.45 } },
  founders_fountain_pen: { id: 'founders_fountain_pen', emoji: '🖋️', name: '창업자의 만년필', grade: 'legendary', desc: '사인 한 번에 회사 분위기가 바뀝니다.', effects: { hourlyExpPercent: 1.5, companyValueBonus: 2.5 } },
  secret_server_rack: { id: 'secret_server_rack', emoji: '🗄️', name: '비밀 서버랙', grade: 'legendary', desc: '돌아가는 소리만으로도 예산이 느껴집니다.', effects: { excavationTimeReductionPercent: 3, bossRaidExpBonus: 2.5 } },
  diamond_employee_card: { id: 'diamond_employee_card', emoji: '💠', name: '다이아 사원증', grade: 'legendary', desc: '출근할 때마다 빛이 납니다.', effects: { excavationPowerBonus: 0.5, hourlyExpPercent: 1.3 } },
  chairman_safe_code: { id: 'chairman_safe_code', emoji: '🔐', name: '회장 금고 암호표', grade: 'legendary', desc: '외우는 순간 책임도 같이 옵니다.', effects: { companyValueBonus: 3, excavationTimeReductionPercent: 2.5 } },
  eternal_coffee_machine: { id: 'eternal_coffee_machine', emoji: '☕', name: '영원한 커피머신', grade: 'legendary', desc: '물을 넣지 않아도 야근 향이 납니다.', effects: { hourlyExpPercent: 1.5, excavationPowerBonus: 0.48 } },
  platinum_toner_core: { id: 'platinum_toner_core', emoji: '⚙️', name: '백금 토너 코어', grade: 'legendary', desc: '잉크보다 값비싼 무언가입니다.', effects: { bossRaidExpBonus: 3, companyValueBonus: 2.5 } },
  ceo_elevator_key: { id: 'ceo_elevator_key', emoji: '🛗', name: '대표 전용 엘리베이터 키', grade: 'legendary', desc: '누르면 층보다 위계가 먼저 올라갑니다.', effects: { excavationTimeReductionPercent: 3, companyValueBonus: 2.8 } },
  abandoned_business_card_case: { id: 'abandoned_business_card_case', emoji: '💼', name: '버려진 명함 케이스', grade: 'common', desc: '빈 케이스인데도 사회생활의 무게가 있습니다.', effects: { companyValueBonus: 0.5 } },
  fresh_printer_paper: { id: 'fresh_printer_paper', emoji: '📄', name: '새 프린터 용지 묶음', grade: 'common', desc: '언젠가 보고서가 될 운명입니다.', effects: { excavationTimeReductionPercent: 0.5 } },
  secret_snack_drawer: { id: 'secret_snack_drawer', emoji: '🍫', name: '비밀 간식 서랍', grade: 'rare', desc: '열면 사내 사기가 조금 올라갑니다.', effects: { hourlyExpPercent: 0.7 } },
  polished_briefcase: { id: 'polished_briefcase', emoji: '💼', name: '광나는 서류가방', grade: 'epic', desc: '내용물보다 가방의 존재감이 더 큽니다.', effects: { companyValueBonus: 2, bossRaidExpBonus: 1.5 } },
  boardroom_chandelier: { id: 'boardroom_chandelier', emoji: '💡', name: '중역회의실 샹들리에', grade: 'legendary', desc: '불이 켜지는 순간 예산도 같이 켜집니다.', effects: { companyValueBonus: 3, excavationPowerBonus: 0.45 } }
});

const ITEM_DATA = {
  pen_monami: {
    name: '모나미 볼펜',
    price: 100000,
    type: 'passive',
    desc: '월급 획득량 +0.05%',
    hoverDesc: '보유량 1개마다 월급 획득량이 0.05% 증가합니다.',
    stats: { moneyBonus: 0.05 }
  },
  pen_jetstream: {
    name: '제트스트림 볼펜',
    price: 500000,
    type: 'passive',
    desc: '월급 획득량 +0.1%',
    hoverDesc: '보유량 1개마다 월급 획득량이 0.1% 증가합니다.',
    stats: { moneyBonus: 0.1 }
  },
  pen_applepencil: {
    name: '애플펜슬',
    price: 1500000,
    type: 'passive',
    desc: '월급 획득량 +2%',
    hoverDesc: '보유량 1개마다 월급 획득량이 2% 증가합니다.',
    stats: { moneyBonus: 2 }
  },
  reward_pen_monami: {
    name: '보상 모나미 볼펜',
    price: 0,
    type: 'passive',
    shopHidden: true,
    desc: '월급 획득량 +0.05%',
    hoverDesc: '보상으로 받은 모나미 볼펜입니다. 월급 획득량이 0.05% 증가하며 상점 가격 상승에는 영향을 주지 않습니다.',
    stats: { moneyBonus: 0.05 }
  },
  reward_pen_jetstream: {
    name: '보상 제트스트림 볼펜',
    price: 0,
    type: 'passive',
    shopHidden: true,
    desc: '월급 획득량 +0.1%',
    hoverDesc: '보상으로 받은 제트스트림 볼펜입니다. 월급 획득량이 0.1% 증가하며 상점 가격 상승에는 영향을 주지 않습니다.',
    stats: { moneyBonus: 0.1 }
  },
  reward_pen_applepencil: {
    name: '보상 애플펜슬',
    price: 0,
    type: 'passive',
    shopHidden: true,
    desc: '월급 획득량 +2%',
    hoverDesc: '보상으로 받은 애플펜슬입니다. 월급 획득량이 2% 증가하며 상점 가격 상승에는 영향을 주지 않습니다.',
    stats: { moneyBonus: 2 }
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
  },
  tylenol: {
    name: '타이레놀',
    price: 200000,
    type: 'consumable',
    desc: '현재 걸린 모든 디버프 제거',
    hoverDesc: '사용 시 현재 걸려 있는 모든 디버프를 제거합니다.'
  },
  raid_entry_ticket: {
    name: '회의 추가 입장권',
    price: 0,
    type: 'consumable',
    shopHidden: true,
    desc: '오늘 보스 레이드 입장 횟수 +1',
    hoverDesc: '사용 시 오늘 보스 레이드 추가 입장 횟수를 1회 늘립니다.'
  },
  infinite_overtime_ticket: {
    name: '무한야근 입장권',
    price: 0,
    type: 'consumable',
    shopHidden: true,
    desc: '무한야근 재도전 대기시간 초기화',
    hoverDesc: '사용 시 무한야근 재도전 대기시간을 초기화해 즉시 다시 도전할 수 있습니다.'
  },
  hagendaz: {
    name: '하겐다즈',
    price: 0,
    type: 'consumable',
    shopHidden: true,
    desc: '사용 즉시 1레벨 상승',
    hoverDesc: '사용 시 즉시 1레벨 상승하며 현재 경험치는 0으로 초기화됩니다.'
  },
  excavation_repair_coupon: {
    name: '발굴 기계 수리 쿠폰',
    price: 0,
    type: 'consumable',
    shopHidden: true,
    desc: '고장난 발굴 기계를 즉시 수리',
    hoverDesc: '회사 운영 중 발굴 기계가 고장났을 때 사용하면 즉시 수리됩니다.'
  },
  exp_5_percent_potion: {
    name: '경험치 5% 포션',
    price: 0,
    type: 'consumable',
    shopHidden: true,
    desc: '사용 즉시 현재 레벨 경험치통의 5% 획득',
    hoverDesc: '사용하면 현재 레벨 기준 필요 경험치의 5%를 즉시 획득합니다.'
  },
  card_batch_fusion_ticket: {
    name: '카드 일괄 합성 티켓',
    price: 0,
    type: 'consumable',
    shopHidden: true,
    desc: '잠금 해제된 C~A 카드 자동 합성',
    hoverDesc: '사용 시 잠기지 않은 +0~+4 C등급부터 A등급 카드까지 자동으로 합성하여 S등급 카드가 나올 때까지 진행합니다. +5강 카드와 잠긴 카드는 사용하지 않습니다.'
  },
  bacchus_oneshot_ticket: {
    name: '박카스 100개 일괄 소진 티켓',
    price: 0,
    type: 'consumable',
    shopHidden: true,
    desc: '박카스 100개로 모험 100회 일괄 정산',
    hoverDesc: '사용 시 보유 박카스 100개를 소모하여 행동력 100회분의 모험 보상을 한 번에 정산합니다. 고양이집사 칭호 장착 중이면 같은 박카스 100개로 200회 정산합니다. 정산 중 획득한 피로감은 정산 완료 후 적용됩니다.'
  },
  chairman_mood_ticket: {
    name: '회장님의 기분 티켓',
    price: 0,
    type: 'consumable',
    shopHidden: true,
    desc: '온라인 유저 경험치 버프',
    hoverDesc: '사용 시 현재 온라인인 모든 유저에게 30분간 경험치 +10%, 자신에게는 경험치 +20% 버프를 적용합니다.'
  },
  shout_free_ticket: {
    name: '외치기 자유이용권',
    price: 0,
    type: 'consumable',
    shopHidden: true,
    desc: '혹시 정지를 당하셨나요? 걱정마세요. 그런 당신을 위해 준비했습니다.',
    hoverDesc: '사용 시 당일 24시까지 외치기 쿨타임 없이 무제한으로 사용할 수 있습니다.'
  },
  business_card: {
    name: '명함',
    price: 200000,
    type: 'special',
    desc: '카드 뽑기에 사용하는 재화',
    hoverDesc: '카드 뽑기에서 사용하는 재화입니다.'
  },
  cat_tuna_can: {
    name: '고양이 참치캔',
    price: 0,
    type: 'special',
    desc: '모험 중 고양이에게 줄 수 있음',
    hoverDesc: '회사 밖에서 고양이를 만났을 때 건네줄 수 있습니다. 가방에서는 직접 사용할 수 없습니다.'
  },
  equipment_fragment: {
    name: '장비 파편',
    price: 0,
    type: 'special',
    shopHidden: true,
    desc: '장비 분해와 일부 보상으로 획득하는 재화',
    hoverDesc: '상점의 파편 상점 탭에서 회의 추가 입장권, 명함, 휘장 등을 구매할 때 사용합니다.'
  },
  scroll_card_005: {
    name: '주문서: 카드 효과 +0.5%',
    price: 0,
    type: 'special',
    shopHidden: true,
    desc: '카드 효과 장비 전용 / 강화확률 100%',
    hoverDesc: '카드 효과 장비에만 사용할 수 있습니다. 성공 시 카드 효과 수치가 0.5% 증가합니다. 강화확률 100%'
  },
  scroll_card_01: {
    name: '주문서: 카드 효과 +1%',
    price: 0,
    type: 'special',
    shopHidden: true,
    desc: '카드 효과 장비 전용 / 강화확률 60%',
    hoverDesc: '카드 효과 장비에만 사용할 수 있습니다. 성공 시 카드 효과 수치가 1% 증가합니다. 강화확률 60%'
  },
  scroll_card_025: {
    name: '주문서: 카드 효과 +2.5%',
    price: 0,
    type: 'special',
    shopHidden: true,
    desc: '카드 효과 장비 전용 / 강화확률 10%',
    hoverDesc: '카드 효과 장비에만 사용할 수 있습니다. 성공 시 카드 효과 수치가 2.5% 증가합니다. 강화확률 10%'
  },
  scroll_attack_01: {
    name: '주문서: 기본 공격력 +1%',
    price: 0,
    type: 'special',
    shopHidden: true,
    desc: '기본 공격력 장비 전용 / 강화확률 100%',
    hoverDesc: '기본 공격력 장비에만 사용할 수 있습니다. 성공 시 기본 공격력 수치가 1% 증가합니다. 강화확률 100%'
  },
  scroll_attack_02: {
    name: '주문서: 기본 공격력 +2%',
    price: 0,
    type: 'special',
    shopHidden: true,
    desc: '기본 공격력 장비 전용 / 강화확률 60%',
    hoverDesc: '기본 공격력 장비에만 사용할 수 있습니다. 성공 시 기본 공격력 수치가 2% 증가합니다. 강화확률 60%'
  },
  scroll_attack_05: {
    name: '주문서: 기본 공격력 +5%',
    price: 0,
    type: 'special',
    shopHidden: true,
    desc: '기본 공격력 장비 전용 / 강화확률 10%',
    hoverDesc: '기본 공격력 장비에만 사용할 수 있습니다. 성공 시 기본 공격력 수치가 5% 증가합니다. 강화확률 10%'
  }
};

const BUFF_DATA = {
  lupin_stress_buff: {
    name: '월급루팡',
    durationMs: LUPIN_STRESS_DURATION_MS,
    desc: '스트레스를 받지 않습니다.',
    effects: { noStress: true }
  },
  lupin_exp_buff: {
    name: '월급루팡 집중',
    durationMs: LUPIN_EXP_DURATION_MS,
    desc: '모든 경험치 획득량이 1.5배가 됩니다.',
    effects: { expBonusAdd: 0.5 }
  },
  hot6_buff: {
    name: '핫식스 버프',
    durationMs: HOT6_DURATION_MS,
    desc: '서류작업 클릭 시 스트레스를 0.1 낮춥니다.',
    effects: { clickStressRelief: 0.1 }
  },
  field_work_buff: {
    name: '외근 버프',
    durationMs: FIELD_WORK_DURATION_MS,
    desc: '자동 획득 경험치가 5배가 되고, 서류작업 클릭 경험치는 절반이 됩니다.',
    effects: { passiveExpBonusAdd: 4, clickExpBonusAdd: -0.5 }
  },
  confidence_buff: {
    name: '자신감',
    durationMs: CONFIDENCE_DURATION_MS,
    desc: '1시간 동안 모든 경험치 획득량이 1.8배가 됩니다.',
    effects: { expBonusAdd: 0.8 }
  },
  fatigue_debuff: {
    name: '피로감',
    durationMs: FATIGUE_DURATION_MS,
    desc: '4시간 동안 모든 경험치 획득량이 절반으로 감소합니다.',
    effects: { expBonusAdd: -0.5 },
    category: 'debuff'
  },
  cat_gratitude_buff: {
    name: '고양이의 보은',
    durationMs: CAT_GRATITUDE_DURATION_MS,
    desc: '1시간 동안 모든 경험치 획득량이 2배가 됩니다.',
    effects: { expBonusAdd: 1 }
  },
  work_optimization_buff: {
    name: '업무 최적화',
    durationMs: WORK_OPTIMIZATION_DURATION_MS,
    desc: '1시간 동안 모든 획득 경험치가 2배가 됩니다.',
    effects: { expBonusAdd: 1 }
  },
  chairman_mood_buff: {
    name: '회장님의 기분: 격려',
    durationMs: CHAIRMAN_MOOD_DURATION_MS,
    desc: '회장님의 기분 티켓으로 받은 버프입니다. 30분 동안 모든 획득 경험치가 10% 증가합니다.',
    effects: { expBonusAdd: 0.1 }
  },
  chairman_mood_self_buff: {
    name: '회장님의 기분: 주최자',
    durationMs: CHAIRMAN_MOOD_DURATION_MS,
    desc: '회장님의 기분 티켓을 사용한 본인 버프입니다. 30분 동안 모든 획득 경험치가 20% 증가합니다.',
    effects: { expBonusAdd: 0.2 }
  }  ,
  shout_free_ticket_buff: {
    name: '외치기 자유이용권',
    durationMs: 0,
    desc: '오늘 24시까지 외치기 쿨타임 없이 무제한으로 사용할 수 있습니다.',
    effects: {}
  }

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
  },
  cat_butler: {
    name: '고양이집사',
    unlockDesc: '고양이에게 참치캔을 총 10번 건네주면 획득',
    baseDesc: '장착 시 매일 행동력 +2, 월급 +6%, 모험 시 행동력 소모 절반',
    effects: { staminaBonus: 2, moneyBonus: 6, adventureStaminaMultiplier: 0.5 }
  },
  pure_blood: {
    name: '순혈주의자',
    unlockDesc: '운영자 지급 전용',
    baseDesc: '장착 시 타이핑 경험치 1.2배, 월급 +5%',
    effects: { typingExpMultiplier: 1.2, moneyBonus: 5 },
    adminOnly: true
  }
};

const CARD_DATA = {
  ineo_diet: {
    id: 'ineo_diet',
    name: '이네오의 다이어트 선언',
    grade: 'S',
    rate: 0.00025,
    skillName: '다이어트 선언',
    skillDesc: '돌아오는 턴에 기본 공격을 총 10회 합니다. 각 공격은 기본 공격 피해의 90%로 적용되며 크리티컬이 적용될 수 있습니다.',
    cooldown: 3,
    effectType: 'self_multi_hit',
    hits: 10
  },
  gangnam_style: {
    id: 'gangnam_style',
    name: '일 중에 몰래 듣는 강남스타일',
    grade: 'S',
    rate: 0.00025,
    skillName: '강남스타일',
    skillDesc: '1턴 동안 모든 팀원에게 크리티컬률 20%와 흥겨움 버프를 부여하고, 보호막 10을 제공합니다. 흥겨움이 있으면 기본 공격 횟수가 2배가 됩니다.',
    cooldown: 2,
    effectType: 'party_hype_crit',
    critBonus: 0.2,
    turns: 1,
    hypeTurns: 1,
    shield: 10
  },
  click_this_is_click: {
    id: 'click_this_is_click',
    name: '자 이게 클릭이야',
    grade: 'S',
    rate: 0.00025,
    skillName: '인턴',
    skillDesc: '패시브. 전투 시작 시 자신에게 <인턴> 버프를 부여합니다. 인턴 버프를 가진 동안 파티원의 기본 공격 시 확률적으로 함께 기본 공격을 지원합니다.',
    cooldown: 0,
    effectType: 'passive_intern_followup',
    passiveOnly: true,
    internChance: 0.25,
    internDamageMultiplier: 0.3,
    targetType: null
  },
  delegate_lee: {
    id: 'delegate_lee',
    name: '이것 좀 대신 해줘 이대리',
    grade: 'S',
    rate: 0.00025,
    skillName: '이것 좀 대신 해줘',
    skillDesc: '현재 입장한 파티원의 전체 레벨 합 x 30의 데미지를 1회 가합니다.',
    cooldown: 2,
    effectType: 'party_level_blast',
    multiplierPerLevel: 30
  },
  celine_tears: {
    id: 'celine_tears',
    name: '구마의 눈물 젖은 셀린느',
    grade: 'S',
    rate: 0.00025,
    skillName: '셀린느',
    skillDesc: '1턴 동안 <셀린느> 버프를 얻어 공격력이 50% 증가하고, 버프가 끝날 때 자신의 레벨 x 60 피해를 입힙니다.',
    cooldown: 2,
    effectType: 'self_celine_buff',
    turns: 1,
    attackBonusPercent: 0.5,
    expireDamagePerLevel: 60
  },
  strawberry_latte: {
    id: 'strawberry_latte',
    name: '딸기라떼',
    grade: 'A',
    rate: 0.0041428571,
    skillName: '딸기라떼',
    skillDesc: '이번 턴까지만 유지되는 보호막 40을 파티원 전원에게 제공합니다.',
    cooldown: 2,
    effectType: 'party_shield',
    shield: 40
  },
  rebuttal: {
    id: 'rebuttal',
    name: '반박',
    grade: 'A',
    rate: 0.0041428571,
    skillName: '반박',
    skillDesc: '파티원 전체의 HP를 20 회복합니다.',
    cooldown: 2,
    effectType: 'party_heal',
    heal: 20
  },
  parking_master: {
    id: 'parking_master',
    name: '멍프의 주차',
    grade: 'A',
    rate: 0.0041428571,
    skillName: '멍프의 주차',
    skillDesc: '돌아오는 턴에 기본 공격을 총 4회 합니다. 각 공격은 기본 공격 피해의 90%로 적용되며 크리티컬이 적용될 수 있습니다.',
    cooldown: 2,
    effectType: 'self_multi_hit',
    hits: 4
  },
  tissue_box: {
    id: 'tissue_box',
    name: '김주임의 휴지곽',
    grade: 'A',
    rate: 0.0041428571,
    skillName: '휴지곽',
    skillDesc: '2턴 동안 자신이 반격 버프를 획득합니다. 피격당하면 피격 1회당 자신의 기본 공격 1번으로 반격합니다.',
    cooldown: 2,
    effectType: 'self_counter',
    turns: 2
  },
  drinking_angle: {
    id: 'drinking_angle',
    name: '야채곱창',
    grade: 'A',
    rate: 0.0041428571,
    skillName: '소주각?',
    skillDesc: '액티브 스킬 없음. 전투 시작 시 모든 파티원에게 소주각? 버프를 부여합니다. 버프를 지닌 상태로 전투 승리 시 전리품을 2배로 획득합니다.',
    cooldown: 0,
    effectType: 'passive_party_reward',
    passiveOnly: true
  },
  tax_invoice: {
    id: 'tax_invoice',
    name: '호이의 세금계산서',
    grade: 'A',
    rate: 0.0041428571,
    skillName: '세금계산서',
    skillDesc: '파티원 2인을 선택하여 1회 피격 무효화, 1턴 공격력 25% 증가, 1회 디버프 무효화 버프를 제공합니다.',
    cooldown: 3,
    effectType: 'target_pair_guard_buff',
    targetType: 'ally_pair',
    negateHitCount: 1,
    debuffImmuneCount: 1,
    attackBonusPercent: 0.25,
    turns: 1
  },
  rotation_blind_date: {
    id: 'rotation_blind_date',
    name: '코카의 로테이션 소개팅',
    grade: 'A',
    rate: 0.0041428571,
    skillName: '소개팅 상대',
    skillDesc: '액티브 스킬 없음. 매 턴 자신을 제외한 파티원 1명에게 카드 효과를 1.5배로 증폭하는 <소개팅 상대> 버프를 차례대로 줍니다.',
    cooldown: 0,
    effectType: 'passive_rotation_amp',
    passiveOnly: true,
    amplifyMultiplier: 1.5,
    turns: 1
  },
  sherlock: {
    id: 'sherlock',
    name: '셜록몬드의 추리',
    grade: 'B',
    rate: 0.0428571429,
    skillName: '셜록몬드의 추리',
    skillDesc: '다다음 턴까지 파티원 전원의 크리티컬 확률을 50% 증가시킵니다.',
    cooldown: 5,
    effectType: 'party_crit_bonus',
    critBonus: 0.5,
    turns: 2
  },
  lotto_numbers: {
    id: 'lotto_numbers',
    name: '모래의 로또번호',
    grade: 'B',
    rate: 0.0428571429,
    skillName: '이번엔 될거같아',
    skillDesc: '액티브 스킬 없음. 전투 시작 시 모든 파티원에게 <이번엔 될거같아> 버프를 부여합니다. 버프를 지닌 상태로 전투 승리 시 절반 확률로 보상을 3배로 획득하거나 보상을 획득하지 못합니다.',
    cooldown: 0,
    effectType: 'passive_party_lotto',
    passiveOnly: true
  },
  blind_date: {
    id: 'blind_date',
    name: '심심이의 소개팅',
    grade: 'B',
    rate: 0.0428571429,
    skillName: '심심이의 소개팅',
    skillDesc: '랜덤 파티원 1명의 HP를 30 감소시키지만, 다음 턴까지 해당 파티원이 입히는 데미지가 2배로 증가합니다.',
    cooldown: 3,
    effectType: 'random_ally_sacrifice_buff',
    damageMultiplier: 2,
    selfDamage: 30
  },
  fantasy: {
    id: 'fantasy',
    name: '라연이의 망상',
    grade: 'B',
    rate: 0.0428571429,
    skillName: '라연이의 망상',
    skillDesc: '파티원 전원의 모든 디버프를 제거합니다.',
    cooldown: 4,
    effectType: 'party_cleanse'
  },
  broken_leg: {
    id: 'broken_leg',
    name: '감자의 부러진 다리',
    grade: 'B',
    rate: 0.0428571429,
    skillName: '감자의 부러진 다리',
    skillDesc: '선택한 파티원 1명의 HP를 30 회복시킵니다.',
    cooldown: 2,
    effectType: 'target_heal',
    heal: 30,
    targetType: 'ally'
  },
  military_service: {
    id: 'military_service',
    name: '자네, 군필인가?',
    grade: 'B',
    rate: 0.0428571429,
    skillName: '군필인가?',
    skillDesc: '이번 턴에 가하는 자신의 모든 공격에 자신의 레벨 x 20의 데미지를 추가로 줍니다.',
    cooldown: 2,
    effectType: 'self_per_hit_bonus',
    bonusPerLevel: 20
  },
  invincible_logic: {
    id: 'invincible_logic',
    name: '무적의 논리',
    grade: 'B',
    rate: 0.0428571429,
    skillName: '무적의 논리',
    skillDesc: '랜덤 파티원 2인에게 1회 피격 무효화 버프를 제공합니다.',
    cooldown: 2,
    effectType: 'random_party_negate_hit',
    targetType: null,
    targets: 2,
    negateHitCount: 1
  },
  ride_line: {
    id: 'ride_line',
    name: '라인 잘타야지',
    grade: 'B',
    rate: 0.0428571429,
    skillName: '라인 잘타야지',
    skillDesc: '랜덤 파티원 2인의 공격력을 1턴 동안 25% 증가시킵니다.',
    cooldown: 4,
    effectType: 'random_party_attack_buff',
    targets: 2,
    attackBonusPercent: 0.25,
    turns: 1
  },
  wig: {
    id: 'wig',
    name: '김부장의 가발',
    grade: 'C',
    rate: 0.1116666667,
    skillName: '김부장의 가발',
    skillDesc: '돌아오는 턴에 자신의 기본 공격을 총 3회 합니다. 각 공격은 기본 공격 피해의 90%로 적용됩니다.',
    cooldown: 3,
    effectType: 'self_multi_hit',
    hits: 3
  },
  chatgpt: {
    id: 'chatgpt',
    name: '모래의 챗지피티',
    grade: 'C',
    rate: 0.1116666667,
    skillName: '모래의 챗지피티',
    skillDesc: '돌아오는 턴에 기본 공격에 더해 자신의 레벨 x 10의 추가 데미지를 입힙니다.',
    cooldown: 2,
    effectType: 'self_bonus_damage',
    bonusPerLevel: 10
  },
  pho: {
    id: 'pho',
    name: '닐닐이의 쌀국수',
    grade: 'C',
    rate: 0.1116666667,
    skillName: '닐닐이의 쌀국수',
    skillDesc: '랜덤 파티원 3명에게 각각 50의 보호막을 제공합니다.',
    cooldown: 3,
    effectType: 'random_shield',
    shield: 50,
    targets: 3
  },
  coca_cola: {
    id: 'coca_cola',
    name: '코카의 콜라',
    grade: 'C',
    rate: 0.1116666667,
    skillName: '코카의 콜라',
    skillDesc: '선택한 파티원 1인의 공격력을 2턴 동안 30% 증가시킵니다.',
    cooldown: 3,
    effectType: 'target_attack_buff',
    targetType: 'ally',
    attackBonusPercent: 0.3,
    turns: 2
  },
  cider_comment: {
    id: 'cider_comment',
    name: '사이다 발언',
    grade: 'C',
    rate: 0.1116666667,
    skillName: '사이다 발언',
    skillDesc: '파티원 1인을 선택하여 해당 팀원에게 1회 모든 디버프 무효화 버프를 제공합니다.',
    cooldown: 3,
    effectType: 'target_debuff_guard',
    targetType: 'ally',
    debuffImmuneCount: 1
  },
  rooftop_pigeons: {
    id: 'rooftop_pigeons',
    name: '옥상의 비둘기떼',
    grade: 'C',
    rate: 0.1116666667,
    skillName: '비둘기떼',
    skillDesc: '자신의 레벨 x 8의 데미지로 5회 공격합니다. 각 공격은 90% 위력으로 적용됩니다.',
    cooldown: 3,
    effectType: 'self_fixed_multi_hit',
    hits: 5,
    damagePerLevel: 8
  },
  sunscreen: {
    id: 'sunscreen',
    name: '썬크림',
    grade: 'S',
    rate: 0.00025,
    skillName: '썬크림',
    skillDesc: '랜덤 팀원 3인에게 피격 무효화 1회를 부여합니다.',
    cooldown: 6,
    effectType: 'party_negate_hit_by_level',
    targets: 3,
    negateHitCount: 1
  },
  trial_and_growth: {
    id: 'trial_and_growth',
    name: '날 죽이지 못하는 시련은 어쩌고저쩌고..',
    grade: 'S',
    rate: 0.00025,
    skillName: '시련은 성장의 밑거름',
    skillDesc: '현재 자신이 가진 버프/디버프 총 갯수 x 레벨 x 5의 피해를 3회 주고, 모든 디버프를 제거합니다.',
    cooldown: 5,
    effectType: 'self_status_blast',
    hits: 3,
    multiplierPerStatus: 5
  },
  hoi_overtime: {
    id: 'hoi_overtime',
    name: '호이의 매일하는 야근',
    grade: 'S',
    rate: 0.00025,
    skillName: '매일하는 야근',
    skillDesc: '사용 시 상대에게 <야근> 디버프를 겁니다. 야근 중 기본 공격에 피격당할 때마다 <내면의 분노>가 쌓이고, 자신의 턴에 재사용하면 스택을 소진해 피해를 준 뒤 쿨타임이 시작됩니다. 야근이 정화되면 폭발 재사용은 불가능해지고 즉시 쿨타임이 시작됩니다.',
    cooldown: 4,
    effectType: 'overtime_rage',
    rageDamagePerStackPerLevel: 5,
    targetType: null
  },
  chunsik_not_hyeji: {
    id: 'chunsik_not_hyeji',
    name: '춘식이혜지아니다.',
    grade: 'S',
    rate: 0.00025,
    skillName: '춘식이혜지아니다.',
    skillDesc: '지정한 아군 1인의 총 잃은 체력의 30%를 회복합니다.',
    cooldown: 8,
    effectType: 'target_missing_hp_heal',
    targetType: 'ally',
    healMissingHpPercent: 0.3
  },
  after_work_chimek: {
    id: 'after_work_chimek',
    name: '퇴근 후 유튜브, 치킨 그리고 맥주',
    grade: 'S',
    rate: 0.00025,
    skillName: '퇴근 후 치맥',
    skillDesc: '파티원 전원의 HP를 10 + 잃은 체력의 15%만큼 회복하고, 피격 무효화 1회를 부여합니다.',
    cooldown: 6,
    effectType: 'party_missing_hp_heal_negate',
    targetType: null,
    healFlat: 10,
    healMissingHpPercent: 0.15,
    negateHitCount: 1
  },
  flexible_blame: {
    id: 'flexible_blame',
    name: '유연한 남탓: 제가 한거 아닌데요?',
    grade: 'A',
    rate: 0.008,
    skillName: '제가 한거 아닌데요?',
    skillDesc: '지정한 아군 1인에게 2턴 동안 <예? 저요?> 버프를 부여합니다. 상대는 해당 대상을 우선 타겟팅하며, 버프 보유자는 받는 최종 피해가 감소합니다.',
    cooldown: 5,
    effectType: 'target_taunt_damage_reduction',
    targetType: 'ally',
    turns: 2,
    damageReductionPercent: 0.02
  },
  solid_mental: {
    id: 'solid_mental',
    name: '굳건한 멘탈의 소유자',
    grade: 'S',
    rate: 0.00025,
    skillName: '굳건한 멘탈',
    skillDesc: '자기 자신에게 피격 무효화를 3회 부여합니다. 피격 무효를 모두 소모한 뒤 쿨타임이 시작됩니다.',
    cooldown: 8,
    effectType: 'self_negate_hit',
    targetType: null,
    negateHitCount: 3
  },
  mingu_champion: {
    id: 'mingu_champion',
    name: '제 1회 면담대회 우승자 밍구의 품격',
    grade: 'S',
    rate: 0.00025,
    skillName: '챔피언의 품격',
    skillDesc: '지정한 파티원 1인에게 보호막 20과 <챔피언의 가호>를, 상대에게 <눈부심>을 부여합니다.',
    cooldown: 7,
    effectType: 'champion_guard',
    targetType: 'ally',
    shield: 20,
    turns: 2,
    attackBonusPercent: 0.1,
    critBonus: 0.2,
    blindTurns: 1,
    blindMissChance: 0.3,
    specialStyle: 'champion'
  },
  winter_subordinate: {
    id: 'winter_subordinate',
    name: '겨울 부장의 부하직원 육성',
    grade: 'S',
    rate: 0.00025,
    skillName: '부하직원 육성',
    skillDesc: '선택한 파티원 1인의 최종 데미지를 2턴 동안 50% 증가시킵니다.',
    cooldown: 7,
    effectType: 'target_final_damage_buff',
    targetType: 'ally',
    turns: 2,
    finalDamageBonusPercent: 0.5
  },
  potato_rehab: {
    id: 'potato_rehab',
    name: '감자의 재활훈련',
    grade: 'S',
    rate: 0.00025,
    skillName: '재활훈련',
    skillDesc: '보스전에서 현재 데미지의 고정 피해를 1회 입힙니다. 노멀 보스에서는 피해와 막타 성장량이 1/3로 적용됩니다. 한 판당 1회만 사용할 수 있고, 이 스킬로 적을 처치하면 데미지가 플레이어의 현재 레벨만큼 영구 증가합니다.',
    cooldown: 0,
    effectType: 'potato_rehab_fixed_damage',
    targetType: null,
    fixedDamage: POTATO_REHAB_BASE_DAMAGE,
    enhanceDisabled: true,
    pvpDisabled: true,
    oncePerBattle: true,
    specialStyle: 'potato-rehab'
  },
  precise_strike: {
    id: 'precise_strike',
    name: '정곡찌르기',
    grade: 'A',
    rate: 0.008,
    skillName: '정곡찌르기',
    skillDesc: '자신의 레벨 x 40의 데미지를 1회 줍니다. 이 스킬은 방어막을 무시하고 HP에 직접 데미지를 입힙니다.',
    cooldown: 5,
    effectType: 'direct_hp_strike',
    multiplierPerLevel: 40
  },
  umbrella_copy: {
    id: 'umbrella_copy',
    name: '쓰비의 우산 돌려쓰기',
    grade: 'A',
    rate: 0.008,
    skillName: '우산 돌려쓰기',
    skillDesc: '랜덤 파티원 1명의 카드 효과를 절반만 적용해 따라 합니다.',
    cooldown: 6,
    effectType: 'copy_ally_skill',
    copyEffectMultiplier: 0.5,
    targetType: null
  },
  neo_pesticide: {
    id: 'neo_pesticide',
    name: '네오의 특제 농약',
    grade: 'A',
    rate: 0.008,
    skillName: '특제 농약',
    skillDesc: '상대에게 2턴 동안 <중독> 디버프를 적용합니다. 중독 중 공격할 때마다 스킬 시전자의 레벨 x 10 피해를 입습니다.',
    cooldown: 7,
    effectType: 'poison_debuff',
    turns: 2,
    damagePerLevel: 10,
    targetType: null
  },
  tangerine_after_brushing: {
    id: 'tangerine_after_brushing',
    name: '양치 후 귤 먹이기',
    grade: 'A',
    rate: 0.008,
    skillName: '양치 후 귤',
    skillDesc: '상대방의 치유 효과를 2턴 동안 15% 감소시킵니다.',
    cooldown: 7,
    effectType: 'enemy_heal_reduction',
    turns: 2,
    healReductionPercent: 0.15,
    targetType: null
  },
  neo_self_esteem: {
    id: 'neo_self_esteem',
    name: '네오의 자존감',
    grade: 'A',
    rate: 0.008,
    skillName: '자존감',
    skillDesc: '자신에게 <자존감> 버프를 1회 부여합니다. 자존감 보유 중 디버프를 받으면 상대에게 반사하고 자존감은 사라집니다.',
    cooldown: 5,
    effectType: 'self_debuff_reflect',
    selfEsteemCount: 1,
    enhanceDisabled: true,
    targetType: null
  },
  nosy_manager: {
    id: 'nosy_manager',
    name: '노처녀 신차장의 오지랖',
    grade: 'A',
    rate: 0.008,
    skillName: '오지랖',
    skillDesc: '선택한 파티원 1명에게 보호막 30을 부여하고, 상대에게 자신의 레벨 x 20 피해를 2회 입힙니다.',
    cooldown: 5,
    effectType: 'ally_shield_enemy_multi_hit',
    targetType: 'ally',
    shield: 30,
    damagePerLevel: 20,
    hits: 2
  },
  mond_parental_leave: {
    id: 'mond_parental_leave',
    name: '몬드의 육아휴직',
    grade: 'A',
    rate: 0.008,
    skillName: '육아휴직',
    skillDesc: '모든 파티원들의 남은 스킬 쿨타임을 1턴 줄여줍니다. 개인면담에서는 자신의 모든 카드의 남은 쿨타임을 1턴 줄입니다.',
    cooldown: 9,
    effectType: 'party_cooldown_reduce',
    cooldownReduce: 1,
    targetType: null
  },
  jor_bongo: {
    id: 'jor_bongo',
    name: '죠르의 봉고차',
    grade: 'B',
    rate: 0.0428571429,
    skillName: '봉고차',
    skillDesc: '파티원들에게 랜덤으로 <빵> 버프를 나눠줍니다. 빵을 가진 상태에서 1회 피격 시 HP 5를 회복하고 빵 1개가 사라집니다.',
    cooldown: 5,
    effectType: 'party_bread_buff',
    breadCount: 6,
    breadHeal: 5,
    targetType: null
  },
  gossip: {
    id: 'gossip',
    name: '뒷담화',
    grade: 'B',
    rate: 0.0428571429,
    skillName: '뒷담화',
    skillDesc: '상대방의 버프 1개 또는 횟수형 버프 1회를 랜덤으로 제거합니다.',
    cooldown: 8,
    effectType: 'remove_enemy_buff',
    removeBuffCount: 1,
    targetType: null
  }
};

const CARD_GRADE_COLORS = {
  S: '#c62828',
  A: '#f9a825',
  B: '#1565c0',
  C: '#2e7d32'
};

const CARD_ENHANCE_SUCCESS_RATES = [0.9, 0.75, 0.55, 0.3, 0.1];
const CARD_ENHANCE_COSTS = {
  C: [50000, 100000, 150000, 200000, 250000],
  B: [100000, 200000, 300000, 400000, 500000],
  A: [500000, 1000000, 1500000, 2000000, 2500000],
  S: [1000000, 2000000, 3000000, 4000000, 5000000]
};
const CARD_ENHANCE_BORDER_COLORS = {
  0: '',
  1: '#2e7d32',
  2: '#1565c0',
  3: '#7b1fa2',
  4: '#f9a825',
  5: '#c62828'
};
const CARD_ENHANCE_RULES = {
  ineo_diet: { hits: { 0: 7, 1: 8, 3: 10, 5: 11 }, cooldown: { 0: 5, 2: 4, 4: 3 } },
  gangnam_style: { critBonus: { 0: 0.1, 1: 0.15, 3: 0.2 }, shield: { 0: 10, 2: 15, 5: 20 }, cooldown: { 0: 3, 4: 2 } },
  click_this_is_click: { internChance: { 0: 0.25, 1: 0.3, 2: 0.35, 5: 0.4 }, internDamageMultiplier: { 0: 0.3, 3: 0.35, 4: 0.4 } },
  delegate_lee: { multiplierPerLevel: { 0: 20, 1: 25, 3: 30, 4: 35 }, cooldown: { 0: 6, 2: 5, 5: 4 } },
  celine_tears: { attackBonusPercent: { 0: 0.3, 1: 0.4, 4: 0.5 }, expireDamagePerLevel: { 0: 50, 3: 60, 5: 65 }, cooldown: { 0: 3, 2: 2 } },
  strawberry_latte: { shield: { 0: 20, 1: 25, 3: 30, 4: 35, 5: 40 }, shieldTurns: { 5: 1 }, cooldown: { 0: 4, 2: 3 } },
  rebuttal: { heal: { 0: 10, 1: 15, 2: 20, 4: 25 }, includeSelf: { 0: 0, 3: 1 }, cooldown: { 0: 4, 5: 3 } },
  parking_master: { hits: { 0: 2, 2: 3, 4: 4, 5: 5 }, cooldown: { 0: 5, 1: 4, 3: 3 } },
  tissue_box: { turns: { 0: 1, 2: 2 }, counterDamageMultiplier: { 0: 0.8, 1: 0.9, 4: 1, 5: 1.2 }, cooldown: { 0: 4, 3: 3 } },
  drinking_angle: { rewardMultiplier: { 0: 1.3, 1: 1.4, 2: 1.5, 3: 1.6, 4: 1.8, 5: 2 } },
  tax_invoice: { negateHitCount: { 0: 0, 5: 1 }, attackBonusPercent: { 0: 0.15, 1: 0.2, 3: 0.25, 4: 0.3 }, cooldown: { 0: 4, 2: 3 } },
  rotation_blind_date: { amplifyMultiplier: { 0: 1.1, 1: 1.2, 2: 1.3, 3: 1.4, 4: 1.5, 5: 1.6 } },
  sherlock: { critBonus: { 0: 0.3, 1: 0.35, 2: 0.4, 3: 0.45, 4: 0.5 }, turns: { 0: 1, 5: 2 } },
  lotto_numbers: { successChance: { 0: 0.3, 1: 0.35, 2: 0.4, 3: 0.45, 4: 0.5, 5: 0.55 } },
  blind_date: { selfDamage: { 0: 40, 2: 30, 4: 20 }, cooldown: { 0: 5, 1: 4, 3: 3, 5: 2 } },
  fantasy: { targets: { 0: 2, 3: 3, 4: 4, 5: 99 }, cooldown: { 0: 5, 1: 4, 2: 3 } },
  broken_leg: { heal: { 0: 10, 1: 15, 2: 20, 4: 25 }, cooldown: { 0: 4, 3: 3, 5: 2 } },
  military_service: { bonusPerLevel: { 0: 10, 1: 12, 2: 14, 3: 16, 4: 18, 5: 20 } },
  invincible_logic: { targets: { 0: 1, 1: 2, 3: 3 }, cooldown: { 0: 5, 2: 4, 4: 3, 5: 2 } },
  ride_line: { targets: { 0: 1, 1: 2 }, attackBonusPercent: { 0: 0.25, 3: 0.3, 5: 0.35 }, cooldown: { 0: 5, 2: 4, 4: 3 } },
  wig: { hits: { 0: 2, 2: 3, 4: 4 }, cooldown: { 0: 6, 1: 5, 3: 4, 5: 3 } },
  chatgpt: { bonusPerLevel: { 0: 6, 1: 7, 2: 8, 3: 9, 4: 10, 5: 12 } },
  pho: { targets: { 0: 2, 3: 3 }, shield: { 0: 30, 1: 40, 5: 50 }, cooldown: { 0: 5, 2: 4, 4: 3 } },
  coca_cola: { attackBonusPercent: { 0: 0.2, 1: 0.25, 3: 0.3, 4: 0.35 }, turns: { 0: 1, 5: 2 }, cooldown: { 0: 5, 2: 4 } },
  cider_comment: { debuffImmuneCount: { 0: 1, 5: 2 }, cooldown: { 0: 6, 1: 5, 2: 4, 3: 3, 4: 2 } },
  rooftop_pigeons: { damagePerLevel: { 0: 5, 1: 6, 2: 7, 3: 8, 4: 9, 5: 10 } },
  sunscreen: { targets: { 0: 3, 2: 4, 3: 99 }, negateHitCount: { 0: 1, 4: 2, 5: 3 }, includeSelf: { 0: 0, 3: 1 }, cooldown: { 0: 6, 1: 5, 5: 4 } },
  trial_and_growth: { multiplierPerStatus: { 0: 5, 1: 5, 2: 6, 3: 7, 4: 7, 5: 8 }, cooldown: { 0: 5, 1: 4, 4: 3 } },
  hoi_overtime: { rageDamagePerStackPerLevel: { 0: 5, 1: 6, 2: 7, 3: 8, 4: 9 }, cooldown: { 0: 4, 5: 3 } },
  chunsik_not_hyeji: { healMissingHpPercent: { 0: 0.3, 2: 0.35, 3: 0.4, 5: 0.45 }, cooldown: { 0: 8, 1: 7, 4: 6 } },
  after_work_chimek: { healMissingHpPercent: { 0: 0.15, 1: 0.2, 3: 0.25, 5: 0.3 }, cooldown: { 0: 6, 2: 5, 4: 4 } },
  flexible_blame: { damageReductionPercent: { 0: 0.02, 1: 0.04, 2: 0.06, 3: 0.08, 4: 0.1 }, cooldown: { 0: 5, 5: 4 } },
  solid_mental: { negateHitCount: { 0: 3, 1: 4, 2: 5, 4: 6, 5: 7 }, cooldown: { 0: 8, 3: 7 } },
  mingu_champion: { attackBonusPercent: { 0: 0.1, 3: 0.15, 5: 0.2 }, cooldown: { 0: 7, 2: 6, 4: 5 } },
  winter_subordinate: { finalDamageBonusPercent: { 0: 0.5, 1: 0.6, 3: 0.7, 5: 0.8 }, cooldown: { 0: 7, 2: 6, 4: 5 } },
  precise_strike: { multiplierPerLevel: { 0: 40, 2: 45, 3: 50, 4: 55 }, cooldown: { 0: 5, 1: 4, 5: 3 } },
  umbrella_copy: { copyEffectMultiplier: { 0: 0.5, 2: 0.6, 3: 0.7 }, canSelectCopyTarget: { 4: 1 }, cooldown: { 0: 6, 1: 5, 5: 4 } },
  neo_pesticide: { damagePerLevel: { 0: 10, 2: 11, 4: 12, 5: 15 }, cooldown: { 0: 7, 1: 6, 3: 5 } },
  tangerine_after_brushing: { healReductionPercent: { 0: 0.15, 1: 0.2, 2: 0.25, 3: 0.3, 4: 0.35, 5: 0.4 } },
  nosy_manager: { shield: { 0: 30, 1: 35, 4: 40 }, damagePerLevel: { 0: 20, 2: 25, 5: 30 }, cooldown: { 0: 5, 3: 4 } },
  mond_parental_leave: { cooldown: { 0: 9, 1: 8, 3: 7, 5: 6 } },
  jor_bongo: { breadCount: { 0: 6, 1: 7, 2: 8, 3: 9, 4: 10 }, cooldown: { 0: 5, 5: 4 } },
  gossip: { removeBuffCount: { 0: 1, 5: 2 }, cooldown: { 0: 8, 1: 7, 2: 6, 3: 5, 4: 4 } }
};

const SUPPORT_PACKAGE_DATA = {
  beginner: {
    id: 'beginner',
    name: '초보자패키지',
    price: 5000,
    beginnerOnlyMaxLevel: 49,
    rewards: [
      { itemId: 'reward_pen_monami', quantity: 10 },
      { itemId: 'reward_pen_jetstream', quantity: 2 },
      { itemId: 'business_card', quantity: 100 },
      { itemId: 'hagendaz', quantity: 2 }
    ]
  },
  fatigue_recovery: {
    id: 'fatigue_recovery',
    name: '피로회복패키지',
    price: 1000,
    rewards: [
      { itemId: 'bacchus', quantity: 1 },
      { itemId: 'business_card', quantity: 10 }
    ]
  },
  awakening: {
    id: 'awakening',
    name: '각성패키지',
    price: 3000,
    rewards: [
      { itemId: 'bacchus', quantity: 5 },
      { itemId: 'reward_pen_monami', quantity: 2 },
      { itemId: 'business_card', quantity: 33 }
    ]
  },
  super_rich: {
    id: 'super_rich',
    name: '초부자패키지',
    price: 5000,
    rewards: [
      { itemId: 'bacchus', quantity: 10 },
      { itemId: 'reward_pen_monami', quantity: 5 },
      { itemId: 'business_card', quantity: 55 }
    ]
  },
  bacchus_100: {
    id: 'bacchus_100',
    name: '박카스 100개 패키지',
    price: 6000,
    rewards: [
      { itemId: 'bacchus', quantity: 100 }
    ]
  },
  business_card_80: {
    id: 'business_card_80',
    name: '명함 패키지 1',
    price: 5000,
    rewards: [
      { itemId: 'business_card', quantity: 80 }
    ]
  },
  business_card_170: {
    id: 'business_card_170',
    name: '명함 패키지 2',
    price: 10000,
    rewards: [
      { itemId: 'business_card', quantity: 170 }
    ]
  },
  batch_fusion_ticket_pack: {
    id: 'batch_fusion_ticket_pack',
    name: '일괄 합성 패키지',
    price: 3000,
    rewards: [
      { itemId: 'card_batch_fusion_ticket', quantity: 1 }
    ]
  },
  bacchus_oneshot_1: {
    id: 'bacchus_oneshot_1',
    name: '박카스 원샷 패키지 1',
    price: 5000,
    rewards: [
      { itemId: 'bacchus_oneshot_ticket', quantity: 5 }
    ]
  },
  bacchus_oneshot_2: {
    id: 'bacchus_oneshot_2',
    name: '박카스 원샷 패키지 2',
    price: 10000,
    rewards: [
      { itemId: 'bacchus_oneshot_ticket', quantity: 11 }
    ]
  },
  ultra_rich: {
    id: 'ultra_rich',
    name: '초초부자패키지',
    price: 7000,
    rewards: [
      { itemId: 'reward_pen_monami', quantity: 7 },
      { itemId: 'reward_pen_jetstream', quantity: 1 },
      { itemId: 'business_card', quantity: 77 }
    ]
  },
  building_owner: {
    id: 'building_owner',
    name: '건물주패키지',
    price: 10000,
    rewards: [
      { itemId: 'reward_pen_monami', quantity: 10 },
      { itemId: 'reward_pen_jetstream', quantity: 2 },
      { itemId: 'business_card', quantity: 110 },
      { itemId: 'hagendaz', quantity: 1 }
    ]
  }
};

const DAILY_SHOP_PURCHASE_LIMITS = {
  business_card: 5,
  bacchus: 20,
  hot6: 5
};

const FRAGMENT_SHOP_ITEMS = {
  raid_entry_ticket: {
    id: 'raid_entry_ticket',
    itemId: 'raid_entry_ticket',
    name: '회의 추가 입장권 1장',
    cost: 50,
    quantity: 1,
    dailyLimit: 1,
    countField: 'dailyFragmentRaidTicketPurchases'
  },
  business_card_bundle: {
    id: 'business_card_bundle',
    itemId: 'business_card',
    name: '명함 10장',
    cost: 30,
    quantity: 10,
    dailyLimit: 2,
    countField: 'dailyFragmentBusinessCardPurchases'
  },
  exp_5_percent_potion: {
    id: 'exp_5_percent_potion',
    itemId: 'exp_5_percent_potion',
    name: '경험치 5% 포션',
    desc: '사용 즉시 현재 레벨 경험치통의 5%를 획득합니다. 매주 3회 구매 가능.',
    cost: 1000,
    quantity: 1,
    weeklyLimit: 3,
    countField: 'weeklyFragmentExpPotionPurchases'
  },
  cat_butler_emblem: {
    id: 'cat_butler_emblem',
    emblemId: 'cat_butler',
    name: '집사 휘장',
    cost: 5000,
    quantity: 1,
    dailyLimit: 1,
    countField: 'dailyFragmentCatButlerEmblemPurchases'
  },
  tiger_emblem: {
    id: 'tiger_emblem',
    emblemId: 'tiger',
    name: '호랭이 휘장',
    cost: 10000,
    quantity: 1,
    dailyLimit: 1,
    countField: 'dailyFragmentTigerEmblemPurchases'
  },
  idol_emblem: {
    id: 'idol_emblem',
    emblemId: 'idol',
    name: 'IDOL 휘장',
    cost: 20000,
    quantity: 1,
    dailyLimit: 1,
    countField: 'dailyFragmentIdolEmblemPurchases'
  },
  bitch_not_emblem: {
    id: 'bitch_not_emblem',
    emblemId: 'bitch_not',
    name: 'BITCH 아닙니다 휘장',
    cost: 25000,
    quantity: 1,
    dailyLimit: 1,
    countField: 'dailyFragmentBitchNotEmblemPurchases'
  },
  ruined_bear_emblem: {
    id: 'ruined_bear_emblem',
    emblemId: 'ruined_bear',
    name: '망x러진곰 휘장',
    cost: 5000,
    quantity: 1,
    dailyLimit: 1,
    countField: 'dailyFragmentRuinedBearEmblemPurchases'
  }
};

const EQUIPMENT_SCROLL_RULES = {
  scroll_card_005: { equipmentType: EQUIPMENT_TYPE_CARD, addValue: 0.5, successRate: 1 },
  scroll_card_01: { equipmentType: EQUIPMENT_TYPE_CARD, addValue: 1, successRate: 0.6 },
  scroll_card_025: { equipmentType: EQUIPMENT_TYPE_CARD, addValue: 2.5, successRate: 0.1 },
  scroll_attack_01: { equipmentType: EQUIPMENT_TYPE_ATTACK, addValue: 1, successRate: 1 },
  scroll_attack_02: { equipmentType: EQUIPMENT_TYPE_ATTACK, addValue: 2, successRate: 0.6 },
  scroll_attack_05: { equipmentType: EQUIPMENT_TYPE_ATTACK, addValue: 5, successRate: 0.1 }
};

const RAID_BOSS_REWARDS_TEXT = [
  '경험치: 10레벨 기준 현재 레벨 경험치통의 100%, 이후 레벨당 2% 감소, 50레벨 이상은 20% 고정',
  '명함 0~2장',
  '박카스 3~5개',
  '보상 모나미 볼펜 0~1개',
  '재화 100,000원~300,000원'
];

const RAID_BOSS_DATA = {
  [RAID_BOSS_ID]: {
    id: RAID_BOSS_ID,
    name: '트름녀',
    maxHp: 60000,
    maxHpByMode: {
      [RAID_MODE_CHAOS]: 400000
    },
    imageLabel: '트름녀',
    portrait: 'assets/bosses/burp_queen.png',
    patternOrder: ['burp', 'ice', 'smack', 'shield'],
    legacyHardPassiveText: '패시브. 가시갑옷: 1회 피격당할 때마다 공격자에게 5 피해를 반사합니다.',
    hardPassiveText: '패시브. 가시갑옷: 1회 피격당할 때마다 공격자에게 5 피해를 반사합니다. 자신의 잃은 체력에 비례해 매 타격당 입는 데미지가 최대 75%까지 감소합니다.',
    skillsText: [
      '1. 트름하기: 파티 전체에게 30 피해',
      '2. 얼음씹기: 랜덤 3명에게 30 피해, 1턴 침묵',
      '3. 쩝쩝거리기: 랜덤 대상에게 20 피해씩 총 4회',
      '4. 눈 새 행동: 1턴 지속 보호막 10,000 획득'
    ],
    hardSkillsText: [
      '1. 트름하기: 파티 전체에게 10 피해, 총 3회',
      '2. 얼음씹기: 랜덤 3명에게 40 피해 + 4턴 침묵',
      '3. 쩝쩝거리기: 랜덤 대상에게 20 피해, 총 4회',
      '4. 눈 새 행동: 70,000 + 잃은 체력의 10% 회복, 자신에게 2턴 지속 150,000 보호막'
    ],
    rewardsText: RAID_BOSS_REWARDS_TEXT
  },
  [RAID_BOSS_ID_BALD_MANAGER]: {
    id: RAID_BOSS_ID_BALD_MANAGER,
    name: '대머리 김부장',
    maxHp: 60000,
    maxHpByMode: {
      [RAID_MODE_CHAOS]: 350000
    },
    imageLabel: '대머리 김부장',
    portrait: 'assets/bosses/bald_manager.png',
    patternOrder: ['wig_search', 'mz', 'afterparty', 'sauna'],
    legacyHardPassiveText: '패시브. 매끈한 두피: 1P 행동 시작부터 다음 1P 행동 시작 전까지, 플레이어에게 1회 타격당할 때마다 이후 받는 피해가 10%씩 곱연산 감소합니다. 다음 턴 1P 행동 시작 시 스택이 초기화됩니다.',
    hardPassiveText: '패시브. 매끈한 두피: 1P 행동 시작부터 다음 1P 행동 시작 전까지, 플레이어에게 1회 타격당할 때마다 이후 받는 피해가 10%씩 곱연산 감소합니다. 다음 턴 1P 행동 시작 시 스택이 초기화됩니다. 매 자신의 턴마다 잃은 체력의 20%를 회복합니다.',
    skillsText: [
      '1. 내 가발 어디갔어?!: 랜덤 3명에게 20 피해, 2턴 동안 기본 공격/스킬 사용 불가',
      '2. 허허, 요즘 엠제트세대란..: 랜덤 4명에게 10 피해, 2턴 동안 회복량/실드 획득량 50% 감소',
      '3. 비기: 회식은 3차부터: 2턴 지속 보호막 7,000 획득, 전원에게 다음 피격 피해 3배 디버프',
      '4. 사우나나 갈까?: 파티 전체에게 20 피해',
      '보너스 규칙: 파티에 <김부장의 가발> 장착자가 있으면 1번 스킬이 어이쿠 가발이 여기있네..로 바뀝니다.'
    ],
    hardSkillsText: [
      '1. 내 가발 어디갔어?!: 랜덤 3명에게 30 피해 + 4턴 기본공격/스킬 사용 불가',
      '1-변형. 어이쿠 가발이 여기있네..: 파티에 김부장의 가발 카드 장착자가 있으면 해당 장착자에게 20 피해 + 1턴 피해 3배 버프',
      '2. 허허, 요즘 엠제트세대란..: 랜덤 4명에게 6 피해, 총 5회 + 4턴 회복량/보호막 획득량 70% 감소',
      '3. 비기: 회식은 3차부터: 자신에게 4턴 지속 100,000 보호막 + 파티 전원에게 다음 피격 피해 3배 디버프',
      '4. 사우나나 갈까?: 파티 전체에게 10 피해, 총 3회'
    ],
    rewardsText: RAID_BOSS_REWARDS_TEXT
  },
  [RAID_BOSS_ID_HOI]: {
    id: RAID_BOSS_ID_HOI,
    name: 'HOI-M.S.J-50',
    maxHp: 60000,
    maxHpByMode: {
      [RAID_MODE_CHAOS]: 400000
    },
    imageLabel: 'HOI-M.S.J-50',
    portrait: 'assets/bosses/hoi_msj_50.png',
    patternOrder: ['son_brag', 'son_mix', 'ass_hit', 'nail_clip', 'food_question'],
    hardPatternOrder: ['son_brag', 'ass_hit', 'nail_clip', 'food_question', 'son_mix'],
    legacyHardPassiveText: '패시브. 나 먼저 퇴근할게: 매 공격을 20% 확률로 회피합니다.',
    hardPassiveText: '패시브. 나 먼저 퇴근할게: 매 공격을 20% 확률로 회피합니다. 회피 성공시마다 총 잃은 체력의 10%를 회복합니다.',
    skillsText: [
      '1. 아들자랑 MK.1: 전원의 버프 제거, 제거된 버프 1개당 10 피해, 랜덤 2인에게 2턴 기본 공격 불가',
      '2. 아들이랑 엮기 MK.2: 자신 버프 1개당 6000 회복, 버프가 없으면 보호막 5000 획득',
      '3. ASS-HIT MK.3: 전원에게 10 피해씩 총 3회 공격',
      '4. 손 톱 깎 기: 랜덤 1인에게 1턴 뒤 40 피해, 이후 30/20 피해로 최대 2회 튕김',
      '5. 먹고 싶은거 있어?: 전원에게 20 피해, 자신에게 피격 무효 10회 버프',
      '특수 기믹: 닉네임이 호이인 파티원이 있으면 그 파티원의 피해가 1.5배로 적용되고, 클리어 시 파티 전체 전리품이 1.5배가 됩니다.'
    ],
    hardSkillsText: [
      '1. 아들자랑 MK.1: 모든 플레이어의 버프 제거. 제거된 버프 1개당 20 피해. 랜덤 2명에게 5턴 기본공격 불가',
      '2. ASS-HIT MK.3: 파티 전체에게 8 피해, 총 5회',
      '3. 손 톱 깎 기: 랜덤 1명에게 손톱 디버프. 1턴 뒤 20 피해, 이후 다른 대상에게 30, 40으로 튕김',
      '4. 먹고 싶은거 있어?: 파티 전체에게 10 피해 2회 + 자신에게 1회 피격 무효화 20스택',
      '5. 아들이랑 엮기 MK.2: 보스 버프 1개당 6,000 HP 회복. 버프가 없으면 80,000 보호막',
      '특수 기믹: 파티에 닉네임 호이 유저가 있으면 해당 유저 피해 1.5배, 클리어 시 파티 전체 보상 1.5배.'
    ],
    rewardsText: RAID_BOSS_REWARDS_TEXT
  },
  [RAID_BOSS_ID_OVERTIME_MANAGER]: {
    id: RAID_BOSS_ID_OVERTIME_MANAGER,
    name: '야근하다 미쳐버린 황과장',
    maxHp: 80000,
    maxHpByMode: {
      [RAID_MODE_NORMAL]: 80000,
      [RAID_MODE_HARD]: 250000
    },
    imageLabel: '황과장',
    portrait: 'assets/bosses/overtime_manager_hwang.png',
    patternOrder: ['inclusive_wage', 'rage_typing', 'no_dinner', 'caffeine_doping'],
    skillsText: [
      '패시브: 전투 시작 시 야근하다 미쳐버린 최주임, 야근하다 미쳐버린 정대리를 함께 생성합니다. 하수인이 살아있으면 도발로 공격을 대신 맞고 받는 피해가 35% 감소합니다.',
      '패시브: 하수인이 1명 쓰러질 때마다 황과장이 입히는 피해가 50% 증가합니다.',
      '하수인 행동: 플레이어 전원 행동 후 최주임, 정대리, 황과장 순서로 행동합니다. 하수인은 랜덤 대상에게 기본공격만 합니다.',
      '1. 포 괄 임 금: 자신은 잃은 HP의 50%만큼, 하수인은 최대 HP의 40%만큼 2턴 보호막을 얻습니다. 황과장의 보호막이 시간 만료로 사라지면 파티 전체에게 10 피해를 2회 줍니다.',
      '2. 분 노 의 타 이 핑: 랜덤 4인에게 10 피해, 랜덤 3인에게 20 피해, 랜덤 2인에게 30 피해를 차례대로 줍니다.',
      '3. 석 식 미 제 공: 자신과 하수인의 잃은 HP를 30% 회복하고, 파티 전체에게 10 피해를 2회 줍니다.',
      '4. 카 페 인 도 핑: 자신은 2턴 동안 받는 피해 40% 감소를 얻고, 파티 전원에게 2턴 동안 실드 삭제 및 획득 불가 디버프를 적용합니다.'
    ],
    rewardsText: RAID_BOSS_REWARDS_TEXT
  }
};

const ADVENTURE_EVENT_DEFINITIONS = [
  {
    id: 'supply_empty',
    location: '비품창고',
    actor: '아무도 없음',
    message: '비품창고를 발견했다! 하지만 아무도 없었고, 딱히 특별한건 없어보인다..',
    reward: { type: 'none' }
  },
  {
    id: 'supply_tuna',
    location: '비품창고',
    actor: '김 주임',
    message: '비품창고에서 김 주임이 몰래 숨겨둔 고양이 간식을 발견했다. "이건 길냥이들 챙기려고 둔 건데 하나는 가져가도 돼요."',
    reward: { type: 'item', itemId: 'cat_tuna_can', quantity: 1 }
  },
  {
    id: 'rooftop_confidence',
    location: '옥상',
    actor: '신 팀장님',
    message: '옥상에서 신 팀장님이 캔커피를 건네며 말했다. "오늘 페이스 괜찮은데? 자신감 있게 밀어!"',
    reward: { type: 'buff', buffId: 'confidence_buff' }
  },
  {
    id: 'parking_guard',
    location: '주차장',
    actor: '경비아저씨',
    message: '주차장에서 경비아저씨가 미소를 지으며 불렀다. "지난번 도와줘서 고마웠어요. 이건 소소한 간식값이오."',
    reward: { type: 'money', amount: 50000 }
  },
  {
    id: 'restroom_bujang',
    location: '화장실',
    actor: '최 부장님',
    message: '화장실 앞에서 최 부장님과 마주쳤다. "회의 자료 오타 봤나? 다시 뽑아와." 괜히 등줄기가 서늘해진다.',
    reward: { type: 'bundle', rewards: [{ type: 'stress', amount: 10 }, { type: 'money', amount: -50000 }] }
  },
  {
    id: 'other_team_hint',
    location: '다른 팀 사무실',
    actor: '김 주임',
    message: '다른 팀 사무실에서 김 주임이 작업 꿀팁을 슬쩍 알려줬다. 문서 정리 감각이 한층 좋아진 느낌이다.',
    reward: { type: 'exp_fraction', divisor: 3 }
  },
  {
    id: 'elevator_bonus',
    location: '엘레베이터',
    actor: '대표님',
    message: '엘레베이터에서 대표님과 단둘이 탔다. 오늘 보고가 마음에 들었는지 격려금 봉투를 쥐여 주셨다.',
    reward: { type: 'money', amount: 200000 }
  },
  {
    id: 'park_cat',
    location: '근처 공원',
    actor: '고양이',
    message: '근처 공원에서 낯익은 고양이가 발치에 몸을 비볐다. 참치캔을 줄까?',
    reward: { type: 'cat_choice' }
  },
  {
    id: 'store_cat',
    location: '근처 편의점',
    actor: '고양이',
    message: '근처 편의점 뒷골목에서 고양이가 야옹거리며 따라온다. 참치캔을 줄까?',
    reward: { type: 'cat_choice' }
  },
  {
    id: 'office_bacchus',
    location: '사무실',
    actor: '박 대리님',
    message: '사무실 자리로 돌아오니 박 대리님이 박카스를 책상에 툭 올려놨다. "오늘 표정이 죽었더라. 하나는 지금, 하나는 나중에."',
    reward: { type: 'item', itemId: 'bacchus', quantity: 2 }
  },
  {
    id: 'hallway_hot6',
    location: '복도',
    actor: '신 팀장님',
    message: '복도에서 신 팀장님이 자판기 앞에 서 있었다. "정신 차리라고 이거 마셔." 하고 핫식스를 건넸다.',
    reward: { type: 'item', itemId: 'hot6', quantity: 1 }
  },
  {
    id: 'rooftop_pigeon',
    location: '옥상',
    actor: '비둘기',
    message: '옥상에서 바람을 쐬는데 비둘기 떼가 어지럽게 날아갔다. 덕분에 머리가 조금 식었다.',
    reward: { type: 'stress', amount: -10 }
  },
  {
    id: 'park_breath',
    location: '근처 공원',
    actor: '아무도 없음',
    message: '근처 공원을 한 바퀴 천천히 돌았다. 큰 일은 없었지만 머릿속이 조금 정리됐다.',
    reward: { type: 'stress', amount: -5 }
  },
  {
    id: 'store_impulse',
    location: '근처 편의점',
    actor: '아무도 없음',
    message: '편의점 신상품 코너를 기웃거리다 정신 차려보니 계산대 앞이다. 쓸데없는 지출을 해버렸다.',
    reward: { type: 'money', amount: -100000 }
  },
  {
    id: 'office_bujang_half',
    location: '사무실',
    actor: '최 부장님',
    message: '최 부장님이 갑자기 불러 세우더니 자료를 절반이나 직접 수정하게 만들었다. 대신 손에 남는 건 확실히 있었다.',
    reward: { type: 'exp_fraction', divisor: 2 }
  },
  {
    id: 'elevator_rare_level',
    location: '엘레베이터',
    actor: '사장님',
    message: '엘레베이터 문이 닫히기 직전 사장님이 보고서를 훑어봤다. "자네, 승급감이네." 심장이 철렁 내려앉는다.',
    reward: { type: 'rare_level', chance: 0.08, fallback: { type: 'exp_fraction', divisor: 4 } }
  },
  {
    id: 'restroom_fatigue',
    location: '화장실',
    actor: '아무도 없음',
    message: '세면대 거울을 보니 생각보다 상태가 심각하다. 어깨가 무겁고 눈이 침침해진다.',
    reward: { type: 'buff', buffId: 'fatigue_debuff' }
  },
  {
    id: 'parking_accident',
    location: '주차장',
    actor: '사장님',
    message: '주차장에서 사장님 차 옆을 지나가다 커피를 흘렸다. 급히 세차값을 보태게 됐다.',
    reward: { type: 'money', amount: -150000 }
  },
  {
    id: 'hallway_bacchus',
    location: '복도',
    actor: '김 주임',
    message: '복도에서 김 주임이 서류철을 건네며 속삭였다. "오늘 버티려면 이 정도는 있어야죠."',
    reward: { type: 'item', itemId: 'bacchus', quantity: 1 }
  },
  {
    id: 'other_team_hot6',
    location: '다른 팀 사무실',
    actor: '박 대리님',
    message: '다른 팀 사무실에 심부름을 갔다가 박 대리님이 에너지 드링크를 두 병 챙겨줬다.',
    reward: { type: 'item', itemId: 'hot6', quantity: 2 }
  },
  {
    id: 'office_bonus_150',
    location: '사무실',
    actor: '대표님',
    message: '대표님이 지나가다 책상 위 메모를 보고 고개를 끄덕였다. 잠시 후 소액 포상금이 들어왔다.',
    reward: { type: 'money', amount: 150000 }
  },
  {
    id: 'corridor_stress_plus',
    location: '복도',
    actor: '최 부장님',
    message: '복도에서 붙잡혀 갑작스러운 업무 지시를 한가득 들었다. 기분이 훅 가라앉는다.',
    reward: { type: 'stress', amount: 20 }
  },
  {
    id: 'store_cash_100',
    location: '근처 편의점',
    actor: '경비아저씨',
    message: '편의점 앞에서 경비아저씨가 지난번 잔돈을 이제야 돌려줬다. 생각보다 두둑하다.',
    reward: { type: 'money', amount: 100000 }
  },
  {
    id: 'park_focus_quarter',
    location: '근처 공원',
    actor: '비둘기',
    message: '비둘기 떼를 피하며 멍하니 걷다 보니 묘하게 머리가 맑아졌다. 일 처리 감각이 돌아오는 느낌이다.',
    reward: { type: 'exp_fraction', divisor: 4 }
  },
  {
    id: 'restroom_relief',
    location: '화장실',
    actor: '신 팀장님',
    message: '화장실 앞에서 신 팀장님이 "힘들지? 너무 몰아붙이지 마." 하고 조용히 다독여 줬다.',
    reward: { type: 'stress', amount: -15 }
  },
  {
    id: 'office_cash_loss',
    location: '사무실',
    actor: '아무도 없음',
    message: '급하게 간식값 정산을 하다 보니 생각보다 많이 빠져나갔다.',
    reward: { type: 'money', amount: -50000 }
  },
  {
    id: 'rooftop_nothing',
    location: '옥상',
    actor: '아무도 없음',
    message: '옥상 문을 열고 나갔지만 아무도 없었다. 바람만 조금 세다.',
    reward: { type: 'none' }
  },
  {
    id: 'parking_stress_plus',
    location: '주차장',
    actor: '대표님',
    message: '주차장에서 대표님에게 붙잡혀 갑작스러운 질의를 받았다. 식은땀이 흐른다.',
    reward: { type: 'stress', amount: 5 }
  },
  {
    id: 'supply_empty_note',
    location: '비품창고',
    actor: '아무도 없음',
    message: '비품창고 깊숙한 곳에서 오래된 메모를 발견했다. 실속은 없지만 괜히 분위기만 으스스하다.',
    reward: { type: 'none' }
  },
  {
    id: 'supply_kim_cash',
    location: '비품창고',
    actor: '김 주임',
    message: '김 주임이 비품 정리를 하다 남는 간식 예산이 있다며 슬쩍 용돈을 쥐여줬다.',
    reward: { type: 'money', amount: 50000 }
  },
  {
    id: 'supply_kim_tuna_bonus',
    location: '비품창고',
    actor: '김 주임',
    message: '김 주임이 박스를 정리하다 말고 작은 캔 하나를 건넸다. "밖에 애들 주려고 챙겨둔 건데, 하나 더 가져가도 돼요."',
    reward: { type: 'item', itemId: 'cat_tuna_can', quantity: 1 }
  },
  {
    id: 'supply_kim_exp',
    location: '비품창고',
    actor: '김 주임',
    message: '김 주임이 재고 정리 요령을 알려줬다. 의외로 업무 동선이 한 번에 머릿속에 들어온다.',
    reward: { type: 'exp_fraction', divisor: 4 }
  },
  {
    id: 'rooftop_teamlead_stress',
    location: '옥상',
    actor: '신 팀장님',
    message: '옥상에서 신 팀장님이 "숨 한번 크게 쉬고 들어가." 하고 등을 툭 쳐줬다.',
    reward: { type: 'stress', amount: -10 }
  },
  {
    id: 'rooftop_teamlead_hot6',
    location: '옥상',
    actor: '신 팀장님',
    message: '옥상 난간에 기대 있던 신 팀장님이 자판기에서 뽑은 핫식스를 건넸다. "눈빛이 풀렸어."',
    reward: { type: 'item', itemId: 'hot6', quantity: 1 }
  },
  {
    id: 'parking_guard_bacchus',
    location: '주차장',
    actor: '경비아저씨',
    message: '경비아저씨가 "오늘은 얼굴이 많이 안 좋네." 하며 박카스를 건네줬다.',
    reward: { type: 'item', itemId: 'bacchus', quantity: 1 }
  },
  {
    id: 'parking_guard_relief',
    location: '주차장',
    actor: '경비아저씨',
    message: '주차장 바람을 맞으며 경비아저씨와 잠깐 수다를 떨었다. 묘하게 마음이 가벼워진다.',
    reward: { type: 'stress', amount: -5 }
  },
  {
    id: 'restroom_bujang_loss_big',
    location: '화장실',
    actor: '최 부장님',
    message: '최 부장님이 세면대 앞에서 오늘 실수를 길게 짚었다. 점심값도 아까울 만큼 기운이 빠진다.',
    reward: { type: 'bundle', rewards: [{ type: 'stress', amount: 20 }, { type: 'money', amount: -100000 }] }
  },
  {
    id: 'restroom_bujang_exp',
    location: '화장실',
    actor: '최 부장님',
    message: '최 부장님이 잔소리 끝에 핵심 포인트 하나를 던졌다. 얄밉지만 확실히 도움이 된다.',
    reward: { type: 'exp_fraction', divisor: 4 }
  },
  {
    id: 'other_team_kim_bacchus',
    location: '다른 팀 사무실',
    actor: '김 주임',
    message: '김 주임이 다른 팀 사무실 한켠에서 몰래 박카스를 건네며 "들키지 말고 버텨요." 하고 웃었다.',
    reward: { type: 'item', itemId: 'bacchus', quantity: 1 }
  },
  {
    id: 'other_team_kim_confidence',
    location: '다른 팀 사무실',
    actor: '김 주임',
    message: '김 주임이 "그 정도면 충분히 잘하고 있어요."라고 말해줬다. 괜히 손끝에 힘이 돌아온다.',
    reward: { type: 'buff', buffId: 'confidence_buff' }
  },
  {
    id: 'elevator_ceo_cash_100',
    location: '엘레베이터',
    actor: '대표님',
    message: '엘레베이터 문이 닫히기 직전 대표님이 어제 아이디어 괜찮았다고 짧게 칭찬했다. 얼마 뒤 소정의 격려금이 찍혔다.',
    reward: { type: 'money', amount: 100000 }
  },
  {
    id: 'elevator_ceo_half',
    location: '엘레베이터',
    actor: '대표님',
    message: '대표님이 짧은 질문 하나를 던졌고, 대답을 마치자 머릿속이 번쩍 열렸다.',
    reward: { type: 'exp_fraction', divisor: 2 }
  },
  {
    id: 'park_cat_variant',
    location: '근처 공원',
    actor: '고양이',
    message: '벤치 밑에 있던 고양이가 조심스럽게 다가와 앞발로 신발끈을 건드렸다. 참치캔을 줄까?',
    reward: { type: 'cat_choice' }
  },
  {
    id: 'store_cat_variant',
    location: '근처 편의점',
    actor: '고양이',
    message: '편의점 냉장고 소리 사이로 야옹 소리가 들렸다. 작은 고양이가 당신만 바라보고 있다. 참치캔을 줄까?',
    reward: { type: 'cat_choice' }
  },
  {
    id: 'park_pigeon_cash_loss',
    location: '근처 공원',
    actor: '비둘기',
    message: '비둘기를 피하다가 들고 있던 동전지갑을 떨어뜨렸다. 주워보니 몇 장이 사라졌다.',
    reward: { type: 'money', amount: -50000 }
  },
  {
    id: 'park_pigeon_relief',
    location: '근처 공원',
    actor: '비둘기',
    message: '비둘기들이 한꺼번에 날아오르는 걸 보며 멍하니 서 있었다. 이상하게 답답함이 조금 풀린다.',
    reward: { type: 'stress', amount: -10 }
  },
  {
    id: 'store_guard_hot6',
    location: '근처 편의점',
    actor: '경비아저씨',
    message: '편의점 앞에서 마주친 경비아저씨가 "이 시간엔 당 떨어져." 하며 핫식스를 손에 쥐여줬다.',
    reward: { type: 'item', itemId: 'hot6', quantity: 1 }
  },
  {
    id: 'store_guard_tuna',
    location: '근처 편의점',
    actor: '경비아저씨',
    message: '경비아저씨가 편의점 봉투를 뒤적이다가 작은 참치캔을 꺼냈다. "길고양이 챙기려던 건데 자네가 더 잘 쓰겠구만."',
    reward: { type: 'item', itemId: 'cat_tuna_can', quantity: 1 }
  },
  {
    id: 'store_guard_cash_50',
    location: '근처 편의점',
    actor: '경비아저씨',
    message: '경비아저씨가 부탁했던 심부름값을 깜빡했다며 지금이라도 챙겨줬다.',
    reward: { type: 'money', amount: 50000 }
  },
  {
    id: 'hallway_manager_exp',
    location: '복도',
    actor: '신 팀장님',
    message: '복도에서 신 팀장님이 보고서 핵심 문장을 딱 한 줄로 정리해줬다. 머리가 환하게 트인다.',
    reward: { type: 'exp_fraction', divisor: 3 }
  },
  {
    id: 'hallway_manager_stress_down',
    location: '복도',
    actor: '신 팀장님',
    message: '신 팀장님이 말없이 엄지를 들어 보였다. 별 것 아닌데도 긴장이 조금 풀린다.',
    reward: { type: 'stress', amount: -5 }
  },
  {
    id: 'hallway_bujang_cash_loss',
    location: '복도',
    actor: '최 부장님',
    message: '복도에서 최 부장님에게 붙잡혀 급한 외주 처리 비용을 떠안게 됐다.',
    reward: { type: 'money', amount: -150000 }
  },
  {
    id: 'hallway_kim_tuna',
    location: '복도',
    actor: '김 주임',
    message: '김 주임이 복도 끝에서 몰래 손짓했다. "밖에서 애들 챙기실 거면 이거 가져가요."',
    reward: { type: 'item', itemId: 'cat_tuna_can', quantity: 1 }
  },
  {
    id: 'office_park_bacchus',
    location: '사무실',
    actor: '박 대리님',
    message: '박 대리님이 모니터를 힐끗 보더니 "이 타이밍엔 각성제보다 박카스가 낫지." 하고 한 병을 더 놔줬다.',
    reward: { type: 'item', itemId: 'bacchus', quantity: 1 }
  },
  {
    id: 'office_park_tuna',
    location: '사무실',
    actor: '박 대리님',
    message: '박 대리님이 서랍 깊은 곳에서 작은 참치캔을 꺼냈다. "지난번에 고양이 좋아하던데, 이거 하나 가져가."',
    reward: { type: 'item', itemId: 'cat_tuna_can', quantity: 1 }
  },
  {
    id: 'office_park_exp',
    location: '사무실',
    actor: '박 대리님',
    message: '박 대리님이 엑셀 단축키 하나를 알려줬다. 당장 체감될 정도로 손이 빨라진다.',
    reward: { type: 'exp_fraction', divisor: 4 }
  },
  {
    id: 'office_ceo_rare',
    location: '사무실',
    actor: '대표님',
    message: '대표님이 잠깐 멈춰 서서 당신의 화면을 본 뒤 조용히 미소를 지었다. 왠지 큰일이 일어날 것 같은 분위기다.',
    reward: { type: 'rare_level', chance: 0.06, fallback: { type: 'money', amount: 100000 } }
  },
  {
    id: 'office_empty_stress_down',
    location: '사무실',
    actor: '아무도 없음',
    message: '아무도 없는 짧은 순간, 의자에 기대 숨을 골랐다. 그 몇 초가 의외로 컸다.',
    reward: { type: 'stress', amount: -5 }
  },
  {
    id: 'office_empty_confidence',
    location: '사무실',
    actor: '아무도 없음',
    message: '지나간 메일들을 훑다가 예전에 칭찬받았던 내용을 발견했다. 괜히 마음이 단단해진다.',
    reward: { type: 'buff', buffId: 'confidence_buff' }
  },
  {
    id: 'rooftop_pigeon_hot6',
    location: '옥상',
    actor: '비둘기',
    message: '비둘기 떼를 피하다 보니 구석에 누가 두고 간 핫식스가 굴러다니고 있었다. 아직 멀쩡해 보인다.',
    reward: { type: 'item', itemId: 'hot6', quantity: 1 }
  },
  {
    id: 'parking_ceo_cash_150',
    location: '주차장',
    actor: '대표님',
    message: '주차장으로 급히 뛰어가던 대표님이 서류 전달을 부탁했고, 끝나자 고생비를 챙겨줬다.',
    reward: { type: 'money', amount: 150000 }
  },
  {
    id: 'restroom_manager_bacchus',
    location: '화장실',
    actor: '신 팀장님',
    message: '화장실 앞 자판기에서 신 팀장님이 박카스를 뽑아 건넸다. "오늘은 진짜 이거 필요해 보여."',
    reward: { type: 'item', itemId: 'bacchus', quantity: 1 }
  },
  {
    id: 'other_team_park_cash',
    location: '다른 팀 사무실',
    actor: '박 대리님',
    message: '박 대리님이 서류 전달 심부름값이라며 지갑에서 현금을 꺼내 손에 쥐여줬다.',
    reward: { type: 'money', amount: 50000 }
  },
  {
    id: 'supply_empty_dust',
    location: '비품창고',
    actor: '아무도 없음',
    message: '비품창고 구석을 뒤지다 먼지만 한가득 뒤집어썼다. 코끝이 간질거리고 짜증이 밀려온다.',
    reward: { type: 'stress', amount: 5 }
  },
  {
    id: 'supply_bujang_scold',
    location: '비품창고',
    actor: '최 부장님',
    message: '비품창고에서 최 부장님과 눈이 마주쳤다. "딴짓하지 말고 필요한 것만 챙겨!" 한마디에 어깨가 움츠러든다.',
    reward: { type: 'stress', amount: 10 }
  },
  {
    id: 'rooftop_ceo_cold',
    location: '옥상',
    actor: '대표님',
    message: '옥상 문을 열자 대표님이 통화 중이었다. 눈빛만으로도 왜 올라왔냐는 압박이 느껴진다.',
    reward: { type: 'stress', amount: 10 }
  },
  {
    id: 'rooftop_pigeon_mess',
    location: '옥상',
    actor: '비둘기',
    message: '비둘기를 피해 몸을 숙였지만 결국 셔츠에 얼룩이 묻었다. 세탁비가 머리를 스친다.',
    reward: { type: 'money', amount: -50000 }
  },
  {
    id: 'parking_manager_urgent',
    location: '주차장',
    actor: '신 팀장님',
    message: '주차장에서 신 팀장님에게 붙잡혀 급한 심부름을 떠안았다. 엘리베이터로 돌아가는 발걸음이 무겁다.',
    reward: { type: 'stress', amount: 5 }
  },
  {
    id: 'parking_president_repair',
    location: '주차장',
    actor: '사장님',
    message: '사장님 차 근처에서 커피를 쏟아 닦느라 진땀을 뺐다. 결국 소소한 수리비 명목으로 돈이 빠져나갔다.',
    reward: { type: 'money', amount: -100000 }
  },
  {
    id: 'restroom_fatigue_variant',
    location: '화장실',
    actor: '아무도 없음',
    message: '거울 속 얼굴이 유난히 창백해 보인다. 잠깐 쉬려 했는데 오히려 더 피곤함만 자각하게 됐다.',
    reward: { type: 'buff', buffId: 'fatigue_debuff' }
  },
  {
    id: 'restroom_kim_badnews',
    location: '화장실',
    actor: '김 주임',
    message: '김 주임이 지나가며 수정 요청 메일이 또 왔다고 귀띔했다. 머리가 지끈거린다.',
    reward: { type: 'stress', amount: 10 }
  },
  {
    id: 'other_team_bujang_rework',
    location: '다른 팀 사무실',
    actor: '최 부장님',
    message: '다른 팀 사무실 앞에서 최 부장님이 붙잡더니 방금 올린 문서를 통째로 다시 보라 했다.',
    reward: { type: 'stress', amount: 20 }
  },
  {
    id: 'other_team_empty_loss',
    location: '다른 팀 사무실',
    actor: '아무도 없음',
    message: '전달하러 온 자료를 잘못 가져와 헛걸음만 했다. 복사비와 시간만 날아간 느낌이다.',
    reward: { type: 'money', amount: -50000 }
  },
  {
    id: 'elevator_bujang_pressure',
    location: '엘레베이터',
    actor: '최 부장님',
    message: '엘리베이터 안 정적 속에서 최 부장님의 한숨 소리만 들렸다. 이유는 몰라도 괜히 압박감이 커진다.',
    reward: { type: 'stress', amount: 5 }
  },
  {
    id: 'store_empty_impulse_variant',
    location: '근처 편의점',
    actor: '아무도 없음',
    message: '편의점 할인 문구에 홀려 필요도 없는 걸 집었다. 계산하고 나오니 허탈함만 남는다.',
    reward: { type: 'money', amount: -50000 }
  },
  {
    id: 'hallway_president_call',
    location: '복도',
    actor: '사장님',
    message: '복도에서 사장님에게 불려 즉석 보고를 했다. 말은 끝났는데 진이 다 빠졌다.',
    reward: { type: 'stress', amount: 10 }
  },
  {
    id: 'office_empty_spill',
    location: '사무실',
    actor: '아무도 없음',
    message: '책상 위 컵을 잘못 건드려 메모지를 버렸다. 다시 출력할 생각을 하니 한숨이 나온다.',
    reward: { type: 'money', amount: -50000 }
  }
  ,
  {
    id: 'hallway_business_card',
    location: '복도',
    actor: '김 주임',
    message: '복도에서 김 주임이 거래처 홍보용 명함 뭉치를 하나 건네줬다. "이거 남는 거니까 챙겨요."',
    reward: { type: 'item', itemId: 'business_card', quantity: 1 }
  },
  {
    id: 'office_business_card',
    location: '사무실',
    actor: '박 대리님',
    message: '박 대리님이 명함 정리함을 털어보다가 멀쩡한 여분 명함을 몇 장 챙겨줬다.',
    reward: { type: 'item', itemId: 'business_card', quantity: 2 }
  },
  {
    id: 'elevator_business_card',
    location: '엘레베이터',
    actor: '대표님',
    message: '엘레베이터 앞에서 대표님이 행사 홍보용 명함을 정리하다가 한 줌을 쥐여줬다.',
    reward: { type: 'item', itemId: 'business_card', quantity: 1 }
  },
  {
    id: 'park_business_card',
    location: '근처 공원',
    actor: '아무도 없음',
    message: '벤치 밑에 떨어진 행사 명함 봉투를 발견했다. 아직 쓸 만한 카드가 남아 있다.',
    reward: { type: 'item', itemId: 'business_card', quantity: 2 }
  },
  {
    id: 'store_business_card',
    location: '근처 편의점',
    actor: '경비아저씨',
    message: '경비아저씨가 근처 행사에서 남은 명함을 모아뒀다가 슬쩍 건네줬다.',
    reward: { type: 'item', itemId: 'business_card', quantity: 1 }
  },
  {
    id: 'supply_business_card',
    location: '비품창고',
    actor: '아무도 없음',
    message: '비품창고 구석 박스 안에서 쓰지 않은 명함 꾸러미를 발견했다.',
    reward: { type: 'item', itemId: 'business_card', quantity: 2 }
  },
  {
    id: 'other_team_business_card',
    location: '다른 팀 사무실',
    actor: '신 팀장님',
    message: '다른 팀 사무실에서 행사 준비 중이던 신 팀장님이 여유 명함을 챙겨줬다.',
    reward: { type: 'item', itemId: 'business_card', quantity: 1 }
  },
  {
    id: 'rooftop_business_card',
    location: '옥상',
    actor: '비둘기',
    message: '옥상 난간에 흩날리던 행사 명함 몇 장을 주워 담았다. 이상하게 멀쩡하다.',
    reward: { type: 'item', itemId: 'business_card', quantity: 2 }
  }
];

const ADVENTURE_SCROLL_EVENT_DEFINITIONS = [
  {
    id: 'scroll_copier_card_005',
    location: '복도',
    actor: '박 대리님',
    message: '복도 복합기 밑에서 반짝이는 주문서를 발견했다. 박 대리님은 "그거 프린터 토너 부적 같은데?"라며 손사래를 쳤다.',
    reward: { type: 'item', itemId: 'scroll_card_005', quantity: 1 }
  },
  {
    id: 'scroll_archive_card_01',
    location: '비품창고',
    actor: '경비아저씨',
    message: '비품창고 낡은 바인더 사이에서 카드 효과 주문서가 떨어졌다. 경비아저씨가 "이런 건 주운 사람이 임자지."라고 말했다.',
    reward: { type: 'item', itemId: 'scroll_card_01', quantity: 1 }
  },
  {
    id: 'scroll_rooftop_card_025',
    location: '옥상',
    actor: '비둘기',
    message: '옥상 난간에 앉아 있던 비둘기가 빛나는 종이를 물고 도망치다 떨어뜨렸다. 꽤 강한 카드 효과 주문서 같다.',
    reward: { type: 'item', itemId: 'scroll_card_025', quantity: 1 }
  },
  {
    id: 'scroll_parking_attack_01',
    location: '주차장',
    actor: '김 주임',
    message: '주차장 구석에서 김 주임이 몰래 숨겨둔 운동 루틴 메모를 발견했다. 이상하게 기본 공격력 주문서로 쓸 수 있다.',
    reward: { type: 'item', itemId: 'scroll_attack_01', quantity: 1 }
  },
  {
    id: 'scroll_park_attack_02',
    location: '근처 공원',
    actor: '고양이',
    message: '근처 공원 벤치 아래에서 고양이가 발로 툭툭 치던 주문서를 건네줬다. 고양이도 성장의 맛을 아는 모양이다.',
    reward: { type: 'item', itemId: 'scroll_attack_02', quantity: 1 }
  },
  {
    id: 'scroll_convenience_attack_05',
    location: '근처 편의점',
    actor: '대표님',
    message: '편의점 영수증 뒤에 기묘한 주문식이 적혀 있었다. 대표님은 "그런 건 경비 처리 안 돼요."라고만 했다.',
    reward: { type: 'item', itemId: 'scroll_attack_05', quantity: 1 }
  }
];

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
  })),
  packages: Object.values(SUPPORT_PACKAGE_DATA).map((pkg) => ({
    id: pkg.id,
    name: `${pkg.name} (${pkg.price.toLocaleString()}원)`,
    rewardsText: pkg.rewards.map((reward) => `${ITEM_DATA[reward.itemId]?.name || reward.itemId} ${reward.quantity}개`).join(', ')
  })),
  titles: Object.entries(TITLE_DATA)
    .filter(([, title]) => title.adminOnly)
    .map(([id, title]) => ({
      id,
      name: title.name,
      desc: title.baseDesc
  }))
};

let activeShouts = [];
function createRaidRoomState() {
  return {
    slots: Array(RAID_PARTY_SIZE).fill(null),
    slotQueuedAt: Array(RAID_PARTY_SIZE).fill(null),
    queuedBossId: null,
    countdown: null,
    activeBattle: null,
    viewers: {}
  };
}

let raidState = {
  version: RAID_POLL_VERSION_EMPTY,
  modes: {
    [RAID_MODE_NORMAL]: createRaidRoomState(),
    [RAID_MODE_HARD]: createRaidRoomState(),
    [RAID_MODE_CHAOS]: createRaidRoomState()
  },
  manualBossOverrideDayKey: null,
  manualBossOverrideId: null,
  nextDayForcedBossDayKey: null,
  nextDayForcedBossId: null
};

function createPvpModeState() {
  return {
    queue: [],
    match: null,
    battle: null,
    viewers: {}
  };
}

let pvpState = {
  version: PVP_POLL_VERSION_EMPTY,
  modes: {
    [PVP_MODE_RANKED]: createPvpModeState(),
    [PVP_MODE_NORMAL]: createPvpModeState(),
    [PVP_MODE_PRACTICE]: createPvpModeState()
  }
};
let pvpAdvanceQueue = Promise.resolve();
let infiniteOvertimeState = {
  version: 0,
  battles: {},
  attackDrafts: {}
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
app.use((req, res, next) => {
  if (
    IS_V2_MODE
    && req.path.startsWith('/api/')
    && req.path !== '/api/health'
    && !req.path.startsWith('/api/v2/')
  ) {
    return res.status(410).json({
      msg: '호이상사 V1 서비스가 종료되었습니다. V2에서 다시 이용해주세요.',
      code: 'V1_SERVICE_CLOSED'
    });
  }
  return next();
});
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  const startedAt = Date.now();
  res.on('finish', () => {
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= 1500) {
      console.warn(`[slow-api] ${req.method} ${req.path} ${res.statusCode} ${elapsedMs}ms`);
    }
  });
  return next();
});
app.get('/', (req, res) => {
  if (IS_V2_MODE) return res.redirect(302, '/v2/');
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index.html', (req, res, next) => {
  if (IS_V2_MODE) return res.redirect(302, '/v2/');
  return next();
});

app.get(['/v2', '/v2/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'v2', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public'), { index: false }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'server is running', appMode: APP_MODE });
});

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log(`MongoDB connected (APP_MODE=${APP_MODE})`);
    if (IS_V2_MODE) {
      console.log('V2 cutover mode enabled: V1 APIs and V1 weekly jobs are disabled.');
      return;
    }
    processWeeklyPvpSeasonIfNeeded(new Date(), { force: true }).catch((err) => {
      console.error('Initial weekly PVP season check error:', err);
    });
    setInterval(() => {
      processWeeklyPvpSeasonIfNeeded(new Date(), { force: true }).catch((err) => {
        console.error('Weekly PVP season interval error:', err);
      });
    }, PVP_WEEKLY_SEASON_CHECK_INTERVAL_MS);
  })
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
  cards: [{
    cardId: { type: String, required: true },
    quantity: { type: Number, default: 1 }
  }],
  enhancedCards: [{
    cardId: { type: String, required: true },
    level: { type: Number, default: 1 },
    quantity: { type: Number, default: 1 }
  }],
  lockedCards: [{
    cardId: { type: String, required: true },
    level: { type: Number, default: 0 }
  }],
  equipments: [{
    equipmentId: { type: String, required: true },
    equipmentType: { type: String, required: true },
    statValue: { type: Number, required: true },
    upgradesLeft: { type: Number, default: 7 }
  }],
  equippedEquipment: {
    cardEffect: { type: String, default: null },
    basicAttack: { type: String, default: null }
  },
  equippedCardId: { type: String, default: null },
  equippedCardLevel: { type: Number, default: 0 },
  raidExtraCardSelection: {
    cardId: { type: String, default: null },
    level: { type: Number, default: 0 }
  },
  pvpStats: {
    rating: { type: Number, default: 1000 },
    played: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    lastWeeklyRewardWeekKey: { type: String, default: '' }
  },
  infiniteOvertime: {
    defensePreset: [{
      cardId: { type: String, required: true },
      enhancementLevel: { type: Number, default: 0 }
    }],
    defenseScore: { type: Number, default: 0 },
    attackDeck: [{
      cardId: { type: String, required: true },
      enhancementLevel: { type: Number, default: 0 }
    }],
    active: { type: Boolean, default: false },
    nextFloor: { type: Number, default: 1 },
    lastAttemptAt: { type: Date, default: null },
    lastCompletedAt: { type: Date, default: null }
  },
  branchOffice: {
    isFounded: { type: Boolean, default: false },
    companyName: { type: String, default: '' },
    foundedAt: { type: Date, default: null },
    companyValue: { type: Number, default: 0 },
    employees: [{
      employeeId: { type: String, required: true },
      name: { type: String, required: true },
      role: { type: String, default: '사원' },
      grade: { type: String, default: 'C' },
      excavationPower: { type: Number, default: 0 },
      dailySalary: { type: Number, default: 0 },
      salaryEfficiency: { type: Number, default: 1 },
      contractPercent: { type: Number, default: 0 },
      hiredAt: { type: Date, default: Date.now }
    }],
    storageSlots: { type: Number, default: 10 },
    items: [{
      instanceId: { type: String, required: true },
      itemId: { type: String, required: true },
      acquiredAt: { type: Date, default: Date.now }
    }],
    pendingExcavation: {
      startedAt: { type: Date, default: null },
      completesAt: { type: Date, default: null },
      cost: { type: Number, default: 0 },
      successChance: { type: Number, default: 0 },
      rareItemBonusChance: { type: Number, default: 0 }
    },
    autoExcavationEnabled: { type: Boolean, default: false },
    excavationBrokenUntil: { type: Date, default: null },
    itemCodex: { type: [String], default: [] },
    employeeCodex: { type: [String], default: [] },
    excavationRewardLog: [{
      itemId: { type: String, default: '' },
      name: { type: String, default: '' },
      quantity: { type: Number, default: 0 },
      acquiredAt: { type: Date, default: Date.now }
    }],
    lastSettlementDayKey: { type: String, default: '' },
    missedMaintenanceDays: { type: Number, default: 0 },
    lastTaxAt: { type: Date, default: null },
    lastLog: { type: String, default: '' }
  },
  buffs: [{
    buffId: { type: String, required: true },
    expiresAt: { type: Date, required: true }
  }],
  titles: {
    unlocked: { type: [String], default: [] },
    equipped: { type: String, default: null }
  },
  emblems: {
    unlocked: { type: [String], default: [] },
    equipped: { type: String, default: null }
  },
  pendingStockInvestment: {
    amount: { type: Number, default: 0 },
    investedOn: { type: String, default: null }
  },
  stockPortfolio: [{
    companyId: { type: String, required: true },
    companyName: { type: String, default: '' },
    shares: { type: Number, default: 0 },
    averagePrice: { type: Number, default: 0 },
    investedAmount: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
  }],
  stockTournament: {
    eventId: { type: String, default: null },
    registeredAt: { type: Date, default: null },
    cash: { type: Number, default: STOCK_TOURNAMENT_INITIAL_CASH },
    holdings: [{
      companyId: { type: String, required: true },
      companyName: { type: String, default: '' },
      shares: { type: Number, default: 0 },
      averagePrice: { type: Number, default: 0 },
      investedAmount: { type: Number, default: 0 },
      updatedAt: { type: Date, default: Date.now }
    }],
    advancedInfoUsed: { type: Number, default: 0 },
    advancedInfos: [{
      companyId: { type: String, default: '' },
      companyName: { type: String, default: '' },
      text: { type: String, default: '' },
      createdAt: { type: Date, default: Date.now },
      expiresAt: { type: Date, default: null }
    }],
    finalizedAt: { type: Date, default: null },
    finalAssets: { type: Number, default: 0 },
    finalReturnPct: { type: Number, default: 0 }
  },
  shopState: {
    dayKey: { type: String, default: null },
    dailySpend: { type: Number, default: 0 },
    dailyBusinessCardPurchases: { type: Number, default: 0 },
    dailyBacchusPurchases: { type: Number, default: 0 },
    dailyHot6Purchases: { type: Number, default: 0 },
    dailyFragmentRaidTicketPurchases: { type: Number, default: 0 },
    dailyFragmentBusinessCardPurchases: { type: Number, default: 0 },
    weeklyFragmentExpPotionWeekKey: { type: String, default: '' },
    weeklyFragmentExpPotionPurchases: { type: Number, default: 0 },
    dailyFragmentCatButlerEmblemPurchases: { type: Number, default: 0 },
    dailyFragmentTigerEmblemPurchases: { type: Number, default: 0 },
    dailyFragmentIdolEmblemPurchases: { type: Number, default: 0 },
    dailyFragmentBitchNotEmblemPurchases: { type: Number, default: 0 },
    dailyFragmentRuinedBearEmblemPurchases: { type: Number, default: 0 },
    lastShoppingAddictQualifiedDayKey: { type: String, default: null }
  },
  meta: {
    loginCount: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: null },
    lastShoutAt: { type: Date, default: null },
    shoutNoCooldownUntil: { type: Date, default: null },
    lastRaidDayKey: { type: String, default: null },
    raidEntryDayKey: { type: String, default: null },
    raidEntryUsedCount: { type: Number, default: 0 },
    raidEntryBonusCount: { type: Number, default: 0 },
    dailyAugmentRaidFreeEntryDayKey: { type: String, default: '' },
    dailyAugmentRaidFreeEntryUsedCount: { type: Number, default: 0 },
    dailyAugmentRaidRewardOnceDayKey: { type: String, default: '' },
    dailyAugmentShopDiscountDayKey: { type: String, default: '' },
    dailyAugmentHourlyStaminaDayKey: { type: String, default: '' },
    dailyAugmentHourlyStaminaGrantedCount: { type: Number, default: 0 },
    dailyAugmentHourlyStaminaLastAt: { type: Date, default: null },
    lastRaidEntryConsumeType: { type: String, default: '' },
    dailyAugmentVersion: { type: String, default: '' },
    catFoodGivenCount: { type: Number, default: 0 },
    lastTitleChangeDayKey: { type: String, default: null },
    lastWorkOptimizationAt: { type: Date, default: null },
    workOptimizationSkillNotified: { type: Boolean, default: false },
    newsTypingAntiCheat: {
      lastSubmittedAt: { type: Date, default: null },
      intervalsMs: { type: [Number], default: [] },
      speedSamples: { type: [Number], default: [] },
      suspiciousScore: { type: Number, default: 0 },
      penaltyUntil: { type: Date, default: null },
      lastIp: { type: String, default: '' }
    },
    workClickAntiCheat: {
      lastSubmittedAt: { type: Date, default: null },
      intervalsMs: { type: [Number], default: [] },
      suspiciousScore: { type: Number, default: 0 },
      penaltyUntil: { type: Date, default: null },
      lastIp: { type: String, default: '' }
    },
    lastAdventureAt: { type: Date, default: null },
    lastAdventureLog: { type: String, default: '' },
    potatoRehabDamage: { type: Number, default: POTATO_REHAB_BASE_DAMAGE },
    potatoRehabKillCount: { type: Number, default: 0 },
    dailyAugmentDayKey: { type: String, default: '' },
    dailyAugmentTier: { type: String, default: '' },
    dailyAugmentSeedKey: { type: String, default: '' },
    dailyAugmentResetSeed: { type: String, default: '' },
    dailyAugmentResetDayKey: { type: String, default: '' },
    dailyAugmentOptions: { type: [String], default: [] },
    dailyAugmentSelectedId: { type: String, default: '' },
    dailyAugmentRerolledSlots: { type: [Number], default: [] }
  },
  pendingAdventure: {
    eventId: { type: String, default: null },
    location: { type: String, default: null },
    actor: { type: String, default: null },
    message: { type: String, default: null },
    createdAt: { type: Date, default: null }
  },
  pendingNotifications: [{
    type: { type: String, default: 'info' },
    text: { type: String, required: true }
  }]
});

userSchema.index({ 'gameState.level': -1, 'gameState.exp': -1 });
userSchema.index({ 'pvpStats.played': -1, 'pvpStats.rating': -1, 'pvpStats.wins': -1, 'pvpStats.losses': 1 });
userSchema.index({ 'branchOffice.isFounded': 1, 'branchOffice.companyValue': -1 });
userSchema.index({ 'meta.lastSeenAt': -1 });


const User = mongoose.model('User', userSchema);

const marketplaceListingSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sellerName: { type: String, default: '' },
  itemType: { type: String, enum: ['equipment', 'scroll', 'item'], required: true },
  itemId: { type: String, required: true },
  itemName: { type: String, required: true },
  description: { type: String, default: '' },
  quantity: { type: Number, default: 1 },
  equipmentSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  price: { type: Number, required: true },
  status: { type: String, enum: ['active', 'sold', 'settling', 'settled', 'cancelled', 'expired'], default: 'active' },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  buyerName: { type: String, default: '' },
  settlementToken: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  soldAt: { type: Date, default: null },
  settledAt: { type: Date, default: null },
  expiredAt: { type: Date, default: null }
});

marketplaceListingSchema.index({ status: 1, itemType: 1, createdAt: -1 });
marketplaceListingSchema.index({ sellerId: 1, status: 1, createdAt: -1 });

const MarketplaceListing = mongoose.model('MarketplaceListing', marketplaceListingSchema);

const gameSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now }
});

const GameSetting = mongoose.model('GameSetting', gameSettingSchema);

const adminMailSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  giftType: { type: String, enum: ['item', 'buff', 'package', 'title', 'fragment', 'raidReward', 'message'], required: true },
  giftId: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['pending', 'claiming', 'claimed', 'expired'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  claimedAt: { type: Date, default: null }
});

adminMailSchema.index({ recipientId: 1, status: 1, createdAt: -1 });
adminMailSchema.index({ expiresAt: 1, status: 1 });

const AdminMail = mongoose.model('AdminMail', adminMailSchema);

function getCompanyStockDisplayName(user) {
  const branchName = String(user?.branchOffice?.companyName || '').trim();
  if (branchName) return branchName;
  return String(user?.nickname || user?.username || '이름 없는 회사').trim();
}

function rollCompanyStockInitialPrice() {
  const buckets = [
    { min: 10000, max: 90000, weight: 35 },
    { min: 100000, max: 900000, weight: 35 },
    { min: 1000000, max: 9000000, weight: 20 },
    { min: 10000000, max: 90000000, weight: 10 }
  ];
  const totalWeight = buckets.reduce((sum, bucket) => sum + bucket.weight, 0);
  let roll = Math.random() * totalWeight;
  const bucket = buckets.find((entry) => {
    roll -= entry.weight;
    return roll <= 0;
  }) || buckets[0];
  return Math.max(100, Math.round(bucket.min + Math.random() * (bucket.max - bucket.min)));
}

function rollCompanyStockChangePct() {
  const magnitude = Math.pow(Math.random(), 2.35) * 10;
  const sign = Math.random() < 0.5 ? -1 : 1;
  return Number((sign * magnitude).toFixed(2));
}

const COMPANY_STOCK_RUMOR_BANK = {
  up: {
    small: [
      '작은 계약 소식이 흘러나옵니다. 살짝 오를 수 있다는 말이 돕니다.',
      '사내 분위기가 조용히 좋아졌다는 이야기가 있습니다.',
      '원가 절감 효과가 조금씩 반영될 수 있다는 분석이 나왔습니다.',
      '단기 매수세가 약하게 붙을 가능성이 있다는 소문입니다.',
      '큰 뉴스는 없지만 바닥을 다지는 흐름이라는 평가가 있습니다.',
      '소폭 개선된 실적 메모가 돌고 있다는 이야기가 들립니다.',
      '작은 협업 건이 긍정적으로 마무리됐다는 소문이 있습니다.',
      '거래량이 천천히 늘어날 수 있다는 관측이 나옵니다.',
      '내부 비용 관리가 효과를 보고 있다는 말이 있습니다.',
      '조심스러운 반등 기대감이 생겼다는 찌라시가 돌고 있습니다.'
    ],
    mid: [
      '신규 거래처 확보 가능성이 제기되며 상승 기대감이 커졌습니다.',
      '중요한 프로젝트가 무난히 진행 중이라는 말이 있습니다.',
      '투자자들이 관심을 보이기 시작했다는 소문입니다.',
      '매출 개선 신호가 잡혔다는 찌라시가 돌고 있습니다.',
      '단기 호재가 확인될 경우 꽤 강한 반등이 나올 수 있다는 관측입니다.',
      '실적 전망치가 상향될 수 있다는 이야기가 있습니다.',
      '중형 계약 발표가 준비 중이라는 소문이 돌고 있습니다.',
      '경쟁사 대비 수익성이 좋아졌다는 평가가 나왔습니다.',
      '기관성 매수세가 유입될 수 있다는 말이 있습니다.',
      '긍정적인 내부 보고서가 공유됐다는 이야기가 있습니다.'
    ],
    large: [
      '대형 계약설이 돌고 있습니다. 사실이라면 큰 폭의 상승도 가능해 보입니다.',
      '업계에서 상당한 호재가 임박했다는 이야기가 나옵니다.',
      '강한 매수세가 유입될 수 있다는 소문이 퍼지고 있습니다.',
      '예상보다 큰 성과 발표가 있을 수 있다는 찌라시입니다.',
      '상승 쪽으로 큰 변동성이 열릴 수 있다는 경고성 분석입니다.',
      '굵직한 파트너십 발표 가능성이 시장에 퍼지고 있습니다.',
      '상장 이후 가장 큰 호재가 나올 수 있다는 과격한 소문입니다.',
      '대형 고객사 확보설이 빠르게 돌고 있습니다.',
      '급등 재료가 포착됐다는 이야기가 투자자 사이에 퍼졌습니다.',
      '매수 잔량이 크게 쌓일 수 있다는 관측이 있습니다.'
    ]
  },
  down: {
    small: [
      '작은 비용 증가 이슈가 있다는 이야기가 있습니다. 소폭 하락 가능성이 있습니다.',
      '단기 차익 실현 매물이 나올 수 있다는 소문입니다.',
      '거래량이 줄어들며 약한 조정이 예상된다는 분석입니다.',
      '큰 악재는 아니지만 분위기가 살짝 식었다는 말이 있습니다.',
      '잠깐 쉬어가는 흐름이 나올 수 있다는 찌라시입니다.',
      '소규모 일정 지연이 있다는 말이 들립니다.',
      '일부 투자자가 이익 실현을 준비한다는 소문입니다.',
      '매수세가 잠시 둔화될 수 있다는 관측이 있습니다.',
      '작은 비용 압박이 반영될 수 있다는 분석이 있습니다.',
      '조용한 약세 전환 가능성이 언급되고 있습니다.'
    ],
    mid: [
      '프로젝트 지연 가능성이 제기되며 조정 압력이 커졌습니다.',
      '최근 상승분을 되돌릴 수 있다는 경계감이 있습니다.',
      '매출 전망이 다소 낮아졌다는 소문입니다.',
      '중요한 협상이 삐걱거린다는 찌라시가 돌고 있습니다.',
      '단기 매도세가 강해질 수 있다는 관측입니다.',
      '주요 계약 조건이 불리해졌다는 이야기가 있습니다.',
      '중형 악재가 확인될 수 있다는 조심스러운 말이 나옵니다.',
      '수익성 둔화 가능성이 투자자 사이에 퍼지고 있습니다.',
      '재고 부담이 커졌다는 소문이 있습니다.',
      '관망세가 매도세로 바뀔 수 있다는 분석입니다.'
    ],
    large: [
      '큰 악재성 루머가 돌고 있습니다. 급락 가능성을 경계해야 한다는 말이 있습니다.',
      '대형 계약 취소설이 퍼지고 있습니다.',
      '강한 매도세가 나올 수 있다는 불안한 소문입니다.',
      '예상보다 큰 비용 문제가 터질 수 있다는 찌라시입니다.',
      '하락 쪽으로 큰 변동성이 열릴 수 있다는 경고성 분석입니다.',
      '핵심 파트너 이탈설이 빠르게 돌고 있습니다.',
      '재무 부담이 크게 늘 수 있다는 이야기가 있습니다.',
      '대규모 실망 매물이 나올 수 있다는 관측입니다.',
      '주요 호재가 무산됐다는 소문이 퍼지고 있습니다.',
      '투자심리가 급격히 얼어붙을 수 있다는 경고가 있습니다.'
    ]
  }
};

function getCompanyStockMagnitudeKey(changePct) {
  const abs = Math.abs(Number(changePct || 0));
  if (abs >= 7) return 'large';
  if (abs >= 3) return 'mid';
  return 'small';
}

function buildCompanyStockRumor(company) {
  const projected = Number(company?.projectedChangePct || 0);
  const reliable = Math.random() < COMPANY_STOCK_RUMOR_ACCURACY;
  const hintUp = reliable ? projected >= 0 : projected < 0;
  const direction = hintUp ? 'up' : 'down';
  const magnitudeKey = getCompanyStockMagnitudeKey(projected);
  const pool = COMPANY_STOCK_RUMOR_BANK[direction][magnitudeKey] || COMPANY_STOCK_RUMOR_BANK[direction].small;
  const base = pool[Math.floor(Math.random() * pool.length)] || '뚜렷한 정보는 없지만 시장이 묘하게 술렁입니다.';
  const wrappers = [
    '점심시간 흡연장 찌라시: ',
    '복도에서 주워들은 말로는 ',
    '익명의 회계팀 제보에 따르면 ',
    '퇴근길 단톡방에 따르면 ',
    '프린터 옆 메모에는 ',
    '회의실 앞 소문으로는 ',
    '탕비실 커피머신 옆 정보에 따르면 ',
    '누군가 흘린 메신저 캡처에는 ',
    '엘리베이터 안에서 들은 이야기로는 ',
    '사내 익명 게시판 분위기는 '
  ];
  return wrappers[Math.floor(Math.random() * wrappers.length)] + base;
}

function normalizeCompanyStockRumorEntry(rumor, now = new Date()) {
  if (!rumor || !rumor.text) return null;
  const expiresAt = rumor.expiresAt ? new Date(rumor.expiresAt) : null;
  if (!expiresAt || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) return null;
  const createdAt = rumor.createdAt ? new Date(rumor.createdAt) : now;
  return { text: String(rumor.text), createdAt, expiresAt };
}

function normalizeCompanyStockEntry(entry, now = new Date()) {
  const price = Math.max(100, Math.round(Number(entry?.price || 0) || rollCompanyStockInitialPrice()));
  const history = Array.isArray(entry?.history) ? entry.history.slice(-COMPANY_STOCK_HISTORY_LIMIT) : [];
  if (!history.length) {
    history.push({ at: now, price, changePct: 0 });
  }
  return {
    companyId: String(entry?.companyId || ''),
    companyName: String(entry?.companyName || '이름 없는 회사'),
    ownerNickname: String(entry?.ownerNickname || ''),
    companyValue: Math.max(0, Number(entry?.companyValue || 0)),
    price,
    lastChangePct: Number(entry?.lastChangePct || 0),
    projectedChangePct: Number.isFinite(Number(entry?.projectedChangePct)) ? Number(entry.projectedChangePct) : rollCompanyStockChangePct(),
    rumor: normalizeCompanyStockRumorEntry(entry?.rumor, now),
    history
  };
}

async function syncCompanyStockMarketUncached(now = new Date()) {
  let setting = await GameSetting.findOne({ key: COMPANY_STOCK_MARKET_SETTING_KEY });
  if (!setting) {
    setting = new GameSetting({ key: COMPANY_STOCK_MARKET_SETTING_KEY, value: { companies: [], lastTickAt: now, nextTickAt: new Date(now.getTime() + COMPANY_STOCK_UPDATE_INTERVAL_MS) } });
  }
  const value = setting.value && typeof setting.value === 'object' ? setting.value : {};
  const companyUsers = await User.find({ 'branchOffice.isFounded': true })
    .select('_id username nickname branchOffice.companyName branchOffice.companyValue')
    .lean();
  const activeIds = new Set(companyUsers.map((entry) => String(entry._id)));
  const byId = new Map();
  (Array.isArray(value.companies) ? value.companies : []).forEach((entry) => {
    const normalized = normalizeCompanyStockEntry(entry, now);
    if (normalized.companyId) byId.set(normalized.companyId, normalized);
  });
  companyUsers.forEach((companyUser) => {
    const companyId = String(companyUser._id);
    const existing = byId.get(companyId) || normalizeCompanyStockEntry({ companyId }, now);
    existing.companyId = companyId;
    existing.companyName = getCompanyStockDisplayName(companyUser);
    existing.ownerNickname = String(companyUser.nickname || companyUser.username || '');
    existing.companyValue = Math.max(0, Number(companyUser.branchOffice?.companyValue || 0));
    if (!Number.isFinite(Number(existing.projectedChangePct))) existing.projectedChangePct = rollCompanyStockChangePct();
    byId.set(companyId, existing);
  });
  let companies = [...byId.values()].filter((entry) => activeIds.has(entry.companyId));
  let lastTickAt = value.lastTickAt ? new Date(value.lastTickAt) : now;
  if (!Number.isFinite(lastTickAt.getTime())) lastTickAt = now;
  let elapsedTicks = Math.floor((now.getTime() - lastTickAt.getTime()) / COMPANY_STOCK_UPDATE_INTERVAL_MS);
  elapsedTicks = Math.max(0, Math.min(COMPANY_STOCK_MAX_BACKFILL_TICKS, elapsedTicks));
  for (let tick = 0; tick < elapsedTicks; tick += 1) {
    const tickAt = new Date(lastTickAt.getTime() + COMPANY_STOCK_UPDATE_INTERVAL_MS);
    companies.forEach((company) => {
      const changePct = Number.isFinite(Number(company.projectedChangePct)) ? Number(company.projectedChangePct) : rollCompanyStockChangePct();
      company.price = Math.max(100, Math.round(Number(company.price || 100) * (1 + changePct / 100)));
      company.lastChangePct = Number(changePct.toFixed(2));
      company.history = Array.isArray(company.history) ? company.history : [];
      company.history.push({ at: tickAt, price: company.price, changePct: company.lastChangePct });
      company.history = company.history.slice(-COMPANY_STOCK_HISTORY_LIMIT);
      company.projectedChangePct = rollCompanyStockChangePct();
    });
    lastTickAt = tickAt;
  }
  const nextTickAt = new Date(lastTickAt.getTime() + COMPANY_STOCK_UPDATE_INTERVAL_MS);
  const nextValue = { companies, lastTickAt, nextTickAt };
  await GameSetting.updateOne(
    { key: COMPANY_STOCK_MARKET_SETTING_KEY },
    { $set: { value: nextValue, updatedAt: now } },
    { upsert: true }
  );
  return nextValue;
}

async function syncCompanyStockMarket(now = new Date()) {
  const nowMs = now.getTime();
  const cachedNextTickAt = companyStockMarketCache?.nextTickAt ? new Date(companyStockMarketCache.nextTickAt).getTime() : 0;
  const cachedMarketStillBeforeTick = !Number.isFinite(cachedNextTickAt) || cachedNextTickAt <= 0 || cachedNextTickAt > nowMs;
  if (companyStockMarketCache && companyStockMarketCacheExpiresAt > nowMs && cachedMarketStillBeforeTick) {
    return companyStockMarketCache;
  }
  if (companyStockMarketSyncPromise) {
    return companyStockMarketSyncPromise;
  }

  companyStockMarketSyncPromise = syncCompanyStockMarketUncached(now)
    .then((market) => {
      companyStockMarketCache = market;
      companyStockMarketCacheExpiresAt = Date.now() + COMPANY_STOCK_MARKET_CACHE_TTL_MS;
      return market;
    })
    .finally(() => {
      companyStockMarketSyncPromise = null;
    });
  return companyStockMarketSyncPromise;
}

function normalizeStockPortfolio(portfolio = []) {
  if (!Array.isArray(portfolio)) return [];
  return portfolio
    .filter((entry) => entry && entry.companyId && Number(entry.shares || 0) > 0)
    .map((entry) => ({
      companyId: String(entry.companyId),
      companyName: String(entry.companyName || ''),
      shares: Math.max(0, Math.floor(Number(entry.shares || 0))),
      averagePrice: Math.max(0, Number(entry.averagePrice || 0)),
      investedAmount: Math.max(0, Number(entry.investedAmount || 0)),
      updatedAt: entry.updatedAt || new Date()
    }));
}

async function buildCompanyStockMarketResponse(user, now = new Date()) {
  const market = await syncCompanyStockMarket(now);
  const companies = Array.isArray(market.companies) ? market.companies : [];
  const portfolio = normalizeStockPortfolio(user?.stockPortfolio);
  const derivedStats = user ? calculateDerivedStats(user, now) : null;
  const sellFeeRate = user ? getEffectiveCompanyStockSellFeeRate(user, now, derivedStats) : COMPANY_STOCK_SELL_FEE_RATE;
  const holdings = portfolio.map((holding) => {
    const stock = companies.find((company) => company.companyId === holding.companyId);
    const currentPrice = stock ? Number(stock.price || 0) : 0;
    const shares = Number(holding.shares || 0);
    const averagePrice = Number(holding.averagePrice || 0);
    return {
      ...holding,
      companyName: stock?.companyName || holding.companyName,
      currentPrice,
      marketValue: Math.floor(currentPrice * shares),
      unrealizedProfit: Math.floor((currentPrice - averagePrice) * shares),
      profitRate: averagePrice > 0 ? ((currentPrice - averagePrice) / averagePrice) * 100 : 0
    };
  });
  return {
    stocks: companies.map((company) => ({
      companyId: company.companyId,
      companyName: company.companyName,
      ownerNickname: company.ownerNickname,
      companyValue: company.companyValue,
      price: company.price,
      lastChangePct: company.lastChangePct,
      rumor: company.rumor || null,
      history: company.history || []
    })),
    holdings,
    sellFeeRate,
    baseSellFeeRate: COMPANY_STOCK_SELL_FEE_RATE,
    stockFeeReductionPercent: Number(derivedStats?.stockFeeReductionPercent || 0),
    nextUpdateAt: market.nextTickAt || null,
    totalMarketValue: holdings.reduce((sum, holding) => sum + Number(holding.marketValue || 0), 0)
  };
}

function createInterviewTournamentState(now = new Date()) {
  return {
    eventId: INTERVIEW_TOURNAMENT_SETTING_KEY,
    name: INTERVIEW_TOURNAMENT_NAME,
    registerDeadlineAt: INTERVIEW_TOURNAMENT_REGISTER_DEADLINE_AT,
    participants: [],
    matches: [],
    bracketGeneratedAt: null,
    championUserId: null,
    thirdPlaceMatchId: null,
    updatedAt: now
  };
}

function getInterviewTournamentPhase(state, now = new Date()) {
  if (now.getTime() < INTERVIEW_TOURNAMENT_REGISTER_DEADLINE_AT.getTime()) return 'registering';
  if (!state?.bracketGeneratedAt) return 'pending_bracket';
  if (state?.championUserId) {
    const thirdPlaceMatch = state.thirdPlaceMatchId
      ? (state.matches || []).find((match) => match.matchId === state.thirdPlaceMatchId)
      : null;
    if (!thirdPlaceMatch || thirdPlaceMatch.status === 'completed') return 'finished';
  }
  return 'bracket';
}

function getInterviewTournamentPhaseLabel(phase) {
  if (phase === 'registering') return '참가 신청 접수중';
  if (phase === 'pending_bracket') return '대진표 생성 대기';
  if (phase === 'finished') return '토너먼트 종료';
  return '대진 진행중';
}

function normalizeInterviewTournamentState(raw, now = new Date()) {
  const state = raw && typeof raw === 'object' ? raw : createInterviewTournamentState(now);
  state.eventId = INTERVIEW_TOURNAMENT_SETTING_KEY;
  state.name = INTERVIEW_TOURNAMENT_NAME;
  state.registerDeadlineAt = state.registerDeadlineAt || INTERVIEW_TOURNAMENT_REGISTER_DEADLINE_AT;
  state.participants = Array.isArray(state.participants) ? state.participants
    .filter((entry) => entry?.userId)
    .map((entry) => ({
      userId: String(entry.userId),
      displayName: String(entry.displayName || '참가자'),
      registeredAt: entry.registeredAt || now
    })) : [];
  state.matches = Array.isArray(state.matches) ? state.matches
    .filter((entry) => entry?.matchId)
    .map((entry) => ({
      matchId: String(entry.matchId),
      round: Math.max(1, Math.floor(Number(entry.round || 1))),
      index: Math.max(0, Math.floor(Number(entry.index || 0))),
      playerA: entry.playerA || null,
      playerB: entry.playerB || null,
      winner: entry.winner || null,
      loser: entry.loser || null,
      readyUserIds: Array.isArray(entry.readyUserIds) ? entry.readyUserIds.map(String) : [],
      status: entry.status || 'waiting',
      isThirdPlace: Boolean(entry.isThirdPlace),
      bestOf: Math.max(1, Math.floor(Number(entry.bestOf || 1))),
      scoreA: Math.max(0, Math.floor(Number(entry.scoreA || 0))),
      scoreB: Math.max(0, Math.floor(Number(entry.scoreB || 0))),
      gamesPlayed: Math.max(0, Math.floor(Number(entry.gamesPlayed || 0))),
      seriesFirstUserId: entry.seriesFirstUserId ? String(entry.seriesFirstUserId) : null,
      createdAt: entry.createdAt || now,
      startedAt: entry.startedAt || null,
      completedAt: entry.completedAt || null
    })) : [];
  state.bracketGeneratedAt = state.bracketGeneratedAt || null;
  state.championUserId = state.championUserId || null;
  state.thirdPlaceMatchId = state.thirdPlaceMatchId || null;
  state.rankedModeHotfixApplied = Boolean(state.rankedModeHotfixApplied);
  state.updatedAt = state.updatedAt || now;
  return state;
}

function applyInterviewTournamentRankedModeHotfix(state, now = new Date()) {
  if (!state || state.rankedModeHotfixApplied) return false;
  const completedMatches = (state.matches || [])
    .filter((match) => match.status === 'completed'
      && match.playerA?.userId
      && match.playerB?.userId
      && match.winner?.userId)
    .sort((a, b) => new Date(b.completedAt || b.startedAt || b.createdAt || 0).getTime()
      - new Date(a.completedAt || a.startedAt || a.createdAt || 0).getTime());

  const resetMatch = completedMatches[0] || null;
  if (resetMatch) {
    const resetRound = Number(resetMatch.round || 1);
    const resetMatchId = String(resetMatch.matchId || '');
    resetMatch.winner = null;
    resetMatch.loser = null;
    resetMatch.readyUserIds = [];
    resetMatch.status = 'waiting';
    resetMatch.scoreA = 0;
    resetMatch.scoreB = 0;
    resetMatch.gamesPlayed = 0;
    resetMatch.seriesFirstUserId = null;
    resetMatch.startedAt = null;
    resetMatch.completedAt = null;

    if (!resetMatch.isThirdPlace) {
      state.matches = (state.matches || []).filter((match) => (
        String(match.matchId || '') === resetMatchId
        || (match.isThirdPlace ? Number(match.round || 0) <= resetRound : Number(match.round || 0) <= resetRound)
      ));
      state.championUserId = null;
      if (state.thirdPlaceMatchId && !(state.matches || []).some((match) => match.matchId === state.thirdPlaceMatchId)) {
        state.thirdPlaceMatchId = null;
      }
    }
  }

  state.rankedModeHotfixApplied = true;
  state.updatedAt = now;
  return true;
}

function shuffleInterviewTournamentParticipants(participants = []) {
  return [...participants].sort(() => Math.random() - 0.5);
}

function createInterviewTournamentRoundMatches(players = [], round = 1, now = new Date()) {
  const matches = [];
  for (let index = 0; index < players.length; index += 2) {
    const playerA = players[index] || null;
    const playerB = players[index + 1] || null;
    const byeWinner = playerA && !playerB ? playerA : null;
    matches.push({
      matchId: crypto.randomUUID(),
      round,
      index: matches.length,
      playerA,
      playerB,
      winner: byeWinner,
      loser: null,
      readyUserIds: [],
      status: byeWinner ? 'completed' : 'waiting',
      isThirdPlace: false,
      bestOf: 1,
      scoreA: 0,
      scoreB: 0,
      gamesPlayed: 0,
      seriesFirstUserId: null,
      createdAt: now,
      startedAt: null,
      completedAt: byeWinner ? now : null
    });
  }
  return matches;
}

function buildInterviewTournamentInitialBracket(state, now = new Date()) {
  if (state.bracketGeneratedAt) return;
  const participants = shuffleInterviewTournamentParticipants(state.participants);
  state.matches = createInterviewTournamentRoundMatches(participants, 1, now);
  state.bracketGeneratedAt = now;
  advanceInterviewTournamentRounds(state, now);
  state.updatedAt = now;
}

function getInterviewTournamentRoundMatches(state, round) {
  return (state.matches || []).filter((match) => !match.isThirdPlace && Number(match.round || 0) === Number(round));
}

function getInterviewTournamentMaxRound(state) {
  return (state.matches || [])
    .filter((match) => !match.isThirdPlace)
    .reduce((max, match) => Math.max(max, Number(match.round || 0)), 0);
}

function getInterviewTournamentMatchBestOf(state, match) {
  if (!state || !match || match.isThirdPlace || !match.playerA?.userId || !match.playerB?.userId) return 1;
  const round = Number(match.round || 0);
  const roundMatches = getInterviewTournamentRoundMatches(state, round);
  const isSemifinal = roundMatches.length === 2;
  const isFinal = roundMatches.length === 1 && round === getInterviewTournamentMaxRound(state);
  return isSemifinal || isFinal ? 3 : 1;
}

function normalizeInterviewTournamentMatchSeries(state, match) {
  if (!match) return false;
  let changed = false;
  const bestOf = getInterviewTournamentMatchBestOf(state, match);
  if (Number(match.bestOf || 1) !== bestOf) {
    match.bestOf = bestOf;
    changed = true;
  }
  const scoreA = Math.max(0, Math.floor(Number(match.scoreA || 0)));
  const scoreB = Math.max(0, Math.floor(Number(match.scoreB || 0)));
  const gamesPlayed = Math.max(scoreA + scoreB, Math.floor(Number(match.gamesPlayed || 0)));
  if (Number(match.scoreA || 0) !== scoreA) {
    match.scoreA = scoreA;
    changed = true;
  }
  if (Number(match.scoreB || 0) !== scoreB) {
    match.scoreB = scoreB;
    changed = true;
  }
  if (Number(match.gamesPlayed || 0) !== gamesPlayed) {
    match.gamesPlayed = gamesPlayed;
    changed = true;
  }
  if (bestOf <= 1 && match.seriesFirstUserId) {
    match.seriesFirstUserId = null;
    changed = true;
  }
  if (
    bestOf > 1
    && match.status === 'completed'
    && match.winner?.userId
    && scoreA + scoreB === 0
  ) {
    const targetWins = Math.ceil(bestOf / 2);
    if (String(match.winner.userId) === String(match.playerA?.userId)) {
      match.scoreA = targetWins;
      match.scoreB = 0;
    } else if (String(match.winner.userId) === String(match.playerB?.userId)) {
      match.scoreA = 0;
      match.scoreB = targetWins;
    }
    match.gamesPlayed = Math.max(Number(match.scoreA || 0) + Number(match.scoreB || 0), Number(match.gamesPlayed || 0));
    changed = true;
  }
  return changed;
}

function normalizeInterviewTournamentSeriesMeta(state) {
  return (state.matches || []).reduce((changed, match) => (
    normalizeInterviewTournamentMatchSeries(state, match) || changed
  ), false);
}

function getInterviewTournamentNextFirstPlayerUserId(match) {
  if (!match?.playerA?.userId || !match?.playerB?.userId || Number(match.bestOf || 1) <= 1) return null;
  const playerAId = String(match.playerA.userId);
  const playerBId = String(match.playerB.userId);
  if (![playerAId, playerBId].includes(String(match.seriesFirstUserId || ''))) {
    match.seriesFirstUserId = Math.random() < 0.5 ? playerAId : playerBId;
  }
  const firstGameFirstUserId = String(match.seriesFirstUserId);
  const otherUserId = firstGameFirstUserId === playerAId ? playerBId : playerAId;
  return Number(match.gamesPlayed || 0) % 2 === 0 ? firstGameFirstUserId : otherUserId;
}

function advanceInterviewTournamentRounds(state, now = new Date()) {
  let guard = 0;
  while (guard < 10) {
    guard += 1;
    const maxRound = getInterviewTournamentMaxRound(state);
    if (!maxRound) return;
    const matches = getInterviewTournamentRoundMatches(state, maxRound);
    if (!matches.length || matches.some((match) => match.status !== 'completed')) return;
    const winners = matches.map((match) => match.winner).filter(Boolean);
    if (winners.length <= 1) {
      state.championUserId = winners[0]?.userId || null;
      return;
    }
    const nextRoundExists = getInterviewTournamentRoundMatches(state, maxRound + 1).length > 0;
    if (nextRoundExists) return;
    if (winners.length === 2 && matches.length === 2) {
      state.matches.push(...createInterviewTournamentRoundMatches(winners, maxRound + 1, now));
      const losers = matches.map((match) => match.loser).filter(Boolean);
      if (losers.length === 2) {
        const thirdPlaceMatch = createInterviewTournamentRoundMatches(losers, maxRound + 1, now)[0];
        thirdPlaceMatch.isThirdPlace = true;
        thirdPlaceMatch.matchId = crypto.randomUUID();
        state.thirdPlaceMatchId = thirdPlaceMatch.matchId;
        state.matches.push(thirdPlaceMatch);
      }
      return;
    }
    state.matches.push(...createInterviewTournamentRoundMatches(winners, maxRound + 1, now));
  }
}

async function getInterviewTournamentState(now = new Date()) {
  let setting = await GameSetting.findOne({ key: INTERVIEW_TOURNAMENT_SETTING_KEY });
  let state = normalizeInterviewTournamentState(setting?.value, now);
  let shouldSave = false;
  if (!setting) {
    setting = new GameSetting({ key: INTERVIEW_TOURNAMENT_SETTING_KEY, value: state, updatedAt: now });
    await setting.save();
  }
  if (now.getTime() >= INTERVIEW_TOURNAMENT_REGISTER_DEADLINE_AT.getTime() && !state.bracketGeneratedAt) {
    buildInterviewTournamentInitialBracket(state, now);
    shouldSave = true;
  }
  if (applyInterviewTournamentRankedModeHotfix(state, now)) {
    shouldSave = true;
  }
  if (normalizeInterviewTournamentSeriesMeta(state)) {
    shouldSave = true;
  }
  if (shouldSave) {
    await GameSetting.updateOne(
      { key: INTERVIEW_TOURNAMENT_SETTING_KEY },
      { $set: { value: state, updatedAt: now } },
      { upsert: true }
    );
  }
  return state;
}

async function saveInterviewTournamentState(state, now = new Date()) {
  state.updatedAt = now;
  await GameSetting.updateOne(
    { key: INTERVIEW_TOURNAMENT_SETTING_KEY },
    { $set: { value: state, updatedAt: now } },
    { upsert: true }
  );
}

function buildInterviewTournamentResponse(state, userId = null, now = new Date()) {
  const phase = getInterviewTournamentPhase(state, now);
  const normalizedUserId = userId ? String(userId) : null;
  const isRegistered = Boolean(normalizedUserId && state.participants.some((entry) => entry.userId === normalizedUserId));
  const currentMatch = normalizedUserId
    ? state.matches.find((match) => match.status === 'waiting'
      && [match.playerA?.userId, match.playerB?.userId].includes(normalizedUserId)) || null
    : null;
  return {
    eventId: INTERVIEW_TOURNAMENT_SETTING_KEY,
    name: INTERVIEW_TOURNAMENT_NAME,
    phase,
    phaseLabel: getInterviewTournamentPhaseLabel(phase),
    registerDeadlineAt: INTERVIEW_TOURNAMENT_REGISTER_DEADLINE_AT,
    isRegistered,
    canRegister: phase === 'registering' && !isRegistered,
    participantCount: state.participants.length,
    participants: state.participants,
    matches: state.matches,
    currentMatch,
    readyUserIds: currentMatch?.readyUserIds || [],
    championUserId: state.championUserId || null,
    thirdPlaceMatchId: state.thirdPlaceMatchId || null
  };
}

async function finalizeInterviewTournamentMatch(matchId, winnerUserId, loserUserId, now = new Date()) {
  if (!matchId) return;
  const state = await getInterviewTournamentState(now);
  const match = state.matches.find((entry) => entry.matchId === String(matchId));
  if (!match || match.status === 'completed') return;
  normalizeInterviewTournamentMatchSeries(state, match);
  const winner = [match.playerA, match.playerB].find((player) => player?.userId === String(winnerUserId));
  const loser = [match.playerA, match.playerB].find((player) => player?.userId === String(loserUserId));
  if (!winner) return;
  const bestOf = Math.max(1, Number(match.bestOf || 1));
  if (bestOf > 1) {
    const targetWins = Math.ceil(bestOf / 2);
    if (String(winner.userId) === String(match.playerA?.userId)) {
      match.scoreA = Math.max(0, Number(match.scoreA || 0)) + 1;
    } else if (String(winner.userId) === String(match.playerB?.userId)) {
      match.scoreB = Math.max(0, Number(match.scoreB || 0)) + 1;
    }
    match.gamesPlayed = Math.max(Number(match.gamesPlayed || 0) + 1, Number(match.scoreA || 0) + Number(match.scoreB || 0));
    if (Number(match.scoreA || 0) < targetWins && Number(match.scoreB || 0) < targetWins) {
      match.winner = null;
      match.loser = null;
      match.status = 'waiting';
      match.startedAt = null;
      match.completedAt = null;
      match.readyUserIds = [];
      await saveInterviewTournamentState(state, now);
      return;
    }
  }
  match.winner = winner;
  match.loser = loser || null;
  match.status = 'completed';
  match.completedAt = now;
  match.readyUserIds = [];
  advanceInterviewTournamentRounds(state, now);
  await saveInterviewTournamentState(state, now);
}

function clearInterviewTournamentPvpSession(matchId) {
  const targetMatchId = String(matchId || '');
  if (!targetMatchId) return;
  const modeState = getPvpModeState(PVP_MODE_RANKED);
  let changed = false;
  if (modeState.match && String(modeState.match.tournamentMatchId || '') === targetMatchId) {
    modeState.match = null;
    changed = true;
  }
  if (modeState.battle && String(modeState.battle.tournamentMatchId || '') === targetMatchId) {
    modeState.battle = null;
    changed = true;
  }
  if (changed) bumpPvpVersion();
}

function pruneInterviewTournamentFutureMatches(state, match) {
  if (!state || !match || match.isThirdPlace) return;
  const matchRound = Number(match.round || 0);
  const matchId = String(match.matchId || '');
  const finalRound = getInterviewTournamentMaxRound(state);
  const keepThirdPlace = matchRound >= finalRound;
  state.matches = (state.matches || []).filter((entry) => (
    String(entry.matchId || '') === matchId
    || (keepThirdPlace && entry.isThirdPlace)
    || (!entry.isThirdPlace && Number(entry.round || 0) <= matchRound)
  ));
  state.championUserId = null;
  if (!keepThirdPlace) state.thirdPlaceMatchId = null;
}

async function forceInterviewTournamentMatchResult(matchId, winnerUserId, now = new Date()) {
  const state = await getInterviewTournamentState(now);
  const match = state.matches.find((entry) => String(entry.matchId) === String(matchId));
  if (!match) throw createHttpError(404, '토너먼트 대진을 찾을 수 없습니다.');
  if (!match.playerA?.userId || !match.playerB?.userId) {
    throw createHttpError(400, '승패를 확정할 수 없는 대진입니다.');
  }

  normalizeInterviewTournamentMatchSeries(state, match);
  const winner = [match.playerA, match.playerB].find((player) => String(player?.userId || '') === String(winnerUserId || ''));
  if (!winner) throw createHttpError(400, '승자로 지정할 참가자가 해당 대진에 없습니다.');
  const loser = String(winner.userId) === String(match.playerA.userId) ? match.playerB : match.playerA;

  if (match.status === 'completed') {
    pruneInterviewTournamentFutureMatches(state, match);
  }

  const bestOf = Math.max(1, Number(match.bestOf || getInterviewTournamentMatchBestOf(state, match) || 1));
  const targetWins = Math.ceil(bestOf / 2);
  match.bestOf = bestOf;
  match.scoreA = String(winner.userId) === String(match.playerA.userId) ? targetWins : 0;
  match.scoreB = String(winner.userId) === String(match.playerB.userId) ? targetWins : 0;
  match.gamesPlayed = targetWins;
  match.winner = winner;
  match.loser = loser || null;
  match.status = 'completed';
  match.readyUserIds = [];
  match.startedAt = match.startedAt || now;
  match.completedAt = now;

  clearInterviewTournamentPvpSession(match.matchId);
  advanceInterviewTournamentRounds(state, now);
  await saveInterviewTournamentState(state, now);
  return { state, match };
}

function getStockTournamentPhase(now = new Date()) {
  const time = now.getTime();
  if (time < STOCK_TOURNAMENT_START_AT.getTime()) return 'before';
  if (time >= STOCK_TOURNAMENT_END_AT.getTime()) return 'ended';
  return 'active';
}

function getStockTournamentPhaseLabel(phase) {
  if (phase === 'before') return '대회 준비중';
  if (phase === 'active') return '대회 진행중';
  return '대회 종료';
}

function normalizeStockTournamentHoldingList(holdings = []) {
  return normalizeStockPortfolio(holdings);
}

function ensureStockTournamentState(user) {
  if (!user.stockTournament || typeof user.stockTournament !== 'object') {
    user.stockTournament = {};
  }
  const tournament = user.stockTournament;
  tournament.eventId = tournament.eventId || null;
  tournament.registeredAt = tournament.registeredAt || null;
  tournament.cash = Math.max(0, Number(tournament.cash ?? STOCK_TOURNAMENT_INITIAL_CASH));
  tournament.holdings = normalizeStockTournamentHoldingList(tournament.holdings);
  tournament.advancedInfoUsed = Math.max(0, Math.floor(Number(tournament.advancedInfoUsed || 0)));
  tournament.advancedInfos = Array.isArray(tournament.advancedInfos) ? tournament.advancedInfos
    .filter((entry) => entry && entry.text)
    .map((entry) => ({
      companyId: String(entry.companyId || ''),
      companyName: String(entry.companyName || ''),
      text: String(entry.text || ''),
      createdAt: entry.createdAt || new Date(),
      expiresAt: entry.expiresAt || null
    })) : [];
  tournament.finalizedAt = tournament.finalizedAt || null;
  tournament.finalAssets = Math.max(0, Number(tournament.finalAssets || 0));
  tournament.finalReturnPct = Number(tournament.finalReturnPct || 0);
  return tournament;
}

function isStockTournamentRegistered(user) {
  return user?.stockTournament?.eventId === STOCK_TOURNAMENT_ID && Boolean(user.stockTournament.registeredAt);
}

function buildStockTournamentUserSummary(user, now = new Date()) {
  ensureStockTournamentState(user);
  const phase = getStockTournamentPhase(now);
  const registered = isStockTournamentRegistered(user);
  return {
    eventId: STOCK_TOURNAMENT_ID,
    name: STOCK_TOURNAMENT_NAME,
    phase,
    phaseLabel: getStockTournamentPhaseLabel(phase),
    startAt: STOCK_TOURNAMENT_START_AT,
    endAt: STOCK_TOURNAMENT_END_AT,
    isRegistered: registered,
    canTrade: registered && phase === 'active'
  };
}

function getStockTournamentValuationPrice(company, now = new Date()) {
  if (!company) return 0;
  if (getStockTournamentPhase(now) !== 'ended') return Number(company.price || 0);
  const endMs = STOCK_TOURNAMENT_END_AT.getTime();
  const history = Array.isArray(company.history) ? company.history : [];
  const endPoint = [...history].reverse().find((entry) => {
    const atMs = entry?.at ? new Date(entry.at).getTime() : 0;
    return Number.isFinite(atMs) && atMs <= endMs;
  });
  return Number(endPoint?.price || company.price || 0);
}

function calculateStockTournamentAssetsFromMarket(tournament, companies = [], now = new Date()) {
  const holdings = normalizeStockTournamentHoldingList(tournament?.holdings);
  const totalStockValue = holdings.reduce((sum, holding) => {
    const stock = companies.find((company) => company.companyId === holding.companyId);
    return sum + Math.floor(getStockTournamentValuationPrice(stock, now) * Number(holding.shares || 0));
  }, 0);
  return Math.max(0, Math.floor(Number(tournament?.cash || 0) + totalStockValue));
}

function buildStockTournamentAdvancedHint(company) {
  const projected = Number(company?.projectedChangePct || 0);
  const truthful = Math.random() < STOCK_TOURNAMENT_ADVANCED_INFO_ACCURACY;
  const hintedChange = truthful ? projected : -projected;
  const abs = Math.abs(hintedChange);
  const direction = hintedChange >= 0 ? '상승' : '하락';
  const strength = abs >= 7 ? '강한' : abs >= 3 ? '완만한' : '약한';
  const volatility = Math.abs(Number(company?.lastChangePct || 0)) >= 5 ? '최근 변동성도 커서 진입 타이밍을 조심해야 합니다.' : '큰 변수만 없다면 흐름은 비교적 안정적으로 보입니다.';
  return `${company?.companyName || '해당 종목'} 고급 정보: 향후 24시간은 ${strength} ${direction} 쪽으로 기울었다는 내부 보고가 있습니다. ${volatility}`;
}

async function buildStockTournamentLeaderboard(companies = [], now = new Date()) {
  const users = await User.find({ 'stockTournament.eventId': STOCK_TOURNAMENT_ID })
    .select('_id username nickname stockTournament')
    .lean();
  return users.map((entry) => {
    const tournament = entry.stockTournament || {};
    const finalized = tournament.finalizedAt && Number(tournament.finalAssets || 0) > 0;
    const totalAssets = finalized
      ? Math.floor(Number(tournament.finalAssets || 0))
      : calculateStockTournamentAssetsFromMarket(tournament, companies, now);
    const returnPct = finalized
      ? Number(tournament.finalReturnPct || 0)
      : ((totalAssets - STOCK_TOURNAMENT_INITIAL_CASH) / STOCK_TOURNAMENT_INITIAL_CASH) * 100;
    return {
      userId: String(entry._id),
      nickname: entry.nickname || entry.username || '참가자',
      totalAssets,
      returnPct
    };
  }).sort((a, b) => b.totalAssets - a.totalAssets || b.returnPct - a.returnPct)
    .map((entry, index) => ({ rank: index + 1, ...entry }));
}

async function buildStockTournamentResponse(user, now = new Date()) {
  ensureUserDefaults(user);
  const phase = getStockTournamentPhase(now);
  const market = await syncCompanyStockMarket(now);
  const companies = Array.isArray(market.companies) ? market.companies : [];
  const tournament = ensureStockTournamentState(user);
  const registered = isStockTournamentRegistered(user);
  const holdings = normalizeStockTournamentHoldingList(tournament.holdings).map((holding) => {
    const stock = companies.find((company) => company.companyId === holding.companyId);
    const currentPrice = stock ? getStockTournamentValuationPrice(stock, now) : 0;
    const shares = Number(holding.shares || 0);
    const averagePrice = Number(holding.averagePrice || 0);
    return {
      ...holding,
      companyName: stock?.companyName || holding.companyName,
      currentPrice,
      marketValue: Math.floor(currentPrice * shares),
      unrealizedProfit: Math.floor((currentPrice - averagePrice) * shares),
      profitRate: averagePrice > 0 ? ((currentPrice - averagePrice) / averagePrice) * 100 : 0
    };
  });
  const totalAssets = registered
    ? Math.max(0, Math.floor(Number(tournament.cash || 0) + holdings.reduce((sum, entry) => sum + Number(entry.marketValue || 0), 0)))
    : 0;
  const returnPct = registered ? ((totalAssets - STOCK_TOURNAMENT_INITIAL_CASH) / STOCK_TOURNAMENT_INITIAL_CASH) * 100 : 0;
  const leaderboard = await buildStockTournamentLeaderboard(companies, now);
  return {
    eventId: STOCK_TOURNAMENT_ID,
    name: STOCK_TOURNAMENT_NAME,
    phase,
    phaseLabel: getStockTournamentPhaseLabel(phase),
    startAt: STOCK_TOURNAMENT_START_AT,
    endAt: STOCK_TOURNAMENT_END_AT,
    initialCash: STOCK_TOURNAMENT_INITIAL_CASH,
    isRegistered: registered,
    canRegister: !registered && phase === 'before',
    canTrade: registered && phase === 'active',
    cash: registered ? Math.floor(Number(tournament.cash || 0)) : 0,
    totalAssets,
    returnPct,
    holdings,
    advancedInfoLimit: STOCK_TOURNAMENT_ADVANCED_INFO_LIMIT,
    advancedInfoUsed: Math.max(0, Math.floor(Number(tournament.advancedInfoUsed || 0))),
    advancedInfoRemaining: Math.max(0, STOCK_TOURNAMENT_ADVANCED_INFO_LIMIT - Math.max(0, Math.floor(Number(tournament.advancedInfoUsed || 0)))),
    advancedInfos: Array.isArray(tournament.advancedInfos) ? tournament.advancedInfos : [],
    leaderboard,
    stockMarket: {
      stocks: companies.map((company) => ({
        companyId: company.companyId,
        companyName: company.companyName,
        ownerNickname: company.ownerNickname,
        companyValue: company.companyValue,
        price: getStockTournamentValuationPrice(company, now),
        lastChangePct: company.lastChangePct,
        rumor: company.rumor || null,
        history: company.history || []
      })),
      sellFeeRate: COMPANY_STOCK_SELL_FEE_RATE,
      nextUpdateAt: market.nextTickAt || null
    }
  };
}


function getKSTDateKey(date = new Date()) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getNextKSTMidnight(date = new Date()) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const nextMidnightUtcMs = Date.UTC(
    kst.getUTCFullYear(),
    kst.getUTCMonth(),
    kst.getUTCDate() + 1,
    0,
    0,
    0,
    0
  ) - KST_OFFSET_MS;
  return new Date(nextMidnightUtcMs);
}

function hashStringToUint32(value) {
  let hash = 2166136261;
  const text = String(value ?? '');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hashStringToUnit(value) {
  return hashStringToUint32(value) / 0x100000000;
}

function getDailyAugmentSeedKey(user, dayKey) {
  const resetSeed = String(user?.meta?.dailyAugmentResetSeed || '').trim();
  const resetDayKey = String(user?.meta?.dailyAugmentResetDayKey || '').trim();
  return resetSeed && resetDayKey === dayKey ? `${dayKey}:${resetSeed}` : dayKey;
}

function getDailyAugmentTier(seedKey) {
  const totalWeight = PVP_AUGMENT_TIER_WEIGHTS.reduce((sum, entry) => sum + Number(entry.weight || 0), 0);
  let roll = hashStringToUnit(`daily-augment-tier:${seedKey}`) * Math.max(1, totalWeight);
  for (const entry of PVP_AUGMENT_TIER_WEIGHTS) {
    roll -= Number(entry.weight || 0);
    if (roll <= 0) return entry.tier;
  }
  return PVP_AUGMENT_TIER_WEIGHTS[0]?.tier || 'silver';
}

function getDailyAugmentOptionsForUser(user, seedKey, tier) {
  const userKey = String(user?._id || user?.username || 'guest');
  return Object.values(DAILY_AUGMENT_DATA)
    .filter((augment) => augment?.tier === tier)
    .sort((a, b) =>
      hashStringToUint32(`daily-augment-option:${seedKey}:${userKey}:${a.id}`)
      - hashStringToUint32(`daily-augment-option:${seedKey}:${userKey}:${b.id}`)
    )
    .slice(0, DAILY_AUGMENT_OPTION_COUNT)
    .map((augment) => augment.id);
}

function getDailyAugmentRerollOption(user, dayKey, tier, slotIndex) {
  const userKey = String(user?._id || user?.username || 'guest');
  const seedKey = String(user?.meta?.dailyAugmentSeedKey || getDailyAugmentSeedKey(user, dayKey));
  const options = Array.isArray(user?.meta?.dailyAugmentOptions) ? user.meta.dailyAugmentOptions : [];
  const excluded = new Set(options.filter(Boolean));
  const selectedId = String(user?.meta?.dailyAugmentSelectedId || '');
  if (selectedId) excluded.add(selectedId);
  const candidates = Object.values(DAILY_AUGMENT_DATA)
    .filter((augment) => augment?.tier === tier && !excluded.has(augment.id))
    .sort((a, b) =>
      hashStringToUint32(`daily-augment-reroll:${seedKey}:${userKey}:${slotIndex}:${a.id}`)
      - hashStringToUint32(`daily-augment-reroll:${seedKey}:${userKey}:${slotIndex}:${b.id}`)
    );
  return candidates[0]?.id || '';
}

function serializeDailyAugment(augmentId, extra = {}) {
  const augment = DAILY_AUGMENT_DATA[augmentId];
  if (!augment) return null;
  return {
    id: augment.id,
    tier: augment.tier,
    tierLabel: PVP_AUGMENT_TIER_LABELS[augment.tier] || augment.tier,
    name: augment.name,
    desc: augment.desc,
    ...extra
  };
}

function getDailyGrantedAugmentId(user, dayKey, sourceAugmentId, targetTier, excludedIds = new Set()) {
  const userKey = String(user?._id || user?.username || 'guest');
  const candidates = Object.values(DAILY_AUGMENT_DATA)
    .filter((augment) => augment?.tier === targetTier && !excludedIds.has(augment.id))
    .sort((a, b) =>
      hashStringToUint32(`daily-augment-grant:${dayKey}:${userKey}:${sourceAugmentId}:${a.id}`)
      - hashStringToUint32(`daily-augment-grant:${dayKey}:${userKey}:${sourceAugmentId}:${b.id}`)
    );
  return candidates[0]?.id || '';
}

function getResolvedDailyAugmentIds(user, now = new Date()) {
  ensureDailyAugmentState(user, now);
  const dayKey = user?.meta?.dailyAugmentDayKey || getKSTDateKey(now);
  const selectedId = String(user?.meta?.dailyAugmentSelectedId || '');
  if (!DAILY_AUGMENT_DATA[selectedId]) return [];

  const ids = [];
  const seen = new Set();
  let currentId = selectedId;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!currentId || seen.has(currentId) || !DAILY_AUGMENT_DATA[currentId]) break;
    ids.push(currentId);
    seen.add(currentId);
    const grantTier = DAILY_AUGMENT_DATA[currentId]?.effects?.grantTier;
    if (!grantTier) break;
    const seedKey = String(user?.meta?.dailyAugmentSeedKey || getDailyAugmentSeedKey(user, dayKey));
    currentId = getDailyGrantedAugmentId(user, seedKey, currentId, grantTier, seen);
  }
  return ids;
}

function getDailyAugmentEffectTotals(user, now = new Date()) {
  const totals = {
    moneyBonus: 0,
    expBonus: 0,
    stockFeeReduction: 0,
    infiniteOvertimeRewardBonus: 0,
    raidRewardBonus: 0,
    pvpWinRatingBonus: 0,
    raidDamageBonusPercent: 0,
    raidHealShieldBonusPercent: 0,
    raidTurn3DamageBonusPercent: 0,
    raidRewardOnceBonusPercent: 0,
    itemCopyChance: 0,
    raidFreeEntries: 0,
    shopOnceDiscountPercent: 0,
    stressHighExpBonus: 0,
    adventureFirstRewardMultiplier: 0,
    adventureSecondRewardBlocked: 0,
    hourlyStamina: 0,
    hourlyStaminaLimit: 0,
    logoutBacchusChance: 0,
    workClickRewardBonusPercent: 0,
    workClickStressBonusPercent: 0,
    bossHitReflectChance: 0,
    bossHitReflectLevelMultiplier: 0,
    shoutNoCooldown: 0,
    adventureExecutiveRewardBonusPercent: 0,
    raidEveningRewardBonus: 0,
    raidItemBonusChance: 0,
    raidItemBonusAmount: 0,
    raidItemBonusLimit: 0,
    staminaZeroRestore: 0,
    staminaZeroRestoreLimit: 0,
    pvpTopDamageBonusPercent: 0,
    nonTopExpBonusPercent: 0,
    debuffNullifyChance: 0,
    eveningExpBonus: 0,
    adventureNegativeChanceBonus: 0,
    adventurePositiveRewardBonusPercent: 0,
    idleExpPercentPer10m: 0,
    rewardDoubleChoiceCharges: 0,
    adventureRerollCharges: 0,
    chairmanMoodTicket: 0,
    raidTomorrowPenaltyPercent: 0,
    infiniteOvertimeDefeatRewardPercent: 0,
    shopDiscountPercent: 0,
    expPenaltyPercent: 0,
    instantLevelUpChanceBonus: 0,
    workDropExtraAttempts: 0,
    maxStaminaBonus: 0
  };

  getResolvedDailyAugmentIds(user, now).forEach((augmentId) => {
    const effects = DAILY_AUGMENT_DATA[augmentId]?.effects || {};
    Object.keys(totals).forEach((key) => {
      totals[key] += Number(effects[key] || 0);
    });
  });

  totals.stockFeeReduction = Math.min(100, Math.max(0, totals.stockFeeReduction));
  Object.keys(totals).forEach((key) => {
    totals[key] = Number(totals[key].toFixed(4));
  });
  return totals;
}

function getKSTNextMidnight(now = new Date()) {
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(
    kstNow.getUTCFullYear(),
    kstNow.getUTCMonth(),
    kstNow.getUTCDate() + 1,
    -9,
    0,
    0,
    0
  ));
}

function hasShoutNoCooldownTicket(user, now = new Date()) {
  if (!user?.meta) return false;
  if (hasBuff(user, 'shout_free_ticket_buff', now)) return true;
  const until = user.meta.shoutNoCooldownUntil ? new Date(user.meta.shoutNoCooldownUntil) : null;
  if (!until || !Number.isFinite(until.getTime())) {
    user.meta.shoutNoCooldownUntil = null;
    return false;
  }
  if (until.getTime() <= now.getTime()) {
    user.meta.shoutNoCooldownUntil = null;
    return false;
  }
  return true;
}

function resetDailyAugmentUsageIfNeeded(user, now = new Date()) {
  if (!user?.meta) return;
  const dayKey = getKSTDateKey(now);
  if (user.meta.dailyAugmentRaidFreeEntryDayKey !== dayKey) {
    user.meta.dailyAugmentRaidFreeEntryDayKey = dayKey;
    user.meta.dailyAugmentRaidFreeEntryUsedCount = 0;
  }
  if (user.meta.dailyAugmentHourlyStaminaDayKey !== dayKey) {
    user.meta.dailyAugmentHourlyStaminaDayKey = dayKey;
    user.meta.dailyAugmentHourlyStaminaGrantedCount = 0;
    user.meta.dailyAugmentHourlyStaminaLastAt = now;
  }
}

function getDailyAugmentRaidRewardOnceBonusPercent(user, now = new Date()) {
  const dayKey = getKSTDateKey(now);
  if (user?.meta?.dailyAugmentRaidRewardOnceDayKey === dayKey) return 0;
  return Math.max(0, Number(getDailyAugmentEffectTotals(user, now).raidRewardOnceBonusPercent || 0));
}

function markDailyAugmentRaidRewardOnceUsed(user, now = new Date()) {
  if (!user?.meta) return;
  user.meta.dailyAugmentRaidRewardOnceDayKey = getKSTDateKey(now);
}

function getDailyAugmentShopDiscountPercent(user, now = new Date()) {
  const dayKey = getKSTDateKey(now);
  if (user?.meta?.dailyAugmentShopDiscountDayKey === dayKey) return 0;
  return Math.max(0, Number(getDailyAugmentEffectTotals(user, now).shopOnceDiscountPercent || 0));
}

function markDailyAugmentShopDiscountUsed(user, now = new Date()) {
  if (!user?.meta) return;
  user.meta.dailyAugmentShopDiscountDayKey = getKSTDateKey(now);
}

function applyDailyAugmentShopDiscount(user, price, now = new Date()) {
  const basePrice = Math.max(0, Number(price || 0));
  const discountPercent = getDailyAugmentShopDiscountPercent(user, now);
  if (discountPercent <= 0) return basePrice;
  return Math.max(0, Math.ceil(basePrice * (1 - Math.min(100, discountPercent) / 100)));
}

function ensureDailyAugmentState(user, now = new Date()) {
  if (!user.meta) user.meta = {};
  const dayKey = getKSTDateKey(now);
  const seedKey = getDailyAugmentSeedKey(user, dayKey);
  const tier = getDailyAugmentTier(seedKey);
  const options = getDailyAugmentOptionsForUser(user, seedKey, tier);
  if (user.meta.dailyAugmentVersion !== DAILY_AUGMENT_VERSION) {
    user.meta.dailyAugmentVersion = DAILY_AUGMENT_VERSION;
  }
  user.meta.dailyAugmentRerolledSlots = Array.isArray(user.meta.dailyAugmentRerolledSlots)
    ? [...new Set(user.meta.dailyAugmentRerolledSlots
      .map((slot) => Math.floor(Number(slot)))
      .filter((slot) => Number.isInteger(slot) && slot >= 0 && slot < DAILY_AUGMENT_OPTION_COUNT))]
    : [];
  const savedOptions = Array.isArray(user.meta.dailyAugmentOptions)
    ? user.meta.dailyAugmentOptions.filter((augmentId) => DAILY_AUGMENT_DATA[augmentId]?.tier === tier)
    : [];
  const selectedId = String(user.meta.dailyAugmentSelectedId || '');
  const selectedIsValid = selectedId
    && DAILY_AUGMENT_DATA[selectedId]?.tier === tier
    && savedOptions.includes(selectedId);

  if (user.meta.dailyAugmentDayKey !== dayKey || user.meta.dailyAugmentTier !== tier || user.meta.dailyAugmentSeedKey !== seedKey) {
    user.meta.dailyAugmentDayKey = dayKey;
    user.meta.dailyAugmentTier = tier;
    user.meta.dailyAugmentSeedKey = seedKey;
    user.meta.dailyAugmentVersion = DAILY_AUGMENT_VERSION;
    user.meta.dailyAugmentOptions = options;
    user.meta.dailyAugmentSelectedId = '';
    user.meta.dailyAugmentRerolledSlots = [];
    return;
  }

  if (savedOptions.length < Math.min(DAILY_AUGMENT_OPTION_COUNT, Object.values(DAILY_AUGMENT_DATA).filter((augment) => augment.tier === tier).length)) {
    user.meta.dailyAugmentOptions = options;
    user.meta.dailyAugmentRerolledSlots = [];
  } else {
    user.meta.dailyAugmentOptions = savedOptions;
  }
  if (!selectedIsValid) user.meta.dailyAugmentSelectedId = '';
}

function buildDailyAugmentState(user, now = new Date()) {
  ensureDailyAugmentState(user, now);
  const selectedId = user.meta.dailyAugmentSelectedId || '';
  const options = Array.isArray(user.meta.dailyAugmentOptions) ? user.meta.dailyAugmentOptions : [];
  const activeIds = getResolvedDailyAugmentIds(user, now);
  const grantedIds = activeIds.filter((augmentId) => augmentId !== selectedId);
  return {
    dayKey: user.meta.dailyAugmentDayKey || getKSTDateKey(now),
    tier: user.meta.dailyAugmentTier || getDailyAugmentTier(getDailyAugmentSeedKey(user, getKSTDateKey(now))),
    tierLabel: PVP_AUGMENT_TIER_LABELS[user.meta.dailyAugmentTier] || user.meta.dailyAugmentTier || '실버',
    expiresAt: getNextKSTMidnight(now),
    selectedId,
    selected: serializeDailyAugment(selectedId),
    granted: grantedIds.map((augmentId) => serializeDailyAugment(augmentId, { grantedBy: selectedId })).filter(Boolean),
    active: activeIds.map((augmentId) => serializeDailyAugment(augmentId, augmentId === selectedId ? {} : { grantedBy: selectedId })).filter(Boolean),
    options: options.map(serializeDailyAugment).filter(Boolean),
    rerolledSlots: Array.isArray(user.meta.dailyAugmentRerolledSlots) ? [...user.meta.dailyAugmentRerolledSlots] : [],
    needsSelection: !selectedId
  };
}

function getKSTWeekStartKey(date = new Date()) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const dayOfWeek = kst.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const mondayKstUtcMs = Date.UTC(
    kst.getUTCFullYear(),
    kst.getUTCMonth(),
    kst.getUTCDate() - daysSinceMonday
  );
  return getKSTDateKey(new Date(mondayKstUtcMs - KST_OFFSET_MS));
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

function getCurrentRaidBossId(now = new Date()) {
  const todayKey = getKSTDateKey(now);
  if (raidState.manualBossOverrideDayKey === todayKey && RAID_BOSS_DATA[raidState.manualBossOverrideId]) {
    return raidState.manualBossOverrideId;
  }
  if (raidState.nextDayForcedBossDayKey === todayKey && RAID_BOSS_DATA[raidState.nextDayForcedBossId]) {
    return raidState.nextDayForcedBossId;
  }
  const diff = Math.abs(getDateKeyDiff(todayKey, RAID_BOSS_ROTATION_START_KEY));
  return RAID_BOSS_ROTATION_IDS[diff % RAID_BOSS_ROTATION_IDS.length] || RAID_BOSS_ID;
}

function getCurrentRaidBoss(now = new Date()) {
  return RAID_BOSS_DATA[getCurrentRaidBossId(now)] || RAID_BOSS_DATA[RAID_BOSS_ID];
}

function normalizeRaidMode(mode) {
  if (mode === RAID_MODE_CHAOS) return RAID_MODE_CHAOS;
  return mode === RAID_MODE_HARD ? RAID_MODE_HARD : RAID_MODE_NORMAL;
}

function getRaidAvailableModesForBossId(bossId) {
  return bossId === RAID_BOSS_ID_OVERTIME_MANAGER
    ? [RAID_MODE_NORMAL, RAID_MODE_HARD]
    : RAID_MODE_LIST;
}

function getRaidAvailableModes(now = new Date()) {
  return getRaidAvailableModesForBossId(getCurrentRaidBossId(now));
}

function isRaidModeAvailableForBoss(mode, bossId) {
  return getRaidAvailableModesForBossId(bossId).includes(normalizeRaidMode(mode));
}

function normalizeRaidModeForCurrentBoss(mode, now = new Date()) {
  const normalizedMode = normalizeRaidMode(mode);
  if (getRaidAvailableModes(now).includes(normalizedMode)) return normalizedMode;
  return normalizedMode === RAID_MODE_CHAOS ? RAID_MODE_HARD : RAID_MODE_NORMAL;
}

function ensureRaidRooms() {
  if (!raidState.modes || typeof raidState.modes !== 'object') {
    raidState.modes = {
      [RAID_MODE_NORMAL]: createRaidRoomState(),
      [RAID_MODE_HARD]: createRaidRoomState(),
      [RAID_MODE_CHAOS]: createRaidRoomState()
    };
  }
  RAID_MODE_LIST.forEach((mode) => {
    if (!raidState.modes[mode]) raidState.modes[mode] = createRaidRoomState();
    if (!Array.isArray(raidState.modes[mode].slots)) raidState.modes[mode].slots = Array(RAID_PARTY_SIZE).fill(null);
    if (!Array.isArray(raidState.modes[mode].slotQueuedAt)) raidState.modes[mode].slotQueuedAt = Array(RAID_PARTY_SIZE).fill(null);
    if (raidState.modes[mode].slotQueuedAt.length !== RAID_PARTY_SIZE) {
      raidState.modes[mode].slotQueuedAt = Array.from({ length: RAID_PARTY_SIZE }, (_, index) => raidState.modes[mode].slotQueuedAt[index] || null);
    }
    if (!raidState.modes[mode].viewers || typeof raidState.modes[mode].viewers !== 'object') raidState.modes[mode].viewers = {};
  });
}

function getRaidRoom(mode = RAID_MODE_NORMAL) {
  ensureRaidRooms();
  return raidState.modes[normalizeRaidMode(mode)];
}

function findRaidRoomWithParticipant(userId) {
  ensureRaidRooms();
  return RAID_MODE_LIST
    .map((mode) => ({ mode, room: getRaidRoom(mode) }))
    .find(({ room }) => room.activeBattle && isRaidUserParticipant(room.activeBattle, userId)) || null;
}

function getRaidModeConfig(mode = RAID_MODE_NORMAL) {
  return RAID_MODE_CONFIG[normalizeRaidMode(mode)] || RAID_MODE_CONFIG[RAID_MODE_NORMAL];
}

function getRaidModeFromBattle(activeBattle) {
  return normalizeRaidMode(activeBattle?.mode || RAID_MODE_NORMAL);
}

function hasQueuedRaidUsers(mode = RAID_MODE_NORMAL) {
  return getRaidRoom(mode).slots.some(Boolean);
}

function syncQueuedRaidBoss(now = new Date(), mode = RAID_MODE_NORMAL) {
  const room = getRaidRoom(mode);
  if (!hasQueuedRaidUsers(mode)) {
    room.queuedBossId = null;
    return null;
  }

  if (!RAID_BOSS_DATA[room.queuedBossId]) {
    room.queuedBossId = getCurrentRaidBossId(now);
  }
  return RAID_BOSS_DATA[room.queuedBossId] || getCurrentRaidBoss(now);
}

function pruneExpiredRaidQueue(mode = null, now = new Date()) {
  const modes = mode ? [normalizeRaidMode(mode)] : RAID_MODE_LIST;
  let changed = false;
  modes.forEach((entryMode) => {
    const room = getRaidRoom(entryMode);
    let roomChanged = false;
    room.slots.forEach((slotUserId, index) => {
      if (!slotUserId) {
        room.slotQueuedAt[index] = null;
        return;
      }
      if (!room.slotQueuedAt[index]) {
        room.slotQueuedAt[index] = now;
        roomChanged = true;
        return;
      }
      const queuedAtMs = new Date(room.slotQueuedAt[index]).getTime();
      if (!Number.isFinite(queuedAtMs) || now.getTime() - queuedAtMs >= RAID_QUEUE_TIMEOUT_MS) {
        room.slots[index] = null;
        room.slotQueuedAt[index] = null;
        roomChanged = true;
      }
    });
    if (roomChanged) {
      syncQueuedRaidBoss(now, entryMode);
      changed = true;
    }
  });
  if (changed) bumpRaidVersion();
  return changed;
}

function getRaidQueueRemainingMs(userId, mode = RAID_MODE_NORMAL, now = new Date()) {
  const room = getRaidRoom(mode);
  const slotIndex = findQueuedRaidSlotIndex(userId, mode);
  if (slotIndex < 0) return null;
  const queuedAt = room.slotQueuedAt?.[slotIndex] || now;
  const queuedAtMs = new Date(queuedAt).getTime();
  if (!Number.isFinite(queuedAtMs)) return RAID_QUEUE_TIMEOUT_MS;
  return Math.max(0, RAID_QUEUE_TIMEOUT_MS - (now.getTime() - queuedAtMs));
}

function getRaidLobbyBoss(now = new Date(), mode = RAID_MODE_NORMAL) {
  const room = getRaidRoom(mode);
  if (room.activeBattle?.bossId && RAID_BOSS_DATA[room.activeBattle.bossId]) {
    return RAID_BOSS_DATA[room.activeBattle.bossId];
  }
  return syncQueuedRaidBoss(now, mode) || getCurrentRaidBoss(now);
}

function getAlternateRaidBossId(selectedBossId) {
  return RAID_BOSS_ROTATION_IDS.find((bossId) => bossId !== selectedBossId) || selectedBossId;
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
  user.gameState.stress = clampStressValue(user.gameState.stress ?? 0);
  user.gameState.moneyCarry = Number(user.gameState.moneyCarry ?? 0);
  user.gameState.passiveExpCarry = Number(user.gameState.passiveExpCarry ?? 0);
  user.gameState.lastActionTime = user.gameState.lastActionTime || new Date();
  user.gameState.lastStaminaResetTime = user.gameState.lastStaminaResetTime || new Date();

  if (!Array.isArray(user.inventory)) user.inventory = [];
  const normalizedInventory = [];
  const inventoryTotals = new Map();
  for (const entry of user.inventory) {
    if (!entry || !entry.itemId) continue;
    const itemId = String(entry.itemId);
    const quantity = Math.max(0, Math.floor(Number(entry.quantity) || 0));
    if (quantity <= 0) continue;
    inventoryTotals.set(itemId, (inventoryTotals.get(itemId) || 0) + quantity);
  }
  for (const [itemId, quantity] of inventoryTotals.entries()) {
    normalizedInventory.push({ itemId, quantity });
  }
  const inventoryChanged = normalizedInventory.length !== user.inventory.length
    || normalizedInventory.some((entry, index) =>
      !user.inventory[index]
      || user.inventory[index].itemId !== entry.itemId
      || Number(user.inventory[index].quantity) !== entry.quantity
    );
  if (inventoryChanged) {
    user.inventory = normalizedInventory;
  }
  if (!Array.isArray(user.cards)) user.cards = [];
  if (!Array.isArray(user.enhancedCards)) user.enhancedCards = [];
  if (!Array.isArray(user.lockedCards)) user.lockedCards = [];
  if (!Array.isArray(user.equipments)) user.equipments = [];
  if (!user.equippedEquipment || typeof user.equippedEquipment !== 'object') {
    user.equippedEquipment = { cardEffect: null, basicAttack: null };
  }
  user.equippedEquipment.cardEffect = user.equippedEquipment.cardEffect || null;
  user.equippedEquipment.basicAttack = user.equippedEquipment.basicAttack || null;
  if (!CARD_DATA[user.equippedCardId]) user.equippedCardId = null;
  user.equippedCardLevel = Math.max(0, Math.min(5, Number(user.equippedCardLevel ?? 0)));
  if (!user.raidExtraCardSelection || typeof user.raidExtraCardSelection !== 'object') {
    user.raidExtraCardSelection = { cardId: null, level: 0 };
  }
  user.raidExtraCardSelection.cardId = CARD_DATA[user.raidExtraCardSelection.cardId]
    ? user.raidExtraCardSelection.cardId
    : null;
  user.raidExtraCardSelection.level = normalizeCardEnhancementLevel(user.raidExtraCardSelection.level || 0);
  if (!user.pvpStats || typeof user.pvpStats !== 'object') {
    user.pvpStats = { rating: 1000, played: 0, wins: 0, losses: 0 };
  }
  user.pvpStats.rating = Math.max(0, Math.round(Number(user.pvpStats.rating ?? 1000)));
  user.pvpStats.played = Math.max(0, Math.floor(Number(user.pvpStats.played ?? 0)));
  user.pvpStats.wins = Math.max(0, Math.floor(Number(user.pvpStats.wins ?? 0)));
  user.pvpStats.losses = Math.max(0, Math.floor(Number(user.pvpStats.losses ?? 0)));
  user.pvpStats.lastWeeklyRewardWeekKey = user.pvpStats.lastWeeklyRewardWeekKey || '';
  if (!user.infiniteOvertime || typeof user.infiniteOvertime !== 'object') {
    user.infiniteOvertime = {
      defensePreset: [],
      defenseScore: 0,
      attackDeck: [],
      active: false,
      nextFloor: 1,
      lastAttemptAt: null,
      lastCompletedAt: null
    };
  }
  const normalizeOvertimeDeck = (deck) => (Array.isArray(deck) ? deck : [])
    .filter((entry) => entry && CARD_DATA[entry.cardId] && !CARD_DATA[entry.cardId].pvpDisabled)
    .slice(0, 5)
    .map((entry) => ({
      cardId: String(entry.cardId),
      enhancementLevel: normalizeCardEnhancementLevel(entry.enhancementLevel || entry.level || 0)
    }));
  user.infiniteOvertime.defensePreset = normalizeOvertimeDeck(user.infiniteOvertime.defensePreset);
  user.infiniteOvertime.defenseScore = Math.max(0, Math.floor(Number(user.infiniteOvertime.defenseScore || 0)));
  user.infiniteOvertime.attackDeck = normalizeOvertimeDeck(user.infiniteOvertime.attackDeck);
  user.infiniteOvertime.active = Boolean(user.infiniteOvertime.active);
  user.infiniteOvertime.nextFloor = Math.max(1, Math.min(INFINITE_OVERTIME_MAX_FLOOR, Math.floor(Number(user.infiniteOvertime.nextFloor || 1))));
  user.infiniteOvertime.lastAttemptAt = user.infiniteOvertime.lastAttemptAt || null;
  user.infiniteOvertime.lastCompletedAt = user.infiniteOvertime.lastCompletedAt || null;
  if (!Array.isArray(user.buffs)) user.buffs = [];
  if (!Array.isArray(user.pendingNotifications)) user.pendingNotifications = [];

  if (!user.titles) {
    user.titles = { unlocked: [], equipped: null };
  }
  if (!Array.isArray(user.titles.unlocked)) user.titles.unlocked = [];
  if (!Object.prototype.hasOwnProperty.call(user.titles, 'equipped')) {
    user.titles.equipped = null;
  }
  if (!user.emblems) {
    user.emblems = { unlocked: [], equipped: null };
  }
  if (!Array.isArray(user.emblems.unlocked)) user.emblems.unlocked = [];
  user.emblems.unlocked = [...new Set(user.emblems.unlocked.filter((emblemId) => EMBLEM_DATA[emblemId]))];
  if (!EMBLEM_DATA[user.emblems.equipped]) {
    user.emblems.equipped = null;
  }

  if (!user.pendingStockInvestment || typeof user.pendingStockInvestment !== 'object') {
    user.pendingStockInvestment = { amount: 0, investedOn: null };
  }
  user.pendingStockInvestment.amount = Number(user.pendingStockInvestment.amount ?? 0);
  user.pendingStockInvestment.investedOn = user.pendingStockInvestment.investedOn || null;

  user.stockPortfolio = normalizeStockPortfolio(user.stockPortfolio);
  ensureStockTournamentState(user);

  if (!user.shopState) {
    user.shopState = {
      dayKey: null,
      dailySpend: 0,
      dailyBusinessCardPurchases: 0,
      dailyBacchusPurchases: 0,
      dailyHot6Purchases: 0,
      dailyFragmentRaidTicketPurchases: 0,
      dailyFragmentBusinessCardPurchases: 0,
      weeklyFragmentExpPotionWeekKey: '',
      weeklyFragmentExpPotionPurchases: 0,
      dailyFragmentCatButlerEmblemPurchases: 0,
      dailyFragmentTigerEmblemPurchases: 0,
      dailyFragmentIdolEmblemPurchases: 0,
      dailyFragmentBitchNotEmblemPurchases: 0,
      dailyFragmentRuinedBearEmblemPurchases: 0,
      lastShoppingAddictQualifiedDayKey: null
    };
  }
  user.shopState.dayKey = user.shopState.dayKey || null;
  user.shopState.dailySpend = Number(user.shopState.dailySpend ?? 0);
  user.shopState.dailyBusinessCardPurchases = Number(user.shopState.dailyBusinessCardPurchases ?? 0);
  user.shopState.dailyBacchusPurchases = Number(user.shopState.dailyBacchusPurchases ?? 0);
  user.shopState.dailyHot6Purchases = Number(user.shopState.dailyHot6Purchases ?? 0);
  user.shopState.dailyFragmentRaidTicketPurchases = Number(user.shopState.dailyFragmentRaidTicketPurchases ?? 0);
  user.shopState.dailyFragmentBusinessCardPurchases = Number(user.shopState.dailyFragmentBusinessCardPurchases ?? 0);
  user.shopState.weeklyFragmentExpPotionWeekKey = user.shopState.weeklyFragmentExpPotionWeekKey || '';
  user.shopState.weeklyFragmentExpPotionPurchases = Number(user.shopState.weeklyFragmentExpPotionPurchases ?? 0);
  user.shopState.dailyFragmentCatButlerEmblemPurchases = Number(user.shopState.dailyFragmentCatButlerEmblemPurchases ?? 0);
  user.shopState.dailyFragmentTigerEmblemPurchases = Number(user.shopState.dailyFragmentTigerEmblemPurchases ?? 0);
  user.shopState.dailyFragmentIdolEmblemPurchases = Number(user.shopState.dailyFragmentIdolEmblemPurchases ?? 0);
  user.shopState.dailyFragmentBitchNotEmblemPurchases = Number(user.shopState.dailyFragmentBitchNotEmblemPurchases ?? 0);
  user.shopState.dailyFragmentRuinedBearEmblemPurchases = Number(user.shopState.dailyFragmentRuinedBearEmblemPurchases ?? 0);
  user.shopState.lastShoppingAddictQualifiedDayKey = user.shopState.lastShoppingAddictQualifiedDayKey || null;

  normalizeBranchOffice(user);

  if (!user.meta) {
    user.meta = {
      loginCount: 0,
      lastLoginAt: null,
      lastSeenAt: null,
      lastShoutAt: null,
      shoutNoCooldownUntil: null,
      lastRaidDayKey: null,
      raidEntryDayKey: null,
      raidEntryUsedCount: 0,
      raidEntryBonusCount: 0,
      dailyAugmentRaidFreeEntryDayKey: '',
      dailyAugmentRaidFreeEntryUsedCount: 0,
      dailyAugmentRaidRewardOnceDayKey: '',
      dailyAugmentShopDiscountDayKey: '',
      lastRaidEntryConsumeType: '',
      dailyAugmentVersion: '',
      catFoodGivenCount: 0,
      lastTitleChangeDayKey: null,
      lastWorkOptimizationAt: null,
      workOptimizationSkillNotified: false,
      newsTypingAntiCheat: {
        lastSubmittedAt: null,
        intervalsMs: [],
        speedSamples: [],
        suspiciousScore: 0,
        penaltyUntil: null,
        lastIp: ''
      },
      workClickAntiCheat: {
        lastSubmittedAt: null,
        intervalsMs: [],
        suspiciousScore: 0,
        penaltyUntil: null,
        lastIp: ''
      },
      lastAdventureAt: null,
      lastAdventureLog: '',
      potatoRehabDamage: POTATO_REHAB_BASE_DAMAGE,
      potatoRehabKillCount: 0,
      dailyAugmentDayKey: '',
      dailyAugmentTier: '',
      dailyAugmentSeedKey: '',
      dailyAugmentResetSeed: '',
      dailyAugmentResetDayKey: '',
      dailyAugmentOptions: [],
      dailyAugmentSelectedId: '',
      dailyAugmentRerolledSlots: []
    };
  }
  user.meta.loginCount = Number(user.meta.loginCount ?? 0);
  user.meta.lastLoginAt = user.meta.lastLoginAt || null;
  user.meta.lastSeenAt = user.meta.lastSeenAt || null;
  user.meta.lastShoutAt = user.meta.lastShoutAt || null;
  user.meta.shoutNoCooldownUntil = user.meta.shoutNoCooldownUntil || null;
  user.meta.lastRaidDayKey = user.meta.lastRaidDayKey || null;
  user.meta.raidEntryDayKey = user.meta.raidEntryDayKey || null;
  user.meta.raidEntryUsedCount = Number(user.meta.raidEntryUsedCount ?? 0);
  user.meta.raidEntryBonusCount = Number(user.meta.raidEntryBonusCount ?? 0);
  user.meta.dailyAugmentRaidFreeEntryDayKey = user.meta.dailyAugmentRaidFreeEntryDayKey || '';
  user.meta.dailyAugmentRaidFreeEntryUsedCount = Math.max(0, Number(user.meta.dailyAugmentRaidFreeEntryUsedCount ?? 0));
  user.meta.dailyAugmentRaidRewardOnceDayKey = user.meta.dailyAugmentRaidRewardOnceDayKey || '';
  user.meta.dailyAugmentShopDiscountDayKey = user.meta.dailyAugmentShopDiscountDayKey || '';
  user.meta.dailyAugmentHourlyStaminaDayKey = user.meta.dailyAugmentHourlyStaminaDayKey || '';
  user.meta.dailyAugmentHourlyStaminaGrantedCount = Math.max(0, Number(user.meta.dailyAugmentHourlyStaminaGrantedCount ?? 0));
  user.meta.dailyAugmentHourlyStaminaLastAt = user.meta.dailyAugmentHourlyStaminaLastAt || null;
  user.meta.lastRaidEntryConsumeType = user.meta.lastRaidEntryConsumeType || '';
  user.meta.dailyAugmentVersion = user.meta.dailyAugmentVersion || '';
  user.meta.catFoodGivenCount = Number(user.meta.catFoodGivenCount ?? 0);
  user.meta.lastTitleChangeDayKey = user.meta.lastTitleChangeDayKey || null;
  user.meta.lastWorkOptimizationAt = user.meta.lastWorkOptimizationAt || null;
  user.meta.workOptimizationSkillNotified = Boolean(user.meta.workOptimizationSkillNotified);
  if (!user.meta.newsTypingAntiCheat || typeof user.meta.newsTypingAntiCheat !== 'object') {
    user.meta.newsTypingAntiCheat = {
      lastSubmittedAt: null,
      intervalsMs: [],
      speedSamples: [],
      suspiciousScore: 0,
      penaltyUntil: null,
      lastIp: ''
    };
  }
  user.meta.newsTypingAntiCheat.lastSubmittedAt = user.meta.newsTypingAntiCheat.lastSubmittedAt || null;
  user.meta.newsTypingAntiCheat.intervalsMs = Array.isArray(user.meta.newsTypingAntiCheat.intervalsMs)
    ? user.meta.newsTypingAntiCheat.intervalsMs.slice(-NEWS_TYPING_ANTICHEAT_INTERVAL_LIMIT).map((value) => Number(value) || 0).filter((value) => value > 0)
    : [];
  user.meta.newsTypingAntiCheat.speedSamples = Array.isArray(user.meta.newsTypingAntiCheat.speedSamples)
    ? user.meta.newsTypingAntiCheat.speedSamples.slice(-NEWS_TYPING_ANTICHEAT_INTERVAL_LIMIT).map((value) => Number(value) || 0).filter((value) => value > 0)
    : [];
  user.meta.newsTypingAntiCheat.suspiciousScore = Math.max(0, Number(user.meta.newsTypingAntiCheat.suspiciousScore ?? 0));
  user.meta.newsTypingAntiCheat.penaltyUntil = user.meta.newsTypingAntiCheat.penaltyUntil || null;
  user.meta.newsTypingAntiCheat.lastIp = user.meta.newsTypingAntiCheat.lastIp || '';
  if (!user.meta.workClickAntiCheat || typeof user.meta.workClickAntiCheat !== 'object') {
    user.meta.workClickAntiCheat = {
      lastSubmittedAt: null,
      intervalsMs: [],
      suspiciousScore: 0,
      penaltyUntil: null,
      lastIp: ''
    };
  }
  user.meta.workClickAntiCheat.lastSubmittedAt = user.meta.workClickAntiCheat.lastSubmittedAt || null;
  user.meta.workClickAntiCheat.intervalsMs = Array.isArray(user.meta.workClickAntiCheat.intervalsMs)
    ? user.meta.workClickAntiCheat.intervalsMs.slice(-WORK_CLICK_ANTICHEAT_INTERVAL_LIMIT).map((value) => Number(value) || 0).filter((value) => value > 0)
    : [];
  user.meta.workClickAntiCheat.suspiciousScore = Math.max(0, Number(user.meta.workClickAntiCheat.suspiciousScore ?? 0));
  user.meta.workClickAntiCheat.penaltyUntil = user.meta.workClickAntiCheat.penaltyUntil || null;
  user.meta.workClickAntiCheat.lastIp = user.meta.workClickAntiCheat.lastIp || '';
  user.meta.lastAdventureAt = user.meta.lastAdventureAt || null;
  user.meta.lastAdventureLog = user.meta.lastAdventureLog || '';
  user.meta.potatoRehabDamage = Math.max(
    POTATO_REHAB_BASE_DAMAGE,
    Math.floor(Number(user.meta.potatoRehabDamage || POTATO_REHAB_BASE_DAMAGE))
  );
  user.meta.potatoRehabKillCount = Math.max(0, Math.floor(Number(user.meta.potatoRehabKillCount || 0)));
  user.meta.dailyAugmentDayKey = user.meta.dailyAugmentDayKey || '';
  user.meta.dailyAugmentSeedKey = user.meta.dailyAugmentSeedKey || '';
  user.meta.dailyAugmentResetSeed = user.meta.dailyAugmentResetSeed || '';
  user.meta.dailyAugmentResetDayKey = user.meta.dailyAugmentResetDayKey || '';
  user.meta.dailyAugmentTier = PVP_AUGMENT_TIER_LABELS[user.meta.dailyAugmentTier] ? user.meta.dailyAugmentTier : '';
  user.meta.dailyAugmentOptions = Array.isArray(user.meta.dailyAugmentOptions)
    ? user.meta.dailyAugmentOptions.filter((augmentId) => DAILY_AUGMENT_DATA[augmentId])
    : [];
  user.meta.dailyAugmentSelectedId = DAILY_AUGMENT_DATA[user.meta.dailyAugmentSelectedId]
    ? user.meta.dailyAugmentSelectedId
    : '';
  user.meta.dailyAugmentRerolledSlots = Array.isArray(user.meta.dailyAugmentRerolledSlots)
    ? [...new Set(user.meta.dailyAugmentRerolledSlots
      .map((slot) => Math.floor(Number(slot)))
      .filter((slot) => Number.isInteger(slot) && slot >= 0 && slot < DAILY_AUGMENT_OPTION_COUNT))]
    : [];
  ensureDailyAugmentState(user);
  resetDailyAugmentUsageIfNeeded(user);

  if (!user.pendingAdventure || typeof user.pendingAdventure !== 'object') {
    user.pendingAdventure = {
      eventId: null,
      location: null,
      actor: null,
      message: null,
      createdAt: null
    };
  }
  user.pendingAdventure.eventId = user.pendingAdventure.eventId || null;
  user.pendingAdventure.location = user.pendingAdventure.location || null;
  user.pendingAdventure.actor = user.pendingAdventure.actor || null;
  user.pendingAdventure.message = user.pendingAdventure.message || null;
  user.pendingAdventure.createdAt = user.pendingAdventure.createdAt || null;

  const normalizedEnhancedCards = [];
  let enhancedCardsChanged = false;
  user.enhancedCards.forEach((entry) => {
    if (!CARD_DATA[entry.cardId] || Number(entry.level) <= 0 || Number(entry.quantity) <= 0) {
      enhancedCardsChanged = true;
      return;
    }

    const normalizedLevel = Math.max(1, Math.min(5, Number(entry.level)));
    const normalizedQuantity = Math.max(1, Math.floor(Number(entry.quantity)));
    if (normalizedLevel !== Number(entry.level) || normalizedQuantity !== Number(entry.quantity)) {
      enhancedCardsChanged = true;
    }

    normalizedEnhancedCards.push({
      cardId: entry.cardId,
      level: normalizedLevel,
      quantity: normalizedQuantity
    });
  });
  if (normalizedEnhancedCards.length !== user.enhancedCards.length) {
    enhancedCardsChanged = true;
  }
  if (enhancedCardsChanged) {
    user.enhancedCards = normalizedEnhancedCards;
  }

  const normalizedEquipments = [];
  const seenEquipmentIds = new Set();
  let equipmentsChanged = false;
  user.equipments.forEach((entry) => {
    if (!entry?.equipmentId || seenEquipmentIds.has(String(entry.equipmentId))) {
      equipmentsChanged = true;
      return;
    }
    const equipmentType = entry.equipmentType === EQUIPMENT_TYPE_ATTACK ? EQUIPMENT_TYPE_ATTACK : EQUIPMENT_TYPE_CARD;
    const statValue = Number(entry.statValue || 0);
    const upgradesLeft = Math.max(0, Math.floor(Number(entry.upgradesLeft ?? 7)));
    if (!Number.isFinite(statValue) || statValue <= 0) {
      equipmentsChanged = true;
      return;
    }
    seenEquipmentIds.add(String(entry.equipmentId));
    normalizedEquipments.push({
      equipmentId: String(entry.equipmentId),
      equipmentType,
      statValue: Number(statValue.toFixed(2)),
      upgradesLeft
    });
  });
  if (normalizedEquipments.length !== user.equipments.length) {
    equipmentsChanged = true;
  }
  if (equipmentsChanged) {
    user.equipments = normalizedEquipments;
  }
  normalizeSingleEquippedEquipment(user);

  migrateLegacyBuffs(user);
  if (user.equippedCardId && getOwnedCardVariantQuantity(user, user.equippedCardId, user.equippedCardLevel || 0) <= 0) {
    user.equippedCardId = null;
    user.equippedCardLevel = 0;
  }
  user.lockedCards = (user.lockedCards || [])
    .filter((entry) => entry && CARD_DATA[entry.cardId])
    .map((entry) => ({
      cardId: String(entry.cardId),
      level: normalizeCardEnhancementLevel(entry.level || 0)
    }))
    .filter((entry, index, list) =>
      getOwnedCardVariantQuantity(user, entry.cardId, entry.level) > 0
      && list.findIndex((candidate) => candidate.cardId === entry.cardId && Number(candidate.level) === Number(entry.level)) === index
    );
  if (
    user.raidExtraCardSelection.cardId
    && (
      getOwnedCardVariantQuantity(user, user.raidExtraCardSelection.cardId, user.raidExtraCardSelection.level || 0) <= 0
      || user.equippedCardId === user.raidExtraCardSelection.cardId
    )
  ) {
    user.raidExtraCardSelection = { cardId: null, level: 0 };
  }
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

function normalizeCardEnhancementLevel(level) {
  return Math.max(0, Math.min(5, Math.floor(Number(level) || 0)));
}

function isPenShopItemId(itemId) {
  return PEN_SHOP_ITEM_IDS.includes(itemId);
}

function getRewardVariantItemId(itemId) {
  return PEN_REWARD_ITEM_MAP[itemId] || itemId;
}

function buildEquipmentDisplayName(entry) {
  if (!entry) return '장비';
  return entry.equipmentType === EQUIPMENT_TYPE_CARD
    ? '장비: 카드 효과 증폭'
    : '장비: 기본 공격력 증폭';
}

function buildEquipmentDescription(entry) {
  if (!entry) return '';
  if (entry.equipmentType === EQUIPMENT_TYPE_CARD) {
    return `카드 효과 +${Number(entry.statValue || 0).toFixed(1)}% / 남은 업그레이드 ${Number(entry.upgradesLeft || 0)}회 / 턴 수 증가나 타수 증가 버프에는 적용되지 않습니다.`;
  }
  return `기본 공격력 +${Number(entry.statValue || 0).toFixed(1)}% / 남은 업그레이드 ${Number(entry.upgradesLeft || 0)}회`;
}

function createEquipmentEntry(equipmentType) {
  const min = equipmentType === EQUIPMENT_TYPE_CARD ? 3 : 3.5;
  const max = equipmentType === EQUIPMENT_TYPE_CARD ? 7 : 6.5;
  const raw = min + (Math.random() * (max - min));
  return {
    equipmentId: new mongoose.Types.ObjectId().toString(),
    equipmentType,
    statValue: Number(raw.toFixed(1)),
    upgradesLeft: 7
  };
}

function cloneEquipmentEntry(entry, options = {}) {
  return {
    equipmentId: options.preserveId && entry.equipmentId ? String(entry.equipmentId) : new mongoose.Types.ObjectId().toString(),
    equipmentType: entry.equipmentType,
    statValue: Number(entry.statValue || 0),
    upgradesLeft: Number(entry.upgradesLeft || 0)
  };
}

function getRandomEquipmentScrollItemId() {
  const scrollItemIds = Object.keys(EQUIPMENT_SCROLL_RULES);
  return scrollItemIds[Math.floor(Math.random() * scrollItemIds.length)] || null;
}

function getEquipmentById(user, equipmentId) {
  return (user.equipments || []).find((entry) => String(entry.equipmentId) === String(equipmentId));
}

function normalizeSingleEquippedEquipment(user) {
  if (!user.equippedEquipment || typeof user.equippedEquipment !== 'object') {
    user.equippedEquipment = { cardEffect: null, basicAttack: null };
  }

  const equippedCardEffect = user.equippedEquipment.cardEffect
    ? getEquipmentById(user, user.equippedEquipment.cardEffect)
    : null;
  const equippedBasicAttack = user.equippedEquipment.basicAttack
    ? getEquipmentById(user, user.equippedEquipment.basicAttack)
    : null;
  const singleEquipped = equippedCardEffect || equippedBasicAttack || null;

  user.equippedEquipment.cardEffect =
    singleEquipped?.equipmentType === EQUIPMENT_TYPE_CARD ? singleEquipped.equipmentId : null;
  user.equippedEquipment.basicAttack =
    singleEquipped?.equipmentType === EQUIPMENT_TYPE_ATTACK ? singleEquipped.equipmentId : null;

  return singleEquipped;
}

function clearEquippedEquipment(user) {
  if (!user.equippedEquipment || typeof user.equippedEquipment !== 'object') {
    user.equippedEquipment = { cardEffect: null, basicAttack: null };
    return;
  }
  user.equippedEquipment.cardEffect = null;
  user.equippedEquipment.basicAttack = null;
}

function getEquippedEquipment(user) {
  return normalizeSingleEquippedEquipment(user);
}

function buildEquipmentDetails(user) {
  const equippedEquipment = getEquippedEquipment(user);
  const equippedEquipmentId = equippedEquipment?.equipmentId || null;
  return (user.equipments || []).map((entry) => ({
    equipmentId: entry.equipmentId,
    equipmentType: entry.equipmentType,
    name: buildEquipmentDisplayName(entry),
    statValue: Number(entry.statValue || 0),
    upgradesLeft: Number(entry.upgradesLeft || 0),
    desc: buildEquipmentDescription(entry),
    equipped: equippedEquipmentId === entry.equipmentId
  }));
}

function getMarketplaceListingExpiresAt(listing) {
  const createdAt = listing?.createdAt ? new Date(listing.createdAt) : new Date();
  return new Date(createdAt.getTime() + MARKETPLACE_LISTING_TTL_MS);
}

async function expireMarketplaceListings(now = new Date()) {
  const cutoff = new Date(now.getTime() - MARKETPLACE_LISTING_TTL_MS);
  await MarketplaceListing.updateMany(
    { status: 'active', createdAt: { $lte: cutoff } },
    { $set: { status: 'expired', expiredAt: now } }
  );
}

function buildMarketplaceListingDetail(listing, currentUserId = null, now = new Date()) {
  const plainListing = listing.toObject ? listing.toObject() : listing;
  const expiresAt = getMarketplaceListingExpiresAt(plainListing);
  const remainingMs = Math.max(0, expiresAt.getTime() - now.getTime());
  return {
    id: String(plainListing._id),
    itemType: plainListing.itemType,
    itemId: plainListing.itemId,
    itemName: plainListing.itemName,
    description: plainListing.description,
    quantity: Number(plainListing.quantity || 1),
    equipment: plainListing.equipmentSnapshot || null,
    price: Number(plainListing.price || 0),
    status: plainListing.status,
    createdAt: plainListing.createdAt,
    expiresAt,
    remainingMs,
    soldAt: plainListing.soldAt,
    settledAt: plainListing.settledAt,
    expiredAt: plainListing.expiredAt,
    recallable: plainListing.status === 'expired',
    mine: currentUserId ? String(plainListing.sellerId) === String(currentUserId) : false
  };
}

async function buildMarketplaceResponse(userId, now = new Date()) {
  await expireMarketplaceListings(now);
  const cutoff = new Date(now.getTime() - MARKETPLACE_LISTING_TTL_MS);
  const activeListings = await MarketplaceListing.find({ status: 'active', createdAt: { $gt: cutoff } })
    .sort({ createdAt: -1 })
    .limit(300);
  const myListings = userId
    ? await MarketplaceListing.find({
        sellerId: userId,
        status: { $in: ['active', 'sold', 'settling', 'expired'] }
      }).sort({ createdAt: -1 }).limit(300)
    : [];

  return {
    active: activeListings.map((listing) => buildMarketplaceListingDetail(listing, userId, now)),
    mine: myListings.map((listing) => buildMarketplaceListingDetail(listing, userId, now))
  };
}

async function getMarketplaceSoldPendingCount(userId) {
  if (!userId) return 0;
  return MarketplaceListing.countDocuments({ sellerId: userId, status: 'sold' });
}

function getCardEnhancementStepValue(stepMap, level, fallbackValue) {
  if (!stepMap || typeof stepMap !== 'object') return fallbackValue;
  const normalizedLevel = normalizeCardEnhancementLevel(level);
  let resolved = fallbackValue;
  Object.keys(stepMap)
    .map((key) => Number(key))
    .filter((key) => !Number.isNaN(key))
    .sort((a, b) => a - b)
    .forEach((key) => {
      if (normalizedLevel >= key) resolved = stepMap[key];
    });
  return resolved;
}

function getCardEnhancementColor(level) {
  return CARD_ENHANCE_BORDER_COLORS[normalizeCardEnhancementLevel(level)] || '';
}

function getCardDisplayName(cardId, level = 0) {
  const baseName = CARD_DATA[cardId]?.name || cardId;
  const normalizedLevel = normalizeCardEnhancementLevel(level);
  return normalizedLevel > 0 ? `${baseName} +${normalizedLevel}` : baseName;
}

function getCardDefinition(cardId, enhancementLevel = 0) {
  const baseCard = CARD_DATA[cardId];
  if (!baseCard) return null;
  const level = normalizeCardEnhancementLevel(enhancementLevel);
  const rules = CARD_ENHANCE_RULES[cardId] || {};
  const card = { ...baseCard };

  Object.keys(rules).forEach((field) => {
    card[field] = getCardEnhancementStepValue(rules[field], level, card[field]);
  });

  if (card.id === 'umbrella_copy') {
    card.targetType = card.canSelectCopyTarget ? 'ally' : null;
  }

  card.enhancementLevel = level;
  card.borderColor = getCardEnhancementColor(level);
  if (baseCard.specialStyle === 'champion') {
    card.borderColor = '#f6c453';
  }
  card.displayName = getCardDisplayName(cardId, level);
  return card;
}

function formatCardPercentText(value) {
  const percent = Number(value || 0) * 100;
  return `${Number.isInteger(percent) ? percent : Number(percent.toFixed(1))}%`;
}

function getCardDurationText(cardId, enhancementLevel = 0) {
  const card = getCardDefinition(cardId, enhancementLevel);
  if (!card) return '즉시';

  switch (cardId) {
    case 'ineo_diet':
    case 'parking_master':
    case 'wig':
    case 'chatgpt':
      return '다음 자신의 턴';
    case 'celine_tears':
    case 'sherlock':
    case 'blind_date':
    case 'military_service':
    case 'ride_line':
      return `${card.turns || 1}턴`;
    case 'gangnam_style':
      return `버프 ${card.turns || 1}턴 / 보호막은 해당 턴의 보스 턴까지`;
    case 'click_this_is_click':
      return '전투 종료까지';
    case 'strawberry_latte':
    case 'pho':
      return '해당 턴의 보스 턴까지';
    case 'rebuttal':
    case 'delegate_lee':
    case 'fantasy':
    case 'broken_leg':
    case 'rooftop_pigeons':
      return '즉시';
    case 'nosy_manager':
      return '즉시 / 보호막은 해당 턴의 보스 턴까지';
    case 'precise_strike':
      return '즉시';
    case 'tissue_box':
    case 'coca_cola':
      return `${card.turns || 1}턴`;
    case 'drinking_angle':
    case 'rotation_blind_date':
    case 'lotto_numbers':
      return '전투 종료까지';
    case 'tax_invoice':
      return `공격력 상승 ${card.turns || 1}턴 / 나머지 1회`;
    case 'cider_comment':
    case 'invincible_logic':
      return '1회';
    case 'sunscreen':
      return '1회';
    case 'trial_and_growth':
      return '즉시 / 사용 시 자신의 디버프 제거';
    case 'hoi_overtime':
      return '첫 사용은 쿨타임 없음 / 재사용 시 즉시 폭발 후 쿨타임';
    case 'chunsik_not_hyeji':
      return '즉시';
    case 'after_work_chimek':
      return '즉시 / 피격 무효 1회';
    case 'flexible_blame':
      return `${card.turns || 2}턴`;
    case 'solid_mental':
      return `${card.negateHitCount || 3}회`;
    case 'mingu_champion':
      return `챔피언의 가호 ${card.turns || 2}턴 / 눈부심 ${card.blindTurns || 1}턴`;
    case 'winter_subordinate':
      return `${card.turns || 2}턴`;
    case 'potato_rehab':
      return '보스전 1회 / 면담 선택 불가';
    case 'umbrella_copy':
      return '즉시 / 복사한 카드 효과는 반감';
    case 'neo_pesticide':
      return `${card.turns || 2}턴`;
    case 'tangerine_after_brushing':
      return `${card.turns || 2}턴`;
    case 'neo_self_esteem':
      return '1회';
    case 'mond_parental_leave':
      return '즉시';
    case 'jor_bongo':
      return '1회';
    case 'gossip':
      return '즉시';
    default:
      return '즉시';
  }
}

function buildCardSkillDescription(cardId, enhancementLevel = 0) {
  const card = getCardDefinition(cardId, enhancementLevel);
  if (!card) return '';

  switch (cardId) {
    case 'ineo_diet':
      return `다음 자신의 턴에 기본 공격을 총 ${card.hits}회 합니다. 각 공격은 기본 공격 피해의 90%로 적용됩니다. 다중 적 전투에서는 매 타마다 살아있는 적 중 랜덤 단일 대상을 공격합니다.`;
    case 'gangnam_style':
      return `파티 전원에게 크리티컬률 ${formatCardPercentText(card.critBonus)}와 흥겨움을 부여하고, 해당 턴 보스 턴까지 유지되는 보호막 ${card.shield}을 제공합니다. 흥겨움 중 기본 공격은 2배 타격으로 적용됩니다.`;
    case 'click_this_is_click':
      return `패시브. 전투 시작 시 자신에게 <인턴> 버프를 부여합니다. 인턴 버프를 가진 동안 파티원(자신 포함)이 기본 공격할 때마다 ${formatCardPercentText(card.internChance)} 확률로 함께 기본 공격을 지원합니다. 인턴 지원 공격은 자신의 기본 공격 피해의 ${formatCardPercentText(card.internDamageMultiplier)}로 적용되며, 인턴 지원 공격으로는 다시 인턴이 발동하지 않습니다.`;
    case 'delegate_lee':
      return `현재 입장한 파티원의 전체 레벨 합 x ${card.multiplierPerLevel}의 데미지를 1회 가합니다.`;
    case 'celine_tears':
      return `공격력 ${formatCardPercentText(card.attackBonusPercent)} 증가, 종료 시 자신의 레벨 x ${card.expireDamagePerLevel} 추가 피해`;
    case 'strawberry_latte':
      return `파티 전원에게 해당 턴 보스 턴까지 유지되는 보호막 ${card.shield}을 제공합니다.`;
    case 'rebuttal':
      return `파티원 전체의 HP를 ${card.heal} 회복합니다.${card.includeSelf ? ' 자신도 포함됩니다.' : ' 자신은 제외됩니다.'}`;
    case 'parking_master':
      return `다음 자신의 턴에 기본 공격을 총 ${card.hits}회 합니다. 각 공격은 기본 공격 피해의 90%로 적용됩니다. 다중 적 전투에서는 매 타마다 살아있는 적 중 랜덤 단일 대상을 공격합니다.`;
    case 'tissue_box':
      return `${card.turns}턴 동안 반격합니다. 피격당하면 기본 공격 ${Math.round(Number(card.counterDamageMultiplier || 1) * 100)}% 위력으로 반격합니다.`;
    case 'drinking_angle':
      return `전투 시작 시 파티 전원에게 소주각? 버프를 부여하고, 승리 시 전리품 ${Number(card.rewardMultiplier || 1).toFixed(1)}배를 획득합니다.`;
    case 'tax_invoice':
      return `파티원 2인에게 피격 무효 ${card.negateHitCount}회, 공격력 ${formatCardPercentText(card.attackBonusPercent)} 증가, 디버프 무효 ${card.debuffImmuneCount}회를 제공합니다.`;
    case 'rotation_blind_date':
      return `매 턴 자신을 제외한 파티원 1명에게 카드 효과 x${Number(card.amplifyMultiplier || 1).toFixed(1)} <소개팅 상대>를 부여합니다.`;
    case 'sherlock':
      return `파티 전원의 크리티컬 확률을 ${formatCardPercentText(card.critBonus)} 증가시킵니다.`;
    case 'lotto_numbers':
      return `전투 시작 시 파티 전원에게 <이번엔 될거같아>를 부여하고, 승리 시 ${formatCardPercentText(card.successChance)} 확률로 전리품 3배 또는 보상 없음이 적용됩니다.`;
    case 'blind_date':
      return `랜덤 파티원 1명의 HP를 ${card.selfDamage} 감소시키지만, 다음 턴까지 해당 파티원의 피해를 2배로 증가시킵니다.`;
    case 'fantasy':
      return card.targets >= 99 ? '파티 전원의 모든 디버프를 제거합니다.' : `랜덤 파티원 ${card.targets}명의 모든 디버프를 제거합니다.`;
    case 'broken_leg':
      return `선택한 파티원 1명의 HP를 ${card.heal} 회복시킵니다.`;
    case 'military_service':
      return `이번 턴 자신의 모든 공격에 자신의 레벨 x ${card.bonusPerLevel} 추가 피해를 줍니다.`;
    case 'invincible_logic':
      return `랜덤 파티원 ${card.targets}인에게 피격 무효 ${card.negateHitCount}회를 부여합니다.`;
    case 'ride_line':
      return `랜덤 파티원 ${card.targets}인의 공격력을 ${formatCardPercentText(card.attackBonusPercent)} 증가시킵니다.`;
    case 'wig':
      return `다음 자신의 턴에 기본 공격을 총 ${card.hits}회 합니다. 각 공격은 기본 공격 피해의 90%로 적용됩니다. 다중 적 전투에서는 매 타마다 살아있는 적 중 랜덤 단일 대상을 공격합니다.`;
    case 'chatgpt':
      return `다음 자신의 턴 기본 공격에 더해 자신의 레벨 x ${card.bonusPerLevel} 추가 피해를 입힙니다.`;
    case 'pho':
      return `랜덤 파티원 ${card.targets}명에게 각각 해당 턴 보스 턴까지 유지되는 보호막 ${card.shield}을 제공합니다.`;
    case 'coca_cola':
      return `선택한 파티원 1인의 공격력을 ${formatCardPercentText(card.attackBonusPercent)} 증가시킵니다.`;
    case 'cider_comment':
      return `선택한 파티원 1인에게 디버프 무효 ${card.debuffImmuneCount}회를 제공합니다.`;
    case 'rooftop_pigeons':
      return `자신의 레벨 x ${card.damagePerLevel}의 데미지로 ${card.hits}회 공격합니다. 각 공격은 90% 위력으로 적용되며, 다중 적 전투에서는 적 전체를 공격합니다.`;
    case 'sunscreen':
      return `${card.includeSelf ? '자신 포함 ' : ''}${card.targets >= 99 ? '파티 전원' : `랜덤 팀원 ${card.targets}인`}에게 피격 무효 ${card.negateHitCount}회를 부여합니다.`;
    case 'trial_and_growth':
      return `현재 자신이 가진 버프/디버프 총 갯수 x 레벨 x ${card.multiplierPerStatus}의 피해를 ${card.hits}회 주고, 자신의 모든 디버프를 제거합니다.`;
    case 'hoi_overtime':
      return `상대에게 <야근>을 적용합니다. 첫 사용은 쿨타임이 돌지 않고, 야근 중 기본 공격 피격마다 <내면의 분노>가 쌓입니다. 이후 자신의 턴에 재사용하면 스택 x 레벨 x ${card.rageDamagePerStackPerLevel} 피해를 주고 야근과 스택을 소진한 뒤 쿨타임이 시작됩니다. 야근이 정화되면 폭발 재사용은 불가능해지고 즉시 쿨타임이 시작됩니다.`;
    case 'chunsik_not_hyeji':
      return `지정한 아군 1인의 총 잃은 체력의 ${formatCardPercentText(card.healMissingHpPercent)}를 회복합니다.`;
    case 'after_work_chimek':
      return `파티원 전원의 HP를 10 + 잃은 체력의 ${formatCardPercentText(card.healMissingHpPercent)}만큼 회복하고, 파티원 전원에게 피격 무효 ${card.negateHitCount || 1}회를 부여합니다.`;
    case 'flexible_blame':
      return `지정한 아군 1인에게 ${card.turns || 2}턴 동안 <예? 저요?> 버프를 부여합니다. 상대방은 버프 보유자를 우선 타겟팅하고, 광역/다중 대상 공격에는 버프 보유자가 우선 포함됩니다. 버프 보유자는 받는 최종 피해가 ${formatCardPercentText(card.damageReductionPercent)} 감소합니다.`;
    case 'solid_mental':
      return `자기 자신에게 피격 무효화 ${card.negateHitCount || 3}회를 부여합니다. 피격 무효를 모두 소모한 뒤 쿨타임이 시작됩니다.`;
    case 'mingu_champion':
      return `지정한 파티원 1인에게 보호막 ${card.shield}, ${card.turns}턴 동안 <챔피언의 가호>를 부여하고 상대에게 ${card.blindTurns}턴 동안 <눈부심>을 부여합니다. 챔피언의 가호: 공격력 +${Math.round(Number(card.attackBonusPercent || 0) * 100)}%, 크리티컬 확률 +${Math.round(Number(card.critBonus || 0) * 100)}%. 눈부심: 모든 공격 명중률 ${Math.round(Number(card.blindMissChance || 0.3) * 100)}% 감소.`;
    case 'winter_subordinate':
      return `선택한 파티원 1인에게 ${card.turns}턴 동안 <부하직원 육성>을 부여합니다. 버프 보유자는 가하는 최종 데미지가 ${formatCardPercentText(card.finalDamageBonusPercent)} 증가합니다.`;
    case 'potato_rehab':
      return `보스전에서 현재 데미지 ${Number(card.fixedDamage || POTATO_REHAB_BASE_DAMAGE).toLocaleString()}의 고정 피해를 1회 입힙니다. 노멀 보스에서는 피해와 막타 성장량이 1/3로 적용됩니다. 한 판당 1회만 사용 가능하며, 이 스킬로 적을 처치하면 데미지가 플레이어의 현재 레벨만큼 영구 증가합니다. 개인면담에서는 선택할 수 없고 강화할 수 없습니다.`;
    case 'nosy_manager':
      return '선택한 파티원 1명에게 보호막 ' + card.shield + '을 부여하고, 선택한 단일 적에게 자신의 레벨 x ' + card.damagePerLevel + ' 피해를 ' + (card.hits || 2) + '회 입힙니다.';
    case 'precise_strike':
      return `자신의 레벨 x ${card.multiplierPerLevel}의 데미지를 1회 주며, 방어막을 무시하고 HP에 직접 피해를 입힙니다.`;
    case 'umbrella_copy':
      return `${card.canSelectCopyTarget ? '선택한' : '랜덤'} 파티원 1명의 카드 효과를 ${Math.round(Number(card.copyEffectMultiplier || 0.5) * 100)}%만 적용해 따라 합니다.`;
    case 'neo_pesticide':
      return `상대에게 ${card.turns || 2}턴 동안 <중독>을 적용합니다. 다중 적 전투에서는 적 전체에게 적용됩니다. 중독 중 공격할 때마다 스킬 시전자의 레벨 x ${card.damagePerLevel} 피해를 입습니다. 다단 타격은 매 타마다 적용됩니다.`;
    case 'tangerine_after_brushing':
      return `상대방의 치유 효과를 ${card.turns || 2}턴 동안 ${formatCardPercentText(card.healReductionPercent)} 감소시킵니다.`;
    case 'neo_self_esteem':
      return '자신에게 <자존감> 버프를 1회 부여합니다. 자존감 보유 중 디버프를 받으면 상대에게 반사하고 자존감은 사라집니다. 강화할 수 없는 카드입니다.';
    case 'mond_parental_leave':
      return `파티원 전원의 남은 스킬 쿨타임을 ${card.cooldownReduce || 1}턴 줄입니다. 개인면담에서는 자신의 모든 카드 쿨타임을 줄입니다.`;
    case 'jor_bongo':
      return `파티원들에게 <빵> ${card.breadCount}개를 랜덤 분배합니다. 빵 보유자는 피격 1회당 HP ${card.breadHeal}를 회복하고 빵 1개를 소모합니다.`;
    case 'gossip':
      return `상대방의 버프 1개 또는 횟수형 버프 ${card.removeBuffCount || 1}회를 랜덤으로 제거합니다.`;
    default:
      return card.skillDesc || '';
  }
}

function getPotatoRehabDamage(source) {
  const rawDamage = source?.potatoRehabDamage ?? source?.meta?.potatoRehabDamage;
  return Math.max(POTATO_REHAB_BASE_DAMAGE, Math.floor(Number(rawDamage || POTATO_REHAB_BASE_DAMAGE)));
}

function getPotatoRehabBattleDamage(source, battle) {
  const damage = getPotatoRehabDamage(source);
  return getRaidModeFromBattle(battle) === RAID_MODE_NORMAL
    ? Math.max(1, Math.floor(damage / 3))
    : damage;
}

function getPotatoRehabGrowthIncrement(source, battle) {
  const baseIncrement = Math.max(1, Math.floor(Number(source?.level || source?.gameState?.level || 1)));
  return getRaidModeFromBattle(battle) === RAID_MODE_NORMAL
    ? Math.max(1, Math.floor(baseIncrement / 3))
    : baseIncrement;
}

function getPotatoRehabKillCount(source) {
  const rawCount = source?.potatoRehabKillCount ?? source?.meta?.potatoRehabKillCount;
  return Math.max(0, Math.floor(Number(rawCount || 0)));
}

function getPotatoRehabAuraStrength(source) {
  const killCount = getPotatoRehabKillCount(source);
  if (killCount <= 0) return 0;
  return Number(Math.min(1, 0.12 + (killCount * 0.055)).toFixed(3));
}

function buildUserCardSkillDescription(user, cardId, enhancementLevel = 0) {
  if (cardId !== 'potato_rehab') return buildCardSkillDescription(cardId, enhancementLevel);
  const damage = getPotatoRehabDamage(user);
  const killCount = getPotatoRehabKillCount(user);
  return `보스전에서 현재 데미지 ${damage.toLocaleString()}의 고정 피해를 1회 입힙니다. 노멀 보스에서는 피해와 막타 성장량이 1/3로 적용됩니다. 한 판당 1회만 사용 가능하며, 이 스킬로 적을 처치하면 데미지가 플레이어의 현재 레벨만큼 영구 증가합니다. 현재 막타 ${killCount.toLocaleString()}회. 개인면담에서는 선택할 수 없고 강화할 수 없습니다.`;
}

function buildRaidParticipantCardSkillDescription(participant, card) {
  if (!card) return '';
  if (card.id !== 'potato_rehab') return buildCardSkillDescription(card.id, card.enhancementLevel || 0);
  const damage = getPotatoRehabDamage(participant);
  const killCount = getPotatoRehabKillCount(participant);
  return `보스전에서 현재 데미지 ${damage.toLocaleString()}의 고정 피해를 1회 입힙니다. 노멀 보스에서는 피해와 막타 성장량이 1/3로 적용됩니다. 한 판당 1회만 사용 가능하며, 이 스킬로 적을 처치하면 데미지가 플레이어의 현재 레벨만큼 영구 증가합니다. 현재 막타 ${killCount.toLocaleString()}회.`;
}

function queueNotification(user, type, text) {
  if (type === 'infinite_overtime_reward') return;
  if (!Array.isArray(user.pendingNotifications)) user.pendingNotifications = [];
  if (type === 'level_up') {
    const existingIndex = user.pendingNotifications.findIndex((notification) => notification?.type === 'level_up');
    if (existingIndex >= 0) {
      const existingText = String(user.pendingNotifications[existingIndex]?.text || '');
      const nextText = String(text || '');
      const existingLevel = Number((existingText.match(/레벨\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || 0);
      const nextLevel = Number((nextText.match(/레벨\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || 0);
      const existingBacchus = Number((existingText.match(/박카스\s*([\d,]+)병/) || [])[1]?.replace(/,/g, '') || 0);
      const nextBacchus = Number((nextText.match(/박카스\s*([\d,]+)병/) || [])[1]?.replace(/,/g, '') || 0);
      const mergedLevel = Math.max(existingLevel, nextLevel) || nextLevel || existingLevel;
      const mergedBacchus = existingBacchus + nextBacchus;
      user.pendingNotifications[existingIndex] = {
        type,
        text: mergedLevel && mergedBacchus
          ? `레벨 ${mergedLevel.toLocaleString()} 달성! 레벨업 보상으로 박카스 ${mergedBacchus.toLocaleString()}병을 받았습니다.`
          : nextText
      };
      return;
    }
  }
  user.pendingNotifications.push({ type, text });
}

function markUserSeen(user, now = new Date()) {
  user.meta.lastSeenAt = now;
}

function consumeNotifications(user) {
  const notifications = [...user.pendingNotifications]
    .filter((notification) => notification?.type !== 'infinite_overtime_reward');
  user.pendingNotifications = [];
  return notifications;
}

function isVersionConflictError(err) {
  return err?.name === 'VersionError' || String(err?.message || '').includes('No matching document found for id');
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const userMutationLocks = new Map();
const userSyncPersistThrottle = new Map();
const SYNC_PERSIST_MIN_INTERVAL_MS = 60000;
const POLL_USER_CACHE_TTL_MS = 5000;
const pollUserSnapshotCache = new Map();
const STATE_RESPONSE_CACHE_TTL_MS = 4000;
const SYNC_RESPONSE_CACHE_TTL_MS = 5000;
const raidStateResponseCache = new Map();
const pvpStateResponseCache = new Map();
const syncResponseCache = new Map();
const LIGHT_USER_SELECT_FIELDS = [
  'username', 'nickname', 'workHours', 'gameState', 'inventory',
  'cards', 'enhancedCards', 'lockedCards',
  'equippedCardId', 'equippedCardLevel', 'raidExtraCardSelection',
  'pvpStats', 'branchOffice', 'buffs', 'titles', 'emblems',
  'pendingStockInvestment', 'stockPortfolio', 'shopState',
  'dailyAugment', 'meta', 'pendingAdventure', 'pendingNotifications'
].join(' ');
const SYNC_USER_SELECT_FIELDS = LIGHT_USER_SELECT_FIELDS;

function getStateResponseCache(cache, key) {
  const nowMs = Date.now();
  const cached = cache.get(key);
  if (cached?.expiresAt > nowMs) return cached.value;
  if (cached) cache.delete(key);
  return null;
}

function setStateResponseCache(cache, key, value) {
  const nowMs = Date.now();
  cache.set(key, { value, expiresAt: nowMs + STATE_RESPONSE_CACHE_TTL_MS });
  if (cache.size > 300) {
    for (const [entryKey, entry] of cache.entries()) {
      if (!entry?.expiresAt || entry.expiresAt <= nowMs) cache.delete(entryKey);
    }
  }
}

function getSyncResponseCache(userId) {
  const key = String(userId || '');
  if (!key) return null;
  const nowMs = Date.now();
  const cached = syncResponseCache.get(key);
  if (cached?.expiresAt > nowMs) return cached.value;
  if (cached) syncResponseCache.delete(key);
  return null;
}

function setSyncResponseCache(userId, value) {
  const key = String(userId || '');
  if (!key || !value) return;
  const notifications = Array.isArray(value.notifications) ? value.notifications : [];
  if (notifications.length > 0) return;
  const nowMs = Date.now();
  syncResponseCache.set(key, { value, expiresAt: nowMs + SYNC_RESPONSE_CACHE_TTL_MS });
  if (syncResponseCache.size > 500) {
    for (const [entryKey, entry] of syncResponseCache.entries()) {
      if (!entry?.expiresAt || entry.expiresAt <= nowMs) syncResponseCache.delete(entryKey);
    }
  }
}

function clearSyncResponseCacheForUser(userId) {
  const key = String(userId || '');
  if (key) syncResponseCache.delete(key);
}


async function getCachedPollUserSnapshot(userId, selectFields) {
  const cacheKey = `${userId}:${selectFields}`;
  const nowMs = Date.now();
  const cached = pollUserSnapshotCache.get(cacheKey);
  if (cached?.expiresAt > nowMs && cached.user) return cached.user;
  const user = await User.findById(userId).select(selectFields);
  if (user) {
    pollUserSnapshotCache.set(cacheKey, {
      user,
      expiresAt: nowMs + POLL_USER_CACHE_TTL_MS
    });
  }
  if (pollUserSnapshotCache.size > 500) {
    for (const [key, entry] of pollUserSnapshotCache.entries()) {
      if (!entry?.expiresAt || entry.expiresAt <= nowMs) pollUserSnapshotCache.delete(key);
    }
  }
  return user;
}

async function withUserMutationLock(userId, operation) {
  const key = String(userId || '');
  if (!key) {
    return operation();
  }

  const previous = userMutationLocks.get(key) || Promise.resolve();
  let releaseCurrent;
  const current = new Promise((resolve) => {
    releaseCurrent = resolve;
  });
  const chain = previous.catch(() => {}).then(() => current);
  userMutationLocks.set(key, chain);

  await previous.catch(() => {});

  try {
    return await operation();
  } finally {
    releaseCurrent();
    if (userMutationLocks.get(key) === chain) {
      userMutationLocks.delete(key);
    }
  }
}

function toPlainMongoValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => toPlainMongoValue(entry));
  }
  if (value && typeof value.toObject === 'function') {
    return value.toObject({ depopulate: true, versionKey: false });
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, toPlainMongoValue(entry)])
    );
  }
  return value;
}

function buildUserPersistenceSnapshot(user) {
  return {
    nickname: user.nickname || null,
    workHours: toPlainMongoValue(user.workHours),
    gameState: toPlainMongoValue(user.gameState),
    inventory: toPlainMongoValue(user.inventory),
    cards: toPlainMongoValue(user.cards),
    enhancedCards: toPlainMongoValue(user.enhancedCards),
    lockedCards: toPlainMongoValue(user.lockedCards),
    equipments: toPlainMongoValue(user.equipments),
    equippedEquipment: toPlainMongoValue(user.equippedEquipment),
    equippedCardId: user.equippedCardId || null,
    equippedCardLevel: normalizeCardEnhancementLevel(user.equippedCardLevel || 0),
    raidExtraCardSelection: toPlainMongoValue(user.raidExtraCardSelection),
    pvpStats: toPlainMongoValue(user.pvpStats),
    infiniteOvertime: toPlainMongoValue(user.infiniteOvertime),
    branchOffice: toPlainMongoValue(user.branchOffice),
    buffs: toPlainMongoValue(user.buffs),
    titles: toPlainMongoValue(user.titles),
    emblems: toPlainMongoValue(user.emblems),
    pendingStockInvestment: toPlainMongoValue(user.pendingStockInvestment),
    stockPortfolio: toPlainMongoValue(user.stockPortfolio),
    stockTournament: toPlainMongoValue(user.stockTournament),
    shopState: toPlainMongoValue(user.shopState),
    meta: toPlainMongoValue(user.meta),
    pendingAdventure: toPlainMongoValue(user.pendingAdventure),
    pendingNotifications: toPlainMongoValue(user.pendingNotifications)
  };
}

function buildUserSyncPersistenceSnapshot(user) {
  return {
    nickname: user.nickname || null,
    workHours: toPlainMongoValue(user.workHours),
    gameState: toPlainMongoValue(user.gameState),
    inventory: toPlainMongoValue(user.inventory),
    equippedCardId: user.equippedCardId || null,
    equippedCardLevel: normalizeCardEnhancementLevel(user.equippedCardLevel || 0),
    raidExtraCardSelection: toPlainMongoValue(user.raidExtraCardSelection),
    pvpStats: toPlainMongoValue(user.pvpStats),
    branchOffice: toPlainMongoValue(user.branchOffice),
    buffs: toPlainMongoValue(user.buffs),
    titles: toPlainMongoValue(user.titles),
    emblems: toPlainMongoValue(user.emblems),
    pendingStockInvestment: toPlainMongoValue(user.pendingStockInvestment),
    stockPortfolio: toPlainMongoValue(user.stockPortfolio),
    shopState: toPlainMongoValue(user.shopState),
    meta: toPlainMongoValue(user.meta),
    pendingAdventure: toPlainMongoValue(user.pendingAdventure),
    pendingNotifications: toPlainMongoValue(user.pendingNotifications)
  };
}

function buildUserActionPersistenceSnapshot(user) {
  return {
    ...buildUserSyncPersistenceSnapshot(user),
    equipments: toPlainMongoValue(user.equipments),
    equippedEquipment: toPlainMongoValue(user.equippedEquipment)
  };
}

async function persistUserSnapshot(user, options = {}) {
  const snapshotBuilder = typeof options.snapshotBuilder === 'function'
    ? options.snapshotBuilder
    : buildUserPersistenceSnapshot;
  const updateResult = await User.updateOne(
    { _id: user._id },
    {
      $set: snapshotBuilder(user),
      $inc: { __v: 1 }
    }
  );

  const matchedCount = updateResult.matchedCount ?? updateResult.n ?? 0;
  if (!matchedCount) {
    throw createHttpError(options.statusCode || 409, options.message || '저장 중 충돌이 발생했습니다. 다시 시도해주세요.');
  }
}

async function runUserMutationWithRetry(userId, mutateUser, options = {}) {
  if (!options.skipUserMutationLock) {
    return withUserMutationLock(userId, () => runUserMutationWithRetry(userId, mutateUser, {
      ...options,
      skipUserMutationLock: true
    }));
  }

  const {
    maxRetries = 5,
    conflictLabel = 'User mutation conflict',
    afterSave = null,
    snapshotBuilder = buildUserPersistenceSnapshot,
    selectFields = null
  } = options;

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const query = User.findById(userId);
    const user = selectFields ? await query.select(selectFields) : await query;
    if (!user) {
      throw createHttpError(404, '사용자를 찾을 수 없습니다.');
    }

    ensureUserDefaults(user);
    const result = await mutateUser(user, attempt);

    try {
      await persistUserSnapshot(user, { snapshotBuilder });
      clearSyncResponseCacheForUser(userId);
      if (typeof afterSave === 'function') {
        return await afterSave(user, result, attempt);
      }
      return result;
    } catch (err) {
      lastError = err;
      if (isVersionConflictError(err)) {
        console.warn(`${conflictLabel}:`, err.message);
        if (attempt < maxRetries) {
          continue;
        }
        throw createHttpError(409, '요청 처리 중 저장 충돌이 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
      throw err;
    }
  }

  if (isVersionConflictError(lastError)) {
    throw createHttpError(409, '요청 처리 중 저장 충돌이 발생했습니다. 잠시 후 다시 시도해주세요.');
  }
  throw lastError || createHttpError(500, '서버 오류가 발생했습니다.');
}

function cleanupExpiredBuffs(user, now = new Date()) {
  if (!user) return;
  user.buffs = (Array.isArray(user.buffs) ? user.buffs : [])
    .filter((buff) => buff && new Date(buff.expiresAt) > now);
}

function removeAllDebuffs(user) {
  if (!user) return;
  user.buffs = (Array.isArray(user.buffs) ? user.buffs : [])
    .filter((buff) => BUFF_DATA[buff.buffId]?.category !== 'debuff');
}

function hasBuff(user, buffId, now = new Date()) {
  return (Array.isArray(user?.buffs) ? user.buffs : [])
    .some((buff) => buff.buffId === buffId && new Date(buff.expiresAt) > now);
}

function getInventoryItem(user, itemId) {
  return user.inventory.find((item) => item.itemId === itemId);
}

function getInventoryItems(user, itemId) {
  return (user.inventory || []).filter((item) => item.itemId === itemId);
}

function getCardEntry(user, cardId) {
  return user.cards.find((card) => card.cardId === cardId);
}

function getEnhancedCardEntry(user, cardId, level) {
  const normalizedLevel = normalizeCardEnhancementLevel(level);
  return (user.enhancedCards || []).find((card) => card.cardId === cardId && Number(card.level) === normalizedLevel);
}

function getInventoryQuantityFromItems(inventory = [], itemId) {
  return (Array.isArray(inventory) ? inventory : [])
    .filter((item) => item?.itemId === itemId)
    .reduce((total, item) => total + Math.max(0, Math.floor(Number(item.quantity) || 0)), 0);
}

function getInventoryQuantity(user, itemId) {
  return getInventoryQuantityFromItems(user?.inventory || [], itemId);
}

function getCardQuantity(user, cardId) {
  return getCardEntry(user, cardId)?.quantity || 0;
}

function getEnhancedCardQuantity(user, cardId, level) {
  return getEnhancedCardEntry(user, cardId, level)?.quantity || 0;
}

function getOwnedCardVariantQuantity(user, cardId, level = 0) {
  const normalizedLevel = normalizeCardEnhancementLevel(level);
  return normalizedLevel <= 0
    ? getCardQuantity(user, cardId) + getEnhancedCardQuantity(user, cardId, 0)
    : getEnhancedCardQuantity(user, cardId, normalizedLevel);
}

function getCardVariantKey(cardId, level = 0) {
  return `${String(cardId || '')}::${normalizeCardEnhancementLevel(level)}`;
}

function getLockedCardKeySet(user) {
  const lockedCards = Array.isArray(user?.lockedCards) ? user.lockedCards : [];
  return new Set(
    lockedCards
      .filter((entry) => entry && CARD_DATA[entry.cardId])
      .map((entry) => getCardVariantKey(entry.cardId, entry.level || 0))
  );
}

function isCardVariantLocked(user, cardId, level = 0) {
  return getLockedCardKeySet(user).has(getCardVariantKey(cardId, level));
}

function getTotalOwnedCardQuantity(user, cardId) {
  return getCardQuantity(user, cardId)
    + (user.enhancedCards || [])
      .filter((card) => card.cardId === cardId)
      .reduce((sum, card) => sum + Math.max(0, Number(card.quantity) || 0), 0);
}

function addItemToInventory(user, itemId, amount = 1, options = {}) {
  if (amount <= 0) return;
  let finalAmount = Math.max(0, Math.floor(Number(amount || 0)));
  if (options.allowDailyAugmentCopy !== false && finalAmount > 0) {
    const copyChance = Math.max(0, Number(getDailyAugmentEffectTotals(user, options.now || new Date()).itemCopyChance || 0));
    if (copyChance > 0 && Math.random() < Math.min(1, copyChance)) {
      finalAmount += 1;
    }
  }
  if (finalAmount <= 0) return;
  const item = getInventoryItem(user, itemId);
  if (item) {
    item.quantity += finalAmount;
    const duplicateItems = getInventoryItems(user, itemId).slice(1);
    if (duplicateItems.length > 0) {
      item.quantity += duplicateItems.reduce((sum, entry) => sum + Math.max(0, Number(entry.quantity) || 0), 0);
      user.inventory = user.inventory.filter((entry, index) => entry.itemId !== itemId || index === user.inventory.indexOf(item));
    }
  } else {
    user.inventory.push({ itemId, quantity: finalAmount });
  }
}

function resetPvpStatsToBase(user, options = {}) {
  const lastWeeklyRewardWeekKey = options.lastWeeklyRewardWeekKey
    ?? user.pvpStats?.lastWeeklyRewardWeekKey
    ?? '';
  user.pvpStats = {
    rating: PVP_RATING_BASE,
    played: 0,
    wins: 0,
    losses: 0,
    lastWeeklyRewardWeekKey
  };
}

function getPvpWeeklyRewardForRank(rank) {
  const tier = PVP_WEEKLY_REWARD_TIERS.find((entry) => entry.rank === rank);
  return tier || PVP_WEEKLY_PARTICIPATION_REWARD;
}

let weeklyPvpSeasonPromise = null;
let weeklyPvpSeasonLastCheckMs = 0;

async function processWeeklyPvpSeasonIfNeeded(now = new Date(), options = {}) {
  const force = Boolean(options.force);
  const nowMs = now.getTime();
  if (!force && nowMs - weeklyPvpSeasonLastCheckMs < PVP_WEEKLY_SEASON_CHECK_INTERVAL_MS) {
    return null;
  }
  weeklyPvpSeasonLastCheckMs = nowMs;

  if (weeklyPvpSeasonPromise) return weeklyPvpSeasonPromise;
  weeklyPvpSeasonPromise = processWeeklyPvpSeasonUnchecked(now)
    .catch((err) => {
      console.error('Weekly PVP season processing error:', err);
    })
    .finally(() => {
      weeklyPvpSeasonPromise = null;
    });
  return weeklyPvpSeasonPromise;
}

async function processWeeklyPvpSeasonUnchecked(now = new Date()) {
  const currentWeekKey = getKSTWeekStartKey(now);
  let setting = await GameSetting.findOne({ key: PVP_WEEKLY_SEASON_SETTING_KEY });

  if (!setting) {
    await GameSetting.updateOne(
      { key: PVP_WEEKLY_SEASON_SETTING_KEY },
      {
        $setOnInsert: {
          key: PVP_WEEKLY_SEASON_SETTING_KEY,
          value: {
            lastProcessedWeekKey: currentWeekKey,
            initializedAt: now
          },
          updatedAt: now
        }
      },
      { upsert: true }
    );
    return;
  }

  const lastProcessedWeekKey = setting.value?.lastProcessedWeekKey || null;
  if (lastProcessedWeekKey === currentWeekKey) return;

  const rewardCandidates = await User.find({ 'pvpStats.played': { $gt: 0 } })
    .select('_id username nickname pvpStats')
    .lean();

  const rankedUsers = rewardCandidates
    .map((user) => ({
      userId: String(user._id),
      nickname: user.nickname || user.username || '',
      rating: Math.round(Number(user.pvpStats?.rating ?? PVP_RATING_BASE)),
      played: Math.max(0, Math.floor(Number(user.pvpStats?.played || 0))),
      wins: Math.max(0, Math.floor(Number(user.pvpStats?.wins || 0))),
      losses: Math.max(0, Math.floor(Number(user.pvpStats?.losses || 0)))
    }))
    .sort((a, b) =>
      b.rating - a.rating
      || b.wins - a.wins
      || a.losses - b.losses
      || String(a.nickname || '').localeCompare(String(b.nickname || ''))
    );

  const rankedMode = getPvpModeState(PVP_MODE_RANKED);
  rankedMode.queue = [];
  rankedMode.match = null;
  rankedMode.battle = null;
  rankedMode.viewers = {};
  bumpPvpVersion();

  for (const [index, rankedUser] of rankedUsers.entries()) {
    const rank = index + 1;
    const reward = getPvpWeeklyRewardForRank(rank);
    await runUserMutationWithRetry(rankedUser.userId, (user) => {
      ensureUserDefaults(user);
      const alreadyRewarded = user.pvpStats?.lastWeeklyRewardWeekKey === currentWeekKey;
      if (!alreadyRewarded) {
        addItemToInventory(user, 'bacchus', reward.bacchus);
        addItemToInventory(user, 'business_card', reward.businessCards);
        if (rank === 1) {
          unlockEmblem(user, 'winter_manager_season');
        }
        queueNotification(
          user,
          'pvp_weekly_reward',
          `지난주 랭크 개인면담 ${rank}위 보상으로 박카스 ${reward.bacchus}개와 명함 ${reward.businessCards}장을 받았습니다. 면담 점수는 월요일 정산으로 초기화되었습니다.`
        );
      }
      resetPvpStatsToBase(user, { lastWeeklyRewardWeekKey: currentWeekKey });
    }, {
      conflictLabel: 'Weekly PVP reward conflict'
    });
  }

  await User.updateMany(
    {},
    {
      $set: {
        'pvpStats.rating': PVP_RATING_BASE,
        'pvpStats.played': 0,
        'pvpStats.wins': 0,
        'pvpStats.losses': 0
      }
    }
  );

  setting.value = {
    ...(setting.value || {}),
    lastProcessedWeekKey: currentWeekKey,
    lastProcessedAt: now,
    previousProcessedWeekKey: lastProcessedWeekKey,
    rewardedUserCount: rankedUsers.length
  };
  setting.updatedAt = now;
  await setting.save();
}

function addCardToCollection(user, cardId, amount = 1) {
  if (amount <= 0 || !CARD_DATA[cardId]) return;
  const entry = getCardEntry(user, cardId);
  if (entry) {
    entry.quantity += amount;
  } else {
    user.cards.push({ cardId, quantity: amount });
  }
}

function addEnhancedCard(user, cardId, level, amount = 1) {
  const normalizedLevel = normalizeCardEnhancementLevel(level);
  if (amount <= 0 || normalizedLevel <= 0 || !CARD_DATA[cardId]) return;
  const entry = getEnhancedCardEntry(user, cardId, normalizedLevel);
  if (entry) {
    entry.quantity += amount;
  } else {
    user.enhancedCards.push({ cardId, level: normalizedLevel, quantity: amount });
  }
}

function removeCardFromCollection(user, cardId, amount = 1) {
  const entry = getCardEntry(user, cardId);
  if (!entry || entry.quantity < amount) return false;

  entry.quantity -= amount;
  if (entry.quantity <= 0) {
    user.cards = user.cards.filter((card) => card.cardId !== cardId);
  }

  if (
    user.equippedCardId === cardId
    && normalizeCardEnhancementLevel(user.equippedCardLevel || 0) === 0
    && getCardQuantity(user, cardId) <= 0
  ) {
    user.equippedCardId = null;
    user.equippedCardLevel = 0;
  }
  return true;
}

function removeEnhancedCard(user, cardId, level, amount = 1) {
  const normalizedLevel = normalizeCardEnhancementLevel(level);
  const entry = getEnhancedCardEntry(user, cardId, normalizedLevel);
  if (!entry || entry.quantity < amount) return false;

  entry.quantity -= amount;
  if (entry.quantity <= 0) {
    user.enhancedCards = (user.enhancedCards || []).filter((card) => !(card.cardId === cardId && Number(card.level) === normalizedLevel));
  }

  if (user.equippedCardId === cardId && Number(user.equippedCardLevel || 0) === normalizedLevel && getEnhancedCardQuantity(user, cardId, normalizedLevel) <= 0) {
    user.equippedCardId = null;
    user.equippedCardLevel = 0;
  }
  return true;
}

function getEquippedCardInfo(user) {
  return getCardDefinition(user.equippedCardId, user.equippedCardLevel || 0);
}

function buildRaidCardEntry(cardId, level = 0) {
  const normalizedLevel = normalizeCardEnhancementLevel(level || 0);
  const card = getCardDefinition(cardId, normalizedLevel);
  if (!card) return null;
  return {
    cardId: card.id,
    enhancementLevel: normalizedLevel
  };
}

function getRaidExtraCardEntryForUser(user) {
  const selection = user?.raidExtraCardSelection || {};
  const cardId = selection.cardId || null;
  const level = normalizeCardEnhancementLevel(selection.level || 0);
  if (!cardId || !CARD_DATA[cardId]) return null;
  if (getOwnedCardVariantQuantity(user, cardId, level) <= 0) return null;
  if (user.equippedCardId === cardId) return null;
  return buildRaidCardEntry(cardId, level);
}

function buildRaidCardEntriesForUser(user, mode = RAID_MODE_NORMAL) {
  const entries = [];
  const equippedEntry = buildRaidCardEntry(user.equippedCardId, user.equippedCardLevel || 0);
  if (equippedEntry) entries.push(equippedEntry);
  if (normalizeRaidMode(mode) === RAID_MODE_CHAOS) {
    const extraEntry = getRaidExtraCardEntryForUser(user);
    if (extraEntry && !entries.some((entry) => entry.cardId === extraEntry.cardId)) {
      entries.push(extraEntry);
    }
  }
  return entries;
}

function buildCardDetails(user) {
  return Object.values(CARD_DATA).map((card) => ({
    id: card.id,
    name: card.name,
    grade: card.grade,
    color: CARD_GRADE_COLORS[card.grade] || '#666666',
    quantity: getCardQuantity(user, card.id),
    equipped: user.equippedCardId === card.id && Number(user.equippedCardLevel || 0) === 0,
    enhancementLevel: 0,
    displayName: getCardDisplayName(card.id, 0),
    skillName: card.skillName,
    skillDesc: buildUserCardSkillDescription(user, card.id, 0),
    cooldown: getCardDefinition(card.id, 0)?.cooldown ?? card.cooldown,
    durationText: getCardDurationText(card.id, 0),
    targetType: card.targetType || null,
    specialStyle: card.specialStyle || '',
    potatoRehabKillCount: card.id === 'potato_rehab' ? getPotatoRehabKillCount(user) : 0,
    potatoRehabAuraStrength: card.id === 'potato_rehab' ? getPotatoRehabAuraStrength(user) : 0
  }));
}

function buildCardVariantDetails(user) {
  const variants = [];
  Object.values(CARD_DATA).forEach((card) => {
    const baseQuantity = getCardQuantity(user, card.id);
    if (baseQuantity > 0) {
      const resolved = getCardDefinition(card.id, 0);
      const equipped = user.equippedCardId === card.id && Number(user.equippedCardLevel || 0) === 0;
      const nextPreview = getCardDefinition(card.id, 1);
      const canEnhanceCard = !card.enhanceDisabled;
      variants.push({
        cardId: card.id,
        enhancementLevel: 0,
        name: resolved.displayName,
        baseName: card.name,
        grade: card.grade,
        color: CARD_GRADE_COLORS[card.grade] || '#666666',
        borderColor: resolved.borderColor,
        quantity: baseQuantity,
        equipped,
        locked: isCardVariantLocked(user, card.id, 0),
        skillName: resolved.skillName,
        skillDesc: buildUserCardSkillDescription(user, card.id, 0),
        cooldown: resolved.cooldown,
        durationText: getCardDurationText(card.id, 0),
        specialStyle: CARD_DATA[card.id].specialStyle || '',
        potatoRehabKillCount: card.id === 'potato_rehab' ? getPotatoRehabKillCount(user) : 0,
        potatoRehabAuraStrength: card.id === 'potato_rehab' ? getPotatoRehabAuraStrength(user) : 0,
        canEnhance: canEnhanceCard,
        availableEnhanceQuantity: canEnhanceCard ? baseQuantity : 0,
        enhanceSuccessRate: canEnhanceCard ? getCardEnhancementSuccessRate(0) : 0,
        enhanceCost: canEnhanceCard ? getCardEnhancementCost(card.id, 0) : 0,
        nextEnhancementPreview: canEnhanceCard && nextPreview ? {
          enhancementLevel: 1,
          name: nextPreview.displayName,
          skillName: nextPreview.skillName,
          skillDesc: buildUserCardSkillDescription(user, card.id, 1),
          cooldown: nextPreview.cooldown,
          durationText: getCardDurationText(card.id, 1),
          borderColor: nextPreview.borderColor,
          specialStyle: CARD_DATA[card.id].specialStyle || '',
          potatoRehabKillCount: card.id === 'potato_rehab' ? getPotatoRehabKillCount(user) : 0,
          potatoRehabAuraStrength: card.id === 'potato_rehab' ? getPotatoRehabAuraStrength(user) : 0
        } : null
      });
    }
  });

  (user.enhancedCards || [])
    .filter((entry) => CARD_DATA[entry.cardId] && Number(entry.quantity) > 0)
    .forEach((entry) => {
      const resolved = getCardDefinition(entry.cardId, entry.level);
      const normalizedLevel = normalizeCardEnhancementLevel(entry.level);
      const canEnhanceCard = !CARD_DATA[entry.cardId].enhanceDisabled;
      const equipped = user.equippedCardId === entry.cardId && Number(user.equippedCardLevel || 0) === normalizedLevel;
      const nextLevel = Math.min(5, normalizedLevel + 1);
      const nextPreview = normalizedLevel < 5 ? getCardDefinition(entry.cardId, nextLevel) : null;
      variants.push({
        cardId: entry.cardId,
        enhancementLevel: normalizedLevel,
        name: resolved.displayName,
        baseName: CARD_DATA[entry.cardId].name,
        grade: CARD_DATA[entry.cardId].grade,
        color: CARD_GRADE_COLORS[CARD_DATA[entry.cardId].grade] || '#666666',
        borderColor: resolved.borderColor,
        quantity: Number(entry.quantity),
        equipped,
        locked: isCardVariantLocked(user, entry.cardId, normalizedLevel),
        skillName: resolved.skillName,
        skillDesc: buildUserCardSkillDescription(user, entry.cardId, normalizedLevel),
        cooldown: resolved.cooldown,
        durationText: getCardDurationText(entry.cardId, normalizedLevel),
        specialStyle: CARD_DATA[entry.cardId].specialStyle || '',
        potatoRehabKillCount: entry.cardId === 'potato_rehab' ? getPotatoRehabKillCount(user) : 0,
        potatoRehabAuraStrength: entry.cardId === 'potato_rehab' ? getPotatoRehabAuraStrength(user) : 0,
        canEnhance: canEnhanceCard && normalizedLevel < 5,
        availableEnhanceQuantity: canEnhanceCard && normalizedLevel < 5 ? Number(entry.quantity) : 0,
        enhanceSuccessRate: canEnhanceCard && normalizedLevel < 5 ? getCardEnhancementSuccessRate(normalizedLevel) : 0,
        enhanceCost: canEnhanceCard && normalizedLevel < 5 ? getCardEnhancementCost(entry.cardId, normalizedLevel) : 0,
        nextEnhancementPreview: canEnhanceCard && nextPreview ? {
          enhancementLevel: nextLevel,
          name: nextPreview.displayName,
          skillName: nextPreview.skillName,
          skillDesc: buildUserCardSkillDescription(user, entry.cardId, nextLevel),
          cooldown: nextPreview.cooldown,
          durationText: getCardDurationText(entry.cardId, nextLevel),
          borderColor: nextPreview.borderColor,
          specialStyle: CARD_DATA[entry.cardId].specialStyle || '',
          potatoRehabKillCount: entry.cardId === 'potato_rehab' ? getPotatoRehabKillCount(user) : 0,
          potatoRehabAuraStrength: entry.cardId === 'potato_rehab' ? getPotatoRehabAuraStrength(user) : 0
        } : null
      });
    });

  const gradeOrder = { S: 0, A: 1, B: 2, C: 3 };
  return variants.sort((a, b) =>
    (gradeOrder[a.grade] ?? 9) - (gradeOrder[b.grade] ?? 9)
    || a.baseName.localeCompare(b.baseName, 'ko')
    || a.enhancementLevel - b.enhancementLevel
  );
}

function removeItemFromInventory(user, itemId, amount = 1) {
  const items = getInventoryItems(user, itemId);
  const totalQuantity = items.reduce((sum, entry) => sum + Math.max(0, Number(entry.quantity) || 0), 0);
  if (totalQuantity < amount) return false;

  let remainingToRemove = amount;
  for (const item of items) {
    if (remainingToRemove <= 0) break;
    const available = Math.max(0, Number(item.quantity) || 0);
    const used = Math.min(available, remainingToRemove);
    item.quantity = available - used;
    remainingToRemove -= used;
  }

  if (remainingToRemove > 0) return false;

  user.inventory = user.inventory.filter((entry) => Math.max(0, Number(entry.quantity) || 0) > 0);
  const firstItem = getInventoryItem(user, itemId);
  const duplicateItems = getInventoryItems(user, itemId).slice(1);
  if (firstItem && duplicateItems.length > 0) {
    firstItem.quantity = getInventoryQuantity(user, itemId);
    user.inventory = user.inventory.filter((entry, index) => entry.itemId !== itemId || index === user.inventory.indexOf(firstItem));
  }
  return true;
}

function getCatTunaCanQuantity(user) {
  return CAT_TUNA_CAN_ITEM_IDS.reduce((total, itemId) => total + getInventoryQuantity(user, itemId), 0);
}

function removeCatTunaCanFromInventory(user, amount = 1) {
  let remaining = Math.max(1, Math.floor(Number(amount) || 1));
  for (const itemId of CAT_TUNA_CAN_ITEM_IDS) {
    if (remaining <= 0) break;
    const available = getInventoryQuantity(user, itemId);
    if (available <= 0) continue;
    const removeAmount = Math.min(available, remaining);
    if (removeItemFromInventory(user, itemId, removeAmount)) {
      remaining -= removeAmount;
    }
  }
  return remaining <= 0;
}

function bumpRaidVersion() {
  raidState.version += 1;
  raidStateResponseCache.clear();
}

function clearActiveRaidBattle(mode = RAID_MODE_NORMAL) {
  const room = getRaidRoom(mode);
  room.activeBattle = null;
  room.viewers = {};
  bumpRaidVersion();
}

function pruneViewerMap(viewerMap, now = new Date()) {
  const source = viewerMap && typeof viewerMap === 'object' ? viewerMap : {};
  const threshold = now.getTime() - SPECTATOR_TTL_MS;
  Object.keys(source).forEach((userId) => {
    const seenAt = new Date(source[userId]?.lastSeenAt || 0).getTime();
    if (!Number.isFinite(seenAt) || seenAt < threshold) {
      delete source[userId];
    }
  });
  return source;
}

function registerViewer(viewerMap, user, now = new Date()) {
  if (!viewerMap || !user?._id) return viewerMap;
  viewerMap[String(user._id)] = {
    userId: String(user._id),
    displayName: getCompactNickname(user, 18),
    lastSeenAt: now
  };
  pruneViewerMap(viewerMap, now);
  return viewerMap;
}

function buildSpectatorList(viewerMap, participantIds = [], now = new Date()) {
  const participantSet = new Set((participantIds || []).map((entry) => String(entry)));
  return Object.values(pruneViewerMap(viewerMap, now))
    .filter((viewer) => viewer?.userId && !participantSet.has(String(viewer.userId)))
    .sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || ''), 'ko'))
    .map((viewer) => ({
      userId: viewer.userId,
      displayName: viewer.displayName || '익명 관전자'
    }));
}

function findQueuedRaidSlotIndex(userId, mode = RAID_MODE_NORMAL) {
  return getRaidRoom(mode).slots.findIndex((slotUserId) => String(slotUserId) === String(userId));
}

function clearQueuedRaidUser(userId, mode = null, options = {}) {
  const modes = mode ? [normalizeRaidMode(mode)] : RAID_MODE_LIST;
  const excludeModes = new Set((options.excludeModes || []).map((entryMode) => normalizeRaidMode(entryMode)));
  modes.forEach((entryMode) => {
    if (excludeModes.has(entryMode)) return;
    const room = getRaidRoom(entryMode);
    const slotIndex = findQueuedRaidSlotIndex(userId, entryMode);
    if (slotIndex >= 0) {
      room.slots[slotIndex] = null;
      room.slotQueuedAt[slotIndex] = null;
      syncQueuedRaidBoss(new Date(), entryMode);
      bumpRaidVersion();
    }
  });
}

function syncRaidEntryState(user, now = new Date()) {
  const todayKey = getKSTDateKey(now);
  const legacyUsedToday = user.meta.lastRaidDayKey === todayKey ? 1 : 0;
  resetDailyAugmentUsageIfNeeded(user, now);

  if (user.meta.raidEntryDayKey !== todayKey) {
    user.meta.raidEntryDayKey = todayKey;
    user.meta.raidEntryUsedCount = legacyUsedToday;
    user.meta.raidEntryBonusCount = 0;
    return;
  }

  user.meta.raidEntryUsedCount = Math.max(user.meta.raidEntryUsedCount, legacyUsedToday);
}

function getRaidEntryLimit(user, now = new Date()) {
  syncRaidEntryState(user, now);
  return RAID_DAILY_LIMIT + Math.max(0, Number(user.meta.raidEntryBonusCount || 0));
}

function getDailyAugmentRaidFreeEntryLimit(user, now = new Date()) {
  resetDailyAugmentUsageIfNeeded(user, now);
  return Math.max(0, Math.floor(Number(getDailyAugmentEffectTotals(user, now).raidFreeEntries || 0)));
}

function getDailyAugmentRaidFreeRemainingEntries(user, now = new Date()) {
  const limit = getDailyAugmentRaidFreeEntryLimit(user, now);
  const used = Math.max(0, Number(user.meta.dailyAugmentRaidFreeEntryUsedCount || 0));
  return Math.max(0, limit - used);
}

function getRaidRemainingEntries(user, now = new Date()) {
  syncRaidEntryState(user, now);
  const regularRemaining = Math.max(0, getRaidEntryLimit(user, now) - Math.max(0, Number(user.meta.raidEntryUsedCount || 0)));
  return regularRemaining + getDailyAugmentRaidFreeRemainingEntries(user, now);
}

function isRaidAlreadyUsedToday(user, now = new Date()) {
  return getRaidRemainingEntries(user, now) <= 0;
}

function consumeRaidEntry(user, now = new Date()) {
  syncRaidEntryState(user, now);
  if (getDailyAugmentRaidFreeRemainingEntries(user, now) > 0) {
    user.meta.dailyAugmentRaidFreeEntryUsedCount += 1;
    user.meta.lastRaidEntryConsumeType = 'dailyAugmentFree';
    return true;
  }
  if (isRaidAlreadyUsedToday(user, now)) return false;
  user.meta.raidEntryUsedCount += 1;
  user.meta.lastRaidDayKey = getKSTDateKey(now);
  user.meta.lastRaidEntryConsumeType = 'regular';
  return true;
}

function refundRaidEntry(user, now = new Date()) {
  syncRaidEntryState(user, now);
  if (user.meta.lastRaidEntryConsumeType === 'dailyAugmentFree') {
    user.meta.dailyAugmentRaidFreeEntryUsedCount = Math.max(0, Number(user.meta.dailyAugmentRaidFreeEntryUsedCount || 0) - 1);
    user.meta.lastRaidEntryConsumeType = '';
    return;
  }
  user.meta.raidEntryUsedCount = Math.max(0, Number(user.meta.raidEntryUsedCount || 0) - 1);
  user.meta.lastRaidEntryConsumeType = '';
  if (user.meta.raidEntryUsedCount <= 0) {
    user.meta.lastRaidDayKey = null;
  }
}

function getRaidBossRewardRatio(level) {
  if (level >= 50) return 0.2;
  if (level <= 10) return 1;
  return Math.max(0.2, 1 - ((level - 10) * 0.02));
}

function isRaidLevelEligible(level, mode = RAID_MODE_NORMAL) {
  const numericLevel = Number(level || 0);
  const config = getRaidModeConfig(mode);
  return numericLevel >= config.minLevel && numericLevel <= config.maxLevel;
}

function getRaidLevelRequirementText(mode = RAID_MODE_NORMAL) {
  const config = getRaidModeConfig(mode);
  if (Number.isFinite(config.maxLevel)) {
    return `${config.minLevel}~${config.maxLevel}레벨`;
  }
  return `${config.minLevel}레벨 이상`;
}

function getRaidParticipantRewardMultiplierByLevel(level, mode = RAID_MODE_NORMAL) {
  const normalizedMode = normalizeRaidMode(mode);
  const numericLevel = Number(level || 0);
  if (normalizedMode === RAID_MODE_NORMAL && numericLevel >= RAID_NORMAL_HIGH_LEVEL_REWARD_THRESHOLD) {
    return RAID_NORMAL_HIGH_LEVEL_REWARD_MULTIPLIER;
  }
  return 1;
}

function buildRaidCardSnapshotFromEntry(user, entry) {
  const card = entry ? getCardDefinition(entry.cardId, entry.enhancementLevel || 0) : null;
  if (!card) return null;
  return {
    cardId: card.id,
    enhancementLevel: Number(card.enhancementLevel || entry.enhancementLevel || 0),
    name: card.displayName || card.name,
    grade: card.grade || null,
    skillName: card.skillName || '',
    skillDesc: buildUserCardSkillDescription(user, card.id, card.enhancementLevel || 0),
    cooldown: Number(card.cooldown || 0),
    passiveOnly: Boolean(card.passiveOnly),
    targetType: card.targetType || null,
    borderColor: card.borderColor || '',
    specialStyle: card.specialStyle || '',
    potatoRehabKillCount: card.id === 'potato_rehab' ? getPotatoRehabKillCount(user) : 0,
    potatoRehabAuraStrength: card.id === 'potato_rehab' ? getPotatoRehabAuraStrength(user) : 0
  };
}

function buildQueuedSlotSnapshot(user, mode = RAID_MODE_NORMAL) {
  const raidCards = buildRaidCardEntriesForUser(user, mode)
    .map((entry) => buildRaidCardSnapshotFromEntry(user, entry))
    .filter(Boolean);
  const equippedCard = raidCards[0] ? getCardDefinition(raidCards[0].cardId, raidCards[0].enhancementLevel || 0) : getEquippedCardInfo(user);
  return {
    userId: String(user._id),
    displayName: getCompactNickname(user, 16),
    nickname: getCompactNickname(user, 16),
    level: user.gameState.level,
    raidCards,
    equippedCardName: equippedCard?.displayName || equippedCard?.name || '장착 카드 없음',
    equippedCardGrade: equippedCard?.grade || null,
    equippedCardSkillName: equippedCard?.skillName || '',
    equippedCardSkillDesc: equippedCard ? buildUserCardSkillDescription(user, equippedCard.id, equippedCard.enhancementLevel || 0) : '',
    equippedCardCooldown: Number(equippedCard?.cooldown || 0),
    equippedCardPassiveOnly: Boolean(equippedCard?.passiveOnly),
    equippedCardEnhancementLevel: Number(equippedCard?.enhancementLevel || 0),
    equippedCardBorderColor: equippedCard?.borderColor || '',
    equippedCardSpecialStyle: equippedCard?.specialStyle || '',
    equippedCardPotatoRehabKillCount: equippedCard?.id === 'potato_rehab' ? getPotatoRehabKillCount(user) : 0,
    equippedCardPotatoRehabAuraStrength: equippedCard?.id === 'potato_rehab' ? getPotatoRehabAuraStrength(user) : 0
  };
}

function createRaidParticipantFromUser(user, mode = RAID_MODE_NORMAL) {
  const equippedEquipment = getEquippedEquipment(user);
  const equippedCardEffect = equippedEquipment?.equipmentType === EQUIPMENT_TYPE_CARD ? equippedEquipment : null;
  const equippedBasicAttack = equippedEquipment?.equipmentType === EQUIPMENT_TYPE_ATTACK ? equippedEquipment : null;
  const derivedStats = calculateDerivedStats(user);
  const raidCards = buildRaidCardEntriesForUser(user, mode);
  const primaryCard = raidCards[0] || buildRaidCardEntry(user.equippedCardId, user.equippedCardLevel || 0);
  return {
    userId: String(user._id),
    displayName: getCompactNickname(user, 18),
    nickname: getCompactNickname(user, 18),
    level: user.gameState.level,
    maxHp: 100,
    hp: 100,
    shield: 0,
    tempShieldAmount: 0,
    tempShieldTurns: 0,
    roundShieldAmount: 0,
    lastHpLoss: 0,
    lastShieldLoss: 0,
    silenceTurns: 0,
    actionLockTurns: 0,
    basicAttackLockTurns: 0,
    plannedSkill: false,
    plannedCardSlot: null,
    plannedTargetUserId: null,
    plannedTargetUserId2: null,
    skillCooldown: 0,
    skillCooldowns: raidCards.map(() => 0),
    raidCards,
    equippedCardId: primaryCard?.cardId || null,
    equippedCardLevel: normalizeCardEnhancementLevel(primaryCard?.enhancementLevel || 0),
    potatoRehabDamage: getPotatoRehabDamage(user),
    potatoRehabKillCount: getPotatoRehabKillCount(user),
    potatoRehabAuraStrength: getPotatoRehabAuraStrength(user),
    potatoRehabUsed: false,
    extraHits: 0,
    multiHitDamageMultiplier: 1,
    extraDamage: 0,
    damageMultiplierTurns: 0,
    damageMultiplierValue: 1,
    critBonusTurns: 0,
    critBonusValue: 0,
    hypeTurns: 0,
    counterTurns: 0,
    counterDamageMultiplier: 1,
    rewardMultiplier: 1,
    hoiRewardBuff: false,
    hoiRewardMultiplier: 1,
    sojuRewardBuff: false,
    sojuRewardMultiplier: 1,
    lottoRewardBuff: false,
    lottoRewardSuccessChance: 0.5,
    internBuff: false,
    internChance: 0,
    internDamageMultiplier: 0.3,
    healShieldReductionTurns: 0,
    healShieldReductionMultiplier: 1,
    shieldBlockTurns: 0,
    nextHitDamageTakenMultiplier: 1,
    negateHitCount: 0,
    solidMentalNegateCount: 0,
    debuffImmuneCount: 0,
    selfEsteemCount: 0,
    tauntTurns: 0,
    tauntDamageReductionPercent: 0,
    tauntSourceUserId: null,
    breadCount: 0,
    attackBonusBuffs: [],
    attackBonusTurns: 0,
    attackBonusPercent: 0,
    perHitBonusTurns: 0,
    perHitBonusDamage: 0,
    championGuardTurns: 0,
    championGuardAttackBonus: 0,
    championGuardCritBonus: 0,
    subordinateTurns: 0,
    subordinateLevelBonus: 0,
    finalDamageBonusTurns: 0,
    finalDamageBonusPercent: 0,
    dailyRaidDamageBonusPercent: Number(derivedStats.raidDamageBonusPercent || 0),
    dailyRaidHealShieldBonusPercent: Number(derivedStats.raidHealShieldBonusPercent || 0),
    dailyRaidTurn3DamageBonusPercent: Number(derivedStats.raidTurn3DamageBonusPercent || 0),
    cardEffectEquipmentBonusPercent: Number(equippedCardEffect?.statValue || 0) / 100,
    basicAttackEquipmentBonusPercent: Number(equippedBasicAttack?.statValue || 0) / 100,
    celineTurns: 0,
    celineExpireDamage: 0,
    celineAttackBonusPercent: 0,
    cardEffectAmpTurns: 0,
    cardEffectAmpValue: 1,
    rotationIndex: 0,
    specialDamageMultiplier: 1,
    nailBounceDelayTurns: 0,
    nailBounceDamage: 0,
    nailBounceRemainingBounces: 0,
    nailBounceDamageStep: 0
  };
}

function setOrRefreshBuff(user, buffId, durationMs, options = {}) {
  if (!Array.isArray(user.buffs)) user.buffs = [];
  const now = options.now || new Date();
  const existingBuff = user.buffs.find((buff) => buff.buffId === buffId);
  const shouldStack = Boolean(options.stackDuration) || buffId === 'cat_gratitude_buff';
  const baseTime = existingBuff && new Date(existingBuff.expiresAt) > now
    ? new Date(existingBuff.expiresAt)
    : now;
  const expiresAt = new Date((shouldStack ? baseTime.getTime() : now.getTime()) + durationMs);

  if (existingBuff) {
    existingBuff.expiresAt = expiresAt;
  } else {
    user.buffs.push({ buffId, expiresAt });
  }
  if (typeof user.markModified === 'function') {
    user.markModified('buffs');
  }
}

function getMonamiPriceMultiplier(ownedCount) {
  return Number(Math.pow(1.05, ownedCount).toFixed(2));
}

function getItemPrice(user, itemId) {
  const itemInfo = ITEM_DATA[itemId];
  if (!itemInfo) return 0;
  if (isPenShopItemId(itemId)) {
    return Math.round(itemInfo.price * getMonamiPriceMultiplier(getInventoryQuantity(user, itemId)));
  }
  return itemInfo.price;
}

function getShopPricesForUser(user, now = new Date()) {
  const prices = {};
  for (const itemId of Object.keys(ITEM_DATA)) {
    if (ITEM_DATA[itemId].shopHidden) continue;
    if (ITEM_DATA[itemId].type === 'special' && itemId !== 'business_card') continue;
    prices[itemId] = applyDailyAugmentShopDiscount(user, getItemPrice(user, itemId), now);
  }
  return prices;
}

function getTotalBuyPrice(user, itemId, quantity, now = new Date()) {
  if (quantity <= 0) return 0;
  const itemInfo = ITEM_DATA[itemId];
  if (!itemInfo) return 0;

  let total = 0;
  if (itemId === 'business_card') {
    total = 200000 * quantity;
  } else if (!isPenShopItemId(itemId)) {
    total = getItemPrice(user, itemId) * quantity;
  } else {
    const currentOwned = getInventoryQuantity(user, itemId);
    for (let offset = 0; offset < quantity; offset += 1) {
      total += Math.round(itemInfo.price * getMonamiPriceMultiplier(currentOwned + offset));
    }
  }
  return applyDailyAugmentShopDiscount(user, total, now);
}

function getRemainingBusinessCardPurchases(user) {
  return Math.max(0, 5 - Number(user.shopState?.dailyBusinessCardPurchases || 0));
}

function getDailyShopPurchaseCount(user, itemId) {
  if (itemId === 'business_card') return Number(user.shopState?.dailyBusinessCardPurchases || 0);
  if (itemId === 'bacchus') return Number(user.shopState?.dailyBacchusPurchases || 0);
  if (itemId === 'hot6') return Number(user.shopState?.dailyHot6Purchases || 0);
  return 0;
}

function getRemainingDailyShopPurchases(user, itemId) {
  const limit = DAILY_SHOP_PURCHASE_LIMITS[itemId];
  if (!limit) return Infinity;
  return Math.max(0, limit - getDailyShopPurchaseCount(user, itemId));
}

function getCardEnhancementSuccessRate(level) {
  const normalizedLevel = normalizeCardEnhancementLevel(level);
  return CARD_ENHANCE_SUCCESS_RATES[normalizedLevel] ?? 0;
}

function getCardEnhancementCost(cardId, level) {
  const grade = CARD_DATA[cardId]?.grade;
  if (!grade) return 0;
  const normalizedLevel = normalizeCardEnhancementLevel(level);
  return CARD_ENHANCE_COSTS[grade]?.[normalizedLevel] ?? 0;
}

function getFusionOutcomeGrade(sourceGrade) {
  const roll = Math.random();
  if (sourceGrade === 'C') {
    return roll < 0.3 ? 'B' : 'C';
  }
  if (sourceGrade === 'B') {
    return roll < 0.2 ? 'A' : 'B';
  }
  if (sourceGrade === 'A') {
    return roll < 0.1 ? 'S' : 'A';
  }
  return sourceGrade;
}

function getRandomCardIdByGrade(grade) {
  const pool = Object.values(CARD_DATA).filter((card) => card.grade === grade);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

function getAutoFusionMaterialEntries(user, grade) {
  const gradeKey = String(grade || '').toUpperCase();
  const lockedSet = getLockedCardKeySet(user);
  const entries = [];
  Object.values(CARD_DATA)
    .filter((card) => card.grade === gradeKey)
    .sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.id.localeCompare(b.id))
    .forEach((card) => {
      for (let level = 0; level <= 4; level += 1) {
        if (lockedSet.has(getCardVariantKey(card.id, level))) continue;
        const quantity = getOwnedCardVariantQuantity(user, card.id, level);
        if (quantity > 0) entries.push({ cardId: card.id, level, quantity });
      }
    });
  return entries;
}

function getAutoFusionMaterialCount(user, grade) {
  return getAutoFusionMaterialEntries(user, grade)
    .reduce((total, entry) => total + Math.max(0, Math.floor(Number(entry.quantity) || 0)), 0);
}

function removeCardVariantForFusion(user, material) {
  const level = normalizeCardEnhancementLevel(material?.level || 0);
  return level <= 0
    ? removeCardFromCollection(user, material.cardId, 1)
    : removeEnhancedCard(user, material.cardId, level, 1);
}

function buildAutoFusionCountState(user) {
  const baseCounts = new Map();
  const enhancedCounts = new Map();

  (user.cards || []).forEach((entry) => {
    if (!entry || !CARD_DATA[entry.cardId]) return;
    const quantity = Math.max(0, Math.floor(Number(entry.quantity) || 0));
    if (quantity > 0) baseCounts.set(entry.cardId, (baseCounts.get(entry.cardId) || 0) + quantity);
  });

  (user.enhancedCards || []).forEach((entry) => {
    if (!entry || !CARD_DATA[entry.cardId]) return;
    const level = normalizeCardEnhancementLevel(entry.level || 0);
    const quantity = Math.max(0, Math.floor(Number(entry.quantity) || 0));
    if (level > 0 && quantity > 0) {
      const key = getCardVariantKey(entry.cardId, level);
      enhancedCounts.set(key, (enhancedCounts.get(key) || 0) + quantity);
    }
  });

  return { baseCounts, enhancedCounts };
}

function getAutoFusionStateQuantity(state, cardId, level = 0) {
  const normalizedLevel = normalizeCardEnhancementLevel(level);
  if (normalizedLevel <= 0) return Math.max(0, Math.floor(Number(state.baseCounts.get(cardId) || 0)));
  return Math.max(0, Math.floor(Number(state.enhancedCounts.get(getCardVariantKey(cardId, normalizedLevel)) || 0)));
}

function addAutoFusionStateQuantity(state, cardId, level, amount) {
  if (!CARD_DATA[cardId]) return;
  const normalizedLevel = normalizeCardEnhancementLevel(level);
  const delta = Math.floor(Number(amount) || 0);
  if (!delta) return;
  if (normalizedLevel <= 0) {
    const nextQuantity = Math.max(0, (state.baseCounts.get(cardId) || 0) + delta);
    if (nextQuantity > 0) state.baseCounts.set(cardId, nextQuantity);
    else state.baseCounts.delete(cardId);
    return;
  }
  const key = getCardVariantKey(cardId, normalizedLevel);
  const nextQuantity = Math.max(0, (state.enhancedCounts.get(key) || 0) + delta);
  if (nextQuantity > 0) state.enhancedCounts.set(key, nextQuantity);
  else state.enhancedCounts.delete(key);
}

function compareAutoFusionMaterials(a, b) {
  const cardA = CARD_DATA[a.cardId] || {};
  const cardB = CARD_DATA[b.cardId] || {};
  return String(cardA.name || a.cardId).localeCompare(String(cardB.name || b.cardId), 'ko')
    || String(a.cardId).localeCompare(String(b.cardId))
    || Number(a.level || 0) - Number(b.level || 0);
}

function buildAutoFusionPools(user, state) {
  const lockedSet = getLockedCardKeySet(user);
  const pools = { C: [], B: [], A: [] };
  Object.values(CARD_DATA)
    .filter((card) => pools[card.grade])
    .sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.id.localeCompare(b.id))
    .forEach((card) => {
      for (let level = 0; level <= 4; level += 1) {
        if (lockedSet.has(getCardVariantKey(card.id, level))) continue;
        const quantity = getAutoFusionStateQuantity(state, card.id, level);
        if (quantity > 0) pools[card.grade].push({ cardId: card.id, level, quantity });
      }
    });
  Object.values(pools).forEach((pool) => pool.sort(compareAutoFusionMaterials));
  return { pools, lockedSet };
}

function getAutoFusionPoolTotal(pool) {
  return pool.reduce((total, entry) => total + Math.max(0, Math.floor(Number(entry.quantity) || 0)), 0);
}

function addAutoFusionPoolMaterial(pools, lockedSet, cardId, level, quantity = 1) {
  const card = CARD_DATA[cardId];
  const grade = card?.grade;
  if (!pools[grade]) return;
  const normalizedLevel = normalizeCardEnhancementLevel(level || 0);
  if (normalizedLevel > 4 || lockedSet.has(getCardVariantKey(cardId, normalizedLevel))) return;
  const safeQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
  if (safeQuantity <= 0) return;
  const existing = pools[grade].find((entry) => entry.cardId === cardId && Number(entry.level || 0) === normalizedLevel);
  if (existing) {
    existing.quantity += safeQuantity;
  } else {
    pools[grade].push({ cardId, level: normalizedLevel, quantity: safeQuantity });
    pools[grade].sort(compareAutoFusionMaterials);
  }
}

function consumeAutoFusionPoolMaterials(pool, state, amount = 5) {
  let remaining = Math.max(0, Math.floor(Number(amount) || 0));
  while (remaining > 0 && pool.length > 0) {
    const entry = pool[0];
    const take = Math.min(remaining, Math.max(0, Math.floor(Number(entry.quantity) || 0)));
    if (take <= 0) {
      pool.shift();
      continue;
    }
    entry.quantity -= take;
    addAutoFusionStateQuantity(state, entry.cardId, entry.level, -take);
    remaining -= take;
    if (entry.quantity <= 0) pool.shift();
  }
  return remaining <= 0;
}

function flushAutoFusionCountState(user, state) {
  user.cards = Array.from(state.baseCounts.entries())
    .map(([cardId, quantity]) => ({ cardId, quantity: Math.max(0, Math.floor(Number(quantity) || 0)) }))
    .filter((entry) => CARD_DATA[entry.cardId] && entry.quantity > 0)
    .sort((a, b) => (CARD_DATA[a.cardId]?.name || a.cardId).localeCompare(CARD_DATA[b.cardId]?.name || b.cardId, 'ko'));

  user.enhancedCards = Array.from(state.enhancedCounts.entries())
    .map(([key, quantity]) => {
      const [cardId, levelText] = key.split('::');
      return { cardId, level: normalizeCardEnhancementLevel(levelText), quantity: Math.max(0, Math.floor(Number(quantity) || 0)) };
    })
    .filter((entry) => CARD_DATA[entry.cardId] && entry.level > 0 && entry.quantity > 0)
    .sort((a, b) =>
      (CARD_DATA[a.cardId]?.name || a.cardId).localeCompare(CARD_DATA[b.cardId]?.name || b.cardId, 'ko')
      || a.level - b.level
    );

  if (user.equippedCardId && getOwnedCardVariantQuantity(user, user.equippedCardId, user.equippedCardLevel || 0) <= 0) {
    user.equippedCardId = null;
    user.equippedCardLevel = 0;
  }
  if (
    user.raidExtraCardSelection?.cardId
    && getOwnedCardVariantQuantity(user, user.raidExtraCardSelection.cardId, user.raidExtraCardSelection.level || 0) <= 0
  ) {
    user.raidExtraCardSelection = { cardId: null, level: 0 };
  }
}

function runAutoFusionUntilS(user) {
  const result = { fusionCount: 0, consumedCount: 0, producedCount: 0, byGrade: { C: 0, B: 0, A: 0 }, producedS: null, stoppedReason: 'NO_MATERIAL' };
  const state = buildAutoFusionCountState(user);
  const { pools, lockedSet } = buildAutoFusionPools(user, state);
  const maxIterations = 200000;

  for (let safety = 0; safety < maxIterations; safety += 1) {
    let fusedThisLoop = false;
    for (const grade of ['C', 'B', 'A']) {
      while (getAutoFusionPoolTotal(pools[grade]) >= 5) {
        if (!consumeAutoFusionPoolMaterials(pools[grade], state, 5)) {
          result.stoppedReason = 'MATERIAL_CONSUME_FAILED';
          flushAutoFusionCountState(user, state);
          return result;
        }
        result.consumedCount += 5;
        result.fusionCount += 1;
        result.byGrade[grade] += 1;

        const outcomeGrade = getFusionOutcomeGrade(grade);
        const resultCardId = getRandomCardIdByGrade(outcomeGrade);
        if (resultCardId) {
          addAutoFusionStateQuantity(state, resultCardId, 0, 1);
          result.producedCount += 1;
          if (outcomeGrade === 'S') {
            result.producedS = { cardId: resultCardId, name: CARD_DATA[resultCardId]?.name || resultCardId };
            result.stoppedReason = 'S_CREATED';
            flushAutoFusionCountState(user, state);
            return result;
          }
          addAutoFusionPoolMaterial(pools, lockedSet, resultCardId, 0, 1);
        }
        fusedThisLoop = true;
        safety += 1;
        if (safety >= maxIterations) break;
      }
      if (safety >= maxIterations) break;
    }
    if (!fusedThisLoop) break;
  }

  result.stoppedReason = result.fusionCount > 0 ? 'NO_MATERIAL_AFTER_FUSION' : 'NO_MATERIAL';
  flushAutoFusionCountState(user, state);
  return result;
}

function buildAutoFusionSummaryText(result) {
  if (!result || result.fusionCount <= 0) return '합성 가능한 잠금 해제 카드가 부족합니다.';
  const gradeParts = ['C', 'B', 'A']
    .filter((grade) => Number(result.byGrade?.[grade] || 0) > 0)
    .map((grade) => `${grade}등급 ${Number(result.byGrade[grade]).toLocaleString()}회`)
    .join(', ');
  const consumedText = result.consumedCount > 0 ? ` / 재료 ${Number(result.consumedCount).toLocaleString()}장 사용` : '';
  const sText = result.producedS
    ? ` / S등급 <${result.producedS.name}> 획득`
    : ' / S등급은 나오지 않았습니다.';
  return `자동 합성 ${Number(result.fusionCount).toLocaleString()}회(${gradeParts || '기록 없음'}) 진행${consumedText}${sText}`;
}

function buildBulkAdventureSummaryText(result) {
  if (!result) return '모험 일괄 정산 결과가 없습니다.';
  const parts = [`모험 ${Number(result.resolvedCount || 0).toLocaleString()}회 정산`];
  if (result.choiceSkippedCount > 0) parts.push(`선택형 이벤트 ${Number(result.choiceSkippedCount).toLocaleString()}회 제외`);
  if (result.levelUpCount > 0) parts.push(`레벨업 ${Number(result.levelUpCount).toLocaleString()}회`);
  if (result.deferredBuffs?.length) {
    parts.push(result.deferredBuffs.map((entry) => `${entry.name} ${Number(entry.count).toLocaleString()}회는 정산 후 적용`).join(', '));
  }
  if (result.sampleLogs?.length) parts.push(`주요 결과: ${result.sampleLogs.join(' / ')}`);
  return parts.join(' / ');
}

function hasCatButlerBulkAdventureBonus(user) {
  return user?.titles?.equipped === 'cat_butler';
}

function applyDeferredBulkAdventureBuffs(user, deferredBuffCounts, now = new Date()) {
  const applied = [];
  for (const [buffId, count] of deferredBuffCounts.entries()) {
    const safeCount = Math.max(0, Math.floor(Number(count) || 0));
    const durationMs = BUFF_DATA[buffId]?.durationMs;
    if (!durationMs || safeCount <= 0) continue;
    setOrRefreshBuff(user, buffId, durationMs * safeCount, { now, stackDuration: true });
    applied.push({ buffId, name: BUFF_DATA[buffId].name, count: safeCount });
  }
  return applied;
}

function runBulkAdventureSettlement(user, count = 100, now = new Date()) {
  const requestedCount = Math.max(1, Math.floor(Number(count) || 100));
  const deferredBuffCounts = new Map();
  const rewardOptions = {
    deferBuffIds: new Set(['fatigue_debuff']),
    deferredBuffCounts
  };
  const result = {
    requestedCount,
    resolvedCount: 0,
    choiceSkippedCount: 0,
    levelUpCount: 0,
    deferredBuffs: [],
    sampleLogs: []
  };

  for (let index = 0; index < requestedCount; index += 1) {
    const event = rollAdventureEvent();
    if (event.reward?.type === 'cat_choice') {
      if (getCatTunaCanQuantity(user) > 0) {
        const beforeLevel = Number(user.gameState.level || 1);
        const rewardText = applyAutomaticCatTunaCanReward(user, now);
        const afterLevel = Number(user.gameState.level || beforeLevel);
        if (afterLevel > beforeLevel) result.levelUpCount += afterLevel - beforeLevel;
        result.resolvedCount += 1;
        if (result.sampleLogs.length < 5) result.sampleLogs.push(`${event.location || '모험'}: ${rewardText}`);
      } else {
        result.choiceSkippedCount += 1;
      }
      continue;
    }
    const beforeLevel = Number(user.gameState.level || 1);
    const rewardText = applyAdventureReward(user, event.reward, now, rewardOptions);
    const afterLevel = Number(user.gameState.level || beforeLevel);
    if (afterLevel > beforeLevel) result.levelUpCount += afterLevel - beforeLevel;
    result.resolvedCount += 1;
    if (result.sampleLogs.length < 5) result.sampleLogs.push(`${event.location || '모험'}: ${rewardText}`);
  }

  result.deferredBuffs = applyDeferredBulkAdventureBuffs(user, deferredBuffCounts, now);
  clearPendingAdventure(user);
  return result;
}

function applySupportPackage(user, packageId) {
  const packageInfo = SUPPORT_PACKAGE_DATA[packageId];
  if (!packageInfo) return null;
  packageInfo.rewards.forEach((reward) => {
    addItemToInventory(user, reward.itemId, reward.quantity);
  });
  return packageInfo;
}

const ADMIN_MAIL_EXPIRY_MS = 24 * 60 * 60 * 1000;
const RAID_REWARD_MAIL_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

function createAdminMailGiftPayload(giftType, giftId, quantity = 1, now = new Date(), options = {}) {
  const giftQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
  const expiresAt = new Date(now.getTime() + ADMIN_MAIL_EXPIRY_MS);

  if (giftType === 'message') {
    const messageTitle = String(options.messageTitle || '운영자 메시지').trim().slice(0, 80) || '운영자 메시지';
    const messageBody = String(options.messageBody || '').replace(/\r\n/g, '\n').trim().slice(0, 1000);
    if (!messageBody) throw createHttpError(400, '메시지 내용을 입력해주세요.');
    return {
      giftType,
      giftId: giftId || `message:${now.getTime()}`,
      quantity: 1,
      title: messageTitle,
      description: messageBody,
      payload: { messageBody },
      expiresAt
    };
  }

  if (giftType === 'item' || giftType === 'fragment') {
    const actualGiftItemId = getRewardVariantItemId(giftId);
    const item = ITEM_DATA[actualGiftItemId];
    return {
      giftType,
      giftId,
      quantity: giftQuantity,
      title: `${item?.name || actualGiftItemId} ${giftQuantity}개`,
      description: '운영자가 보낸 아이템입니다. 24시간 안에 수령해주세요.',
      payload: { actualGiftItemId },
      expiresAt
    };
  }

  if (giftType === 'buff') {
    const buff = BUFF_DATA[giftId];
    return {
      giftType,
      giftId,
      quantity: 1,
      title: `${buff?.name || giftId} 버프`,
      description: '수령 즉시 버프가 적용됩니다. 24시간 안에 수령해주세요.',
      payload: {},
      expiresAt
    };
  }

  if (giftType === 'package') {
    const packageInfo = SUPPORT_PACKAGE_DATA[giftId];
    return {
      giftType,
      giftId,
      quantity: 1,
      title: packageInfo?.name || giftId,
      description: (packageInfo?.rewards || [])
        .map((reward) => `${ITEM_DATA[reward.itemId]?.name || reward.itemId} ${reward.quantity}개`)
        .join(', '),
      payload: {},
      expiresAt
    };
  }

  const title = TITLE_DATA[giftId];
  return {
    giftType,
    giftId,
    quantity: 1,
    title: `<${title?.name || giftId}> 칭호`,
    description: '수령 시 칭호가 해금됩니다. 이미 보유 중이어도 우편은 정상 처리됩니다.',
    payload: {},
    expiresAt
  };
}

function createRaidRewardMailPayload({ activeBattle, participant, user, sharedBaseRewards, sharedLottoOutcome, battleMode, now = new Date() }) {
  ensureUserDefaults(user);
  const modeConfig = getRaidModeConfig(battleMode);
  const modeRewardMultiplier = Number(modeConfig.rewardMultiplier || 1);
  let rewardMultiplier = modeRewardMultiplier;
  const rewardNotes = [];
  const derivedStats = calculateDerivedStats(user, now);

  if (modeRewardMultiplier !== 1) {
    rewardNotes.push(`${modeConfig.label} 모드 보상 ${modeRewardMultiplier.toFixed(1)}배`);
  }

  const levelRewardMultiplier = getRaidParticipantRewardMultiplierByLevel(participant.level, battleMode);
  if (levelRewardMultiplier !== 1) {
    rewardMultiplier *= levelRewardMultiplier;
    rewardNotes.push(`${RAID_NORMAL_HIGH_LEVEL_REWARD_THRESHOLD}레벨 이상 노멀 참여 보정으로 기본 보상 1/3`);
  }

  if (derivedStats.raidRewardBonusPercent > 0) {
    const rewardBonusMultiplier = 1 + derivedStats.raidRewardBonusPercent / 100;
    rewardMultiplier *= rewardBonusMultiplier;
    rewardNotes.push(`보상 증가 효과로 보스 보상 ${rewardBonusMultiplier.toFixed(2)}배`);
  }
  const dailyOnceRewardBonusPercent = getDailyAugmentRaidRewardOnceBonusPercent(user, now);
  const dailyOnceRewardBonusUsed = dailyOnceRewardBonusPercent > 0;
  if (dailyOnceRewardBonusUsed) {
    const rewardBonusMultiplier = 1 + dailyOnceRewardBonusPercent / 100;
    rewardMultiplier *= rewardBonusMultiplier;
    markDailyAugmentRaidRewardOnceUsed(user, now);
    rewardNotes.push(`오늘의 증강 첫 회의 보상 ${rewardBonusMultiplier.toFixed(2)}배`);
  }

  if (participant.sojuRewardBuff) {
    rewardMultiplier *= Number(participant.sojuRewardMultiplier || 1);
    rewardNotes.push(`소주각? 효과로 전리품 ${Number(participant.sojuRewardMultiplier || 1).toFixed(1)}배`);
  }

  if (participant.hoiRewardBuff) {
    rewardMultiplier *= Number(participant.hoiRewardMultiplier || 1);
    rewardNotes.push(`HOI 특수 기믹으로 전리품 ${Number(participant.hoiRewardMultiplier || 1).toFixed(1)}배`);
  }

  if (participant.lottoRewardBuff) {
    if (sharedLottoOutcome === 'success') {
      rewardMultiplier *= 3;
      rewardNotes.push('이번엔 될거같아 성공으로 전리품 3배');
    } else {
      rewardMultiplier = 0;
      rewardNotes.push('이번엔 될거같아 실패로 보상 없음');
    }
  }

  const rewardRatio = getRaidBossRewardRatio(participant.level);
  const activeExpBuffEffects = getActiveBuffEffects(user, now);
  const activeExpBuffMultiplier = Math.max(0, 1 + Number(activeExpBuffEffects.expBonusAdd || 0));
  const expBonusMultiplier =
    (1 + (derivedStats.expBonusPercent + (derivedStats.branchRaidExpBonusPercent || 0) + (derivedStats.raidExpBonusPercent || 0)) / 100)
    * activeExpBuffMultiplier;
  if (activeExpBuffMultiplier !== 1) {
    rewardNotes.push(`임시 경험치 버프로 경험치 ${activeExpBuffMultiplier.toFixed(2)}배`);
  }
  const expReward = Math.max(0, Math.floor(getRequiredExp(participant.level) * rewardRatio * rewardMultiplier * expBonusMultiplier));
  const businessCards = Math.max(0, Math.round((sharedBaseRewards?.businessCards || 0) * rewardMultiplier));
  const bacchus = Math.max(0, Math.round((sharedBaseRewards?.bacchus || 0) * rewardMultiplier));
  const monami = Math.max(0, Math.round((sharedBaseRewards?.monami || 0) * rewardMultiplier));
  const moneyReward = Math.max(0, Number(((sharedBaseRewards?.moneyReward || 0) * rewardMultiplier).toFixed(2)));
  const fragments = Math.max(0, Math.round((sharedBaseRewards?.fragments || 0) * rewardMultiplier));
  const equipmentCount = sharedBaseRewards?.equipment ? Math.max(0, Math.round(rewardMultiplier)) : 0;
  const scrollCount = sharedBaseRewards?.scrollItemId ? Math.max(0, Math.round(rewardMultiplier)) : 0;
  const itemRewards = [
    { itemId: 'business_card', quantity: businessCards },
    { itemId: 'bacchus', quantity: bacchus },
    { itemId: 'reward_pen_monami', quantity: monami },
    { itemId: 'equipment_fragment', quantity: fragments },
    { itemId: sharedBaseRewards?.scrollItemId, quantity: scrollCount }
  ].filter((entry) => entry.itemId && entry.quantity > 0);
  const equipmentRewards = sharedBaseRewards?.equipment && equipmentCount > 0
    ? Array.from({ length: equipmentCount }, () => cloneEquipmentEntry(sharedBaseRewards.equipment))
    : [];
  const potatoRehabGrowth = (activeBattle.potatoRehabKillUserIds || []).includes(participant.userId)
    ? {
        increment: getPotatoRehabGrowthIncrement(participant, activeBattle),
        clearLevel: Math.max(1, Math.floor(Number(participant.level || 1)))
      }
    : null;

  const rewardSummaryParts = [];
  if (expReward > 0) rewardSummaryParts.push(`경험치 ${expReward.toLocaleString()}`);
  itemRewards.forEach((entry) => {
    rewardSummaryParts.push(`${ITEM_DATA[entry.itemId]?.name || entry.itemId} ${Number(entry.quantity).toLocaleString()}개`);
  });
  if (equipmentRewards.length > 0) rewardSummaryParts.push(`${buildEquipmentDisplayName(sharedBaseRewards.equipment)} ${Number(equipmentRewards.length).toLocaleString()}개`);
  if (moneyReward > 0) rewardSummaryParts.push(`${Number(moneyReward).toLocaleString()}원`);
  if (potatoRehabGrowth) rewardSummaryParts.push(`<감자의 재활훈련> 데미지 +${Number(potatoRehabGrowth.increment).toLocaleString()}`);

  const bossName = RAID_BOSS_DATA[activeBattle.bossId]?.name || '보스';
  const summaryText = rewardSummaryParts.length ? rewardSummaryParts.join(', ') : '획득한 보상이 없습니다.';
  const noteText = rewardNotes.length ? `\n적용 보정: ${rewardNotes.join(', ')}` : '';

  return {
    giftType: 'raidReward',
    giftId: `raid:${activeBattle.battleId}:${participant.userId}`,
    quantity: 1,
    title: `${bossName} 레이드 클리어 보상`,
    description: `${summaryText}\n클리어 당시 Lv.${Math.max(1, Math.floor(Number(participant.level || 1)))} 기준 경험치로 확정되었습니다.${noteText}`,
    payload: {
      raidReward: {
        battleId: activeBattle.battleId,
        bossId: activeBattle.bossId,
        bossName,
        mode: battleMode,
        participantLevel: Math.max(1, Math.floor(Number(participant.level || 1))),
        expReward,
        moneyReward,
        items: itemRewards,
        equipments: equipmentRewards,
        potatoRehabGrowth,
        dailyOnceRewardBonusUsed,
        notes: rewardNotes,
        summary: summaryText
      }
    },
    expiresAt: new Date(now.getTime() + RAID_REWARD_MAIL_EXPIRY_MS)
  };
}

async function enqueueRaidRewardMail(recipientId, mailPayload) {
  return AdminMail.findOneAndUpdate(
    {
      recipientId,
      giftType: 'raidReward',
      giftId: mailPayload.giftId
    },
    {
      $setOnInsert: {
        recipientId,
        ...mailPayload,
        status: 'pending',
        createdAt: new Date()
      }
    },
    {
      upsert: true,
      returnDocument: 'after',
      setDefaultsOnInsert: true
    }
  );
}

function applyRaidRewardMailToUser(user, mail) {
  ensureUserDefaults(user);
  const reward = mail.payload?.raidReward || {};
  const claimedParts = [];
  const expReward = Math.max(0, Math.floor(Number(reward.expReward || 0)));
  const moneyReward = Math.max(0, Number(reward.moneyReward || 0));

  if (moneyReward > 0) {
    user.gameState.money += moneyReward;
    claimedParts.push(`${Number(moneyReward).toLocaleString()}원`);
  }

  (Array.isArray(reward.items) ? reward.items : []).forEach((entry) => {
    const itemId = entry?.itemId;
    const quantity = Math.max(0, Math.round(Number(entry?.quantity || 0)));
    if (!itemId || quantity <= 0) return;
    addItemToInventory(user, itemId, quantity);
    claimedParts.push(`${ITEM_DATA[itemId]?.name || itemId} ${quantity.toLocaleString()}개`);
  });

  (Array.isArray(reward.equipments) ? reward.equipments : []).forEach((equipment) => {
    if (!equipment?.equipmentType) return;
    user.equipments.push(cloneEquipmentEntry(equipment));
    claimedParts.push(buildEquipmentDisplayName(equipment));
  });

  if (expReward > 0) {
    user.gameState.exp += expReward;
    checkLevelUp(user);
    claimedParts.push(`경험치 ${expReward.toLocaleString()}`);
  }

  if (reward.potatoRehabGrowth) {
    const increment = Math.max(0, Math.floor(Number(reward.potatoRehabGrowth.increment || 0)));
    if (increment > 0) {
      const previousDamage = getPotatoRehabDamage(user);
      user.meta.potatoRehabDamage = previousDamage + increment;
      user.meta.potatoRehabKillCount = getPotatoRehabKillCount(user) + 1;
      claimedParts.push(`<감자의 재활훈련> 데미지 +${increment.toLocaleString()}`);
    }
  }

  reconcileEmblems(user);
  return `${mail.title}을 수령했습니다. ${claimedParts.length ? claimedParts.join(', ') : '획득한 보상은 없습니다.'}`;
}

function applyAdminMailGiftToUser(user, mail) {
  ensureUserDefaults(user);

  if (mail.giftType === 'raidReward') {
    return applyRaidRewardMailToUser(user, mail);
  }

  if (mail.giftType === 'message') {
    return `${mail.title || '운영자 메시지'}을(를) 확인했습니다.`;
  }

  if (mail.giftType === 'item' || mail.giftType === 'fragment') {
    const itemId = mail.payload?.actualGiftItemId || getRewardVariantItemId(mail.giftId);
    addItemToInventory(user, itemId, Math.max(1, Math.floor(Number(mail.quantity || 1))));
    return `${ITEM_DATA[itemId]?.name || itemId} ${Math.max(1, Math.floor(Number(mail.quantity || 1)))}개를 수령했습니다.`;
  }

  if (mail.giftType === 'buff') {
    const buff = BUFF_DATA[mail.giftId];
    if (!buff) throw createHttpError(400, '존재하지 않는 버프 우편입니다.');
    setOrRefreshBuff(user, mail.giftId, buff.durationMs);
    return `${buff.name} 버프를 수령했습니다.`;
  }

  if (mail.giftType === 'package') {
    const packageInfo = applySupportPackage(user, mail.giftId);
    if (!packageInfo) throw createHttpError(400, '존재하지 않는 패키지 우편입니다.');
    return `${packageInfo.name} 패키지를 수령했습니다.`;
  }

  if (mail.giftType === 'title') {
    const title = TITLE_DATA[mail.giftId];
    if (!title) throw createHttpError(400, '존재하지 않는 칭호 우편입니다.');
    unlockTitle(user, mail.giftId, { notify: false });
    return `<${title.name}> 칭호를 수령했습니다.`;
  }

  throw createHttpError(400, '처리할 수 없는 우편입니다.');
}

async function expireAdminMails(userId = null, now = new Date()) {
  const filter = {
    status: 'pending',
    expiresAt: { $lte: now }
  };
  if (userId) filter.recipientId = userId;
  await AdminMail.updateMany(filter, { $set: { status: 'expired' } });
}

async function getPendingAdminMailCount(userId, now = new Date()) {
  if (!userId) return 0;
  return AdminMail.countDocuments({
    recipientId: userId,
    status: 'pending',
    expiresAt: { $gt: now }
  });
}

function formatAdminMail(mail, now = new Date()) {
  const expiresAt = new Date(mail.expiresAt);
  const remainingMs = Math.max(0, expiresAt.getTime() - now.getTime());
  return {
    id: String(mail._id),
    title: mail.title,
    description: mail.description || '',
    giftType: mail.giftType,
    giftId: mail.giftId,
    quantity: Math.max(1, Math.floor(Number(mail.quantity || 1))),
    createdAt: mail.createdAt,
    expiresAt: mail.expiresAt,
    remainingSeconds: Math.ceil(remainingMs / 1000)
  };
}

async function getPendingAdminMailList(userId, now = new Date()) {
  await expireAdminMails(userId, now);
  const mails = await AdminMail.find({
    recipientId: userId,
    status: 'pending',
    expiresAt: { $gt: now }
  }).sort({ createdAt: -1 });
  return mails.map((mail) => formatAdminMail(mail, now));
}

async function claimAdminMail(userId, mailId, now = new Date()) {
  const mail = await AdminMail.findOneAndUpdate(
    {
      _id: mailId,
      recipientId: userId,
      status: 'pending',
      expiresAt: { $gt: now }
    },
    { $set: { status: 'claiming' } },
    { returnDocument: 'after' }
  );

  if (!mail) {
    throw createHttpError(404, '수령할 수 있는 우편을 찾을 수 없습니다.');
  }

  try {
    const message = await runUserMutationWithRetry(userId, (user) => {
      calculateOfflineGains(user, now);
      const claimMessage = applyAdminMailGiftToUser(user, mail);
      reconcileTitles(user, now);
      reconcileEmblems(user);
      user.gameState.lastActionTime = now;
      return claimMessage;
    }, {
      conflictLabel: 'Admin mail claim conflict',
      snapshotBuilder: buildUserActionPersistenceSnapshot
    });

    mail.status = 'claimed';
    mail.claimedAt = now;
    await mail.save();
    return message;
  } catch (err) {
    await AdminMail.updateOne(
      { _id: mail._id, status: 'claiming' },
      { $set: { status: 'pending' } }
    );
    throw err;
  }
}
async function claimAdminMailsBatch(userId, now = new Date()) {
  await expireAdminMails(userId, now);
  const pendingMails = await AdminMail.find({
    recipientId: userId,
    status: 'pending',
    expiresAt: { $gt: now }
  }).sort({ createdAt: 1 });

  if (!pendingMails.length) {
    const user = await User.findById(userId);
    if (!user) throw createHttpError(404, '사용자를 찾을 수 없습니다.');
    ensureUserDefaults(user);
    const response = await buildFastUserResponseWithGlobals(user, now);
    response.mail = {
      mails: await getPendingAdminMailList(user._id, now),
      claimedCount: 0,
      messages: []
    };
    return response;
  }

  const pendingIds = pendingMails.map((mail) => mail._id);
  await AdminMail.updateMany(
    {
      _id: { $in: pendingIds },
      recipientId: userId,
      status: 'pending',
      expiresAt: { $gt: now }
    },
    { $set: { status: 'claiming' } }
  );

  const claimableMails = await AdminMail.find({
    _id: { $in: pendingIds },
    recipientId: userId,
    status: 'claiming'
  }).sort({ createdAt: 1 });

  if (!claimableMails.length) {
    const user = await User.findById(userId);
    if (!user) throw createHttpError(404, '사용자를 찾을 수 없습니다.');
    ensureUserDefaults(user);
    const response = await buildFastUserResponseWithGlobals(user, now);
    response.mail = {
      mails: await getPendingAdminMailList(user._id, now),
      claimedCount: 0,
      messages: []
    };
    return response;
  }

  try {
    return await runUserMutationWithRetry(userId, (user) => {
      const mutationNow = new Date();
      calculateOfflineGains(user, mutationNow);

      const messages = [];
      const claimedIds = [];
      const skippedIds = [];

      for (const mail of claimableMails) {
        try {
          messages.push(applyAdminMailGiftToUser(user, mail));
          claimedIds.push(mail._id);
        } catch (err) {
          skippedIds.push(mail._id);
          console.error('Admin mail claim-all item skipped:', err);
        }
      }

      reconcileTitles(user, mutationNow);
      reconcileEmblems(user);
      user.gameState.lastActionTime = mutationNow;

      return {
        messages,
        claimedIds,
        skippedIds,
        claimedAt: mutationNow
      };
    }, {
      conflictLabel: 'Admin mail claim-all conflict',
      snapshotBuilder: buildUserActionPersistenceSnapshot,
      afterSave: async (user, result) => {
        if (result.claimedIds.length) {
          await AdminMail.updateMany(
            { _id: { $in: result.claimedIds }, status: 'claiming' },
            { $set: { status: 'claimed', claimedAt: result.claimedAt } }
          );
        }
        if (result.skippedIds.length) {
          await AdminMail.updateMany(
            { _id: { $in: result.skippedIds }, status: 'claiming' },
            { $set: { status: 'pending' } }
          );
        }

        const responseNow = new Date();
        const response = await buildFastUserResponseWithGlobals(user, responseNow);
        response.mail = {
          mails: await getPendingAdminMailList(user._id, responseNow),
          claimedCount: result.messages.length,
          messages: result.messages
        };
        return response;
      }
    });
  } catch (err) {
    await AdminMail.updateMany(
      { _id: { $in: pendingIds }, status: 'claiming' },
      { $set: { status: 'pending' } }
    );
    throw err;
  }
}


function getEquipmentScrollRule(itemId) {
  return EQUIPMENT_SCROLL_RULES[itemId] || null;
}

function getEquipmentTypeName(equipmentType) {
  return equipmentType === EQUIPMENT_TYPE_ATTACK ? '기본 공격력' : '카드 효과';
}

function buildEquipmentEnhanceLog(scrollItemId, equipment, success) {
  const scrollName = ITEM_DATA[scrollItemId]?.name || scrollItemId;
  const successRate = Math.round((getEquipmentScrollRule(scrollItemId)?.successRate || 0) * 100);
  const equipmentName = buildEquipmentDisplayName(equipment);
  if (success) {
    return `${scrollName} ${successRate}%가 한 순간 빛나더니 신비로운 힘이 그대로 ${equipmentName}에 전해졌습니다.`;
  }
  return `${scrollName} ${successRate}%가 한 순간 빛났지만 ${equipmentName}에는 아무런 변화도 일어나지 않았습니다.`;
}

function applyWorkDrop(user) {
  if (Math.random() >= EQUIPMENT_DROP_CHANCE) return null;

  const totalWeight = EQUIPMENT_GEAR_DROP_WEIGHT + EQUIPMENT_SCROLL_DROP_WEIGHT;
  const gearRoll = Math.random() * totalWeight;
  if (gearRoll < EQUIPMENT_GEAR_DROP_WEIGHT) {
    const equipmentType = Math.random() < 0.5 ? EQUIPMENT_TYPE_CARD : EQUIPMENT_TYPE_ATTACK;
    const equipment = createEquipmentEntry(equipmentType);
    user.equipments.push(equipment);
    return {
      type: 'equipment',
      text: `${buildEquipmentDisplayName(equipment)}를 획득했습니다! (${buildEquipmentDescription(equipment)})`,
      equipment
    };
  }

  const scrollItemIds = Object.keys(EQUIPMENT_SCROLL_RULES);
  const scrollItemId = scrollItemIds[Math.floor(Math.random() * scrollItemIds.length)];
  addItemToInventory(user, scrollItemId, 1);
  return {
    type: 'scroll',
    text: `${ITEM_DATA[scrollItemId].name} 1개를 획득했습니다!`,
    itemId: scrollItemId
  };
}

function applyWorkDrops(user, attempts = 1, options = {}) {
  const normalizedAttempts = Math.max(0, Math.floor(Number(attempts) || 0));
  const drops = [];
  for (let index = 0; index < normalizedAttempts; index += 1) {
    if (options.includeRepairCoupon && Math.random() < WORK_REPAIR_COUPON_DROP_CHANCE) {
      addItemToInventory(user, 'excavation_repair_coupon', 1);
      drops.push({
        type: 'item',
        itemId: 'excavation_repair_coupon',
        quantity: 1,
        text: '발굴 기계 수리 쿠폰 1개를 획득했습니다.'
      });
    }
    const drop = applyWorkDrop(user);
    if (drop) drops.push(drop);
  }
  return drops;
}

function decodeXmlEntities(value = '') {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripHtml(value = '') {
  return decodeXmlEntities(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripNewsTypingSourceSuffix(value = '') {
  let text = String(value).trim();
  for (let index = 0; index < 4; index += 1) {
    const match = text.match(/\s*[-|]\s*([^-|]{2,80})$/);
    if (!match) break;

    const body = text.slice(0, match.index).trim();
    if (body.length < 12) break;
    text = body;
  }
  return text;
}

function sanitizeNewsTypingSentence(value = '') {
  let text = stripHtml(value)
    .normalize('NFKC')
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gi, ' ')
    .replace(/\[[^\]]{1,20}\]/g, '')
    .replace(/\([^)]{1,20}(?:신문|일보|뉴스|경제|방송|TV|데일리|타임즈|헤럴드|연합|통신)[^)]{0,10}\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  text = stripNewsTypingSourceSuffix(text);

  text = text
    .replace(/\s*[-|]\s*[^-|]{1,25}(?:신문|일보|뉴스|경제|방송|TV|데일리|타임즈|헤럴드|연합|통신)\s*$/i, '')
    .replace(/\s+[가-힣A-Za-z0-9]{1,20}(?:신문|일보|뉴스|경제|방송|TV|데일리|타임즈|헤럴드|연합|통신)\s*$/i, '')
    .replace(/[^\uAC00-\uD7A3A-Za-z0-9\s.,!?'"():;%+\-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return stripNewsTypingSourceSuffix(text).replace(/\s+/g, ' ').trim();
}

function normalizeNewsTypingAnswer(value = '') {
  return sanitizeNewsTypingSentence(value)
    .replace(/\s+/g, ' ')
    .trim();
}

function getNewsTypingUnitCount(text = '') {
  return normalizeNewsTypingAnswer(text).replace(/\s/g, '').length;
}

function createSeededRandom(seedText = '') {
  let seed = 0;
  String(seedText).split('').forEach((char) => {
    seed = ((seed << 5) - seed + char.charCodeAt(0)) >>> 0;
  });
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function pickNewsTypingRevealRange(text, random) {
  const matches = [...String(text).matchAll(/[\uAC00-\uD7A3A-Za-z0-9]{2,}/g)];
  if (!matches.length) return null;
  const candidates = matches.filter((match) => match[0].length <= 8);
  const pool = candidates.length ? candidates : matches;
  const picked = pool[Math.floor(random() * pool.length)];
  return {
    start: picked.index,
    end: picked.index + picked[0].length
  };
}

function buildNewsTypingDisplaySegments(text, seed) {
  const random = createSeededRandom(seed);
  const ruleRoll = random();
  const fakeChars = ['※', '★', 'x', '0', 'ㄱ', '7', '?'];
  const revealRange = null;
  const fakeStyle = ruleRoll < 0.34 ? 'red' : ruleRoll < 0.68 ? 'gray' : 'paren';
  const instructionParts = [
    '캔버스에 그려진 문장을 직접 입력해주세요.',
    '옅은 회색 취소선 또는 빨간 글자는 입력하지 않습니다.'
  ];
  if (fakeStyle === 'paren') {
    instructionParts.push('괄호 안 보조문구도 입력하지 않습니다.');
  }

  const segments = [];
  let targetBuffer = '';
  let revealedBuffer = '';
  let nonSpaceCount = 0;
  const flushTarget = () => {
    if (targetBuffer) {
      segments.push({ text: targetBuffer, role: 'target' });
      targetBuffer = '';
    }
  };
  const flushReveal = () => {
    if (revealedBuffer) {
      segments.push({ text: revealedBuffer, role: 'target', reveal: true });
      revealedBuffer = '';
    }
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const isRevealChar = revealRange && index >= revealRange.start && index < revealRange.end && /\S/.test(char);
    if (isRevealChar) {
      flushTarget();
      revealedBuffer += char;
    } else {
      flushReveal();
      targetBuffer += char;
    }

    if (/\S/.test(char)) {
      nonSpaceCount += 1;
      const shouldInsertFake = nonSpaceCount > 0 && nonSpaceCount % (5 + Math.floor(random() * 5)) === 0 && random() < 0.55;
      if (shouldInsertFake) {
        flushTarget();
        flushReveal();
        const fakeText = fakeStyle === 'paren'
          ? `(${fakeChars[Math.floor(random() * fakeChars.length)]})`
          : fakeChars[Math.floor(random() * fakeChars.length)];
        segments.push({
          text: fakeText,
          role: 'decoy',
          style: fakeStyle
        });
      }
    }
  }
  flushTarget();
  flushReveal();

  return {
    segments,
    instruction: instructionParts.join(' ')
  };
}

function buildClientNewsTypingPrompt(prompt) {
  if (!prompt) return null;
  return {
    id: prompt.id,
    unitCount: prompt.unitCount,
    wordCount: prompt.wordCount,
    displaySegments: Array.isArray(prompt.displaySegments) ? prompt.displaySegments : [{ text: prompt.text || '', role: 'target' }],
    instruction: prompt.instruction || '캔버스에 그려진 문장을 직접 입력해주세요. 표시된 제외 규칙을 지켜주세요.',
    canvasSeed: prompt.canvasSeed || prompt.id
  };
}

function buildNewsTypingPrompt(text) {
  const normalizedText = sanitizeNewsTypingSentence(text);
  const id = crypto.createHash('sha1').update(normalizedText).digest('hex').slice(0, 16);
  const canvasSeed = crypto.createHash('sha1').update(`${normalizedText}:canvas-v2`).digest('hex').slice(0, 16);
  const display = buildNewsTypingDisplaySegments(normalizedText, canvasSeed);
  return {
    id,
    text: normalizedText,
    unitCount: getNewsTypingUnitCount(normalizedText),
    wordCount: getNewsTypingUnitCount(normalizedText),
    displaySegments: display.segments,
    instruction: display.instruction,
    canvasSeed
  };
}

function parseRssTypingCandidates(xml = '') {
  const candidates = [];
  const itemMatches = String(xml).match(/<item\b[\s\S]*?<\/item>/gi) || [];
  itemMatches.forEach((itemXml) => {
    const titleMatch = itemXml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const sentence = sanitizeNewsTypingSentence(titleMatch?.[1] || '');
    if (sentence.length >= 12 && sentence.length <= 100 && getNewsTypingUnitCount(sentence) >= 8) {
      candidates.push(sentence);
    }
  });
  return candidates;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = NEWS_TYPING_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshNewsTypingPrompts() {
  const now = Date.now();
  const candidates = [];
  const fetchStats = [];
  await Promise.allSettled(NEWS_TYPING_RSS_FEEDS.map(async (url) => {
    try {
      const response = await fetchWithTimeout(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 HoiOfficeGame/2.0',
          Accept: 'application/rss+xml, application/xml, text/xml, */*'
        }
      });
      if (!response.ok) throw new Error(`RSS fetch failed: ${response.status}`);
      const xml = await response.text();
      const parsedCandidates = parseRssTypingCandidates(xml);
      candidates.push(...parsedCandidates);
      fetchStats.push({
        url,
        ok: true,
        status: response.status,
        itemCount: (String(xml).match(/<item\b/gi) || []).length,
        candidateCount: parsedCandidates.length
      });
    } catch (err) {
      fetchStats.push({
        url,
        ok: false,
        error: err?.cause?.code || err?.message || String(err)
      });
    }
  }));

  const uniqueSentences = [...new Map(candidates
    .filter((sentence) => !/Google\s*뉴스/i.test(sentence))
    .filter((sentence) => !/&[a-z0-9#]+;/i.test(sentence))
    .filter((sentence) => /[\uAC00-\uD7A3A-Za-z0-9]/.test(sentence))
    .map((sentence) => [normalizeNewsTypingAnswer(sentence), sentence])).values()]
    .slice(0, 120);

  const usingFallback = uniqueSentences.length === 0;
  const prompts = (usingFallback ? [...NEWS_TYPING_FALLBACK_SENTENCES].sort(() => Math.random() - 0.5) : uniqueSentences)
    .map(buildNewsTypingPrompt)
    .filter((prompt) => prompt.text && prompt.unitCount > 0);

  if (prompts.length) {
    newsTypingCache = {
      fetchedAt: now,
      prompts,
      fallback: usingFallback,
      stats: fetchStats
    };
    if (usingFallback) {
      console.warn('News typing RSS fallback used:', fetchStats);
    }
  } else if (!newsTypingCache.prompts.length) {
    newsTypingCache = {
      fetchedAt: now,
      prompts: NEWS_TYPING_FALLBACK_SENTENCES.map(buildNewsTypingPrompt),
      fallback: true,
      stats: fetchStats
    };
    console.warn('News typing RSS fallback used with empty prompt build:', fetchStats);
  }

  return newsTypingCache.prompts;
}

function startNewsTypingRefreshInBackground() {
  if (newsTypingFetchPromise) return newsTypingFetchPromise;
  newsTypingFetchPromise = refreshNewsTypingPrompts()
    .catch((err) => {
      console.warn('News typing background refresh failed:', err?.message || err);
      return newsTypingCache.prompts;
    })
    .finally(() => {
      newsTypingFetchPromise = null;
    });
  return newsTypingFetchPromise;
}

async function fetchNewsTypingPrompts(force = false) {
  const now = Date.now();
  const cacheFresh = newsTypingCache.prompts.length
    && now - newsTypingCache.fetchedAt < (newsTypingCache.fallback ? NEWS_TYPING_FALLBACK_CACHE_TTL_MS : NEWS_TYPING_CACHE_TTL_MS);
  if (!force && cacheFresh) return newsTypingCache.prompts;

  if (!force && newsTypingCache.prompts.length) {
    startNewsTypingRefreshInBackground();
    return newsTypingCache.prompts;
  }

  if (!force && !newsTypingCache.prompts.length) {
    newsTypingCache = {
      fetchedAt: now,
      prompts: NEWS_TYPING_FALLBACK_SENTENCES.map(buildNewsTypingPrompt),
      fallback: true,
      stats: [{ ok: false, error: 'initial_fallback' }]
    };
    startNewsTypingRefreshInBackground();
    return newsTypingCache.prompts;
  }

  if (newsTypingFetchPromise) return newsTypingFetchPromise;
  return startNewsTypingRefreshInBackground();
}

function cleanupNewsTypingSubmissionGuards(now = Date.now()) {
  for (const [key, expiresAt] of recentNewsTypingSubmissions.entries()) {
    if (expiresAt <= now) recentNewsTypingSubmissions.delete(key);
  }
}

function reserveNewsTypingSubmission(userId, promptId) {
  cleanupNewsTypingSubmissionGuards();
  const key = `${userId}:${promptId}`;
  if (activeNewsTypingSubmissions.has(key) || (recentNewsTypingSubmissions.get(key) || 0) > Date.now()) {
    return null;
  }
  activeNewsTypingSubmissions.add(key);
  return key;
}

function markNewsTypingSubmissionSettled(key) {
  if (!key) return;
  recentNewsTypingSubmissions.set(key, Date.now() + NEWS_TYPING_DUPLICATE_WINDOW_MS);
}

function getRequestIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '';
}

function updateNewsTypingIpActivity(ip, userId, nowMs, isFast) {
  if (!ip) return { busyIp: false, multiAccountIp: false };
  const existing = newsTypingIpActivity.get(ip) || [];
  const nextEntries = existing
    .filter((entry) => nowMs - entry.at <= NEWS_TYPING_ANTICHEAT_IP_WINDOW_MS)
    .concat([{ at: nowMs, userId: String(userId), isFast: Boolean(isFast) }]);
  newsTypingIpActivity.set(ip, nextEntries);

  for (const [storedIp, entries] of newsTypingIpActivity.entries()) {
    const freshEntries = entries.filter((entry) => nowMs - entry.at <= NEWS_TYPING_ANTICHEAT_IP_WINDOW_MS);
    if (freshEntries.length) newsTypingIpActivity.set(storedIp, freshEntries);
    else newsTypingIpActivity.delete(storedIp);
  }

  const accountCount = new Set(nextEntries.map((entry) => entry.userId)).size;
  const fastCount = nextEntries.filter((entry) => entry.isFast).length;
  return {
    busyIp: nextEntries.length >= 48 || fastCount >= 26,
    multiAccountIp: accountCount >= 4 && nextEntries.length >= 28
  };
}

function updateWorkClickIpActivity(ip, userId, nowMs, isFast) {
  if (!ip) return { busyIp: false, multiAccountIp: false };
  const existing = workClickIpActivity.get(ip) || [];
  const nextEntries = existing
    .filter((entry) => nowMs - entry.at <= WORK_CLICK_ANTICHEAT_IP_WINDOW_MS)
    .concat([{ at: nowMs, userId: String(userId), isFast: Boolean(isFast) }]);
  workClickIpActivity.set(ip, nextEntries);

  for (const [storedIp, entries] of workClickIpActivity.entries()) {
    const freshEntries = entries.filter((entry) => nowMs - entry.at <= WORK_CLICK_ANTICHEAT_IP_WINDOW_MS);
    if (freshEntries.length) workClickIpActivity.set(storedIp, freshEntries);
    else workClickIpActivity.delete(storedIp);
  }

  const accountCount = new Set(nextEntries.map((entry) => entry.userId)).size;
  const fastCount = nextEntries.filter((entry) => entry.isFast).length;
  return {
    busyIp: nextEntries.length >= 140 || fastCount >= 75,
    multiAccountIp: accountCount >= 4 && nextEntries.length >= 90
  };
}

function getNewsTypingCoefficientOfVariation(values) {
  const samples = values.filter((value) => Number.isFinite(value) && value > 0);
  if (samples.length < 6) return 1;
  const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  if (!average) return 1;
  const variance = samples.reduce((sum, value) => sum + ((value - average) ** 2), 0) / samples.length;
  return Math.sqrt(variance) / average;
}

function applyWorkClickAntiCheat(user, { now, ip }) {
  ensureUserDefaults(user);
  const state = user.meta.workClickAntiCheat;
  const nowMs = now.getTime();
  const penaltyUntilMs = state.penaltyUntil ? new Date(state.penaltyUntil).getTime() : 0;
  if (penaltyUntilMs > nowMs) {
    const remainingSeconds = Math.ceil((penaltyUntilMs - nowMs) / 1000);
    throw createHttpError(429, `서류작업 클릭 쿨타임 중입니다. ${remainingSeconds}초 후 다시 시도해주세요.`);
  }

  const lastSubmittedAtMs = state.lastSubmittedAt ? new Date(state.lastSubmittedAt).getTime() : 0;
  const intervalMs = lastSubmittedAtMs ? Math.max(0, nowMs - lastSubmittedAtMs) : 0;
  const isTooFast = intervalMs > 0 && intervalMs < WORK_CLICK_ANTICHEAT_MIN_INTERVAL_MS;
  const ipSignals = updateWorkClickIpActivity(ip, user._id, nowMs, isTooFast);
  const nextIntervals = intervalMs > 0
    ? state.intervalsMs.concat(intervalMs).slice(-WORK_CLICK_ANTICHEAT_INTERVAL_LIMIT)
    : state.intervalsMs.slice(-WORK_CLICK_ANTICHEAT_INTERVAL_LIMIT);
  const recentIntervals = nextIntervals.slice(-18);
  const averageInterval = recentIntervals.length
    ? recentIntervals.reduce((sum, value) => sum + value, 0) / recentIntervals.length
    : 0;
  const intervalVariation = getNewsTypingCoefficientOfVariation(recentIntervals);
  const suspiciouslyEven = recentIntervals.length >= 16 && averageInterval < 520 && intervalVariation < 0.035;
  const suspiciouslyFast = recentIntervals.length >= 12 && averageInterval < 90;

  let score = Math.max(0, Number(state.suspiciousScore || 0));
  score = Math.max(0, score - 0.32);
  if (isTooFast) score += 0.9;
  if (suspiciouslyFast) score += 0.9;
  if (suspiciouslyEven) score += 0.8;
  if (ipSignals.busyIp) score += 0.6;
  if (ipSignals.multiAccountIp) score += 0.5;

  let rewardMultiplier = 1;
  let warning = '';
  if (score >= 18) {
    state.penaltyUntil = new Date(nowMs + WORK_CLICK_ANTICHEAT_COOLDOWN_MS);
    score = 12;
    rewardMultiplier = 0;
    warning = '서류작업 매크로 의심 패턴이 감지되어 짧은 쿨타임이 적용되었습니다.';
  } else if (score >= 13) {
    rewardMultiplier = 0.5;
    warning = '서류작업 매크로 의심 패턴이 감지되어 클릭 보상이 50%만 적용됩니다.';
  } else if (score >= 9) {
    rewardMultiplier = 0.75;
    warning = '클릭 간격이 매우 빠르거나 일정해 클릭 보상이 일부 감소했습니다.';
  } else if (score >= 6) {
    rewardMultiplier = 0.9;
    warning = '클릭 간격이 비정상적으로 빨라 클릭 보상이 소폭 감소했습니다.';
  } else {
    state.penaltyUntil = null;
  }

  state.lastSubmittedAt = now;
  state.intervalsMs = nextIntervals;
  state.suspiciousScore = Number(score.toFixed(2));
  state.lastIp = ip || state.lastIp || '';

  return {
    rewardMultiplier,
    warning,
    suspiciousScore: state.suspiciousScore
  };
}

function applyNewsTypingAntiCheat(user, { now, unitCount, ip }) {
  ensureUserDefaults(user);
  const state = user.meta.newsTypingAntiCheat;
  const nowMs = now.getTime();
  const penaltyUntilMs = state.penaltyUntil ? new Date(state.penaltyUntil).getTime() : 0;
  if (penaltyUntilMs > nowMs) {
    const remainingSeconds = Math.ceil((penaltyUntilMs - nowMs) / 1000);
    throw createHttpError(429, `타이핑 보상 쿨타임 중입니다. ${remainingSeconds}초 후 다시 시도해주세요.`);
  }

  const lastSubmittedAtMs = state.lastSubmittedAt ? new Date(state.lastSubmittedAt).getTime() : 0;
  const intervalMs = lastSubmittedAtMs ? Math.max(0, nowMs - lastSubmittedAtMs) : 0;
  const minHumanMs = Math.max(NEWS_TYPING_ANTICHEAT_MIN_SUBMIT_MS, unitCount * 35);
  const speed = intervalMs > 0 ? unitCount / (intervalMs / 1000) : 0;
  const isFast = intervalMs > 0 && (intervalMs < minHumanMs || speed > NEWS_TYPING_ANTICHEAT_SPEED_LIMIT);
  const ipSignals = updateNewsTypingIpActivity(ip, user._id, nowMs, isFast);

  const nextIntervals = intervalMs > 0
    ? state.intervalsMs.concat(intervalMs).slice(-NEWS_TYPING_ANTICHEAT_INTERVAL_LIMIT)
    : state.intervalsMs.slice(-NEWS_TYPING_ANTICHEAT_INTERVAL_LIMIT);
  const nextSpeeds = speed > 0
    ? state.speedSamples.concat(Number(speed.toFixed(2))).slice(-NEWS_TYPING_ANTICHEAT_INTERVAL_LIMIT)
    : state.speedSamples.slice(-NEWS_TYPING_ANTICHEAT_INTERVAL_LIMIT);
  const recentIntervals = nextIntervals.slice(-12);
  const recentSpeeds = nextSpeeds.slice(-12);
  const intervalVariation = getNewsTypingCoefficientOfVariation(recentIntervals);
  const speedVariation = getNewsTypingCoefficientOfVariation(recentSpeeds);
  const averageInterval = recentIntervals.length
    ? recentIntervals.reduce((sum, value) => sum + value, 0) / recentIntervals.length
    : 0;
  const suspiciouslyEven = recentIntervals.length >= 12
    && intervalVariation < 0.035
    && speedVariation < 0.07
    && averageInterval < 4500;

  let score = Math.max(0, Number(state.suspiciousScore || 0));
  score = Math.max(0, score - 0.55);
  if (isFast) score += 0.9;
  if (suspiciouslyEven) score += 0.8;
  if (ipSignals.busyIp) score += 0.6;
  if (ipSignals.multiAccountIp) score += 0.5;

  let rewardMultiplier = 1;
  let warning = '';
  if (score >= 18) {
    state.penaltyUntil = new Date(nowMs + NEWS_TYPING_ANTICHEAT_COOLDOWN_MS);
    score = 12;
    warning = '자동 입력 의심 패턴이 감지되어 타이핑 보상 쿨타임이 적용되었습니다.';
    rewardMultiplier = 0;
  } else if (score >= 13) {
    rewardMultiplier = 0.5;
    warning = '자동 입력 의심 패턴이 감지되어 타이핑 보상이 50%만 적용됩니다.';
  } else if (score >= 9) {
    rewardMultiplier = 0.75;
    warning = '입력 속도가 매우 빨라 타이핑 보상이 일부 감소했습니다.';
  } else if (score >= 6) {
    rewardMultiplier = 0.9;
    warning = '입력 속도가 비정상적으로 빨라 타이핑 보상이 소폭 감소했습니다.';
  } else {
    state.penaltyUntil = null;
  }

  state.lastSubmittedAt = now;
  state.intervalsMs = nextIntervals;
  state.speedSamples = nextSpeeds;
  state.suspiciousScore = Number(score.toFixed(2));
  state.lastIp = ip || state.lastIp || '';

  return {
    rewardMultiplier,
    warning,
    suspiciousScore: state.suspiciousScore
  };
}

async function getNewsTypingPrompt(afterId = null) {
  const prompts = await fetchNewsTypingPrompts(false);
  if (!prompts.length) return null;

  if (afterId) {
    const foundIndex = prompts.findIndex((prompt) => prompt.id === afterId);
    if (foundIndex >= 0) {
      return prompts[(foundIndex + 1) % prompts.length];
    }
  }

  newsTypingCursor = (newsTypingCursor + 1) % prompts.length;
  return prompts[newsTypingCursor];
}

async function findNewsTypingPrompt(promptId) {
  if (!promptId) return null;
  const cachedPrompt = newsTypingCache.prompts.find((prompt) => prompt.id === promptId);
  if (cachedPrompt) return cachedPrompt;

  const prompts = await fetchNewsTypingPrompts(true);
  return prompts.find((prompt) => prompt.id === promptId) || null;
}

function getActiveRaidAttackBonusBuffs(participant) {
  return (Array.isArray(participant?.attackBonusBuffs) ? participant.attackBonusBuffs : [])
    .map((buff) => ({
      source: buff.source || buff.name || '공격력 상승',
      value: Math.max(0, Number(buff.value || 0)),
      turns: Math.max(0, Number(buff.turns || 0))
    }))
    .filter((buff) => buff.value > 0 && buff.turns > 0);
}

function syncRaidAttackBonusFields(participant) {
  if (!participant || !Array.isArray(participant.attackBonusBuffs)) return;
  const activeBuffs = getActiveRaidAttackBonusBuffs(participant);
  participant.attackBonusBuffs = activeBuffs;
  participant.attackBonusTurns = activeBuffs.length
    ? Math.max(...activeBuffs.map((buff) => buff.turns))
    : 0;
  participant.attackBonusPercent = activeBuffs.reduce((sum, buff) => sum + buff.value, 0);
}

function addRaidAttackBonusBuff(participant, value, turns, source = '공격력 상승') {
  if (!participant) return;
  const buffValue = Math.max(0, Number(value || 0));
  const buffTurns = Math.max(0, Number(turns || 0));
  if (buffValue <= 0 || buffTurns <= 0) return;

  if (!Array.isArray(participant.attackBonusBuffs)) {
    participant.attackBonusBuffs = [];
    const legacyTurns = Math.max(0, Number(participant.attackBonusTurns || 0));
    const legacyValue = Math.max(0, Number(participant.attackBonusPercent || 0));
    if (legacyTurns > 0 && legacyValue > 0) {
      participant.attackBonusBuffs.push({
        source: '기존 공격력 상승',
        value: legacyValue,
        turns: legacyTurns
      });
    }
  }

  participant.attackBonusBuffs.push({
    source,
    value: buffValue,
    turns: buffTurns
  });
  syncRaidAttackBonusFields(participant);
}

function buildRaidParticipantStatusEffects(participant) {
  const effects = [];
  if (Number(participant.silenceTurns || 0) > 0) effects.push({ type: 'debuff', name: '침묵', turns: Number(participant.silenceTurns || 0), desc: '스킬 사용 불가' });
  if (Number(participant.actionLockTurns || 0) > 0) effects.push({ type: 'debuff', name: '가발 찾는중..', turns: Number(participant.actionLockTurns || 0), desc: '기본 공격, 스킬 사용 불가' });
  if (Number(participant.basicAttackLockTurns || 0) > 0) effects.push({ type: 'debuff', name: '울 아들 만나봐', turns: Number(participant.basicAttackLockTurns || 0), desc: '기본 공격 불가' });
  if (Number(participant.healShieldReductionTurns || 0) > 0) {
    const reductionPercent = Math.round((1 - Number(participant.healShieldReductionMultiplier || 1)) * 100);
    effects.push({ type: 'debuff', name: '꼰대', turns: Number(participant.healShieldReductionTurns || 0), desc: `회복량 및 실드 획득량 ${Math.max(0, reductionPercent)}% 감소` });
  }
  if (Number(participant.shieldBlockTurns || 0) > 0) effects.push({ type: 'debuff', name: '실드 삭제 및 획득 불가', turns: Number(participant.shieldBlockTurns || 0), desc: '현재 실드가 제거되고 새 실드를 얻을 수 없습니다.' });
  if (Number(participant.nextHitDamageTakenMultiplier || 1) > 1) effects.push({ type: 'debuff', name: '4차까지?', desc: `다음 공격으로 받는 피해 x${Number(participant.nextHitDamageTakenMultiplier || 1).toFixed(1)}` });
  if (Number(participant.nailBounceDelayTurns || 0) > 0 && Number(participant.nailBounceDamage || 0) > 0) effects.push({ type: 'debuff', name: '튕겨나간 손톱', turns: Number(participant.nailBounceDelayTurns || 0), desc: `${Number(participant.nailBounceDamage || 0)} 피해 예정` });
  if (Number(participant.counterTurns || 0) > 0) effects.push({ type: 'buff', name: '반격', turns: Number(participant.counterTurns || 0), desc: '보스에게 피격당하면 기본 공격으로 반격' });
  if (Number(participant.negateHitCount || 0) > 0) effects.push({ type: 'buff', name: '피격 무효', count: Number(participant.negateHitCount || 0), desc: '다음 피격을 무효화' });
  if (Number(participant.debuffImmuneCount || 0) > 0) effects.push({ type: 'buff', name: '디버프 무효', count: Number(participant.debuffImmuneCount || 0), desc: '다음 디버프를 무효화' });
  if (Number(participant.selfEsteemCount || 0) > 0) effects.push({ type: 'buff', name: '자존감', count: Number(participant.selfEsteemCount || 0), desc: '다음 디버프를 반사합니다. 보스에게는 디버프 무효처럼 작동합니다.' });
  if (Number(participant.tauntTurns || 0) > 0) effects.push({ type: 'buff', name: '예? 저요?', turns: Number(participant.tauntTurns || 0), desc: `보스가 이 대상을 우선 타겟팅합니다. 받는 최종 피해 ${Math.round(Number(participant.tauntDamageReductionPercent || 0) * 100)}% 감소` });
  if (Number(participant.breadCount || 0) > 0) effects.push({ type: 'buff', name: '빵', count: Number(participant.breadCount || 0), desc: '피격 시 HP 5 회복 후 1개 소모' });
  if (Number(participant.critBonusTurns || 0) > 0) effects.push({ type: 'buff', name: '크리티컬 상승', turns: Number(participant.critBonusTurns || 0), desc: `치명타 확률 +${Math.round(Number(participant.critBonusValue || 0) * 100)}%` });
  if (Number(participant.hypeTurns || 0) > 0) effects.push({ type: 'buff', name: '흥겨움', turns: Number(participant.hypeTurns || 0), desc: '기본 공격 횟수 2배' });
  if (participant.internBuff) {
    effects.push({
      type: 'buff',
      name: '인턴',
      desc: `파티원이 기본 공격할 때 ${formatCardPercentText(participant.internChance || 0)} 확률로 ${formatCardPercentText(participant.internDamageMultiplier || 0.3)} 위력의 지원 기본 공격`
    });
  }
  const activeAttackBuffs = getActiveRaidAttackBonusBuffs(participant);
  if (activeAttackBuffs.length > 0) {
    const totalAttackBonus = activeAttackBuffs.reduce((sum, buff) => sum + buff.value, 0);
    const detailText = activeAttackBuffs
      .map((buff) => `${buff.source} +${Math.round(buff.value * 100)}%`)
      .join(', ');
    effects.push({
      type: 'buff',
      name: '공격력 상승',
      turns: Math.max(...activeAttackBuffs.map((buff) => buff.turns)),
      desc: `공격력 +${Math.round(totalAttackBonus * 100)}%${detailText ? ` (${detailText})` : ''}`
    });
  } else if (Number(participant.attackBonusTurns || 0) > 0) {
    effects.push({ type: 'buff', name: '공격력 상승', turns: Number(participant.attackBonusTurns || 0), desc: `공격력 +${Math.round(Number(participant.attackBonusPercent || 0) * 100)}%` });
  }
  if (Number(participant.championGuardTurns || 0) > 0) effects.push({ type: 'buff', name: '챔피언의 가호', turns: Number(participant.championGuardTurns || 0), desc: `공격력 +${Math.round(Number(participant.championGuardAttackBonus || 0) * 100)}%, 치명타 확률 +${Math.round(Number(participant.championGuardCritBonus || 0) * 100)}%` });
  if (Number(participant.subordinateTurns || 0) > 0) effects.push({ type: 'buff', name: '부하직원', turns: Number(participant.subordinateTurns || 0), desc: `레벨 +${Number(participant.subordinateLevelBonus || 0)}` });
  if (Number(participant.finalDamageBonusTurns || 0) > 0) effects.push({ type: 'buff', name: '부하직원 육성', turns: Number(participant.finalDamageBonusTurns || 0), desc: `최종 데미지 +${Math.round(Number(participant.finalDamageBonusPercent || 0) * 100)}%` });
  if (Number(participant.damageMultiplierTurns || 0) > 0) effects.push({ type: 'buff', name: '피해 증폭', turns: Number(participant.damageMultiplierTurns || 0), desc: `가하는 피해 x${Number(participant.damageMultiplierValue || 1).toFixed(2)}` });
  if (Number(participant.perHitBonusTurns || 0) > 0) effects.push({ type: 'buff', name: '추가 타격 피해', turns: Number(participant.perHitBonusTurns || 0), desc: `공격마다 +${Number(participant.perHitBonusDamage || 0).toLocaleString()} 피해` });
  if (Number(participant.celineTurns || 0) > 0) effects.push({ type: 'buff', name: '셀린느', turns: Number(participant.celineTurns || 0), desc: `공격력 +${Math.round(Number(participant.celineAttackBonusPercent || 0) * 100)}%, 종료 시 추가 피해` });
  if (Number(participant.cardEffectAmpTurns || 0) > 0) effects.push({ type: 'buff', name: '소개팅 상대', turns: Number(participant.cardEffectAmpTurns || 0), desc: `카드 효과 x${Number(participant.cardEffectAmpValue || 1).toFixed(2)}` });
  if (participant.sojuRewardBuff) effects.push({ type: 'buff', name: '소주각?', desc: `전투 승리 시 전리품 ${Number(participant.sojuRewardMultiplier || 1).toFixed(1)}배` });
  if (participant.lottoRewardBuff) effects.push({ type: 'buff', name: '이번엔 될거같아', desc: `전투 승리 시 ${formatCardPercentText(participant.lottoRewardSuccessChance || 0.5)} 확률로 전리품 3배 또는 보상 없음` });
  if (participant.hoiRewardBuff) effects.push({ type: 'buff', name: 'HOI 특수기믹', desc: `전투 승리 시 전리품 ${Number(participant.hoiRewardMultiplier || 1).toFixed(1)}배` });
  return effects;
}

function buildRaidBossStatusEffects(battle) {
  const effects = [];
  if (!battle) return effects;
  const isHardMode = isHardOrChaosRaidBattle(battle);
  const isChaosMode = isChaosRaidBattle(battle);
  if (isHardMode && battle.bossId === RAID_BOSS_ID) {
    const missingRatio = Number(battle.bossMaxHp || 0) > 0
      ? Math.max(0, Math.min(1, (Number(battle.bossMaxHp || 0) - Number(battle.bossHp || 0)) / Number(battle.bossMaxHp || 1)))
      : 0;
    const reductionPercent = isChaosRaidBattle(battle) ? Math.round(Math.min(0.75, missingRatio * 0.75) * 100) : 0;
    effects.push({
      type: 'buff',
      name: '가시갑옷',
      desc: isChaosMode
        ? `1회 피격당할 때마다 공격자에게 5 피해를 반사합니다. 잃은 체력 비례 피해 감소 ${reductionPercent}%`
        : '1회 피격당할 때마다 공격자에게 5 피해를 반사합니다.'
    });
  }
  if (isHardMode && battle.bossId === RAID_BOSS_ID_BALD_MANAGER) {
    const stacks = Math.max(0, Number(battle.bossSmoothScalpStacks || 0));
    effects.push({
      type: 'buff',
      name: '매끈한 두피',
      count: stacks || null,
      desc: isChaosMode
        ? `1P 행동 시작부터 다음 1P 행동 시작 전까지 피격될 때마다 이후 받는 피해가 10%씩 곱연산으로 감소하고, 자신의 턴마다 잃은 체력의 20%를 회복합니다.${stacks > 0 ? ` 현재 피해 수령 ${Math.round(Math.pow(0.9, stacks) * 100)}%` : ''}`
        : `1P 행동 시작부터 다음 1P 행동 시작 전까지 피격될 때마다 이후 받는 피해가 10%씩 곱연산으로 감소합니다.${stacks > 0 ? ` 현재 피해 수령 ${Math.round(Math.pow(0.9, stacks) * 100)}%` : ''}`
    });
  }
  if (isHardMode && battle.bossId === RAID_BOSS_ID_HOI) {
    effects.push({
      type: 'buff',
      name: '나 먼저 퇴근할게',
      desc: isChaosMode
        ? '매 공격을 20% 확률로 회피합니다. 회피 성공 시 총 잃은 체력의 10%를 회복합니다.'
        : '매 공격을 20% 확률로 회피합니다.'
    });
  }
  if (battle.bossId === RAID_BOSS_ID_OVERTIME_MANAGER) {
    const defeatedMinions = getRaidDeadMinionCount(battle);
    effects.push({
      type: 'buff',
      name: '야근 광기',
      count: defeatedMinions || null,
      desc: `하수인이 쓰러질 때마다 황과장이 입히는 피해가 50% 증가합니다. 현재 피해 ${Math.round(getRaidBossOutgoingDamageMultiplier(battle) * 100)}%`
    });
  }
  if (Number(battle.bossDamageReductionTurns || 0) > 0) {
    effects.push({
      type: 'buff',
      name: '카페인 도핑',
      turns: Number(battle.bossDamageReductionTurns || 0),
      desc: `받는 피해 ${Math.round(Number(battle.bossDamageReductionPercent || 0) * 100)}% 감소`
    });
  }
  if (Number(battle.bossShield || 0) > 0) {
    effects.push({
      type: 'buff',
      name: '보호막',
      turns: Number(battle.bossShieldTurns || 0) || null,
      desc: `남은 보호막 ${Number(battle.bossShield || 0).toLocaleString()}`
    });
  }
  if (Number(battle.bossNegateHits || 0) > 0) {
    effects.push({
      type: 'buff',
      name: '난 그건 싫은데?',
      count: Number(battle.bossNegateHits || 0),
      desc: '피격 시 데미지를 입지 않고 1회씩 사라집니다.'
    });
  }
  (battle.bossOvertimeDebuffs || []).forEach((entry) => {
    effects.push({
      type: 'debuff',
      name: `야근: ${entry.displayName || '알 수 없음'}`,
      count: Number(entry.stacks || 0),
      desc: `기본 공격에 피격될 때마다 내면의 분노가 쌓입니다. 현재 ${Number(entry.stacks || 0).toLocaleString()}스택`
    });
  });
  if (Number(battle.bossBlindTurns || 0) > 0) {
    effects.push({
      type: 'debuff',
      name: '눈부심',
      turns: Number(battle.bossBlindTurns || 0),
      desc: `공격 명중률 ${Math.round(Number(battle.bossBlindMissChance || 0.3) * 100)}% 감소`
    });
  }
  if (Number(battle.bossHealingReductionTurns || 0) > 0) {
    const reductionPercent = Math.round((1 - Number(battle.bossHealingReductionMultiplier || 1)) * 100);
    effects.push({
      type: 'debuff',
      name: '양치 후 귤',
      turns: Number(battle.bossHealingReductionTurns || 0),
      desc: `치유 효과 ${Math.max(0, reductionPercent)}% 감소`
    });
  }
  (battle.bossPoisonDebuffs || []).forEach((entry) => {
    effects.push({
      type: 'debuff',
      name: `중독: ${entry.displayName || '알 수 없음'}`,
      turns: Number(entry.turns || 0),
      desc: `보스가 공격할 때마다 ${Number(entry.damage || 0).toLocaleString()} 피해`
    });
  });
  return effects;
}

function getEquippedTitleDefinition(user) {
  if (!user.titles?.equipped) return null;
  return TITLE_DATA[user.titles.equipped] || null;
}

function truncateUiText(value, maxLength = 24) {
  const text = String(value || '').trim();
  const chars = Array.from(text);
  if (chars.length <= maxLength) return text;
  return `${chars.slice(0, Math.max(1, maxLength - 1)).join('')}…`;
}

function getCompactNickname(user, maxLength = 18) {
  return truncateUiText(user?.nickname || user?.username || '', maxLength);
}

function buildDisplayName(user) {
  const titleInfo = getEquippedTitleDefinition(user);
  const baseName = user.nickname || user.username;
  const titlePrefix = titleInfo ? `<${titleInfo.name}>` : '';
  return truncateUiText(`${titlePrefix}${baseName}`, 24);
}

function rollCardDraw() {
  const roll = Math.random();
  let cumulative = 0;
  let selectedGrade = 'C';
  for (const entry of CARD_DRAW_GRADE_RATES) {
    cumulative += Number(entry.rate || 0);
    if (roll < cumulative) {
      selectedGrade = entry.grade;
      break;
    }
  }
  const pool = Object.values(CARD_DATA).filter((card) => card.grade === selectedGrade);
  if (!pool.length) return Object.values(CARD_DATA).find((card) => card.grade === 'C') || Object.values(CARD_DATA)[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

function getRaidRecoveryMultiplier(target) {
  if (!target) return 1;
  const reductionMultiplier = Number(target.healShieldReductionTurns || 0) > 0
    ? Number(target.healShieldReductionMultiplier || 1)
    : 1;
  const dailyBonusMultiplier = 1 + Math.max(0, Number(target.dailyRaidHealShieldBonusPercent || 0)) / 100;
  return Number((reductionMultiplier * dailyBonusMultiplier).toFixed(4));
}

function getRaidBossHealingMultiplier(battle) {
  return Number(battle?.bossHealingReductionTurns || 0) > 0
    ? Math.max(0, Math.min(1, Number(battle.bossHealingReductionMultiplier || 1)))
    : 1;
}

function healRaidBoss(battle, amount) {
  if (!battle || Number(battle.bossHp || 0) <= 0) return 0;
  const previousHp = Number(battle.bossHp || 0);
  const missingHp = Math.max(0, Number(battle.bossMaxHp || 0) - previousHp);
  const effectiveAmount = Math.min(missingHp, Math.max(0, Math.floor(Number(amount || 0) * getRaidBossHealingMultiplier(battle))));
  if (effectiveAmount <= 0) return 0;
  battle.bossHp = Math.min(Number(battle.bossMaxHp || 0), previousHp + effectiveAmount);
  battle.bossLastHpLoss = 0;
  return effectiveAmount;
}

function getRaidBossMaxHpForMode(boss, mode = RAID_MODE_NORMAL) {
  const normalizedMode = normalizeRaidMode(mode);
  const modeOverride = boss?.maxHpByMode?.[normalizedMode];
  let baseHp;
  if (Number.isFinite(Number(modeOverride)) && Number(modeOverride) > 0) {
    baseHp = Number(modeOverride);
  } else {
    const modeConfig = getRaidModeConfig(normalizedMode);
    baseHp = Number(boss?.maxHp || 0) * Number(modeConfig.hpMultiplier || 1);
  }
  return Math.round(baseHp * (normalizedMode === RAID_MODE_CHAOS ? 3 : 1));
}

function createRaidBossMinions(bossId, mode = RAID_MODE_NORMAL) {
  if (bossId !== RAID_BOSS_ID_OVERTIME_MANAGER) return [];
  const normalizedMode = normalizeRaidMode(mode);
  const isHardMode = normalizedMode === RAID_MODE_HARD || normalizedMode === RAID_MODE_CHAOS;
  const minionDefs = [
    {
      unitId: 'overtime_choi',
      name: '야근하다 미쳐버린 최주임',
      normalHp: 30000,
      hardHp: 100000,
      attackDamage: 10
    },
    {
      unitId: 'overtime_jung',
      name: '야근하다 미쳐버린 정대리',
      normalHp: 50000,
      hardHp: 150000,
      attackDamage: 15
    }
  ];

  return minionDefs.map((minion, index) => {
    const maxHp = isHardMode ? minion.hardHp : minion.normalHp;
    return {
      unitId: minion.unitId,
      name: minion.name,
      turnOrder: index,
      maxHp,
      hp: maxHp,
      shield: 0,
      shieldTurns: 0,
      lastHpLoss: 0,
      lastShieldLoss: 0,
      attackDamage: minion.attackDamage,
      taunt: true,
      damageReduction: 0.35,
      defeatLogged: false
    };
  });
}

function getRaidLobbySummary(now = new Date(), mode = RAID_MODE_NORMAL) {
  const normalizedMode = normalizeRaidMode(mode);
  const modeConfig = getRaidModeConfig(normalizedMode);
  const boss = getRaidLobbyBoss(now, normalizedMode);
  const maxHp = getRaidBossMaxHpForMode(boss, normalizedMode);
  const usesEnhancedText = normalizedMode === RAID_MODE_CHAOS
    || (normalizedMode === RAID_MODE_HARD && boss.id === RAID_BOSS_ID_OVERTIME_MANAGER);
  const modeSkillsText = usesEnhancedText && Array.isArray(boss.hardSkillsText)
    ? boss.hardSkillsText
    : (boss.skillsText || []);
  const passiveText = normalizedMode === RAID_MODE_CHAOS
    ? boss.hardPassiveText
    : (normalizedMode === RAID_MODE_HARD ? (boss.legacyHardPassiveText || boss.hardPassiveText) : null);
  const skillsText = passiveText
    ? [passiveText, ...modeSkillsText]
    : modeSkillsText;
  return {
    mode: normalizedMode,
    modeLabel: modeConfig.label,
    bossId: boss.id,
    bossName: boss.name,
    bossPortrait: boss.portrait || '',
    bossImageLabel: boss.imageLabel || boss.name,
    maxHp,
    minLevel: modeConfig.minLevel,
    maxLevel: Number.isFinite(modeConfig.maxLevel) ? modeConfig.maxLevel : null,
    rewardMultiplier: modeConfig.rewardMultiplier,
    skillsText,
    rewardsText: normalizedMode !== RAID_MODE_NORMAL
      ? [...(boss.rewardsText || []), `${modeConfig.label} 모드 보상: 노멀 보상의 ${Number(modeConfig.rewardMultiplier || 1).toFixed(2)}배`]
      : [...(boss.rewardsText || []), '150레벨 이상 유저가 노멀 모드에 참가하면 기본 보상은 1/3로 지급됩니다.']
  };
}

function isRaidUserParticipant(activeBattle, userId) {
  return Boolean(activeBattle?.participants?.some((participant) => participant.userId === String(userId)));
}

function getAliveRaidParticipants(activeBattle) {
  return (activeBattle?.participants || []).filter((participant) => participant.hp > 0);
}

function getRaidParticipant(activeBattle, userId) {
  return activeBattle?.participants?.find((participant) => participant.userId === String(userId)) || null;
}

function getParticipantCardEntries(participant) {
  if (Array.isArray(participant?.raidCards) && participant.raidCards.length) {
    return participant.raidCards
      .map((entry) => buildRaidCardEntry(entry.cardId, entry.enhancementLevel || entry.level || 0))
      .filter(Boolean);
  }
  const fallback = buildRaidCardEntry(participant?.equippedCardId, participant?.equippedCardLevel || 0);
  return fallback ? [fallback] : [];
}

function getParticipantCard(participant, slot = null) {
  const entries = getParticipantCardEntries(participant);
  const selectedSlot = Number.isInteger(slot)
    ? slot
    : (Number.isInteger(participant?.plannedCardSlot) ? participant.plannedCardSlot : 0);
  const entry = entries[Math.max(0, Math.min(entries.length - 1, selectedSlot))];
  return entry ? getCardDefinition(entry.cardId, entry.enhancementLevel || 0) : null;
}

function getParticipantCards(participant) {
  return getParticipantCardEntries(participant)
    .map((entry) => getCardDefinition(entry.cardId, entry.enhancementLevel || 0))
    .filter(Boolean);
}

function getRaidSkillCooldown(participant, slot = 0) {
  const normalizedSlot = Math.max(0, Math.floor(Number(slot) || 0));
  if (Array.isArray(participant?.skillCooldowns)) {
    return Math.max(0, Number(participant.skillCooldowns[normalizedSlot] || 0));
  }
  return normalizedSlot === 0 ? Math.max(0, Number(participant?.skillCooldown || 0)) : 0;
}

function setRaidSkillCooldown(participant, slot = 0, value = 0) {
  const normalizedSlot = Math.max(0, Math.floor(Number(slot) || 0));
  if (!Array.isArray(participant.skillCooldowns)) {
    participant.skillCooldowns = getParticipantCardEntries(participant).map((_, index) => index === 0 ? Number(participant.skillCooldown || 0) : 0);
  }
  while (participant.skillCooldowns.length <= normalizedSlot) {
    participant.skillCooldowns.push(0);
  }
  participant.skillCooldowns[normalizedSlot] = Math.max(0, Number(value || 0));
  if (normalizedSlot === 0) participant.skillCooldown = participant.skillCooldowns[0];
}

function tickRaidSkillCooldowns(participant) {
  const entries = getParticipantCardEntries(participant);
  if (!Array.isArray(participant.skillCooldowns)) {
    participant.skillCooldowns = entries.map((_, index) => index === 0 ? Number(participant.skillCooldown || 0) : 0);
  }
  participant.skillCooldowns = entries.map((entry, index) => {
    const paused = entry.cardId === 'solid_mental' && Number(participant.solidMentalNegateCount || 0) > 0;
    const current = getRaidSkillCooldown(participant, index);
    return current > 0 && !paused ? current - 1 : current;
  });
  participant.skillCooldown = participant.skillCooldowns[0] || 0;
}

function getRaidBossMinions(battle) {
  return Array.isArray(battle?.bossMinions) ? battle.bossMinions : [];
}

function getAliveRaidBossMinions(battle) {
  return getRaidBossMinions(battle).filter((minion) => Number(minion.hp || 0) > 0);
}

function getRaidTauntMinion(battle) {
  return getAliveRaidBossMinions(battle).find((minion) => minion.taunt) || null;
}

function getRaidDeadMinionCount(battle) {
  return getRaidBossMinions(battle).filter((minion) => Number(minion.hp || 0) <= 0).length;
}

function getRaidBossOutgoingDamageMultiplier(battle) {
  if (battle?.bossId !== RAID_BOSS_ID_OVERTIME_MANAGER) return 1;
  return 1 + (getRaidDeadMinionCount(battle) * 0.5);
}

function scaleRaidBossDamage(battle, damage) {
  return Math.max(0, Math.floor(Number(damage || 0) * getRaidBossOutgoingDamageMultiplier(battle)));
}

function getRaidBossSideActors(battle) {
  return [
    ...getAliveRaidBossMinions(battle).map((minion) => ({ type: 'minion', unitId: minion.unitId, name: minion.name, minion })),
    { type: 'boss', unitId: 'boss', name: (RAID_BOSS_DATA[battle?.bossId] || RAID_BOSS_DATA[RAID_BOSS_ID]).name }
  ];
}

function getCurrentRaidBossSideActor(battle) {
  const enemyIndex = Math.max(0, Number(battle?.turnIndex || 0) - (battle?.participants?.length || 0));
  const actors = getRaidBossSideActors(battle);
  return actors[enemyIndex] || actors[actors.length - 1] || { type: 'boss', unitId: 'boss', name: '보스' };
}

function buildRaidBossUnitStatusEffects(unit) {
  const effects = [];
  if (!unit) return effects;
  if (Number(unit.hp || 0) > 0 && unit.taunt) {
    effects.push({
      type: 'buff',
      name: '도발',
      desc: `공격 타겟팅을 자신에게 돌리고 받는 피해가 ${Math.round(Number(unit.damageReduction || 0) * 100)}% 감소합니다.`
    });
  }
  if (Number(unit.shield || 0) > 0) {
    effects.push({
      type: 'buff',
      name: '보호막',
      turns: Number(unit.shieldTurns || 0) || null,
      desc: `남은 보호막 ${Number(unit.shield || 0).toLocaleString()}`
    });
  }
  return effects;
}

function clearRoundShieldEffects(battle) {
  if (!battle?.participants?.length) return;
  battle.participants.forEach((participant) => {
    const remainingRoundShield = Number(participant.roundShieldAmount || 0);
    if (remainingRoundShield > 0) {
      participant.shield = Math.max(0, Number(participant.shield || 0) - remainingRoundShield);
      participant.roundShieldAmount = 0;
    }
  });
}

function grantRaidShield(target, amount, options = {}) {
  if (!target || target.hp <= 0) return 0;
  if (Number(target.shieldBlockTurns || 0) > 0) return 0;
  const effectiveAmount = Math.max(0, Math.floor(Number(amount || 0) * getRaidRecoveryMultiplier(target)));
  if (effectiveAmount <= 0) return 0;

  target.shield += effectiveAmount;
  const shieldTurns = Math.max(0, Number(options.turns || 0));
  if (shieldTurns > 0) {
    target.tempShieldAmount = Number(target.tempShieldAmount || 0) + effectiveAmount;
    target.tempShieldTurns = Math.max(Number(target.tempShieldTurns || 0), shieldTurns);
  } else {
    target.roundShieldAmount = Number(target.roundShieldAmount || 0) + effectiveAmount;
  }
  return effectiveAmount;
}

function healRaidTarget(target, amount) {
  if (!target || target.hp <= 0) return 0;
  const effectiveAmount = Math.max(0, Math.floor(Number(amount || 0) * getRaidRecoveryMultiplier(target)));
  if (effectiveAmount <= 0) return 0;
  const previousHp = Number(target.hp || 0);
  target.hp = Math.min(target.maxHp, target.hp + effectiveAmount);
  return Math.max(0, Number(target.hp || 0) - previousHp);
}

function applyRaidPartyHeal(participants, amount, options = {}) {
  const { excludeUserId = null } = options;
  let totalHealed = 0;
  const healedEntries = [];

  (participants || []).forEach((ally) => {
    if (!ally || ally.hp <= 0) return;
    if (excludeUserId && ally.userId === excludeUserId) return;
    const actualHealed = healRaidTarget(ally, amount);
    totalHealed += actualHealed;
    if (actualHealed > 0) {
      healedEntries.push(`${ally.displayName} +${actualHealed.toLocaleString()}`);
    }
  });

  return { totalHealed, healedEntries };
}

function cleanseRaidTarget(target) {
  if (!target) return;
  target.silenceTurns = 0;
  target.actionLockTurns = 0;
  target.basicAttackLockTurns = 0;
  target.healShieldReductionTurns = 0;
  target.healShieldReductionMultiplier = 1;
  target.shieldBlockTurns = 0;
  target.nextHitDamageTakenMultiplier = 1;
  target.nailBounceDelayTurns = 0;
  target.nailBounceDamage = 0;
  target.nailBounceRemainingBounces = 0;
  target.nailBounceDamageStep = 0;
}


function getSelectableRaidTargets(battle) {
  return battle.participants.filter((participant) => participant.hp > 0).map((participant) => participant.userId);
}

function useRaidCardSkill(participant, battle) {
  const plannedCardSlot = Number.isInteger(participant.plannedCardSlot) ? participant.plannedCardSlot : 0;
  const card = getParticipantCard(participant, plannedCardSlot);
  if (!card || card.passiveOnly) return null;

  if (participant.silenceTurns > 0 && card.effectType !== 'party_cleanse') {
    participant.silenceTurns = Math.max(0, participant.silenceTurns - 1);
    return `${participant.displayName}은(는) 침묵 상태라 스킬을 사용할 수 없습니다.`;
  }

  battle.bossOvertimeDebuffs = Array.isArray(battle.bossOvertimeDebuffs) ? battle.bossOvertimeDebuffs : [];
  const canResolveOvertime = card.effectType === 'overtime_rage'
    && battle.bossOvertimeDebuffs.some((entry) => entry.userId === participant.userId);
  const currentCooldown = getRaidSkillCooldown(participant, plannedCardSlot);
  if (!participant.plannedSkill || (currentCooldown > 0 && !canResolveOvertime)) {
    return null;
  }

  if (card.effectType === 'potato_rehab_fixed_damage' && participant.potatoRehabUsed) {
    participant.plannedSkill = false;
    return `${participant.displayName}은(는) 이번 전투에서 ${card.name}을(를) 이미 사용했습니다.`;
  }

  const ampMultiplier = getRaidCardEffectAmpMultiplier(participant);
  const equipmentMultiplier = 1 + Number(participant.cardEffectEquipmentBonusPercent || 0);
  const totalValueMultiplier = ampMultiplier * equipmentMultiplier;
  const scaleFlat = (value) => Math.max(0, Math.floor(Number(value || 0) * totalValueMultiplier));
  const scaleMultiHitFlat = (value) => Math.max(1, Math.floor(Number(value || 0) * totalValueMultiplier * RAID_MULTI_HIT_DAMAGE_MULTIPLIER));
  const scalePercent = (value) => Number((Number(value || 0) * totalValueMultiplier).toFixed(4));
  const scaleCount = (value) => Math.max(1, Math.ceil(Number(value || 0) * ampMultiplier));
  const scaleBonusMultiplier = (value) => Number((1 + ((Number(value || 1) - 1) * totalValueMultiplier)).toFixed(4));

  const startsCooldownAfterNegate = card.id === 'solid_mental';
  setRaidSkillCooldown(participant, plannedCardSlot, startsCooldownAfterNegate ? Number(card.cooldown || 0) : Number(card.cooldown || 0) + 1);
  participant.plannedSkill = false;
  participant.plannedCardSlot = null;
  let logText = `${participant.displayName}(이)가 ${card.name} 스킬을 사용했습니다.`;

  if (card.effectType === 'self_multi_hit') {
    participant.extraHits = Math.max(participant.extraHits, scaleCount(card.hits) - 1);
    participant.multiHitDamageMultiplier = Math.min(Number(participant.multiHitDamageMultiplier || 1), RAID_MULTI_HIT_DAMAGE_MULTIPLIER);
  } else if (card.effectType === 'self_fixed_multi_hit') {
    const hits = Math.max(1, Number(card.hits || 1));
    const perHitDamage = scaleMultiHitFlat(getRaidEffectiveLevel(participant) * Number(card.damagePerLevel || 0));
    const steps = [];
    for (let hit = 0; hit < hits; hit += 1) {
      steps.push({
        type: 'player_fixed_skill_hit',
        userId: participant.userId,
        skillName: card.name,
        damage: perHitDamage,
        hitIndex: hit
      });
    }
    participant.plannedTargetUserId = null;
    participant.plannedTargetUserId2 = null;
    return {
      logs: [`${participant.displayName}(이)가 ${card.name} 스킬을 사용했습니다.`],
      steps,
      delayUnits: Math.max(1, steps.length)
    };
  } else if (card.effectType === 'self_celine_buff') {
    participant.celineTurns = Math.max(participant.celineTurns, Number(card.turns || 1));
    participant.celineAttackBonusPercent = Math.max(Number(participant.celineAttackBonusPercent || 0), scalePercent(card.attackBonusPercent));
    participant.celineExpireDamage = Math.max(Number(participant.celineExpireDamage || 0), scaleFlat(getRaidEffectiveLevel(participant) * Number(card.expireDamagePerLevel || 0)));
    logText = `${participant.displayName}(이)가 <셀린느> 버프를 얻었습니다.`;
  } else if (card.effectType === 'party_shield') {
    const shieldAmount = scaleFlat(card.shield);
    let totalAppliedShield = 0;
    battle.participants.forEach((ally) => {
      if (ally.hp > 0) {
        totalAppliedShield += grantRaidShield(ally, shieldAmount);
      }
    });
    logText = `${participant.displayName}(이)가 ${card.name}로 파티 전원에게 보호막 ${totalAppliedShield.toLocaleString()}을 부여했습니다.`;
  } else if (card.effectType === 'party_heal') {
    const healAmount = scaleFlat(card.heal);
    const { totalHealed, healedEntries } = applyRaidPartyHeal(battle.participants, healAmount, {
      excludeUserId: card.includeSelf ? null : participant.userId
    });
    logText = totalHealed > 0
      ? `${participant.displayName}(이)가 ${card.name}로 ${healedEntries.join(', ')} 회복시켰습니다. (파티 총 ${totalHealed.toLocaleString()})`
      : `${participant.displayName}(이)가 ${card.name}를 사용했지만 회복된 HP가 없습니다.`;
  } else if (card.effectType === 'party_crit_bonus') {
    const critBonus = scalePercent(card.critBonus);
    battle.participants.forEach((ally) => {
      if (ally.hp > 0) {
        ally.critBonusTurns = Math.max(ally.critBonusTurns, card.turns);
        ally.critBonusValue = Math.max(Number(ally.critBonusValue || 0), critBonus);
      }
    });
    logText = `${participant.displayName}(이)가 ${card.name}로 파티 전원의 크리티컬 확률을 높였습니다.`;
  } else if (card.effectType === 'party_hype_crit') {
    const critBonus = scalePercent(card.critBonus);
    const shieldAmount = scaleFlat(card.shield || 0);
    let totalAppliedShield = 0;
    battle.participants.forEach((ally) => {
      if (ally.hp > 0) {
        const appliedCritTurns = ally.userId === participant.userId ? card.turns + 1 : card.turns;
        const appliedHypeTurns = ally.userId === participant.userId ? (card.hypeTurns || 1) + 1 : (card.hypeTurns || 1);
        ally.critBonusTurns = Math.max(ally.critBonusTurns, appliedCritTurns);
        ally.critBonusValue = Math.max(Number(ally.critBonusValue || 0), critBonus);
        ally.hypeTurns = Math.max(ally.hypeTurns, appliedHypeTurns);
        totalAppliedShield += grantRaidShield(ally, shieldAmount);
      }
    });
    logText = `${participant.displayName}(이)가 ${card.name}로 파티 전원에게 흥겨움, 크리티컬 버프와 보호막 ${totalAppliedShield.toLocaleString()}을 부여했습니다.`;
  } else if (card.effectType === 'party_level_blast') {
    const totalLevels = battle.participants.reduce((sum, member) => sum + Number(member.level || 0), 0);
    const damage = scaleFlat(totalLevels * Number(card.multiplierPerLevel || 0));
    const dealtDamage = applyRaidDamageToBoss(battle, damage, { attacker: participant, skillName: card.name });
    logText = `${participant.displayName}(이)가 ${card.name}로 ${dealtDamage.toLocaleString()} 피해를 가했습니다.`;
  } else if (card.effectType === 'potato_rehab_fixed_damage') {
    const damage = getPotatoRehabBattleDamage(participant, battle);
    const beforeBossHp = Number(battle.bossHp || 0);
    const dealtDamage = applyRaidDamageToBoss(battle, damage, { attacker: participant, skillName: card.name });
    participant.potatoRehabUsed = true;
    if (beforeBossHp > 0 && Number(battle.bossHp || 0) <= 0) {
      battle.potatoRehabKillUserIds = Array.isArray(battle.potatoRehabKillUserIds) ? battle.potatoRehabKillUserIds : [];
      if (!battle.potatoRehabKillUserIds.includes(participant.userId)) {
        battle.potatoRehabKillUserIds.push(participant.userId);
      }
    }
    logText = `${participant.displayName}(이)가 ${card.name}로 ${dealtDamage.toLocaleString()} 고정 피해를 입혔습니다.`;
  } else if (card.effectType === 'random_ally_sacrifice_buff') {
    const aliveAllies = getAliveRaidParticipants(battle);
    if (aliveAllies.length > 0) {
      const target = aliveAllies[Math.floor(Math.random() * aliveAllies.length)];
      applyRaidDamage(target, card.selfDamage, { battle, source: 'ally', allowCounter: false });
      target.damageMultiplierTurns = 1;
      target.damageMultiplierValue = Math.max(Number(target.damageMultiplierValue || 1), scaleBonusMultiplier(card.damageMultiplier));
      logText = `${participant.displayName}(이)가 ${card.name}로 ${target.displayName}의 HP를 ${card.selfDamage} 줄이고 다음 공격 피해를 증폭시켰습니다.`;
    }
  } else if (card.effectType === 'party_cleanse') {
    const aliveAllies = getAliveRaidParticipants(battle);
    const targets = card.targets >= 99
      ? aliveAllies
      : [...aliveAllies].sort(() => Math.random() - 0.5).slice(0, Math.min(card.targets || aliveAllies.length, aliveAllies.length));
    targets.forEach((ally) => cleanseRaidTarget(ally));
    logText = `${participant.displayName}(이)가 ${card.name}로 ${targets.length >= aliveAllies.length ? '파티 전원' : targets.map((ally) => ally.displayName).join(', ')}의 모든 디버프를 제거했습니다.`;
  } else if (card.effectType === 'party_bread_buff') {
    const aliveAllies = getAliveRaidParticipants(battle);
    const breadCount = scaleCount(card.breadCount || 0);
    for (let index = 0; index < breadCount; index += 1) {
      const target = aliveAllies[Math.floor(Math.random() * aliveAllies.length)];
      if (target) target.breadCount = Number(target.breadCount || 0) + 1;
    }
    logText = `${participant.displayName}(이)가 ${card.name}로 파티원들에게 빵 ${breadCount}개를 나눠줬습니다.`;
  } else if (card.effectType === 'party_cooldown_reduce') {
    const aliveAllies = getAliveRaidParticipants(battle);
    const reduceAmount = scaleCount(card.cooldownReduce || 1);
    aliveAllies.forEach((ally) => {
      if (ally.userId === participant.userId) return;
      getParticipantCardEntries(ally).forEach((_, cooldownSlot) => {
        setRaidSkillCooldown(ally, cooldownSlot, Math.max(0, getRaidSkillCooldown(ally, cooldownSlot) - reduceAmount));
      });
    });
    logText = `${participant.displayName}(이)가 ${card.name}로 파티원들의 남은 스킬 쿨타임을 ${reduceAmount}턴 줄였습니다.`;
  } else if (card.effectType === 'ally_shield_enemy_multi_hit') {
    const selectedTargetId = participant.plannedTargetUserId;
    const target = getRaidParticipant(battle, selectedTargetId) || participant;
    const shieldAmount = scaleFlat(card.shield || 0);
    const appliedShield = grantRaidShield(target, shieldAmount);
    const perHitDamage = scaleMultiHitFlat(getRaidEffectiveLevel(participant) * Number(card.damagePerLevel || 0));
    const steps = [];
    for (let hit = 0; hit < Math.max(1, Number(card.hits || 2)); hit += 1) {
      steps.push({
        type: 'player_fixed_skill_hit',
        userId: participant.userId,
        skillName: card.name,
        damage: perHitDamage,
        hitIndex: hit
      });
    }
    participant.plannedTargetUserId = null;
    participant.plannedTargetUserId2 = null;
    return {
      logs: [participant.displayName + '(이)가 ' + card.name + '로 ' + target.displayName + '에게 보호막 ' + appliedShield.toLocaleString() + '을 부여했습니다.'],
      steps,
      delayUnits: Math.max(1, steps.length)
    };
  } else if (card.effectType === 'target_heal') {
    const selectedTargetId = participant.plannedTargetUserId;
    const target = getRaidParticipant(battle, selectedTargetId) || getAliveRaidParticipants(battle)[0] || participant;
    const healAmount = scaleFlat(card.heal);
    const actualHeal = healRaidTarget(target, healAmount);
    logText = `${participant.displayName}(이)가 ${card.name}로 ${target.displayName}의 HP를 ${actualHeal.toLocaleString()} 회복시켰습니다.`;
  } else if (card.effectType === 'target_missing_hp_heal') {
    const selectedTargetId = participant.plannedTargetUserId;
    const target = getRaidParticipant(battle, selectedTargetId) || getAliveRaidParticipants(battle)[0] || participant;
    const percent = Math.max(0, scalePercent(card.healMissingHpPercent));
    const missingHp = Math.max(0, Number(target.maxHp || 0) - Number(target.hp || 0));
    const actualHeal = healRaidTarget(target, Math.floor(missingHp * percent));
    logText = `${participant.displayName}(이)가 ${card.name}로 ${target.displayName}의 잃은 체력 ${formatCardPercentText(percent)}만큼 HP ${actualHeal.toLocaleString()}를 회복시켰습니다.`;
  } else if (card.effectType === 'party_missing_hp_heal_negate') {
    const aliveAllies = getAliveRaidParticipants(battle);
    const percent = Math.max(0, scalePercent(card.healMissingHpPercent));
    const flatHeal = scaleFlat(card.healFlat || 0);
    const negateCount = scaleCount(card.negateHitCount || 1);
    let totalHealed = 0;
    aliveAllies.forEach((ally) => {
      const missingHp = Math.max(0, Number(ally.maxHp || 0) - Number(ally.hp || 0));
      totalHealed += healRaidTarget(ally, flatHeal + Math.floor(missingHp * percent));
      ally.negateHitCount += negateCount;
    });
    logText = `${participant.displayName}(이)가 ${card.name}로 파티 전원의 HP를 총 ${totalHealed.toLocaleString()} 회복시키고 피격 무효 ${negateCount}회를 부여했습니다.`;
  } else if (card.effectType === 'target_taunt_damage_reduction') {
    const selectedTargetId = participant.plannedTargetUserId;
    const target = getRaidParticipant(battle, selectedTargetId) || participant;
    const reduction = Math.max(0, Math.min(0.95, scalePercent(card.damageReductionPercent)));
    target.tauntTurns = Math.max(Number(target.tauntTurns || 0), Number(card.turns || 2));
    target.tauntDamageReductionPercent = Math.max(Number(target.tauntDamageReductionPercent || 0), reduction);
    target.tauntSourceUserId = participant.userId;
    logText = `${participant.displayName}(이)가 ${card.name}로 ${target.displayName}에게 <예? 저요?>를 부여했습니다. 보스가 우선 타겟팅하며 받는 최종 피해가 ${formatCardPercentText(reduction)} 감소합니다.`;
  } else if (card.effectType === 'self_negate_hit') {
    const negateCount = scaleCount(card.negateHitCount || 1);
    participant.negateHitCount += negateCount;
    if (card.id === 'solid_mental') {
      participant.solidMentalNegateCount = Math.max(0, Number(participant.solidMentalNegateCount || 0)) + negateCount;
    }
    logText = `${participant.displayName}(이)가 ${card.name}로 자신에게 피격 무효 ${negateCount}회를 부여했습니다.`;
  } else if (card.effectType === 'self_bonus_damage') {
    participant.extraDamage = scaleFlat(getRaidEffectiveLevel(participant) * Number(card.bonusPerLevel || 0));
  } else if (card.effectType === 'self_per_hit_bonus') {
    participant.perHitBonusDamage = scaleFlat(getRaidEffectiveLevel(participant) * Number(card.bonusPerLevel || 0));
    participant.perHitBonusTurns = 1;
    logText = `${participant.displayName}(이)가 ${card.name}로 이번 턴 공격마다 추가 피해를 준비했습니다.`;
  } else if (card.effectType === 'random_shield') {
    const aliveAllies = getAliveRaidParticipants(battle);
    const shuffled = [...aliveAllies].sort(() => Math.random() - 0.5).slice(0, Math.min(card.targets, aliveAllies.length));
    const shieldAmount = scaleFlat(card.shield);
    let totalAppliedShield = 0;
    shuffled.forEach((target) => {
      totalAppliedShield += grantRaidShield(target, shieldAmount);
    });
    logText = `${participant.displayName}(이)가 ${card.name}로 ${shuffled.length}명에게 보호막 ${totalAppliedShield.toLocaleString()}을 부여했습니다.`;
  } else if (card.effectType === 'self_counter') {
    participant.counterTurns = Math.max(participant.counterTurns, card.turns);
    participant.counterDamageMultiplier = Math.max(Number(participant.counterDamageMultiplier || 1), Number(card.counterDamageMultiplier || 1));
    logText = `${participant.displayName}(이)가 ${card.name}로 반격 태세에 들어갔습니다.`;
  } else if (card.effectType === 'target_pair_guard_buff') {
    const selectedTargetId = participant.plannedTargetUserId;
    const selectedTargetId2 = participant.plannedTargetUserId2;
    const first = getRaidParticipant(battle, selectedTargetId) || getAliveRaidParticipants(battle)[0] || participant;
    const second = getRaidParticipant(battle, selectedTargetId2) || getAliveRaidParticipants(battle).find((entry) => entry.userId !== first.userId) || first;
    const negateCount = scaleCount(card.negateHitCount || 0);
    const debuffGuardCount = scaleCount(card.debuffImmuneCount || 0);
    const attackBonusPercent = scalePercent(card.attackBonusPercent);
    [first, second].forEach((target) => {
      target.negateHitCount += negateCount;
      target.debuffImmuneCount += debuffGuardCount;
      addRaidAttackBonusBuff(target, attackBonusPercent, card.turns, card.name);
    });
    logText = `${participant.displayName}(이)가 ${card.name}로 ${first.displayName}${second.userId !== first.userId ? `, ${second.displayName}` : ''}에게 보호 버프를 부여했습니다.`;
  } else if (card.effectType === 'random_party_negate_hit') {
    const aliveAllies = getAliveRaidParticipants(battle);
    const shuffled = [...aliveAllies].sort(() => Math.random() - 0.5).slice(0, Math.min(card.targets || 2, aliveAllies.length));
    const negateCount = scaleCount(card.negateHitCount || 0);
    shuffled.forEach((target) => {
      target.negateHitCount += negateCount;
    });
    logText = `${participant.displayName}(이)가 ${card.name}로 ${shuffled.map((target) => target.displayName).join(', ')}에게 피격 무효 ${negateCount}회를 부여했습니다.`;
  } else if (card.effectType === 'party_negate_hit_by_level') {
    const aliveAllies = getAliveRaidParticipants(battle);
    const candidates = card.includeSelf ? aliveAllies : aliveAllies.filter((entry) => entry.userId !== participant.userId);
    const targets = (card.targets || 0) >= 99
      ? candidates
      : [...candidates].sort(() => Math.random() - 0.5).slice(0, Math.min(card.targets || 1, candidates.length));
    const negateCount = scaleCount(card.negateHitCount || 1);
    targets.forEach((target) => {
      target.negateHitCount += negateCount;
    });
    logText = `${participant.displayName}(이)가 ${card.name}로 ${targets.map((target) => target.displayName).join(', ')}에게 피격 무효 ${negateCount}회를 부여했습니다.`;
  } else if (card.effectType === 'self_status_blast') {
    const statusCount = buildRaidParticipantStatusEffects(participant).length;
    const perHitDamage = scaleFlat(statusCount * getRaidEffectiveLevel(participant) * Number(card.multiplierPerStatus || 0));
    const steps = [];
    for (let hit = 0; hit < Math.max(1, Number(card.hits || 1)); hit += 1) {
      steps.push({
        type: 'player_fixed_skill_hit',
        userId: participant.userId,
        skillName: card.name,
        damage: perHitDamage,
        hitIndex: hit
      });
    }
    participant.silenceTurns = 0;
    participant.actionLockTurns = 0;
    participant.basicAttackLockTurns = 0;
    participant.healShieldReductionTurns = 0;
    participant.healShieldReductionMultiplier = 1;
    participant.nextHitDamageTakenMultiplier = 1;
    participant.nailBounceDelayTurns = 0;
    participant.nailBounceDamage = 0;
    participant.nailBounceRemainingBounces = 0;
    participant.nailBounceDamageStep = 0;
    participant.plannedTargetUserId = null;
    participant.plannedTargetUserId2 = null;
    return {
      logs: [`${participant.displayName}(이)가 ${card.name} 스킬을 사용했습니다. 현재 상태 갯수 ${statusCount}개 기준입니다.`],
      steps,
      delayUnits: Math.max(1, steps.length)
    };
  } else if (card.effectType === 'overtime_rage') {
    const existing = battle.bossOvertimeDebuffs.find((entry) => entry.userId === participant.userId);
    if (existing) {
      const stacks = Math.max(0, Number(existing.stacks || 0));
      const damage = scaleFlat(stacks * getRaidEffectiveLevel(participant) * Number(card.rageDamagePerStackPerLevel || 0));
      const dealtDamage = damage > 0 ? applyRaidDamageToBoss(battle, damage, { attacker: participant, skillName: card.name }) : 0;
      battle.bossOvertimeDebuffs = battle.bossOvertimeDebuffs.filter((entry) => entry !== existing);
      logText = `${participant.displayName}(이)가 ${card.name}로 내면의 분노 ${stacks.toLocaleString()}스택을 폭발시켜 ${dealtDamage.toLocaleString()} 피해를 입혔습니다.`;
    } else {
      battle.bossOvertimeDebuffs.push({
        userId: participant.userId,
        displayName: participant.displayName,
        stacks: 0
      });
      logText = `${participant.displayName}(이)가 ${card.name}로 보스에게 <야근>을 적용했습니다.`;
      setRaidSkillCooldown(participant, plannedCardSlot, 0);
    }
  } else if (card.effectType === 'champion_guard') {
    const selectedTargetId = participant.plannedTargetUserId;
    const target = getRaidParticipant(battle, selectedTargetId) || participant;
    const shieldAmount = scaleFlat(card.shield || 0);
    grantRaidShield(target, shieldAmount);
    target.championGuardTurns = Math.max(Number(target.championGuardTurns || 0), Number(card.turns || 2));
    target.championGuardAttackBonus = Math.max(Number(target.championGuardAttackBonus || 0), scalePercent(card.attackBonusPercent));
    target.championGuardCritBonus = Math.max(Number(target.championGuardCritBonus || 0), scalePercent(card.critBonus));
    battle.bossBlindTurns = Math.max(Number(battle.bossBlindTurns || 0), Number(card.blindTurns || 1));
    battle.bossBlindMissChance = Math.max(Number(battle.bossBlindMissChance || 0), Number(card.blindMissChance || 0.3));
    logText = `${participant.displayName}(이)가 ${card.name}로 ${target.displayName}에게 <챔피언의 가호>와 보호막 ${shieldAmount.toLocaleString()}을 부여하고, 보스에게 <눈부심>을 적용했습니다.`;
  } else if (card.effectType === 'target_final_damage_buff') {
    const selectedTargetId = participant.plannedTargetUserId;
    const target = getRaidParticipant(battle, selectedTargetId) || getAliveRaidParticipants(battle)[0] || participant;
    const finalDamageBonus = Math.max(0, scalePercent(card.finalDamageBonusPercent));
    target.finalDamageBonusTurns = Math.max(Number(target.finalDamageBonusTurns || 0), Number(card.turns || 2));
    target.finalDamageBonusPercent = Math.max(Number(target.finalDamageBonusPercent || 0), finalDamageBonus);
    logText = `${participant.displayName}(이)가 ${card.name}로 ${target.displayName}의 최종 데미지를 ${formatCardPercentText(finalDamageBonus)} 증가시켰습니다.`;
  } else if (card.effectType === 'poison_debuff') {
    battle.bossPoisonDebuffs = Array.isArray(battle.bossPoisonDebuffs) ? battle.bossPoisonDebuffs : [];
    const damage = scaleFlat(getRaidEffectiveLevel(participant) * Number(card.damagePerLevel || 10));
    const existing = battle.bossPoisonDebuffs.find((entry) => entry.userId === participant.userId);
    if (existing) {
      existing.turns = Math.max(Number(existing.turns || 0), Number(card.turns || 2));
      existing.damage = Math.max(Number(existing.damage || 0), damage);
      existing.displayName = participant.displayName;
    } else {
      battle.bossPoisonDebuffs.push({
        userId: participant.userId,
        displayName: participant.displayName,
        turns: Number(card.turns || 2),
        damage
      });
    }
    logText = `${participant.displayName}(이)가 ${card.name}로 보스에게 <중독>을 적용했습니다. 보스가 공격할 때마다 ${damage.toLocaleString()} 피해를 받습니다.`;
  } else if (card.effectType === 'enemy_heal_reduction') {
    const reduction = Math.max(0, Math.min(0.95, scalePercent(card.healReductionPercent || 0)));
    battle.bossHealingReductionTurns = Math.max(Number(battle.bossHealingReductionTurns || 0), Number(card.turns || 2));
    battle.bossHealingReductionMultiplier = Math.min(Number(battle.bossHealingReductionMultiplier || 1), Math.max(0, 1 - reduction));
    logText = `${participant.displayName}(이)가 ${card.name}로 보스의 치유 효과를 ${formatCardPercentText(reduction)} 감소시켰습니다.`;
  } else if (card.effectType === 'direct_hp_strike') {
    const damage = scaleFlat(getRaidEffectiveLevel(participant) * Number(card.multiplierPerLevel || 0));
    const dealtDamage = applyRaidDamageToBoss(battle, damage, { attacker: participant, skillName: card.name, ignoreShield: true });
    logText = dealtDamage > 0
      ? `${participant.displayName}(이)가 ${card.name}로 방어막을 무시하고 ${dealtDamage.toLocaleString()} 피해를 입혔습니다.`
      : `${participant.displayName}(이)가 ${card.name}를 사용했지만 피해를 입히지 못했습니다.`;
  } else if (card.effectType === 'copy_ally_skill') {
    const copyCandidates = getAliveRaidParticipants(battle).filter((entry) => entry.userId !== participant.userId && getParticipantCard(entry) && !getParticipantCard(entry).passiveOnly);
    const sourceParticipant = card.canSelectCopyTarget
      ? (getRaidParticipant(battle, participant.plannedTargetUserId) || copyCandidates[0])
      : copyCandidates[Math.floor(Math.random() * copyCandidates.length)];
    const copiedCard = sourceParticipant ? getParticipantCard(sourceParticipant) : null;
    if (!copiedCard || copiedCard.id === 'umbrella_copy') {
      logText = `${participant.displayName}(이)가 ${card.name}를 사용했지만 복사할 카드 효과가 없었습니다.`;
    } else {
      const copyScale = Number(card.copyEffectMultiplier || 0.5);
      if (copiedCard.effectType === 'party_shield') {
        const shieldAmount = Math.max(1, Math.floor(Number(copiedCard.shield || 0) * copyScale));
        let totalAppliedShield = 0;
        battle.participants.forEach((ally) => {
          if (ally.hp > 0) totalAppliedShield += grantRaidShield(ally, shieldAmount);
        });
        logText = `${participant.displayName}(이)가 ${sourceParticipant.displayName}의 ${copiedCard.name}를 흉내 내 파티 전원에게 보호막 ${totalAppliedShield.toLocaleString()}을 부여했습니다.`;
      } else if (copiedCard.effectType === 'party_heal') {
        const healAmount = Math.max(1, Math.floor(Number(copiedCard.heal || 0) * copyScale));
        const { totalHealed, healedEntries } = applyRaidPartyHeal(battle.participants, healAmount);
        logText = totalHealed > 0
          ? `${participant.displayName}(이)가 ${sourceParticipant.displayName}의 ${copiedCard.name}를 흉내 내 ${healedEntries.join(', ')} 회복시켰습니다. (파티 총 ${totalHealed.toLocaleString()})`
          : `${participant.displayName}(이)가 ${sourceParticipant.displayName}의 ${copiedCard.name}를 흉내 냈지만 회복된 HP가 없습니다.`;
      } else if (copiedCard.effectType === 'party_level_blast') {
        const totalLevels = battle.participants.reduce((sum, member) => sum + Number(member.level || 0), 0);
        const damage = Math.max(1, Math.floor(totalLevels * Number(copiedCard.multiplierPerLevel || 0) * copyScale));
        const dealtDamage = applyRaidDamageToBoss(battle, damage, { attacker: participant, skillName: copiedCard.name });
        logText = `${participant.displayName}(이)가 ${sourceParticipant.displayName}의 ${copiedCard.name}를 흉내 내 ${dealtDamage.toLocaleString()} 피해를 입혔습니다.`;
      } else if (copiedCard.effectType === 'self_multi_hit') {
        const hits = Math.max(1, Math.ceil(Number(copiedCard.hits || 1) * copyScale));
        participant.extraHits = Math.max(participant.extraHits, hits - 1);
        participant.multiHitDamageMultiplier = Math.min(Number(participant.multiHitDamageMultiplier || 1), RAID_MULTI_HIT_DAMAGE_MULTIPLIER);
        logText = `${participant.displayName}(이)가 ${sourceParticipant.displayName}의 ${copiedCard.name}를 흉내 내 다음 기본 공격을 ${hits}회로 준비했습니다.`;
      } else if (copiedCard.effectType === 'self_fixed_multi_hit') {
        const hits = Math.max(1, Math.ceil(Number(copiedCard.hits || 1) * copyScale));
        const perHitDamage = Math.max(1, Math.floor(getRaidEffectiveLevel(participant) * Number(copiedCard.damagePerLevel || 0) * copyScale * RAID_MULTI_HIT_DAMAGE_MULTIPLIER));
        const steps = [];
        for (let hit = 0; hit < hits; hit += 1) {
          steps.push({
            type: 'player_fixed_skill_hit',
            userId: participant.userId,
            skillName: copiedCard.name,
            damage: perHitDamage,
            hitIndex: hit
          });
        }
        participant.plannedTargetUserId = null;
        participant.plannedTargetUserId2 = null;
        return {
          logs: [`${participant.displayName}(이)가 ${sourceParticipant.displayName}의 ${copiedCard.name}를 흉내 냈습니다.`],
          steps,
          delayUnits: Math.max(1, steps.length)
        };
      } else if (copiedCard.effectType === 'party_hype_crit') {
        const critBonus = Math.max(0, Number(copiedCard.critBonus || 0) * copyScale);
        const shieldAmount = Math.max(0, Math.floor(Number(copiedCard.shield || 0) * copyScale));
        let totalAppliedShield = 0;
        battle.participants.forEach((ally) => {
          if (ally.hp > 0) {
            ally.critBonusTurns = Math.max(ally.critBonusTurns, Number(copiedCard.turns || 1));
            ally.critBonusValue = Math.max(Number(ally.critBonusValue || 0), critBonus);
            ally.hypeTurns = Math.max(ally.hypeTurns, Number(copiedCard.hypeTurns || 1));
            totalAppliedShield += grantRaidShield(ally, shieldAmount);
          }
        });
        logText = `${participant.displayName}(이)가 ${sourceParticipant.displayName}의 ${copiedCard.name}를 흉내 내 흥겨움과 보호막 ${totalAppliedShield.toLocaleString()}을 부여했습니다.`;
      } else if (copiedCard.effectType === 'party_bread_buff') {
        const aliveAllies = getAliveRaidParticipants(battle);
        const breadCount = Math.max(1, Math.ceil(Number(copiedCard.breadCount || 0) * copyScale));
        for (let index = 0; index < breadCount; index += 1) {
          const target = aliveAllies[Math.floor(Math.random() * aliveAllies.length)];
          if (target) target.breadCount = Number(target.breadCount || 0) + 1;
        }
        logText = `${participant.displayName}(이)가 ${sourceParticipant.displayName}의 ${copiedCard.name}를 흉내 내 빵 ${breadCount}개를 나눠줬습니다.`;
      } else if (copiedCard.effectType === 'party_missing_hp_heal_negate') {
        const aliveAllies = getAliveRaidParticipants(battle);
        const percent = Math.max(0, Number(copiedCard.healMissingHpPercent || 0) * copyScale);
        const flatHeal = Math.max(0, Math.floor(Number(copiedCard.healFlat || 0) * copyScale));
        const negateCount = Math.max(1, Math.ceil(Number(copiedCard.negateHitCount || 1) * copyScale));
        let totalHealed = 0;
        aliveAllies.forEach((ally) => {
          const missingHp = Math.max(0, Number(ally.maxHp || 0) - Number(ally.hp || 0));
          totalHealed += healRaidTarget(ally, flatHeal + Math.floor(missingHp * percent));
          ally.negateHitCount += negateCount;
        });
        logText = `${participant.displayName}(이)가 ${sourceParticipant.displayName}의 ${copiedCard.name}를 흉내 내 파티 HP를 총 ${totalHealed.toLocaleString()} 회복시키고 피격 무효 ${negateCount}회를 부여했습니다.`;
      } else if (copiedCard.effectType === 'party_cooldown_reduce') {
        const reduceAmount = Math.max(1, Math.ceil(Number(copiedCard.cooldownReduce || 1) * copyScale));
        getAliveRaidParticipants(battle).forEach((ally) => {
          if (ally.userId === participant.userId) return;
          getParticipantCardEntries(ally).forEach((_, cooldownSlot) => {
            setRaidSkillCooldown(ally, cooldownSlot, Math.max(0, getRaidSkillCooldown(ally, cooldownSlot) - reduceAmount));
          });
        });
        logText = `${participant.displayName}(이)가 ${sourceParticipant.displayName}의 ${copiedCard.name}를 흉내 내 파티원들의 남은 스킬 쿨타임을 ${reduceAmount}턴 줄였습니다.`;
      } else if (copiedCard.effectType === 'random_party_negate_hit' || copiedCard.effectType === 'party_negate_hit_by_level') {
        const targets = getAliveRaidParticipants(battle).sort(() => Math.random() - 0.5).slice(0, Math.max(1, Math.floor((Number(copiedCard.targets || 1) || 1) * copyScale)));
        targets.forEach((target) => {
          target.negateHitCount += Math.max(1, Math.floor((Number(copiedCard.negateHitCount || 1) || 1) * copyScale));
        });
        logText = `${participant.displayName}(이)가 ${sourceParticipant.displayName}의 ${copiedCard.name}를 흉내 내 방어 버프를 부여했습니다.`;
      } else if (copiedCard.effectType === 'target_final_damage_buff') {
        const target = getRaidParticipant(battle, participant.plannedTargetUserId) || participant;
        const finalDamageBonus = Math.max(0, Number(copiedCard.finalDamageBonusPercent || 0) * copyScale);
        target.finalDamageBonusTurns = Math.max(Number(target.finalDamageBonusTurns || 0), Number(copiedCard.turns || 2));
        target.finalDamageBonusPercent = Math.max(Number(target.finalDamageBonusPercent || 0), finalDamageBonus);
        logText = `${participant.displayName}(이)가 ${sourceParticipant.displayName}의 ${copiedCard.name}를 흉내 내 ${target.displayName}의 최종 데미지를 ${formatCardPercentText(finalDamageBonus)} 증가시켰습니다.`;
      } else {
        const damage = Math.max(1, Math.floor(getRaidEffectiveLevel(participant) * 20 * copyScale));
        const dealtDamage = applyRaidDamageToBoss(battle, damage, { attacker: participant, skillName: copiedCard.name });
        logText = `${participant.displayName}(이)가 ${sourceParticipant.displayName}의 ${copiedCard.name}를 흉내 냈지만 절반 위력으로만 ${dealtDamage.toLocaleString()} 피해를 입혔습니다.`;
      }
    }
  } else if (card.effectType === 'random_party_attack_buff') {
    const aliveAllies = getAliveRaidParticipants(battle);
    const shuffled = [...aliveAllies].sort(() => Math.random() - 0.5).slice(0, Math.min(card.targets, aliveAllies.length));
    const attackBonusPercent = scalePercent(card.attackBonusPercent);
    shuffled.forEach((target) => {
      addRaidAttackBonusBuff(target, attackBonusPercent, card.turns, card.name);
    });
    logText = `${participant.displayName}(이)가 ${card.name}로 ${shuffled.map((target) => target.displayName).join(', ')}의 공격력을 높였습니다.`;
  } else if (card.effectType === 'target_attack_buff') {
    const selectedTargetId = participant.plannedTargetUserId;
    const target = getRaidParticipant(battle, selectedTargetId) || getAliveRaidParticipants(battle)[0] || participant;
    const attackBonusPercent = scalePercent(card.attackBonusPercent);
    addRaidAttackBonusBuff(target, attackBonusPercent, card.turns, card.name);
    logText = `${participant.displayName}(이)가 ${card.name}로 ${target.displayName}의 공격력을 높였습니다.`;
  } else if (card.effectType === 'target_debuff_guard') {
    const selectedTargetId = participant.plannedTargetUserId;
    const target = getRaidParticipant(battle, selectedTargetId) || getAliveRaidParticipants(battle)[0] || participant;
    const debuffGuardCount = scaleCount(card.debuffImmuneCount || 0);
    target.debuffImmuneCount += debuffGuardCount;
    logText = `${participant.displayName}(이)가 ${card.name}로 ${target.displayName}에게 디버프 무효 ${debuffGuardCount}회를 부여했습니다.`;
  } else if (card.effectType === 'self_debuff_reflect') {
    participant.selfEsteemCount += scaleCount(card.selfEsteemCount || 1);
    logText = `${participant.displayName}(이)가 ${card.name}로 <자존감> 버프를 얻었습니다.`;
  } else if (card.effectType === 'remove_enemy_buff') {
    const removeCount = scaleCount(card.removeBuffCount || 1);
    const candidates = [];
    if (Number(battle.bossNegateHits || 0) > 0) candidates.push('negate');
    if (Number(battle.bossShield || 0) > 0) candidates.push('shield');
    const targetBuff = candidates[Math.floor(Math.random() * candidates.length)];
    if (targetBuff === 'negate') {
      battle.bossNegateHits = Math.max(0, Number(battle.bossNegateHits || 0) - removeCount);
      logText = `${participant.displayName}(이)가 ${card.name}로 보스의 피격 무효를 ${removeCount}회 제거했습니다.`;
    } else if (targetBuff === 'shield') {
      battle.bossShield = 0;
      battle.bossShieldTurns = 0;
      logText = `${participant.displayName}(이)가 ${card.name}로 보스의 보호막을 제거했습니다.`;
    } else {
      logText = `${participant.displayName}(이)가 ${card.name}를 사용했지만 제거할 보스 버프가 없었습니다.`;
    }
  }

  participant.plannedTargetUserId = null;
  participant.plannedTargetUserId2 = null;
  return logText;
}

function tickRaidParticipantEndOfTurn(participant, battle) {
  tickRaidSkillCooldowns(participant);
  if (participant.silenceTurns > 0) participant.silenceTurns -= 1;
  if (participant.actionLockTurns > 0) participant.actionLockTurns -= 1;
  if (participant.basicAttackLockTurns > 0) participant.basicAttackLockTurns -= 1;
  if (participant.healShieldReductionTurns > 0) {
    participant.healShieldReductionTurns -= 1;
    if (participant.healShieldReductionTurns <= 0) {
      participant.healShieldReductionMultiplier = 1;
    }
  }
  if (participant.shieldBlockTurns > 0) {
    participant.shieldBlockTurns -= 1;
  }
  if (participant.critBonusTurns > 0) {
    participant.critBonusTurns -= 1;
    if (participant.critBonusTurns <= 0) participant.critBonusValue = 0;
  }
  if (participant.damageMultiplierTurns > 0) {
    participant.damageMultiplierTurns -= 1;
    if (participant.damageMultiplierTurns <= 0) {
      participant.damageMultiplierValue = 1;
    }
  }
  if (participant.hypeTurns > 0) {
    participant.hypeTurns -= 1;
  }
  if (participant.tauntTurns > 0) {
    participant.tauntTurns -= 1;
    if (participant.tauntTurns <= 0) {
      participant.tauntDamageReductionPercent = 0;
      participant.tauntSourceUserId = null;
    }
  }
  if (participant.tempShieldTurns > 0) {
    participant.tempShieldTurns -= 1;
    if (participant.tempShieldTurns <= 0) {
      const remainingTempShield = Number(participant.tempShieldAmount || 0);
      if (remainingTempShield > 0) {
        participant.shield = Math.max(0, Number(participant.shield || 0) - remainingTempShield);
      }
      participant.tempShieldAmount = 0;
    }
  }
  if (participant.counterTurns > 0) {
    participant.counterTurns -= 1;
    if (participant.counterTurns <= 0) participant.counterDamageMultiplier = 1;
  }
  if (Array.isArray(participant.attackBonusBuffs)) {
    participant.attackBonusBuffs = participant.attackBonusBuffs
      .map((buff) => ({
        ...buff,
        turns: Math.max(0, Number(buff.turns || 0) - 1)
      }))
      .filter((buff) => Number(buff.turns || 0) > 0 && Number(buff.value || 0) > 0);
    syncRaidAttackBonusFields(participant);
  } else if (participant.attackBonusTurns > 0) {
    participant.attackBonusTurns -= 1;
    if (participant.attackBonusTurns <= 0) participant.attackBonusPercent = 0;
  }
  if (participant.perHitBonusTurns > 0) {
    participant.perHitBonusTurns -= 1;
    if (participant.perHitBonusTurns <= 0) participant.perHitBonusDamage = 0;
  }
  if (participant.championGuardTurns > 0) {
    participant.championGuardTurns -= 1;
    if (participant.championGuardTurns <= 0) {
      participant.championGuardAttackBonus = 0;
      participant.championGuardCritBonus = 0;
    }
  }
  if (participant.subordinateTurns > 0) {
    participant.subordinateTurns -= 1;
    if (participant.subordinateTurns <= 0) participant.subordinateLevelBonus = 0;
  }
  if (participant.finalDamageBonusTurns > 0) {
    participant.finalDamageBonusTurns -= 1;
    if (participant.finalDamageBonusTurns <= 0) participant.finalDamageBonusPercent = 0;
  }
  if (participant.cardEffectAmpTurns > 0) {
    participant.cardEffectAmpTurns -= 1;
    if (participant.cardEffectAmpTurns <= 0) participant.cardEffectAmpValue = 1;
  }
  if (participant.celineTurns > 0) {
    participant.celineTurns -= 1;
    if (participant.celineTurns <= 0) {
      const expireDamage = Number(participant.celineExpireDamage || 0);
      if (battle && expireDamage > 0 && battle.bossHp > 0) {
        const dealtDamage = applyRaidDamageToBoss(battle, expireDamage, { attacker: participant, skillName: '셀린느' });
        battle.logs.push(`${participant.displayName}의 <셀린느> 버프가 종료되며 ${dealtDamage.toLocaleString()} 피해를 입혔습니다.`);
      }
      participant.celineExpireDamage = 0;
      participant.celineAttackBonusPercent = 0;
    }
  }
  if (participant.nailBounceDelayTurns > 0) {
    participant.nailBounceDelayTurns -= 1;
    if (participant.nailBounceDelayTurns <= 0 && Number(participant.nailBounceDamage || 0) > 0) {
      const pendingDamage = Number(participant.nailBounceDamage || 0);
      applyRaidDamage(participant, pendingDamage, { battle, source: 'boss', allowCounter: false });
      battle.logs.push(`${participant.displayName}에게 튕겨나간 손톱이 꽂혀 ${pendingDamage.toLocaleString()} 피해를 입혔습니다.`);
      if (Number(participant.nailBounceRemainingBounces || 0) > 0) {
        const candidates = getAliveRaidParticipants(battle).filter((entry) => entry.userId !== participant.userId);
        if (candidates.length > 0) {
          const target = candidates[Math.floor(Math.random() * candidates.length)];
          const damageStep = Number.isFinite(Number(participant.nailBounceDamageStep)) ? Number(participant.nailBounceDamageStep) : -10;
          target.nailBounceDelayTurns = Math.max(target.nailBounceDelayTurns, 1);
          target.nailBounceDamage = Math.max(0, pendingDamage + damageStep);
          target.nailBounceRemainingBounces = Math.max(0, Number(participant.nailBounceRemainingBounces || 0) - 1);
          target.nailBounceDamageStep = damageStep;
          battle.logs.push(`튕겨나간 손톱이 ${target.displayName}에게 튕겨갔습니다.`);
        }
      }
      participant.nailBounceDamage = 0;
      participant.nailBounceRemainingBounces = 0;
      participant.nailBounceDamageStep = 0;
    }
  }
  participant.extraHits = 0;
  participant.multiHitDamageMultiplier = 1;
  participant.extraDamage = 0;
}


function getRaidCardEffectAmpMultiplier(participant) {
  return participant.cardEffectAmpTurns > 0 ? Number(participant.cardEffectAmpValue || 1) : 1;
}

function getRaidEffectiveLevel(participant) {
  return Number(participant.level || 1) + (Number(participant.subordinateTurns || 0) > 0 ? Number(participant.subordinateLevelBonus || 0) : 0);
}

function triggerRaidTurnStartPassives(participant, battle) {
  const card = getParticipantCards(participant).find((entry) => entry.effectType === 'passive_rotation_amp');
  if (!card || participant.hp <= 0) return null;
  if (card.effectType !== 'passive_rotation_amp') return null;

  const targets = battle.participants.filter((entry) => entry.hp > 0 && entry.userId !== participant.userId);
  if (!targets.length) return null;

  const rotationIndex = Number(participant.rotationIndex || 0) % targets.length;
  const target = targets[rotationIndex];
  participant.rotationIndex = (rotationIndex + 1) % targets.length;
  target.cardEffectAmpTurns = Math.max(target.cardEffectAmpTurns, Number(card.turns || 1));
  target.cardEffectAmpValue = Math.max(Number(target.cardEffectAmpValue || 1), Number(card.amplifyMultiplier || 1));

  return `${participant.displayName}의 ${card.name} 효과로 ${target.displayName}에게 <소개팅 상대> 버프가 적용되었습니다.`;
}

function getRaidAttackBonusPercent(participant) {
  const attackBuffs = getActiveRaidAttackBonusBuffs(participant);
  const baseBonus = attackBuffs.length > 0
    ? attackBuffs.reduce((sum, buff) => sum + buff.value, 0)
    : (participant.attackBonusTurns > 0 ? Number(participant.attackBonusPercent || 0) : 0);
  const celineBonus = participant.celineTurns > 0 ? Number(participant.celineAttackBonusPercent || 0) : 0;
  const championBonus = participant.championGuardTurns > 0 ? Number(participant.championGuardAttackBonus || 0) : 0;
  return baseBonus + celineBonus + championBonus;
}

function getRaidFinalDamageBonusPercent(participant) {
  return participant && Number(participant.finalDamageBonusTurns || 0) > 0
    ? Math.max(0, Number(participant.finalDamageBonusPercent || 0))
    : 0;
}

function isHardRaidBattle(battle) {
  return getRaidModeFromBattle(battle) === RAID_MODE_HARD;
}

function isChaosRaidBattle(battle) {
  return getRaidModeFromBattle(battle) === RAID_MODE_CHAOS;
}

function isHardOrChaosRaidBattle(battle) {
  const mode = getRaidModeFromBattle(battle);
  return mode === RAID_MODE_HARD || mode === RAID_MODE_CHAOS;
}

function usesEnhancedRaidBossTuning(battle) {
  if (!battle) return false;
  return isChaosRaidBattle(battle)
    || (isHardRaidBattle(battle) && battle.bossId === RAID_BOSS_ID_OVERTIME_MANAGER);
}

function resetRaidBossRoundPassiveState(battle) {
  if (!battle) return;
  battle.bossSmoothScalpStacks = 0;
}

function applyHardRaidBossOnHitPassive(battle, attacker) {
  if (!battle || !attacker || !isHardOrChaosRaidBattle(battle)) return;
  if (battle.bossId === RAID_BOSS_ID) {
    const reflectedDamage = 5;
    const dealt = applyRaidDamage(attacker, reflectedDamage, {
      battle,
      source: 'boss_passive',
      allowCounter: false,
      skipBread: true
    });
    battle.logs.push(`트름녀의 <가시갑옷>! ${attacker.displayName}에게 ${dealt.toLocaleString()} 피해를 반사했습니다.`);
  } else if (battle.bossId === RAID_BOSS_ID_BALD_MANAGER) {
    battle.bossSmoothScalpStacks = Math.max(0, Number(battle.bossSmoothScalpStacks || 0)) + 1;
  }
}

function applyRaidDamageToBossMinion(battle, minion, damage, options = {}) {
  if (!battle || !minion || Number(minion.hp || 0) <= 0) return 0;
  let remainingDamage = Math.max(0, Math.floor(Number(damage || 0)));
  const reduction = Number(minion.taunt ? minion.damageReduction : 0) || 0;
  if (reduction > 0) {
    remainingDamage = Math.max(0, Math.floor(remainingDamage * (1 - Math.min(0.95, reduction))));
  }

  let blocked = 0;
  if (!options.ignoreShield && Number(minion.shield || 0) > 0) {
    blocked = Math.min(Number(minion.shield || 0), remainingDamage);
    minion.shield = Math.max(0, Number(minion.shield || 0) - blocked);
    remainingDamage -= blocked;
  }

  const wasAlive = Number(minion.hp || 0) > 0;
  minion.hp = Math.max(0, Number(minion.hp || 0) - remainingDamage);
  minion.lastShieldLoss = blocked;
  minion.lastHpLoss = remainingDamage;
  battle.bossLastHpLoss = 0;
  battle.lastBossDamageTargetName = minion.name;

  if (wasAlive && minion.hp <= 0 && !minion.defeatLogged) {
    minion.defeatLogged = true;
    minion.taunt = false;
    minion.shield = 0;
    minion.shieldTurns = 0;
    battle.logs.push(`${minion.name}이(가) 쓰러졌습니다. 황과장의 야근 광기가 짙어집니다.`);
  }

  return remainingDamage;
}

function applyRaidDamageToBoss(battle, damage, options = {}) {
  const attacker = options.attacker || null;
  let incomingDamage = Math.max(0, Math.floor(Number(damage || 0)));
  if (attacker) {
    const finalDamageBonus = getRaidFinalDamageBonusPercent(attacker);
    if (finalDamageBonus > 0) {
      incomingDamage = Math.max(0, Math.floor(incomingDamage * (1 + finalDamageBonus)));
    }
    const dailyDamageBonus = Math.max(0, Number(attacker.dailyRaidDamageBonusPercent || 0));
    if (dailyDamageBonus > 0) {
      incomingDamage = Math.max(0, Math.floor(incomingDamage * (1 + dailyDamageBonus / 100)));
    }
    const turn3DamageBonus = Math.max(0, Number(attacker.dailyRaidTurn3DamageBonusPercent || 0));
    if (turn3DamageBonus > 0 && Math.max(1, Number(battle.turnNumber || 1)) === 3) {
      incomingDamage = Math.max(0, Math.floor(incomingDamage * (1 + turn3DamageBonus / 100)));
    }
  }
  const tauntMinion = options.ignoreTaunt ? null : getRaidTauntMinion(battle);
  if (tauntMinion) {
    return applyRaidDamageToBossMinion(battle, tauntMinion, incomingDamage, options);
  }
  if (attacker && isHardOrChaosRaidBattle(battle) && battle.bossId === RAID_BOSS_ID_HOI && Math.random() < 0.2) {
    const missingHp = Math.max(0, Number(battle.bossMaxHp || 0) - Number(battle.bossHp || 0));
    const healAmount = isChaosRaidBattle(battle) ? healRaidBoss(battle, Math.floor(missingHp * 0.1)) : 0;
    battle.logs.push(`HOI-M.S.J-50의 <나 먼저 퇴근할게>! ${attacker.displayName}의 공격을 회피했습니다.${healAmount > 0 ? ` ${healAmount.toLocaleString()} HP를 회복했습니다.` : ''}`);
    return 0;
  }
  if (attacker && isHardOrChaosRaidBattle(battle) && battle.bossId === RAID_BOSS_ID_BALD_MANAGER) {
    const stacks = Math.max(0, Number(battle.bossSmoothScalpStacks || 0));
    if (stacks > 0) {
      incomingDamage = Math.max(0, Math.floor(incomingDamage * Math.pow(0.9, stacks)));
    }
  }
  if (attacker && isChaosRaidBattle(battle) && battle.bossId === RAID_BOSS_ID) {
    const maxHp = Math.max(1, Number(battle.bossMaxHp || 1));
    const missingRatio = Math.max(0, Math.min(1, (maxHp - Number(battle.bossHp || 0)) / maxHp));
    const reduction = Math.min(0.75, missingRatio * 0.75);
    if (reduction > 0) {
      incomingDamage = Math.max(0, Math.floor(incomingDamage * (1 - reduction)));
    }
  }
  if (Number(battle.bossDamageReductionTurns || 0) > 0) {
    incomingDamage = Math.max(0, Math.floor(incomingDamage * (1 - Math.min(0.95, Number(battle.bossDamageReductionPercent || 0)))));
  }
  if (Number(battle.bossNegateHits || 0) > 0) {
    battle.bossNegateHits -= 1;
    battle.bossLastHpLoss = 0;
    applyHardRaidBossOnHitPassive(battle, attacker);
    return 0;
  }
  let remainingDamage = incomingDamage;
  if (!options.ignoreShield && battle.bossShield > 0) {
    const blocked = Math.min(battle.bossShield, remainingDamage);
    battle.bossShield -= blocked;
    remainingDamage -= blocked;
  }
  battle.bossHp = Math.max(0, battle.bossHp - remainingDamage);
  battle.bossLastHpLoss = remainingDamage;
  battle.lastBossDamageTargetName = (RAID_BOSS_DATA[battle.bossId] || RAID_BOSS_DATA[RAID_BOSS_ID]).name;
  applyHardRaidBossOnHitPassive(battle, attacker);
  return remainingDamage;
}

function incrementRaidOvertimeRageStacks(battle) {
  if (!Array.isArray(battle?.bossOvertimeDebuffs)) return;
  battle.bossOvertimeDebuffs.forEach((entry) => {
    entry.stacks = Math.max(0, Number(entry.stacks || 0)) + 1;
  });
}

function triggerRaidBossPoisonOnAttack(battle) {
  if (!Array.isArray(battle?.bossPoisonDebuffs) || battle.bossHp <= 0) return 0;
  let totalDamage = 0;
  battle.bossPoisonDebuffs.forEach((entry) => {
    const damage = Math.max(1, Math.floor(Number(entry.damage || 0)));
    if (damage > 0) {
      const dealt = applyRaidDamageToBoss(battle, damage);
      totalDamage += dealt;
      battle.logs.push(`${entry.displayName || '누군가'}의 중독 효과로 ${battle.lastBossDamageTargetName || '보스'}이(가) ${dealt.toLocaleString()} 피해를 입었습니다.`);
    }
  });
  return totalDamage;
}

function tickRaidBossPoisonDebuffs(battle) {
  if (!Array.isArray(battle?.bossPoisonDebuffs)) return;
  battle.bossPoisonDebuffs.forEach((entry) => {
    entry.turns = Math.max(0, Number(entry.turns || 0) - 1);
  });
  battle.bossPoisonDebuffs = battle.bossPoisonDebuffs.filter((entry) => Number(entry.turns || 0) > 0);
}

function tickRaidBossEndOfTurn(battle) {
  tickRaidBossPoisonDebuffs(battle);
  if (Number(battle.bossBlindTurns || 0) > 0) {
    battle.bossBlindTurns -= 1;
    if (battle.bossBlindTurns <= 0) battle.bossBlindMissChance = 0;
  }
  if (Number(battle.bossDamageReductionTurns || 0) > 0) {
    battle.bossDamageReductionTurns -= 1;
    if (battle.bossDamageReductionTurns <= 0) {
      battle.bossDamageReductionPercent = 0;
    }
  }
  if (Number(battle.bossHealingReductionTurns || 0) > 0) {
    battle.bossHealingReductionTurns -= 1;
    if (battle.bossHealingReductionTurns <= 0) {
      battle.bossHealingReductionMultiplier = 1;
    }
  }
  battle.turnNumber = Math.max(1, Number(battle.turnNumber || 1)) + 1;
  battle.turnIndex = 0;
}

function normalizeRaidActionResult(result) {
  if (!result) {
    return { logs: [], delayUnits: 0 };
  }
  if (typeof result === 'string') {
    return { logs: [result], delayUnits: 0 };
  }
  if (Array.isArray(result)) {
    return { logs: result.filter(Boolean), delayUnits: 0 };
  }

  const logs = Array.isArray(result.logs)
    ? result.logs.filter(Boolean)
    : (result.log ? [result.log] : []);

  return {
    logs,
    delayUnits: Math.max(0, Number(result.delayUnits || 0))
  };
}

function appendRaidActionLogs(battle, result) {
  const normalized = normalizeRaidActionResult(result);
  normalized.logs.forEach((line) => {
    battle.logs.push(line);
  });
  return normalized.delayUnits;
}

function queueRaidSequence(battle, steps, options = {}) {
  battle.pendingSequence = {
    steps: Array.isArray(steps) ? [...steps] : [],
    endTurnType: options.endTurnType || null,
    participantUserId: options.participantUserId || null,
    clearRoundShieldsAtEnd: Boolean(options.clearRoundShieldsAtEnd)
  };
}

function finalizeRaidSequence(battle) {
  const sequence = battle.pendingSequence;
  if (!sequence) return;

  if (sequence.clearRoundShieldsAtEnd) {
    clearRoundShieldEffects(battle);
  }

  if (sequence.endTurnType === 'participant' && sequence.participantUserId) {
    const participant = getRaidParticipant(battle, sequence.participantUserId);
    if (participant) {
      tickRaidParticipantEndOfTurn(participant, battle);
    }
    battle.turnIndex += 1;
  } else if (sequence.endTurnType === 'boss_minion') {
    battle.turnIndex += 1;
  } else if (sequence.endTurnType === 'boss') {
    tickRaidBossEndOfTurn(battle);
  }

  battle.pendingSequence = null;
}

function buildRaidInternFollowupSteps(battle, triggerParticipant) {
  if (!battle || !triggerParticipant) return [];
  return getAliveRaidParticipants(battle)
    .filter((participant) => participant.internBuff && Number(participant.internChance || 0) > 0)
    .filter((participant) => Math.random() < Math.max(0, Math.min(1, Number(participant.internChance || 0))))
    .map((participant) => ({
      type: 'player_basic_hit',
      userId: participant.userId,
      hitIndex: 0,
      damageMultiplier: Math.max(0.1, Number(participant.internDamageMultiplier || 0.3)),
      internFollowup: true,
      triggerUserId: triggerParticipant.userId
    }));
}

function executeNextRaidSequenceStep(battle) {
  const sequence = battle.pendingSequence;
  if (!sequence || !Array.isArray(sequence.steps) || !sequence.steps.length) return false;

  const step = sequence.steps.shift();
  if (!step) return false;

  if (step.type === 'player_basic_hit') {
    const participant = getRaidParticipant(battle, step.userId);
    if (participant && participant.hp > 0 && battle.bossHp > 0) {
      const baseDamage = Math.floor((getRaidEffectiveLevel(participant) / 2) * 20 * (1 + getRaidAttackBonusPercent(participant)) * (1 + Number(participant.basicAttackEquipmentBonusPercent || 0)) * Number(participant.specialDamageMultiplier || 1));
      const isCritical = Math.random() < getRaidCriticalChance(participant);
      const hitDamageMultiplier = Number.isFinite(Number(step.damageMultiplier)) ? Number(step.damageMultiplier) : 1;
      let hitDamage = Math.floor(baseDamage * hitDamageMultiplier * (isCritical ? 1.5 : 1));
      if (participant.perHitBonusTurns > 0) {
        hitDamage += participant.perHitBonusDamage || 0;
      }
      if (step.hitIndex === 0 && participant.extraDamage > 0) {
        hitDamage += participant.extraDamage;
      }
      if (participant.damageMultiplierTurns > 0) {
        hitDamage = Math.floor(hitDamage * participant.damageMultiplierValue);
      }
      const skillName = step.internFollowup ? '인턴 지원 공격' : '기본 공격';
      const dealtDamage = applyRaidDamageToBoss(battle, hitDamage, { attacker: participant, skillName });
      const targetName = battle.lastBossDamageTargetName || '보스';
      incrementRaidOvertimeRageStacks(battle);
      battle.logs.push(`${participant.displayName}의 ${step.internFollowup ? '<인턴> 지원 공격' : `기본 공격 ${step.hitIndex + 1}타`}! ${targetName}에게 ${dealtDamage.toLocaleString()} 피해를 입혔습니다.${isCritical ? ' (치명타)' : ''}`);
      if (!step.internFollowup && battle.bossHp > 0) {
        const followupSteps = buildRaidInternFollowupSteps(battle, participant);
        if (followupSteps.length) {
          sequence.steps = [...followupSteps, ...sequence.steps];
        }
      }
    }
  } else if (step.type === 'player_fixed_skill_hit') {
    const participant = getRaidParticipant(battle, step.userId);
    if (participant && participant.hp > 0 && battle.bossHp > 0) {
      const dealtDamage = applyRaidDamageToBoss(battle, step.damage, { attacker: participant, skillName: step.skillName });
      const targetName = battle.lastBossDamageTargetName || '보스';
      battle.logs.push(`${participant.displayName}의 ${step.skillName} ${step.hitIndex + 1}타! ${targetName}에게 ${dealtDamage.toLocaleString()} 피해를 입혔습니다.`);
    }
  } else if (step.type === 'boss_random_hit') {
    const bossInfo = RAID_BOSS_DATA[battle.bossId] || RAID_BOSS_DATA[RAID_BOSS_ID];
    if (Number(battle.bossBlindTurns || 0) > 0 && Math.random() < Number(battle.bossBlindMissChance || 0.3)) {
      battle.logs.push(`${bossInfo.name}의 ${step.skillName} ${step.hitIndex + 1}타는 눈부심 때문에 빗나갔습니다.`);
      return true;
    }
    const currentAlive = getAliveRaidParticipants(battle);
    if (currentAlive.length > 0) {
      const target = pickRaidBossTarget(currentAlive);
      if (!target) return true;
      const dealt = applyRaidDamage(target, Number(step.damage || 0), { battle, source: 'boss' });
      battle.logs.push(`${bossInfo.name}의 ${step.skillName} ${step.hitIndex + 1}타! ${target.displayName}에게 ${dealt.toLocaleString()} 피해를 입혔습니다.`);
    }
  } else if (step.type === 'boss_all_hit') {
    const bossInfo = RAID_BOSS_DATA[battle.bossId] || RAID_BOSS_DATA[RAID_BOSS_ID];
    if (Number(battle.bossBlindTurns || 0) > 0 && Math.random() < Number(battle.bossBlindMissChance || 0.3)) {
      battle.logs.push(`${bossInfo.name}의 ${step.skillName} ${step.hitIndex + 1}타는 눈부심 때문에 빗나갔습니다.`);
      return true;
    }
    const currentAlive = getAliveRaidParticipants(battle);
    let totalDealt = 0;
    currentAlive.forEach((target) => {
      totalDealt += applyRaidDamage(target, Number(step.damage || 0), { battle, source: 'boss' });
    });
    battle.logs.push(`${bossInfo.name}의 ${step.skillName} ${step.hitIndex + 1}타! 파티 전체가 총 ${totalDealt.toLocaleString()} 피해를 받았습니다.`);
  } else if (step.type === 'boss_add_negate_hits') {
    const addCount = Math.max(0, Math.floor(Number(step.count || 0)));
    if (addCount > 0) {
      battle.bossNegateHits = Number(battle.bossNegateHits || 0) + addCount;
      battle.logs.push(step.text || `${(RAID_BOSS_DATA[battle.bossId] || RAID_BOSS_DATA[RAID_BOSS_ID]).name}이(가) 피격 무효 ${addCount.toLocaleString()}회를 얻었습니다.`);
    }
  } else if (step.type === 'log' && step.text) {
    battle.logs.push(step.text);
  }

  return true;
}

function performRaidCounterAttack(participant, battle) {
  const baseDamage = Math.floor((getRaidEffectiveLevel(participant) / 2) * 20 * (1 + getRaidAttackBonusPercent(participant)) * (1 + Number(participant.basicAttackEquipmentBonusPercent || 0)) * Number(participant.specialDamageMultiplier || 1));
  const isCritical = Math.random() < getRaidCriticalChance(participant);
  let damage = Math.floor(baseDamage * Number(participant.counterDamageMultiplier || 1) * (isCritical ? 1.5 : 1));
  if (participant.perHitBonusTurns > 0) damage += participant.perHitBonusDamage || 0;
  if (participant.damageMultiplierTurns > 0) {
    damage = Math.floor(damage * participant.damageMultiplierValue);
  }
  const dealtDamage = applyRaidDamageToBoss(battle, damage, { attacker: participant, skillName: '반격' });
  incrementRaidOvertimeRageStacks(battle);
  return `${participant.displayName}의 반격! ${dealtDamage.toLocaleString()} 피해를 입혔습니다.${isCritical ? ' (치명타)' : ''}`;
}

function consumeRaidBreadBuff(target, battle) {
  if (!target || !battle || target.hp <= 0 || Number(target.breadCount || 0) <= 0) return 0;
  target.breadCount = Math.max(0, Number(target.breadCount || 0) - 1);
  const healed = healRaidTarget(target, 5);
  battle.logs.push(`${target.displayName}의 <빵>이 발동해 HP ${healed.toLocaleString()}를 회복했습니다. (남은 빵 ${Number(target.breadCount || 0).toLocaleString()}개)`);
  return healed;
}

function applyRaidDamage(target, damage, options = {}) {
  if (!target || target.hp <= 0) return 0;
  if ((options.allowNegate ?? true) && target.negateHitCount > 0) {
    target.negateHitCount -= 1;
    if (Number(target.solidMentalNegateCount || 0) > 0) {
      target.solidMentalNegateCount = Math.max(0, Number(target.solidMentalNegateCount || 0) - 1);
    }
    target.lastShieldLoss = 0;
    target.lastHpLoss = 0;
    return 0;
  }

  let remainingDamage = Number(damage || 0);
  if (Number(target.nextHitDamageTakenMultiplier || 1) > 1) {
    remainingDamage = Math.floor(remainingDamage * Number(target.nextHitDamageTakenMultiplier || 1));
    target.nextHitDamageTakenMultiplier = 1;
  }
  const tauntReduction = Number(target.tauntTurns || 0) > 0 ? Math.max(0, Math.min(0.95, Number(target.tauntDamageReductionPercent || 0))) : 0;
  if (tauntReduction > 0) {
    remainingDamage = Math.floor(remainingDamage * (1 - tauntReduction));
  }
  let blocked = 0;
  if (target.shield > 0) {
    blocked = Math.min(target.shield, remainingDamage);
    target.shield -= blocked;
    remainingDamage -= blocked;
    if (target.roundShieldAmount > 0) {
      target.roundShieldAmount = Math.max(0, Number(target.roundShieldAmount || 0) - blocked);
    }
  }
  target.hp = Math.max(0, target.hp - remainingDamage);
  target.lastShieldLoss = blocked;
  target.lastHpLoss = remainingDamage;

  if (!options.skipBread && options.source === 'boss' && options.battle && (blocked > 0 || remainingDamage > 0)) {
    consumeRaidBreadBuff(target, options.battle);
  }

  if (options.source === 'boss' && options.battle && target.counterTurns > 0 && target.hp > 0) {
    options.battle.logs.push(performRaidCounterAttack(target, options.battle));
  }
  if (options.source === 'boss' && options.battle) {
    triggerRaidBossPoisonOnAttack(options.battle);
  }

  return remainingDamage;
}

function getRaidCriticalChance(participant) {
  const baseChance = 0.1;
  const bonus = participant.critBonusTurns > 0 ? Number(participant.critBonusValue || 0) : 0;
  const championBonus = participant.championGuardTurns > 0 ? Number(participant.championGuardCritBonus || 0) : 0;
  return Math.min(1, baseChance + bonus + championBonus);
}

function performRaidBasicAttack(participant, battle) {
  if (participant.basicAttackLockTurns > 0) {
    return {
      logs: [`${participant.displayName}님은 울 아들 만나봐 상태라 기본 공격을 할 수 없습니다.`],
      delayUnits: 0
    };
  }
  let hitCount = Math.max(1, 1 + participant.extraHits);
  const multiHitDamageMultiplier = Number(participant.multiHitDamageMultiplier || 1);
  const damageMultiplier = Math.min(1, multiHitDamageMultiplier);
  if (participant.hypeTurns > 0) hitCount *= 2;
  const steps = [];
  for (let hit = 0; hit < hitCount; hit += 1) {
    steps.push({
      type: 'player_basic_hit',
      userId: participant.userId,
      hitIndex: hit,
      damageMultiplier
    });
  }

  return {
    steps,
    delayUnits: Math.max(1, steps.length)
  };
}

function applyRaidDebuffImmunity(target) {
  if (target.selfEsteemCount > 0) {
    target.selfEsteemCount -= 1;
    return true;
  }
  if (target.debuffImmuneCount > 0) {
    target.debuffImmuneCount -= 1;
    return true;
  }
  return false;
}


function getRaidTauntTargets(aliveParticipants) {
  return (aliveParticipants || []).filter((participant) => participant.hp > 0 && Number(participant.tauntTurns || 0) > 0);
}

function pickRaidBossTarget(aliveParticipants) {
  const alive = (aliveParticipants || []).filter((participant) => participant.hp > 0);
  if (!alive.length) return null;
  const tauntTargets = getRaidTauntTargets(alive);
  const pool = tauntTargets.length ? tauntTargets : alive;
  return pool[Math.floor(Math.random() * pool.length)];
}

function selectRaidBossTargets(aliveParticipants, count) {
  const alive = (aliveParticipants || []).filter((participant) => participant.hp > 0);
  const targetCount = Math.max(0, Math.min(Math.floor(Number(count || 0)), alive.length));
  if (!targetCount) return [];
  const tauntTargets = getRaidTauntTargets(alive);
  const selected = [];
  tauntTargets.sort(() => Math.random() - 0.5).slice(0, targetCount).forEach((target) => selected.push(target));
  const selectedIds = new Set(selected.map((target) => target.userId));
  const rest = alive.filter((target) => !selectedIds.has(target.userId)).sort(() => Math.random() - 0.5);
  while (selected.length < targetCount && rest.length) {
    selected.push(rest.shift());
  }
  return selected;
}

function tickRaidBossSideShields(battle) {
  if (!battle) return;
  if (Number(battle.bossShieldTurns || 0) > 0) {
    battle.bossShieldTurns -= 1;
    if (battle.bossShieldTurns <= 0) {
      const expiredShield = Number(battle.bossShield || 0);
      battle.bossShield = 0;
      if (expiredShield > 0 && Number(battle.bossShieldExpirePartyHits || 0) > 0) {
        const hits = Math.max(0, Number(battle.bossShieldExpirePartyHits || 0));
        const damage = scaleRaidBossDamage(battle, Number(battle.bossShieldExpirePartyDamage || 0));
        for (let hit = 0; hit < hits; hit += 1) {
          getAliveRaidParticipants(battle).forEach((participant) => {
            applyRaidDamage(participant, damage, { battle, source: 'boss' });
          });
          battle.logs.push(`황과장의 포괄임금 보호막이 만료되어 파티 전체가 ${damage.toLocaleString()} 피해를 받았습니다. (${hit + 1}타)`);
        }
      }
      battle.bossShieldExpirePartyHits = 0;
      battle.bossShieldExpirePartyDamage = 0;
    }
  }

  getRaidBossMinions(battle).forEach((minion) => {
    if (Number(minion.shieldTurns || 0) <= 0) return;
    minion.shieldTurns -= 1;
    if (minion.shieldTurns <= 0) {
      minion.shield = 0;
    }
  });
}

function performRaidBossMinionAction(battle, minion) {
  if (!battle || !minion || Number(minion.hp || 0) <= 0) {
    return null;
  }
  const aliveParticipants = getAliveRaidParticipants(battle);
  if (!aliveParticipants.length) return null;
  const target = pickRaidBossTarget(aliveParticipants);
  if (!target) return null;
  const damage = Math.max(0, Math.floor(Number(minion.attackDamage || 0)));
  const dealt = applyRaidDamage(target, damage, { battle, source: 'boss' });
  return `${minion.name}의 기본 공격! ${target.displayName}에게 ${dealt.toLocaleString()} 피해를 입혔습니다.`;
}

function performRaidBossAction(battle) {
  const bossInfo = RAID_BOSS_DATA[battle.bossId] || RAID_BOSS_DATA[RAID_BOSS_ID];
  tickRaidBossSideShields(battle);
  const patternOrder = usesEnhancedRaidBossTuning(battle) && Array.isArray(bossInfo.hardPatternOrder) && bossInfo.hardPatternOrder.length
    ? bossInfo.hardPatternOrder
    : bossInfo.patternOrder;
  const pattern = patternOrder[battle.bossPatternIndex % patternOrder.length];
  battle.bossPatternIndex += 1;
  const aliveParticipants = getAliveRaidParticipants(battle);
  if (aliveParticipants.length === 0) return `${bossInfo.name}이(가) 승리의 포즈를 취했습니다.`;

  if (isChaosRaidBattle(battle) && battle.bossId === RAID_BOSS_ID_BALD_MANAGER) {
    const missingHp = Math.max(0, Number(battle.bossMaxHp || 0) - Number(battle.bossHp || 0));
    const healAmount = healRaidBoss(battle, Math.floor(missingHp * 0.2));
    if (healAmount > 0) {
      battle.logs.push(`대머리 김부장의 <매끈한 두피>! 자신의 턴을 맞아 ${healAmount.toLocaleString()} HP를 회복했습니다.`);
    }
  }

  if (battle.bossId === RAID_BOSS_ID_OVERTIME_MANAGER) {
    if (pattern === 'inclusive_wage') {
      const bossMissingHp = Math.max(0, Number(battle.bossMaxHp || 0) - Number(battle.bossHp || 0));
      const bossShield = Math.max(0, Math.floor(bossMissingHp * 0.5));
      battle.bossShield = Number(battle.bossShield || 0) + bossShield;
      battle.bossShieldTurns = Math.max(Number(battle.bossShieldTurns || 0), 2);
      battle.bossShieldExpirePartyHits = 2;
      battle.bossShieldExpirePartyDamage = 10;
      battle.bossLastHpLoss = 0;

      const minionTexts = [];
      getAliveRaidBossMinions(battle).forEach((minion) => {
        const minionShield = Math.max(0, Math.floor(Number(minion.maxHp || 0) * 0.4));
        minion.shield = Number(minion.shield || 0) + minionShield;
        minion.shieldTurns = Math.max(Number(minion.shieldTurns || 0), 2);
        minion.lastHpLoss = 0;
        minion.lastShieldLoss = 0;
        minionTexts.push(`${minion.name} ${minionShield.toLocaleString()}`);
      });
      clearRoundShieldEffects(battle);
      return `야근하다 미쳐버린 황과장의 포 괄 임 금! 황과장 ${bossShield.toLocaleString()}${minionTexts.length ? `, ${minionTexts.join(', ')}` : ''} 보호막을 얻었습니다.`;
    }

    if (pattern === 'rage_typing') {
      const steps = [];
      [
        { count: 4, damage: 10 },
        { count: 3, damage: 20 },
        { count: 2, damage: 30 }
      ].forEach((phase) => {
        for (let hit = 0; hit < phase.count; hit += 1) {
          steps.push({
            type: 'boss_random_hit',
            skillName: '분 노 의 타 이 핑',
            damage: scaleRaidBossDamage(battle, phase.damage),
            hitIndex: steps.length
          });
        }
      });
      return {
        logs: ['야근하다 미쳐버린 황과장의 분 노 의 타 이 핑! 키보드가 불꽃처럼 두드려집니다.'],
        steps,
        delayUnits: Math.max(1, steps.length),
        clearRoundShieldsAtEnd: true
      };
    }

    if (pattern === 'no_dinner') {
      const bossMissingHp = Math.max(0, Number(battle.bossMaxHp || 0) - Number(battle.bossHp || 0));
      const bossHeal = healRaidBoss(battle, Math.floor(bossMissingHp * 0.3));
      const healTexts = bossHeal > 0 ? [`황과장 +${bossHeal.toLocaleString()}`] : [];
      getRaidBossMinions(battle).forEach((minion) => {
        if (Number(minion.hp || 0) <= 0) return;
        const missingHp = Math.max(0, Number(minion.maxHp || 0) - Number(minion.hp || 0));
        const healed = Math.floor(missingHp * 0.3);
        if (healed > 0) {
          minion.hp = Math.min(Number(minion.maxHp || 0), Number(minion.hp || 0) + healed);
          minion.lastHpLoss = 0;
          healTexts.push(`${minion.name} +${healed.toLocaleString()}`);
        }
      });
      const steps = [0, 1].map((_, index) => ({
        type: 'boss_all_hit',
        skillName: '석 식 미 제 공',
        damage: scaleRaidBossDamage(battle, 10),
        hitIndex: index
      }));
      return {
        logs: [`야근하다 미쳐버린 황과장의 석 식 미 제 공! ${healTexts.length ? healTexts.join(', ') : '회복할 HP가 없었습니다.'}`],
        steps,
        delayUnits: Math.max(1, steps.length),
        clearRoundShieldsAtEnd: true
      };
    }

    if (pattern === 'caffeine_doping') {
      battle.bossDamageReductionTurns = Math.max(Number(battle.bossDamageReductionTurns || 0), 2);
      battle.bossDamageReductionPercent = Math.max(Number(battle.bossDamageReductionPercent || 0), 0.4);
      const appliedNames = [];
      const resistedNames = [];
      aliveParticipants.forEach((participant) => {
        if (applyRaidDebuffImmunity(participant)) {
          resistedNames.push(participant.displayName);
          return;
        }
        participant.shield = 0;
        participant.tempShieldAmount = 0;
        participant.tempShieldTurns = 0;
        participant.roundShieldAmount = 0;
        participant.shieldBlockTurns = Math.max(Number(participant.shieldBlockTurns || 0), 2);
        appliedNames.push(participant.displayName);
      });
      clearRoundShieldEffects(battle);
      const appliedText = appliedNames.length ? `${appliedNames.join(', ')} 이(가) 실드 삭제 및 획득 불가 상태가 되었습니다.` : '모든 대상이 디버프를 막아냈습니다.';
      const resistedText = resistedNames.length ? ` ${resistedNames.join(', ')} 은(는) 디버프를 막아냈습니다.` : '';
      return `야근하다 미쳐버린 황과장의 카 페 인 도 핑! 황과장이 받는 피해 감소를 얻었습니다. ${appliedText}${resistedText}`;
    }
  }

  if (battle.bossId === RAID_BOSS_ID_HOI) {
    if (pattern === 'son_brag') {
      const isHardMode = isChaosRaidBattle(battle);
      const targets = selectRaidBossTargets(aliveParticipants, 2);
      const affectedNames = [];
      const resistedNames = [];
      aliveParticipants.forEach((participant) => {
        const removedBuffCount = buildRaidParticipantStatusEffects(participant).filter((effect) => effect.type === 'buff').length;
        if (removedBuffCount > 0) {
          applyRaidDamage(participant, removedBuffCount * (isHardMode ? 20 : 10), { battle, source: 'boss', allowCounter: false });
        }
        participant.critBonusTurns = 0;
        participant.critBonusValue = 0;
        participant.hypeTurns = 0;
        participant.counterTurns = 0;
        participant.counterDamageMultiplier = 1;
        participant.attackBonusBuffs = [];
        participant.attackBonusTurns = 0;
        participant.attackBonusPercent = 0;
        participant.damageMultiplierTurns = 0;
        participant.damageMultiplierValue = 1;
        participant.perHitBonusTurns = 0;
        participant.perHitBonusDamage = 0;
        participant.negateHitCount = 0;
        participant.debuffImmuneCount = 0;
        participant.cardEffectAmpTurns = 0;
        participant.cardEffectAmpValue = 1;
        participant.celineTurns = 0;
        participant.celineExpireDamage = 0;
        participant.celineAttackBonusPercent = 0;
      });
      targets.forEach((participant) => {
        if (applyRaidDebuffImmunity(participant)) {
          resistedNames.push(participant.displayName);
        } else {
          participant.basicAttackLockTurns = Math.max(participant.basicAttackLockTurns, isHardMode ? 5 : 2);
          affectedNames.push(participant.displayName);
        }
      });
      clearRoundShieldEffects(battle);
      return `HOI-M.S.J-50의 아들자랑 MK.1! 전원의 버프를 제거하고 ${affectedNames.join(', ') || '대상 없음'}에게 울 아들 만나봐 디버프를 적용했습니다.${resistedNames.length ? ` ${resistedNames.join(', ')} 은(는) 디버프를 막아냈습니다.` : ''}`;
    }

    if (pattern === 'son_mix') {
      const bossBuffCount = Math.max(0, Number(battle.bossNegateHits || 0));
      if (bossBuffCount > 0) {
        const healAmount = healRaidBoss(battle, bossBuffCount * 6000);
        return `HOI-M.S.J-50의 아들이랑 엮기 MK.2! 보유 버프 ${bossBuffCount}개로 HP를 ${healAmount.toLocaleString()} 회복했습니다.`;
      }
      const shieldAmount = isChaosRaidBattle(battle) ? 80000 : 5000;
      battle.bossShield = Number(battle.bossShield || 0) + shieldAmount;
      battle.bossShieldTurns = Math.max(Number(battle.bossShieldTurns || 0), 1);
      battle.bossLastHpLoss = 0;
      return `HOI-M.S.J-50의 아들이랑 엮기 MK.2! 버프가 없어 보호막 ${shieldAmount.toLocaleString()}을 얻었습니다.`;
    }

    if (pattern === 'ass_hit') {
      const steps = [];
      const hitCount = isChaosRaidBattle(battle) ? 5 : 3;
      const hitDamage = isChaosRaidBattle(battle) ? 8 : 10;
      for (let count = 0; count < hitCount; count += 1) {
        steps.push({
          type: 'boss_all_hit',
          skillName: 'ASS-HIT MK.3',
          damage: hitDamage,
          hitIndex: count
        });
      }
      return {
        steps,
        delayUnits: Math.max(1, steps.length),
        clearRoundShieldsAtEnd: true
      };
    }

    if (pattern === 'nail_clip') {
      const target = pickRaidBossTarget(aliveParticipants);
      if (target && !applyRaidDebuffImmunity(target)) {
        target.nailBounceDelayTurns = Math.max(target.nailBounceDelayTurns, 1);
        target.nailBounceDamage = Math.max(target.nailBounceDamage, isChaosRaidBattle(battle) ? 20 : 40);
        target.nailBounceRemainingBounces = Math.max(target.nailBounceRemainingBounces, 2);
        target.nailBounceDamageStep = isChaosRaidBattle(battle) ? 10 : -10;
        return `HOI-M.S.J-50의 손 톱 깎 기! ${target.displayName}에게 튕겨나간 손톱 디버프를 부여했습니다.`;
      }
      return `HOI-M.S.J-50의 손 톱 깎 기! ${target.displayName}은(는) 디버프를 막아냈습니다.`;
    }

    if (pattern === 'food_question') {
      const isHardMode = isChaosRaidBattle(battle);
      if (isHardMode) {
        const steps = [0, 1].map((_, index) => ({
          type: 'boss_all_hit',
          skillName: '먹고 싶은거 있어?',
          damage: 10,
          hitIndex: index
        }));
        steps.push({
          type: 'boss_add_negate_hits',
          count: 20,
          text: 'HOI-M.S.J-50이 <난 그건 싫은데?> 피격 무효 20회를 얻었습니다.'
        });
        return {
          logs: ['HOI-M.S.J-50의 먹고 싶은거 있어?! 파티 전체에게 10 피해를 2회 줍니다.'],
          steps,
          delayUnits: Math.max(1, steps.length),
          clearRoundShieldsAtEnd: true
        };
      }
      aliveParticipants.forEach((participant) => {
        applyRaidDamage(participant, 20, { battle, source: 'boss' });
      });
      battle.bossNegateHits = Number(battle.bossNegateHits || 0) + 10;
      clearRoundShieldEffects(battle);
      return 'HOI-M.S.J-50의 먹고 싶은거 있어?! 파티 전체에게 20 피해를 주고 피격 무효 10회를 얻었습니다.';
    }
  }

  if (battle.bossId === RAID_BOSS_ID_BALD_MANAGER) {
    const isHardMode = isChaosRaidBattle(battle);
    if (pattern === 'wig_search') {
      const wigTargets = aliveParticipants.filter((participant) => getParticipantCards(participant).some((card) => card.id === 'wig'));
      if (wigTargets.length > 0) {
        const target = wigTargets[Math.floor(Math.random() * wigTargets.length)];
        applyRaidDamage(target, 20, { battle, source: 'boss' });
        target.damageMultiplierTurns = Math.max(target.damageMultiplierTurns, 1);
        target.damageMultiplierValue = Math.max(Number(target.damageMultiplierValue || 1), isHardMode ? 3 : 2.5);
        clearRoundShieldEffects(battle);
        return `대머리 김부장의 어이쿠 가발이 여기있네..! ${target.displayName}에게 20 피해를 입히고 <수고했네> 버프를 부여했습니다.`;
      }

      const targets = selectRaidBossTargets(aliveParticipants, 3);
      const lockedNames = [];
      const resistedNames = [];
      targets.forEach((participant) => {
        applyRaidDamage(participant, isHardMode ? 30 : 20, { battle, source: 'boss' });
        if (applyRaidDebuffImmunity(participant)) {
          resistedNames.push(participant.displayName);
        } else {
          participant.actionLockTurns = Math.max(participant.actionLockTurns, isHardMode ? 4 : 2);
          lockedNames.push(participant.displayName);
        }
      });
      const lockedText = lockedNames.length ? `${lockedNames.join(', ')} 이(가) ${isHardMode ? 4 : 2}턴 동안 가발 찾는중.. 상태에 빠졌습니다.` : '모든 대상이 디버프를 막아냈습니다.';
      const resistedText = resistedNames.length ? ` ${resistedNames.join(', ')} 은(는) 디버프를 막아냈습니다.` : '';
      clearRoundShieldEffects(battle);
      return `대머리 김부장의 내 가발 어디갔어?! 대상 3명이 ${isHardMode ? 30 : 20} 피해를 받았습니다. ${lockedText}${resistedText}`;
    }

    if (pattern === 'mz') {
      const targets = selectRaidBossTargets(aliveParticipants, 4);
      const debuffedNames = [];
      const resistedNames = [];
      targets.forEach((participant) => {
        const hitCount = isHardMode ? 5 : 1;
        const hitDamage = isHardMode ? 6 : 10;
        for (let hit = 0; hit < hitCount; hit += 1) {
          applyRaidDamage(participant, hitDamage, { battle, source: 'boss' });
        }
        if (applyRaidDebuffImmunity(participant)) {
          resistedNames.push(participant.displayName);
        } else {
          participant.healShieldReductionTurns = Math.max(participant.healShieldReductionTurns, isHardMode ? 4 : 2);
          participant.healShieldReductionMultiplier = Math.min(Number(participant.healShieldReductionMultiplier || 1), isHardMode ? 0.3 : 0.5);
          debuffedNames.push(participant.displayName);
        }
      });
      const debuffedText = debuffedNames.length ? `${debuffedNames.join(', ')} 이(가) 꼰대 디버프에 걸렸습니다.` : '모든 대상이 디버프를 막아냈습니다.';
      const resistedText = resistedNames.length ? ` ${resistedNames.join(', ')} 은(는) 디버프를 막아냈습니다.` : '';
      clearRoundShieldEffects(battle);
      return `대머리 김부장의 허허, 요즘 엠제트세대란..! 대상 4명이 ${isHardMode ? '6 피해를 5회씩' : '10 피해를'} 받았습니다. ${debuffedText}${resistedText}`;
    }

    if (pattern === 'afterparty') {
      const shieldAmount = isHardMode ? 100000 : 7000;
      const shieldTurns = isHardMode ? 4 : 2;
      battle.bossShield = Number(battle.bossShield || 0) + shieldAmount;
      battle.bossShieldTurns = Math.max(Number(battle.bossShieldTurns || 0), shieldTurns);
      battle.bossLastHpLoss = 0;
      const appliedNames = [];
      const resistedNames = [];
      aliveParticipants.forEach((participant) => {
        if (applyRaidDebuffImmunity(participant)) {
          resistedNames.push(participant.displayName);
        } else {
          participant.nextHitDamageTakenMultiplier = Math.max(Number(participant.nextHitDamageTakenMultiplier || 1), 3);
          appliedNames.push(participant.displayName);
        }
      });
      clearRoundShieldEffects(battle);
      const appliedText = appliedNames.length ? `${appliedNames.join(', ')} 이(가) 4차까지? 디버프에 걸렸습니다.` : '모든 대상이 디버프를 막아냈습니다.';
      const resistedText = resistedNames.length ? ` ${resistedNames.join(', ')} 은(는) 디버프를 막아냈습니다.` : '';
      return `대머리 김부장의 비기: 회식은 3차부터! ${shieldTurns}턴 지속되는 ${shieldAmount.toLocaleString()}의 실드를 획득했습니다. ${appliedText}${resistedText}`;
    }

    if (pattern === 'sauna') {
      if (isHardMode) {
        const steps = [0, 1, 2].map((_, index) => ({
          type: 'boss_all_hit',
          skillName: '사우나나 갈까?',
          damage: 10,
          hitIndex: index
        }));
        return {
          logs: ['대머리 김부장의 사우나나 갈까?! 파티 전체에게 10 피해를 3회 줍니다.'],
          steps,
          delayUnits: Math.max(1, steps.length),
          clearRoundShieldsAtEnd: true
        };
      }
      aliveParticipants.forEach((participant) => {
        applyRaidDamage(participant, 20, { battle, source: 'boss' });
      });
      clearRoundShieldEffects(battle);
      return '대머리 김부장의 사우나나 갈까?! 파티 전체가 20 피해를 받았습니다.';
    }

    return '대머리 김부장이 뒷짐을 지고 숨을 골랐습니다.';
  }

  if (pattern === 'burp') {
    if (isChaosRaidBattle(battle) && battle.bossId === RAID_BOSS_ID) {
      const steps = [0, 1, 2].map((_, index) => ({
        type: 'boss_all_hit',
        skillName: '트름하기',
        damage: 10,
        hitIndex: index
      }));
      return {
        logs: ['트름녀의 트름하기! 파티 전체에게 10 피해를 3회 줍니다.'],
        steps,
        delayUnits: Math.max(1, steps.length),
        clearRoundShieldsAtEnd: true
      };
    }
    aliveParticipants.forEach((participant) => {
      applyRaidDamage(participant, 30, { battle, source: 'boss' });
    });
    clearRoundShieldEffects(battle);
    return '트름녀의 트름하기! 파티 전체가 30 피해를 받았습니다.';
  }

  if (pattern === 'ice') {
    const isHardMode = isChaosRaidBattle(battle) && battle.bossId === RAID_BOSS_ID;
    const targets = selectRaidBossTargets(aliveParticipants, 3);
    const silencedNames = [];
    const resistedNames = [];
    targets.forEach((participant) => {
      applyRaidDamage(participant, isHardMode ? 40 : 30, { battle, source: 'boss' });
      if (applyRaidDebuffImmunity(participant)) {
        resistedNames.push(participant.displayName);
      } else {
        participant.silenceTurns = Math.max(participant.silenceTurns, isHardMode ? 4 : 1);
        silencedNames.push(participant.displayName);
      }
    });
    const silencedText = silencedNames.length ? `${silencedNames.join(', ')} 이(가) ${isHardMode ? 4 : 1}턴 침묵에 걸렸습니다.` : '모든 대상이 침묵을 막아냈습니다.';
    const resistedText = resistedNames.length ? ` ${resistedNames.join(', ')} 은(는) 디버프를 막아냈습니다.` : '';
    clearRoundShieldEffects(battle);
    return `트름녀의 얼음씹기! 대상 3명이 ${isHardMode ? 40 : 30} 피해를 받았습니다. ${silencedText}${resistedText}`;
  }

  if (pattern === 'smack') {
    const steps = [];
    for (let count = 0; count < 4; count += 1) {
      steps.push({
        type: 'boss_random_hit',
        skillName: '쩝쩝거리기',
        damage: 20,
        hitIndex: count
      });
    }
    return {
      steps,
      delayUnits: Math.max(1, steps.length),
      clearRoundShieldsAtEnd: true
    };
  }

  if (pattern === 'shield') {
    const isHardMode = isChaosRaidBattle(battle) && battle.bossId === RAID_BOSS_ID;
    let healAmount = 0;
    if (isHardMode) {
      const missingHp = Math.max(0, Number(battle.bossMaxHp || 0) - Number(battle.bossHp || 0));
      const rawHealAmount = isChaosRaidBattle(battle)
        ? 70000 + Math.floor(missingHp * 0.1)
        : Math.floor(missingHp * 0.2);
      healAmount = healRaidBoss(battle, rawHealAmount);
    }
    const shieldAmount = isHardMode ? 150000 : 10000;
    const shieldTurns = isHardMode ? 2 : 1;
    battle.bossShield = Number(battle.bossShield || 0) + shieldAmount;
    battle.bossShieldTurns = Math.max(Number(battle.bossShieldTurns || 0), shieldTurns);
    battle.bossLastHpLoss = 0;
    clearRoundShieldEffects(battle);
    return `트름녀의 눈 새 행동! ${healAmount > 0 ? `${healAmount.toLocaleString()} HP를 회복하고 ` : ''}${shieldTurns}턴 지속되는 ${shieldAmount.toLocaleString()}의 실드를 획득했습니다.`;
  }

  return `${bossInfo.name}이(가) 잠시 숨을 골랐습니다.`;
}

function buildRaidBattleSnapshot(activeBattle, viewerUserId = null) {
  if (!activeBattle) return null;
  const bossData = RAID_BOSS_DATA[activeBattle.bossId] || RAID_BOSS_DATA[RAID_BOSS_ID];
  const battleMode = getRaidModeFromBattle(activeBattle);
  const room = getRaidRoom(battleMode);
  const currentEnemyActor = Number(activeBattle.turnIndex || 0) >= (activeBattle.participants?.length || 0)
    ? getCurrentRaidBossSideActor(activeBattle)
    : null;
  const sanitizedLogs = activeBattle.logs.slice(-8).map((line) => {
    let normalized = String(line || '');
    activeBattle.participants.forEach((participant) => {
      if (participant?.displayName && participant?.nickname && participant.displayName !== participant.nickname) {
        normalized = normalized.split(participant.displayName).join(participant.nickname);
      }
    });
    return normalized;
  });
  return {
    battleId: activeBattle.battleId,
    mode: battleMode,
    modeLabel: getRaidModeConfig(battleMode).label,
    bossId: activeBattle.bossId,
    bossName: bossData.name,
    bossPortrait: bossData.portrait || '',
    bossImageLabel: bossData.imageLabel || bossData.name,
    bossHp: activeBattle.bossHp,
    bossMaxHp: activeBattle.bossMaxHp,
    bossShield: activeBattle.bossShield || 0,
    bossLastHpLoss: activeBattle.bossLastHpLoss || 0,
    bossStatusEffects: buildRaidBossStatusEffects(activeBattle),
    bossMinions: getRaidBossMinions(activeBattle).map((minion) => ({
      unitId: minion.unitId,
      name: minion.name,
      hp: Number(minion.hp || 0),
      maxHp: Number(minion.maxHp || 0),
      shield: Number(minion.shield || 0),
      shieldTurns: Number(minion.shieldTurns || 0),
      lastHpLoss: Number(minion.lastHpLoss || 0),
      lastShieldLoss: Number(minion.lastShieldLoss || 0),
      attackDamage: Number(minion.attackDamage || 0),
      statusEffects: buildRaidBossUnitStatusEffects(minion)
    })),
    phase: activeBattle.phase,
    turnNumber: Math.max(1, Number(activeBattle.turnNumber || 1)),
    currentTurnIndex: activeBattle.turnIndex,
    currentEnemyUnitId: currentEnemyActor?.unitId || null,
    currentEnemyName: currentEnemyActor?.name || null,
    currentEnemyType: currentEnemyActor?.type || null,
    bossPatternIndex: activeBattle.bossPatternIndex,
    nextActionAt: activeBattle.nextActionAt,
    countdownEndsAt: activeBattle.countdownEndsAt || null,
    readyEndsAt: activeBattle.readyEndsAt || null,
    isParticipant: viewerUserId ? isRaidUserParticipant(activeBattle, viewerUserId) : false,
    spectators: buildSpectatorList(room.viewers, activeBattle.participants.map((participant) => participant.userId)),
    participants: activeBattle.participants.map((participant, index) => {
      const raidCards = getParticipantCardEntries(participant).map((entry, cardSlot) => {
        const card = getCardDefinition(entry.cardId, entry.enhancementLevel || 0);
        return card ? {
          cardSlot,
          cardId: card.id,
          enhancementLevel: normalizeCardEnhancementLevel(card.enhancementLevel || entry.enhancementLevel || 0),
          name: card.displayName || card.name,
          grade: card.grade || null,
          borderColor: card.borderColor || '',
          specialStyle: card.specialStyle || '',
          potatoRehabKillCount: card.id === 'potato_rehab' ? getPotatoRehabKillCount(participant) : 0,
          potatoRehabAuraStrength: card.id === 'potato_rehab' ? getPotatoRehabAuraStrength(participant) : 0,
          skillName: card.skillName || '',
          skillDesc: buildRaidParticipantCardSkillDescription(participant, card),
          targetType: card.targetType || null,
          passiveOnly: Boolean(card.passiveOnly),
          skillCooldown: getRaidSkillCooldown(participant, cardSlot),
          plannedSkill: Boolean(participant.plannedSkill && Number(participant.plannedCardSlot || 0) === cardSlot),
          oncePerBattle: Boolean(card.oncePerBattle),
          oncePerBattleUsed: Boolean(card.oncePerBattle && participant.potatoRehabUsed)
        } : null;
      }).filter(Boolean);
      const card = getParticipantCard(participant, 0);
      return {
        turnOrder: Number.isInteger(participant.turnOrder) ? participant.turnOrder : index,
        userId: participant.userId,
        displayName: participant.nickname || participant.displayName,
        level: participant.level,
        hp: participant.hp,
        maxHp: participant.maxHp,
        shield: participant.shield,
        lastHpLoss: participant.lastHpLoss || 0,
        lastShieldLoss: participant.lastShieldLoss || 0,
        silenceTurns: participant.silenceTurns,
        skillCooldown: participant.skillCooldown,
        plannedSkill: participant.plannedSkill,
        plannedCardSlot: Number.isInteger(participant.plannedCardSlot) ? participant.plannedCardSlot : null,
        plannedTargetUserId: participant.plannedTargetUserId || null,
        plannedTargetUserId2: participant.plannedTargetUserId2 || null,
        raidCards,
        equippedCardId: participant.equippedCardId || null,
        equippedCardLevel: normalizeCardEnhancementLevel(participant.equippedCardLevel || 0),
        equippedCardName: card?.displayName || card?.name || '장착 카드 없음',
        equippedCardGrade: card?.grade || null,
        equippedCardBorderColor: card?.borderColor || '',
        equippedCardSpecialStyle: card?.specialStyle || '',
        equippedCardPotatoRehabKillCount: card?.id === 'potato_rehab' ? getPotatoRehabKillCount(participant) : 0,
        equippedCardPotatoRehabAuraStrength: card?.id === 'potato_rehab' ? getPotatoRehabAuraStrength(participant) : 0,
        skillName: card?.skillName || '',
        skillDesc: card ? buildRaidParticipantCardSkillDescription(participant, card) : '',
        targetType: card?.targetType || null,
        passiveOnly: Boolean(card?.passiveOnly),
        oncePerBattle: Boolean(card?.oncePerBattle),
        oncePerBattleUsed: Boolean(card?.oncePerBattle && participant.potatoRehabUsed),
        statusEffects: buildRaidParticipantStatusEffects(participant),
        isSelf: viewerUserId ? participant.userId === String(viewerUserId) : false
      };
    }),
    recentLogs: sanitizedLogs
  };
}

function applyRaidBattleStartPassives(activeBattle) {
  if (isHardOrChaosRaidBattle(activeBattle)) {
    const bossInfo = RAID_BOSS_DATA[activeBattle.bossId] || RAID_BOSS_DATA[RAID_BOSS_ID];
    const passiveText = isChaosRaidBattle(activeBattle)
      ? bossInfo.hardPassiveText
      : (bossInfo.legacyHardPassiveText || bossInfo.hardPassiveText);
    if (passiveText) {
      const modeLabel = getRaidModeConfig(getRaidModeFromBattle(activeBattle)).label;
      activeBattle.logs.push(`${bossInfo.name} ${modeLabel} 패시브 적용: ${passiveText.replace(/^패시브\.\s*/, '')}`);
    }
  }
  const hoiBoosted = activeBattle.bossId === RAID_BOSS_ID_HOI
    ? activeBattle.participants.filter((participant) => participant.nickname === '호이')
    : [];
  hoiBoosted.forEach((participant) => {
    participant.specialDamageMultiplier = 1.5;
    activeBattle.logs.push(`${participant.displayName}은(는) HOI-M.S.J-50 특수 기믹으로 입히는 피해가 ${Number(participant.specialDamageMultiplier || 1).toFixed(1)}배가 됩니다.`);
  });
  if (hoiBoosted.length) {
    activeBattle.participants.forEach((participant) => {
      participant.hoiRewardBuff = true;
      participant.hoiRewardMultiplier = 1.5;
    });
    activeBattle.logs.push('HOI-M.S.J-50 특수 기믹으로 클리어 시 파티 전체 전리품이 1.5배가 됩니다.');
  }
  if (activeBattle.bossId === RAID_BOSS_ID_OVERTIME_MANAGER && getAliveRaidBossMinions(activeBattle).length) {
    activeBattle.logs.push('황과장이 최주임과 정대리를 불러냈습니다. 하수인의 도발이 활성화됩니다.');
  }
  const sojuCards = activeBattle.participants
    .flatMap((participant) => getParticipantCards(participant))
    .filter((card) => card?.id === 'drinking_angle');
  if (sojuCards.length) {
    const rewardMultiplier = Math.max(...sojuCards.map((card) => Number(card.rewardMultiplier || 1)));
    activeBattle.participants.forEach((participant) => {
      participant.sojuRewardBuff = true;
      participant.sojuRewardMultiplier = rewardMultiplier;
    });
    activeBattle.logs.push('야채곱창이 파티 전원에게 소주각? 버프를 부여했습니다.');
  }
  const lottoCards = activeBattle.participants
    .flatMap((participant) => getParticipantCards(participant))
    .filter((card) => card?.id === 'lotto_numbers');
  if (lottoCards.length) {
    const successChance = Math.max(...lottoCards.map((card) => Number(card.successChance || 0.5)));
    activeBattle.participants.forEach((participant) => {
      participant.lottoRewardBuff = true;
      participant.lottoRewardSuccessChance = successChance;
    });
    activeBattle.logs.push('모래의 로또번호가 파티 전원에게 이번엔 될거같아 버프를 부여했습니다.');
  }
  activeBattle.participants.forEach((participant) => {
    const internCard = getParticipantCards(participant).find((card) => card?.effectType === 'passive_intern_followup');
    if (!internCard) return;
    participant.internBuff = true;
    participant.internChance = Number(internCard.internChance || 0);
    participant.internDamageMultiplier = Number(internCard.internDamageMultiplier || 0.3);
    activeBattle.logs.push(`${participant.displayName}이(가) ${internCard.name} 효과로 <인턴> 버프를 얻었습니다.`);
  });
}

function buildRaidModeStatus(user, mode = RAID_MODE_NORMAL, now = new Date()) {
  pruneExpiredRaidQueue(mode, now);
  const room = getRaidRoom(mode);
  const slots = room.slots || Array(RAID_PARTY_SIZE).fill(null);
  const slotIndex = findQueuedRaidSlotIndex(user._id, mode);
  const config = getRaidModeConfig(mode);
  const queueRemainingMs = slotIndex >= 0 ? getRaidQueueRemainingMs(user._id, mode, now) : null;
  return {
    mode,
    label: config.label,
    queuedCount: slots.filter(Boolean).length,
    queuedSlotIndex: slotIndex,
    queueRemainingMs,
    queueExpiresAt: queueRemainingMs === null ? null : new Date(now.getTime() + queueRemainingMs),
    hasActiveBattle: Boolean(room.activeBattle),
    isParticipant: room.activeBattle ? isRaidUserParticipant(room.activeBattle, user._id) : false,
    participantCount: room.activeBattle?.participants?.length || 0,
    minLevel: config.minLevel,
    maxLevel: Number.isFinite(config.maxLevel) ? config.maxLevel : null,
    levelEligible: isRaidLevelEligible(user.gameState.level, mode)
  };
}

let raidPollAdvanceInFlight = false;

async function advanceRaidStateForPoll(now = new Date()) {
  if (raidPollAdvanceInFlight) return;
  raidPollAdvanceInFlight = true;
  try {
    await advanceRaidState(now);
  } finally {
    raidPollAdvanceInFlight = false;
  }
}

async function buildRaidStateResponse(user, now = new Date(), mode = RAID_MODE_NORMAL, options = {}) {
  try {
    pruneExpiredRaidQueue(null, now);
    if (options.poll) {
      await advanceRaidStateForPoll(now);
    } else {
      await advanceRaidState(now);
    }
  } catch (err) {
    console.error('Raid state reconciliation error:', err);
    RAID_MODE_LIST.forEach((entryMode) => {
      const activeBattle = getRaidRoom(entryMode).activeBattle;
      if (activeBattle?.finalizing) {
        activeBattle.finalizing = false;
        activeBattle.nextActionAt = new Date(now.getTime() + RAID_ACTION_DELAY_MS);
      }
    });
  }

  const normalizedMode = normalizeRaidModeForCurrentBoss(mode, now);
  const room = getRaidRoom(normalizedMode);
  const raidCacheKey = options.poll && user?._id
    ? ['raid', String(user._id), normalizedMode, raidState.version, room.slots.join(','), room.activeBattle?.battleId || '', room.activeBattle?.phase || '', room.activeBattle?.currentActorId || '', Number(user.gameState?.level || 1), user.meta?.lastRaidDayKey || '', user.meta?.raidEntryDayKey || '', user.meta?.raidEntryUsedCount || 0, user.meta?.raidEntryBonusCount || 0].join(':')
    : null;
  if (raidCacheKey) {
    const cachedRaid = getStateResponseCache(raidStateResponseCache, raidCacheKey);
    if (cachedRaid) return cachedRaid;
  }
  const queuedUserIds = room.slots.filter(Boolean);
  const queuedUsers = queuedUserIds.length
    ? await User.find({ _id: { $in: queuedUserIds } }).select('nickname username gameState.level equippedCardId equippedCardLevel raidExtraCardSelection cards enhancedCards titles')
    : [];
  const queuedMap = new Map(queuedUsers.map((queuedUser) => [String(queuedUser._id), queuedUser]));

  const slots = room.slots.map((slotUserId) => {
    if (!slotUserId) return null;
    const queuedUser = queuedMap.get(String(slotUserId));
    if (!queuedUser) return null;
    ensureUserDefaults(queuedUser);
    return buildQueuedSlotSnapshot(queuedUser, normalizedMode);
  });

  const slotIndex = findQueuedRaidSlotIndex(user._id, normalizedMode);
  const queueRemainingMs = slotIndex >= 0 ? getRaidQueueRemainingMs(user._id, normalizedMode, now) : null;
  const raidResponse = {
    version: raidState.version,
    mode: normalizedMode,
    modes: getRaidAvailableModes(now).map((entryMode) => buildRaidModeStatus(user, entryMode, now)),
    lobby: getRaidLobbySummary(now, normalizedMode),
    slots,
    queuedSlotIndex: slotIndex,
    queueRemainingMs,
    queueExpiresAt: queueRemainingMs === null ? null : new Date(now.getTime() + queueRemainingMs),
    todayUsed: isRaidAlreadyUsedToday(user, now),
    remainingEntries: getRaidRemainingEntries(user, now),
    minLevelMet: isRaidLevelEligible(user.gameState.level, normalizedMode),
    levelRequirementText: getRaidLevelRequirementText(normalizedMode),
    canStart: slotIndex === slots.findIndex(Boolean) && slotIndex !== -1 && !room.activeBattle,
    countdown: room.activeBattle?.phase === 'countdown'
      ? {
          active: true,
          mode: normalizedMode,
          endsAt: room.activeBattle.countdownEndsAt,
          participantIds: room.activeBattle.participants.map((participant) => participant.userId)
        }
      : null,
    activeBattle: buildRaidBattleSnapshot(room.activeBattle, user._id),
    activeBattles: {
      [RAID_MODE_NORMAL]: buildRaidBattleSnapshot(getRaidRoom(RAID_MODE_NORMAL).activeBattle, user._id),
      [RAID_MODE_HARD]: buildRaidBattleSnapshot(getRaidRoom(RAID_MODE_HARD).activeBattle, user._id),
      [RAID_MODE_CHAOS]: buildRaidBattleSnapshot(getRaidRoom(RAID_MODE_CHAOS).activeBattle, user._id)
    }
  };
  if (raidCacheKey) setStateResponseCache(raidStateResponseCache, raidCacheKey, raidResponse);
  return raidResponse;
}

function bumpPvpVersion() {
  pvpState.version = (Number(pvpState.version || 0) + 1) % Number.MAX_SAFE_INTEGER;
  pvpStateResponseCache.clear();
}

function normalizePvpMode(mode) {
  if (mode === PVP_MODE_AUGMENT_3V3) return PVP_MODE_AUGMENT_3V3;
  if (mode === PVP_MODE_PRACTICE) return PVP_MODE_PRACTICE;
  return mode === PVP_MODE_NORMAL ? PVP_MODE_NORMAL : PVP_MODE_RANKED;
}

function getPvpModeLabel(mode) {
  return PVP_MODE_LABELS[normalizePvpMode(mode)] || PVP_MODE_LABELS[PVP_MODE_RANKED];
}

function getPvpModeState(mode = PVP_MODE_RANKED) {
  const normalized = normalizePvpMode(mode);
  if (!pvpState.modes) pvpState.modes = {};
  if (!pvpState.modes[normalized]) pvpState.modes[normalized] = createPvpModeState();
  return pvpState.modes[normalized];
}

function getPvpModeEntries() {
  return [PVP_MODE_RANKED, PVP_MODE_NORMAL, PVP_MODE_PRACTICE, PVP_MODE_AUGMENT_3V3].map((mode) => [mode, getPvpModeState(mode)]);
}

function isRankedPvpMode(mode) {
  return normalizePvpMode(mode) === PVP_MODE_RANKED;
}

function isPracticePvpMode(mode) {
  return normalizePvpMode(mode) === PVP_MODE_PRACTICE;
}

function getPvpModeStateForMatch(match) {
  return getPvpModeState(match?.mode || PVP_MODE_RANKED);
}

function getPvpModeStateForBattle(battle) {
  return getPvpModeState(battle?.mode || PVP_MODE_RANKED);
}

function isUserInAnyPvpSession(userId) {
  const normalizedUserId = String(userId || '');
  if (!normalizedUserId) return false;
  return getPvpModeEntries().some(([, modeState]) => (
    modeState.queue.some((entry) => entry.userId === normalizedUserId)
    || modeState.match?.players?.some((player) => player.userId === normalizedUserId)
    || modeState.battle?.players?.some((player) => player.userId === normalizedUserId)
  ));
}

function getCardGradeOrderValue(grade) {
  return ({ S: 0, A: 1, B: 2, C: 3 }[grade] ?? 9);
}

function getAllPvpBanCards() {
  return Object.values(CARD_DATA)
    .filter((card) => !card.pvpDisabled)
    .slice()
    .sort((a, b) => getCardGradeOrderValue(a.grade) - getCardGradeOrderValue(b.grade) || a.name.localeCompare(b.name, 'ko'))
    .map((card) => {
      const previewLevel = card.enhanceDisabled ? 0 : 5;
      const resolved = getCardDefinition(card.id, previewLevel);
      return {
        cardId: card.id,
        name: resolved?.displayName || card.name,
        baseName: card.name,
        grade: card.grade,
        color: CARD_GRADE_COLORS[card.grade] || '#666666',
        skillName: resolved?.skillName || card.skillName,
        skillDesc: buildCardSkillDescription(card.id, previewLevel),
        cooldown: Number(resolved?.cooldown || 0),
        durationText: getCardDurationText(card.id, previewLevel),
        passiveOnly: Boolean(resolved?.passiveOnly),
        specialStyle: card.specialStyle || '',
        enhancementLevel: previewLevel
      };
    });
}

let allPvpBanCardsCache = null;

function getAllPvpBanCardsCached() {
  if (!allPvpBanCardsCache) allPvpBanCardsCache = getAllPvpBanCards();
  return allPvpBanCardsCache;
}

function getOwnedPvpPickCards(user) {
  const highestByCardId = new Map();
  buildCardVariantDetails(user)
    .filter((entry) => Number(entry.quantity || 0) > 0 && !CARD_DATA[entry.cardId]?.pvpDisabled)
    .forEach((entry) => {
      const current = highestByCardId.get(entry.cardId);
      if (!current || Number(entry.enhancementLevel || 0) > Number(current.enhancementLevel || 0)) {
        highestByCardId.set(entry.cardId, entry);
      }
    });

  return [...highestByCardId.values()].map((entry) => ({
      cardId: entry.cardId,
      enhancementLevel: normalizeCardEnhancementLevel(entry.enhancementLevel || 0),
      name: entry.name,
      baseName: entry.baseName,
      grade: entry.grade,
      color: entry.color,
      borderColor: entry.borderColor,
      skillName: entry.skillName,
      skillDesc: entry.skillDesc,
      cooldown: Number(entry.cooldown || 0),
      durationText: entry.durationText,
      targetType: entry.targetType || null,
      passiveOnly: Boolean(entry.passiveOnly),
      specialStyle: entry.specialStyle || ''
    }));
}

function isAugmentPvpMode(mode) {
  return normalizePvpMode(mode) === PVP_MODE_AUGMENT_3V3;
}

function getAllAugmentPvpCards() {
  return getAllPvpBanCards()
    .filter((card) => !card.passiveOnly)
    .map((card) => ({
      ...card,
      enhancementLevel: CARD_DATA[card.cardId]?.enhanceDisabled ? 0 : 5,
      name: CARD_DATA[card.cardId]?.enhanceDisabled ? card.baseName : `${card.baseName} +5`
    }));
}

function pickAugmentRandomCard(cardPool, usedCardIds = new Set()) {
  const candidates = cardPool.filter((card) => !usedCardIds.has(card.cardId));
  if (!candidates.length) return null;
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  usedCardIds.add(picked.cardId);
  return picked;
}

function buildAugmentCardCandidatesForPlayers(players = []) {
  const cardPool = getAllAugmentPvpCards();
  const teamUsed = { red: new Set(), blue: new Set() };
  const candidates = {};
  players.forEach((player) => {
    const used = teamUsed[player.team] || new Set();
    const list = [];
    while (list.length < PVP_AUGMENT_CANDIDATE_COUNT) {
      const picked = pickAugmentRandomCard(cardPool, used);
      if (!picked) break;
      list.push({
        cardId: picked.cardId,
        enhancementLevel: picked.enhancementLevel,
        name: picked.name,
        baseName: picked.baseName,
        grade: picked.grade,
        color: picked.color,
        skillName: picked.skillName,
        skillDesc: picked.skillDesc,
        cooldown: picked.cooldown,
        durationText: picked.durationText,
        targetType: picked.targetType || null,
        effectType: picked.effectType || null,
        specialStyle: picked.specialStyle || ''
      });
    }
    candidates[player.userId] = list;
  });
  return candidates;
}

function getAugmentOptionsForPlayer(player = {}) {
  return Array.isArray(player.augmentOptions) ? player.augmentOptions : [];
}

function pickWeightedAugmentTier() {
  const totalWeight = PVP_AUGMENT_TIER_WEIGHTS.reduce((sum, entry) => sum + Number(entry.weight || 0), 0);
  let roll = Math.random() * totalWeight;
  for (const entry of PVP_AUGMENT_TIER_WEIGHTS) {
    roll -= Number(entry.weight || 0);
    if (roll <= 0) return entry.tier;
  }
  return 'silver';
}

function pickAugmentOptions(count = 3, forcedTier = null) {
  const entries = Object.values(PVP_AUGMENT_DATA);
  const byTier = {
    silver: entries.filter((entry) => entry.tier === 'silver'),
    gold: entries.filter((entry) => entry.tier === 'gold'),
    prism: entries.filter((entry) => entry.tier === 'prism')
  };
  const picked = [];
  const seen = new Set();
  while (picked.length < count && seen.size < entries.length) {
    const tier = forcedTier || pickWeightedAugmentTier();
    const pool = (byTier[tier] || []).filter((entry) => !seen.has(entry.id));
    const fallback = entries.filter((entry) => !seen.has(entry.id));
    const source = pool.length ? pool : fallback;
    if (!source.length) break;
    const option = source[Math.floor(Math.random() * source.length)];
    seen.add(option.id);
    picked.push(option);
  }
  return picked;
}

function bumpInfiniteOvertimeVersion() {
  infiniteOvertimeState.version = (Number(infiniteOvertimeState.version || 0) + 1) % Number.MAX_SAFE_INTEGER;
}

function getInfiniteOvertimeCardScore(cardId) {
  return INFINITE_OVERTIME_CARD_SCORE[CARD_DATA[cardId]?.grade] || 0;
}

function getInfiniteOvertimeDeckScore(deck = []) {
  return (Array.isArray(deck) ? deck : []).reduce((sum, entry) => sum + getInfiniteOvertimeCardScore(entry.cardId), 0);
}

function normalizeInfiniteOvertimeDeck(deck = []) {
  const seen = new Set();
  return (Array.isArray(deck) ? deck : [])
    .filter((entry) => {
      const cardId = String(entry?.cardId || '');
      if (!cardId || seen.has(cardId) || !CARD_DATA[cardId] || CARD_DATA[cardId].pvpDisabled) return false;
      seen.add(cardId);
      return true;
    })
    .slice(0, 5)
    .map((entry) => ({
      cardId: String(entry.cardId),
      enhancementLevel: normalizeCardEnhancementLevel(entry.enhancementLevel || entry.level || 0)
    }));
}

function getAllInfiniteOvertimeCards(previewLevel = 0) {
  return Object.values(CARD_DATA)
    .filter((card) => !card.pvpDisabled)
    .map((card) => {
      const level = card.enhanceDisabled ? 0 : normalizeCardEnhancementLevel(previewLevel);
      const resolved = getCardDefinition(card.id, level);
      return {
        cardId: card.id,
        enhancementLevel: level,
        name: resolved?.displayName || card.name,
        baseName: card.name,
        grade: card.grade,
        score: getInfiniteOvertimeCardScore(card.id),
        color: CARD_GRADE_COLORS[card.grade] || '#666666',
        skillName: resolved?.skillName || card.skillName,
        skillDesc: buildCardSkillDescription(card.id, level),
        cooldown: Number(resolved?.cooldown || 0),
        durationText: getCardDurationText(card.id, level),
        passiveOnly: Boolean(resolved?.passiveOnly),
        specialStyle: card.specialStyle || ''
      };
    })
    .sort((a, b) => getCardGradeOrderValue(a.grade) - getCardGradeOrderValue(b.grade) || a.baseName.localeCompare(b.baseName, 'ko'));
}

function getInfiniteOvertimeOwnedCards(user) {
  return getOwnedPvpPickCards(user)
    .map((entry) => ({
      ...entry,
      score: getInfiniteOvertimeCardScore(entry.cardId)
    }))
    .filter((entry) => entry.score > 0);
}

function resolveInfiniteOvertimeOwnedEnhancements(user, deck = []) {
  const ownedMap = new Map(getInfiniteOvertimeOwnedCards(user).map((card) => [card.cardId, card]));
  return normalizeInfiniteOvertimeDeck(deck).map((entry) => {
    const owned = ownedMap.get(entry.cardId);
    return {
      cardId: entry.cardId,
      enhancementLevel: normalizeCardEnhancementLevel(owned?.enhancementLevel ?? entry.enhancementLevel ?? 0)
    };
  });
}

function generateInfiniteOvertimeDeckForScore(targetScore, options = getAllInfiniteOvertimeCards(0)) {
  const normalizedTarget = Math.max(INFINITE_OVERTIME_DEFENSE_MIN_SCORE, Math.min(INFINITE_OVERTIME_DEFENSE_MAX_SCORE, Math.floor(Number(targetScore || INFINITE_OVERTIME_DEFENSE_MIN_SCORE))));
  const pool = (Array.isArray(options) ? options : []).filter((entry) => entry?.cardId && getInfiniteOvertimeCardScore(entry.cardId) > 0);
  if (pool.length < 5) return [];

  for (let attempt = 0; attempt < 5000; attempt += 1) {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const selected = [];
    let score = 0;
    for (const card of shuffled) {
      if (selected.some((entry) => entry.cardId === card.cardId)) continue;
      const nextScore = score + getInfiniteOvertimeCardScore(card.cardId);
      if (selected.length < 4 && nextScore >= normalizedTarget) continue;
      selected.push({
        cardId: card.cardId,
        enhancementLevel: normalizeCardEnhancementLevel(card.enhancementLevel || 0)
      });
      score = nextScore;
      if (selected.length === 5) break;
    }
    if (selected.length === 5 && score === normalizedTarget) return selected;
  }

  const result = [];
  function backtrack(startIndex, score) {
    if (result.length === 5) return score === normalizedTarget;
    for (let index = startIndex; index < pool.length; index += 1) {
      const card = pool[index];
      if (result.some((entry) => entry.cardId === card.cardId)) continue;
      const nextScore = score + getInfiniteOvertimeCardScore(card.cardId);
      if (nextScore > normalizedTarget) continue;
      result.push({
        cardId: card.cardId,
        enhancementLevel: normalizeCardEnhancementLevel(card.enhancementLevel || 0)
      });
      if (backtrack(index + 1, nextScore)) return true;
      result.pop();
    }
    return false;
  }
  return backtrack(0, 0) ? [...result] : [];
}

function getInfiniteOvertimeCardPublicDetail(entry) {
  const card = getCardDefinition(entry.cardId, entry.enhancementLevel || 0);
  if (!card) return null;
  return {
    cardId: entry.cardId,
    enhancementLevel: normalizeCardEnhancementLevel(entry.enhancementLevel || 0),
    name: card.displayName || CARD_DATA[entry.cardId]?.name || entry.cardId,
    baseName: CARD_DATA[entry.cardId]?.name || entry.cardId,
    grade: card.grade || CARD_DATA[entry.cardId]?.grade || '',
    score: getInfiniteOvertimeCardScore(entry.cardId),
    color: CARD_GRADE_COLORS[card.grade || CARD_DATA[entry.cardId]?.grade] || '#666666',
    borderColor: card.borderColor || '',
    skillName: card.skillName || '',
    skillDesc: buildCardSkillDescription(entry.cardId, entry.enhancementLevel || 0),
    cooldown: Number(card.cooldown || 0),
    durationText: getCardDurationText(entry.cardId, entry.enhancementLevel || 0),
    passiveOnly: Boolean(card.passiveOnly),
    specialStyle: CARD_DATA[entry.cardId]?.specialStyle || ''
  };
}

function getInfiniteOvertimeDefenseScoreFromRanks(pvpRank, levelRank) {
  let score = INFINITE_OVERTIME_DEFENSE_MIN_SCORE;
  if (Number.isFinite(Number(pvpRank)) && Number(pvpRank) > 0) {
    score = Math.max(score, INFINITE_OVERTIME_DEFENSE_MAX_SCORE - (Math.floor((Number(pvpRank) - 1) / 3) * 2));
  }
  if (Number.isFinite(Number(levelRank)) && Number(levelRank) > 0) {
    score = Math.max(score, INFINITE_OVERTIME_DEFENSE_MAX_SCORE - 1 - (Math.floor((Number(levelRank) - 1) / 3) * 2));
  }
  return Math.max(INFINITE_OVERTIME_DEFENSE_MIN_SCORE, Math.min(INFINITE_OVERTIME_DEFENSE_MAX_SCORE, score));
}

async function buildInfiniteOvertimeScoreMap() {
  const users = await User.find({ nickname: { $ne: null } })
    .select('_id nickname username gameState.level gameState.exp pvpStats infiniteOvertime');
  const scoreMap = new Map();
  const levelSorted = [...users].sort((a, b) =>
    Number(b.gameState?.level || 1) - Number(a.gameState?.level || 1)
    || Number(b.gameState?.exp || 0) - Number(a.gameState?.exp || 0)
  );
  levelSorted.forEach((user, index) => {
    const userId = String(user._id);
    const previous = scoreMap.get(userId) || {};
    scoreMap.set(userId, {
      ...previous,
      levelRank: index + 1,
      targetScore: getInfiniteOvertimeDefenseScoreFromRanks(previous.pvpRank, index + 1)
    });
  });

  const pvpSorted = [...users]
    .filter((user) => Number(user.pvpStats?.played || 0) > 0)
    .sort((a, b) =>
      Number(b.pvpStats?.rating || PVP_RATING_BASE) - Number(a.pvpStats?.rating || PVP_RATING_BASE)
      || Number(b.pvpStats?.wins || 0) - Number(a.pvpStats?.wins || 0)
      || Number(a.pvpStats?.losses || 0) - Number(b.pvpStats?.losses || 0)
    );
  pvpSorted.forEach((user, index) => {
    const userId = String(user._id);
    const previous = scoreMap.get(userId) || {};
    scoreMap.set(userId, {
      ...previous,
      pvpRank: index + 1,
      targetScore: getInfiniteOvertimeDefenseScoreFromRanks(index + 1, previous.levelRank)
    });
  });
  return { users, scoreMap };
}

function formatInfiniteOvertimeDeck(deck = []) {
  return normalizeInfiniteOvertimeDeck(deck).map(getInfiniteOvertimeCardPublicDetail).filter(Boolean);
}

function rollInfiniteOvertimeDraftGrade() {
  const totalWeight = INFINITE_OVERTIME_DRAFT_GRADE_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of INFINITE_OVERTIME_DRAFT_GRADE_WEIGHTS) {
    roll -= entry.weight;
    if (roll <= 0) return entry.grade;
  }
  return 'C';
}

function getInfiniteOvertimeDraftGradeWeight(grade) {
  return INFINITE_OVERTIME_DRAFT_GRADE_WEIGHTS.find((entry) => entry.grade === grade)?.weight || 0;
}

function getInfiniteOvertimeDraftLowerGrades(grade, includeSelf = false) {
  const index = INFINITE_OVERTIME_DRAFT_GRADE_ORDER.indexOf(grade);
  if (index < 0) return ['C'];
  return INFINITE_OVERTIME_DRAFT_GRADE_ORDER.slice(index + (includeSelf ? 0 : 1));
}

function pickInfiniteOvertimeCandidateFromGrades(available, usedIds, grades) {
  const gradeList = (Array.isArray(grades) ? grades : [])
    .filter((grade, index, list) => grade && list.indexOf(grade) === index);
  const availableGrades = gradeList.filter((grade) => (
    available.some((entry) => !usedIds.has(entry.cardId) && entry.grade === grade)
  ));
  if (!availableGrades.length) return null;

  const totalWeight = availableGrades.reduce((sum, grade) => sum + getInfiniteOvertimeDraftGradeWeight(grade), 0);
  let roll = Math.random() * Math.max(1, totalWeight);
  let selectedGrade = availableGrades[availableGrades.length - 1];
  for (const grade of availableGrades) {
    roll -= getInfiniteOvertimeDraftGradeWeight(grade);
    if (roll <= 0) {
      selectedGrade = grade;
      break;
    }
  }

  const pool = available.filter((entry) => !usedIds.has(entry.cardId) && entry.grade === selectedGrade);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pushInfiniteOvertimeCandidate(candidates, picked) {
  if (!picked) return false;
  candidates.push({
    cardId: picked.cardId,
    enhancementLevel: normalizeCardEnhancementLevel(picked.enhancementLevel || 0)
  });
  return true;
}

function buildInfiniteOvertimeDraftCandidates(user, selectedDeck = [], count = 5) {
  const selectedIds = new Set(normalizeInfiniteOvertimeDeck(selectedDeck).map((entry) => entry.cardId));
  const owned = getInfiniteOvertimeOwnedCards(user)
    .filter((entry) => !selectedIds.has(entry.cardId));
  const candidates = [];
  const targetGrade = rollInfiniteOvertimeDraftGrade();

  while (candidates.length < count && candidates.length < owned.length) {
    const usedIds = new Set(candidates.map((entry) => entry.cardId));
    const available = owned.filter((entry) => !usedIds.has(entry.cardId));
    if (!available.length) break;

    let picked = null;
    if (!candidates.length) {
      picked = pickInfiniteOvertimeCandidateFromGrades(available, usedIds, [targetGrade])
        || pickInfiniteOvertimeCandidateFromGrades(available, usedIds, getInfiniteOvertimeDraftLowerGrades(targetGrade, false))
        || pickInfiniteOvertimeCandidateFromGrades(available, usedIds, INFINITE_OVERTIME_DRAFT_GRADE_ORDER.filter((grade) => grade !== 'S'))
        || pickInfiniteOvertimeCandidateFromGrades(available, usedIds, INFINITE_OVERTIME_DRAFT_GRADE_ORDER);
    } else {
      const fillerGrades = getInfiniteOvertimeDraftLowerGrades(targetGrade, false);
      picked = pickInfiniteOvertimeCandidateFromGrades(available, usedIds, fillerGrades.length ? fillerGrades : [targetGrade])
        || pickInfiniteOvertimeCandidateFromGrades(available, usedIds, INFINITE_OVERTIME_DRAFT_GRADE_ORDER.filter((grade) => grade !== 'S'))
        || pickInfiniteOvertimeCandidateFromGrades(available, usedIds, INFINITE_OVERTIME_DRAFT_GRADE_ORDER);
    }

    if (!pushInfiniteOvertimeCandidate(candidates, picked)) break;
  }

  return candidates;
}

function getInfiniteOvertimeAttackDraftStore(userId) {
  if (!infiniteOvertimeState.attackDrafts || typeof infiniteOvertimeState.attackDrafts !== 'object') {
    infiniteOvertimeState.attackDrafts = {};
  }
  const key = String(userId);
  if (!infiniteOvertimeState.attackDrafts[key]) {
    infiniteOvertimeState.attackDrafts[key] = { deck: [], candidates: [] };
  }
  return infiniteOvertimeState.attackDrafts[key];
}

function clearInfiniteOvertimeAttackDraft(userId) {
  if (infiniteOvertimeState.attackDrafts) {
    delete infiniteOvertimeState.attackDrafts[String(userId)];
  }
}

function getOrCreateInfiniteOvertimeAttackDraft(user) {
  const draft = getInfiniteOvertimeAttackDraftStore(user._id);
  const ownedMap = new Map(getInfiniteOvertimeOwnedCards(user).map((card) => [card.cardId, card]));
  draft.deck = normalizeInfiniteOvertimeDeck(draft.deck)
    .filter((entry) => ownedMap.has(entry.cardId))
    .map((entry) => {
      const owned = ownedMap.get(entry.cardId);
      return {
        cardId: entry.cardId,
        enhancementLevel: normalizeCardEnhancementLevel(owned?.enhancementLevel || entry.enhancementLevel || 0)
      };
    });

  draft.candidates = normalizeInfiniteOvertimeDeck(draft.candidates)
    .filter((entry) => ownedMap.has(entry.cardId) && !draft.deck.some((pick) => pick.cardId === entry.cardId))
    .map((entry) => {
      const owned = ownedMap.get(entry.cardId);
      return {
        cardId: entry.cardId,
        enhancementLevel: normalizeCardEnhancementLevel(owned?.enhancementLevel || entry.enhancementLevel || 0)
      };
    });

  if (draft.deck.length < 5 && draft.candidates.length < 1) {
    draft.candidates = buildInfiniteOvertimeDraftCandidates(user, draft.deck, 5);
  } else if (draft.deck.length >= 5) {
    draft.candidates = [];
  }
  return draft;
}

function buildInfiniteOvertimeAttackDraftSnapshot(user) {
  const draft = getOrCreateInfiniteOvertimeAttackDraft(user);
  return {
    selectedDeck: formatInfiniteOvertimeDeck(draft.deck || []),
    candidates: formatInfiniteOvertimeDeck(draft.candidates || []),
    slotIndex: Math.min(5, Number(draft.deck?.length || 0) + 1),
    selectedScore: getInfiniteOvertimeDeckScore(draft.deck || [])
  };
}

function pickInfiniteOvertimeAttackDraftCard(user, cardId, enhancementLevel = 0) {
  const draft = getOrCreateInfiniteOvertimeAttackDraft(user);
  if (draft.deck.length >= 5) {
    throw createHttpError(400, '이미 공략용 카드 5장을 모두 선택했습니다.');
  }
  const normalizedCardId = String(cardId || '');
  const picked = (draft.candidates || []).find((entry) => (
    entry.cardId === normalizedCardId
    && Number(entry.enhancementLevel || 0) === Number(enhancementLevel || 0)
  ));
  if (!picked) {
    throw createHttpError(400, '현재 후보에 있는 카드만 선택할 수 있습니다.');
  }
  draft.deck.push({
    cardId: picked.cardId,
    enhancementLevel: normalizeCardEnhancementLevel(picked.enhancementLevel || 0)
  });
  draft.candidates = draft.deck.length < 5
    ? buildInfiniteOvertimeDraftCandidates(user, draft.deck, 5)
    : [];
  bumpInfiniteOvertimeVersion();
  return draft;
}

function getPvpPlayer(matchOrBattle, userId) {
  return matchOrBattle?.players?.find((player) => String(player.userId) === String(userId)) || null;
}

function getPvpOpponent(matchOrBattle, userId) {
  return matchOrBattle?.players?.find((player) => String(player.userId) !== String(userId)) || null;
}

function getPvpBannedCardIds(match) {
  const banned = [];
  Object.values(match?.bans || {}).forEach((list) => {
    banned.push(...(Array.isArray(list) ? list : []));
  });
  return banned;
}

function getPvpPickedCardIds(match) {
  const picked = [];
  Object.values(match?.picks || {}).forEach((list) => {
    (Array.isArray(list) ? list : []).forEach((entry) => picked.push(entry.cardId));
  });
  return picked;
}

function getPvpTurnPlayerId(match) {
  return match?.turnUserId || match?.players?.[0]?.userId || null;
}

function getPvpPickSequence(match) {
  if (Array.isArray(match?.pickSequenceIndices) && match.pickSequenceIndices.length) {
    return match.pickSequenceIndices;
  }
  return isPracticePvpMode(match?.mode) ? PVP_PRACTICE_PICK_SEQUENCE_INDICES : PVP_PICK_SEQUENCE_INDICES;
}

function getPvpPickTurnPlayerId(match) {
  const pickTurnIndex = Number(match?.pickTurnIndex || 0);
  const sequence = getPvpPickSequence(match);
  if (pickTurnIndex < 0 || pickTurnIndex >= sequence.length) return null;
  const playerIndex = sequence[pickTurnIndex] ?? 0;
  return match?.players?.[playerIndex]?.userId || match?.players?.[0]?.userId || null;
}

function isPvpPickPhaseComplete(match) {
  return match.players.every((player) => (
    (match.picks[player.userId] || []).length >= PVP_PICKS_PER_PLAYER
    || match.pickDone?.[player.userId]
  ));
}

function advancePvpDraftTurn(match, now = new Date()) {
  if (match.phase === 'pick') {
    match.pickDone = match.pickDone || {};
    let guard = 0;
    match.pickTurnIndex = Number(match.pickTurnIndex || 0) + 1;

    const sequence = getPvpPickSequence(match);
    while (match.pickTurnIndex < sequence.length && guard <= sequence.length) {
      const nextUserId = getPvpPickTurnPlayerId(match);
      const alreadyFull = nextUserId && (match.picks[nextUserId] || []).length >= PVP_PICKS_PER_PLAYER;
      if (nextUserId && !match.pickDone[nextUserId] && !alreadyFull) {
        match.turnUserId = nextUserId;
        match.turnEndsAt = new Date(now.getTime() + PVP_PICK_TURN_MS);
        return;
      }
      if (nextUserId && alreadyFull) match.pickDone[nextUserId] = true;
      match.pickTurnIndex += 1;
      guard += 1;
    }

    startPvpBattleCountdown(match, now);
    return;
  }

  const currentUserId = getPvpTurnPlayerId(match);
  const currentIndex = Math.max(0, match.players.findIndex((player) => player.userId === currentUserId));
  const nextPlayer = match.players[(currentIndex + 1) % match.players.length];
  match.turnUserId = nextPlayer.userId;
  match.turnEndsAt = new Date(now.getTime() + PVP_BAN_TURN_MS);
}

function startPvpPickPhase(match, now = new Date()) {
  match.phase = 'pick';
  match.pickTurnIndex = 0;
  match.turnUserId = getPvpPickTurnPlayerId(match);
  match.turnEndsAt = new Date(now.getTime() + PVP_PICK_TURN_MS);
}

function startPvpBattleCountdown(match, now = new Date()) {
  if (!match || match.phase === 'starting') return;
  match.phase = 'starting';
  match.turnUserId = null;
  match.turnEndsAt = null;
  match.pickTurnIndex = Math.max(Number(match.pickTurnIndex || 0), getPvpPickSequence(match).length);
  match.startsAt = new Date(now.getTime() + PVP_START_COUNTDOWN_MS);
  match.logs.push('전투가 곧 시작됩니다.');
}

function isPvpDraftTurnTimedOut(match, now = new Date(), graceMs = 0) {
  if (!match?.turnEndsAt) return false;
  return now.getTime() >= new Date(match.turnEndsAt).getTime() + Math.max(0, Number(graceMs || 0));
}

function getPvpDraftTurnKey(match) {
  if (!match) return '';
  return [
    match.matchId || '',
    match.phase || '',
    match.turnUserId || '',
    Number(match.pickTurnIndex || 0),
    match.turnEndsAt ? new Date(match.turnEndsAt).getTime() : 0
  ].join('|');
}

async function autoBanPvpCard(match, userId, now = new Date()) {
  const bannedSet = new Set(getPvpBannedCardIds(match));
  const pickedSet = new Set(getPvpPickedCardIds(match));
  const candidates = getAllPvpBanCards().filter((card) => !bannedSet.has(card.cardId) && !pickedSet.has(card.cardId));
  if (!candidates.length) return;
  const card = candidates[Math.floor(Math.random() * candidates.length)];
  match.bans[userId].push(card.cardId);
  match.logs.push(`${getPvpPlayer(match, userId)?.displayName || '플레이어'}의 시간이 초과되어 ${card.baseName}이(가) 자동 금지되었습니다.`);
  if (match.players.every((player) => (match.bans[player.userId] || []).length >= PVP_BANS_PER_PLAYER)) {
    startPvpPickPhase(match, now);
  } else {
    advancePvpDraftTurn(match, now);
  }
}

async function autoPickPvpCard(match, userId, now = new Date()) {
  const turnKey = getPvpDraftTurnKey(match);
  match.pickDone = match.pickDone || {};
  match.picks[userId] = match.picks[userId] || [];
  if (match.pickDone[userId] || (match.picks[userId] || []).length >= PVP_PICKS_PER_PLAYER) {
    match.pickDone[userId] = true;
    if (isPvpPickPhaseComplete(match)) {
      startPvpBattleCountdown(match, now);
    } else {
      advancePvpDraftTurn(match, now);
    }
    return;
  }

  const user = await User.findById(userId);
  if (!user) return;
  ensureUserDefaults(user);
  if (
    getPvpModeStateForMatch(match).match !== match
    || match.phase !== 'pick'
    || match.turnUserId !== String(userId)
    || getPvpDraftTurnKey(match) !== turnKey
  ) {
    return;
  }
  const bannedSet = new Set(getPvpBannedCardIds(match));
  const pickedSet = new Set(getPvpPickedCardIds(match));
  const candidates = getOwnedPvpPickCards(user).filter((card) => !bannedSet.has(card.cardId) && !pickedSet.has(card.cardId));
  if (candidates.length) {
    const card = candidates[Math.floor(Math.random() * candidates.length)];
    match.picks[userId].push({ cardId: card.cardId, enhancementLevel: card.enhancementLevel });
    match.logs.push(`${getPvpPlayer(match, userId)?.displayName || '플레이어'}의 시간이 초과되어 ${card.baseName}이(가) 자동 선택되었습니다.`);
    if ((match.picks[userId] || []).length >= PVP_PICKS_PER_PLAYER) {
      match.pickDone[userId] = true;
    }
  } else {
    match.logs.push(`${getPvpPlayer(match, userId)?.displayName || '플레이어'}의 시간이 초과되었지만 선택 가능한 카드가 없었습니다.`);
    match.pickDone[userId] = true;
  }

  if (isPvpPickPhaseComplete(match)) {
    startPvpBattleCountdown(match, now);
  } else {
    advancePvpDraftTurn(match, now);
  }
}

function buildPvpCardSlotSnapshot(pick, index, existing = null) {
  const normalizedLevel = normalizeCardEnhancementLevel(pick.enhancementLevel || 0);
  const card = getCardDefinition(pick.cardId, normalizedLevel);
  return {
    slotIndex: index,
    cardId: pick.cardId,
    enhancementLevel: normalizedLevel,
    cooldownRemaining: Math.max(0, Math.floor(Number(existing?.cooldownRemaining || 0))),
    name: card?.displayName || CARD_DATA[pick.cardId]?.name || pick.cardId,
    baseName: CARD_DATA[pick.cardId]?.name || pick.cardId,
    grade: card?.grade || CARD_DATA[pick.cardId]?.grade || null,
    color: CARD_GRADE_COLORS[card?.grade || CARD_DATA[pick.cardId]?.grade] || '#666666',
    borderColor: card?.borderColor || '',
    skillName: card?.skillName || '',
    skillDesc: card ? buildCardSkillDescription(card.id, card.enhancementLevel || 0) : '',
    durationText: card ? getCardDurationText(card.id, card.enhancementLevel || 0) : '',
    passiveOnly: Boolean(card?.passiveOnly),
    targetType: card?.targetType || null,
    effectType: card?.effectType || null
  };
}

function createPvpParticipantFromUser(user, match, picks) {
  const equippedEquipment = getEquippedEquipment(user);
  const equippedCardEffect = equippedEquipment?.equipmentType === EQUIPMENT_TYPE_CARD ? equippedEquipment : null;
  const equippedBasicAttack = equippedEquipment?.equipmentType === EQUIPMENT_TYPE_ATTACK ? equippedEquipment : null;
  return {
    userId: String(user._id),
    displayName: getCompactNickname(user, 18),
    level: 1,
    maxHp: PVP_MAX_HP,
    hp: PVP_MAX_HP,
    shield: 0,
    tempShieldAmount: 0,
    shieldExpiresAfterUserId: null,
    lastHpLoss: 0,
    lastShieldLoss: 0,
    basicAttackEquipmentBonusPercent: Number(equippedBasicAttack?.statValue || 0) / 100,
    cardEffectEquipmentBonusPercent: Number(equippedCardEffect?.statValue || 0) / 100,
    plannedCardIndex: null,
    basicAttackLockTurns: 0,
    actionLockTurns: 0,
    buffs: [],
    debuffs: [],
    cards: (picks || []).map((pick, index) => buildPvpCardSlotSnapshot(pick, index))
  };
}

function createPvpPracticeBotParticipant() {
  return {
    userId: 'practice_bot_jm',
    displayName: 'JM이햄',
    isBot: true,
    level: 1,
    maxHp: PVP_MAX_HP,
    hp: PVP_MAX_HP,
    shield: 0,
    tempShieldAmount: 0,
    shieldExpiresAfterUserId: null,
    lastHpLoss: 0,
    lastShieldLoss: 0,
    basicAttackEquipmentBonusPercent: 0,
    cardEffectEquipmentBonusPercent: 0,
    plannedCardIndex: null,
    basicAttackLockTurns: 0,
    actionLockTurns: 0,
    buffs: [],
    debuffs: [],
    cards: []
  };
}

async function createPvpBattleFromMatch(match, now = new Date()) {
  const userIds = match.players.map((player) => player.userId);
  const users = await User.find({ _id: { $in: userIds } });
  const userMap = new Map(users.map((user) => [String(user._id), user]));
  const players = match.players.map((player) => {
    const user = userMap.get(player.userId);
    if (!user) return null;
    ensureUserDefaults(user);
    return createPvpParticipantFromUser(user, match, match.picks[player.userId] || []);
  }).filter(Boolean);
  if (isPracticePvpMode(match.mode) && players.length === 1) {
    players.push(createPvpPracticeBotParticipant());
  }

  const battle = {
    battleId: crypto.randomUUID(),
    mode: normalizePvpMode(match.mode),
    modeLabel: getPvpModeLabel(match.mode),
    isRanked: isRankedPvpMode(match.mode),
    phase: 'active',
    players,
    firstUserId: players[0]?.userId || match.players[0].userId,
    currentUserId: players[0]?.userId || match.players[0].userId,
    turnNumber: 1,
    turnEndsAt: new Date(now.getTime() + PVP_BATTLE_TURN_MS),
    logs: [isPracticePvpMode(match.mode) ? '면담 연습모드가 시작되었습니다.' : '개인면담이 시작되었습니다.'],
    winnerUserId: null,
    loserUserId: null,
    finishedAt: null,
    tournamentMatchId: match.tournamentMatchId || null,
    bets: { ...(match.bets || {}) }
  };
  applyPvpBattleStartPassives(battle);
  return battle;
}

function applyPvpBattleStartPassives(battle) {
  battle.players.forEach((player) => {
    player.cards.forEach((cardEntry) => {
      const card = getCardDefinition(cardEntry.cardId, cardEntry.enhancementLevel);
      if (!card) return;
      if (card.effectType === 'passive_rotation_amp') {
        addPvpBuff(player, {
          id: 'rotation_amp_passive',
          name: '소개팅 상대',
          desc: `자신의 카드 효과 x${Number(card.amplifyMultiplier || 1).toFixed(1)}`,
          value: Number(card.amplifyMultiplier || 1),
          turns: 999
        });
        battle.logs.push(`${player.displayName}의 ${card.name} 효과로 카드 효과가 증폭됩니다.`);
      } else if (card.effectType === 'passive_party_reward') {
        addPvpBuff(player, {
          id: 'soju_reward',
          name: '소주각?',
          desc: `개인면담 승리 보상 x${Number(card.rewardMultiplier || 1).toFixed(1)}`,
          value: Number(card.rewardMultiplier || 1),
          turns: 999
        });
        battle.logs.push(`${player.displayName}의 야채곱창이 <소주각?> 버프를 부여했습니다.`);
      } else if (card.effectType === 'passive_party_lotto') {
        addPvpBuff(player, {
          id: 'lotto_reward',
          name: '이번엔 될거같아',
          desc: `개인면담 승리 시 ${formatCardPercentText(card.successChance || 0.5)} 확률로 보상 3배 또는 보상 없음`,
          value: Number(card.successChance || 0.5),
          turns: 999
        });
        battle.logs.push(`${player.displayName}의 모래의 로또번호가 <이번엔 될거같아> 버프를 부여했습니다.`);
      } else if (card.effectType === 'passive_intern_followup') {
        addPvpBuff(player, {
          id: 'intern_followup',
          name: '인턴',
          desc: `아군이 기본 공격할 때 ${formatCardPercentText(card.internChance || 0)} 확률로 ${formatCardPercentText(card.internDamageMultiplier || 0.3)} 위력의 기본 공격을 지원합니다.`,
          value: Number(card.internChance || 0),
          damageMultiplier: Number(card.internDamageMultiplier || 0.3),
          turns: 999
        });
        battle.logs.push(`${player.displayName}이(가) ${card.name} 효과로 <인턴> 버프를 얻었습니다.`);
      }
    });
  });
}

function createInfiniteOvertimeBotParticipant(floorInfo) {
  const botLevel = Math.max(1, Math.floor(Number(floorInfo.botLevel || 1)));
  const botMaxHp = Math.max(PVP_MAX_HP, Math.floor(Number(floorInfo.botMaxHp || PVP_MAX_HP)));
  return {
    userId: `bot:${floorInfo.floor}`,
    displayName: `<야근중인 ${floorInfo.defenderName || '야근 Bot'}>`,
    level: botLevel,
    attackLevel: INFINITE_OVERTIME_BOT_ATTACK_LEVEL,
    maxHp: botMaxHp,
    hp: botMaxHp,
    shield: 0,
    tempShieldAmount: 0,
    shieldExpiresAfterUserId: null,
    lastHpLoss: 0,
    lastShieldLoss: 0,
    basicAttackEquipmentBonusPercent: 0,
    cardEffectEquipmentBonusPercent: 0,
    plannedCardIndex: null,
    basicAttackLockTurns: 0,
    actionLockTurns: 0,
    buffs: [],
    debuffs: [],
    isBot: true,
    cards: normalizeInfiniteOvertimeDeck(floorInfo.deck).map((pick, index) => {
      const card = getCardDefinition(pick.cardId, pick.enhancementLevel || 0);
      return {
        slotIndex: index,
        cardId: pick.cardId,
        enhancementLevel: normalizeCardEnhancementLevel(pick.enhancementLevel || 0),
        cooldownRemaining: 0,
        name: card?.displayName || CARD_DATA[pick.cardId]?.name || pick.cardId,
        baseName: CARD_DATA[pick.cardId]?.name || pick.cardId,
        grade: card?.grade || CARD_DATA[pick.cardId]?.grade || null,
        color: CARD_GRADE_COLORS[card?.grade || CARD_DATA[pick.cardId]?.grade] || '#666666',
        borderColor: card?.borderColor || '',
        skillName: card?.skillName || '',
        skillDesc: card ? buildCardSkillDescription(card.id, card.enhancementLevel || 0) : '',
        durationText: card ? getCardDurationText(card.id, card.enhancementLevel || 0) : '',
        passiveOnly: Boolean(card?.passiveOnly)
      };
    })
  };
}

function decorateInfiniteOvertimeFloor(entry, index) {
  const floor = index + 1;
  const score = Math.max(INFINITE_OVERTIME_DEFENSE_MIN_SCORE, Math.min(INFINITE_OVERTIME_DEFENSE_MAX_SCORE, Number(entry.score || entry.targetScore || INFINITE_OVERTIME_DEFENSE_MIN_SCORE)));
  const difficultyTier = Math.floor((floor - 1) / 4);
  return {
    ...entry,
    floor,
    score,
    botLevel: 1 + difficultyTier,
    botMaxHp: PVP_MAX_HP + ((floor - 1) * 8) + ((score - INFINITE_OVERTIME_DEFENSE_MIN_SCORE) * 12)
  };
}

async function buildInfiniteOvertimeFloors(userId) {
  const { users, scoreMap } = await buildInfiniteOvertimeScoreMap();
  const allCards = getAllInfiniteOvertimeCards(0);
  const sortedCandidates = users
    .filter((entry) => String(entry._id) !== String(userId))
    .map((entry) => {
      ensureUserDefaults(entry);
      const scoreInfo = scoreMap.get(String(entry._id)) || {};
      const targetScore = Math.max(
        INFINITE_OVERTIME_DEFENSE_MIN_SCORE,
        Math.min(INFINITE_OVERTIME_DEFENSE_MAX_SCORE, Number(scoreInfo.targetScore || INFINITE_OVERTIME_DEFENSE_MIN_SCORE))
      );
      let deck = resolveInfiniteOvertimeOwnedEnhancements(entry, entry.infiniteOvertime?.defensePreset || []);
      const storedScore = getInfiniteOvertimeDeckScore(deck);
      if (
        deck.length !== 5
        || storedScore < INFINITE_OVERTIME_DEFENSE_MIN_SCORE
        || storedScore > INFINITE_OVERTIME_DEFENSE_MAX_SCORE
      ) {
        deck = generateInfiniteOvertimeDeckForScore(targetScore, allCards);
      }
      const score = getInfiniteOvertimeDeckScore(deck) || targetScore;
      return {
        defenderUserId: String(entry._id),
        defenderName: entry.nickname || entry.username || '익명',
        level: Number(entry.gameState?.level || 1),
        targetScore,
        score,
        deck
      };
    })
    .filter((entry) => entry.deck.length === 5)
    .sort((a, b) => a.score - b.score || a.level - b.level || a.defenderName.localeCompare(b.defenderName, 'ko'));
  const selectedCandidates = sortedCandidates.length <= INFINITE_OVERTIME_MAX_FLOOR
    ? sortedCandidates
    : Array.from({ length: INFINITE_OVERTIME_MAX_FLOOR }, (_, index) => {
        const sourceIndex = Math.round(index * ((sortedCandidates.length - 1) / (INFINITE_OVERTIME_MAX_FLOOR - 1)));
        return sortedCandidates[sourceIndex];
      });
  const floors = selectedCandidates.map((entry, index) => decorateInfiniteOvertimeFloor(entry, index));

  while (floors.length < INFINITE_OVERTIME_MAX_FLOOR) {
    const floor = floors.length + 1;
    const syntheticScore = Math.min(
      INFINITE_OVERTIME_DEFENSE_MAX_SCORE,
      INFINITE_OVERTIME_DEFENSE_MIN_SCORE + Math.floor((floor - 1) / 3)
    );
    floors.push(decorateInfiniteOvertimeFloor({
      defenderUserId: `synthetic:${floor}`,
      defenderName: `야근 ${floor}팀`,
      level: 1,
      targetScore: syntheticScore,
      score: syntheticScore,
      deck: generateInfiniteOvertimeDeckForScore(syntheticScore, allCards)
    }, floor - 1));
  }
  return floors;
}

async function getInfiniteOvertimeFloorInfo(userId, floor) {
  const floors = await buildInfiniteOvertimeFloors(userId);
  return floors[Math.max(0, Math.min(INFINITE_OVERTIME_MAX_FLOOR - 1, Number(floor || 1) - 1))] || floors[0];
}

function createInfiniteOvertimeBattleFromFloor(user, floorInfo, now = new Date()) {
  const userId = String(user._id);
  const attackDeck = resolveInfiniteOvertimeOwnedEnhancements(user, user.infiniteOvertime?.attackDeck || []);
  user.infiniteOvertime.attackDeck = attackDeck;
  const player = createPvpParticipantFromUser(user, { players: [{ userId }] }, attackDeck);
  const bot = createInfiniteOvertimeBotParticipant(floorInfo);
  const battle = {
    battleId: crypto.randomUUID(),
    mode: 'infinite_overtime',
    modeLabel: '무한야근',
    phase: 'active',
    floor: floorInfo.floor,
    floorScore: floorInfo.score,
    floorInfo,
    players: [player, bot],
    firstUserId: userId,
    currentUserId: userId,
    turnNumber: 1,
    turnEndsAt: null,
    logs: [`무한야근 ${floorInfo.floor}층 전투가 시작되었습니다.`],
    winnerUserId: null,
    loserUserId: null,
    finishedAt: null,
    rewardGranted: false,
    reward: null,
    swapOptions: [],
    swapResolved: false
  };
  applyPvpBattleStartPassives(battle);
  battle.createdAt = now;
  return battle;
}

function getInfiniteOvertimeBattle(userId) {
  return infiniteOvertimeState.battles[String(userId)] || null;
}

function setInfiniteOvertimeBattle(userId, battle) {
  if (battle) {
    infiniteOvertimeState.battles[String(userId)] = battle;
  } else {
    delete infiniteOvertimeState.battles[String(userId)];
  }
  bumpInfiniteOvertimeVersion();
}

function getInfiniteOvertimePlayer(battle) {
  return battle?.players?.find((player) => !player.isBot) || null;
}

function refreshInfiniteOvertimeBattlePlayerFromUser(user, battle) {
  const player = getInfiniteOvertimePlayer(battle);
  if (!user || !battle || !player) return;
  ensureUserDefaults(user);
  const resolvedDeck = resolveInfiniteOvertimeOwnedEnhancements(user, user.infiniteOvertime?.attackDeck || []);
  if (resolvedDeck.length !== 5) return;
  user.infiniteOvertime.attackDeck = resolvedDeck;
  const equippedEquipment = getEquippedEquipment(user);
  const equippedCardEffect = equippedEquipment?.equipmentType === EQUIPMENT_TYPE_CARD ? equippedEquipment : null;
  const equippedBasicAttack = equippedEquipment?.equipmentType === EQUIPMENT_TYPE_ATTACK ? equippedEquipment : null;
  player.cardEffectEquipmentBonusPercent = Number(equippedCardEffect?.statValue || 0) / 100;
  player.basicAttackEquipmentBonusPercent = Number(equippedBasicAttack?.statValue || 0) / 100;
  const previousCards = Array.isArray(player.cards) ? player.cards : [];
  player.cards = resolvedDeck.map((pick, index) => {
    const previous = previousCards[index]?.cardId === pick.cardId
      ? previousCards[index]
      : previousCards.find((entry) => entry.cardId === pick.cardId);
    return buildPvpCardSlotSnapshot(pick, index, previous);
  });
}

function getInfiniteOvertimeBot(battle) {
  return battle?.players?.find((player) => player.isBot) || null;
}

function buildInfiniteOvertimeReward(floor, rewardBonusPercent = 0) {
  const ratio = Math.max(0, Math.min(1, (Number(floor || 1) - 1) / Math.max(1, INFINITE_OVERTIME_MAX_FLOOR - 1)));
  const rewardTypes = [
    { type: 'fragment', itemId: 'equipment_fragment', min: 50, max: 400, label: '장비 파편' },
    { type: 'business_card', itemId: 'business_card', min: 5, max: 15, label: '명함' },
    { type: 'bacchus', itemId: 'bacchus', min: 5, max: 20, label: '박카스' },
    { type: 'raid_ticket', itemId: 'raid_entry_ticket', min: 1, max: 3, label: '회의 추가 입장권' }
  ];
  const picked = rewardTypes[Math.floor(Math.random() * rewardTypes.length)];
  const baseAmount = Math.max(1, Math.round(Number(picked.min || 1) + ((Number(picked.max || picked.min) - Number(picked.min || 1)) * ratio)));
  const rewardMultiplier = 1 + Math.max(0, Number(rewardBonusPercent || 0)) / 100;
  const amount = Math.max(1, Math.round(baseAmount * rewardMultiplier));
  return {
    ...picked,
    quantity: amount,
    text: `${picked.label} ${amount.toLocaleString()}개`
  };
}

function grantInfiniteOvertimeReward(user, battle) {
  if (!battle || battle.rewardGranted) return battle?.reward || null;
  const derivedStats = calculateDerivedStats(user);
  const reward = buildInfiniteOvertimeReward(battle.floor, derivedStats.infiniteOvertimeRewardBonusPercent);
  addItemToInventory(user, reward.itemId, reward.quantity);
  battle.reward = reward;
  battle.rewardGranted = true;
  queueNotification(user, 'infinite_overtime_reward', `무한야근 ${battle.floor}층 클리어! ${reward.text}를 획득했습니다.`);
  return reward;
}

function buildInfiniteOvertimeSwapOptions(user, currentDeck = []) {
  const currentIds = new Set(normalizeInfiniteOvertimeDeck(currentDeck).map((entry) => entry.cardId));
  const owned = getInfiniteOvertimeOwnedCards(user)
    .filter((entry) => !currentIds.has(entry.cardId));
  const selected = [];
  const gradeWeights = [
    { grade: 'S', weight: 10 },
    { grade: 'A', weight: 20 },
    { grade: 'B', weight: 30 },
    { grade: 'C', weight: 40 }
  ];

  while (selected.length < 3 && selected.length < owned.length) {
    const available = owned.filter((entry) => !selected.some((picked) => picked.cardId === entry.cardId));
    const totalWeight = gradeWeights.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;
    let targetGrade = 'C';
    for (const entry of gradeWeights) {
      roll -= entry.weight;
      if (roll <= 0) {
        targetGrade = entry.grade;
        break;
      }
    }
    const gradePool = available.filter((entry) => entry.grade === targetGrade);
    const pool = gradePool.length ? gradePool : available;
    selected.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return selected.slice(0, 3).map((entry) => ({
    cardId: entry.cardId,
    enhancementLevel: normalizeCardEnhancementLevel(entry.enhancementLevel || 0)
  }));
}

async function finishInfiniteOvertimeVictory(user, battle, options = {}) {
  if (!battle || battle.phase === 'defeat') return;
  if (!options.skipSwap && battle.floor % 3 === 0 && !battle.swapResolved && !battle.rewardGranted) {
    const swapOptions = buildInfiniteOvertimeSwapOptions(user, user.infiniteOvertime.attackDeck || []);
    if (swapOptions.length > 0) {
      battle.phase = 'swap';
      battle.swapOptions = swapOptions;
      battle.logs.push('카드 교환 이벤트가 발생했습니다.');
      return;
    }
    battle.swapResolved = true;
    battle.logs.push('교환 가능한 카드가 없어 카드 교환 이벤트를 건너뜁니다.');
  }

  const reward = grantInfiniteOvertimeReward(user, battle);
  const nextFloor = Math.min(INFINITE_OVERTIME_MAX_FLOOR, Number(battle.floor || 1) + 1);
  user.infiniteOvertime.active = Number(battle.floor || 1) < INFINITE_OVERTIME_MAX_FLOOR;
  user.infiniteOvertime.nextFloor = nextFloor;
  if (!user.infiniteOvertime.active) {
    user.infiniteOvertime.lastCompletedAt = new Date();
  }
  battle.phase = 'victory';
  battle.reward = reward;
  battle.finishedAt = new Date();
  battle.logs.push(Number(battle.floor || 1) >= INFINITE_OVERTIME_MAX_FLOOR
    ? '무한야근 최종 층을 클리어했습니다!'
    : `승리했습니다. 다음 도전은 ${nextFloor}층입니다.`);
}

function isInfiniteOvertimeBotSkillCandidateUsable(actor, target, battle, slotIndex) {
  const entry = actor?.cards?.[Number(slotIndex)];
  const card = getPvpCardDefinitionFromSlot(actor, slotIndex);
  if (!actor || !target || !battle || !entry || !card || card.passiveOnly) return false;
  if (Number(actor.actionLockTurns || 0) > 0) return false;

  const canResolveOvertime = card.effectType === 'overtime_rage'
    && (target.debuffs || []).some((debuff) => debuff.id === 'overtime' && debuff.sourceUserId === actor.userId);
  if (Number(entry.cooldownRemaining || 0) > 0 && !canResolveOvertime) return false;

  if (card.effectType === 'party_heal' || card.effectType === 'target_heal') {
    return Number(actor.hp || 0) < Number(actor.maxHp || PVP_MAX_HP);
  }
  if (card.effectType === 'party_cleanse') {
    return (actor.debuffs || []).some((debuff) => debuff.id !== 'overtime' || Number(debuff.count || 0) > 0 || Number(debuff.turns || 0) > 0);
  }
  if (card.effectType === 'remove_enemy_buff') {
    return (target.buffs || []).some((buff) => Number(buff.turns || 0) > 0 || Number(buff.count || 0) > 0 || Number(buff.value || 0) > 0);
  }
  if (card.effectType === 'party_cooldown_reduce') {
    return (actor.cards || []).some((cardEntry) => Number(cardEntry.cooldownRemaining || 0) > 0);
  }
  if (card.effectType === 'copy_ally_skill') {
    return (target.cards || []).some((targetEntry) => {
      const targetCard = getCardDefinition(targetEntry.cardId, targetEntry.enhancementLevel);
      return targetCard && !targetCard.passiveOnly && targetCard.id !== 'umbrella_copy';
    });
  }
  if (card.effectType === 'random_ally_sacrifice_buff') {
    return Number(actor.hp || 0) > Number(card.selfDamage || 0);
  }
  if (card.effectType === 'self_status_blast') {
    return ((actor.buffs || []).length + (actor.debuffs || []).length) > 0;
  }

  return true;
}

function executeInfiniteOvertimeSingleTurn(battle, actor, target, plannedIndex = null, options = {}) {
  if (!battle || !actor || !target || actor.hp <= 0 || target.hp <= 0) return;
  actor.lastHpLoss = 0;
  actor.lastShieldLoss = 0;
  target.lastHpLoss = 0;
  target.lastShieldLoss = 0;

  const actionLocked = Number(actor.actionLockTurns || 0) > 0;
  if (actionLocked) {
    battle.logs.push(`${actor.displayName}은(는) 행동 불가 상태라 아무 행동도 할 수 없습니다.`);
  } else if (!options.basicOnly && Number(plannedIndex) >= 0) {
    const used = applyPvpCardSkill(actor, target, battle, Number(plannedIndex));
    if (!used) {
      battle.logs.push(`${actor.displayName}의 스킬은 사용할 수 없어 기본 공격만 진행합니다.`);
    }
  } else if (options.botAutoSkill) {
    let usedSkill = false;
    for (let index = 0; index < (actor.cards || []).length; index += 1) {
      if (!isInfiniteOvertimeBotSkillCandidateUsable(actor, target, battle, index)) continue;
      const card = getPvpCardDefinitionFromSlot(actor, index);
      const canResolveOvertime = card?.effectType === 'overtime_rage'
        && (target.debuffs || []).some((debuff) => debuff.id === 'overtime' && debuff.sourceUserId === actor.userId);
      if (applyPvpCardSkill(actor, target, battle, index)) {
        const entry = actor.cards?.[index];
        if (
          entry
          && card
          && Number(card.cooldown || 0) > 0
          && Number(entry.cooldownRemaining || 0) <= 0
          && !(card.effectType === 'overtime_rage' && !canResolveOvertime)
        ) {
          entry.cooldownRemaining = Number(card.cooldown || 0);
        }
        battle.logs.push(`${actor.displayName}은 ${index + 1}번 스킬을 사용했습니다.`);
        usedSkill = true;
        break;
      }
    }
    if (!usedSkill) {
      battle.logs.push(`${actor.displayName}은(는) 사용할 수 있는 스킬이 없어 기본 공격을 진행합니다.`);
    }
  }

  if (!actionLocked && actor.hp > 0 && target.hp > 0 && actor.basicAttackLockTurns <= 0) {
    performPvpBasicAttack(actor, target, battle);
  } else if (!actionLocked && actor.basicAttackLockTurns > 0) {
    battle.logs.push(`${actor.displayName}은(는) 기본 공격을 할 수 없습니다.`);
  }
  tickPvpPlayerEndOfTurn(actor, battle);
  clearPvpShieldsExpiredByUserTurn(battle, actor.userId);
}

async function executeInfiniteOvertimePlayerAction(user, cardIndex = null, options = {}) {
  const userId = String(user._id);
  const battle = getInfiniteOvertimeBattle(userId);
  if (!battle || battle.phase !== 'active') throw createHttpError(400, '진행 중인 무한야근 전투가 없습니다.');
  refreshInfiniteOvertimeBattlePlayerFromUser(user, battle);
  const player = getInfiniteOvertimePlayer(battle);
  const bot = getInfiniteOvertimeBot(battle);
  if (!player || !bot) throw createHttpError(400, '전투 정보를 찾을 수 없습니다.');

  executeInfiniteOvertimeSingleTurn(battle, player, bot, Number.isInteger(cardIndex) ? cardIndex : null, { basicOnly: Boolean(options.basicOnly) });
  if (bot.hp <= 0) {
    battle.winnerUserId = player.userId;
    battle.phase = 'victory_pending';
    await finishInfiniteOvertimeVictory(user, battle);
    return battle;
  }
  if (player.hp <= 0) {
    battle.winnerUserId = bot.userId;
    battle.loserUserId = player.userId;
    battle.phase = 'defeat';
    user.infiniteOvertime.active = false;
    battle.logs.push('패배했습니다. 이번 무한야근 도전은 종료됩니다.');
    return battle;
  }

  battle.currentUserId = bot.userId;
  executeInfiniteOvertimeSingleTurn(battle, bot, player, null, { botAutoSkill: true });
  battle.turnNumber = Number(battle.turnNumber || 1) + 1;
  battle.currentUserId = player.userId;
  if (bot.hp <= 0) {
    battle.winnerUserId = player.userId;
    battle.phase = 'victory_pending';
    await finishInfiniteOvertimeVictory(user, battle);
    return battle;
  }
  if (player.hp <= 0) {
    battle.winnerUserId = bot.userId;
    battle.loserUserId = player.userId;
    battle.phase = 'defeat';
    user.infiniteOvertime.active = false;
    battle.logs.push('패배했습니다. 이번 무한야근 도전은 종료됩니다.');
  }
  return battle;
}

function getInfiniteOvertimeCooldownRemainingMs(user, now = new Date()) {
  if (user?.infiniteOvertime?.active) return 0;
  const lastAttemptAt = user?.infiniteOvertime?.lastAttemptAt
    ? new Date(user.infiniteOvertime.lastAttemptAt).getTime()
    : 0;
  if (!lastAttemptAt) return 0;
  return Math.max(0, (lastAttemptAt + INFINITE_OVERTIME_COOLDOWN_MS) - now.getTime());
}

function buildInfiniteOvertimeBattleSnapshot(battle, viewerUserId = null) {
  if (!battle) return null;
  return {
    battleId: battle.battleId,
    mode: 'infinite_overtime',
    modeLabel: '무한야근',
    phase: battle.phase,
    floor: battle.floor,
    floorScore: battle.floorScore,
    floorInfo: battle.floorInfo ? {
      floor: battle.floorInfo.floor,
      defenderName: battle.floorInfo.defenderName,
      score: battle.floorInfo.score,
      botLevel: battle.floorInfo.botLevel,
      botMaxHp: battle.floorInfo.botMaxHp,
      deck: formatInfiniteOvertimeDeck(battle.floorInfo.deck || [])
    } : null,
    currentUserId: battle.currentUserId,
    firstUserId: battle.firstUserId,
    turnNumber: battle.turnNumber,
    winnerUserId: battle.winnerUserId,
    loserUserId: battle.loserUserId,
    finishedAt: battle.finishedAt,
    reward: battle.reward || null,
    swapOptions: formatInfiniteOvertimeDeck(battle.swapOptions || []),
    swapResolved: Boolean(battle.swapResolved),
    isParticipant: Boolean(viewerUserId && battle.players?.some((player) => player.userId === String(viewerUserId))),
    players: (battle.players || []).map((player) => ({
      userId: player.userId,
      displayName: player.displayName,
      isSelf: viewerUserId ? player.userId === String(viewerUserId) : false,
      isBot: Boolean(player.isBot),
      hp: player.hp,
      maxHp: player.maxHp,
      shield: player.shield,
      lastHpLoss: player.lastHpLoss || 0,
      lastShieldLoss: player.lastShieldLoss || 0,
      plannedCardIndex: Number.isInteger(player.plannedCardIndex) ? player.plannedCardIndex : null,
      statusEffects: buildPvpEffectsSnapshot(player),
      cards: (player.cards || []).map((card, index) => ({
        ...card,
        slotIndex: index,
        cooldownRemaining: Number(card.cooldownRemaining || 0)
      }))
    })),
    recentLogs: (battle.logs || []).slice(-20).reverse()
  };
}

async function buildInfiniteOvertimeStateResponse(user, now = new Date()) {
  ensureUserDefaults(user);
  const userId = String(user._id);
  const { scoreMap } = await buildInfiniteOvertimeScoreMap();
  const scoreInfo = scoreMap.get(userId) || {};
  const targetScore = getInfiniteOvertimeDefenseScoreFromRanks(scoreInfo.pvpRank, scoreInfo.levelRank);
  const battle = getInfiniteOvertimeBattle(userId);
  if (battle) refreshInfiniteOvertimeBattlePlayerFromUser(user, battle);
  const cooldownRemainingMs = getInfiniteOvertimeCooldownRemainingMs(user, now);
  const defensePreset = resolveInfiniteOvertimeOwnedEnhancements(user, user.infiniteOvertime?.defensePreset || []);
  const attackDeck = normalizeInfiniteOvertimeDeck(user.infiniteOvertime?.attackDeck || []);
  const locked = Number(user.gameState?.level || 1) < INFINITE_OVERTIME_MIN_LEVEL;

  let stage = 'attack_setup';
  if (locked) stage = 'locked';
  else if (battle) stage = battle.phase || 'battle';
  else if (defensePreset.length !== 5) stage = 'defense_setup';
  else if (user.infiniteOvertime?.active && attackDeck.length === 5) stage = 'ready';
  else if (cooldownRemainingMs > 0) stage = 'cooldown';
  const attackDraft = stage === 'attack_setup' ? buildInfiniteOvertimeAttackDraftSnapshot(user) : null;

  return {
    version: infiniteOvertimeState.version,
    serverNow: now.toISOString(),
    stage,
    locked,
    minLevel: INFINITE_OVERTIME_MIN_LEVEL,
    maxFloor: INFINITE_OVERTIME_MAX_FLOOR,
    cooldownMs: INFINITE_OVERTIME_COOLDOWN_MS,
    cooldownRemainingMs,
    targetScore,
    scoreInfo: {
      pvpRank: scoreInfo.pvpRank || null,
      levelRank: scoreInfo.levelRank || null
    },
    defenseScore: getInfiniteOvertimeDeckScore(defensePreset),
    defensePreset: formatInfiniteOvertimeDeck(defensePreset),
    defenseOptions: getInfiniteOvertimeOwnedCards(user),
    ownedCards: getInfiniteOvertimeOwnedCards(user),
    attackDeck: formatInfiniteOvertimeDeck(attackDeck),
    attackDraft,
    active: Boolean(user.infiniteOvertime?.active),
    nextFloor: Math.max(1, Math.min(INFINITE_OVERTIME_MAX_FLOOR, Number(user.infiniteOvertime?.nextFloor || 1))),
    battle: buildInfiniteOvertimeBattleSnapshot(battle, userId)
  };
}

async function buildInfiniteOvertimeUserPayload(user, now = new Date()) {
  const response = await buildUserResponseWithGlobals(user, now);
  response.infiniteOvertime = await buildInfiniteOvertimeStateResponse(user, now);
  return response;
}

function validateInfiniteOvertimeDefenseDeck(user, deck, targetScore) {
  const normalized = normalizeInfiniteOvertimeDeck(deck);
  if (normalized.length !== 5) {
    throw createHttpError(400, '방어 Bot 프리셋은 카드 5장으로 구성해야 합니다.');
  }
  const ownedMap = new Map(getInfiniteOvertimeOwnedCards(user).map((card) => [card.cardId, card]));
  const resolved = normalized.map((entry) => {
    const owned = ownedMap.get(entry.cardId);
    if (!owned) {
      throw createHttpError(400, '방어 Bot에는 보유 중인 카드만 등록할 수 있습니다.');
    }
    return {
      cardId: entry.cardId,
      enhancementLevel: normalizeCardEnhancementLevel(owned.enhancementLevel || 0)
    };
  });
  const score = getInfiniteOvertimeDeckScore(resolved);
  if (score !== Number(targetScore)) {
    throw createHttpError(400, `현재 배정 점수는 ${targetScore}점입니다. 정확히 ${targetScore}점으로 구성해주세요.`);
  }
  return resolved;
}

function validateInfiniteOvertimeAttackDeck(user, deck) {
  const normalized = normalizeInfiniteOvertimeDeck(deck);
  if (normalized.length !== 5) {
    throw createHttpError(400, '공략용 카드는 5장을 선택해야 합니다.');
  }
  const ownedMap = new Map(getInfiniteOvertimeOwnedCards(user).map((card) => [card.cardId, card]));
  const validated = normalized.map((entry) => {
    const owned = ownedMap.get(entry.cardId);
    if (!owned) {
      throw createHttpError(400, '보유 중인 카드만 선택할 수 있습니다.');
    }
    return {
      cardId: entry.cardId,
      enhancementLevel: normalizeCardEnhancementLevel(owned.enhancementLevel || 0)
    };
  });
  return validated;
}

async function startInfiniteOvertimeBattleForUser(user, floor, now = new Date()) {
  const floorInfo = await getInfiniteOvertimeFloorInfo(user._id, floor);
  const battle = createInfiniteOvertimeBattleFromFloor(user, floorInfo, now);
  setInfiniteOvertimeBattle(user._id, battle);
  return battle;
}

function addPvpBuff(player, buff) {
  const existing = player.buffs.find((entry) => entry.id === buff.id);
  if (existing && (Number(existing.count || 0) > 0 || Number(buff.count || 0) > 0)) {
    existing.count = Number(existing.count || 0) + Number(buff.count || 0);
    existing.turns = Math.max(Number(existing.turns || 0), Number(buff.turns || 0));
    return existing;
  }
  if (existing && !buff.stackDistinct) {
    existing.turns = Math.max(Number(existing.turns || 0), Number(buff.turns || 0));
    existing.value = Math.max(Number(existing.value || 0), Number(buff.value || 0));
    existing.desc = buff.desc || existing.desc;
    return existing;
  }
  player.buffs.push({ ...buff });
  return buff;
}

function addPvpDebuff(target, debuff, source, battle) {
  const selfEsteem = target.buffs.find((buff) => buff.id === 'self_esteem' && Number(buff.count || 0) > 0);
  if (selfEsteem && source) {
    selfEsteem.count -= 1;
    if (selfEsteem.count <= 0) {
      target.buffs = target.buffs.filter((buff) => buff !== selfEsteem);
    }
    source.debuffs.push({ ...debuff });
    battle.logs.push(`${target.displayName}의 자존감이 ${debuff.name} 디버프를 ${source.displayName}에게 반사했습니다.`);
    return false;
  }

  const guard = target.buffs.find((buff) => buff.id === 'debuff_guard' && Number(buff.count || 0) > 0);
  if (guard) {
    guard.count -= 1;
    if (guard.count <= 0) target.buffs = target.buffs.filter((buff) => buff !== guard);
    battle.logs.push(`${target.displayName}이(가) 디버프를 막아냈습니다.`);
    return false;
  }

  target.debuffs.push({ ...debuff });
  return true;
}

function getPvpBuffValue(player, id, fallback = 0) {
  return player.buffs
    .filter((buff) => buff.id === id)
    .reduce((max, buff) => Math.max(max, Number(buff.value || fallback)), fallback);
}

function getPvpAugmentEffectSum(player, key) {
  return (player?.augmentIds || [])
    .reduce((sum, augmentId) => sum + Number(PVP_AUGMENT_DATA[augmentId]?.effects?.[key] || 0), 0);
}

function getPvpAttackBonus(player) {
  return Number(player.augmentAttackBonus || 0) + player.buffs
    .filter((buff) => ['attack_bonus', 'celine', 'damage_multiplier', 'champion_guard'].includes(buff.id) && !buff.pendingActivation)
    .reduce((sum, buff) => {
      if (buff.id === 'damage_multiplier') return sum + (Number(buff.value || 1) - 1);
      return sum + Number(buff.value || 0);
    }, 0);
}

function getPvpFinalDamageBonus(player) {
  return (player?.buffs || [])
    .filter((buff) => buff.id === 'final_damage_bonus' && !buff.pendingActivation)
    .reduce((sum, buff) => sum + Math.max(0, Number(buff.value || 0)), 0);
}

function applyPvpOutgoingDamageBonus(player, amount) {
  const bonus = getPvpFinalDamageBonus(player);
  const baseAmount = Math.max(0, Math.floor(Number(amount || 0)));
  return bonus > 0 ? Math.max(0, Math.floor(baseAmount * (1 + bonus))) : baseAmount;
}

function getPvpEffectiveLevel(player) {
  const subordinateBonus = (player.buffs || [])
    .filter((buff) => buff.id === 'subordinate_level' && !buff.pendingActivation)
    .reduce((max, buff) => Math.max(max, Number(buff.value || 0)), 0);
  const baseLevel = Number.isFinite(Number(player.attackLevel))
    ? Math.max(1, Number(player.attackLevel))
    : Number(player.level || 1);
  return baseLevel + subordinateBonus;
}

function getPvpCardEffectMultiplier(player) {
  const equipmentMultiplier = 1 + Number(player.cardEffectEquipmentBonusPercent || 0);
  const ampBuff = getPvpBuffValue(player, 'rotation_amp_passive', 1);
  return equipmentMultiplier * Math.max(1, ampBuff);
}

function consumePvpBreadBuff(target, battle) {
  if (!target || !battle || target.hp <= 0) return 0;
  const breadBuff = (target.buffs || []).find((buff) => buff.id === 'bread' && Number(buff.count || 0) > 0);
  if (!breadBuff) return 0;
  breadBuff.count = Math.max(0, Number(breadBuff.count || 0) - 1);
  if (breadBuff.count <= 0) target.buffs = target.buffs.filter((buff) => buff !== breadBuff);
  const healed = healPvpTarget(target, Number(breadBuff.heal || 5));
  battle.logs.push(`${target.displayName}의 <빵>이 발동해 HP ${healed.toLocaleString()}를 회복했습니다.`);
  return healed;
}

function applyPvpDamage(target, amount, battle, options = {}) {
  if (!target || target.hp <= 0) return 0;
  const negateBuff = target.buffs.find((buff) => ['solid_mental_negate_hit', 'negate_hit'].includes(buff.id) && Number(buff.count || 0) > 0);
  if (!options.ignoreNegate && negateBuff) {
    negateBuff.count -= 1;
    if (negateBuff.count <= 0) target.buffs = target.buffs.filter((buff) => buff !== negateBuff);
    target.lastHpLoss = 0;
    target.lastShieldLoss = 0;
    battle.logs.push(`${target.displayName}의 피격 무효가 공격을 막았습니다.`);
    return 0;
  }

  let remaining = Math.max(0, Math.floor(Number(amount || 0)));
  if (Number(target.augmentDamageTakenBonus || 0) > 0) {
    remaining = Math.floor(remaining * (1 + Number(target.augmentDamageTakenBonus || 0)));
  }
  const augmentDamageReduction = getPvpAugmentEffectSum(target, 'damageReduction');
  if (augmentDamageReduction > 0) {
    remaining = Math.floor(remaining * (1 - Math.max(0, Math.min(0.95, augmentDamageReduction))));
  }
  const tauntReduction = target.buffs
    .filter((buff) => buff.id === 'taunt_damage_reduction' && !buff.pendingActivation)
    .reduce((max, buff) => Math.max(max, Number(buff.value || 0)), 0);
  if (tauntReduction > 0) {
    remaining = Math.floor(remaining * (1 - Math.max(0, Math.min(0.95, tauntReduction))));
  }
  let shieldLoss = 0;
  if (!options.ignoreShield && Number(target.shield || 0) > 0) {
    shieldLoss = Math.min(Number(target.shield || 0), remaining);
    target.shield -= shieldLoss;
    remaining -= shieldLoss;
    if (Number(target.tempShieldAmount || 0) > 0) {
      target.tempShieldAmount = Math.max(0, Number(target.tempShieldAmount || 0) - shieldLoss);
      if (target.tempShieldAmount <= 0) target.shieldExpiresAfterUserId = null;
    }
  }
  const beforeHp = Number(target.hp || 0);
  if (remaining >= beforeHp && Number(target.augmentDeathCheat || 0) > 0 && !options.ignoreNegate) {
    target.augmentDeathCheat -= 1;
    const deathCheatHeal = getPvpAugmentEffectSum(target, 'deathCheatHeal');
    target.hp = Math.min(Number(target.maxHp || PVP_MAX_HP), 1 + Math.max(0, Math.floor(deathCheatHeal)));
    target.lastHpLoss = Math.max(0, beforeHp - target.hp);
    target.lastShieldLoss = shieldLoss;
    battle.logs.push(`${target.displayName}이(가) <철야 멘탈>로 쓰러지지 않고 버텼습니다.`);
    return target.lastHpLoss;
  }
  target.hp = Math.max(0, beforeHp - remaining);
  target.lastHpLoss = remaining;
  target.lastShieldLoss = shieldLoss;
  const lowHpShield = getPvpAugmentEffectSum(target, 'lowHpShieldOnce');
  if (
    lowHpShield > 0
    && !target.augmentLowHpShieldUsed
    && target.hp > 0
    && target.hp <= Math.floor(Number(target.maxHp || PVP_MAX_HP) * 0.4)
  ) {
    target.augmentLowHpShieldUsed = true;
    grantPvpTemporaryShield(target, lowHpShield, target.userId, battle);
    battle.logs.push(`${target.displayName}의 위기 대응 증강이 보호막 ${Number(lowHpShield).toLocaleString()}을 부여했습니다.`);
  }
  if (!options.skipBread && battle && (shieldLoss > 0 || remaining > 0)) {
    consumePvpBreadBuff(target, battle);
  }
  return remaining;
}

function triggerPvpThorns(defender, attacker, battle) {
  if (!defender || !attacker || !battle || defender.hp <= 0 || attacker.hp <= 0) return 0;
  const thornsDamage = Math.max(0, Math.floor(getPvpAugmentEffectSum(defender, 'thornsDamage')));
  if (thornsDamage <= 0) return 0;
  const reflected = applyPvpDamage(attacker, thornsDamage, battle, { ignoreNegate: true, skipBread: true });
  if (reflected > 0) {
    battle.logs.push(`${defender.displayName}의 가시 증강이 ${attacker.displayName}에게 ${reflected.toLocaleString()} 반사 피해를 입혔습니다.`);
  }
  return reflected;
}

function healPvpTarget(target, amount) {
  const previousHp = Number(target.hp || 0);
  const healReduction = (target.debuffs || [])
    .filter((debuff) => debuff.id === 'heal_reduction')
    .reduce((max, debuff) => Math.max(max, Number(debuff.value || 0)), 0);
  const effectiveAmount = Math.max(
    0,
    Math.floor(Number(amount || 0) * (1 - Math.max(0, Math.min(0.95, healReduction))))
  );
  target.hp = Math.min(Number(target.maxHp || PVP_MAX_HP), previousHp + effectiveAmount);
  return Number(target.hp || 0) - previousHp;
}

function getPvpTurnSerial(battle) {
  if (!battle) return -1;
  return (Number(battle.roundNumber || battle.turnNumber || 1) * 100) + Number(battle.turnCursor || 0);
}

function grantPvpTemporaryShield(target, amount, expiresAfterUserId, battle = null) {
  if (!target || target.hp <= 0) return 0;
  const shieldAmount = Math.max(0, Math.floor(Number(amount || 0)));
  if (shieldAmount <= 0) return 0;
  target.shield = Number(target.shield || 0) + shieldAmount;
  target.tempShieldAmount = Number(target.tempShieldAmount || 0) + shieldAmount;
  target.shieldExpiresAfterUserId = String(expiresAfterUserId || target.userId || '');
  target.shieldGrantedTurnSerial = getPvpTurnSerial(battle);
  return shieldAmount;
}

function clearPvpShieldsExpiredByUserTurn(battle, userId) {
  if (!battle?.players?.length) return;
  battle.players.forEach((player) => {
    if (player.shieldExpiresAfterUserId !== String(userId)) return;
    if (Number(player.shieldGrantedTurnSerial ?? -1) === getPvpTurnSerial(battle)) return;
    const remainingTempShield = Number(player.tempShieldAmount || 0);
    if (remainingTempShield > 0) {
      player.shield = Math.max(0, Number(player.shield || 0) - remainingTempShield);
    }
    player.tempShieldAmount = 0;
    player.shieldExpiresAfterUserId = null;
    player.shieldGrantedTurnSerial = null;
  });
}

function triggerPvpPoisonOnAttack(actor, battle) {
  if (!actor || actor.hp <= 0 || !battle) return 0;
  const poisonDebuffs = (actor.debuffs || []).filter((debuff) => debuff.id === 'poison');
  if (!poisonDebuffs.length) return 0;
  let totalDamage = 0;
  poisonDebuffs.forEach((debuff) => {
    const damage = Math.max(1, Math.floor(Number(debuff.sourceLevel || 1) * Number(debuff.damagePerLevel || 10)));
    if (damage > 0) {
      const dealt = applyPvpDamage(actor, damage, battle, { skipBread: true });
      totalDamage += dealt;
      if (dealt > 0) {
        battle.logs.push(`${actor.displayName}이(가) 중독으로 ${dealt.toLocaleString()} 피해를 입었습니다.`);
      }
    }
  });
  return totalDamage;
}

function getPvpCardDefinitionFromSlot(player, slotIndex) {
  const cardEntry = player.cards?.[Number(slotIndex)];
  if (!cardEntry) return null;
  return getCardDefinition(cardEntry.cardId, cardEntry.enhancementLevel || 0);
}

function removeRandomPvpBuff(target, removeCount = 1) {
  const removable = target.buffs.filter(Boolean);
  if (!removable.length) return null;
  const buff = removable[Math.floor(Math.random() * removable.length)];
  const count = Math.max(1, Number(removeCount || 1));
  if (Number(buff.count || 0) > 0) {
    buff.count -= count;
    if (buff.count <= 0) target.buffs = target.buffs.filter((entry) => entry !== buff);
  } else {
    target.buffs = target.buffs.filter((entry) => entry !== buff);
  }
  return buff.name;
}

function incrementPvpOvertimeRageStacks(target) {
  (target?.debuffs || [])
    .filter((debuff) => debuff.id === 'overtime')
    .forEach((debuff) => {
      debuff.count = Math.max(0, Number(debuff.count || 0)) + 1;
      debuff.desc = `기본 공격에 피격될 때마다 내면의 분노가 쌓입니다. 현재 ${Number(debuff.count || 0).toLocaleString()}스택`;
    });
}

function startPvpOvertimeCooldownForSource(battle, sourceUserId) {
  const source = getPvpPlayer(battle, sourceUserId);
  if (!source?.cards?.length) return false;
  const cardEntry = source.cards.find((entry) => entry.cardId === 'hoi_overtime');
  if (!cardEntry) return false;
  const card = getCardDefinition(cardEntry.cardId, cardEntry.enhancementLevel);
  cardEntry.cooldownRemaining = Math.max(
    Number(cardEntry.cooldownRemaining || 0),
    Number(card?.cooldown || 0)
  );
  return true;
}

function handlePvpRemovedDebuffs(player, removedDebuffs = [], battle) {
  if (!player || !battle || !removedDebuffs.length) return;
  const overtimeSourceIds = [...new Set(
    removedDebuffs
      .filter((debuff) => debuff?.id === 'overtime' && debuff.sourceUserId)
      .map((debuff) => String(debuff.sourceUserId))
  )];
  overtimeSourceIds.forEach((sourceUserId) => {
    if (startPvpOvertimeCooldownForSource(battle, sourceUserId)) {
      battle.logs.push(`${player.displayName}의 야근 디버프가 해제되어 호이의 매일하는 야근 쿨타임이 시작되었습니다.`);
    }
  });
}

function clearPvpDebuffs(player, battle) {
  const removedDebuffs = Array.isArray(player?.debuffs) ? [...player.debuffs] : [];
  if (!player) return [];
  player.debuffs = [];
  handlePvpRemovedDebuffs(player, removedDebuffs, battle);
  return removedDebuffs;
}

function applyPvpCardSkill(actor, target, battle, slotIndex, options = {}) {
  const card = options.cardOverride || getPvpCardDefinitionFromSlot(actor, slotIndex);
  const cardEntry = actor.cards?.[Number(slotIndex)];
  if (!card || card.passiveOnly) return false;
  const canResolveOvertime = card.effectType === 'overtime_rage'
    && (target.debuffs || []).some((debuff) => debuff.id === 'overtime' && debuff.sourceUserId === actor.userId);
  if (!options.ignoreCooldown && !canResolveOvertime && cardEntry && Number(cardEntry.cooldownRemaining || 0) > 0) return false;
  if (actor.actionLockTurns > 0) return false;

  const valueMultiplier = getPvpCardEffectMultiplier(actor) * Number(options.effectMultiplier || 1);
  const scaleFlat = (value) => Math.max(0, Math.floor(Number(value || 0) * valueMultiplier));
  const scalePercent = (value) => Number((Number(value || 0) * valueMultiplier).toFixed(4));
  const scaleCount = (value) => Math.max(1, Math.ceil(Number(value || 0) * Number(options.effectMultiplier || 1)));
  const cardLabel = card.name || card.displayName || card.skillName;
  const friendlyTarget = target && (target.userId === actor.userId || (target.team && actor.team && target.team === actor.team))
    ? target
    : actor;
  const isAugmentBattle = isAugmentPvpMode(battle?.mode);
  const friendlyTargets = isAugmentBattle
    ? getAliveAugmentTargets(getAugmentTeamPlayers(battle, actor.team))
    : [friendlyTarget].filter(Boolean);
  const enemyTargets = isAugmentBattle
    ? getAliveAugmentTargets(getAugmentEnemyPlayers(battle, actor.team))
    : [target].filter(Boolean);

  battle.logs.push(`${actor.displayName}이(가) ${cardLabel} 스킬을 사용했습니다.`);

  if (card.effectType === 'self_debuff_reflect') {
    addPvpBuff(actor, {
      id: 'self_esteem',
      name: '자존감',
      count: Number(card.selfEsteemCount || 1),
      desc: '다음 디버프를 상대에게 반사합니다.'
    });
  } else if (card.effectType === 'remove_enemy_buff') {
    const removed = removeRandomPvpBuff(target, card.removeBuffCount || 1);
    battle.logs.push(removed ? `${target.displayName}의 ${removed} 버프가 제거되었습니다.` : `${target.displayName}에게 제거할 버프가 없습니다.`);
  } else if (card.effectType === 'self_multi_hit') {
    if (isAugmentBattle && target && target.team !== actor.team) {
      performPvpBasicAttack(actor, target, battle, {
        baseHitCount: scaleCount(card.hits),
        hitMultiplier: 0.9,
        randomizeEachHitTarget: true,
        targetPool: enemyTargets
      });
    } else {
      actor.extraHits = Math.max(Number(actor.extraHits || 0), scaleCount(card.hits) - 1);
      actor.multiHitDamageMultiplier = 0.9;
    }
  } else if (card.effectType === 'self_fixed_multi_hit') {
    const hits = Math.max(1, Number(card.hits || 1));
    const damage = Math.max(1, scaleFlat(getPvpEffectiveLevel(actor) * Number(card.damagePerLevel || 0) * 0.9));
    for (let index = 0; index < hits; index += 1) {
      const fixedTargets = isAugmentBattle ? enemyTargets.filter((entry) => entry && entry.hp > 0) : [target].filter(Boolean);
      if (!fixedTargets.length) break;
      for (const fixedTarget of fixedTargets) {
        if (!fixedTarget || fixedTarget.hp <= 0) continue;
        if (isPvpAttackMissed(actor, battle, `${cardLabel} ${index + 1}타`)) {
          triggerPvpPoisonOnAttack(actor, battle);
          continue;
        }
        const outgoingDamage = applyPvpOutgoingDamageBonus(actor, damage);
        applyPvpDamage(fixedTarget, outgoingDamage, battle);
        battle.logs.push(`${cardLabel} ${index + 1}타! ${fixedTarget.displayName}에게 ${outgoingDamage.toLocaleString()} 피해를 입혔습니다.`);
        triggerPvpPoisonOnAttack(actor, battle);
        if (fixedTarget.hp > 0) performPvpCounterAttack(fixedTarget, actor, battle);
        if (actor.hp <= 0) break;
      }
      if (actor.hp <= 0) break;
    }
  } else if (card.effectType === 'party_level_blast') {
    const levelSource = isAugmentBattle ? getAugmentTeamPlayers(battle, actor.team) : battle.players;
    const totalLevels = levelSource.reduce((sum, player) => sum + getPvpEffectiveLevel(player), 0);
    const damage = applyPvpOutgoingDamageBonus(actor, scaleFlat(totalLevels * Number(card.multiplierPerLevel || 0)));
    if (!isPvpAttackMissed(actor, battle, cardLabel)) {
      applyPvpDamage(target, damage, battle);
      battle.logs.push(`${target.displayName}에게 ${damage.toLocaleString()} 피해를 입혔습니다.`);
      triggerPvpPoisonOnAttack(actor, battle);
    }
  } else if (card.effectType === 'direct_hp_strike') {
    const damage = applyPvpOutgoingDamageBonus(actor, scaleFlat(getPvpEffectiveLevel(actor) * Number(card.multiplierPerLevel || 0)));
    if (!isPvpAttackMissed(actor, battle, cardLabel)) {
      applyPvpDamage(target, damage, battle, { ignoreShield: true });
      battle.logs.push(`${target.displayName}의 보호막을 무시하고 ${damage.toLocaleString()} 피해를 입혔습니다.`);
      triggerPvpPoisonOnAttack(actor, battle);
    }
  } else if (card.effectType === 'party_hype_crit') {
    friendlyTargets.forEach((ally) => {
      addPvpBuff(ally, { id: 'crit_bonus', name: '크리티컬 상승', turns: Number(card.turns || 1), value: scalePercent(card.critBonus), desc: `치명타 확률 +${Math.round(scalePercent(card.critBonus) * 100)}%` });
      addPvpBuff(ally, { id: 'hype', name: '흥겨움', turns: Number(card.hypeTurns || 1), desc: '기본 공격 횟수 2배' });
      grantPvpTemporaryShield(ally, scaleFlat(card.shield || 0), ally.userId, battle);
    });
  } else if (card.effectType === 'party_shield' || card.effectType === 'random_shield') {
    if (card.effectType === 'party_shield' && isAugmentBattle) {
      friendlyTargets.forEach((ally) => grantPvpTemporaryShield(ally, scaleFlat(card.shield || 0), ally.userId, battle));
    } else if (card.effectType === 'random_shield' && isAugmentBattle) {
      const targetCount = Math.max(1, Math.min(friendlyTargets.length, Math.floor(Number(card.targets || 1))));
      const shieldTargets = [...friendlyTargets].sort(() => Math.random() - 0.5).slice(0, targetCount);
      shieldTargets.forEach((ally) => grantPvpTemporaryShield(ally, scaleFlat(card.shield || 0), ally.userId, battle));
      battle.logs.push(`${actor.displayName}이(가) 팀원 ${shieldTargets.length}명에게 보호막을 부여했습니다.`);
    } else {
      grantPvpTemporaryShield(friendlyTarget, scaleFlat(card.shield || 0), friendlyTarget.userId, battle);
    }
  } else if (card.effectType === 'party_heal' || card.effectType === 'target_heal') {
    if (card.effectType === 'party_heal' && isAugmentBattle) {
      const totalHealed = friendlyTargets.reduce((sum, ally) => sum + healPvpTarget(ally, scaleFlat(card.heal || 0)), 0);
      battle.logs.push(`${actor.displayName}의 팀 HP가 총 ${totalHealed.toLocaleString()} 회복되었습니다.`);
    } else {
      const healed = healPvpTarget(friendlyTarget, scaleFlat(card.heal || 0));
      battle.logs.push(`${friendlyTarget.displayName}의 HP가 ${healed.toLocaleString()} 회복되었습니다.`);
    }
  } else if (card.effectType === 'party_crit_bonus') {
    friendlyTargets.forEach((ally) => {
      addPvpBuff(ally, { id: 'crit_bonus', name: '크리티컬 상승', turns: Number(card.turns || 1), value: scalePercent(card.critBonus), desc: `치명타 확률 +${Math.round(scalePercent(card.critBonus) * 100)}%` });
    });
  } else if (card.effectType === 'self_celine_buff') {
    addPvpBuff(actor, { id: 'celine', name: '셀린느', turns: Number(card.turns || 1), value: scalePercent(card.attackBonusPercent), expireDamage: scaleFlat(getPvpEffectiveLevel(actor) * Number(card.expireDamagePerLevel || 0)), desc: `공격력 +${Math.round(scalePercent(card.attackBonusPercent) * 100)}%, 종료 시 피해` });
  } else if (card.effectType === 'self_counter') {
    addPvpBuff(actor, { id: 'counter', name: '반격', turns: Number(card.turns || 1) + 1, value: Number(card.counterDamageMultiplier || 1), desc: '피격 시 반격' });
    battle.logs.push(`${actor.displayName}이(가) ${Number(card.turns || 1)}턴 동안 반격 태세에 들어갔습니다.`);
  } else if (card.effectType === 'random_ally_sacrifice_buff') {
    const sacrificeTarget = isAugmentBattle && friendlyTargets.length
      ? pickRandomEntry(friendlyTargets)
      : actor;
    const selfDamage = applyPvpDamage(sacrificeTarget, Number(card.selfDamage || 0), battle, { ignoreNegate: true, skipBread: true });
    const damageMultiplier = Number(card.damageMultiplier || 2);
    addPvpBuff(sacrificeTarget, {
      id: 'damage_multiplier',
      name: '피해 증폭',
      turns: 1,
      value: damageMultiplier,
      pendingActivation: true,
      desc: `다음 자신의 공격 피해 x${damageMultiplier.toFixed(1)}`
    });
    battle.logs.push(`${sacrificeTarget.displayName}의 HP가 ${selfDamage.toLocaleString()} 감소하고, 다음 자신의 공격 피해가 ${damageMultiplier.toFixed(1)}배가 됩니다.`);
  } else if (card.effectType === 'target_missing_hp_heal') {
    const missingHp = Math.max(0, Number(friendlyTarget.maxHp || PVP_MAX_HP) - Number(friendlyTarget.hp || 0));
    const healed = healPvpTarget(friendlyTarget, Math.floor(missingHp * Math.max(0, scalePercent(card.healMissingHpPercent))));
    battle.logs.push(`${actor.displayName}의 HP가 ${healed.toLocaleString()} 회복되었습니다.`);
  } else if (card.effectType === 'party_missing_hp_heal_negate') {
    const healTargets = isAugmentBattle ? friendlyTargets : [actor];
    const percent = Math.max(0, scalePercent(card.healMissingHpPercent));
    const flatHeal = scaleFlat(card.healFlat || 0);
    const negateCount = scaleCount(card.negateHitCount || 1);
    let totalHealed = 0;
    healTargets.forEach((ally) => {
      const missingHp = Math.max(0, Number(ally.maxHp || PVP_MAX_HP) - Number(ally.hp || 0));
      totalHealed += healPvpTarget(ally, flatHeal + Math.floor(missingHp * percent));
      addPvpBuff(ally, { id: 'negate_hit', name: '피격 무효', count: negateCount, desc: '피격 무효' });
    });
    battle.logs.push(`${actor.displayName}이(가) 파티 HP를 총 ${totalHealed.toLocaleString()} 회복시키고 피격 무효 ${negateCount}회를 부여했습니다.`);
  } else if (card.effectType === 'target_taunt_damage_reduction') {
    const reduction = Math.max(0, Math.min(0.95, scalePercent(card.damageReductionPercent)));
    addPvpBuff(friendlyTarget, {
      id: 'taunt_damage_reduction',
      name: '예? 저요?',
      turns: Number(card.turns || 2),
      value: reduction,
      desc: `상대가 우선 타겟팅합니다. 받는 최종 피해 ${Math.round(reduction * 100)}% 감소`
    });
    battle.logs.push(`${friendlyTarget.displayName}(이)가 <예? 저요?> 버프를 얻었습니다.`);
  } else if (card.effectType === 'self_negate_hit') {
    const negateCount = scaleCount(card.negateHitCount || 1);
    const buffId = card.id === 'solid_mental' ? 'solid_mental_negate_hit' : 'negate_hit';
    const desc = card.id === 'solid_mental' ? '피격 무효를 모두 소모하면 굳건한 멘탈 쿨타임이 시작됩니다.' : '피격 무효';
    addPvpBuff(actor, { id: buffId, name: '피격 무효', count: negateCount, desc });
    battle.logs.push(`${actor.displayName}(이)가 피격 무효 ${negateCount}회를 얻었습니다.`);
  } else if (card.effectType === 'party_cleanse') {
    const cleanseTargets = isAugmentBattle ? friendlyTargets : [actor];
    cleanseTargets.forEach((ally) => clearPvpDebuffs(ally, battle));
  } else if (card.effectType === 'party_bread_buff') {
    const breadCount = scaleCount(card.breadCount || 0);
    const breadHeal = Number(card.breadHeal || 5);
    if (isAugmentBattle && friendlyTargets.length) {
      for (let index = 0; index < breadCount; index += 1) {
        const ally = pickRandomEntry(friendlyTargets);
        addPvpBuff(ally, {
          id: 'bread',
          name: '빵',
          count: 1,
          heal: breadHeal,
          desc: `피격 시 HP ${breadHeal} 회복 후 1개 소모`
        });
      }
      battle.logs.push(`${actor.displayName}이(가) 팀원들에게 빵 ${breadCount}개를 나눠줬습니다.`);
    } else {
      addPvpBuff(actor, {
        id: 'bread',
        name: '빵',
        count: breadCount,
        heal: breadHeal,
        desc: `피격 시 HP ${breadHeal} 회복 후 1개 소모`
      });
      battle.logs.push(`${actor.displayName}이(가) 빵 ${breadCount}개를 챙겼습니다.`);
    }
  } else if (card.effectType === 'party_cooldown_reduce') {
    const reduceAmount = scaleCount(card.cooldownReduce || 1);
    const cooldownTargets = isAugmentBattle ? friendlyTargets : [actor];
    cooldownTargets.forEach((ally) => {
      ally.cards.forEach((entry) => {
        entry.cooldownRemaining = Math.max(0, Number(entry.cooldownRemaining || 0) - reduceAmount);
      });
    });
    battle.logs.push(`${actor.displayName}의 팀 카드 쿨타임이 ${reduceAmount}턴 감소했습니다.`);
  } else if (card.effectType === 'self_bonus_damage') {
    actor.extraDamage = scaleFlat(getPvpEffectiveLevel(actor) * Number(card.bonusPerLevel || 0));
    if (isAugmentBattle && target && target.team !== actor.team) {
      performPvpBasicAttack(actor, target, battle);
      actor.extraDamage = 0;
    }
  } else if (card.effectType === 'self_per_hit_bonus') {
    actor.perHitBonusDamage = scaleFlat(getPvpEffectiveLevel(actor) * Number(card.bonusPerLevel || 0));
    actor.perHitBonusTurns = 1;
    if (isAugmentBattle && target && target.team !== actor.team) {
      performPvpBasicAttack(actor, target, battle);
      actor.perHitBonusTurns = 0;
      actor.perHitBonusDamage = 0;
    }
  } else if (card.effectType === 'target_pair_guard_buff') {
    const negateHitCount = Number(card.negateHitCount || 0) > 0 ? scaleCount(card.negateHitCount) : 0;
    if (negateHitCount > 0) {
      addPvpBuff(friendlyTarget, { id: 'negate_hit', name: '피격 무효', count: negateHitCount, desc: '피격 무효' });
    }
    addPvpBuff(friendlyTarget, { id: 'debuff_guard', name: '디버프 무효', count: scaleCount(card.debuffImmuneCount || 1), desc: '디버프 무효' });
    addPvpBuff(friendlyTarget, { id: 'attack_bonus', name: '공격력 상승', turns: Number(card.turns || 1), value: scalePercent(card.attackBonusPercent), stackDistinct: true, desc: `공격력 +${Math.round(scalePercent(card.attackBonusPercent) * 100)}%` });
  } else if (card.effectType === 'random_party_negate_hit' || card.effectType === 'party_negate_hit_by_level') {
    const targetCount = isAugmentBattle
      ? Math.max(1, Math.min(friendlyTargets.length, Math.floor(Number(card.targets || 1))))
      : 1;
    const targets = isAugmentBattle
      ? [...friendlyTargets].sort(() => Math.random() - 0.5).slice(0, targetCount)
      : [friendlyTarget];
    targets.forEach((ally) => {
      addPvpBuff(ally, { id: 'negate_hit', name: '피격 무효', count: scaleCount(card.negateHitCount || 1), desc: '피격 무효' });
    });
  } else if (card.effectType === 'random_party_attack_buff' || card.effectType === 'target_attack_buff') {
    const targetCount = card.effectType === 'random_party_attack_buff' && isAugmentBattle
      ? Math.max(1, Math.min(friendlyTargets.length, Math.floor(Number(card.targets || 1))))
      : 1;
    const targets = card.effectType === 'random_party_attack_buff' && isAugmentBattle
      ? [...friendlyTargets].sort(() => Math.random() - 0.5).slice(0, targetCount)
      : [friendlyTarget];
    targets.forEach((ally) => {
      addPvpBuff(ally, { id: 'attack_bonus', name: '공격력 상승', turns: Number(card.turns || 1), value: scalePercent(card.attackBonusPercent), stackDistinct: true, desc: `공격력 +${Math.round(scalePercent(card.attackBonusPercent) * 100)}%` });
    });
  } else if (card.effectType === 'target_final_damage_buff') {
    const finalDamageBonus = Math.max(0, scalePercent(card.finalDamageBonusPercent));
    addPvpBuff(friendlyTarget, {
      id: 'final_damage_bonus',
      name: '부하직원 육성',
      turns: Number(card.turns || 2),
      value: finalDamageBonus,
      stackDistinct: true,
      desc: `최종 데미지 +${Math.round(finalDamageBonus * 100)}%`
    });
    battle.logs.push(`${friendlyTarget.displayName}의 최종 데미지가 ${Math.round(finalDamageBonus * 100)}% 증가합니다.`);
  } else if (card.effectType === 'target_debuff_guard') {
    addPvpBuff(friendlyTarget, { id: 'debuff_guard', name: '디버프 무효', count: scaleCount(card.debuffImmuneCount || 1), desc: '디버프 무효' });
  } else if (card.effectType === 'ally_shield_enemy_multi_hit') {
    const shieldAmount = grantPvpTemporaryShield(friendlyTarget, scaleFlat(card.shield || 0), friendlyTarget.userId, battle);
    const damageTarget = target && target.team !== actor.team
      ? target
      : pickRandomEntry(enemyTargets);
    const hits = Math.max(1, Number(card.hits || 1));
    const damage = applyPvpOutgoingDamageBonus(actor, scaleFlat(getPvpEffectiveLevel(actor) * Number(card.damagePerLevel || 0)));
    if (damageTarget) {
      for (let index = 0; index < hits; index += 1) {
        if (isPvpAttackMissed(actor, battle, `${cardLabel} ${index + 1}타`)) continue;
        applyPvpDamage(damageTarget, damage, battle);
        battle.logs.push(`${cardLabel} ${index + 1}타! ${damageTarget.displayName}에게 ${damage.toLocaleString()} 피해를 입혔습니다.`);
        triggerPvpPoisonOnAttack(actor, battle);
        if (damageTarget.hp > 0) performPvpCounterAttack(damageTarget, actor, battle);
        if (actor.hp <= 0 || damageTarget.hp <= 0) break;
      }
    }
    battle.logs.push(`${friendlyTarget.displayName}이(가) 보호막 ${shieldAmount.toLocaleString()}을 얻었습니다.`);
  } else if (card.effectType === 'self_status_blast') {
    const statusCount = actor.buffs.length + actor.debuffs.length;
    const hits = Math.max(1, Number(card.hits || 1));
    const damage = applyPvpOutgoingDamageBonus(actor, scaleFlat(statusCount * getPvpEffectiveLevel(actor) * Number(card.multiplierPerStatus || 0)));
    for (let index = 0; index < hits; index += 1) {
      if (isPvpAttackMissed(actor, battle, `${cardLabel} ${index + 1}타`)) continue;
      applyPvpDamage(target, damage, battle);
      battle.logs.push(`${cardLabel} ${index + 1}타! ${target.displayName}에게 ${damage.toLocaleString()} 피해를 입혔습니다.`);
      triggerPvpPoisonOnAttack(actor, battle);
      if (target.hp > 0) performPvpCounterAttack(target, actor, battle);
      if (actor.hp <= 0 || target.hp <= 0) break;
    }
    clearPvpDebuffs(actor, battle);
  } else if (card.effectType === 'overtime_rage') {
    const existing = target.debuffs.find((debuff) => debuff.id === 'overtime' && debuff.sourceUserId === actor.userId);
    if (existing) {
      const stacks = Math.max(0, Number(existing.count || 0));
      const damage = applyPvpOutgoingDamageBonus(actor, scaleFlat(stacks * getPvpEffectiveLevel(actor) * Number(card.rageDamagePerStackPerLevel || 0)));
      if (damage > 0 && !isPvpAttackMissed(actor, battle, cardLabel)) applyPvpDamage(target, damage, battle);
      target.debuffs = target.debuffs.filter((debuff) => debuff !== existing);
      battle.logs.push(`${target.displayName}의 내면의 분노 ${stacks.toLocaleString()}스택이 폭발해 ${damage.toLocaleString()} 피해를 입었습니다.`);
    } else {
      addPvpDebuff(target, {
        id: 'overtime',
        name: '야근',
        sourceUserId: actor.userId,
        count: 0,
        desc: '기본 공격에 피격될 때마다 내면의 분노가 쌓입니다. 현재 0스택'
      }, actor, battle);
      if (cardEntry && !options.ignoreCooldown) {
        cardEntry.cooldownRemaining = 0;
      }
    }
  } else if (card.effectType === 'champion_guard') {
    const shieldAmount = scaleFlat(card.shield || 0);
    const championEnemyTarget = target && target.team === actor.team
      ? (battle.players || []).find((player) => player.team !== actor.team && player.hp > 0)
      : target;
    grantPvpTemporaryShield(friendlyTarget, shieldAmount, friendlyTarget.userId, battle);
    addPvpBuff(friendlyTarget, {
      id: 'champion_guard',
      name: '챔피언의 가호',
      turns: Number(card.turns || 2),
      value: scalePercent(card.attackBonusPercent),
      critBonus: scalePercent(card.critBonus),
      stackDistinct: true,
      desc: `공격력 +${Math.round(scalePercent(card.attackBonusPercent) * 100)}%, 치명타 확률 +${Math.round(scalePercent(card.critBonus) * 100)}%`
    });
    if (championEnemyTarget) addPvpDebuff(championEnemyTarget, {
      id: 'blind',
      name: '눈부심',
      turns: Number(card.blindTurns || 1),
      missChance: Number(card.blindMissChance || 0.3),
      desc: `모든 공격 명중률 ${Math.round(Number(card.blindMissChance || 0.3) * 100)}% 감소`
    }, actor, battle);
    battle.logs.push(`${actor.displayName}이(가) 보호막 ${shieldAmount.toLocaleString()}과 <챔피언의 가호>를 얻고, ${target.displayName}에게 <눈부심>을 적용했습니다.`);
  } else if (card.effectType === 'lowest_level_buff') {
    const subordinateTarget = isAugmentBattle
      ? [...friendlyTargets].sort((a, b) => getPvpEffectiveLevel(a) - getPvpEffectiveLevel(b))[0] || actor
      : actor;
    addPvpBuff(subordinateTarget, {
      id: 'subordinate_level',
      name: '부하직원',
      turns: Number(card.turns || 2),
      value: Number(card.levelBonus || 10),
      desc: `레벨 +${Number(card.levelBonus || 10)}로 간주`
    });
    battle.logs.push(`${subordinateTarget.displayName}이(가) <부하직원> 버프를 얻어 ${Number(card.turns || 2)}턴 동안 레벨 +${Number(card.levelBonus || 10)}로 간주됩니다.`);
  } else if (card.effectType === 'poison_debuff') {
    const poisonTargets = isAugmentBattle ? enemyTargets.filter((entry) => entry && entry.hp > 0) : [target].filter(Boolean);
    let appliedCount = 0;
    poisonTargets.forEach((poisonTarget) => {
      const applied = addPvpDebuff(poisonTarget, {
        id: 'poison',
        name: '중독',
        sourceUserId: actor.userId,
        sourceDisplayName: actor.displayName,
        sourceLevel: getPvpEffectiveLevel(actor),
        damagePerLevel: Number(card.damagePerLevel || 10),
        turns: Number(card.turns || 2),
        desc: `공격할 때마다 ${actor.displayName}의 레벨 x ${Number(card.damagePerLevel || 10)} 피해를 받습니다.`
      }, actor, battle);
      if (applied) appliedCount += 1;
    });
    battle.logs.push(isAugmentBattle
      ? `${actor.displayName}의 농약이 적 ${appliedCount.toLocaleString()}명에게 중독을 적용했습니다.`
      : (appliedCount > 0 ? `${target.displayName}이(가) 중독되었습니다.` : `${target.displayName}이(가) 중독을 막았습니다.`));
  } else if (card.effectType === 'enemy_heal_reduction') {
    const reduction = Math.max(0, Math.min(0.95, scalePercent(card.healReductionPercent || 0)));
    const healReductionTargets = isAugmentBattle
      ? enemyTargets.filter((entry) => entry && entry.hp > 0)
      : [target].filter(Boolean);
    let appliedCount = 0;
    healReductionTargets.forEach((healTarget) => {
      const applied = addPvpDebuff(healTarget, {
        id: 'heal_reduction',
        name: '양치 후 귤',
        turns: Number(card.turns || 2),
        value: reduction,
        desc: `치유 효과 ${Math.round(reduction * 100)}% 감소`
      }, actor, battle);
      if (applied) appliedCount += 1;
    });
    battle.logs.push(isAugmentBattle
      ? `${actor.displayName}이(가) ${card.name}로 적 ${appliedCount.toLocaleString()}명의 치유 효과를 ${Math.round(reduction * 100)}% 감소시켰습니다.`
      : (appliedCount > 0 ? `${target.displayName}의 치유 효과가 ${Math.round(reduction * 100)}% 감소했습니다.` : `${target.displayName}이(가) 치유 감소를 막았습니다.`));
  } else if (card.effectType === 'copy_ally_skill') {
    const opponentCards = target.cards
      .map((entry, index) => ({ entry, index, card: getCardDefinition(entry.cardId, entry.enhancementLevel) }))
      .filter((entry) => entry.card && !entry.card.passiveOnly && entry.card.id !== 'umbrella_copy');
    const source = opponentCards[Math.floor(Math.random() * opponentCards.length)];
    if (source) {
      battle.logs.push(`${actor.displayName}이(가) 상대의 ${source.card.name} 효과를 복사했습니다.`);
      applyPvpCardSkill(actor, target, battle, slotIndex, {
        cardOverride: source.card,
        effectMultiplier: Number(card.copyEffectMultiplier || 0.5),
        ignoreCooldown: true
      });
    }
  }

  if (cardEntry && !options.ignoreCooldown && (card.effectType !== 'overtime_rage' || canResolveOvertime)) {
    cardEntry.cooldownRemaining = card.id === 'solid_mental'
      ? Number(card.cooldown || 0)
      : Number(card.cooldown || 0) + 1;
  }
  return true;
}

function getPvpCriticalChance(player) {
  const baseChance = 0.1;
  const bonus = player.buffs
    .filter((buff) => buff.id === 'crit_bonus' && !buff.pendingActivation)
    .reduce((sum, buff) => sum + Number(buff.value || 0), 0);
  const championBonus = player.buffs
    .filter((buff) => buff.id === 'champion_guard' && !buff.pendingActivation)
    .reduce((sum, buff) => sum + Number(buff.critBonus || 0), 0);
  return Math.min(1, baseChance + bonus + championBonus);
}

function isPvpAttackMissed(actor, battle, label = '공격') {
  const missChance = (actor?.debuffs || [])
    .filter((debuff) => debuff.id === 'blind')
    .reduce((max, debuff) => Math.max(max, Number(debuff.missChance || 0.3)), 0);
  if (missChance > 0 && Math.random() < missChance) {
    battle?.logs?.push(`${actor.displayName}의 ${label}은(는) 눈부심 때문에 빗나갔습니다.`);
    return true;
  }
  return false;
}

function performPvpCounterAttack(counterActor, target, battle) {
  if (!counterActor || !target || counterActor.hp <= 0 || target.hp <= 0) return;
  if (counterActor.basicAttackLockTurns > 0) return;
  const counterBuff = (counterActor.buffs || []).find((buff) => buff.id === 'counter' && !buff.pendingActivation && (Number(buff.turns || 0) > 0 || Number(buff.count || 0) > 0));
  if (!counterBuff) return;

  if (isPvpAttackMissed(counterActor, battle, '반격')) return;
  const baseDamage = Math.max(1, Math.floor((getPvpEffectiveLevel(counterActor) / 2) * 20 * (1 + getPvpAttackBonus(counterActor)) * (1 + Number(counterActor.basicAttackEquipmentBonusPercent || 0))));
  const critical = Math.random() < getPvpCriticalChance(counterActor);
  const damage = applyPvpOutgoingDamageBonus(counterActor, Math.max(1, Math.floor(baseDamage * Number(counterBuff.value || 1) * (critical ? 1.5 : 1))));
  const dealt = applyPvpDamage(target, damage, battle);
  if (dealt > 0) {
    target.lastDamagedByUserId = counterActor.userId;
    triggerPvpThorns(target, counterActor, battle);
  }
  incrementPvpOvertimeRageStacks(target);
  battle.logs.push(`${counterActor.displayName}의 반격! ${target.displayName}에게 ${damage.toLocaleString()} 피해를 입혔습니다.${critical ? ' (치명타)' : ''}`);
  triggerPvpPoisonOnAttack(counterActor, battle);
}

function getPvpInternBuff(player) {
  return (player?.buffs || []).find((buff) => buff.id === 'intern_followup' && !buff.pendingActivation);
}

function getPvpInternFollowupAllies(actor, battle) {
  if (!actor || !battle) return [];
  const allies = isAugmentPvpMode(battle?.mode)
    ? getAliveAugmentTargets(getAugmentTeamPlayers(battle, actor.team))
    : [actor].filter((entry) => entry && entry.hp > 0);
  return allies.filter((player) => {
    const internBuff = getPvpInternBuff(player);
    return internBuff && Math.random() < Math.max(0, Math.min(1, Number(internBuff.value || 0)));
  });
}

function performPvpBasicAttack(actor, target, battle, options = {}) {
  if (actor.basicAttackLockTurns > 0) {
    battle.logs.push(`${actor.displayName}은(는) 기본 공격을 할 수 없습니다.`);
    return;
  }
  const augmentExtraHits = Math.max(0, Math.floor(getPvpAugmentEffectSum(actor, 'extraBasicHits')));
  const forcedBaseHitCount = Number.isFinite(Number(options.baseHitCount))
    ? Math.max(1, Math.floor(Number(options.baseHitCount)))
    : null;
  const targetPool = Array.isArray(options.targetPool) ? options.targetPool : [];
  const useRandomTargetPerHit = Boolean(options.randomizeEachHitTarget && targetPool.length);
  let hitCount = forcedBaseHitCount === null
    ? 1 + Number(actor.extraHits || 0) + augmentExtraHits
    : forcedBaseHitCount + augmentExtraHits;
  if (actor.buffs.some((buff) => buff.id === 'hype' && !buff.pendingActivation)) hitCount *= 2;
  const baseHitMultiplier = options.hitMultiplier !== undefined
    ? Number(options.hitMultiplier)
    : Number(actor.multiHitDamageMultiplier || 1);
  const hitMultiplier = Math.max(0.1, baseHitMultiplier + getPvpAugmentEffectSum(actor, 'basicHitMultiplierBonus'));
  const baseDamage = Math.max(1, Math.floor((getPvpEffectiveLevel(actor) / 2) * 20 * (1 + getPvpAttackBonus(actor)) * (1 + Number(actor.basicAttackEquipmentBonusPercent || 0))));
  const stackGain = Math.max(0, Math.floor(getPvpAugmentEffectSum(actor, 'basicStackGain')));
  const stackDamagePerStack = Math.max(0, Math.floor(getPvpAugmentEffectSum(actor, 'basicStackDamagePerStack')));
  const basicProcChance = Math.max(0, Math.min(1, getPvpAugmentEffectSum(actor, 'basicProcChance')));
  const basicProcDamage = Math.max(0, Math.floor(getPvpAugmentEffectSum(actor, 'basicProcDamage')));
  const basicHealOnHit = Math.max(0, Math.floor(getPvpAugmentEffectSum(actor, 'basicHealOnHit')));
  const basicSplashDamage = Math.max(0, Math.floor(getPvpAugmentEffectSum(actor, 'basicSplashDamage')));
  const basicCooldownReduceChance = Math.max(0, Math.min(1, getPvpAugmentEffectSum(actor, 'basicCooldownReduceChance')));
  const basicCooldownReduce = Math.max(0, Math.floor(getPvpAugmentEffectSum(actor, 'basicCooldownReduce')));
  for (let index = 0; index < hitCount; index += 1) {
    const hitTarget = useRandomTargetPerHit
      ? pickRandomEntry(targetPool.filter((entry) => entry && entry.hp > 0))
      : target;
    if (!hitTarget || hitTarget.hp <= 0) break;
    const critical = Math.random() < getPvpCriticalChance(actor);
    let damage = Math.floor(baseDamage * hitMultiplier * (critical ? 1.5 : 1));
    if (isPvpAttackMissed(actor, battle, `기본 공격 ${index + 1}타`)) {
      triggerPvpPoisonOnAttack(actor, battle);
      if (actor.hp <= 0) break;
      continue;
    }
    const executeBonus = hitTarget.hp <= Math.floor(Number(hitTarget.maxHp || PVP_MAX_HP) * 0.5)
      ? getPvpAugmentEffectSum(actor, 'executeBonus')
      : 0;
    if (executeBonus > 0) damage = Math.floor(damage * (1 + executeBonus));
    if (actor.perHitBonusTurns > 0) damage += Number(actor.perHitBonusDamage || 0);
    damage += Math.max(0, Math.floor(getPvpAugmentEffectSum(actor, 'flatBasicDamage')));
    const stackKey = String(actor.userId || actor.displayName || 'unknown');
    const currentStacks = Number(hitTarget.augmentDamageStacks?.[stackKey] || 0);
    if (stackDamagePerStack > 0 && currentStacks > 0) {
      damage += currentStacks * stackDamagePerStack;
    }
    const procActivated = basicProcChance > 0 && basicProcDamage > 0 && Math.random() < basicProcChance;
    if (procActivated) damage += basicProcDamage;
    if (index === 0 && actor.extraDamage > 0) damage += Number(actor.extraDamage || 0);
    damage = applyPvpOutgoingDamageBonus(actor, damage);
    const dealt = applyPvpDamage(hitTarget, damage, battle);
    if (dealt > 0) {
      hitTarget.lastDamagedByUserId = actor.userId;
      triggerPvpThorns(hitTarget, actor, battle);
      if (stackGain > 0) {
        hitTarget.augmentDamageStacks = hitTarget.augmentDamageStacks || {};
        hitTarget.augmentDamageStacks[stackKey] = Math.min(99, currentStacks + stackGain);
      }
      if (basicHealOnHit > 0) {
        const healed = healPvpTarget(actor, basicHealOnHit);
        if (healed > 0) battle.logs.push(`${actor.displayName}의 증강 효과로 HP ${healed.toLocaleString()}를 회복했습니다.`);
      }
      if (basicSplashDamage > 0 && isAugmentPvpMode(battle?.mode)) {
        const splashTarget = pickRandomEntry(getAliveAugmentTargets(getAugmentEnemyPlayers(battle, actor.team)).filter((enemy) => enemy.userId !== hitTarget.userId));
        if (splashTarget) {
          const splashDealt = applyPvpDamage(splashTarget, basicSplashDamage, battle, { skipBread: true });
          if (splashDealt > 0) {
            battle.logs.push(`${actor.displayName}의 튕김 증강이 ${splashTarget.displayName}에게 ${splashDealt.toLocaleString()} 피해를 입혔습니다.`);
            handleAugmentKillIfNeeded(actor, splashTarget, battle);
          }
        }
      }
      if (basicCooldownReduceChance > 0 && basicCooldownReduce > 0 && Math.random() < basicCooldownReduceChance) {
        actor.cards.forEach((card) => { card.cooldownRemaining = Math.max(0, Number(card.cooldownRemaining || 0) - basicCooldownReduce); });
        battle.logs.push(`${actor.displayName}의 증강 효과로 카드 쿨타임이 ${basicCooldownReduce}턴 감소했습니다.`);
      }
    }
    incrementPvpOvertimeRageStacks(hitTarget);
    const attackLabel = options.internFollowup ? '<인턴> 지원 공격' : `기본 공격 ${index + 1}타`;
    battle.logs.push(`${actor.displayName}의 ${attackLabel}! ${hitTarget.displayName}에게 ${damage.toLocaleString()} 피해를 입혔습니다.${critical ? ' (치명타)' : ''}`);
    triggerPvpPoisonOnAttack(actor, battle);
    if (hitTarget.hp > 0) performPvpCounterAttack(hitTarget, actor, battle);
    if (!options.internFollowup && actor.hp > 0) {
      const internAllies = getPvpInternFollowupAllies(actor, battle);
      internAllies.forEach((internActor) => {
        const internBuff = getPvpInternBuff(internActor);
        const internTarget = isAugmentPvpMode(battle?.mode)
          ? pickRandomEntry(getAliveAugmentTargets(getAugmentEnemyPlayers(battle, internActor.team)))
          : hitTarget;
        if (!internTarget || internTarget.hp <= 0 || internActor.hp <= 0) return;
        performPvpBasicAttack(internActor, internTarget, battle, {
          baseHitCount: 1,
          hitMultiplier: Math.max(0.1, Number(internBuff?.damageMultiplier || 0.3)),
          internFollowup: true
        });
      });
    }
    if (actor.hp <= 0) break;
    if (useRandomTargetPerHit) {
      if (!targetPool.some((entry) => entry && entry.hp > 0)) break;
    } else if (hitTarget.hp <= 0) {
      break;
    }
  }
}

function tickPvpPlayerEndOfTurn(player, battle) {
  const solidMentalActive = player.buffs.some((buff) => buff.id === 'solid_mental_negate_hit' && Number(buff.count || 0) > 0);
  player.cards.forEach((card) => {
    const pausedBySolidMental = card.cardId === 'solid_mental' && solidMentalActive;
    if (Number(card.cooldownRemaining || 0) > 0 && !pausedBySolidMental) card.cooldownRemaining -= 1;
  });
  player.buffs.forEach((buff) => {
    if (buff.pendingActivation) {
      buff.pendingActivation = false;
      return;
    }
    if (Number(buff.turns || 0) > 0 && Number(buff.turns || 0) < 900) {
      buff.turns -= 1;
      if (buff.turns <= 0 && buff.id === 'celine' && Number(buff.expireDamage || 0) > 0) {
        const target = isAugmentPvpMode(battle?.mode)
          ? pickRandomEntry(getAliveAugmentTargets(getAugmentEnemyPlayers(battle, player.team)))
          : getPvpOpponent(battle, player.userId);
        if (target) {
          const expireDamage = applyPvpOutgoingDamageBonus(player, Number(buff.expireDamage || 0));
          applyPvpDamage(target, expireDamage, battle);
          battle.logs.push(`${player.displayName}의 셀린느가 종료되며 ${target.displayName}에게 ${expireDamage.toLocaleString()} 피해를 입혔습니다.`);
        }
      }
    }
  });
  player.debuffs.forEach((debuff) => {
    if (Number(debuff.turns || 0) > 0) debuff.turns -= 1;
  });
  player.buffs = player.buffs.filter((buff) => Number(buff.turns || 0) > 0 || Number(buff.count || 0) > 0 || Number(buff.turns || 0) >= 900);
  player.debuffs = player.debuffs.filter((debuff) => debuff.id === 'overtime' || Number(debuff.turns || 0) > 0 || Number(debuff.count || 0) > 0);
  if (player.basicAttackLockTurns > 0) player.basicAttackLockTurns -= 1;
  if (player.actionLockTurns > 0) player.actionLockTurns -= 1;
  player.extraHits = 0;
  player.multiHitDamageMultiplier = 1;
  player.extraDamage = 0;
  if (player.perHitBonusTurns > 0) {
    player.perHitBonusTurns -= 1;
    if (player.perHitBonusTurns <= 0) player.perHitBonusDamage = 0;
  }
  player.plannedCardIndex = null;
}

function getPvpUserRating(user) {
  return Math.round(Number(user?.pvpStats?.rating ?? PVP_RATING_BASE));
}

function calculatePvpRatingDelta(winnerRating, loserRating) {
  const expectedWinner = 1 / (1 + Math.pow(10, (Number(loserRating || PVP_RATING_BASE) - Number(winnerRating || PVP_RATING_BASE)) / 400));
  return Math.max(1, Math.round(PVP_RATING_K * (1 - expectedWinner)));
}

async function settlePvpBets(battle, winnerUserId) {
  const bets = battle?.bets || {};
  const entries = Object.entries(bets);
  if (!entries.length) return;

  for (const [bettorId, bet] of entries) {
    const amount = Math.max(0, Math.floor(Number(bet?.amount || 0)));
    if (amount <= 0) continue;
    const predictedWinnerId = String(bet?.targetUserId || '');
    const won = predictedWinnerId === String(winnerUserId);
    const payout = won ? Math.floor(amount * PVP_BET_PAYOUT_MULTIPLIER) : 0;
    try {
      await withUserMutationLock(bettorId, async () => {
        const user = await User.findById(bettorId);
        if (!user) return;
        ensureUserDefaults(user);
        if (won) {
          user.gameState.money += payout;
          queueNotification(user, 'pvp_bet_win', `개인면담 배팅 성공! ${payout.toLocaleString()}원을 획득했습니다.`);
        } else {
          queueNotification(user, 'pvp_bet_lose', `개인면담 배팅 실패! ${amount.toLocaleString()}원을 잃었습니다.`);
        }
        await persistUserSnapshot(user);
      });
    } catch (err) {
      console.error('PVP bet settlement error:', err);
    }
  }
}

async function finalizePvpBattleOutcome(winnerUserId, loserUserId, battle) {
  if (!winnerUserId || !loserUserId || battle?.outcomeFinalized) return;
  battle.outcomeFinalized = true;
  if (isPracticePvpMode(battle?.mode)) {
    battle.ratingChange = null;
    return;
  }
  try {
    const [winnerSnapshot, loserSnapshot] = await Promise.all([
      User.findById(winnerUserId),
      User.findById(loserUserId)
    ]);
    if (!winnerSnapshot || !loserSnapshot) return;
    ensureUserDefaults(winnerSnapshot);
    ensureUserDefaults(loserSnapshot);
    const ranked = isRankedPvpMode(battle?.mode);
    if (battle?.tournamentMatchId) {
      await finalizeInterviewTournamentMatch(battle.tournamentMatchId, winnerUserId, loserUserId, new Date());
    }

    if (!ranked) {
      await withUserMutationLock(winnerUserId, async () => {
        const user = await User.findById(winnerUserId);
        if (!user) return;
        ensureUserDefaults(user);
        const expMultiplier = 1 + calculateDerivedStats(user, new Date()).expBonusPercent / 100;
        const expReward = Math.floor(getRequiredExp(user.gameState.level) * 0.025 * expMultiplier);
        user.gameState.exp += expReward;
        checkLevelUp(user);
        queueNotification(user, 'pvp_normal_victory_reward', `일반 개인면담 승리! 경험치 ${expReward.toLocaleString()}를 획득했습니다.`);
        await persistUserSnapshot(user);
      });
      await withUserMutationLock(loserUserId, async () => {
        const user = await User.findById(loserUserId);
        if (!user) return;
        ensureUserDefaults(user);
        const expMultiplier = 1 + calculateDerivedStats(user, new Date()).expBonusPercent / 100;
        const expReward = Math.floor(getRequiredExp(user.gameState.level) * 0.01 * expMultiplier);
        user.gameState.exp += expReward;
        checkLevelUp(user);
        queueNotification(user, 'pvp_normal_defeat_reward', `일반 개인면담 패배 보상으로 경험치 ${expReward.toLocaleString()}를 획득했습니다.`);
        await persistUserSnapshot(user);
      });
      battle.ratingChange = null;
      return;
    }

    const winnerOldRating = getPvpUserRating(winnerSnapshot);
    const loserOldRating = getPvpUserRating(loserSnapshot);
    const baseDelta = calculatePvpRatingDelta(winnerOldRating, loserOldRating);
    const winnerRatingBonusPercent = Math.max(0, Number(calculateDerivedStats(winnerSnapshot, new Date()).pvpWinRatingBonusPercent || 0));
    const winnerDelta = Math.max(1, Math.round(baseDelta * (1 + winnerRatingBonusPercent / 100)));
    const loserDelta = baseDelta;
    const winnerNewRating = winnerOldRating + winnerDelta;
    const loserNewRating = Math.max(0, loserOldRating - loserDelta);

    await withUserMutationLock(winnerUserId, async () => {
      const user = await User.findById(winnerUserId);
      if (!user) return;
      ensureUserDefaults(user);
      user.pvpStats.rating = winnerNewRating;
      user.pvpStats.played += 1;
      user.pvpStats.wins += 1;
      const expMultiplier = 1 + calculateDerivedStats(user, new Date()).expBonusPercent / 100;
      const expReward = Math.floor(getRequiredExp(user.gameState.level) * 0.05 * expMultiplier);
      const fragmentReward = Math.floor(Math.random() * 5) + 1;
      user.gameState.exp += expReward;
      checkLevelUp(user);
      addItemToInventory(user, 'raid_entry_ticket', 1);
      addItemToInventory(user, 'equipment_fragment', fragmentReward);
      addItemToInventory(user, 'bacchus', 1);
      queueNotification(user, 'pvp_victory_reward', `랭크 개인면담 승리! +${winnerDelta}점, 회의 추가 입장권 1장, 박카스 1개, 경험치 ${expReward.toLocaleString()}, 장비 파편 ${fragmentReward}개를 획득했습니다.`);
      await persistUserSnapshot(user);
    });
    await withUserMutationLock(loserUserId, async () => {
      const user = await User.findById(loserUserId);
      if (!user) return;
      ensureUserDefaults(user);
      user.pvpStats.rating = loserNewRating;
      user.pvpStats.played += 1;
      user.pvpStats.losses += 1;
      const expMultiplier = 1 + calculateDerivedStats(user, new Date()).expBonusPercent / 100;
      const expReward = Math.floor(getRequiredExp(user.gameState.level) * 0.02 * expMultiplier);
      user.gameState.exp += expReward;
      checkLevelUp(user);
      queueNotification(user, 'pvp_rating_loss', `랭크 개인면담 패배로 -${loserDelta}점이 반영되었습니다. 패배 보상으로 경험치 ${expReward.toLocaleString()}를 획득했습니다.`);
      await persistUserSnapshot(user);
    });
    battle.ratingChange = { winnerDelta, loserDelta: -loserDelta, winnerNewRating, loserNewRating };
    await settlePvpBets(battle, winnerUserId);
  } catch (err) {
    battle.outcomeFinalized = false;
    console.error('PVP outcome finalize error:', err);
  }
}

function allAugmentSelectionsResolved(battle) {
  if (!battle || battle.phase !== 'augment') return false;
  return battle.players.every((player) => Number(player.hp || 0) <= 0 || battle.augmentSelected?.[player.userId]);
}

function finishAugmentSelectionRound(battle, now = new Date()) {
  if (!battle || battle.phase !== 'augment') return;
  battle.players.forEach((player) => {
    if (Number(player.hp || 0) <= 0) return;
    const selectedId = battle.augmentSelected?.[player.userId]
      || getAugmentOptionsForPlayer(player)[0]?.id;
    if (selectedId) {
      applyAugmentEffectsToPlayer(player, selectedId, battle);
      battle.augmentSelected[player.userId] = selectedId;
      battle.logs.push(`${player.displayName}이(가) <${PVP_AUGMENT_DATA[selectedId]?.name || selectedId}> 증강을 선택했습니다.`);
    }
    player.augmentOptions = [];
  });
  startAugmentActiveTurn(battle, now);
}

function applyAugmentRoundStartEffects(battle) {
  if (!battle) return;

  ['red', 'blue'].forEach((team) => {
    const teamPlayers = getAugmentTeamPlayers(battle, team);
    const aliveTeamPlayers = getAliveAugmentTargets(teamPlayers);
    const getAliveEnemies = () => getAliveAugmentTargets(getAugmentEnemyPlayers(battle, team));

    const roundShield = teamPlayers.reduce((sum, player) => sum + getPvpAugmentEffectSum(player, 'teamRoundShield'), 0);
    if (roundShield > 0) {
      aliveTeamPlayers.forEach((player) => {
        grantPvpTemporaryShield(player, roundShield, player.userId, battle);
      });
      battle.logs.push(`${team === 'red' ? '레드팀' : '블루팀'}이 라운드 시작 보호막 ${roundShield.toLocaleString()}을 받았습니다.`);
    }

    const teamHeal = teamPlayers.reduce((sum, player) => sum + getPvpAugmentEffectSum(player, 'teamRoundHeal'), 0);
    if (teamHeal > 0) {
      const totalHealed = aliveTeamPlayers.reduce((sum, player) => sum + healPvpTarget(player, teamHeal), 0);
      if (totalHealed > 0) battle.logs.push(`${team === 'red' ? '레드팀' : '블루팀'}이 증강 효과로 HP ${totalHealed.toLocaleString()}을 회복했습니다.`);
    }

    const teamAttackStack = teamPlayers.reduce((sum, player) => sum + getPvpAugmentEffectSum(player, 'teamRoundAttackStack'), 0);
    if (teamAttackStack > 0) {
      aliveTeamPlayers.forEach((player) => {
        addPvpBuff(player, {
          id: 'augment_round_attack_stack',
          name: '누적 업무 탄력',
          value: teamAttackStack,
          turns: 999,
          desc: `공격력 +${Math.round(teamAttackStack * 100)}%`
        });
      });
    }

    aliveTeamPlayers.forEach((player) => {
      const selfDamage = getPvpAugmentEffectSum(player, 'selfRoundDamage');
      if (selfDamage > 0) {
        applyPvpDamage(player, selfDamage, battle, { ignoreNegate: true, skipBread: true });
      }

      const randomDamage = getPvpAugmentEffectSum(player, 'randomEnemyRoundDamage');
      if (randomDamage > 0) {
        const enemy = pickRandomEntry(getAliveEnemies());
        if (enemy) {
          applyPvpDamage(enemy, randomDamage, battle);
          battle.logs.push(`${player.displayName}의 증강이 ${enemy.displayName}에게 ${Number(randomDamage).toLocaleString()} 피해를 입혔습니다.`);
          handleAugmentKillIfNeeded(player, enemy, battle);
        }
      }

      const lowestDamage = getPvpAugmentEffectSum(player, 'lowestEnemyRoundDamage');
      if (lowestDamage > 0) {
        const enemy = getAliveEnemies().sort((left, right) => Number(left.hp || 0) - Number(right.hp || 0))[0];
        if (enemy) {
          applyPvpDamage(enemy, lowestDamage, battle);
          battle.logs.push(`${player.displayName}의 증강이 가장 약한 적 ${enemy.displayName}에게 ${Number(lowestDamage).toLocaleString()} 피해를 입혔습니다.`);
          handleAugmentKillIfNeeded(player, enemy, battle);
        }
      }

      const enemyTeamDamage = getPvpAugmentEffectSum(player, 'enemyTeamRoundDamage');
      if (enemyTeamDamage > 0) {
        getAliveEnemies().forEach((enemy) => {
          applyPvpDamage(enemy, enemyTeamDamage, battle);
          handleAugmentKillIfNeeded(player, enemy, battle);
        });
      }

      const retaliationDamage = getPvpAugmentEffectSum(player, 'retaliationMarkDamage');
      if (retaliationDamage > 0 && player.lastDamagedByUserId) {
        const enemy = battle.players.find((entry) => entry.userId === player.lastDamagedByUserId && entry.hp > 0);
        if (enemy) {
          applyPvpDamage(enemy, retaliationDamage, battle);
          battle.logs.push(`${player.displayName}의 감사 추적이 ${enemy.displayName}에게 ${Number(retaliationDamage).toLocaleString()} 피해를 입혔습니다.`);
          handleAugmentKillIfNeeded(player, enemy, battle);
        }
      }
    });
  });
}

function respawnAugmentPlayersAtRoundStart(battle) {
  if (!battle) return;
  const teamRespawnShield = {};
  ['red', 'blue'].forEach((team) => {
    teamRespawnShield[team] = getAugmentTeamPlayers(battle, team).reduce((sum, player) => {
      return sum + (player.augmentIds || []).reduce((acc, augmentId) => acc + Number(PVP_AUGMENT_DATA[augmentId]?.effects?.teamRespawnShield || 0), 0);
    }, 0);
  });
  battle.players.forEach((player) => {
    if (player.hp > 0 || Number(player.respawnAtRound || 0) > battle.roundNumber) return;
    const bonus = (player.augmentIds || []).reduce((sum, augmentId) => sum + Number(PVP_AUGMENT_DATA[augmentId]?.effects?.respawnHpBonus || 0), 0);
    player.hp = Math.min(player.maxHp, Math.floor(PVP_AUGMENT_MAX_HP + bonus));
    player.shield = Math.max(0, Number(player.shield || 0));
    if (teamRespawnShield[player.team] > 0) {
      grantPvpTemporaryShield(player, teamRespawnShield[player.team], player.userId, battle);
    }
    battle.logs.push(`${player.displayName}이(가) 부활했습니다.`);
  });
}

function pickDefaultAugmentActionTarget(actor, battle, actionType = 'basic') {
  if (actionType === 'ally') {
    return getAliveAugmentTargets(getAugmentTeamPlayers(battle, actor.team)).find((player) => player.userId !== actor.userId)
      || actor;
  }
  return getAliveAugmentTargets(getAugmentEnemyPlayers(battle, actor.team))[0] || null;
}

function resolveAugmentSkillTarget(actor, battle, card, targetUserId = null) {
  const target = battle.players.find((player) => player.userId === String(targetUserId || ''));
  if (isPvpAugmentSelfSkill(card)) {
    return actor;
  }
  if (isPvpAugmentAllySkill(card)) {
    if (target && target.team === actor.team && target.hp > 0) return target;
    return pickDefaultAugmentActionTarget(actor, battle, 'ally');
  }
  if (target && target.team !== actor.team && target.hp > 0) return target;
  return pickDefaultAugmentActionTarget(actor, battle, 'enemy');
}

function handleAugmentKillIfNeeded(actor, target, battle) {
  if (!actor || !target || !battle || target.hp > 0 || target.countedDeathInRound === battle.roundNumber) return false;
  target.deaths = Number(target.deaths || 0) + 1;
  target.countedDeathInRound = battle.roundNumber;
  target.respawnAtRound = Number(battle.roundNumber || 1) + 1;
  actor.kills = Number(actor.kills || 0) + 1;
  battle.teamKills[actor.team] = Number(battle.teamKills?.[actor.team] || 0) + 1;
  battle.logs.push(`${actor.displayName}이(가) ${target.displayName}을(를) 처치했습니다. ${actor.team === 'red' ? '레드팀' : '블루팀'} ${battle.teamKills[actor.team]}/${battle.killTarget}킬`);
  const cooldownReduce = (actor.augmentIds || []).reduce((sum, augmentId) => sum + Number(PVP_AUGMENT_DATA[augmentId]?.effects?.cooldownOnKill || 0), 0);
  if (cooldownReduce > 0) {
    actor.cards.forEach((card) => { card.cooldownRemaining = Math.max(0, Number(card.cooldownRemaining || 0) - cooldownReduce); });
  }
  const teamCooldownReduce = getPvpAugmentEffectSum(actor, 'teamCooldownOnKill');
  if (teamCooldownReduce > 0) {
    getAugmentTeamPlayers(battle, actor.team).forEach((ally) => {
      ally.cards.forEach((card) => { card.cooldownRemaining = Math.max(0, Number(card.cooldownRemaining || 0) - teamCooldownReduce); });
    });
  }
  const enemyCooldownIncrease = getPvpAugmentEffectSum(actor, 'enemyCooldownOnKill');
  if (enemyCooldownIncrease > 0) {
    getAugmentEnemyPlayers(battle, actor.team).forEach((enemy) => {
      enemy.cards.forEach((card) => { card.cooldownRemaining = Math.max(0, Number(card.cooldownRemaining || 0) + enemyCooldownIncrease); });
    });
  }
  const allyDeathAttackStack = getAugmentTeamPlayers(battle, target.team)
    .reduce((sum, ally) => sum + (ally.userId !== target.userId ? getPvpAugmentEffectSum(ally, 'attackStackOnAllyDeath') : 0), 0);
  if (allyDeathAttackStack > 0) {
    getAugmentTeamPlayers(battle, target.team)
      .filter((ally) => ally.hp > 0)
      .forEach((ally) => {
        addPvpBuff(ally, {
          id: 'augment_ally_death_rage',
          name: '동료의 야근 분노',
          value: allyDeathAttackStack,
          turns: 999,
          desc: `공격력 +${Math.round(allyDeathAttackStack * 100)}%`
        });
      });
  }
  const deathExplosionDamage = getPvpAugmentEffectSum(target, 'deathExplosionDamage');
  if (deathExplosionDamage > 0 && actor.hp > 0) {
    const dealt = applyPvpDamage(actor, deathExplosionDamage, battle, { ignoreNegate: true, skipBread: true });
    if (dealt > 0) battle.logs.push(`${target.displayName}의 사망 증강이 ${actor.displayName}에게 ${dealt.toLocaleString()} 피해를 입혔습니다.`);
    if (actor.hp <= 0) handleAugmentKillIfNeeded(target, actor, battle);
  }
  const deathExplosionSplash = getPvpAugmentEffectSum(target, 'deathExplosionSplash');
  if (deathExplosionSplash > 0) {
    getAugmentEnemyPlayers(battle, target.team)
      .filter((enemy) => enemy.hp > 0)
      .forEach((enemy) => {
        applyPvpDamage(enemy, deathExplosionSplash, battle, { ignoreNegate: true, skipBread: true });
        if (enemy.hp <= 0) handleAugmentKillIfNeeded(target, enemy, battle);
      });
    battle.logs.push(`${target.displayName}의 사망 증강이 적 전체에게 ${Number(deathExplosionSplash).toLocaleString()} 피해를 입혔습니다.`);
  }
  if (battle.teamKills[actor.team] >= battle.killTarget) {
    battle.phase = 'finished';
    battle.winnerTeam = actor.team;
    battle.winnerUserId = actor.userId;
    battle.finishedAt = new Date();
    battle.logs.push(`${actor.team === 'red' ? '레드팀' : '블루팀'}이 먼저 ${battle.killTarget}킬을 달성했습니다.`);
  }
  return true;
}

function pickRandomEntry(list = []) {
  if (!Array.isArray(list) || !list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

function getRandomAugmentTargetForAction(actor, battle, card = null, actionType = 'basic') {
  if (!actor || !battle) return null;
  if (actionType === 'skill') {
    if (isPvpAugmentSelfSkill(card)) return actor;
    if (isPvpAugmentAllySkill(card)) {
      return pickRandomEntry(getAliveAugmentTargets(getAugmentTeamPlayers(battle, actor.team))) || actor;
    }
  }
  return pickRandomEntry(getAliveAugmentTargets(getAugmentEnemyPlayers(battle, actor.team)));
}

function buildRandomAugmentAction(actor, battle) {
  const usableSkills = (actor.cards || [])
    .map((entry, index) => ({ entry, index, card: getPvpCardDefinitionFromSlot(actor, index) }))
    .filter(({ entry, card }) => card && !card.passiveOnly && Number(entry.cooldownRemaining || 0) <= 0);
  if (usableSkills.length && Math.random() < 0.65) {
    const picked = pickRandomEntry(usableSkills);
    const target = getRandomAugmentTargetForAction(actor, battle, picked.card, 'skill');
    return { type: 'skill', cardIndex: picked.index, targetUserId: target?.userId || '' };
  }
  const target = getRandomAugmentTargetForAction(actor, battle, null, 'basic');
  return { type: 'basic', targetUserId: target?.userId || '' };
}

async function executePvpAugmentTurn(battle, now = new Date(), options = {}) {
  if (!battle || battle.phase !== 'active') return;
  const order = getAugmentTurnOrderPlayers(battle);
  if (!order.length) return;
  if (Number(battle.turnCursor || 0) === 0) {
    respawnAugmentPlayersAtRoundStart(battle);
    applyAugmentRoundStartEffects(battle);
    if (battle.phase === 'finished') {
      bumpPvpVersion();
      return;
    }
  }
  let cursor = Math.max(0, Math.min(order.length - 1, Number(battle.turnCursor || 0)));
  if (battle.currentUserId) {
    const currentIndex = order.findIndex((player) => player.userId === battle.currentUserId);
    if (currentIndex >= 0 && currentIndex !== cursor) {
      cursor = currentIndex;
      battle.turnCursor = cursor;
    }
  }
  const actor = order[cursor] || order[0];
  battle.currentUserId = actor?.userId || null;
  if (!actor) return;
  actor.lastHpLoss = 0;
  actor.lastShieldLoss = 0;
  battle.players.forEach((player) => {
    if (player.userId !== actor.userId) {
      player.lastHpLoss = 0;
      player.lastShieldLoss = 0;
    }
  });
  if (actor.hp <= 0) {
    battle.logs.push(`${actor.displayName}은(는) 리스폰 대기 중입니다.`);
  } else {
    const turnHeal = (actor.augmentIds || []).reduce((sum, augmentId) => sum + Number(PVP_AUGMENT_DATA[augmentId]?.effects?.turnHeal || 0), 0);
    if (turnHeal > 0) healPvpTarget(actor, turnHeal);
    if (turnHeal < 0) applyPvpDamage(actor, Math.abs(turnHeal), battle, { ignoreNegate: true, skipBread: true });
    const action = actor.pendingAction || (options.timedOut ? buildRandomAugmentAction(actor, battle) : { type: 'basic' });
    if (options.timedOut && !actor.pendingAction) {
      battle.logs.push(`${actor.displayName}이(가) 제한 시간 안에 행동하지 않아 랜덤 행동을 진행합니다.`);
    }
    if (action.type === 'skill') {
      const slotIndex = Number(action.cardIndex);
      const card = getPvpCardDefinitionFromSlot(actor, slotIndex);
      const target = resolveAugmentSkillTarget(actor, battle, card, action.targetUserId);
      const used = target ? applyPvpCardSkill(actor, target, battle, slotIndex) : false;
      if (used) {
        handleAugmentKillIfNeeded(actor, target, battle);
        getAugmentEnemyPlayers(battle, actor.team).forEach((enemy) => {
          handleAugmentKillIfNeeded(actor, enemy, battle);
        });
      } else {
        battle.logs.push(`${actor.displayName}의 카드 사용이 실패해 기본공격으로 전환됩니다.`);
        const basicTarget = pickDefaultAugmentActionTarget(actor, battle, 'enemy');
        if (basicTarget) {
          performPvpBasicAttack(actor, basicTarget, battle);
          handleAugmentKillIfNeeded(actor, basicTarget, battle);
        }
      }
    } else {
      const explicitTarget = battle.players.find((player) => player.userId === String(action.targetUserId || ''));
      const target = explicitTarget && explicitTarget.team !== actor.team && explicitTarget.hp > 0
        ? explicitTarget
        : pickDefaultAugmentActionTarget(actor, battle, 'enemy');
      if (target) {
        performPvpBasicAttack(actor, target, battle);
        handleAugmentKillIfNeeded(actor, target, battle);
      }
    }
  }
  actor.pendingAction = null;
  battle.pendingActionUserId = null;
  battle.pendingActionExecuteAt = null;
  tickPvpPlayerEndOfTurn(actor, battle);
  clearPvpShieldsExpiredByUserTurn(battle, actor.userId);
  if (battle.phase === 'finished') {
    bumpPvpVersion();
    return;
  }
  battle.turnCursor = (cursor + 1) % order.length;
  if (battle.turnCursor === 0) {
    battle.roundNumber = Number(battle.roundNumber || 1) + 1;
    battle.turnNumber = battle.roundNumber;
    if (PVP_AUGMENT_ROUNDS.includes(battle.roundNumber)) {
      prepareAugmentSelectionRound(battle, battle.roundNumber, now);
      bumpPvpVersion();
      return;
    }
  }
  const nextActor = getAugmentTurnOrderPlayers(battle)[battle.turnCursor] || order[0];
  battle.currentUserId = nextActor?.userId || null;
  battle.turnEndsAt = new Date(now.getTime() + PVP_AUGMENT_TURN_MS);
  bumpPvpVersion();
}

async function executePvpTurn(battle, now = new Date(), options = {}) {
  if (isAugmentPvpMode(battle?.mode)) {
    await executePvpAugmentTurn(battle, now, options);
    return;
  }
  const actor = getPvpPlayer(battle, battle.currentUserId);
  const target = getPvpOpponent(battle, battle.currentUserId);
  if (!actor || !target || battle.winnerUserId) return;

  actor.lastHpLoss = 0;
  actor.lastShieldLoss = 0;
  target.lastHpLoss = 0;
  target.lastShieldLoss = 0;

  if (isPracticePvpMode(battle.mode) && actor.isBot) {
    battle.logs.push('JM이햄은 참고 있습니다.');
    battle.currentUserId = target.userId;
    battle.turnNumber += 1;
    battle.turnEndsAt = new Date(now.getTime() + PVP_BATTLE_TURN_MS);
    bumpPvpVersion();
    return;
  }

  if (actor.hp <= 0) {
    battle.logs.push(`${actor.displayName}은(는) 전투불능입니다.`);
  } else {
    const plannedIndex = Number.isInteger(actor.plannedCardIndex) ? actor.plannedCardIndex : null;
    if (plannedIndex !== null) {
      const used = applyPvpCardSkill(actor, target, battle, plannedIndex);
      if (!used) {
        battle.logs.push(`${actor.displayName}의 예약 스킬은 사용할 수 없어 기본 공격만 진행합니다.`);
      }
    }
    if (actor.hp > 0 && target.hp > 0) {
      performPvpBasicAttack(actor, target, battle);
    }
  }

  tickPvpPlayerEndOfTurn(actor, battle);
  clearPvpShieldsExpiredByUserTurn(battle, actor.userId);
  if (actor.hp <= 0) {
    battle.winnerUserId = target.userId;
    battle.loserUserId = actor.userId;
    battle.phase = 'finished';
    battle.finishedAt = now;
    battle.logs.push(`${target.displayName}의 승리입니다.`);
    await finalizePvpBattleOutcome(target.userId, actor.userId, battle);
    bumpPvpVersion();
    return;
  }
  if (target.hp <= 0) {
    battle.winnerUserId = actor.userId;
    battle.loserUserId = target.userId;
    battle.phase = 'finished';
    battle.finishedAt = now;
    battle.logs.push(`${actor.displayName}의 승리입니다.`);
    await finalizePvpBattleOutcome(actor.userId, target.userId, battle);
    bumpPvpVersion();
    return;
  }

  battle.currentUserId = target.userId;
  battle.turnNumber += 1;
  const nextTurnMs = isPracticePvpMode(battle.mode) && target.isBot
    ? PVP_PRACTICE_BOT_TURN_MS
    : PVP_BATTLE_TURN_MS;
  battle.turnEndsAt = new Date(now.getTime() + nextTurnMs);
  bumpPvpVersion();
}

async function advancePvpModeStateUnlocked(mode, modeState, now = new Date()) {
  if (modeState.match) {
    const match = modeState.match;
    if (match.phase === 'augment_pick') {
      if (now.getTime() >= new Date(match.turnEndsAt).getTime()) {
        modeState.battle = await createPvpAugmentBattleFromMatch(match, now);
        modeState.match = null;
        bumpPvpVersion();
      }
    } else if (match.phase === 'accept') {
      if (now.getTime() >= new Date(match.acceptEndsAt).getTime()) {
        const acceptedPlayers = match.players.filter((player) => match.accepted[player.userId]);
        modeState.match = null;
        acceptedPlayers.forEach((player) => {
          if (!isUserInAnyPvpSession(player.userId)) {
            modeState.queue.push(player);
          }
        });
        bumpPvpVersion();
      }
    } else if (['ban', 'pick'].includes(match.phase) && isPvpDraftTurnTimedOut(match, now, PVP_DRAFT_AUTO_GRACE_MS)) {
      if (match.phase === 'ban') {
        await autoBanPvpCard(match, match.turnUserId, now);
      } else {
        await autoPickPvpCard(match, match.turnUserId, now);
      }
      bumpPvpVersion();
    } else if (match.phase === 'starting' && now.getTime() >= new Date(match.startsAt).getTime()) {
      modeState.battle = await createPvpBattleFromMatch(match, now);
      modeState.match = null;
      bumpPvpVersion();
    }
  }

  if (modeState.battle?.phase === 'augment') {
    if (allAugmentSelectionsResolved(modeState.battle) || now.getTime() >= new Date(modeState.battle.augmentEndsAt).getTime()) {
      finishAugmentSelectionRound(modeState.battle, now);
      bumpPvpVersion();
    }
  }

  if (modeState.battle?.phase === 'active' && isAugmentPvpMode(modeState.battle.mode)) {
    const battle = modeState.battle;
    const currentPlayer = getPvpPlayer(battle, battle.currentUserId);
    if (currentPlayer?.pendingAction) {
      const currentUserId = String(currentPlayer.userId || '');
      const executeAtMs = battle.pendingActionUserId === currentUserId
        ? new Date(battle.pendingActionExecuteAt || 0).getTime()
        : 0;
      if (!executeAtMs || !Number.isFinite(executeAtMs)) {
        battle.pendingActionUserId = currentUserId;
        battle.pendingActionExecuteAt = new Date(now.getTime() + PVP_AUGMENT_RESERVED_ACTION_FRAME_MS);
        const currentTurnEndMs = new Date(battle.turnEndsAt || now).getTime() || now.getTime();
        battle.turnEndsAt = new Date(Math.max(currentTurnEndMs, new Date(battle.pendingActionExecuteAt).getTime()));
        bumpPvpVersion();
      } else if (now.getTime() >= executeAtMs) {
        await executePvpTurn(battle, now, { reserved: true });
      }
    } else {
      battle.pendingActionUserId = null;
      battle.pendingActionExecuteAt = null;
    }
  }

  if (
    modeState.battle?.phase === 'active'
    && !getPvpPlayer(modeState.battle, modeState.battle.currentUserId)?.pendingAction
    && now.getTime() >= new Date(modeState.battle.turnEndsAt).getTime()
  ) {
    await executePvpTurn(modeState.battle, now, { timedOut: true });
  }

  if (modeState.battle?.phase === 'finished' && modeState.battle.finishedAt && now.getTime() - new Date(modeState.battle.finishedAt).getTime() > 20000) {
    modeState.battle = null;
    modeState.viewers = {};
    bumpPvpVersion();
  }
}

async function advancePvpStateUnlocked(now = new Date()) {
  for (const [mode, modeState] of getPvpModeEntries()) {
    await advancePvpModeStateUnlocked(mode, modeState, now);
  }
}

async function advancePvpState(now = new Date()) {
  const run = pvpAdvanceQueue.then(() => advancePvpStateUnlocked(now));
  pvpAdvanceQueue = run.catch((err) => {
    console.error('PVP advance lock error:', err);
  });
  return run;
}

function buildPvpEffectsSnapshot(player) {
  const normalizeEffect = (effect, type) => ({
    type,
    id: effect.id,
    name: effect.pendingActivation ? `${effect.name} 준비` : effect.name,
    turns: Number(effect.turns || 0),
    count: Number(effect.count || 0),
    desc: `${effect.desc || ''}${effect.pendingActivation ? ' (다음 자신의 턴부터 적용)' : ''}`
  });
  return [
    ...(player.buffs || []).map((effect) => normalizeEffect(effect, 'buff')),
    ...(player.debuffs || []).map((effect) => normalizeEffect(effect, 'debuff'))
  ];
}

function isPvpViewerParticipant(players = [], viewerUserId = null) {
  if (!viewerUserId) return false;
  return players.some((player) => player.userId === String(viewerUserId));
}

function getPvpDisplayNameForViewer(player, players = [], mode = PVP_MODE_RANKED, viewerUserId = null) {
  const originalName = player?.displayName || '';
  if (!isRankedPvpMode(mode)) return originalName;
  if (!isPvpViewerParticipant(players, viewerUserId)) return originalName;
  if (player.userId === String(viewerUserId)) return originalName;
  return PVP_RANKED_ANONYMOUS_OPPONENT_NAME;
}

function buildPvpPlayersForViewer(players = [], mode = PVP_MODE_RANKED, viewerUserId = null) {
  return players.map((player) => ({
    ...player,
    displayName: getPvpDisplayNameForViewer(player, players, mode, viewerUserId)
  }));
}

function buildPvpSpectatorsForViewer(viewerMap, players = [], mode = PVP_MODE_RANKED, viewerUserId = null, now = new Date()) {
  const spectators = buildSpectatorList(viewerMap, players.map((player) => player.userId), now);
  if (!isRankedPvpMode(mode) || !isPvpViewerParticipant(players, viewerUserId)) {
    return spectators;
  }
  return spectators.length
    ? [{ userId: 'ranked-spectator-count', displayName: `${spectators.length}명`, countOnly: true }]
    : [];
}

function anonymizePvpTextForViewer(text, players = [], mode = PVP_MODE_RANKED, viewerUserId = null) {
  if (!text || !isRankedPvpMode(mode) || !isPvpViewerParticipant(players, viewerUserId)) {
    return text;
  }

  return players
    .filter((player) => player.userId !== String(viewerUserId) && player.displayName)
    .reduce(
      (output, player) => String(output).split(player.displayName).join(PVP_RANKED_ANONYMOUS_OPPONENT_NAME),
      String(text)
    );
}

function buildPvpBattleSnapshot(battle, viewerUserId = null) {
  if (!battle) return null;
  const modeState = getPvpModeStateForBattle(battle);
  const viewerIsParticipant = isPvpViewerParticipant(battle.players, viewerUserId);
  return {
    battleId: battle.battleId,
    mode: normalizePvpMode(battle.mode),
    modeLabel: getPvpModeLabel(battle.mode),
    isRanked: isRankedPvpMode(battle.mode),
    phase: battle.phase,
    currentUserId: battle.currentUserId,
    firstUserId: battle.firstUserId,
    turnNumber: battle.turnNumber,
    roundNumber: battle.roundNumber || battle.turnNumber,
    turnEndsAt: battle.turnEndsAt,
    augmentRound: battle.augmentRound || null,
    augmentTier: battle.augmentTier || null,
    augmentEndsAt: battle.augmentEndsAt || null,
    augmentSelected: battle.augmentSelected || {},
    teamKills: battle.teamKills || null,
    killTarget: battle.killTarget || null,
    winnerTeam: battle.winnerTeam || null,
    winnerUserId: battle.winnerUserId,
    loserUserId: battle.loserUserId,
    finishedAt: battle.finishedAt,
    ratingChange: battle.ratingChange || null,
    isParticipant: viewerIsParticipant,
    currentBet: viewerUserId && battle.bets ? (battle.bets[viewerUserId] || null) : null,
    spectators: buildPvpSpectatorsForViewer(modeState.viewers, battle.players, battle.mode, viewerUserId),
    players: battle.players.map((player) => ({
      userId: player.userId,
      displayName: getPvpDisplayNameForViewer(player, battle.players, battle.mode, viewerUserId),
      isSelf: viewerUserId ? player.userId === String(viewerUserId) : false,
      hp: player.hp,
      maxHp: player.maxHp,
      shield: player.shield,
      team: player.team || null,
      teamSlot: Number.isInteger(player.teamSlot) ? player.teamSlot : null,
      kills: Number(player.kills || 0),
      deaths: Number(player.deaths || 0),
      respawnAtRound: Number(player.respawnAtRound || 0),
      augmentIds: Array.isArray(player.augmentIds) ? player.augmentIds : [],
      augments: (Array.isArray(player.augmentIds) ? player.augmentIds : [])
        .map((augmentId) => PVP_AUGMENT_DATA[augmentId])
        .filter(Boolean)
        .map((augment) => ({
          id: augment.id,
          tier: augment.tier,
          name: augment.name,
          desc: augment.desc
        })),
      augmentOptions: Array.isArray(player.augmentOptions) ? player.augmentOptions : [],
      pendingAction: player.pendingAction || null,
      lastHpLoss: player.lastHpLoss || 0,
      lastShieldLoss: player.lastShieldLoss || 0,
      plannedCardIndex: Number.isInteger(player.plannedCardIndex) ? player.plannedCardIndex : null,
      statusEffects: buildPvpEffectsSnapshot(player),
      cards: player.cards.map((card, index) => ({
        ...card,
        slotIndex: index,
        cooldownRemaining: Number(card.cooldownRemaining || 0)
      }))
    })),
    recentLogs: battle.logs
      .slice(-20)
      .reverse()
      .map((log) => anonymizePvpTextForViewer(log, battle.players, battle.mode, viewerUserId))
  };
}

function buildPvpModeSummary(mode, modeState, userId, user) {
  const normalizedMode = normalizePvpMode(mode);
  const participantInMatch = Boolean(userId && modeState.match?.players?.some((player) => player.userId === userId));
  const participantInBattle = Boolean(userId && modeState.battle?.players?.some((player) => player.userId === userId));
  const queued = Boolean(userId && modeState.queue.some((entry) => entry.userId === userId));
  return {
    mode: normalizedMode,
    label: getPvpModeLabel(normalizedMode),
    isRanked: isRankedPvpMode(normalizedMode),
    canQueue: Boolean(user && (isPracticePvpMode(normalizedMode) || user.gameState.level >= PVP_MIN_LEVEL) && !modeState.battle && !modeState.match && !isUserInAnyPvpSession(userId)),
    isQueued: queued,
    queueCount: modeState.queue.length,
    hasActiveSession: Boolean(modeState.match || modeState.battle),
    isParticipant: participantInMatch || participantInBattle
  };
}

let pvpPollAdvanceInFlight = false;

async function advancePvpStateForPoll(now = new Date()) {
  if (pvpPollAdvanceInFlight) return;
  pvpPollAdvanceInFlight = true;
  try {
    await advancePvpState(now);
  } finally {
    pvpPollAdvanceInFlight = false;
  }
}

async function buildPvpStateResponse(user, now = new Date(), requestedMode = PVP_MODE_RANKED, options = {}) {
  await processWeeklyPvpSeasonIfNeeded(now);
  if (options.poll) {
    await advancePvpStateForPoll(now);
  } else {
    await advancePvpState(now);
  }
  const responseNow = new Date();
  const userId = user?._id ? String(user._id) : null;
  const selectedMode = normalizePvpMode(requestedMode);
  const selectedModeState = getPvpModeState(selectedMode);
  const pvpCacheKey = options.poll && userId
    ? ['pvp', userId, selectedMode, pvpState.version, selectedModeState.queue.length, selectedModeState.match?.matchId || '', selectedModeState.match?.phase || '', selectedModeState.match?.turnUserId || '', selectedModeState.battle?.battleId || '', selectedModeState.battle?.turnUserId || '', (user.cards || []).length, (user.enhancedCards || []).length].join(':')
    : null;
  if (pvpCacheKey) {
    const cachedPvp = getStateResponseCache(pvpStateResponseCache, pvpCacheKey);
    if (cachedPvp) return cachedPvp;
  }
  const match = selectedModeState.match;
  const matchIsParticipant = Boolean(userId && match?.players?.some((player) => player.userId === userId));
  const matchPlayersForViewer = match ? buildPvpPlayersForViewer(match.players, match.mode, userId) : [];
  const matchPayload = match ? {
    matchId: match.matchId,
    mode: normalizePvpMode(match.mode),
    modeLabel: getPvpModeLabel(match.mode),
    isRanked: isRankedPvpMode(match.mode),
    phase: match.phase,
    players: matchPlayersForViewer,
    accepted: match.accepted,
    acceptEndsAt: match.acceptEndsAt,
    turnUserId: match.turnUserId,
    turnEndsAt: match.turnEndsAt,
    startsAt: match.startsAt || null,
    bans: match.bans,
    picks: match.picks,
    leftovers: match.leftovers || {},
    candidates: match.candidates || {},
    pickDone: match.pickDone || {},
    pickTurnIndex: match.pickTurnIndex || 0,
    currentBet: userId && match.bets ? (match.bets[userId] || null) : null,
    canBet: Boolean(isRankedPvpMode(match.mode) && userId && !match.players.some((player) => player.userId === userId) && ['ban', 'pick'].includes(match.phase) && !(match.bets || {})[userId]),
    bannedCardIds: getPvpBannedCardIds(match),
    pickedCardIds: getPvpPickedCardIds(match),
    allCards: getAllPvpBanCardsCached(),
    ownedCards: matchIsParticipant ? getOwnedPvpPickCards(user) : [],
    logs: match.logs.slice(-8).map((log) => anonymizePvpTextForViewer(log, match.players, match.mode, userId)),
    spectators: buildPvpSpectatorsForViewer(selectedModeState.viewers, match.players, match.mode, userId),
    isParticipant: Boolean(userId && match.players.some((player) => player.userId === userId)),
    isMyTurn: Boolean(userId && match.turnUserId === userId)
  } : null;
  const modes = Object.fromEntries(getPvpModeEntries().map(([mode, modeState]) => [
    mode,
    buildPvpModeSummary(mode, modeState, userId, user)
  ]));

  const pvpResponse = {
    version: pvpState.version,
    mode: selectedMode,
    modeLabel: getPvpModeLabel(selectedMode),
    modes,
    serverNow: responseNow.toISOString(),
    minLevel: PVP_MIN_LEVEL,
    canQueue: modes[selectedMode]?.canQueue || false,
    isQueued: modes[selectedMode]?.isQueued || false,
    queueCount: modes[selectedMode]?.queueCount || 0,
    hasActiveSession: modes[selectedMode]?.hasActiveSession || false,
    match: matchPayload,
    battle: buildPvpBattleSnapshot(selectedModeState.battle, userId)
  };
  if (pvpCacheKey) setStateResponseCache(pvpStateResponseCache, pvpCacheKey, pvpResponse);
  return pvpResponse;
}

async function sendPvpStateError(res, user, now, status, msg, mode = PVP_MODE_RANKED) {
  return res.status(status).json({
    msg,
    pvp: await buildPvpStateResponse(user, now, mode)
  });
}

function createPvpQueueEntry(user) {
  return {
    userId: String(user._id),
    displayName: getCompactNickname(user, 18)
  };
}

function removePvpQueueUser(userId, modeState = null) {
  const normalizedUserId = String(userId);
  if (modeState) {
    modeState.queue = modeState.queue.filter((entry) => entry.userId !== normalizedUserId);
    return;
  }
  getPvpModeEntries().forEach(([, state]) => {
    state.queue = state.queue.filter((entry) => entry.userId !== normalizedUserId);
  });
}

function startPvpAcceptMatch(modeState, mode, playerA, playerB, now = new Date()) {
  const players = Math.random() < 0.5 ? [playerA, playerB] : [playerB, playerA];
  const [firstPlayer, secondPlayer] = players;
  modeState.match = {
    matchId: crypto.randomUUID(),
    mode: normalizePvpMode(mode),
    modeLabel: getPvpModeLabel(mode),
    isRanked: isRankedPvpMode(mode),
    phase: 'accept',
    players,
    accepted: {
      [firstPlayer.userId]: false,
      [secondPlayer.userId]: false
    },
    acceptEndsAt: new Date(now.getTime() + PVP_ACCEPT_MS),
    turnUserId: firstPlayer.userId,
    turnEndsAt: null,
    startsAt: null,
    bans: {
      [firstPlayer.userId]: [],
      [secondPlayer.userId]: []
    },
    picks: {
      [firstPlayer.userId]: [],
      [secondPlayer.userId]: []
    },
    bets: {},
    pickDone: {
      [firstPlayer.userId]: false,
      [secondPlayer.userId]: false
    },
    pickTurnIndex: 0,
    logs: [`${getPvpModeLabel(mode)} 개인면담 매칭이 성사되었습니다. 5초 안에 입장해주세요. 1P/2P 순서는 무작위로 배정되었습니다.`]
  };
  bumpPvpVersion();
}

function startPvpPracticeMatch(modeState, player, now = new Date()) {
  modeState.queue = modeState.queue.filter((entry) => entry.userId !== player.userId);
  modeState.match = {
    matchId: crypto.randomUUID(),
    mode: PVP_MODE_PRACTICE,
    modeLabel: getPvpModeLabel(PVP_MODE_PRACTICE),
    isRanked: false,
    phase: 'pick',
    players: [player],
    accepted: { [player.userId]: true },
    acceptEndsAt: null,
    turnUserId: player.userId,
    turnEndsAt: new Date(now.getTime() + PVP_PICK_TURN_MS),
    startsAt: null,
    bans: { [player.userId]: [] },
    picks: { [player.userId]: [] },
    bets: {},
    pickDone: { [player.userId]: false },
    pickTurnIndex: 0,
    pickSequenceIndices: [...PVP_PRACTICE_PICK_SEQUENCE_INDICES],
    logs: ['면담 연습모드 카드 선택을 시작합니다. 밴 없이 내 카드 5장을 고르면 바로 입장합니다.']
  };
  bumpPvpVersion();
}

function startPvpTournamentMatch(modeState, playerA, playerB, tournamentMatchId, now = new Date(), options = {}) {
  const requestedFirstUserId = options.firstPlayerUserId ? String(options.firstPlayerUserId) : '';
  let players;
  if (requestedFirstUserId && String(playerB?.userId || '') === requestedFirstUserId) {
    players = [playerB, playerA];
  } else if (requestedFirstUserId && String(playerA?.userId || '') === requestedFirstUserId) {
    players = [playerA, playerB];
  } else {
    players = Math.random() < 0.5 ? [playerA, playerB] : [playerB, playerA];
  }
  const [firstPlayer, secondPlayer] = players;
  const bestOf = Math.max(1, Math.floor(Number(options.bestOf || 1)));
  const gameNumber = Math.max(1, Math.floor(Number(options.gameNumber || 1)));
  const seriesScoreText = bestOf > 1
    ? ` 현재 스코어 ${Number(options.scoreA || 0)}:${Number(options.scoreB || 0)}, ${gameNumber}세트입니다.`
    : '';
  modeState.match = {
    matchId: crypto.randomUUID(),
    mode: PVP_MODE_RANKED,
    modeLabel: getPvpModeLabel(PVP_MODE_RANKED),
    isRanked: true,
    phase: 'ban',
    players,
    accepted: {
      [firstPlayer.userId]: true,
      [secondPlayer.userId]: true
    },
    acceptEndsAt: null,
    turnUserId: firstPlayer.userId,
    turnEndsAt: new Date(now.getTime() + PVP_BAN_TURN_MS),
    startsAt: null,
    bans: {
      [firstPlayer.userId]: [],
      [secondPlayer.userId]: []
    },
    picks: {
      [firstPlayer.userId]: [],
      [secondPlayer.userId]: []
    },
    bets: {},
    pickDone: {
      [firstPlayer.userId]: false,
      [secondPlayer.userId]: false
    },
    pickTurnIndex: 0,
    pickSequenceIndices: [...PVP_PICK_SEQUENCE_INDICES],
    tournamentMatchId: String(tournamentMatchId || ''),
    logs: [`면담 토너먼트 대진이 시작되었습니다. 랭크 규칙으로 밴픽을 진행합니다.${seriesScoreText}`]
  };
  bumpPvpVersion();
}

function startPvpAugmentMatch(modeState, queuedPlayers, now = new Date()) {
  const shuffled = [...queuedPlayers].sort(() => Math.random() - 0.5).slice(0, PVP_AUGMENT_QUEUE_SIZE);
  const players = shuffled.map((entry, index) => ({
    ...entry,
    team: index < 2 ? 'red' : 'blue',
    teamSlot: index % 2
  }));
  const candidates = buildAugmentCardCandidatesForPlayers(players);
  modeState.match = {
    matchId: crypto.randomUUID(),
    mode: PVP_MODE_AUGMENT_3V3,
    modeLabel: getPvpModeLabel(PVP_MODE_AUGMENT_3V3),
    isRanked: false,
    phase: 'augment_pick',
    players,
    accepted: {},
    acceptEndsAt: null,
    turnUserId: null,
    turnEndsAt: new Date(now.getTime() + PVP_AUGMENT_PICK_MS),
    startsAt: null,
    bans: {},
    picks: Object.fromEntries(players.map((player) => [player.userId, []])),
    leftovers: {},
    candidates,
    pickDone: Object.fromEntries(players.map((player) => [player.userId, false])),
    pickTurnIndex: 0,
    logs: ['증강 2대2 면담 매칭이 성사되었습니다. 50초 안에 후보 5장 중 3장을 선택해주세요.']
  };
  bumpPvpVersion();
}

function finalizePvpAugmentPicks(match) {
  if (!match || match.phase !== 'augment_pick') return;
  match.players.forEach((player) => {
    const userId = player.userId;
    const candidates = Array.isArray(match.candidates?.[userId]) ? match.candidates[userId] : [];
    const current = Array.isArray(match.picks?.[userId]) ? match.picks[userId] : [];
    const unique = [];
    current.forEach((pick) => {
      if (unique.length >= PVP_AUGMENT_PICK_COUNT) return;
      if (candidates.some((candidate) => candidate.cardId === pick.cardId) && !unique.some((entry) => entry.cardId === pick.cardId)) {
        unique.push({ cardId: pick.cardId, enhancementLevel: pick.enhancementLevel ?? 5 });
      }
    });
    candidates.forEach((candidate) => {
      if (unique.length >= PVP_AUGMENT_PICK_COUNT) return;
      if (!unique.some((entry) => entry.cardId === candidate.cardId)) {
        unique.push({ cardId: candidate.cardId, enhancementLevel: candidate.enhancementLevel ?? 5 });
      }
    });
    match.picks[userId] = unique.slice(0, PVP_AUGMENT_PICK_COUNT);
    const leftover = candidates.find((candidate) => !match.picks[userId].some((pick) => pick.cardId === candidate.cardId));
    if (leftover) match.leftovers[userId] = { cardId: leftover.cardId, enhancementLevel: leftover.enhancementLevel ?? 5 };
    match.pickDone[userId] = true;
  });
}

function getAugmentTurnOrderPlayers(battle) {
  const players = Array.isArray(battle?.players) ? battle.players : [];
  if (Array.isArray(battle?.turnOrderUserIds) && battle.turnOrderUserIds.length) {
    const byId = new Map(players.map((player) => [String(player.userId), player]));
    const ordered = battle.turnOrderUserIds.map((userId) => byId.get(String(userId))).filter(Boolean);
    if (ordered.length) return ordered;
  }
  const redPlayers = players
    .filter((player) => player.team === 'red')
    .sort((left, right) => Number(left.teamSlot || 0) - Number(right.teamSlot || 0));
  const bluePlayers = players
    .filter((player) => player.team === 'blue')
    .sort((left, right) => Number(left.teamSlot || 0) - Number(right.teamSlot || 0));
  const order = [];
  const maxSlots = Math.max(redPlayers.length, bluePlayers.length);
  for (let slot = 0; slot < maxSlots; slot += 1) {
    if (redPlayers[slot]) order.push(redPlayers[slot]);
    if (bluePlayers[slot]) order.push(bluePlayers[slot]);
  }
  return order;
}

function getAugmentTeamPlayers(battle, team) {
  return battle.players.filter((player) => player.team === team);
}

function getAugmentEnemyPlayers(battle, team) {
  return battle.players.filter((player) => player.team !== team);
}

function getAliveAugmentTargets(players = []) {
  return players.filter((player) => Number(player.hp || 0) > 0);
}

const PVP_AUGMENT_ALLY_TARGET_TYPES = new Set(['ally', 'ally_pair']);
const PVP_AUGMENT_ALLY_EFFECT_TYPES = new Set([
  'party_shield',
  'party_heal',
  'party_missing_hp_heal_negate',
  'target_heal',
  'target_missing_hp_heal',
  'target_taunt_damage_reduction',
  'target_attack_buff',
  'target_final_damage_buff',
  'target_debuff_guard',
  'champion_guard',
  'party_cooldown_reduce',
  'random_party_negate_hit',
  'party_negate_hit_by_level',
  'party_bread_buff',
  'party_cleanse',
  'party_crit_bonus',
  'party_hype_crit',
  'random_party_attack_buff',
  'target_pair_guard_buff',
  'lowest_level_buff',
  'random_ally_sacrifice_buff',
  'random_shield'
]);

const PVP_AUGMENT_SELF_EFFECT_TYPES = new Set([
  'self_counter',
  'self_celine_buff',
  'self_negate_hit',
  'self_debuff_reflect'
]);

function isPvpAugmentAllySkill(card = {}) {
  return PVP_AUGMENT_ALLY_TARGET_TYPES.has(card?.targetType) || PVP_AUGMENT_ALLY_EFFECT_TYPES.has(card?.effectType);
}

function isPvpAugmentSelfSkill(card = {}) {
  return PVP_AUGMENT_SELF_EFFECT_TYPES.has(card?.effectType);
}

function applyAugmentEffectsToPlayer(player, augmentId, battle = null) {
  const augment = PVP_AUGMENT_DATA[augmentId];
  if (!player || !augment) return;
  player.augmentIds = [...new Set([...(player.augmentIds || []), augmentId])];
  const effects = augment.effects || {};
  if (effects.maxHp) {
    const hpDelta = Number(effects.maxHp || 0);
    player.maxHp = Math.max(1, Number(player.maxHp || PVP_MAX_HP) + hpDelta);
    player.hp = Math.max(1, Math.min(player.maxHp, Number(player.hp || 0) + hpDelta));
  }
  if (effects.healNow) {
    player.hp = Math.min(Number(player.maxHp || PVP_MAX_HP), Number(player.hp || 0) + Number(effects.healNow || 0));
  }
  if (effects.attackBonus) player.augmentAttackBonus = Number(player.augmentAttackBonus || 0) + Number(effects.attackBonus || 0);
  if (effects.damageTakenBonus) player.augmentDamageTakenBonus = Number(player.augmentDamageTakenBonus || 0) + Number(effects.damageTakenBonus || 0);
  if (effects.cardEffectBonus) player.cardEffectEquipmentBonusPercent = Number(player.cardEffectEquipmentBonusPercent || 0) + Number(effects.cardEffectBonus || 0);
  if (effects.reduceCooldownNow) {
    player.cards.forEach((card) => { card.cooldownRemaining = Math.max(0, Number(card.cooldownRemaining || 0) - Number(effects.reduceCooldownNow || 0)); });
  }
  if (effects.deathCheat) player.augmentDeathCheat = Number(player.augmentDeathCheat || 0) + Number(effects.deathCheat || 0);
  if (effects.swapRandomCardWithEnemy && battle) {
    const enemies = getAugmentEnemyPlayers(battle, player.team)
      .filter((enemy) => Array.isArray(enemy.cards) && enemy.cards.length > 0);
    const enemy = pickRandomEntry(enemies);
    if (enemy && Array.isArray(player.cards) && player.cards.length > 0) {
      const playerIndex = Math.floor(Math.random() * player.cards.length);
      const enemyIndex = Math.floor(Math.random() * enemy.cards.length);
      const playerCard = { ...player.cards[playerIndex], cooldownRemaining: 0 };
      const enemyCard = { ...enemy.cards[enemyIndex], cooldownRemaining: 0 };
      player.cards[playerIndex] = enemyCard;
      enemy.cards[enemyIndex] = playerCard;
      battle.logs.push(`${player.displayName}의 카드 1장이 ${enemy.displayName}의 카드와 바뀌었습니다.`);
    }
  }
}

function prepareAugmentSelectionRound(battle, roundNumber, now = new Date()) {
  battle.phase = 'augment';
  battle.augmentRound = roundNumber;
  battle.augmentTier = pickWeightedAugmentTier();
  battle.augmentEndsAt = new Date(now.getTime() + PVP_AUGMENT_SELECT_MS);
  battle.augmentSelected = {};
  battle.players.forEach((player) => {
    if (Number(player.hp || 0) > 0) {
      player.augmentOptions = pickAugmentOptions(3, battle.augmentTier);
    }
  });
  battle.logs.push(`${roundNumber}턴 증강 선택이 시작되었습니다. 이번 라운드는 ${PVP_AUGMENT_TIER_LABELS[battle.augmentTier] || battle.augmentTier} 증강입니다. 40초 안에 선택해주세요.`);
}

function startAugmentActiveTurn(battle, now = new Date()) {
  battle.phase = 'active';
  battle.augmentEndsAt = null;
  battle.currentUserId = getAugmentTurnOrderPlayers(battle)[battle.turnCursor || 0]?.userId || battle.players[0]?.userId || null;
  battle.turnEndsAt = new Date(now.getTime() + PVP_AUGMENT_TURN_MS);
}

async function createPvpAugmentBattleFromMatch(match, now = new Date()) {
  finalizePvpAugmentPicks(match);
  const userIds = match.players.map((player) => player.userId);
  const users = await User.find({ _id: { $in: userIds } });
  const userMap = new Map(users.map((user) => [String(user._id), user]));
  const players = match.players.map((player) => {
    const user = userMap.get(player.userId);
    if (!user) return null;
    ensureUserDefaults(user);
    const participant = createPvpParticipantFromUser(user, match, match.picks[player.userId] || []);
    participant.maxHp = PVP_AUGMENT_MAX_HP;
    participant.hp = PVP_AUGMENT_MAX_HP;
    participant.team = player.team;
    participant.teamSlot = player.teamSlot;
    participant.kills = 0;
    participant.deaths = 0;
    participant.augmentIds = [];
    participant.augmentOptions = [];
    participant.respawnAtRound = 0;
    return participant;
  }).filter(Boolean);
  const battle = {
    battleId: crypto.randomUUID(),
    mode: PVP_MODE_AUGMENT_3V3,
    modeLabel: getPvpModeLabel(PVP_MODE_AUGMENT_3V3),
    isRanked: false,
    phase: 'augment',
    players,
    turnOrderUserIds: getAugmentTurnOrderPlayers({ players }).map((player) => player.userId),
    firstUserId: getAugmentTurnOrderPlayers({ players })[0]?.userId || players[0]?.userId,
    currentUserId: null,
    turnNumber: 1,
    roundNumber: 1,
    turnCursor: 0,
    turnEndsAt: null,
    teamKills: { red: 0, blue: 0 },
    killTarget: PVP_AUGMENT_KILL_TARGET,
    logs: ['증강 2대2 면담 전투가 시작되었습니다. 먼저 첫 번째 증강을 선택합니다.'],
    winnerTeam: null,
    winnerUserId: null,
    loserUserId: null,
    finishedAt: null,
    augmentRound: 1,
    augmentTier: null,
    augmentEndsAt: null,
    augmentSelected: {}
  };
  applyPvpBattleStartPassives(battle);
  prepareAugmentSelectionRound(battle, 1, now);
  return battle;
}


async function finalizeRaidBattle(activeBattle, now = new Date()) {
  if (!activeBattle || activeBattle.finalized) return;
  activeBattle.finalizing = true;
  const battleMode = getRaidModeFromBattle(activeBattle);
  const modeRewardMultiplier = Number(getRaidModeConfig(battleMode).rewardMultiplier || 1);
  const participantIds = activeBattle.participants.map((participant) => participant.userId);
  const raidSpecialRewardType = Math.random() < RAID_SPECIAL_REWARD_CHANCE
    ? (Math.random() < 0.5 ? 'equipment' : 'scroll')
    : null;
  const sharedBaseRewards = activeBattle.winner === 'players'
    ? {
        businessCards: Math.floor(Math.random() * 3),
        bacchus: 3 + Math.floor(Math.random() * 3),
        monami: Math.floor(Math.random() * 2),
        moneyReward: 100000 + Math.floor(Math.random() * 200001),
        fragments: 1 + Math.floor(Math.random() * 5),
        equipment: raidSpecialRewardType === 'equipment'
          ? createEquipmentEntry(Math.random() < 0.5 ? EQUIPMENT_TYPE_CARD : EQUIPMENT_TYPE_ATTACK)
          : null,
        scrollItemId: raidSpecialRewardType === 'scroll' ? getRandomEquipmentScrollItemId() : null
      }
    : null;
  const maxLottoSuccessChance = activeBattle.participants.reduce(
    (maxChance, participant) => participant.lottoRewardBuff ? Math.max(maxChance, Number(participant.lottoRewardSuccessChance || 0.5)) : maxChance,
    0
  );
  const sharedLottoOutcome = activeBattle.winner === 'players' && maxLottoSuccessChance > 0
    ? (Math.random() < maxLottoSuccessChance ? 'success' : 'fail')
    : null;
  const rewardedParticipantIds = new Set((activeBattle.rewardedParticipantIds || []).map((entry) => String(entry)));
  activeBattle.rewardedParticipantIds = [...rewardedParticipantIds];

  const applyRaidOutcomeToUser = (user, participant) => {
    ensureUserDefaults(user);
    calculateOfflineGains(user, now);

    if (activeBattle.winner === 'players') {
      const rewardRatio = getRaidBossRewardRatio(participant.level);
      let rewardMultiplier = modeRewardMultiplier;
      const rewardNotes = [];
      const derivedStats = calculateDerivedStats(user, now);
      if (modeRewardMultiplier !== 1) {
        rewardNotes.push(`${getRaidModeConfig(battleMode).label} 모드 보상 ${modeRewardMultiplier.toFixed(1)}배`);
      }
      const levelRewardMultiplier = getRaidParticipantRewardMultiplierByLevel(participant.level, battleMode);
      if (levelRewardMultiplier !== 1) {
        rewardMultiplier *= levelRewardMultiplier;
        rewardNotes.push(`${RAID_NORMAL_HIGH_LEVEL_REWARD_THRESHOLD}레벨 이상 노멀 참여 보정으로 기본 보상 1/3`);
      }
      if (derivedStats.raidRewardBonusPercent > 0) {
        const rewardBonusMultiplier = 1 + derivedStats.raidRewardBonusPercent / 100;
        rewardMultiplier *= rewardBonusMultiplier;
        rewardNotes.push(`보상 증가 효과로 보스 보상 ${rewardBonusMultiplier.toFixed(2)}배`);
      }
      if (participant.sojuRewardBuff) {
        rewardMultiplier *= Number(participant.sojuRewardMultiplier || 1);
        rewardNotes.push(`소주각? 적용으로 전리품 ${Number(participant.sojuRewardMultiplier || 1).toFixed(1)}배`);
      }
      if (participant.hoiRewardBuff) {
        rewardMultiplier *= Number(participant.hoiRewardMultiplier || 1);
        rewardNotes.push(`HOI 특수 기믹으로 전리품 ${Number(participant.hoiRewardMultiplier || 1).toFixed(1)}배`);
      }
      if (participant.lottoRewardBuff) {
        if (sharedLottoOutcome === 'success') {
          rewardMultiplier *= 3;
          rewardNotes.push('이번엔 될거같아 성공으로 전리품 3배');
        } else {
          rewardMultiplier = 0;
          rewardNotes.push('이번엔 될거같아 실패로 보상 없음');
        }
      }
      const activeExpBuffEffects = getActiveBuffEffects(user, now);
      const activeExpBuffMultiplier = Math.max(0, 1 + Number(activeExpBuffEffects.expBonusAdd || 0));
      const expBonusMultiplier =
        (1 + (derivedStats.expBonusPercent + (derivedStats.branchRaidExpBonusPercent || 0) + (derivedStats.raidExpBonusPercent || 0)) / 100)
        * activeExpBuffMultiplier;
      if (activeExpBuffMultiplier !== 1) {
        rewardNotes.push(`임시 경험치 버프로 경험치 ${activeExpBuffMultiplier.toFixed(2)}배`);
      }
      const expReward = Math.floor(getRequiredExp(participant.level) * rewardRatio * rewardMultiplier * expBonusMultiplier);
      const businessCards = Math.max(0, Math.round((sharedBaseRewards?.businessCards || 0) * rewardMultiplier));
      const bacchus = Math.max(0, Math.round((sharedBaseRewards?.bacchus || 0) * rewardMultiplier));
      const monami = Math.max(0, Math.round((sharedBaseRewards?.monami || 0) * rewardMultiplier));
      const moneyReward = (sharedBaseRewards?.moneyReward || 0) * rewardMultiplier;
      const fragments = Math.max(0, Math.round((sharedBaseRewards?.fragments || 0) * rewardMultiplier));
      const equipmentCount = sharedBaseRewards?.equipment ? Math.max(0, Math.round(rewardMultiplier)) : 0;
      const scrollCount = sharedBaseRewards?.scrollItemId ? Math.max(0, Math.round(rewardMultiplier)) : 0;
      user.gameState.exp += expReward;
      checkLevelUp(user);
      addItemToInventory(user, 'business_card', businessCards);
      addItemToInventory(user, 'bacchus', bacchus);
      addItemToInventory(user, 'reward_pen_monami', monami);
      addItemToInventory(user, 'equipment_fragment', fragments);
      for (let index = 0; index < equipmentCount; index += 1) {
        user.equipments.push(cloneEquipmentEntry(sharedBaseRewards.equipment));
      }
      if (scrollCount > 0) {
        addItemToInventory(user, sharedBaseRewards.scrollItemId, scrollCount);
      }
      user.gameState.money += moneyReward;
      const rewardSummaryParts = [];
      if (expReward > 0) rewardSummaryParts.push(`경험치 ${expReward.toLocaleString()}`);
      if (businessCards > 0) rewardSummaryParts.push(`명함 ${Number(businessCards).toLocaleString()}장`);
      if (bacchus > 0) rewardSummaryParts.push(`박카스 ${Number(bacchus).toLocaleString()}개`);
      if (monami > 0) rewardSummaryParts.push(`보상 모나미 볼펜 ${Number(monami).toLocaleString()}개`);
      if (fragments > 0) rewardSummaryParts.push(`장비 파편 ${Number(fragments).toLocaleString()}개`);
      if (equipmentCount > 0) rewardSummaryParts.push(`${buildEquipmentDisplayName(sharedBaseRewards.equipment)} ${Number(equipmentCount).toLocaleString()}개`);
      if (scrollCount > 0) rewardSummaryParts.push(`${ITEM_DATA[sharedBaseRewards.scrollItemId]?.name || sharedBaseRewards.scrollItemId} ${Number(scrollCount).toLocaleString()}개`);
      if (moneyReward > 0) rewardSummaryParts.push(`${Number(moneyReward).toLocaleString()}원`);
      const rewardSummaryText = rewardSummaryParts.length ? rewardSummaryParts.join(', ') : '보상을 획득하지 못했습니다.';
      queueNotification(
        user,
        'raid_reward',
        `보스 레이드 승리! ${rewardSummaryText}${rewardNotes.length ? ` (${rewardNotes.join(', ')})` : ''}`
      );
      if ((activeBattle.potatoRehabKillUserIds || []).includes(participant.userId)) {
        const previousDamage = getPotatoRehabDamage(user);
        const levelIncrement = getPotatoRehabGrowthIncrement(participant, activeBattle);
        const nextDamage = previousDamage + levelIncrement;
        user.meta.potatoRehabDamage = nextDamage;
        user.meta.potatoRehabKillCount = getPotatoRehabKillCount(user) + 1;
        queueNotification(
          user,
          'potato_rehab_growth',
          `<감자의 재활훈련>으로 보스를 처치했습니다! 카드 데미지가 ${previousDamage.toLocaleString()}에서 ${nextDamage.toLocaleString()}로 영구 증가했습니다. (막타 ${Number(user.meta.potatoRehabKillCount || 0).toLocaleString()}회)`
        );
      }
    } else {
      queueNotification(user, 'raid_fail', '보스 레이드에서 패배했습니다. 이번에는 보상을 획득하지 못했습니다.');
    }

    reconcileTitles(user, now);
  };

  for (const participant of activeBattle.participants) {
    if (rewardedParticipantIds.has(String(participant.userId))) continue;
    try {
      if (activeBattle.winner === 'players') {
        const user = await User.findById(participant.userId);
        if (!user) throw createHttpError(404, 'User not found');
        const mailPayload = createRaidRewardMailPayload({
          activeBattle,
          participant,
          user,
          sharedBaseRewards,
          sharedLottoOutcome,
          battleMode,
          now
        });
        const mailDoc = await enqueueRaidRewardMail(user._id, mailPayload);
        if (!mailDoc?._id) {
          throw createHttpError(500, 'Raid reward mail was not persisted');
        }
        if (mailPayload?.payload?.raidReward?.dailyOnceRewardBonusUsed) {
          await User.updateOne(
            { _id: user._id },
            { $set: { 'meta.dailyAugmentRaidRewardOnceDayKey': user.meta.dailyAugmentRaidRewardOnceDayKey || getKSTDateKey(now) } }
          );
        }
      }
      rewardedParticipantIds.add(String(participant.userId));
      activeBattle.rewardedParticipantIds = [...rewardedParticipantIds];
    } catch (err) {
      if (err?.statusCode === 404) {
        rewardedParticipantIds.add(String(participant.userId));
        activeBattle.rewardedParticipantIds = [...rewardedParticipantIds];
      } else {
        console.error(`Raid finalize failed for ${participant.userId}:`, err);
      }
    }
  }

  const missingRewardParticipantIds = activeBattle.participants
    .map((participant) => String(participant.userId))
    .filter((participantId) => !rewardedParticipantIds.has(participantId));
  if (missingRewardParticipantIds.length > 0) {
    activeBattle.finalizing = false;
    activeBattle.nextActionAt = new Date(now.getTime() + RAID_ACTION_DELAY_MS);
    console.error('Raid finalize incomplete, will retry:', missingRewardParticipantIds.join(', '));
    bumpRaidVersion();
    return;
  }

  activeBattle.finalized = true;
  clearActiveRaidBattle(battleMode);
}

async function advanceRaidRoomState(mode = RAID_MODE_NORMAL, now = new Date()) {
  const room = getRaidRoom(mode);
  const activeBattle = room.activeBattle;
  if (!activeBattle) return;

  let safety = 0;
  while (room.activeBattle && safety < 500) {
    safety += 1;

    if (activeBattle.phase === 'countdown') {
      if (now.getTime() < new Date(activeBattle.countdownEndsAt).getTime()) return;
      activeBattle.phase = 'ready';
      activeBattle.readyEndsAt = new Date(now.getTime() + RAID_INITIAL_READY_MS);
      activeBattle.nextActionAt = activeBattle.readyEndsAt;
      activeBattle.logs.push('레이드가 시작되었습니다. 5초 동안 첫 행동을 준비하세요.');
      bumpRaidVersion();
      continue;
    }

    if (activeBattle.phase === 'ready') {
      if (now.getTime() < new Date(activeBattle.readyEndsAt || activeBattle.nextActionAt).getTime()) return;
      activeBattle.phase = 'active';
      activeBattle.readyEndsAt = null;
      activeBattle.nextActionAt = new Date(now.getTime() + RAID_ACTION_DELAY_MS);
      activeBattle.logs.push('전투 행동을 시작합니다.');
      bumpRaidVersion();
      continue;
    }

    if (now.getTime() < new Date(activeBattle.nextActionAt).getTime()) return;

    if (activeBattle.pendingSequence?.steps?.length) {
      executeNextRaidSequenceStep(activeBattle);
      if (activeBattle.pendingSequence?.steps?.length) {
        activeBattle.nextActionAt = new Date(now.getTime() + RAID_ACTION_DELAY_MS);
      } else {
        finalizeRaidSequence(activeBattle);
        activeBattle.nextActionAt = new Date(now.getTime() + RAID_ACTION_DELAY_MS);
      }

      if (activeBattle.bossHp <= 0) {
        activeBattle.winner = 'players';
        break;
      }
      if (getAliveRaidParticipants(activeBattle).length === 0) {
        activeBattle.winner = 'boss';
        break;
      }

      bumpRaidVersion();
      continue;
    }

    const aliveParticipants = getAliveRaidParticipants(activeBattle);
    if (activeBattle.bossHp <= 0) {
      activeBattle.winner = 'players';
      break;
    }
    if (aliveParticipants.length === 0) {
      activeBattle.winner = 'boss';
      break;
    }

    if (activeBattle.turnIndex < activeBattle.participants.length) {
      const participant = activeBattle.participants[activeBattle.turnIndex];
      if (activeBattle.turnIndex === 0) {
        resetRaidBossRoundPassiveState(activeBattle);
      }
      if (participant.hp > 0) {
        if (participant.actionLockTurns > 0) {
          activeBattle.logs.push(`${participant.displayName}님은 가발 찾는중.. 상태라 아무 행동도 할 수 없습니다.`);
          tickRaidParticipantEndOfTurn(participant, activeBattle);
          activeBattle.turnIndex += 1;
          activeBattle.nextActionAt = new Date(now.getTime() + RAID_ACTION_DELAY_MS);
        } else {
          const passiveLog = triggerRaidTurnStartPassives(participant, activeBattle);
          appendRaidActionLogs(activeBattle, passiveLog);
          const skillResult = useRaidCardSkill(participant, activeBattle);
          const queuedSteps = [];

          if (skillResult?.steps?.length) {
            const normalizedSkill = normalizeRaidActionResult(skillResult);
            normalizedSkill.logs.forEach((line) => activeBattle.logs.push(line));
            queuedSteps.push(...skillResult.steps);
          } else {
            appendRaidActionLogs(activeBattle, skillResult);
          }

          const attackResult = performRaidBasicAttack(participant, activeBattle);
          if (attackResult?.steps?.length) {
            queuedSteps.push(...attackResult.steps);
          } else {
            appendRaidActionLogs(activeBattle, attackResult);
          }

          if (queuedSteps.length) {
            queueRaidSequence(activeBattle, queuedSteps, {
              endTurnType: 'participant',
              participantUserId: participant.userId
            });
            executeNextRaidSequenceStep(activeBattle);
            if (activeBattle.pendingSequence?.steps?.length) {
              activeBattle.nextActionAt = new Date(now.getTime() + RAID_ACTION_DELAY_MS);
            } else {
              finalizeRaidSequence(activeBattle);
              activeBattle.nextActionAt = new Date(now.getTime() + RAID_ACTION_DELAY_MS);
            }
          } else {
            tickRaidParticipantEndOfTurn(participant, activeBattle);
            activeBattle.turnIndex += 1;
            activeBattle.nextActionAt = new Date(now.getTime() + RAID_ACTION_DELAY_MS);
          }
        }
      } else {
        activeBattle.logs.push(`${participant.displayName}님은 전투불능 상태입니다.`);
        activeBattle.turnIndex += 1;
        activeBattle.nextActionAt = new Date(now.getTime() + RAID_ACTION_DELAY_MS);
      }
    } else {
      const bossSideActor = getCurrentRaidBossSideActor(activeBattle);
      if (bossSideActor.type === 'minion') {
        appendRaidActionLogs(activeBattle, performRaidBossMinionAction(activeBattle, bossSideActor.minion));
        activeBattle.turnIndex += 1;
        activeBattle.nextActionAt = new Date(now.getTime() + RAID_ACTION_DELAY_MS);
      } else {
        const bossResult = performRaidBossAction(activeBattle);
        if (bossResult?.steps?.length) {
          const normalizedBossResult = normalizeRaidActionResult(bossResult);
          normalizedBossResult.logs.forEach((line) => activeBattle.logs.push(line));
          queueRaidSequence(activeBattle, bossResult.steps, {
            endTurnType: 'boss',
            clearRoundShieldsAtEnd: Boolean(bossResult.clearRoundShieldsAtEnd)
          });
          executeNextRaidSequenceStep(activeBattle);
          if (activeBattle.pendingSequence?.steps?.length) {
            activeBattle.nextActionAt = new Date(now.getTime() + RAID_ACTION_DELAY_MS);
          } else {
            finalizeRaidSequence(activeBattle);
            activeBattle.nextActionAt = new Date(now.getTime() + RAID_ACTION_DELAY_MS);
          }
        } else {
          appendRaidActionLogs(activeBattle, bossResult);
          clearRoundShieldEffects(activeBattle);
          tickRaidBossEndOfTurn(activeBattle);
          activeBattle.nextActionAt = new Date(now.getTime() + RAID_ACTION_DELAY_MS);
        }
      }
    }

    if (activeBattle.bossHp <= 0) {
      activeBattle.winner = 'players';
      break;
    }
    if (getAliveRaidParticipants(activeBattle).length === 0) {
      activeBattle.winner = 'boss';
      break;
    }
    bumpRaidVersion();
  }

  if (room.activeBattle?.winner) {
    if (room.activeBattle.finalizing || room.activeBattle.finalized) return;
    room.activeBattle.finalizing = true;
    try {
      await finalizeRaidBattle(room.activeBattle, now);
    } catch (err) {
      console.error('Raid finalize crashed, will retry:', err);
      if (room.activeBattle) {
        room.activeBattle.finalizing = false;
        room.activeBattle.nextActionAt = new Date(now.getTime() + RAID_ACTION_DELAY_MS);
        bumpRaidVersion();
      }
    }
  }
}

async function advanceRaidState(now = new Date()) {
  for (const mode of RAID_MODE_LIST) {
    await advanceRaidRoomState(mode, now);
  }
}

function unlockTitle(user, titleId, options = {}) {
  if (!TITLE_DATA[titleId]) return false;
  if (user.titles.unlocked.includes(titleId)) return false;
  user.titles.unlocked.push(titleId);
  if (options.notify !== false) {
    queueNotification(user, 'title_unlock', `<${TITLE_DATA[titleId].name}> 칭호를 획득하였습니다!`);
  }
  return true;
}

function unlockEmblem(user, emblemId, options = {}) {
  const emblem = EMBLEM_DATA[emblemId];
  if (!emblem) return false;
  ensureUserDefaults(user);
  if (user.emblems.unlocked.includes(emblemId)) return false;

  user.emblems.unlocked.push(emblemId);
  if (!user.emblems.equipped) user.emblems.equipped = emblemId;
  if (options.notify !== false) {
    queueNotification(user, 'emblem_unlock', `<${emblem.name}> 휘장을 획득하였습니다!`);
  }
  return true;
}

function reconcileEmblems(user) {
  ensureUserDefaults(user);
  Object.values(EMBLEM_DATA).forEach((emblem) => {
    if (emblem.unlockLevel && Number(user.gameState?.level || 1) >= Number(emblem.unlockLevel || 0)) {
      unlockEmblem(user, emblem.id);
    }
    if (emblem.unlockCatFoodGiven && Number(user.meta?.catFoodGivenCount || 0) >= Number(emblem.unlockCatFoodGiven || 0)) {
      unlockEmblem(user, emblem.id);
    }
  });
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
    user.shopState.dailyBusinessCardPurchases = 0;
    user.shopState.dailyBacchusPurchases = 0;
    user.shopState.dailyHot6Purchases = 0;
    user.shopState.dailyFragmentRaidTicketPurchases = 0;
    user.shopState.dailyFragmentBusinessCardPurchases = 0;
    user.shopState.dailyFragmentCatButlerEmblemPurchases = 0;
    user.shopState.dailyFragmentTigerEmblemPurchases = 0;
    user.shopState.dailyFragmentIdolEmblemPurchases = 0;
    user.shopState.dailyFragmentBitchNotEmblemPurchases = 0;
    user.shopState.dailyFragmentRuinedBearEmblemPurchases = 0;
  }
}

function syncWeeklyFragmentShopState(user, now = new Date()) {
  ensureUserDefaults(user);
  const weekKey = getKSTWeekStartKey(now);
  if (user.shopState.weeklyFragmentExpPotionWeekKey !== weekKey) {
    user.shopState.weeklyFragmentExpPotionWeekKey = weekKey;
    user.shopState.weeklyFragmentExpPotionPurchases = 0;
  }
}

function buildFragmentShopState(user, now = new Date()) {
  ensureUserDefaults(user);
  syncDailyShopState(user, now);
  syncWeeklyFragmentShopState(user, now);
  const ownedFragments = getInventoryQuantity(user, 'equipment_fragment');
  return {
    fragments: ownedFragments,
    items: Object.values(FRAGMENT_SHOP_ITEMS).map((entry) => {
      const isWeekly = Number(entry.weeklyLimit || 0) > 0;
      const limit = Math.max(0, Number(isWeekly ? entry.weeklyLimit : entry.dailyLimit || 0));
      const purchased = Math.max(0, Number(user.shopState?.[entry.countField] || 0));
      const isEmblem = Boolean(entry.emblemId);
      const owned = isEmblem && user.emblems.unlocked.includes(entry.emblemId);
      const cost = applyDailyAugmentShopDiscount(user, entry.cost, now);
      const remaining = Math.max(0, limit - purchased);
      return {
        id: entry.id,
        itemId: entry.itemId,
        emblemId: entry.emblemId || null,
        type: isEmblem ? 'emblem' : 'item',
        name: entry.name,
        desc: isEmblem ? (EMBLEM_DATA[entry.emblemId]?.desc || '') : (entry.desc || ''),
        cost,
        originalCost: entry.cost,
        quantity: entry.quantity,
        dailyLimit: isWeekly ? null : limit,
        weeklyLimit: isWeekly ? limit : null,
        limitType: isWeekly ? 'weekly' : 'daily',
        purchasedToday: isWeekly ? 0 : purchased,
        purchasedThisWeek: isWeekly ? purchased : 0,
        remainingToday: isWeekly ? 0 : remaining,
        remainingThisWeek: isWeekly ? remaining : 0,
        owned,
        canBuy: ownedFragments >= cost && remaining > 0 && !owned
      };
    })
  };
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

function calculateEmblemStats(emblems = {}) {
  const stats = {
    moneyBonus: 0,
    expBonus: 0,
    raidRewardBonus: 0,
    raidExpBonus: 0,
    maintenanceReduction: 0,
    stockFeeReduction: 0,
    infiniteOvertimeRewardBonus: 0
  };

  const unlocked = Array.isArray(emblems?.unlocked) ? [...new Set(emblems.unlocked)] : [];
  unlocked.forEach((emblemId) => {
    const effects = EMBLEM_DATA[emblemId]?.effects;
    if (!effects) return;
    stats.moneyBonus += Number(effects.moneyBonus || 0);
    stats.expBonus += Number(effects.expBonus || 0);
    stats.raidRewardBonus += Number(effects.raidRewardBonus || 0);
    stats.raidExpBonus += Number(effects.raidExpBonus || 0);
    stats.maintenanceReduction += Number(effects.maintenanceReduction || 0);
    stats.stockFeeReduction += Number(effects.stockFeeReduction || 0);
    stats.infiniteOvertimeRewardBonus += Number(effects.infiniteOvertimeRewardBonus || 0);
  });

  stats.moneyBonus = Number(stats.moneyBonus.toFixed(2));
  stats.expBonus = Number(stats.expBonus.toFixed(2));
  stats.raidRewardBonus = Number(stats.raidRewardBonus.toFixed(2));
  stats.raidExpBonus = Number(stats.raidExpBonus.toFixed(2));
  stats.maintenanceReduction = Number(stats.maintenanceReduction.toFixed(2));
  stats.stockFeeReduction = Number(stats.stockFeeReduction.toFixed(2));
  stats.infiniteOvertimeRewardBonus = Number(stats.infiniteOvertimeRewardBonus.toFixed(2));
  return stats;
}

function getEffectiveCompanyStockSellFeeRate(user, now = new Date(), derivedStats = null) {
  if (!user) return COMPANY_STOCK_SELL_FEE_RATE;
  const stats = derivedStats || calculateDerivedStats(user, now);
  const reduction = Math.max(0, Math.min(100, Number(stats.stockFeeReductionPercent || 0)));
  return Number((COMPANY_STOCK_SELL_FEE_RATE * Math.max(0, 1 - reduction / 100)).toFixed(6));
}


function createBranchOfficeId(prefix) {
  const suffix = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(36).slice(2, 10);
  return prefix + '_' + suffix;
}

function getDefaultBranchOffice() {
  return {
    isFounded: false,
    companyName: '',
    foundedAt: null,
    companyValue: 0,
    employees: [],
    storageSlots: BRANCH_OFFICE_BASE_STORAGE_SLOTS,
    items: [],
    pendingExcavation: { startedAt: null, completesAt: null, cost: 0, successChance: 0, rareItemBonusChance: 0 },
    autoExcavationEnabled: false,
    excavationBrokenUntil: null,
    itemCodex: [],
    employeeCodex: [],
    excavationRewardLog: [],
    lastSettlementDayKey: '',
    missedMaintenanceDays: 0,
    lastTaxAt: null,
    lastLog: ''
  };
}

function getBranchMaxEmployees(source) {
  const office = source?.branchOffice || source || {};
  const companyValue = Math.max(0, Math.floor(Number(office.companyValue || 0)));
  return BRANCH_OFFICE_MAX_EMPLOYEES + Math.floor(companyValue / BRANCH_OFFICE_COMPANY_VALUE_PER_EXTRA_EMPLOYEE);
}

function getBranchSalaryMoneyBonusPercent(user) {
  const itemStats = calculateItemStats(user.inventory);
  const emblemStats = calculateEmblemStats(user.emblems);
  const titleEffects = getEquippedTitleDefinition(user)?.effects || {};
  return Number((itemStats.moneyBonus + emblemStats.moneyBonus + Number(titleEffects.moneyBonus || 0)).toFixed(2));
}

function getBranchEmployeeFairDailySalaryFromBase(baseDailySalary, employee = {}) {
  const grade = BRANCH_EMPLOYEE_GRADE_CONFIG[employee.grade] ? employee.grade : 'C';
  const minContractSalary = Number(baseDailySalary || 0) * BRANCH_OFFICE_MIN_CONTRACT_PERCENT / 100;
  const gradeMultiplier = BRANCH_EMPLOYEE_GRADE_SALARY_MULTIPLIER[grade] || 1;
  const powerFactor = getBranchEmployeePowerSalaryFactor(employee);
  const efficiency = getBranchEmployeeSalaryEfficiency(employee);
  return Math.max(1, Math.floor(minContractSalary * gradeMultiplier * powerFactor * efficiency));
}

function normalizeBranchOffice(user) {
  if (!user.branchOffice || typeof user.branchOffice !== 'object') {
    user.branchOffice = getDefaultBranchOffice();
  }
  const office = user.branchOffice;
  office.isFounded = Boolean(office.isFounded);
  office.companyName = String(office.companyName || '').slice(0, 24);
  office.foundedAt = office.foundedAt || null;
  office.companyValue = Math.max(0, Math.floor(Number(office.companyValue || 0)));
  office.storageSlots = Math.max(BRANCH_OFFICE_BASE_STORAGE_SLOTS, Math.min(BRANCH_OFFICE_MAX_STORAGE_SLOTS, Math.floor(Number(office.storageSlots || BRANCH_OFFICE_BASE_STORAGE_SLOTS))));
  const salaryBaseStats = { moneyBonusPercent: getBranchSalaryMoneyBonusPercent(user) };
  const fairDailyBase = getBranchEmployeeDailySalaryBase(user, new Date(), salaryBaseStats);
  office.employees = (Array.isArray(office.employees) ? office.employees : [])
    .filter((employee) => employee && employee.employeeId)
    .slice(0, Math.max(BRANCH_OFFICE_MAX_EMPLOYEES, getBranchMaxEmployees(office), Array.isArray(office.employees) ? office.employees.length : 0))
    .map((employee) => {
      const normalizedEmployee = {
        employeeId: String(employee.employeeId),
        name: String(employee.name || '이름없는 직원').slice(0, 24),
        role: String(employee.role || '사원').slice(0, 12),
        grade: BRANCH_EMPLOYEE_GRADE_CONFIG[employee.grade] ? String(employee.grade) : 'C',
        excavationPower: Number(Math.max(0, Number(employee.excavationPower || 0)).toFixed(2)),
        dailySalary: Math.max(0, Math.floor(Number(employee.dailySalary || 0))),
        salaryEfficiency: getBranchEmployeeSalaryEfficiency(employee),
        contractPercent: Math.max(0, Math.min(50, Number(employee.contractPercent || 0))),
        hiredAt: employee.hiredAt || new Date()
      };
      const fairDailySalary = getBranchEmployeeFairDailySalaryFromBase(fairDailyBase, normalizedEmployee);
      if (normalizedEmployee.dailySalary < fairDailySalary) {
        normalizedEmployee.dailySalary = fairDailySalary;
      }
      return normalizedEmployee;
    });
  office.items = (Array.isArray(office.items) ? office.items : [])
    .filter((item) => item && item.instanceId && BRANCH_COLLECTIBLE_ITEMS[item.itemId])
    .slice(0, office.storageSlots)
    .map((item) => ({
      instanceId: String(item.instanceId),
      itemId: String(item.itemId),
      acquiredAt: item.acquiredAt || new Date()
    }));
  const pendingStartedAt = office.pendingExcavation?.startedAt ? new Date(office.pendingExcavation.startedAt) : null;
  const pendingCompletesAt = office.pendingExcavation?.completesAt ? new Date(office.pendingExcavation.completesAt) : null;
  const hasPendingExcavation = pendingCompletesAt && Number.isFinite(pendingCompletesAt.getTime());
  office.pendingExcavation = hasPendingExcavation
    ? {
        startedAt: pendingStartedAt && Number.isFinite(pendingStartedAt.getTime()) ? pendingStartedAt : null,
        completesAt: pendingCompletesAt,
        cost: Math.max(0, Math.floor(Number(office.pendingExcavation.cost || 0))),
        successChance: Math.max(0, Math.min(100, Number(office.pendingExcavation.successChance || 0))),
        rareItemBonusChance: Math.max(0, Math.min(100, Number(office.pendingExcavation.rareItemBonusChance || 0)))
      }
    : { startedAt: null, completesAt: null, cost: 0, successChance: 0, rareItemBonusChance: 0 };
  office.autoExcavationEnabled = Boolean(office.autoExcavationEnabled);
  const brokenUntil = office.excavationBrokenUntil ? new Date(office.excavationBrokenUntil) : null;
  office.excavationBrokenUntil = brokenUntil && Number.isFinite(brokenUntil.getTime()) ? brokenUntil : null;
  office.itemCodex = [...new Set(Array.isArray(office.itemCodex) ? office.itemCodex.filter((itemId) => BRANCH_COLLECTIBLE_ITEMS[itemId]) : [])];
  office.employeeCodex = [...new Set(Array.isArray(office.employeeCodex) ? office.employeeCodex.map((name) => String(name || '').slice(0, 24)).filter(Boolean) : [])];
  office.excavationRewardLog = (Array.isArray(office.excavationRewardLog) ? office.excavationRewardLog : [])
    .filter((entry) => entry && entry.itemId)
    .map((entry) => {
      const itemDef = INVENTORY_ITEM_DEFS[entry.itemId] || {};
      return {
        itemId: String(entry.itemId),
        name: String(entry.name || itemDef.name || entry.itemId).slice(0, 40),
        quantity: Math.max(1, Math.floor(Number(entry.quantity || 1))),
        acquiredAt: entry.acquiredAt || new Date()
      };
    })
    .slice(-BRANCH_EXCAVATION_EXTRA_DROP_LOG_LIMIT);
  office.lastSettlementDayKey = office.lastSettlementDayKey || '';
  office.missedMaintenanceDays = Math.max(0, Math.floor(Number(office.missedMaintenanceDays || 0)));
  office.lastTaxAt = office.lastTaxAt || null;
  office.lastLog = String(office.lastLog || '').slice(0, 240);
}

function sanitizeBranchCompanyName(name) {
  return String(name || '').replace(/\s+/g, ' ').trim().slice(0, 24);
}

function getBranchEmployeeDailySalaryBase(user, now = new Date(), derivedStats = null) {
  const stats = derivedStats || calculateDerivedStats(user, now);
  return Math.floor(getSalaryPerMinute(user.gameState.level, stats.moneyBonusPercent) * 60 * 24 * BRANCH_OFFICE_CONTRACT_SALARY_RATIO);
}

function getStableUnitIntervalFromText(text) {
  const source = String(text || '');
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function getBranchEmployeeSalaryEfficiency(employee = {}) {
  const stored = Number(employee.salaryEfficiency);
  const hasModernContractPercent = Number(employee.contractPercent || 0) > 0;
  if (Number.isFinite(stored) && stored >= 0.5 && stored <= 2 && (stored !== 1 || hasModernContractPercent)) {
    return Number(stored.toFixed(3));
  }
  const unit = getStableUnitIntervalFromText(employee.employeeId || employee.name || Math.random());
  return Number((BRANCH_EMPLOYEE_SALARY_EFFICIENCY_MIN + unit * BRANCH_EMPLOYEE_SALARY_EFFICIENCY_RANGE).toFixed(3));
}

function getBranchEmployeePowerSalaryFactor(employee = {}) {
  const grade = BRANCH_EMPLOYEE_GRADE_CONFIG[employee.grade] ? employee.grade : 'C';
  const config = BRANCH_EMPLOYEE_GRADE_CONFIG[grade];
  const power = Math.max(config.minPower, Math.min(config.maxPower, Number(employee.excavationPower || config.minPower)));
  const span = Math.max(0.01, config.maxPower - config.minPower);
  const normalized = (power - config.minPower) / span;
  return Number((0.85 + normalized * 0.35).toFixed(3));
}

function getBranchEmployeeFairDailySalary(user, employee = {}, now = new Date(), derivedStats = null) {
  const grade = BRANCH_EMPLOYEE_GRADE_CONFIG[employee.grade] ? employee.grade : 'C';
  const base = getBranchEmployeeDailySalaryBase(user, now, derivedStats);
  const minContractSalary = base * BRANCH_OFFICE_MIN_CONTRACT_PERCENT / 100;
  const gradeMultiplier = BRANCH_EMPLOYEE_GRADE_SALARY_MULTIPLIER[grade] || 1;
  const powerFactor = getBranchEmployeePowerSalaryFactor(employee);
  const efficiency = getBranchEmployeeSalaryEfficiency(employee);
  return Math.max(1, Math.floor(minContractSalary * gradeMultiplier * powerFactor * efficiency));
}

function getBranchEmployeeFinalDailySalary(user, employee = {}, requestedDailySalary = 0, now = new Date(), derivedStats = null) {
  return Math.max(
    Math.max(1, Math.floor(Number(requestedDailySalary || 0))),
    getBranchEmployeeFairDailySalary(user, employee, now, derivedStats)
  );
}

function isBranchOfficeEligible(user, now = new Date(), derivedStats = null) {
  const level = Number(user.gameState?.level || 1);
  if (level >= BRANCH_OFFICE_ELIGIBLE_LEVEL) return true;
  const stats = derivedStats || calculateDerivedStats(user, now);
  return getSalaryPerMinute(level, stats.moneyBonusPercent) >= BRANCH_OFFICE_ELIGIBLE_SALARY_PER_MINUTE;
}

function getBranchItemEffectText(effects = {}) {
  const parts = [];
  if (effects.hourlyExpPercent) parts.push('매시간 다음 레벨까지 남은 경험치의 ' + effects.hourlyExpPercent + '% 획득');
  if (effects.excavationPowerBonus) parts.push('직원 전체 발굴 확률 +' + effects.excavationPowerBonus + '%');
  if (effects.bossRaidExpBonus) parts.push('보스 클리어 경험치 +' + effects.bossRaidExpBonus + '%');
  if (effects.excavationSuccessCapBonus) parts.push('발굴 확률 최대치 +' + effects.excavationSuccessCapBonus + '%');
  if (effects.excavationTimeReductionPercent) parts.push('발굴 소요 시간 -' + effects.excavationTimeReductionPercent + '%');
  if (effects.companyValueBonus) parts.push('회사 가치 증가량 +' + effects.companyValueBonus + '%');
  return parts.length ? parts.join(' / ') : '보유 효과 없음';
}

function getBranchItemDetail(itemId) {
  const item = BRANCH_COLLECTIBLE_ITEMS[itemId];
  if (!item) return null;
  const grade = BRANCH_ITEM_GRADE_CONFIG[item.grade] || BRANCH_ITEM_GRADE_CONFIG.common;
  return {
    id: item.id,
    emoji: item.emoji,
    name: item.name,
    grade: item.grade,
    gradeLabel: grade.label,
    color: grade.color,
    desc: item.desc,
    valueGain: grade.valueGain,
    disposeCost: grade.disposeCost,
    effectText: getBranchItemEffectText(item.effects),
    effects: item.effects || {}
  };
}

function calculateBranchItemEffects(branchOffice = {}) {
  const effects = { hourlyExpPercent: 0, excavationPowerBonus: 0, bossRaidExpBonus: 0, companyValueBonus: 0, excavationTimeReductionPercent: 0, excavationSuccessCapBonus: 0 };
  (Array.isArray(branchOffice?.items) ? branchOffice.items : []).forEach((entry) => {
    const itemEffects = BRANCH_COLLECTIBLE_ITEMS[entry.itemId]?.effects || {};
    effects.hourlyExpPercent += Number(itemEffects.hourlyExpPercent || 0);
    effects.excavationPowerBonus += Number(itemEffects.excavationPowerBonus || 0);
    effects.bossRaidExpBonus += Number(itemEffects.bossRaidExpBonus || 0);
    effects.companyValueBonus += Number(itemEffects.companyValueBonus || 0);
    effects.excavationTimeReductionPercent += Number(itemEffects.excavationTimeReductionPercent || 0);
    effects.excavationSuccessCapBonus += Number(itemEffects.excavationSuccessCapBonus || 0);
  });
  Object.keys(effects).forEach((key) => { effects[key] = Number(effects[key].toFixed(2)); });
  return effects;
}

function getBranchEffectiveExcavationPowerBonus(branchOffice = {}) {
  const effects = calculateBranchItemEffects(branchOffice);
  const employeeCount = Array.isArray(branchOffice?.employees) ? branchOffice.employees.length : 0;
  return Number((Number(effects.excavationPowerBonus || 0) * employeeCount).toFixed(2));
}

function getBranchExcavationPower(user) {
  normalizeBranchOffice(user);
  const employeePower = user.branchOffice.employees.reduce((sum, employee) => sum + Number(employee.excavationPower || 0), 0);
  const itemPower = getBranchEffectiveExcavationPowerBonus(user.branchOffice);
  return Number((employeePower + itemPower).toFixed(2));
}

function getBranchExcavationRawChance(user) {
  return Number((getBranchExcavationPower(user) || 0).toFixed(2));
}

function getBranchExcavationCap(user) {
  normalizeBranchOffice(user);
  const effects = calculateBranchItemEffects(user.branchOffice);
  return Number((BRANCH_OFFICE_SUCCESS_CAP + Number(effects.excavationSuccessCapBonus || 0)).toFixed(2));
}

function getBranchExcavationChance(user) {
  return Number(Math.min(getBranchExcavationCap(user), getBranchExcavationRawChance(user)).toFixed(2));
}

function getBranchRareItemBonusChance(user) {
  return Number((Math.max(0, getBranchExcavationRawChance(user) - getBranchExcavationCap(user)) * BRANCH_OFFICE_RARE_BONUS_RATE).toFixed(2));
}

function getKSTHour(date = new Date()) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return kst.getUTCHours();
}

function isBranchOvertimeExcavationTime(now = new Date()) {
  return getKSTHour(now) >= BRANCH_OFFICE_OVERTIME_START_HOUR;
}

function getBranchExcavationCost(user, now = new Date()) {
  normalizeBranchOffice(user);
  const baseCost = BRANCH_OFFICE_BASE_DIG_COST + user.branchOffice.employees.length * BRANCH_OFFICE_DIG_COST_PER_EMPLOYEE;
  return baseCost * (isBranchOvertimeExcavationTime(now) ? BRANCH_OFFICE_OVERTIME_COST_MULTIPLIER : 1);
}

function getBranchExcavationDurationMs(user) {
  normalizeBranchOffice(user);
  const effects = calculateBranchItemEffects(user.branchOffice);
  const reduction = Math.max(0, Math.min(90, Number(effects.excavationTimeReductionPercent || 0)));
  return Math.max(60 * 1000, Math.floor(BRANCH_OFFICE_BASE_EXCAVATION_MS * (1 - reduction / 100)));
}

function getBranchPendingExcavation(user) {
  normalizeBranchOffice(user);
  const pending = user.branchOffice.pendingExcavation;
  if (!pending?.completesAt) return null;
  const completesAt = new Date(pending.completesAt);
  if (!Number.isFinite(completesAt.getTime())) return null;
  const startedAt = pending.startedAt ? new Date(pending.startedAt) : null;
  return {
    startedAt: startedAt && Number.isFinite(startedAt.getTime()) ? startedAt : null,
    completesAt,
    cost: Math.max(0, Math.floor(Number(pending.cost || 0))),
    successChance: Math.max(0, Math.min(100, Number(pending.successChance || 0))),
    rareItemBonusChance: Math.max(0, Math.min(100, Number(pending.rareItemBonusChance || 0)))
  };
}

function clearBranchPendingExcavation(user) {
  normalizeBranchOffice(user);
  user.branchOffice.pendingExcavation = { startedAt: null, completesAt: null, cost: 0, successChance: 0, rareItemBonusChance: 0 };
}

function getBranchMachineBrokenUntil(user, now = new Date()) {
  normalizeBranchOffice(user);
  const brokenUntil = user.branchOffice.excavationBrokenUntil ? new Date(user.branchOffice.excavationBrokenUntil) : null;
  if (!brokenUntil || !Number.isFinite(brokenUntil.getTime())) {
    user.branchOffice.excavationBrokenUntil = null;
    return null;
  }
  if (brokenUntil.getTime() <= now.getTime()) {
    user.branchOffice.excavationBrokenUntil = null;
    return null;
  }
  return brokenUntil;
}

function appendBranchExcavationRewardLog(user, reward, now = new Date()) {
  if (!reward?.itemId) return;
  normalizeBranchOffice(user);
  const itemDef = INVENTORY_ITEM_DEFS[reward.itemId] || {};
  const entry = {
    itemId: reward.itemId,
    name: reward.name || itemDef.name || reward.itemId,
    quantity: Math.max(1, Math.floor(Number(reward.quantity || 1))),
    acquiredAt: now
  };
  user.branchOffice.excavationRewardLog = [
    ...(Array.isArray(user.branchOffice.excavationRewardLog) ? user.branchOffice.excavationRewardLog : []),
    entry
  ].slice(-BRANCH_EXCAVATION_EXTRA_DROP_LOG_LIMIT);
}

function getBranchExcavationExtraDropChancePercent(rareItemBonusChance = 0) {
  const rareBonus = Math.max(0, Number(rareItemBonusChance || 0));
  const scaledBonus = rareBonus > 0
    ? rareBonus / (rareBonus + BRANCH_EXCAVATION_EXTRA_DROP_RARE_BONUS_SCALE)
    : 0;
  const chance = BRANCH_EXCAVATION_EXTRA_DROP_CHANCE
    + (BRANCH_EXCAVATION_EXTRA_DROP_MAX_CHANCE - BRANCH_EXCAVATION_EXTRA_DROP_CHANCE) * scaledBonus;
  return Number(Math.min(BRANCH_EXCAVATION_EXTRA_DROP_MAX_CHANCE, chance).toFixed(4));
}

function rollBranchExcavationExtraDrop(user, now = new Date(), rareItemBonusChance = 0) {
  const chancePercent = getBranchExcavationExtraDropChancePercent(rareItemBonusChance);
  if (Math.random() * 100 >= chancePercent) return null;
  const drop = pickRandom(BRANCH_EXCAVATION_EXTRA_DROPS);
  if (!drop?.itemId || !INVENTORY_ITEM_DEFS[drop.itemId]) return null;
  const quantity = 1;
  addItemToInventory(user, drop.itemId, quantity);
  const itemDef = INVENTORY_ITEM_DEFS[drop.itemId];
  const reward = { itemId: drop.itemId, name: itemDef.name, quantity };
  appendBranchExcavationRewardLog(user, reward, now);
  return reward;
}

function startBranchExcavation(user, now = new Date(), options = {}) {
  normalizeBranchOffice(user);
  if (!user.branchOffice.isFounded) {
    return { started: false, reason: 'not_founded', message: '먼저 회사를 설립해주세요.' };
  }
  if (getBranchPendingExcavation(user)) {
    return { started: false, reason: 'pending', message: '이미 발굴이 진행 중입니다.' };
  }
  const brokenUntil = getBranchMachineBrokenUntil(user, now);
  if (brokenUntil) {
    const message = '발굴 기계 수리 중입니다. 남은 시간: ' + Math.ceil((brokenUntil.getTime() - now.getTime()) / 60000) + '분';
    user.branchOffice.lastLog = message;
    return { started: false, reason: 'broken', message, brokenUntil };
  }
  if (Math.random() < BRANCH_OFFICE_BREAKDOWN_CHANCE) {
    const repairUntil = new Date(now.getTime() + BRANCH_OFFICE_BREAKDOWN_MS);
    user.branchOffice.excavationBrokenUntil = repairUntil;
    const message = '발굴 기계가 고장났습니다. 6시간 수리 후 다시 발굴할 수 있습니다. 비용은 사용되지 않았습니다.';
    user.branchOffice.lastLog = message;
    return { started: false, reason: 'breakdown', message, brokenUntil: repairUntil };
  }

  const cost = getBranchExcavationCost(user, now);
  if (Number(user.gameState.money || 0) < cost) {
    const message = options.auto ? '자동 발굴 대기 중: 발굴 비용이 부족합니다.' : '발굴 비용이 부족합니다.';
    user.branchOffice.lastLog = message;
    return { started: false, reason: 'money', message };
  }

  user.gameState.money = Number(user.gameState.money || 0) - cost;
  const durationMs = getBranchExcavationDurationMs(user);
  const successChance = getBranchExcavationChance(user);
  const rareItemBonusChance = getBranchRareItemBonusChance(user);
  const completesAt = new Date(now.getTime() + durationMs);
  user.branchOffice.pendingExcavation = { startedAt: now, completesAt, cost, successChance, rareItemBonusChance };
  const overtimeText = isBranchOvertimeExcavationTime(now) ? ' 야근 시간이라 발굴 비용 3배가 적용되었습니다.' : '';
  const message = (options.auto ? '자동 발굴을 시작했습니다.' : '발굴을 시작했습니다.')
    + ' 발굴 비용 ' + cost.toLocaleString() + '원이 사용되었습니다.' + overtimeText
    + ' 예상 소요 시간: ' + Math.ceil(durationMs / 60000) + '분.';
  user.branchOffice.lastLog = message;
  return { started: true, message, pending: true, completesAt, durationMs, successChance };
}

function completeBranchExcavation(user, now = new Date(), options = {}) {
  normalizeBranchOffice(user);
  const pending = getBranchPendingExcavation(user);
  if (!pending) return { completed: false, reason: 'none', message: '확인할 발굴 결과가 없습니다.' };

  const remainingMs = pending.completesAt.getTime() - now.getTime();
  if (remainingMs > 0 && !options.force) {
    return {
      completed: false,
      reason: 'not_ready',
      remainingMs,
      message: '발굴이 아직 진행 중입니다. 남은 시간: ' + Math.ceil(remainingMs / 1000) + '초'
    };
  }

  const successChance = Number(pending.successChance || getBranchExcavationChance(user));
  const rareItemBonusChance = Number(pending.rareItemBonusChance || getBranchRareItemBonusChance(user));
  const success = Math.random() * 100 < successChance;
  let message = options.auto ? '자동 발굴 결과: ' : '발굴 결과 확인: ';
  let itemDetail = null;
  let valueGain = 0;

  if (success) {
    const item = rollBranchCollectibleItem(user, rareItemBonusChance);
    const detail = getBranchItemDetail(item.id);
    if (detail) {
      const branchEffects = calculateBranchItemEffects(user.branchOffice);
      valueGain = Math.floor(detail.valueGain * (1 + branchEffects.companyValueBonus / 100));
      user.branchOffice.companyValue += valueGain;
      user.branchOffice.itemCodex = [...new Set([...(user.branchOffice.itemCodex || []), item.id])];
      itemDetail = detail;
      if (user.branchOffice.items.length < user.branchOffice.storageSlots) {
        user.branchOffice.items.push({ instanceId: createBranchOfficeId('boi'), itemId: item.id, acquiredAt: now });
        message += detail.emoji + ' ' + detail.name + ' 발굴 성공! 회사 가치 +' + valueGain.toLocaleString() + '원';
      } else {
        message += detail.emoji + ' ' + detail.name + ' 발굴 성공! 회사 가치 +' + valueGain.toLocaleString() + '원. 단, 창고가 가득 차 보관하지 못했습니다.';
      }
    } else {
      message += '발굴은 성공했지만 수집품 정보를 확인하지 못했습니다.';
    }
  } else {
    message += '발굴 실패. 아무것도 찾지 못했습니다. (성공률 ' + successChance + '%)';
  }

  const extraDrop = rollBranchExcavationExtraDrop(user, now, rareItemBonusChance);
  if (extraDrop) {
    message += ' / 추가 보상: ' + extraDrop.name + ' ' + extraDrop.quantity.toLocaleString() + '개';
  }

  clearBranchPendingExcavation(user);
  user.branchOffice.lastLog = message;
  return { completed: true, message, success, item: itemDetail, valueGain, extraDrop, pending: false };
}

function processBranchAutoExcavation(user, now = new Date(), options = {}) {
  normalizeBranchOffice(user);
  const office = user.branchOffice;
  if (!office.isFounded || !office.autoExcavationEnabled) return [];

  const messages = [];
  const maxSteps = Math.max(1, Math.min(
    100,
    Math.floor(Number(options.maxSteps || BRANCH_AUTO_EXCAVATION_MAX_STEPS_PER_REQUEST))
  ));
  let guard = 0;
  while (guard < maxSteps) {
    guard += 1;
    const brokenUntil = getBranchMachineBrokenUntil(user, now);
    if (brokenUntil) break;
    const pending = getBranchPendingExcavation(user);
    if (pending) {
      if (pending.completesAt.getTime() > now.getTime()) break;
      const completed = completeBranchExcavation(user, now, { auto: true, force: true });
      if (completed.message) messages.push(completed.message);
      if (!office.autoExcavationEnabled) break;
      const next = startBranchExcavation(user, now, { auto: true });
      if (next.message) messages.push(next.message);
      if (!next.started || new Date(next.completesAt).getTime() > now.getTime()) break;
      continue;
    }

    const started = startBranchExcavation(user, now, { auto: true });
    if (started.message) messages.push(started.message);
    break;
  }

  if (guard >= maxSteps) {
    office.lastLog = '자동 발굴 정산이 많아 일부만 처리했습니다. 다음 동기화에서 이어서 처리됩니다.';
  }

  return messages;
}

function getBranchNextStorageCost(user) {
  normalizeBranchOffice(user);
  if (user.branchOffice.storageSlots >= BRANCH_OFFICE_MAX_STORAGE_SLOTS) return null;
  const extraSlots = Math.max(0, user.branchOffice.storageSlots - BRANCH_OFFICE_BASE_STORAGE_SLOTS);
  return Math.floor(BRANCH_OFFICE_STORAGE_BASE_COST * Math.pow(3, extraSlots));
}

function rollBranchEmployee(contractPercent, dailySalary) {
  const roll = Math.random() * 100;
  const sChance = Math.min(8, contractPercent * 0.35);
  const aChance = Math.min(22, 4 + contractPercent * 1.1);
  const bChance = Math.min(45, 18 + contractPercent * 1.5);
  let grade = 'C';
  if (roll < sChance) grade = 'S';
  else if (roll < sChance + aChance) grade = 'A';
  else if (roll < sChance + aChance + bChance) grade = 'B';
  const config = BRANCH_EMPLOYEE_GRADE_CONFIG[grade];
  const basePower = config.minPower + Math.random() * (config.maxPower - config.minPower);
  const efficiencyNoise = 0.85 + Math.random() * 0.3;
  const excavationPower = Number((basePower * efficiencyNoise).toFixed(2));
  const salaryEfficiency = Number((BRANCH_EMPLOYEE_SALARY_EFFICIENCY_MIN + Math.random() * BRANCH_EMPLOYEE_SALARY_EFFICIENCY_RANGE).toFixed(3));
  const baseName = BRANCH_EMPLOYEE_NAME_POOL[Math.floor(Math.random() * BRANCH_EMPLOYEE_NAME_POOL.length)];
  return {
    employeeId: createBranchOfficeId('emp'),
    name: baseName + ' ' + config.role,
    role: config.role,
    grade,
    excavationPower,
    dailySalary: Math.max(1, Math.floor(Number(dailySalary || 0))),
    salaryEfficiency,
    contractPercent: Number(Math.max(0, Number(contractPercent || 0)).toFixed(3)),
    hiredAt: new Date()
  };
}

function getBranchRecruitSuccessChance(contractPercent) {
  return Number(Math.min(95, 30 + Math.sqrt(Math.max(0, contractPercent)) * 18).toFixed(2));
}

function rollBranchCollectibleItem(user, rareBonusOverride = null) {
  const overCapBonus = Number.isFinite(Number(rareBonusOverride))
    ? Number(rareBonusOverride)
    : getBranchRareItemBonusChance(user);
  const excessPower = Math.max(0, getBranchExcavationRawChance(user) - getBranchExcavationCap(user));
  const legendaryBonus = Math.min(5, excessPower * 0.15 + overCapBonus * 0.13);
  const epicBonus = Math.min(8, excessPower * 0.25 + overCapBonus * 0.30);
  const rareBonus = Math.min(10, overCapBonus * 0.55);
  if (Math.random() * 100 < 0.15 + overCapBonus * 0.02) {
    const ssPool = Object.values(BRANCH_COLLECTIBLE_ITEMS).filter((item) => item.grade === 'ss');
    if (ssPool.length) return ssPool[Math.floor(Math.random() * ssPool.length)];
  }
  const weights = [
    { grade: 'legendary', weight: 2 + legendaryBonus },
    { grade: 'epic', weight: 8 + epicBonus },
    { grade: 'rare', weight: 25 + rareBonus },
    { grade: 'common', weight: Math.max(1, 65 - rareBonus - epicBonus - legendaryBonus) }
  ];
  const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  let selectedGrade = 'common';
  for (const entry of weights) {
    roll -= entry.weight;
    if (roll <= 0) {
      selectedGrade = entry.grade;
      break;
    }
  }
  const pool = Object.values(BRANCH_COLLECTIBLE_ITEMS).filter((item) => item.grade === selectedGrade);
  return pool[Math.floor(Math.random() * pool.length)] || Object.values(BRANCH_COLLECTIBLE_ITEMS)[0];
}

function applyBranchOfficeDailySettlement(user, now = new Date(), derivedStats = null) {
  normalizeBranchOffice(user);
  const office = user.branchOffice;
  if (!office.isFounded) return;
  const todayKey = getKSTDateKey(now);
  if (office.lastSettlementDayKey === todayKey) return;
  const days = office.lastSettlementDayKey ? Math.max(1, Math.min(7, getDateKeyDiff(todayKey, office.lastSettlementDayKey))) : 1;
  const stats = derivedStats || calculateDerivedStats(user, now);
  const maintenanceReduction = Math.max(0, Math.min(100, Number(stats.maintenanceReductionPercent || 0)));
  const effectiveMaintenanceRate = BRANCH_OFFICE_MAINTENANCE_RATE * Math.max(0, 1 - maintenanceReduction / 100);
  let totalBurned = 0;
  let hadUnpaidCost = false;
  for (let i = 0; i < days && office.isFounded; i += 1) {
    const salaryCost = office.employees.reduce((sum, employee) => sum + Math.max(0, Math.floor(Number(employee.dailySalary || 0))), 0);
    const salaryPaid = Math.min(user.gameState.money, salaryCost);
    user.gameState.money -= salaryPaid;
    totalBurned += salaryPaid;
    if (salaryPaid < salaryCost) hadUnpaidCost = true;

    const maintenanceCost = Math.floor(office.companyValue * effectiveMaintenanceRate);
    const maintenancePaid = Math.min(user.gameState.money, maintenanceCost);
    user.gameState.money -= maintenancePaid;
    totalBurned += maintenancePaid;
    if (maintenancePaid < maintenanceCost) hadUnpaidCost = true;
    office.missedMaintenanceDays = 0;
  }
  office.lastSettlementDayKey = todayKey;
  if (totalBurned > 0 && office.isFounded) {
    office.lastLog = '일일 정산으로 ' + totalBurned.toLocaleString() + '원이 사용되었습니다.'
      + (hadUnpaidCost ? ' 일부 비용을 전부 처리하지 못했지만 회사 가치는 유지됩니다.' : '');
  } else if (hadUnpaidCost && office.isFounded) {
    office.lastLog = '정산 비용이 부족했지만 회사 가치는 유지됩니다.';
  }
}

function applyBranchOfficeHighIncomeTax(user, now = new Date(), derivedStats = null) {
  normalizeBranchOffice(user);
  const office = user.branchOffice;
  if (office.isFounded) {
    office.lastTaxAt = now;
    return;
  }
  const eligible = isBranchOfficeEligible(user, now, derivedStats);
  if (!eligible) {
    office.lastTaxAt = now;
    return;
  }
  if (!office.lastTaxAt) {
    office.lastTaxAt = now;
    return;
  }
  const lastTaxAt = new Date(office.lastTaxAt);
  const elapsed = now.getTime() - lastTaxAt.getTime();
  const intervals = Math.floor(elapsed / BRANCH_OFFICE_HIGH_INCOME_TAX_INTERVAL_MS);
  if (intervals <= 0) return;
  let burned = 0;
  for (let i = 0; i < intervals; i += 1) {
    const tax = Math.floor(Number(user.gameState.money || 0) * BRANCH_OFFICE_HIGH_INCOME_TAX_RATE);
    user.gameState.money = Math.max(0, Number(user.gameState.money || 0) - tax);
    burned += tax;
  }
  office.lastTaxAt = new Date(lastTaxAt.getTime() + intervals * BRANCH_OFFICE_HIGH_INCOME_TAX_INTERVAL_MS);
  if (burned > 0) {
    office.lastLog = '지사 미설립 고소득근로자 세금으로 ' + burned.toLocaleString() + '원이 사용되었습니다.';
    queueNotification(user, 'branch_office_tax', office.lastLog);
  }
}

function buildBranchOfficePublicState(user, now = new Date(), derivedStats = null) {
  normalizeBranchOffice(user);
  const office = user.branchOffice;
  const stats = derivedStats || calculateDerivedStats(user, now);
  const dailySalaryBase = getBranchEmployeeDailySalaryBase(user, now, stats);
  const employees = office.employees.map((employee) => ({
    employeeId: employee.employeeId,
    name: employee.name,
    role: employee.role,
    grade: employee.grade,
    excavationPower: employee.excavationPower,
    dailySalary: employee.dailySalary,
    salaryEfficiency: employee.salaryEfficiency,
    contractPercent: employee.contractPercent
  }));
  const items = office.items.map((entry) => ({
    instanceId: entry.instanceId,
    acquiredAt: entry.acquiredAt,
    ...getBranchItemDetail(entry.itemId)
  })).filter((entry) => entry.id);
  const itemEffects = {
    ...calculateBranchItemEffects(office),
    effectiveExcavationPowerBonus: getBranchEffectiveExcavationPowerBonus(office)
  };
  const pending = office.pendingExcavation?.completesAt ? office.pendingExcavation : null;
  const pendingStartedAt = pending?.startedAt ? new Date(pending.startedAt) : null;
  const pendingCompletesAt = pending?.completesAt ? new Date(pending.completesAt) : null;
  const pendingRemainingMs = pendingCompletesAt && Number.isFinite(pendingCompletesAt.getTime())
    ? Math.max(0, pendingCompletesAt.getTime() - now.getTime())
    : 0;
  const pendingTotalMs = pendingStartedAt && pendingCompletesAt && Number.isFinite(pendingStartedAt.getTime()) && Number.isFinite(pendingCompletesAt.getTime())
    ? Math.max(1, pendingCompletesAt.getTime() - pendingStartedAt.getTime())
    : getBranchExcavationDurationMs(user);
  const eligible = isBranchOfficeEligible(user, now, stats);
  const salaryPerMinute = getSalaryPerMinute(user.gameState.level, stats.moneyBonusPercent);
  const maintenanceReduction = Math.max(0, Math.min(100, Number(stats.maintenanceReductionPercent || 0)));
  const effectiveMaintenanceRate = BRANCH_OFFICE_MAINTENANCE_RATE * Math.max(0, 1 - maintenanceReduction / 100);
  return {
    isFounded: office.isFounded,
    eligible,
    requirementText: '레벨 ' + BRANCH_OFFICE_ELIGIBLE_LEVEL + ' 이상 또는 분당 월급 ' + BRANCH_OFFICE_ELIGIBLE_SALARY_PER_MINUTE.toLocaleString() + '원 이상',
    foundCost: BRANCH_OFFICE_FOUND_COST,
    companyName: office.companyName,
    foundedAt: office.foundedAt,
    companyValue: office.companyValue,
    employees,
    employeeCount: employees.length,
    maxEmployees: getBranchMaxEmployees(office),
    storageSlots: office.storageSlots,
    maxStorageSlots: BRANCH_OFFICE_MAX_STORAGE_SLOTS,
    storageUsed: items.length,
    items,
    itemCodex: office.itemCodex.map((itemId) => getBranchItemDetail(itemId)).filter(Boolean),
    itemCodexCount: office.itemCodex.length,
    itemCodexTotal: Object.keys(BRANCH_COLLECTIBLE_ITEMS).length,
    employeeCodex: office.employeeCodex,
    employeeCodexCount: office.employeeCodex.length,
    excavationRewardLog: office.excavationRewardLog.map((entry) => ({
      itemId: entry.itemId,
      name: entry.name,
      quantity: entry.quantity,
      acquiredAt: entry.acquiredAt
    })),
    digCost: getBranchExcavationCost(user, now),
    overtimeExcavationActive: isBranchOvertimeExcavationTime(now),
    overtimeExcavationMultiplier: BRANCH_OFFICE_OVERTIME_COST_MULTIPLIER,
    excavationPower: getBranchExcavationPower(user),
    successChance: getBranchExcavationChance(user),
    excavationSuccessCap: getBranchExcavationCap(user),
    rareItemBonusChance: getBranchRareItemBonusChance(user),
    excavationDurationMs: getBranchExcavationDurationMs(user),
    extraDropChancePercent: getBranchExcavationExtraDropChancePercent(getBranchRareItemBonusChance(user)),
    autoExcavationEnabled: Boolean(office.autoExcavationEnabled),
    excavationBrokenUntil: getBranchMachineBrokenUntil(user, now),
    excavationBrokenRemainingMs: (() => {
      const brokenUntil = getBranchMachineBrokenUntil(user, now);
      return brokenUntil ? Math.max(0, brokenUntil.getTime() - now.getTime()) : 0;
    })(),
    breakdownChancePercent: Number((BRANCH_OFFICE_BREAKDOWN_CHANCE * 100).toFixed(2)),
    pendingExcavation: pending ? {
      startedAt: pending.startedAt,
      completesAt: pending.completesAt,
      remainingMs: pendingRemainingMs,
      isComplete: pendingRemainingMs <= 0,
      progressPercent: Number(Math.max(0, Math.min(100, ((pendingTotalMs - pendingRemainingMs) / pendingTotalMs) * 100)).toFixed(1)),
      cost: pending.cost,
      successChance: pending.successChance,
      rareItemBonusChance: pending.rareItemBonusChance
    } : null,
    itemEffects,
    nextStorageCost: getBranchNextStorageCost(user),
    dailySalaryBase,
    salaryPerMinute,
    dailyMaintenanceCost: Math.floor(office.companyValue * effectiveMaintenanceRate),
    maintenanceRate: effectiveMaintenanceRate,
    baseMaintenanceRate: BRANCH_OFFICE_MAINTENANCE_RATE,
    maintenanceReductionPercent: maintenanceReduction,
    missedMaintenanceDays: office.missedMaintenanceDays,
    highIncomeTax: {
      applies: eligible && !office.isFounded,
      rate: BRANCH_OFFICE_HIGH_INCOME_TAX_RATE,
      intervalHours: 6,
      lastTaxAt: office.lastTaxAt
    },
    lastSettlementDayKey: office.lastSettlementDayKey,
    lastLog: office.lastLog
  };
}

function getBranchRankingLiteSummary(user) {
  const office = user?.branchOffice || {};
  if (!office.isFounded) return null;
  return {
    companyName: office.companyName,
    companyValue: office.companyValue
  };
}

function getBranchRankingSummary(user) {
  normalizeBranchOffice(user);
  const office = user.branchOffice;
  if (!office.isFounded) return null;
  return {
    companyName: office.companyName,
    companyValue: office.companyValue,
    employeeCount: office.employees.length,
    maxEmployees: getBranchMaxEmployees(office),
    storageUsed: office.items.length,
    storageSlots: office.storageSlots,
    successChance: getBranchExcavationChance(user),
    itemCodexCount: office.itemCodex.length,
    itemCodexTotal: Object.keys(BRANCH_COLLECTIBLE_ITEMS).length,
    lastLog: office.lastLog
  };
}

function getBranchRankingSummaryFromLean(user) {
  const office = user?.branchOffice || {};
  if (!office.isFounded) return null;
  const employees = Array.isArray(office.employees) ? office.employees : [];
  const items = Array.isArray(office.items) ? office.items : [];
  const itemCodex = Array.isArray(office.itemCodex) ? office.itemCodex : [];
  const itemEffects = calculateBranchItemEffects(office);
  const employeePower = employees.reduce((sum, employee) => sum + Number(employee.excavationPower || 0), 0);
  const itemPower = Number((Number(itemEffects.excavationPowerBonus || 0) * employees.length).toFixed(2));
  const cap = Number((BRANCH_OFFICE_SUCCESS_CAP + Number(itemEffects.excavationSuccessCapBonus || 0)).toFixed(2));
  const successChance = Number(Math.min(cap, employeePower + itemPower).toFixed(2));
  return {
    companyName: office.companyName,
    companyValue: Math.max(0, Math.floor(Number(office.companyValue || 0))),
    employeeCount: employees.length,
    maxEmployees: getBranchMaxEmployees(office),
    storageUsed: items.length,
    storageSlots: Math.max(BRANCH_OFFICE_BASE_STORAGE_SLOTS, Math.min(BRANCH_OFFICE_MAX_STORAGE_SLOTS, Math.floor(Number(office.storageSlots || BRANCH_OFFICE_BASE_STORAGE_SLOTS)))),
    successChance,
    itemCodexCount: itemCodex.length,
    itemCodexTotal: Object.keys(BRANCH_COLLECTIBLE_ITEMS).length,
    lastLog: String(office.lastLog || '').slice(0, 240)
  };
}

function getActiveBuffEffects(user, now = new Date()) {
  const effects = {
    expBonusAdd: 0,
    passiveExpBonusAdd: 0,
    clickExpBonusAdd: 0,
    clickStressRelief: 0,
    noStress: false
  };

  (user.buffs || []).forEach((buff) => {
    if (new Date(buff.expiresAt) <= now) return;

    const buffEffects = BUFF_DATA[buff.buffId]?.effects;
    if (!buffEffects) return;

    effects.expBonusAdd += Number(buffEffects.expBonusAdd || 0);
    effects.passiveExpBonusAdd += Number(buffEffects.passiveExpBonusAdd || 0);
    effects.clickExpBonusAdd += Number(buffEffects.clickExpBonusAdd || 0);
    effects.clickStressRelief += Number(buffEffects.clickStressRelief || 0);
    if (buffEffects.noStress) effects.noStress = true;
  });

  effects.expBonusAdd = Number(effects.expBonusAdd.toFixed(4));
  effects.passiveExpBonusAdd = Number(effects.passiveExpBonusAdd.toFixed(4));
  effects.clickExpBonusAdd = Number(effects.clickExpBonusAdd.toFixed(4));
  effects.clickStressRelief = Number(effects.clickStressRelief.toFixed(2));
  return effects;
}

function calculateDerivedStats(user, now = new Date()) {
  cleanupExpiredBuffs(user, now);

  const itemStats = calculateItemStats(user.inventory);
  const emblemStats = calculateEmblemStats(user.emblems);
  const branchItemStats = calculateBranchItemEffects(user.branchOffice);
  const titleDef = getEquippedTitleDefinition(user);
  const titleEffects = titleDef?.effects || {};
  const activeBuffEffects = getActiveBuffEffects(user, now);
  const dailyAugmentStats = getDailyAugmentEffectTotals(user, now);
  const dailyStressExpBonus = Number(user.gameState?.stress || 0) >= 90
    ? Number(dailyAugmentStats.stressHighExpBonus || 0)
    : 0;
  const kstHour = getKSTHour(now);
  const dailyEveningExpBonus = kstHour >= 18 && kstHour < 24
    ? Number(dailyAugmentStats.eveningExpBonus || 0)
    : 0;
  const dailyExpPenalty = Number(dailyAugmentStats.expPenaltyPercent || 0);

  const moneyBonusPercent = itemStats.moneyBonus + emblemStats.moneyBonus + (titleEffects.moneyBonus || 0) + dailyAugmentStats.moneyBonus;
  const expBonusPercent = itemStats.expBonus + emblemStats.expBonus + dailyAugmentStats.expBonus + dailyStressExpBonus + dailyEveningExpBonus - dailyExpPenalty;
  const titleStressMultiplier = titleEffects.titleStressMultiplier || 1;
  const passiveExpMultiplier = Math.max(0, 1 + activeBuffEffects.expBonusAdd + activeBuffEffects.passiveExpBonusAdd);
  const clickExpMultiplier = Math.max(0, 1 + activeBuffEffects.expBonusAdd + activeBuffEffects.clickExpBonusAdd);
  const typingExpMultiplier = Math.max(0, Number(titleEffects.typingExpMultiplier || 1));

  const finalStressMultiplier = Number((itemStats.stressMultiplier * titleStressMultiplier).toFixed(6));

  return {
    moneyBonusPercent: Number(moneyBonusPercent.toFixed(2)),
    itemMoneyBonusPercent: itemStats.moneyBonus,
    emblemMoneyBonusPercent: emblemStats.moneyBonus,
    titleMoneyBonusPercent: Number((titleEffects.moneyBonus || 0).toFixed(2)),
    dailyAugmentMoneyBonusPercent: dailyAugmentStats.moneyBonus,
    expBonusPercent: Number(expBonusPercent.toFixed(2)),
    itemExpBonusPercent: itemStats.expBonus,
    emblemExpBonusPercent: emblemStats.expBonus,
    dailyAugmentExpBonusPercent: Number((dailyAugmentStats.expBonus + dailyStressExpBonus + dailyEveningExpBonus - dailyExpPenalty).toFixed(4)),
    dailyAugmentStressExpBonusPercent: dailyStressExpBonus,
    dailyAugmentEveningExpBonusPercent: dailyEveningExpBonus,
    dailyAugmentExpPenaltyPercent: dailyExpPenalty,
    raidRewardBonusPercent: Number((emblemStats.raidRewardBonus + dailyAugmentStats.raidRewardBonus + (kstHour >= 18 && kstHour < 24 ? dailyAugmentStats.raidEveningRewardBonus : 0)).toFixed(4)),
    raidRewardOnceBonusPercent: dailyAugmentStats.raidRewardOnceBonusPercent,
    raidExpBonusPercent: emblemStats.raidExpBonus,
    maintenanceReductionPercent: emblemStats.maintenanceReduction,
    stockFeeReductionPercent: Math.min(100, Number((emblemStats.stockFeeReduction + dailyAugmentStats.stockFeeReduction).toFixed(4))),
    infiniteOvertimeRewardBonusPercent: Number((emblemStats.infiniteOvertimeRewardBonus + dailyAugmentStats.infiniteOvertimeRewardBonus).toFixed(4)),
    pvpWinRatingBonusPercent: dailyAugmentStats.pvpWinRatingBonus,
    raidDamageBonusPercent: dailyAugmentStats.raidDamageBonusPercent,
    raidHealShieldBonusPercent: dailyAugmentStats.raidHealShieldBonusPercent,
    raidTurn3DamageBonusPercent: dailyAugmentStats.raidTurn3DamageBonusPercent,
    itemCopyChance: dailyAugmentStats.itemCopyChance,
    raidFreeEntries: dailyAugmentStats.raidFreeEntries,
    shopOnceDiscountPercent: Number((dailyAugmentStats.shopOnceDiscountPercent + dailyAugmentStats.shopDiscountPercent).toFixed(4)),
    branchHourlyExpPercent: branchItemStats.hourlyExpPercent,
    branchExcavationBonusPercent: getBranchEffectiveExcavationPowerBonus(user.branchOffice),
    branchRaidExpBonusPercent: branchItemStats.bossRaidExpBonus,
    branchCompanyValueBonusPercent: branchItemStats.companyValueBonus,
    stressMultiplier: finalStressMultiplier,
    stressReductionPercent: Number(((1 - finalStressMultiplier) * 100).toFixed(2)),
    clickStressRelief: Number((itemStats.clickStressRelief + activeBuffEffects.clickStressRelief).toFixed(2)),
    hourlyStressRelief: Number((titleEffects.hourlyStressRelief || 0).toFixed(2)),
    shopStressRelief: Number((titleEffects.shopStressRelief || 0).toFixed(2)),
    passiveExpMultiplier,
    clickExpMultiplier,
    typingExpMultiplier,
    noStress: activeBuffEffects.noStress,
    maxStaminaBonus: Number(titleEffects.staminaBonus || 0) + Number(dailyAugmentStats.maxStaminaBonus || 0),
    adventureStaminaMultiplier: Number(titleEffects.adventureStaminaMultiplier || 1)
  };
}

function clampStressValue(value) {
  const stress = Number(value);
  if (!Number.isFinite(stress)) return 0;
  return Number(Math.min(100, Math.max(0, stress)).toFixed(4));
}

function setUserStress(user, value) {
  user.gameState.stress = clampStressValue(value);
}

function addUserStress(user, amount) {
  setUserStress(user, Number(user.gameState.stress || 0) + Number(amount || 0));
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

function getEffectiveMaxStamina(user, now = new Date(), derivedStats = null) {
  const stats = derivedStats || calculateDerivedStats(user, now);
  return Number((user.gameState.maxStamina + stats.maxStaminaBonus).toFixed(2));
}

function normalizeUserStamina(user, now = new Date()) {
  ensureUserDefaults(user);
  const maxStamina = getEffectiveMaxStamina(user, now);
  const currentStamina = Number(user.gameState.stamina ?? maxStamina);
  user.gameState.stamina = Number(Math.min(maxStamina, Math.max(0, Number.isFinite(currentStamina) ? currentStamina : maxStamina)).toFixed(2));
  return user.gameState.stamina;
}

function spendUserStamina(user, cost, now = new Date()) {
  const currentStamina = normalizeUserStamina(user, now);
  const staminaCost = Number(cost || 0);
  if (!Number.isFinite(staminaCost) || staminaCost < 0) {
    throw createHttpError(500, '행동력 소모량 계산에 실패했습니다.');
  }
  if (currentStamina + 0.000001 < staminaCost) {
    throw createHttpError(400, `행동력이 부족합니다. (필요: ${staminaCost})`);
  }
  user.gameState.stamina = Number(Math.max(0, currentStamina - staminaCost).toFixed(2));
  return {
    staminaBefore: currentStamina,
    staminaAfter: user.gameState.stamina,
    staminaCost
  };
}

function getAdventureStaminaCost(user, now = new Date(), derivedStats = null) {
  const stats = derivedStats || calculateDerivedStats(user, now);
  const multiplier = Number(stats.adventureStaminaMultiplier || 1);
  return Number(Math.max(0, 1 * (Number.isFinite(multiplier) ? multiplier : 1)).toFixed(2));
}

function hasWorkOptimizationSkill(user) {
  return Number(user?.gameState?.level || 1) >= WORK_OPTIMIZATION_UNLOCK_LEVEL;
}

function getWorkOptimizationSkillState(user, now = new Date()) {
  const unlocked = hasWorkOptimizationSkill(user);
  const lastUsedAt = user.meta?.lastWorkOptimizationAt ? new Date(user.meta.lastWorkOptimizationAt) : null;
  const nextAvailableAt = lastUsedAt
    ? new Date(lastUsedAt.getTime() + WORK_OPTIMIZATION_COOLDOWN_MS)
    : null;
  const remainingMs = unlocked && nextAvailableAt
    ? Math.max(0, nextAvailableAt.getTime() - now.getTime())
    : 0;

  return {
    id: 'work_optimization',
    name: '업무 최적화',
    unlocked,
    unlockLevel: WORK_OPTIMIZATION_UNLOCK_LEVEL,
    cooldownMs: WORK_OPTIMIZATION_COOLDOWN_MS,
    buffDurationMs: WORK_OPTIMIZATION_DURATION_MS,
    lastUsedAt,
    nextAvailableAt,
    remainingMs,
    available: unlocked && remainingMs <= 0,
    desc: '7시간마다 한 번 사용할 수 있습니다. 현재 온라인인 모든 유저에게 1시간 동안 모든 획득 경험치 2배 버프를 부여합니다.'
  };
}

function buildSkillDetails(user, now = new Date()) {
  const workOptimization = getWorkOptimizationSkillState(user, now);
  return {
    unlocked: workOptimization.unlocked,
    workOptimization
  };
}

function reconcileSkills(user) {
  if (!hasWorkOptimizationSkill(user)) return;
  if (user.meta.workOptimizationSkillNotified) return;
  user.meta.workOptimizationSkillNotified = true;
  queueNotification(user, 'skill_unlock', '<업무 최적화> 스킬을 획득했습니다! 스킬 탭에서 7시간마다 사용할 수 있습니다.');
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


function applyDailyAugmentHourlyStamina(user, now = new Date(), derivedStats = null) {
  if (!user?.meta) return;
  const hourlyStamina = Math.max(0, Number(derivedStats?.hourlyStamina || 0));
  const hourlyLimit = Math.max(0, Math.floor(Number(derivedStats?.hourlyStaminaLimit || 0)));
  const dayKey = getKSTDateKey(now);

  if (user.meta.dailyAugmentHourlyStaminaDayKey !== dayKey) {
    user.meta.dailyAugmentHourlyStaminaDayKey = dayKey;
    user.meta.dailyAugmentHourlyStaminaGrantedCount = 0;
    user.meta.dailyAugmentHourlyStaminaLastAt = now;
  }

  if (hourlyStamina <= 0 || hourlyLimit <= 0) return;

  const grantedCount = Math.max(0, Math.floor(Number(user.meta.dailyAugmentHourlyStaminaGrantedCount || 0)));
  const remainingCount = Math.max(0, hourlyLimit - grantedCount);
  if (remainingCount <= 0) return;

  const intervalMs = 60 * 60 * 1000;
  const lastAt = user.meta.dailyAugmentHourlyStaminaLastAt
    ? new Date(user.meta.dailyAugmentHourlyStaminaLastAt)
    : now;
  if (!Number.isFinite(lastAt.getTime())) {
    user.meta.dailyAugmentHourlyStaminaLastAt = now;
    return;
  }

  const elapsedMs = now.getTime() - lastAt.getTime();
  if (elapsedMs < intervalMs) return;

  const tickCount = Math.min(Math.floor(elapsedMs / intervalMs), remainingCount);
  if (tickCount <= 0) return;

  const maxStamina = getEffectiveMaxStamina(user, now);
  const currentStamina = normalizeUserStamina(user, now);
  user.gameState.stamina = Number(Math.min(maxStamina, currentStamina + tickCount * hourlyStamina).toFixed(2));
  user.meta.dailyAugmentHourlyStaminaGrantedCount = grantedCount + tickCount;
  user.meta.dailyAugmentHourlyStaminaLastAt = new Date(lastAt.getTime() + tickCount * intervalMs);
}

function resetDailyStaminaIfNeeded(user, now = new Date(), effectiveMaxStamina = user.gameState.maxStamina) {
  const currentKey = getKSTDateKey(now);
  const lastResetKey = getKSTDateKey(new Date(user.gameState.lastStaminaResetTime));

  if (currentKey !== lastResetKey) {
    user.gameState.stamina = effectiveMaxStamina;
    user.gameState.lastStaminaResetTime = now;
  }
}

function reconcileTitles(user, now = new Date(), derivedStats = null) {
  if (user.meta.loginCount > 0) {
    unlockTitle(user, 'newcomer');
  }

  if (user.meta.catFoodGivenCount >= 10) {
    unlockTitle(user, 'cat_butler');
  }

  const currentStats = derivedStats || calculateDerivedStats(user, now);
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

  reconcileSkills(user);
}

function checkLevelUp(user) {
  if (!user?.gameState) return false;

  user.gameState.level = Math.max(1, Math.floor(Number(user.gameState.level || 1)));
  user.gameState.exp = Math.max(0, Number(user.gameState.exp || 0));

  let leveledUp = false;
  let levelUpCount = 0;
  let safety = 0;
  while (safety < 1000) {
    const requiredExp = getRequiredExp(user.gameState.level);
    if (user.gameState.exp < requiredExp) break;

    user.gameState.exp = Number((user.gameState.exp - requiredExp).toFixed(6));
    user.gameState.level += 1;
    addItemToInventory(user, 'bacchus', 1);
    levelUpCount += 1;
    leveledUp = true;
    safety += 1;
  }

  if (leveledUp) {
    user.gameState.passiveExpCarry = 0;
    reconcileEmblems(user);
    const rewardText = levelUpCount === 1
      ? '박카스 1병'
      : `박카스 ${levelUpCount.toLocaleString()}병`;
    queueNotification(user, 'level_up', `레벨 ${user.gameState.level} 달성! 레벨업 보상으로 ${rewardText}을 받았습니다.`);
  }
  return leveledUp;
}

function calculateOfflineGains(user, now = new Date()) {
  ensureUserDefaults(user);
  markUserSeen(user, now);
  syncDailyShopState(user, now);
  settlePendingStockInvestment(user, now);
  cleanupExpiredBuffs(user, now);
  let derivedStats = calculateDerivedStats(user, now);
  reconcileTitles(user, now, derivedStats);
  reconcileEmblems(user);
  resetDailyStaminaIfNeeded(user, now, getEffectiveMaxStamina(user, now, derivedStats));

  const lastActionTime = new Date(user.gameState.lastActionTime || now);
  let elapsedSeconds = (now.getTime() - lastActionTime.getTime()) / 1000;
  if (elapsedSeconds < 0) elapsedSeconds = 0;
  applyBranchOfficeDailySettlement(user, now, derivedStats);
  applyBranchOfficeHighIncomeTax(user, now, derivedStats);

  if (elapsedSeconds === 0) {
    processBranchAutoExcavation(user, now);
    user.gameState.lastActionTime = now;
    return;
  }

  if (!derivedStats.noStress) {
    const gainedStress = elapsedSeconds * IDLE_STRESS_PER_SECOND * derivedStats.stressMultiplier;
    addUserStress(user, gainedStress);
  }

  if (derivedStats.hourlyStressRelief > 0) {
    const stressRelief = (derivedStats.hourlyStressRelief / 3600) * elapsedSeconds;
    addUserStress(user, -stressRelief);
  }

  applyDailyAugmentHourlyStamina(user, now, derivedStats);

  const rawMoneyGain =
    getSalaryPerSecond(user.gameState.level, derivedStats.moneyBonusPercent) * elapsedSeconds +
    user.gameState.moneyCarry;
  const gainedMoney = Math.floor(rawMoneyGain);
  user.gameState.moneyCarry = Number((rawMoneyGain - gainedMoney).toFixed(6));
  user.gameState.money += gainedMoney;

  const passiveExpMultiplier =
    (1 + derivedStats.expBonusPercent / 100) * derivedStats.passiveExpMultiplier;
  let rawExpGain =
    getPassiveExpPerSecond(user.gameState.level) * passiveExpMultiplier * elapsedSeconds +
    user.gameState.passiveExpCarry;

  if (user.branchOffice?.isFounded && derivedStats.branchHourlyExpPercent > 0) {
    const hourlyBranchExp = getRequiredExp(user.gameState.level) * (derivedStats.branchHourlyExpPercent / 100) * (elapsedSeconds / 3600);
    rawExpGain += hourlyBranchExp;
  }

  if (user.gameState.stress >= 100) {
    rawExpGain /= 2;
  }

  const gainedExp = Math.floor(rawExpGain);
  user.gameState.passiveExpCarry = Number((rawExpGain - gainedExp).toFixed(6));
  user.gameState.exp += gainedExp;

  checkLevelUp(user);
  reconcileTitles(user, now);
  processBranchAutoExcavation(user, now);
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

      if (titleId === 'cat_butler') {
        desc += ` / 현재까지 고양이에게 참치캔을 ${user.meta.catFoodGivenCount}번 건넸습니다.`;
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

function getEmblemPublicDetail(emblemId, extra = {}) {
  const emblem = EMBLEM_DATA[emblemId];
  if (!emblem) return null;
  return {
    id: emblem.id,
    name: emblem.name,
    price: emblem.price,
    desc: emblem.desc,
    imageUrl: emblem.imageUrl,
    className: emblem.className,
    ...extra
  };
}

function getEquippedEmblemDetail(user) {
  return getEmblemPublicDetail(user?.emblems?.equipped);
}

function buildEmblemDetails(user) {
  ensureUserDefaults(user);
  return user.emblems.unlocked
    .filter((emblemId) => EMBLEM_DATA[emblemId])
    .map((emblemId) => getEmblemPublicDetail(emblemId, {
      equipped: user.emblems.equipped === emblemId
    }));
}

function buildEmblemShopState(user, now = new Date()) {
  ensureUserDefaults(user);
  return {
    items: Object.values(EMBLEM_DATA).filter((emblem) => emblem.shopType === 'money').map((emblem) => {
      const owned = user.emblems.unlocked.includes(emblem.id);
      const price = applyDailyAugmentShopDiscount(user, emblem.price, now);
      return getEmblemPublicDetail(emblem.id, {
        price,
        originalPrice: emblem.price,
        owned,
        equipped: user.emblems.equipped === emblem.id,
        canBuy: !owned && Number(user.gameState?.money || 0) >= price
      });
    })
  };
}

function buildDerivedItemStatsResponse(derivedStats) {
  return {
    moneyBonus: derivedStats.moneyBonusPercent,
    itemMoneyBonus: derivedStats.itemMoneyBonusPercent,
    emblemMoneyBonus: derivedStats.emblemMoneyBonusPercent,
    titleMoneyBonus: derivedStats.titleMoneyBonusPercent,
    dailyAugmentMoneyBonus: derivedStats.dailyAugmentMoneyBonusPercent,
    expBonus: derivedStats.expBonusPercent,
    itemExpBonus: derivedStats.itemExpBonusPercent,
    emblemExpBonus: derivedStats.emblemExpBonusPercent,
    dailyAugmentExpBonus: derivedStats.dailyAugmentExpBonusPercent,
    raidRewardBonus: derivedStats.raidRewardBonusPercent,
    raidExpBonus: derivedStats.raidExpBonusPercent,
    maintenanceReduction: derivedStats.maintenanceReductionPercent,
    stockFeeReduction: derivedStats.stockFeeReductionPercent,
    infiniteOvertimeRewardBonus: derivedStats.infiniteOvertimeRewardBonusPercent,
    pvpWinRatingBonus: derivedStats.pvpWinRatingBonusPercent,
    raidDamageBonus: derivedStats.raidDamageBonusPercent,
    raidHealShieldBonus: derivedStats.raidHealShieldBonusPercent,
    branchHourlyExp: derivedStats.branchHourlyExpPercent,
    branchExcavationBonus: derivedStats.branchExcavationBonusPercent,
    branchRaidExpBonus: derivedStats.branchRaidExpBonusPercent,
    branchCompanyValueBonus: derivedStats.branchCompanyValueBonusPercent,
    stressMultiplier: derivedStats.stressMultiplier,
    stressReduction: derivedStats.stressReductionPercent,
    clickStressRelief: derivedStats.clickStressRelief,
    hourlyStressRelief: derivedStats.hourlyStressRelief,
    shopStressRelief: derivedStats.shopStressRelief,
    passiveExpMultiplier: derivedStats.passiveExpMultiplier,
    clickExpMultiplier: derivedStats.clickExpMultiplier,
    typingExpMultiplier: derivedStats.typingExpMultiplier,
    maxStaminaBonus: derivedStats.maxStaminaBonus,
    adventureStaminaMultiplier: derivedStats.adventureStaminaMultiplier
  };
}

function buildGameStateResponse(user, now = new Date()) {
  if (user.branchOffice?.autoExcavationEnabled) {
    processBranchAutoExcavation(user, now, { maxSteps: 1 });
  }
  const derivedStats = calculateDerivedStats(user, now);
  const gameState = user.gameState.toObject ? user.gameState.toObject() : { ...user.gameState };
  gameState.maxStamina = getEffectiveMaxStamina(user, now, derivedStats);
  gameState.stamina = Math.min(gameState.stamina, gameState.maxStamina);
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
    equipmentDetails: buildEquipmentDetails(user),
    equippedEquipment: user.equippedEquipment,
    cards: user.cards,
    enhancedCards: user.enhancedCards,
    lockedCards: user.lockedCards,
    equippedCardId: user.equippedCardId,
    equippedCardLevel: normalizeCardEnhancementLevel(user.equippedCardLevel || 0),
    raidExtraCardSelection: user.raidExtraCardSelection,
    pvpStats: {
      rating: Math.round(Number(user.pvpStats?.rating ?? PVP_RATING_BASE)),
      played: Math.max(0, Math.floor(Number(user.pvpStats?.played || 0))),
      wins: Math.max(0, Math.floor(Number(user.pvpStats?.wins || 0))),
      losses: Math.max(0, Math.floor(Number(user.pvpStats?.losses || 0)))
    },
    cardDetails: buildCardDetails(user),
    cardVariantDetails: buildCardVariantDetails(user),
    buffs: user.buffs,
    titles: user.titles,
    titleDetails: buildTitleDetails(user, now),
    emblems: user.emblems,
    emblemDetails: buildEmblemDetails(user),
    emblemShop: buildEmblemShopState(user, now),
    branchOffice: buildBranchOfficePublicState(user, now, derivedStats),
    pendingStockInvestment: user.pendingStockInvestment,
    stockPortfolio: user.stockPortfolio,
    stockTournament: buildStockTournamentUserSummary(user, now),
    dailyAugment: buildDailyAugmentState(user, now),
    pendingAdventure: user.pendingAdventure,
    shopState: user.shopState,
    fragmentShop: buildFragmentShopState(user, now),
    meta: {
      loginCount: user.meta.loginCount,
      lastShoutAt: user.meta.lastShoutAt,
      lastRaidDayKey: user.meta.lastRaidDayKey,
      raidEntryDayKey: user.meta.raidEntryDayKey,
      raidEntryUsedCount: user.meta.raidEntryUsedCount,
      raidEntryBonusCount: user.meta.raidEntryBonusCount,
      catFoodGivenCount: user.meta.catFoodGivenCount,
      lastTitleChangeDayKey: user.meta.lastTitleChangeDayKey,
      lastWorkOptimizationAt: user.meta.lastWorkOptimizationAt,
      workOptimizationSkillNotified: user.meta.workOptimizationSkillNotified,
      lastAdventureLog: user.meta.lastAdventureLog
    },
    itemStats: buildDerivedItemStatsResponse(derivedStats),
    shopPrices: getShopPricesForUser(user, now),
    skills: buildSkillDetails(user, now)
  };
}

function buildLightGameStateResponse(user, now = new Date()) {
  if (user.branchOffice?.autoExcavationEnabled) {
    processBranchAutoExcavation(user, now, { maxSteps: 1 });
  }
  const derivedStats = calculateDerivedStats(user, now);
  const gameState = user.gameState.toObject ? user.gameState.toObject() : { ...user.gameState };
  gameState.maxStamina = getEffectiveMaxStamina(user, now, derivedStats);
  gameState.stamina = Math.min(gameState.stamina, gameState.maxStamina);
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
    equippedCardId: user.equippedCardId || null,
    equippedCardLevel: normalizeCardEnhancementLevel(user.equippedCardLevel || 0),
    raidExtraCardSelection: user.raidExtraCardSelection,
    buffs: user.buffs,
    pvpStats: {
      rating: Math.round(Number(user.pvpStats?.rating ?? PVP_RATING_BASE)),
      played: Math.max(0, Math.floor(Number(user.pvpStats?.played || 0))),
      wins: Math.max(0, Math.floor(Number(user.pvpStats?.wins || 0))),
      losses: Math.max(0, Math.floor(Number(user.pvpStats?.losses || 0)))
    },
    infiniteOvertime: user.infiniteOvertime,
    branchOffice: buildBranchOfficePublicState(user, now, derivedStats),
    pendingStockInvestment: user.pendingStockInvestment,
    stockPortfolio: user.stockPortfolio,
    stockTournament: buildStockTournamentUserSummary(user, now),
    dailyAugment: buildDailyAugmentState(user, now),
    pendingAdventure: user.pendingAdventure,
    shopState: user.shopState,
    fragmentShop: buildFragmentShopState(user, now),
    shopPrices: getShopPricesForUser(user, now),
    skills: buildSkillDetails(user, now),
    titles: user.titles,
    titleDetails: buildTitleDetails(user, now),
    emblems: user.emblems,
    emblemDetails: buildEmblemDetails(user),
    meta: {
      loginCount: user.meta.loginCount,
      lastShoutAt: user.meta.lastShoutAt,
      lastRaidDayKey: user.meta.lastRaidDayKey,
      raidEntryDayKey: user.meta.raidEntryDayKey,
      raidEntryUsedCount: user.meta.raidEntryUsedCount,
      raidEntryBonusCount: user.meta.raidEntryBonusCount,
      catFoodGivenCount: user.meta.catFoodGivenCount,
      lastTitleChangeDayKey: user.meta.lastTitleChangeDayKey,
      lastWorkOptimizationAt: user.meta.lastWorkOptimizationAt,
      workOptimizationSkillNotified: user.meta.workOptimizationSkillNotified,
      lastAdventureLog: user.meta.lastAdventureLog
    },
    itemStats: buildDerivedItemStatsResponse(derivedStats)
  };
}

function buildRealtimeGameStatePatch(user, now = new Date()) {
  const derivedStats = calculateDerivedStats(user, now);
  const gameState = user.gameState.toObject ? user.gameState.toObject() : { ...user.gameState };
  gameState.maxStamina = getEffectiveMaxStamina(user, now, derivedStats);
  gameState.stamina = Math.min(gameState.stamina, gameState.maxStamina);
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
    equippedCardId: user.equippedCardId || null,
    equippedCardLevel: normalizeCardEnhancementLevel(user.equippedCardLevel || 0),
    raidExtraCardSelection: user.raidExtraCardSelection,
    buffs: user.buffs,
    titles: user.titles,
    titleDetails: buildTitleDetails(user, now),
    emblems: user.emblems,
    dailyAugment: buildDailyAugmentState(user, now),
    pendingAdventure: user.pendingAdventure,
    shopState: user.shopState,
    pvpStats: {
      rating: Math.round(Number(user.pvpStats?.rating ?? PVP_RATING_BASE)),
      played: Math.max(0, Math.floor(Number(user.pvpStats?.played || 0))),
      wins: Math.max(0, Math.floor(Number(user.pvpStats?.wins || 0))),
      losses: Math.max(0, Math.floor(Number(user.pvpStats?.losses || 0)))
    },
    meta: {
      loginCount: user.meta.loginCount,
      lastShoutAt: user.meta.lastShoutAt,
      lastRaidDayKey: user.meta.lastRaidDayKey,
      raidEntryDayKey: user.meta.raidEntryDayKey,
      raidEntryUsedCount: user.meta.raidEntryUsedCount,
      raidEntryBonusCount: user.meta.raidEntryBonusCount,
      catFoodGivenCount: user.meta.catFoodGivenCount,
      lastTitleChangeDayKey: user.meta.lastTitleChangeDayKey,
      lastWorkOptimizationAt: user.meta.lastWorkOptimizationAt,
      workOptimizationSkillNotified: user.meta.workOptimizationSkillNotified,
      lastAdventureLog: user.meta.lastAdventureLog
    },
    itemStats: buildDerivedItemStatsResponse(derivedStats),
    skills: buildSkillDetails(user, now)
  };
}

function buildRealtimeUserResponse(user, now = new Date()) {
  return {
    userPatch: buildRealtimeGameStatePatch(user, now),
    notifications: consumeNotifications(user)
  };
}

async function buildRealtimeUserResponseWithGlobals(user, now = new Date(), options = {}) {
  const response = buildRealtimeUserResponse(user, now);
  response.global = getGlobalState(now);

  if (options.includeCardState === true) {
    response.userPatch = {
      ...response.userPatch,
      cards: user.cards,
      enhancedCards: user.enhancedCards,
      lockedCards: user.lockedCards,
      cardDetails: buildCardDetails(user),
      cardVariantDetails: buildCardVariantDetails(user)
    };
  }

  if (options.includePendingCounts !== false) {
    response.marketplaceSoldPendingCount = await getMarketplaceSoldPendingCount(user._id);
    response.adminMailPendingCount = await getPendingAdminMailCount(user._id, now);
  }

  return response;
}

function buildLightUserResponse(user, now = new Date()) {
  return {
    userPatch: buildLightGameStateResponse(user, now),
    notifications: consumeNotifications(user)
  };
}

async function buildLightUserResponseWithGlobals(user, now = new Date(), options = {}) {
  const response = buildLightUserResponse(user, now);
  response.global = getGlobalState(now);

  if (options.includePendingCounts !== false) {
    response.marketplaceSoldPendingCount = await getMarketplaceSoldPendingCount(user._id);
    response.adminMailPendingCount = await getPendingAdminMailCount(user._id, now);
  }

  return response;
}

function buildUserResponse(user, now = new Date()) {
  return {
    user: buildGameStateResponse(user, now),
    notifications: consumeNotifications(user)
  };
}

async function buildUserResponseWithGlobals(user, now = new Date(), options = {}) {
  const response = buildUserResponse(user, now);
  response.global = getGlobalState(now);

  if (options.includePendingCounts !== false) {
    response.marketplaceSoldPendingCount = await getMarketplaceSoldPendingCount(user._id);
    response.adminMailPendingCount = await getPendingAdminMailCount(user._id, now);
  }

  return response;
}

async function buildFastUserResponseWithGlobals(user, now = new Date()) {
  return buildUserResponseWithGlobals(user, now, { includePendingCounts: false });
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

function clearPendingAdventure(user) {
  user.pendingAdventure = {
    eventId: null,
    location: null,
    actor: null,
    message: null,
    createdAt: null
  };
}

function setAdventureLog(user, text) {
  user.meta.lastAdventureLog = text || '';
}

function cleanupActiveShouts(now = new Date()) {
  activeShouts = activeShouts.filter((entry) => entry.expiresAt > now);
}

function pushShoutMessage(text, now = new Date()) {
  cleanupActiveShouts(now);
  activeShouts.push({
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    expiresAt: new Date(now.getTime() + SHOUT_VISIBLE_DURATION_MS)
  });
}

function getGlobalState(now = new Date()) {
  cleanupActiveShouts(now);
  return {
    activeShoutText: activeShouts.map((entry) => entry.text).join(' // '),
    activeShoutKey: activeShouts.map((entry) => entry.id).join('|')
  };
}

function getRemainingExpToNextLevel(user) {
  return Math.max(0, getRequiredExp(user.gameState.level) - user.gameState.exp);
}

function getAdventureExpFractionScale(level) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  if (safeLevel <= 50) return 1;
  return Math.pow(0.9995, safeLevel - 50);
}

function getGeneralExpMultiplier(user, now = new Date()) {
  const derivedStats = calculateDerivedStats(user, now);
  const activeBuffEffects = getActiveBuffEffects(user, now);
  const multiplier = (1 + derivedStats.expBonusPercent / 100) * (1 + activeBuffEffects.expBonusAdd);
  return Number.isFinite(multiplier) ? Math.max(0, multiplier) : 1;
}

function grantExperience(user, baseExp, now = new Date(), options = {}) {
  const beforeLevel = Number(user.gameState.level || 1);
  const beforeExp = Number(user.gameState.exp || 0);
  const rawMultiplier = options.multiplier ?? getGeneralExpMultiplier(user, now);
  const multiplier = Number.isFinite(rawMultiplier) ? Math.max(0, rawMultiplier) : 1;
  const minimumGain = options.minimumGain ?? 0;
  const safeBaseExp = Math.max(0, Math.floor(Number(baseExp) || 0));
  const gainedExp = Math.max(minimumGain, Math.floor(safeBaseExp * multiplier));

  user.gameState.exp = beforeExp + gainedExp;
  const leveledUp = checkLevelUp(user);

  return {
    beforeLevel,
    beforeExp,
    beforeRequiredExp: getRequiredExp(beforeLevel),
    baseExp: safeBaseExp,
    gainedExp,
    multiplier: Number(multiplier.toFixed(4)),
    leveledUp,
    afterLevel: Number(user.gameState.level || beforeLevel),
    afterExp: Number(user.gameState.exp || 0),
    afterRequiredExp: getRequiredExp(user.gameState.level || beforeLevel)
  };
}

function applyAutomaticCatTunaCanReward(user, now = new Date()) {
  const hadCatButlerTitle = user.titles?.unlocked?.includes('cat_butler');

  if (!(getCatTunaCanQuantity(user) > 0 && removeCatTunaCanFromInventory(user, 1))) {
    let rewardText = '참치캔이 없어 고양이에게 아무것도 줄 수 없었습니다.';
    if (hadCatButlerTitle) {
      setOrRefreshBuff(user, 'cat_gratitude_buff', CAT_GRATITUDE_DURATION_MS, { now });
      rewardText += ' 그래도 고양이는 당신을 기억하고 있어 고양이의 보은 버프를 챙겨주었습니다.';
    }
    return rewardText;
  }

  user.meta.catFoodGivenCount += 1;
  let rewardText = `고양이에게 참치캔을 건넸습니다. 현재 총 ${user.meta.catFoodGivenCount}번 건네주었습니다.`;

  if (user.meta.catFoodGivenCount >= 10) {
    unlockTitle(user, 'cat_butler');
    setOrRefreshBuff(user, 'cat_gratitude_buff', CAT_GRATITUDE_DURATION_MS, { now });
    rewardText += ' 고양이의 보은 버프를 획득했습니다.';
  }

  if (hadCatButlerTitle || user.meta.catFoodGivenCount >= 10) {
    setOrRefreshBuff(user, 'cat_gratitude_buff', CAT_GRATITUDE_DURATION_MS, { now });
    addItemToInventory(user, 'bacchus', 1);

    const extraItemPool = ['hot6', 'cat_tuna_can', 'reward_pen_monami'];
    const extraItemId = extraItemPool[Math.floor(Math.random() * extraItemPool.length)];
    addItemToInventory(user, extraItemId, 1);

    rewardText += ` 고양이가 보답으로 박카스 1개와 ${ITEM_DATA[extraItemId].name} 1개를 챙겨주고 갔습니다.`;
  }

  return rewardText;
}

function applyAdventureReward(user, reward, now = new Date(), options = {}) {
  if (!reward) {
    return '아무것도 획득하지 못했습니다.';
  }

  if (reward.type === 'bundle') {
    const summaries = reward.rewards
      .map((entry) => applyAdventureReward(user, entry, now, options))
      .filter(Boolean);
    return summaries.length ? summaries.join(' / ') : '아무것도 획득하지 못했습니다.';
  }

  if (reward.type === 'none') {
    return '아무것도 획득하지 못했습니다.';
  }

  if (reward.type === 'money') {
    const rewardAmount = Math.trunc(Number(reward.amount || 0));
    const beforeMoney = Number(user.gameState.money || 0);
    user.gameState.money = Math.max(0, beforeMoney + rewardAmount);
    const actualDelta = Math.trunc(user.gameState.money - beforeMoney);
    if (actualDelta === 0) return '잔고는 변하지 않았습니다.';
    return actualDelta > 0
      ? `${actualDelta.toLocaleString()}원을 획득했습니다.`
      : `${Math.abs(actualDelta).toLocaleString()}원을 잃었습니다.`;
  }

  if (reward.type === 'stress') {
    const beforeStress = user.gameState.stress;
    addUserStress(user, reward.amount);
    const actualDelta = Number((user.gameState.stress - beforeStress).toFixed(2));
    if (actualDelta === 0) return '스트레스는 변하지 않았습니다.';
    return actualDelta > 0
      ? `스트레스가 ${actualDelta} 증가했습니다.`
      : `스트레스가 ${Math.abs(actualDelta)} 감소했습니다.`;
  }

  if (reward.type === 'item') {
    addItemToInventory(user, reward.itemId, reward.quantity || 1);
    const itemName = ITEM_DATA[reward.itemId]?.name || reward.itemId;
    return `${itemName} ${reward.quantity || 1}개를 획득했습니다.`;
  }

  if (reward.type === 'buff') {
    const durationMs = BUFF_DATA[reward.buffId]?.durationMs;
    if (!durationMs) return '아무 일도 일어나지 않았습니다.';
    if (options.deferBuffIds?.has(reward.buffId) && options.deferredBuffCounts instanceof Map) {
      options.deferredBuffCounts.set(reward.buffId, (options.deferredBuffCounts.get(reward.buffId) || 0) + 1);
      return `${BUFF_DATA[reward.buffId].name} 효과를 획득했습니다. 이 효과는 일괄 정산이 끝난 뒤 적용됩니다.`;
    }
    setOrRefreshBuff(user, reward.buffId, durationMs, { now, stackDuration: true });
    return `${BUFF_DATA[reward.buffId].name} 효과를 획득했습니다.`;
  }

  if (reward.type === 'exp_fraction') {
    const remainingExp = getRemainingExpToNextLevel(user);
    const levelScale = getAdventureExpFractionScale(user.gameState.level);
    const baseExp = Math.max(1, Math.floor((remainingExp / reward.divisor) * levelScale));
    const expResult = grantExperience(user, baseExp, now, { minimumGain: 1 });
    const multiplierText = expResult.multiplier !== 1
      ? ` (경험치 배율 ${expResult.multiplier.toFixed(2)}배 적용)`
      : '';

    if (expResult.leveledUp) {
      return `${expResult.gainedExp.toLocaleString()} 경험치를 얻어 레벨 ${expResult.afterLevel}이 되었습니다.${multiplierText} 현재 경험치 ${expResult.afterExp.toLocaleString()}/${expResult.afterRequiredExp.toLocaleString()}`;
    }

    return `${expResult.gainedExp.toLocaleString()} 경험치를 획득했습니다.${multiplierText} 현재 경험치 ${expResult.afterExp.toLocaleString()}/${expResult.afterRequiredExp.toLocaleString()}`;
  }

  if (reward.type === 'rare_level') {
    if (Math.random() < reward.chance) {
      const beforeLevel = Number(user.gameState.level || 1);
      user.gameState.exp = getRequiredExp(user.gameState.level);
      const leveledUp = checkLevelUp(user);
      return leveledUp
        ? `기적처럼 즉시 레벨업하여 레벨 ${user.gameState.level}이 되었습니다! 현재 경험치 ${Number(user.gameState.exp || 0).toLocaleString()}/${getRequiredExp(user.gameState.level).toLocaleString()}`
        : `기적이 스쳐 지나갔지만 레벨 ${beforeLevel}에 머물렀습니다.`;
    }
    const fallbackText = applyAdventureReward(user, reward.fallback, now, options);
    return `즉시 레벨업에는 실패했습니다. 대신 ${fallbackText}`;
  }

  return '아무것도 획득하지 못했습니다.';
}

function rollAdventureEvent() {
  if (Math.random() < ADVENTURE_SCROLL_DROP_CHANCE) {
    return ADVENTURE_SCROLL_EVENT_DEFINITIONS[Math.floor(Math.random() * ADVENTURE_SCROLL_EVENT_DEFINITIONS.length)];
  }
  return ADVENTURE_EVENT_DEFINITIONS[Math.floor(Math.random() * ADVENTURE_EVENT_DEFINITIONS.length)];
}

async function buildAdventureChoiceResponse(user, now = new Date()) {
  const response = await buildRealtimeUserResponseWithGlobals(user, now, { includePendingCounts: false });
  response.adventureResult = {
    requiresChoice: true,
    title: `${user.pendingAdventure.location} / ${user.pendingAdventure.actor}`,
    message: user.pendingAdventure.message,
    prompt: '참치캔을 주겠습니까?',
    buttons: [
      { value: 'yes', label: '예' },
      { value: 'no', label: '아니오' }
    ]
  };
  return response;
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
      addItemToInventory(user, 'reward_pen_monami', 1);
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
    await persistUserSnapshot(user);

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


app.post('/api/daily-augment/reroll', async (req, res) => {
  const { userId } = req.body;
  const slotIndex = Math.floor(Number(req.body?.slotIndex));
  if (!userId || !Number.isInteger(slotIndex)) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });

  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      reconcileTitles(user, now);
      ensureDailyAugmentState(user, now);

      if (user.meta.dailyAugmentSelectedId) {
        throw createHttpError(400, '이미 오늘의 증강을 선택했습니다.');
      }
      if (slotIndex < 0 || slotIndex >= DAILY_AUGMENT_OPTION_COUNT) {
        throw createHttpError(400, '다시 굴릴 증강 위치가 올바르지 않습니다.');
      }

      const rerolledSlots = Array.isArray(user.meta.dailyAugmentRerolledSlots)
        ? [...new Set(user.meta.dailyAugmentRerolledSlots.map((slot) => Math.floor(Number(slot))).filter((slot) => Number.isInteger(slot)))]
        : [];
      if (rerolledSlots.includes(slotIndex)) {
        throw createHttpError(400, '이미 다시 굴린 증강입니다.');
      }

      const nextAugmentId = getDailyAugmentRerollOption(user, user.meta.dailyAugmentDayKey, user.meta.dailyAugmentTier, slotIndex);
      if (!nextAugmentId) {
        throw createHttpError(400, '더 이상 바꿀 증강 후보가 없습니다.');
      }

      const options = Array.isArray(user.meta.dailyAugmentOptions) ? [...user.meta.dailyAugmentOptions] : [];
      options[slotIndex] = nextAugmentId;
      user.meta.dailyAugmentOptions = options;
      user.meta.dailyAugmentRerolledSlots = [...rerolledSlots, slotIndex];
      user.gameState.lastActionTime = now;
      return buildRealtimeUserResponseWithGlobals(user, now, { includePendingCounts: false });
    }, { conflictLabel: 'Daily augment reroll conflict', snapshotBuilder: buildUserSyncPersistenceSnapshot, selectFields: LIGHT_USER_SELECT_FIELDS });

    res.json(response);
  } catch (err) {
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ msg: err.message });
    }
    console.error('Daily augment reroll error:', err);
    res.status(500).json({ msg: '증강 다시 굴리기에 실패했습니다.' });
  }
});

app.post('/api/daily-augment/select', async (req, res) => {
  const { userId, augmentId } = req.body;
  if (!userId || !augmentId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });

  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      reconcileTitles(user, now);
      ensureDailyAugmentState(user, now);

      const options = Array.isArray(user.meta.dailyAugmentOptions) ? user.meta.dailyAugmentOptions : [];
      if (user.meta.dailyAugmentSelectedId) {
        throw createHttpError(400, '오늘의 증강은 이미 선택했습니다.');
      }
      if (!options.includes(augmentId) || !DAILY_AUGMENT_DATA[augmentId]) {
        throw createHttpError(400, '오늘 선택 가능한 증강이 아닙니다.');
      }

      user.meta.dailyAugmentSelectedId = augmentId;
      const selectedAugmentEffects = DAILY_AUGMENT_DATA[augmentId]?.effects || {};
      if (Number(selectedAugmentEffects.hourlyStamina || 0) > 0 && Number(selectedAugmentEffects.hourlyStaminaLimit || 0) > 0) {
        user.meta.dailyAugmentHourlyStaminaDayKey = getKSTDateKey(now);
        user.meta.dailyAugmentHourlyStaminaGrantedCount = 0;
        user.meta.dailyAugmentHourlyStaminaLastAt = now;
      }
      const resolvedAugmentEffects = getResolvedDailyAugmentIds(user, now)
        .map((resolvedAugmentId) => DAILY_AUGMENT_DATA[resolvedAugmentId]?.effects || {});
      const sumResolvedEffect = (effectKey) => resolvedAugmentEffects
        .reduce((total, effects) => total + Math.max(0, Number(effects[effectKey] || 0)), 0);

      const ticketGrant = Math.max(0, Math.floor(sumResolvedEffect('raidEntryTicketGrant')));
      if (ticketGrant > 0) {
        addItemToInventory(user, 'raid_entry_ticket', ticketGrant, { allowDailyAugmentCopy: false, now });
        queueNotification(user, 'daily_augment_reward', `오늘의 증강 보상으로 회의 추가 입장권 ${ticketGrant}장을 획득했습니다.`);
      }
      const chairmanMoodTicketGrant = Math.max(0, Math.floor(sumResolvedEffect('chairmanMoodTicket')));
      if (chairmanMoodTicketGrant > 0) {
        addItemToInventory(user, 'chairman_mood_ticket', chairmanMoodTicketGrant, { allowDailyAugmentCopy: false, now });
        queueNotification(user, 'daily_augment_reward', `오늘의 증강 보상으로 회장님의 기분 티켓 ${chairmanMoodTicketGrant}장을 획득했습니다.`);
      }
      const bacchusGrant = Math.max(0, Math.floor(sumResolvedEffect('bacchusGrant')));
      if (bacchusGrant > 0) {
        addItemToInventory(user, 'bacchus', bacchusGrant, { allowDailyAugmentCopy: false, now });
        queueNotification(user, 'daily_augment_reward', `오늘의 증강 보상으로 박카스 ${bacchusGrant}개를 획득했습니다.`);
      }
      user.gameState.lastActionTime = now;
      return buildRealtimeUserResponseWithGlobals(user, now, { includePendingCounts: false });
    }, { conflictLabel: 'Daily augment select conflict', snapshotBuilder: buildUserSyncPersistenceSnapshot, selectFields: LIGHT_USER_SELECT_FIELDS });

    res.json(response);
  } catch (err) {
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ msg: err.message });
    }
    console.error('Daily augment select error:', err);
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
    await persistUserSnapshot(user);
    res.json({ success: true, nickname: user.nickname });
  } catch (err) {
    console.error('Set nickname error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.get('/api/news-typing/prompt', async (req, res) => {
  try {
    const prompt = await getNewsTypingPrompt(req.query.afterId || null);
    if (!prompt) return res.status(503).json({ msg: '뉴스 문장을 불러오지 못했습니다.' });
    res.json({ prompt: buildClientNewsTypingPrompt(prompt) });
  } catch (err) {
    console.error('News typing prompt error:', err);
    const fallbackPrompt = NEWS_TYPING_FALLBACK_SENTENCES.map(buildNewsTypingPrompt)[0];
    res.json({ prompt: buildClientNewsTypingPrompt(fallbackPrompt) });
  }
});

app.post('/api/action/work', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const requestIp = getRequestIp(req);
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      cleanupExpiredBuffs(user, now);

      const derivedStats = calculateDerivedStats(user, now);
      const hadTooMuchStress = user.gameState.stress >= 100;
      const antiCheat = applyWorkClickAntiCheat(user, { now, ip: requestIp });

      if (!derivedStats.noStress) {
        const clickStressGain = CLICK_STRESS_GAIN * derivedStats.stressMultiplier;
        addUserStress(user, clickStressGain);
      }

      if (derivedStats.clickStressRelief > 0) {
        addUserStress(user, -derivedStats.clickStressRelief);
      }

      if (!hadTooMuchStress) {
        const expMultiplier = (1 + derivedStats.expBonusPercent / 100);
        user.gameState.exp += Math.floor(getClickExp(user.gameState.level) * expMultiplier * derivedStats.clickExpMultiplier * antiCheat.rewardMultiplier);
      }

      checkLevelUp(user);
      reconcileTitles(user, now);
      user.gameState.lastActionTime = now;
      const dropAttempts = antiCheat.rewardMultiplier >= 1 || Math.random() < antiCheat.rewardMultiplier ? 1 : 0;
      const workDrops = applyWorkDrops(user, dropAttempts, { includeRepairCoupon: true });
      const workDrop = workDrops[0] || null;
      if (workDrop?.text) {
        queueNotification(user, 'work_drop', workDrop.text);
      }
      const response = await buildRealtimeUserResponseWithGlobals(user, now, { includePendingCounts: false });
      if (workDrop) {
        response.workDrop = workDrop;
      }
      response.workAntiCheat = {
        rewardMultiplier: antiCheat.rewardMultiplier,
        warning: antiCheat.warning
      };
      return response;
    }, { conflictLabel: 'Work action conflict', snapshotBuilder: buildUserSyncPersistenceSnapshot, selectFields: LIGHT_USER_SELECT_FIELDS });

    res.json(response);
  } catch (err) {
    console.error('Work action error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/action/news-typing', async (req, res) => {
  const { userId, promptId, answer } = req.body;
  if (!userId || !promptId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });

  let submissionKey = null;
  try {
    const prompt = await findNewsTypingPrompt(promptId);
    if (!prompt) {
      return res.status(400).json({ msg: '뉴스 문장이 만료되었습니다. 새 문장을 불러와주세요.' });
    }

    const normalizedAnswer = normalizeNewsTypingAnswer(answer);
    const normalizedPromptText = normalizeNewsTypingAnswer(prompt.text);
    if (normalizedAnswer !== normalizedPromptText) {
      return res.status(400).json({ msg: '문장이 정확히 일치하지 않습니다.' });
    }

    submissionKey = reserveNewsTypingSubmission(userId, promptId);
    if (!submissionKey) {
      return res.status(429).json({ msg: '이미 정산 중인 문장입니다. 잠시만 기다려주세요.' });
    }

    const requestIp = getRequestIp(req);
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      cleanupExpiredBuffs(user, now);

      const derivedStats = calculateDerivedStats(user, now);
      const hadTooMuchStress = user.gameState.stress >= 100;
      const unitCount = Math.max(1, Number(prompt.unitCount || getNewsTypingUnitCount(prompt.text)));
      const antiCheat = applyNewsTypingAntiCheat(user, { now, unitCount, ip: requestIp });
      const clickStressGain = CLICK_STRESS_GAIN * unitCount * derivedStats.stressMultiplier;

      if (!derivedStats.noStress) {
        addUserStress(user, clickStressGain);
      }

      if (derivedStats.clickStressRelief > 0) {
        addUserStress(user, -(derivedStats.clickStressRelief * unitCount));
      }

      let gainedExp = 0;
      if (!hadTooMuchStress) {
        const expMultiplier = (1 + derivedStats.expBonusPercent / 100);
        gainedExp = Math.floor(
          getClickExp(user.gameState.level)
          * unitCount
          * expMultiplier
          * derivedStats.clickExpMultiplier
          * derivedStats.typingExpMultiplier
          * antiCheat.rewardMultiplier
        );
        user.gameState.exp += gainedExp;
      }

      checkLevelUp(user);
      reconcileTitles(user, now);
      user.gameState.lastActionTime = now;
      const typingDropAttempts = Math.max(0, Math.floor(unitCount * antiCheat.rewardMultiplier));
      const typingDrops = applyWorkDrops(user, typingDropAttempts);
      typingDrops.forEach((drop) => {
        if (drop?.text) queueNotification(user, 'work_drop', drop.text);
      });

      const nextPrompt = await getNewsTypingPrompt(prompt.id);
      const mutationResponse = await buildRealtimeUserResponseWithGlobals(user, now, { includePendingCounts: false });
      mutationResponse.newsTypingResult = {
        gainedExp,
        unitCount,
        wordCount: unitCount,
        dropCount: typingDrops.length,
        nextPrompt: buildClientNewsTypingPrompt(nextPrompt),
        antiCheat: {
          rewardMultiplier: antiCheat.rewardMultiplier,
          warning: antiCheat.warning
        }
      };
      return mutationResponse;
    }, { conflictLabel: 'News typing action conflict', snapshotBuilder: buildUserSyncPersistenceSnapshot, selectFields: LIGHT_USER_SELECT_FIELDS });

    markNewsTypingSubmissionSettled(submissionKey);
    res.json(response);
  } catch (err) {
    console.error('News typing action error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  } finally {
    if (submissionKey) activeNewsTypingSubmissions.delete(submissionKey);
  }
});

app.post('/api/skill/work-optimization', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      cleanupExpiredBuffs(user, now);
      reconcileTitles(user, now);

      const skillState = getWorkOptimizationSkillState(user, now);
      if (!skillState.unlocked) {
        throw createHttpError(403, `${WORK_OPTIMIZATION_UNLOCK_LEVEL}레벨부터 사용할 수 있는 스킬입니다.`);
      }
      if (!skillState.available) {
        const remainingMinutes = Math.ceil(skillState.remainingMs / 60000);
        throw createHttpError(400, `업무 최적화는 아직 재사용 대기 중입니다. 약 ${remainingMinutes}분 후 사용할 수 있습니다.`);
      }

      user.meta.lastWorkOptimizationAt = now;
      setOrRefreshBuff(user, 'work_optimization_buff', WORK_OPTIMIZATION_DURATION_MS, { now });
      user.markModified('meta');
      queueNotification(user, 'skill_use', '<업무 최적화>를 사용했습니다. 온라인 유저들에게 1시간 경험치 2배 버프가 적용됩니다.');

      const onlineSince = new Date(now.getTime() - ONLINE_THRESHOLD_MS);
      const onlineTargets = await User.find({
        _id: { $ne: user._id },
        'meta.lastSeenAt': { $gte: onlineSince }
      }).select('_id nickname username');

      let deliveredCount = 1;
      for (const target of onlineTargets) {
        try {
          await runUserMutationWithRetry(target._id, async (targetUser) => {
            const targetNow = new Date();
            cleanupExpiredBuffs(targetUser, targetNow);
            setOrRefreshBuff(targetUser, 'work_optimization_buff', WORK_OPTIMIZATION_DURATION_MS, { now: targetNow });
            queueNotification(targetUser, 'skill_buff', '누군가 <업무 최적화>를 사용했습니다! 1시간 동안 모든 획득 경험치가 2배가 됩니다.');
            return null;
          }, { conflictLabel: 'Work optimization target conflict' });
          deliveredCount += 1;
        } catch (err) {
          console.error('Work optimization target skipped:', err);
        }
      }

      const mutationResponse = await buildLightUserResponseWithGlobals(user, now);
      mutationResponse.skillResult = {
        name: '업무 최적화',
        deliveredCount,
        message: `업무 최적화 버프를 현재 온라인 유저 ${deliveredCount}명에게 적용했습니다.`
      };
      return mutationResponse;
    }, { conflictLabel: 'Work optimization skill conflict' });

    res.json(response);
  } catch (err) {
    console.error('Work optimization skill error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/action/field-work', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      cleanupExpiredBuffs(user, now);

      if (user.gameState.stamina < 6) {
        throw createHttpError(400, '행동력이 부족합니다. (필요: 6)');
      }

      if (hasBuff(user, 'field_work_buff', now)) {
        throw createHttpError(400, '이미 외근 중입니다.');
      }

      user.gameState.stamina -= 6;
      setOrRefreshBuff(user, 'field_work_buff', FIELD_WORK_DURATION_MS);
      user.gameState.lastActionTime = now;

      return buildLightUserResponseWithGlobals(user, now);
    }, { conflictLabel: 'Field work action conflict' });
    res.json(response);
  } catch (err) {
    console.error('Field work action error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/action/adventure', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      cleanupExpiredBuffs(user, now);

      if (user.pendingAdventure?.eventId) {
        const pendingResponse = await buildAdventureChoiceResponse(user, now);
        pendingResponse.adventureResult.alreadyPending = true;
        return pendingResponse;
      }

      const lastAdventureAtMs = user.meta.lastAdventureAt ? new Date(user.meta.lastAdventureAt).getTime() : 0;
      const elapsedAdventureMs = lastAdventureAtMs ? now.getTime() - lastAdventureAtMs : ADVENTURE_COOLDOWN_MS;
      if (elapsedAdventureMs < ADVENTURE_COOLDOWN_MS) {
        const remainingTenths = Math.ceil((ADVENTURE_COOLDOWN_MS - elapsedAdventureMs) / 100) / 10;
        throw createHttpError(429, `모험 준비 중입니다. ${remainingTenths.toFixed(1)}초 후 다시 시도해주세요.`);
      }

      const staminaBefore = normalizeUserStamina(user, now);
      const staminaCost = getAdventureStaminaCost(user, now);
      if (staminaBefore + 0.000001 < staminaCost) {
        throw createHttpError(400, `행동력이 부족합니다. (필요: ${staminaCost})`);
      }

      user.gameState.stamina = Number((user.gameState.stamina - staminaCost).toFixed(2));
      const staminaAfter = normalizeUserStamina(user, now);
      user.gameState.lastActionTime = now;
      user.meta.lastAdventureAt = now;

      const event = rollAdventureEvent();
      const eventTitle = `${event.location} / ${event.actor}`;
      setAdventureLog(user, `${eventTitle} - ${event.message}`);

      if (event.reward?.type === 'cat_choice') {
        if (getCatTunaCanQuantity(user) > 0) {
          const rewardText = applyAutomaticCatTunaCanReward(user, now);
          setAdventureLog(user, `${eventTitle} - ${event.message} / ${rewardText}`);
          clearPendingAdventure(user);
          reconcileTitles(user, now);
          reconcileEmblems(user);

          const response = await buildLightUserResponseWithGlobals(user, now);
          response.adventureResult = {
            requiresChoice: false,
            autoFedCat: true,
            title: eventTitle,
            message: event.message,
            rewardText,
            staminaBefore,
            staminaAfter,
            staminaCost
          };
          return response;
        }

        user.pendingAdventure = {
          eventId: event.id,
          location: event.location,
          actor: event.actor,
          message: event.message,
          createdAt: now
        };
        const choiceResponse = await buildAdventureChoiceResponse(user, now);
        choiceResponse.adventureResult.staminaBefore = staminaBefore;
        choiceResponse.adventureResult.staminaAfter = staminaAfter;
        choiceResponse.adventureResult.staminaCost = staminaCost;
        return choiceResponse;
      }

      const rewardText = applyAdventureReward(user, event.reward, now);
      setAdventureLog(user, `${eventTitle} - ${event.message} / ${rewardText}`);
      clearPendingAdventure(user);
      reconcileTitles(user, now);

      const response = await buildLightUserResponseWithGlobals(user, now);
      response.adventureResult = {
        requiresChoice: false,
        title: eventTitle,
        message: event.message,
        rewardText,
        staminaBefore,
        staminaAfter,
        staminaCost
      };
      return response;
    }, { conflictLabel: 'Adventure action conflict', snapshotBuilder: buildUserSyncPersistenceSnapshot, selectFields: LIGHT_USER_SELECT_FIELDS });

    res.json(response);
  } catch (err) {
    console.error('Adventure action error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});
app.post('/api/action/adventure/resolve', async (req, res) => {
  const { userId, choice } = req.body;
  if (!userId || !choice) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });
  if (!['yes', 'no'].includes(choice)) return res.status(400).json({ msg: '올바르지 않은 선택입니다.' });

  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      cleanupExpiredBuffs(user, now);

      if (!user.pendingAdventure?.eventId) {
        clearPendingAdventure(user);
        const response = await buildLightUserResponseWithGlobals(user, now);
        response.adventureResult = {
          requiresChoice: false,
          alreadyResolved: true,
          title: '모험 선택지',
          message: '이미 처리된 모험 선택지입니다.',
          rewardText: ''
        };
        return response;
      }

      const eventTitle = `${user.pendingAdventure.location} / ${user.pendingAdventure.actor}`;
      let rewardText = '아무 일도 일어나지 않았습니다.';
      const hasCatButlerTitle = user.titles?.unlocked?.includes('cat_butler');

      if (choice === 'yes') {
        if (getCatTunaCanQuantity(user) > 0 && removeCatTunaCanFromInventory(user, 1)) {
          user.meta.catFoodGivenCount += 1;
          rewardText = `고양이에게 참치캔을 건넸습니다. 현재 총 ${user.meta.catFoodGivenCount}번 건네주었습니다.`;

          if (user.meta.catFoodGivenCount >= 10) {
            unlockTitle(user, 'cat_butler');
            setOrRefreshBuff(user, 'cat_gratitude_buff', CAT_GRATITUDE_DURATION_MS, { now });
            rewardText += ' 고양이의 보은 버프를 획득했습니다.';
          }

          if (hasCatButlerTitle || user.meta.catFoodGivenCount >= 10) {
            setOrRefreshBuff(user, 'cat_gratitude_buff', CAT_GRATITUDE_DURATION_MS, { now });
            addItemToInventory(user, 'bacchus', 1);

            const extraItemPool = ['hot6', 'cat_tuna_can', 'reward_pen_monami'];
            const extraItemId = extraItemPool[Math.floor(Math.random() * extraItemPool.length)];
            addItemToInventory(user, extraItemId, 1);

            rewardText += ` 고양이가 보답으로 박카스 1개와 ${ITEM_DATA[extraItemId].name} 1개를 챙겨주고 갔습니다.`;
          }
        } else {
          rewardText = '참치캔이 없어 고양이에게 아무것도 줄 수 없었습니다.';
          if (hasCatButlerTitle) {
            setOrRefreshBuff(user, 'cat_gratitude_buff', CAT_GRATITUDE_DURATION_MS, { now });
            rewardText += ' 그래도 고양이는 당신을 기억하고 있어 고양이의 보은 버프를 챙겨주었습니다.';
          }
        }
      } else {
        rewardText = '고양이를 한 번 쓰다듬고 지나쳤습니다. 아무것도 획득하지 못했습니다.';
        if (hasCatButlerTitle) {
          setOrRefreshBuff(user, 'cat_gratitude_buff', CAT_GRATITUDE_DURATION_MS, { now });
          rewardText += ' 그래도 고양이는 당신을 기억하고 있어 고양이의 보은 버프를 챙겨주었습니다.';
        }
      }

      setAdventureLog(user, `${eventTitle} - ${rewardText}`);
      clearPendingAdventure(user);
      reconcileTitles(user, now);
      reconcileEmblems(user);

      const response = await buildLightUserResponseWithGlobals(user, now);
      response.adventureResult = {
        requiresChoice: false,
        title: eventTitle,
        message: '고양이가 잠시 당신을 바라보다가 천천히 발걸음을 옮겼다.',
        rewardText
      };
      return response;
    }, { conflictLabel: 'Adventure resolve conflict', snapshotBuilder: buildUserSyncPersistenceSnapshot, selectFields: LIGHT_USER_SELECT_FIELDS });

    res.json(response);
  } catch (err) {
    console.error('Adventure resolve error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});
app.post('/api/action/lupin', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      cleanupExpiredBuffs(user, now);

      if (user.gameState.stamina < 6) {
        throw createHttpError(400, '행동력이 부족합니다. (필요: 6)');
      }

      if (hasBuff(user, 'lupin_stress_buff', now) || hasBuff(user, 'lupin_exp_buff', now)) {
        throw createHttpError(400, '이미 월급루팡 효과가 적용 중입니다.');
      }

      user.gameState.stamina -= 6;
      setOrRefreshBuff(user, 'lupin_stress_buff', LUPIN_STRESS_DURATION_MS);
      setOrRefreshBuff(user, 'lupin_exp_buff', LUPIN_EXP_DURATION_MS);
      user.gameState.lastActionTime = now;

      return buildLightUserResponseWithGlobals(user, now);
    }, { conflictLabel: 'Lupin action conflict' });
    res.json(response);
  } catch (err) {
    console.error('Lupin action error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/action/nap', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);

      if (user.gameState.stamina < 3) {
        throw createHttpError(400, '행동력이 부족합니다. (필요: 3)');
      }

      user.gameState.stamina -= 3;
      addUserStress(user, -30);
      user.gameState.lastActionTime = now;

      return buildLightUserResponseWithGlobals(user, now);
    }, { conflictLabel: 'Nap action conflict' });
    res.json(response);
  } catch (err) {
    console.error('Nap action error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/action/side-job', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const response = await withUserMutationLock(userId, async () => {
      const user = await User.findById(userId);
      if (!user) {
        throw createHttpError(404, '사용자를 찾을 수 없습니다.');
      }

      const now = new Date();
      calculateOfflineGains(user, now);

      if (Number(user.gameState.stress || 0) > 60) {
        throw createHttpError(400, '부업하기는 스트레스가 60 이하일 때만 할 수 있습니다.');
      }
      if (Number(user.gameState.stamina || 0) < 1) {
        throw createHttpError(400, '행동력이 부족합니다.');
      }

      const derivedStats = calculateDerivedStats(user, now);
      const salaryPerMinute = getSalaryPerMinute(user.gameState.level, derivedStats.moneyBonusPercent);
      const rawGainedMoney = salaryPerMinute * 300;
      if (!Number.isFinite(rawGainedMoney) || rawGainedMoney <= 0) {
        throw createHttpError(500, '부업 보상 계산에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }

      const gainedMoney = Math.floor(rawGainedMoney);
      const moneyBefore = Number(user.gameState.money || 0);
      const stressBefore = Number(user.gameState.stress || 0);
      const staminaBefore = Number(user.gameState.stamina || 0);

      user.gameState.stamina = Number(Math.max(0, Number(user.gameState.stamina || 0) - 1).toFixed(2));
      setUserStress(user, stressBefore + 40);
      user.gameState.money = moneyBefore + gainedMoney;
      user.gameState.lastActionTime = now;

      const persistedState = buildUserPersistenceSnapshot(user);
      const updateResult = await User.updateOne(
        { _id: user._id },
        {
          $set: persistedState,
          $inc: { __v: 1 }
        }
      );

      const matchedCount = updateResult.matchedCount ?? updateResult.n ?? 0;
      if (!matchedCount) {
        throw createHttpError(409, '요청 처리 중 저장 충돌이 발생했습니다. 잠시 후 다시 시도해주세요.');
      }

      const savedUser = await User.findById(user._id);
      if (!savedUser) {
        throw createHttpError(404, '사용자를 찾을 수 없습니다.');
      }
      ensureUserDefaults(savedUser);

      const mutationResponse = await buildLightUserResponseWithGlobals(savedUser, now);
      const moneyAfter = Number(savedUser.gameState.money || 0);
      const stressAfter = Number(savedUser.gameState.stress || 0);
      const staminaAfter = Number(savedUser.gameState.stamina || 0);
      mutationResponse.sideJobResult = {
        gainedMoney,
        moneyBefore,
        moneyAfter,
        stressBefore,
        stressAfter,
        stressGain: Number((stressAfter - stressBefore).toFixed(2)),
        staminaBefore,
        staminaAfter,
        staminaCost: Number((staminaBefore - staminaAfter).toFixed(2))
      };
      return mutationResponse;
    });

    res.json(response);
  } catch (err) {
    console.error('Side job action error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.get('/api/company-stock-market', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    ensureUserDefaults(user);
    const now = new Date();
    const stockMarket = await buildCompanyStockMarketResponse(user, now);
    res.json({ stockMarket });
  } catch (err) {
    console.error('Company stock market load error:', err);
    res.status(500).json({ msg: '회사 주식 시장을 불러오지 못했습니다.' });
  }
});

app.post('/api/company-stock-market/buy', async (req, res) => {
  const { userId, companyId, shares } = req.body;
  const buyShares = Math.max(0, Math.floor(Number(shares || 0)));
  if (!userId || !companyId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });
  if (buyShares <= 0) return res.status(400).json({ msg: '구매 수량을 입력해주세요.' });
  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      ensureUserDefaults(user);
      const market = await syncCompanyStockMarket(now);
      const stock = (market.companies || []).find((entry) => entry.companyId === String(companyId));
      if (!stock) throw createHttpError(404, '상장된 회사를 찾을 수 없습니다.');
      const cost = Math.floor(Number(stock.price || 0) * buyShares);
      if (cost <= 0) throw createHttpError(400, '구매 금액이 올바르지 않습니다.');
      if (Number(user.gameState.money || 0) < cost) throw createHttpError(400, '잔고가 부족합니다.');
      user.gameState.money -= cost;
      const portfolio = normalizeStockPortfolio(user.stockPortfolio);
      const holdingIndex = portfolio.findIndex((entry) => entry.companyId === String(companyId));
      const previousHolding = holdingIndex >= 0 ? portfolio[holdingIndex] : {
        companyId: String(companyId),
        companyName: stock.companyName,
        shares: 0,
        averagePrice: 0,
        investedAmount: 0,
        updatedAt: now
      };
      const previousShares = Number(previousHolding.shares || 0);
      const previousInvested = Number(previousHolding.investedAmount || (previousShares * Number(previousHolding.averagePrice || 0)));
      const nextShares = previousShares + buyShares;
      const nextInvested = previousInvested + cost;
      const nextHolding = {
        ...previousHolding,
        companyId: String(companyId),
        companyName: stock.companyName,
        shares: nextShares,
        investedAmount: nextInvested,
        averagePrice: nextShares > 0 ? nextInvested / nextShares : 0,
        updatedAt: now
      };
      if (holdingIndex >= 0) portfolio[holdingIndex] = nextHolding;
      else portfolio.push(nextHolding);
      user.stockPortfolio = portfolio;
      user.markModified('stockPortfolio');
      user.gameState.lastActionTime = now;
      const userResponse = await buildLightUserResponseWithGlobals(user, now);
      userResponse.stockMarket = await buildCompanyStockMarketResponse(user, now);
      return userResponse;
    }, { conflictLabel: 'Company stock buy conflict' });
    res.json(response);
  } catch (err) {
    console.error('Company stock buy error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '주식을 구매하지 못했습니다.' });
  }
});

app.post('/api/company-stock-market/sell', async (req, res) => {
  const { userId, companyId, shares } = req.body;
  const sellShares = Math.max(0, Math.floor(Number(shares || 0)));
  if (!userId || !companyId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });
  if (sellShares <= 0) return res.status(400).json({ msg: '판매 수량을 입력해주세요.' });
  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      ensureUserDefaults(user);
      const market = await syncCompanyStockMarket(now);
      const stock = (market.companies || []).find((entry) => entry.companyId === String(companyId));
      const portfolio = normalizeStockPortfolio(user.stockPortfolio);
      const holdingIndex = portfolio.findIndex((entry) => entry.companyId === String(companyId));
      const holding = holdingIndex >= 0 ? portfolio[holdingIndex] : null;
      if (!stock || !holding || Number(holding.shares || 0) < sellShares) throw createHttpError(400, '판매할 주식이 부족합니다.');
      const gross = Math.floor(Number(stock.price || 0) * sellShares);
      const derivedStats = calculateDerivedStats(user, now);
      const feeRate = getEffectiveCompanyStockSellFeeRate(user, now, derivedStats);
      const fee = Math.floor(gross * feeRate);
      const net = Math.max(0, gross - fee);
      user.gameState.money += net;
      const averagePrice = Number(holding.averagePrice || 0);
      const previousShares = Number(holding.shares || 0);
      const previousInvested = Number(holding.investedAmount || (previousShares * averagePrice));
      const nextShares = previousShares - sellShares;
      const nextInvested = Math.max(0, previousInvested - (averagePrice * sellShares));
      if (nextShares <= 0) {
        portfolio.splice(holdingIndex, 1);
      } else {
        portfolio[holdingIndex] = {
          ...holding,
          shares: nextShares,
          investedAmount: nextInvested,
          averagePrice: nextInvested / nextShares,
          updatedAt: now
        };
      }
      user.stockPortfolio = portfolio;
      user.markModified('stockPortfolio');
      user.gameState.lastActionTime = now;
      const userResponse = await buildLightUserResponseWithGlobals(user, now);
      userResponse.stockMarket = await buildCompanyStockMarketResponse(user, now);
      userResponse.stockTrade = { gross, fee, net, feeRate };
      return userResponse;
    }, { conflictLabel: 'Company stock sell conflict' });
    res.json(response);
  } catch (err) {
    console.error('Company stock sell error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '주식을 판매하지 못했습니다.' });
  }
});

app.post('/api/company-stock-market/rumor', async (req, res) => {
  const { companyId } = req.body || {};
  if (!companyId) return res.status(400).json({ msg: '회사 정보가 필요합니다.' });
  try {
    const now = new Date();
    const market = await syncCompanyStockMarket(now);
    const company = (market.companies || []).find((entry) => entry.companyId === String(companyId));
    if (!company) return res.status(404).json({ msg: '상장된 회사를 찾을 수 없습니다.' });
    const currentRumor = normalizeCompanyStockRumorEntry(company.rumor, now);
    if (!currentRumor) {
      company.rumor = {
        text: buildCompanyStockRumor(company),
        createdAt: now,
        expiresAt: new Date(now.getTime() + COMPANY_STOCK_RUMOR_TTL_MS)
      };
      await GameSetting.updateOne(
        { key: COMPANY_STOCK_MARKET_SETTING_KEY },
        { $set: { value: market, updatedAt: now } },
        { upsert: true }
      );
      companyStockMarketCache = market;
      companyStockMarketCacheExpiresAt = Date.now() + COMPANY_STOCK_MARKET_CACHE_TTL_MS;
    } else {
      company.rumor = currentRumor;
    }
    res.json({
      rumor: company.rumor.text,
      createdAt: company.rumor.createdAt,
      expiresAt: company.rumor.expiresAt,
      cached: Boolean(currentRumor)
    });
  } catch (err) {
    console.error('Company stock rumor error:', err);
    res.status(500).json({ msg: '찌라시를 불러오지 못했습니다.' });
  }
});

app.get('/api/interview-tournament', async (req, res) => {
  const { userId } = req.query || {};
  try {
    const now = new Date();
    const state = await getInterviewTournamentState(now);
    res.json({ interviewTournament: buildInterviewTournamentResponse(state, userId, now) });
  } catch (err) {
    console.error('Interview tournament load error:', err);
    res.status(500).json({ msg: '면담 토너먼트 정보를 불러오지 못했습니다.' });
  }
});

app.post('/api/interview-tournament/register', async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });
  try {
    const now = new Date();
    const user = await User.findById(userId).select('_id username nickname');
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    const state = await getInterviewTournamentState(now);
    if (getInterviewTournamentPhase(state, now) !== 'registering') {
      return res.status(400).json({ msg: '현재 토너먼트 참가 신청 기간이 아닙니다.' });
    }
    const normalizedUserId = String(user._id);
    if (!state.participants.some((entry) => entry.userId === normalizedUserId)) {
      state.participants.push({
        userId: normalizedUserId,
        displayName: getCompactNickname(user, 18),
        registeredAt: now
      });
      await saveInterviewTournamentState(state, now);
    }
    res.json({ interviewTournament: buildInterviewTournamentResponse(state, normalizedUserId, now) });
  } catch (err) {
    console.error('Interview tournament register error:', err);
    res.status(500).json({ msg: '면담 토너먼트 참가 신청에 실패했습니다.' });
  }
});

app.post('/api/interview-tournament/join-match', async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });
  try {
    const now = new Date();
    await advancePvpState(now);
    const user = await User.findById(userId).select('_id username nickname gameState.level');
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    ensureUserDefaults(user);
    const state = await getInterviewTournamentState(now);
    const normalizedUserId = String(user._id);
    const match = state.matches.find((entry) => entry.status === 'waiting'
      && [entry.playerA?.userId, entry.playerB?.userId].includes(normalizedUserId));
    if (!match) {
      return res.status(400).json({ msg: '참여 가능한 현재 대진이 없습니다.' });
    }
    match.readyUserIds = Array.isArray(match.readyUserIds) ? match.readyUserIds.map(String) : [];
    if (!match.readyUserIds.includes(normalizedUserId)) match.readyUserIds.push(normalizedUserId);

    if (match.playerA?.userId && match.playerB?.userId
      && match.readyUserIds.includes(match.playerA.userId)
      && match.readyUserIds.includes(match.playerB.userId)) {
      const tournamentModeState = getPvpModeState(PVP_MODE_RANKED);
      if (tournamentModeState.match || tournamentModeState.battle) {
        await saveInterviewTournamentState(state, now);
        return res.status(400).json({ msg: '현재 랭크 면담이 진행 중이라 잠시 후 다시 대진 참여를 눌러주세요.' });
      }
      if (isUserInAnyPvpSession(match.playerA.userId) || isUserInAnyPvpSession(match.playerB.userId)) {
        await saveInterviewTournamentState(state, now);
        return res.status(400).json({ msg: '대진 참가자 중 이미 다른 면담에 참여 중인 유저가 있습니다.' });
      }
      match.status = 'in_progress';
      match.startedAt = now;
      normalizeInterviewTournamentMatchSeries(state, match);
      const firstPlayerUserId = getInterviewTournamentNextFirstPlayerUserId(match);
      const gameNumber = Math.max(1, Number(match.gamesPlayed || 0) + 1);
      startPvpTournamentMatch(
        tournamentModeState,
        { userId: match.playerA.userId, displayName: match.playerA.displayName },
        { userId: match.playerB.userId, displayName: match.playerB.displayName },
        match.matchId,
        now,
        {
          firstPlayerUserId,
          bestOf: Number(match.bestOf || 1),
          gameNumber,
          scoreA: Number(match.scoreA || 0),
          scoreB: Number(match.scoreB || 0)
        }
      );
    }
    await saveInterviewTournamentState(state, now);
    res.json({
      interviewTournament: buildInterviewTournamentResponse(state, normalizedUserId, now),
      pvp: await buildPvpStateResponse(user, now, PVP_MODE_RANKED)
    });
  } catch (err) {
    console.error('Interview tournament join error:', err);
    res.status(500).json({ msg: '면담 토너먼트 대진 참여에 실패했습니다.' });
  }
});

app.post('/api/interview-tournament/spectate-match', async (req, res) => {
  const { userId, matchId } = req.body || {};
  if (!userId || !matchId) return res.status(400).json({ msg: '사용자 ID와 대진 정보가 필요합니다.' });
  try {
    const now = new Date();
    await advancePvpState(now);
    const user = await getCachedPollUserSnapshot(
      userId,
      'nickname username gameState.level cards enhancedCards equippedCardId equippedCardLevel meta.potatoRehabDamage meta.potatoRehabKillCount'
    );
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    ensureUserDefaults(user);

    const state = await getInterviewTournamentState(now);
    const match = state.matches.find((entry) => String(entry.matchId) === String(matchId));
    if (!match || match.status !== 'in_progress') {
      return res.status(400).json({ msg: '현재 관전 가능한 진행 중 대진이 아닙니다.' });
    }

    const tournamentModeState = getPvpModeState(PVP_MODE_RANKED);
    const activePvp = tournamentModeState.battle || tournamentModeState.match;
    if (!activePvp || String(activePvp.tournamentMatchId || '') !== String(matchId)) {
      return res.status(400).json({ msg: '해당 토너먼트 대진의 면담이 아직 열려 있지 않습니다.' });
    }

    const isParticipant = activePvp.players?.some((player) => player.userId === String(userId));
    if (!isParticipant) registerViewer(tournamentModeState.viewers, user, now);

    res.json({
      interviewTournament: buildInterviewTournamentResponse(state, String(user._id), now),
      pvp: await buildPvpStateResponse(user, now, PVP_MODE_RANKED, { poll: true })
    });
  } catch (err) {
    console.error('Interview tournament spectate error:', err);
    res.status(500).json({ msg: '면담 토너먼트 관전에 실패했습니다.' });
  }
});


app.get('/api/stock-tournament', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    const now = new Date();
    const stockTournament = await buildStockTournamentResponse(user, now);
    res.json({ stockTournament });
  } catch (err) {
    console.error('Stock tournament load error:', err);
    res.status(500).json({ msg: '주식투자 대회 정보를 불러오지 못했습니다.' });
  }
});

app.post('/api/stock-tournament/register', async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });
  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      ensureUserDefaults(user);
      const phase = getStockTournamentPhase(now);
      if (phase !== 'before') throw createHttpError(400, '참가 신청 기간이 아닙니다.');
      const tournament = ensureStockTournamentState(user);
      if (!isStockTournamentRegistered(user)) {
        tournament.eventId = STOCK_TOURNAMENT_ID;
        tournament.registeredAt = now;
        tournament.cash = STOCK_TOURNAMENT_INITIAL_CASH;
        tournament.holdings = [];
        tournament.advancedInfoUsed = 0;
        tournament.advancedInfos = [];
        tournament.finalizedAt = null;
        tournament.finalAssets = 0;
        tournament.finalReturnPct = 0;
        user.markModified('stockTournament');
      }
      const userResponse = await buildFastUserResponseWithGlobals(user, now);
      userResponse.stockTournament = await buildStockTournamentResponse(user, now);
      return userResponse;
    }, { conflictLabel: 'Stock tournament register conflict' });
    res.json(response);
  } catch (err) {
    console.error('Stock tournament register error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '주식투자 대회 참가 신청에 실패했습니다.' });
  }
});

app.post('/api/stock-tournament/buy', async (req, res) => {
  const { userId, companyId, shares } = req.body || {};
  const buyShares = Math.max(0, Math.floor(Number(shares || 0)));
  if (!userId || !companyId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });
  if (buyShares <= 0) return res.status(400).json({ msg: '매수 수량을 입력해주세요.' });
  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      ensureUserDefaults(user);
      if (!isStockTournamentRegistered(user)) throw createHttpError(400, '대회 참가자가 아닙니다.');
      if (getStockTournamentPhase(now) !== 'active') throw createHttpError(400, '현재 대회 거래 시간이 아닙니다.');
      const market = await syncCompanyStockMarket(now);
      const stock = (market.companies || []).find((entry) => entry.companyId === String(companyId));
      if (!stock) throw createHttpError(404, '상장 회사를 찾을 수 없습니다.');
      const tournament = ensureStockTournamentState(user);
      const cost = Math.floor(Number(stock.price || 0) * buyShares);
      if (cost <= 0) throw createHttpError(400, '매수 금액이 올바르지 않습니다.');
      if (Number(tournament.cash || 0) < cost) throw createHttpError(400, '대회 가상 현금이 부족합니다.');
      tournament.cash -= cost;
      const holdings = normalizeStockTournamentHoldingList(tournament.holdings);
      const holdingIndex = holdings.findIndex((entry) => entry.companyId === String(companyId));
      const previousHolding = holdingIndex >= 0 ? holdings[holdingIndex] : {
        companyId: String(companyId),
        companyName: stock.companyName,
        shares: 0,
        averagePrice: 0,
        investedAmount: 0,
        updatedAt: now
      };
      const previousShares = Number(previousHolding.shares || 0);
      const previousInvested = Number(previousHolding.investedAmount || (previousShares * Number(previousHolding.averagePrice || 0)));
      const nextShares = previousShares + buyShares;
      const nextInvested = previousInvested + cost;
      const nextHolding = {
        ...previousHolding,
        companyId: String(companyId),
        companyName: stock.companyName,
        shares: nextShares,
        investedAmount: nextInvested,
        averagePrice: nextShares > 0 ? nextInvested / nextShares : 0,
        updatedAt: now
      };
      if (holdingIndex >= 0) holdings[holdingIndex] = nextHolding;
      else holdings.push(nextHolding);
      tournament.holdings = holdings;
      user.stockTournament = tournament;
      user.markModified('stockTournament');
      const userResponse = await buildFastUserResponseWithGlobals(user, now);
      userResponse.stockTournament = await buildStockTournamentResponse(user, now);
      return userResponse;
    }, { conflictLabel: 'Stock tournament buy conflict' });
    res.json(response);
  } catch (err) {
    console.error('Stock tournament buy error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '대회 주식을 매수하지 못했습니다.' });
  }
});

app.post('/api/stock-tournament/sell', async (req, res) => {
  const { userId, companyId, shares } = req.body || {};
  const sellShares = Math.max(0, Math.floor(Number(shares || 0)));
  if (!userId || !companyId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });
  if (sellShares <= 0) return res.status(400).json({ msg: '매도 수량을 입력해주세요.' });
  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      ensureUserDefaults(user);
      if (!isStockTournamentRegistered(user)) throw createHttpError(400, '대회 참가자가 아닙니다.');
      if (getStockTournamentPhase(now) !== 'active') throw createHttpError(400, '현재 대회 거래 시간이 아닙니다.');
      const market = await syncCompanyStockMarket(now);
      const stock = (market.companies || []).find((entry) => entry.companyId === String(companyId));
      const tournament = ensureStockTournamentState(user);
      const holdings = normalizeStockTournamentHoldingList(tournament.holdings);
      const holdingIndex = holdings.findIndex((entry) => entry.companyId === String(companyId));
      const holding = holdingIndex >= 0 ? holdings[holdingIndex] : null;
      if (!stock || !holding || Number(holding.shares || 0) < sellShares) throw createHttpError(400, '매도할 대회 주식이 부족합니다.');
      const gross = Math.floor(Number(stock.price || 0) * sellShares);
      const fee = Math.floor(gross * COMPANY_STOCK_SELL_FEE_RATE);
      const net = Math.max(0, gross - fee);
      tournament.cash += net;
      const averagePrice = Number(holding.averagePrice || 0);
      const previousShares = Number(holding.shares || 0);
      const previousInvested = Number(holding.investedAmount || (previousShares * averagePrice));
      const nextShares = previousShares - sellShares;
      const nextInvested = Math.max(0, previousInvested - (averagePrice * sellShares));
      if (nextShares <= 0) {
        holdings.splice(holdingIndex, 1);
      } else {
        holdings[holdingIndex] = {
          ...holding,
          shares: nextShares,
          investedAmount: nextInvested,
          averagePrice: nextInvested / nextShares,
          updatedAt: now
        };
      }
      tournament.holdings = holdings;
      user.stockTournament = tournament;
      user.markModified('stockTournament');
      const userResponse = await buildFastUserResponseWithGlobals(user, now);
      userResponse.stockTournament = await buildStockTournamentResponse(user, now);
      userResponse.stockTournamentTrade = { gross, fee, net };
      return userResponse;
    }, { conflictLabel: 'Stock tournament sell conflict' });
    res.json(response);
  } catch (err) {
    console.error('Stock tournament sell error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '대회 주식을 매도하지 못했습니다.' });
  }
});

app.post('/api/stock-tournament/advanced-info', async (req, res) => {
  const { userId, companyId } = req.body || {};
  if (!userId || !companyId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });
  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      ensureUserDefaults(user);
      if (!isStockTournamentRegistered(user)) throw createHttpError(400, '대회 참가자가 아닙니다.');
      if (getStockTournamentPhase(now) !== 'active') throw createHttpError(400, '대회 진행 중에만 고급 정보를 사용할 수 있습니다.');
      const tournament = ensureStockTournamentState(user);
      if (Number(tournament.advancedInfoUsed || 0) >= STOCK_TOURNAMENT_ADVANCED_INFO_LIMIT) {
        throw createHttpError(400, '고급 정보 찬스를 모두 사용했습니다.');
      }
      const market = await syncCompanyStockMarket(now);
      const stock = (market.companies || []).find((entry) => entry.companyId === String(companyId));
      if (!stock) throw createHttpError(404, '상장 회사를 찾을 수 없습니다.');
      const info = {
        companyId: String(companyId),
        companyName: stock.companyName,
        text: buildStockTournamentAdvancedHint(stock),
        createdAt: now,
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
      };
      tournament.advancedInfoUsed = Math.max(0, Math.floor(Number(tournament.advancedInfoUsed || 0))) + 1;
      tournament.advancedInfos = [...(Array.isArray(tournament.advancedInfos) ? tournament.advancedInfos : []), info].slice(-STOCK_TOURNAMENT_ADVANCED_INFO_LIMIT);
      user.stockTournament = tournament;
      user.markModified('stockTournament');
      const userResponse = await buildFastUserResponseWithGlobals(user, now);
      userResponse.stockTournament = await buildStockTournamentResponse(user, now);
      userResponse.advancedInfo = info;
      return userResponse;
    }, { conflictLabel: 'Stock tournament advanced info conflict' });
    res.json(response);
  } catch (err) {
    console.error('Stock tournament advanced info error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '고급 정보를 확인하지 못했습니다.' });
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

    const actualInvestAmount = investAmount >= Math.max(0, Math.floor(user.gameState.money) - 1000)
      ? user.gameState.money
      : investAmount;
    const moneyBeforeInvestment = user.gameState.money;
    user.gameState.money -= actualInvestAmount;
    user.pendingStockInvestment = {
      amount: actualInvestAmount,
      investedOn: getKSTDateKey(now)
    };
    user.gameState.lastActionTime = now;

    if (moneyBeforeInvestment >= BEAST_HEART_UNLOCK_THRESHOLD && actualInvestAmount >= moneyBeforeInvestment * 0.9) {
      unlockTitle(user, 'beast_heart');
    }

    reconcileTitles(user, now);
    const response = await buildFastUserResponseWithGlobals(user, now);
    await persistUserSnapshot(user);
    res.json(response);
  } catch (err) {
    console.error('Stock action error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/shop/buy', async (req, res) => {
  const { userId, itemId, quantity } = req.body;
  if (!userId || !itemId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });
  const buyQuantity = Math.max(1, Math.floor(Number(quantity) || 1));

  const itemInfo = ITEM_DATA[itemId];
  if (!itemInfo) return res.status(400).json({ msg: '존재하지 않는 아이템입니다.' });
  if (itemInfo.type === 'special' && itemId !== 'business_card') {
    return res.status(400).json({ msg: '해당 아이템은 상점에서 구매할 수 없습니다.' });
  }

  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      ensureUserDefaults(user);
      syncDailyShopState(user, now);

      const remainingDailyPurchases = getRemainingDailyShopPurchases(user, itemId);
      if (Number.isFinite(remainingDailyPurchases) && buyQuantity > remainingDailyPurchases) {
        if (itemId === 'business_card') {
          throw createHttpError(400, '명함은 하루에 최대 5개까지만 구매할 수 있습니다.');
        }
        if (itemId === 'bacchus') {
          throw createHttpError(400, '박카스는 하루에 최대 20개까지만 구매할 수 있습니다.');
        }
        if (itemId === 'hot6') {
          throw createHttpError(400, '핫식스는 하루에 최대 5개까지만 구매할 수 있습니다.');
        }
      }

      if (itemId === 'coffee_mix') {
        const derivedStats = calculateDerivedStats(user, now);
        if (Number(derivedStats.stressReductionPercent || 0) >= 100) {
          throw createHttpError(400, '스트레스 감소율이 이미 100%에 도달하여 더 이상 맥심 커피믹스를 구매할 수 없습니다.');
        }
      }

      const shopDiscountPercent = getDailyAugmentShopDiscountPercent(user, now);
      const totalPrice = getTotalBuyPrice(user, itemId, buyQuantity, now);

      if (user.gameState.money < totalPrice) {
        throw createHttpError(400, '잔고가 부족합니다.');
      }

      user.gameState.money -= totalPrice;
      addItemToInventory(user, itemId, buyQuantity, { allowDailyAugmentCopy: false, now });
      if (shopDiscountPercent > 0) {
        markDailyAugmentShopDiscountUsed(user, now);
      }
      if (itemId === 'business_card') {
        user.shopState.dailyBusinessCardPurchases += buyQuantity;
      } else if (itemId === 'bacchus') {
        user.shopState.dailyBacchusPurchases += buyQuantity;
      } else if (itemId === 'hot6') {
        user.shopState.dailyHot6Purchases += buyQuantity;
      }
      recordShopSpend(user, totalPrice, now);

      const derivedStats = calculateDerivedStats(user, now);
      if (derivedStats.shopStressRelief > 0) {
        addUserStress(user, -derivedStats.shopStressRelief);
      }

      reconcileTitles(user, now, derivedStats);
      reconcileEmblems(user);
      user.gameState.lastActionTime = now;

      const purchaseResponse = await buildRealtimeUserResponseWithGlobals(user, now, { includePendingCounts: false });
      purchaseResponse.shopPurchase = {
        itemId,
        itemName: itemInfo.name,
        quantity: buyQuantity,
        totalPrice,
        ownedQuantity: getInventoryQuantity(user, itemId)
      };
      return purchaseResponse;
    }, {
      conflictLabel: 'Shop buy conflict',
      snapshotBuilder: buildUserSyncPersistenceSnapshot,
      selectFields: LIGHT_USER_SELECT_FIELDS
    });

    res.json(response);
  } catch (err) {
    console.error('Shop buy error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/fragment-shop/buy', async (req, res) => {
  const { userId, shopItemId } = req.body;
  if (!userId || !shopItemId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });

  const shopItem = FRAGMENT_SHOP_ITEMS[shopItemId];
  if (!shopItem) return res.status(400).json({ msg: '존재하지 않는 파편 상점 항목입니다.' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    calculateOfflineGains(user, now);
    ensureUserDefaults(user);
    syncDailyShopState(user, now);
    syncWeeklyFragmentShopState(user, now);

    const isWeeklyLimited = Number(shopItem.weeklyLimit || 0) > 0;
    const purchaseLimit = Math.max(0, Number(isWeeklyLimited ? shopItem.weeklyLimit : shopItem.dailyLimit || 0));
    const purchasedCount = Math.max(0, Number(user.shopState?.[shopItem.countField] || 0));
    if (purchasedCount >= purchaseLimit) {
      const limitLabel = isWeeklyLimited ? '이번 주' : '오늘';
      return res.status(400).json({ msg: `${limitLabel}는 해당 항목을 더 이상 구매할 수 없습니다.` });
    }
    if (shopItem.emblemId) {
      if (user.emblems.unlocked.includes(shopItem.emblemId)) {
        return res.status(400).json({ msg: '이미 보유 중인 휘장입니다.' });
      }
    }
    const fragmentShopDiscountPercent = getDailyAugmentShopDiscountPercent(user, now);
    const fragmentShopCost = applyDailyAugmentShopDiscount(user, shopItem.cost, now);
    if (getInventoryQuantity(user, 'equipment_fragment') < fragmentShopCost) {
      return res.status(400).json({ msg: '장비 파편이 부족합니다.' });
    }
    if (!removeItemFromInventory(user, 'equipment_fragment', fragmentShopCost)) {
      return res.status(400).json({ msg: '장비 파편이 부족합니다.' });
    }
    if (fragmentShopDiscountPercent > 0) {
      markDailyAugmentShopDiscountUsed(user, now);
    }

    if (shopItem.emblemId) {
      unlockEmblem(user, shopItem.emblemId, { notify: false });
    } else {
      addItemToInventory(user, shopItem.itemId, shopItem.quantity, { allowDailyAugmentCopy: false, now });
    }
    user.shopState[shopItem.countField] = purchasedCount + 1;
    user.gameState.lastActionTime = now;

    const response = await buildFastUserResponseWithGlobals(user, now);
    response.fragmentShop = buildFragmentShopState(user, now);
    response.fragmentShopPurchase = {
      shopItemId: shopItem.id,
      itemId: shopItem.itemId,
      emblemId: shopItem.emblemId || null,
      itemName: shopItem.emblemId ? EMBLEM_DATA[shopItem.emblemId]?.name : (ITEM_DATA[shopItem.itemId]?.name || shopItem.name),
      quantity: shopItem.quantity,
      cost: fragmentShopCost,
      originalCost: shopItem.cost
    };
    await persistUserSnapshot(user);
    res.json(response);
  } catch (err) {
    console.error('Fragment shop buy error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/emblem-shop/buy', async (req, res) => {
  const { userId, emblemId } = req.body;
  if (!userId || !emblemId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });

  const emblem = EMBLEM_DATA[emblemId];
  if (!emblem) return res.status(400).json({ msg: '존재하지 않는 휘장입니다.' });
  if (emblem.shopType === 'fragment') return res.status(400).json({ msg: '해당 휘장은 파편 상점에서 구매할 수 있습니다.' });

  try {
    await withUserMutationLock(userId, async () => {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

      const now = new Date();
      calculateOfflineGains(user, now);
      ensureUserDefaults(user);

      if (user.emblems.unlocked.includes(emblemId)) {
        return res.status(400).json({ msg: '이미 보유 중인 휘장입니다.' });
      }
      const emblemShopDiscountPercent = getDailyAugmentShopDiscountPercent(user, now);
      const emblemPrice = applyDailyAugmentShopDiscount(user, emblem.price, now);
      if (Number(user.gameState.money || 0) < emblemPrice) {
        return res.status(400).json({ msg: '잔고가 부족합니다.' });
      }

      user.gameState.money -= emblemPrice;
      if (emblemShopDiscountPercent > 0) {
        markDailyAugmentShopDiscountUsed(user, now);
      }
      user.emblems.unlocked.push(emblemId);
      if (!user.emblems.equipped) user.emblems.equipped = emblemId;
      user.gameState.lastActionTime = now;

      const response = await buildFastUserResponseWithGlobals(user, now);
      response.emblemShopPurchase = {
        emblemId,
        emblemName: emblem.name,
        price: emblemPrice,
        originalPrice: emblem.price
      };
      await persistUserSnapshot(user);
      res.json(response);
    });
  } catch (err) {
    console.error('Emblem shop buy error:', err);
    if (!res.headersSent) res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/emblem/toggle', async (req, res) => {
  const { userId, emblemId } = req.body;
  if (!userId || !emblemId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });
  if (!EMBLEM_DATA[emblemId]) return res.status(400).json({ msg: '존재하지 않는 휘장입니다.' });

  try {
    await withUserMutationLock(userId, async () => {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

      const now = new Date();
      calculateOfflineGains(user, now);
      ensureUserDefaults(user);

      if (!user.emblems.unlocked.includes(emblemId)) {
        return res.status(400).json({ msg: '보유하지 않은 휘장입니다.' });
      }

      user.emblems.equipped = user.emblems.equipped === emblemId ? null : emblemId;
      user.gameState.lastActionTime = now;

      const response = await buildFastUserResponseWithGlobals(user, now);
      await persistUserSnapshot(user);
      res.json(response);
    });
  } catch (err) {
    console.error('Emblem toggle error:', err);
    if (!res.headersSent) res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/inventory/use', async (req, res) => {
  const { userId, itemId, quantity } = req.body;
  if (!userId || !itemId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });
  let requestedQuantity = Math.max(1, Math.floor(Number(quantity) || 1));

  const itemInfo = ITEM_DATA[itemId];
  if (!itemInfo || itemInfo.type !== 'consumable') {
    return res.status(400).json({ msg: '사용할 수 없는 아이템입니다.' });
  }

  try {
    const quickInventoryUser = await User.findById(userId).select('inventory branchOffice').lean();
    if (!quickInventoryUser) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    if (getInventoryQuantityFromItems(quickInventoryUser.inventory, itemId) <= 0) {
      return res.status(400).json({ msg: '해당 아이템이 부족합니다.' });
    }
    if (itemId === 'bacchus_oneshot_ticket' && getInventoryQuantityFromItems(quickInventoryUser.inventory, 'bacchus') < 100) {
      return res.status(400).json({ msg: '박카스 원샷 티켓을 사용하려면 박카스 100개가 필요합니다.' });
    }
    if (itemId === 'excavation_repair_coupon') {
      const brokenUntil = quickInventoryUser.branchOffice?.excavationBrokenUntil
        ? new Date(quickInventoryUser.branchOffice.excavationBrokenUntil)
        : null;
      if (!quickInventoryUser.branchOffice?.isFounded || !brokenUntil || !Number.isFinite(brokenUntil.getTime()) || brokenUntil <= new Date()) {
        return res.status(400).json({ msg: '현재 수리할 발굴 기계 고장이 없습니다.' });
      }
    }

    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      ensureUserDefaults(user);
      cleanupExpiredBuffs(user, now);
      reconcileTitles(user, now);
      reconcileSkills(user, now);

      let useQuantity = Math.min(requestedQuantity, getInventoryQuantity(user, itemId));
      if (useQuantity <= 0) {
        throw createHttpError(400, '해당 아이템이 부족합니다.');
      }

      if (itemId === 'bacchus') {
        const currentStamina = normalizeUserStamina(user, now);
        const maxRecoverableStamina = Math.max(0, Math.floor(getEffectiveMaxStamina(user, now) - currentStamina));
        if (maxRecoverableStamina <= 0) {
          throw createHttpError(400, '행동력이 이미 최대치라 박카스를 사용할 수 없습니다.');
        }
        useQuantity = Math.min(useQuantity, maxRecoverableStamina);
      } else if (itemId === 'infinite_overtime_ticket') {
        if (user.infiniteOvertime?.active) {
          throw createHttpError(400, '진행 중인 무한야근 도전이 있어 입장권을 사용할 수 없습니다.');
        }
        if (getInfiniteOvertimeCooldownRemainingMs(user, now) <= 0) {
          throw createHttpError(400, '이미 무한야근에 도전할 수 있어 입장권을 사용할 필요가 없습니다.');
        }
        useQuantity = 1;
      }

      if (itemId === 'excavation_repair_coupon') {
        if (!user.branchOffice?.isFounded) {
          throw createHttpError(400, '회사를 설립해야 사용할 수 있습니다.');
        }
        const brokenUntil = getBranchMachineBrokenUntil(user, now);
        if (!brokenUntil || brokenUntil <= now) {
          throw createHttpError(400, '현재 수리할 발굴 기계 고장이 없습니다.');
        }
        useQuantity = 1;
      }

      if (itemId === 'card_batch_fusion_ticket') {
        const hasMaterials = ['C', 'B', 'A'].some((grade) => getAutoFusionMaterialCount(user, grade) >= 5);
        if (!hasMaterials) throw createHttpError(400, '자동 합성에 사용할 잠금 해제 카드가 부족합니다. +5강과 잠긴 카드는 제외됩니다.');
        useQuantity = 1;
      }

      if (itemId === 'bacchus_oneshot_ticket') {
        if (getInventoryQuantity(user, 'bacchus') < 100) throw createHttpError(400, '박카스 원샷 티켓을 사용하려면 박카스 100개가 필요합니다.');
        useQuantity = 1;
      }

      if (itemId === 'chairman_mood_ticket') {
        useQuantity = 1;
      }

      if (itemId === 'shout_free_ticket') {
        if (hasShoutNoCooldownTicket(user, now)) {
          throw createHttpError(400, '이미 오늘 24시까지 외치기 자유이용권 효과가 적용 중입니다.');
        }
        useQuantity = 1;
      }

      if (!removeItemFromInventory(user, itemId, useQuantity)) {
        throw createHttpError(400, '해당 아이템이 부족합니다.');
      }

      if (itemId === 'bacchus') {
        user.gameState.stamina = Number(Math.min(getEffectiveMaxStamina(user, now), normalizeUserStamina(user, now) + useQuantity).toFixed(2));
        queueNotification(user, 'item_use', `박카스를 ${useQuantity}병 마셨습니다. 행동력이 ${useQuantity} 회복되었습니다.`);
      } else if (itemId === 'hot6') {
        addUserStress(user, -(10 * useQuantity));
        setOrRefreshBuff(user, 'hot6_buff', HOT6_DURATION_MS * useQuantity, { now, stackDuration: true });
        queueNotification(user, 'item_use', `핫식스를 ${useQuantity}병 사용했습니다. 스트레스가 ${10 * useQuantity} 감소하고 버프 시간이 누적되었습니다.`);
      } else if (itemId === 'tylenol') {
        removeAllDebuffs(user);
        queueNotification(user, 'item_use', `타이레놀 ${useQuantity}개를 사용했습니다. 현재 걸린 모든 디버프를 제거했습니다.`);
      } else if (itemId === 'raid_entry_ticket') {
        syncRaidEntryState(user, now);
        user.meta.raidEntryBonusCount += useQuantity;
        queueNotification(user, 'item_use', `회의 추가 입장권 ${useQuantity}장을 사용했습니다. 오늘 보스 레이드 입장 가능 횟수가 ${useQuantity}회 증가했습니다.`);
      } else if (itemId === 'infinite_overtime_ticket') {
        user.infiniteOvertime.lastAttemptAt = null;
        user.infiniteOvertime.lastCompletedAt = null;
        user.infiniteOvertime.active = false;
        user.markModified('infiniteOvertime');
        clearInfiniteOvertimeAttackDraft(String(userId));
        queueNotification(user, 'item_use', '무한야근 입장권 1장을 사용했습니다. 무한야근 도전 대기시간이 초기화되었습니다.');
      } else if (itemId === 'hagendaz') {
        user.gameState.level += useQuantity;
        user.gameState.exp = 0;
        user.gameState.passiveExpCarry = 0;
        queueNotification(user, 'item_use', `하겐다즈 ${useQuantity}개를 사용해 즉시 ${useQuantity}레벨 상승했습니다.`);
      } else if (itemId === 'exp_5_percent_potion') {
        let totalExpGain = 0;
        for (let index = 0; index < useQuantity; index += 1) {
          const expGain = Math.max(1, Math.floor(getRequiredExp(user.gameState.level) * 0.05));
          user.gameState.exp += expGain;
          totalExpGain += expGain;
          checkLevelUp(user);
        }
        queueNotification(user, 'item_use', `경험치 5% 포션 ${useQuantity}개를 사용해 경험치 ${totalExpGain.toLocaleString()}을 획득했습니다.`);
      }

      if (itemId === 'shout_free_ticket') {
        const expiresAt = getKSTNextMidnight(now);
        const durationMs = Math.max(1000, expiresAt.getTime() - now.getTime());
        user.meta.shoutNoCooldownUntil = expiresAt;
        setOrRefreshBuff(user, 'shout_free_ticket_buff', durationMs, { now });
        queueNotification(user, 'item_use', '외치기 자유이용권을 사용했습니다. 오늘 24시까지 외치기 쿨타임 없이 무제한으로 사용할 수 있습니다.');
      }

      if (itemId === 'chairman_mood_ticket') {
        if (Array.isArray(user.buffs)) {
          user.buffs = user.buffs.filter((buff) => buff.buffId !== 'chairman_mood_buff');
          user.markModified('buffs');
        }
        setOrRefreshBuff(user, 'chairman_mood_self_buff', CHAIRMAN_MOOD_DURATION_MS, { now });

        const onlineSince = new Date(now.getTime() - ONLINE_THRESHOLD_MS);
        const onlineTargets = await User.find({
          _id: { $ne: user._id },
          'meta.lastSeenAt': { $gte: onlineSince }
        }).select('_id nickname username');

        let deliveredCount = 1;
        for (const target of onlineTargets) {
          try {
            await runUserMutationWithRetry(target._id, async (targetUser) => {
              const targetNow = new Date();
              cleanupExpiredBuffs(targetUser, targetNow);
              if (!hasBuff(targetUser, 'chairman_mood_self_buff', targetNow)) {
                setOrRefreshBuff(targetUser, 'chairman_mood_buff', CHAIRMAN_MOOD_DURATION_MS, { now: targetNow });
                queueNotification(targetUser, 'item_buff', '회장님의 기분 티켓 효과를 받았습니다! 30분 동안 모든 획득 경험치가 10% 증가합니다.');
              }
              return null;
            }, { conflictLabel: 'Chairman mood target conflict' });
            deliveredCount += 1;
          } catch (err) {
            console.error('Chairman mood target skipped:', err);
          }
        }

        queueNotification(user, 'item_use', `회장님의 기분 티켓을 사용했습니다. 현재 온라인 유저 ${deliveredCount}명에게 경험치 버프를 적용했습니다. 자신은 30분 동안 경험치 +20%가 적용됩니다.`);
      }

      if (itemId === 'card_batch_fusion_ticket') {
        const autoFusionResult = runAutoFusionUntilS(user);
        const summaryText = buildAutoFusionSummaryText(autoFusionResult);
        queueNotification(user, 'item_use', `카드 일괄 합성 티켓을 사용했습니다. ${summaryText}`);
      }

      if (itemId === 'bacchus_oneshot_ticket') {
        if (!removeItemFromInventory(user, 'bacchus', 100)) throw createHttpError(400, '박카스 100개가 부족합니다.');
        const bulkAdventureCount = hasCatButlerBulkAdventureBonus(user) ? 200 : 100;
        const bulkAdventureResult = runBulkAdventureSettlement(user, bulkAdventureCount, now);
        const summaryText = buildBulkAdventureSummaryText(bulkAdventureResult);
        const butlerText = bulkAdventureCount > 100 ? ' 집사 착용 효과로 모험 200회를 정산했습니다.' : '';
        queueNotification(user, 'item_use', `박카스 원샷 티켓을 사용했습니다. 박카스 100개를 소모했습니다.${butlerText} ${summaryText}`);
      }

      if (itemId === 'excavation_repair_coupon') {
        user.branchOffice.excavationBrokenUntil = null;
        user.branchOffice.lastLog = '발굴 기계 수리 쿠폰으로 고장난 발굴 기계를 즉시 수리했습니다.';
        user.markModified('branchOffice');
        queueNotification(user, 'item_use', '발굴 기계 수리 쿠폰을 사용해 발굴 기계를 즉시 수리했습니다.');
      }

      reconcileTitles(user, now);
      reconcileSkills(user, now);
      user.gameState.lastActionTime = now;

      const response = await buildFastUserResponseWithGlobals(user, now);
      response.itemUseResult = {
        itemId,
        itemName: itemInfo.name,
        quantity: useQuantity
      };
      return response;
    }, { conflictLabel: 'Inventory use conflict' });
    res.json(response);
  } catch (err) {
    console.error('Inventory use error:', err);
    res.status(err.statusCode || 500).json({ msg: err.statusCode ? err.message : '서버 오류가 발생했습니다.' });
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

    const todayKey = getKSTDateKey(now);
    if (user.meta.lastTitleChangeDayKey === todayKey) {
      return res.status(400).json({ msg: '오늘은 이미 칭호를 변경했습니다. 내일 다시 변경할 수 있습니다.' });
    }

    user.titles.equipped = user.titles.equipped === titleId ? null : titleId;
    user.meta.lastTitleChangeDayKey = todayKey;
    user.gameState.stamina = Math.min(user.gameState.stamina, getEffectiveMaxStamina(user, now));
    const response = await buildFastUserResponseWithGlobals(user, now);
    await persistUserSnapshot(user);
    res.json(response);
  } catch (err) {
    console.error('Title toggle error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/equipment/toggle-equip', async (req, res) => {
  const { userId, equipmentId } = req.body;
  if (!userId || !equipmentId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    calculateOfflineGains(user, now);
    ensureUserDefaults(user);

    const equipment = getEquipmentById(user, equipmentId);
    if (!equipment) {
      return res.status(404).json({ msg: '장비를 찾을 수 없습니다.' });
    }

    const currentlyEquipped = getEquippedEquipment(user);
    clearEquippedEquipment(user);

    if (currentlyEquipped?.equipmentId !== equipment.equipmentId) {
      const slotKey = equipment.equipmentType === EQUIPMENT_TYPE_ATTACK ? 'basicAttack' : 'cardEffect';
      user.equippedEquipment[slotKey] = equipment.equipmentId;
    }

    const response = await buildFastUserResponseWithGlobals(user, now);
    await persistUserSnapshot(user);
    res.json(response);
  } catch (err) {
    console.error('Equipment toggle error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/equipment/upgrade', async (req, res) => {
  const { userId, equipmentId, scrollItemId } = req.body;
  if (!userId || !equipmentId || !scrollItemId) {
    return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });
  }
  const successRoll = Math.random();

  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      ensureUserDefaults(user);

      const equipment = getEquipmentById(user, equipmentId);
      if (!equipment) {
        throw createHttpError(404, '장비를 찾을 수 없습니다.');
      }
      if (Number(equipment.upgradesLeft || 0) <= 0) {
        throw createHttpError(400, '더 이상 업그레이드할 수 없는 장비입니다.');
      }

      const scrollRule = getEquipmentScrollRule(scrollItemId);
      if (!scrollRule) {
        throw createHttpError(400, '사용할 수 없는 주문서입니다.');
      }
      if (scrollRule.equipmentType !== equipment.equipmentType) {
        throw createHttpError(400, '해당 장비에는 사용할 수 없는 주문서입니다.');
      }
      if (getInventoryQuantity(user, scrollItemId) <= 0) {
        throw createHttpError(400, '보유한 주문서가 없습니다.');
      }

      removeItemFromInventory(user, scrollItemId, 1);
      equipment.upgradesLeft = Math.max(0, Number(equipment.upgradesLeft || 0) - 1);
      const success = successRoll < Number(scrollRule.successRate || 0);
      if (success) {
        equipment.statValue = Number((Number(equipment.statValue || 0) + Number(scrollRule.addValue || 0)).toFixed(1));
      }

      const logText = buildEquipmentEnhanceLog(scrollItemId, equipment, success);
      const response = await buildFastUserResponseWithGlobals(user, now);
      response.equipmentUpgrade = {
        success,
        equipmentId: equipment.equipmentId,
        logText
      };
      return response;
    }, { conflictLabel: 'Equipment upgrade conflict' });

    res.json(response);
  } catch (err) {
    console.error('Equipment upgrade error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/equipment/dismantle', async (req, res) => {
  const { userId, equipmentIds } = req.body;
  if (!userId || !Array.isArray(equipmentIds)) {
    return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });
  }

  const selectedIds = [...new Set(equipmentIds.map((id) => String(id || '').trim()).filter(Boolean))].slice(0, 100);
  if (!selectedIds.length) {
    return res.status(400).json({ msg: '분해할 장비를 선택해주세요.' });
  }

  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      ensureUserDefaults(user);

      const selectedSet = new Set(selectedIds);
      const dismantled = [];
      let fragmentCount = 0;

      user.equipments = (user.equipments || []).filter((equipment) => {
        const equipmentId = String(equipment.equipmentId || '');
        if (!selectedSet.has(equipmentId)) return true;

        const fragments = Math.floor(Math.random() * 6);
        fragmentCount += fragments;
        dismantled.push({
          equipmentId,
          name: buildEquipmentDisplayName(equipment),
          desc: buildEquipmentDescription(equipment),
          fragments
        });
        return false;
      });

      if (!dismantled.length) {
        throw createHttpError(404, '분해할 장비를 찾을 수 없습니다.');
      }

      if (user.equippedEquipment?.cardEffect && selectedSet.has(String(user.equippedEquipment.cardEffect))) {
        user.equippedEquipment.cardEffect = null;
      }
      if (user.equippedEquipment?.basicAttack && selectedSet.has(String(user.equippedEquipment.basicAttack))) {
        user.equippedEquipment.basicAttack = null;
      }
      normalizeSingleEquippedEquipment(user);

      if (fragmentCount > 0) {
        addItemToInventory(user, 'equipment_fragment', fragmentCount);
      }
      user.gameState.lastActionTime = now;

      const response = await buildFastUserResponseWithGlobals(user, now);
      response.equipmentDismantle = {
        count: dismantled.length,
        fragments: fragmentCount,
        results: dismantled
      };
      return response;
    }, { conflictLabel: 'Equipment dismantle conflict' });

    res.json(response);
  } catch (err) {
    console.error('Equipment dismantle error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.get('/api/marketplace', async (req, res) => {
  const { userId } = req.query;
  try {
    const now = new Date();
    res.json({
      marketplace: await buildMarketplaceResponse(userId || null, now)
    });
  } catch (err) {
    console.error('Marketplace load error:', err);
    res.status(500).json({ msg: '거래소 정보를 불러오지 못했습니다.' });
  }
});

app.post('/api/marketplace/list', async (req, res) => {
  const { userId, itemType, itemId, price, quantity } = req.body;
  const listingPrice = Math.max(1, Math.floor(Number(price) || 0));
  const requestedQuantity = Number(quantity);

  if (!userId || !['equipment', 'scroll', 'item'].includes(itemType) || !itemId) {
    return res.status(400).json({ msg: '등록할 물품 정보가 부족합니다.' });
  }
  if (!Number.isInteger(requestedQuantity) || requestedQuantity < 1) {
    return res.status(400).json({ msg: '등록 수량은 1개 이상의 정수여야 합니다.' });
  }
  const listingQuantity = itemType === 'equipment' ? 1 : requestedQuantity;
  if (listingPrice <= 0) {
    return res.status(400).json({ msg: '판매 가격은 1원 이상이어야 합니다.' });
  }

  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      ensureUserDefaults(user);

      let listingPayload = null;
      if (itemType === 'equipment') {
        const equipment = getEquipmentById(user, itemId);
        if (!equipment) throw createHttpError(404, '등록할 장비를 찾을 수 없습니다.');
        listingPayload = {
          sellerId: user._id,
          sellerName: buildDisplayName(user),
          itemType: 'equipment',
          itemId: String(equipment.equipmentId),
          itemName: buildEquipmentDisplayName(equipment),
          description: buildEquipmentDescription(equipment),
          quantity: 1,
          equipmentSnapshot: {
            equipmentId: String(equipment.equipmentId),
            equipmentType: equipment.equipmentType,
            statValue: Number(equipment.statValue || 0),
            upgradesLeft: Number(equipment.upgradesLeft || 0)
          },
          price: listingPrice
        };
        user.equipments = (user.equipments || []).filter((entry) => String(entry.equipmentId) !== String(itemId));
        if (user.equippedEquipment?.cardEffect === itemId) user.equippedEquipment.cardEffect = null;
        if (user.equippedEquipment?.basicAttack === itemId) user.equippedEquipment.basicAttack = null;
        normalizeSingleEquippedEquipment(user);
      } else if (itemType === 'scroll') {
        const itemInfo = ITEM_DATA[itemId];
        if (!itemInfo || !getEquipmentScrollRule(itemId)) {
          throw createHttpError(400, '거래소에 등록할 수 없는 주문서입니다.');
        }
        if (!removeItemFromInventory(user, itemId, listingQuantity)) {
          throw createHttpError(400, '등록할 주문서 수량이 부족합니다.');
        }
        listingPayload = {
          sellerId: user._id,
          sellerName: buildDisplayName(user),
          itemType: 'scroll',
          itemId,
          itemName: itemInfo.name,
          description: itemInfo.desc || itemInfo.hoverDesc || '',
          quantity: listingQuantity,
          equipmentSnapshot: null,
          price: listingPrice
        };
      } else {
        const itemInfo = ITEM_DATA[itemId];
        if (!itemInfo || !MARKETPLACE_TRADEABLE_ITEM_IDS.includes(itemId)) {
          throw createHttpError(400, '거래소에 등록할 수 없는 아이템입니다.');
        }
        if (!removeItemFromInventory(user, itemId, listingQuantity)) {
          throw createHttpError(400, '등록할 아이템 수량이 부족합니다.');
        }
        listingPayload = {
          sellerId: user._id,
          sellerName: buildDisplayName(user),
          itemType: 'item',
          itemId,
          itemName: itemInfo.name,
          description: itemInfo.desc || itemInfo.hoverDesc || '',
          quantity: listingQuantity,
          equipmentSnapshot: null,
          price: listingPrice
        };
      }

      user.gameState.lastActionTime = now;
      return { listingPayload };
    }, {
      conflictLabel: 'Marketplace list conflict',
      afterSave: async (user, result) => {
        await MarketplaceListing.create(result.listingPayload);
        const now = new Date();
        const response = await buildUserResponseWithGlobals(user, now);
        response.marketplace = await buildMarketplaceResponse(user._id, now);
        response.marketplaceResult = { message: '물품을 거래소에 등록했습니다.' };
        return response;
      }
    });

    res.json(response);
  } catch (err) {
    console.error('Marketplace list error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/marketplace/buy', async (req, res) => {
  const { userId, listingId } = req.body;
  if (!userId || !listingId) return res.status(400).json({ msg: '구매 정보가 부족합니다.' });

  let reservedListing = null;
  try {
    const now = new Date();
    await expireMarketplaceListings(now);
    const cutoff = new Date(now.getTime() - MARKETPLACE_LISTING_TTL_MS);
    const currentListing = await MarketplaceListing.findById(listingId);
    if (!currentListing || currentListing.status !== 'active') {
      return res.status(404).json({ msg: '이미 판매되었거나 존재하지 않는 물품입니다.' });
    }
    if (new Date(currentListing.createdAt || 0).getTime() <= cutoff.getTime()) {
      await MarketplaceListing.updateOne(
        { _id: listingId, status: 'active' },
        { $set: { status: 'expired', expiredAt: now } }
      );
      return res.status(410).json({ msg: '판매 시간이 만료되어 구매할 수 없습니다.' });
    }
    if (String(currentListing.sellerId) === String(userId)) {
      return res.status(400).json({ msg: '내가 등록한 물품은 구매할 수 없습니다.' });
    }

    reservedListing = await MarketplaceListing.findOneAndUpdate(
      { _id: listingId, status: 'active', createdAt: { $gt: cutoff } },
      { $set: { status: 'sold', buyerId: userId, soldAt: now } },
      { returnDocument: 'after' }
    );
    if (!reservedListing) {
      return res.status(409).json({ msg: '방금 다른 유저가 먼저 구매했습니다.' });
    }

    const response = await runUserMutationWithRetry(userId, async (user) => {
      calculateOfflineGains(user, now);
      ensureUserDefaults(user);
      const price = Number(reservedListing.price || 0);
      if (Number(user.gameState.money || 0) < price) {
        throw createHttpError(400, '잔고가 부족합니다.');
      }

      user.gameState.money -= price;
      if (reservedListing.itemType === 'equipment') {
        user.equipments.push(cloneEquipmentEntry(reservedListing.equipmentSnapshot));
      } else {
        addItemToInventory(user, reservedListing.itemId, Number(reservedListing.quantity || 1), { allowDailyAugmentCopy: false, now });
      }
      user.gameState.lastActionTime = now;
      return null;
    }, {
      conflictLabel: 'Marketplace buy conflict',
      afterSave: async (user) => {
        reservedListing.buyerName = buildDisplayName(user);
        await reservedListing.save();
        const response = await buildUserResponseWithGlobals(user, now);
        response.marketplace = await buildMarketplaceResponse(user._id, now);
        response.marketplaceResult = { message: `${reservedListing.itemName}을(를) 구매했습니다.` };
        return response;
      }
    });

    res.json(response);
  } catch (err) {
    if (reservedListing?._id && reservedListing.status === 'sold') {
      await MarketplaceListing.updateOne(
        { _id: reservedListing._id, status: 'sold', buyerId: userId },
        { $set: { status: 'active' }, $unset: { buyerId: '', buyerName: '', soldAt: '' } }
      ).catch((revertErr) => console.error('Marketplace buy reservation revert failed:', revertErr));
    }
    console.error('Marketplace buy error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/marketplace/cancel', async (req, res) => {
  const { userId, listingId } = req.body;
  if (!userId || !listingId) return res.status(400).json({ msg: '취소 정보가 부족합니다.' });

  let cancelledListing = null;
  let previousStatus = 'active';
  try {
    const now = new Date();
    await expireMarketplaceListings(now);
    const targetListing = await MarketplaceListing.findOne(
      { _id: listingId, sellerId: userId, status: { $in: ['active', 'expired'] } }
    );
    if (!targetListing) {
      return res.status(404).json({ msg: '취소할 등록 물품을 찾을 수 없습니다.' });
    }
    previousStatus = targetListing.status;
    cancelledListing = await MarketplaceListing.findOneAndUpdate(
      { _id: listingId, sellerId: userId, status: previousStatus },
      { $set: { status: 'cancelled' } },
      { returnDocument: 'after' }
    );
    if (!cancelledListing) {
      return res.status(404).json({ msg: '취소할 등록 물품을 찾을 수 없습니다.' });
    }

    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      ensureUserDefaults(user);
      if (cancelledListing.itemType === 'equipment') {
        user.equipments.push(cloneEquipmentEntry(cancelledListing.equipmentSnapshot, { preserveId: true }));
      } else {
        addItemToInventory(user, cancelledListing.itemId, Number(cancelledListing.quantity || 1), { allowDailyAugmentCopy: false, now });
      }
      user.gameState.lastActionTime = now;
      return null;
    }, {
      conflictLabel: 'Marketplace cancel conflict',
      afterSave: async (user) => {
        const now = new Date();
        const response = await buildUserResponseWithGlobals(user, now);
        response.marketplace = await buildMarketplaceResponse(user._id, now);
        response.marketplaceResult = { message: '등록 물품을 회수했습니다.' };
        return response;
      }
    });

    res.json(response);
  } catch (err) {
    if (cancelledListing?._id) {
      await MarketplaceListing.updateOne(
        { _id: cancelledListing._id, status: 'cancelled' },
        { $set: { status: previousStatus } }
      ).catch((revertErr) => console.error('Marketplace cancel revert failed:', revertErr));
    }
    console.error('Marketplace cancel error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/marketplace/settle', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  let claimIds = [];
  const settlementToken = `settle-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let settlementMoneySaved = false;
  try {
    await MarketplaceListing.updateMany(
      { sellerId: userId, status: 'settling', $or: [{ settlementToken: '' }, { settlementToken: null }, { settlementToken: { $exists: false } }] },
      { $set: { status: 'sold' }, $unset: { settlementToken: '' } }
    );
    const soldListings = await MarketplaceListing.find({ sellerId: userId, status: 'sold' });
    claimIds = soldListings.map((listing) => listing._id);
    if (!claimIds.length) return res.status(400).json({ msg: '정산할 판매 금액이 없습니다.' });

    await MarketplaceListing.updateMany(
      { _id: { $in: claimIds }, sellerId: userId, status: 'sold' },
      { $set: { status: 'settling', settlementToken } }
    );
    const claimedListings = await MarketplaceListing.find({ _id: { $in: claimIds }, sellerId: userId, status: 'settling', settlementToken });
    claimIds = claimedListings.map((listing) => listing._id);
    const grossAmount = claimedListings.reduce((sum, listing) => sum + Number(listing.price || 0), 0);
    const feeAmount = Math.floor(grossAmount * MARKETPLACE_FEE_RATE);
    const settleAmount = Math.max(0, grossAmount - feeAmount);
    if (settleAmount <= 0 || !claimIds.length) throw createHttpError(400, '정산할 금액이 없습니다.');

    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      ensureUserDefaults(user);
      user.gameState.money += settleAmount;
      queueNotification(user, 'marketplace_settle', `사내 번개장터 판매 대금 ${settleAmount.toLocaleString()}원을 정산받았습니다. (수수료 ${feeAmount.toLocaleString()}원)`);
      user.gameState.lastActionTime = now;
      return null;
    }, {
      conflictLabel: 'Marketplace settle conflict',
      afterSave: async (user) => {
        settlementMoneySaved = true;
        const now = new Date();
        await MarketplaceListing.updateMany(
          { _id: { $in: claimIds }, sellerId: userId, status: 'settling', settlementToken },
          { $set: { status: 'settled', settledAt: now }, $unset: { settlementToken: '' } }
        );
        const response = await buildUserResponseWithGlobals(user, now);
        response.marketplace = await buildMarketplaceResponse(user._id, now);
        response.marketplaceResult = { message: `${settleAmount.toLocaleString()}원을 정산했습니다. (판매가 ${grossAmount.toLocaleString()}원 - 수수료 ${feeAmount.toLocaleString()}원)` };
        return response;
      }
    });

    res.json(response);
  } catch (err) {
    if (claimIds.length && !settlementMoneySaved) {
      await MarketplaceListing.updateMany(
        { _id: { $in: claimIds }, status: 'settling', settlementToken },
        { $set: { status: 'sold' }, $unset: { settlementToken: '' } }
      ).catch((revertErr) => console.error('Marketplace settle revert failed:', revertErr));
    }
    console.error('Marketplace settle error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/cards/draw', async (req, res) => {
  const { userId, quantity } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });
  const drawCount = Math.max(1, Math.floor(Number(quantity) || 1));

  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);

      if (!removeItemFromInventory(user, 'business_card', drawCount)) {
        throw createHttpError(400, '명함이 부족합니다.');
      }

      const results = [];
      for (let drawIndex = 0; drawIndex < drawCount; drawIndex += 1) {
        const card = rollCardDraw();
        const isNew = getTotalOwnedCardQuantity(user, card.id) <= 0;
        addCardToCollection(user, card.id, 1);
        results.push({
          id: card.id,
          name: card.name,
          grade: card.grade,
          color: CARD_GRADE_COLORS[card.grade],
          isNew
        });
      }
      results.sort((left, right) => {
        const gradeDiff = (CARD_GRADE_SORT_ORDER[left.grade] ?? 99) - (CARD_GRADE_SORT_ORDER[right.grade] ?? 99);
        if (gradeDiff !== 0) return gradeDiff;
        return String(left.name || '').localeCompare(String(right.name || ''), 'ko');
      });

      user.gameState.lastActionTime = now;
      const response = await buildFastUserResponseWithGlobals(user, now);
      response.drawResults = results;
      return response;
    }, { conflictLabel: 'Card draw conflict' });

    res.json(response);
  } catch (err) {
    console.error('Card draw error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/cards/fuse', async (req, res) => {
  const { userId, cardIds, cards, targetCardId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });
  const requestedCards = Array.isArray(cards)
    ? cards.map((entry) => ({
      cardId: String(entry?.cardId || ''),
      enhancementLevel: normalizeCardEnhancementLevel(entry?.enhancementLevel || 0)
    }))
    : (Array.isArray(cardIds) ? cardIds.map((entry) => {
      const [cardId, levelText] = String(entry || '').split('::');
      return {
        cardId,
        enhancementLevel: normalizeCardEnhancementLevel(levelText || 0)
      };
    }) : []);

  if (![5, 10].includes(requestedCards.length)) {
    return res.status(400).json({ msg: '합성에는 카드 5장 또는 S등급 카드 10장이 필요합니다.' });
  }

  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      ensureUserDefaults(user);

      const quantityMap = new Map();
      let sourceGrade = null;
      for (const entry of requestedCards) {
        const cardId = entry.cardId;
        const enhancementLevel = normalizeCardEnhancementLevel(entry.enhancementLevel || 0);
        const cardInfo = CARD_DATA[cardId];
        if (!cardInfo) {
          throw createHttpError(400, '존재하지 않는 카드가 포함되어 있습니다.');
        }
        if (enhancementLevel >= 5) {
          throw createHttpError(400, '5강 카드는 합성 재료로 사용할 수 없습니다.');
        }
        if (isCardVariantLocked(user, cardId, enhancementLevel)) {
          throw createHttpError(400, '잠금 처리된 카드는 합성 재료로 사용할 수 없습니다.');
        }
        if (!sourceGrade) {
          sourceGrade = cardInfo.grade;
        } else if (sourceGrade !== cardInfo.grade) {
          throw createHttpError(400, '같은 등급 카드만 합성할 수 있습니다.');
        }
        const variantKey = `${cardId}::${enhancementLevel}`;
        quantityMap.set(variantKey, {
          cardId,
          enhancementLevel,
          amount: (quantityMap.get(variantKey)?.amount || 0) + 1
        });
      }

      const isSelectiveSFusion = sourceGrade === 'S';
      const requiredCount = isSelectiveSFusion ? 10 : 5;
      if (requestedCards.length !== requiredCount) {
        throw createHttpError(400, isSelectiveSFusion
          ? 'S등급 선택 합성에는 S등급 카드 10장이 필요합니다.'
          : '일반 합성에는 같은 등급 카드 5장이 필요합니다.');
      }
      const normalizedTargetCardId = String(targetCardId || '');
      if (isSelectiveSFusion) {
        const targetInfo = CARD_DATA[normalizedTargetCardId];
        if (!targetInfo || targetInfo.grade !== 'S') {
          throw createHttpError(400, '획득할 S등급 카드를 선택해주세요.');
        }
      }

      for (const { cardId, enhancementLevel, amount } of quantityMap.values()) {
        if (getOwnedCardVariantQuantity(user, cardId, enhancementLevel) < amount) {
          throw createHttpError(400, '보유 카드 수량이 부족합니다.');
        }
      }

      for (const { cardId, enhancementLevel, amount } of quantityMap.values()) {
        const removed = enhancementLevel > 0
          ? removeEnhancedCard(user, cardId, enhancementLevel, amount)
          : removeCardFromCollection(user, cardId, amount);
        if (!removed) {
          throw createHttpError(400, '보유 카드 수량이 부족합니다.');
        }
      }

      const resultGrade = isSelectiveSFusion ? 'S' : getFusionOutcomeGrade(sourceGrade);
      const resultCardId = isSelectiveSFusion ? normalizedTargetCardId : getRandomCardIdByGrade(resultGrade);
      if (!resultCardId) {
        throw createHttpError(500, '합성 결과 카드를 찾지 못했습니다.');
      }

      addCardToCollection(user, resultCardId, 1);

      user.gameState.lastActionTime = now;
      const response = await buildFastUserResponseWithGlobals(user, now);
      response.fusionResult = {
        sourceGrade,
        selective: isSelectiveSFusion,
        result: {
          id: resultCardId,
          name: CARD_DATA[resultCardId].name,
          grade: CARD_DATA[resultCardId].grade,
          color: CARD_GRADE_COLORS[CARD_DATA[resultCardId].grade] || '#666666',
          skillName: CARD_DATA[resultCardId].skillName,
          skillDesc: CARD_DATA[resultCardId].skillDesc
        }
      };
      return response;
    }, { conflictLabel: 'Card fusion conflict' });

    res.json(response);
  } catch (err) {
    console.error('Card fusion error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/cards/toggle-lock', async (req, res) => {
  const { userId, cardId, enhancementLevel } = req.body;
  if (!userId || !cardId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });

  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      ensureUserDefaults(user);
      const normalizedLevel = normalizeCardEnhancementLevel(enhancementLevel || 0);
      if (!CARD_DATA[cardId]) {
        throw createHttpError(400, '존재하지 않는 카드입니다.');
      }
      if (getOwnedCardVariantQuantity(user, cardId, normalizedLevel) <= 0) {
        throw createHttpError(400, '보유 중인 카드만 잠금할 수 있습니다.');
      }
      const variantKey = getCardVariantKey(cardId, normalizedLevel);
      const currentLocked = isCardVariantLocked(user, cardId, normalizedLevel);
      user.lockedCards = (user.lockedCards || []).filter((entry) => getCardVariantKey(entry.cardId, entry.level || 0) !== variantKey);
      if (!currentLocked) {
        user.lockedCards.push({ cardId, level: normalizedLevel });
      }
      user.gameState.lastActionTime = now;
      const response = await buildFastUserResponseWithGlobals(user, now);
      response.cardLockResult = { cardId, enhancementLevel: normalizedLevel, locked: !currentLocked };
      return response;
    }, { conflictLabel: 'Card lock conflict' });

    res.json(response);
  } catch (err) {
    console.error('Card lock error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/cards/enhance', async (req, res) => {
  const { userId, cardId, enhancementLevel } = req.body;
  if (!userId || !cardId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });
  const successRoll = Math.random();

  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      ensureUserDefaults(user);

      const currentLevel = normalizeCardEnhancementLevel(enhancementLevel || 0);
      if (!CARD_DATA[cardId]) {
        throw createHttpError(400, '존재하지 않는 카드입니다.');
      }
      if (CARD_DATA[cardId].enhanceDisabled) {
        throw createHttpError(400, '이 카드는 강화할 수 없습니다.');
      }
      if (currentLevel >= 5) {
        throw createHttpError(400, '이미 최대 강화 단계입니다.');
      }
      if (getOwnedCardVariantQuantity(user, cardId, currentLevel) <= 0) {
        throw createHttpError(400, '해당 강화 단계의 카드를 보유하고 있지 않습니다.');
      }
      const equippedThisVariant = user.equippedCardId === cardId && Number(user.equippedCardLevel || 0) === currentLevel;
      const availableEnhanceQuantity = getOwnedCardVariantQuantity(user, cardId, currentLevel);
      if (availableEnhanceQuantity <= 0) {
        throw createHttpError(400, '강화에 사용할 카드가 없습니다.');
      }

      const enhanceCost = getCardEnhancementCost(cardId, currentLevel);
      if (user.gameState.money < enhanceCost) {
        throw createHttpError(400, '강화 비용이 부족합니다.');
      }

      user.gameState.money -= enhanceCost;
      const successRate = getCardEnhancementSuccessRate(currentLevel);
      const isSuccess = successRoll < successRate;
      const nextLevel = currentLevel + 1;

      if (isSuccess) {
        if (currentLevel <= 0) {
          removeCardFromCollection(user, cardId, 1);
        } else {
          removeEnhancedCard(user, cardId, currentLevel, 1);
        }
        addEnhancedCard(user, cardId, nextLevel, 1);
        if (equippedThisVariant) {
          user.equippedCardId = cardId;
          user.equippedCardLevel = nextLevel;
        }
      }

      user.gameState.lastActionTime = now;
      const response = await buildFastUserResponseWithGlobals(user, now);
      response.enhancementResult = {
        cardId,
        success: isSuccess,
        previousLevel: currentLevel,
        nextLevel: isSuccess ? nextLevel : currentLevel,
        successRate,
        cost: enhanceCost,
        cardName: CARD_DATA[cardId].name
      };
      return response;
    }, { conflictLabel: 'Card enhance conflict' });

    res.json(response);
  } catch (err) {
    console.error('Card enhance error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/cards/equip', async (req, res) => {
  const { userId, cardId, enhancementLevel } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      ensureUserDefaults(user);

      const targetLevel = normalizeCardEnhancementLevel(enhancementLevel || 0);
      if (cardId && getOwnedCardVariantQuantity(user, cardId, targetLevel) <= 0) {
        throw createHttpError(400, '보유하지 않은 카드입니다.');
      }

      for (const mode of RAID_MODE_LIST) {
        const queuedSlotIndex = findQueuedRaidSlotIndex(user._id, mode);
        if (queuedSlotIndex < 0 || !cardId) continue;

        const otherQueuedUserIds = getRaidRoom(mode).slots
          .filter(Boolean)
          .filter((slotUserId) => String(slotUserId) !== String(user._id));
        if (!otherQueuedUserIds.length) continue;

        const queuedUsers = await User.find({ _id: { $in: otherQueuedUserIds } })
          .select('nickname username equippedCardId equippedCardLevel raidExtraCardSelection cards enhancedCards');
        const duplicateCardUser = queuedUsers.find((queuedUser) => {
          ensureUserDefaults(queuedUser);
          return buildRaidCardEntriesForUser(queuedUser, mode)
            .some((entry) => entry.cardId === cardId);
        });
        if (duplicateCardUser) {
          throw createHttpError(400, '같은 카드를 든 참가자가 이미 대기 중이라 교체할 수 없습니다.');
        }
      }

      const isSameCardVariant = user.equippedCardId === cardId
        && Number(user.equippedCardLevel || 0) === targetLevel;
      if (isSameCardVariant) {
        user.equippedCardId = null;
        user.equippedCardLevel = 0;
      } else {
        user.equippedCardId = cardId || null;
        user.equippedCardLevel = cardId ? targetLevel : 0;
      }

      if (
        user.raidExtraCardSelection?.cardId
        && user.raidExtraCardSelection.cardId === user.equippedCardId
        && Number(user.raidExtraCardSelection.level || 0) === Number(user.equippedCardLevel || 0)
      ) {
        user.raidExtraCardSelection = { cardId: null, level: 0 };
      }

      user.gameState.lastActionTime = now;
      return {
        userPatch: {
          ...buildRealtimeGameStatePatch(user, now),
          cards: user.cards,
          enhancedCards: user.enhancedCards,
          lockedCards: user.lockedCards,
          cardDetails: buildCardDetails(user),
          cardVariantDetails: buildCardVariantDetails(user)
        },
        notifications: consumeNotifications(user)
      };
    }, {
      conflictLabel: 'Card equip conflict',
      selectFields: LIGHT_USER_SELECT_FIELDS,
      snapshotBuilder: buildUserSyncPersistenceSnapshot
    });
    res.json(response);
  } catch (err) {
    console.error('Card equip error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/raid/state', async (req, res) => {
  const { userId, viewing, mode } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const user = await getCachedPollUserSnapshot(
      userId,
      'nickname username gameState.level meta.lastRaidDayKey meta.raidEntryDayKey meta.raidEntryUsedCount meta.raidEntryBonusCount'
    );
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    user.gameState = user.gameState || {};
    user.gameState.level = Number(user.gameState.level || 1);
    user.meta = user.meta || {};

    const now = new Date();
    const normalizedMode = normalizeRaidModeForCurrentBoss(mode, now);
    const room = getRaidRoom(normalizedMode);
    if (viewing && room.activeBattle && !isRaidUserParticipant(room.activeBattle, userId)) {
      registerViewer(room.viewers, user, now);
    } else {
      pruneViewerMap(room.viewers, now);
    }
    const raid = await buildRaidStateResponse(user, now, normalizedMode, { poll: true });
    res.json({ raid });
  } catch (err) {
    console.error('Raid state poll failed:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/raid/toggle-slot', async (req, res) => {
  const { userId, slotIndex, mode } = req.body;
  const targetSlot = Math.max(0, Math.min(RAID_PARTY_SIZE - 1, Math.floor(Number(slotIndex))));
  if (!userId || Number.isNaN(targetSlot)) {
    return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    ensureUserDefaults(user);
    const now = new Date();
    calculateOfflineGains(user, now);
    const normalizedMode = normalizeRaidMode(mode);
    if (!isRaidModeAvailableForBoss(normalizedMode, getCurrentRaidBossId(now))) {
      return res.status(400).json({ msg: '오늘 보스는 카오스 모드를 지원하지 않습니다.' });
    }
    const room = getRaidRoom(normalizedMode);
    pruneExpiredRaidQueue(normalizedMode, now);

    if (room.activeBattle) {
      return res.status(400).json({ msg: '이미 해당 모드의 레이드가 진행 중입니다.' });
    }
    if (!isRaidLevelEligible(user.gameState.level, normalizedMode)) {
      return res.status(400).json({ msg: `${getRaidModeConfig(normalizedMode).label} 레이드는 ${getRaidLevelRequirementText(normalizedMode)}만 입장할 수 있습니다.` });
    }
    if (isRaidAlreadyUsedToday(user, now)) {
      return res.status(400).json({ msg: '오늘은 이미 레이드에 입장했습니다. 내일 다시 시도해주세요.' });
    }

    const existingSlot = findQueuedRaidSlotIndex(user._id, normalizedMode);
    if (existingSlot === targetSlot) {
      room.slots[targetSlot] = null;
      room.slotQueuedAt[targetSlot] = null;
      syncQueuedRaidBoss(now, normalizedMode);
      bumpRaidVersion();
    } else {
      const requestedRaidCards = buildRaidCardEntriesForUser(user, normalizedMode);
      if (normalizedMode === RAID_MODE_CHAOS && requestedRaidCards.length < 2) {
        return res.status(400).json({ msg: '카오스 레이드는 기본 장착 카드와 다른 추가 카드 1장이 필요합니다.' });
      }
      if (requestedRaidCards.length) {
        const queuedOtherUserIds = room.slots
          .filter(Boolean)
          .filter((slotUserId) => String(slotUserId) !== String(user._id));
        if (queuedOtherUserIds.length) {
          const queuedUsers = await User.find({ _id: { $in: queuedOtherUserIds } })
            .select('nickname username equippedCardId equippedCardLevel raidExtraCardSelection cards enhancedCards');
          const requestedCardIds = new Set(requestedRaidCards.map((entry) => entry.cardId).filter(Boolean));
          const duplicateCardUser = queuedUsers.find((queuedUser) => {
            ensureUserDefaults(queuedUser);
            return buildRaidCardEntriesForUser(queuedUser, normalizedMode)
              .some((entry) => requestedCardIds.has(entry.cardId));
          });
          if (duplicateCardUser) {
            return res.status(400).json({ msg: '중복된 카드를 들고 온 참가자가 이미 있습니다.' });
          }
        }
      }
      if (room.slots[targetSlot] && String(room.slots[targetSlot]) !== String(user._id)) {
        return res.status(400).json({ msg: '이미 다른 플레이어가 대기 중인 슬롯입니다.' });
      }
      if (existingSlot >= 0) {
        room.slots[existingSlot] = null;
        room.slotQueuedAt[existingSlot] = null;
      }
      clearQueuedRaidUser(user._id, null, { excludeModes: [normalizedMode] });
      room.slots[targetSlot] = String(user._id);
      room.slotQueuedAt[targetSlot] = now;
      syncQueuedRaidBoss(now, normalizedMode);
      bumpRaidVersion();
    }

    const raid = await buildRaidStateResponse(user, now, normalizedMode);
    res.json({ raid });
  } catch (err) {
    console.error('Raid slot toggle error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/raid/select-extra-card', async (req, res) => {
  const { userId, cardId, enhancementLevel } = req.body;
  if (!userId) return res.status(400).json({ msg: '?ъ슜??ID媛 ?꾩슂?⑸땲??' });

  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      ensureUserDefaults(user);
      const normalizedLevel = normalizeCardEnhancementLevel(enhancementLevel || 0);
      if (!cardId) {
        user.raidExtraCardSelection = { cardId: null, level: 0 };
      } else {
        if (!CARD_DATA[cardId]) {
          throw createHttpError(400, '존재하지 않는 카드입니다.');
        }
        if (getOwnedCardVariantQuantity(user, cardId, normalizedLevel) <= 0) {
          throw createHttpError(400, '보유 중인 카드만 카오스 추가 카드로 선택할 수 있습니다.');
        }
        if (user.equippedCardId === cardId) {
          throw createHttpError(400, '기본 장착 카드와 같은 카드는 추가 카드로 선택할 수 없습니다.');
        }
        const chaosSlotIndex = findQueuedRaidSlotIndex(user._id, RAID_MODE_CHAOS);
        if (chaosSlotIndex >= 0) {
          const queuedOtherUserIds = getRaidRoom(RAID_MODE_CHAOS).slots
            .filter(Boolean)
            .filter((slotUserId) => String(slotUserId) !== String(user._id));
          if (queuedOtherUserIds.length) {
            const queuedUsers = await User.find({ _id: { $in: queuedOtherUserIds } })
              .select('nickname username equippedCardId equippedCardLevel raidExtraCardSelection cards enhancedCards');
            const duplicateCardUser = queuedUsers.find((queuedUser) => {
              ensureUserDefaults(queuedUser);
              return buildRaidCardEntriesForUser(queuedUser, RAID_MODE_CHAOS)
                .some((entry) => entry.cardId === cardId);
            });
            if (duplicateCardUser) {
              throw createHttpError(400, '중복된 카드를 들고 온 참가자가 이미 있습니다.');
            }
          }
        }
        user.raidExtraCardSelection = { cardId, level: normalizedLevel };
      }
      user.gameState.lastActionTime = now;
      return buildFastUserResponseWithGlobals(user, now);
    }, { conflictLabel: 'Raid extra card selection conflict' });

    res.json(response);
  } catch (err) {
    console.error('Raid extra card selection error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '?쒕쾭 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.' });
  }
});

app.post('/api/raid/start', async (req, res) => {
  const { userId, mode } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  const consumedUsers = [];
  const normalizedMode = normalizeRaidMode(mode);
  const room = getRaidRoom(normalizedMode);
  try {
    const starter = await User.findById(userId);
    if (!starter) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    ensureUserDefaults(starter);
    const now = new Date();
    calculateOfflineGains(starter, now);
    if (!isRaidModeAvailableForBoss(normalizedMode, getCurrentRaidBossId(now))) {
      return res.status(400).json({ msg: '오늘 보스는 카오스 모드를 지원하지 않습니다.' });
    }
    try {
      await advanceRaidState(now);
    } catch (err) {
      console.error('Raid advance before start error:', err);
      if (room.activeBattle?.finalizing) {
        room.activeBattle.finalizing = false;
        room.activeBattle.nextActionAt = new Date(now.getTime() + RAID_ACTION_DELAY_MS);
      }
    }
    pruneExpiredRaidQueue(normalizedMode, now);

    if (room.activeBattle) {
      if (isRaidUserParticipant(room.activeBattle, userId)) {
        const raid = await buildRaidStateResponse(starter, now, normalizedMode);
        return res.json({ raid, resumed: true });
      }
      return res.status(400).json({ msg: '이미 해당 모드의 레이드가 진행 중입니다.' });
    }

    const leftMostIndex = room.slots.findIndex(Boolean);
    if (leftMostIndex === -1 || String(room.slots[leftMostIndex]) !== String(userId)) {
      return res.status(403).json({ msg: '가장 왼쪽 슬롯의 플레이어만 입장 버튼을 누를 수 있습니다.' });
    }

    const participantIds = room.slots.filter(Boolean);
    if (participantIds.length < 2) {
      return res.status(400).json({ msg: '회의는 혼자 할 수 없습니다!' });
    }
    const users = await User.find({ _id: { $in: participantIds } });
    const userMap = new Map(users.map((user) => [String(user._id), user]));
    const participants = [];
    const participantUsers = [];

    for (const participantId of participantIds) {
      const user = userMap.get(String(participantId));
      if (!user) continue;
      ensureUserDefaults(user);
      calculateOfflineGains(user, now);
      if (!isRaidLevelEligible(user.gameState.level, normalizedMode)) {
        return res.status(400).json({ msg: `${user.nickname || user.username} 님은 ${getRaidModeConfig(normalizedMode).label} 레이드 입장 기준(${getRaidLevelRequirementText(normalizedMode)})에 맞지 않습니다.` });
      }
      if (normalizedMode === RAID_MODE_CHAOS && buildRaidCardEntriesForUser(user, normalizedMode).length < 2) {
        return res.status(400).json({ msg: `${user.nickname || user.username} 님은 카오스 레이드 추가 카드 선택이 필요합니다.` });
      }
      participants.push(createRaidParticipantFromUser(user, normalizedMode));
      participantUsers.push(user);
    }

    const duplicateCardIds = participants
      .flatMap((participant) => getParticipantCardEntries(participant).map((entry) => entry.cardId))
      .filter(Boolean)
      .filter((cardId, index, list) => list.indexOf(cardId) !== index);
    if (duplicateCardIds.length) {
      return res.status(400).json({ msg: '같은 카드를 장착한 참가자가 있어 레이드를 시작할 수 없습니다.' });
    }

    if (participants.length < 2) {
      room.slots = room.slots.map((slotUserId, index) => {
        const keepSlot = userMap.has(String(slotUserId));
        if (!keepSlot) room.slotQueuedAt[index] = null;
        return keepSlot ? slotUserId : null;
      });
      syncQueuedRaidBoss(now, normalizedMode);
      bumpRaidVersion();
      return res.status(400).json({ msg: '참여 가능한 파티원이 2명 이상 있어야 합니다.' });
    }

    for (let participantIndex = 0; participantIndex < participantUsers.length; participantIndex += 1) {
      let user = participantUsers[participantIndex];
      if (!consumeRaidEntry(user, now)) {
        return res.status(400).json({ msg: `${user.nickname || user.username} 님은 오늘 이미 레이드에 참여했습니다.` });
      }
      try {
        await persistUserSnapshot(user);
        consumedUsers.push(user);
      } catch (err) {
        if (!isVersionConflictError(err)) throw err;

        const latestUser = await User.findById(user._id);
        if (!latestUser) {
          throw createHttpError(404, '사용자를 찾을 수 없습니다.');
        }

        ensureUserDefaults(latestUser);
        calculateOfflineGains(latestUser, now);
        if (!isRaidLevelEligible(latestUser.gameState.level, normalizedMode)) {
          throw createHttpError(400, `${latestUser.nickname || latestUser.username} 님은 ${getRaidModeConfig(normalizedMode).label} 레이드 입장 기준(${getRaidLevelRequirementText(normalizedMode)})에 맞지 않습니다.`);
        }
        if (!consumeRaidEntry(latestUser, now)) {
          throw createHttpError(400, `${latestUser.nickname || latestUser.username} 님은 오늘 이미 레이드에 참여했습니다.`);
        }

        await persistUserSnapshot(latestUser);
        participantUsers[participantIndex] = latestUser;
        participants[participantIndex] = createRaidParticipantFromUser(latestUser, normalizedMode);
        consumedUsers.push(latestUser);
      }
    }

    const countdownDurationMs = (RAID_COUNTDOWN_SECONDS * 1000) + RAID_COUNTDOWN_BUFFER_MS;
    const countdownBaseTime = new Date();

    const currentBoss = syncQueuedRaidBoss(now, normalizedMode) || getCurrentRaidBoss(now);
    const bossMaxHp = getRaidBossMaxHpForMode(currentBoss, normalizedMode);
    room.activeBattle = {
      battleId: `raid-${Date.now()}`,
      mode: normalizedMode,
      bossId: currentBoss.id,
      bossHp: bossMaxHp,
      bossMaxHp,
      bossShield: 0,
      bossShieldTurns: 0,
      bossLastHpLoss: 0,
      bossSmoothScalpStacks: 0,
      bossDamageReductionTurns: 0,
      bossDamageReductionPercent: 0,
      bossHealingReductionTurns: 0,
      bossHealingReductionMultiplier: 1,
      bossShieldExpirePartyHits: 0,
      bossShieldExpirePartyDamage: 0,
      bossMinions: createRaidBossMinions(currentBoss.id, normalizedMode),
      potatoRehabKillUserIds: [],
      bossOvertimeDebuffs: [],
      bossPoisonDebuffs: [],
      participants,
      phase: 'countdown',
      countdownEndsAt: new Date(countdownBaseTime.getTime() + countdownDurationMs),
      readyEndsAt: null,
      nextActionAt: new Date(countdownBaseTime.getTime() + countdownDurationMs),
      turnNumber: 1,
      turnIndex: 0,
      bossPatternIndex: 0,
      logs: ['레이드가 곧 시작됩니다. 3, 2, 1'],
      winner: null
    };
    applyRaidBattleStartPassives(room.activeBattle);
    room.slots = Array(RAID_PARTY_SIZE).fill(null);
    room.slotQueuedAt = Array(RAID_PARTY_SIZE).fill(null);
    room.queuedBossId = null;
    bumpRaidVersion();

    const responseUser = participantUsers.find((entry) => String(entry._id) === String(userId)) || starter;
    const raid = {
      version: raidState.version,
      mode: normalizedMode,
      modes: getRaidAvailableModes(now).map((entryMode) => buildRaidModeStatus(responseUser, entryMode, now)),
      lobby: getRaidLobbySummary(now, normalizedMode),
      slots: Array(RAID_PARTY_SIZE).fill(null),
      queuedSlotIndex: -1,
      todayUsed: isRaidAlreadyUsedToday(responseUser, now),
      remainingEntries: getRaidRemainingEntries(responseUser, now),
      minLevelMet: isRaidLevelEligible(responseUser.gameState.level, normalizedMode),
      levelRequirementText: getRaidLevelRequirementText(normalizedMode),
      canStart: false,
      countdown: {
        active: true,
        mode: normalizedMode,
        endsAt: room.activeBattle.countdownEndsAt,
        participantIds: room.activeBattle.participants.map((participant) => participant.userId)
      },
      activeBattle: buildRaidBattleSnapshot(room.activeBattle, userId),
      activeBattles: {
        [RAID_MODE_NORMAL]: buildRaidBattleSnapshot(getRaidRoom(RAID_MODE_NORMAL).activeBattle, userId),
        [RAID_MODE_HARD]: buildRaidBattleSnapshot(getRaidRoom(RAID_MODE_HARD).activeBattle, userId),
        [RAID_MODE_CHAOS]: buildRaidBattleSnapshot(getRaidRoom(RAID_MODE_CHAOS).activeBattle, userId)
      }
    };
    res.json({ raid });
  } catch (err) {
    console.error('Raid start error:', err);
    for (const user of consumedUsers) {
      try {
        refundRaidEntry(user, new Date());
        await persistUserSnapshot(user);
      } catch (refundErr) {
        console.error('Raid start refund error:', refundErr);
      }
    }
    if (
      room.activeBattle
      && room.activeBattle.phase === 'countdown'
      && room.activeBattle.participants?.some((participant) => String(participant.userId) === String(userId))
    ) {
      clearActiveRaidBattle(normalizedMode);
    }
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/raid/cancel-countdown', async (req, res) => {
  const { userId, mode } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const normalizedMode = normalizeRaidMode(mode);
    const room = getRaidRoom(normalizedMode);
    const activeBattle = room.activeBattle;
    if (!activeBattle || activeBattle.phase !== 'countdown') {
      return res.status(400).json({ msg: '입장 카운트다운 중인 레이드가 없습니다.' });
    }

    const isParticipant = activeBattle.participants.some((participant) => String(participant.userId) === String(userId));
    if (!isParticipant) {
      return res.status(403).json({ msg: '레이드 참여자만 취소할 수 있습니다.' });
    }

    const participantIds = activeBattle.participants.map((participant) => String(participant.userId));
    const users = await User.find({ _id: { $in: participantIds } });
    const userMap = new Map(users.map((entry) => [String(entry._id), entry]));

    room.slots = Array(RAID_PARTY_SIZE).fill(null);
    room.slotQueuedAt = Array(RAID_PARTY_SIZE).fill(null);
    activeBattle.participants.forEach((participant, index) => {
      if (index < RAID_PARTY_SIZE) {
        room.slots[index] = String(participant.userId);
        room.slotQueuedAt[index] = new Date();
      }
    });
    room.queuedBossId = activeBattle.bossId;

    for (const participantId of participantIds) {
      const participantUser = userMap.get(String(participantId));
      if (!participantUser) continue;
      refundRaidEntry(participantUser, new Date());
      await persistUserSnapshot(participantUser);
    }

    room.activeBattle = null;
    room.viewers = {};
    bumpRaidVersion();

    const raid = await buildRaidStateResponse(user, new Date(), normalizedMode);
    res.json({ raid, cancelled: true });
  } catch (err) {
    console.error('Raid countdown cancel error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/raid/plan-skill', async (req, res) => {
  const { userId, useSkill, targetUserId, targetUserId2, cardSlot } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    await advanceRaidState(new Date());
    const located = findRaidRoomWithParticipant(userId);
    const activeBattle = located?.room?.activeBattle;
    if (!activeBattle || activeBattle.phase === 'finished') {
      return res.status(400).json({ msg: '진행 중인 레이드가 없습니다.' });
    }

    const participant = getRaidParticipant(activeBattle, userId);
    if (!participant) {
      return res.status(403).json({ msg: '현재 레이드 참가자가 아닙니다.' });
    }

    const participantCardEntries = getParticipantCardEntries(participant);
    const normalizedCardSlot = Math.max(0, Math.min(participantCardEntries.length - 1, Math.floor(Number(cardSlot) || 0)));
    const card = getParticipantCard(participant, normalizedCardSlot);
    if (!card) {
      return res.status(400).json({ msg: '장착한 카드가 없습니다.' });
    }
    if (card.passiveOnly) {
      return res.status(400).json({ msg: '이 카드는 액티브 스킬이 없습니다.' });
    }
    if (useSkill && card.oncePerBattle && participant.potatoRehabUsed) {
      return res.status(400).json({ msg: '이 카드는 이번 전투에서 이미 사용했습니다.' });
    }

    if ((card.targetType === 'ally' || card.targetType === 'ally_pair') && targetUserId) {
      const selectableTargets = getSelectableRaidTargets(activeBattle);
      if (!selectableTargets.includes(String(targetUserId))) {
        return res.status(400).json({ msg: '선택할 수 없는 대상입니다.' });
      }
      participant.plannedTargetUserId = String(targetUserId);
      if (card.targetType === 'ally_pair' && targetUserId2) {
        if (!selectableTargets.includes(String(targetUserId2))) {
          return res.status(400).json({ msg: '두 번째 대상이 올바르지 않습니다.' });
        }
        participant.plannedTargetUserId2 = String(targetUserId2);
      }
    }

    if (useSkill && card.targetType === 'ally' && !participant.plannedTargetUserId) {
      return res.status(400).json({ msg: '버프를 줄 파티원을 먼저 선택해주세요.' });
    }
    if (useSkill && card.targetType === 'ally_pair') {
      if (!participant.plannedTargetUserId || !participant.plannedTargetUserId2) {
        return res.status(400).json({ msg: '두 명의 파티원을 먼저 선택해주세요.' });
      }
    }

    participant.plannedSkill = Boolean(useSkill);
    participant.plannedCardSlot = useSkill ? normalizedCardSlot : null;
    bumpRaidVersion();
    res.json({ raid: buildRaidBattleSnapshot(activeBattle, userId) });
  } catch (err) {
    console.error('Raid skill plan error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/raid/set-target', async (req, res) => {
  const { userId, targetUserId, targetSlot, cardSlot } = req.body;
  if (!userId || !targetUserId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });

  try {
    await advanceRaidState(new Date());
    const located = findRaidRoomWithParticipant(userId);
    const activeBattle = located?.room?.activeBattle;
    if (!activeBattle || activeBattle.phase === 'finished') {
      return res.status(400).json({ msg: '진행 중인 레이드가 없습니다.' });
    }

    const participant = getRaidParticipant(activeBattle, userId);
    if (!participant) {
      return res.status(403).json({ msg: '현재 레이드 참가자가 아닙니다.' });
    }

    const participantCardEntries = getParticipantCardEntries(participant);
    const normalizedCardSlot = Math.max(0, Math.min(participantCardEntries.length - 1, Math.floor(Number(cardSlot ?? participant.plannedCardSlot ?? 0) || 0)));
    const card = getParticipantCard(participant, normalizedCardSlot);
    if (!card || !['ally', 'ally_pair'].includes(card.targetType)) {
      return res.status(400).json({ msg: '대상을 선택하는 스킬이 아닙니다.' });
    }

    participant.plannedCardSlot = normalizedCardSlot;
    const selectableTargets = getSelectableRaidTargets(activeBattle);
    if (!selectableTargets.includes(String(targetUserId))) {
      return res.status(400).json({ msg: '선택할 수 없는 대상입니다.' });
    }

    const slotNumber = Number(targetSlot || 1);
    if (slotNumber === 1) {
      participant.plannedTargetUserId = String(targetUserId);
    } else if (slotNumber === 2 && card.targetType === 'ally_pair') {
      participant.plannedTargetUserId2 = String(targetUserId);
    } else {
      return res.status(400).json({ msg: '올바르지 않은 대상 슬롯입니다.' });
    }

    bumpRaidVersion();
    res.json({ raid: buildRaidBattleSnapshot(activeBattle, userId) });
  } catch (err) {
    console.error('Raid target set error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/infinite-overtime/state', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    ensureUserDefaults(user);
    res.json({ infiniteOvertime: await buildInfiniteOvertimeStateResponse(user, new Date()) });
  } catch (err) {
    console.error('Infinite overtime state error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/infinite-overtime/defense-preset', async (req, res) => {
  const { userId, deck } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const response = await withUserMutationLock(userId, async () => {
      const user = await User.findById(userId);
      if (!user) throw createHttpError(404, '사용자를 찾을 수 없습니다.');
      ensureUserDefaults(user);
      const now = new Date();
      if (Number(user.gameState?.level || 1) < INFINITE_OVERTIME_MIN_LEVEL) {
        throw createHttpError(400, `무한야근은 ${INFINITE_OVERTIME_MIN_LEVEL}레벨부터 입장할 수 있습니다.`);
      }
      const { scoreMap } = await buildInfiniteOvertimeScoreMap();
      const scoreInfo = scoreMap.get(String(user._id)) || {};
      const targetScore = getInfiniteOvertimeDefenseScoreFromRanks(scoreInfo.pvpRank, scoreInfo.levelRank);
      const preset = validateInfiniteOvertimeDefenseDeck(user, deck, targetScore);
      user.infiniteOvertime.defensePreset = preset;
      user.infiniteOvertime.defenseScore = getInfiniteOvertimeDeckScore(preset);
      user.markModified('infiniteOvertime');
      await persistUserSnapshot(user);
      bumpInfiniteOvertimeVersion();
      return buildInfiniteOvertimeUserPayload(user, now);
    });
    res.json(response);
  } catch (err) {
    if (err?.statusCode) return res.status(err.statusCode).json({ msg: err.message });
    console.error('Infinite overtime defense preset error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/infinite-overtime/draft-pick', async (req, res) => {
  const { userId, cardId, enhancementLevel } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const response = await withUserMutationLock(userId, async () => {
      const user = await User.findById(userId);
      if (!user) throw createHttpError(404, '사용자를 찾을 수 없습니다.');
      ensureUserDefaults(user);
      if (Number(user.gameState?.level || 1) < INFINITE_OVERTIME_MIN_LEVEL) {
        throw createHttpError(400, `무한야근은 ${INFINITE_OVERTIME_MIN_LEVEL}레벨부터 입장할 수 있습니다.`);
      }
      if (user.infiniteOvertime?.active) {
        throw createHttpError(400, '진행 중인 무한야근 도전 중에는 공략 덱 후보를 다시 선택할 수 없습니다.');
      }
      if (getInfiniteOvertimeCooldownRemainingMs(user, new Date()) > 0) {
        throw createHttpError(400, '아직 무한야근 재도전 시간이 아닙니다.');
      }
      const defensePreset = normalizeInfiniteOvertimeDeck(user.infiniteOvertime?.defensePreset || []);
      if (defensePreset.length !== 5) {
        throw createHttpError(400, '먼저 방어 Bot 프리셋을 등록해주세요.');
      }
      pickInfiniteOvertimeAttackDraftCard(user, cardId, enhancementLevel);
      return buildInfiniteOvertimeUserPayload(user, new Date());
    });
    res.json(response);
  } catch (err) {
    if (err?.statusCode) return res.status(err.statusCode).json({ msg: err.message });
    console.error('Infinite overtime draft pick error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/infinite-overtime/start', async (req, res) => {
  const { userId, deck } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const response = await withUserMutationLock(userId, async () => {
      const user = await User.findById(userId);
      if (!user) throw createHttpError(404, '사용자를 찾을 수 없습니다.');
      ensureUserDefaults(user);
      const now = new Date();
      if (Number(user.gameState?.level || 1) < INFINITE_OVERTIME_MIN_LEVEL) {
        throw createHttpError(400, `무한야근은 ${INFINITE_OVERTIME_MIN_LEVEL}레벨부터 입장할 수 있습니다.`);
      }
      const defensePreset = normalizeInfiniteOvertimeDeck(user.infiniteOvertime?.defensePreset || []);
      if (defensePreset.length !== 5) {
        throw createHttpError(400, '먼저 방어 Bot 프리셋을 등록해주세요.');
      }

      const existingBattle = getInfiniteOvertimeBattle(userId);
      if (existingBattle && existingBattle.phase === 'active') {
        return buildInfiniteOvertimeUserPayload(user, now);
      }

      if (!user.infiniteOvertime.active) {
        const cooldownRemainingMs = getInfiniteOvertimeCooldownRemainingMs(user, now);
        if (cooldownRemainingMs > 0) {
          throw createHttpError(400, '아직 무한야근 재도전 시간이 아닙니다.');
        }
        const draft = getOrCreateInfiniteOvertimeAttackDraft(user);
        const requestedDeck = normalizeInfiniteOvertimeDeck(deck || []);
        const attackDeck = requestedDeck.length === 5 ? requestedDeck : draft.deck;
        user.infiniteOvertime.attackDeck = validateInfiniteOvertimeAttackDeck(user, attackDeck);
        user.infiniteOvertime.active = true;
        user.infiniteOvertime.nextFloor = 1;
        user.infiniteOvertime.lastAttemptAt = now;
        user.infiniteOvertime.lastCompletedAt = null;
        clearInfiniteOvertimeAttackDraft(userId);
      } else if (normalizeInfiniteOvertimeDeck(user.infiniteOvertime.attackDeck || []).length !== 5) {
        throw createHttpError(400, '공략용 카드 5장을 먼저 선택해주세요.');
      }

      const floor = Math.max(1, Math.min(INFINITE_OVERTIME_MAX_FLOOR, Number(user.infiniteOvertime.nextFloor || 1)));
      user.markModified('infiniteOvertime');
      await persistUserSnapshot(user);
      await startInfiniteOvertimeBattleForUser(user, floor, now);
      return buildInfiniteOvertimeUserPayload(user, now);
    });
    res.json(response);
  } catch (err) {
    if (err?.statusCode) return res.status(err.statusCode).json({ msg: err.message });
    console.error('Infinite overtime start error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/infinite-overtime/action', async (req, res) => {
  const { userId, cardIndex, actionType } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const response = await withUserMutationLock(userId, async () => {
      const user = await User.findById(userId);
      if (!user) throw createHttpError(404, '사용자를 찾을 수 없습니다.');
      ensureUserDefaults(user);
      const basicOnly = actionType === 'basic' || cardIndex === null || cardIndex === undefined || cardIndex === '';
      const parsedIndex = basicOnly ? null : Number(cardIndex);
      await executeInfiniteOvertimePlayerAction(user, Number.isInteger(parsedIndex) ? parsedIndex : null, { basicOnly });
      user.markModified('infiniteOvertime');
      await persistUserSnapshot(user);
      bumpInfiniteOvertimeVersion();
      return buildInfiniteOvertimeUserPayload(user, new Date());
    });
    res.json(response);
  } catch (err) {
    if (err?.statusCode) return res.status(err.statusCode).json({ msg: err.message });
    console.error('Infinite overtime action error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/infinite-overtime/swap', async (req, res) => {
  const { userId, skip, optionCardId, replaceIndex } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const response = await withUserMutationLock(userId, async () => {
      const user = await User.findById(userId);
      if (!user) throw createHttpError(404, '사용자를 찾을 수 없습니다.');
      ensureUserDefaults(user);
      const battle = getInfiniteOvertimeBattle(userId);
      if (!battle || battle.phase !== 'swap') {
        throw createHttpError(400, '진행 중인 카드 교환 이벤트가 없습니다.');
      }

      if (!skip) {
        const option = normalizeInfiniteOvertimeDeck(battle.swapOptions || []).find((entry) => entry.cardId === String(optionCardId));
        const index = Math.floor(Number(replaceIndex));
        const attackDeck = normalizeInfiniteOvertimeDeck(user.infiniteOvertime.attackDeck || []);
        if (!option) throw createHttpError(400, '선택할 수 없는 카드입니다.');
        if (!Number.isInteger(index) || index < 0 || index >= attackDeck.length) {
          throw createHttpError(400, '교체할 카드를 선택해주세요.');
        }
        attackDeck[index] = {
          cardId: option.cardId,
          enhancementLevel: normalizeCardEnhancementLevel(option.enhancementLevel || 0)
        };
        user.infiniteOvertime.attackDeck = attackDeck;
        battle.logs.push(`${getCardDisplayName(option.cardId, option.enhancementLevel)} 카드로 덱을 교체했습니다.`);
      } else {
        battle.logs.push('카드 교환을 하지 않고 진행합니다.');
      }

      battle.swapResolved = true;
      await finishInfiniteOvertimeVictory(user, battle, { skipSwap: true });
      if (battle.phase === 'victory') {
        const nextFloor = Math.min(INFINITE_OVERTIME_MAX_FLOOR, Number(battle.floor || 1) + 1);
        user.infiniteOvertime.active = Number(battle.floor || 1) < INFINITE_OVERTIME_MAX_FLOOR;
        user.infiniteOvertime.nextFloor = nextFloor;
      }
      user.markModified('infiniteOvertime');
      await persistUserSnapshot(user);
      bumpInfiniteOvertimeVersion();
      return buildInfiniteOvertimeUserPayload(user, new Date());
    });
    res.json(response);
  } catch (err) {
    if (err?.statusCode) return res.status(err.statusCode).json({ msg: err.message });
    console.error('Infinite overtime swap error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/infinite-overtime/continue', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const response = await withUserMutationLock(userId, async () => {
      const user = await User.findById(userId);
      if (!user) throw createHttpError(404, '사용자를 찾을 수 없습니다.');
      ensureUserDefaults(user);
      const battle = getInfiniteOvertimeBattle(userId);
      if (battle && !['victory', 'defeat'].includes(battle.phase)) {
        throw createHttpError(400, '현재 전투를 먼저 마무리해주세요.');
      }
      if (!user.infiniteOvertime.active) {
        throw createHttpError(400, '이어갈 무한야근 도전이 없습니다.');
      }
      let floor = Math.max(1, Math.min(INFINITE_OVERTIME_MAX_FLOOR, Number(user.infiniteOvertime.nextFloor || 1)));
      if (battle?.phase === 'victory') {
        floor = Math.max(floor, Math.min(INFINITE_OVERTIME_MAX_FLOOR, Number(battle.floor || 1) + 1));
        user.infiniteOvertime.nextFloor = floor;
        user.markModified('infiniteOvertime');
        await persistUserSnapshot(user);
      }
      setInfiniteOvertimeBattle(userId, null);
      await startInfiniteOvertimeBattleForUser(user, floor, new Date());
      return buildInfiniteOvertimeUserPayload(user, new Date());
    });
    res.json(response);
  } catch (err) {
    if (err?.statusCode) return res.status(err.statusCode).json({ msg: err.message });
    console.error('Infinite overtime continue error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/infinite-overtime/exit', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const response = await withUserMutationLock(userId, async () => {
      const user = await User.findById(userId);
      if (!user) throw createHttpError(404, '사용자를 찾을 수 없습니다.');
      ensureUserDefaults(user);
      const battle = getInfiniteOvertimeBattle(userId);
      if (battle && !['victory', 'defeat'].includes(battle.phase)) {
        throw createHttpError(400, '전투 중에는 메인화면으로 돌아갈 수 없습니다.');
      }
      setInfiniteOvertimeBattle(userId, null);
      await persistUserSnapshot(user);
      return buildInfiniteOvertimeUserPayload(user, new Date());
    });
    res.json(response);
  } catch (err) {
    if (err?.statusCode) return res.status(err.statusCode).json({ msg: err.message });
    console.error('Infinite overtime exit error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/pvp/state', async (req, res) => {
  const { userId, viewing, mode } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const user = await getCachedPollUserSnapshot(
      userId,
      'nickname username gameState.level cards enhancedCards equippedCardId equippedCardLevel meta.potatoRehabDamage meta.potatoRehabKillCount'
    );
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    user.gameState = user.gameState || {};
    user.gameState.level = Number(user.gameState.level || 1);
    user.cards = Array.isArray(user.cards) ? user.cards : [];
    user.enhancedCards = Array.isArray(user.enhancedCards) ? user.enhancedCards : [];
    user.meta = user.meta || {};

    const now = new Date();
    const pvpMode = normalizePvpMode(mode);
    const modeState = getPvpModeState(pvpMode);
    const activePvp = modeState.match || modeState.battle;
    const isParticipant = activePvp?.players?.some((player) => player.userId === String(userId));
    if (viewing && activePvp && !isParticipant) {
      registerViewer(modeState.viewers, user, now);
    } else {
      pruneViewerMap(modeState.viewers, now);
    }
    const pvp = await buildPvpStateResponse(user, now, pvpMode, { poll: true });
    res.json({ pvp });
  } catch (err) {
    console.error('PVP state error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/pvp/queue', async (req, res) => {
  const { userId, mode } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const now = new Date();
    await advancePvpState(now);
    const pvpMode = normalizePvpMode(mode);
    const modeState = getPvpModeState(pvpMode);
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    ensureUserDefaults(user);

    if (!isPracticePvpMode(pvpMode) && user.gameState.level < PVP_MIN_LEVEL) {
      return res.status(400).json({ msg: '개인면담 입장은 50레벨부터 가능합니다.' });
    }
    if (modeState.battle || modeState.match) {
      const activePvp = modeState.battle || modeState.match;
      if (activePvp?.players?.some((player) => player.userId === String(userId))) {
        return res.json({ pvp: await buildPvpStateResponse(user, now, pvpMode) });
      }
      return res.status(400).json({ msg: `이미 ${getPvpModeLabel(pvpMode)} 개인면담이 진행 중입니다. 관전으로 참여해주세요.` });
    }
    if (isUserInAnyPvpSession(userId)) {
      return res.json({ pvp: await buildPvpStateResponse(user, now, pvpMode) });
    }

    const entry = createPvpQueueEntry(user);
    if (isPracticePvpMode(pvpMode)) {
      startPvpPracticeMatch(modeState, entry, now);
      return res.json({ pvp: await buildPvpStateResponse(user, now, pvpMode) });
    }

    if (isAugmentPvpMode(pvpMode)) {
      modeState.queue.push(entry);
      if (modeState.queue.length >= PVP_AUGMENT_QUEUE_SIZE) {
        const players = modeState.queue.splice(0, PVP_AUGMENT_QUEUE_SIZE);
        startPvpAugmentMatch(modeState, players, now);
      } else {
        bumpPvpVersion();
      }
      return res.json({ pvp: await buildPvpStateResponse(user, now, pvpMode) });
    }

    const opponentIndex = modeState.queue.findIndex((queued) => queued.userId !== entry.userId);
    if (opponentIndex >= 0) {
      const opponent = modeState.queue.splice(opponentIndex, 1)[0];
      startPvpAcceptMatch(modeState, pvpMode, opponent, entry, now);
    } else {
      modeState.queue.push(entry);
      bumpPvpVersion();
    }

    res.json({ pvp: await buildPvpStateResponse(user, now, pvpMode) });
  } catch (err) {
    console.error('PVP queue error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/pvp/augment-pick', async (req, res) => {
  const { userId, cardIds, swapOutCardId, mode } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });
  try {
    const now = new Date();
    const pvpMode = normalizePvpMode(mode);
    const modeState = getPvpModeState(pvpMode);
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    ensureUserDefaults(user);
    await advancePvpState(now);
    const match = modeState.match;
    if (!match || !isAugmentPvpMode(match.mode) || match.phase !== 'augment_pick') {
      return sendPvpStateError(res, user, now, 400, '진행 중인 증강 2대2 픽 단계가 없습니다.', pvpMode);
    }
    const player = getPvpPlayer(match, userId);
    if (!player) return sendPvpStateError(res, user, now, 403, '증강 2대2 참가자가 아닙니다.', pvpMode);
    const candidates = Array.isArray(match.candidates?.[String(userId)]) ? match.candidates[String(userId)] : [];
    const candidateMap = new Map(candidates.map((entry) => [entry.cardId, entry]));
    const requested = Array.isArray(cardIds) ? cardIds.map((id) => String(id || '')).filter(Boolean) : [];
    if (requested.length) {
      const unique = [...new Set(requested)].filter((cardId) => candidateMap.has(cardId)).slice(0, PVP_AUGMENT_PICK_COUNT);
      if (unique.length !== PVP_AUGMENT_PICK_COUNT) {
        return sendPvpStateError(res, user, now, 400, '후보 5장 중 3장을 선택해주세요.', pvpMode);
      }
      match.picks[String(userId)] = unique.map((cardId) => ({ cardId, enhancementLevel: candidateMap.get(cardId).enhancementLevel ?? 5 }));
      const leftover = candidates.find((candidate) => !unique.includes(candidate.cardId));
      if (leftover) match.leftovers[String(userId)] = { cardId: leftover.cardId, enhancementLevel: leftover.enhancementLevel ?? 5 };
      match.pickDone[String(userId)] = true;
      match.logs.push(`${player.displayName}이(가) 증강 2대2 카드를 선택했습니다.`);
    } else if (swapOutCardId) {
      const leftover = match.leftovers?.[String(userId)];
      const picks = Array.isArray(match.picks?.[String(userId)]) ? match.picks[String(userId)] : [];
      const index = picks.findIndex((pick) => pick.cardId === String(swapOutCardId));
      if (!leftover || index < 0) return sendPvpStateError(res, user, now, 400, '교체할 수 있는 카드가 없습니다.', pvpMode);
      const previous = picks[index];
      picks[index] = { cardId: leftover.cardId, enhancementLevel: leftover.enhancementLevel ?? 5 };
      match.leftovers[String(userId)] = previous;
      match.logs.push(`${player.displayName}이(가) 남은 후보 카드로 교체했습니다.`);
    }
    bumpPvpVersion();
    res.json({ pvp: await buildPvpStateResponse(user, now, pvpMode) });
  } catch (err) {
    console.error('PVP augment pick error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/pvp/augment-select', async (req, res) => {
  const { userId, augmentId, mode } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });
  try {
    const now = new Date();
    const pvpMode = normalizePvpMode(mode);
    const modeState = getPvpModeState(pvpMode);
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    ensureUserDefaults(user);
    await advancePvpState(now);
    const battle = modeState.battle;
    if (!battle || !isAugmentPvpMode(battle.mode) || battle.phase !== 'augment') {
      return sendPvpStateError(res, user, now, 400, '현재 증강 선택 단계가 아닙니다.', pvpMode);
    }
    const player = getPvpPlayer(battle, userId);
    if (!player) return sendPvpStateError(res, user, now, 403, '증강 2대2 참가자가 아닙니다.', pvpMode);
    if (!getAugmentOptionsForPlayer(player).some((entry) => entry.id === augmentId)) {
      return sendPvpStateError(res, user, now, 400, '선택할 수 없는 증강입니다.', pvpMode);
    }
    battle.augmentSelected[String(userId)] = augmentId;
    if (allAugmentSelectionsResolved(battle)) finishAugmentSelectionRound(battle, now);
    bumpPvpVersion();
    res.json({ pvp: await buildPvpStateResponse(user, now, pvpMode) });
  } catch (err) {
    console.error('PVP augment select error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/pvp/augment-action', async (req, res) => {
  const { userId, type, cardIndex, targetUserId, mode } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });
  try {
    const now = new Date();
    const pvpMode = normalizePvpMode(mode);
    const modeState = getPvpModeState(pvpMode);
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    ensureUserDefaults(user);
    await advancePvpState(now);
    const battle = modeState.battle;
    if (!battle || !isAugmentPvpMode(battle.mode) || battle.phase !== 'active') {
      return sendPvpStateError(res, user, now, 400, '진행 중인 증강 2대2 전투가 없습니다.', pvpMode);
    }
    const player = getPvpPlayer(battle, userId);
    if (!player) return sendPvpStateError(res, user, now, 403, '증강 2대2 참가자가 아닙니다.', pvpMode);
    player.pendingAction = type === 'skill'
      ? { type: 'skill', cardIndex: Number(cardIndex), targetUserId: String(targetUserId || '') }
      : { type: 'basic', targetUserId: String(targetUserId || '') };
    if (battle.currentUserId === String(userId)) {
      const currentUserId = String(userId);
      const existingExecuteAtMs = battle.pendingActionUserId === currentUserId
        ? new Date(battle.pendingActionExecuteAt || 0).getTime()
        : 0;
      battle.pendingActionUserId = currentUserId;
      if (!existingExecuteAtMs || !Number.isFinite(existingExecuteAtMs)) {
        battle.pendingActionExecuteAt = new Date(now.getTime() + PVP_AUGMENT_RESERVED_ACTION_FRAME_MS);
      }
      const currentTurnEndMs = new Date(battle.turnEndsAt || now).getTime() || now.getTime();
      battle.turnEndsAt = new Date(Math.max(currentTurnEndMs, new Date(battle.pendingActionExecuteAt).getTime()));
      bumpPvpVersion();
    } else {
      battle.logs.push(`${player.displayName}이(가) 다음 자신의 차례 행동을 예약했습니다.`);
      bumpPvpVersion();
    }
    res.json({ pvp: await buildPvpStateResponse(user, now, pvpMode) });
  } catch (err) {
    console.error('PVP augment action error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/pvp/accept', async (req, res) => {
  const { userId, accept, mode } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const now = new Date();
    await advancePvpState(now);
    const pvpMode = normalizePvpMode(mode);
    const modeState = getPvpModeState(pvpMode);
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    ensureUserDefaults(user);

    const match = modeState.match;
    if (!match || match.phase !== 'accept' || !getPvpPlayer(match, userId)) {
      return res.status(400).json({ msg: '수락할 개인면담 매칭이 없습니다.' });
    }

    if (!accept) {
      match.players.forEach((player) => removePvpQueueUser(player.userId));
      modeState.match = null;
      bumpPvpVersion();
      return res.json({ pvp: await buildPvpStateResponse(user, now, pvpMode) });
    }

    match.accepted[String(userId)] = true;
    if (match.players.every((player) => match.accepted[player.userId])) {
      if (isRankedPvpMode(match.mode)) {
        match.phase = 'ban';
        match.turnUserId = match.players[0].userId;
        match.turnEndsAt = new Date(now.getTime() + PVP_BAN_TURN_MS);
        match.logs.push('랭크 밴픽을 시작합니다. 먼저 각자 3장씩 금지합니다.');
      } else {
        startPvpPickPhase(match, now);
        match.logs.push('일반전 카드 선택을 시작합니다. 밴 없이 픽만 진행합니다.');
      }
    }
    bumpPvpVersion();
    res.json({ pvp: await buildPvpStateResponse(user, now, pvpMode) });
  } catch (err) {
    console.error('PVP accept error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/pvp/ban', async (req, res) => {
  const { userId, cardId, matchId, phase, mode } = req.body;
  if (!userId || !cardId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });

  try {
    const now = new Date();
    const pvpMode = normalizePvpMode(mode);
    const modeState = getPvpModeState(pvpMode);
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    ensureUserDefaults(user);
    let match = modeState.match;
    if (!match || match.phase !== 'ban') {
      await advancePvpState(now);
      match = modeState.match;
    }
    if (!match || match.phase !== 'ban') return sendPvpStateError(res, user, now, 400, '현재 금지 단계가 아닙니다.', pvpMode);
    if (matchId && match.matchId !== matchId) return sendPvpStateError(res, user, now, 400, '이미 지난 개인면담 선택입니다. 화면을 다시 확인해주세요.', pvpMode);
    if (phase && phase !== 'ban') return sendPvpStateError(res, user, now, 400, '이미 지난 금지 요청입니다. 화면을 다시 확인해주세요.', pvpMode);
    if (match.turnUserId !== String(userId)) return sendPvpStateError(res, user, now, 400, '아직 내 차례가 아닙니다.', pvpMode);
    if (isPvpDraftTurnTimedOut(match, now, PVP_DRAFT_SUBMIT_GRACE_MS)) {
      await advancePvpState(now);
      return sendPvpStateError(res, user, now, 400, '시간이 초과되어 자동 진행되었습니다.', pvpMode);
    }
    if (!CARD_DATA[cardId]) return sendPvpStateError(res, user, now, 400, '존재하지 않는 카드입니다.', pvpMode);
    if (CARD_DATA[cardId].pvpDisabled) return sendPvpStateError(res, user, now, 400, '개인면담에서 사용할 수 없는 카드입니다.', pvpMode);
    if (getPvpBannedCardIds(match).includes(cardId) || getPvpPickedCardIds(match).includes(cardId)) {
      return sendPvpStateError(res, user, now, 400, '이미 선택할 수 없는 카드입니다.', pvpMode);
    }
    if ((match.bans[String(userId)] || []).length >= PVP_BANS_PER_PLAYER) {
      return sendPvpStateError(res, user, now, 400, '이미 금지할 카드를 모두 골랐습니다.', pvpMode);
    }

    match.bans[String(userId)].push(cardId);
    match.logs.push(`${getPvpPlayer(match, userId).displayName}이(가) ${CARD_DATA[cardId].name}을(를) 금지했습니다.`);
    if (match.players.every((player) => (match.bans[player.userId] || []).length >= PVP_BANS_PER_PLAYER)) {
      startPvpPickPhase(match, now);
    } else {
      advancePvpDraftTurn(match, now);
    }
    bumpPvpVersion();
    res.json({ pvp: await buildPvpStateResponse(user, now, pvpMode) });
  } catch (err) {
    console.error('PVP ban error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/pvp/pick', async (req, res) => {
  const { userId, cardId, enhancementLevel, matchId, phase, mode } = req.body;
  if (!userId || !cardId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });

  try {
    const now = new Date();
    const pvpMode = normalizePvpMode(mode);
    const modeState = getPvpModeState(pvpMode);
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    ensureUserDefaults(user);
    let match = modeState.match;
    if (!match || match.phase !== 'pick') {
      await advancePvpState(now);
      match = modeState.match;
    }
    if (!match || match.phase !== 'pick') return sendPvpStateError(res, user, now, 400, '현재 선택 단계가 아닙니다.', pvpMode);
    if (matchId && match.matchId !== matchId) return sendPvpStateError(res, user, now, 400, '이미 지난 개인면담 선택입니다. 화면을 다시 확인해주세요.', pvpMode);
    if (phase && phase !== 'pick') return sendPvpStateError(res, user, now, 400, '이미 지난 선택 요청입니다. 화면을 다시 확인해주세요.', pvpMode);
    if (match.turnUserId !== String(userId)) return sendPvpStateError(res, user, now, 400, '아직 내 차례가 아닙니다.', pvpMode);
    if (isPvpDraftTurnTimedOut(match, now, PVP_DRAFT_SUBMIT_GRACE_MS)) {
      await advancePvpState(now);
      return sendPvpStateError(res, user, now, 400, '시간이 초과되어 자동 진행되었습니다.', pvpMode);
    }
    if (!CARD_DATA[cardId]) return sendPvpStateError(res, user, now, 400, '존재하지 않는 카드입니다.', pvpMode);
    if (CARD_DATA[cardId].pvpDisabled) return sendPvpStateError(res, user, now, 400, '개인면담에서 사용할 수 없는 카드입니다.', pvpMode);
    if (getPvpBannedCardIds(match).includes(cardId) || getPvpPickedCardIds(match).includes(cardId)) {
      return sendPvpStateError(res, user, now, 400, '이미 선택할 수 없는 카드입니다.', pvpMode);
    }
    const level = normalizeCardEnhancementLevel(enhancementLevel || 0);
    const pickableCard = getOwnedPvpPickCards(user).find((card) => card.cardId === cardId);
    if (!pickableCard || Number(pickableCard.enhancementLevel || 0) !== level) {
      return sendPvpStateError(res, user, now, 400, '개인면담에서는 보유 중인 가장 높은 강화 단계 카드만 선택할 수 있습니다.', pvpMode);
    }
    if ((match.picks[String(userId)] || []).length >= PVP_PICKS_PER_PLAYER) {
      return sendPvpStateError(res, user, now, 400, '이미 카드를 모두 선택했습니다.', pvpMode);
    }

    match.pickDone = match.pickDone || {};
    match.picks[String(userId)].push({ cardId, enhancementLevel: level });
    match.logs.push(`${getPvpPlayer(match, userId).displayName}이(가) ${getCardDisplayName(cardId, level)}을(를) 선택했습니다.`);
    if ((match.picks[String(userId)] || []).length >= PVP_PICKS_PER_PLAYER) {
      match.pickDone[String(userId)] = true;
    }
    if (isPvpPickPhaseComplete(match)) {
      startPvpBattleCountdown(match, now);
    } else {
      advancePvpDraftTurn(match, now);
    }
    bumpPvpVersion();
    res.json({ pvp: await buildPvpStateResponse(user, now, pvpMode) });
  } catch (err) {
    console.error('PVP pick error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/pvp/bet', async (req, res) => {
  const { userId, targetUserId, amount, mode } = req.body;
  if (!userId || !targetUserId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });

  const betAmount = Math.floor(Number(amount) || 0);
  if (betAmount <= 0) return res.status(400).json({ msg: '배팅 금액을 입력해주세요.' });

  try {
    const now = new Date();
    await advancePvpState(now);
    const pvpMode = normalizePvpMode(mode);
    const modeState = getPvpModeState(pvpMode);
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    ensureUserDefaults(user);

    if (!isRankedPvpMode(pvpMode)) {
      return sendPvpStateError(res, user, now, 400, '배팅은 랭크 개인면담에서만 가능합니다.', pvpMode);
    }

    const match = modeState.match;
    if (!match || !['ban', 'pick'].includes(match.phase)) {
      return sendPvpStateError(res, user, now, 400, '배팅은 밴픽이 끝나기 전까지만 가능합니다.', pvpMode);
    }
    if (match.players.some((player) => player.userId === String(userId))) {
      return sendPvpStateError(res, user, now, 400, '참가자는 배팅할 수 없습니다.', pvpMode);
    }
    const target = match.players.find((player) => player.userId === String(targetUserId));
    if (!target) return sendPvpStateError(res, user, now, 400, '배팅할 대상을 찾을 수 없습니다.', pvpMode);
    match.bets = match.bets || {};
    if (match.bets[String(userId)]) {
      return sendPvpStateError(res, user, now, 400, '이번 개인면담에는 이미 배팅했습니다.', pvpMode);
    }
    if (user.gameState.money < betAmount) {
      return sendPvpStateError(res, user, now, 400, '보유 금액이 부족합니다.', pvpMode);
    }

    user.gameState.money -= betAmount;
    match.bets[String(userId)] = {
      userId: String(userId),
      displayName: getCompactNickname(user, 18),
      targetUserId: String(targetUserId),
      targetDisplayName: target.displayName,
      amount: betAmount,
      createdAt: now
    };
    match.logs.push(`${user.nickname || user.username}님이 승부 예측 배팅을 등록했습니다.`);
    await persistUserSnapshot(user);
    bumpPvpVersion();

    res.json({
      user: buildGameStateResponse(user, now),
      notifications: consumeNotifications(user),
      pvp: await buildPvpStateResponse(user, now, pvpMode),
      adminMailPendingCount: await getPendingAdminMailCount(user._id, now)
    });
  } catch (err) {
    console.error('PVP bet error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/pvp/plan-skill', async (req, res) => {
  const { userId, cardIndex, mode } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const now = new Date();
    await advancePvpState(now);
    const pvpMode = normalizePvpMode(mode);
    const modeState = getPvpModeState(pvpMode);
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    ensureUserDefaults(user);
    const battle = modeState.battle;
    if (!battle || battle.phase !== 'active') return res.status(400).json({ msg: '진행 중인 개인면담이 없습니다.' });
    const player = getPvpPlayer(battle, userId);
    if (!player) return res.status(403).json({ msg: '개인면담 참가자가 아닙니다.' });

    const index = Number(cardIndex);
    if (!Number.isInteger(index) || index < 0 || index >= player.cards.length) {
      player.plannedCardIndex = null;
    } else {
      player.plannedCardIndex = index;
    }

    if (battle.currentUserId === String(userId)) {
      await executePvpTurn(battle, now);
    } else {
      bumpPvpVersion();
    }
    res.json({ pvp: await buildPvpStateResponse(user, now, pvpMode) });
  } catch (err) {
    console.error('PVP skill plan error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/pvp/end-turn', async (req, res) => {
  const { userId, mode } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const now = new Date();
    await advancePvpState(now);
    const pvpMode = normalizePvpMode(mode);
    const modeState = getPvpModeState(pvpMode);
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    ensureUserDefaults(user);
    const battle = modeState.battle;
    if (!battle || battle.phase !== 'active') return res.status(400).json({ msg: '진행 중인 개인면담이 없습니다.' });
    const player = getPvpPlayer(battle, userId);
    if (!player) return res.status(403).json({ msg: '개인면담 참가자가 아닙니다.' });
    if (battle.currentUserId !== String(userId)) return res.status(400).json({ msg: '아직 내 차례가 아닙니다.' });

    player.plannedCardIndex = null;
    await executePvpTurn(battle, now);
    res.json({ pvp: await buildPvpStateResponse(user, now, pvpMode) });
  } catch (err) {
    console.error('PVP end turn error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/pvp/cancel', async (req, res) => {
  const { userId, mode } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const pvpMode = normalizePvpMode(mode);
    const modeState = getPvpModeState(pvpMode);
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    removePvpQueueUser(userId, modeState);
    if (modeState.match?.phase === 'accept' && getPvpPlayer(modeState.match, userId)) {
      modeState.match.players.forEach((player) => removePvpQueueUser(player.userId));
      modeState.match = null;
    }
    if (isPracticePvpMode(pvpMode)) {
      if (modeState.match && getPvpPlayer(modeState.match, userId)) {
        modeState.match = null;
      }
      if (modeState.battle && getPvpPlayer(modeState.battle, userId)) {
        modeState.battle = null;
        modeState.viewers = {};
      }
    }
    bumpPvpVersion();
    res.json({ pvp: await buildPvpStateResponse(user, new Date(), pvpMode) });
  } catch (err) {
    console.error('PVP cancel error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/action/shout', async (req, res) => {
  const { userId, message } = req.body;
  if (!userId || !message) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });

  const shoutMessage = String(message).replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!shoutMessage) return res.status(400).json({ msg: '외칠 내용을 입력해주세요.' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    calculateOfflineGains(user, now);

    const dailyAugmentStats = getDailyAugmentEffectTotals(user, now);
    const hasShoutNoCooldown = Number(dailyAugmentStats.shoutNoCooldown || 0) > 0 || hasShoutNoCooldownTicket(user, now);
    if (!hasShoutNoCooldown && user.meta.lastShoutAt && now.getTime() - new Date(user.meta.lastShoutAt).getTime() < SHOUT_COOLDOWN_MS) {
      return res.status(400).json({ msg: '외치기는 10분마다 한 번만 사용할 수 있습니다.' });
    }

    if (!hasShoutNoCooldown) user.meta.lastShoutAt = now;
    pushShoutMessage(shoutMessage, now);


    const response = await buildUserResponseWithGlobals(user, now);
    await persistUserSnapshot(user);
    res.json(response);
  } catch (err) {
    console.error('Shout action error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/sync', async (req, res) => {
  const { userId, includeCounts } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const shouldIncludePendingCounts = includeCounts === true;
    const cachedSyncResponse = shouldIncludePendingCounts ? null : getSyncResponseCache(userId);
    if (cachedSyncResponse) return res.json(cachedSyncResponse);

    const response = await withUserMutationLock(userId, async () => {
      const user = await User.findById(userId).select(SYNC_USER_SELECT_FIELDS);
      if (!user) {
        throw createHttpError(404, '사용자를 찾을 수 없습니다.');
      }

      const now = new Date();
      calculateOfflineGains(user, now);
      reconcileTitles(user, now);
      const autoExcavationMessages = user.branchOffice?.autoExcavationEnabled
        ? processBranchAutoExcavation(user, now, { maxSteps: 2 })
        : [];

      const hadPendingNotifications = Array.isArray(user.pendingNotifications) && user.pendingNotifications.length > 0;
      const syncResponse = await buildRealtimeUserResponseWithGlobals(user, now, {
        includePendingCounts: shouldIncludePendingCounts
      });
      const throttleKey = String(user._id);
      const lastPersistedAt = Number(userSyncPersistThrottle.get(throttleKey) || 0);
      const shouldPersistSync = autoExcavationMessages.length > 0
        || hadPendingNotifications
        || shouldIncludePendingCounts
        || now.getTime() - lastPersistedAt >= SYNC_PERSIST_MIN_INTERVAL_MS;
      if (shouldPersistSync) {
        await persistUserSnapshot(user, { snapshotBuilder: buildUserSyncPersistenceSnapshot });
        userSyncPersistThrottle.set(throttleKey, now.getTime());
      }
      return syncResponse;
    });
    if (!shouldIncludePendingCounts) setSyncResponseCache(userId, response);
    res.json(response);
  } catch (err) {
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ msg: err.message });
    }
    if (err?.name === 'VersionError' || String(err?.message || '').includes('No matching document found for id')) {
      console.warn('Sync save conflict ignored:', err.message);
      try {
        const latestUser = await User.findById(userId).select(SYNC_USER_SELECT_FIELDS);
        if (!latestUser) {
          return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
        }
        ensureUserDefaults(latestUser);
        const now = new Date();
        const recoveryResponse = {
          userPatch: buildRealtimeGameStatePatch(latestUser, now),
          notifications: Array.isArray(latestUser.pendingNotifications) ? [...latestUser.pendingNotifications] : [],
          global: getGlobalState(now)
        };
        if (includeCounts === true) {
          recoveryResponse.marketplaceSoldPendingCount = await getMarketplaceSoldPendingCount(latestUser._id);
          recoveryResponse.adminMailPendingCount = await getPendingAdminMailCount(latestUser._id, now);
        }
        return res.json(recoveryResponse);
      } catch (reloadErr) {
        console.error('Sync conflict recovery error:', reloadErr);
      }
    }
    console.error('Sync error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});


app.post('/api/branch-office/found', async (req, res) => {
  const { userId, companyName } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      const derivedStats = calculateDerivedStats(user, now);
      if (user.branchOffice.isFounded) throw createHttpError(400, '이미 지사를 운영 중입니다.');
      if (!isBranchOfficeEligible(user, now, derivedStats)) throw createHttpError(400, '아직 지사 설립 조건을 달성하지 못했습니다.');
      if (user.gameState.money < BRANCH_OFFICE_FOUND_COST) throw createHttpError(400, '지사 설립비가 부족합니다.');
      const cleanName = sanitizeBranchCompanyName(companyName);
      if (cleanName.length < 2) throw createHttpError(400, '회사 이름은 2글자 이상으로 입력해주세요.');
      user.gameState.money -= BRANCH_OFFICE_FOUND_COST;
      user.branchOffice = {
        ...getDefaultBranchOffice(),
        isFounded: true,
        companyName: cleanName,
        foundedAt: now,
        lastSettlementDayKey: getKSTDateKey(now),
        lastTaxAt: now,
        lastLog: cleanName + ' 지사를 설립했습니다. 설립비 ' + BRANCH_OFFICE_FOUND_COST.toLocaleString() + '원이 사용되었습니다.'
      };
      return { user: buildGameStateResponse(user, now), branchResult: { message: user.branchOffice.lastLog } };
    }, { conflictLabel: 'Branch found conflict' });
    res.json(response);
  } catch (err) {
    console.error('Branch found error:', err);
    res.status(err.statusCode || 500).json({ msg: err.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/branch-office/rename', async (req, res) => {
  const { userId, companyName } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });
  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      if (!user.branchOffice.isFounded) throw createHttpError(400, '먼저 지사를 설립해주세요.');
      const cleanName = sanitizeBranchCompanyName(companyName);
      if (cleanName.length < 2) throw createHttpError(400, '회사 이름은 2글자 이상으로 입력해주세요.');
      user.branchOffice.companyName = cleanName;
      user.branchOffice.lastLog = '회사 이름을 ' + cleanName + '(으)로 변경했습니다.';
      return { user: buildGameStateResponse(user, now), branchResult: { message: user.branchOffice.lastLog } };
    }, { conflictLabel: 'Branch rename conflict' });
    res.json(response);
  } catch (err) {
    console.error('Branch rename error:', err);
    res.status(err.statusCode || 500).json({ msg: err.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/branch-office/post-job', async (req, res) => {
  const { userId, contractPercent } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });
  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      if (!user.branchOffice.isFounded) throw createHttpError(400, '먼저 지사를 설립해주세요.');
      const maxEmployees = getBranchMaxEmployees(user);
      if (user.branchOffice.employees.length >= maxEmployees) throw createHttpError(400, '직원은 현재 최대 ' + maxEmployees + '명까지 고용할 수 있습니다. 회사 가치 20억원마다 한도가 1명씩 증가합니다.');
      const rawPercent = Number(contractPercent);
      if (!Number.isFinite(rawPercent) || rawPercent <= 0) throw createHttpError(400, '계약 비율은 0보다 크게 입력해주세요.');
      const percent = Math.max(BRANCH_OFFICE_MIN_CONTRACT_PERCENT, Math.min(50, rawPercent));
      const derivedStats = calculateDerivedStats(user, now);
      const dailyBase = getBranchEmployeeDailySalaryBase(user, now, derivedStats);
      const dailySalary = Math.max(1, Math.floor(dailyBase * percent / 100));
      const postCost = Math.floor(dailySalary * 0.3);
      if (user.gameState.money < postCost) throw createHttpError(400, '공고 비용이 부족합니다.');
      user.gameState.money -= postCost;
      const successChance = getBranchRecruitSuccessChance(percent);
      const success = Math.random() * 100 < successChance;
      let message = '공고 비용 ' + postCost.toLocaleString() + '원이 사용되었습니다. ';
      let employee = null;
      if (success) {
        employee = rollBranchEmployee(percent, dailySalary);
        employee.dailySalary = getBranchEmployeeFinalDailySalary(user, employee, dailySalary, now, derivedStats);
        user.branchOffice.employees.push(employee);
        user.branchOffice.employeeCodex = [...new Set([...(user.branchOffice.employeeCodex || []), employee.name])];
        message += employee.name + ' 채용 성공! (' + employee.grade + '등급 / 발굴력 +' + employee.excavationPower + '% / 일일 계약금 ' + employee.dailySalary.toLocaleString() + '원)';
      } else {
        message += '채용 실패. 면접장에 아무도 오지 않았습니다. (성공률 ' + successChance + '%)';
      }
      user.branchOffice.lastLog = message;
      return { user: buildGameStateResponse(user, now), branchResult: { message, employee } };
    }, { conflictLabel: 'Branch recruit conflict', snapshotBuilder: buildUserSyncPersistenceSnapshot });
    res.json(response);
  } catch (err) {
    console.error('Branch recruit error:', err);
    res.status(err.statusCode || 500).json({ msg: err.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/branch-office/fire', async (req, res) => {
  const { userId, employeeId } = req.body;
  if (!userId || !employeeId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });
  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      if (!user.branchOffice.isFounded) throw createHttpError(400, '먼저 지사를 설립해주세요.');
      const index = user.branchOffice.employees.findIndex((employee) => employee.employeeId === employeeId);
      if (index < 0) throw createHttpError(404, '직원을 찾을 수 없습니다.');
      const employee = user.branchOffice.employees[index];
      const fireCost = Math.floor(Number(employee.dailySalary || 0) * 5);
      if (user.gameState.money < fireCost) throw createHttpError(400, '해고 비용이 부족합니다.');
      user.gameState.money -= fireCost;
      user.branchOffice.employees.splice(index, 1);
      const message = employee.name + '을(를) 해고했습니다. 해고 비용 ' + fireCost.toLocaleString() + '원이 사용되었습니다.';
      user.branchOffice.lastLog = message;
      return { user: buildGameStateResponse(user, now), branchResult: { message } };
    }, { conflictLabel: 'Branch fire conflict' });
    res.json(response);
  } catch (err) {
    console.error('Branch fire error:', err);
    res.status(err.statusCode || 500).json({ msg: err.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/branch-office/excavate', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });
  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      normalizeBranchOffice(user);
      if (!user.branchOffice.isFounded) throw createHttpError(400, '먼저 회사를 설립해주세요.');

      const pending = getBranchPendingExcavation(user);
      if (pending) {
        const completed = completeBranchExcavation(user, now);
        if (!completed.completed) throw createHttpError(400, completed.message || '발굴이 아직 진행 중입니다.');
        if (user.branchOffice.autoExcavationEnabled) {
          const next = startBranchExcavation(user, now, { auto: true });
          if (next.started) completed.message += ' 다음 자동 발굴이 이어서 시작되었습니다.';
          else if (next.message) completed.message += ' ' + next.message;
        }
        return { user: buildGameStateResponse(user, now), branchResult: completed };
      }

      const started = startBranchExcavation(user, now);
      if (!started.started) throw createHttpError(400, started.message || '발굴을 시작할 수 없습니다.');
      return { user: buildGameStateResponse(user, now), branchResult: started };
    }, { conflictLabel: 'Branch excavate conflict' });
    res.json(response);
  } catch (err) {
    console.error('Branch excavate error:', err);
    res.status(err.statusCode || 500).json({ msg: err.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/branch-office/toggle-auto-excavation', async (req, res) => {
  const { userId, enabled } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });
  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      normalizeBranchOffice(user);
      if (!user.branchOffice.isFounded) throw createHttpError(400, '먼저 회사를 설립해주세요.');

      user.branchOffice.autoExcavationEnabled = Boolean(enabled);
      let message = user.branchOffice.autoExcavationEnabled
        ? '자동 발굴을 켰습니다. 완료된 발굴은 자동 정산되고 다음 발굴이 이어서 시작됩니다.'
        : '자동 발굴을 껐습니다. 이미 진행 중인 발굴은 유지되고, 다음 반복만 중단됩니다.';

      if (user.branchOffice.autoExcavationEnabled) {
        const autoMessages = processBranchAutoExcavation(user, now);
        if (autoMessages.length) message += ' ' + autoMessages[autoMessages.length - 1];
      }
      user.branchOffice.lastLog = message;
      return { user: buildGameStateResponse(user, now), branchResult: { message } };
    }, { conflictLabel: 'Branch auto excavate conflict' });
    res.json(response);
  } catch (err) {
    console.error('Branch auto excavate error:', err);
    res.status(err.statusCode || 500).json({ msg: err.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/branch-office/buy-storage', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });
  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      if (!user.branchOffice.isFounded) throw createHttpError(400, '먼저 지사를 설립해주세요.');
      const cost = getBranchNextStorageCost(user);
      if (cost == null) throw createHttpError(400, '창고가 이미 최대치입니다.');
      if (user.gameState.money < cost) throw createHttpError(400, '창고 구매 비용이 부족합니다.');
      user.gameState.money -= cost;
      user.branchOffice.storageSlots += 1;
      const message = '창고 1칸을 구매했습니다. ' + cost.toLocaleString() + '원이 사용되었습니다.';
      user.branchOffice.lastLog = message;
      return { user: buildGameStateResponse(user, now), branchResult: { message } };
    }, { conflictLabel: 'Branch storage conflict' });
    res.json(response);
  } catch (err) {
    console.error('Branch storage error:', err);
    res.status(err.statusCode || 500).json({ msg: err.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/branch-office/dispose-item', async (req, res) => {
  const { userId, instanceId } = req.body;
  if (!userId || !instanceId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });
  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      if (!user.branchOffice.isFounded) throw createHttpError(400, '먼저 지사를 설립해주세요.');
      const index = user.branchOffice.items.findIndex((item) => item.instanceId === instanceId);
      if (index < 0) throw createHttpError(404, '아이템을 찾을 수 없습니다.');
      const itemEntry = user.branchOffice.items[index];
      const detail = getBranchItemDetail(itemEntry.itemId);
      const cost = detail.disposeCost;
      if (user.gameState.money < cost) throw createHttpError(400, '처분 비용이 부족합니다.');
      user.gameState.money -= cost;
      user.branchOffice.items.splice(index, 1);
      const message = detail.emoji + ' ' + detail.name + '을(를) 처분했습니다. 처분 비용 ' + cost.toLocaleString() + '원이 사용되었습니다. 회사 가치는 유지됩니다.';
      user.branchOffice.lastLog = message;
      return { user: buildGameStateResponse(user, now), branchResult: { message } };
    }, { conflictLabel: 'Branch dispose conflict' });
    res.json(response);
  } catch (err) {
    console.error('Branch dispose error:', err);
    res.status(err.statusCode || 500).json({ msg: err.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

const rankingCacheByMode = new Map();

function normalizeRankingMode(mode = 'all') {
  if (mode === 'level' || mode === 'pvp' || mode === 'branch') return mode;
  return 'all';
}

async function buildRankingPayload(now = new Date(), requestedMode = 'all') {
  const mode = normalizeRankingMode(requestedMode);
  await processWeeklyPvpSeasonIfNeeded(now);
  const payload = {};

  if (mode === 'all' || mode === 'level') {
    const rankingUsers = await User.find({ nickname: { $ne: null } })
      .sort({ 'gameState.level': -1, 'gameState.exp': -1 })
      .limit(20)
      .select('nickname username gameState.level gameState.exp titles emblems meta.lastSeenAt branchOffice.isFounded branchOffice.companyName branchOffice.companyValue')
      .lean();

    payload.level = rankingUsers.map((user) => ({
      nickname: user.nickname,
      displayName: buildDisplayName(user),
      equippedEmblem: getEquippedEmblemDetail(user),
      gameState: {
        level: user.gameState.level,
        exp: user.gameState.exp
      },
      isOnline: Boolean(user.meta?.lastSeenAt && now.getTime() - new Date(user.meta.lastSeenAt).getTime() <= ONLINE_THRESHOLD_MS),
      branchOffice: getBranchRankingLiteSummary(user)
    }));
  }

  if (mode === 'all' || mode === 'pvp') {
    const pvpSelect = 'nickname username titles emblems meta.lastSeenAt pvpStats branchOffice.isFounded branchOffice.companyName branchOffice.companyValue';
    const playedUsers = await User.find({ nickname: { $ne: null }, 'pvpStats.played': { $gt: 0 } })
      .sort({ 'pvpStats.rating': -1, 'pvpStats.wins': -1, 'pvpStats.losses': 1, nickname: 1, username: 1 })
      .limit(20)
      .select(pvpSelect)
      .lean();
    const fillerUsers = playedUsers.length >= 20
      ? []
      : await User.find({
          nickname: { $ne: null },
          $or: [
            { 'pvpStats.played': { $exists: false } },
            { 'pvpStats.played': { $lte: 0 } }
          ]
        })
          .sort({ nickname: 1, username: 1 })
          .limit(20 - playedUsers.length)
          .select(pvpSelect)
          .lean();
    const pvpUsers = [...playedUsers, ...fillerUsers];
    payload.pvp = pvpUsers.map((user) => ({
      nickname: user.nickname,
      displayName: buildDisplayName(user),
      equippedEmblem: getEquippedEmblemDetail(user),
      pvpStats: {
        rating: Math.round(Number(user.pvpStats?.rating ?? PVP_RATING_BASE)),
        played: Math.max(0, Math.floor(Number(user.pvpStats?.played || 0))),
        wins: Math.max(0, Math.floor(Number(user.pvpStats?.wins || 0))),
        losses: Math.max(0, Math.floor(Number(user.pvpStats?.losses || 0)))
      },
      isOnline: Boolean(user.meta?.lastSeenAt && now.getTime() - new Date(user.meta.lastSeenAt).getTime() <= ONLINE_THRESHOLD_MS),
      branchOffice: getBranchRankingLiteSummary(user)
    }));
  }

  if (mode === 'all' || mode === 'branch') {
    const branchUsers = await User.find({ nickname: { $ne: null }, 'branchOffice.isFounded': true })
      .sort({ 'branchOffice.companyValue': -1, nickname: 1, username: 1 })
      .limit(20)
      .select('nickname username titles emblems meta.lastSeenAt branchOffice.isFounded branchOffice.companyName branchOffice.companyValue branchOffice.employees branchOffice.items branchOffice.storageSlots branchOffice.itemCodex branchOffice.lastLog')
      .lean();
    payload.branch = branchUsers.map((user) => ({
      nickname: user.nickname,
      displayName: buildDisplayName(user),
      equippedEmblem: getEquippedEmblemDetail(user),
      branchOffice: getBranchRankingSummaryFromLean(user),
      isOnline: Boolean(user.meta?.lastSeenAt && now.getTime() - new Date(user.meta.lastSeenAt).getTime() <= ONLINE_THRESHOLD_MS)
    }));
  }

  return payload;
}

async function getRankingPayloadCached(now = new Date(), requestedMode = 'all') {
  const mode = normalizeRankingMode(requestedMode);
  const nowMs = now.getTime();
  const cached = rankingCacheByMode.get(mode);
  if (cached?.payload && cached.expiresAt > nowMs) {
    return cached.payload;
  }
  if (cached?.promise) {
    return cached.payload || cached.promise;
  }
  const promise = buildRankingPayload(now, mode)
    .then((payload) => {
      rankingCacheByMode.set(mode, {
        payload,
        expiresAt: Date.now() + RANKING_CACHE_TTL_MS,
        promise: null
      });
      return payload;
    })
    .finally(() => {
      const latest = rankingCacheByMode.get(mode);
      if (latest?.promise === promise) {
        rankingCacheByMode.set(mode, {
          payload: latest.payload,
          expiresAt: latest.expiresAt || 0,
          promise: null
        });
      }
    });
  rankingCacheByMode.set(mode, {
    payload: cached?.payload || null,
    expiresAt: cached?.expiresAt || 0,
    promise
  });
  return cached?.payload || promise;
}

app.get('/api/ranking', async (req, res) => {
  try {
    const now = new Date();
    res.json(await getRankingPayloadCached(now, req.query.mode || 'all'));
  } catch (err) {
    console.error('Ranking error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});


app.get('/api/mail', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const user = await User.findById(userId).select('_id');
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    const mails = await getPendingAdminMailList(user._id, now);
    res.json({
      mails,
      pendingCount: mails.length
    });
  } catch (err) {
    console.error('Admin mail list error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/mail/claim', async (req, res) => {
  const { userId, mailId } = req.body;
  if (!userId || !mailId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });

  try {
    const now = new Date();
    const message = await claimAdminMail(userId, mailId, now);
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    ensureUserDefaults(user);
    const response = await buildUserResponseWithGlobals(user, now);
    response.mail = {
      mails: await getPendingAdminMailList(user._id, now),
      claimedCount: 1,
      messages: [message]
    };
    res.json(response);
  } catch (err) {
    console.error('Admin mail claim error:', err);
    res.status(err.statusCode || 500).json({ msg: err.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/mail/claim-all', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const response = await claimAdminMailsBatch(userId, new Date());
    res.json(response);
  } catch (err) {
    console.error('Admin mail claim all error:', err);
    res.status(err.statusCode || 500).json({ msg: err.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const now = new Date();
    const tournamentState = await getInterviewTournamentState(now);
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
      giftCatalog: ADMIN_GIFT_CATALOG,
      currentRaidBossId: getCurrentRaidBossId(new Date()),
      raidBossOptions: RAID_BOSS_ROTATION_IDS.map((bossId) => ({
        id: bossId,
        name: RAID_BOSS_DATA[bossId]?.name || bossId
      })),
      interviewTournament: buildInterviewTournamentResponse(tournamentState, null, now)
    });
  } catch (err) {
    console.error('Admin user list error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/admin/gift', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { targetMode, targetUserId, giftType, giftId, quantity, messageTitle, messageBody } = req.body;
  const giftQuantity = Math.max(1, Math.floor(Number(quantity) || 1));

  if (!['all', 'single'].includes(targetMode)) {
    return res.status(400).json({ msg: '대상 지정 방식이 올바르지 않습니다.' });
  }

  if (!['item', 'buff', 'package', 'title', 'fragment', 'message'].includes(giftType)) {
    return res.status(400).json({ msg: '선물 종류가 올바르지 않습니다.' });
  }

  if (giftType === 'item' && !ITEM_DATA[giftId]) {
    return res.status(400).json({ msg: '존재하지 않는 아이템입니다.' });
  }

  if (giftType === 'fragment' && giftId !== 'equipment_fragment') {
    return res.status(400).json({ msg: '존재하지 않는 파편입니다.' });
  }

  if (giftType === 'buff' && !BUFF_DATA[giftId]) {
    return res.status(400).json({ msg: '존재하지 않는 버프입니다.' });
  }

  if (giftType === 'package' && !SUPPORT_PACKAGE_DATA[giftId]) {
    return res.status(400).json({ msg: '존재하지 않는 패키지입니다.' });
  }

  if (giftType === 'title' && !TITLE_DATA[giftId]) {
    return res.status(400).json({ msg: '존재하지 않는 칭호입니다.' });
  }

  try {
    const users = targetMode === 'all'
      ? await User.find({}).select('_id').lean()
      : await User.find({ _id: targetUserId }).select('_id').lean();

    if (!users.length) {
      return res.status(404).json({ msg: '선물할 사용자를 찾을 수 없습니다.' });
    }

    const now = new Date();
    const mailPayload = createAdminMailGiftPayload(giftType, giftId, giftQuantity, now, { messageTitle, messageBody });
    const mailDocs = users.map((user) => ({
      recipientId: user._id,
      ...mailPayload
    }));
    const inserted = await AdminMail.insertMany(mailDocs, { ordered: false });
    const deliveredCount = inserted.length;

    if (!deliveredCount) {
      return res.status(500).json({ msg: '선물 발송에 실패했습니다.' });
    }

    res.json({
      success: true,
      deliveredCount,
      expiresAt: mailPayload.expiresAt
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

app.post('/api/admin/set-level', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { targetUserId, level } = req.body;
  const targetLevel = Math.max(1, Math.floor(Number(level) || 1));
  if (!targetUserId) {
    return res.status(400).json({ msg: '대상 사용자 ID가 필요합니다.' });
  }

  try {
    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ msg: '대상 사용자를 찾을 수 없습니다.' });
    }

    const now = new Date();
    ensureUserDefaults(user);
    calculateOfflineGains(user, now);

    user.gameState.level = targetLevel;
    user.gameState.exp = 0;
    user.gameState.passiveExpCarry = 0;
    user.gameState.moneyCarry = Number(user.gameState.moneyCarry || 0);
    user.gameState.maxStamina = 10;
    user.gameState.stamina = Math.min(getEffectiveMaxStamina(user, now), user.gameState.stamina);
    reconcileTitles(user, now);
    reconcileEmblems(user);
    queueNotification(user, 'admin_level', `운영자가 당신의 레벨을 ${targetLevel}(으)로 조정했습니다.`);

    await persistUserSnapshot(user);

    res.json({
      success: true,
      updatedLabel: user.nickname ? `${user.nickname} (${user.username})` : user.username,
      level: targetLevel
    });
  } catch (err) {
    console.error('Admin set level error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/admin/grant-money', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { targetUserId, amount } = req.body;
  const grantAmount = Math.max(1, Math.floor(Number(amount) || 0));
  if (!targetUserId) {
    return res.status(400).json({ msg: '대상 사용자 ID가 필요합니다.' });
  }
  if (!Number.isFinite(grantAmount) || grantAmount <= 0) {
    return res.status(400).json({ msg: '지급할 금액이 올바르지 않습니다.' });
  }

  try {
    let user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ msg: '대상 사용자를 찾을 수 없습니다.' });
    }

    const now = new Date();
    ensureUserDefaults(user);
    calculateOfflineGains(user, now);
    user.gameState.money += grantAmount;
    reconcileTitles(user, now);
    queueNotification(user, 'admin_money', `운영자가 ${grantAmount.toLocaleString()}원을 지급했습니다.`);

    try {
      await persistUserSnapshot(user);
    } catch (err) {
      if (!isVersionConflictError(err)) throw err;
      const latestUser = await User.findById(targetUserId);
      if (!latestUser) {
        return res.status(404).json({ msg: '대상 사용자를 찾을 수 없습니다.' });
      }
      ensureUserDefaults(latestUser);
      calculateOfflineGains(latestUser, now);
      latestUser.gameState.money += grantAmount;
      reconcileTitles(latestUser, now);
      queueNotification(latestUser, 'admin_money', `운영자가 ${grantAmount.toLocaleString()}원을 지급했습니다.`);
      await persistUserSnapshot(latestUser);
      user = latestUser;
    }

    res.json({
      success: true,
      updatedLabel: user.nickname ? `${user.nickname} (${user.username})` : user.username,
      amount: grantAmount
    });
  } catch (err) {
    console.error('Admin grant money error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/admin/daily-augment/reset', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const now = new Date();
    const resetSeed = `${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`;
    const result = await User.updateMany(
      {},
      {
        $set: {
          'meta.dailyAugmentVersion': DAILY_AUGMENT_VERSION,
          'meta.dailyAugmentDayKey': '',
          'meta.dailyAugmentTier': '',
          'meta.dailyAugmentSeedKey': '',
          'meta.dailyAugmentResetSeed': resetSeed,
          'meta.dailyAugmentResetDayKey': getKSTDateKey(now),
          'meta.dailyAugmentOptions': [],
          'meta.dailyAugmentSelectedId': '',
          'meta.dailyAugmentRerolledSlots': []
        }
      }
    );
    const dayKey = getKSTDateKey(now);
    const nextTier = getDailyAugmentTier(`${dayKey}:${resetSeed}`);
    res.json({ ok: true, modifiedCount: result.modifiedCount || 0, resetSeed, tier: nextTier });
  } catch (err) {
    console.error('Admin daily augment reset error:', err);
    res.status(500).json({ msg: '증강 선택 초기화 중 서버 오류가 발생했습니다.' });
  }
});

app.post('/api/admin/interview-tournament/force-result', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { matchId, winnerUserId } = req.body || {};
  if (!matchId || !winnerUserId) {
    return res.status(400).json({ msg: '대진과 승자를 선택해주세요.' });
  }

  try {
    const now = new Date();
    const { state, match } = await forceInterviewTournamentMatchResult(matchId, winnerUserId, now);
    res.json({
      success: true,
      matchId: match.matchId,
      winner: match.winner,
      interviewTournament: buildInterviewTournamentResponse(state, null, now)
    });
  } catch (err) {
    console.error('Admin tournament force-result error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '토너먼트 승패 확정에 실패했습니다.' });
  }
});

app.post('/api/admin/set-raid-boss', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { bossId } = req.body;
  if (!bossId || !RAID_BOSS_DATA[bossId]) {
    return res.status(400).json({ msg: '변경할 보스가 올바르지 않습니다.' });
  }

  if (RAID_MODE_LIST.some((mode) => {
    const room = getRaidRoom(mode);
    return room.activeBattle || room.slots.some(Boolean);
  })) {
    return res.status(400).json({ msg: '현재 진행 중이거나 대기 중인 레이드가 있어 보스를 변경할 수 없습니다.' });
  }

  try {
    const now = new Date();
    const todayKey = getKSTDateKey(now);
    const tomorrowKey = getKSTDateKey(new Date(now.getTime() + (24 * 60 * 60 * 1000)));
    const nextBossId = getAlternateRaidBossId(bossId);

    raidState.manualBossOverrideDayKey = todayKey;
    raidState.manualBossOverrideId = bossId;
    raidState.nextDayForcedBossDayKey = tomorrowKey;
    raidState.nextDayForcedBossId = nextBossId;
    bumpRaidVersion();

    res.json({
      success: true,
      currentRaidBossId: bossId,
      currentRaidBossName: RAID_BOSS_DATA[bossId].name,
      nextRaidBossId: nextBossId,
      nextRaidBossName: RAID_BOSS_DATA[nextBossId]?.name || nextBossId
    });
  } catch (err) {
    console.error('Admin set raid boss error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

const { registerV2Routes } = require('./src/v2/registerV2Routes');

registerV2Routes({
  app,
  User,
  bcrypt,
  jwt,
  jwtSecret: JWT_SECRET,
  adminUsername: ADMIN_USERNAME,
  adminPassword: ADMIN_PASSWORD,
  requireAdmin
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
