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

const ADMIN_USERNAME = 'dinguree';
const ADMIN_PASSWORD = 'dinguree';

let newsTypingCache = {
  fetchedAt: 0,
  prompts: [],
  fallback: false,
  stats: []
};
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
const MARKETPLACE_TRADEABLE_ITEM_IDS = ['raid_entry_ticket', 'hagendaz'];
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
    rewardMultiplier: 1.5
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
const RAID_BOSS_ROTATION_IDS = [RAID_BOSS_ID, RAID_BOSS_ID_BALD_MANAGER, RAID_BOSS_ID_HOI];
const RAID_BOSS_ROTATION_START_KEY = '2026-05-11';
const RAID_POLL_VERSION_EMPTY = 0;
const PVP_MIN_LEVEL = 50;
const PVP_ACCEPT_MS = 5 * 1000;
const PVP_BAN_TURN_MS = 30000;
const PVP_PICK_TURN_MS = 45000;
const PVP_BATTLE_TURN_MS = 30000;
const PVP_START_COUNTDOWN_MS = 5000;
const PVP_DRAFT_AUTO_GRACE_MS = 0;
const PVP_DRAFT_SUBMIT_GRACE_MS = 1500;
const PVP_BANS_PER_PLAYER = 3;
const PVP_PICKS_PER_PLAYER = 5;
const PVP_PICK_SEQUENCE_INDICES = [0, 1, 1, 0, 0, 1, 1, 0, 0, 1];
const PVP_MAX_HP = 300;
const PVP_RATING_BASE = 1000;
const PVP_RATING_K = 30;
const PVP_BET_PAYOUT_MULTIPLIER = 1.3;
const PVP_POLL_VERSION_EMPTY = 0;
const PVP_MODE_RANKED = 'ranked';
const PVP_MODE_NORMAL = 'normal';
const PVP_WEEKLY_SEASON_SETTING_KEY = 'pvp_weekly_season';
const PVP_WEEKLY_SEASON_CHECK_INTERVAL_MS = 60 * 1000;
const PVP_RANKED_ANONYMOUS_OPPONENT_NAME = '익명의 상대';
const INFINITE_OVERTIME_MIN_LEVEL = 30;
const INFINITE_OVERTIME_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
const INFINITE_OVERTIME_MAX_FLOOR = 30;
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
  [PVP_MODE_NORMAL]: '일반'
};
const PVP_WEEKLY_REWARD_TIERS = [
  { rank: 1, bacchus: 50, businessCards: 50 },
  { rank: 2, bacchus: 30, businessCards: 30 },
  { rank: 3, bacchus: 20, businessCards: 20 }
];
const PVP_WEEKLY_PARTICIPATION_REWARD = { bacchus: 10, businessCards: 10 };
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
  }
};
const EQUIPMENT_DROP_CHANCE = 0.0005;
const ADVENTURE_SCROLL_DROP_CHANCE = 0.005;
const EQUIPMENT_TYPE_CARD = 'card_effect';
const EQUIPMENT_TYPE_ATTACK = 'basic_attack';
const EQUIPMENT_SCROLL_DROP_WEIGHT = 3;
const EQUIPMENT_GEAR_DROP_WEIGHT = 7;
const CAT_TUNA_CAN_ITEM_IDS = ['cat_tuna_can', 'tuna_can', 'cat_food'];

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
    skillDesc: '파티원 중 가장 레벨이 낮은 1명을 2턴 동안 레벨 +1~+5로 간주합니다.',
    cooldown: 8,
    effectType: 'lowest_level_buff',
    targetType: null,
    turns: 2,
    levelBonus: 1
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
  sunscreen: { targets: { 0: 3, 2: 4, 3: 99 }, negateHitCount: { 0: 1, 4: 2 }, includeSelf: { 0: 0, 3: 1 }, cooldown: { 0: 6, 1: 5, 5: 4 } },
  trial_and_growth: { multiplierPerStatus: { 0: 5, 1: 5, 2: 6, 3: 7, 4: 7, 5: 8 }, cooldown: { 0: 5, 1: 4, 4: 3 } },
  hoi_overtime: { rageDamagePerStackPerLevel: { 0: 5, 1: 6, 2: 7, 3: 8, 4: 9 }, cooldown: { 0: 4, 5: 3 } },
  mingu_champion: { attackBonusPercent: { 0: 0.1, 3: 0.15, 5: 0.2 }, cooldown: { 0: 7, 2: 6, 4: 5 } },
  winter_subordinate: { levelBonus: { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 5 }, cooldown: { 0: 8, 5: 7 } },
  precise_strike: { multiplierPerLevel: { 0: 40, 2: 45, 3: 50, 4: 55 }, cooldown: { 0: 5, 1: 4, 5: 3 } },
  umbrella_copy: { copyEffectMultiplier: { 0: 0.5, 2: 0.6, 3: 0.7 }, canSelectCopyTarget: { 4: 1 }, cooldown: { 0: 6, 1: 5, 5: 4 } },
  neo_pesticide: { damagePerLevel: { 0: 10, 2: 11, 4: 12, 5: 15 }, cooldown: { 0: 7, 1: 6, 3: 5 } },
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
  cat_butler_emblem: {
    id: 'cat_butler_emblem',
    emblemId: 'cat_butler',
    name: '집사 휘장',
    cost: 5000,
    quantity: 1,
    dailyLimit: 1,
    countField: 'dailyFragmentCatButlerEmblemPurchases'
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
    imageLabel: '트름녀',
    portrait: 'assets/bosses/burp_queen.png',
    patternOrder: ['burp', 'ice', 'smack', 'shield'],
    hardPassiveText: '패시브. 가시갑옷: 1회 피격당할 때마다 공격자에게 5 피해를 반사합니다.',
    skillsText: [
      '1. 트름하기: 파티 전체에게 30 피해',
      '2. 얼음씹기: 랜덤 3명에게 30 피해, 1턴 침묵',
      '3. 쩝쩝거리기: 랜덤 대상에게 20 피해씩 총 4회',
      '4. 눈 새 행동: 1턴 지속 보호막 10,000 획득'
    ],
    rewardsText: RAID_BOSS_REWARDS_TEXT
  },
  [RAID_BOSS_ID_BALD_MANAGER]: {
    id: RAID_BOSS_ID_BALD_MANAGER,
    name: '대머리 김부장',
    maxHp: 60000,
    imageLabel: '대머리 김부장',
    portrait: 'assets/bosses/bald_manager.png',
    patternOrder: ['wig_search', 'mz', 'afterparty', 'sauna'],
    hardPassiveText: '패시브. 매끈한 두피: 1P 행동 시작부터 다음 1P 행동 시작 전까지 1회 타격당할 때마다 이후 받는 피해가 10%씩 곱연산으로 감소합니다. 다음 턴 1P 행동 시작 시 사라집니다.',
    skillsText: [
      '1. 내 가발 어디갔어?!: 랜덤 3명에게 20 피해, 2턴 동안 기본 공격/스킬 사용 불가',
      '2. 허허, 요즘 엠제트세대란..: 랜덤 4명에게 10 피해, 2턴 동안 회복량/실드 획득량 50% 감소',
      '3. 비기: 회식은 3차부터: 2턴 지속 보호막 7,000 획득, 전원에게 다음 피격 피해 3배 디버프',
      '4. 사우나나 갈까?: 파티 전체에게 20 피해',
      '보너스 규칙: 파티에 <김부장의 가발> 장착자가 있으면 1번 스킬이 어이쿠 가발이 여기있네..로 바뀝니다.'
    ],
    rewardsText: RAID_BOSS_REWARDS_TEXT
  },
  [RAID_BOSS_ID_HOI]: {
    id: RAID_BOSS_ID_HOI,
    name: 'HOI-M.S.J-50',
    maxHp: 60000,
    imageLabel: 'HOI-M.S.J-50',
    portrait: 'assets/bosses/hoi_msj_50.png',
    patternOrder: ['son_brag', 'son_mix', 'ass_hit', 'nail_clip', 'food_question'],
    hardPassiveText: '패시브. 나 먼저 퇴근할게: 매 공격을 20% 확률로 회피합니다.',
    skillsText: [
      '1. 아들자랑 MK.1: 전원의 버프 제거, 제거된 버프 1개당 10 피해, 랜덤 2인에게 2턴 기본 공격 불가',
      '2. 아들이랑 엮기 MK.2: 자신 버프 1개당 6000 회복, 버프가 없으면 보호막 5000 획득',
      '3. ASS-HIT MK.3: 전원에게 10 피해씩 총 3회 공격',
      '4. 손 톱 깎 기: 랜덤 1인에게 1턴 뒤 40 피해, 이후 30/20 피해로 최대 2회 튕김',
      '5. 먹고 싶은거 있어?: 전원에게 20 피해, 자신에게 피격 무효 10회 버프',
      '특수 기믹: 닉네임이 호이인 파티원이 있으면 그 파티원의 피해가 1.5배로 적용되고, 클리어 시 파티 전체 전리품이 1.5배가 됩니다.'
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
    [RAID_MODE_HARD]: createRaidRoomState()
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
    [PVP_MODE_NORMAL]: createPvpModeState()
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
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'server is running' });
});

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
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
  shopState: {
    dayKey: { type: String, default: null },
    dailySpend: { type: Number, default: 0 },
    dailyBusinessCardPurchases: { type: Number, default: 0 },
    dailyBacchusPurchases: { type: Number, default: 0 },
    dailyHot6Purchases: { type: Number, default: 0 },
    dailyFragmentRaidTicketPurchases: { type: Number, default: 0 },
    dailyFragmentBusinessCardPurchases: { type: Number, default: 0 },
    dailyFragmentCatButlerEmblemPurchases: { type: Number, default: 0 },
    lastShoppingAddictQualifiedDayKey: { type: String, default: null }
  },
  meta: {
    loginCount: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: null },
    lastShoutAt: { type: Date, default: null },
    lastRaidDayKey: { type: String, default: null },
    raidEntryDayKey: { type: String, default: null },
    raidEntryUsedCount: { type: Number, default: 0 },
    raidEntryBonusCount: { type: Number, default: 0 },
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
    potatoRehabKillCount: { type: Number, default: 0 }
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
  giftType: { type: String, enum: ['item', 'buff', 'package', 'title', 'fragment'], required: true },
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

function getKSTDateKey(date = new Date()) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  return mode === RAID_MODE_HARD ? RAID_MODE_HARD : RAID_MODE_NORMAL;
}

function ensureRaidRooms() {
  if (!raidState.modes || typeof raidState.modes !== 'object') {
    raidState.modes = {
      [RAID_MODE_NORMAL]: createRaidRoomState(),
      [RAID_MODE_HARD]: createRaidRoomState()
    };
  }
  [RAID_MODE_NORMAL, RAID_MODE_HARD].forEach((mode) => {
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
  return [RAID_MODE_NORMAL, RAID_MODE_HARD]
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
  const modes = mode ? [normalizeRaidMode(mode)] : [RAID_MODE_NORMAL, RAID_MODE_HARD];
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
  if (!Array.isArray(user.equipments)) user.equipments = [];
  if (!user.equippedEquipment || typeof user.equippedEquipment !== 'object') {
    user.equippedEquipment = { cardEffect: null, basicAttack: null };
  }
  user.equippedEquipment.cardEffect = user.equippedEquipment.cardEffect || null;
  user.equippedEquipment.basicAttack = user.equippedEquipment.basicAttack || null;
  if (!CARD_DATA[user.equippedCardId]) user.equippedCardId = null;
  user.equippedCardLevel = Math.max(0, Math.min(5, Number(user.equippedCardLevel ?? 0)));
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

  if (!user.shopState) {
    user.shopState = {
      dayKey: null,
      dailySpend: 0,
      dailyBusinessCardPurchases: 0,
      dailyBacchusPurchases: 0,
      dailyHot6Purchases: 0,
      dailyFragmentRaidTicketPurchases: 0,
      dailyFragmentBusinessCardPurchases: 0,
      dailyFragmentCatButlerEmblemPurchases: 0,
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
  user.shopState.dailyFragmentCatButlerEmblemPurchases = Number(user.shopState.dailyFragmentCatButlerEmblemPurchases ?? 0);
  user.shopState.lastShoppingAddictQualifiedDayKey = user.shopState.lastShoppingAddictQualifiedDayKey || null;

  if (!user.meta) {
    user.meta = {
      loginCount: 0,
      lastLoginAt: null,
      lastSeenAt: null,
      lastShoutAt: null,
      lastRaidDayKey: null,
      raidEntryDayKey: null,
      raidEntryUsedCount: 0,
      raidEntryBonusCount: 0,
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
      potatoRehabKillCount: 0
    };
  }
  user.meta.loginCount = Number(user.meta.loginCount ?? 0);
  user.meta.lastLoginAt = user.meta.lastLoginAt || null;
  user.meta.lastSeenAt = user.meta.lastSeenAt || null;
  user.meta.lastShoutAt = user.meta.lastShoutAt || null;
  user.meta.lastRaidDayKey = user.meta.lastRaidDayKey || null;
  user.meta.raidEntryDayKey = user.meta.raidEntryDayKey || null;
  user.meta.raidEntryUsedCount = Number(user.meta.raidEntryUsedCount ?? 0);
  user.meta.raidEntryBonusCount = Number(user.meta.raidEntryBonusCount ?? 0);
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
    case 'strawberry_latte':
    case 'pho':
      return '해당 턴의 보스 턴까지';
    case 'rebuttal':
    case 'delegate_lee':
    case 'fantasy':
    case 'broken_leg':
    case 'rooftop_pigeons':
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
      return `다음 자신의 턴에 기본 공격을 총 ${card.hits}회 합니다. 각 공격은 기본 공격 피해의 90%로 적용됩니다.`;
    case 'gangnam_style':
      return `파티 전원에게 크리티컬률 ${formatCardPercentText(card.critBonus)}와 흥겨움을 부여하고, 해당 턴 보스 턴까지 유지되는 보호막 ${card.shield}을 제공합니다. 흥겨움 중 기본 공격은 2배 타격으로 적용됩니다.`;
    case 'delegate_lee':
      return `현재 입장한 파티원의 전체 레벨 합 x ${card.multiplierPerLevel}의 데미지를 1회 가합니다.`;
    case 'celine_tears':
      return `공격력 ${formatCardPercentText(card.attackBonusPercent)} 증가, 종료 시 자신의 레벨 x ${card.expireDamagePerLevel} 추가 피해`;
    case 'strawberry_latte':
      return `파티 전원에게 해당 턴 보스 턴까지 유지되는 보호막 ${card.shield}을 제공합니다.`;
    case 'rebuttal':
      return `파티원 전체의 HP를 ${card.heal} 회복합니다.${card.includeSelf ? ' 자신도 포함됩니다.' : ' 자신은 제외됩니다.'}`;
    case 'parking_master':
      return `다음 자신의 턴에 기본 공격을 총 ${card.hits}회 합니다. 각 공격은 기본 공격 피해의 90%로 적용됩니다.`;
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
      return `다음 자신의 턴에 기본 공격을 총 ${card.hits}회 합니다. 각 공격은 기본 공격 피해의 90%로 적용됩니다.`;
    case 'chatgpt':
      return `다음 자신의 턴 기본 공격에 더해 자신의 레벨 x ${card.bonusPerLevel} 추가 피해를 입힙니다.`;
    case 'pho':
      return `랜덤 파티원 ${card.targets}명에게 각각 해당 턴 보스 턴까지 유지되는 보호막 ${card.shield}을 제공합니다.`;
    case 'coca_cola':
      return `선택한 파티원 1인의 공격력을 ${formatCardPercentText(card.attackBonusPercent)} 증가시킵니다.`;
    case 'cider_comment':
      return `선택한 파티원 1인에게 디버프 무효 ${card.debuffImmuneCount}회를 제공합니다.`;
    case 'rooftop_pigeons':
      return `자신의 레벨 x ${card.damagePerLevel}의 데미지로 ${card.hits}회 공격합니다. 각 공격은 90% 위력으로 적용됩니다.`;
    case 'sunscreen':
      return `${card.includeSelf ? '자신 포함 ' : ''}${card.targets >= 99 ? '파티 전원' : `랜덤 팀원 ${card.targets}인`}에게 피격 무효 ${card.negateHitCount}회를 부여합니다.`;
    case 'trial_and_growth':
      return `현재 자신이 가진 버프/디버프 총 갯수 x 레벨 x ${card.multiplierPerStatus}의 피해를 ${card.hits}회 주고, 자신의 모든 디버프를 제거합니다.`;
    case 'hoi_overtime':
      return `상대에게 <야근>을 적용합니다. 첫 사용은 쿨타임이 돌지 않고, 야근 중 기본 공격 피격마다 <내면의 분노>가 쌓입니다. 이후 자신의 턴에 재사용하면 스택 x 레벨 x ${card.rageDamagePerStackPerLevel} 피해를 주고 야근과 스택을 소진한 뒤 쿨타임이 시작됩니다. 야근이 정화되면 폭발 재사용은 불가능해지고 즉시 쿨타임이 시작됩니다.`;
    case 'mingu_champion':
      return `지정한 파티원 1인에게 보호막 ${card.shield}, ${card.turns}턴 동안 <챔피언의 가호>를 부여하고 상대에게 ${card.blindTurns}턴 동안 <눈부심>을 부여합니다. 챔피언의 가호: 공격력 +${Math.round(Number(card.attackBonusPercent || 0) * 100)}%, 크리티컬 확률 +${Math.round(Number(card.critBonus || 0) * 100)}%. 눈부심: 모든 공격 명중률 ${Math.round(Number(card.blindMissChance || 0.3) * 100)}% 감소.`;
    case 'winter_subordinate':
      return `파티원 중 가장 레벨이 낮은 1명에게 ${card.turns}턴 동안 <부하직원>을 부여합니다. 부하직원은 현재 레벨보다 +${card.levelBonus} 높게 간주되어 레벨 기반 공격력과 스킬에 적용됩니다.`;
    case 'potato_rehab':
      return `보스전에서 현재 데미지 ${Number(card.fixedDamage || POTATO_REHAB_BASE_DAMAGE).toLocaleString()}의 고정 피해를 1회 입힙니다. 노멀 보스에서는 피해와 막타 성장량이 1/3로 적용됩니다. 한 판당 1회만 사용 가능하며, 이 스킬로 적을 처치하면 데미지가 플레이어의 현재 레벨만큼 영구 증가합니다. 개인면담에서는 선택할 수 없고 강화할 수 없습니다.`;
    case 'precise_strike':
      return `자신의 레벨 x ${card.multiplierPerLevel}의 데미지를 1회 주며, 방어막을 무시하고 HP에 직접 피해를 입힙니다.`;
    case 'umbrella_copy':
      return `${card.canSelectCopyTarget ? '선택한' : '랜덤'} 파티원 1명의 카드 효과를 ${Math.round(Number(card.copyEffectMultiplier || 0.5) * 100)}%만 적용해 따라 합니다.`;
    case 'neo_pesticide':
      return `상대에게 ${card.turns || 2}턴 동안 <중독>을 적용합니다. 중독 중 공격할 때마다 스킬 시전자의 레벨 x ${card.damagePerLevel} 피해를 입습니다. 다단 타격은 매 타마다 적용됩니다.`;
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
  user.pendingNotifications.push({ type, text });
}

function markUserSeen(user, now = new Date()) {
  user.meta.lastSeenAt = now;
}

function consumeNotifications(user) {
  const notifications = [...user.pendingNotifications];
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
    gameState: toPlainMongoValue(user.gameState),
    inventory: toPlainMongoValue(user.inventory),
    cards: toPlainMongoValue(user.cards),
    enhancedCards: toPlainMongoValue(user.enhancedCards),
    equipments: toPlainMongoValue(user.equipments),
    equippedEquipment: toPlainMongoValue(user.equippedEquipment),
    equippedCardId: user.equippedCardId || null,
    equippedCardLevel: normalizeCardEnhancementLevel(user.equippedCardLevel || 0),
    buffs: toPlainMongoValue(user.buffs),
    titles: toPlainMongoValue(user.titles),
    emblems: toPlainMongoValue(user.emblems),
    pendingStockInvestment: toPlainMongoValue(user.pendingStockInvestment),
    shopState: toPlainMongoValue(user.shopState),
    meta: toPlainMongoValue(user.meta),
    pendingAdventure: toPlainMongoValue(user.pendingAdventure),
    pendingNotifications: toPlainMongoValue(user.pendingNotifications)
  };
}

async function persistUserSnapshot(user, options = {}) {
  const updateResult = await User.updateOne(
    { _id: user._id },
    {
      $set: buildUserPersistenceSnapshot(user),
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
    afterSave = null
  } = options;

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const user = await User.findById(userId);
    if (!user) {
      throw createHttpError(404, '사용자를 찾을 수 없습니다.');
    }

    ensureUserDefaults(user);
    const result = await mutateUser(user, attempt);

    try {
      await user.save();
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
        throw createHttpError(409, '요청이 겹쳐 처리에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
      throw err;
    }
  }

  if (isVersionConflictError(lastError)) {
    throw createHttpError(409, '요청이 겹쳐 처리에 실패했습니다. 잠시 후 다시 시도해주세요.');
  }
  throw lastError || createHttpError(500, '서버 오류가 발생했습니다.');
}

function cleanupExpiredBuffs(user, now = new Date()) {
  user.buffs = user.buffs.filter((buff) => new Date(buff.expiresAt) > now);
}

function removeAllDebuffs(user) {
  user.buffs = user.buffs.filter((buff) => BUFF_DATA[buff.buffId]?.category !== 'debuff');
}

function hasBuff(user, buffId, now = new Date()) {
  return user.buffs.some((buff) => buff.buffId === buffId && new Date(buff.expiresAt) > now);
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

function getInventoryQuantity(user, itemId) {
  return getInventoryItems(user, itemId).reduce((total, item) => total + Math.max(0, Number(item.quantity) || 0), 0);
}

function getCardQuantity(user, cardId) {
  return getCardEntry(user, cardId)?.quantity || 0;
}

function getEnhancedCardQuantity(user, cardId, level) {
  return getEnhancedCardEntry(user, cardId, level)?.quantity || 0;
}

function getOwnedCardVariantQuantity(user, cardId, level = 0) {
  const normalizedLevel = normalizeCardEnhancementLevel(level);
  return normalizedLevel <= 0 ? getCardQuantity(user, cardId) : getEnhancedCardQuantity(user, cardId, normalizedLevel);
}

function getTotalOwnedCardQuantity(user, cardId) {
  return getCardQuantity(user, cardId)
    + (user.enhancedCards || [])
      .filter((card) => card.cardId === cardId)
      .reduce((sum, card) => sum + Math.max(0, Number(card.quantity) || 0), 0);
}

function addItemToInventory(user, itemId, amount = 1) {
  if (amount <= 0) return;
  const item = getInventoryItem(user, itemId);
  if (item) {
    item.quantity += amount;
    const duplicateItems = getInventoryItems(user, itemId).slice(1);
    if (duplicateItems.length > 0) {
      item.quantity += duplicateItems.reduce((sum, entry) => sum + Math.max(0, Number(entry.quantity) || 0), 0);
      user.inventory = user.inventory.filter((entry, index) => entry.itemId !== itemId || index === user.inventory.indexOf(item));
    }
  } else {
    user.inventory.push({ itemId, quantity: amount });
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

  if (user.equippedCardId === cardId && getCardQuantity(user, cardId) <= 0) {
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
    displayName: user.nickname || user.username,
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

function clearQueuedRaidUser(userId, mode = null) {
  const modes = mode ? [normalizeRaidMode(mode)] : [RAID_MODE_NORMAL, RAID_MODE_HARD];
  modes.forEach((entryMode) => {
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

function getRaidRemainingEntries(user, now = new Date()) {
  syncRaidEntryState(user, now);
  return Math.max(0, getRaidEntryLimit(user, now) - Math.max(0, Number(user.meta.raidEntryUsedCount || 0)));
}

function isRaidAlreadyUsedToday(user, now = new Date()) {
  return getRaidRemainingEntries(user, now) <= 0;
}

function consumeRaidEntry(user, now = new Date()) {
  if (isRaidAlreadyUsedToday(user, now)) return false;
  user.meta.raidEntryUsedCount += 1;
  user.meta.lastRaidDayKey = getKSTDateKey(now);
  return true;
}

function refundRaidEntry(user, now = new Date()) {
  syncRaidEntryState(user, now);
  user.meta.raidEntryUsedCount = Math.max(0, Number(user.meta.raidEntryUsedCount || 0) - 1);
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

function buildQueuedSlotSnapshot(user) {
  const equippedCard = getEquippedCardInfo(user);
  return {
    userId: String(user._id),
    displayName: user.nickname || user.username,
    nickname: user.nickname || user.username,
    level: user.gameState.level,
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

function createRaidParticipantFromUser(user) {
  const equippedEquipment = getEquippedEquipment(user);
  const equippedCardEffect = equippedEquipment?.equipmentType === EQUIPMENT_TYPE_CARD ? equippedEquipment : null;
  const equippedBasicAttack = equippedEquipment?.equipmentType === EQUIPMENT_TYPE_ATTACK ? equippedEquipment : null;
  return {
    userId: String(user._id),
    displayName: user.nickname || user.username,
    nickname: user.nickname || user.username,
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
    plannedTargetUserId: null,
    plannedTargetUserId2: null,
    skillCooldown: 0,
    equippedCardId: user.equippedCardId || null,
    equippedCardLevel: normalizeCardEnhancementLevel(user.equippedCardLevel || 0),
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
    healShieldReductionTurns: 0,
    healShieldReductionMultiplier: 1,
    nextHitDamageTakenMultiplier: 1,
    negateHitCount: 0,
    debuffImmuneCount: 0,
    selfEsteemCount: 0,
    breadCount: 0,
    attackBonusTurns: 0,
    attackBonusPercent: 0,
    perHitBonusTurns: 0,
    perHitBonusDamage: 0,
    championGuardTurns: 0,
    championGuardAttackBonus: 0,
    championGuardCritBonus: 0,
    subordinateTurns: 0,
    subordinateLevelBonus: 0,
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
    nailBounceRemainingBounces: 0
  };
}

function setOrRefreshBuff(user, buffId, durationMs, options = {}) {
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

function getShopPricesForUser(user) {
  const prices = {};
  for (const itemId of Object.keys(ITEM_DATA)) {
    if (ITEM_DATA[itemId].shopHidden) continue;
    if (ITEM_DATA[itemId].type === 'special' && itemId !== 'business_card') continue;
    prices[itemId] = getItemPrice(user, itemId);
  }
  return prices;
}

function getTotalBuyPrice(user, itemId, quantity) {
  if (quantity <= 0) return 0;
  const itemInfo = ITEM_DATA[itemId];
  if (!itemInfo) return 0;

  if (itemId === 'business_card') {
    return 200000 * quantity;
  }

  if (!isPenShopItemId(itemId)) {
    return getItemPrice(user, itemId) * quantity;
  }

  const currentOwned = getInventoryQuantity(user, itemId);
  let total = 0;
  for (let offset = 0; offset < quantity; offset += 1) {
    total += Math.round(itemInfo.price * getMonamiPriceMultiplier(currentOwned + offset));
  }
  return total;
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

function applySupportPackage(user, packageId) {
  const packageInfo = SUPPORT_PACKAGE_DATA[packageId];
  if (!packageInfo) return null;
  packageInfo.rewards.forEach((reward) => {
    addItemToInventory(user, reward.itemId, reward.quantity);
  });
  return packageInfo;
}

function createAdminMailGiftPayload(giftType, giftId, quantity = 1, now = new Date()) {
  const giftQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

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

function applyAdminMailGiftToUser(user, mail) {
  ensureUserDefaults(user);

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
  await expireAdminMails(userId, now);
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
    { new: true }
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
      conflictLabel: 'Admin mail claim conflict'
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

function applyWorkDrops(user, attempts = 1) {
  const normalizedAttempts = Math.max(0, Math.floor(Number(attempts) || 0));
  const drops = [];
  for (let index = 0; index < normalizedAttempts; index += 1) {
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

async function fetchNewsTypingPrompts(force = false) {
  const now = Date.now();
  const cacheFresh = newsTypingCache.prompts.length
    && now - newsTypingCache.fetchedAt < (newsTypingCache.fallback ? NEWS_TYPING_FALLBACK_CACHE_TTL_MS : NEWS_TYPING_CACHE_TTL_MS);
  if (!force && cacheFresh) return newsTypingCache.prompts;

  const candidates = [];
  const fetchStats = [];
  await Promise.allSettled(NEWS_TYPING_RSS_FEEDS.map(async (url) => {
    try {
      const response = await fetchWithTimeout(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 IneoOfficeTypingGame/1.0',
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

function buildRaidParticipantStatusEffects(participant) {
  const effects = [];
  if (Number(participant.silenceTurns || 0) > 0) effects.push({ type: 'debuff', name: '침묵', turns: Number(participant.silenceTurns || 0), desc: '스킬 사용 불가' });
  if (Number(participant.actionLockTurns || 0) > 0) effects.push({ type: 'debuff', name: '가발 찾는중..', turns: Number(participant.actionLockTurns || 0), desc: '기본 공격, 스킬 사용 불가' });
  if (Number(participant.basicAttackLockTurns || 0) > 0) effects.push({ type: 'debuff', name: '울 아들 만나봐', turns: Number(participant.basicAttackLockTurns || 0), desc: '기본 공격 불가' });
  if (Number(participant.healShieldReductionTurns || 0) > 0) effects.push({ type: 'debuff', name: '꼰대', turns: Number(participant.healShieldReductionTurns || 0), desc: '회복량 및 실드 획득량 50% 감소' });
  if (Number(participant.nextHitDamageTakenMultiplier || 1) > 1) effects.push({ type: 'debuff', name: '4차까지?', desc: `다음 공격으로 받는 피해 x${Number(participant.nextHitDamageTakenMultiplier || 1).toFixed(1)}` });
  if (Number(participant.nailBounceDelayTurns || 0) > 0 && Number(participant.nailBounceDamage || 0) > 0) effects.push({ type: 'debuff', name: '튕겨나간 손톱', turns: Number(participant.nailBounceDelayTurns || 0), desc: `${Number(participant.nailBounceDamage || 0)} 피해 예정` });
  if (Number(participant.counterTurns || 0) > 0) effects.push({ type: 'buff', name: '반격', turns: Number(participant.counterTurns || 0), desc: '보스에게 피격당하면 기본 공격으로 반격' });
  if (Number(participant.negateHitCount || 0) > 0) effects.push({ type: 'buff', name: '피격 무효', count: Number(participant.negateHitCount || 0), desc: '다음 피격을 무효화' });
  if (Number(participant.debuffImmuneCount || 0) > 0) effects.push({ type: 'buff', name: '디버프 무효', count: Number(participant.debuffImmuneCount || 0), desc: '다음 디버프를 무효화' });
  if (Number(participant.selfEsteemCount || 0) > 0) effects.push({ type: 'buff', name: '자존감', count: Number(participant.selfEsteemCount || 0), desc: '다음 디버프를 반사합니다. 보스에게는 디버프 무효처럼 작동합니다.' });
  if (Number(participant.breadCount || 0) > 0) effects.push({ type: 'buff', name: '빵', count: Number(participant.breadCount || 0), desc: '피격 시 HP 5 회복 후 1개 소모' });
  if (Number(participant.critBonusTurns || 0) > 0) effects.push({ type: 'buff', name: '크리티컬 상승', turns: Number(participant.critBonusTurns || 0), desc: `치명타 확률 +${Math.round(Number(participant.critBonusValue || 0) * 100)}%` });
  if (Number(participant.hypeTurns || 0) > 0) effects.push({ type: 'buff', name: '흥겨움', turns: Number(participant.hypeTurns || 0), desc: '기본 공격 횟수 2배' });
  if (Number(participant.attackBonusTurns || 0) > 0) effects.push({ type: 'buff', name: '공격력 상승', turns: Number(participant.attackBonusTurns || 0), desc: `공격력 +${Math.round(Number(participant.attackBonusPercent || 0) * 100)}%` });
  if (Number(participant.championGuardTurns || 0) > 0) effects.push({ type: 'buff', name: '챔피언의 가호', turns: Number(participant.championGuardTurns || 0), desc: `공격력 +${Math.round(Number(participant.championGuardAttackBonus || 0) * 100)}%, 치명타 확률 +${Math.round(Number(participant.championGuardCritBonus || 0) * 100)}%` });
  if (Number(participant.subordinateTurns || 0) > 0) effects.push({ type: 'buff', name: '부하직원', turns: Number(participant.subordinateTurns || 0), desc: `레벨 +${Number(participant.subordinateLevelBonus || 0)}` });
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
  const isHardMode = getRaidModeFromBattle(battle) === RAID_MODE_HARD;
  if (isHardMode && battle.bossId === RAID_BOSS_ID) {
    effects.push({
      type: 'buff',
      name: '가시갑옷',
      desc: '1회 피격당할 때마다 공격자에게 5 피해를 반사합니다.'
    });
  }
  if (isHardMode && battle.bossId === RAID_BOSS_ID_BALD_MANAGER) {
    const stacks = Math.max(0, Number(battle.bossSmoothScalpStacks || 0));
    effects.push({
      type: 'buff',
      name: '매끈한 두피',
      count: stacks || null,
      desc: `1P 행동 시작부터 다음 1P 행동 시작 전까지 피격될 때마다 이후 받는 피해가 10%씩 곱연산으로 감소합니다.${stacks > 0 ? ` 현재 피해 수령 ${Math.round(Math.pow(0.9, stacks) * 100)}%` : ''}`
    });
  }
  if (isHardMode && battle.bossId === RAID_BOSS_ID_HOI) {
    effects.push({
      type: 'buff',
      name: '나 먼저 퇴근할게',
      desc: '매 공격을 20% 확률로 회피합니다.'
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

function buildDisplayName(user) {
  const titleInfo = getEquippedTitleDefinition(user);
  const baseName = user.nickname || user.username;
  const titlePrefix = titleInfo ? `<${titleInfo.name}>` : '';
  return `${titlePrefix}${baseName}`;
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
  return Number(target.healShieldReductionTurns || 0) > 0
    ? Number(target.healShieldReductionMultiplier || 1)
    : 1;
}

function getRaidLobbySummary(now = new Date(), mode = RAID_MODE_NORMAL) {
  const normalizedMode = normalizeRaidMode(mode);
  const modeConfig = getRaidModeConfig(normalizedMode);
  const boss = getRaidLobbyBoss(now, normalizedMode);
  const maxHp = Math.round(Number(boss.maxHp || 0) * Number(modeConfig.hpMultiplier || 1));
  const skillsText = normalizedMode === RAID_MODE_HARD && boss.hardPassiveText
    ? [boss.hardPassiveText, ...(boss.skillsText || [])]
    : (boss.skillsText || []);
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
    rewardsText: normalizedMode === RAID_MODE_HARD
      ? [...(boss.rewardsText || []), '하드 모드 보상: 노멀 보상의 1.5배']
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

function getParticipantCard(participant) {
  return participant?.equippedCardId ? getCardDefinition(participant.equippedCardId, participant.equippedCardLevel || 0) : null;
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
  target.silenceTurns = 0;
  target.actionLockTurns = 0;
  target.healShieldReductionTurns = 0;
  target.healShieldReductionMultiplier = 1;
  target.nextHitDamageTakenMultiplier = 1;
}


function getSelectableRaidTargets(battle) {
  return battle.participants.filter((participant) => participant.hp > 0).map((participant) => participant.userId);
}

function useRaidCardSkill(participant, battle) {
  const card = getParticipantCard(participant);
  if (!card || card.passiveOnly) return null;

  if (participant.silenceTurns > 0) {
    participant.silenceTurns = Math.max(0, participant.silenceTurns - 1);
    return `${participant.displayName}은(는) 침묵 상태라 스킬을 사용할 수 없습니다.`;
  }

  battle.bossOvertimeDebuffs = Array.isArray(battle.bossOvertimeDebuffs) ? battle.bossOvertimeDebuffs : [];
  const canResolveOvertime = card.effectType === 'overtime_rage'
    && battle.bossOvertimeDebuffs.some((entry) => entry.userId === participant.userId);
  if (!participant.plannedSkill || (participant.skillCooldown > 0 && !canResolveOvertime)) {
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

  participant.skillCooldown = card.cooldown + 1;
  participant.plannedSkill = false;
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
      ally.skillCooldown = Math.max(0, Number(ally.skillCooldown || 0) - reduceAmount);
    });
    logText = `${participant.displayName}(이)가 ${card.name}로 파티원들의 남은 스킬 쿨타임을 ${reduceAmount}턴 줄였습니다.`;
  } else if (card.effectType === 'target_heal') {
    const selectedTargetId = participant.plannedTargetUserId;
    const target = getRaidParticipant(battle, selectedTargetId) || getAliveRaidParticipants(battle)[0] || participant;
    const healAmount = scaleFlat(card.heal);
    const actualHeal = healRaidTarget(target, healAmount);
    logText = `${participant.displayName}(이)가 ${card.name}로 ${target.displayName}의 HP를 ${actualHeal.toLocaleString()} 회복시켰습니다.`;
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
      target.attackBonusTurns = Math.max(target.attackBonusTurns, card.turns);
      target.attackBonusPercent = Math.max(Number(target.attackBonusPercent || 0), attackBonusPercent);
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
      participant.skillCooldown = 0;
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
  } else if (card.effectType === 'lowest_level_buff') {
    const aliveAllies = getAliveRaidParticipants(battle);
    const target = aliveAllies.sort((a, b) => Number(a.level || 1) - Number(b.level || 1))[0] || participant;
    target.subordinateTurns = Math.max(Number(target.subordinateTurns || 0), Number(card.turns || 2));
    target.subordinateLevelBonus = Math.max(Number(target.subordinateLevelBonus || 0), Number(card.levelBonus || 10));
    logText = `${participant.displayName}(이)가 ${card.name}로 ${target.displayName}에게 <부하직원>을 부여했습니다. ${card.turns || 2}턴 동안 레벨 +${Number(card.levelBonus || 10)}로 간주됩니다.`;
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
      } else if (copiedCard.effectType === 'party_cooldown_reduce') {
        const reduceAmount = Math.max(1, Math.ceil(Number(copiedCard.cooldownReduce || 1) * copyScale));
        getAliveRaidParticipants(battle).forEach((ally) => {
          if (ally.userId === participant.userId) return;
          ally.skillCooldown = Math.max(0, Number(ally.skillCooldown || 0) - reduceAmount);
        });
        logText = `${participant.displayName}(이)가 ${sourceParticipant.displayName}의 ${copiedCard.name}를 흉내 내 파티원들의 남은 스킬 쿨타임을 ${reduceAmount}턴 줄였습니다.`;
      } else if (copiedCard.effectType === 'random_party_negate_hit' || copiedCard.effectType === 'party_negate_hit_by_level') {
        const targets = getAliveRaidParticipants(battle).sort(() => Math.random() - 0.5).slice(0, Math.max(1, Math.floor((Number(copiedCard.targets || 1) || 1) * copyScale)));
        targets.forEach((target) => {
          target.negateHitCount += Math.max(1, Math.floor((Number(copiedCard.negateHitCount || 1) || 1) * copyScale));
        });
        logText = `${participant.displayName}(이)가 ${sourceParticipant.displayName}의 ${copiedCard.name}를 흉내 내 방어 버프를 부여했습니다.`;
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
      target.attackBonusTurns = Math.max(target.attackBonusTurns, card.turns);
      target.attackBonusPercent = Math.max(Number(target.attackBonusPercent || 0), attackBonusPercent);
    });
    logText = `${participant.displayName}(이)가 ${card.name}로 ${shuffled.map((target) => target.displayName).join(', ')}의 공격력을 높였습니다.`;
  } else if (card.effectType === 'target_attack_buff') {
    const selectedTargetId = participant.plannedTargetUserId;
    const target = getRaidParticipant(battle, selectedTargetId) || getAliveRaidParticipants(battle)[0] || participant;
    const attackBonusPercent = scalePercent(card.attackBonusPercent);
    target.attackBonusTurns = Math.max(target.attackBonusTurns, card.turns);
    target.attackBonusPercent = Math.max(Number(target.attackBonusPercent || 0), attackBonusPercent);
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
  if (participant.skillCooldown > 0) participant.skillCooldown -= 1;
  if (participant.silenceTurns > 0) participant.silenceTurns -= 1;
  if (participant.actionLockTurns > 0) participant.actionLockTurns -= 1;
  if (participant.basicAttackLockTurns > 0) participant.basicAttackLockTurns -= 1;
  if (participant.healShieldReductionTurns > 0) {
    participant.healShieldReductionTurns -= 1;
    if (participant.healShieldReductionTurns <= 0) {
      participant.healShieldReductionMultiplier = 1;
    }
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
  if (participant.attackBonusTurns > 0) {
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
          target.nailBounceDelayTurns = Math.max(target.nailBounceDelayTurns, 1);
          target.nailBounceDamage = Math.max(0, pendingDamage - 10);
          target.nailBounceRemainingBounces = Math.max(0, Number(participant.nailBounceRemainingBounces || 0) - 1);
          battle.logs.push(`튕겨나간 손톱이 ${target.displayName}에게 튕겨갔습니다.`);
        }
      }
      participant.nailBounceDamage = 0;
      participant.nailBounceRemainingBounces = 0;
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
  const card = getParticipantCard(participant);
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
  const baseBonus = participant.attackBonusTurns > 0 ? Number(participant.attackBonusPercent || 0) : 0;
  const celineBonus = participant.celineTurns > 0 ? Number(participant.celineAttackBonusPercent || 0) : 0;
  const championBonus = participant.championGuardTurns > 0 ? Number(participant.championGuardAttackBonus || 0) : 0;
  return baseBonus + celineBonus + championBonus;
}

function isHardRaidBattle(battle) {
  return getRaidModeFromBattle(battle) === RAID_MODE_HARD;
}

function resetRaidBossRoundPassiveState(battle) {
  if (!battle) return;
  battle.bossSmoothScalpStacks = 0;
}

function applyHardRaidBossOnHitPassive(battle, attacker) {
  if (!battle || !attacker || !isHardRaidBattle(battle)) return;
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

function applyRaidDamageToBoss(battle, damage, options = {}) {
  const attacker = options.attacker || null;
  let incomingDamage = Math.max(0, Math.floor(Number(damage || 0)));
  if (attacker && isHardRaidBattle(battle) && battle.bossId === RAID_BOSS_ID_HOI && Math.random() < 0.2) {
    battle.bossLastHpLoss = 0;
    battle.logs.push(`HOI-M.S.J-50의 <나 먼저 퇴근할게>! ${attacker.displayName}의 공격을 회피했습니다.`);
    return 0;
  }
  if (attacker && isHardRaidBattle(battle) && battle.bossId === RAID_BOSS_ID_BALD_MANAGER) {
    const stacks = Math.max(0, Number(battle.bossSmoothScalpStacks || 0));
    if (stacks > 0) {
      incomingDamage = Math.max(0, Math.floor(incomingDamage * Math.pow(0.9, stacks)));
    }
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
      applyRaidDamageToBoss(battle, damage);
      totalDamage += damage;
      battle.logs.push(`${entry.displayName || '누군가'}의 중독 효과로 보스가 ${damage.toLocaleString()} 피해를 입었습니다.`);
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
  } else if (sequence.endTurnType === 'boss') {
    tickRaidBossPoisonDebuffs(battle);
    if (Number(battle.bossBlindTurns || 0) > 0) {
      battle.bossBlindTurns -= 1;
      if (battle.bossBlindTurns <= 0) battle.bossBlindMissChance = 0;
    }
    battle.turnIndex = 0;
  }

  battle.pendingSequence = null;
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
      const dealtDamage = applyRaidDamageToBoss(battle, hitDamage, { attacker: participant, skillName: '기본 공격' });
      incrementRaidOvertimeRageStacks(battle);
      battle.logs.push(`${participant.displayName}의 기본 공격 ${step.hitIndex + 1}타! ${dealtDamage.toLocaleString()} 피해를 입혔습니다.${isCritical ? ' (치명타)' : ''}`);
    }
  } else if (step.type === 'player_fixed_skill_hit') {
    const participant = getRaidParticipant(battle, step.userId);
    if (participant && participant.hp > 0 && battle.bossHp > 0) {
      const dealtDamage = applyRaidDamageToBoss(battle, step.damage, { attacker: participant, skillName: step.skillName });
      battle.logs.push(`${participant.displayName}의 ${step.skillName} ${step.hitIndex + 1}타! ${dealtDamage.toLocaleString()} 피해를 입혔습니다.`);
    }
  } else if (step.type === 'boss_random_hit') {
    const bossInfo = RAID_BOSS_DATA[battle.bossId] || RAID_BOSS_DATA[RAID_BOSS_ID];
    if (Number(battle.bossBlindTurns || 0) > 0 && Math.random() < Number(battle.bossBlindMissChance || 0.3)) {
      battle.logs.push(`${bossInfo.name}의 ${step.skillName} ${step.hitIndex + 1}타는 눈부심 때문에 빗나갔습니다.`);
      return true;
    }
    const currentAlive = getAliveRaidParticipants(battle);
    if (currentAlive.length > 0) {
      const target = currentAlive[Math.floor(Math.random() * currentAlive.length)];
      applyRaidDamage(target, Number(step.damage || 0), { battle, source: 'boss' });
      battle.logs.push(`${bossInfo.name}의 ${step.skillName} ${step.hitIndex + 1}타! ${target.displayName}에게 ${Number(step.damage || 0).toLocaleString()} 피해를 입혔습니다.`);
    }
  } else if (step.type === 'boss_all_hit') {
    const bossInfo = RAID_BOSS_DATA[battle.bossId] || RAID_BOSS_DATA[RAID_BOSS_ID];
    if (Number(battle.bossBlindTurns || 0) > 0 && Math.random() < Number(battle.bossBlindMissChance || 0.3)) {
      battle.logs.push(`${bossInfo.name}의 ${step.skillName} ${step.hitIndex + 1}타는 눈부심 때문에 빗나갔습니다.`);
      return true;
    }
    const currentAlive = getAliveRaidParticipants(battle);
    currentAlive.forEach((target) => {
      applyRaidDamage(target, Number(step.damage || 0), { battle, source: 'boss' });
    });
    battle.logs.push(`${bossInfo.name}의 ${step.skillName} ${step.hitIndex + 1}타! 파티 전체가 ${Number(step.damage || 0).toLocaleString()} 피해를 받았습니다.`);
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
    target.lastShieldLoss = 0;
    target.lastHpLoss = 0;
    return 0;
  }

  let remainingDamage = Number(damage || 0);
  if (Number(target.nextHitDamageTakenMultiplier || 1) > 1) {
    remainingDamage = Math.floor(remainingDamage * Number(target.nextHitDamageTakenMultiplier || 1));
    target.nextHitDamageTakenMultiplier = 1;
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

function performRaidBossAction(battle) {
  const bossInfo = RAID_BOSS_DATA[battle.bossId] || RAID_BOSS_DATA[RAID_BOSS_ID];
  if (battle.bossShieldTurns > 0) {
    battle.bossShieldTurns -= 1;
    if (battle.bossShieldTurns <= 0) {
      battle.bossShield = 0;
    }
  }
  const pattern = bossInfo.patternOrder[battle.bossPatternIndex % bossInfo.patternOrder.length];
  battle.bossPatternIndex += 1;
  const aliveParticipants = getAliveRaidParticipants(battle);
  if (aliveParticipants.length === 0) return `${bossInfo.name}이(가) 승리의 포즈를 취했습니다.`;

  if (battle.bossId === RAID_BOSS_ID_HOI) {
    if (pattern === 'son_brag') {
      const targets = [...aliveParticipants].sort(() => Math.random() - 0.5).slice(0, Math.min(2, aliveParticipants.length));
      const affectedNames = [];
      const resistedNames = [];
      aliveParticipants.forEach((participant) => {
        const removedBuffCount = buildRaidParticipantStatusEffects(participant).filter((effect) => effect.type === 'buff').length;
        if (removedBuffCount > 0) {
          applyRaidDamage(participant, removedBuffCount * 10, { battle, source: 'boss', allowCounter: false });
        }
        participant.critBonusTurns = 0;
        participant.critBonusValue = 0;
        participant.hypeTurns = 0;
        participant.counterTurns = 0;
        participant.counterDamageMultiplier = 1;
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
          participant.basicAttackLockTurns = Math.max(participant.basicAttackLockTurns, 2);
          affectedNames.push(participant.displayName);
        }
      });
      clearRoundShieldEffects(battle);
      return `HOI-M.S.J-50의 아들자랑 MK.1! 전원의 버프를 제거하고 ${affectedNames.join(', ') || '대상 없음'}에게 울 아들 만나봐 디버프를 적용했습니다.${resistedNames.length ? ` ${resistedNames.join(', ')} 은(는) 디버프를 막아냈습니다.` : ''}`;
    }

    if (pattern === 'son_mix') {
      const bossBuffCount = Math.max(0, Number(battle.bossNegateHits || 0));
      if (bossBuffCount > 0) {
        const healAmount = bossBuffCount * 6000;
        battle.bossHp = Math.min(battle.bossMaxHp, battle.bossHp + healAmount);
        battle.bossLastHpLoss = 0;
        return `HOI-M.S.J-50의 아들이랑 엮기 MK.2! 보유 버프 ${bossBuffCount}개로 HP를 ${healAmount.toLocaleString()} 회복했습니다.`;
      }
      battle.bossShield = Number(battle.bossShield || 0) + 5000;
      battle.bossShieldTurns = Math.max(Number(battle.bossShieldTurns || 0), 1);
      battle.bossLastHpLoss = 0;
      return 'HOI-M.S.J-50의 아들이랑 엮기 MK.2! 버프가 없어 보호막 5000을 얻었습니다.';
    }

    if (pattern === 'ass_hit') {
      const steps = [];
      for (let count = 0; count < 3; count += 1) {
        steps.push({
          type: 'boss_all_hit',
          skillName: 'ASS-HIT MK.3',
          damage: 10,
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
      const target = aliveParticipants[Math.floor(Math.random() * aliveParticipants.length)];
      if (!applyRaidDebuffImmunity(target)) {
        target.nailBounceDelayTurns = Math.max(target.nailBounceDelayTurns, 1);
        target.nailBounceDamage = Math.max(target.nailBounceDamage, 40);
        target.nailBounceRemainingBounces = Math.max(target.nailBounceRemainingBounces, 2);
        return `HOI-M.S.J-50의 손 톱 깎 기! ${target.displayName}에게 튕겨나간 손톱 디버프를 부여했습니다.`;
      }
      return `HOI-M.S.J-50의 손 톱 깎 기! ${target.displayName}은(는) 디버프를 막아냈습니다.`;
    }

    if (pattern === 'food_question') {
      aliveParticipants.forEach((participant) => {
        applyRaidDamage(participant, 20, { battle, source: 'boss' });
      });
      battle.bossNegateHits = Number(battle.bossNegateHits || 0) + 10;
      clearRoundShieldEffects(battle);
      return 'HOI-M.S.J-50의 먹고 싶은거 있어?! 파티 전체에게 20 피해를 주고 피격 무효 10회를 얻었습니다.';
    }
  }

  if (battle.bossId === RAID_BOSS_ID_BALD_MANAGER) {
    if (pattern === 'wig_search') {
      const wigTargets = aliveParticipants.filter((participant) => participant.equippedCardId === 'wig');
      if (wigTargets.length > 0) {
        const target = wigTargets[Math.floor(Math.random() * wigTargets.length)];
        applyRaidDamage(target, 20, { battle, source: 'boss' });
        target.damageMultiplierTurns = Math.max(target.damageMultiplierTurns, 1);
        target.damageMultiplierValue = Math.max(Number(target.damageMultiplierValue || 1), 2.5);
        clearRoundShieldEffects(battle);
        return `대머리 김부장의 어이쿠 가발이 여기있네..! ${target.displayName}에게 20 피해를 입히고 <수고했네> 버프를 부여했습니다.`;
      }

      const targets = [...aliveParticipants]
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(3, aliveParticipants.length));
      const lockedNames = [];
      const resistedNames = [];
      targets.forEach((participant) => {
        applyRaidDamage(participant, 20, { battle, source: 'boss' });
        if (applyRaidDebuffImmunity(participant)) {
          resistedNames.push(participant.displayName);
        } else {
          participant.actionLockTurns = Math.max(participant.actionLockTurns, 2);
          lockedNames.push(participant.displayName);
        }
      });
      const lockedText = lockedNames.length ? `${lockedNames.join(', ')} 이(가) 2턴 동안 가발 찾는중.. 상태에 빠졌습니다.` : '모든 대상이 디버프를 막아냈습니다.';
      const resistedText = resistedNames.length ? ` ${resistedNames.join(', ')} 은(는) 디버프를 막아냈습니다.` : '';
      clearRoundShieldEffects(battle);
      return `대머리 김부장의 내 가발 어디갔어?! 대상 3명이 20 피해를 받았습니다. ${lockedText}${resistedText}`;
    }

    if (pattern === 'mz') {
      const targets = [...aliveParticipants]
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(4, aliveParticipants.length));
      const debuffedNames = [];
      const resistedNames = [];
      targets.forEach((participant) => {
        applyRaidDamage(participant, 10, { battle, source: 'boss' });
        if (applyRaidDebuffImmunity(participant)) {
          resistedNames.push(participant.displayName);
        } else {
          participant.healShieldReductionTurns = Math.max(participant.healShieldReductionTurns, 2);
          participant.healShieldReductionMultiplier = Math.min(Number(participant.healShieldReductionMultiplier || 1), 0.5);
          debuffedNames.push(participant.displayName);
        }
      });
      const debuffedText = debuffedNames.length ? `${debuffedNames.join(', ')} 이(가) 꼰대 디버프에 걸렸습니다.` : '모든 대상이 디버프를 막아냈습니다.';
      const resistedText = resistedNames.length ? ` ${resistedNames.join(', ')} 은(는) 디버프를 막아냈습니다.` : '';
      clearRoundShieldEffects(battle);
      return `대머리 김부장의 허허, 요즘 엠제트세대란..! 대상 4명이 10 피해를 받았습니다. ${debuffedText}${resistedText}`;
    }

    if (pattern === 'afterparty') {
      battle.bossShield = Number(battle.bossShield || 0) + 7000;
      battle.bossShieldTurns = Math.max(Number(battle.bossShieldTurns || 0), 2);
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
      return `대머리 김부장의 비기: 회식은 3차부터! 2턴 지속되는 7000의 실드를 획득했습니다. ${appliedText}${resistedText}`;
    }

    if (pattern === 'sauna') {
      aliveParticipants.forEach((participant) => {
        applyRaidDamage(participant, 20, { battle, source: 'boss' });
      });
      clearRoundShieldEffects(battle);
      return '대머리 김부장의 사우나나 갈까?! 파티 전체가 20 피해를 받았습니다.';
    }

    return '대머리 김부장이 뒷짐을 지고 숨을 골랐습니다.';
  }

  if (pattern === 'burp') {
    aliveParticipants.forEach((participant) => {
      applyRaidDamage(participant, 30, { battle, source: 'boss' });
    });
    clearRoundShieldEffects(battle);
    return '트름녀의 트름하기! 파티 전체가 30 피해를 받았습니다.';
  }

  if (pattern === 'ice') {
    const targets = [...aliveParticipants]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(3, aliveParticipants.length));
    const silencedNames = [];
    const resistedNames = [];
    targets.forEach((participant) => {
      applyRaidDamage(participant, 30, { battle, source: 'boss' });
      if (applyRaidDebuffImmunity(participant)) {
        resistedNames.push(participant.displayName);
      } else {
        participant.silenceTurns = Math.max(participant.silenceTurns, 1);
        silencedNames.push(participant.displayName);
      }
    });
    const silencedText = silencedNames.length ? `${silencedNames.join(', ')} 이(가) 1턴 침묵에 걸렸습니다.` : '모든 대상이 침묵을 막아냈습니다.';
    const resistedText = resistedNames.length ? ` ${resistedNames.join(', ')} 은(는) 디버프를 막아냈습니다.` : '';
    clearRoundShieldEffects(battle);
    return `트름녀의 얼음씹기! 대상 3명이 30 피해를 받았습니다. ${silencedText}${resistedText}`;
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
    battle.bossShield = Number(battle.bossShield || 0) + 10000;
    battle.bossShieldTurns = Math.max(Number(battle.bossShieldTurns || 0), 1);
    battle.bossLastHpLoss = 0;
    clearRoundShieldEffects(battle);
    return '트름녀의 눈 새 행동! 1턴 지속되는 10000의 실드를 획득했습니다.';
  }

  return `${bossInfo.name}이(가) 잠시 숨을 골랐습니다.`;
}

function buildRaidBattleSnapshot(activeBattle, viewerUserId = null) {
  if (!activeBattle) return null;
  const bossData = RAID_BOSS_DATA[activeBattle.bossId] || RAID_BOSS_DATA[RAID_BOSS_ID];
  const battleMode = getRaidModeFromBattle(activeBattle);
  const room = getRaidRoom(battleMode);
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
    phase: activeBattle.phase,
    currentTurnIndex: activeBattle.turnIndex,
    bossPatternIndex: activeBattle.bossPatternIndex,
    nextActionAt: activeBattle.nextActionAt,
    countdownEndsAt: activeBattle.countdownEndsAt || null,
    readyEndsAt: activeBattle.readyEndsAt || null,
    isParticipant: viewerUserId ? isRaidUserParticipant(activeBattle, viewerUserId) : false,
    spectators: buildSpectatorList(room.viewers, activeBattle.participants.map((participant) => participant.userId)),
    participants: activeBattle.participants.map((participant, index) => {
      const card = getParticipantCard(participant);
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
        plannedTargetUserId: participant.plannedTargetUserId || null,
        plannedTargetUserId2: participant.plannedTargetUserId2 || null,
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
  if (isHardRaidBattle(activeBattle)) {
    const bossInfo = RAID_BOSS_DATA[activeBattle.bossId] || RAID_BOSS_DATA[RAID_BOSS_ID];
    if (bossInfo.hardPassiveText) {
      activeBattle.logs.push(`${bossInfo.name} 하드 패시브 적용: ${bossInfo.hardPassiveText.replace(/^패시브\.\s*/, '')}`);
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
  const sojuCards = activeBattle.participants
    .map((participant) => getParticipantCard(participant))
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
    .map((participant) => getParticipantCard(participant))
    .filter((card) => card?.id === 'lotto_numbers');
  if (lottoCards.length) {
    const successChance = Math.max(...lottoCards.map((card) => Number(card.successChance || 0.5)));
    activeBattle.participants.forEach((participant) => {
      participant.lottoRewardBuff = true;
      participant.lottoRewardSuccessChance = successChance;
    });
    activeBattle.logs.push('모래의 로또번호가 파티 전원에게 이번엔 될거같아 버프를 부여했습니다.');
  }
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

async function buildRaidStateResponse(user, now = new Date(), mode = RAID_MODE_NORMAL) {
  try {
    pruneExpiredRaidQueue(null, now);
    await advanceRaidState(now);
  } catch (err) {
    console.error('Raid state reconciliation error:', err);
    [RAID_MODE_NORMAL, RAID_MODE_HARD].forEach((entryMode) => clearActiveRaidBattle(entryMode));
  }

  const normalizedMode = normalizeRaidMode(mode);
  const room = getRaidRoom(normalizedMode);
  const queuedUserIds = room.slots.filter(Boolean);
  const queuedUsers = queuedUserIds.length
    ? await User.find({ _id: { $in: queuedUserIds } }).select('nickname username gameState.level equippedCardId equippedCardLevel cards enhancedCards titles')
    : [];
  const queuedMap = new Map(queuedUsers.map((queuedUser) => [String(queuedUser._id), queuedUser]));

  const slots = room.slots.map((slotUserId) => {
    if (!slotUserId) return null;
    const queuedUser = queuedMap.get(String(slotUserId));
    if (!queuedUser) return null;
    ensureUserDefaults(queuedUser);
    return buildQueuedSlotSnapshot(queuedUser);
  });

  const slotIndex = findQueuedRaidSlotIndex(user._id, normalizedMode);
  const queueRemainingMs = slotIndex >= 0 ? getRaidQueueRemainingMs(user._id, normalizedMode, now) : null;
  return {
    version: raidState.version,
    mode: normalizedMode,
    modes: [RAID_MODE_NORMAL, RAID_MODE_HARD].map((entryMode) => buildRaidModeStatus(user, entryMode, now)),
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
      [RAID_MODE_HARD]: buildRaidBattleSnapshot(getRaidRoom(RAID_MODE_HARD).activeBattle, user._id)
    }
  };
}

function bumpPvpVersion() {
  pvpState.version = (Number(pvpState.version || 0) + 1) % Number.MAX_SAFE_INTEGER;
}

function normalizePvpMode(mode) {
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
  return [PVP_MODE_RANKED, PVP_MODE_NORMAL].map((mode) => [mode, getPvpModeState(mode)]);
}

function isRankedPvpMode(mode) {
  return normalizePvpMode(mode) === PVP_MODE_RANKED;
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

function getPvpPickTurnPlayerId(match) {
  const pickTurnIndex = Number(match?.pickTurnIndex || 0);
  if (pickTurnIndex < 0 || pickTurnIndex >= PVP_PICK_SEQUENCE_INDICES.length) return null;
  const playerIndex = PVP_PICK_SEQUENCE_INDICES[pickTurnIndex] ?? 0;
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

    while (match.pickTurnIndex < PVP_PICK_SEQUENCE_INDICES.length && guard <= PVP_PICK_SEQUENCE_INDICES.length) {
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
  match.pickTurnIndex = Math.max(Number(match.pickTurnIndex || 0), PVP_PICK_SEQUENCE_INDICES.length);
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

function createPvpParticipantFromUser(user, match, picks) {
  const equippedEquipment = getEquippedEquipment(user);
  const equippedCardEffect = equippedEquipment?.equipmentType === EQUIPMENT_TYPE_CARD ? equippedEquipment : null;
  const equippedBasicAttack = equippedEquipment?.equipmentType === EQUIPMENT_TYPE_ATTACK ? equippedEquipment : null;
  return {
    userId: String(user._id),
    displayName: user.nickname || user.username,
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
    cards: (picks || []).map((pick, index) => {
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

  const battle = {
    battleId: crypto.randomUUID(),
    mode: normalizePvpMode(match.mode),
    modeLabel: getPvpModeLabel(match.mode),
    isRanked: isRankedPvpMode(match.mode),
    phase: 'active',
    players,
    firstUserId: match.players[0].userId,
    currentUserId: match.players[0].userId,
    turnNumber: 1,
    turnEndsAt: new Date(now.getTime() + PVP_BATTLE_TURN_MS),
    logs: ['개인면담이 시작되었습니다.'],
    winnerUserId: null,
    loserUserId: null,
    finishedAt: null,
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
  const attackDeck = normalizeInfiniteOvertimeDeck(user.infiniteOvertime?.attackDeck || []);
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

function getInfiniteOvertimeBot(battle) {
  return battle?.players?.find((player) => player.isBot) || null;
}

function buildInfiniteOvertimeReward(floor) {
  const ratio = Math.max(0, Math.min(1, (Number(floor || 1) - 1) / Math.max(1, INFINITE_OVERTIME_MAX_FLOOR - 1)));
  const rewardTypes = [
    { type: 'fragment', itemId: 'equipment_fragment', min: 50, max: 400, label: '장비 파편' },
    { type: 'business_card', itemId: 'business_card', min: 10, max: 50, label: '명함' },
    { type: 'bacchus', itemId: 'bacchus', min: 30, max: 60, label: '박카스' },
    { type: 'raid_ticket', itemId: 'raid_entry_ticket', min: 2, max: 10, label: '회의 추가 입장권' }
  ];
  const picked = rewardTypes[Math.floor(Math.random() * rewardTypes.length)];
  const amount = Math.max(1, Math.round(Number(picked.min || 1) + ((Number(picked.max || picked.min) - Number(picked.min || 1)) * ratio)));
  return {
    ...picked,
    quantity: amount,
    text: `${picked.label} ${amount.toLocaleString()}개`
  };
}

function grantInfiniteOvertimeReward(user, battle) {
  if (!battle || battle.rewardGranted) return battle?.reward || null;
  const reward = buildInfiniteOvertimeReward(battle.floor);
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
  } else if (Number(plannedIndex) >= 0) {
    const used = applyPvpCardSkill(actor, target, battle, Number(plannedIndex));
    if (!used) {
      battle.logs.push(`${actor.displayName}의 스킬은 사용할 수 없어 기본 공격만 진행합니다.`);
    }
  } else if (options.botAutoSkill) {
    let usedSkill = false;
    for (let index = 0; index < (actor.cards || []).length; index += 1) {
      if (!isInfiniteOvertimeBotSkillCandidateUsable(actor, target, battle, index)) continue;
      if (applyPvpCardSkill(actor, target, battle, index)) {
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

async function executeInfiniteOvertimePlayerAction(user, cardIndex = null) {
  const userId = String(user._id);
  const battle = getInfiniteOvertimeBattle(userId);
  if (!battle || battle.phase !== 'active') throw createHttpError(400, '진행 중인 무한야근 전투가 없습니다.');
  const player = getInfiniteOvertimePlayer(battle);
  const bot = getInfiniteOvertimeBot(battle);
  if (!player || !bot) throw createHttpError(400, '전투 정보를 찾을 수 없습니다.');

  executeInfiniteOvertimeSingleTurn(battle, player, bot, Number.isInteger(cardIndex) ? cardIndex : null);
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

function getPvpAttackBonus(player) {
  return player.buffs
    .filter((buff) => ['attack_bonus', 'celine', 'damage_multiplier', 'champion_guard'].includes(buff.id) && !buff.pendingActivation)
    .reduce((sum, buff) => {
      if (buff.id === 'damage_multiplier') return sum + (Number(buff.value || 1) - 1);
      return sum + Number(buff.value || 0);
    }, 0);
}

function getPvpEffectiveLevel(player) {
  const subordinateBonus = (player.buffs || [])
    .filter((buff) => buff.id === 'subordinate_level' && !buff.pendingActivation)
    .reduce((max, buff) => Math.max(max, Number(buff.value || 0)), 0);
  return Number(player.level || 1) + subordinateBonus;
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
  const negateBuff = target.buffs.find((buff) => buff.id === 'negate_hit' && Number(buff.count || 0) > 0);
  if (!options.ignoreNegate && negateBuff) {
    negateBuff.count -= 1;
    if (negateBuff.count <= 0) target.buffs = target.buffs.filter((buff) => buff !== negateBuff);
    target.lastHpLoss = 0;
    target.lastShieldLoss = 0;
    battle.logs.push(`${target.displayName}의 피격 무효가 공격을 막았습니다.`);
    return 0;
  }

  let remaining = Math.max(0, Math.floor(Number(amount || 0)));
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
  target.hp = Math.max(0, Number(target.hp || 0) - remaining);
  target.lastHpLoss = remaining;
  target.lastShieldLoss = shieldLoss;
  if (!options.skipBread && battle && (shieldLoss > 0 || remaining > 0)) {
    consumePvpBreadBuff(target, battle);
  }
  return remaining;
}

function healPvpTarget(target, amount) {
  const previousHp = Number(target.hp || 0);
  target.hp = Math.min(Number(target.maxHp || PVP_MAX_HP), previousHp + Math.max(0, Math.floor(Number(amount || 0))));
  return Number(target.hp || 0) - previousHp;
}

function grantPvpTemporaryShield(target, amount, expiresAfterUserId) {
  if (!target || target.hp <= 0) return 0;
  const shieldAmount = Math.max(0, Math.floor(Number(amount || 0)));
  if (shieldAmount <= 0) return 0;
  target.shield = Number(target.shield || 0) + shieldAmount;
  target.tempShieldAmount = Number(target.tempShieldAmount || 0) + shieldAmount;
  target.shieldExpiresAfterUserId = String(expiresAfterUserId || '');
  return shieldAmount;
}

function clearPvpShieldsExpiredByUserTurn(battle, userId) {
  if (!battle?.players?.length) return;
  battle.players.forEach((player) => {
    if (player.shieldExpiresAfterUserId !== String(userId)) return;
    const remainingTempShield = Number(player.tempShieldAmount || 0);
    if (remainingTempShield > 0) {
      player.shield = Math.max(0, Number(player.shield || 0) - remainingTempShield);
    }
    player.tempShieldAmount = 0;
    player.shieldExpiresAfterUserId = null;
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
    actor.extraHits = Math.max(Number(actor.extraHits || 0), scaleCount(card.hits) - 1);
    actor.multiHitDamageMultiplier = 0.9;
  } else if (card.effectType === 'self_fixed_multi_hit') {
    const hits = Math.max(1, Number(card.hits || 1));
    const damage = Math.max(1, scaleFlat(getPvpEffectiveLevel(actor) * Number(card.damagePerLevel || 0) * 0.9));
    for (let index = 0; index < hits; index += 1) {
      if (isPvpAttackMissed(actor, battle, `${cardLabel} ${index + 1}타`)) continue;
      applyPvpDamage(target, damage, battle);
      battle.logs.push(`${cardLabel} ${index + 1}타! ${target.displayName}에게 ${damage.toLocaleString()} 피해를 입혔습니다.`);
      triggerPvpPoisonOnAttack(actor, battle);
      if (target.hp > 0) performPvpCounterAttack(target, actor, battle);
      if (actor.hp <= 0 || target.hp <= 0) break;
    }
  } else if (card.effectType === 'party_level_blast') {
    const totalLevels = battle.players.reduce((sum, player) => sum + getPvpEffectiveLevel(player), 0);
    const damage = scaleFlat(totalLevels * Number(card.multiplierPerLevel || 0));
    if (!isPvpAttackMissed(actor, battle, cardLabel)) {
      applyPvpDamage(target, damage, battle);
      battle.logs.push(`${target.displayName}에게 ${damage.toLocaleString()} 피해를 입혔습니다.`);
      triggerPvpPoisonOnAttack(actor, battle);
    }
  } else if (card.effectType === 'direct_hp_strike') {
    const damage = scaleFlat(getPvpEffectiveLevel(actor) * Number(card.multiplierPerLevel || 0));
    if (!isPvpAttackMissed(actor, battle, cardLabel)) {
      applyPvpDamage(target, damage, battle, { ignoreShield: true });
      battle.logs.push(`${target.displayName}의 보호막을 무시하고 ${damage.toLocaleString()} 피해를 입혔습니다.`);
      triggerPvpPoisonOnAttack(actor, battle);
    }
  } else if (card.effectType === 'party_hype_crit') {
    addPvpBuff(actor, { id: 'crit_bonus', name: '크리티컬 상승', turns: Number(card.turns || 1), value: scalePercent(card.critBonus), desc: `치명타 확률 +${Math.round(scalePercent(card.critBonus) * 100)}%` });
    addPvpBuff(actor, { id: 'hype', name: '흥겨움', turns: Number(card.hypeTurns || 1), desc: '기본 공격 횟수 2배' });
    grantPvpTemporaryShield(actor, scaleFlat(card.shield || 0), target.userId);
  } else if (card.effectType === 'party_shield' || card.effectType === 'random_shield') {
    grantPvpTemporaryShield(actor, scaleFlat(card.shield || 0), target.userId);
  } else if (card.effectType === 'party_heal' || card.effectType === 'target_heal') {
    const healed = healPvpTarget(actor, scaleFlat(card.heal || 0));
    battle.logs.push(`${actor.displayName}의 HP가 ${healed.toLocaleString()} 회복되었습니다.`);
  } else if (card.effectType === 'party_crit_bonus') {
    addPvpBuff(actor, { id: 'crit_bonus', name: '크리티컬 상승', turns: Number(card.turns || 1), value: scalePercent(card.critBonus), desc: `치명타 확률 +${Math.round(scalePercent(card.critBonus) * 100)}%` });
  } else if (card.effectType === 'self_celine_buff') {
    addPvpBuff(actor, { id: 'celine', name: '셀린느', turns: Number(card.turns || 1), value: scalePercent(card.attackBonusPercent), expireDamage: scaleFlat(getPvpEffectiveLevel(actor) * Number(card.expireDamagePerLevel || 0)), desc: `공격력 +${Math.round(scalePercent(card.attackBonusPercent) * 100)}%, 종료 시 피해` });
  } else if (card.effectType === 'self_counter') {
    addPvpBuff(actor, { id: 'counter', name: '반격', turns: Number(card.turns || 1) + 1, value: Number(card.counterDamageMultiplier || 1), desc: '피격 시 반격' });
    battle.logs.push(`${actor.displayName}이(가) ${Number(card.turns || 1)}턴 동안 반격 태세에 들어갔습니다.`);
  } else if (card.effectType === 'random_ally_sacrifice_buff') {
    const selfDamage = applyPvpDamage(actor, Number(card.selfDamage || 0), battle, { ignoreNegate: true, skipBread: true });
    const damageMultiplier = Number(card.damageMultiplier || 2);
    addPvpBuff(actor, {
      id: 'damage_multiplier',
      name: '피해 증폭',
      turns: 1,
      value: damageMultiplier,
      pendingActivation: true,
      desc: `다음 자신의 공격 피해 x${damageMultiplier.toFixed(1)}`
    });
    battle.logs.push(`${actor.displayName}의 HP가 ${selfDamage.toLocaleString()} 감소하고, 다음 자신의 공격 피해가 ${damageMultiplier.toFixed(1)}배가 됩니다.`);
  } else if (card.effectType === 'party_cleanse') {
    clearPvpDebuffs(actor, battle);
  } else if (card.effectType === 'party_bread_buff') {
    const breadCount = scaleCount(card.breadCount || 0);
    const breadHeal = Number(card.breadHeal || 5);
    addPvpBuff(actor, {
      id: 'bread',
      name: '빵',
      count: breadCount,
      heal: breadHeal,
      desc: `피격 시 HP ${breadHeal} 회복 후 1개 소모`
    });
    battle.logs.push(`${actor.displayName}이(가) 빵 ${breadCount}개를 챙겼습니다.`);
  } else if (card.effectType === 'party_cooldown_reduce') {
    const reduceAmount = scaleCount(card.cooldownReduce || 1);
    actor.cards.forEach((entry) => {
      entry.cooldownRemaining = Math.max(0, Number(entry.cooldownRemaining || 0) - reduceAmount);
    });
    battle.logs.push(`${actor.displayName}의 모든 카드 남은 쿨타임이 ${reduceAmount}턴 감소했습니다.`);
  } else if (card.effectType === 'self_bonus_damage') {
    actor.extraDamage = scaleFlat(getPvpEffectiveLevel(actor) * Number(card.bonusPerLevel || 0));
  } else if (card.effectType === 'self_per_hit_bonus') {
    actor.perHitBonusDamage = scaleFlat(getPvpEffectiveLevel(actor) * Number(card.bonusPerLevel || 0));
    actor.perHitBonusTurns = 1;
  } else if (card.effectType === 'target_pair_guard_buff') {
    const negateHitCount = Number(card.negateHitCount || 0) > 0 ? scaleCount(card.negateHitCount) : 0;
    if (negateHitCount > 0) {
      addPvpBuff(actor, { id: 'negate_hit', name: '피격 무효', count: negateHitCount, desc: '피격 무효' });
    }
    addPvpBuff(actor, { id: 'debuff_guard', name: '디버프 무효', count: scaleCount(card.debuffImmuneCount || 1), desc: '디버프 무효' });
    addPvpBuff(actor, { id: 'attack_bonus', name: '공격력 상승', turns: Number(card.turns || 1), value: scalePercent(card.attackBonusPercent), desc: `공격력 +${Math.round(scalePercent(card.attackBonusPercent) * 100)}%` });
  } else if (card.effectType === 'random_party_negate_hit' || card.effectType === 'party_negate_hit_by_level') {
    addPvpBuff(actor, { id: 'negate_hit', name: '피격 무효', count: scaleCount(card.negateHitCount || 1), desc: '피격 무효' });
  } else if (card.effectType === 'random_party_attack_buff' || card.effectType === 'target_attack_buff') {
    addPvpBuff(actor, { id: 'attack_bonus', name: '공격력 상승', turns: Number(card.turns || 1), value: scalePercent(card.attackBonusPercent), desc: `공격력 +${Math.round(scalePercent(card.attackBonusPercent) * 100)}%` });
  } else if (card.effectType === 'target_debuff_guard') {
    addPvpBuff(actor, { id: 'debuff_guard', name: '디버프 무효', count: scaleCount(card.debuffImmuneCount || 1), desc: '디버프 무효' });
  } else if (card.effectType === 'self_status_blast') {
    const statusCount = actor.buffs.length + actor.debuffs.length;
    const hits = Math.max(1, Number(card.hits || 1));
    const damage = scaleFlat(statusCount * getPvpEffectiveLevel(actor) * Number(card.multiplierPerStatus || 0));
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
      const damage = scaleFlat(stacks * getPvpEffectiveLevel(actor) * Number(card.rageDamagePerStackPerLevel || 0));
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
    grantPvpTemporaryShield(actor, shieldAmount, target.userId);
    addPvpBuff(actor, {
      id: 'champion_guard',
      name: '챔피언의 가호',
      turns: Number(card.turns || 2),
      value: scalePercent(card.attackBonusPercent),
      critBonus: scalePercent(card.critBonus),
      desc: `공격력 +${Math.round(scalePercent(card.attackBonusPercent) * 100)}%, 치명타 확률 +${Math.round(scalePercent(card.critBonus) * 100)}%`
    });
    addPvpDebuff(target, {
      id: 'blind',
      name: '눈부심',
      turns: Number(card.blindTurns || 1),
      missChance: Number(card.blindMissChance || 0.3),
      desc: `모든 공격 명중률 ${Math.round(Number(card.blindMissChance || 0.3) * 100)}% 감소`
    }, actor, battle);
    battle.logs.push(`${actor.displayName}이(가) 보호막 ${shieldAmount.toLocaleString()}과 <챔피언의 가호>를 얻고, ${target.displayName}에게 <눈부심>을 적용했습니다.`);
  } else if (card.effectType === 'lowest_level_buff') {
    addPvpBuff(actor, {
      id: 'subordinate_level',
      name: '부하직원',
      turns: Number(card.turns || 2),
      value: Number(card.levelBonus || 10),
      desc: `레벨 +${Number(card.levelBonus || 10)}로 간주`
    });
    battle.logs.push(`${actor.displayName}이(가) <부하직원> 버프를 얻어 ${Number(card.turns || 2)}턴 동안 레벨 +${Number(card.levelBonus || 10)}로 간주됩니다.`);
  } else if (card.effectType === 'poison_debuff') {
    const applied = addPvpDebuff(target, {
      id: 'poison',
      name: '중독',
      sourceUserId: actor.userId,
      sourceDisplayName: actor.displayName,
      sourceLevel: getPvpEffectiveLevel(actor),
      damagePerLevel: Number(card.damagePerLevel || 10),
      turns: Number(card.turns || 2),
      desc: `공격할 때마다 ${actor.displayName}의 레벨 x ${Number(card.damagePerLevel || 10)} 피해를 받습니다.`
    }, actor, battle);
    battle.logs.push(applied ? `${target.displayName}이(가) 중독되었습니다.` : `${target.displayName}이(가) 중독을 막았습니다.`);
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
    cardEntry.cooldownRemaining = Number(card.cooldown || 0) + 1;
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
  const damage = Math.max(1, Math.floor(baseDamage * Number(counterBuff.value || 1) * (critical ? 1.5 : 1)));
  applyPvpDamage(target, damage, battle);
  incrementPvpOvertimeRageStacks(target);
  battle.logs.push(`${counterActor.displayName}의 반격! ${target.displayName}에게 ${damage.toLocaleString()} 피해를 입혔습니다.${critical ? ' (치명타)' : ''}`);
  triggerPvpPoisonOnAttack(counterActor, battle);
}

function performPvpBasicAttack(actor, target, battle) {
  if (actor.basicAttackLockTurns > 0) {
    battle.logs.push(`${actor.displayName}은(는) 기본 공격을 할 수 없습니다.`);
    return;
  }
  let hitCount = 1 + Number(actor.extraHits || 0);
  if (actor.buffs.some((buff) => buff.id === 'hype' && !buff.pendingActivation)) hitCount *= 2;
  const hitMultiplier = Number(actor.multiHitDamageMultiplier || 1);
  const baseDamage = Math.max(1, Math.floor((getPvpEffectiveLevel(actor) / 2) * 20 * (1 + getPvpAttackBonus(actor)) * (1 + Number(actor.basicAttackEquipmentBonusPercent || 0))));
  for (let index = 0; index < hitCount; index += 1) {
    const critical = Math.random() < getPvpCriticalChance(actor);
    let damage = Math.floor(baseDamage * hitMultiplier * (critical ? 1.5 : 1));
    if (isPvpAttackMissed(actor, battle, `기본 공격 ${index + 1}타`)) {
      triggerPvpPoisonOnAttack(actor, battle);
      if (actor.hp <= 0) break;
      continue;
    }
    if (actor.perHitBonusTurns > 0) damage += Number(actor.perHitBonusDamage || 0);
    if (index === 0 && actor.extraDamage > 0) damage += Number(actor.extraDamage || 0);
    applyPvpDamage(target, damage, battle);
    incrementPvpOvertimeRageStacks(target);
    battle.logs.push(`${actor.displayName}의 기본 공격 ${index + 1}타! ${target.displayName}에게 ${damage.toLocaleString()} 피해를 입혔습니다.${critical ? ' (치명타)' : ''}`);
    triggerPvpPoisonOnAttack(actor, battle);
    if (target.hp > 0) performPvpCounterAttack(target, actor, battle);
    if (actor.hp <= 0 || target.hp <= 0) break;
  }
}

function tickPvpPlayerEndOfTurn(player, battle) {
  player.cards.forEach((card) => {
    if (Number(card.cooldownRemaining || 0) > 0) card.cooldownRemaining -= 1;
  });
  player.buffs.forEach((buff) => {
    if (buff.pendingActivation) {
      buff.pendingActivation = false;
      return;
    }
    if (Number(buff.turns || 0) > 0 && Number(buff.turns || 0) < 900) {
      buff.turns -= 1;
      if (buff.turns <= 0 && buff.id === 'celine' && Number(buff.expireDamage || 0) > 0) {
        const target = getPvpOpponent(battle, player.userId);
        if (target) {
          applyPvpDamage(target, Number(buff.expireDamage || 0), battle);
          battle.logs.push(`${player.displayName}의 셀린느가 종료되며 ${target.displayName}에게 ${Number(buff.expireDamage || 0).toLocaleString()} 피해를 입혔습니다.`);
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
        await user.save();
      });
    } catch (err) {
      console.error('PVP bet settlement error:', err);
    }
  }
}

async function finalizePvpBattleOutcome(winnerUserId, loserUserId, battle) {
  if (!winnerUserId || !loserUserId || battle?.outcomeFinalized) return;
  battle.outcomeFinalized = true;
  try {
    const [winnerSnapshot, loserSnapshot] = await Promise.all([
      User.findById(winnerUserId),
      User.findById(loserUserId)
    ]);
    if (!winnerSnapshot || !loserSnapshot) return;
    ensureUserDefaults(winnerSnapshot);
    ensureUserDefaults(loserSnapshot);
    const ranked = isRankedPvpMode(battle?.mode);

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
        await user.save();
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
        await user.save();
      });
      battle.ratingChange = null;
      return;
    }

    const winnerOldRating = getPvpUserRating(winnerSnapshot);
    const loserOldRating = getPvpUserRating(loserSnapshot);
    const delta = calculatePvpRatingDelta(winnerOldRating, loserOldRating);
    const winnerNewRating = winnerOldRating + delta;
    const loserNewRating = Math.max(0, loserOldRating - delta);

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
      queueNotification(user, 'pvp_victory_reward', `랭크 개인면담 승리! +${delta}점, 회의 추가 입장권 1장, 박카스 1개, 경험치 ${expReward.toLocaleString()}, 장비 파편 ${fragmentReward}개를 획득했습니다.`);
      await user.save();
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
      queueNotification(user, 'pvp_rating_loss', `랭크 개인면담 패배로 -${delta}점이 반영되었습니다. 패배 보상으로 경험치 ${expReward.toLocaleString()}를 획득했습니다.`);
      await user.save();
    });
    battle.ratingChange = { winnerDelta: delta, loserDelta: -delta, winnerNewRating, loserNewRating };
    await settlePvpBets(battle, winnerUserId);
  } catch (err) {
    battle.outcomeFinalized = false;
    console.error('PVP outcome finalize error:', err);
  }
}

async function executePvpTurn(battle, now = new Date()) {
  const actor = getPvpPlayer(battle, battle.currentUserId);
  const target = getPvpOpponent(battle, battle.currentUserId);
  if (!actor || !target || battle.winnerUserId) return;

  actor.lastHpLoss = 0;
  actor.lastShieldLoss = 0;
  target.lastHpLoss = 0;
  target.lastShieldLoss = 0;

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
  battle.turnEndsAt = new Date(now.getTime() + PVP_BATTLE_TURN_MS);
  bumpPvpVersion();
}

async function advancePvpModeStateUnlocked(mode, modeState, now = new Date()) {
  if (modeState.match) {
    const match = modeState.match;
    if (match.phase === 'accept') {
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

  if (modeState.battle?.phase === 'active' && now.getTime() >= new Date(modeState.battle.turnEndsAt).getTime()) {
    await executePvpTurn(modeState.battle, now);
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
    turnEndsAt: battle.turnEndsAt,
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
    canQueue: Boolean(user && user.gameState.level >= PVP_MIN_LEVEL && !modeState.battle && !modeState.match && !isUserInAnyPvpSession(userId)),
    isQueued: queued,
    queueCount: modeState.queue.length,
    hasActiveSession: Boolean(modeState.match || modeState.battle),
    isParticipant: participantInMatch || participantInBattle
  };
}

async function buildPvpStateResponse(user, now = new Date(), requestedMode = PVP_MODE_RANKED) {
  await processWeeklyPvpSeasonIfNeeded(now);
  await advancePvpState(now);
  const responseNow = new Date();
  const userId = user?._id ? String(user._id) : null;
  const selectedMode = normalizePvpMode(requestedMode);
  const selectedModeState = getPvpModeState(selectedMode);
  const match = selectedModeState.match;
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
    pickTurnIndex: match.pickTurnIndex || 0,
    currentBet: userId && match.bets ? (match.bets[userId] || null) : null,
    canBet: Boolean(isRankedPvpMode(match.mode) && userId && !match.players.some((player) => player.userId === userId) && ['ban', 'pick'].includes(match.phase) && !(match.bets || {})[userId]),
    bannedCardIds: getPvpBannedCardIds(match),
    pickedCardIds: getPvpPickedCardIds(match),
    allCards: getAllPvpBanCards(),
    ownedCards: getOwnedPvpPickCards(user),
    logs: match.logs.slice(-8).map((log) => anonymizePvpTextForViewer(log, match.players, match.mode, userId)),
    spectators: buildPvpSpectatorsForViewer(selectedModeState.viewers, match.players, match.mode, userId),
    isParticipant: Boolean(userId && match.players.some((player) => player.userId === userId)),
    isMyTurn: Boolean(userId && match.turnUserId === userId)
  } : null;
  const modes = Object.fromEntries(getPvpModeEntries().map(([mode, modeState]) => [
    mode,
    buildPvpModeSummary(mode, modeState, userId, user)
  ]));

  return {
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
    displayName: user.nickname || user.username
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
        const emblemRewardMultiplier = 1 + derivedStats.raidRewardBonusPercent / 100;
        rewardMultiplier *= emblemRewardMultiplier;
        rewardNotes.push(`휘장 효과로 보스 보상 ${emblemRewardMultiplier.toFixed(2)}배`);
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
      const expBonusMultiplier = 1 + derivedStats.expBonusPercent / 100;
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
    let finalized = false;
    let lastFinalizeError = null;

    for (let attempt = 0; attempt < 5 && !finalized; attempt += 1) {
      const user = await User.findById(participant.userId);
      if (!user) {
        finalized = true;
        break;
      }

      try {
        applyRaidOutcomeToUser(user, participant);
        await user.save();
        finalized = true;
      } catch (err) {
        lastFinalizeError = err;
        if (isVersionConflictError(err) && attempt < 4) {
          console.warn(`Raid finalize conflict for ${participant.userId}:`, err.message);
          continue;
        }
        console.error(`Raid finalize error for ${participant.userId}:`, err);
        finalized = true;
      }
    }

    if (!finalized && lastFinalizeError) {
      console.error(`Raid finalize failed for ${participant.userId}:`, lastFinalizeError);
    }
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
      const bossResult = performRaidBossAction(activeBattle);
      if (bossResult?.steps?.length) {
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
        tickRaidBossPoisonDebuffs(activeBattle);
        activeBattle.turnIndex = 0;
        activeBattle.nextActionAt = new Date(now.getTime() + RAID_ACTION_DELAY_MS);
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
    await finalizeRaidBattle(room.activeBattle, now);
  }
}

async function advanceRaidState(now = new Date()) {
  await advanceRaidRoomState(RAID_MODE_NORMAL, now);
  await advanceRaidRoomState(RAID_MODE_HARD, now);
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
    if (!emblem.unlockLevel) return;
    if (Number(user.gameState?.level || 1) >= Number(emblem.unlockLevel || 0)) {
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
  }
}

function buildFragmentShopState(user, now = new Date()) {
  ensureUserDefaults(user);
  syncDailyShopState(user, now);
  const ownedFragments = getInventoryQuantity(user, 'equipment_fragment');
  return {
    fragments: ownedFragments,
    items: Object.values(FRAGMENT_SHOP_ITEMS).map((entry) => {
      const purchased = Math.max(0, Number(user.shopState?.[entry.countField] || 0));
      const isEmblem = Boolean(entry.emblemId);
      const owned = isEmblem && user.emblems.unlocked.includes(entry.emblemId);
      return {
        id: entry.id,
        itemId: entry.itemId,
        emblemId: entry.emblemId || null,
        type: isEmblem ? 'emblem' : 'item',
        name: entry.name,
        desc: isEmblem ? (EMBLEM_DATA[entry.emblemId]?.desc || '') : (entry.desc || ''),
        cost: entry.cost,
        quantity: entry.quantity,
        dailyLimit: entry.dailyLimit,
        purchasedToday: purchased,
        remainingToday: Math.max(0, entry.dailyLimit - purchased),
        owned,
        canBuy: ownedFragments >= entry.cost && purchased < entry.dailyLimit && !owned
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
    raidRewardBonus: 0
  };

  const unlocked = Array.isArray(emblems?.unlocked) ? [...new Set(emblems.unlocked)] : [];
  unlocked.forEach((emblemId) => {
    const effects = EMBLEM_DATA[emblemId]?.effects;
    if (!effects) return;
    stats.moneyBonus += Number(effects.moneyBonus || 0);
    stats.expBonus += Number(effects.expBonus || 0);
    stats.raidRewardBonus += Number(effects.raidRewardBonus || 0);
  });

  stats.moneyBonus = Number(stats.moneyBonus.toFixed(2));
  stats.expBonus = Number(stats.expBonus.toFixed(2));
  stats.raidRewardBonus = Number(stats.raidRewardBonus.toFixed(2));
  return stats;
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
  const titleDef = getEquippedTitleDefinition(user);
  const titleEffects = titleDef?.effects || {};
  const activeBuffEffects = getActiveBuffEffects(user, now);

  const moneyBonusPercent = itemStats.moneyBonus + emblemStats.moneyBonus + (titleEffects.moneyBonus || 0);
  const expBonusPercent = itemStats.expBonus + emblemStats.expBonus;
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
    expBonusPercent: Number(expBonusPercent.toFixed(2)),
    itemExpBonusPercent: itemStats.expBonus,
    emblemExpBonusPercent: emblemStats.expBonus,
    raidRewardBonusPercent: emblemStats.raidRewardBonus,
    stressMultiplier: finalStressMultiplier,
    stressReductionPercent: Number(((1 - finalStressMultiplier) * 100).toFixed(2)),
    clickStressRelief: Number((itemStats.clickStressRelief + activeBuffEffects.clickStressRelief).toFixed(2)),
    hourlyStressRelief: Number((titleEffects.hourlyStressRelief || 0).toFixed(2)),
    shopStressRelief: Number((titleEffects.shopStressRelief || 0).toFixed(2)),
    passiveExpMultiplier,
    clickExpMultiplier,
    typingExpMultiplier,
    noStress: activeBuffEffects.noStress,
    maxStaminaBonus: Number(titleEffects.staminaBonus || 0),
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

function getEffectiveMaxStamina(user, now = new Date()) {
  const derivedStats = calculateDerivedStats(user, now);
  return Number((user.gameState.maxStamina + derivedStats.maxStaminaBonus).toFixed(2));
}

function getAdventureStaminaCost(user, now = new Date()) {
  const derivedStats = calculateDerivedStats(user, now);
  return Number((1 * derivedStats.adventureStaminaMultiplier).toFixed(2));
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
    desc: '5시간마다 한 번 사용할 수 있습니다. 현재 온라인인 모든 유저에게 1시간 동안 모든 획득 경험치 2배 버프를 부여합니다.'
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
  queueNotification(user, 'skill_unlock', '<업무 최적화> 스킬을 획득했습니다! 스킬 탭에서 5시간마다 사용할 수 있습니다.');
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

function resetDailyStaminaIfNeeded(user, now = new Date(), effectiveMaxStamina = user.gameState.maxStamina) {
  const currentKey = getKSTDateKey(now);
  const lastResetKey = getKSTDateKey(new Date(user.gameState.lastStaminaResetTime));

  if (currentKey !== lastResetKey) {
    user.gameState.stamina = effectiveMaxStamina;
    user.gameState.lastStaminaResetTime = now;
  }
}

function reconcileTitles(user, now = new Date()) {
  if (user.meta.loginCount > 0) {
    unlockTitle(user, 'newcomer');
  }

  if (user.meta.catFoodGivenCount >= 10) {
    unlockTitle(user, 'cat_butler');
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

  reconcileSkills(user);
}

function checkLevelUp(user) {
  if (!user?.gameState) return false;

  user.gameState.level = Math.max(1, Math.floor(Number(user.gameState.level || 1)));
  user.gameState.exp = Math.max(0, Number(user.gameState.exp || 0));

  let leveledUp = false;
  let safety = 0;
  while (safety < 1000) {
    const requiredExp = getRequiredExp(user.gameState.level);
    if (user.gameState.exp < requiredExp) break;

    user.gameState.exp = Number((user.gameState.exp - requiredExp).toFixed(6));
    user.gameState.level += 1;
    addItemToInventory(user, 'bacchus', 1);
    queueNotification(user, 'level_up', `레벨 ${user.gameState.level} 달성! 레벨업 보상으로 박카스 1병을 받았습니다.`);
    leveledUp = true;
    safety += 1;
  }

  if (leveledUp) {
    user.gameState.passiveExpCarry = 0;
    reconcileEmblems(user);
  }
  return leveledUp;
}

function calculateOfflineGains(user, now = new Date()) {
  ensureUserDefaults(user);
  markUserSeen(user, now);
  syncDailyShopState(user, now);
  settlePendingStockInvestment(user, now);
  cleanupExpiredBuffs(user, now);
  reconcileTitles(user, now);
  reconcileEmblems(user);
  resetDailyStaminaIfNeeded(user, now, getEffectiveMaxStamina(user, now));

  const lastActionTime = new Date(user.gameState.lastActionTime || now);
  let elapsedSeconds = (now.getTime() - lastActionTime.getTime()) / 1000;
  if (elapsedSeconds < 0) elapsedSeconds = 0;

  if (elapsedSeconds === 0) {
    user.gameState.lastActionTime = now;
    return;
  }

  const derivedStats = calculateDerivedStats(user, now);

  if (!derivedStats.noStress) {
    const gainedStress = elapsedSeconds * IDLE_STRESS_PER_SECOND * derivedStats.stressMultiplier;
    addUserStress(user, gainedStress);
  }

  if (derivedStats.hourlyStressRelief > 0) {
    const stressRelief = (derivedStats.hourlyStressRelief / 3600) * elapsedSeconds;
    addUserStress(user, -stressRelief);
  }

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

function buildEmblemShopState(user) {
  ensureUserDefaults(user);
  return {
    items: Object.values(EMBLEM_DATA).filter((emblem) => emblem.shopType === 'money').map((emblem) => {
      const owned = user.emblems.unlocked.includes(emblem.id);
      return getEmblemPublicDetail(emblem.id, {
        owned,
        equipped: user.emblems.equipped === emblem.id,
        canBuy: !owned && Number(user.gameState?.money || 0) >= emblem.price
      });
    })
  };
}

function buildGameStateResponse(user, now = new Date()) {
  const derivedStats = calculateDerivedStats(user, now);
  const gameState = user.gameState.toObject ? user.gameState.toObject() : { ...user.gameState };
  gameState.maxStamina = getEffectiveMaxStamina(user, now);
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
    equippedCardId: user.equippedCardId,
    equippedCardLevel: normalizeCardEnhancementLevel(user.equippedCardLevel || 0),
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
    emblemShop: buildEmblemShopState(user),
    pendingStockInvestment: user.pendingStockInvestment,
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
    itemStats: {
      moneyBonus: derivedStats.moneyBonusPercent,
      itemMoneyBonus: derivedStats.itemMoneyBonusPercent,
      emblemMoneyBonus: derivedStats.emblemMoneyBonusPercent,
      titleMoneyBonus: derivedStats.titleMoneyBonusPercent,
      expBonus: derivedStats.expBonusPercent,
      itemExpBonus: derivedStats.itemExpBonusPercent,
      emblemExpBonus: derivedStats.emblemExpBonusPercent,
      raidRewardBonus: derivedStats.raidRewardBonusPercent,
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
    },
    shopPrices: getShopPricesForUser(user),
    skills: buildSkillDetails(user, now)
  };
}

function buildUserResponse(user, now = new Date()) {
  return {
    user: buildGameStateResponse(user, now),
    notifications: consumeNotifications(user)
  };
}

async function buildUserResponseWithGlobals(user, now = new Date()) {
  const response = buildUserResponse(user, now);
  response.global = getGlobalState(now);
  response.marketplaceSoldPendingCount = await getMarketplaceSoldPendingCount(user._id);
  response.adminMailPendingCount = await getPendingAdminMailCount(user._id, now);
  return response;
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

function applyAdventureReward(user, reward, now = new Date()) {
  if (!reward) {
    return '아무것도 획득하지 못했습니다.';
  }

  if (reward.type === 'bundle') {
    const summaries = reward.rewards
      .map((entry) => applyAdventureReward(user, entry, now))
      .filter(Boolean);
    return summaries.length ? summaries.join(' / ') : '아무것도 획득하지 못했습니다.';
  }

  if (reward.type === 'none') {
    return '아무것도 획득하지 못했습니다.';
  }

  if (reward.type === 'money') {
    const beforeMoney = user.gameState.money;
    user.gameState.money = Math.max(0, user.gameState.money + reward.amount);
    const actualDelta = user.gameState.money - beforeMoney;
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
    setOrRefreshBuff(user, reward.buffId, durationMs, { now, stackDuration: true });
    return `${BUFF_DATA[reward.buffId].name} 효과를 획득했습니다.`;
  }

  if (reward.type === 'exp_fraction') {
    const remainingExp = getRemainingExpToNextLevel(user);
    const baseExp = Math.max(1, Math.floor(remainingExp / reward.divisor));
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
    const fallbackText = applyAdventureReward(user, reward.fallback, now);
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
  const response = await buildUserResponseWithGlobals(user, now);
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
      const workDrops = applyWorkDrops(user, dropAttempts);
      const workDrop = workDrops[0] || null;
      if (workDrop?.text) {
        queueNotification(user, 'work_drop', workDrop.text);
      }
      const response = await buildUserResponseWithGlobals(user, now);
      if (workDrop) {
        response.workDrop = workDrop;
      }
      response.workAntiCheat = {
        rewardMultiplier: antiCheat.rewardMultiplier,
        warning: antiCheat.warning
      };
      return response;
    }, { conflictLabel: 'Work action conflict' });

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
      const mutationResponse = await buildUserResponseWithGlobals(user, now);
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
    }, { conflictLabel: 'News typing action conflict' });

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

      const mutationResponse = await buildUserResponseWithGlobals(user, now);
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

      return buildUserResponseWithGlobals(user, now);
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
    const response = await withUserMutationLock(userId, async () => {
      const user = await User.findById(userId);
      if (!user) {
        throw createHttpError(404, '사용자를 찾을 수 없습니다.');
      }
      ensureUserDefaults(user);

      const now = new Date();
      calculateOfflineGains(user, now);
      cleanupExpiredBuffs(user, now);

      if (user.pendingAdventure?.eventId) {
        throw createHttpError(400, '진행 중인 모험 선택지가 남아 있습니다. 먼저 결과를 선택해주세요.');
      }

      const lastAdventureAtMs = user.meta.lastAdventureAt ? new Date(user.meta.lastAdventureAt).getTime() : 0;
      const elapsedAdventureMs = lastAdventureAtMs ? now.getTime() - lastAdventureAtMs : ADVENTURE_COOLDOWN_MS;
      if (elapsedAdventureMs < ADVENTURE_COOLDOWN_MS) {
        const remainingTenths = Math.ceil((ADVENTURE_COOLDOWN_MS - elapsedAdventureMs) / 100) / 10;
        throw createHttpError(429, `모험 준비 중입니다. ${remainingTenths.toFixed(1)}초 후 다시 시도해주세요.`);
      }

      const staminaCost = getAdventureStaminaCost(user, now);
      if (user.gameState.stamina < staminaCost) {
        throw createHttpError(400, `행동력이 부족합니다. (필요: ${staminaCost})`);
      }

      user.gameState.stamina = Number((user.gameState.stamina - staminaCost).toFixed(2));
      user.gameState.lastActionTime = now;
      user.meta.lastAdventureAt = now;

      const event = rollAdventureEvent();
      const eventTitle = `${event.location} / ${event.actor}`;
      setAdventureLog(user, `${eventTitle} - ${event.message}`);

      if (event.reward?.type === 'cat_choice') {
        user.pendingAdventure = {
          eventId: event.id,
          location: event.location,
          actor: event.actor,
          message: event.message,
          createdAt: now
        };

        const choiceResponse = await buildAdventureChoiceResponse(user, now);
        await persistUserSnapshot(user, { message: '모험 선택지 저장 중 충돌이 발생했습니다. 다시 시도해주세요.' });
        return choiceResponse;
      }

      const rewardText = applyAdventureReward(user, event.reward, now);
      setAdventureLog(user, `${eventTitle} - ${event.message} / ${rewardText}`);
      clearPendingAdventure(user);
      reconcileTitles(user, now);

      const response = await buildUserResponseWithGlobals(user, now);
      response.adventureResult = {
        requiresChoice: false,
        title: eventTitle,
        message: event.message,
        rewardText
      };
      await persistUserSnapshot(user, { message: '모험 결과 저장 중 충돌이 발생했습니다. 다시 시도해주세요.' });
      return response;
    });

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
    const response = await withUserMutationLock(userId, async () => {
      const user = await User.findById(userId);
      if (!user) {
        throw createHttpError(404, '사용자를 찾을 수 없습니다.');
      }
      ensureUserDefaults(user);

      const now = new Date();
      calculateOfflineGains(user, now);

      if (!user.pendingAdventure?.eventId) {
        throw createHttpError(400, '진행 중인 모험 선택지가 없습니다.');
      }

      const eventTitle = `${user.pendingAdventure.location} / ${user.pendingAdventure.actor}`;
      let rewardText = '아무 일도 일어나지 않았습니다.';
      const hasCatButlerTitle = user.titles?.unlocked?.includes('cat_butler');

      if (choice === 'yes') {
        if (getCatTunaCanQuantity(user) > 0 && removeCatTunaCanFromInventory(user, 1)) {
          user.meta.catFoodGivenCount += 1;
          rewardText = `고양이에게 참치캔을 건넸습니다. 현재 총 ${user.meta.catFoodGivenCount}번 건네줬습니다.`;

          if (user.meta.catFoodGivenCount >= 10) {
            unlockTitle(user, 'cat_butler');
            setOrRefreshBuff(user, 'cat_gratitude_buff', CAT_GRATITUDE_DURATION_MS);
            rewardText += ' 고양이의 보은 버프를 획득했습니다.';
          }

          if (hasCatButlerTitle || user.meta.catFoodGivenCount >= 10) {
            setOrRefreshBuff(user, 'cat_gratitude_buff', CAT_GRATITUDE_DURATION_MS);
            addItemToInventory(user, 'bacchus', 1);

            const extraItemPool = ['hot6', 'cat_tuna_can', 'reward_pen_monami'];
            const extraItemId = extraItemPool[Math.floor(Math.random() * extraItemPool.length)];
            addItemToInventory(user, extraItemId, 1);

            rewardText += ` 고양이가 보답으로 박카스 1개와 ${ITEM_DATA[extraItemId].name} 1개를 남겨두고 갔습니다.`;
          }
        } else {
          rewardText = '참치캔이 없어 고양이에게 아무것도 줄 수 없었습니다.';
          if (hasCatButlerTitle) {
            setOrRefreshBuff(user, 'cat_gratitude_buff', CAT_GRATITUDE_DURATION_MS);
            rewardText += ' 그래도 고양이는 당신을 기억하고 있어 고양이의 보은 버프를 남겨줬습니다.';
          }
        }
      } else {
        rewardText = '고양이를 한 번 쓰다듬고 지나쳤습니다. 아무것도 획득하지 못했습니다.';
        if (hasCatButlerTitle) {
          setOrRefreshBuff(user, 'cat_gratitude_buff', CAT_GRATITUDE_DURATION_MS);
          rewardText += ' 그래도 고양이는 당신을 기억하고 있어 고양이의 보은 버프를 남겨줬습니다.';
        }
      }

      setAdventureLog(user, `${eventTitle} - ${rewardText}`);
      clearPendingAdventure(user);
      reconcileTitles(user, now);

      const response = await buildUserResponseWithGlobals(user, now);
      response.adventureResult = {
        requiresChoice: false,
        title: eventTitle,
        message: '고양이가 잠시 당신을 바라보다가 천천히 발걸음을 옮겼다.',
        rewardText
      };
      await persistUserSnapshot(user, { message: '모험 선택 결과 저장 중 충돌이 발생했습니다. 다시 시도해주세요.' });
      return response;
    });

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

      return buildUserResponseWithGlobals(user, now);
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

      return buildUserResponseWithGlobals(user, now);
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
        throw createHttpError(409, '부업 처리 중 저장 충돌이 발생했습니다. 다시 시도해주세요.');
      }

      const savedUser = await User.findById(user._id);
      if (!savedUser) {
        throw createHttpError(404, '사용자를 찾을 수 없습니다.');
      }
      ensureUserDefaults(savedUser);

      const mutationResponse = await buildUserResponseWithGlobals(savedUser, now);
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
    const response = await buildUserResponseWithGlobals(user, now);
    await user.save();
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
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    calculateOfflineGains(user, now);
    ensureUserDefaults(user);
    syncDailyShopState(user, now);

    const remainingDailyPurchases = getRemainingDailyShopPurchases(user, itemId);
    if (Number.isFinite(remainingDailyPurchases) && buyQuantity > remainingDailyPurchases) {
      if (itemId === 'business_card') {
        return res.status(400).json({ msg: '명함은 하루에 최대 5개까지만 구매할 수 있습니다.' });
      }
      if (itemId === 'bacchus') {
        return res.status(400).json({ msg: '박카스는 하루에 최대 20개까지만 구매할 수 있습니다.' });
      }
      if (itemId === 'hot6') {
        return res.status(400).json({ msg: '핫식스는 하루에 최대 5개까지만 구매할 수 있습니다.' });
      }
    }

    if (itemId === 'coffee_mix') {
      const derivedStats = calculateDerivedStats(user, now);
      if (Number(derivedStats.stressReductionPercent || 0) >= 100) {
        return res.status(400).json({ msg: '스트레스 감소율이 이미 100%에 도달해 더 이상 맥심 커피믹스를 구매할 수 없습니다.' });
      }
    }

    const totalPrice = getTotalBuyPrice(user, itemId, buyQuantity);

    if (user.gameState.money < totalPrice) {
      return res.status(400).json({ msg: '잔고가 부족합니다.' });
    }

    user.gameState.money -= totalPrice;
    addItemToInventory(user, itemId, buyQuantity);
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

    reconcileTitles(user, now);
    reconcileEmblems(user);
    user.gameState.lastActionTime = now;

    const response = await buildUserResponseWithGlobals(user, now);
    response.shopPurchase = {
      itemId,
      itemName: itemInfo.name,
      quantity: buyQuantity,
      totalPrice,
      ownedQuantity: getInventoryQuantity(user, itemId)
    };
    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Shop buy error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
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

    const purchasedToday = Math.max(0, Number(user.shopState?.[shopItem.countField] || 0));
    if (purchasedToday >= shopItem.dailyLimit) {
      return res.status(400).json({ msg: '오늘은 해당 항목을 더 이상 구매할 수 없습니다.' });
    }
    if (shopItem.emblemId) {
      if (user.emblems.unlocked.includes(shopItem.emblemId)) {
        return res.status(400).json({ msg: '이미 보유 중인 휘장입니다.' });
      }
    }
    if (getInventoryQuantity(user, 'equipment_fragment') < shopItem.cost) {
      return res.status(400).json({ msg: '장비 파편이 부족합니다.' });
    }
    if (!removeItemFromInventory(user, 'equipment_fragment', shopItem.cost)) {
      return res.status(400).json({ msg: '장비 파편이 부족합니다.' });
    }

    if (shopItem.emblemId) {
      user.emblems.unlocked.push(shopItem.emblemId);
      if (!user.emblems.equipped) user.emblems.equipped = shopItem.emblemId;
    } else {
      addItemToInventory(user, shopItem.itemId, shopItem.quantity);
    }
    user.shopState[shopItem.countField] = purchasedToday + 1;
    user.gameState.lastActionTime = now;

    const response = await buildUserResponseWithGlobals(user, now);
    response.fragmentShop = buildFragmentShopState(user, now);
    response.fragmentShopPurchase = {
      shopItemId: shopItem.id,
      itemId: shopItem.itemId,
      emblemId: shopItem.emblemId || null,
      itemName: shopItem.emblemId ? EMBLEM_DATA[shopItem.emblemId]?.name : (ITEM_DATA[shopItem.itemId]?.name || shopItem.name),
      quantity: shopItem.quantity,
      cost: shopItem.cost
    };
    await user.save();
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
      if (Number(user.gameState.money || 0) < emblem.price) {
        return res.status(400).json({ msg: '잔고가 부족합니다.' });
      }

      user.gameState.money -= emblem.price;
      user.emblems.unlocked.push(emblemId);
      if (!user.emblems.equipped) user.emblems.equipped = emblemId;
      user.gameState.lastActionTime = now;

      const response = await buildUserResponseWithGlobals(user, now);
      response.emblemShopPurchase = {
        emblemId,
        emblemName: emblem.name,
        price: emblem.price
      };
      await user.save();
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

      const response = await buildUserResponseWithGlobals(user, now);
      await user.save();
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
  let useQuantity = Math.max(1, Math.floor(Number(quantity) || 1));

  const itemInfo = ITEM_DATA[itemId];
  if (!itemInfo || itemInfo.type !== 'consumable') {
    return res.status(400).json({ msg: '사용할 수 없는 아이템입니다.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    calculateOfflineGains(user, now);

    if (itemId === 'bacchus') {
      const maxRecoverableStamina = Math.max(0, Math.floor(getEffectiveMaxStamina(user, now) - Number(user.gameState.stamina || 0)));
      if (maxRecoverableStamina <= 0) {
        return res.status(400).json({ msg: '행동력이 이미 최대치라 박카스를 사용할 수 없습니다.' });
      }
      useQuantity = Math.min(useQuantity, maxRecoverableStamina);
    } else if (itemId === 'infinite_overtime_ticket') {
      ensureUserDefaults(user);
      if (user.infiniteOvertime?.active) {
        return res.status(400).json({ msg: '진행 중인 무한야근 도전이 있어 입장권을 사용할 수 없습니다.' });
      }
      if (getInfiniteOvertimeCooldownRemainingMs(user, now) <= 0) {
        return res.status(400).json({ msg: '이미 무한야근에 도전할 수 있어 입장권을 사용할 필요가 없습니다.' });
      }
      useQuantity = 1;
    }

    if (!removeItemFromInventory(user, itemId, useQuantity)) {
      return res.status(400).json({ msg: '해당 아이템이 부족합니다.' });
    }

    if (itemId === 'bacchus') {
      user.gameState.stamina = Math.min(getEffectiveMaxStamina(user, now), user.gameState.stamina + useQuantity);
      queueNotification(user, 'item_use', `박카스를 ${useQuantity}병 마셨습니다. 행동력이 ${useQuantity} 회복되었습니다.`);
    } else if (itemId === 'hot6') {
      addUserStress(user, -(10 * useQuantity));
      setOrRefreshBuff(user, 'hot6_buff', HOT6_DURATION_MS * useQuantity, { now, stackDuration: true });
      queueNotification(user, 'item_use', `핫식스를 ${useQuantity}병 사용했습니다. 스트레스가 ${10 * useQuantity} 감소하고 버프 시간이 누적되었습니다.`);
    } else if (itemId === 'tylenol') {
      removeAllDebuffs(user);
      queueNotification(user, 'item_use', `타이레놀을 ${useQuantity}정 사용했습니다. 현재 걸려 있는 모든 디버프를 제거했습니다.`);
    } else if (itemId === 'raid_entry_ticket') {
      syncRaidEntryState(user, now);
      user.meta.raidEntryBonusCount += useQuantity;
      queueNotification(user, 'item_use', `회의 추가 입장권 ${useQuantity}장을 사용했습니다. 오늘 보스 레이드 입장 가능 횟수가 ${useQuantity}회 증가했습니다.`);
    } else if (itemId === 'infinite_overtime_ticket') {
      ensureUserDefaults(user);
      user.infiniteOvertime.lastAttemptAt = null;
      user.infiniteOvertime.lastCompletedAt = null;
      user.infiniteOvertime.active = false;
      user.markModified('infiniteOvertime');
      clearInfiniteOvertimeAttackDraft(userId);
      queueNotification(user, 'item_use', '무한야근 입장권 1장을 사용했습니다. 무한야근 재도전 대기시간이 초기화되었습니다.');
    } else if (itemId === 'hagendaz') {
      user.gameState.level += useQuantity;
      user.gameState.exp = 0;
      user.gameState.passiveExpCarry = 0;
      queueNotification(user, 'item_use', `하겐다즈 ${useQuantity}개를 사용해 즉시 ${useQuantity}레벨 상승했습니다.`);
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

    const todayKey = getKSTDateKey(now);
    if (user.meta.lastTitleChangeDayKey === todayKey) {
      return res.status(400).json({ msg: '오늘은 이미 칭호를 변경했습니다. 내일 다시 변경할 수 있습니다.' });
    }

    user.titles.equipped = user.titles.equipped === titleId ? null : titleId;
    user.meta.lastTitleChangeDayKey = todayKey;
    user.gameState.stamina = Math.min(user.gameState.stamina, getEffectiveMaxStamina(user, now));
    const response = await buildUserResponseWithGlobals(user, now);
    await user.save();
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

    const response = await buildUserResponseWithGlobals(user, now);
    await user.save();
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
    if (Number(equipment.upgradesLeft || 0) <= 0) {
      return res.status(400).json({ msg: '더 이상 업그레이드할 수 없는 장비입니다.' });
    }

    const scrollRule = getEquipmentScrollRule(scrollItemId);
    if (!scrollRule) {
      return res.status(400).json({ msg: '사용할 수 없는 주문서입니다.' });
    }
    if (scrollRule.equipmentType !== equipment.equipmentType) {
      return res.status(400).json({ msg: '해당 장비에는 사용할 수 없는 주문서입니다.' });
    }
    if (getInventoryQuantity(user, scrollItemId) <= 0) {
      return res.status(400).json({ msg: '보유한 주문서가 없습니다.' });
    }

    removeItemFromInventory(user, scrollItemId, 1);
    equipment.upgradesLeft = Math.max(0, Number(equipment.upgradesLeft || 0) - 1);
    const success = Math.random() < Number(scrollRule.successRate || 0);
    if (success) {
      equipment.statValue = Number((Number(equipment.statValue || 0) + Number(scrollRule.addValue || 0)).toFixed(1));
    }

    const logText = buildEquipmentEnhanceLog(scrollItemId, equipment, success);
    const response = await buildUserResponseWithGlobals(user, now);
    response.equipmentUpgrade = {
      success,
      equipmentId: equipment.equipmentId,
      logText
    };
    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Equipment upgrade error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
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

      const response = await buildUserResponseWithGlobals(user, now);
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
  const listingQuantity = Math.max(1, Math.floor(Number(quantity) || 1));

  if (!userId || !['equipment', 'scroll', 'item'].includes(itemType) || !itemId) {
    return res.status(400).json({ msg: '등록할 물품 정보가 부족합니다.' });
  }
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
      { new: true }
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
        addItemToInventory(user, reservedListing.itemId, Number(reservedListing.quantity || 1));
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
      { new: true }
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
        addItemToInventory(user, cancelledListing.itemId, Number(cancelledListing.quantity || 1));
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
      const response = await buildUserResponseWithGlobals(user, now);
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
  const { userId, cardIds, cards } = req.body;
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

  if (requestedCards.length !== 5) {
    return res.status(400).json({ msg: '합성에는 카드 5장이 필요합니다.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    calculateOfflineGains(user, now);

    const quantityMap = new Map();
    let sourceGrade = null;
    for (const entry of requestedCards) {
      const cardId = entry.cardId;
      const enhancementLevel = normalizeCardEnhancementLevel(entry.enhancementLevel || 0);
      const cardInfo = CARD_DATA[cardId];
      if (!cardInfo) {
        return res.status(400).json({ msg: '존재하지 않는 카드가 포함되어 있습니다.' });
      }
      if (cardInfo.grade === 'S') {
        return res.status(400).json({ msg: 'S등급 카드는 합성할 수 없습니다.' });
      }
      if (enhancementLevel >= 5) {
        return res.status(400).json({ msg: '5강 카드는 합성 재료로 사용할 수 없습니다.' });
      }
      if (!sourceGrade) {
        sourceGrade = cardInfo.grade;
      } else if (sourceGrade !== cardInfo.grade) {
        return res.status(400).json({ msg: '같은 등급 카드만 합성할 수 있습니다.' });
      }
      const variantKey = `${cardId}::${enhancementLevel}`;
      quantityMap.set(variantKey, {
        cardId,
        enhancementLevel,
        amount: (quantityMap.get(variantKey)?.amount || 0) + 1
      });
    }

    for (const { cardId, enhancementLevel, amount } of quantityMap.values()) {
      if (getOwnedCardVariantQuantity(user, cardId, enhancementLevel) < amount) {
        return res.status(400).json({ msg: '보유 카드 수량이 부족합니다.' });
      }
    }

    for (const { cardId, enhancementLevel, amount } of quantityMap.values()) {
      const removed = enhancementLevel > 0
        ? removeEnhancedCard(user, cardId, enhancementLevel, amount)
        : removeCardFromCollection(user, cardId, amount);
      if (!removed) {
        return res.status(400).json({ msg: '보유 카드 수량이 부족합니다.' });
      }
    }

    const resultGrade = getFusionOutcomeGrade(sourceGrade);
    const resultCardId = getRandomCardIdByGrade(resultGrade);
    if (!resultCardId) {
      return res.status(500).json({ msg: '합성 결과 카드를 찾지 못했습니다.' });
    }

    addCardToCollection(user, resultCardId, 1);

    user.gameState.lastActionTime = now;
    const response = await buildUserResponseWithGlobals(user, now);
    response.fusionResult = {
      sourceGrade,
      result: {
        id: resultCardId,
        name: CARD_DATA[resultCardId].name,
        grade: CARD_DATA[resultCardId].grade,
        color: CARD_GRADE_COLORS[CARD_DATA[resultCardId].grade] || '#666666',
        skillName: CARD_DATA[resultCardId].skillName,
        skillDesc: CARD_DATA[resultCardId].skillDesc
      }
    };
    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Card fusion error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/cards/enhance', async (req, res) => {
  const { userId, cardId, enhancementLevel } = req.body;
  if (!userId || !cardId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    calculateOfflineGains(user, now);

    const currentLevel = normalizeCardEnhancementLevel(enhancementLevel || 0);
    if (!CARD_DATA[cardId]) {
      return res.status(400).json({ msg: '존재하지 않는 카드입니다.' });
    }
    if (CARD_DATA[cardId].enhanceDisabled) {
      return res.status(400).json({ msg: '이 카드는 강화할 수 없습니다.' });
    }
    if (currentLevel >= 5) {
      return res.status(400).json({ msg: '이미 최대 강화 단계입니다.' });
    }
    if (getOwnedCardVariantQuantity(user, cardId, currentLevel) <= 0) {
      return res.status(400).json({ msg: '해당 강화 단계의 카드를 보유하고 있지 않습니다.' });
    }
    const equippedThisVariant = user.equippedCardId === cardId && Number(user.equippedCardLevel || 0) === currentLevel;
    const availableEnhanceQuantity = getOwnedCardVariantQuantity(user, cardId, currentLevel);
    if (availableEnhanceQuantity <= 0) {
      return res.status(400).json({ msg: '강화에 사용할 카드가 없습니다.' });
    }

    const enhanceCost = getCardEnhancementCost(cardId, currentLevel);
    if (user.gameState.money < enhanceCost) {
      return res.status(400).json({ msg: '강화 비용이 부족합니다.' });
    }

    user.gameState.money -= enhanceCost;
    const successRate = getCardEnhancementSuccessRate(currentLevel);
    const isSuccess = Math.random() < successRate;
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
    const response = await buildUserResponseWithGlobals(user, now);
    response.enhancementResult = {
      cardId,
      success: isSuccess,
      previousLevel: currentLevel,
      nextLevel: isSuccess ? nextLevel : currentLevel,
      successRate,
      cost: enhanceCost,
      cardName: CARD_DATA[cardId].name
    };
    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Card enhance error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/cards/equip', async (req, res) => {
  const { userId, cardId, enhancementLevel } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    calculateOfflineGains(user, now);

    const targetLevel = normalizeCardEnhancementLevel(enhancementLevel || 0);
    if (cardId && getOwnedCardVariantQuantity(user, cardId, targetLevel) <= 0) {
      return res.status(400).json({ msg: '보유하지 않은 카드입니다.' });
    }

    for (const mode of [RAID_MODE_NORMAL, RAID_MODE_HARD]) {
      const queuedSlotIndex = findQueuedRaidSlotIndex(user._id, mode);
      if (queuedSlotIndex >= 0 && cardId) {
        const otherQueuedUserIds = getRaidRoom(mode).slots
          .filter(Boolean)
          .filter((slotUserId) => String(slotUserId) !== String(user._id));
        if (otherQueuedUserIds.length) {
          const duplicateCardUser = await User.findOne({
            _id: { $in: otherQueuedUserIds },
            equippedCardId: cardId
          }).select('nickname username');
          if (duplicateCardUser) {
            return res.status(400).json({ msg: '같은 카드를 든 참가자가 이미 대기 중이라 교체할 수 없습니다.' });
          }
        }
      }
    }

    if (user.equippedCardId === cardId && Number(user.equippedCardLevel || 0) === targetLevel) {
      user.equippedCardId = null;
      user.equippedCardLevel = 0;
    } else {
      user.equippedCardId = cardId || null;
      user.equippedCardLevel = cardId ? targetLevel : 0;
    }
    const response = await buildUserResponseWithGlobals(user, now);
    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Card equip error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/raid/state', async (req, res) => {
  const { userId, viewing, mode } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    ensureUserDefaults(user);
    const now = new Date();
    const normalizedMode = normalizeRaidMode(mode);
    const room = getRaidRoom(normalizedMode);
    if (viewing && room.activeBattle && !isRaidUserParticipant(room.activeBattle, userId)) {
      registerViewer(room.viewers, user, now);
    } else {
      pruneViewerMap(room.viewers, now);
    }
    const raid = await buildRaidStateResponse(user, now, normalizedMode);
    res.json({
      raid,
      user: buildGameStateResponse(user, now),
      notifications: Array.isArray(user.pendingNotifications) ? [...user.pendingNotifications] : [],
      global: getGlobalState(now),
      adminMailPendingCount: await getPendingAdminMailCount(user._id, now)
    });
  } catch (err) {
    console.error('Raid state error:', err);
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
      if (user.equippedCardId) {
        const queuedOtherUserIds = room.slots
          .filter(Boolean)
          .filter((slotUserId) => String(slotUserId) !== String(user._id));
        if (queuedOtherUserIds.length) {
          const duplicateCardUser = await User.findOne({
            _id: { $in: queuedOtherUserIds },
            equippedCardId: user.equippedCardId
          }).select('nickname username');
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
    try {
      await advanceRaidState(now);
    } catch (err) {
      console.error('Raid advance before start error:', err);
      clearActiveRaidBattle(normalizedMode);
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
      participants.push(createRaidParticipantFromUser(user));
      participantUsers.push(user);
    }

    const duplicateCardIds = participants
      .map((participant) => participant.equippedCardId)
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
        await user.save();
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

        await latestUser.save();
        participantUsers[participantIndex] = latestUser;
        participants[participantIndex] = createRaidParticipantFromUser(latestUser);
        consumedUsers.push(latestUser);
      }
    }

    const countdownDurationMs = (RAID_COUNTDOWN_SECONDS * 1000) + RAID_COUNTDOWN_BUFFER_MS;

    const currentBoss = syncQueuedRaidBoss(now, normalizedMode) || getCurrentRaidBoss(now);
    const modeConfig = getRaidModeConfig(normalizedMode);
    const bossMaxHp = Math.round(Number(currentBoss.maxHp || 0) * Number(modeConfig.hpMultiplier || 1));
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
      potatoRehabKillUserIds: [],
      bossOvertimeDebuffs: [],
      bossPoisonDebuffs: [],
      participants,
      phase: 'countdown',
      countdownEndsAt: new Date(now.getTime() + countdownDurationMs),
      readyEndsAt: null,
      nextActionAt: new Date(now.getTime() + countdownDurationMs),
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
      modes: [RAID_MODE_NORMAL, RAID_MODE_HARD].map((entryMode) => buildRaidModeStatus(responseUser, entryMode, now)),
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
        [RAID_MODE_HARD]: buildRaidBattleSnapshot(getRaidRoom(RAID_MODE_HARD).activeBattle, userId)
      }
    };
    res.json({ raid });
  } catch (err) {
    console.error('Raid start error:', err);
    for (const user of consumedUsers) {
      try {
        refundRaidEntry(user, new Date());
        await user.save();
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
      await participantUser.save();
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
  const { userId, useSkill, targetUserId, targetUserId2 } = req.body;
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

    const card = getParticipantCard(participant);
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
    bumpRaidVersion();
    res.json({ raid: buildRaidBattleSnapshot(activeBattle, userId) });
  } catch (err) {
    console.error('Raid skill plan error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/raid/set-target', async (req, res) => {
  const { userId, targetUserId, targetSlot } = req.body;
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

    const card = getParticipantCard(participant);
    if (!card || !['ally', 'ally_pair'].includes(card.targetType)) {
      return res.status(400).json({ msg: '대상을 선택하는 스킬이 아닙니다.' });
    }

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
      await user.save();
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
      await user.save();
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
  const { userId, cardIndex } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const response = await withUserMutationLock(userId, async () => {
      const user = await User.findById(userId);
      if (!user) throw createHttpError(404, '사용자를 찾을 수 없습니다.');
      ensureUserDefaults(user);
      const parsedIndex = Number(cardIndex);
      await executeInfiniteOvertimePlayerAction(user, Number.isInteger(parsedIndex) ? parsedIndex : null);
      user.markModified('infiniteOvertime');
      await user.save();
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
      await user.save();
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
        await user.save();
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
      await user.save();
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
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    ensureUserDefaults(user);
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
    const pvp = await buildPvpStateResponse(user, now, pvpMode);
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

    if (user.gameState.level < PVP_MIN_LEVEL) {
      return res.status(400).json({ msg: '개인면담 입장은 50레벨부터 가능합니다.' });
    }
    if (modeState.battle || modeState.match) {
      return res.status(400).json({ msg: `이미 ${getPvpModeLabel(pvpMode)} 개인면담이 진행 중입니다. 관전으로 참여해주세요.` });
    }
    if (isUserInAnyPvpSession(userId)) {
      return res.json({ pvp: await buildPvpStateResponse(user, now, pvpMode) });
    }

    const entry = createPvpQueueEntry(user);
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
      displayName: user.nickname || user.username,
      targetUserId: String(targetUserId),
      targetDisplayName: target.displayName,
      amount: betAmount,
      createdAt: now
    };
    match.logs.push(`${user.nickname || user.username}님이 승부 예측 배팅을 등록했습니다.`);
    await user.save();
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

    if (user.meta.lastShoutAt && now.getTime() - new Date(user.meta.lastShoutAt).getTime() < SHOUT_COOLDOWN_MS) {
      return res.status(400).json({ msg: '외치기는 10분마다 한 번만 사용할 수 있습니다.' });
    }

    user.meta.lastShoutAt = now;
    pushShoutMessage(shoutMessage, now);

    const response = await buildUserResponseWithGlobals(user, now);
    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Shout action error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/sync', async (req, res) => {
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
      reconcileTitles(user, now);

      const syncResponse = await buildUserResponseWithGlobals(user, now);
      await user.save();
      return syncResponse;
    });
    res.json(response);
  } catch (err) {
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ msg: err.message });
    }
    if (err?.name === 'VersionError' || String(err?.message || '').includes('No matching document found for id')) {
      console.warn('Sync save conflict ignored:', err.message);
      try {
        const latestUser = await User.findById(userId);
        if (!latestUser) {
          return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
        }
        ensureUserDefaults(latestUser);
        const now = new Date();
        return res.json({
          user: buildGameStateResponse(latestUser, now),
          notifications: Array.isArray(latestUser.pendingNotifications) ? [...latestUser.pendingNotifications] : [],
          global: getGlobalState(now),
          marketplaceSoldPendingCount: await getMarketplaceSoldPendingCount(latestUser._id),
          adminMailPendingCount: await getPendingAdminMailCount(latestUser._id, now)
        });
      } catch (reloadErr) {
        console.error('Sync conflict recovery error:', reloadErr);
      }
    }
    console.error('Sync error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.get('/api/ranking', async (req, res) => {
  try {
    const now = new Date();
    await processWeeklyPvpSeasonIfNeeded(now);
    const rankingUsers = await User.find({ nickname: { $ne: null } })
      .sort({ 'gameState.level': -1, 'gameState.exp': -1 })
      .limit(20)
      .select('nickname username gameState.level gameState.exp titles emblems meta.lastSeenAt pvpStats');

    const levelRanking = rankingUsers.map((user) => ({
      nickname: user.nickname,
      displayName: buildDisplayName(user),
      equippedEmblem: getEquippedEmblemDetail(user),
      gameState: {
        level: user.gameState.level,
        exp: user.gameState.exp
      },
      isOnline: Boolean(user.meta?.lastSeenAt && now.getTime() - new Date(user.meta.lastSeenAt).getTime() <= ONLINE_THRESHOLD_MS)
    }));

    const pvpUsers = await User.find({ nickname: { $ne: null } })
      .select('nickname username titles emblems meta.lastSeenAt pvpStats');
    const pvpRanking = pvpUsers
      .map((user) => ({
        nickname: user.nickname,
        displayName: buildDisplayName(user),
        equippedEmblem: getEquippedEmblemDetail(user),
        pvpStats: {
          rating: Math.round(Number(user.pvpStats?.rating ?? PVP_RATING_BASE)),
          played: Math.max(0, Math.floor(Number(user.pvpStats?.played || 0))),
          wins: Math.max(0, Math.floor(Number(user.pvpStats?.wins || 0))),
          losses: Math.max(0, Math.floor(Number(user.pvpStats?.losses || 0)))
        },
        isOnline: Boolean(user.meta?.lastSeenAt && now.getTime() - new Date(user.meta.lastSeenAt).getTime() <= ONLINE_THRESHOLD_MS)
      }))
      .sort((a, b) => {
        const aPlayed = a.pvpStats.played > 0 ? 1 : 0;
        const bPlayed = b.pvpStats.played > 0 ? 1 : 0;
        return bPlayed - aPlayed
          || b.pvpStats.rating - a.pvpStats.rating
          || b.pvpStats.wins - a.pvpStats.wins
          || a.pvpStats.losses - b.pvpStats.losses
          || String(a.nickname || '').localeCompare(String(b.nickname || ''));
      })
      .slice(0, 20);

    res.json({ level: levelRanking, pvp: pvpRanking });
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
    const now = new Date();
    await expireAdminMails(userId, now);
    const mails = await AdminMail.find({
      recipientId: userId,
      status: 'pending',
      expiresAt: { $gt: now }
    }).sort({ createdAt: 1 }).select('_id');

    const messages = [];
    for (const mail of mails) {
      try {
        messages.push(await claimAdminMail(userId, mail._id, new Date()));
      } catch (err) {
        console.error('Admin mail claim-all item skipped:', err);
      }
    }

    const responseNow = new Date();
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    ensureUserDefaults(user);
    const response = await buildUserResponseWithGlobals(user, responseNow);
    response.mail = {
      mails: await getPendingAdminMailList(user._id, responseNow),
      claimedCount: messages.length,
      messages
    };
    res.json(response);
  } catch (err) {
    console.error('Admin mail claim all error:', err);
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
      giftCatalog: ADMIN_GIFT_CATALOG,
      currentRaidBossId: getCurrentRaidBossId(new Date()),
      raidBossOptions: RAID_BOSS_ROTATION_IDS.map((bossId) => ({
        id: bossId,
        name: RAID_BOSS_DATA[bossId]?.name || bossId
      }))
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

  if (!['item', 'buff', 'package', 'title', 'fragment'].includes(giftType)) {
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
    const mailPayload = createAdminMailGiftPayload(giftType, giftId, giftQuantity, now);
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

    await user.save();

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
      await user.save();
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
      await latestUser.save();
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

app.post('/api/admin/set-raid-boss', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { bossId } = req.body;
  if (!bossId || !RAID_BOSS_DATA[bossId]) {
    return res.status(400).json({ msg: '변경할 보스가 올바르지 않습니다.' });
  }

  if ([RAID_MODE_NORMAL, RAID_MODE_HARD].some((mode) => {
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
