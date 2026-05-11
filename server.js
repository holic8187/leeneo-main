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
const CONFIDENCE_DURATION_MS = 60 * 60 * 1000;
const FATIGUE_DURATION_MS = 4 * 60 * 60 * 1000;
const CAT_GRATITUDE_DURATION_MS = 60 * 60 * 1000;
const SHOUT_COOLDOWN_MS = 10 * 60 * 1000;
const SHOUT_VISIBLE_DURATION_MS = 36 * 1000;
const ONLINE_THRESHOLD_MS = 25 * 1000;
const SHOPPING_ADDICT_THRESHOLD = 1500000;
const SHOPPING_ADDICT_LOSE_AFTER_DAYS = 3;
const RICH_THRESHOLD = 5000000;
const BEAST_HEART_UNLOCK_THRESHOLD = 2000000;
const TITLE_CHANGE_LIMIT_DAYS = 1;
const RAID_MIN_LEVEL = 10;
const RAID_PARTY_SIZE = 5;
const RAID_ACTION_DELAY_MS = 2000;
const RAID_COUNTDOWN_SECONDS = 3;
const RAID_COUNTDOWN_BUFFER_MS = 2000;
const RAID_DAILY_LIMIT = 1;
const RAID_BOSS_ID = 'burp_queen';
const RAID_POLL_VERSION_EMPTY = 0;

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
  }
};

const CARD_DATA = {
  ineo_diet: {
    id: 'ineo_diet',
    name: '이네오의 다이어트 선언',
    grade: 'S',
    rate: 0.00025,
    skillName: '다이어트 선언',
    skillDesc: '돌아오는 턴에 기본 공격을 총 10회 합니다. 각 공격마다 크리티컬이 적용될 수 있습니다.',
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
    skillDesc: '돌아오는 턴에 기본 공격을 총 4회 합니다. 각 공격마다 크리티컬이 적용될 수 있습니다.',
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
    skillDesc: '파티원 전원의 해로운 효과를 제거합니다.',
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
    skillDesc: '돌아오는 턴에 자신의 기본 공격을 총 3회 합니다.',
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
    skillDesc: '자신의 레벨 x 8의 데미지로 5회 공격합니다.',
    cooldown: 3,
    effectType: 'self_fixed_multi_hit',
    hits: 5,
    damagePerLevel: 8
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
  delegate_lee: { multiplierPerLevel: { 0: 20, 1: 25, 3: 30, 4: 35 }, cooldown: { 0: 4, 2: 3, 5: 2 } },
  celine_tears: { attackBonusPercent: { 0: 0.3, 1: 0.4, 4: 0.5 }, expireDamagePerLevel: { 0: 50, 3: 60, 5: 65 }, cooldown: { 0: 3, 2: 2 } },
  strawberry_latte: { shield: { 0: 20, 1: 25, 3: 30, 4: 35 }, shieldTurns: { 5: 1 }, cooldown: { 0: 4, 2: 3 } },
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
  rooftop_pigeons: { damagePerLevel: { 0: 5, 1: 6, 2: 7, 3: 8, 4: 9, 5: 10 } }
};

const SUPPORT_PACKAGE_DATA = {
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
      { itemId: 'pen_monami', quantity: 2 },
      { itemId: 'business_card', quantity: 33 }
    ]
  },
  super_rich: {
    id: 'super_rich',
    name: '초부자패키지',
    price: 5000,
    rewards: [
      { itemId: 'bacchus', quantity: 10 },
      { itemId: 'pen_monami', quantity: 5 },
      { itemId: 'business_card', quantity: 55 }
    ]
  }
};

const RAID_BOSS_DATA = {
  [RAID_BOSS_ID]: {
    id: RAID_BOSS_ID,
    name: '트름녀',
    maxHp: 50000,
    imageLabel: '트름녀',
    patternOrder: ['burp', 'ice', 'smack', 'shield'],
    skillsText: [
      '1. 트름하기: 파티 전체에게 30 피해',
      '2. 얼음씹기: 랜덤 3명에게 30 피해, 1턴 침묵',
      '3. 쩝쩝거리기: 랜덤 대상에게 20 피해씩 총 4회',
      '4. 눈 새 행동: 1턴 지속 보호막 10,000 획득'
    ],
    rewardsText: [
      '경험치: 10레벨 기준 현재 레벨 경험치통의 100%, 이후 레벨당 2% 감소, 50레벨 이상은 20% 고정',
      '명함 0~2장',
      '박카스 3~5개',
      '모나미 볼펜 0~1개',
      '재화 100,000원~300,000원'
    ]
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
    reward: { type: 'item', itemId: 'hot6', quantity: 1 }
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
  }))
};

let activeShouts = [];
let raidState = {
  version: RAID_POLL_VERSION_EMPTY,
  slots: Array(RAID_PARTY_SIZE).fill(null),
  countdown: null,
  activeBattle: null
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
  cards: [{
    cardId: { type: String, required: true },
    quantity: { type: Number, default: 1 }
  }],
  enhancedCards: [{
    cardId: { type: String, required: true },
    level: { type: Number, default: 1 },
    quantity: { type: Number, default: 1 }
  }],
  equippedCardId: { type: String, default: null },
  equippedCardLevel: { type: Number, default: 0 },
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
    dailyBusinessCardPurchases: { type: Number, default: 0 },
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
    lastAdventureLog: { type: String, default: '' }
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
  if (!Array.isArray(user.cards)) user.cards = [];
  if (!Array.isArray(user.enhancedCards)) user.enhancedCards = [];
  if (!CARD_DATA[user.equippedCardId]) user.equippedCardId = null;
  user.equippedCardLevel = Math.max(0, Math.min(5, Number(user.equippedCardLevel ?? 0)));
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
      dailyBusinessCardPurchases: 0,
      lastShoppingAddictQualifiedDayKey: null
    };
  }
  user.shopState.dayKey = user.shopState.dayKey || null;
  user.shopState.dailySpend = Number(user.shopState.dailySpend ?? 0);
  user.shopState.dailyBusinessCardPurchases = Number(user.shopState.dailyBusinessCardPurchases ?? 0);
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
      lastAdventureLog: ''
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
  user.meta.lastAdventureLog = user.meta.lastAdventureLog || '';

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

  card.enhancementLevel = level;
  card.borderColor = getCardEnhancementColor(level);
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
    case 'gangnam_style':
    case 'celine_tears':
    case 'sherlock':
    case 'blind_date':
    case 'military_service':
    case 'ride_line':
      return `${card.turns || 1}턴`;
    case 'strawberry_latte':
      return Number(card.shieldTurns || 0) > 0 ? `${Number(card.shieldTurns || 0)}턴` : '이번 턴까지만';
    case 'rebuttal':
    case 'delegate_lee':
    case 'fantasy':
    case 'broken_leg':
    case 'rooftop_pigeons':
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
    case 'pho':
      return '즉시 부여';
    case 'cider_comment':
    case 'invincible_logic':
      return '1회';
    default:
      return '즉시';
  }
}

function buildCardSkillDescription(cardId, enhancementLevel = 0) {
  const card = getCardDefinition(cardId, enhancementLevel);
  if (!card) return '';

  switch (cardId) {
    case 'ineo_diet':
      return `다음 자신의 턴에 기본 공격을 총 ${card.hits}회 합니다.`;
    case 'gangnam_style':
      return `파티 전원에게 크리티컬률 ${formatCardPercentText(card.critBonus)}와 흥겨움을 부여하고, 보호막 ${card.shield}을 제공합니다.`;
    case 'delegate_lee':
      return `현재 입장한 파티원의 전체 레벨 합 x ${card.multiplierPerLevel}의 데미지를 1회 가합니다.`;
    case 'celine_tears':
      return `공격력 ${formatCardPercentText(card.attackBonusPercent)} 증가, 종료 시 자신의 레벨 x ${card.expireDamagePerLevel} 추가 피해`;
    case 'strawberry_latte':
      return `파티 전원에게 보호막 ${card.shield}을 제공합니다.`;
    case 'rebuttal':
      return `파티원 전체의 HP를 ${card.heal} 회복합니다.${card.includeSelf ? ' 자신도 포함됩니다.' : ' 자신은 제외됩니다.'}`;
    case 'parking_master':
      return `다음 자신의 턴에 기본 공격을 총 ${card.hits}회 합니다.`;
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
      return card.targets >= 99 ? '파티 전원의 해로운 효과를 제거합니다.' : `랜덤 파티원 ${card.targets}명의 해로운 효과를 제거합니다.`;
    case 'broken_leg':
      return `선택한 파티원 1명의 HP를 ${card.heal} 회복시킵니다.`;
    case 'military_service':
      return `이번 턴 자신의 모든 공격에 자신의 레벨 x ${card.bonusPerLevel} 추가 피해를 줍니다.`;
    case 'invincible_logic':
      return `랜덤 파티원 ${card.targets}인에게 피격 무효 ${card.negateHitCount}회를 부여합니다.`;
    case 'ride_line':
      return `랜덤 파티원 ${card.targets}인의 공격력을 ${formatCardPercentText(card.attackBonusPercent)} 증가시킵니다.`;
    case 'wig':
      return `다음 자신의 턴에 기본 공격을 총 ${card.hits}회 합니다.`;
    case 'chatgpt':
      return `다음 자신의 턴 기본 공격에 더해 자신의 레벨 x ${card.bonusPerLevel} 추가 피해를 입힙니다.`;
    case 'pho':
      return `랜덤 파티원 ${card.targets}명에게 각각 보호막 ${card.shield}을 제공합니다.`;
    case 'coca_cola':
      return `선택한 파티원 1인의 공격력을 ${formatCardPercentText(card.attackBonusPercent)} 증가시킵니다.`;
    case 'cider_comment':
      return `선택한 파티원 1인에게 디버프 무효 ${card.debuffImmuneCount}회를 제공합니다.`;
    case 'rooftop_pigeons':
      return `자신의 레벨 x ${card.damagePerLevel}의 데미지로 ${card.hits}회 공격합니다.`;
    default:
      return card.skillDesc || '';
  }
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

async function runUserMutationWithRetry(userId, mutateUser, options = {}) {
  const {
    maxRetries = 5,
    conflictLabel = 'User mutation conflict'
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

function getCardEntry(user, cardId) {
  return user.cards.find((card) => card.cardId === cardId);
}

function getEnhancedCardEntry(user, cardId, level) {
  const normalizedLevel = normalizeCardEnhancementLevel(level);
  return (user.enhancedCards || []).find((card) => card.cardId === cardId && Number(card.level) === normalizedLevel);
}

function getInventoryQuantity(user, itemId) {
  return getInventoryItem(user, itemId)?.quantity || 0;
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

function addItemToInventory(user, itemId, amount = 1) {
  if (amount <= 0) return;
  const item = getInventoryItem(user, itemId);
  if (item) {
    item.quantity += amount;
  } else {
    user.inventory.push({ itemId, quantity: amount });
  }
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
    skillDesc: buildCardSkillDescription(card.id, 0),
    cooldown: getCardDefinition(card.id, 0)?.cooldown ?? card.cooldown,
    durationText: getCardDurationText(card.id, 0),
    targetType: card.targetType || null
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
        skillDesc: buildCardSkillDescription(card.id, 0),
        cooldown: resolved.cooldown,
        durationText: getCardDurationText(card.id, 0),
        canEnhance: true,
        availableEnhanceQuantity: baseQuantity,
        enhanceSuccessRate: getCardEnhancementSuccessRate(0),
        enhanceCost: getCardEnhancementCost(card.id, 0),
        nextEnhancementPreview: nextPreview ? {
          enhancementLevel: 1,
          name: nextPreview.displayName,
          skillName: nextPreview.skillName,
          skillDesc: buildCardSkillDescription(card.id, 1),
          cooldown: nextPreview.cooldown,
          durationText: getCardDurationText(card.id, 1),
          borderColor: nextPreview.borderColor
        } : null
      });
    }
  });

  (user.enhancedCards || [])
    .filter((entry) => CARD_DATA[entry.cardId] && Number(entry.quantity) > 0)
    .forEach((entry) => {
      const resolved = getCardDefinition(entry.cardId, entry.level);
      const normalizedLevel = normalizeCardEnhancementLevel(entry.level);
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
        skillDesc: buildCardSkillDescription(entry.cardId, normalizedLevel),
        cooldown: resolved.cooldown,
        durationText: getCardDurationText(entry.cardId, normalizedLevel),
        canEnhance: normalizedLevel < 5,
        availableEnhanceQuantity: Number(entry.quantity),
        enhanceSuccessRate: normalizedLevel < 5 ? getCardEnhancementSuccessRate(normalizedLevel) : 0,
        enhanceCost: normalizedLevel < 5 ? getCardEnhancementCost(entry.cardId, normalizedLevel) : 0,
        nextEnhancementPreview: nextPreview ? {
          enhancementLevel: nextLevel,
          name: nextPreview.displayName,
          skillName: nextPreview.skillName,
          skillDesc: buildCardSkillDescription(entry.cardId, nextLevel),
          cooldown: nextPreview.cooldown,
          durationText: getCardDurationText(entry.cardId, nextLevel),
          borderColor: nextPreview.borderColor
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
  const item = getInventoryItem(user, itemId);
  if (!item || item.quantity < amount) return false;

  item.quantity -= amount;
  if (item.quantity <= 0) {
    user.inventory = user.inventory.filter((entry) => entry.itemId !== itemId);
  }
  return true;
}

function bumpRaidVersion() {
  raidState.version += 1;
}

function clearActiveRaidBattle() {
  raidState.activeBattle = null;
  bumpRaidVersion();
}

function findQueuedRaidSlotIndex(userId) {
  return raidState.slots.findIndex((slotUserId) => String(slotUserId) === String(userId));
}

function clearQueuedRaidUser(userId) {
  const slotIndex = findQueuedRaidSlotIndex(userId);
  if (slotIndex >= 0) {
    raidState.slots[slotIndex] = null;
    bumpRaidVersion();
  }
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
    equippedCardSkillDesc: equippedCard ? buildCardSkillDescription(equippedCard.id, equippedCard.enhancementLevel || 0) : '',
    equippedCardCooldown: Number(equippedCard?.cooldown || 0),
    equippedCardPassiveOnly: Boolean(equippedCard?.passiveOnly),
    equippedCardEnhancementLevel: Number(equippedCard?.enhancementLevel || 0),
    equippedCardBorderColor: equippedCard?.borderColor || ''
  };
}

function createRaidParticipantFromUser(user) {
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
    plannedSkill: false,
    plannedTargetUserId: null,
    plannedTargetUserId2: null,
    skillCooldown: 0,
    equippedCardId: user.equippedCardId || null,
    equippedCardLevel: normalizeCardEnhancementLevel(user.equippedCardLevel || 0),
    extraHits: 0,
    extraDamage: 0,
    damageMultiplierTurns: 0,
    damageMultiplierValue: 1,
    critBonusTurns: 0,
    critBonusValue: 0,
    hypeTurns: 0,
    counterTurns: 0,
    counterDamageMultiplier: 1,
    rewardMultiplier: 1,
    sojuRewardBuff: false,
    sojuRewardMultiplier: 1,
    lottoRewardBuff: false,
    lottoRewardSuccessChance: 0.5,
    negateHitCount: 0,
    debuffImmuneCount: 0,
    attackBonusTurns: 0,
    attackBonusPercent: 0,
    perHitBonusTurns: 0,
    perHitBonusDamage: 0,
    celineTurns: 0,
    celineExpireDamage: 0,
    celineAttackBonusPercent: 0,
    cardEffectAmpTurns: 0,
    cardEffectAmpValue: 1,
    rotationIndex: 0
  };
}

function setOrRefreshBuff(user, buffId, durationMs, options = {}) {
  const now = options.now || new Date();
  const existingBuff = user.buffs.find((buff) => buff.buffId === buffId);
  const shouldStack = Boolean(options.stackDuration);
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
  if (['pen_monami', 'pen_jetstream'].includes(itemId)) {
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

  if (!['pen_monami', 'pen_jetstream'].includes(itemId)) {
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

function buildRaidParticipantStatusEffects(participant) {
  const effects = [];
  if (Number(participant.silenceTurns || 0) > 0) effects.push({ type: 'debuff', name: '침묵', turns: Number(participant.silenceTurns || 0), desc: '스킬 사용 불가' });
  if (Number(participant.counterTurns || 0) > 0) effects.push({ type: 'buff', name: '반격', turns: Number(participant.counterTurns || 0), desc: '보스에게 피격당하면 기본 공격으로 반격' });
  if (Number(participant.negateHitCount || 0) > 0) effects.push({ type: 'buff', name: '피격 무효', count: Number(participant.negateHitCount || 0), desc: '다음 피격을 무효화' });
  if (Number(participant.debuffImmuneCount || 0) > 0) effects.push({ type: 'buff', name: '디버프 무효', count: Number(participant.debuffImmuneCount || 0), desc: '다음 디버프를 무효화' });
  if (Number(participant.critBonusTurns || 0) > 0) effects.push({ type: 'buff', name: '크리티컬 상승', turns: Number(participant.critBonusTurns || 0), desc: `치명타 확률 +${Math.round(Number(participant.critBonusValue || 0) * 100)}%` });
  if (Number(participant.hypeTurns || 0) > 0) effects.push({ type: 'buff', name: '흥겨움', turns: Number(participant.hypeTurns || 0), desc: '기본 공격 횟수 2배' });
  if (Number(participant.attackBonusTurns || 0) > 0) effects.push({ type: 'buff', name: '공격력 상승', turns: Number(participant.attackBonusTurns || 0), desc: `공격력 +${Math.round(Number(participant.attackBonusPercent || 0) * 100)}%` });
  if (Number(participant.damageMultiplierTurns || 0) > 0) effects.push({ type: 'buff', name: '피해 증폭', turns: Number(participant.damageMultiplierTurns || 0), desc: `가하는 피해 x${Number(participant.damageMultiplierValue || 1).toFixed(2)}` });
  if (Number(participant.perHitBonusTurns || 0) > 0) effects.push({ type: 'buff', name: '추가 타격 피해', turns: Number(participant.perHitBonusTurns || 0), desc: `공격마다 +${Number(participant.perHitBonusDamage || 0).toLocaleString()} 피해` });
  if (Number(participant.celineTurns || 0) > 0) effects.push({ type: 'buff', name: '셀린느', turns: Number(participant.celineTurns || 0), desc: `공격력 +${Math.round(Number(participant.celineAttackBonusPercent || 0) * 100)}%, 종료 시 추가 피해` });
  if (Number(participant.cardEffectAmpTurns || 0) > 0) effects.push({ type: 'buff', name: '소개팅 상대', turns: Number(participant.cardEffectAmpTurns || 0), desc: `카드 효과 x${Number(participant.cardEffectAmpValue || 1).toFixed(2)}` });
  if (participant.sojuRewardBuff) effects.push({ type: 'buff', name: '소주각?', desc: `전투 승리 시 전리품 ${Number(participant.sojuRewardMultiplier || 1).toFixed(1)}배` });
  if (participant.lottoRewardBuff) effects.push({ type: 'buff', name: '이번엔 될거같아', desc: `전투 승리 시 ${formatCardPercentText(participant.lottoRewardSuccessChance || 0.5)} 확률로 전리품 3배 또는 보상 없음` });
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
  const cards = Object.values(CARD_DATA);
  const totalWeight = cards.reduce((sum, card) => sum + Number(card.rate || 0), 0);
  if (totalWeight <= 0) return cards[cards.length - 1];
  const roll = Math.random() * totalWeight;
  let cumulative = 0;
  for (const card of cards) {
    cumulative += Number(card.rate || 0);
    if (roll <= cumulative) return card;
  }
  return cards[cards.length - 1];
}

function getRaidLobbySummary() {
  const boss = RAID_BOSS_DATA[RAID_BOSS_ID];
  return {
    bossId: boss.id,
    bossName: boss.name,
    minLevel: RAID_MIN_LEVEL,
    skillsText: boss.skillsText || [],
    rewardsText: boss.rewardsText
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

function applyRaidDamage(target, damage) {
  let remainingDamage = damage;
  let blocked = 0;
  if (target.shield > 0) {
    blocked = Math.min(target.shield, remainingDamage);
    target.shield -= blocked;
    remainingDamage -= blocked;
    if (target.tempShieldAmount > 0) {
      target.tempShieldAmount = Math.max(0, Number(target.tempShieldAmount || 0) - blocked);
    }
  }
  target.hp = Math.max(0, target.hp - remainingDamage);
  target.lastShieldLoss = blocked;
  target.lastHpLoss = remainingDamage;
  return remainingDamage;
}

function healRaidTarget(target, amount) {
  target.hp = Math.min(target.maxHp, target.hp + amount);
}

function cleanseRaidTarget(target) {
  target.silenceTurns = 0;
}

function getRaidCriticalChance(participant) {
  const baseChance = 0.1;
  const bonus = participant.critBonusTurns > 0 ? 0.5 : 0;
  return Math.min(1, baseChance + bonus);
}

function performRaidBasicAttack(participant, battle) {
  const baseDamage = participant.level * 20;
  const hitCount = Math.max(1, 1 + participant.extraHits);
  let totalDamage = 0;
  let critCount = 0;

  for (let hit = 0; hit < hitCount; hit += 1) {
    const isCritical = Math.random() < getRaidCriticalChance(participant);
    const hitDamage = Math.floor(baseDamage * (isCritical ? 1.5 : 1));
    totalDamage += hitDamage;
    if (isCritical) critCount += 1;
  }

  totalDamage += participant.extraDamage;
  if (participant.damageMultiplierTurns > 0) {
    totalDamage = Math.floor(totalDamage * participant.damageMultiplierValue);
  }

  battle.bossHp = Math.max(0, battle.bossHp - totalDamage);
  battle.bossLastHpLoss = totalDamage;
  const criticalText = critCount > 0 ? ` (치명타 ${critCount}회)` : '';
  return `${participant.displayName}의 기본 공격이 ${totalDamage.toLocaleString()} 피해를 입혔습니다.${criticalText}`;
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

  if (!participant.plannedSkill || participant.skillCooldown > 0) {
    return null;
  }

  const ampMultiplier = getRaidCardEffectAmpMultiplier(participant);
  const scaleFlat = (value) => Math.max(0, Math.floor(Number(value || 0) * ampMultiplier));
  const scalePercent = (value) => Number((Number(value || 0) * ampMultiplier).toFixed(4));
  const scaleCount = (value) => Math.max(1, Math.ceil(Number(value || 0) * ampMultiplier));
  const scaleBonusMultiplier = (value) => Number((1 + ((Number(value || 1) - 1) * ampMultiplier)).toFixed(4));

  participant.skillCooldown = card.cooldown + 1;
  participant.plannedSkill = false;
  let logText = `${participant.displayName}(이)가 ${card.name} 스킬을 사용했습니다.`;

  if (card.effectType === 'self_multi_hit') {
    participant.extraHits = Math.max(participant.extraHits, scaleCount(card.hits) - 1);
  } else if (card.effectType === 'self_fixed_multi_hit') {
    const hits = Math.max(1, Number(card.hits || 1));
    const perHitDamage = scaleFlat(participant.level * Number(card.damagePerLevel || 0));
    const logs = [`${participant.displayName}(이)가 ${card.name} 스킬을 사용했습니다.`];
    for (let hit = 0; hit < hits; hit += 1) {
      if (battle.bossHp <= 0) break;
      applyRaidDamageToBoss(battle, perHitDamage);
      logs.push(`${participant.displayName}의 ${card.name} ${hit + 1}타! ${perHitDamage.toLocaleString()} 피해를 입혔습니다.`);
    }
    participant.plannedTargetUserId = null;
    participant.plannedTargetUserId2 = null;
    return {
      logs,
      delayUnits: Math.max(1, logs.length - 1)
    };
  } else if (card.effectType === 'self_celine_buff') {
    participant.celineTurns = Math.max(participant.celineTurns, Number(card.turns || 1));
    participant.celineAttackBonusPercent = Math.max(Number(participant.celineAttackBonusPercent || 0), scalePercent(card.attackBonusPercent));
    participant.celineExpireDamage = Math.max(Number(participant.celineExpireDamage || 0), scaleFlat(participant.level * Number(card.expireDamagePerLevel || 0)));
    logText = `${participant.displayName}(이)가 <셀린느> 버프를 얻었습니다.`;
  } else if (card.effectType === 'party_shield') {
    const shieldAmount = scaleFlat(card.shield);
    const shieldTurns = Math.max(0, Number(card.shieldTurns || 0));
    battle.participants.forEach((ally) => {
      if (ally.hp > 0) {
        ally.shield += shieldAmount;
        if (shieldTurns > 0) {
          const appliedShieldTurns = ally.userId === participant.userId ? shieldTurns + 1 : shieldTurns;
          ally.tempShieldAmount = Number(ally.tempShieldAmount || 0) + shieldAmount;
          ally.tempShieldTurns = Math.max(Number(ally.tempShieldTurns || 0), appliedShieldTurns);
        } else {
          ally.roundShieldAmount = Number(ally.roundShieldAmount || 0) + shieldAmount;
        }
      }
    });
    logText = `${participant.displayName}(이)가 ${card.name}로 파티 전원에게 보호막 ${shieldAmount}을 부여했습니다.`;
  } else if (card.effectType === 'party_heal') {
    const healAmount = scaleFlat(card.heal);
    battle.participants.forEach((ally) => {
      if (ally.hp > 0 && (card.includeSelf || ally.userId !== participant.userId)) healRaidTarget(ally, healAmount);
    });
    logText = `${participant.displayName}(이)가 ${card.name}로 파티 전원의 HP를 ${healAmount} 회복시켰습니다.`;
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
    battle.participants.forEach((ally) => {
      if (ally.hp > 0) {
        const appliedCritTurns = ally.userId === participant.userId ? card.turns + 1 : card.turns;
        const appliedHypeTurns = ally.userId === participant.userId ? (card.hypeTurns || 1) + 1 : (card.hypeTurns || 1);
        const appliedShieldTurns = ally.userId === participant.userId ? card.turns + 1 : card.turns;
        ally.critBonusTurns = Math.max(ally.critBonusTurns, appliedCritTurns);
        ally.critBonusValue = Math.max(Number(ally.critBonusValue || 0), critBonus);
        ally.hypeTurns = Math.max(ally.hypeTurns, appliedHypeTurns);
        ally.shield += shieldAmount;
        ally.tempShieldAmount = Number(ally.tempShieldAmount || 0) + shieldAmount;
        ally.tempShieldTurns = Math.max(Number(ally.tempShieldTurns || 0), appliedShieldTurns);
      }
    });
    logText = `${participant.displayName}(이)가 ${card.name}로 파티 전원에게 흥겨움, 크리티컬 버프와 보호막 ${shieldAmount}을 부여했습니다.`;
  } else if (card.effectType === 'party_level_blast') {
    const totalLevels = battle.participants.reduce((sum, member) => sum + Number(member.level || 0), 0);
    const damage = scaleFlat(totalLevels * Number(card.multiplierPerLevel || 0));
    applyRaidDamageToBoss(battle, damage);
    logText = `${participant.displayName}(이)가 ${card.name}로 ${damage.toLocaleString()} 피해를 가했습니다.`;
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
    logText = `${participant.displayName}(이)가 ${card.name}로 ${targets.length >= aliveAllies.length ? '파티 전원' : targets.map((ally) => ally.displayName).join(', ')}의 해로운 효과를 제거했습니다.`;
  } else if (card.effectType === 'target_heal') {
    const selectedTargetId = participant.plannedTargetUserId;
    const target = getRaidParticipant(battle, selectedTargetId) || getAliveRaidParticipants(battle)[0] || participant;
    const healAmount = scaleFlat(card.heal);
    healRaidTarget(target, healAmount);
    logText = `${participant.displayName}(이)가 ${card.name}로 ${target.displayName}의 HP를 ${healAmount} 회복시켰습니다.`;
  } else if (card.effectType === 'self_bonus_damage') {
    participant.extraDamage = scaleFlat(participant.level * Number(card.bonusPerLevel || 0));
  } else if (card.effectType === 'self_per_hit_bonus') {
    participant.perHitBonusDamage = scaleFlat(participant.level * Number(card.bonusPerLevel || 0));
    participant.perHitBonusTurns = 1;
    logText = `${participant.displayName}(이)가 ${card.name}로 이번 턴 공격마다 추가 피해를 준비했습니다.`;
  } else if (card.effectType === 'random_shield') {
    const aliveAllies = getAliveRaidParticipants(battle);
    const shuffled = [...aliveAllies].sort(() => Math.random() - 0.5).slice(0, Math.min(card.targets, aliveAllies.length));
    const shieldAmount = scaleFlat(card.shield);
    shuffled.forEach((target) => {
      target.shield += shieldAmount;
    });
    logText = `${participant.displayName}(이)가 ${card.name}로 ${shuffled.length}명에게 보호막 ${shieldAmount}을 부여했습니다.`;
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
  }

  participant.plannedTargetUserId = null;
  participant.plannedTargetUserId2 = null;
  return logText;
}

function tickRaidParticipantEndOfTurn(participant, battle) {
  if (participant.skillCooldown > 0) participant.skillCooldown -= 1;
  if (participant.silenceTurns > 0) participant.silenceTurns -= 1;
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
  if (participant.hypeTurns > 0) participant.hypeTurns -= 1;
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
  if (participant.cardEffectAmpTurns > 0) {
    participant.cardEffectAmpTurns -= 1;
    if (participant.cardEffectAmpTurns <= 0) participant.cardEffectAmpValue = 1;
  }
  if (participant.celineTurns > 0) {
    participant.celineTurns -= 1;
    if (participant.celineTurns <= 0) {
      const expireDamage = Number(participant.celineExpireDamage || 0);
      if (battle && expireDamage > 0 && battle.bossHp > 0) {
        applyRaidDamageToBoss(battle, expireDamage);
        battle.logs.push(`${participant.displayName}의 <셀린느> 버프가 종료되며 ${expireDamage.toLocaleString()} 피해를 입혔습니다.`);
      }
      participant.celineExpireDamage = 0;
      participant.celineAttackBonusPercent = 0;
    }
  }
  participant.extraHits = 0;
  participant.extraDamage = 0;
}

function performRaidBossAction(battle) {
  if (battle.bossShieldTurns > 0) {
    battle.bossShieldTurns -= 1;
    if (battle.bossShieldTurns <= 0) {
      battle.bossShield = 0;
    }
  }

  const pattern = RAID_BOSS_DATA[battle.bossId].patternOrder[battle.bossPatternIndex % RAID_BOSS_DATA[battle.bossId].patternOrder.length];
  battle.bossPatternIndex += 1;
  const aliveParticipants = getAliveRaidParticipants(battle);
  if (aliveParticipants.length === 0) return '트름녀가 승리의 포즈를 취했습니다.';

  if (pattern === 'burp') {
    aliveParticipants.forEach((participant) => {
      applyRaidDamage(participant, 30);
    });
    return '트름녀의 트름하기! 파티 전체가 30 피해를 받았습니다.';
  }

  if (pattern === 'smack') {
    const targetNames = [];
    for (let count = 0; count < 4; count += 1) {
      const currentAlive = getAliveRaidParticipants(battle);
      if (currentAlive.length === 0) break;
      const target = currentAlive[Math.floor(Math.random() * currentAlive.length)];
      applyRaidDamage(target, 20);
      targetNames.push(target.displayName);
    }
    return `트름녀의 쩝쩝거리기! ${targetNames.join(', ')}에게 연속 공격이 날아갔습니다.`;
  }

  if (pattern === 'ice') {
    const targets = [...aliveParticipants]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(3, aliveParticipants.length));
    targets.forEach((participant) => {
      applyRaidDamage(participant, 30);
      participant.silenceTurns = Math.max(participant.silenceTurns, 1);
    });
    return `트름녀의 얼음씹기! ${targets.map((participant) => participant.displayName).join(', ')} 이(가) 30 피해를 받고 1턴 침묵에 걸렸습니다.`;
  }

  return '트름녀가 잠시 숨을 골랐습니다.';
}

function buildRaidBattleSnapshot(activeBattle, viewerUserId = null) {
  if (!activeBattle) return null;
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
    bossId: activeBattle.bossId,
    bossName: RAID_BOSS_DATA[activeBattle.bossId].name,
    bossHp: activeBattle.bossHp,
    bossMaxHp: activeBattle.bossMaxHp,
    bossLastHpLoss: activeBattle.bossLastHpLoss || 0,
    phase: activeBattle.phase,
    currentTurnIndex: activeBattle.turnIndex,
    bossPatternIndex: activeBattle.bossPatternIndex,
    nextActionAt: activeBattle.nextActionAt,
    countdownEndsAt: activeBattle.countdownEndsAt || null,
    isParticipant: viewerUserId ? isRaidUserParticipant(activeBattle, viewerUserId) : false,
    participants: activeBattle.participants.map((participant, index) => {
      const card = getParticipantCard(participant);
      return {
        turnOrder: index,
        userId: participant.userId,
        displayName: participant.displayName,
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
        equippedCardId: participant.equippedCardId || null,
        equippedCardName: card?.name || '장착 카드 없음',
        equippedCardGrade: card?.grade || null,
        skillName: card?.skillName || '',
        skillDesc: card?.skillDesc || '',
        targetType: card?.targetType || null,
        isSelf: viewerUserId ? participant.userId === String(viewerUserId) : false
      };
    }),
    recentLogs: activeBattle.logs.slice(-8)
  };
}

function getRaidCardEffectAmpMultiplier(participant) {
  return participant.cardEffectAmpTurns > 0 ? Number(participant.cardEffectAmpValue || 1) : 1;
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
  return baseBonus + celineBonus;
}

function applyRaidDamageToBoss(battle, damage) {
  let remainingDamage = damage;
  if (battle.bossShield > 0) {
    const blocked = Math.min(battle.bossShield, remainingDamage);
    battle.bossShield -= blocked;
    remainingDamage -= blocked;
  }
  battle.bossHp = Math.max(0, battle.bossHp - remainingDamage);
  battle.bossLastHpLoss = remainingDamage;
  return remainingDamage;
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

function performRaidCounterAttack(participant, battle) {
  const baseDamage = Math.floor(participant.level * 20 * (1 + getRaidAttackBonusPercent(participant)));
  const isCritical = Math.random() < getRaidCriticalChance(participant);
  let damage = Math.floor(baseDamage * Number(participant.counterDamageMultiplier || 1) * (isCritical ? 1.5 : 1));
  if (participant.perHitBonusTurns > 0) damage += participant.perHitBonusDamage || 0;
  if (participant.damageMultiplierTurns > 0) {
    damage = Math.floor(damage * participant.damageMultiplierValue);
  }
  applyRaidDamageToBoss(battle, damage);
  return `${participant.displayName}의 반격! ${damage.toLocaleString()} 피해를 입혔습니다.${isCritical ? ' (치명타)' : ''}`;
}

function applyRaidDamage(target, damage, options = {}) {
  if (!target || target.hp <= 0) return 0;
  if ((options.allowNegate ?? true) && target.negateHitCount > 0) {
    target.negateHitCount -= 1;
    target.lastShieldLoss = 0;
    target.lastHpLoss = 0;
    return 0;
  }

  let remainingDamage = damage;
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

  if (options.source === 'boss' && options.battle && target.counterTurns > 0 && target.hp > 0) {
    options.battle.logs.push(performRaidCounterAttack(target, options.battle));
  }

  return remainingDamage;
}

function getRaidCriticalChance(participant) {
  const baseChance = 0.1;
  const bonus = participant.critBonusTurns > 0 ? Number(participant.critBonusValue || 0) : 0;
  return Math.min(1, baseChance + bonus);
}

function performRaidBasicAttack(participant, battle) {
  const baseDamage = Math.floor(participant.level * 20 * (1 + getRaidAttackBonusPercent(participant)));
  let hitCount = Math.max(1, 1 + participant.extraHits);
  if (participant.hypeTurns > 0) hitCount *= 2;
  const logs = [];

  for (let hit = 0; hit < hitCount; hit += 1) {
    if (battle.bossHp <= 0) break;
    const isCritical = Math.random() < getRaidCriticalChance(participant);
    let hitDamage = Math.floor(baseDamage * (isCritical ? 1.5 : 1));
    if (participant.perHitBonusTurns > 0) {
      hitDamage += participant.perHitBonusDamage || 0;
    }
    if (hit === 0 && participant.extraDamage > 0) {
      hitDamage += participant.extraDamage;
    }
    if (participant.damageMultiplierTurns > 0) {
      hitDamage = Math.floor(hitDamage * participant.damageMultiplierValue);
    }
    applyRaidDamageToBoss(battle, hitDamage);
    logs.push(`${participant.displayName}의 기본 공격 ${hit + 1}타! ${hitDamage.toLocaleString()} 피해를 입혔습니다.${isCritical ? ' (치명타)' : ''}`);
  }

  if (!logs.length) {
    logs.push(`${participant.displayName}의 기본 공격은 더 이상 이어지지 않았습니다.`);
  }

  return {
    logs,
    delayUnits: Math.max(1, logs.length)
  };
}

function applyRaidDebuffImmunity(target) {
  if (target.debuffImmuneCount > 0) {
    target.debuffImmuneCount -= 1;
    return true;
  }
  return false;
}

function performRaidBossAction(battle) {
  const pattern = RAID_BOSS_DATA[battle.bossId].patternOrder[battle.bossPatternIndex % RAID_BOSS_DATA[battle.bossId].patternOrder.length];
  battle.bossPatternIndex += 1;
  const aliveParticipants = getAliveRaidParticipants(battle);
  if (aliveParticipants.length === 0) return '트름녀가 승리의 포즈를 취했습니다.';

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
    const logs = [];
    for (let count = 0; count < 4; count += 1) {
      const currentAlive = getAliveRaidParticipants(battle);
      if (currentAlive.length === 0) break;
      const target = currentAlive[Math.floor(Math.random() * currentAlive.length)];
      applyRaidDamage(target, 20, { battle, source: 'boss' });
      logs.push(`트름녀의 쩝쩝거리기 ${count + 1}타! ${target.displayName}에게 20 피해를 입혔습니다.`);
    }
    clearRoundShieldEffects(battle);
    return {
      logs: logs.length ? logs : ['트름녀의 쩝쩝거리기! 아무도 맞지 않았습니다.'],
      delayUnits: Math.max(1, logs.length)
    };
  }

  if (pattern === 'shield') {
    battle.bossShield = Number(battle.bossShield || 0) + 10000;
    battle.bossShieldTurns = 1;
    battle.bossLastHpLoss = 0;
    clearRoundShieldEffects(battle);
    return '트름녀의 눈 새 행동! 1턴 지속되는 10000의 실드를 획득했습니다.';
  }

  return '트름녀가 잠시 숨을 골랐습니다.';
}

function buildRaidBattleSnapshot(activeBattle, viewerUserId = null) {
  if (!activeBattle) return null;
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
    bossId: activeBattle.bossId,
    bossName: RAID_BOSS_DATA[activeBattle.bossId].name,
    bossHp: activeBattle.bossHp,
    bossMaxHp: activeBattle.bossMaxHp,
    bossShield: activeBattle.bossShield || 0,
    bossLastHpLoss: activeBattle.bossLastHpLoss || 0,
    phase: activeBattle.phase,
    currentTurnIndex: activeBattle.turnIndex,
    bossPatternIndex: activeBattle.bossPatternIndex,
    nextActionAt: activeBattle.nextActionAt,
    countdownEndsAt: activeBattle.countdownEndsAt || null,
    isParticipant: viewerUserId ? isRaidUserParticipant(activeBattle, viewerUserId) : false,
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
        skillName: card?.skillName || '',
        skillDesc: card ? buildCardSkillDescription(card.id, card.enhancementLevel || 0) : '',
        targetType: card?.targetType || null,
        passiveOnly: Boolean(card?.passiveOnly),
        statusEffects: buildRaidParticipantStatusEffects(participant),
        isSelf: viewerUserId ? participant.userId === String(viewerUserId) : false
      };
    }),
    recentLogs: sanitizedLogs
  };
}

function applyRaidBattleStartPassives(activeBattle) {
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

async function buildRaidStateResponse(user, now = new Date()) {
  try {
    await advanceRaidState(now);
  } catch (err) {
    console.error('Raid state reconciliation error:', err);
    clearActiveRaidBattle();
  }

  const queuedUserIds = raidState.slots.filter(Boolean);
  const queuedUsers = queuedUserIds.length
    ? await User.find({ _id: { $in: queuedUserIds } }).select('nickname username gameState.level equippedCardId equippedCardLevel cards enhancedCards titles')
    : [];
  const queuedMap = new Map(queuedUsers.map((queuedUser) => [String(queuedUser._id), queuedUser]));

  const slots = raidState.slots.map((slotUserId) => {
    if (!slotUserId) return null;
    const queuedUser = queuedMap.get(String(slotUserId));
    if (!queuedUser) return null;
    ensureUserDefaults(queuedUser);
    return buildQueuedSlotSnapshot(queuedUser);
  });

  const slotIndex = findQueuedRaidSlotIndex(user._id);
  return {
    version: raidState.version,
    lobby: getRaidLobbySummary(),
    slots,
    queuedSlotIndex: slotIndex,
    todayUsed: isRaidAlreadyUsedToday(user, now),
    remainingEntries: getRaidRemainingEntries(user, now),
    minLevelMet: user.gameState.level >= RAID_MIN_LEVEL,
    canStart: slotIndex === slots.findIndex(Boolean) && slotIndex !== -1 && !raidState.activeBattle,
    countdown: raidState.activeBattle?.phase === 'countdown'
      ? {
          active: true,
          endsAt: raidState.activeBattle.countdownEndsAt,
          participantIds: raidState.activeBattle.participants.map((participant) => participant.userId)
        }
      : null,
    activeBattle: buildRaidBattleSnapshot(raidState.activeBattle, user._id)
  };
}

async function finalizeRaidBattle(activeBattle, now = new Date()) {
  if (!activeBattle || activeBattle.finalized) return;
  activeBattle.finalizing = true;
  const participantIds = activeBattle.participants.map((participant) => participant.userId);
  const sharedBaseRewards = activeBattle.winner === 'players'
    ? {
        businessCards: Math.floor(Math.random() * 3),
        bacchus: 3 + Math.floor(Math.random() * 3),
        monami: Math.floor(Math.random() * 2),
        moneyReward: 100000 + Math.floor(Math.random() * 200001)
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
      let rewardMultiplier = 1;
      const rewardNotes = [];
      if (participant.sojuRewardBuff) {
        rewardMultiplier *= Number(participant.sojuRewardMultiplier || 1);
        rewardNotes.push(`소주각? 적용으로 전리품 ${Number(participant.sojuRewardMultiplier || 1).toFixed(1)}배`);
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
      const expReward = Math.floor(getRequiredExp(participant.level) * rewardRatio * rewardMultiplier);
      const businessCards = (sharedBaseRewards?.businessCards || 0) * rewardMultiplier;
      const bacchus = (sharedBaseRewards?.bacchus || 0) * rewardMultiplier;
      const monami = (sharedBaseRewards?.monami || 0) * rewardMultiplier;
      const moneyReward = (sharedBaseRewards?.moneyReward || 0) * rewardMultiplier;
      user.gameState.exp += expReward;
      checkLevelUp(user);
      addItemToInventory(user, 'business_card', businessCards);
      addItemToInventory(user, 'bacchus', bacchus);
      addItemToInventory(user, 'pen_monami', monami);
      user.gameState.money += moneyReward;
      queueNotification(
        user,
        'raid_reward',
        `보스 레이드 승리! 경험치 ${expReward.toLocaleString()}, 명함 ${businessCards}장, 박카스 ${bacchus}개, 모나미 볼펜 ${monami}개, ${moneyReward.toLocaleString()}원을 획득했습니다.${rewardNotes.length ? ` (${rewardNotes.join(', ')})` : ''}`
      );
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
  clearActiveRaidBattle();
}

async function advanceRaidState(now = new Date()) {
  const activeBattle = raidState.activeBattle;
  if (!activeBattle) return;

  let safety = 0;
  while (raidState.activeBattle && safety < 500) {
    safety += 1;

    if (activeBattle.phase === 'countdown') {
      if (now.getTime() < new Date(activeBattle.countdownEndsAt).getTime()) return;
      activeBattle.phase = 'active';
      activeBattle.nextActionAt = new Date(now.getTime() + RAID_ACTION_DELAY_MS);
      activeBattle.logs.push('레이드가 시작되었습니다.');
      bumpRaidVersion();
      continue;
    }

    if (now.getTime() < new Date(activeBattle.nextActionAt).getTime()) return;

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
      let actionDelayUnits = 1;
      if (participant.hp > 0) {
        const passiveLog = triggerRaidTurnStartPassives(participant, activeBattle);
        appendRaidActionLogs(activeBattle, passiveLog);
        const skillDelayUnits = appendRaidActionLogs(activeBattle, useRaidCardSkill(participant, activeBattle));
        const attackDelayUnits = appendRaidActionLogs(activeBattle, performRaidBasicAttack(participant, activeBattle));
        if (attackDelayUnits > 1) {
          actionDelayUnits += attackDelayUnits - 1;
        }
        if (skillDelayUnits > 0) {
          actionDelayUnits += skillDelayUnits;
        }
        tickRaidParticipantEndOfTurn(participant, activeBattle);
      } else {
        activeBattle.logs.push(`${participant.displayName}님은 전투불능 상태입니다.`);
      }
      activeBattle.turnIndex += 1;
      activeBattle.nextActionAt = new Date(new Date(activeBattle.nextActionAt).getTime() + (RAID_ACTION_DELAY_MS * actionDelayUnits));
    } else {
      const bossDelayUnits = appendRaidActionLogs(activeBattle, performRaidBossAction(activeBattle));
      activeBattle.turnIndex = 0;
      activeBattle.nextActionAt = new Date(new Date(activeBattle.nextActionAt).getTime() + (RAID_ACTION_DELAY_MS * Math.max(1, bossDelayUnits)));
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

  if (raidState.activeBattle?.winner) {
    if (raidState.activeBattle.finalizing || raidState.activeBattle.finalized) return;
    raidState.activeBattle.finalizing = true;
    await finalizeRaidBattle(raidState.activeBattle, now);
  }
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
    user.shopState.dailyBusinessCardPurchases = 0;
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
  const titleDef = getEquippedTitleDefinition(user);
  const titleEffects = titleDef?.effects || {};
  const activeBuffEffects = getActiveBuffEffects(user, now);

  const moneyBonusPercent = itemStats.moneyBonus + (titleEffects.moneyBonus || 0);
  const titleStressMultiplier = titleEffects.titleStressMultiplier || 1;
  const passiveExpMultiplier = Math.max(0, 1 + activeBuffEffects.expBonusAdd + activeBuffEffects.passiveExpBonusAdd);
  const clickExpMultiplier = Math.max(0, 1 + activeBuffEffects.expBonusAdd + activeBuffEffects.clickExpBonusAdd);

  const finalStressMultiplier = Number((itemStats.stressMultiplier * titleStressMultiplier).toFixed(6));

  return {
    moneyBonusPercent: Number(moneyBonusPercent.toFixed(2)),
    itemMoneyBonusPercent: itemStats.moneyBonus,
    titleMoneyBonusPercent: Number((titleEffects.moneyBonus || 0).toFixed(2)),
    expBonusPercent: itemStats.expBonus,
    stressMultiplier: finalStressMultiplier,
    stressReductionPercent: Number(((1 - finalStressMultiplier) * 100).toFixed(2)),
    clickStressRelief: Number((itemStats.clickStressRelief + activeBuffEffects.clickStressRelief).toFixed(2)),
    hourlyStressRelief: Number((titleEffects.hourlyStressRelief || 0).toFixed(2)),
    shopStressRelief: Number((titleEffects.shopStressRelief || 0).toFixed(2)),
    passiveExpMultiplier,
    clickExpMultiplier,
    noStress: activeBuffEffects.noStress,
    maxStaminaBonus: Number(titleEffects.staminaBonus || 0),
    adventureStaminaMultiplier: Number(titleEffects.adventureStaminaMultiplier || 1)
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

function getEffectiveMaxStamina(user, now = new Date()) {
  const derivedStats = calculateDerivedStats(user, now);
  return Number((user.gameState.maxStamina + derivedStats.maxStaminaBonus).toFixed(2));
}

function getAdventureStaminaCost(user, now = new Date()) {
  const derivedStats = calculateDerivedStats(user, now);
  return Number((1 * derivedStats.adventureStaminaMultiplier).toFixed(2));
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
  markUserSeen(user, now);
  syncDailyShopState(user, now);
  settlePendingStockInvestment(user, now);
  cleanupExpiredBuffs(user, now);
  reconcileTitles(user, now);
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
    cards: user.cards,
    enhancedCards: user.enhancedCards,
    equippedCardId: user.equippedCardId,
    equippedCardLevel: normalizeCardEnhancementLevel(user.equippedCardLevel || 0),
    cardDetails: buildCardDetails(user),
    cardVariantDetails: buildCardVariantDetails(user),
    buffs: user.buffs,
    titles: user.titles,
    titleDetails: buildTitleDetails(user, now),
    pendingStockInvestment: user.pendingStockInvestment,
    pendingAdventure: user.pendingAdventure,
    shopState: user.shopState,
    meta: {
      loginCount: user.meta.loginCount,
      lastShoutAt: user.meta.lastShoutAt,
      lastRaidDayKey: user.meta.lastRaidDayKey,
      raidEntryDayKey: user.meta.raidEntryDayKey,
      raidEntryUsedCount: user.meta.raidEntryUsedCount,
      raidEntryBonusCount: user.meta.raidEntryBonusCount,
      catFoodGivenCount: user.meta.catFoodGivenCount,
      lastTitleChangeDayKey: user.meta.lastTitleChangeDayKey,
      lastAdventureLog: user.meta.lastAdventureLog
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
      clickExpMultiplier: derivedStats.clickExpMultiplier,
      maxStaminaBonus: derivedStats.maxStaminaBonus,
      adventureStaminaMultiplier: derivedStats.adventureStaminaMultiplier
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
  const response = buildUserResponse(user, now);
  response.global = getGlobalState(now);
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
    user.gameState.stress = Number(Math.min(100, Math.max(0, user.gameState.stress + reward.amount)).toFixed(2));
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
    setOrRefreshBuff(user, reward.buffId, durationMs);
    return `${BUFF_DATA[reward.buffId].name} 효과를 획득했습니다.`;
  }

  if (reward.type === 'exp_fraction') {
    const remainingExp = getRemainingExpToNextLevel(user);
    const gainedExp = Math.max(1, Math.floor(remainingExp / reward.divisor));
    user.gameState.exp += gainedExp;
    const leveledUp = checkLevelUp(user);
    return leveledUp
      ? `${gainedExp.toLocaleString()} 경험치를 얻었고 즉시 레벨업했습니다.`
      : `${gainedExp.toLocaleString()} 경험치를 획득했습니다.`;
  }

  if (reward.type === 'rare_level') {
    if (Math.random() < reward.chance) {
      user.gameState.exp = getRequiredExp(user.gameState.level);
      checkLevelUp(user);
      return '기적처럼 즉시 레벨업했습니다!';
    }
    const fallbackText = applyAdventureReward(user, reward.fallback, now);
    return `즉시 레벨업에는 실패했습니다. 대신 ${fallbackText}`;
  }

  return '아무것도 획득하지 못했습니다.';
}

function rollAdventureEvent() {
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
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      cleanupExpiredBuffs(user, now);

      const derivedStats = calculateDerivedStats(user, now);
      const hadTooMuchStress = user.gameState.stress >= 100;

      if (!derivedStats.noStress) {
        const clickStressGain = CLICK_STRESS_GAIN * derivedStats.stressMultiplier;
        user.gameState.stress = Number(Math.min(100, user.gameState.stress + clickStressGain).toFixed(2));
      }

      if (derivedStats.clickStressRelief > 0) {
        user.gameState.stress = Number(Math.max(0, user.gameState.stress - derivedStats.clickStressRelief).toFixed(2));
      }

      if (!hadTooMuchStress) {
        const expMultiplier = (1 + derivedStats.expBonusPercent / 100);
        user.gameState.exp += Math.floor(getClickExp(user.gameState.level) * expMultiplier * derivedStats.clickExpMultiplier);
      }

      checkLevelUp(user);
      reconcileTitles(user, now);
      user.gameState.lastActionTime = now;

      return buildUserResponseWithGlobals(user, now);
    }, { conflictLabel: 'Work action conflict' });

    res.json(response);
  } catch (err) {
    console.error('Work action error:', err);
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
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

app.post('/api/action/adventure', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const response = await runUserMutationWithRetry(userId, async (user) => {
      const now = new Date();
      calculateOfflineGains(user, now);
      cleanupExpiredBuffs(user, now);

      if (user.pendingAdventure?.eventId) {
        throw createHttpError(400, '진행 중인 모험 선택지가 남아 있습니다. 먼저 결과를 선택해주세요.');
      }

      const staminaCost = getAdventureStaminaCost(user, now);
      if (user.gameState.stamina < staminaCost) {
        throw createHttpError(400, `행동력이 부족합니다. (필요: ${staminaCost})`);
      }

      user.gameState.stamina = Number((user.gameState.stamina - staminaCost).toFixed(2));
      user.gameState.lastActionTime = now;

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

        return buildAdventureChoiceResponse(user, now);
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
      return response;
    }, { conflictLabel: 'Adventure action conflict' });

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

      if (!user.pendingAdventure?.eventId) {
        throw createHttpError(400, '진행 중인 모험 선택지가 없습니다.');
      }

      const eventTitle = `${user.pendingAdventure.location} / ${user.pendingAdventure.actor}`;
      let rewardText = '아무 일도 일어나지 않았습니다.';
      const hasCatButlerTitle = user.titles?.unlocked?.includes('cat_butler');

      if (choice === 'yes') {
        if (getInventoryQuantity(user, 'cat_tuna_can') > 0) {
          removeItemFromInventory(user, 'cat_tuna_can', 1);
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

            const extraItemPool = ['hot6', 'cat_tuna_can', 'pen_monami'];
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
      return response;
    }, { conflictLabel: 'Adventure resolve conflict' });

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

app.post('/api/action/side-job', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    calculateOfflineGains(user, now);
    if (Number(user.gameState.stress || 0) > 60) {
      return res.status(400).json({ msg: '부업하기는 스트레스가 60 이하일 때만 할 수 있습니다.' });
    }
    const derivedStats = calculateDerivedStats(user, now);
    const salaryPerMinute = getSalaryPerMinute(user.gameState.level, derivedStats.moneyBonusPercent);
    const gainedMoney = Math.floor(salaryPerMinute * 300);

    user.gameState.stress = Number(Math.min(100, user.gameState.stress + 40).toFixed(2));
    user.gameState.money += gainedMoney;
    user.gameState.lastActionTime = now;

    const response = await buildUserResponseWithGlobals(user, now);
    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Side job action error:', err);
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
    syncDailyShopState(user, now);

    if (itemId === 'business_card' && buyQuantity > getRemainingBusinessCardPurchases(user)) {
      return res.status(400).json({ msg: '명함은 하루에 최대 5개까지만 구매할 수 있습니다.' });
    }

    const totalPrice = getTotalBuyPrice(user, itemId, buyQuantity);

    if (user.gameState.money < totalPrice) {
      return res.status(400).json({ msg: '잔고가 부족합니다.' });
    }

    user.gameState.money -= totalPrice;
    addItemToInventory(user, itemId, buyQuantity);
    if (itemId === 'business_card') {
      user.shopState.dailyBusinessCardPurchases += buyQuantity;
    }
    recordShopSpend(user, totalPrice, now);

    const derivedStats = calculateDerivedStats(user, now);
    if (derivedStats.shopStressRelief > 0) {
      user.gameState.stress = Number(Math.max(0, user.gameState.stress - derivedStats.shopStressRelief).toFixed(2));
    }

    reconcileTitles(user, now);
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
    }

    if (!removeItemFromInventory(user, itemId, useQuantity)) {
      return res.status(400).json({ msg: '해당 아이템이 부족합니다.' });
    }

    if (itemId === 'bacchus') {
      user.gameState.stamina = Math.min(getEffectiveMaxStamina(user, now), user.gameState.stamina + useQuantity);
      queueNotification(user, 'item_use', `박카스를 ${useQuantity}병 마셨습니다. 행동력이 ${useQuantity} 회복되었습니다.`);
    } else if (itemId === 'hot6') {
      user.gameState.stress = Number(Math.max(0, user.gameState.stress - (10 * useQuantity)).toFixed(2));
      setOrRefreshBuff(user, 'hot6_buff', HOT6_DURATION_MS * useQuantity, { now, stackDuration: true });
      queueNotification(user, 'item_use', `핫식스를 ${useQuantity}병 사용했습니다. 스트레스가 ${10 * useQuantity} 감소하고 버프 시간이 누적되었습니다.`);
    } else if (itemId === 'tylenol') {
      removeAllDebuffs(user);
      queueNotification(user, 'item_use', `타이레놀을 ${useQuantity}정 사용했습니다. 현재 걸려 있는 모든 디버프를 제거했습니다.`);
    } else if (itemId === 'raid_entry_ticket') {
      syncRaidEntryState(user, now);
      user.meta.raidEntryBonusCount += useQuantity;
      queueNotification(user, 'item_use', `회의 추가 입장권 ${useQuantity}장을 사용했습니다. 오늘 보스 레이드 입장 가능 횟수가 ${useQuantity}회 증가했습니다.`);
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
        addCardToCollection(user, card.id, 1);
        results.push({
          id: card.id,
          name: card.name,
          grade: card.grade,
          color: CARD_GRADE_COLORS[card.grade]
        });
      }

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
  const { userId, cardIds } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });
  if (!Array.isArray(cardIds) || cardIds.length !== 5) {
    return res.status(400).json({ msg: '합성에는 카드 5장이 필요합니다.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    calculateOfflineGains(user, now);

    const quantityMap = new Map();
    let sourceGrade = null;
    for (const cardId of cardIds) {
      const cardInfo = CARD_DATA[cardId];
      if (!cardInfo) {
        return res.status(400).json({ msg: '존재하지 않는 카드가 포함되어 있습니다.' });
      }
      if (cardInfo.grade === 'S') {
        return res.status(400).json({ msg: 'S등급 카드는 합성할 수 없습니다.' });
      }
      if (!sourceGrade) {
        sourceGrade = cardInfo.grade;
      } else if (sourceGrade !== cardInfo.grade) {
        return res.status(400).json({ msg: '같은 등급 카드만 합성할 수 있습니다.' });
      }
      quantityMap.set(cardId, (quantityMap.get(cardId) || 0) + 1);
    }

    for (const [cardId, amount] of quantityMap.entries()) {
      if (getCardQuantity(user, cardId) < amount) {
        return res.status(400).json({ msg: '보유 카드 수량이 부족합니다.' });
      }
    }

    for (const [cardId, amount] of quantityMap.entries()) {
      removeCardFromCollection(user, cardId, amount);
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
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    ensureUserDefaults(user);
    const now = new Date();
    const raid = await buildRaidStateResponse(user, now);
    res.json({
      raid,
      user: buildGameStateResponse(user, now),
      notifications: Array.isArray(user.pendingNotifications) ? [...user.pendingNotifications] : [],
      global: getGlobalState(now)
    });
  } catch (err) {
    console.error('Raid state error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/raid/toggle-slot', async (req, res) => {
  const { userId, slotIndex } = req.body;
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

    if (raidState.activeBattle) {
      return res.status(400).json({ msg: '이미 레이드가 진행 중입니다.' });
    }
    if (user.gameState.level < RAID_MIN_LEVEL) {
      return res.status(400).json({ msg: `레이드는 ${RAID_MIN_LEVEL}레벨부터 입장할 수 있습니다.` });
    }
    if (isRaidAlreadyUsedToday(user, now)) {
      return res.status(400).json({ msg: '오늘은 이미 레이드에 입장했습니다. 내일 다시 시도해주세요.' });
    }

    const existingSlot = findQueuedRaidSlotIndex(user._id);
    if (existingSlot === targetSlot) {
      raidState.slots[targetSlot] = null;
      bumpRaidVersion();
    } else {
      if (user.equippedCardId) {
        const queuedOtherUserIds = raidState.slots
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
      if (raidState.slots[targetSlot] && String(raidState.slots[targetSlot]) !== String(user._id)) {
        return res.status(400).json({ msg: '이미 다른 플레이어가 대기 중인 슬롯입니다.' });
      }
      if (existingSlot >= 0) {
        raidState.slots[existingSlot] = null;
      }
      raidState.slots[targetSlot] = String(user._id);
      bumpRaidVersion();
    }

    const raid = await buildRaidStateResponse(user, now);
    res.json({ raid });
  } catch (err) {
    console.error('Raid slot toggle error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/raid/start', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  const consumedUsers = [];
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
      clearActiveRaidBattle();
    }

    if (raidState.activeBattle) {
      if (isRaidUserParticipant(raidState.activeBattle, userId)) {
        const raid = await buildRaidStateResponse(starter, now);
        return res.json({ raid, resumed: true });
      }
      return res.status(400).json({ msg: '이미 레이드가 진행 중입니다.' });
    }

    const leftMostIndex = raidState.slots.findIndex(Boolean);
    if (leftMostIndex === -1 || String(raidState.slots[leftMostIndex]) !== String(userId)) {
      return res.status(403).json({ msg: '가장 왼쪽 슬롯의 플레이어만 입장 버튼을 누를 수 있습니다.' });
    }

    const participantIds = raidState.slots.filter(Boolean);
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
      if (user.gameState.level < RAID_MIN_LEVEL) {
        return res.status(400).json({ msg: `${user.nickname || user.username} 님의 레벨이 부족합니다.` });
      }
      participants.push(createRaidParticipantFromUser(user));
      participantUsers.push(user);
    }

    if (participants.length < 2) {
      raidState.slots = raidState.slots.map((slotUserId) => (userMap.has(String(slotUserId)) ? slotUserId : null));
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
        if (latestUser.gameState.level < RAID_MIN_LEVEL) {
          throw createHttpError(400, `${latestUser.nickname || latestUser.username} 님의 레벨이 부족합니다.`);
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

    raidState.activeBattle = {
      battleId: `raid-${Date.now()}`,
      bossId: RAID_BOSS_ID,
      bossHp: RAID_BOSS_DATA[RAID_BOSS_ID].maxHp,
      bossMaxHp: RAID_BOSS_DATA[RAID_BOSS_ID].maxHp,
      bossShield: 0,
      bossShieldTurns: 0,
      bossLastHpLoss: 0,
      participants,
      phase: 'countdown',
      countdownEndsAt: new Date(now.getTime() + countdownDurationMs),
      nextActionAt: new Date(now.getTime() + countdownDurationMs),
      turnIndex: 0,
      bossPatternIndex: 0,
      logs: ['레이드가 곧 시작됩니다. 3, 2, 1'],
      winner: null
    };
    applyRaidBattleStartPassives(raidState.activeBattle);
    raidState.slots = Array(RAID_PARTY_SIZE).fill(null);
    bumpRaidVersion();

    const responseUser = participantUsers.find((entry) => String(entry._id) === String(userId)) || starter;
    const raid = {
      version: raidState.version,
      lobby: getRaidLobbySummary(),
      slots: Array(RAID_PARTY_SIZE).fill(null),
      queuedSlotIndex: -1,
      todayUsed: isRaidAlreadyUsedToday(responseUser, now),
      remainingEntries: getRaidRemainingEntries(responseUser, now),
      minLevelMet: responseUser.gameState.level >= RAID_MIN_LEVEL,
      canStart: false,
      countdown: {
        active: true,
        endsAt: raidState.activeBattle.countdownEndsAt,
        participantIds: raidState.activeBattle.participants.map((participant) => participant.userId)
      },
      activeBattle: buildRaidBattleSnapshot(raidState.activeBattle, userId)
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
      raidState.activeBattle
      && raidState.activeBattle.phase === 'countdown'
      && raidState.activeBattle.participants?.some((participant) => String(participant.userId) === String(userId))
    ) {
      clearActiveRaidBattle();
    }
    res.status(err?.statusCode || 500).json({ msg: err?.statusCode ? err.message : '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/raid/cancel-countdown', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '?ъ슜??ID媛 ?꾩슂?⑸땲??' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '?ъ슜?먮? 李얠쓣 ???놁뒿?덈떎.' });

    const activeBattle = raidState.activeBattle;
    if (!activeBattle || activeBattle.phase !== 'countdown') {
      return res.status(400).json({ msg: '?낆옣 移댁슫?몃떎?댁슫 以묒씤 ?덉씠?쒓? ?놁뒿?덈떎.' });
    }

    const isParticipant = activeBattle.participants.some((participant) => String(participant.userId) === String(userId));
    if (!isParticipant) {
      return res.status(403).json({ msg: '?덉씠?쒓? 李몄뿬?먮쭔 痍⑥냼???덉뒿?덈떎.' });
    }

    const participantIds = activeBattle.participants.map((participant) => String(participant.userId));
    const users = await User.find({ _id: { $in: participantIds } });
    const userMap = new Map(users.map((entry) => [String(entry._id), entry]));

    raidState.slots = Array(RAID_PARTY_SIZE).fill(null);
    activeBattle.participants.forEach((participant, index) => {
      if (index < RAID_PARTY_SIZE) {
        raidState.slots[index] = String(participant.userId);
      }
    });

    for (const participantId of participantIds) {
      const participantUser = userMap.get(String(participantId));
      if (!participantUser) continue;
      refundRaidEntry(participantUser, new Date());
      await participantUser.save();
    }

    raidState.activeBattle = null;
    bumpRaidVersion();

    const raid = await buildRaidStateResponse(user, new Date());
    res.json({ raid, cancelled: true });
  } catch (err) {
    console.error('Raid countdown cancel error:', err);
    res.status(500).json({ msg: '?쒕쾭 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.' });
  }
});

app.post('/api/raid/plan-skill', async (req, res) => {
  const { userId, useSkill, targetUserId, targetUserId2 } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    await advanceRaidState(new Date());
    if (!raidState.activeBattle || raidState.activeBattle.phase === 'finished') {
      return res.status(400).json({ msg: '진행 중인 레이드가 없습니다.' });
    }

    const participant = getRaidParticipant(raidState.activeBattle, userId);
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

    if ((card.targetType === 'ally' || card.targetType === 'ally_pair') && targetUserId) {
      const selectableTargets = getSelectableRaidTargets(raidState.activeBattle);
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
    res.json({ raid: buildRaidBattleSnapshot(raidState.activeBattle, userId) });
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
    if (!raidState.activeBattle || raidState.activeBattle.phase === 'finished') {
      return res.status(400).json({ msg: '진행 중인 레이드가 없습니다.' });
    }

    const participant = getRaidParticipant(raidState.activeBattle, userId);
    if (!participant) {
      return res.status(403).json({ msg: '현재 레이드 참가자가 아닙니다.' });
    }

    const card = getParticipantCard(participant);
    if (!card || !['ally', 'ally_pair'].includes(card.targetType)) {
      return res.status(400).json({ msg: '대상을 선택하는 스킬이 아닙니다.' });
    }

    const selectableTargets = getSelectableRaidTargets(raidState.activeBattle);
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
    res.json({ raid: buildRaidBattleSnapshot(raidState.activeBattle, userId) });
  } catch (err) {
    console.error('Raid target set error:', err);
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
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    calculateOfflineGains(user, now);
    reconcileTitles(user, now);

    const response = await buildUserResponseWithGlobals(user, now);
    await user.save();
    res.json(response);
  } catch (err) {
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
          global: getGlobalState(now)
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
    const rankingUsers = await User.find({ nickname: { $ne: null } })
      .sort({ 'gameState.level': -1, 'gameState.exp': -1 })
      .limit(20)
      .select('nickname username gameState.level gameState.exp titles meta.lastSeenAt');

    const ranking = rankingUsers.map((user) => ({
      nickname: user.nickname,
      displayName: buildDisplayName(user),
      gameState: {
        level: user.gameState.level,
        exp: user.gameState.exp
      },
      isOnline: Boolean(user.meta?.lastSeenAt && now.getTime() - new Date(user.meta.lastSeenAt).getTime() <= ONLINE_THRESHOLD_MS)
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

  if (!['item', 'buff', 'package'].includes(giftType)) {
    return res.status(400).json({ msg: '선물 종류가 올바르지 않습니다.' });
  }

  if (giftType === 'item' && !ITEM_DATA[giftId]) {
    return res.status(400).json({ msg: '존재하지 않는 아이템입니다.' });
  }

  if (giftType === 'buff' && !BUFF_DATA[giftId]) {
    return res.status(400).json({ msg: '존재하지 않는 버프입니다.' });
  }

  if (giftType === 'package' && !SUPPORT_PACKAGE_DATA[giftId]) {
    return res.status(400).json({ msg: '존재하지 않는 패키지입니다.' });
  }

  try {
    const users = targetMode === 'all'
      ? await User.find({})
      : await User.find({ _id: targetUserId });

    if (!users.length) {
      return res.status(404).json({ msg: '선물할 사용자를 찾을 수 없습니다.' });
    }

    const now = new Date();
    let deliveredCount = 0;

    const applyGiftToUser = (user) => {
      ensureUserDefaults(user);
      calculateOfflineGains(user, now);

      if (giftType === 'item') {
        addItemToInventory(user, giftId, giftQuantity);
        queueNotification(user, 'admin_gift', `운영자로부터 선물이 도착했습니다! <${ITEM_DATA[giftId].name} ${giftQuantity}개>`);
      } else if (giftType === 'buff') {
        setOrRefreshBuff(user, giftId, BUFF_DATA[giftId].durationMs);
        queueNotification(user, 'admin_gift', `운영자로부터 선물이 도착했습니다! <${BUFF_DATA[giftId].name}>`);
      } else {
        const packageInfo = applySupportPackage(user, giftId);
        queueNotification(user, 'admin_gift', `운영자로부터 선물이 도착했습니다! <${packageInfo.name}>`);
      }

      reconcileTitles(user, now);
    };

    for (const user of users) {
      try {
        applyGiftToUser(user);
        await user.save();
        deliveredCount += 1;
      } catch (err) {
        if (!isVersionConflictError(err)) {
          if (targetMode === 'single') throw err;
          console.error('Admin gift user skipped:', err);
          continue;
        }

        try {
          const latestUser = await User.findById(user._id);
          if (!latestUser) continue;
          applyGiftToUser(latestUser);
          await latestUser.save();
          deliveredCount += 1;
        } catch (retryErr) {
          if (targetMode === 'single') throw retryErr;
          console.error('Admin gift retry failed:', retryErr);
        }
      }
    }

    if (!deliveredCount) {
      return res.status(500).json({ msg: '선물 발송에 실패했습니다.' });
    }

    res.json({
      success: true,
      deliveredCount
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
