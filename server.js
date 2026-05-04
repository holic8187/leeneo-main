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
    effects: { expBonusAdd: -0.5 }
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
  }))
};

let activeShouts = [];

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
    lastLoginAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: null },
    lastShoutAt: { type: Date, default: null },
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
    user.meta = {
      loginCount: 0,
      lastLoginAt: null,
      lastSeenAt: null,
      lastShoutAt: null,
      catFoodGivenCount: 0,
      lastTitleChangeDayKey: null,
      lastAdventureLog: ''
    };
  }
  user.meta.loginCount = Number(user.meta.loginCount ?? 0);
  user.meta.lastLoginAt = user.meta.lastLoginAt || null;
  user.meta.lastSeenAt = user.meta.lastSeenAt || null;
  user.meta.lastShoutAt = user.meta.lastShoutAt || null;
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

function markUserSeen(user, now = new Date()) {
  user.meta.lastSeenAt = now;
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
  if (itemId === 'pen_monami') {
    return Math.round(itemInfo.price * getMonamiPriceMultiplier(getInventoryQuantity(user, itemId)));
  }
  return itemInfo.price;
}

function getShopPricesForUser(user) {
  const prices = {};
  for (const itemId of Object.keys(ITEM_DATA)) {
    if (ITEM_DATA[itemId].type === 'special') continue;
    prices[itemId] = getItemPrice(user, itemId);
  }
  return prices;
}

function getTotalBuyPrice(user, itemId, quantity) {
  if (quantity <= 0) return 0;
  const itemInfo = ITEM_DATA[itemId];
  if (!itemInfo) return 0;

  if (itemId !== 'pen_monami') {
    return getItemPrice(user, itemId) * quantity;
  }

  const currentOwned = getInventoryQuantity(user, itemId);
  let total = 0;
  for (let offset = 0; offset < quantity; offset += 1) {
    total += Math.round(itemInfo.price * getMonamiPriceMultiplier(currentOwned + offset));
  }
  return total;
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
    buffs: user.buffs,
    titles: user.titles,
    titleDetails: buildTitleDetails(user, now),
    pendingStockInvestment: user.pendingStockInvestment,
    pendingAdventure: user.pendingAdventure,
    shopState: user.shopState,
    meta: {
      loginCount: user.meta.loginCount,
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
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

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

app.post('/api/action/adventure', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: '사용자 ID가 필요합니다.' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    calculateOfflineGains(user, now);
    cleanupExpiredBuffs(user, now);

    if (user.pendingAdventure?.eventId) {
      return res.status(400).json({ msg: '진행 중인 모험 선택지가 남아 있습니다. 먼저 결과를 선택해주세요.' });
    }

    const staminaCost = getAdventureStaminaCost(user, now);
    if (user.gameState.stamina < staminaCost) {
      return res.status(400).json({ msg: `행동력이 부족합니다. (필요: ${staminaCost})` });
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

      const response = await buildAdventureChoiceResponse(user, now);
      await user.save();
      return res.json(response);
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

    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Adventure action error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/action/adventure/resolve', async (req, res) => {
  const { userId, choice } = req.body;
  if (!userId || !choice) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });
  if (!['yes', 'no'].includes(choice)) return res.status(400).json({ msg: '올바르지 않은 선택입니다.' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    calculateOfflineGains(user, now);

    if (!user.pendingAdventure?.eventId) {
      return res.status(400).json({ msg: '진행 중인 모험 선택지가 없습니다.' });
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

    await user.save();
    res.json(response);
  } catch (err) {
    console.error('Adventure resolve error:', err);
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
  const { userId, itemId, quantity } = req.body;
  if (!userId || !itemId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });
  const buyQuantity = Math.max(1, Math.floor(Number(quantity) || 1));

  const itemInfo = ITEM_DATA[itemId];
  if (!itemInfo) return res.status(400).json({ msg: '존재하지 않는 아이템입니다.' });
  if (itemInfo.type === 'special') return res.status(400).json({ msg: '해당 아이템은 상점에서 구매할 수 없습니다.' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    calculateOfflineGains(user, now);
    const totalPrice = getTotalBuyPrice(user, itemId, buyQuantity);

    if (user.gameState.money < totalPrice) {
      return res.status(400).json({ msg: '잔고가 부족합니다.' });
    }

    user.gameState.money -= totalPrice;
    addItemToInventory(user, itemId, buyQuantity);
    recordShopSpend(user, totalPrice, now);

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
  const { userId, itemId, quantity } = req.body;
  if (!userId || !itemId) return res.status(400).json({ msg: '필수 정보가 누락되었습니다.' });
  const useQuantity = Math.max(1, Math.floor(Number(quantity) || 1));

  const itemInfo = ITEM_DATA[itemId];
  if (!itemInfo || itemInfo.type !== 'consumable') {
    return res.status(400).json({ msg: '사용할 수 없는 아이템입니다.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });

    const now = new Date();
    calculateOfflineGains(user, now);

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
