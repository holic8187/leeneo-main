const API_URL = window.location.origin;

const ITEM_DATA = {
  excavation_repair_coupon: {
    name: '발굴 기계 수리 쿠폰',
    desc: '고장난 발굴 기계를 즉시 수리',
    hoverDesc: '회사 운영 중 발굴 기계가 고장났을 때 사용하면 즉시 수리됩니다.'
  },
  pen_monami: {
    name: '모나미 볼펜',
    desc: '월급 획득량 +0.05%',
    hoverDesc: '보유량 1개마다 월급 획득량이 0.05% 증가합니다.'
  },
  pen_jetstream: {
    name: '제트스트림 볼펜',
    desc: '월급 획득량 +0.1%',
    hoverDesc: '보유량 1개마다 월급 획득량이 0.1% 증가합니다.'
  },
  coffee_mix: {
    name: '맥심 커피믹스',
    desc: '스트레스 증가량 2% 감소',
    hoverDesc: '보유량마다 현재 스트레스 증가량의 98%만 받습니다.'
  },
  bacchus: {
    name: '박카스',
    desc: '행동력 +1',
    hoverDesc: '가방에서 사용하면 행동력을 1 회복합니다.'
  },
  hot6: {
    name: '핫식스',
    desc: '스트레스 -10, 10분 버프',
    hoverDesc: '사용 즉시 스트레스를 10 낮추고, 10분 동안 서류작업 클릭마다 스트레스를 0.1 낮춥니다.'
  },
  tylenol: {
    name: '타이레놀',
    desc: '현재 걸린 모든 디버프 제거',
    hoverDesc: '사용 시 현재 걸려 있는 모든 디버프를 제거합니다.'
  },
  raid_entry_ticket: {
    name: '회의 추가 입장권',
    desc: '오늘 보스 레이드 입장 횟수 +1',
    hoverDesc: '사용 시 오늘 보스 레이드 추가 입장 가능 횟수가 1회 증가합니다.',
    shopHidden: true
  },
  infinite_overtime_ticket: {
    name: '무한야근 입장권',
    desc: '무한야근 재도전 대기시간 초기화',
    hoverDesc: '사용 시 무한야근 재도전 대기시간을 초기화해 즉시 다시 도전할 수 있습니다.',
    shopHidden: true
  },
  hagendaz: {
    name: '하겐다즈',
    desc: '사용 즉시 1레벨 상승',
    hoverDesc: '사용 시 즉시 1레벨 상승하며 현재 경험치는 0으로 초기화됩니다.',
    shopHidden: true
  },
  business_card: {
    name: '명함',
    desc: '카드 뽑기에 사용하는 재화',
    hoverDesc: '카드 뽑기 전용 재화입니다.'
  },
  cat_tuna_can: {
    name: '고양이 참치캔',
    desc: '고양이에게 줄 수 있음',
    hoverDesc: '모험 중 회사 밖에서 고양이를 만났을 때 건네줄 수 있습니다.'
  },
  equipment_fragment: {
    name: '장비 파편',
    desc: '장비 분해와 일부 보상으로 획득하는 재화',
    hoverDesc: '상점의 파편 상점 탭에서 회의 추가 입장권, 명함, 휘장 등을 구매할 때 사용합니다.'
  }
};

const CARD_DATA = {
  chunsik_not_hyeji: { name: '춘식이혜지아니다.', grade: 'S', color: '#c62828', skillName: '춘식이혜지아니다.', skillDesc: '지정한 아군 1인의 총 잃은 체력 비율을 회복합니다.', cooldown: 8, targetType: 'ally' },
  flexible_blame: { name: '유연한 남탓: 제가 한거 아닌데요?', grade: 'A', color: '#f9a825', skillName: '제가 한거 아닌데요?', skillDesc: '지정한 아군 1인에게 <예? 저요?>를 부여해 우선 타겟팅되게 하고 받는 최종 피해를 감소시킵니다.', cooldown: 5, targetType: 'ally' },
  solid_mental: { name: '굳건한 멘탈의 소유자', grade: 'S', color: '#c62828', skillName: '굳건한 멘탈', skillDesc: '자기 자신에게 피격 무효화를 여러 회 부여합니다. 피격 무효를 모두 소모한 뒤 쿨타임이 시작됩니다.', cooldown: 8, targetType: null },
  nosy_manager: { name: '노처녀 신차장의 오지랖', grade: 'A', color: '#f9a825', skillName: '오지랖', skillDesc: '선택한 파티원 1명에게 보호막을 부여하고, 상대에게 자신의 레벨 기반 피해를 2회 입힙니다.', cooldown: 5, targetType: 'ally' },
  mingu_champion: { name: '제 1회 면담대회 우승자 밍구의 품격', grade: 'S', color: '#c62828', skillName: '챔피언의 품격', skillDesc: '지정한 파티원 1인에게 보호막 20과 <챔피언의 가호>를, 상대에게 <눈부심>을 부여합니다.', cooldown: 7, targetType: 'ally', specialStyle: 'champion' },
  winter_subordinate: { name: '겨울 부장의 부하직원 육성', grade: 'S', color: '#c62828', skillName: '부하직원 육성', skillDesc: '파티원 중 가장 레벨이 낮은 1명을 2턴 동안 레벨 +1~+5로 간주합니다. +5강은 쿨타임이 7턴입니다.', cooldown: 8, targetType: null },
  potato_rehab: { name: '감자의 재활훈련', grade: 'S', color: '#c62828', skillName: '재활훈련', skillDesc: '보스전에서 현재 데미지의 고정 피해를 1회 입힙니다. 노멀 보스에서는 피해와 막타 성장량이 1/3로 적용됩니다. 한 판당 1회만 사용할 수 있고, 이 스킬로 처치하면 데미지가 플레이어의 현재 레벨만큼 영구 증가합니다. 개인면담에서는 선택할 수 없습니다.', cooldown: 0, targetType: null, specialStyle: 'potato-rehab' },
  ineo_diet: { name: '이네오의 다이어트 선언', grade: 'S', color: '#c62828', skillName: '다이어트 선언', skillDesc: '돌아오는 턴에 기본 공격을 총 10회 합니다. 각 공격은 기본 공격 피해의 90%로 적용되며 크리티컬이 적용될 수 있습니다.', cooldown: 3, targetType: null },
  gangnam_style: { name: '일 중에 몰래 듣는 강남스타일', grade: 'S', color: '#c62828', skillName: '강남스타일', skillDesc: '1턴 동안 모든 팀원에게 크리티컬률 20%와 흥겨움 버프를 부여하고, 보호막 10을 제공합니다. 흥겨움 동안 기본 공격 횟수가 2배가 됩니다.', cooldown: 2, targetType: null },
  delegate_lee: { name: '이것 좀 대신 해줘 이대리', grade: 'S', color: '#c62828', skillName: '이것 좀 대신 해줘', skillDesc: '현재 입장한 파티원의 전체 레벨 합 x 30의 데미지를 1회 가합니다.', cooldown: 6, targetType: null },
  celine_tears: { name: '구마의 눈물 젖은 셀린느', grade: 'S', color: '#c62828', skillName: '셀린느', skillDesc: '1턴 동안 <셀린느> 버프를 얻어 공격력이 50% 증가하고, 버프가 끝날 때 자신의 레벨 x 60 피해를 입힙니다.', cooldown: 2, targetType: null },
  strawberry_latte: { name: '딸기라떼', grade: 'A', color: '#f9a825', skillName: '딸기라떼', skillDesc: '다음 턴까지 지속되는 보호막 40을 파티원 전원에게 제공합니다.', cooldown: 2, targetType: null },
  rebuttal: { name: '반박', grade: 'A', color: '#f9a825', skillName: '반박', skillDesc: '파티원 전체의 HP를 20 회복합니다.', cooldown: 2, targetType: null },
  parking_master: { name: '멍프의 주차', grade: 'A', color: '#f9a825', skillName: '멍프의 주차', skillDesc: '돌아오는 턴에 기본 공격을 총 4회 합니다. 각 공격은 기본 공격 피해의 90%로 적용되며 크리티컬이 적용될 수 있습니다.', cooldown: 2, targetType: null },
  tissue_box: { name: '김주임의 휴지곽', grade: 'A', color: '#f9a825', skillName: '휴지곽', skillDesc: '2턴 동안 자신이 반격 버프를 획득합니다. 피격당하면 피격 1회당 기본 공격 1번으로 반격합니다.', cooldown: 2, targetType: null },
  drinking_angle: { name: '야채곱창', grade: 'A', color: '#f9a825', skillName: '소주각?', skillDesc: '액티브 스킬 없음. 전투 시작 시 모든 파티원에게 <소주각?> 버프를 부여합니다. 버프를 지닌 상태로 전투 승리 시 전리품을 2배로 획득합니다.', cooldown: 0, targetType: null, passiveOnly: true },
  tax_invoice: { name: '호이의 세금계산서', grade: 'A', color: '#f9a825', skillName: '세금계산서', skillDesc: '파티원 2인을 선택하여 1회 피격 무효화, 1턴 공격력 25% 증가, 1회 디버프 무효화를 부여합니다.', cooldown: 3, targetType: 'ally_pair' },
  rotation_blind_date: { name: '코카의 로테이션 소개팅', grade: 'A', color: '#f9a825', skillName: '소개팅 상대', skillDesc: '액티브 스킬 없음. 매 턴 자신을 제외한 파티원 1명에게 카드 효과를 1.5배로 증폭하는 <소개팅 상대> 버프를 차례대로 줍니다.', cooldown: 0, targetType: null, passiveOnly: true },
  sherlock: { name: '셜록몬드의 추리', grade: 'B', color: '#1565c0', skillName: '셜록몬드의 추리', skillDesc: '다다음 턴까지 파티원 전원의 크리티컬 확률을 50% 증가시킵니다.', cooldown: 5, targetType: null },
  lotto_numbers: { name: '모래의 로또번호', grade: 'B', color: '#1565c0', skillName: '이번엔 될거같아', skillDesc: '액티브 스킬 없음. 전투 시작 시 모든 파티원에게 <이번엔 될거같아> 버프를 부여합니다. 버프를 지닌 상태로 전투 승리 시 절반 확률로 보상을 3배로 획득하거나 보상을 획득하지 못합니다.', cooldown: 0, targetType: null, passiveOnly: true },
  blind_date: { name: '심심이의 소개팅', grade: 'B', color: '#1565c0', skillName: '심심이의 소개팅', skillDesc: '랜덤 파티원 1명의 HP를 30 감소시키지만 다음 공격 피해를 2배로 증가시킵니다.', cooldown: 3, targetType: null },
  fantasy: { name: '라연이의 망상', grade: 'B', color: '#1565c0', skillName: '라연이의 망상', skillDesc: '파티원 전원의 모든 디버프를 제거합니다.', cooldown: 4, targetType: null },
  broken_leg: { name: '감자의 부러진 다리', grade: 'B', color: '#1565c0', skillName: '감자의 부러진 다리', skillDesc: '선택한 파티원 1명의 HP를 30 회복시킵니다.', cooldown: 2, targetType: 'ally' },
  military_service: { name: '자네, 군필인가?', grade: 'B', color: '#1565c0', skillName: '군필인가?', skillDesc: '이번 턴에 가하는 자신의 모든 공격에 자신의 레벨 x 20의 추가 데미지를 줍니다.', cooldown: 2, targetType: null },
  invincible_logic: { name: '무적의 논리', grade: 'B', color: '#1565c0', skillName: '무적의 논리', skillDesc: '랜덤 파티원 2인에게 1회 피격 무효화 버프를 제공합니다.', cooldown: 2, targetType: null },
  ride_line: { name: '라인 잘타야지', grade: 'B', color: '#1565c0', skillName: '라인 잘타야지', skillDesc: '랜덤 파티원 2인의 공격력을 1턴 동안 25% 증가시킵니다.', cooldown: 4, targetType: null },
  wig: { name: '김부장의 가발', grade: 'C', color: '#2e7d32', skillName: '김부장의 가발', skillDesc: '돌아오는 턴에 자신의 기본 공격을 총 3회 합니다.', cooldown: 3, targetType: null },
  chatgpt: { name: '모래의 챗지피티', grade: 'C', color: '#2e7d32', skillName: '모래의 챗지피티', skillDesc: '돌아오는 턴에 기본공격에 더해 자신의 레벨 x 10 추가 피해를 입힙니다.', cooldown: 2, targetType: null },
  pho: { name: '닐닐이의 쌀국수', grade: 'C', color: '#2e7d32', skillName: '닐닐이의 쌀국수', skillDesc: '랜덤 파티원 3명에게 각각 50의 보호막을 제공합니다.', cooldown: 3, targetType: null },
  coca_cola: { name: '코카의 콜라', grade: 'C', color: '#2e7d32', skillName: '코카의 콜라', skillDesc: '선택한 파티원 1인의 공격력을 2턴 동안 30% 증가시킵니다.', cooldown: 3, targetType: 'ally' },
  cider_comment: { name: '사이다 발언', grade: 'C', color: '#2e7d32', skillName: '사이다 발언', skillDesc: '파티원 1인을 선택하여 해당 팀원에게 1회 모든 디버프 무효화 버프를 제공합니다.', cooldown: 3, targetType: 'ally' },
  rooftop_pigeons: { name: '옥상의 비둘기떼', grade: 'C', color: '#2e7d32', skillName: '비둘기떼', skillDesc: '자신의 레벨 x 8의 데미지로 5회 공격합니다. 각 공격은 90% 위력으로 적용됩니다.', cooldown: 3, targetType: null }
};

const BUFF_DATA = {
  lupin_stress_buff: { name: '월급루팡' },
  lupin_exp_buff: { name: '월급루팡 집중' },
  field_work_buff: {
    name: '외근 버프',
    desc: '12시간 동안 자동 획득 경험치가 5배가 되고, 서류작업 클릭 경험치는 절반이 됩니다.'
  },
  confidence_buff: {
    name: '자신감',
    desc: '1시간 동안 모든 경험치 획득량이 1.8배가 됩니다.'
  },
  fatigue_debuff: {
    name: '피로감',
    desc: '4시간 동안 모든 경험치 획득량이 절반으로 감소합니다.',
    className: 'debuff-item'
  },
  cat_gratitude_buff: {
    name: '고양이의 보은',
    desc: '1시간 동안 모든 경험치 획득량이 2배가 됩니다.',
    className: 'buff-item title-buff'
  },
  hot6_buff: {
    name: '핫식스 버프',
    desc: '서류작업 클릭 시 스트레스를 0.1 낮춥니다.',
    className: 'buff-item title-buff'
  },
  work_optimization_buff: {
    name: '업무 최적화',
    desc: '1시간 동안 모든 획득 경험치가 2배가 됩니다.',
    className: 'buff-item title-buff'
  }
};

ITEM_DATA.pen_applepencil = {
  name: '애플펜슬',
  desc: '월급 획득량 +2%',
  hoverDesc: '보유량 1개마다 월급 획득량이 2% 증가합니다.'
};
ITEM_DATA.reward_pen_monami = {
  name: '보상 모나미 볼펜',
  desc: '월급 획득량 +0.05%',
  hoverDesc: '보상으로 받은 모나미 볼펜입니다. 상점 가격 상승에는 영향을 주지 않습니다.'
};
ITEM_DATA.reward_pen_jetstream = {
  name: '보상 제트스트림 볼펜',
  desc: '월급 획득량 +0.1%',
  hoverDesc: '보상으로 받은 제트스트림 볼펜입니다. 상점 가격 상승에는 영향을 주지 않습니다.'
};
ITEM_DATA.reward_pen_applepencil = {
  name: '보상 애플펜슬',
  desc: '월급 획득량 +2%',
  hoverDesc: '보상으로 받은 애플펜슬입니다. 상점 가격 상승에는 영향을 주지 않습니다.'
};
ITEM_DATA.scroll_card_005 = { name: '주문서: 카드 효과 +0.5%', desc: '카드 효과 장비 전용 / 강화확률 100%', hoverDesc: '카드 효과 장비에만 사용 가능합니다.' };
ITEM_DATA.scroll_card_01 = { name: '주문서: 카드 효과 +1%', desc: '카드 효과 장비 전용 / 강화확률 60%', hoverDesc: '카드 효과 장비에만 사용 가능합니다.' };
ITEM_DATA.scroll_card_025 = { name: '주문서: 카드 효과 +2.5%', desc: '카드 효과 장비 전용 / 강화확률 10%', hoverDesc: '카드 효과 장비에만 사용 가능합니다.' };
ITEM_DATA.scroll_attack_01 = { name: '주문서: 기본 공격력 +1%', desc: '기본 공격력 장비 전용 / 강화확률 100%', hoverDesc: '기본 공격력 장비에만 사용 가능합니다.' };
ITEM_DATA.scroll_attack_02 = { name: '주문서: 기본 공격력 +2%', desc: '기본 공격력 장비 전용 / 강화확률 60%', hoverDesc: '기본 공격력 장비에만 사용 가능합니다.' };
ITEM_DATA.scroll_attack_05 = { name: '주문서: 기본 공격력 +5%', desc: '기본 공격력 장비 전용 / 강화확률 10%', hoverDesc: '기본 공격력 장비에만 사용 가능합니다.' };

const animations = [
  [
    '   O\n  /|\\\\   [PC]\n  / \\\\',
    '   O\n  /|>   [PC]\n  / \\\\',
    '   O\n  <|\\\\   [PC]\n  / \\\\'
  ],
  [
    '   O\n  /|\\\\   [서류]\n  / \\\\',
    '   O\n  /|\\\\   [도장]\n  / \\\\',
    '   O\n  /|\\\\   [검토]\n  / \\\\'
  ],
  [
    '   O\n  /|\\\\   (회의)\n  / \\\\',
    '   O\n  /|\\\\   (전화)\n  / \\\\',
    '   O\n  /|\\\\   (메모)\n  / \\\\'
  ]
];

animations[0] = [
  '   O   [PC]\n  /|\\\\\n   |\n  / \\\\',
  '   O   [PC]\n  /|>\n   |\n  / \\\\',
  '   O   [PC]\n  <|\\\\\n   |\n  / \\\\'
];
animations[1] = [
  '   O   [DOC]\n  /|\\\\\n   |\n  / \\\\',
  '   O   [MAIL]\n  /|\\\\\n   |\n  / \\\\',
  '   O   [CHK]\n  /|\\\\\n   |\n  / \\\\'
];
animations[2] = [
  '   O   (MEET)\n  /|\\\\\n   |\n  / \\\\',
  '   O   (TALK)\n  /|\\\\\n   |\n  / \\\\',
  '   O   (MEMO)\n  /|\\\\\n   |\n  / \\\\'
];

let updateInterval;
let rankingInterval;
let rankingMode = 'level';
let branchContractPercentDraft = '1';
let branchEmployeeSortMode = { key: "grade", direction: "desc" };
let shopModalMode = 'fragment';
let syncInterval;
let animationInterval;
let raidPollInterval;
let pvpPollInterval;
let rankingRequestInFlight = false;
let syncRequestInFlight = false;
let raidPollRequestInFlight = false;
let pvpPollRequestInFlight = false;
let lastSyncPendingCountAt = 0;
let modalResolver = null;
let latestGlobalState = { activeShoutText: '', activeShoutKey: '' };
let lastRenderedShoutKey = '';
let latestRaidState = null;
let selectedRaidMode = 'normal';
let latestPvpState = null;
let selectedPvpMode = 'ranked';
let selectedPvpCardId = null;
let selectedPvpEnhancementLevel = 0;
let selectedPvpAugmentCardIds = [];
let latestInfiniteOvertimeState = null;
let overtimeSetupMode = '';
let overtimeSelection = [];
let overtimeEditingDefense = false;
let overtimeDraftPicking = false;
let overtimeSwapOptionCardId = null;
let overtimeSwapReplaceIndex = null;
let overtimeActionInFlight = false;
let overtimeContinueInFlight = false;
let overtimeSwapInFlight = false;
let pvpBetTargetUserId = null;
let pvpDraftContextKey = '';
let pvpDraftSubmitting = false;
let pvpAcceptTicker = null;
let pvpDraftTicker = null;
let pvpStartTicker = null;
let pvpTurnTicker = null;
let pvpResultReturnTimer = null;
let pvpSpectatorReturnTimer = null;
let pvpServerClockOffsetMs = 0;
let lastPvpResultShownBattleId = null;
let lastPvpSpectatorReturnBattleId = null;
let lastPvpLogSignature = '';
let pvpHpAnimationRatios = {};
let raidCountdownVisible = false;
let raidCountdownTicker = null;
let raidCountdownEndsAtMs = 0;
let raidCountdownDisplayStartMs = 0;
let raidReadyTicker = null;
let raidReadyEndsAtMs = 0;
let cardFusionSelection = [];
let selectedEnhanceCardKey = null;
let selectedEquipmentEnhanceId = null;
let selectedEquipmentScrollId = null;
let equipmentEnhanceLogs = [];
const EQUIPMENT_PAGE_SIZE = 15;
let equipmentListPage = 1;
let equipmentSortMode = 'acquired';
let equipmentDismantleSelection = new Set();
let equipmentDismantleSortMode = 'acquired';
let cardGradeFilter = 'all';
let cardSortMode = 'grade';
let marketplaceState = { itemType: 'scroll', view: 'active', sort: 'time_desc', data: { active: [], mine: [] } };
let marketplaceRegisterState = { itemType: 'scroll', selected: null, sort: 'acquired' };
let companyStockMarketState = { stocks: [], holdings: [], sellFeeRate: 0.03, totalMarketValue: 0, rumors: {} };
let stockTournamentState = { stocks: [], holdings: [], leaderboard: [], advancedInfos: [], phase: 'before', isRegistered: false, canTrade: false, cash: 0, totalAssets: 0, returnPct: 0, advancedInfoRemaining: 0 };
let mailboxState = { mails: [] };
let raidBattleLogPinnedToBottom = true;
let userMutationInFlightCount = 0;
let loginRequestSerial = 0;
let currentNewsTypingPrompt = null;
let newsTypingLoading = false;
let newsTypingSubmitting = false;
let newsTypingCanvasTimer = null;
let newsTypingCanvasFrame = 0;
let raidBarAnimationState = {
  bossHpRatio: null,
  participantHpRatios: {}
};
let lastRenderedRaidBattleId = null;
const recentNotificationKeys = new Map();
const BGM_MUTED_STORAGE_KEY = 'ineoBgmMuted';
const RAID_BOSS_PORTRAIT_STORAGE_KEY = 'ineoRaidBossPortraitEnabled';
const RANKING_EMBLEMS_STORAGE_KEY = 'ineoRankingEmblemsEnabled';
const BGM_VOLUME = 0.16;
const BGM_TRACKS = {
  normal: 'bgm.mp3',
  raid: 'raid-bgm.mp3',
  pvp: 'pvp-bgm.mp3'
};
let currentBgmMode = 'normal';
const PATCH_NOTES_STORAGE_KEY = 'ineoLastSeenPatchNoteId';
const PATCH_NOTES = [
  {
    id: '2026-06-08-pvp-augment-3v3-beta',
    time: '2026-06-08 01:20',
    title: '증강 3대3 면담 베타 출시',
    items: [
      '개인면담 선택창에 <증강 3대3> 모드를 추가했습니다.',
      '6명이 매칭되면 각자 랜덤 +5 카드 3장 중 2장을 선택하고, 남은 카드와 교체할 수 있습니다.',
      '전투는 레드팀/블루팀 3대3으로 진행되며, 먼저 팀 합산 10킬을 달성하는 팀이 승리합니다.',
      '시작 시, 3턴 시작 시, 5턴 시작 시 실버/골드/프리즘 등급 증강 중 하나를 선택할 수 있습니다.'
    ]
  },
  {
    id: '2026-06-08-branch-excavation-item-per-employee',
    time: '2026-06-08 00:45',
    title: '회사 유물 발굴 보너스 적용 수정',
    items: [
      '회사 운영 수집품의 직원 발굴 확률 증가 효과가 직원 수만큼 정상 반영되도록 수정했습니다.',
      '예를 들어 직원별 발굴 보너스 +0.5% 수집품을 보유하고 직원이 10명이라면 실제 발굴력에 +5%가 반영됩니다.'
    ]
  },
  {
    id: '2026-06-08-ranking-emblem-fixed-size',
    time: '2026-06-08 00:20',
    title: '랭킹 휘장 표시 크기 조정',
    items: [
      'PC와 모바일에서 랭킹 휘장 칸이 같은 가로세로 기준으로 보이도록 표 폭과 행 높이 기준을 다시 정리했습니다.',
      '휘장 이미지가 강제로 찌그러지지 않도록 원본 비율을 유지하는 방식으로 표시됩니다.'
    ]
  },
  {
    id: '2026-06-05-ranking-emblem-mobile-ratio',
    time: '2026-06-05 23:55',
    title: '모바일 휘장 비율 표시 개선',
    items: [
      '모바일 랭킹에서 휘장이 찌그러져 보이지 않도록 랭킹 표 폭과 휘장 행 높이를 고정하고, 랭킹 영역 안에서 가로 스크롤되도록 조정했습니다.'
    ]
  },
  {
    id: '2026-06-05-emblem-bitch-not-mobile-fit',
    time: '2026-06-05 23:40',
    title: '휘장 표시 개선 및 신규 휘장 추가',
    items: [
      '모바일 랭킹에서 휘장 배너가 잘려 보이지 않도록 휘장 배경 표시 방식을 조정했습니다.',
      '<BITCH 아닙니다> 휘장이 파편 상점에 추가되었습니다. 파편 25,000개로 구매할 수 있으며, 보유 시 주식 거래 수수료가 10% 감소합니다.',
      '<춘식이 작품2> 휘장 이미지를 새 이미지로 교체했습니다.'
    ]
  },
  {
    id: '2026-06-05-compact-nickname-layout',
    time: '2026-06-05 23:10',
    title: '긴 닉네임 표시 안정화',
    items: [
      '비정상적으로 긴 닉네임이 랭킹, 레이드, 개인면담, 관전자 목록 등의 화면 레이아웃을 밀어내지 않도록 표시명을 적절히 축약했습니다.',
      '축약된 이름 위에 마우스를 올리면 가능한 화면에서는 전체 이름을 확인할 수 있습니다.'
    ]
  },
  {
    id: '2026-06-05-emblems-winter-chunsik-idol',
    time: '2026-06-05 22:30',
    title: '신규 휘장 3종 추가',
    items: [
      '<차가운 겨부장의 계절> 휘장이 추가되었습니다. 개인면담 주간 랭킹 1위에게 최초 1회 지급되며, 회사 유지비를 1% 줄여줍니다.',
      '<춘식이 작품2> 휘장이 추가되었습니다. 고양이에게 참치캔을 300번 이상 건넨 유저에게 자동 지급되며, 주식 거래 수수료를 5% 줄여줍니다.',
      '<IDOL> 휘장이 파편 상점에 추가되었습니다. 파편 20,000개로 구매할 수 있으며, 무한야근 보상을 10% 증가시킵니다.'
    ]
  },
  {
    id: '2026-06-01-infinite-overtime-basic-refresh',
    time: '2026-06-01 21:05',
    title: '무한야근 전투 조작 안정화',
    items: [
      '무한야근에서 기본공격만 선택했을 때 호이의 야근 재시전으로 처리될 수 있는 경로를 차단했습니다.',
      '무한야근 도중 메인 화면으로 나가 카드 강화를 하고 돌아와도 현재 공략 덱의 강화 단계와 장비 효과가 다시 반영되도록 했습니다.'
    ]
  },
  {
    id: '2026-06-01-branch-salary-bacchus-hotfix',
    time: '2026-06-01 20:35',
    title: '회사 계약금/소모품 사용 핫픽스',
    items: [
      '회사 직원 계약금 기준 일급 계산을 기존의 1/3 수준으로 낮췄습니다.',
      '박카스 등 인벤토리 아이템 사용 시 서버 오류가 발생하던 잘못된 호출을 제거했습니다.'
    ]
  },
  {
    id: '2026-06-01-consumable-skill-atomic-save',
    time: '2026-06-01 20:10',
    title: '소모품/업무 최적화 적용 안정화',
    items: [
      '업무 최적화 버프 갱신이 저장에 확실히 반영되도록 보강했습니다.',
      '박카스 등 소모품 사용을 원자 처리로 묶어 아이템만 소모되고 효과가 누락될 수 있던 경로를 수정했습니다.'
    ]
  },
  {
    id: '2026-06-01-solid-mental-delayed-cooldown',
    time: '2026-06-01 19:45',
    title: '굳건한 멘탈 쿨타임 조정',
    items: [
      '<굳건한 멘탈의 소유자>는 피격 무효화 횟수를 모두 소모한 뒤부터 쿨타임이 진행되도록 변경했습니다.',
      '회의/개인면담/무한야근 전투 모두 같은 방식으로 적용됩니다.'
    ]
  },
  {
    id: '2026-06-01-branch-employee-salary-floor',
    time: '2026-06-01 19:20',
    title: '회사 직원 계약금 악용 방지',
    items: [
      '직원 공고 계약금 기준을 분당 월급 환산값과 서버 최소 비율 기준으로 고정했습니다.',
      '이미 생성된 비정상 저가 직원은 등급, 발굴력, 효율 보정값을 반영한 최소 일일 계약금으로 자동 보정됩니다.'
    ]
  },
  {
    id: '2026-06-01-new-cards-chunsik-blame-mental',
    date: '2026-06-01 18:45',
    title: '신규 카드 3종 추가',
    changes: [
      'S등급 <춘식이혜지아니다.>, S등급 <굳건한 멘탈의 소유자>, A등급 <유연한 남탓: 제가 한거 아닌데요?> 카드를 추가했습니다.',
      '<예? 저요?> 버프는 보스의 랜덤 타겟팅에 우선 포함되며, 받는 최종 피해 감소 효과가 적용됩니다.'
    ]
  },
  {
    id: '2026-06-01-main-button-layout-fix',
    date: '2026-06-01 18:20',
    title: '메인 버튼 정렬 안정화',
    changes: [
      '회의/면담/야근/상점 버튼이 상태 문구 길이에 따라 서로 겹치지 않도록 고정 슬롯 배치로 정리했습니다.',
      '대기중처럼 긴 버튼 문구는 버튼 영역 안에서만 표시되도록 처리했습니다.'
    ]
  },
  {
    id: '2026-06-01-stock-rumor-branch-sort-overtime-fix',
    date: '2026-06-01 18:40',
    title: '주식 시장/회사 운영/무한야근 안정화',
    items: [
      '주식 매수 후 돈만 빠지고 보유 주식이 늘지 않을 수 있던 저장 흐름을 보강했습니다.',
      '주식 찌라시는 종목별 10분 동안 유지되며, 멘트 풀을 두 배로 늘렸습니다.',
      '주식 보유 탭에 평균 매수가와 수익률을 추가하고, 차트 표시 범위를 12시간으로 확장했습니다.',
      '회사 직원 목록에 발굴력, 등급, 계약금 정렬 기능을 추가했습니다.',
      '발굴률 상한을 넘는 초과 발굴력은 희귀 수집품 등장 보정으로 일부 반영됩니다.',
      '무한야근에서 기본공격이 첫 번째 스킬로 처리될 수 있던 문제를 수정했습니다.'
    ]
  },
  {
    id: '2026-05-29-company-stock-market-repair-card',
    time: '2026-05-29 18:20',
    title: '회사 주식 시장과 수리 쿠폰, 신규 카드 추가',
    items: [
      '회사 운영과 연동되는 주식 시장을 추가했습니다. 상장 회사 주식을 직접 사고팔 수 있고, 매도 시 3% 수수료가 적용됩니다.',
      '주식은 10분마다 변동되며, 종목별 차트와 찌라시 버튼으로 흐름을 확인할 수 있습니다.',
      '서류작업 클릭 시 낮은 확률로 발굴 기계 수리 쿠폰을 획득할 수 있고, 쿠폰은 장터 거래와 고장 즉시 수리에 사용할 수 있습니다.',
      'A급 카드 <노처녀 신차장의 오지랖>을 추가했습니다.'
    ]
  },
  {
    id: '2026-05-29-branch-auto-excavation-balance',
    time: '2026-05-29 11:55',
    title: '회사 자동 발굴과 발굴 밸런스 조정',
    items: [
      '회사 운영 발굴에 자동 반복 ON/OFF 버튼을 추가했습니다.',
      '발굴 기본 시간이 15분으로 변경되고, 저녁 6시 이후 발굴은 야근 비용으로 3배가 적용됩니다.',
      '발굴 시작 시 3% 확률로 기계가 고장나며, 고장 시 6시간 동안 발굴할 수 없습니다.',
      '직원 계약금 산정 기준을 기존의 절반으로 낮추고, SS급 유물 사장님의 벤츠 키와 신규 수집품을 대폭 추가했습니다.'
    ]
  },
  {
    id: '2026-05-29-branch-company-ranking-wording',
    time: '2026-05-29 10:45',
    title: '회사 운영 표시와 고용 밸런스 조정',
    items: [
      '회사 가치 랭킹에서 닉네임 대신 회사 이름이 보이도록 변경했습니다.',
      '직원 공고 배율 입력값이 동기화 갱신 후에도 유지되도록 개선했습니다.',
      '회사 운영 안내 문구를 운영 비용/사용 표현 중심으로 정리했습니다.',
      '회사 가치 20억원마다 최대 고용 가능 직원 수가 1명씩 증가하고, 해고 비용은 기존의 절반으로 조정했습니다.'
    ]
  },
  {
    id: '2026-05-29-branch-excavation-time-pool',
    time: '2026-05-29 10:30',
    title: '회사 운영 발굴 시간제 및 수집 풀 확장',
    items: [
      '회사 설립/회사명 입력 중 동기화 갱신으로 입력창 포커스가 사라지던 현상을 수정했습니다.',
      '발굴이 즉시 결과가 나오는 방식에서 기본 10분 진행 후 결과 확인 방식으로 변경되었습니다.',
      '발굴 소요 시간을 0.5~3% 줄여주는 신규 수집품 효과를 추가했습니다.',
      '지사 직원 이름 풀과 수집품 종류를 대폭 확장했습니다.'
    ]
  },
  {
    id: '2026-05-29-branch-office-mvp',
    time: '2026-05-29 15:40',
    title: '이모지 지사 운영 MVP 추가',
    items: [
      '레벨 250 이상 또는 분당 월급 5,000만원 이상 유저가 500억원을 사용해 회사를 설립할 수 있습니다.',
      '직원 공고, NPC 직원 고용, 발굴, 창고 확장, 아이템 처분, 일일 계약금/유지비 정산, 파산, 회사 가치 랭킹을 추가했습니다.',
      '지사를 설립하지 않은 고소득 유저는 6시간마다 보유 현금의 30%가 고소득근로자 세금으로 사용됩니다.',
      '발굴 수집품은 현금 보상이 아니라 회사 가치, 도감, 보유 효과 중심으로 작동합니다.'
    ]
  },
    {
    id: '2026-05-28-carbon-fiber-image',
    time: '2026-05-28 19:25',
    title: 'CARBON FIBER 휘장 이미지 적용',
    items: [
      'CARBON FIBER 휘장에 실제 카본 파이버 배너 이미지를 적용하고, 원본 하단의 흰 여백을 잘라냈습니다.'
    ]
  },{
    id: '2026-05-28-carbon-fiber-emblem',
    time: '2026-05-28 19:10',
    title: 'CARBON FIBER 휘장 추가',
    items: [
      '일반 상점에 100경 원짜리 CARBON FIBER 휘장을 추가했습니다. 보유 효과는 모든 경험치 획득량 +1.5%입니다.'
    ]
  },
  {
    id: '2026-05-28-adventure-save-hardening',
    time: '2026-05-28 18:35',
    title: '모험 저장 안정화',
    items: [
      '모험하기와 고양이 선택지 결과 처리를 공통 저장 잠금/재시도 흐름으로 통일해, 저장 중 연결이 끊기거나 서버 오류 팝업이 뜨는 빈도를 줄였습니다.'
    ]
  },  {
    id: '2026-05-28-infinite-overtime-reward-tune',
    time: '2026-05-28 18:20',
    title: '무한야근 보상 조정',
    items: [
      '무한야근 클리어 보상 중 파편 보상은 유지하고, 명함은 5~15개, 박카스는 5~20개, 회의 추가 입장권은 1~3개 범위로 조정했습니다.'
    ]
  },  {
    id: '2026-05-28-infinite-overtime-bot-attack-fixed',
    time: '2026-05-28 18:05',
    title: '무한야근 공격력 조정',
    items: [
      '무한야근은 층이 올라갈수록 상대 HP만 점진적으로 증가하고, 방어 Bot의 기본 공격력과 레벨 기반 스킬 피해는 더 이상 층에 따라 증가하지 않도록 조정했습니다.'
    ]
  },  {
    id: '2026-05-28-user-save-snapshot',
    time: '2026-05-28 17:45',
    title: '저장 충돌 추가 안정화',
    items: [
      '카드 강화뿐 아니라 상점, 가방, 장착 변경, 일부 보상 처리처럼 유저 데이터를 저장하는 주요 행동을 안전 저장 방식으로 통일했습니다.',
      '자동 동기화와 직접 행동이 겹칠 때 뜨던 서버 오류 팝업 빈도를 더 줄였습니다.'
    ]
  },  {
    id: '2026-05-28-save-conflict-hardening',
    time: '2026-05-28 17:25',
    title: '강화/합성 저장 안정화',
    items: [
      '카드 강화, 카드 합성, 장비 강화가 자동 동기화 저장과 충돌해 서버 오류 팝업이 뜨던 문제를 줄이기 위해 서버 저장 잠금과 충돌 재시도를 적용했습니다.',
      '카드 강화와 합성 요청도 클라이언트 요청 큐를 타도록 바꿔 빠른 연속 조작 중 저장 순서가 꼬일 가능성을 낮췄습니다.'
    ]
  },
  {
    id: '2026-05-28-infinite-overtime-draft-rate-fix',
    time: '2026-05-28 17:05',
    title: '무한야근 공략 카드 후보 확률 조정',
    items: [
      '공략용 카드 후보 5장을 각각 S 10%로 굴리던 구조를 바꿔, 한 슬롯에서 S 후보가 등장하는 확률이 의도한 10%에 가깝게 적용되도록 조정했습니다.',
      '낮은 등급 후보가 부족할 때 전체 카드 풀로 바로 대체되며 고등급이 과하게 섞일 수 있던 보정 로직도 완화했습니다.'
    ]
  },
  {
    id: '2026-05-28-infinite-overtime-bot-skill-ai',
    time: '2026-05-28 16:40',
    title: '무한야근 Bot 스킬 사용 보강',
    items: [
      '무한야근 방어 Bot이 효과가 없는 스킬을 고르고 턴을 낭비하지 않도록, 사용 가치가 없는 스킬은 건너뛰고 다음 카드 스킬을 확인하게 했습니다.',
      '무한야근 입장권을 추가했습니다. 운영자 우편 선물로 지급할 수 있고, 사용하면 무한야근 재도전 대기시간이 초기화됩니다.',
      '사용 가능한 스킬이 없을 때는 기본 공격을 진행한다는 로그를 남기도록 해 전투 흐름을 더 명확하게 표시했습니다.'
    ]
  },
  {
    id: '2026-05-28-infinite-overtime-30f-draft',
    time: '2026-05-28 16:20',
    title: '무한야근 30층 및 후보 선택 패치',
    items: [
      '무한야근을 30층 구성으로 확장하고, 층이 올라갈수록 방어 Bot의 체력이 점진적으로 높아지도록 조정했습니다.',
      '공략 덱 선택 방식을 슬롯마다 5개의 랜덤 후보 중 1장을 고르는 방식으로 변경했습니다. 후보 등급 확률은 S 10%, A 20%, B 30%, C 40%입니다.',
      '3층마다 발생하는 카드 교환 이벤트 후 같은 층으로 다시 들어가는 문제를 방지하고, 항상 다음 층으로 이어지도록 저장 처리를 보강했습니다.',
      '방어 Bot 프리셋은 무한야근 대기 화면에서 원할 때 다시 수정할 수 있습니다.'
    ]
  },
  {
    id: '2026-05-28-infinite-overtime-mode',
    time: '2026-05-28 01:10',
    title: '무한야근 모드 1차 추가',
    items: [
      '개인면담 옆에 30레벨부터 입장 가능한 1인 전투 콘텐츠 무한야근 버튼을 추가했습니다.',
      '첫 입장 시 방어 Bot 프리셋을 등록하고, 공략용 카드 5장으로 이어 도전할 수 있습니다.',
      '3층마다 카드 교환 이벤트가 발생하며, 승리 시 층수에 비례한 파편, 명함, 박카스, 회의 추가 입장권 중 하나를 획득합니다.',
      '무한야근은 3일에 한 번 도전할 수 있고, 승리 후 나가면 다음 층부터 이어서 진행됩니다.'
    ]
  },
  {
    id: '2026-05-28-pvp-overtime-cleanse-cooldown',
    time: '2026-05-28 00:20',
    title: '\uc57c\uadfc\u0020\uc815\ud654\u0020\uc2dc\u0020\ucfe8\ud0c0\uc784\u0020\ucc98\ub9ac',
    items: [
      '\uac1c\uc778\uba74\ub2f4\uc5d0\uc11c\u0020\u003c\ud638\uc774\uc758\u0020\ub9e4\uc77c\ud558\ub294\u0020\uc57c\uadfc\u003e\u0020\ub514\ubc84\ud504\uac00\u0020\ub77c\uc5f0\uc774\uc758\u0020\ub9dd\uc0c1\u0020\ub4f1\uc73c\ub85c\u0020\ud574\uc81c\ub418\uba74\u002c\u0020\ub354\u0020\uc774\uc0c1\u0020\ud3ed\ubc1c\u0020\uc7ac\uc0ac\uc6a9\uc744\u0020\ud560\u0020\uc218\u0020\uc5c6\uace0\u0020\uc989\uc2dc\u0020\ucfe8\ud0c0\uc784\uc774\u0020\uc2dc\uc791\ub418\ub3c4\ub85d\u0020\uc218\uc815\ud588\uc2b5\ub2c8\ub2e4\u002e'
    ]
  },
  {
    id: '2026-05-27-ranked-pvp-spectator-privacy',
    time: '2026-05-27 16:05',
    title: '\ub7ad\ud06c\u0020\uba74\ub2f4\u0020\uad00\uc804\uc790\u0020\uc775\uba85\u0020\ud45c\uc2dc',
    items: [
      '\ub7ad\ud06c\u0020\uac1c\uc778\uba74\ub2f4\u0020\ucc38\uac00\uc790\u0020\ud654\uba74\uc5d0\uc11c\ub294\u0020\uad00\uc804\uc790\u0020\ub2c9\ub124\uc784\u0020\ub300\uc2e0\u0020\uc778\uc6d0\u0020\uc218\ub9cc\u0020\ud45c\uc2dc\ub418\ub3c4\ub85d\u0020\ubcc0\uacbd\ud588\uc2b5\ub2c8\ub2e4\u002e',
      '\uad00\uc804\uc790\ub294\u0020\uae30\uc874\ucc98\ub7fc\u0020\uad00\uc804\uc790\u0020\ub2c9\ub124\uc784\u0020\ubaa9\ub85d\uc744\u0020\ud655\uc778\ud560\u0020\uc218\u0020\uc788\uc2b5\ub2c8\ub2e4\u002e'
    ]
  },
  {
    id: '2026-05-27-potato-rehab-normal-mode-nerf',
    time: '2026-05-27 15:05',
    title: '감자의 재활훈련 노멀 보스 보정',
    items: [
      '노멀 보스에서 <감자의 재활훈련> 피해와 막타 후 영구 데미지 증가량이 1/3로 적용되도록 조정했습니다.',
      '<감자의 재활훈련> 설명에 노멀 보스 1/3 적용 내용을 추가했습니다.'
    ]
  },
  {
    id: '2026-05-27-potato-rehab-rework',
    time: '2026-05-27 14:55',
    title: '감자의 재활훈련 리워크',
    items: [
      '<감자의 재활훈련> 기본 피해를 20,000으로 변경했습니다.',
      '<감자의 재활훈련>으로 보스를 처치하면 카드 피해가 플레이어의 현재 레벨만큼 영구 증가하도록 변경했습니다.',
      '<감자의 재활훈련> 막타 횟수에 따라 카드 뒤 붉은 불꽃 오오라가 점점 선명해지도록 추가했습니다.'
    ]
  },
  {
    id: '2026-05-27-pvp-gossip-passive-removable',
    time: '2026-05-27 14:35',
    title: '뒷담화 제거 대상 재조정',
    items: [
      '개인면담에서 소개팅 상대, 소주각?, 이번엔 될거같아 같은 카드 패시브 버프도 뒷담화로 제거될 수 있도록 변경했습니다.',
      '레이드 보스의 고유 패시브 효과는 뒷담화 제거 대상에 포함하지 않습니다.'
    ]
  },
  {
    id: '2026-05-27-adventure-cooldown-half',
    time: '2026-05-27 14:05',
    title: '모험 재시도 대기시간 단축',
    items: [
      '모험하기 재시도 대기시간을 기존의 절반으로 줄였습니다.'
    ]
  },
  {
    id: '2026-05-27-raid-queue-timeout-winter-nerf',
    time: '2026-05-27 13:45',
    title: '레이드 대기열 자동 퇴장과 겨부장 조정',
    items: [
      '보스 레이드 대기열에 입장한 뒤 10분이 지나면 자동으로 슬롯에서 퇴장되도록 변경했습니다.',
      '보스 대기열 팝업에서 내 자동 퇴장까지 남은 시간을 확인할 수 있습니다.',
      '<겨울 부장의 부하직원 육성>의 레벨 보정량을 +1~+5로 낮추고, +5강은 쿨타임 7턴으로 조정했습니다.'
    ]
  },
  {
    id: '2026-05-27-admin-mailbox',
    time: '2026-05-27 13:10',
    title: '운영자 우편함 추가',
    items: [
      '운영자 선물은 즉시 팝업/가방 지급 대신 우편함으로 도착하도록 변경했습니다.',
      '우편함에 새 선물이 있으면 우상단 버튼에 빨간 점이 표시되고, 각 우편 또는 전체 우편을 직접 수령할 수 있습니다.',
      '운영자 우편은 발송 후 24시간 안에 수령하지 않으면 자동으로 만료됩니다.'
    ]
  },
  {
    id: '2026-05-27-pvp-weekly-season-anonymous-ranked',
    time: '2026-05-27 12:20',
    title: '개인면담 주간 정산과 랭크 익명화',
    items: [
      '매주 월요일 랭크 개인면담 점수가 초기화되고, 지난주 순위에 따라 박카스와 명함 보상이 지급되도록 추가했습니다.',
      '랭크 개인면담 참가자는 상대 닉네임이 <익명의 상대>로 보이도록 변경했습니다. 일반전과 관전 화면에서는 기존처럼 닉네임이 표시됩니다.'
    ]
  },
  {
    id: '2026-05-27-chunsik-art-emblem',
    time: '2026-05-27 11:45',
    title: '춘식이 작품 휘장 추가',
    items: [
      '150레벨 이상 유저에게 자동으로 지급되는 신규 휘장 <춘식이 작품>을 추가했습니다.',
      '<춘식이 작품>은 보유만 해도 월급 획득량이 1% 증가합니다.'
    ]
  },
  {
    id: '2026-05-27-bald-manager-passive-round-reset',
    time: '2026-05-27 00:40',
    title: '김부장 하드 패시브 초기화 수정',
    items: [
      '하드 대머리 김부장의 <매끈한 두피> 스택이 1P 행동 시작부터 다음 1P 행동 시작 전까지 누적되고, 다음 턴 1P 행동 시작 시 0으로 초기화되도록 수정했습니다.'
    ]
  },
  {
    id: '2026-05-27-hard-boss-passives',
    time: '2026-05-27 00:20',
    title: '하드 보스 패시브 추가',
    items: [
      '하드 트름녀에게 피격 시 공격자에게 5 피해를 반사하는 <가시갑옷>을 추가했습니다.',
      '하드 대머리 김부장에게 1P 행동 시작부터 다음 1P 행동 시작 전까지 피격될수록 이후 피해를 10%씩 곱연산으로 줄이는 <매끈한 두피>를 추가했습니다.',
      '하드 HOI-M.S.J-50에게 매 공격을 20% 확률로 회피하는 <나 먼저 퇴근할게>를 추가하고, 보스 정보/전투 버프칸에 표시되도록 했습니다.'
    ]
  },
  {
    id: '2026-05-26-ranking-emblem-toggle',
    time: '2026-05-26 13:20',
    title: '랭킹 휘장 표시 토글',
    items: [
      '랭킹 탭에 휘장 켜기/끄기 버튼을 추가했습니다.',
      '휘장을 끄면 랭킹에 표시되는 모든 휘장 배경과 아이콘이 숨겨져 더 조용한 화면으로 볼 수 있습니다.'
    ]
  },
  {
    id: '2026-05-26-normal-raid-high-level-entry',
    time: '2026-05-26 13:05',
    title: '노멀 회의 입장 제한 완화',
    items: [
      '150레벨 이상 유저도 노멀 보스에 참가할 수 있게 변경했습니다.',
      '대신 150레벨 이상 유저가 노멀 보스에 참가하면 기본 보상은 1/3로 지급됩니다.'
    ]
  },
  {
    id: '2026-05-26-potato-rehab-card-balance',
    time: '2026-05-26 12:35',
    title: '카드 밸런스와 신규 S카드',
    items: [
      '<겨울 부장의 부하직원 육성>의 레벨 보정 수치를 전 강화 구간에서 10 낮췄습니다.',
      '신규 S등급 카드 <감자의 재활훈련>을 추가했습니다. 보스전에서 한 판당 1회 고정 피해를 주고, 처치에 성공하면 카드 데미지가 영구적으로 10% 증가합니다.',
      '<감자의 재활훈련>은 강화할 수 없고 개인면담 밴픽/선택 목록에는 표시되지 않습니다.'
    ]
  },
  {
    id: '2026-05-26-pvp-normal-ranked-mode',
    time: '2026-05-26 12:10',
    title: '개인면담 일반/랭크 분리',
    items: [
      '개인면담 입장 시 일반전과 랭크전을 선택할 수 있게 했고, 두 모드는 대기열과 진행 상태가 따로 운영됩니다.',
      '일반전은 밴 없이 픽만 진행하며 점수 변동 없이 승리 2.5%, 패배 1% 경험치 보상을 지급합니다.',
      '랭크전 승리 보상에 박카스 1개를 추가하고, 랭크 패배 시에도 경험치통 2% 경험치를 지급합니다.',
      '개인면담 1P/2P 순서는 대기열 입장 순서와 관계없이 무작위로 배정됩니다.'
    ]
  },
  {
    id: '2026-05-26-butler-emblem-refresh',
    time: '2026-05-26 11:35',
    title: '집사 휘장 조정',
    items: [
      '<집사> 휘장 이미지를 새 버전으로 교체했습니다.',
      '<집사> 휘장의 파편 상점 구매 가격을 장비 파편 10,000개에서 5,000개로 낮췄습니다.'
    ]
  },
  {
    id: '2026-05-26-butler-emblem',
    time: '2026-05-26 09:35',
    title: '집사 휘장 추가',
    items: [
      '파편 상점에 장비 파편 10,000개로 구매 가능한 <집사> 휘장을 추가했습니다.',
      '<집사> 휘장은 보유만 해도 보스 클리어 보상을 5% 증가시킵니다.',
      '운영자 선물 기능에서 장비 파편을 바로 지급할 수 있게 했습니다.'
    ]
  },
  {
    id: '2026-05-26-emblem-owned-exp-effect',
    time: '2026-05-26 00:20',
    title: '휘장 보유 효과 추가',
    items: [
      '첫 휘장 이름을 <사원증>으로 변경했습니다.',
      '휘장은 장착 여부와 관계없이 보유만 해도 효과가 적용되며, <사원증>은 획득하는 모든 경험치를 1% 증가시킵니다.'
    ]
  },
  {
    id: '2026-05-22-emblem-shop',
    time: '2026-05-22 02:10',
    title: '휘장 상점과 랭킹 닉네임 연출 추가',
    items: [
      '파편 상점 버튼을 상점으로 변경하고, 상점 팝업 안에 파편 상점과 일반 상점 탭을 분리했습니다.',
      '일반 상점에 1000억원으로 구매 가능한 <사원증> 휘장을 추가했습니다.',
      '가방에 휘장 탭을 추가하고, 장착한 휘장은 랭킹 닉네임 칸 배경과 아이콘으로 표시되도록 했습니다.'
    ]
  },
  {
    id: '2026-05-22-hard-raid-hp-180k',
    time: '2026-05-22 01:45',
    title: '하드 회의 보스 체력 상향',
    items: [
      '하드 모드 보스의 체력을 기존 120,000에서 180,000으로 상향했습니다.'
    ]
  },
  {
    id: '2026-05-22-pvp-victory-exp-fragments',
    time: '2026-05-22 01:30',
    title: '개인면담 승리 보상 추가',
    items: [
      '개인면담 승리 시 기존 회의 추가 입장권에 더해 현재 레벨 경험치통의 5% 경험치와 장비 파편 1~5개를 추가 지급합니다.'
    ]
  },
  {
    id: '2026-05-22-fragment-shop-raid-hard-mode',
    time: '2026-05-22 01:10',
    title: '파편 상점과 하드 레이드 추가',
    items: [
      '파편 상점에 회의 추가 입장권과 명함 묶음 구매 항목을 추가했습니다.',
      '보스 레이드를 노멀/하드 모드로 분리하고, 하드 모드는 150레벨 이상 입장 및 노멀 보상 1.5배로 적용했습니다.',
      '노멀/하드 레이드는 각각 별도 대기열과 전투 방으로 진행되며, 회의 창에서 모드를 선택할 수 있습니다.'
    ]
  },
  {
    id: '2026-05-22-raid-spectator-bottom',
    time: '2026-05-22 00:35',
    title: '레이드 관전자 위치 조정',
    items: [
      '보스 레이드 전투 화면의 관전자 목록을 상단 오버레이가 아니라 참가 플레이어 목록 아래쪽에 표시되도록 변경했습니다.'
    ]
  },
  {
    id: '2026-05-22-mingu-blue-aura',
    time: '2026-05-22 00:20',
    title: '밍구 카드 푸른 오라 연출 추가',
    items: [
      '<제 1회 면담대회 우승자 밍구의 품격> 카드가 보이는 화면에 은은한 푸른 아우라 애니메이션을 추가했습니다.',
      '보스 대기/전투 프로필, 개인면담 카드, 가방/강화/합성 카드 표시에도 같은 특수 연출이 적용됩니다.'
    ]
  },
  {
    id: '2026-05-21-mingu-raid-profile-style',
    time: '2026-05-21 22:45',
    title: '밍구 카드 보스전 프로필 연출 추가',
    items: [
      '<제 1회 면담대회 우승자 밍구의 품격> 카드를 장착한 상태로 보스 대기/전투 화면에 들어가면 참가자 프로필에도 검정 배경, 주황 글씨, 금색 발광 테두리가 표시되도록 변경했습니다.'
    ]
  },
  {
    id: '2026-05-21-pvp-ranking-betting-new-s-cards',
    time: '2026-05-21 22:20',
    title: '개인면담 랭킹/배팅 및 신규 S카드 추가',
    items: [
      '실시간 랭킹을 레벨 순위와 개인면담 순위 탭으로 나누고, 개인면담 점수는 첫 경기 후 1000점 기준으로 승패에 따라 변동되도록 추가했습니다.',
      '개인면담 관전자는 밴픽 종료 전까지 참가자에게 배팅할 수 있으며, 적중 시 배팅금의 1.3배를 지급받습니다.',
      '신규 S등급 카드 <제 1회 면담대회 우승자 밍구의 품격>, <겨울 부장의 부하직원 육성>을 추가했습니다.',
      '반격 버프가 다단 타격을 맞을 때 매 타격마다 반격하도록 개인면담 전투 처리를 보강했습니다.'
    ]
  },
  {
    id: '2026-05-21-pvp-server-timer-lock',
    time: '2026-05-21 21:35',
    title: '개인면담 타이머/자동선택 안정화',
    items: [
      '개인면담 타이머를 서버 시간 기준으로 보정해서 PC별 시간 차이로 선택 가능 시간이 어긋나는 문제를 줄였습니다.',
      '동시에 여러 유저 화면에서 자동 선택 요청이 들어와도 같은 턴이 여러 번 처리되지 않도록 서버 진행 락을 추가했습니다.',
      '자동 픽 처리 중 직접 픽이 먼저 들어온 경우, 뒤늦게 돌아온 자동 픽이 추가로 들어가지 않도록 검증을 보강했습니다.'
    ]
  },
  {
    id: '2026-05-21-pvp-draft-turn-sync-pick-time',
    time: '2026-05-21 21:15',
    title: '개인면담 밴픽 턴 동기화 보강',
    items: [
      '개인면담 밴/픽 선택 실패 시 서버의 최신 상태를 즉시 화면에 반영하도록 수정했습니다.',
      '화면상 내 차례처럼 보이는데 서버에서는 내 차례가 아니라고 판단되는 상태 엇갈림을 줄였습니다.',
      '픽 단계 제한시간을 30초에서 45초로 늘렸습니다.'
    ]
  },
  {
    id: '2026-05-21-pvp-draft-deadline-server-time',
    time: '2026-05-21 20:50',
    title: '개인면담 픽 제한시간 판정 수정',
    items: [
      '개인면담 밴픽에서 브라우저 시간 차이 때문에 1~2초 일찍 선택 버튼이 막힐 수 있던 클라이언트 만료 판정을 제거했습니다.',
      '밴/픽 제한시간은 서버가 최종 판정하며, 0초가 지난 뒤에는 즉시 자동 밴/픽으로 진행되도록 조정했습니다.'
    ]
  },
  {
    id: '2026-05-21-pvp-pick-sequence-hotfix',
    time: '2026-05-21 20:35',
    title: '개인면담 픽 순서 긴급 수정',
    items: [
      '개인면담 픽 단계가 1P-2P-2P-1P-1P-2P-2P-1P-1P-2P 순서표를 끝까지 소모하면 즉시 전투 카운트다운으로 넘어가도록 수정했습니다.',
      '마지막 픽 순서에서 2P 턴이 고정되어 5장을 초과 선택하거나 자동 선택이 반복될 수 있던 문제를 차단했습니다.',
      '이미 5장을 고른 플레이어에게 자동 픽이 추가로 들어가지 않도록 서버 검증을 보강했습니다.'
    ]
  },
  {
    id: '2026-05-21-hoi-overtime-parental-leave',
    time: '2026-05-21 20:10',
    title: '야근 폭발 구조와 육아휴직 쿨타임 조정',
    items: [
      '<호이의 매일하는 야근>은 첫 사용 시 쿨타임이 돌지 않고, 이후 자신의 턴에 재사용해 폭발시킨 뒤 쿨타임이 시작되도록 변경했습니다.',
      '<호이의 매일하는 야근>의 쿨타임을 전체 강화 구간에서 1턴 줄였습니다.',
      '<몬드의 육아휴직> 쿨타임을 +0 9턴, +1~2 8턴, +3~4 7턴, +5 6턴으로 조정했습니다.'
    ]
  },
  {
    id: '2026-05-20-marketplace-expiry-fusion-guard',
    time: '2026-05-20 19:35',
    title: '번개장터 만료/회수 및 합성 보호 패치',
    items: [
      '사내 번개장터 물품은 등록 후 48시간이 지나면 구매 목록에서 숨겨지고, 판매자는 판매완료/회수 탭에서 회수할 수 있습니다.',
      '카드 합성 재료는 +4강 이하 카드만 등록할 수 있도록 클라이언트와 서버 검증을 함께 강화했습니다.',
      '개인면담에서 피격 무효가 중독 피해에도 정상 적용되도록 피해 처리 예외를 정리했습니다.'
    ]
  },
  {
    id: '2026-05-20-package-fusion-pvp-pick',
    time: '2026-05-20 19:10',
    title: '명함 패키지와 카드 합성/개인면담 개선',
    items: [
      '지갑전사 탭에 명함 패키지 1, 명함 패키지 2를 추가했습니다.',
      '카드 합성에서 강화 카드도 재료로 사용할 수 있게 하고, C/B/A급 일괄 등록 버튼을 추가했습니다.',
      '개인면담 픽 과정에서는 같은 카드 종류가 여러 강화 단계로 있을 때 가장 높은 강화 단계만 표시되도록 변경했습니다.'
    ]
  },
  {
    id: '2026-05-20-pvp-draft-confirm-fix',
    time: '2026-05-20 18:45',
    title: '개인면담 밴픽 선택 안정화',
    items: [
      '개인면담 밴픽에서 턴/단계가 바뀌면 이전 선택 카드가 남지 않도록 정리했습니다.',
      '밴/픽 확정 시 현재 화면에서 클릭해둔 카드만 서버에 전달되도록 검증을 강화했습니다.',
      '자동 밴/픽은 제한시간이 끝난 뒤 서버 전송 유예까지 지난 경우에만 진행되도록 조정했습니다.'
    ]
  },
  {
    id: '2026-05-20-new-cards-work-optimization',
    time: '2026-05-20 18:20',
    title: '신규 카드와 업무 최적화 조정',
    items: [
      '신규 B등급 카드 <죠르의 봉고차>를 추가했습니다. 빵 버프는 피격 시 HP를 회복하고 1개씩 사용됩니다.',
      '신규 A등급 카드 <몬드의 육아휴직>을 추가했습니다. 레이드에서는 파티원 스킬 쿨타임을, 개인면담에서는 자신의 카드 쿨타임을 줄입니다.',
      '<업무 최적화> 스킬 재사용 대기시간을 5시간에서 7시간으로 조정했습니다.'
    ]
  },
  {
    id: '2026-05-20-pvp-buff-fix',
    time: '2026-05-20 17:45',
    title: '개인면담 버프 적용 보정',
    items: [
      '개인면담에서 <심심이의 소개팅> 사용 시 피해 증폭 버프가 다음 자신의 공격용 버프로 표시되도록 수정했습니다.',
      '개인면담에서 반격 버프가 자기 턴 종료와 동시에 사라지지 않고 상대 공격에 정상 반응하도록 조정했습니다.'
    ]
  },
  {
    id: '2026-05-20-pvp-accept-pick-order',
    time: '2026-05-20 17:20',
    title: '개인면담 매칭과 픽 순서 조정',
    items: [
      '개인면담 매칭 수락 대기 시간을 5초로 유지하고, 한 명이 취소하면 양쪽 모두 대기 상태가 풀리도록 조정했습니다.',
      '개인면담 픽 순서를 1P-2P-2P-1P-1P-2P-2P-1P-1P-2P 방식으로 변경했습니다.',
      '개인면담 관전자는 승패가 결정되면 자동으로 메인 화면으로 돌아가도록 조정했습니다.'
    ]
  },
  {
    id: '2026-05-20-pvp-raid-spectator-poison',
    time: '2026-05-20 16:30',
    title: '개인면담 안내와 회의 관전 개선',
    items: [
      '개인면담 화면에 레벨 보정, 기본 공격력, 밴픽 규칙, 강화/장비 적용 안내를 추가했습니다.',
      '개인면담과 회의 전투 화면에 실시간 관전자 목록을 표시합니다.',
      '개인면담에서 실드형 카드가 상대 턴 종료 후 정리되도록 조정했습니다.',
      '신규 A급 카드 <네오의 특제 농약>을 추가했습니다.',
      '개인면담 승리 보상으로 회의 추가 입장권 1장을 지급합니다.'
    ]
  },
  {
    id: '2026-05-19-pvp-battle-usability',
    time: '2026-05-19 17:48',
    title: '개인면담 전투 편의성 개선',
    items: [
      '개인면담 전투에서 현재 행동 중인 플레이어 패널을 노란색 테두리로 강조하고, 중앙에 턴 제한 시간을 표시합니다.',
      '턴 제한 시간을 30초로 늘리고, 스킬 없이 기본공격만 진행하는 버튼을 추가했습니다.',
      '개인면담 HP바에도 레이드와 같은 피해 잔상 애니메이션을 적용했습니다.',
      '개인면담 대기중 버튼을 다시 누르면 대기열을 취소할 수 있고, 진행 중인 개인면담은 레벨 제한 없이 관전할 수 있습니다.',
      '개인면담 반격 버프가 기본 공격 피격 시 실제로 반격하도록 보강했습니다.'
    ]
  },
  {
    id: '2026-05-19-gacha-marketplace-overtime-card',
    time: '2026-05-19 13:47',
    title: '뽑기 확률, 번개장터, 신규 카드 조정',
    items: [
      '회의 참석 오른쪽에 개인면담, 파편 상점, 사내 번개장터 버튼이 차례대로 보이도록 배치를 조정했습니다.',
      '카드 뽑기를 등급 선결정 방식으로 변경하고 확률을 S 0.5%, A 3.5%, B 31%, C 65%로 조정했습니다.',
      '뽑기 결과는 높은 등급 순으로 표시되며, 새로 획득한 카드는 빨간색 NEW 표시가 붙습니다.',
      '사내 번개장터 정산 중복 방지 처리를 강화하고 정산 수수료 10%를 적용했습니다.',
      '신규 S등급 카드 <호이의 매일하는 야근>을 추가했습니다.'
    ]
  },
  {
    id: '2026-05-19-anticheat-marketplace-typing-tune',
    time: '2026-05-19 13:47',
    title: '봇 감지 완화와 거래소 정산 개선',
    items: [
      '뉴스 타이핑과 서류작업 클릭의 봇 감지 기준을 완화해 정상 플레이가 과하게 감점되지 않도록 조정했습니다.',
      '사내 번개장터에서 정산 완료한 판매 물품은 판매완료 목록에서 사라지도록 변경했습니다.',
      '뉴스 타이핑 문장에서 클릭해야 가려진 글자가 보이는 규칙을 제거했습니다.'
    ]
  },
  {
    id: '2026-05-19-pvp-interview-alpha',
    time: '2026-05-19 20:10',
    title: '개인면담 1대1 모드 1차 추가',
    items: [
      '신규 카드 네오의 자존감, 뒷담화를 추가했습니다.',
      '50레벨부터 입장 가능한 개인면담 매칭, 밴픽, 1대1 전투, 관전 화면을 1차로 추가했습니다.',
      '거래소에 정산 대기 판매가 있으면 사내 번개장터 버튼에 빨간 알림점이 표시됩니다.',
      '회의 전투 화면에서 보스의 보호막과 피격 무효 같은 버프 상태도 확인할 수 있게 했습니다.'
    ]
  },
  {
    id: '2026-05-19-anti-automation-marketplace',
    time: '2026-05-19 19:05',
    title: '자동 입력 방어와 번개장터 확장',
    items: [
      '뉴스 타이핑 문장을 일반 텍스트가 아닌 캔버스 이미지로 표시하고, 제외 글자/클릭 확인 단어/미세 흔들림 규칙을 추가했습니다.',
      '뉴스 타이핑과 서류작업 클릭에 비정상적으로 빠르거나 일정한 반복 패턴이 감지되면 보상 감점 또는 짧은 쿨타임이 적용됩니다.',
      '회의 추가 입장권과 하겐다즈를 사내 번개장터에서 유저끼리 거래할 수 있게 했습니다.',
      '번개장터 등록 창에 장비/주문서/아이템 필터와 정렬 기능을 추가하고, 모험에는 짧은 재시도 대기시간을 적용했습니다.'
    ]
  },
  {
    id: '2026-05-18-1527-card-filter-sort',
    time: '2026-05-18 15:27',
    title: '카드 목록 분류와 정렬 추가',
    items: [
      '가방의 카드 목록에 전체/S/A/B/C 등급별 보기 버튼을 추가했습니다.',
      '카드 목록을 기본 등급순, 강화 높은 순, 강화 낮은 순으로 정렬할 수 있게 했습니다.'
    ]
  },
  {
    id: '2026-05-18-1507-news-rss-source-fix',
    time: '2026-05-18 15:07',
    title: '뉴스 타이핑 RSS 소스 보강',
    items: [
      '응답하지 않는 뉴스 RSS 주소를 제거하고, 여러 국내 뉴스 RSS 소스를 추가해 실시간 헤드라인을 더 안정적으로 불러오도록 개선했습니다.',
      '실시간 뉴스 후보를 하나도 얻지 못해 예비 문장으로 전환되는 경우, 서버 로그에 원인 확인용 RSS 상태가 남도록 보강했습니다.'
    ]
  },
  {
    id: '2026-05-18-1458-boss-hp-color',
    time: '2026-05-18 14:58',
    title: '보스 HP바 가시성 개선',
    items: [
      '보스 현재 HP바를 초록색으로 변경해, 빨간 피해 잔상이 더 또렷하게 보이도록 조정했습니다.'
    ]
  },
  {
    id: '2026-05-18-1449-raid-hp-smooth-animation',
    time: '2026-05-18 14:49',
    title: '레이드 HP바 애니메이션 개선',
    items: [
      '레이드 HP바를 매 렌더마다 새로 만들지 않고 유지하도록 변경해, 피해와 회복이 이전 수치에서 현재 수치까지 부드럽게 움직이도록 개선했습니다.',
      '피해를 입을 때 초록색 HP가 먼저 줄고, 붉은 잔상이 뒤따라 줄어드는 연출이 더 안정적으로 보이도록 조정했습니다.'
    ]
  },
  {
    id: '2026-05-18-1445-patch-note-per-user-equipment-scroll',
    time: '2026-05-18 14:45',
    title: '패치노트 표시와 장비 강화창 개선',
    items: [
      '새 패치 배포 후 패치노트가 브라우저 단위가 아니라 계정별로 1회 표시되도록 변경했습니다.',
      '장비 강화창의 스크롤 영역을 조정해 맨 아래 장비와 주문서도 끝까지 확인할 수 있게 했습니다.'
    ]
  },
  {
    id: '2026-05-18-1430-raid-news-typing-stability',
    time: '2026-05-18 14:30',
    title: '레이드 준비 시간과 뉴스 타이핑 안정화',
    items: [
      '뉴스 타이핑 문장을 더 자주 실시간 RSS에서 다시 가져오도록 보강하고, 같은 문장을 Enter 연타로 중복 정산할 수 없게 막았습니다.',
      '딸기라떼 5강 보호막을 40으로 조정하고, 이것 좀 대신 해줘 이대리의 쿨타임을 강화 단계별로 2턴씩 늘렸습니다.',
      '레이드 입장 직후 전투 화면 중앙에 5초 준비 카운트다운을 추가하고, HP 감소 연출이 더 안정적으로 보이도록 조정했습니다.',
      '스트레스 수치가 100까지 정상적으로 누적되도록 스트레스 계산을 보정했습니다.'
    ]
  },
  {
    id: '2026-05-18-fragment-shop-marketplace-raid-rewards',
    time: '2026-05-18 00:00',
    title: '파편 상점과 사내 번개장터 준비',
    items: [
      '회의 참석 옆에 파편 상점 버튼을 추가하고 현재 보유 장비 파편 수를 확인할 수 있게 했습니다.',
      '사내 번개장터에서 장비와 주문서를 등록, 구매, 회수, 정산할 수 있는 기본 거래소 화면을 추가했습니다.',
      '보스 클리어 보상에 장비 파편 1~5개와 낮은 확률의 장비/주문서 보상을 추가했습니다.'
    ]
  },
  {
    id: '2026-05-15-1318-raid-queued-boss-lock',
    time: '2026-05-15 13:18',
    title: '\ub808\uc774\ub4dc \ub300\uae30 \ubcf4\uc2a4 \uace0\uc815',
    items: [
      '\ub808\uc774\ub4dc \ub300\uae30\uc5f4\uc5d0 \uccab \ucc38\uac00\uc790\uac00 \ub4e4\uc5b4\uc628 \uc21c\uac04\uc758 \ubcf4\uc2a4\ub97c \uace0\uc815\ud574, \ub300\uae30\ucc3d\uacfc \uc2e4\uc81c \uc785\uc7a5 \ubcf4\uc2a4\uac00 \ub2ec\ub77c\uc9c0\uc9c0 \uc54a\ub3c4\ub85d \uc218\uc815\ud588\uc2b5\ub2c8\ub2e4.'
    ]
  },
  {
    id: '2026-05-15-1305-raid-boss-portrait-toggle',
    time: '2026-05-15 13:05',
    title: '\ubcf4\uc2a4 \ucd08\uc0c1\ud654 ON/OFF \ucd94\uac00',
    items: [
      '\ubcf4\uc2a4 \ub300\uae30\ud654\uba74\uacfc \uc804\ud22c\ud654\uba74\uc5d0\uc11c \uc5f0\ub3d9\ub418\ub294 \ucd08\uc0c1\ud654 ON/OFF \ubc84\ud2bc\uc744 \ucd94\uac00\ud588\uc2b5\ub2c8\ub2e4.'
    ]
  },
  {
    id: '2026-05-15-1252-raid-boss-portraits',
    time: '2026-05-15 12:52',
    title: '\ubcf4\uc2a4 \ucd08\uc0c1\ud654 \ud45c\uc2dc \uc900\ube44',
    items: [
      '\ubcf4\uc2a4 \uc785\uc7a5 \ub300\uae30\ucc3d\uacfc \uc804\ud22c\ud654\uba74\uc5d0 \ubcf4\uc2a4 \ucd08\uc0c1\ud654\ub97c \ud45c\uc2dc\ud560 \uc218 \uc788\ub3c4\ub85d \ud30c\uc77c \uacbd\ub85c\ub97c \uc5f0\uacb0\ud588\uc2b5\ub2c8\ub2e4.'
    ]
  },
  {
    id: '2026-05-15-1240-news-typing-dash-tail-trim',
    time: '2026-05-15 12:40',
    title: '\ub274\uc2a4 \ud0c0\uc790 \ub3c4\uba54\uc778 \ucd9c\ucc98 \uc81c\uac70',
    items: [
      '\ub274\uc2a4 \uc81c\ubaa9 \ub05d\uc758 - \ub4a4\uc5d0 \ubd99\ub294 \ub9e4\uccb4\uba85\uacfc \ub3c4\uba54\uc778 \ucd9c\ucc98\ub97c \uc77c\uad04 \uc81c\uac70\ud558\ub3c4\ub85d \ubcc0\uacbd\ud588\uc2b5\ub2c8\ub2e4.'
    ]
  },
  {
    id: '2026-05-15-1234-news-typing-multi-source-trim',
    time: '2026-05-15 12:34',
    title: '\ub274\uc2a4 \ud0c0\uc790 \ucd9c\ucc98 \ubc18\ubcf5 \uc81c\uac70',
    items: [
      '\ub274\uc2a4 \uc81c\ubaa9 \ub05d\uc5d0 \ucd9c\ucc98\uac00 \uc5ec\ub7ec \ubc88 \ubd99\ub294 \uacbd\uc6b0\ub3c4 \ubc18\ubcf5 \uc81c\uac70\ud558\ub3c4\ub85d \ubcf4\uac15\ud588\uc2b5\ub2c8\ub2e4.'
    ]
  },
  {
    id: '2026-05-15-1232-news-typing-source-trim',
    time: '2026-05-15 12:32',
    title: '뉴스 타자 출처 제거 보강',
    items: [
      '뉴스 제목 끝에 영문 매체명이 붙는 경우도 타자 문장에서 제거되도록 정리했습니다.'
    ]
  },
  {
    id: '2026-05-15-1229-news-typing-cleanup',
    time: '2026-05-15 12:29',
    title: '뉴스 타자 문장 정리 강화',
    items: [
      '뉴스 타자 문장에서 출처, HTML 엔티티, 입력하기 어려운 특수문자를 제거하도록 필터를 강화했습니다.',
      '같은 기사 제목이 출처만 붙어 반복되는 경우 중복으로 나오지 않도록 정리했습니다.'
    ]
  },
  {
    id: '2026-05-15-1153-news-typing-normalize',
    time: '2026-05-15 11:53',
    title: '뉴스 타자 판정 완화 및 보상 기준 변경',
    items: [
      '뉴스 문장의 따옴표, 대시, 공백 차이 때문에 겉보기에는 같은 문장이 실패하던 판정을 보정했습니다.',
      '타자 보상 기준을 단어 수에서 공백 제외 글자와 부호 수로 변경했습니다.'
    ]
  },
  {
    id: '2026-05-15-1145-news-typing-work',
    time: '2026-05-15 11:45',
    title: '뉴스 타자 열일하기 추가',
    items: [
      '열일하기 탭을 좌우로 나누고 오른쪽에 RSS 기반 뉴스 문장 타자 입력 기능을 추가했습니다.',
      '문장을 정확히 입력하고 Enter를 누르면 공백을 제외한 글자와 부호 수만큼 서류 작업 클릭 경험치를 획득합니다.',
      '뉴스 문장은 드래그 복사와 붙여넣기를 막고, 제출 후에도 입력창 포커스가 유지되도록 했습니다.'
    ]
  },
  {
    id: '2026-05-15-1131-account-switch-fix',
    time: '2026-05-15 11:31',
    title: '계정 전환 안정화',
    items: [
      '로그아웃 후 다른 계정으로 로그인할 때 이전 계정의 늦게 도착한 응답이 새 로그인 상태를 덮어쓰지 않도록 수정했습니다.',
      '로그아웃 시 남아있는 갱신 타이머와 레이드 상태를 더 확실하게 정리하도록 보강했습니다.'
    ]
  },
  {
    id: '2026-05-15-1115-equipment-dismantle-scroll',
    time: '2026-05-15 11:15',
    title: '장비 분해창 스크롤 개선',
    items: [
      '장비 분해 팝업에서 목록을 끝까지 내려도 마지막 장비가 하단에 가려지지 않도록 스크롤 영역을 조정했습니다.'
    ]
  },
  {
    id: '2026-05-15-1104-raid-shield-exp-fix',
    time: '2026-05-15 11:04',
    title: '레이드 보호막 지속 및 레벨업 경험치 수정',
    items: [
      '카드로 획득한 보호막이 중간 파티원 행동 후 사라지지 않고 해당 턴의 보스 턴까지 유지되도록 수정했습니다.',
      '보스 보상 등으로 레벨업할 때 요구 경험치를 초과한 남은 경험치가 0으로 사라지지 않고 다음 레벨 경험치로 이어지도록 수정했습니다.'
    ]
  },
  {
    id: '2026-05-15-1025-equipment-dismantle',
    time: '2026-05-15 10:25',
    title: '장비 분해 추가',
    items: [
      '가방의 장비 영역에 장비 분해 버튼을 추가했습니다.',
      '분해 팝업에서 장비를 정렬하고 여러 장비를 선택해 한 번에 분해할 수 있습니다.',
      '장비 1개를 분해할 때마다 장비 파편 0~5개를 획득하며, 파편은 가방에 보관됩니다.'
    ]
  },
  {
    id: '2026-05-15-1017-patch-notes',
    time: '2026-05-15 10:17',
    title: '패치노트 시스템 추가',
    items: [
      '로그인 후 최신 패치노트가 유저별로 한 번 자동 표시됩니다.',
      '상단 BGM 버튼 옆에 패치노트 버튼을 추가해 언제든 다시 확인할 수 있습니다.',
      '앞으로 패치 요청이 들어올 때마다 시간과 변경 내역을 이 기록에 계속 누적합니다.'
    ]
  },
  {
    id: '2026-05-15-1005-raid-balance',
    time: '2026-05-15 10:05',
    title: '레이드 다단히트 밸런스 및 통신 주기 조정',
    items: [
      '이네오의 다이어트 선언, 멍프의 주차, 김부장의 가발, 옥상의 비둘기떼, 쓰비 우산으로 복사한 다단히트 피해를 각 타격 90%로 조정했습니다.',
      '강남스타일의 흥겨움은 기본 공격 2배 효과만 적용되며 90% 피해 보정에서는 제외했습니다.',
      '날 죽이지 못하는 시련은 어쩌고저쩌고.. 카드의 강화별 계수와 쿨타임을 상향 조정했습니다.',
      '랭킹 갱신은 30초, 레이드 폴링은 3초, 일반 동기화는 7초로 조정했습니다.'
    ]
  }
];

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  setupEventListeners();
  setupRaidBattleLogTracking();
  configureBgmAudio();
  updateBgmToggleButton();
  updateRaidBossPortraitToggleButtons();
  tryAutoLogin();
}

function setupEventListeners() {
  bindClick('loginBtn', handleLoginClick);
  bindClick('logoutBtn', handleLogoutClick);
  bindClick('bgmToggleBtn', handleBgmToggleClick);
  bindClick('raidBgmToggleBtn', handleBgmToggleClick);
  bindClick('raidLobbyPortraitToggleBtn', handleRaidBossPortraitToggle);
  bindClick('raidBattlePortraitToggleBtn', handleRaidBossPortraitToggle);
  bindClick('patchNotesBtn', () => openPatchNotesModal({ markSeen: true }));
  bindClick('raidPatchNotesBtn', () => openPatchNotesModal({ markSeen: true }));
  bindClick('patchNotesCloseBtn', closePatchNotesModal);
  bindClick('mailboxBtn', openMailboxModal);
  bindClick('mailboxCloseBtn', closeMailboxModal);
  bindClick('mailboxClaimAllBtn', handleMailboxClaimAll);
  bindClick('supportBtn', openSupportModal);
  bindClick('supportModalCloseBtn', closeSupportModal);
  bindClick('setNicknameBtn', handleSetNicknameClick);
  bindClick('clickWorkBtn', handleClickWork);
  setupNewsTypingInput();
  bindClick('adventureBtn', handleAdventureClick);
  bindClick('shoutBtn', handleShoutClick);
  bindClick('lupinBtn', handleLupinClick);
  bindClick('napBtn', handleNapClick);
  bindClick('fieldWorkBtn', handleFieldWorkClick);
  bindClick('sideJobBtn', handleSideJobClick);
  bindClick('workOptimizationSkillBtn', handleWorkOptimizationSkillClick);
  bindClick('raidLobbyBtn', openRaidLobby);
  bindClick('pvpLobbyBtn', handlePvpLobbyClick);
  bindClick('infiniteOvertimeBtn', handleInfiniteOvertimeClick);
  bindClick('overtimeBackBtn', handleOvertimeBackClick);
  bindClick('overtimeConfirmBtn', handleOvertimeConfirmClick);
  bindClick('overtimeBgmToggleBtn', handleBgmToggleClick);
  bindClick('overtimePatchNotesBtn', () => openPatchNotesModal({ markSeen: true }));
  bindClick('overtimeSwapConfirmBtn', handleOvertimeSwapConfirm);
  bindClick('overtimeSwapSkipBtn', handleOvertimeSwapSkip);
  bindClick('pvpModeNormalBtn', () => handlePvpModeSelect('normal'));
  bindClick('pvpModeRankedBtn', () => handlePvpModeSelect('ranked'));
  bindClick('pvpModeAugmentBtn', () => handlePvpModeSelect('augment3v3'));
  bindClick('pvpModeCloseBtn', () => hideModal('pvpModeModal'));
  bindClick('pvpAcceptBtn', () => handlePvpAccept(true));
  bindClick('pvpDeclineBtn', () => handlePvpAccept(false));
  bindClick('pvpBackBtn', handlePvpBackClick);
  bindClick('pvpDraftActionBtn', handlePvpDraftAction);
  bindClick('pvpBetBtn', openPvpBetModal);
  bindClick('pvpBetCancelBtn', closePvpBetModal);
  bindClick('pvpBetConfirmBtn', handlePvpBetConfirm);
  bindClick('pvpBgmToggleBtn', handleBgmToggleClick);
  bindClick('pvpPatchNotesBtn', () => openPatchNotesModal({ markSeen: true }));
  bindClick('rankingLevelTab', () => setRankingMode('level'));
  bindClick('rankingPvpTab', () => setRankingMode('pvp'));
  bindClick('rankingBranchTab', () => setRankingMode('branch'));
  bindClick('rankingEmblemToggleBtn', handleRankingEmblemToggle);
  bindClick('branchOfficeBtn', openBranchOfficeModal);
  bindClick('branchOfficeCloseBtn', closeBranchOfficeModal);
  bindClick('fragmentShopBtn', openFragmentShopModal);
  bindClick('fragmentShopTabBtn', () => handleShopModalTabChange('fragment'));
  bindClick('generalShopTabBtn', () => handleShopModalTabChange('general'));
  bindClick('fragmentShopCloseBtn', closeFragmentShopModal);
  bindClick('marketplaceBtn', openMarketplaceModal);
  bindClick('marketplaceCloseBtn', closeMarketplaceModal);
  bindClick('marketplaceRegisterOpenBtn', openMarketplaceRegisterModal);
  bindClick('marketplaceRegisterCloseBtn', closeMarketplaceRegisterModal);
  bindClick('marketplaceRegisterBtn', handleMarketplaceRegisterConfirm);
  bindClick('marketplaceSettleBtn', handleMarketplaceSettle);
  bindClick('raidLobbyCloseBtn', closeRaidLobby);
  bindClick('raidStartBtn', handleRaidStartClick);
  bindClick('raidModeNormalBtn', () => handleRaidModeChange('normal'));
  bindClick('raidModeHardBtn', () => handleRaidModeChange('hard'));
  bindClick('raidCountdownCancelBtn', handleRaidCountdownCancelClick);
  bindClick('raidBackBtn', handleRaidBackClick);
  bindClick('cardDrawBtn', handleCardDraw);
  bindClick('openEnhanceModalBtn', openCardEnhanceModal);
  bindClick('closeEnhanceModalBtn', closeCardEnhanceModal);
  bindClick('confirmEnhanceBtn', handleCardEnhanceConfirm);
  bindClick('openEquipmentEnhanceModalBtn', openEquipmentEnhanceModal);
  bindClick('closeEquipmentEnhanceModalBtn', closeEquipmentEnhanceModal);
  bindClick('confirmEquipmentEnhanceBtn', handleEquipmentEnhanceConfirm);
  bindClick('openEquipmentDismantleModalBtn', openEquipmentDismantleModal);
  bindClick('closeEquipmentDismantleModalBtn', closeEquipmentDismantleModal);
  bindClick('confirmEquipmentDismantleBtn', handleEquipmentDismantleConfirm);
  bindClick('openFusionModalBtn', openCardFusionModal);
  bindClick('closeFusionModalBtn', closeCardFusionModal);
  bindClick('confirmFusionBtn', handleCardFusionConfirm);
  bindClick('stockInvestBtn', handleStockInvest);
  bindClick('stockMarketOpenBtn', openCompanyStockMarketModal);
  bindClick('stockMarketCloseBtn', closeCompanyStockMarketModal);
  bindClick('eventBtn', openEventModal);
  bindClick('eventCloseBtn', closeEventModal);
  bindClick('stockTournamentRegisterBtn', handleStockTournamentRegister);
  bindClick('stockTournamentWatchBtn', openStockTournamentModal);
  bindClick('stockTournamentEntryBtn', openStockTournamentModal);
  bindClick('stockTournamentCloseBtn', closeStockTournamentModal);
  bindClick('adminLogoutBtn', handleLogoutClick);
  bindClick('adminGiftBtn', handleAdminGift);
  bindClick('adminDeleteUserBtn', handleAdminDeleteUser);
  bindClick('adminSetLevelBtn', handleAdminSetLevel);
  bindClick('adminGrantMoneyBtn', handleAdminGrantMoney);
  bindClick('adminSetRaidBossBtn', handleAdminSetRaidBoss);

  const giftType = document.getElementById('giftTypeSelect');
  if (giftType) {
    giftType.removeEventListener('change', renderAdminGiftOptions);
    giftType.addEventListener('change', renderAdminGiftOptions);
  }
}

function bindClick(id, handler) {
  const element = document.getElementById(id);
  if (!element) return;
  element.removeEventListener('click', handler);
  element.addEventListener('click', handler);
}

function setupRaidBattleLogTracking() {
  const battleLog = document.getElementById('raidBattleLog');
  if (!battleLog) return;
  battleLog.addEventListener('scroll', () => {
    const threshold = 16;
    raidBattleLogPinnedToBottom = battleLog.scrollTop <= threshold;
  });
}

function getStoredUser() {
  const value = localStorage.getItem('user');
  return value ? JSON.parse(value) : null;
}

function saveStoredUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

function getUserIdentity(user) {
  return user?._id ? String(user._id) : '';
}

function beginUserMutation() {
  userMutationInFlightCount += 1;
}

function endUserMutation() {
  userMutationInFlightCount = Math.max(0, userMutationInFlightCount - 1);
}

async function runWithUserMutation(task) {
  beginUserMutation();
  try {
    return await task();
  } finally {
    endUserMutation();
  }
}

function getUserStateActionTimeMs(user) {
  const value = user?.gameState?.lastActionTime;
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function shouldApplyIncomingUserState(incomingUser, options = {}) {
  if (!incomingUser) return false;
  const currentUser = getStoredUser();
  const incomingUserId = getUserIdentity(incomingUser);
  const currentUserId = getUserIdentity(currentUser);
  if (!incomingUserId || !currentUserId) return false;
  if (incomingUserId !== currentUserId) return false;
  if (options.force) return true;

  const incomingActionMs = getUserStateActionTimeMs(incomingUser);
  const currentActionMs = getUserStateActionTimeMs(currentUser);
  if (incomingActionMs !== currentActionMs) {
    return incomingActionMs >= currentActionMs;
  }

  const incomingLevel = Number(incomingUser?.gameState?.level || 0);
  const currentLevel = Number(currentUser?.gameState?.level || 0);
  if (incomingLevel !== currentLevel) {
    return incomingLevel >= currentLevel;
  }

  const incomingExp = Number(incomingUser?.gameState?.exp || 0);
  const currentExp = Number(currentUser?.gameState?.exp || 0);
  if (incomingExp !== currentExp) {
    return incomingExp >= currentExp;
  }

  const incomingMoney = Number(incomingUser?.gameState?.money || 0);
  const currentMoney = Number(currentUser?.gameState?.money || 0);
  if (incomingMoney !== currentMoney) {
    return incomingMoney >= currentMoney;
  }

  return true;
}

function ensureRaidAnimatedBar(container, { fillClass, trailClass }) {
  if (!container) return null;
  let root = container.querySelector(':scope > .raid-bar-anim-root');
  if (root) return root;

  container.innerHTML = `
    <div class="raid-bar-anim-root" data-current-hp-ratio="">
      <div class="${trailClass}" data-raid-bar-trail style="width:0%"></div>
      <div class="${fillClass}" data-raid-bar-current style="width:0%"></div>
      <div class="raid-shield-fill hidden" data-raid-bar-shield style="left:0%; width:0%"></div>
      <div class="raid-loss-indicator hidden" data-raid-bar-loss></div>
    </div>
  `;
  return container.querySelector(':scope > .raid-bar-anim-root');
}

function readRaidBarWidthRatio(element, root) {
  const rootWidth = root?.getBoundingClientRect?.().width || 0;
  const width = element?.getBoundingClientRect?.().width || 0;
  if (rootWidth <= 0) return null;
  return Math.max(0, Math.min(100, (width / rootWidth) * 100));
}

function setRaidBarTransitionEnabled(root, enabled) {
  const elements = [
    root.querySelector('[data-raid-bar-current]'),
    root.querySelector('[data-raid-bar-trail]'),
    root.querySelector('[data-raid-bar-shield]')
  ].filter(Boolean);
  elements.forEach((element) => {
    element.style.transition = enabled ? '' : 'none';
  });
}

function updateRaidAnimatedBar(container, options = {}) {
  const {
    hpRatio = 0,
    shieldRatio = 0,
    lossText = '',
    fillClass = 'raid-hp-fill',
    trailClass = 'raid-hp-trail-fill',
    trailDelayMs = 950
  } = options;
  const root = ensureRaidAnimatedBar(container, { fillClass, trailClass });
  if (!root) return;

  const hpFill = root.querySelector('[data-raid-bar-current]');
  const hpTrail = root.querySelector('[data-raid-bar-trail]');
  const shieldFill = root.querySelector('[data-raid-bar-shield]');
  const lossEl = root.querySelector('[data-raid-bar-loss]');
  if (!hpFill || !hpTrail) return;

  const targetHpRatio = Math.max(0, Math.min(100, Number(hpRatio || 0)));
  const targetShieldRatio = Math.max(0, Math.min(100, Number(shieldRatio || 0)));
  const previousTargetRaw = root.dataset.currentHpRatio;
  const previousTarget = previousTargetRaw === '' || previousTargetRaw == null
    ? NaN
    : Number(previousTargetRaw);
  const isFirstRender = !Number.isFinite(previousTarget);
  const visualHpRatio = readRaidBarWidthRatio(hpFill, root);
  const visualTrailRatio = readRaidBarWidthRatio(hpTrail, root);
  const startHpRatio = isFirstRender ? targetHpRatio : (visualHpRatio ?? previousTarget);
  const startTrailRatio = isFirstRender ? targetHpRatio : Math.max(visualTrailRatio ?? startHpRatio, startHpRatio);
  const changed = Math.abs(targetHpRatio - (Number.isFinite(previousTarget) ? previousTarget : targetHpRatio)) > 0.01
    || Math.abs(targetHpRatio - startHpRatio) > 0.01;
  const takingDamage = targetHpRatio < startHpRatio;
  const endShieldWidth = Math.max(0, Math.min(100 - targetHpRatio, targetShieldRatio));

  root.dataset.currentHpRatio = String(targetHpRatio);

  if (lossEl) {
    lossEl.textContent = lossText || '';
    lossEl.classList.toggle('hidden', !lossText);
  }

  if (isFirstRender || !changed) {
    setRaidBarTransitionEnabled(root, false);
    hpFill.style.width = `${targetHpRatio}%`;
    hpTrail.style.width = `${targetHpRatio}%`;
    if (shieldFill) {
      shieldFill.classList.toggle('hidden', targetShieldRatio <= 0);
      shieldFill.style.left = `${targetHpRatio}%`;
      shieldFill.style.width = `${endShieldWidth}%`;
    }
    root.getBoundingClientRect();
    requestAnimationFrame(() => setRaidBarTransitionEnabled(root, true));
    return;
  }

  setRaidBarTransitionEnabled(root, false);
  hpFill.style.width = `${startHpRatio}%`;
  hpTrail.style.width = `${takingDamage ? Math.max(startTrailRatio, startHpRatio) : startHpRatio}%`;
  if (shieldFill) {
    shieldFill.classList.toggle('hidden', targetShieldRatio <= 0);
    shieldFill.style.left = `${startHpRatio}%`;
    shieldFill.style.width = `${Math.max(0, Math.min(100 - startHpRatio, targetShieldRatio))}%`;
  }

  root.getBoundingClientRect();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setRaidBarTransitionEnabled(root, true);
      hpFill.style.width = `${targetHpRatio}%`;
      if (!takingDamage) {
        hpTrail.style.width = `${targetHpRatio}%`;
      }
      if (shieldFill) {
        shieldFill.style.left = `${targetHpRatio}%`;
        shieldFill.style.width = `${endShieldWidth}%`;
      }
      if (takingDamage) {
        window.setTimeout(() => {
          hpTrail.style.width = `${targetHpRatio}%`;
        }, trailDelayMs);
      }
    });
  });
}

function updatePvpAnimatedBar(container, key, options = {}) {
  const previousRatio = pvpHpAnimationRatios[key];
  const root = ensureRaidAnimatedBar(container, {
    fillClass: 'pvp-hp-fill',
    trailClass: 'pvp-hp-trail-fill'
  });
  if (root && previousRatio != null && root.dataset.currentHpRatio === '') {
    const hpFill = root.querySelector('[data-raid-bar-current]');
    const hpTrail = root.querySelector('[data-raid-bar-trail]');
    if (hpFill) hpFill.style.width = `${previousRatio}%`;
    if (hpTrail) hpTrail.style.width = `${previousRatio}%`;
    root.dataset.currentHpRatio = String(previousRatio);
  }
  updateRaidAnimatedBar(container, {
    ...options,
    fillClass: 'pvp-hp-fill',
    trailClass: 'pvp-hp-trail-fill'
  });
  pvpHpAnimationRatios[key] = Math.max(0, Math.min(100, Number(options.hpRatio || 0)));
}

function createRaidParticipantCardElement(userId) {
  const card = document.createElement('div');
  card.className = 'raid-participant-card';
  card.dataset.userId = String(userId || '');
  card.innerHTML = `
    <div class="raid-participant-header">
      <div>
        <strong data-raid-participant-name></strong>
        <span class="menu-note" data-raid-participant-level></span>
      </div>
      <div data-raid-participant-card></div>
    </div>
    <div class="raid-bar-wrap">
      <div class="raid-shield-indicator hidden" data-raid-participant-shield-indicator></div>
      <div class="raid-loss-indicator hidden" data-raid-participant-loss></div>
      <div class="raid-hp-bar" data-raid-participant-hp-bar></div>
    </div>
    <div class="raid-status-text" data-raid-participant-status></div>
    <div class="raid-shield-text" data-raid-participant-shield-text></div>
    <div class="raid-effect-list" data-raid-participant-effects></div>
    <div data-raid-participant-controls></div>
  `;
  return card;
}

function getStoredAdmin() {
  const value = localStorage.getItem('adminSession');
  return value ? JSON.parse(value) : null;
}

function saveStoredAdmin(adminSession) {
  localStorage.setItem('adminSession', JSON.stringify(adminSession));
}

function clearIntervals() {
  if (animationInterval) clearInterval(animationInterval);
  if (updateInterval) clearInterval(updateInterval);
  if (rankingInterval) clearInterval(rankingInterval);
  if (syncInterval) clearInterval(syncInterval);
  if (raidPollInterval) clearInterval(raidPollInterval);
  if (pvpPollInterval) clearInterval(pvpPollInterval);
  if (raidCountdownTicker) clearInterval(raidCountdownTicker);
  if (raidReadyTicker) clearInterval(raidReadyTicker);
  if (pvpAcceptTicker) clearInterval(pvpAcceptTicker);
  if (pvpDraftTicker) clearInterval(pvpDraftTicker);
  if (pvpStartTicker) clearInterval(pvpStartTicker);
  if (pvpTurnTicker) clearInterval(pvpTurnTicker);
  if (pvpResultReturnTimer) clearTimeout(pvpResultReturnTimer);
  if (pvpSpectatorReturnTimer) clearTimeout(pvpSpectatorReturnTimer);
  if (newsTypingCanvasTimer) clearInterval(newsTypingCanvasTimer);
  animationInterval = null;
  updateInterval = null;
  rankingInterval = null;
  syncInterval = null;
  raidPollInterval = null;
  pvpPollInterval = null;
  raidCountdownTicker = null;
  raidCountdownEndsAtMs = 0;
  raidCountdownDisplayStartMs = 0;
  raidReadyTicker = null;
  raidReadyEndsAtMs = 0;
  pvpAcceptTicker = null;
  pvpDraftTicker = null;
  pvpStartTicker = null;
  pvpTurnTicker = null;
  pvpResultReturnTimer = null;
  pvpSpectatorReturnTimer = null;
  newsTypingCanvasTimer = null;
}

function clearSessions() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('adminSession');
}

function getBgmAudio() {
  return document.getElementById('bgmAudio');
}

function isBgmMuted() {
  return localStorage.getItem(BGM_MUTED_STORAGE_KEY) === '1';
}

function configureBgmAudio() {
  const audio = getBgmAudio();
  if (!audio) return;
  audio.volume = BGM_VOLUME;
  audio.loop = true;
  audio.muted = isBgmMuted();
}

function switchBgmTrack(mode = 'normal') {
  const audio = getBgmAudio();
  if (!audio) return;

  const normalizedMode = BGM_TRACKS[mode] ? mode : 'normal';
  const nextSrc = BGM_TRACKS[normalizedMode];
  if (audio.getAttribute('src') !== nextSrc) {
    audio.pause();
    audio.setAttribute('src', nextSrc);
    audio.load();
  }
  currentBgmMode = normalizedMode;
}

function updateBgmToggleButton() {
  const audio = getBgmAudio();
  const muted = isBgmMuted();
  const isPlaying = Boolean(audio && !audio.paused && !muted);

  document.querySelectorAll('.bgm-toggle-btn').forEach((button) => {
    button.textContent = isPlaying ? 'BGM 끄기' : 'BGM 켜기';
    button.classList.toggle('is-muted', !isPlaying);
    button.setAttribute('aria-pressed', String(isPlaying));
    button.title = isPlaying ? '배경음악 음소거' : '배경음악 켜기';
  });
}

async function startBgm(mode = currentBgmMode) {
  const audio = getBgmAudio();
  if (!audio) return;

  configureBgmAudio();
  switchBgmTrack(mode);
  if (isBgmMuted()) {
    audio.pause();
    updateBgmToggleButton();
    return;
  }

  try {
    await audio.play();
  } catch (err) {
    console.warn('BGM playback was blocked by the browser:', err);
  } finally {
    updateBgmToggleButton();
  }
}

function stopBgm(resetPosition = false) {
  const audio = getBgmAudio();
  if (!audio) return;
  audio.pause();
  if (resetPosition) audio.currentTime = 0;
  if (resetPosition) switchBgmTrack('normal');
  updateBgmToggleButton();
}

function handleBgmToggleClick() {
  const audio = getBgmAudio();
  const shouldMute = audio ? !audio.paused && !isBgmMuted() : !isBgmMuted();
  localStorage.setItem(BGM_MUTED_STORAGE_KEY, shouldMute ? '1' : '0');

  if (shouldMute) {
    stopBgm(false);
  } else {
    startBgm(currentBgmMode);
  }
  updateBgmToggleButton();
}

function playPvpSfx(type = 'hit') {
  if (isBgmMuted()) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const presets = {
    skill: { frequency: 660, endFrequency: 880, duration: 0.12, gain: 0.035 },
    hit: { frequency: 180, endFrequency: 120, duration: 0.08, gain: 0.045 },
    result: { frequency: 523, endFrequency: 784, duration: 0.18, gain: 0.04 }
  };
  const preset = presets[type] || presets.hit;
  oscillator.type = type === 'hit' ? 'square' : 'sine';
  oscillator.frequency.setValueAtTime(preset.frequency, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(preset.endFrequency, context.currentTime + preset.duration);
  gain.gain.setValueAtTime(preset.gain, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + preset.duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + preset.duration);
  setTimeout(() => context.close().catch(() => {}), Math.ceil((preset.duration + 0.05) * 1000));
}

function formatNumber(value, decimals = 0) {
  return Number(value || 0).toLocaleString('ko-KR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function formatDurationMs(ms) {
  const totalSeconds = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}시간 ${minutes}분 ${seconds}초`;
  if (minutes > 0) return `${minutes}분 ${seconds}초`;
  return `${seconds}초`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function truncateDisplayText(value, maxLength = 18) {
  const text = String(value ?? '').trim();
  const chars = Array.from(text);
  if (chars.length <= maxLength) return text;
  return chars.slice(0, Math.max(1, maxLength - 1)).join('') + '…';
}

function getCompactDisplayName(value, maxLength = 18) {
  return truncateDisplayText(value || '이름 없음', maxLength);
}

function compactDisplayHtml(value, maxLength = 18) {
  const full = String(value || '이름 없음');
  return `<span class="compact-display-name" title="${escapeAttr(full)}">${escapeHtml(getCompactDisplayName(full, maxLength))}</span>`;
}

function getCardVisualClass(card = {}) {
  const classes = [];
  if (card.specialStyle === 'champion') classes.push('champion-card');
  if (card.specialStyle === 'potato-rehab') classes.push('potato-rehab-card');
  return classes.join(' ');
}

function getCardVisualStyle(card = {}) {
  if (card.specialStyle !== 'potato-rehab') return '';
  const strength = Math.max(0, Math.min(1, Number(card.potatoRehabAuraStrength || 0)));
  if (strength <= 0) return '';
  const scale = Number((1 + (strength * 0.32)).toFixed(3));
  return `--potato-aura-strength:${strength}; --potato-aura-scale:${scale};`;
}

function applyCardVisualToElement(element, card = {}) {
  if (!element) return;
  element.classList.toggle('champion-card', card.specialStyle === 'champion');
  element.classList.toggle('potato-rehab-card', card.specialStyle === 'potato-rehab');
  const strength = Math.max(0, Math.min(1, Number(card.potatoRehabAuraStrength || 0)));
  if (card.specialStyle === 'potato-rehab' && strength > 0) {
    element.style.setProperty('--potato-aura-strength', String(strength));
    element.style.setProperty('--potato-aura-scale', String(Number((1 + (strength * 0.32)).toFixed(3))));
  } else {
    element.style.removeProperty('--potato-aura-strength');
    element.style.removeProperty('--potato-aura-scale');
  }
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setHtml(id, value) {
  const element = document.getElementById(id);
  if (element) element.innerHTML = value;
}

function buildRaidBossPortraitHtml(portraitSrc, bossName, options = {}) {
  const name = bossName || '보스';
  const imageClass = options.imageClass || 'raid-boss-avatar-img';
  const fallbackClass = options.fallbackClass || 'raid-boss-avatar';
  const hiddenFallbackClass = portraitSrc ? ' hidden' : '';
  const imageHtml = portraitSrc
    ? `<img class="${imageClass}" src="${escapeHtml(portraitSrc)}" alt="${escapeHtml(name)} 초상화" onerror="this.classList.add('hidden'); this.nextElementSibling.classList.remove('hidden');">`
    : '';

  return `
    ${imageHtml}
    <div class="${fallbackClass}${hiddenFallbackClass}">${escapeHtml(name)}</div>
  `;
}

function isRaidBossPortraitEnabled() {
  return localStorage.getItem(RAID_BOSS_PORTRAIT_STORAGE_KEY) !== 'false';
}

function updateRaidBossPortraitToggleButtons() {
  const enabled = isRaidBossPortraitEnabled();
  ['raidLobbyPortraitToggleBtn', 'raidBattlePortraitToggleBtn'].forEach((buttonId) => {
    const button = document.getElementById(buttonId);
    if (!button) return;
    button.textContent = enabled ? '초상화 끄기' : '초상화 켜기';
    button.setAttribute('aria-pressed', String(enabled));
    button.classList.toggle('off', !enabled);
  });
}

function rerenderRaidBossPortraitSections() {
  updateRaidBossPortraitToggleButtons();
  const user = getStoredUser();
  if (latestRaidState) {
    updateRaidLobbyUI(latestRaidState, user);
    if (latestRaidState.activeBattle && !document.getElementById('raid-screen')?.classList.contains('hidden')) {
      renderRaidBattle(latestRaidState, user);
    }
  }
}

function handleRaidBossPortraitToggle() {
  const nextEnabled = !isRaidBossPortraitEnabled();
  localStorage.setItem(RAID_BOSS_PORTRAIT_STORAGE_KEY, nextEnabled ? 'true' : 'false');
  rerenderRaidBossPortraitSections();
}

function renderRaidBossPortrait(element, portraitSrc, bossName, options = {}) {
  if (!element) return;
  const enabled = isRaidBossPortraitEnabled();
  const effectivePortraitSrc = enabled ? portraitSrc : '';
  const key = `${enabled}|${effectivePortraitSrc || ''}|${bossName || ''}|${options.imageClass || ''}|${options.fallbackClass || ''}`;
  if (element.dataset.portraitKey === key) return;
  element.dataset.portraitKey = key;
  element.innerHTML = buildRaidBossPortraitHtml(effectivePortraitSrc, bossName, options);
}

function isRankingEmblemsEnabled() {
  return localStorage.getItem(RANKING_EMBLEMS_STORAGE_KEY) !== 'false';
}

function updateRankingEmblemToggleButton() {
  const button = document.getElementById('rankingEmblemToggleBtn');
  if (!button) return;
  const enabled = isRankingEmblemsEnabled();
  button.textContent = enabled ? '휘장 끄기' : '휘장 켜기';
  button.classList.toggle('off', !enabled);
  button.setAttribute('aria-pressed', String(enabled));
  button.title = enabled ? '랭킹 휘장 배경과 아이콘 숨기기' : '랭킹 휘장 다시 표시하기';
}

function handleRankingEmblemToggle() {
  const nextEnabled = !isRankingEmblemsEnabled();
  localStorage.setItem(RANKING_EMBLEMS_STORAGE_KEY, nextEnabled ? 'true' : 'false');
  updateRankingEmblemToggleButton();
  updateRankingUI();
}

function getBusinessCardCount(user) {
  return (user.inventory || [])
    .filter((item) => item.itemId === 'business_card')
    .reduce((total, item) => total + Math.max(0, Number(item.quantity) || 0), 0);
}

function getEquippedCardDetail(user) {
  const equippedCardId = user?.equippedCardId || null;
  const equippedCardLevel = Number(user?.equippedCardLevel || 0);
  if (!equippedCardId) return null;

  return (user.cardVariantDetails || []).find((card) =>
    card.cardId === equippedCardId && Number(card.enhancementLevel || 0) === equippedCardLevel
  ) || (user.cardDetails || []).find((card) => card.equipped) || null;
}

function hideModal(id) {
  const element = document.getElementById(id);
  if (element) element.classList.add('hidden');
}

function showModal(id) {
  const element = document.getElementById(id);
  if (element) element.classList.remove('hidden');
}

function getLatestPatchNoteId() {
  return PATCH_NOTES[0]?.id || '';
}

function getPatchNotesStorageKey() {
  const user = getStoredUser();
  const userKey = user?._id || user?.username || 'guest';
  return `${PATCH_NOTES_STORAGE_KEY}:${userKey}`;
}

function isAnyModalOpen() {
  return Array.from(document.querySelectorAll('.modal-overlay'))
    .some((element) => !element.classList.contains('hidden'));
}

function renderPatchNotes() {
  const list = document.getElementById('patchNotesList');
  if (!list) return;

  list.innerHTML = '';
  PATCH_NOTES.forEach((note) => {
    const card = document.createElement('article');
    card.className = 'patch-note-card';

    const time = document.createElement('div');
    time.className = 'patch-note-time';
    time.textContent = note.time;
    card.appendChild(time);

    const title = document.createElement('div');
    title.className = 'patch-note-title';
    title.textContent = note.title;
    card.appendChild(title);

    const items = document.createElement('ul');
    items.className = 'patch-note-items';
    (note.items || []).forEach((text) => {
      const item = document.createElement('li');
      item.textContent = text;
      items.appendChild(item);
    });
    card.appendChild(items);
    list.appendChild(card);
  });
}

function openPatchNotesModal({ markSeen = true } = {}) {
  renderPatchNotes();
  showModal('patchNotesModal');
  if (markSeen) {
    const latestId = getLatestPatchNoteId();
    if (latestId) localStorage.setItem(getPatchNotesStorageKey(), latestId);
  }
}

function closePatchNotesModal() {
  hideModal('patchNotesModal');
}

function maybeShowPatchNotesOnce(attempt = 0) {
  const latestId = getLatestPatchNoteId();
  if (!latestId || localStorage.getItem(getPatchNotesStorageKey()) === latestId) return;

  if (isAnyModalOpen() && attempt < 20) {
    setTimeout(() => maybeShowPatchNotesOnce(attempt + 1), 1000);
    return;
  }

  openPatchNotesModal({ markSeen: true });
}

function closeDecisionModal(result = null) {
  const overlay = document.getElementById('decisionModal');
  if (overlay) overlay.classList.add('hidden');

  const resolver = modalResolver;
  modalResolver = null;
  if (resolver) resolver(result);
}

function applyGlobalState(globalState = {}) {
  latestGlobalState = {
    activeShoutText: globalState.activeShoutText || '',
    activeShoutKey: globalState.activeShoutKey || ''
  };
  updateShoutBanner(latestGlobalState);
}

function updateShoutBanner(globalState = latestGlobalState) {
  const banner = document.getElementById('shoutBanner');
  const textEl = document.getElementById('shoutBannerText');
  if (!banner || !textEl) return;

  const shoutText = globalState.activeShoutText || '';
  const shoutKey = globalState.activeShoutKey || '';

  if (!shoutText) {
    banner.classList.add('shout-banner-empty');
    textEl.classList.remove('shout-banner-text');
    textEl.textContent = '';
    lastRenderedShoutKey = '';
    return;
  }

  banner.classList.remove('shout-banner-empty');
  if (lastRenderedShoutKey === shoutKey) return;

  textEl.classList.remove('shout-banner-text');
  void textEl.offsetWidth;
  textEl.textContent = shoutText;
  textEl.classList.add('shout-banner-text');
  lastRenderedShoutKey = shoutKey;
}

function updateShoutStatus(user) {
  const statusEl = document.getElementById('shoutStatus');
  const shoutBtn = document.getElementById('shoutBtn');
  if (!statusEl || !shoutBtn) return;

  const lastShoutAt = user?.meta?.lastShoutAt ? new Date(user.meta.lastShoutAt) : null;
  const remainMs = lastShoutAt
    ? Math.max(0, (10 * 60 * 1000) - (Date.now() - lastShoutAt.getTime()))
    : 0;

  if (remainMs <= 0) {
    statusEl.textContent = '외치기를 지금 사용할 수 있습니다.';
    shoutBtn.disabled = false;
    return;
  }

  const remainMinutes = Math.floor(remainMs / 60000);
  const remainSeconds = Math.floor((remainMs % 60000) / 1000);
  statusEl.textContent = `다음 외치기까지 ${remainMinutes}분 ${String(remainSeconds).padStart(2, '0')}초 남았습니다.`;
  shoutBtn.disabled = true;
}

function openDecisionModal({ title, message, details = '', buttons = [] }) {
  const overlay = document.getElementById('decisionModal');
  const titleEl = document.getElementById('decisionModalTitle');
  const messageEl = document.getElementById('decisionModalMessage');
  const detailsEl = document.getElementById('decisionModalDetails');
  const buttonsEl = document.getElementById('decisionModalButtons');

  if (!overlay || !titleEl || !messageEl || !detailsEl || !buttonsEl) {
    return Promise.resolve(null);
  }

  titleEl.textContent = title || '확인';
  messageEl.textContent = message || '';
  detailsEl.innerHTML = details || '';
  buttonsEl.innerHTML = '';

  overlay.classList.remove('hidden');

  return new Promise((resolve) => {
    modalResolver = resolve;

    buttons.forEach((button) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `mini-btn ${button.className || ''}`.trim();
      btn.textContent = button.label;
      btn.addEventListener('click', () => closeDecisionModal(button.value));
      buttonsEl.appendChild(btn);
    });
  });
}

function getUserToken() {
  return localStorage.getItem('token');
}

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok && data && typeof data === 'object') {
    const error = new Error(data.msg || '요청 처리에 실패했습니다.');
    Object.assign(error, data);
    throw error;
  }
  if (!res.ok) throw new Error(data.msg || '요청 처리에 실패했습니다.');
  return data;
}

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || '요청 처리에 실패했습니다.');
  return data;
}

function showNotifications(notifications = []) {
  const seen = new Set();
  const now = Date.now();
  for (const [key, shownAt] of recentNotificationKeys.entries()) {
    if (now - shownAt > 60000) {
      recentNotificationKeys.delete(key);
    }
  }
  notifications.forEach((notification) => {
    if (!notification?.text) return;
    if (notification.type === 'infinite_overtime_reward') return;
    const key = `${notification.type || ''}::${notification.text}`;
    if (seen.has(key)) return;
    const lastShownAt = recentNotificationKeys.get(key) || 0;
    if (now - lastShownAt < 15000) return;
    seen.add(key);
    recentNotificationKeys.set(key, now);
    alert(notification.text);
  });
}

function hideAllScreens() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('nickname-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('admin-screen').classList.add('hidden');
  const raidScreen = document.getElementById('raid-screen');
  if (raidScreen) raidScreen.classList.add('hidden');
  const pvpScreen = document.getElementById('pvp-screen');
  if (pvpScreen) pvpScreen.classList.add('hidden');
  const overtimeScreen = document.getElementById('infinite-overtime-screen');
  if (overtimeScreen) overtimeScreen.classList.add('hidden');
}

async function handleLoginClick(event) {
  event?.preventDefault();

  const requestSerial = ++loginRequestSerial;
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    alert('아이디와 비밀번호를 입력해주세요.');
    return;
  }

  try {
    const data = await postJson(`${API_URL}/api/login`, { username, password });
    if (requestSerial !== loginRequestSerial) return;
    processLoginSuccess(data);
  } catch (err) {
    if (requestSerial !== loginRequestSerial) return;
    alert(`로그인 실패: ${err.message}`);
  }
}

function processLoginSuccess(data) {
  clearIntervals();
  clearSessions();
  localStorage.setItem('token', data.token);

  if (data.isAdmin) {
    saveStoredAdmin({
      token: data.token,
      admin: data.admin,
      giftCatalog: data.giftCatalog
    });
    showAdminScreen();
    return;
  }

  saveStoredUser(data.user);
  applyGlobalState(data.global);

  if (data.isNewUser || !data.user.nickname) {
    hideAllScreens();
    document.getElementById('nickname-screen').classList.remove('hidden');
    alert('환영합니다. 게임에서 사용할 닉네임을 설정해주세요.');
    return;
  }

  showGameScreen(data.user);
  updateMailboxPendingDot(data.adminMailPendingCount);
  updateMarketplacePendingDot(data.marketplaceSoldPendingCount);
  showNotifications(data.notifications);
}

async function handleSetNicknameClick() {
  const nickname = document.getElementById('nicknameInput').value.trim();
  const user = getStoredUser();

  if (!nickname) {
    alert('닉네임을 입력해주세요.');
    return;
  }

  if (!user?._id) {
    handleLogoutClick();
    return;
  }

  try {
    const data = await postJson(`${API_URL}/api/set-nickname`, {
      userId: user._id,
      nickname
    });

    user.nickname = data.nickname;
    user.displayName = data.nickname;
    saveStoredUser(user);
    showGameScreen(user);
    alert('닉네임이 설정되었습니다.');
  } catch (err) {
    alert(err.message);
  }
}

function tryAutoLogin() {
  const adminSession = getStoredAdmin();
  if (adminSession?.token) {
    showAdminScreen();
    return;
  }

  const user = getStoredUser();
  const token = getUserToken();
  if (!user || !token) return;

  try {
    if (!user.nickname) throw new Error('nickname missing');
    showGameScreen(user);
  } catch {
    clearSessions();
  }
}

function handleLogoutClick() {
  loginRequestSerial += 1;
  userMutationInFlightCount = 0;
  latestRaidState = null;
  raidBarAnimationState = {
    bossHpRatio: null,
    participantHpRatios: {}
  };
  lastRenderedRaidBattleId = null;
  clearIntervals();
  closeDecisionModal();
  hideModal('patchNotesModal');
  hideModal('equipmentDismantleModal');
  hideModal('fragmentShopModal');
  hideModal('branchOfficeModal');
  hideModal('marketplaceModal');
  hideModal('marketplaceRegisterModal');
  hideModal('raidLobbyModal');
  hideModal('raidCountdownOverlay');
  stopBgm(true);
  clearSessions();
  hideAllScreens();

  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
}

function getEquippedTitleDetail(user) {
  return (user.titleDetails || []).find((title) => title.equipped) || null;
}

function getMainName(user) {
  const equippedTitle = getEquippedTitleDetail(user);
  const titlePrefix = equippedTitle ? `<${equippedTitle.name}>` : '';
  return getCompactDisplayName(`${titlePrefix}${user.nickname || user.username || '사원'}`, 24);
}

async function handleClickWork() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const btn = document.getElementById('clickWorkBtn');
  btn.disabled = true;
  btn.textContent = '서류 작업 중...';

  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/action/work`, { userId: user._id }));
    updateLocalUserState(data);
    if (data.workAntiCheat?.warning) {
      const statusEl = document.getElementById('newsTypingStatus');
      if (statusEl) statusEl.textContent = data.workAntiCheat.warning;
    }
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '서류 작업하기 (클릭 경험치 획득)';
  }
}

function setupNewsTypingInput() {
  const input = document.getElementById('newsTypingInput');
  const prompt = document.getElementById('newsTypingPrompt');
  if (input) {
    input.addEventListener('keydown', handleNewsTypingKeydown);
    input.addEventListener('paste', blockNewsTypingPaste);
    input.addEventListener('drop', blockNewsTypingPaste);
  }
  if (prompt) {
    prompt.addEventListener('copy', (event) => event.preventDefault());
    prompt.addEventListener('cut', (event) => event.preventDefault());
    prompt.addEventListener('contextmenu', (event) => event.preventDefault());
  }
}

function createClientSeededRandom(seedText = '') {
  let seed = 0;
  String(seedText).split('').forEach((char) => {
    seed = ((seed << 5) - seed + char.charCodeAt(0)) >>> 0;
  });
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function getNewsTypingDisplaySegments(prompt = currentNewsTypingPrompt) {
  if (Array.isArray(prompt?.displaySegments) && prompt.displaySegments.length) {
    return prompt.displaySegments;
  }
  if (prompt?.text) return [{ text: prompt.text, role: 'target' }];
  return [];
}

function layoutNewsTypingCanvasChars(ctx, segments, width, frame) {
  const seed = currentNewsTypingPrompt?.canvasSeed || currentNewsTypingPrompt?.id || 'news';
  const maxWidth = Math.max(220, width - 20);
  const lineHeight = 26;
  const chars = [];
  let x = 10;
  let y = 26;
  let charIndex = 0;

  segments.forEach((segment) => {
    const text = String(segment.text || '');
    for (const char of text) {
      const hidden = false;
      const drawChar = hidden ? '■' : char;
      const measure = ctx.measureText(drawChar === ' ' ? '  ' : drawChar);
      const charWidth = Math.max(5, measure.width + 1);
      if (x + charWidth > maxWidth && char !== ' ') {
        x = 10;
        y += lineHeight;
      }
      const random = createClientSeededRandom(`${seed}:${frame}:${charIndex}`);
      chars.push({
        char: drawChar,
        x,
        y,
        role: segment.role || 'target',
        style: segment.style || '',
        hidden,
        jitterX: (random() - 0.5) * 1.8,
        jitterY: (random() - 0.5) * 2.2,
        rotate: (random() - 0.5) * 0.08,
        width: charWidth
      });
      x += charWidth;
      charIndex += 1;
    }
  });

  return {
    chars,
    height: Math.max(64, y + lineHeight)
  };
}

function drawNewsTypingCanvas() {
  const promptEl = document.getElementById('newsTypingPrompt');
  const canvas = document.getElementById('newsTypingCanvas');
  if (!promptEl || !canvas || !currentNewsTypingPrompt) return;

  const segments = getNewsTypingDisplaySegments();
  const cssWidth = Math.max(260, promptEl.clientWidth - 24);
  const ratio = window.devicePixelRatio || 1;
  const fontSize = 16;
  const font = `700 ${fontSize}px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`;

  canvas.style.width = `${cssWidth}px`;
  let ctx = canvas.getContext('2d');
  ctx.font = font;
  const layout = layoutNewsTypingCanvasChars(ctx, segments, cssWidth, newsTypingCanvasFrame);

  canvas.width = Math.ceil(cssWidth * ratio);
  canvas.height = Math.ceil(layout.height * ratio);
  canvas.style.height = `${layout.height}px`;
  ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, cssWidth, layout.height);
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';

  const finalLayout = layoutNewsTypingCanvasChars(ctx, segments, cssWidth, newsTypingCanvasFrame);
  finalLayout.chars.forEach((entry) => {
    ctx.save();
    ctx.translate(entry.x + entry.jitterX, entry.y + entry.jitterY);
    ctx.rotate(entry.rotate);

    if (entry.hidden) {
      ctx.fillStyle = '#fff8cf';
      ctx.strokeStyle = '#b5a55b';
      ctx.lineWidth = 1;
      ctx.fillRect(-1, -16, Math.max(12, entry.width), 20);
      ctx.strokeRect(-1, -16, Math.max(12, entry.width), 20);
      ctx.fillStyle = '#8a7a1c';
    } else if (entry.role === 'decoy' && entry.style === 'red') {
      ctx.fillStyle = '#c62828';
    } else if (entry.role === 'decoy') {
      ctx.fillStyle = '#9a9a9a';
    } else {
      ctx.fillStyle = '#111';
    }

    ctx.fillText(entry.char, 0, 0);
    if (entry.role === 'decoy') {
      ctx.strokeStyle = entry.style === 'red' ? '#c62828' : '#8f8f8f';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(Math.max(8, entry.width), -7);
      ctx.stroke();
    }
    ctx.restore();
  });
}

function startNewsTypingCanvasMotion() {
  if (newsTypingCanvasTimer) clearInterval(newsTypingCanvasTimer);
  newsTypingCanvasTimer = setInterval(() => {
    newsTypingCanvasFrame += 1;
    drawNewsTypingCanvas();
  }, 2500);
}

function renderNewsTypingPrompt(prompt) {
  currentNewsTypingPrompt = prompt || null;
  const promptEl = document.getElementById('newsTypingPrompt');
  const statusEl = document.getElementById('newsTypingStatus');
  if (!promptEl) return;

  const segments = getNewsTypingDisplaySegments(currentNewsTypingPrompt);
  if (!currentNewsTypingPrompt?.id || !segments.length) {
    if (newsTypingCanvasTimer) clearInterval(newsTypingCanvasTimer);
    newsTypingCanvasTimer = null;
    promptEl.textContent = '뉴스 문장을 불러오지 못했습니다.';
    if (statusEl) statusEl.textContent = '잠시 후 다시 시도해주세요.';
    return;
  }

  newsTypingCanvasFrame = 0;
  promptEl.textContent = '';
  const instructionEl = document.createElement('div');
  instructionEl.className = 'news-typing-instruction';
  instructionEl.textContent = currentNewsTypingPrompt.instruction || '캔버스에 그려진 문장을 직접 입력해주세요. 빨간 글자와 취소선 글자는 제외합니다.';
  const canvas = document.createElement('canvas');
  canvas.id = 'newsTypingCanvas';
  canvas.className = 'news-typing-canvas';
  canvas.setAttribute('aria-label', '뉴스 타자 문장 캔버스');
  promptEl.append(instructionEl, canvas);
  promptEl.dataset.promptId = currentNewsTypingPrompt.id || '';
  drawNewsTypingCanvas();
  startNewsTypingCanvasMotion();
  if (statusEl && !statusEl.dataset.locked) {
    statusEl.textContent = `현재 문장 ${formatNumber(currentNewsTypingPrompt.unitCount || currentNewsTypingPrompt.wordCount || 0)}타 · Enter로 제출`;
  }
}

async function loadNewsTypingPrompt(afterId = '') {
  if (newsTypingLoading) return;
  newsTypingLoading = true;
  const statusEl = document.getElementById('newsTypingStatus');
  try {
    const query = afterId ? `?afterId=${encodeURIComponent(afterId)}` : '';
    const data = await getJson(`${API_URL}/api/news-typing/prompt${query}`);
    renderNewsTypingPrompt(data.prompt);
  } catch (err) {
    if (statusEl) statusEl.textContent = err.message || '뉴스 문장을 불러오지 못했습니다.';
  } finally {
    newsTypingLoading = false;
  }
}

function blockNewsTypingPaste(event) {
  event.preventDefault();
  const statusEl = document.getElementById('newsTypingStatus');
  if (statusEl) statusEl.textContent = '붙여넣기는 사용할 수 없습니다. 직접 입력해주세요.';
  const input = document.getElementById('newsTypingInput');
  if (input) input.focus();
}

async function handleNewsTypingKeydown(event) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  await handleNewsTypingSubmit();
}

async function handleNewsTypingSubmit() {
  if (newsTypingSubmitting) return;
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const input = document.getElementById('newsTypingInput');
  const statusEl = document.getElementById('newsTypingStatus');
  const answer = input?.value || '';
  if (!currentNewsTypingPrompt?.id) {
    if (statusEl) statusEl.textContent = '뉴스 문장을 먼저 불러오는 중입니다.';
    await loadNewsTypingPrompt();
    input?.focus();
    return;
  }
  if (!answer.trim()) {
    if (statusEl) statusEl.textContent = '문장을 입력한 뒤 Enter를 눌러주세요.';
    input?.focus();
    return;
  }

  newsTypingSubmitting = true;
  if (input) input.disabled = true;
  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/action/news-typing`, {
      userId: user._id,
      promptId: currentNewsTypingPrompt.id,
      answer
    }));
    updateLocalUserState(data);
    const result = data.newsTypingResult || {};
    if (statusEl) {
      const dropText = result.dropCount > 0 ? ` / 장비·주문서 ${formatNumber(result.dropCount)}개 획득` : '';
      const warningText = result.antiCheat?.warning ? ` / ${result.antiCheat.warning}` : '';
      statusEl.textContent = `${formatNumber(result.unitCount || result.wordCount || 0)}타 정산 완료: +${formatNumber(result.gainedExp || 0)} EXP${dropText}${warningText}`;
    }
    if (input) input.value = '';
    renderNewsTypingPrompt(result.nextPrompt);
  } catch (err) {
    if (statusEl) statusEl.textContent = err.message || '문장이 정확히 일치하지 않습니다.';
  } finally {
    newsTypingSubmitting = false;
    if (input) input.disabled = false;
    window.setTimeout(() => {
      const latestInput = document.getElementById('newsTypingInput');
      if (latestInput) latestInput.focus();
    }, 0);
  }
}

async function handleLupinClick() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const btn = document.getElementById('lupinBtn');
  btn.disabled = true;

  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/action/lupin`, { userId: user._id }));
    updateLocalUserState(data);
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
}

async function handleNapClick() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const btn = document.getElementById('napBtn');
  btn.disabled = true;

  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/action/nap`, { userId: user._id }));
    updateLocalUserState(data);
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
}

async function handleFieldWorkClick() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const btn = document.getElementById('fieldWorkBtn');
  btn.disabled = true;

  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/action/field-work`, { userId: user._id }));
    updateLocalUserState(data);
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
}

async function handleSideJobClick() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const btn = document.getElementById('sideJobBtn');
  if (btn) btn.disabled = true;

  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/action/side-job`, { userId: user._id }));
    if (data.sideJobResult) {
      const result = data.sideJobResult;
      if (data.user?.gameState) {
        data.user.gameState.money = Number(result.moneyAfter ?? data.user.gameState.money);
        data.user.gameState.stress = Number(result.stressAfter ?? data.user.gameState.stress);
        data.user.gameState.stamina = Number(result.staminaAfter ?? data.user.gameState.stamina);
      }
      updateLocalUserState(data, { force: true });
      alert(
        `부업 완료\n+${formatNumber(result.gainedMoney || 0)}원 획득\n` +
        `잔고: ${formatNumber(result.moneyBefore || 0)}원 -> ${formatNumber(result.moneyAfter || 0)}원\n` +
        `스트레스 +${formatNumber(result.stressGain || 0, 2)} / 행동력 -${formatNumber(result.staminaCost || 1, 1)}`
      );
    } else {
      updateLocalUserState(data, { force: true });
    }
  } catch (err) {
    alert(err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleWorkOptimizationSkillClick() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const btn = document.getElementById('workOptimizationSkillBtn');
  if (btn) btn.disabled = true;

  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/skill/work-optimization`, { userId: user._id }));
    updateLocalUserState(data, { force: true });
    if (data.skillResult?.message) {
      alert(data.skillResult.message);
    }
  } catch (err) {
    alert(err.message);
  } finally {
    const latestUser = getStoredUser();
    updateSkillTab(latestUser);
  }
}

async function handleAdventureClick() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const btn = document.getElementById('adventureBtn');
  if (btn) btn.disabled = true;

  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/action/adventure`, { userId: user._id }));
    updateLocalUserState(data);
    await processAdventureResult(data.adventureResult);
  } catch (err) {
    alert(err.message);
  } finally {
    if (btn) btn.disabled = false;
    const latestUser = getStoredUser();
    if (latestUser) {
      updateShoutStatus(latestUser);
      updateSpecialActionButtons(latestUser);
    }
  }
}

async function handleShoutClick() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const input = document.getElementById('shoutInput');
  const btn = document.getElementById('shoutBtn');
  const message = input?.value.trim() || '';

  if (!message) {
    alert('외칠 내용을 입력해주세요.');
    return;
  }

  if (btn) btn.disabled = true;

  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/action/shout`, {
      userId: user._id,
      message
    }));
    updateLocalUserState(data);
    if (input) input.value = '';
  } catch (err) {
    alert(err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleStockInvest() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  if (user.pendingStockInvestment?.amount > 0) {
    alert('이미 오늘 주식 투자를 완료했습니다. 결과 확인 후 다시 투자할 수 있습니다.');
    return;
  }

  const input = document.getElementById('stockAmount');
  const rawValue = input.value.replaceAll(',', '').trim();
  const amount = Math.floor(Number(rawValue));

  if (!Number.isFinite(amount) || amount <= 0) {
    alert('투자 금액을 숫자로 입력해주세요.');
    return;
  }

  if (!confirm('정말 투자하시겠습니까?')) return;

  const btn = document.getElementById('stockInvestBtn');
  btn.disabled = true;

  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/action/stock`, {
      userId: user._id,
      amount
    }));
    updateLocalUserState(data);
  } catch (err) {
    alert(err.message);
    btn.disabled = false;
  }
}

function getRequestedQuantity(inputId) {
  const input = document.getElementById(inputId);
  const value = Math.floor(Number(input?.value || 1));
  rememberQuantityInputValue(inputId, value);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

const quantityInputState = {};

function rememberQuantityInputValue(inputId, rawValue) {
  const normalizedId = String(inputId || '');
  if (!normalizedId) return;
  const value = Math.floor(Number(rawValue));
  if (Number.isFinite(value) && value > 0) {
    quantityInputState[normalizedId] = value;
  }
}

function getRememberedQuantityInputValue(inputId, fallback = 1, maxValue = null) {
  const normalizedId = String(inputId || '');
  let value = Math.floor(Number(quantityInputState[normalizedId] ?? fallback));
  if (!Number.isFinite(value) || value <= 0) value = 1;
  if (Number.isFinite(maxValue) && maxValue > 0) {
    value = Math.min(value, Math.floor(maxValue));
  }
  return Math.max(1, value);
}

function hasFocusedQuantityInput() {
  const activeElement = document.activeElement;
  return Boolean(activeElement && activeElement.classList?.contains('qty-input'));
}


async function loadCompanyStockMarket() {
  const user = getStoredUser();
  if (!user?._id) return null;
  const data = await getJson(API_URL + '/api/company-stock-market?userId=' + encodeURIComponent(user._id));
  if (data.stockMarket) {
    mergeCompanyStockMarketState(data.stockMarket);
  }
  return companyStockMarketState;
}

async function openCompanyStockMarketModal() {
  showModal('stockMarketModal');
  const status = document.getElementById('stockMarketStatus');
  if (status) status.textContent = '회사 주식 시장을 불러오는 중입니다.';
  try {
    await loadCompanyStockMarket();
    renderCompanyStockMarket();
  } catch (err) {
    if (status) status.textContent = err.message || '주식 시장을 불러오지 못했습니다.';
  }
}

function normalizeCompanyStockRumorClient(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') return { text: entry };
  const expiresAtMs = entry.expiresAt ? Date.parse(entry.expiresAt) : 0;
  if (expiresAtMs && expiresAtMs <= Date.now()) return null;
  return { text: entry.text || '', createdAt: entry.createdAt || null, expiresAt: entry.expiresAt || null };
}

function getFreshCompanyStockRumorsFromMarket(stockMarket) {
  const result = {};
  (stockMarket?.stocks || []).forEach((stock) => {
    const rumor = normalizeCompanyStockRumorClient(stock.rumor);
    if (rumor?.text) result[stock.companyId] = rumor;
  });
  return result;
}

function getCompanyStockRumorText(companyId) {
  const rumor = normalizeCompanyStockRumorClient(companyStockMarketState.rumors?.[companyId]);
  return rumor?.text || '';
}

function getCompanyStockRumorRemainingText(companyId) {
  const rumor = normalizeCompanyStockRumorClient(companyStockMarketState.rumors?.[companyId]);
  if (!rumor?.expiresAt) return '';
  const remainingMs = Date.parse(rumor.expiresAt) - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return '';
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  return '다음 찌라시까지 ' + minutes + '분 ' + String(seconds).padStart(2, '0') + '초';
}

function mergeCompanyStockMarketState(stockMarket) {
  const previousRumors = {};
  Object.entries(companyStockMarketState.rumors || {}).forEach(([companyId, rumor]) => {
    const normalized = normalizeCompanyStockRumorClient(rumor);
    if (normalized?.text) previousRumors[companyId] = normalized;
  });
  companyStockMarketState = {
    ...companyStockMarketState,
    ...stockMarket,
    rumors: {
      ...previousRumors,
      ...getFreshCompanyStockRumorsFromMarket(stockMarket)
    }
  };
}

function closeCompanyStockMarketModal() {
  hideModal('stockMarketModal');
}

function buildCompanyStockChart(history = []) {
  const points = Array.isArray(history) ? history.slice(-72) : [];
  if (points.length < 2) return '<div class="company-stock-chart-empty">자료 부족</div>';
  const prices = points.map((entry) => Number(entry.price || 0));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = Math.max(1, max - min);
  const coords = points.map((entry, index) => {
    const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * 120;
    const y = 36 - ((Number(entry.price || 0) - min) / range) * 32;
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  return '<svg class="company-stock-chart" viewBox="0 0 120 40" preserveAspectRatio="none"><polyline points="' + coords + '" fill="none" stroke="#107c41" stroke-width="2"/><line x1="0" y1="36" x2="120" y2="36" stroke="#d0d7de" stroke-width="1"/></svg>';
}

function renderCompanyStockMarket() {
  const tbody = document.getElementById('stockMarketList');
  const summary = document.getElementById('stockMarketSummary');
  const status = document.getElementById('stockMarketStatus');
  if (!tbody) return;
  const stocks = companyStockMarketState.stocks || [];
  const holdings = new Map((companyStockMarketState.holdings || []).map((entry) => [entry.companyId, entry]));
  if (summary) {
    summary.textContent = '보유 주식 평가액 ' + formatNumber(companyStockMarketState.totalMarketValue || 0) + '원 / 매도 수수료 ' + Math.round(Number(companyStockMarketState.sellFeeRate || 0.03) * 100) + '%';
  }
  if (status) {
    const next = companyStockMarketState.nextUpdateAt ? new Date(companyStockMarketState.nextUpdateAt) : null;
    status.textContent = next && Number.isFinite(next.getTime()) ? '다음 주가 변동 예정: ' + next.toLocaleTimeString('ko-KR') : '주가는 10분마다 변동됩니다.';
  }
  tbody.innerHTML = stocks.length ? '' : '<tr><td colspan="8">상장된 회사가 아직 없습니다. 회사 운영에서 지사를 설립하면 자동 상장됩니다.</td></tr>';
  stocks.forEach((stock, index) => {
    const holding = holdings.get(stock.companyId) || {};
    const buyInputId = 'stock-buy-' + index;
    const sellInputId = 'stock-sell-' + index;
    const currentPrice = Number(stock.price || 0);
    const averagePrice = Number(holding.averagePrice || 0);
    const marketValue = Number(holding.marketValue || 0);
    const profitRate = Number.isFinite(Number(holding.profitRate)) ? Number(holding.profitRate) : (averagePrice > 0 ? ((currentPrice - averagePrice) / averagePrice) * 100 : 0);
    const change = Number(stock.lastChangePct || 0);
    const changeClass = change >= 0 ? 'stock-change-up' : 'stock-change-down';
    const rumor = getCompanyStockRumorText(stock.companyId);
    const rumorRemaining = getCompanyStockRumorRemainingText(stock.companyId);
    const row = document.createElement('tr');
    row.innerHTML =
      '<td>' + escapeHtml(stock.companyName || '이름 없는 회사') + '<div class="muted-text">가치 ' + formatNumber(stock.companyValue || 0) + '원</div></td>' +
      '<td>' + formatNumber(currentPrice) + '원</td>' +
      '<td class="' + changeClass + '">' + (change >= 0 ? '+' : '') + formatNumber(change, 2) + '%</td>' +
      '<td>' + buildCompanyStockChart(stock.history) + '</td>' +
      '<td>' + formatNumber(holding.shares || 0) + '주<div class="muted-text">평가 ' + formatNumber(marketValue) + '원</div><div class="muted-text">평단 ' + formatNumber(averagePrice, 2) + '원</div><div class="muted-text ' + (profitRate >= 0 ? 'stock-change-up' : 'stock-change-down') + '">수익률 ' + (profitRate >= 0 ? '+' : '') + formatNumber(profitRate, 2) + '%</div></td>' +
      '<td><div class="stock-trade-row"><input id="' + buyInputId + '" class="stock-share-input" type="number" min="1" step="1" value="1"><button class="mini-btn" onclick="handleCompanyStockBuy(\'' + escapeHtml(stock.companyId) + '\', \'' + buyInputId + '\')">매수</button></div></td>' +
      '<td><div class="stock-trade-row"><input id="' + sellInputId + '" class="stock-share-input" type="number" min="1" max="' + Math.max(1, Number(holding.shares || 0)) + '" step="1" value="1"><button class="mini-btn" onclick="handleCompanyStockSell(\'' + escapeHtml(stock.companyId) + '\', \'' + sellInputId + '\')" ' + (Number(holding.shares || 0) <= 0 ? 'disabled' : '') + '>매도</button></div></td>' +
      '<td><button class="mini-btn" onclick="handleCompanyStockRumor(\'' + escapeHtml(stock.companyId) + '\')">찌라시</button>' + (rumor ? '<div class="company-stock-rumor">' + escapeHtml(rumor) + (rumorRemaining ? '<span class="company-stock-rumor-meta">' + escapeHtml(rumorRemaining) + '</span>' : '') + '</div>' : '') + '</td>';
    tbody.appendChild(row);
  });
}

async function handleCompanyStockBuy(companyId, inputId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  const input = document.getElementById(inputId);
  const shares = Math.max(1, Math.floor(Number(input?.value || 1)));
  try {
    const data = await postJson(API_URL + '/api/company-stock-market/buy', { userId: user._id, companyId, shares });
    if (data.stockMarket) mergeCompanyStockMarketState(data.stockMarket);
    updateLocalUserState(data, { force: true });
    renderCompanyStockMarket();
  } catch (err) {
    alert(err.message || '주식을 구매하지 못했습니다.');
  }
}

async function handleCompanyStockSell(companyId, inputId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  const input = document.getElementById(inputId);
  const shares = Math.max(1, Math.floor(Number(input?.value || 1)));
  try {
    const data = await postJson(API_URL + '/api/company-stock-market/sell', { userId: user._id, companyId, shares });
    if (data.stockMarket) mergeCompanyStockMarketState(data.stockMarket);
    updateLocalUserState(data, { force: true });
    renderCompanyStockMarket();
    if (data.stockTrade) alert('매도 정산: ' + formatNumber(data.stockTrade.net) + '원 (수수료 ' + formatNumber(data.stockTrade.fee) + '원)');
  } catch (err) {
    alert(err.message || '주식을 판매하지 못했습니다.');
  }
}

async function handleCompanyStockRumor(companyId) {
  try {
    const data = await postJson(API_URL + '/api/company-stock-market/rumor', { companyId });
    companyStockMarketState.rumors = companyStockMarketState.rumors || {};
    companyStockMarketState.rumors[companyId] = { text: data.rumor || '별다른 소문은 없습니다.', createdAt: data.createdAt || null, expiresAt: data.expiresAt || null };
    renderCompanyStockMarket();
  } catch (err) {
    alert(err.message || '찌라시를 불러오지 못했습니다.');
  }
}


function updateStockTournamentEntryButton(user) {
  const button = document.getElementById('stockTournamentEntryBtn');
  if (!button) return;
  const tournament = user?.stockTournament || {};
  const registered = Boolean(tournament.isRegistered);
  if (!registered) {
    button.classList.add('hidden');
    return;
  }
  button.classList.remove('hidden');
  if (tournament.phase === 'before') {
    button.textContent = '주식 대회 준비중';
    button.disabled = true;
  } else if (tournament.phase === 'ended') {
    button.textContent = '주식 대회 결과';
    button.disabled = false;
  } else {
    button.textContent = '주식 대회 참가';
    button.disabled = false;
  }
}

function mergeStockTournamentState(stockTournament) {
  if (!stockTournament) return;
  const market = stockTournament.stockMarket || {};
  stockTournamentState = {
    ...stockTournamentState,
    ...stockTournament,
    stocks: market.stocks || stockTournament.stocks || [],
    sellFeeRate: market.sellFeeRate ?? stockTournament.sellFeeRate ?? 0.03,
    nextUpdateAt: market.nextUpdateAt || stockTournament.nextUpdateAt || null
  };
}

async function loadStockTournament() {
  const user = getStoredUser();
  if (!user?._id) return null;
  const data = await getJson(API_URL + '/api/stock-tournament?userId=' + encodeURIComponent(user._id));
  if (data.stockTournament) mergeStockTournamentState(data.stockTournament);
  return stockTournamentState;
}

async function openEventModal() {
  showModal('eventModal');
  const status = document.getElementById('stockTournamentEventStatus');
  if (status) status.textContent = '대회 정보를 불러오는 중입니다.';
  try {
    await loadStockTournament();
    renderStockTournamentEventPanel();
  } catch (err) {
    if (status) status.textContent = err.message || '대회 정보를 불러오지 못했습니다.';
  }
}

function closeEventModal() {
  hideModal('eventModal');
}

function getTournamentDateText(value) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function renderStockTournamentEventPanel() {
  const status = document.getElementById('stockTournamentEventStatus');
  const registerBtn = document.getElementById('stockTournamentRegisterBtn');
  const watchBtn = document.getElementById('stockTournamentWatchBtn');
  if (status) {
    const start = getTournamentDateText(stockTournamentState.startAt);
    const end = getTournamentDateText(stockTournamentState.endAt);
    const registeredText = stockTournamentState.isRegistered ? '참가 신청 완료' : '미참가';
    status.textContent = `${stockTournamentState.phaseLabel || '대회 상태 확인중'} / ${registeredText} / 시작 ${start} / 종료 ${end}`;
  }
  if (registerBtn) {
    registerBtn.disabled = !stockTournamentState.canRegister;
    registerBtn.textContent = stockTournamentState.isRegistered ? '참가 신청 완료' : '참여한다';
  }
  if (watchBtn) {
    watchBtn.textContent = stockTournamentState.phase === 'before' ? '대회장 미리보기' : '대회장 보기';
  }
}

async function handleStockTournamentRegister() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  try {
    const data = await postJson(API_URL + '/api/stock-tournament/register', { userId: user._id });
    if (data.stockTournament) mergeStockTournamentState(data.stockTournament);
    updateLocalUserState(data, { force: true });
    renderStockTournamentEventPanel();
    alert('주식투자 대회 참가 신청이 완료되었습니다.');
  } catch (err) {
    alert(err.message || '참가 신청에 실패했습니다.');
  }
}

async function openStockTournamentModal() {
  showModal('stockTournamentModal');
  const status = document.getElementById('stockTournamentStatus');
  if (status) status.textContent = '대회 정보를 불러오는 중입니다.';
  try {
    await loadStockTournament();
    renderStockTournament();
  } catch (err) {
    if (status) status.textContent = err.message || '대회 정보를 불러오지 못했습니다.';
  }
}

function closeStockTournamentModal() {
  hideModal('stockTournamentModal');
}

function getStockTournamentAdvancedInfo(companyId) {
  const infos = Array.isArray(stockTournamentState.advancedInfos) ? stockTournamentState.advancedInfos : [];
  const now = Date.now();
  return [...infos].reverse().find((entry) => entry.companyId === companyId && (!entry.expiresAt || Date.parse(entry.expiresAt) > now));
}

function renderStockTournamentLeaderboard() {
  const container = document.getElementById('stockTournamentLeaderboard');
  if (!container) return;
  const leaderboard = stockTournamentState.leaderboard || [];
  if (!leaderboard.length) {
    container.innerHTML = '<p class="menu-note">아직 참가자가 없습니다.</p>';
    return;
  }
  container.innerHTML = leaderboard.slice(0, 30).map((entry) => (
    '<div class="stock-tournament-rank-row">' +
      '<strong>' + formatNumber(entry.rank) + '위</strong>' +
      '<span>' + compactDisplayHtml(entry.nickname || '참가자', 14) + '</span>' +
      '<span>' + formatNumber(entry.totalAssets || 0) + '원</span>' +
      '<span class="' + (Number(entry.returnPct || 0) >= 0 ? 'stock-change-up' : 'stock-change-down') + '">' + (Number(entry.returnPct || 0) >= 0 ? '+' : '') + formatNumber(entry.returnPct || 0, 2) + '%</span>' +
    '</div>'
  )).join('');
}

function renderStockTournament() {
  const tbody = document.getElementById('stockTournamentList');
  const summary = document.getElementById('stockTournamentSummary');
  const status = document.getElementById('stockTournamentStatus');
  if (!tbody) return;
  const stocks = stockTournamentState.stocks || [];
  const holdings = new Map((stockTournamentState.holdings || []).map((entry) => [entry.companyId, entry]));
  const phaseText = stockTournamentState.phaseLabel || '대회 상태 확인중';
  if (summary) {
    if (stockTournamentState.isRegistered) {
      summary.textContent = `가상 현금 ${formatNumber(stockTournamentState.cash || 0)}원 / 총 재산 ${formatNumber(stockTournamentState.totalAssets || 0)}원 / 수익률 ${Number(stockTournamentState.returnPct || 0) >= 0 ? '+' : ''}${formatNumber(stockTournamentState.returnPct || 0, 2)}% / 고급 정보 ${formatNumber(stockTournamentState.advancedInfoRemaining || 0)}회 남음`;
    } else {
      summary.textContent = '미참가자는 거래 없이 순위와 종목만 구경할 수 있습니다.';
    }
  }
  if (status) {
    const next = stockTournamentState.nextUpdateAt ? new Date(stockTournamentState.nextUpdateAt) : null;
    const timeText = next && Number.isFinite(next.getTime()) ? ' / 다음 가격 변동 ' + next.toLocaleTimeString('ko-KR') : '';
    status.textContent = `${phaseText}${timeText}`;
  }
  tbody.innerHTML = stocks.length ? '' : '<tr><td colspan="8">상장된 회사가 아직 없습니다.</td></tr>';
  stocks.forEach((stock, index) => {
    const holding = holdings.get(stock.companyId) || {};
    const buyInputId = 'tournament-buy-' + index;
    const sellInputId = 'tournament-sell-' + index;
    const currentPrice = Number(stock.price || 0);
    const averagePrice = Number(holding.averagePrice || 0);
    const marketValue = Number(holding.marketValue || 0);
    const profitRate = Number.isFinite(Number(holding.profitRate)) ? Number(holding.profitRate) : (averagePrice > 0 ? ((currentPrice - averagePrice) / averagePrice) * 100 : 0);
    const change = Number(stock.lastChangePct || 0);
    const changeClass = change >= 0 ? 'stock-change-up' : 'stock-change-down';
    const info = getStockTournamentAdvancedInfo(stock.companyId);
    const tradeDisabled = !stockTournamentState.canTrade;
    const infoDisabled = tradeDisabled || !stockTournamentState.isRegistered || Number(stockTournamentState.advancedInfoRemaining || 0) <= 0;
    const row = document.createElement('tr');
    row.innerHTML =
      '<td>' + escapeHtml(stock.companyName || '이름 없는 회사') + '<div class="muted-text">가치 ' + formatNumber(stock.companyValue || 0) + '원</div></td>' +
      '<td>' + formatNumber(currentPrice) + '원</td>' +
      '<td class="' + changeClass + '">' + (change >= 0 ? '+' : '') + formatNumber(change, 2) + '%</td>' +
      '<td>' + buildCompanyStockChart(stock.history) + '</td>' +
      '<td>' + formatNumber(holding.shares || 0) + '주<div class="muted-text">평가 ' + formatNumber(marketValue) + '원</div><div class="muted-text">평단 ' + formatNumber(averagePrice, 2) + '원</div><div class="muted-text ' + (profitRate >= 0 ? 'stock-change-up' : 'stock-change-down') + '">수익률 ' + (profitRate >= 0 ? '+' : '') + formatNumber(profitRate, 2) + '%</div></td>' +
      '<td><div class="stock-trade-row"><input id="' + buyInputId + '" class="stock-share-input" type="number" min="1" step="1" value="1" ' + (tradeDisabled ? 'disabled' : '') + '><button class="mini-btn" onclick="handleStockTournamentBuy(\'' + escapeHtml(stock.companyId) + '\', \'' + buyInputId + '\')" ' + (tradeDisabled ? 'disabled' : '') + '>매수</button></div></td>' +
      '<td><div class="stock-trade-row"><input id="' + sellInputId + '" class="stock-share-input" type="number" min="1" max="' + Math.max(1, Number(holding.shares || 0)) + '" step="1" value="1" ' + (tradeDisabled ? 'disabled' : '') + '><button class="mini-btn" onclick="handleStockTournamentSell(\'' + escapeHtml(stock.companyId) + '\', \'' + sellInputId + '\')" ' + (tradeDisabled || Number(holding.shares || 0) <= 0 ? 'disabled' : '') + '>매도</button></div></td>' +
      '<td><button class="mini-btn" onclick="handleStockTournamentAdvancedInfo(\'' + escapeHtml(stock.companyId) + '\')" ' + (infoDisabled ? 'disabled' : '') + '>고급 정보</button>' + (info ? '<div class="company-stock-rumor">' + escapeHtml(info.text || '') + '</div>' : '') + '</td>';
    tbody.appendChild(row);
  });
  renderStockTournamentLeaderboard();
}

async function handleStockTournamentBuy(companyId, inputId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  const input = document.getElementById(inputId);
  const shares = Math.max(1, Math.floor(Number(input?.value || 1)));
  try {
    const data = await postJson(API_URL + '/api/stock-tournament/buy', { userId: user._id, companyId, shares });
    if (data.stockTournament) mergeStockTournamentState(data.stockTournament);
    updateLocalUserState(data, { force: true });
    renderStockTournament();
  } catch (err) {
    alert(err.message || '대회 주식을 매수하지 못했습니다.');
  }
}

async function handleStockTournamentSell(companyId, inputId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  const input = document.getElementById(inputId);
  const shares = Math.max(1, Math.floor(Number(input?.value || 1)));
  try {
    const data = await postJson(API_URL + '/api/stock-tournament/sell', { userId: user._id, companyId, shares });
    if (data.stockTournament) mergeStockTournamentState(data.stockTournament);
    updateLocalUserState(data, { force: true });
    renderStockTournament();
    if (data.stockTournamentTrade) alert('대회 매도 정산: ' + formatNumber(data.stockTournamentTrade.net) + '원 (수수료 ' + formatNumber(data.stockTournamentTrade.fee) + '원)');
  } catch (err) {
    alert(err.message || '대회 주식을 매도하지 못했습니다.');
  }
}

async function handleStockTournamentAdvancedInfo(companyId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  try {
    const data = await postJson(API_URL + '/api/stock-tournament/advanced-info', { userId: user._id, companyId });
    if (data.stockTournament) mergeStockTournamentState(data.stockTournament);
    updateLocalUserState(data, { force: true });
    renderStockTournament();
    if (data.advancedInfo?.text) alert(data.advancedInfo.text);
  } catch (err) {
    alert(err.message || '고급 정보를 확인하지 못했습니다.');
  }
}

function getMaxUsableItemQuantity(user, itemId, ownedQuantity = null) {
  const aggregatedOwned = getInventoryQuantityFromUser(user, itemId);
  const parsedOwned = Math.floor(Number(ownedQuantity));
  const owned = Math.max(
    0,
    Number.isFinite(parsedOwned) && parsedOwned > 0
      ? Math.max(aggregatedOwned, parsedOwned)
      : aggregatedOwned
  );
  if (itemId === 'excavation_repair_coupon') {
    return user?.branchOffice?.excavationBrokenRemainingMs > 0 ? Math.min(1, owned) : 0;
  }

  if (itemId === 'infinite_overtime_ticket') {
    const hasOvertimeState = latestInfiniteOvertimeState && typeof latestInfiniteOvertimeState === 'object';
    const remainingMs = Number(latestInfiniteOvertimeState?.cooldownRemainingMs || 0);
    const active = Boolean(latestInfiniteOvertimeState?.active || user?.infiniteOvertime?.active);
    if (active || (hasOvertimeState && remainingMs <= 0)) return 0;
    return Math.min(1, Math.max(0, Math.floor(Number(owned || 0))));
  }
  if (itemId !== 'bacchus') {
    return Math.max(0, Math.floor(Number(owned || 0)));
  }

  const stamina = Number(user?.gameState?.stamina || 0);
  const maxStamina = Math.max(
    Number(user?.gameState?.maxStamina || 0),
    Number(user?.gameState?.baseMaxStamina || 0) + Number(user?.itemStats?.maxStaminaBonus || 0)
  );
  const recoverable = Math.max(0, Math.floor(maxStamina - stamina));
  return Math.max(0, Math.min(Math.floor(Number(owned || 0)), recoverable));
}

function getCardVariantKey(cardId, enhancementLevel = 0) {
  return `${cardId}::${Number(enhancementLevel || 0)}`;
}

function parseCardVariantKey(key) {
  const [cardId, levelText] = String(key || '').split('::');
  return {
    cardId,
    enhancementLevel: Math.max(0, Math.min(5, Number(levelText || 0) || 0))
  };
}

function getCardVariantByKey(user, key) {
  return (user.cardVariantDetails || []).find((card) => getCardVariantKey(card.cardId, card.enhancementLevel) === key) || null;
}

function isFusionModalOpen() {
  return !document.getElementById('fusionModal')?.classList.contains('hidden');
}

function isEnhanceModalOpen() {
  return !document.getElementById('enhanceModal')?.classList.contains('hidden');
}

function getFusionProbabilityText(grade = null) {
  if (grade === 'C') return 'C 5장 합성: B 30% / 랜덤 C 70%';
  if (grade === 'B') return 'B 5장 합성: A 20% / 랜덤 B 80%';
  if (grade === 'A') return 'A 5장 합성: S 10% / 랜덤 A 90%';
  return 'C 5장: B 30% / C 70%, B 5장: A 20% / B 80%, A 5장: S 10% / A 90%';
}

function getFusionSelectionCountMap() {
  const counts = new Map();
  cardFusionSelection.forEach((cardKey) => {
    counts.set(cardKey, (counts.get(cardKey) || 0) + 1);
  });
  return counts;
}

function getFusionOwnedCards(user) {
  return (user.cardVariantDetails || [])
    .filter((card) => Number(card.quantity || 0) > 0 && Number(card.enhancementLevel || 0) < 5)
    .map((card) => ({
      ...card,
      id: getCardVariantKey(card.cardId, card.enhancementLevel || 0)
    }));
}

function getFusionCardInfo(user, cardKey) {
  const normalizedKey = String(cardKey || '').includes('::') ? cardKey : getCardVariantKey(cardKey, 0);
  const parsed = parseCardVariantKey(normalizedKey);
  return getFusionOwnedCards(user).find((card) => card.id === normalizedKey)
    || (CARD_DATA[parsed.cardId] ? {
      ...CARD_DATA[parsed.cardId],
      id: normalizedKey,
      cardId: parsed.cardId,
      enhancementLevel: parsed.enhancementLevel,
      name: parsed.enhancementLevel > 0 ? `${CARD_DATA[parsed.cardId].name} +${parsed.enhancementLevel}` : CARD_DATA[parsed.cardId].name,
      baseName: CARD_DATA[parsed.cardId].name
    } : null);
}

function getLockedFusionGrade(user) {
  if (!cardFusionSelection.length) return null;
  return getFusionCardInfo(user, cardFusionSelection[0])?.grade || null;
}

function normalizeCardFusionSelection(user) {
  const ownedCards = getFusionOwnedCards(user);
  const ownedCounts = new Map(ownedCards.map((card) => [card.id, Number(card.quantity || 0)]));
  const cardInfoMap = new Map(ownedCards.map((card) => [card.id, card]));
  const normalized = [];
  const usedCounts = new Map();
  let lockedGrade = null;

  for (const cardId of cardFusionSelection) {
    const cardInfo = cardInfoMap.get(cardId) || getFusionCardInfo(user, cardId);
    if (!cardInfo || cardInfo.grade === 'S') continue;

    if (lockedGrade && lockedGrade !== cardInfo.grade) continue;
    const used = usedCounts.get(cardId) || 0;
    const owned = ownedCounts.get(cardId) || 0;
    if (used >= owned) continue;

    lockedGrade ||= cardInfo.grade;
    normalized.push(cardId);
    usedCounts.set(cardId, used + 1);
    if (normalized.length >= 5) break;
  }

  cardFusionSelection = normalized;
}

function renderCardFusionModal(user) {
  const slotList = document.getElementById('fusionSlotList');
  const sourceList = document.getElementById('fusionSourceList');
  const probabilityText = document.getElementById('fusionProbabilityText');
  const bulkControls = document.getElementById('fusionBulkControls');
  const confirmButton = document.getElementById('confirmFusionBtn');
  if (!slotList || !sourceList || !probabilityText || !confirmButton) return;

  normalizeCardFusionSelection(user);
  const selectedCounts = getFusionSelectionCountMap();
  const lockedGrade = getLockedFusionGrade(user);
  const ownedCards = getFusionOwnedCards(user)
    .sort((a, b) => {
      const gradeOrder = { S: 0, A: 1, B: 2, C: 3 };
      return (gradeOrder[a.grade] ?? 9) - (gradeOrder[b.grade] ?? 9)
        || String(a.baseName || a.name || '').localeCompare(String(b.baseName || b.name || ''), 'ko')
        || Number(a.enhancementLevel || 0) - Number(b.enhancementLevel || 0);
    });

  probabilityText.textContent = getFusionProbabilityText(lockedGrade);
  confirmButton.disabled = cardFusionSelection.length !== 5;
  if (bulkControls) {
    bulkControls.innerHTML = `
      <div class="menu-note">등급별 자동 등록</div>
      <button class="mini-btn" onclick="handleCardFusionAutoFill('C')" ${lockedGrade && lockedGrade !== 'C' ? 'disabled' : ''}>C급 일괄 등록</button>
      <button class="mini-btn" onclick="handleCardFusionAutoFill('B')" ${lockedGrade && lockedGrade !== 'B' ? 'disabled' : ''}>B급 일괄 등록</button>
      <button class="mini-btn" onclick="handleCardFusionAutoFill('A')" ${lockedGrade && lockedGrade !== 'A' ? 'disabled' : ''}>A급 일괄 등록</button>
    `;
  }

  slotList.innerHTML = '';
  for (let index = 0; index < 5; index += 1) {
    const cardId = cardFusionSelection[index];
    if (!cardId) {
      slotList.insertAdjacentHTML(
        'beforeend',
        `<div class="fusion-slot empty"><strong>${index + 1}번 슬롯</strong><div class="fusion-card-meta">비어 있습니다.</div></div>`
      );
      continue;
    }

    const card = ownedCards.find((entry) => entry.id === cardId) || getFusionCardInfo(user, cardId);
    slotList.insertAdjacentHTML(
      'beforeend',
      `
        <div class="fusion-slot filled" onclick="handleCardFusionSlotRemove(${index})">
          <div class="fusion-card-head">
            <span class="fusion-card-name">${escapeHtml(card.name)}</span>
            <span class="grade-badge" style="background:${escapeHtml(card.color || '#666666')}">${escapeHtml(card.grade)}</span>
          </div>
          <div class="fusion-card-meta">${escapeHtml(card.skillName || '')}<br>${escapeHtml(card.skillDesc || '')}</div>
        </div>
      `
    );
  }

  sourceList.innerHTML = '';
  const sourceCards = ownedCards.filter((card) => card.grade !== 'S');
  if (!sourceCards.length) {
    sourceList.innerHTML = '<div class="fusion-slot empty">합성 가능한 카드가 없습니다.</div>';
    return;
  }

  sourceCards.forEach((card) => {
    const alreadySelected = selectedCounts.get(card.id) || 0;
    const available = Math.max(0, Number(card.quantity || 0) - alreadySelected);
    const disabled = available <= 0 || (lockedGrade && lockedGrade !== card.grade);
    const qtyInputId = `fusion-qty-${card.id}`;
    const levelText = Number(card.enhancementLevel || 0) > 0 ? ` +${Number(card.enhancementLevel || 0)}` : '';
    const actionHtml = available <= 0
      ? '<span class="muted-text">등록 완료</span>'
      : available === 1
        ? `<button class="mini-btn" ${disabled ? 'disabled' : ''} onclick="handleCardFusionAdd('${card.id}')">등록</button>`
        : `<input id="${qtyInputId}" class="qty-input" type="number" min="1" max="${available}" step="1" value="${getRememberedQuantityInputValue(qtyInputId, 1, available)}" oninput="rememberQuantityInputValue('${qtyInputId}', this.value)" ${disabled ? 'disabled' : ''}><button class="mini-btn" ${disabled ? 'disabled' : ''} onclick="handleCardFusionAdd('${card.id}', '${qtyInputId}')">등록</button>`;

    sourceList.insertAdjacentHTML(
      'beforeend',
      `
        <div class="fusion-source-card ${getCardVisualClass(card)} ${disabled ? 'disabled' : ''}" style="${escapeAttr(getCardVisualStyle(card))}">
          <div class="fusion-card-head">
            <span class="fusion-card-name">${escapeHtml(card.baseName || card.name)}${levelText}</span>
            <span class="grade-badge" style="background:${escapeHtml(card.color)}">${escapeHtml(card.grade)}</span>
          </div>
          <div class="fusion-card-meta">
            보유 ${formatNumber(card.quantity)}장 / 등록 가능 ${formatNumber(available)}장<br>
            ${escapeHtml(card.skillName)}<br>
            ${escapeHtml(card.skillDesc)}
          </div>
          <div class="fusion-card-actions">
            ${actionHtml}
          </div>
        </div>
      `
    );
  });
}

function openCardFusionModal() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  cardFusionSelection = [];
  showModal('fusionModal');
  renderCardFusionModal(user);
}

function closeCardFusionModal() {
  cardFusionSelection = [];
  hideModal('fusionModal');
}

function normalizeEnhanceSelection(user) {
  if (!selectedEnhanceCardKey) return;
  const card = getCardVariantByKey(user, selectedEnhanceCardKey);
  if (!card || !card.canEnhance || Number(card.availableEnhanceQuantity || 0) <= 0) {
    selectedEnhanceCardKey = null;
  }
}

function renderCardEnhanceModal(user) {
  const selectedCardEl = document.getElementById('enhanceSelectedCard');
  const sourceList = document.getElementById('enhanceSourceList');
  const chanceText = document.getElementById('enhanceChanceText');
  const previewPane = document.getElementById('enhancePreviewPane');
  const confirmButton = document.getElementById('confirmEnhanceBtn');
  if (!selectedCardEl || !sourceList || !chanceText || !previewPane || !confirmButton) return;

  normalizeEnhanceSelection(user);
  const variants = (user.cardVariantDetails || [])
    .filter((card) => Number(card.quantity || 0) > 0)
    .sort((a, b) => {
      const gradeOrder = { S: 0, A: 1, B: 2, C: 3 };
      return (gradeOrder[a.grade] ?? 9) - (gradeOrder[b.grade] ?? 9)
        || String(a.baseName || '').localeCompare(String(b.baseName || ''), 'ko')
        || Number(a.enhancementLevel || 0) - Number(b.enhancementLevel || 0);
    });

  const selectedCard = selectedEnhanceCardKey ? getCardVariantByKey(user, selectedEnhanceCardKey) : null;

  if (!selectedCard) {
    selectedCardEl.className = 'enhance-selected-card empty';
    selectedCardEl.style.borderColor = '';
    selectedCardEl.onclick = null;
    selectedCardEl.innerHTML = '강화할 카드를 아래 목록에서 선택하세요.';
    chanceText.textContent = '강화할 카드를 선택하면 성공 확률과 비용이 표시됩니다.';
    previewPane.innerHTML = '현재 효과와 강화 후 미리보기가 여기에 표시됩니다.';
    confirmButton.disabled = true;
  } else {
    selectedCardEl.className = `enhance-selected-card selected ${getCardVisualClass(selectedCard)}`;
    selectedCardEl.setAttribute('style', getCardVisualStyle(selectedCard));
    selectedCardEl.style.borderColor = selectedCard.borderColor || '#d0d0d0';
    selectedCardEl.innerHTML = `
      <div class="fusion-card-head">
        <span class="fusion-card-name">${escapeHtml(selectedCard.name)}</span>
        <span class="grade-badge" style="background:${escapeHtml(selectedCard.color || '#666666')}">${escapeHtml(selectedCard.grade)}</span>
      </div>
      <div class="fusion-card-meta">
        보유 ${formatNumber(selectedCard.quantity)}장 / 강화 재료 사용 가능 ${formatNumber(selectedCard.availableEnhanceQuantity || 0)}장<br>
        ${escapeHtml(selectedCard.skillName || '')}<br>
        ${escapeHtml(selectedCard.skillDesc || '')}<br>
        지속/적용: ${escapeHtml(selectedCard.durationText || '즉시')} / 쿨타임 ${formatNumber(selectedCard.cooldown || 0)}턴
      </div>
    `;
    selectedCardEl.onclick = () => {
      selectedEnhanceCardKey = null;
      renderCardEnhanceModal(user);
    };

    const successPercent = Math.round(Number(selectedCard.enhanceSuccessRate || 0) * 100);
    chanceText.textContent = `${escapeHtml(selectedCard.name)} 강화: 성공 확률 ${successPercent}% / 비용 ${formatNumber(selectedCard.enhanceCost || 0)}원`;
    const nextPreview = selectedCard.nextEnhancementPreview;
    previewPane.innerHTML = `
      <div class="enhance-preview-block">
        <h5>현재 효과</h5>
        <div><strong>${escapeHtml(selectedCard.skillName || '')}</strong></div>
        <div class="menu-note">${escapeHtml(selectedCard.skillDesc || '')}</div>
        <div class="menu-note">지속/적용: ${escapeHtml(selectedCard.durationText || '즉시')} / 쿨타임 ${formatNumber(selectedCard.cooldown || 0)}턴</div>
      </div>
      <div class="enhance-preview-block">
        <h5>강화 후 미리보기</h5>
        ${nextPreview
          ? `
            <div><strong>${escapeHtml(nextPreview.name || '')}</strong></div>
            <div class="menu-note">${escapeHtml(nextPreview.skillDesc || '')}</div>
            <div class="menu-note">지속/적용: ${escapeHtml(nextPreview.durationText || '즉시')} / 쿨타임 ${formatNumber(nextPreview.cooldown || 0)}턴</div>
          `
          : '<div class="menu-note">이미 최대 강화 단계입니다.</div>'}
      </div>
    `;
    confirmButton.disabled = !selectedCard.canEnhance || Number(selectedCard.availableEnhanceQuantity || 0) <= 0;
  }

  sourceList.innerHTML = '';
  if (!variants.length) {
    sourceList.innerHTML = '<div class="fusion-slot empty">보유 중인 카드가 없습니다.</div>';
    return;
  }

  variants.forEach((card) => {
    const key = getCardVariantKey(card.cardId, card.enhancementLevel);
    const selected = selectedEnhanceCardKey === key;
    const available = Number(card.availableEnhanceQuantity ?? card.quantity ?? 0);
    const disabled = !card.canEnhance || available <= 0;
    sourceList.insertAdjacentHTML(
      'beforeend',
      `
        <div class="fusion-source-card enhance-source-card ${getCardVisualClass(card)} ${selected ? 'selected' : ''} ${disabled ? 'unavailable' : ''}" style="border-color:${escapeHtml(card.borderColor || '#d0d0d0')}; ${escapeAttr(getCardVisualStyle(card))}" onclick="handleCardEnhanceSelect('${card.cardId}', ${Number(card.enhancementLevel || 0)})">
          <div class="fusion-card-head">
            <span class="fusion-card-name">${escapeHtml(card.name)}</span>
            <span class="grade-badge" style="background:${escapeHtml(card.color || '#666666')}">${escapeHtml(card.grade)}</span>
          </div>
          <div class="fusion-card-meta">
            <span class="enhance-card-count">보유 ${formatNumber(card.quantity)}장 / 강화 가능 ${formatNumber(available)}장${card.equipped ? ' / 현재 장착 중' : ''}</span><br>
            ${escapeHtml(card.skillName || '')}<br>
            ${escapeHtml(card.skillDesc || '')}<br>
            지속/적용: ${escapeHtml(card.durationText || '즉시')} / 쿨타임 ${formatNumber(card.cooldown || 0)}턴
          </div>
        </div>
      `
    );
  });
}

function openCardEnhanceModal() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  selectedEnhanceCardKey = null;
  showModal('enhanceModal');
  renderCardEnhanceModal(user);
}

function closeCardEnhanceModal() {
  selectedEnhanceCardKey = null;
  hideModal('enhanceModal');
}

function handleCardEnhanceSelect(cardId, enhancementLevel) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  const key = getCardVariantKey(cardId, enhancementLevel);
  const selectedCard = getCardVariantByKey(user, key);
  if (!selectedCard) return;
  if (!selectedCard.canEnhance || Number(selectedCard.availableEnhanceQuantity || 0) <= 0) return;
  if (selectedEnhanceCardKey === key) {
    selectedEnhanceCardKey = null;
  } else {
    selectedEnhanceCardKey = key;
  }
  renderCardEnhanceModal(user);
}

async function handleCardEnhanceConfirm() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  if (!selectedEnhanceCardKey) {
    alert('강화할 카드를 선택해주세요.');
    return;
  }

  const selectedCard = getCardVariantByKey(user, selectedEnhanceCardKey);
  if (!selectedCard) {
    alert('강화할 카드 정보를 찾을 수 없습니다.');
    return;
  }
  if (!selectedCard.canEnhance || Number(selectedCard.availableEnhanceQuantity || 0) <= 0) {
    alert('강화할 수 없는 카드입니다.');
    return;
  }

  const successPercent = Math.round(Number(selectedCard.enhanceSuccessRate || 0) * 100);
  const confirmed = confirm(`${selectedCard.name} 강화를 진행할까요?\n성공 확률 ${successPercent}% / 비용 ${formatNumber(selectedCard.enhanceCost || 0)}원`);
  if (!confirmed) return;

  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/cards/enhance`, {
      userId: user._id,
      cardId: selectedCard.cardId,
      enhancementLevel: selectedCard.enhancementLevel
    }));
    updateLocalUserState(data);
    const result = data.enhancementResult;
    if (result) {
      selectedEnhanceCardKey = getCardVariantKey(
        result.cardId,
        result.success ? result.nextLevel : result.previousLevel
      );
    }
    if (result) {
      alert(result.success
        ? `${result.cardName} +${formatNumber(result.previousLevel)} 강화 성공! -> +${formatNumber(result.nextLevel)}`
        : `${result.cardName} +${formatNumber(result.previousLevel)} 강화에 실패했습니다.`);
    }
    if (isEnhanceModalOpen()) {
      renderCardEnhanceModal(getStoredUser());
    }
  } catch (err) {
    alert(err.message);
  }
}


function closeSupportModal() {
  hideModal('supportModal');
}

function handleCardFusionAdd(cardId, inputId = null) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const card = getFusionOwnedCards(user).find((entry) => entry.id === cardId && entry.quantity > 0);
  if (!card) {
    alert('보유한 카드를 찾을 수 없습니다.');
    return;
  }
  if (card.grade === 'S') {
    alert('S등급 카드는 합성할 수 없습니다.');
    return;
  }

  normalizeCardFusionSelection(user);
  const lockedGrade = getLockedFusionGrade(user);
  if (lockedGrade && lockedGrade !== card.grade) {
    alert('같은 등급 카드만 합성 리스트에 등록할 수 있습니다.');
    return;
  }

  const selectedCounts = getFusionSelectionCountMap();
  const available = Math.max(0, Number(card.quantity || 0) - (selectedCounts.get(cardId) || 0));
  if (available <= 0) {
    alert('더 이상 등록할 수 있는 카드가 없습니다.');
    return;
  }

  const remainingSlots = 5 - cardFusionSelection.length;
  if (remainingSlots <= 0) {
    alert('합성 리스트는 최대 5장까지 등록할 수 있습니다.');
    return;
  }

  let quantity = available === 1 ? 1 : getRequestedQuantity(inputId);
  quantity = Math.max(1, Math.min(quantity, available, remainingSlots));
  for (let index = 0; index < quantity; index += 1) {
    cardFusionSelection.push(cardId);
  }
  renderCardFusionModal(user);
}

function handleCardFusionAutoFill(grade) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  normalizeCardFusionSelection(user);
  const lockedGrade = getLockedFusionGrade(user);
  if (lockedGrade && lockedGrade !== grade) {
    alert('이미 다른 등급 카드가 등록되어 있습니다.');
    return;
  }

  const selectedCounts = getFusionSelectionCountMap();
  const remainingSlots = 5 - cardFusionSelection.length;
  if (remainingSlots <= 0) {
    alert('합성 리스트가 이미 가득 찼습니다.');
    return;
  }

  const candidates = getFusionOwnedCards(user)
    .filter((card) => card.grade === grade && card.grade !== 'S')
    .sort((a, b) => Number(a.enhancementLevel || 0) - Number(b.enhancementLevel || 0)
      || String(a.baseName || a.name || '').localeCompare(String(b.baseName || b.name || ''), 'ko'));

  let added = 0;
  for (const card of candidates) {
    const used = selectedCounts.get(card.id) || 0;
    const available = Math.max(0, Number(card.quantity || 0) - used);
    for (let index = 0; index < available && cardFusionSelection.length < 5; index += 1) {
      cardFusionSelection.push(card.id);
      selectedCounts.set(card.id, (selectedCounts.get(card.id) || 0) + 1);
      added += 1;
    }
    if (cardFusionSelection.length >= 5) break;
  }

  if (added <= 0) {
    alert(`${grade}급 합성 재료로 등록할 카드가 없습니다.`);
  }
  renderCardFusionModal(user);
}

function handleCardFusionSlotRemove(index) {
  if (index < 0 || index >= cardFusionSelection.length) return;
  cardFusionSelection.splice(index, 1);
  const user = getStoredUser();
  if (user?._id) {
    renderCardFusionModal(user);
  }
}

async function handleCardFusionConfirm() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  normalizeCardFusionSelection(user);
  if (cardFusionSelection.length !== 5) {
    alert('합성 리스트를 5장으로 채워주세요.');
    return;
  }

  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/cards/fuse`, {
      userId: user._id,
      cards: cardFusionSelection.map(parseCardVariantKey),
      cardIds: [...cardFusionSelection]
    }));
    cardFusionSelection = [];
    updateLocalUserState(data);
    const result = data.fusionResult?.result;
    if (result) {
      alert(`합성 결과: [${result.grade}] ${result.name}`);
    }
    if (isFusionModalOpen()) {
      renderCardFusionModal(getStoredUser());
    }
  } catch (err) {
    alert(err.message);
  }
}

async function handleBuyClick(itemId, inputId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const quantity = getRequestedQuantity(inputId);
  const price = user.shopPrices?.[itemId] ?? 0;
  const itemName = ITEM_DATA[itemId]?.name || '아이템';
  if (!confirm(`${itemName} ${formatNumber(quantity)}개를 구매하시겠습니까?`)) return;

  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/shop/buy`, {
      userId: user._id,
      itemId,
      quantity
    }));
    updateLocalUserState(data);
    if (data.shopPurchase) {
      alert(`${data.shopPurchase.itemName} ${formatNumber(data.shopPurchase.quantity)}개 구매\n-${formatNumber(data.shopPurchase.totalPrice)}원\n현재 보유 ${formatNumber(data.shopPurchase.ownedQuantity)}개`);
    }
  } catch (err) {
    alert(err.message);
  }
}

async function handleUseItem(itemId, inputId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  const requestedQuantity = getRequestedQuantity(inputId);
  const maxUsableQuantity = getMaxUsableItemQuantity(user, itemId);
  if (maxUsableQuantity <= 0) {
    if (itemId === 'bacchus') {
      alert('행동력이 이미 최대치라 박카스를 사용할 수 없습니다.');
    } else {
      alert('지금은 해당 아이템을 사용할 수 없습니다.');
    }
    return;
  }
  const quantity = Math.min(requestedQuantity, maxUsableQuantity);

  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/inventory/use`, {
      userId: user._id,
      itemId,
      quantity
    }));
    updateLocalUserState(data);
  } catch (err) {
    alert(err.message);
  }
}

async function handleCardDraw() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const quantity = Math.max(1, Math.floor(Number(document.getElementById('cardDrawCount')?.value) || 1));
  const businessCards = getBusinessCardCount(user);
  if (businessCards < quantity) {
    alert('명함이 부족합니다.');
    return;
  }

  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/cards/draw`, {
      userId: user._id,
      quantity
    }));
    updateLocalUserState(data);
    const results = (data.drawResults || [])
      .map((card) => {
        const label = `[${card.grade}] ${escapeHtml(card.name)}`;
        return card.isNew ? `<span class="new-card-result">${label} (NEW)</span>` : label;
      })
      .join(', ');
    const statusEl = document.getElementById('cardDrawStatus');
    if (statusEl) {
      statusEl.innerHTML = results ? `이번 뽑기 결과: ${results}` : '뽑기 결과가 없습니다.';
    }
  } catch (err) {
    alert(err.message);
  }
}

async function handleToggleCardEquip(cardId, enhancementLevel = 0) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/cards/equip`, {
      userId: user._id,
      cardId,
      enhancementLevel
    }));
    updateLocalUserState(data);
  } catch (err) {
    alert(err.message);
  }
}

async function handleToggleTitle(titleId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const titleDetails = user.titleDetails || [];
  const currentTitle = titleDetails.find((title) => title.equipped) || null;
  const targetTitle = titleDetails.find((title) => title.id === titleId) || null;
  if (!targetTitle) {
    alert('칭호 정보를 찾을 수 없습니다.');
    return;
  }

  const targetAfterChange = currentTitle?.id === titleId ? null : targetTitle;
  const details = `
    <div class="modal-compare-block"><strong>현재 칭호</strong><br>${escapeHtml(currentTitle?.name || '없음')}<br>${escapeHtml(currentTitle?.desc || '효과 없음')}</div>
    <div class="modal-compare-block"><strong>변경 후 칭호</strong><br>${escapeHtml(targetAfterChange?.name || '없음')}<br>${escapeHtml(targetAfterChange?.desc || '효과 없음')}</div>
  `;

  const choice = await openDecisionModal({
    title: '칭호 변경 확인',
    message: '내일까지 칭호를 변경할 수 없습니다. 정말 변경하시겠습니까?',
    details,
    buttons: [
      { value: 'confirm', label: '변경하기' },
      { value: 'cancel', label: '취소' }
    ]
  });

  if (choice !== 'confirm') return;

  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/title/toggle`, {
      userId: user._id,
      titleId
    }));
    updateLocalUserState(data);
  } catch (err) {
    alert(err.message);
  }
}

async function handleToggleEmblem(emblemId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/emblem/toggle`, {
      userId: user._id,
      emblemId
    }));
    updateLocalUserState(data);
    updateRankingUI();
  } catch (err) {
    alert(err.message);
  }
}

function updateLocalUserState(data, options = {}) {
  if (!data?.user) return;
  const mergedOptions = {
    force: options.force !== false
  };
  if (shouldApplyIncomingUserState(data.user, mergedOptions)) {
    saveStoredUser(data.user);
  }
  const latestUser = getStoredUser();
  applyGlobalState(data.global);
  if (latestUser) {
    updateGameUI(latestUser);
  }
  if (isFusionModalOpen()) {
    renderCardFusionModal(latestUser);
  }
  if (isEnhanceModalOpen()) {
    renderCardEnhanceModal(latestUser);
  }
  if (isEquipmentEnhanceModalOpen()) {
    renderEquipmentEnhanceModal(latestUser);
  }
  if (isEquipmentDismantleModalOpen()) {
    renderEquipmentDismantleModal(latestUser);
  }
  if (data.marketplace) {
    marketplaceState.data = data.marketplace;
    renderMarketplace();
    const registerModal = document.getElementById('marketplaceRegisterModal');
    if (registerModal && !registerModal.classList.contains('hidden')) {
      renderMarketplaceRegisterModal();
    }
  }
  const fragmentShopModal = document.getElementById('fragmentShopModal');
  if (fragmentShopModal && !fragmentShopModal.classList.contains('hidden')) {
    openFragmentShopModal();
  }
  const branchOfficeModal = document.getElementById('branchOfficeModal');
  if (branchOfficeModal && !branchOfficeModal.classList.contains('hidden') && !isBranchOfficeTextEntryActive()) {
    renderBranchOfficeModal(latestUser);
  }
  if (latestUser) {
    updateRaidButton(latestUser, latestRaidState);
    updatePvpButton(latestUser, latestPvpState);
    updateInfiniteOvertimeButton(latestUser, latestInfiniteOvertimeState);
  }
  if (Object.prototype.hasOwnProperty.call(data, 'marketplaceSoldPendingCount')) {
    updateMarketplacePendingDot(data.marketplaceSoldPendingCount);
  }
  if (Object.prototype.hasOwnProperty.call(data, 'adminMailPendingCount')) {
    updateMailboxPendingDot(data.adminMailPendingCount);
  }
  showNotifications(data.notifications);
}

function getActiveMenuTabName() {
  const activeTab = document.querySelector('.menu-content:not(.hidden)');
  if (!activeTab?.id?.startsWith('tab-')) return 'work';
  return activeTab.id.slice(4);
}

async function processAdventureResult(result) {
  if (!result) return;

  setText('adventureLog', result.message || '아무 일도 일어나지 않았습니다.');

  if (result.requiresChoice) {
    const choice = await openDecisionModal({
      title: result.title || '모험',
      message: result.message || '',
      details: `<div class="modal-note">${escapeHtml(result.prompt || '')}</div>`,
      buttons: (result.buttons || []).map((button) => ({
        value: button.value,
        label: button.label
      }))
    });

    if (!choice) return;

    const user = getStoredUser();
    if (!user?._id) return handleLogoutClick();

    try {
      const data = await runWithUserMutation(() => postJson(`${API_URL}/api/action/adventure/resolve`, {
        userId: user._id,
        choice
      }));
      updateLocalUserState(data);
      await processAdventureResult(data.adventureResult);
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  if (result.rewardText) {
    alert(result.rewardText);
  }
}

function showGameScreen(user) {
  clearIntervals();
  hideAllScreens();
  document.getElementById('game-screen').classList.remove('hidden');
  document.getElementById('raid-screen').classList.add('hidden');
  document.getElementById('pvp-screen')?.classList.add('hidden');
  document.getElementById('infinite-overtime-screen')?.classList.add('hidden');
  updateShoutBanner(latestGlobalState);
  updateGameUI(user);
  loadNewsTypingPrompt();
  startAnimation();
  startPeriodicUpdates();
  startBgm('normal');

  if (user.pendingAdventure?.eventId && !modalResolver) {
    processAdventureResult({
      requiresChoice: true,
      title: `${user.pendingAdventure.location} / ${user.pendingAdventure.actor}`,
      message: user.pendingAdventure.message,
      prompt: '참치캔을 주겠습니까?',
      buttons: [
        { value: 'yes', label: '예' },
        { value: 'no', label: '아니오' }
      ]
    });
  }

  setTimeout(() => maybeShowPatchNotesOnce(), 500);
}

function openRaidLobby() {
  const user = getStoredUser();
  const activeModes = latestRaidState?.activeBattles || {};
  const participantMode = Object.entries(activeModes).find(([, battle]) => battle?.isParticipant)?.[0];
  if (participantMode) {
    selectedRaidMode = participantMode;
    latestRaidState.activeBattle = activeModes[participantMode];
    hideModal('raidLobbyModal');
    showRaidScreen();
    renderRaidBattle(latestRaidState, user);
    pollRaidState();
    return;
  }
  showModal('raidLobbyModal');
  updateRaidLobbyUI(latestRaidState, user);
  pollRaidState();
}

function closeRaidLobby() {
  hideModal('raidLobbyModal');
}

function handleRaidBackClick() {
  document.getElementById('raid-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  document.getElementById('raidReadyCountdownOverlay')?.classList.add('hidden');
  hideSpectatorPanel('raidSpectatorPanel');
  stopRaidReadyTicker();
  startBgm('normal');
}

function showRaidScreen() {
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('raid-screen').classList.remove('hidden');
  document.getElementById('pvp-screen')?.classList.add('hidden');
  document.getElementById('infinite-overtime-screen')?.classList.add('hidden');
  startBgm('raid');
}

function handleRaidModeChange(mode) {
  selectedRaidMode = mode === 'hard' ? 'hard' : 'normal';
  updateRaidLobbyUI(latestRaidState, getStoredUser());
  pollRaidState();
}

function updateRaidButton(user, raidState) {
  const button = document.getElementById('raidLobbyBtn');
  const hint = document.getElementById('raidEntryHint');
  if (!button || !hint || !user) return;
  let queueCountEl = document.getElementById('raidQueueCount');
  if (!queueCountEl) {
    button.insertAdjacentHTML('afterend', '<div id="raidQueueCount" class="raid-entry-count">현재 입장 대기중 0/5</div>');
    queueCountEl = document.getElementById('raidQueueCount');
  }

  const todayUsed = Boolean(raidState?.todayUsed);
  const remainingEntries = Number(raidState?.remainingEntries ?? 0);
  const modes = Array.isArray(raidState?.modes) ? raidState.modes : [];
  const selectedStatus = modes.find((entry) => entry.mode === selectedRaidMode) || null;
  const anyActive = modes.some((entry) => entry.hasActiveBattle);
  const participantStatus = modes.find((entry) => entry.isParticipant);
  const queuedStatus = modes.find((entry) => Number.isInteger(entry.queuedSlotIndex) && entry.queuedSlotIndex >= 0);
  const queuedCountText = modes.length
    ? modes.map((entry) => `${entry.label || entry.mode} ${formatNumber(entry.queuedCount || 0)}/5`).join(' / ')
    : `현재 입장 대기중 ${(raidState?.slots || []).filter(Boolean).length}/5`;

  if (anyActive) {
    button.classList.toggle('waiting', Boolean(participantStatus));
    button.disabled = false;
    button.textContent = participantStatus ? '회의 진행중' : '회의 관전/참석';
    hint.textContent = participantStatus
      ? `${participantStatus.label || ''} 회의가 진행 중입니다. 버튼을 누르면 전투 화면으로 돌아갑니다.`
      : '진행 중인 회의 관전 또는 다른 모드 대기열 입장이 가능합니다.';
    if (queueCountEl) queueCountEl.textContent = `진행/대기: ${queuedCountText}`;
    return;
  }

  button.classList.toggle('waiting', Boolean(queuedStatus));
  if (queueCountEl) queueCountEl.textContent = `현재 입장 대기중 ${queuedCountText}`;
  button.textContent = queuedStatus ? '회의 참석 대기중' : '회의 참석';

  if (todayUsed) {
    button.disabled = true;
    hint.textContent = '오늘은 이미 보스 레이드에 입장했습니다.';
  } else if (selectedStatus && !selectedStatus.levelEligible) {
    button.disabled = false;
    hint.textContent = `${selectedStatus.label} 모드 입장 기준: ${selectedStatus.maxLevel ? `${selectedStatus.minLevel}~${selectedStatus.maxLevel}레벨` : `${selectedStatus.minLevel}레벨 이상`}`;
  } else {
    button.disabled = false;
    hint.textContent = queuedStatus
      ? `${queuedStatus.label} ${queuedStatus.queuedSlotIndex + 1}번 슬롯에서 대기 중입니다. 오늘 남은 입장 가능 횟수 ${remainingEntries}회`
      : `보스 레이드 대기열에 참가할 수 있습니다. 오늘 남은 입장 가능 횟수 ${remainingEntries}회`;
  }
}

function updateMarketplacePendingDot(count) {
  const button = document.getElementById('marketplaceBtn');
  if (!button) return;
  const numericCount = Math.max(0, Number(count || 0));
  button.classList.toggle('has-pending', numericCount > 0);
  if (numericCount > 0) {
    button.title = `정산 대기 판매 ${numericCount}건`;
  } else {
    button.removeAttribute('title');
  }
}

function updateMailboxPendingDot(count) {
  const button = document.getElementById('mailboxBtn');
  if (!button) return;
  const numericCount = Math.max(0, Number(count || 0));
  button.classList.toggle('has-pending', numericCount > 0);
  if (numericCount > 0) {
    button.title = `수령하지 않은 운영자 우편 ${numericCount}건`;
  } else {
    button.removeAttribute('title');
  }
}

function formatMailRemaining(seconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(seconds || 0)));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}시간 ${minutes}분 남음`;
  return `${minutes}분 남음`;
}

async function openMailboxModal() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  showModal('mailboxModal');
  setText('mailboxStatus', '우편을 불러오는 중입니다.');
  const listEl = document.getElementById('mailboxList');
  if (listEl) listEl.innerHTML = '';

  try {
    const data = await getJson(`${API_URL}/api/mail?userId=${encodeURIComponent(user._id)}`);
    mailboxState.mails = data.mails || [];
    updateMailboxPendingDot(data.pendingCount);
    renderMailboxModal();
  } catch (err) {
    setText('mailboxStatus', err.message || '우편함을 불러오지 못했습니다.');
  }
}

function closeMailboxModal() {
  hideModal('mailboxModal');
}

function renderMailboxModal() {
  const listEl = document.getElementById('mailboxList');
  const statusEl = document.getElementById('mailboxStatus');
  const claimAllBtn = document.getElementById('mailboxClaimAllBtn');
  if (!listEl || !statusEl || !claimAllBtn) return;

  const mails = Array.isArray(mailboxState.mails) ? mailboxState.mails : [];
  claimAllBtn.disabled = mails.length === 0;
  statusEl.textContent = mails.length
    ? `수령 가능한 우편 ${mails.length}건`
    : '수령 가능한 우편이 없습니다.';

  listEl.innerHTML = mails.map((mail) => `
    <div class="mailbox-item">
      <div>
        <strong>${escapeHtml(mail.title || '운영자 우편')}</strong>
        <p>${escapeHtml(mail.description || '')}</p>
        <span class="menu-note">도착: ${escapeHtml(formatMarketDate(mail.createdAt))}</span>
        <span class="menu-note">${escapeHtml(formatMailRemaining(mail.remainingSeconds))}</span>
      </div>
      <button class="mini-btn" onclick="handleMailboxClaim('${escapeAttr(mail.id)}')">수령</button>
    </div>
  `).join('');
}

async function handleMailboxClaim(mailId) {
  const user = getStoredUser();
  if (!user?._id || !mailId) return;

  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/mail/claim`, {
      userId: user._id,
      mailId
    }));
    updateLocalUserState(data);
    mailboxState.mails = data.mail?.mails || [];
    updateMailboxPendingDot(data.adminMailPendingCount);
    renderMailboxModal();
    const message = data.mail?.messages?.[0];
    if (message) alert(message);
  } catch (err) {
    alert(err.message);
    openMailboxModal();
  }
}

async function handleMailboxClaimAll() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/mail/claim-all`, {
      userId: user._id
    }));
    updateLocalUserState(data);
    mailboxState.mails = data.mail?.mails || [];
    updateMailboxPendingDot(data.adminMailPendingCount);
    renderMailboxModal();
    alert(`${data.mail?.claimedCount || 0}건의 우편을 수령했습니다.`);
  } catch (err) {
    alert(err.message);
  }
}

function getPvpModeLabel(mode) {
  if (mode === 'augment3v3') return '증강 3대3';
  return mode === 'normal' ? '일반전' : '랭크';
}

function normalizePvpModeClient(mode) {
  if (mode === 'augment3v3') return 'augment3v3';
  return mode === 'normal' ? 'normal' : 'ranked';
}

function getPvpModeSummary(pvpState, mode = selectedPvpMode) {
  return pvpState?.modes?.[normalizePvpModeClient(mode)] || null;
}

function getActivePvpModeFromState(pvpState, userId = null) {
  const modes = pvpState?.modes || {};
  const entries = ['ranked', 'normal', 'augment3v3'].map((mode) => [mode, modes[mode]]).filter(([, summary]) => summary);
  const participant = entries.find(([, summary]) => summary.isParticipant || summary.isQueued);
  if (participant) return participant[0];
  const active = entries.find(([, summary]) => summary.hasActiveSession);
  return active?.[0] || selectedPvpMode || 'ranked';
}

function updatePvpModeModal(pvpState = latestPvpState) {
  const status = document.getElementById('pvpModeStatus');
  if (!status) return;
  const describe = (mode) => {
    const summary = getPvpModeSummary(pvpState, mode);
    if (!summary) return `${getPvpModeLabel(mode)}: 대기`;
    if (summary.isQueued) return `${getPvpModeLabel(mode)}: 대기중 ${summary.queueCount || 1}명`;
    if (summary.hasActiveSession) return `${getPvpModeLabel(mode)}: 진행중${summary.isParticipant ? ' / 참가중' : ' / 관전 가능'}`;
    return `${getPvpModeLabel(mode)}: 대기 가능`;
  };
  status.textContent = `${describe('normal')} / ${describe('ranked')} / ${describe('augment3v3')}`;
}

function updatePvpButton(user, pvpState) {
  const button = document.getElementById('pvpLobbyBtn');
  if (!button || !user) return;
  const level = Number(user.gameState?.level || 1);
  const summaries = Object.values(pvpState?.modes || {});
  const activeParticipant = summaries.find((summary) => summary?.isParticipant);
  const queued = summaries.find((summary) => summary?.isQueued);
  const activeSession = summaries.find((summary) => summary?.hasActiveSession);
  button.classList.toggle('waiting', Boolean(queued || activeParticipant));

  if (activeParticipant) {
    button.disabled = false;
    button.textContent = `${activeParticipant.label || '개인면담'} 진행중`;
    button.title = '진행 중인 개인면담으로 돌아갑니다.';
    return;
  }

  if (queued) {
    button.disabled = false;
    button.textContent = `${queued.label || '개인면담'} 대기중`;
    button.title = '다시 누르면 대기열에서 취소합니다.';
    return;
  }

  if (activeSession) {
    button.disabled = false;
    button.textContent = '개인면담 관전하기';
    button.title = '진행 중인 개인면담은 레벨 제한 없이 관전할 수 있습니다.';
    return;
  }

  button.textContent = '개인면담';
  button.disabled = false;
  button.title = level < 50 ? '입장은 50레벨부터 가능하지만, 진행 중인 개인면담은 관전할 수 있습니다.' : '';
  return;
  const battle = pvpState?.battle;
  const match = pvpState?.match;
  const isParticipant = Boolean(battle?.isParticipant || match?.isParticipant);
  button.classList.toggle('waiting', Boolean(pvpState?.isQueued || isParticipant));

  if (battle || match) {
    button.disabled = false;
    button.textContent = isParticipant ? '개인면담 진행중' : '개인면담 관전하기';
    button.title = isParticipant ? '진행 중인 개인면담으로 돌아갑니다.' : '진행 중인 개인면담은 레벨 제한 없이 관전할 수 있습니다.';
    return;
  }

  if (pvpState?.isQueued) {
    button.disabled = false;
    button.textContent = '개인면담 입장 대기중';
    button.title = '다시 누르면 대기열에서 취소됩니다.';
    return;
  }

  button.textContent = '개인면담';
  button.disabled = false;
  button.title = level < 50 ? '입장은 50레벨부터 가능하지만, 진행 중인 개인면담은 관전할 수 있습니다.' : '';
}

function updateInfiniteOvertimeButton(user, overtimeState) {
  const button = document.getElementById('infiniteOvertimeBtn');
  if (!button || !user) return;
  const level = Number(user.gameState?.level || 1);
  button.classList.toggle('waiting', Boolean(overtimeState?.battle || overtimeState?.active));
  if (level < 30) {
    button.disabled = true;
    button.textContent = '무한야근';
    button.title = '무한야근은 30레벨부터 입장할 수 있습니다.';
    return;
  }
  button.disabled = false;
  if (overtimeState?.battle?.phase === 'active') {
    button.textContent = '무한야근 진행중';
    button.title = '진행 중인 무한야근 전투로 돌아갑니다.';
  } else if (overtimeState?.active) {
    button.textContent = `무한야근 ${formatNumber(overtimeState.nextFloor || 1)}층`;
    button.title = '이어가기를 할 수 있습니다.';
  } else if (Number(overtimeState?.cooldownRemainingMs || 0) > 0) {
    button.textContent = '무한야근 대기';
    button.title = `다음 도전까지 ${formatOvertimeDuration(overtimeState.cooldownRemainingMs)} 남았습니다.`;
  } else {
    button.textContent = '무한야근';
    button.title = '무한야근에 입장합니다.';
  }
}

function formatOvertimeDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}일 ${hours}시간`;
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분`;
}

function showInfiniteOvertimeScreen() {
  document.getElementById('game-screen')?.classList.add('hidden');
  document.getElementById('raid-screen')?.classList.add('hidden');
  document.getElementById('pvp-screen')?.classList.add('hidden');
  document.getElementById('infinite-overtime-screen')?.classList.remove('hidden');
  startBgm('pvp');
}

async function handleInfiniteOvertimeClick() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  if (Number(user.gameState?.level || 1) < 30) {
    alert('무한야근은 30레벨부터 입장할 수 있습니다.');
    return;
  }
  try {
    await fetchInfiniteOvertimeState({ open: true });
  } catch (err) {
    alert(err.message);
  }
}

async function fetchInfiniteOvertimeState(options = {}) {
  const user = getStoredUser();
  if (!user?._id) return null;
  const data = await postJson(`${API_URL}/api/infinite-overtime/state`, { userId: user._id });
  applyInfiniteOvertimeState(data.infiniteOvertime);
  updateInfiniteOvertimeButton(user, latestInfiniteOvertimeState);
  if (options.open) showInfiniteOvertimeScreen();
  if (!document.getElementById('infinite-overtime-screen')?.classList.contains('hidden')) {
    renderInfiniteOvertimeState(latestInfiniteOvertimeState, user);
  }
  return latestInfiniteOvertimeState;
}

function getOvertimeStateBattleFloor(state) {
  return Number(state?.battle?.floor || 0);
}

function getOvertimeStateVisibleFloor(state) {
  const battleFloor = getOvertimeStateBattleFloor(state);
  const nextFloor = Number(state?.nextFloor || 0);
  return battleFloor > 0 ? battleFloor : Math.max(0, nextFloor);
}

function isOlderInfiniteOvertimeState(incoming, current) {
  if (!incoming || !current) return false;
  const currentBattle = current.battle;
  const incomingBattle = incoming.battle;
  const currentFloor = getOvertimeStateVisibleFloor(current);
  const incomingFloor = getOvertimeStateVisibleFloor(incoming);
  if (incomingFloor > 0 && currentFloor > 0 && incomingFloor < currentFloor) {
    return true;
  }
  if (currentBattle?.battleId && incomingBattle?.battleId && currentBattle.battleId !== incomingBattle.battleId) {
    const currentBattleFloor = getOvertimeStateBattleFloor(current);
    const incomingBattleFloor = getOvertimeStateBattleFloor(incoming);
    if (incomingBattleFloor > 0 && currentBattleFloor > 0 && incomingBattleFloor <= currentBattleFloor) {
      return true;
    }
  }
  if (currentBattle?.phase === 'active' && incomingBattle && ['victory', 'defeat', 'swap'].includes(incomingBattle.phase)) {
    return incomingFloor < currentFloor || incomingBattle.battleId !== currentBattle.battleId;
  }
  if (currentBattle?.phase === 'active' && !incomingBattle && incoming?.active) {
    return true;
  }
  return false;
}

function applyInfiniteOvertimeState(incoming, options = {}) {
  if (!incoming) return false;
  if (!options.force && isOlderInfiniteOvertimeState(incoming, latestInfiniteOvertimeState)) {
    return false;
  }
  latestInfiniteOvertimeState = incoming;
  return true;
}

function getOvertimeModeFromState(state) {
  if (state?.stage === 'defense_setup') return 'defense';
  if (state?.stage === 'attack_setup') return 'attack';
  if (state?.stage === 'ready') return 'ready';
  if (state?.stage === 'cooldown') return 'cooldown';
  if (state?.stage === 'locked') return 'locked';
  return '';
}

function getOvertimeSelectionKey(card) {
  return `${card.cardId}:${Number(card.enhancementLevel || 0)}`;
}

function isOvertimeCardSelected(card) {
  const key = getOvertimeSelectionKey(card);
  return overtimeSelection.some((entry) => getOvertimeSelectionKey(entry) === key);
}

function renderOvertimeCard(card, options = {}) {
  const selected = Boolean(options.selected);
  const disabled = Boolean(options.disabled);
  const handler = options.handler || 'handleOvertimeCardSelect';
  const scoreText = Number(card.score || 0) > 0 ? ` / ${formatNumber(card.score)}점` : '';
  return `
    <button class="pvp-card-choice ${getCardVisualClass(card)} ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}"
      style="${escapeAttr(getCardVisualStyle(card))}"
      ${disabled ? 'disabled' : ''}
      onclick="${handler}('${escapeAttr(card.cardId)}', ${Number(card.enhancementLevel || 0)})">
      <span class="pvp-card-grade" style="background:${escapeAttr(card.color || '#666666')}">${escapeHtml(card.grade || '')}</span>
      <div class="pvp-card-name">${escapeHtml(card.name || card.baseName || card.cardId)}${card.enhancementLevel ? ` +${formatNumber(card.enhancementLevel)}` : ''}</div>
      <div class="pvp-card-desc">${escapeHtml(card.skillDesc || '')}</div>
      <div class="menu-note">쿨타임 ${formatNumber(card.cooldown || 0)}턴 / ${escapeHtml(card.durationText || '')}${scoreText}</div>
    </button>
  `;
}

function renderOvertimeSelectedDeck(containerId, deck = [], options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const clickable = options.clickable;
  const handler = options.handler || 'handleOvertimeSelectedDeckClick';
  const slots = [];
  for (let index = 0; index < 5; index += 1) {
    const card = deck[index];
    slots.push(card ? `
      <button class="overtime-deck-slot ${getCardVisualClass(card)} ${options.selectedIndex === index ? 'selected' : ''}"
        style="${escapeAttr(getCardVisualStyle(card))}"
        ${clickable ? `onclick="${handler}(${index})"` : ''}>
        <strong>${index + 1}. ${escapeHtml(card.name || card.baseName || card.cardId)}${card.enhancementLevel ? ` +${formatNumber(card.enhancementLevel)}` : ''}</strong>
        <span>${escapeHtml(card.grade || '')} / ${formatNumber(card.score || 0)}점</span>
      </button>
    ` : `<div class="overtime-deck-slot empty">${index + 1}번 슬롯</div>`);
  }
  container.innerHTML = slots.join('');
}

function renderOvertimeDefenseEditButton() {
  return '<button class="mini-btn" onclick="startOvertimeDefenseEdit()">방어 Bot 수정</button>';
}

function startOvertimeDefenseEdit() {
  const state = latestInfiniteOvertimeState;
  if (!state || state.battle) return;
  overtimeEditingDefense = true;
  overtimeSetupMode = '';
  renderInfiniteOvertimeState(state, getStoredUser());
}

function cancelOvertimeDefenseEdit() {
  overtimeEditingDefense = false;
  overtimeSetupMode = '';
  renderInfiniteOvertimeState(latestInfiniteOvertimeState, getStoredUser());
}

function renderInfiniteOvertimeState(state, user) {
  if (!state) return;
  showInfiniteOvertimeScreen();
  const baseMode = getOvertimeModeFromState(state);
  const mode = overtimeEditingDefense && !state.battle ? 'defense' : baseMode;
  const battle = state.battle;
  const setupView = document.getElementById('overtimeSetupView');
  const battleView = document.getElementById('overtimeBattleView');
  const swapView = document.getElementById('overtimeSwapView');
  const backBtn = document.getElementById('overtimeBackBtn');
  const confirmBtn = document.getElementById('overtimeConfirmBtn');
  if (backBtn) backBtn.disabled = Boolean(battle && ['active', 'swap'].includes(battle.phase));

  if (battle?.phase === 'swap') {
    setupView?.classList.add('hidden');
    battleView?.classList.add('hidden');
    swapView?.classList.remove('hidden');
    renderOvertimeSwap(state);
    setText('overtimePhaseStatus', `${formatNumber(battle.floor)}층 클리어! 카드 교환 이벤트`);
    return;
  }

  if (battle && ['active', 'victory', 'defeat'].includes(battle.phase)) {
    setupView?.classList.add('hidden');
    swapView?.classList.add('hidden');
    battleView?.classList.remove('hidden');
    renderOvertimeBattle(state, user);
    return;
  }

  setupView?.classList.remove('hidden');
  battleView?.classList.add('hidden');
  swapView?.classList.add('hidden');

  if (overtimeSetupMode !== mode) {
    overtimeSetupMode = mode;
    overtimeSelection = mode === 'defense' ? [...(state.defensePreset || [])] : [];
  }

  const selectedScore = overtimeSelection.reduce((sum, card) => sum + Number(card.score || 0), 0);
  const grid = document.getElementById('overtimeCardGrid');
  const cards = state.defenseOptions || [];

  if (mode === 'locked') {
    overtimeEditingDefense = false;
    setText('overtimePhaseStatus', `무한야근은 ${formatNumber(state.minLevel || 30)}레벨부터 입장할 수 있습니다.`);
    renderOvertimeSelectedDeck('overtimeSelectedDeck', []);
    if (grid) grid.innerHTML = '';
    if (confirmBtn) confirmBtn.disabled = true;
    return;
  }

  if (mode === 'cooldown') {
    overtimeEditingDefense = false;
    setText('overtimePhaseStatus', `다음 무한야근 도전까지 ${formatOvertimeDuration(state.cooldownRemainingMs)} 남았습니다.`);
    renderOvertimeSelectedDeck('overtimeSelectedDeck', state.attackDeck || []);
    if (grid) {
      grid.innerHTML = `
        <div class="menu-note">아직 재도전 시간이 아닙니다.</div>
        <div class="pvp-action-row">${renderOvertimeDefenseEditButton()}</div>
      `;
    }
    if (confirmBtn) confirmBtn.disabled = true;
    return;
  }

  if (mode === 'ready') {
    overtimeEditingDefense = false;
    setText('overtimePhaseStatus', `무한야근 ${formatNumber(state.nextFloor || 1)}층부터 이어갈 수 있습니다.`);
    renderOvertimeSelectedDeck('overtimeSelectedDeck', state.attackDeck || []);
    if (grid) {
      grid.innerHTML = `
        <div class="menu-note">이미 확정한 공략 덱으로 다음 층 전투를 시작합니다.</div>
        <div class="pvp-action-row">${renderOvertimeDefenseEditButton()}</div>
      `;
    }
    if (confirmBtn) {
      confirmBtn.textContent = '다음 층 전투 시작';
      confirmBtn.disabled = false;
    }
    return;
  }

  if (mode === 'attack') {
    overtimeEditingDefense = false;
    const draft = state.attackDraft || {};
    const selectedDeck = draft.selectedDeck || [];
    const selectedScore = Number(draft.selectedScore || 0);
    setText('overtimePhaseStatus', `공략용 카드 후보 선택: ${formatNumber(selectedDeck.length)}/5장 / 현재 비용 ${formatNumber(selectedScore)}점`);
    renderOvertimeSelectedDeck('overtimeSelectedDeck', selectedDeck);
    if (confirmBtn) {
      confirmBtn.textContent = selectedDeck.length >= 5 ? '무한야근 시작' : `${formatNumber((draft.slotIndex || selectedDeck.length + 1))}번 슬롯 후보 선택 중`;
      confirmBtn.disabled = selectedDeck.length !== 5;
    }
    if (grid) {
      const candidates = draft.candidates || [];
      const intro = `
        <div class="menu-note">
          슬롯마다 제시되는 5개의 후보 중 1장을 선택합니다. 후보 등급 확률은 S 10%, A 20%, B 30%, C 40%입니다.
        </div>
        <div class="pvp-action-row">${renderOvertimeDefenseEditButton()}</div>
      `;
      grid.innerHTML = selectedDeck.length >= 5
        ? `${intro}<div class="menu-note">공략 덱이 완성되었습니다. 시작 버튼을 눌러 1층으로 입장하세요.</div>`
        : intro + (candidates.map((card) => renderOvertimeCard(card, {
            handler: 'handleOvertimeDraftCandidateSelect',
            disabled: overtimeDraftPicking
          })).join('') || '<div class="menu-note">선택 가능한 후보가 없습니다.</div>');
    }
    return;
  }

  const targetText = mode === 'defense'
    ? `${overtimeEditingDefense ? '방어 Bot 프리셋 수정' : '방어 Bot 프리셋 등록'}: 배정 점수 ${formatNumber(state.targetScore)}점 / 현재 ${formatNumber(selectedScore)}점`
    : `공략용 카드 선택: ${formatNumber(overtimeSelection.length)}/5장`;
  setText('overtimePhaseStatus', targetText);
  renderOvertimeSelectedDeck('overtimeSelectedDeck', overtimeSelection, { clickable: true });
  if (confirmBtn) {
    confirmBtn.textContent = overtimeEditingDefense ? '방어 Bot 수정 완료' : '방어 Bot 등록';
    confirmBtn.disabled = mode === 'defense'
      ? !(overtimeSelection.length === 5 && selectedScore === Number(state.targetScore || 0))
      : overtimeSelection.length !== 5;
  }
  if (grid) {
    grid.innerHTML = cards.map((card) => {
      const selected = isOvertimeCardSelected(card);
      const disabled = !selected && overtimeSelection.length >= 5;
      return renderOvertimeCard(card, { selected, disabled });
    }).join('') || '<div class="menu-note">선택 가능한 카드가 없습니다.</div>';
    if (overtimeEditingDefense) {
      grid.innerHTML = `<div class="pvp-action-row"><button class="mini-btn" onclick="cancelOvertimeDefenseEdit()">수정 취소</button></div>${grid.innerHTML}`;
    }
  }
}

function handleOvertimeCardSelect(cardId, enhancementLevel = 0) {
  const state = latestInfiniteOvertimeState;
  const mode = overtimeEditingDefense ? 'defense' : getOvertimeModeFromState(state);
  if (mode !== 'defense') return;
  const cards = state.defenseOptions || [];
  const card = cards.find((entry) => entry.cardId === cardId && Number(entry.enhancementLevel || 0) === Number(enhancementLevel || 0));
  if (!card) return;
  const key = getOvertimeSelectionKey(card);
  const existingIndex = overtimeSelection.findIndex((entry) => getOvertimeSelectionKey(entry) === key);
  if (existingIndex >= 0) {
    overtimeSelection.splice(existingIndex, 1);
  } else if (overtimeSelection.length < 5) {
    overtimeSelection.push(card);
  }
  renderInfiniteOvertimeState(state, getStoredUser());
}

async function handleOvertimeDraftCandidateSelect(cardId, enhancementLevel = 0) {
  const user = getStoredUser();
  if (!user?._id || overtimeDraftPicking) return;
  overtimeDraftPicking = true;
  renderInfiniteOvertimeState(latestInfiniteOvertimeState, user);
  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/infinite-overtime/draft-pick`, {
      userId: user._id,
      cardId,
      enhancementLevel
    }));
    const applied = applyInfiniteOvertimeState(data.infiniteOvertime, { force: true });
    if (applied) updateLocalUserState(data, { force: true });
  } catch (err) {
    alert(err.message);
  } finally {
    overtimeDraftPicking = false;
    renderInfiniteOvertimeState(latestInfiniteOvertimeState, getStoredUser());
  }
}

function handleOvertimeSelectedDeckClick(index) {
  if (!Number.isInteger(Number(index))) return;
  if (!overtimeEditingDefense && getOvertimeModeFromState(latestInfiniteOvertimeState) !== 'defense') return;
  overtimeSelection.splice(Number(index), 1);
  renderInfiniteOvertimeState(latestInfiniteOvertimeState, getStoredUser());
}

async function handleOvertimeConfirmClick() {
  const user = getStoredUser();
  const state = latestInfiniteOvertimeState;
  if (!user?._id || !state) return;
  const mode = overtimeEditingDefense ? 'defense' : getOvertimeModeFromState(state);
  const endpoint = mode === 'defense' ? 'defense-preset' : 'start';
  const payload = { userId: user._id };
  if (mode === 'defense') payload.deck = overtimeSelection;
  if (!['defense', 'attack', 'ready'].includes(mode)) return;
  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/infinite-overtime/${endpoint}`, payload));
    const applied = applyInfiniteOvertimeState(data.infiniteOvertime, { force: true });
    if (applied) updateLocalUserState(data, { force: true });
    overtimeEditingDefense = false;
    overtimeSetupMode = '';
    renderInfiniteOvertimeState(latestInfiniteOvertimeState, getStoredUser());
  } catch (err) {
    alert(err.message);
  }
}

function renderOvertimeBattle(state, user) {
  const battle = state.battle;
  if (!battle) return;
  const player = (battle.players || []).find((entry) => !entry.isBot);
  const bot = (battle.players || []).find((entry) => entry.isBot);
  setText('overtimePhaseStatus', battle.phase === 'active'
    ? `무한야근 ${formatNumber(battle.floor)}층 / 방어 점수 ${formatNumber(battle.floorScore)}점`
    : battle.phase === 'victory' ? `${formatNumber(battle.floor)}층 승리` : '무한야근 패배');
  setText('overtimeBattleTurnLabel', `현재 턴 ${formatNumber(battle.turnNumber || 1)}`);
  setText('overtimeBattleTurnActor', battle.phase === 'active' ? '내 행동' : '전투 종료');
  renderOvertimeBattlePanel('overtimeBotBattlePanel', bot, false, battle);
  renderOvertimeBattlePanel('overtimePlayerBattlePanel', player, true, battle);
  renderOvertimeBattleLog(battle);
  renderOvertimeResultPanel(state);
}

function renderOvertimeBattlePanel(panelId, player, canControl, battle) {
  const panel = document.getElementById(panelId);
  if (!panel || !player) return;
  const hpRatio = player.maxHp > 0 ? Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100)) : 0;
  const shieldRatio = player.maxHp > 0 ? Math.max(0, Math.min(100, (player.shield / player.maxHp) * 100)) : 0;
  const effects = (player.statusEffects || []).map((effect) => `
    <div class="raid-effect-badge ${effect.type === 'debuff' ? 'raid-effect-debuff' : 'raid-effect-buff'}" title="${escapeAttr(effect.desc || '')}">
      <div class="raid-effect-name">${escapeHtml(effect.name)}${effect.turns ? ` (${formatNumber(effect.turns)}턴)` : ''}${effect.count ? ` (${formatNumber(effect.count)}회)` : ''}</div>
      ${effect.desc ? `<div class="raid-effect-desc">${escapeHtml(effect.desc)}</div>` : ''}
    </div>
  `).join('');
  const cardButtons = (player.cards || []).map((card, index) => {
    const disabled = !canControl || battle.phase !== 'active' || card.passiveOnly || Number(card.cooldownRemaining || 0) > 0;
    return `
      <button class="pvp-card-skill-btn ${getCardVisualClass(card)}" style="${escapeAttr(getCardVisualStyle(card))}" ${disabled ? 'disabled' : ''} title="${escapeAttr(card.skillDesc || '')}" onclick="handleOvertimeAction(${index}, 'skill')">
        ${escapeHtml(card.name || card.baseName || '')}
        ${Number(card.cooldownRemaining || 0) > 0 ? `<br>쿨 ${formatNumber(card.cooldownRemaining)}` : ''}
      </button>
    `;
  }).join('');
  const basicButton = canControl ? `
    <button class="pvp-card-skill-btn pvp-basic-turn-btn" ${battle.phase !== 'active' || player.hp <= 0 ? 'disabled' : ''} onclick="handleOvertimeAction(null, 'basic')">
      스킬 없이 기본공격
    </button>
  ` : '';
  const lossAmount = Number(player.lastHpLoss || 0) + Number(player.lastShieldLoss || 0);
  panel.classList.toggle('active-turn', battle.phase === 'active' && canControl);
  panel.innerHTML = `
    <strong>${compactDisplayHtml(player.displayName || '', 18)}</strong>
    <div class="pvp-hp-row">
      <span>HP</span>
      <div class="pvp-hp-bar" data-pvp-hp-bar></div>
      <span>${formatNumber(player.hp)} / ${formatNumber(player.maxHp)}</span>
    </div>
    <div class="menu-note">보호막 ${formatNumber(player.shield || 0)}</div>
    <div class="pvp-effect-title">버프 / 디버프</div>
    <div class="pvp-effect-list">${effects || '<span class="muted-text">버프 / 디버프 없음</span>'}</div>
    <div class="pvp-card-button-list">${basicButton}${cardButtons}</div>
  `;
  updatePvpAnimatedBar(panel.querySelector('[data-pvp-hp-bar]'), `overtime:${battle.battleId || ''}:${player.userId}`, {
    hpRatio,
    shieldRatio,
    lossText: lossAmount > 0 ? `-${formatNumber(lossAmount)}` : '',
    trailDelayMs: 650
  });
}

function renderOvertimeBattleLog(battle) {
  const log = document.getElementById('overtimeBattleLog');
  if (!log) return;
  log.innerHTML = (battle.recentLogs || [])
    .map((line, index) => `<div class="raid-log-line ${index === 0 ? 'latest' : ''}">${escapeHtml(line)}</div>`)
    .join('');
}

function renderOvertimeResultPanel(state) {
  const panel = document.getElementById('overtimeResultPanel');
  const battle = state?.battle;
  if (!panel || !battle || !['victory', 'defeat'].includes(battle.phase)) {
    if (panel) {
      panel.classList.add('hidden');
      panel.innerHTML = '';
    }
    return;
  }
  panel.classList.remove('hidden');
  if (battle.phase === 'victory') {
    panel.innerHTML = `
      <h3>${formatNumber(battle.floor)}층 승리</h3>
      <p>${escapeHtml(battle.reward?.text || '보상을 획득했습니다.')}</p>
      <div class="modal-actions">
        <button class="menu-action-btn" ${state.active ? '' : 'disabled'} onclick="handleOvertimeContinueClick()">다음 층으로</button>
        <button class="mini-btn" onclick="handleOvertimeExitClick()">메인 화면으로</button>
      </div>
    `;
  } else {
    panel.innerHTML = `
      <h3>무한야근 패배</h3>
      <p>이번 도전은 종료되었습니다. 3일 뒤 다시 도전할 수 있습니다.</p>
      <div class="modal-actions">
        <button class="mini-btn" onclick="handleOvertimeExitClick()">확인</button>
      </div>
    `;
  }
}

async function handleOvertimeAction(cardIndex, actionType = cardIndex === null ? 'basic' : 'skill') {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  if (overtimeActionInFlight) return;
  overtimeActionInFlight = true;
  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/infinite-overtime/action`, {
      userId: user._id,
      cardIndex,
      actionType
    }));
    const applied = applyInfiniteOvertimeState(data.infiniteOvertime);
    if (applied) {
      updateLocalUserState(data, { force: true });
      renderInfiniteOvertimeState(latestInfiniteOvertimeState, getStoredUser());
    }
  } catch (err) {
    alert(err.message);
  } finally {
    overtimeActionInFlight = false;
  }
}

function renderOvertimeSwap(state) {
  const battle = state.battle;
  const optionsEl = document.getElementById('overtimeSwapOptions');
  const deck = state.attackDeck || [];
  if (optionsEl) {
    optionsEl.innerHTML = (battle.swapOptions || []).map((card) => renderOvertimeCard(card, {
      selected: overtimeSwapOptionCardId === card.cardId,
      handler: 'handleOvertimeSwapOptionSelect'
    })).join('');
  }
  renderOvertimeSelectedDeck('overtimeSwapDeck', deck, {
    clickable: true,
    handler: 'handleOvertimeSwapDeckSelect',
    selectedIndex: overtimeSwapReplaceIndex
  });
  const confirmBtn = document.getElementById('overtimeSwapConfirmBtn');
  if (confirmBtn) confirmBtn.disabled = !overtimeSwapOptionCardId || !Number.isInteger(overtimeSwapReplaceIndex);
}

function handleOvertimeSwapOptionSelect(cardId) {
  overtimeSwapOptionCardId = String(cardId || '');
  renderOvertimeSwap(latestInfiniteOvertimeState);
}

function handleOvertimeSwapDeckSelect(index) {
  overtimeSwapReplaceIndex = Number(index);
  renderOvertimeSwap(latestInfiniteOvertimeState);
}

async function handleOvertimeSwapConfirm() {
  const user = getStoredUser();
  if (!user?._id || !overtimeSwapOptionCardId || !Number.isInteger(overtimeSwapReplaceIndex)) return;
  if (overtimeSwapInFlight) return;
  overtimeSwapInFlight = true;
  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/infinite-overtime/swap`, {
      userId: user._id,
      optionCardId: overtimeSwapOptionCardId,
      replaceIndex: overtimeSwapReplaceIndex
    }));
    overtimeSwapOptionCardId = null;
    overtimeSwapReplaceIndex = null;
    const applied = applyInfiniteOvertimeState(data.infiniteOvertime);
    if (applied) {
      updateLocalUserState(data, { force: true });
      renderInfiniteOvertimeState(latestInfiniteOvertimeState, getStoredUser());
    }
  } catch (err) {
    alert(err.message);
  } finally {
    overtimeSwapInFlight = false;
  }
}

async function handleOvertimeSwapSkip() {
  const user = getStoredUser();
  if (!user?._id) return;
  if (overtimeSwapInFlight) return;
  overtimeSwapInFlight = true;
  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/infinite-overtime/swap`, {
      userId: user._id,
      skip: true
    }));
    overtimeSwapOptionCardId = null;
    overtimeSwapReplaceIndex = null;
    const applied = applyInfiniteOvertimeState(data.infiniteOvertime);
    if (applied) {
      updateLocalUserState(data, { force: true });
      renderInfiniteOvertimeState(latestInfiniteOvertimeState, getStoredUser());
    }
  } catch (err) {
    alert(err.message);
  } finally {
    overtimeSwapInFlight = false;
  }
}

async function handleOvertimeContinueClick() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  if (overtimeContinueInFlight) return;
  overtimeContinueInFlight = true;
  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/infinite-overtime/continue`, { userId: user._id }));
    const applied = applyInfiniteOvertimeState(data.infiniteOvertime);
    if (applied) {
      updateLocalUserState(data, { force: true });
      renderInfiniteOvertimeState(latestInfiniteOvertimeState, getStoredUser());
    }
  } catch (err) {
    alert(err.message);
  } finally {
    overtimeContinueInFlight = false;
  }
}

async function handleOvertimeExitClick() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/infinite-overtime/exit`, { userId: user._id }));
    const applied = applyInfiniteOvertimeState(data.infiniteOvertime, { force: true });
    if (applied) updateLocalUserState(data, { force: true });
  } catch (err) {
    alert(err.message);
  }
  showGameScreen(getStoredUser());
}

async function handleOvertimeBackClick() {
  const battle = latestInfiniteOvertimeState?.battle;
  if (overtimeEditingDefense) {
    cancelOvertimeDefenseEdit();
    return;
  }
  if (battle && ['active', 'swap'].includes(battle.phase)) {
    alert('전투 중에는 메인화면으로 돌아갈 수 없습니다.');
    return;
  }
  if (battle && ['victory', 'defeat'].includes(battle.phase)) {
    await handleOvertimeExitClick();
    return;
  }
  document.getElementById('infinite-overtime-screen')?.classList.add('hidden');
  document.getElementById('game-screen')?.classList.remove('hidden');
  startBgm('normal');
}

function showPvpScreen() {
  document.getElementById('game-screen')?.classList.add('hidden');
  document.getElementById('raid-screen')?.classList.add('hidden');
  document.getElementById('infinite-overtime-screen')?.classList.add('hidden');
  document.getElementById('pvp-screen')?.classList.remove('hidden');
  startBgm('pvp');
}

function handlePvpBackClick() {
  document.getElementById('pvp-screen')?.classList.add('hidden');
  document.getElementById('game-screen')?.classList.remove('hidden');
  document.getElementById('pvpCountdownOverlay')?.classList.add('hidden');
  hideSpectatorPanel('pvpSpectatorPanel');
  if (pvpTurnTicker) clearInterval(pvpTurnTicker);
  if (pvpSpectatorReturnTimer) clearTimeout(pvpSpectatorReturnTimer);
  pvpTurnTicker = null;
  pvpSpectatorReturnTimer = null;
  startBgm('normal');
}

async function fetchPvpStateForMode(mode = selectedPvpMode, options = {}) {
  const user = getStoredUser();
  if (!user?._id) return null;
  selectedPvpMode = normalizePvpModeClient(mode);
  const data = await postJson(`${API_URL}/api/pvp/state`, {
    userId: user._id,
    mode: selectedPvpMode,
    viewing: Boolean(options.viewing)
  });
  latestPvpState = data.pvp;
  return latestPvpState;
}

function openPvpModeModal() {
  updatePvpModeModal(latestPvpState);
  showModal('pvpModeModal');
}

async function handlePvpModeSelect(mode) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  selectedPvpMode = normalizePvpModeClient(mode);
  hideModal('pvpModeModal');

  try {
    await fetchPvpStateForMode(selectedPvpMode, { viewing: false });
  } catch (err) {
    console.error('PVP mode refresh failed:', err);
  }

  const summary = getPvpModeSummary(latestPvpState, selectedPvpMode);
  if (summary?.hasActiveSession) {
    await fetchPvpStateForMode(selectedPvpMode, { viewing: true });
    showPvpScreen();
    renderPvpState(latestPvpState, user);
    pollPvpState();
    return;
  }

  if (Number(user.gameState?.level || 1) < 50) {
    alert('개인면담 입장은 50레벨부터 가능합니다. 진행 중인 개인면담은 레벨과 상관없이 관전할 수 있습니다.');
    return;
  }

  try {
    const data = await postJson(`${API_URL}/api/pvp/queue`, { userId: user._id, mode: selectedPvpMode });
    latestPvpState = data.pvp;
    updatePvpButton(user, latestPvpState);
    updatePvpMatchModal(latestPvpState);
    renderPvpState(latestPvpState, user);
  } catch (err) {
    alert(err.message);
  }
}

async function handlePvpLobbyClick() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const activeMode = getActivePvpModeFromState(latestPvpState, user._id);
  const activeSummary = getPvpModeSummary(latestPvpState, activeMode);
  if (activeSummary?.isParticipant) {
    selectedPvpMode = activeMode;
    try {
      await fetchPvpStateForMode(selectedPvpMode, { viewing: !activeSummary.isParticipant });
    } catch (err) {
      console.error('PVP mode state load failed:', err);
    }
    showPvpScreen();
    renderPvpState(latestPvpState, user);
    pollPvpState();
    return;
  }

  if (activeSummary?.isQueued) {
    selectedPvpMode = activeMode;
    try {
      const data = await postJson(`${API_URL}/api/pvp/cancel`, { userId: user._id, mode: selectedPvpMode });
      latestPvpState = data.pvp;
      updatePvpButton(user, latestPvpState);
      updatePvpMatchModal(latestPvpState);
      renderPvpState(latestPvpState, user);
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  openPvpModeModal();
  return;

  if (latestPvpState?.battle || latestPvpState?.match) {
    showPvpScreen();
    renderPvpState(latestPvpState, user);
    pollPvpState();
    return;
  }

  if (latestPvpState?.isQueued) {
    try {
      const data = await postJson(`${API_URL}/api/pvp/cancel`, { userId: user._id, mode: selectedPvpMode });
      latestPvpState = data.pvp;
      updatePvpButton(user, latestPvpState);
      updatePvpMatchModal(latestPvpState);
      renderPvpState(latestPvpState, user);
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  if (Number(user.gameState?.level || 1) < 50) {
    alert('개인면담 입장은 50레벨부터 가능합니다. 진행 중인 개인면담은 레벨과 상관없이 관전할 수 있습니다.');
    return;
  }

  try {
    const data = await postJson(`${API_URL}/api/pvp/queue`, { userId: user._id, mode: selectedPvpMode });
    latestPvpState = data.pvp;
    updatePvpButton(user, latestPvpState);
    updatePvpMatchModal(latestPvpState);
    renderPvpState(latestPvpState, user);
  } catch (err) {
    alert(err.message);
  }
}

async function handlePvpAccept(accept) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  try {
    const data = await postJson(`${API_URL}/api/pvp/accept`, { userId: user._id, accept, mode: selectedPvpMode });
    latestPvpState = data.pvp;
    hideModal('pvpMatchModal');
    if (accept) {
      showPvpScreen();
    } else {
      handlePvpBackClick();
    }
    updatePvpButton(user, latestPvpState);
    updatePvpMatchModal(latestPvpState);
    renderPvpState(latestPvpState, user);
  } catch (err) {
    alert(err.message);
  }
}

async function pollPvpState() {
  const user = getStoredUser();
  if (!user?._id) return;
  if (pvpPollRequestInFlight) return;
  try {
    pvpPollRequestInFlight = true;
    const pvpScreenOpen = !document.getElementById('pvp-screen')?.classList.contains('hidden');
    const viewing = pvpScreenOpen && Boolean(latestPvpState?.match || latestPvpState?.battle);
    const previousPvpState = latestPvpState;
    const data = await postJson(`${API_URL}/api/pvp/state`, { userId: user._id, viewing, mode: selectedPvpMode });
    latestPvpState = data.pvp;
    const acceptWasCancelled = previousPvpState?.match?.phase === 'accept'
      && previousPvpState.match.isParticipant
      && !latestPvpState?.match
      && !latestPvpState?.battle
      && !latestPvpState?.isQueued;
    if (acceptWasCancelled) {
      hideModal('pvpMatchModal');
      if (pvpScreenOpen) handlePvpBackClick();
    }
    updatePvpButton(user, latestPvpState);
    updatePvpMatchModal(latestPvpState);
    if (!document.getElementById('pvp-screen')?.classList.contains('hidden')) {
      renderPvpState(latestPvpState, user);
    }
  } catch (err) {
    console.error('PVP state poll failed:', err);
  } finally {
    pvpPollRequestInFlight = false;
  }
}

function renderSpectatorPanel(panelId, listId, spectators = []) {
  const panel = document.getElementById(panelId);
  const list = document.getElementById(listId);
  if (!panel || !list) return;
  panel.classList.remove('hidden');
  const normalized = Array.isArray(spectators) ? spectators : [];
  list.innerHTML = normalized.length
    ? normalized.map((spectator) => `<span class="spectator-chip">${compactDisplayHtml(spectator.displayName || spectator.nickname || spectator.username || '관전자', 14)}</span>`).join('')
    : '<span class="muted-text">없음</span>';
}

function hideSpectatorPanel(panelId) {
  document.getElementById(panelId)?.classList.add('hidden');
}

function isPvpAugmentMode(mode) {
  return normalizePvpModeClient(mode) === 'augment3v3';
}

function getPvpAugmentTierLabel(tier) {
  if (tier === 'prism') return '프리즘';
  if (tier === 'gold') return '골드';
  return '실버';
}

function getPvpAugmentPlayerListHtml(players = [], viewerUserId = '') {
  return players.map((player) => `
    <div class="pvp-augment-roster-card ${player.hp <= 0 ? 'dead' : ''} ${player.isSelf ? 'self' : ''}">
      <strong>${compactDisplayHtml(player.displayName || '', 16)}</strong>
      <span>HP ${formatNumber(player.hp || 0)} / ${formatNumber(player.maxHp || 300)}</span>
      <span>${formatNumber(player.kills || 0)}킬 / ${formatNumber(player.deaths || 0)}데스</span>
      ${player.pendingAction ? '<span class="pvp-augment-ready">행동 예약됨</span>' : ''}
    </div>
  `).join('');
}

function renderPvpAugmentSidePanel(panelId, players = [], title = '') {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.innerHTML = `
    <div class="pvp-side-name">${escapeHtml(title)}</div>
    <div class="pvp-augment-roster">${getPvpAugmentPlayerListHtml(players)}</div>
  `;
}

function getMyAugmentPicks(match, userId) {
  return Array.isArray(match?.picks?.[String(userId)]) ? match.picks[String(userId)] : [];
}

function getMyAugmentCandidates(match, userId) {
  return Array.isArray(match?.candidates?.[String(userId)]) ? match.candidates[String(userId)] : [];
}

function renderPvpAugmentDraft(match, user) {
  showPvpScreen();
  document.getElementById('pvpDraftView')?.classList.remove('hidden');
  document.getElementById('pvpBattleView')?.classList.add('hidden');
  document.getElementById('pvpCountdownOverlay')?.classList.add('hidden');
  if (pvpTurnTicker) clearInterval(pvpTurnTicker);
  pvpTurnTicker = null;

  const userId = String(user?._id || '');
  const redPlayers = (match.players || []).filter((player) => player.team === 'red');
  const bluePlayers = (match.players || []).filter((player) => player.team === 'blue');
  renderPvpAugmentSidePanel('pvpMyPanel', redPlayers, '레드팀');
  renderPvpAugmentSidePanel('pvpEnemyPanel', bluePlayers, '블루팀');
  renderSpectatorPanel('pvpSpectatorPanel', 'pvpSpectatorList', match.spectators || []);
  renderPvpDraftTimer(match);

  const candidates = getMyAugmentCandidates(match, userId);
  const savedPicks = getMyAugmentPicks(match, userId);
  const leftover = match.leftovers?.[userId] || null;
  const pickDone = Boolean(match.pickDone?.[userId]);
  const contextKey = `${match.matchId || ''}|augment_pick|${pickDone ? savedPicks.map((pick) => pick.cardId).join(',') : candidates.map((card) => card.cardId).join(',')}`;
  if (pvpDraftContextKey !== contextKey) {
    selectedPvpAugmentCardIds = pickDone ? savedPicks.map((pick) => pick.cardId) : [];
    pvpDraftSubmitting = false;
    pvpDraftContextKey = contextKey;
  }

  setText('pvpPhaseStatus', `증강 3대3 카드 선택 - 3장 중 2장을 선택하세요. 선택 후 남은 카드와 교체할 수 있습니다.`);
  const grid = document.getElementById('pvpCardGrid');
  if (!grid) return;

  if (pickDone) {
    const cardMap = new Map(candidates.map((card) => [card.cardId, card]));
    grid.innerHTML = `
      <div class="pvp-augment-leftover">
        <strong>남은 카드</strong>
        ${leftover ? `<div class="pvp-mini-card">${escapeHtml(cardMap.get(leftover.cardId)?.name || leftover.cardId)}</div>` : '<div class="menu-note">없음</div>'}
      </div>
      ${savedPicks.map((pick) => {
        const card = cardMap.get(pick.cardId) || pick;
        return `
          <button class="pvp-card-choice ${card.specialStyle === 'champion' ? 'champion-card' : ''}" ${leftover ? '' : 'disabled'} onclick="handlePvpAugmentSwap('${escapeAttr(pick.cardId)}')">
            <span class="pvp-card-grade" style="background:${escapeAttr(card.color || '#666666')}">${escapeHtml(card.grade || '')}</span>
            <div class="pvp-card-name">${escapeHtml(card.name || card.baseName || card.cardId)}</div>
            <div class="pvp-card-desc">${escapeHtml(card.skillDesc || '')}</div>
            <div class="menu-note">클릭하면 남은 카드와 교체</div>
          </button>
        `;
      }).join('')}
    `;
  } else {
    grid.innerHTML = candidates.map((card) => {
      const selected = selectedPvpAugmentCardIds.includes(card.cardId);
      const disabled = !selected && selectedPvpAugmentCardIds.length >= 2;
      return `
        <button class="pvp-card-choice ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${card.specialStyle === 'champion' ? 'champion-card' : ''}"
          ${disabled ? 'disabled' : ''}
          onclick="handlePvpAugmentCandidateSelect('${escapeAttr(card.cardId)}')">
          <span class="pvp-card-grade" style="background:${escapeAttr(card.color || '#666666')}">${escapeHtml(card.grade || '')}</span>
          <div class="pvp-card-name">${escapeHtml(card.name || card.baseName || card.cardId)}</div>
          <div class="pvp-card-desc">${escapeHtml(card.skillDesc || '')}</div>
          <div class="menu-note">+5 기준 / ${escapeHtml(card.durationText || '')}</div>
        </button>
      `;
    }).join('');
  }

  const actionBtn = document.getElementById('pvpDraftActionBtn');
  if (actionBtn) {
    actionBtn.textContent = pickDone ? '선택 완료' : '2장 확정';
    actionBtn.disabled = pickDone || selectedPvpAugmentCardIds.length !== 2 || pvpDraftSubmitting;
  }
  document.getElementById('pvpBetBtn')?.classList.add('hidden');
}

function handlePvpAugmentCandidateSelect(cardId) {
  const match = latestPvpState?.match;
  const user = getStoredUser();
  if (!match || !user?._id || match.phase !== 'augment_pick') return;
  const candidates = getMyAugmentCandidates(match, user._id);
  if (!candidates.some((card) => card.cardId === cardId)) return;
  if (selectedPvpAugmentCardIds.includes(cardId)) {
    selectedPvpAugmentCardIds = selectedPvpAugmentCardIds.filter((id) => id !== cardId);
  } else if (selectedPvpAugmentCardIds.length < 2) {
    selectedPvpAugmentCardIds = [...selectedPvpAugmentCardIds, cardId];
  }
  renderPvpState(latestPvpState, user);
}

async function handlePvpAugmentSwap(cardId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  try {
    const data = await postJson(`${API_URL}/api/pvp/augment-pick`, {
      userId: user._id,
      swapOutCardId: cardId,
      mode: selectedPvpMode
    });
    latestPvpState = data.pvp;
    renderPvpState(latestPvpState, user);
  } catch (err) {
    alert(err.message);
  }
}

function renderPvpAugmentSelection(battle, user) {
  showPvpScreen();
  document.getElementById('pvpDraftView')?.classList.remove('hidden');
  document.getElementById('pvpBattleView')?.classList.add('hidden');
  const userId = String(user?._id || '');
  const redPlayers = (battle.players || []).filter((player) => player.team === 'red');
  const bluePlayers = (battle.players || []).filter((player) => player.team === 'blue');
  renderPvpAugmentSidePanel('pvpMyPanel', redPlayers, '레드팀');
  renderPvpAugmentSidePanel('pvpEnemyPanel', bluePlayers, '블루팀');
  renderSpectatorPanel('pvpSpectatorPanel', 'pvpSpectatorList', battle.spectators || []);
  setText('pvpPhaseStatus', `증강 선택 - ${formatNumber(battle.augmentRound || 1)}턴 시작 증강을 고르세요.`);

  const grid = document.getElementById('pvpCardGrid');
  const me = (battle.players || []).find((player) => String(player.userId) === userId);
  const selected = battle.augmentSelected?.[userId];
  if (grid) {
    const options = Array.isArray(me?.augmentOptions) ? me.augmentOptions : [];
    grid.innerHTML = options.map((augment) => `
      <button class="pvp-augment-choice ${augment.tier || 'silver'} ${selected === augment.id ? 'selected' : ''}" ${selected ? 'disabled' : ''} onclick="handlePvpAugmentSelect('${escapeAttr(augment.id)}')">
        <span>${escapeHtml(getPvpAugmentTierLabel(augment.tier))}</span>
        <strong>${escapeHtml(augment.name || augment.id)}</strong>
        <p>${escapeHtml(augment.desc || '')}</p>
      </button>
    `).join('') || '<div class="menu-note">증강 선택 대기 중입니다.</div>';
  }
  const actionBtn = document.getElementById('pvpDraftActionBtn');
  if (actionBtn) {
    actionBtn.textContent = selected ? '선택 완료' : '증강을 선택하세요';
    actionBtn.disabled = true;
  }
  document.getElementById('pvpBetBtn')?.classList.add('hidden');
  const fakeMatch = { phase: 'augment', turnEndsAt: battle.augmentEndsAt };
  renderPvpDraftTimer(fakeMatch);
}

async function handlePvpAugmentSelect(augmentId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  try {
    const data = await postJson(`${API_URL}/api/pvp/augment-select`, {
      userId: user._id,
      augmentId,
      mode: selectedPvpMode
    });
    latestPvpState = data.pvp;
    renderPvpState(latestPvpState, user);
  } catch (err) {
    alert(err.message);
  }
}

function updatePvpMatchModal(pvpState) {
  syncPvpServerClock(pvpState);
  const user = getStoredUser();
  const match = pvpState?.match;
  const isParticipant = Boolean(match?.isParticipant);
  if (!match || match.phase !== 'accept' || !isParticipant) {
    hideModal('pvpMatchModal');
    if (pvpAcceptTicker) clearInterval(pvpAcceptTicker);
    pvpAcceptTicker = null;
    return;
  }

  const accepted = Boolean(match.accepted?.[user._id]);
  const acceptBtn = document.getElementById('pvpAcceptBtn');
  if (acceptBtn) acceptBtn.disabled = accepted;
  setText('pvpMatchText', accepted ? '상대의 입장을 기다리는 중입니다.' : '매칭 성공! 5초 안에 입장하기를 눌러주세요.');
  showModal('pvpMatchModal');

  const render = () => {
    const remaining = Math.max(0, Math.ceil((new Date(match.acceptEndsAt).getTime() - getPvpNowMs()) / 1000));
    setText('pvpAcceptCountdown', String(remaining));
  };
  if (!pvpAcceptTicker) pvpAcceptTicker = setInterval(render, 150);
  render();
}

function syncPvpServerClock(pvpState) {
  const serverNowMs = pvpState?.serverNow ? new Date(pvpState.serverNow).getTime() : NaN;
  if (Number.isFinite(serverNowMs)) {
    pvpServerClockOffsetMs = serverNowMs - Date.now();
  }
}

function getPvpNowMs() {
  return Date.now() + pvpServerClockOffsetMs;
}

function renderPvpState(pvpState, user) {
  if (!pvpState) return;
  if (pvpState.mode) selectedPvpMode = normalizePvpModeClient(pvpState.mode);
  syncPvpServerClock(pvpState);
  if (pvpState.match) {
    if (isPvpAugmentMode(pvpState.match.mode)) {
      renderPvpAugmentDraft(pvpState.match, user);
    } else {
      renderPvpDraft(pvpState.match, user);
    }
  } else if (pvpState.battle) {
    if (isPvpAugmentMode(pvpState.battle.mode)) {
      if (pvpState.battle.phase === 'augment') {
        renderPvpAugmentSelection(pvpState.battle, user);
      } else {
        renderPvpAugmentBattle(pvpState.battle, user);
      }
    } else {
      renderPvpBattle(pvpState.battle, user);
    }
  } else {
    if (pvpTurnTicker) clearInterval(pvpTurnTicker);
    pvpTurnTicker = null;
    document.getElementById('pvpDraftView')?.classList.remove('hidden');
    document.getElementById('pvpBattleView')?.classList.add('hidden');
    hideSpectatorPanel('pvpSpectatorPanel');
    setText('pvpPhaseStatus', pvpState.isQueued ? `개인면담 대기열에 등록되었습니다. 현재 대기 ${pvpState.queueCount || 1}명` : '진행 중인 개인면담이 없습니다.');
  }
}

function getPvpPerspectivePlayers(players = [], userId) {
  const self = players.find((player) => String(player.userId) === String(userId)) || players[0] || null;
  const enemy = players.find((player) => !self || String(player.userId) !== String(self.userId)) || null;
  return { self, enemy };
}

function renderPvpSidePanel(panelId, player, match, userId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  if (!player) {
    panel.innerHTML = '<div class="pvp-side-name">대기 중</div>';
    return;
  }
  const bans = (match.bans?.[player.userId] || []).map((cardId) => {
    const card = match.allCards?.find((entry) => entry.cardId === cardId);
    return card?.baseName || card?.name || CARD_DATA[cardId]?.name || cardId;
  });
  const picks = (match.picks?.[player.userId] || []).map((pick) => {
    const card = match.ownedCards?.find((entry) => entry.cardId === pick.cardId && Number(entry.enhancementLevel || 0) === Number(pick.enhancementLevel || 0))
      || match.allCards?.find((entry) => entry.cardId === pick.cardId)
      || {};
    return {
      name: `${card.baseName || CARD_DATA[pick.cardId]?.name || pick.cardId}${pick.enhancementLevel ? ` +${pick.enhancementLevel}` : ''}`,
      specialStyle: card.specialStyle || CARD_DATA[pick.cardId]?.specialStyle || ''
    };
  });
  panel.innerHTML = `
    <div class="pvp-side-name">${escapeHtml(player.userId === String(userId) ? '내 진영' : '상대 진영')} - ${compactDisplayHtml(player.displayName || '', 16)}</div>
    <strong>금지 카드</strong>
    <div class="pvp-ban-list">${bans.map((name) => `<div class="pvp-mini-card">${escapeHtml(name)}</div>`).join('') || '<div class="menu-note">아직 없음</div>'}</div>
    <strong>선택 카드</strong>
    <div class="pvp-pick-list">${picks.map((pick) => `<div class="pvp-mini-card ${pick.specialStyle === 'champion' ? 'champion-card' : ''}">${escapeHtml(pick.name)}</div>`).join('') || '<div class="menu-note">아직 없음</div>'}</div>
  `;
}

function renderPvpDraft(match, user) {
  showPvpScreen();
  document.getElementById('pvpDraftView')?.classList.remove('hidden');
  document.getElementById('pvpBattleView')?.classList.add('hidden');
  if (pvpTurnTicker) clearInterval(pvpTurnTicker);
  pvpTurnTicker = null;
  const draftContextKey = [
    match.matchId || '',
    match.phase || '',
    match.turnUserId || '',
    Number(match.pickTurnIndex || 0),
    (match.bannedCardIds || []).join(','),
    (match.pickedCardIds || []).join(',')
  ].join('|');
  if (pvpDraftContextKey !== draftContextKey) {
    selectedPvpCardId = null;
    selectedPvpEnhancementLevel = 0;
    pvpDraftSubmitting = false;
    pvpDraftContextKey = draftContextKey;
  }
  const phaseText = match.phase === 'ban' ? '1. 금지' : match.phase === 'pick' ? (match.isRanked ? '2. 선택' : '카드 선택') : match.phase === 'starting' ? '전투 시작 준비' : '입장 확인';
  const myTurn = match.isMyTurn;
  const turnPlayer = (match.players || []).find((player) => player.userId === match.turnUserId);
  const turnText = match.isParticipant
    ? (myTurn ? '내 차례입니다.' : '상대 차례입니다.')
    : `${turnPlayer?.displayName || '플레이어'}의 차례입니다.`;
  setText('pvpPhaseStatus', `${match.modeLabel || '개인면담'} ${phaseText} - ${turnText}`);

  const { self, enemy } = getPvpPerspectivePlayers(match.players || [], user._id);
  renderPvpSidePanel('pvpMyPanel', self, match, user._id);
  renderPvpSidePanel('pvpEnemyPanel', enemy, match, user._id);
  renderSpectatorPanel('pvpSpectatorPanel', 'pvpSpectatorList', match.spectators || []);
  renderPvpDraftTimer(match);
  renderPvpCountdown(match);

  const bannedSet = new Set(match.bannedCardIds || []);
  const pickedSet = new Set(match.pickedCardIds || []);
  const isBan = match.phase === 'ban';
  const cards = isBan ? (match.allCards || []) : (match.ownedCards || []);
  const isCardSelectable = (card) => myTurn
    && !bannedSet.has(card.cardId)
    && !pickedSet.has(card.cardId)
    && match.phase !== 'starting'
    && match.phase !== 'accept';
  if (selectedPvpCardId && !cards.some((card) => (
    isCardSelectable(card)
    && selectedPvpCardId === card.cardId
    && Number(selectedPvpEnhancementLevel || 0) === Number(card.enhancementLevel || 0)
  ))) {
    selectedPvpCardId = null;
    selectedPvpEnhancementLevel = 0;
  }
  const grid = document.getElementById('pvpCardGrid');
  if (!grid) return;
  grid.innerHTML = cards.map((card) => {
    const disabled = !isCardSelectable(card);
    const selected = selectedPvpCardId === card.cardId && Number(selectedPvpEnhancementLevel || 0) === Number(card.enhancementLevel || 0);
    return `
      <button class="pvp-card-choice ${card.specialStyle === 'champion' ? 'champion-card' : ''} ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${bannedSet.has(card.cardId) ? 'banned' : ''}"
        ${disabled ? 'disabled' : ''}
        onclick="handlePvpCardSelect('${escapeAttr(card.cardId)}', ${Number(card.enhancementLevel || 0)})">
        <span class="pvp-card-grade" style="background:${escapeAttr(card.color || '#666666')}">${escapeHtml(card.grade || '')}</span>
        <div class="pvp-card-name">${escapeHtml(card.name || card.baseName || card.cardId)}</div>
        <div class="pvp-card-desc">${escapeHtml(card.skillDesc || '')}</div>
        <div class="menu-note">쿨타임 ${formatNumber(card.cooldown || 0)}턴 / ${escapeHtml(card.durationText || '')}</div>
      </button>
    `;
  }).join('');

  const actionBtn = document.getElementById('pvpDraftActionBtn');
  if (actionBtn) {
    actionBtn.textContent = isBan ? '금지하기' : '선택하기';
    actionBtn.disabled = !myTurn || !selectedPvpCardId || match.phase === 'starting' || pvpDraftSubmitting;
  }
  const betBtn = document.getElementById('pvpBetBtn');
  if (betBtn) {
    const canBet = Boolean(match.canBet && !match.currentBet && ['ban', 'pick'].includes(match.phase));
    betBtn.classList.toggle('hidden', !canBet);
    betBtn.disabled = !canBet;
  }
}

function renderPvpDraftTimer(match) {
  const timerEl = document.getElementById('pvpDraftTimer');
  if (!timerEl) return;
  const targetAt = match.phase === 'starting' ? match.startsAt : match.turnEndsAt;
  const render = () => {
    const remaining = targetAt ? Math.max(0, Math.ceil((new Date(targetAt).getTime() - getPvpNowMs()) / 1000)) : 0;
    timerEl.textContent = match.phase === 'starting' ? `시작 ${remaining}` : String(remaining);
  };
  if (pvpDraftTicker) clearInterval(pvpDraftTicker);
  pvpDraftTicker = setInterval(render, 200);
  render();
}

function renderPvpCountdown(match) {
  const overlay = document.getElementById('pvpCountdownOverlay');
  if (!overlay) return;
  if (match.phase !== 'starting' || !match.startsAt) {
    overlay.classList.add('hidden');
    return;
  }
  overlay.classList.remove('hidden');
  const render = () => {
    const remaining = Math.max(1, Math.ceil((new Date(match.startsAt).getTime() - getPvpNowMs()) / 1000));
    setText('pvpCountdownNumber', String(remaining));
  };
  if (pvpStartTicker) clearInterval(pvpStartTicker);
  pvpStartTicker = setInterval(render, 150);
  render();
}

function isPvpAugmentAllyCard(card = {}) {
  const allyTargets = new Set(['ally', 'ally_pair']);
  const allyEffects = new Set([
    'party_shield', 'party_heal', 'target_heal', 'target_missing_hp_heal',
    'target_taunt_damage_reduction', 'target_attack_buff', 'target_debuff_guard',
    'champion_guard', 'party_cooldown_reduce', 'random_party_negate_hit',
    'party_negate_hit_by_level', 'party_bread_buff', 'party_cleanse',
    'party_crit_bonus', 'party_hype_crit', 'random_party_attack_buff',
    'random_party_negate_hit', 'self_counter', 'self_celine_buff',
    'self_negate_hit', 'self_debuff_reflect'
  ]);
  return allyTargets.has(card.targetType) || allyEffects.has(card.effectType);
}

function getPvpAugmentTargets(battle, actor, card = null, actionType = 'basic') {
  const players = Array.isArray(battle?.players) ? battle.players : [];
  const wantsAlly = actionType === 'skill' && isPvpAugmentAllyCard(card);
  return players.filter((player) => {
    if (Number(player.hp || 0) <= 0) return false;
    return wantsAlly ? player.team === actor.team : player.team !== actor.team;
  });
}

function ensurePvpAugmentTargetPicker() {
  let picker = document.getElementById('pvpAugmentTargetPicker');
  if (!picker) {
    picker = document.createElement('div');
    picker.id = 'pvpAugmentTargetPicker';
    picker.className = 'pvp-augment-target-picker hidden';
    document.getElementById('pvp-screen')?.appendChild(picker);
  }
  return picker;
}

function closePvpAugmentTargetPicker() {
  document.getElementById('pvpAugmentTargetPicker')?.classList.add('hidden');
}

function openPvpAugmentTargetPicker(actionType, cardIndex = null) {
  const user = getStoredUser();
  const battle = latestPvpState?.battle;
  const actor = (battle?.players || []).find((player) => String(player.userId) === String(user?._id || ''));
  if (!battle || !actor || actor.hp <= 0 || battle.phase !== 'active') return;
  const card = actionType === 'skill' ? actor.cards?.[Number(cardIndex)] : null;
  if (actionType === 'skill' && (!card || card.passiveOnly || Number(card.cooldownRemaining || 0) > 0)) return;
  const targets = getPvpAugmentTargets(battle, actor, card, actionType);
  const picker = ensurePvpAugmentTargetPicker();
  picker.innerHTML = `
    <div class="pvp-augment-target-panel">
      <strong>${actionType === 'skill' ? escapeHtml(card?.name || '카드') : '기본공격'} 대상 선택</strong>
      <div class="pvp-augment-target-list">
        ${targets.map((target) => `
          <button class="mini-btn" onclick="handlePvpAugmentAction('${escapeAttr(actionType)}', ${cardIndex === null ? 'null' : Number(cardIndex)}, '${escapeAttr(target.userId)}')">
            ${escapeHtml(target.displayName || '')} HP ${formatNumber(target.hp || 0)}
          </button>
        `).join('') || '<span class="menu-note">선택 가능한 대상이 없습니다.</span>'}
      </div>
      <button class="mini-btn" onclick="closePvpAugmentTargetPicker()">취소</button>
    </div>
  `;
  picker.classList.remove('hidden');
}

async function handlePvpAugmentAction(actionType, cardIndex, targetUserId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  closePvpAugmentTargetPicker();
  try {
    const payload = {
      userId: user._id,
      type: actionType === 'skill' ? 'skill' : 'basic',
      targetUserId,
      mode: selectedPvpMode
    };
    if (actionType === 'skill') payload.cardIndex = Number(cardIndex);
    const data = await postJson(`${API_URL}/api/pvp/augment-action`, payload);
    latestPvpState = data.pvp;
    renderPvpState(latestPvpState, user);
  } catch (err) {
    alert(err.message);
  }
}

function renderPvpAugmentBattlePanel(panelId, players = [], battle, user) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const currentUserId = String(battle.currentUserId || '');
  panel.innerHTML = `
    <div class="pvp-augment-team-grid">
      ${players.map((player) => renderPvpAugmentPlayerBattleCard(player, battle, user, currentUserId)).join('')}
    </div>
  `;
  players.forEach((player) => {
    const bar = panel.querySelector(`[data-pvp-augment-hp="${CSS.escape(String(player.userId))}"]`);
    const hpRatio = player.maxHp > 0 ? Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100)) : 0;
    const shieldRatio = player.maxHp > 0 ? Math.max(0, Math.min(100, (player.shield / player.maxHp) * 100)) : 0;
    updatePvpAnimatedBar(bar, `${battle.battleId || 'augment'}:${player.userId}`, {
      hpRatio,
      shieldRatio,
      lossText: (Number(player.lastHpLoss || 0) + Number(player.lastShieldLoss || 0)) > 0 ? `-${formatNumber(Number(player.lastHpLoss || 0) + Number(player.lastShieldLoss || 0))}` : '',
      trailDelayMs: 650
    });
  });
}

function renderPvpAugmentPlayerBattleCard(player, battle, user, currentUserId) {
  const isSelf = String(player.userId) === String(user?._id || '');
  const isCurrent = String(player.userId) === currentUserId;
  const effects = (player.statusEffects || []).map((effect) => `
    <span class="raid-effect-badge ${effect.type === 'debuff' ? 'raid-effect-debuff' : 'raid-effect-buff'}" title="${escapeAttr(effect.desc || '')}">
      ${escapeHtml(effect.name)}${effect.turns ? ` ${formatNumber(effect.turns)}턴` : ''}${effect.count ? ` ${formatNumber(effect.count)}회` : ''}
    </span>
  `).join('');
  const actionButtons = isSelf && battle.isParticipant && player.hp > 0 ? `
    <div class="pvp-augment-actions">
      <button class="pvp-card-skill-btn pvp-basic-turn-btn" onclick="openPvpAugmentTargetPicker('basic')">기본공격</button>
      ${(player.cards || []).map((card, index) => `
        <button class="pvp-card-skill-btn" ${card.passiveOnly || Number(card.cooldownRemaining || 0) > 0 ? 'disabled' : ''} title="${escapeAttr(card.skillDesc || '')}" onclick="openPvpAugmentTargetPicker('skill', ${index})">
          ${escapeHtml(card.name || card.baseName || '')}
          ${Number(card.cooldownRemaining || 0) > 0 ? `<br>쿨 ${formatNumber(card.cooldownRemaining)}` : ''}
        </button>
      `).join('')}
    </div>
  ` : '';
  return `
    <div class="pvp-augment-player-card ${player.team || ''} ${isSelf ? 'self' : ''} ${isCurrent ? 'active-turn' : ''} ${player.hp <= 0 ? 'dead' : ''}">
      <strong>${escapeHtml(player.displayName || '')}</strong>
      <div class="pvp-hp-row">
        <span>HP</span>
        <div class="pvp-hp-bar" data-pvp-augment-hp="${escapeAttr(player.userId)}"></div>
        <span>${formatNumber(player.hp || 0)} / ${formatNumber(player.maxHp || 300)}</span>
      </div>
      <div class="menu-note">보호막 ${formatNumber(player.shield || 0)} / ${formatNumber(player.kills || 0)}킬 ${formatNumber(player.deaths || 0)}데스</div>
      <div class="pvp-effect-list">${effects || '<span class="muted-text">버프/디버프 없음</span>'}</div>
      ${player.pendingAction ? '<div class="pvp-augment-ready">다음 행동 예약됨</div>' : ''}
      ${actionButtons}
    </div>
  `;
}

function renderPvpAugmentBattle(battle, user) {
  showPvpScreen();
  document.getElementById('pvpDraftView')?.classList.add('hidden');
  document.getElementById('pvpBattleView')?.classList.remove('hidden');
  document.getElementById('pvpCountdownOverlay')?.classList.add('hidden');
  closePvpAugmentTargetPicker();
  const redPlayers = (battle.players || []).filter((player) => player.team === 'red');
  const bluePlayers = (battle.players || []).filter((player) => player.team === 'blue');
  const current = (battle.players || []).find((player) => player.userId === battle.currentUserId);
  setText('pvpPhaseStatus', `증강 3대3 - 레드 ${formatNumber(battle.teamKills?.red || 0)} / 블루 ${formatNumber(battle.teamKills?.blue || 0)} / 목표 ${formatNumber(battle.killTarget || 10)}킬`);
  setText('pvpBattleTurnLabel', `현재 ${formatNumber(battle.roundNumber || battle.turnNumber || 1)}턴`);
  setText('pvpBattleTurnActor', current ? `${current.team === 'red' ? '레드' : '블루'} ${current.teamSlot + 1}P - ${current.displayName} 행동` : '행동 대기');
  updatePvpTurnTimer();
  if (!pvpTurnTicker) pvpTurnTicker = setInterval(updatePvpTurnTimer, 200);
  renderPvpAugmentBattlePanel('pvpEnemyBattlePanel', bluePlayers, battle, user);
  renderPvpAugmentBattlePanel('pvpMyBattlePanel', redPlayers, battle, user);
  renderSpectatorPanel('pvpSpectatorPanel', 'pvpSpectatorList', battle.spectators || []);
  renderPvpBattleLog(battle);
  maybeShowPvpResult(battle, user);
  maybeReturnPvpSpectatorAfterFinish(battle);
}

function handlePvpCardSelect(cardId, enhancementLevel = 0) {
  const match = latestPvpState?.match;
  if (!match || !match.isMyTurn || match.phase === 'starting' || match.phase === 'accept') return;
  const bannedSet = new Set(match.bannedCardIds || []);
  const pickedSet = new Set(match.pickedCardIds || []);
  const cards = match.phase === 'ban' ? (match.allCards || []) : (match.ownedCards || []);
  const available = cards.some((card) => (
    card.cardId === cardId
    && Number(card.enhancementLevel || 0) === Number(enhancementLevel || 0)
    && !bannedSet.has(card.cardId)
    && !pickedSet.has(card.cardId)
  ));
  if (!available) return;
  selectedPvpCardId = cardId;
  selectedPvpEnhancementLevel = Number(enhancementLevel || 0);
  renderPvpState(latestPvpState, getStoredUser());
}

async function handlePvpDraftAction() {
  const user = getStoredUser();
  if (!user?._id || !latestPvpState?.match) return;
  const match = latestPvpState.match;
  if (isPvpAugmentMode(match.mode)) {
    if (pvpDraftSubmitting || match.phase !== 'augment_pick' || selectedPvpAugmentCardIds.length !== 2) return;
    pvpDraftSubmitting = true;
    renderPvpState(latestPvpState, user);
    try {
      const data = await postJson(`${API_URL}/api/pvp/augment-pick`, {
        userId: user._id,
        cardIds: selectedPvpAugmentCardIds,
        mode: selectedPvpMode
      });
      latestPvpState = data.pvp;
      pvpDraftSubmitting = false;
      renderPvpState(latestPvpState, user);
    } catch (err) {
      pvpDraftSubmitting = false;
      if (err.pvp) latestPvpState = err.pvp;
      renderPvpState(latestPvpState, user);
      alert(err.message);
    }
    return;
  }
  if (!selectedPvpCardId) return;
  if (pvpDraftSubmitting || !match.isMyTurn || !['ban', 'pick'].includes(match.phase)) return;
  const bannedSet = new Set(match.bannedCardIds || []);
  const pickedSet = new Set(match.pickedCardIds || []);
  const cards = match.phase === 'ban' ? (match.allCards || []) : (match.ownedCards || []);
  const selectedStillAvailable = cards.some((card) => (
    card.cardId === selectedPvpCardId
    && Number(card.enhancementLevel || 0) === Number(selectedPvpEnhancementLevel || 0)
    && !bannedSet.has(card.cardId)
    && !pickedSet.has(card.cardId)
  ));
  if (!selectedStillAvailable) return;
  const endpoint = match.phase === 'ban' ? 'ban' : 'pick';
  pvpDraftSubmitting = true;
  renderPvpState(latestPvpState, user);
  try {
    const data = await postJson(`${API_URL}/api/pvp/${endpoint}`, {
      userId: user._id,
      cardId: selectedPvpCardId,
      enhancementLevel: selectedPvpEnhancementLevel,
      matchId: match.matchId,
      phase: match.phase,
      mode: selectedPvpMode
    });
    latestPvpState = data.pvp;
    selectedPvpCardId = null;
    selectedPvpEnhancementLevel = 0;
    pvpDraftSubmitting = false;
    renderPvpState(latestPvpState, user);
  } catch (err) {
    pvpDraftSubmitting = false;
    if (err.pvp) {
      latestPvpState = err.pvp;
      selectedPvpCardId = null;
      selectedPvpEnhancementLevel = 0;
      updatePvpButton(user, latestPvpState);
      updatePvpMatchModal(latestPvpState);
    }
    renderPvpState(latestPvpState, user);
    const syncOnlyMessages = ['아직 내 차례가 아닙니다.', '시간이 초과되어 자동 진행되었습니다.'];
    if (!err.pvp || !syncOnlyMessages.includes(err.message)) {
      alert(err.message);
    }
  }
}

function openPvpBetModal() {
  const match = latestPvpState?.match;
  if (!match?.canBet || match.currentBet) return;
  pvpBetTargetUserId = null;
  const choices = document.getElementById('pvpBetChoices');
  const amountInput = document.getElementById('pvpBetAmountInput');
  const status = document.getElementById('pvpBetStatus');
  if (amountInput) amountInput.value = '';
  if (status) status.textContent = '배팅할 참가자와 금액을 선택해주세요.';
  if (choices) {
    choices.innerHTML = (match.players || []).map((player) => `
      <button type="button" class="pvp-bet-choice" onclick="handlePvpBetTargetSelect('${escapeAttr(player.userId)}')">
        ${escapeHtml(player.displayName || '플레이어')}
      </button>
    `).join('');
  }
  showModal('pvpBetModal');
}

function closePvpBetModal() {
  pvpBetTargetUserId = null;
  hideModal('pvpBetModal');
}

function handlePvpBetTargetSelect(userId) {
  pvpBetTargetUserId = String(userId || '');
  document.querySelectorAll('.pvp-bet-choice').forEach((button) => {
    button.classList.toggle('selected', button.getAttribute('onclick')?.includes(pvpBetTargetUserId));
  });
}

async function handlePvpBetConfirm() {
  const user = getStoredUser();
  const match = latestPvpState?.match;
  const amount = Math.floor(Number(document.getElementById('pvpBetAmountInput')?.value) || 0);
  if (!user?._id || !match) return;
  if (!pvpBetTargetUserId) return alert('배팅할 참가자를 선택해주세요.');
  if (!Number.isFinite(amount) || amount <= 0) return alert('배팅 금액을 입력해주세요.');

  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/pvp/bet`, {
      userId: user._id,
      targetUserId: pvpBetTargetUserId,
      amount,
      mode: selectedPvpMode
    }));
    updateLocalUserState(data);
    latestPvpState = data.pvp;
    closePvpBetModal();
    renderPvpState(latestPvpState, getStoredUser());
  } catch (err) {
    if (err.pvp) {
      latestPvpState = err.pvp;
      renderPvpState(latestPvpState, user);
    }
    alert(err.message);
  }
}

function updatePvpTurnTimer() {
  const timer = document.getElementById('pvpTurnTimer');
  const battle = latestPvpState?.battle;
  if (!timer || !battle || battle.phase !== 'active' || !battle.turnEndsAt) {
    if (timer) timer.textContent = '';
    return;
  }
  const remaining = Math.max(0, Math.ceil((new Date(battle.turnEndsAt).getTime() - getPvpNowMs()) / 1000));
  timer.textContent = String(remaining);
  timer.classList.toggle('urgent', remaining <= 5);
}

function renderPvpBattle(battle, user) {
  showPvpScreen();
  document.getElementById('pvpDraftView')?.classList.add('hidden');
  document.getElementById('pvpBattleView')?.classList.remove('hidden');
  document.getElementById('pvpCountdownOverlay')?.classList.add('hidden');
  const { self, enemy } = getPvpPerspectivePlayers(battle.players || [], user._id);
  const current = (battle.players || []).find((player) => player.userId === battle.currentUserId);
  setText('pvpPhaseStatus', battle.phase === 'finished' ? '개인면담 종료' : `현재 턴 ${formatNumber(battle.turnNumber || 1)}`);
  setText('pvpBattleTurnLabel', `현재 턴 ${formatNumber(battle.turnNumber || 1)}`);
  setText('pvpBattleTurnActor', current ? `${current.displayName} 행동` : '행동 대기');
  updatePvpTurnTimer();
  if (!pvpTurnTicker) pvpTurnTicker = setInterval(updatePvpTurnTimer, 200);
  const canControlSelf = Boolean(battle.isParticipant && self && String(self.userId) === String(user._id));
  renderPvpBattlePanel('pvpEnemyBattlePanel', enemy, false, battle);
  renderPvpBattlePanel('pvpMyBattlePanel', self, canControlSelf, battle);
  renderSpectatorPanel('pvpSpectatorPanel', 'pvpSpectatorList', battle.spectators || []);
  renderPvpBattleLog(battle);
  maybeShowPvpResult(battle, user);
  maybeReturnPvpSpectatorAfterFinish(battle);
}

function renderPvpBattlePanel(panelId, player, isSelfPanel, battle) {
  const panel = document.getElementById(panelId);
  if (!panel || !player) return;
  const hpRatio = player.maxHp > 0 ? Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100)) : 0;
  const shieldRatio = player.maxHp > 0 ? Math.max(0, Math.min(100, (player.shield / player.maxHp) * 100)) : 0;
  const isCurrentTurn = battle.phase === 'active' && String(battle.currentUserId) === String(player.userId);
  const isMyTurn = isSelfPanel && isCurrentTurn;
  panel.classList.toggle('active-turn', isCurrentTurn);
  const effects = (player.statusEffects || []).map((effect) => `
    <div class="raid-effect-badge ${effect.type === 'debuff' ? 'raid-effect-debuff' : 'raid-effect-buff'}" title="${escapeAttr(effect.desc || '')}">
      <div class="raid-effect-name">${escapeHtml(effect.name)}${effect.turns ? ` (${formatNumber(effect.turns)}턴)` : ''}${effect.count ? ` (${formatNumber(effect.count)}회)` : ''}</div>
      ${effect.desc ? `<div class="raid-effect-desc">${escapeHtml(effect.desc)}</div>` : ''}
    </div>
  `).join('');
  const cardButtons = (player.cards || []).map((card, index) => {
    const opponent = (battle.players || []).find((entry) => String(entry.userId) !== String(player.userId));
    const canResolveOvertime = card.cardId === 'hoi_overtime'
      && (opponent?.statusEffects || []).some((effect) => effect.id === 'overtime');
    const coolingDown = Number(card.cooldownRemaining || 0) > 0;
    const disabled = !isSelfPanel || battle.phase === 'finished' || card.passiveOnly || (coolingDown && !canResolveOvertime);
    const planned = Number(player.plannedCardIndex) === index;
    return `
      <button class="pvp-card-skill-btn ${planned ? 'planned' : ''}" ${disabled ? 'disabled' : ''} title="${escapeAttr(card.skillDesc || '')}" onclick="handlePvpPlanSkill(${index})">
        ${escapeHtml(card.name || card.baseName || '')}
        ${coolingDown ? `<br>${canResolveOvertime ? '폭발 가능' : `쿨 ${formatNumber(card.cooldownRemaining)}`}` : ''}
      </button>
    `;
  }).join('');
  const basicOnlyButton = isSelfPanel ? `
    <button class="pvp-card-skill-btn pvp-basic-turn-btn" ${!isMyTurn || player.hp <= 0 ? 'disabled' : ''} onclick="handlePvpBasicOnlyTurn()">
      스킬 없이 기본공격
    </button>
  ` : '';
  const lossAmount = Number(player.lastHpLoss || 0) + Number(player.lastShieldLoss || 0);
  const lossText = lossAmount > 0 ? `-${formatNumber(lossAmount)}` : '';
  panel.innerHTML = `
    <strong>${escapeHtml(player.displayName || '')}</strong>
    <div class="pvp-hp-row">
      <span>HP</span>
      <div class="pvp-hp-bar" data-pvp-hp-bar></div>
      <span>${formatNumber(player.hp)} / ${formatNumber(player.maxHp)}</span>
    </div>
    <div class="menu-note">보호막 ${formatNumber(player.shield || 0)}</div>
    <div class="pvp-effect-title">버프 / 디버프</div>
    <div class="pvp-effect-list">${effects || '<span class="muted-text">버프 / 디버프 없음</span>'}</div>
    <div class="pvp-card-button-list">${basicOnlyButton}${cardButtons}</div>
  `;
  updatePvpAnimatedBar(panel.querySelector('[data-pvp-hp-bar]'), `${battle.battleId || 'pvp'}:${player.userId}`, {
    hpRatio,
    shieldRatio,
    lossText,
    trailDelayMs: 650
  });
}

function renderPvpBattleLog(battle) {
  const log = document.getElementById('pvpBattleLog');
  if (!log) return;
  const latestLine = (battle.recentLogs || [])[0] || '';
  const nextSignature = `${battle.battleId}:${latestLine}`;
  if (latestLine && lastPvpLogSignature && lastPvpLogSignature !== nextSignature) {
    playPvpSfx(latestLine.includes('스킬') ? 'skill' : latestLine.includes('피해') ? 'hit' : 'skill');
  }
  if (latestLine) lastPvpLogSignature = nextSignature;
  log.innerHTML = (battle.recentLogs || [])
    .map((line, index) => `<div class="raid-log-line ${index === 0 ? 'latest' : ''}">${escapeHtml(line)}</div>`)
    .join('');
}

async function handlePvpPlanSkill(index) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  try {
    const data = await postJson(`${API_URL}/api/pvp/plan-skill`, {
      userId: user._id,
      cardIndex: index,
      mode: selectedPvpMode
    });
    latestPvpState = data.pvp;
    renderPvpState(latestPvpState, user);
  } catch (err) {
    alert(err.message);
  }
}

async function handlePvpBasicOnlyTurn() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  try {
    const data = await postJson(`${API_URL}/api/pvp/end-turn`, { userId: user._id, mode: selectedPvpMode });
    latestPvpState = data.pvp;
    renderPvpState(latestPvpState, user);
  } catch (err) {
    alert(err.message);
  }
}

function maybeShowPvpResult(battle, user) {
  if (!battle || battle.phase !== 'finished' || !battle.isParticipant) return;
  if (lastPvpResultShownBattleId === battle.battleId) return;
  lastPvpResultShownBattleId = battle.battleId;
  const won = String(battle.winnerUserId) === String(user._id);
  playPvpSfx('result');
  const ratingDelta = won ? battle.ratingChange?.winnerDelta : battle.ratingChange?.loserDelta;
  const ratingText = Number.isFinite(Number(ratingDelta)) ? `\n점수 변동: ${ratingDelta > 0 ? '+' : ''}${formatNumber(ratingDelta)}점` : '';
  alert(`${won ? 'WIN! 개인면담에서 승리했습니다.' : 'LOSE! 개인면담에서 패배했습니다.'}${ratingText}`);
  if (pvpResultReturnTimer) clearTimeout(pvpResultReturnTimer);
  pvpResultReturnTimer = setTimeout(() => {
    if (!document.getElementById('pvp-screen')?.classList.contains('hidden')) {
      handlePvpBackClick();
    }
  }, 10000);
}

function maybeReturnPvpSpectatorAfterFinish(battle) {
  if (!battle || battle.phase !== 'finished' || battle.isParticipant) return;
  if (lastPvpSpectatorReturnBattleId === battle.battleId) return;
  lastPvpSpectatorReturnBattleId = battle.battleId;
  if (pvpSpectatorReturnTimer) clearTimeout(pvpSpectatorReturnTimer);
  pvpSpectatorReturnTimer = setTimeout(() => {
    if (!document.getElementById('pvp-screen')?.classList.contains('hidden')) {
      handlePvpBackClick();
    }
  }, 1500);
}


function isEquipmentEnhanceModalOpen() {
  const modal = document.getElementById('equipmentEnhanceModal');
  return modal && !modal.classList.contains('hidden');
}

function isEquipmentDismantleModalOpen() {
  const modal = document.getElementById('equipmentDismantleModal');
  return modal && !modal.classList.contains('hidden');
}

function getEquipmentScrollItemIds() {
  return ['scroll_card_005', 'scroll_card_01', 'scroll_card_025', 'scroll_attack_01', 'scroll_attack_02', 'scroll_attack_05'];
}

function getEquipmentScrollQuantity(user, itemId) {
  return getInventoryQuantityFromUser(user, itemId);
}

function getEquipmentUpgradeCount(equipment) {
  return Math.max(0, 7 - Number(equipment?.upgradesLeft ?? 7));
}

function getEquipmentTypedStat(equipment, equipmentType) {
  return equipment?.equipmentType === equipmentType ? Number(equipment.statValue || 0) : 0;
}

function getEquipmentSortLabel(mode = equipmentSortMode) {
  const labels = {
    attack_desc: '공격력 높은 순',
    attack_asc: '공격력 낮은 순',
    card_desc: '스킬 증폭 높은 순',
    card_asc: '스킬 증폭 낮은 순',
    upgrade_desc: '강화 높은 순',
    acquired: '획득 순'
  };
  return labels[mode] || labels.acquired;
}

function getSortedEquipmentDetails(equipments, sortMode = equipmentSortMode) {
  const indexed = (equipments || []).map((equipment, index) => ({ equipment, index }));
  const tieBreakByAcquired = (left, right) => left.index - right.index;
  const compareByValue = (left, right, getValue, direction = 'desc') => {
    const leftValue = getValue(left.equipment);
    const rightValue = getValue(right.equipment);
    if (leftValue === rightValue) return tieBreakByAcquired(left, right);
    const diff = leftValue - rightValue;
    if (diff !== 0) return direction === 'asc' ? diff : -diff;
    return tieBreakByAcquired(left, right);
  };

  indexed.sort((left, right) => {
    switch (sortMode) {
      case 'attack_desc':
        return compareByValue(left, right, (equipment) => equipment?.equipmentType === 'basic_attack' ? getEquipmentTypedStat(equipment, 'basic_attack') : -1, 'desc');
      case 'attack_asc':
        return compareByValue(left, right, (equipment) => equipment?.equipmentType === 'basic_attack' ? getEquipmentTypedStat(equipment, 'basic_attack') : Number.POSITIVE_INFINITY, 'asc');
      case 'card_desc':
        return compareByValue(left, right, (equipment) => equipment?.equipmentType === 'card_effect' ? getEquipmentTypedStat(equipment, 'card_effect') : -1, 'desc');
      case 'card_asc':
        return compareByValue(left, right, (equipment) => equipment?.equipmentType === 'card_effect' ? getEquipmentTypedStat(equipment, 'card_effect') : Number.POSITIVE_INFINITY, 'asc');
      case 'upgrade_desc':
        return compareByValue(left, right, getEquipmentUpgradeCount, 'desc');
      case 'acquired':
      default:
        return tieBreakByAcquired(left, right);
    }
  });

  return indexed.map(({ equipment }) => equipment);
}

function getCardGradeOrder(grade) {
  return ({ S: 0, A: 1, B: 2, C: 3 })[grade] ?? 9;
}

function getCardSortLabel() {
  const labels = {
    grade: '등급순',
    enhance_desc: '강화 높은 순',
    enhance_asc: '강화 낮은 순',
    name: '이름순'
  };
  return labels[cardSortMode] || labels.grade;
}

function getFilteredSortedCardDetails(user) {
  const cards = (user?.cardVariantDetails || [])
    .filter((card) => Number(card.quantity || 0) > 0)
    .filter((card) => cardGradeFilter === 'all' || card.grade === cardGradeFilter);

  return cards.sort((a, b) => {
    if (cardSortMode === 'enhance_desc') {
      return Number(b.enhancementLevel || 0) - Number(a.enhancementLevel || 0)
        || getCardGradeOrder(a.grade) - getCardGradeOrder(b.grade)
        || String(a.baseName || a.name || '').localeCompare(String(b.baseName || b.name || ''), 'ko');
    }

    if (cardSortMode === 'enhance_asc') {
      return Number(a.enhancementLevel || 0) - Number(b.enhancementLevel || 0)
        || getCardGradeOrder(a.grade) - getCardGradeOrder(b.grade)
        || String(a.baseName || a.name || '').localeCompare(String(b.baseName || b.name || ''), 'ko');
    }

    if (cardSortMode === 'name') {
      return String(a.baseName || a.name || '').localeCompare(String(b.baseName || b.name || ''), 'ko')
        || Number(a.enhancementLevel || 0) - Number(b.enhancementLevel || 0);
    }

    return getCardGradeOrder(a.grade) - getCardGradeOrder(b.grade)
      || String(a.baseName || a.name || '').localeCompare(String(b.baseName || b.name || ''), 'ko')
      || Number(a.enhancementLevel || 0) - Number(b.enhancementLevel || 0);
  });
}

function updateCardFilterControls() {
  document.querySelectorAll('[data-card-grade-filter]').forEach((button) => {
    button.classList.toggle('active', button.dataset.cardGradeFilter === cardGradeFilter);
  });
  document.querySelectorAll('[data-card-sort-mode]').forEach((button) => {
    button.classList.toggle('active', button.dataset.cardSortMode === cardSortMode);
  });
  const status = document.getElementById('cardFilterStatus');
  if (status) {
    const gradeText = cardGradeFilter === 'all' ? '전체 등급' : `${cardGradeFilter}등급`;
    status.textContent = `${gradeText} / ${getCardSortLabel()}`;
  }
}

function renderEquipmentPager(totalCount, currentPage, totalPages) {
  const pager = document.getElementById('equipmentPager');
  if (!pager) return;
  if (totalCount <= EQUIPMENT_PAGE_SIZE) {
    pager.innerHTML = `정렬: ${escapeHtml(getEquipmentSortLabel())} / 총 ${formatNumber(totalCount)}개`;
    return;
  }
  pager.innerHTML = `
    <button class="mini-btn" onclick="handleEquipmentPageChange(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>이전</button>
    <span>${formatNumber(currentPage)} / ${formatNumber(totalPages)} 페이지 · 정렬: ${escapeHtml(getEquipmentSortLabel())} · 총 ${formatNumber(totalCount)}개</span>
    <button class="mini-btn" onclick="handleEquipmentPageChange(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>다음</button>
  `;
}

function handleEquipmentSortChange(mode) {
  equipmentSortMode = mode;
  equipmentListPage = 1;
  updateInventoryUI(getStoredUser());
}

function handleCardGradeFilterChange(grade) {
  cardGradeFilter = ['all', 'S', 'A', 'B', 'C'].includes(grade) ? grade : 'all';
  updateInventoryUI(getStoredUser());
}

function handleCardSortChange(mode) {
  cardSortMode = ['grade', 'enhance_desc', 'enhance_asc', 'name'].includes(mode) ? mode : 'grade';
  updateInventoryUI(getStoredUser());
}

function handleEquipmentPageChange(page) {
  const user = getStoredUser();
  const totalPages = Math.max(1, Math.ceil((user?.equipmentDetails?.length || 0) / EQUIPMENT_PAGE_SIZE));
  equipmentListPage = Math.min(totalPages, Math.max(1, Number(page) || 1));
  updateInventoryUI(user);
}

function openSupportModal() {
  const user = getStoredUser();
  const beginnerCard = document.getElementById('beginnerSupportPackageCard');
  if (beginnerCard) {
    beginnerCard.classList.toggle('hidden', Number(user?.gameState?.level || 1) >= 50);
  }
  showModal('supportModal');
}


function getBranchOfficeState(user = getStoredUser()) {
  return user?.branchOffice || null;
}

function getBranchEmployeeGradeRank(grade) {
  return { S: 4, A: 3, B: 2, C: 1 }[String(grade || '').toUpperCase()] || 0;
}

function getSortedBranchEmployees(employees = []) {
  const list = Array.isArray(employees) ? employees.slice() : [];
  const { key, direction } = branchEmployeeSortMode || {};
  const sign = direction === 'asc' ? 1 : -1;
  return list.sort((a, b) => {
    let av = 0;
    let bv = 0;
    if (key === 'power') {
      av = Number(a?.excavationPower || 0);
      bv = Number(b?.excavationPower || 0);
    } else if (key === 'salary') {
      av = Number(a?.dailySalary || 0);
      bv = Number(b?.dailySalary || 0);
    } else {
      av = getBranchEmployeeGradeRank(a?.grade);
      bv = getBranchEmployeeGradeRank(b?.grade);
    }
    if (av === bv) return String(a?.name || '').localeCompare(String(b?.name || ''), 'ko');
    return (av - bv) * sign;
  });
}

function handleBranchEmployeeSortChange(key) {
  if (branchEmployeeSortMode.key === key) {
    branchEmployeeSortMode = { key, direction: branchEmployeeSortMode.direction === 'desc' ? 'asc' : 'desc' };
  } else {
    branchEmployeeSortMode = { key, direction: key === 'salary' ? 'asc' : 'desc' };
  }
  renderBranchOffice();
}

function formatBranchEmployeeSortLabel(key, label) {
  if (branchEmployeeSortMode.key !== key) return label;
  return label + (branchEmployeeSortMode.direction === 'desc' ? ' ▼' : ' ▲');
}

function formatBranchPercent(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toFixed(2).replace(/\.00$/, '') + '%' : '0%';
}

function renderBranchEffectBadges(item) {
  const effectText = item?.effectText || '보유 효과 없음';
  return '<span class="branch-effect-badge">' + escapeHtml(effectText) + '</span>';
}

function openBranchOfficeModal() {
  renderBranchOfficeModal(getStoredUser());
  showModal('branchOfficeModal');
}

function closeBranchOfficeModal() {
  hideModal('branchOfficeModal');
}

function isBranchOfficeTextEntryActive() {
  const modal = document.getElementById('branchOfficeModal');
  const container = document.getElementById('branchOfficeContent');
  const active = document.activeElement;
  if (!modal || modal.classList.contains('hidden') || !container) return false;
  if (container.matches(':focus-within')) return true;
  if (!active || !container.contains(active)) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName);
}

function renderBranchOfficeModal(user = getStoredUser()) {
  const container = document.getElementById('branchOfficeContent');
  if (!container) return;
  const branch = getBranchOfficeState(user);
  if (!branch) {
    container.innerHTML = '<div class="menu-note">지사 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>';
    return;
  }

  if (!branch.isFounded) {
    const taxNotice = branch.highIncomeTax?.applies
      ? '<div class="branch-warning">지사 설립 대상자입니다. 지사를 설립하지 않으면 6시간마다 보유 현금의 30%가 고소득근로자 4대보험+소득세로 사용됩니다.</div>'
      : '';
    const foundForm = branch.eligible
      ? `
        <div class="branch-card">
          <h4>지사 설립</h4>
          <p>설립비: <strong>${formatNumber(branch.foundCost)}원</strong> 전액 소모</p>
          <div class="stock-controls">
            <input id="branchCompanyNameInput" type="text" maxlength="24" placeholder="회사 이름 입력">
            <button class="menu-action-btn" onclick="handleBranchFound()">지사 설립</button>
          </div>
        </div>
      `
      : '<div class="branch-card"><h4>아직 설립 대상자가 아닙니다</h4><p>' + escapeHtml(branch.requirementText || '') + '</p></div>';
    container.innerHTML = `
      <div class="branch-summary-grid">
        <div class="branch-stat"><span>설립 조건</span><strong>${escapeHtml(branch.requirementText || '')}</strong></div>
        <div class="branch-stat"><span>현재 상태</span><strong>${branch.eligible ? '설립 가능' : '대기 중'}</strong></div>
      </div>
      ${taxNotice}
      ${foundForm}
    `;
    return;
  }

  const employeeRows = getSortedBranchEmployees(branch.employees || []).map((employee) => `
    <tr>
      <td><span class="branch-grade branch-grade-${escapeAttr(employee.grade)}">${escapeHtml(employee.grade)}</span></td>
      <td>${escapeHtml(employee.name)}</td>
      <td class="center-text">+${formatBranchPercent(employee.excavationPower)}</td>
      <td class="center-text">${formatNumber(employee.dailySalary)}원</td>
      <td class="center-text"><button class="mini-btn" onclick="handleBranchFire('${escapeAttr(employee.employeeId)}')">해고</button></td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="center-text">고용된 직원이 없습니다.</td></tr>';

  const itemCards = (branch.items || []).map((item) => `
    <div class="branch-item-card" style="border-color:${escapeAttr(item.color || '#cccccc')}">
      <div class="branch-item-head"><strong>${escapeHtml(item.emoji || '')} ${escapeHtml(item.name)}</strong><span style="color:${escapeAttr(item.color || '#333')}">${escapeHtml(item.gradeLabel || '')}</span></div>
      <p>${escapeHtml(item.desc || '')}</p>
      ${renderBranchEffectBadges(item)}
      <div class="branch-item-actions">
        <span>처분 비용 ${formatNumber(item.disposeCost)}원</span>
        <button class="mini-btn" onclick="handleBranchDispose('${escapeAttr(item.instanceId)}')">처분</button>
      </div>
    </div>
  `).join('') || '<div class="menu-note">창고에 보관 중인 수집품이 없습니다.</div>';

  const itemCodex = (branch.itemCodex || []).map((item) => `
    <span class="branch-codex-chip" title="${escapeAttr(item.effectText || '')}">${escapeHtml(item.emoji || '')} ${escapeHtml(item.name || '')}</span>
  `).join('') || '<span class="menu-note">아직 발견한 수집품이 없습니다.</span>';
  const employeeCodex = (branch.employeeCodex || []).map((name) => `<span class="branch-codex-chip">${escapeHtml(name)}</span>`).join('') || '<span class="menu-note">아직 고용 기록이 없습니다.</span>';
  const activeContractInput = document.getElementById('branchContractPercentInput');
  if (activeContractInput && activeContractInput.value !== '') branchContractPercentDraft = activeContractInput.value;
  const contractPercentValue = branchContractPercentDraft || '1';
  const postPreview = Number(branch.dailySalaryBase || 0);
  const pendingExcavation = branch.pendingExcavation || null;
  const pendingRemainingMs = Number(pendingExcavation?.remainingMs || 0);
  const pendingComplete = Boolean(pendingExcavation?.isComplete);
  const pendingProgress = Math.max(0, Math.min(100, Number(pendingExcavation?.progressPercent || 0)));
  const brokenRemainingMs = Number(branch.excavationBrokenRemainingMs || 0);
  const branchMachineBroken = brokenRemainingMs > 0;
  const excavationButtonText = pendingExcavation
    ? (pendingComplete ? '발굴 결과 확인' : `발굴 진행 중 (${formatDurationMs(pendingRemainingMs)} 남음)`)
    : '발굴 시작';
  const excavationButtonDisabled = (pendingExcavation && !pendingComplete) || branchMachineBroken ? 'disabled' : '';
  const excavationStatus = branchMachineBroken
    ? `발굴 기계 수리 중입니다. 남은 시간: ${formatDurationMs(brokenRemainingMs)}`
    : (pendingExcavation
        ? (pendingComplete
            ? '발굴이 완료되었습니다. 결과 확인 버튼을 눌러주세요.'
            : `진행률 ${formatNumber(pendingProgress, 1)}% / 완료까지 ${formatDurationMs(pendingRemainingMs)}`)
        : `기본 소요 시간 ${formatDurationMs(branch.excavationDurationMs || 0)} / 수집품 효과로 단축될 수 있습니다.`);
  const autoExcavationEnabled = Boolean(branch.autoExcavationEnabled);
  const autoExcavationButtonText = autoExcavationEnabled ? '자동 발굴 ON' : '자동 발굴 OFF';
  const autoExcavationHint = autoExcavationEnabled
    ? 'ON 상태에서는 완료된 발굴을 자동 정산하고 다음 발굴을 이어서 시작합니다.'
    : 'OFF 상태에서는 완료 후 직접 결과 확인을 눌러야 합니다.';
  const overtimeExcavationNotice = branch.overtimeExcavationActive
    ? `저녁 6시 이후 야근 발굴 비용 ${formatNumber(branch.overtimeExcavationMultiplier || 3)}배 적용 중`
    : '저녁 6시 이후에는 야근 발굴 비용 3배가 적용됩니다.';

  container.innerHTML = `
    <div class="branch-summary-grid">
      <div class="branch-stat"><span>회사명</span><strong>${escapeHtml(branch.companyName || '이름 없음')}</strong></div>
      <div class="branch-stat"><span>회사 가치</span><strong>${formatNumber(branch.companyValue || 0)}원</strong></div>
      <div class="branch-stat"><span>발굴 성공률</span><strong>${formatBranchPercent(branch.successChance)}</strong></div>
      <div class="branch-stat"><span>창고</span><strong>${formatNumber(branch.storageUsed || 0)} / ${formatNumber(branch.storageSlots || 0)}</strong></div>
      <div class="branch-stat"><span>일일 유지비</span><strong>${formatNumber(branch.dailyMaintenanceCost || 0)}원</strong></div>
      <div class="branch-stat"><span>직원</span><strong>${formatNumber(branch.employeeCount || 0)} / ${formatNumber(branch.maxEmployees || 0)}</strong></div>
    </div>

    <div class="branch-card">
      <h4>회사명 변경</h4>
      <div class="stock-controls">
        <input id="branchRenameInput" type="text" maxlength="24" value="${escapeAttr(branch.companyName || '')}">
        <button class="mini-btn" onclick="handleBranchRename()">변경</button>
      </div>
      <p class="menu-note">최근 기록: ${escapeHtml(branch.lastLog || '기록 없음')}</p>
    </div>

    <div class="branch-card">
      <h4>직원 공고</h4>
      <p>분당 월급 기준 환산 일급: <strong>${formatNumber(postPreview)}원</strong>. 입력한 비율만큼 직원 일일 계약금이 정해지고, 공고 비용은 계약금의 30%입니다. 서버에서 최소 ${formatNumber(0.1, 1)}%와 직원 등급/발굴력 기준 보정이 적용됩니다.</p>
      <div class="stock-controls">
        <input id="branchContractPercentInput" type="number" min="0.1" max="50" step="0.1" value="${escapeAttr(contractPercentValue)}" oninput="handleBranchContractPercentInput(this.value)" onchange="handleBranchContractPercentInput(this.value)">
        <button class="menu-action-btn" onclick="handleBranchRecruit()">공고 올리기</button>
      </div>
    </div>

    <div class="branch-card">
      <h4>발굴</h4>
      <p>발굴 비용: <strong>${formatNumber(branch.digCost || 0)}원</strong> / 성공률: <strong>${formatBranchPercent(branch.successChance)}</strong> / 소요 시간: <strong>${formatDurationMs(branch.excavationDurationMs || 0)}</strong></p>
      <p class="branch-stat-note">발굴 확률 상한: <strong>${formatBranchPercent(branch.excavationSuccessCap || 15)}</strong> / 초과 발굴력 희귀 보정: <strong>${formatBranchPercent(branch.rareItemBonusChance || 0)}</strong></p>
      <p class="menu-note">${escapeHtml(overtimeExcavationNotice)} / 고장 확률: ${formatNumber(branch.breakdownChancePercent || 3, 2)}%</p>
      <p class="menu-note">${escapeHtml(excavationStatus)}</p>
      ${pendingExcavation ? `<div class="branch-excavation-progress"><div style="width:${pendingProgress}%"></div></div>` : ''}
      <div class="branch-auto-row">
        <button class="mini-btn branch-auto-toggle ${autoExcavationEnabled ? 'on' : 'off'}" onclick="handleBranchAutoExcavationToggle(${autoExcavationEnabled ? 'false' : 'true'})">${escapeHtml(autoExcavationButtonText)}</button>
        <span class="menu-note">${escapeHtml(autoExcavationHint)}</span>
      </div>
      <button class="menu-action-btn" ${excavationButtonDisabled} onclick="handleBranchExcavate()">${escapeHtml(excavationButtonText)}</button>
    </div>

    <div class="branch-card">
      <h4>직원 목록</h4>
      <div class="branch-section-heading">
        <div class="branch-sort-controls">
          <button type="button" onclick="handleBranchEmployeeSortChange('power')">${formatBranchEmployeeSortLabel('power', '발굴력')}</button>
          <button type="button" onclick="handleBranchEmployeeSortChange('grade')">${formatBranchEmployeeSortLabel('grade', '등급')}</button>
          <button type="button" onclick="handleBranchEmployeeSortChange('salary')">${formatBranchEmployeeSortLabel('salary', '계약금')}</button>
        </div>
      </div>
      <table class="inner-table branch-table">
        <thead><tr><th>등급</th><th>직원</th><th>발굴력</th><th>일일 계약금</th><th>관리</th></tr></thead>
        <tbody>${employeeRows}</tbody>
      </table>
    </div>

    <div class="branch-card">
      <h4>창고</h4>
      <div class="branch-storage-actions">
        <span>다음 창고 1칸 구매 비용: ${branch.nextStorageCost == null ? '최대치' : formatNumber(branch.nextStorageCost) + '원'}</span>
        <button class="mini-btn" ${branch.nextStorageCost == null ? 'disabled' : ''} onclick="handleBranchBuyStorage()">창고 1칸 구매</button>
      </div>
      <div class="branch-item-grid">${itemCards}</div>
    </div>

    <div class="branch-card">
      <h4>도감</h4>
      <p>수집품 도감: ${formatNumber(branch.itemCodexCount || 0)} / ${formatNumber(branch.itemCodexTotal || 0)}</p>
      <div class="branch-codex-list">${itemCodex}</div>
      <p>직원 도감: ${formatNumber(branch.employeeCodexCount || 0)}명</p>
      <div class="branch-codex-list">${employeeCodex}</div>
    </div>
  `;
}

async function runBranchAction(endpoint, body = {}) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  const data = await runWithUserMutation(() => postJson(API_URL + endpoint, { userId: user._id, ...body }));
  updateLocalUserState(data, { force: true });
  if (data.branchResult?.message) alert(data.branchResult.message);
  renderBranchOfficeModal(getStoredUser());
}

async function handleBranchFound() {
  const companyName = document.getElementById('branchCompanyNameInput')?.value || '';
  try {
    await runBranchAction('/api/branch-office/found', { companyName });
  } catch (err) {
    alert(err.message);
  }
}

async function handleBranchRename() {
  const companyName = document.getElementById('branchRenameInput')?.value || '';
  try {
    await runBranchAction('/api/branch-office/rename', { companyName });
  } catch (err) {
    alert(err.message);
  }
}

function handleBranchContractPercentInput(value) {
  branchContractPercentDraft = String(value ?? '').slice(0, 12);
}

async function handleBranchRecruit() {
  const inputValue = document.getElementById('branchContractPercentInput')?.value || branchContractPercentDraft || '0';
  handleBranchContractPercentInput(inputValue);
  const contractPercent = Number(inputValue || 0);
  try {
    await runBranchAction('/api/branch-office/post-job', { contractPercent });
  } catch (err) {
    alert(err.message);
  }
}

async function handleBranchFire(employeeId) {
  if (!confirm('해고 비용은 해당 직원 일일 계약금의 5배입니다. 정말 해고할까요?')) return;
  try {
    await runBranchAction('/api/branch-office/fire', { employeeId });
  } catch (err) {
    alert(err.message);
  }
}

async function handleBranchExcavate() {
  try {
    await runBranchAction('/api/branch-office/excavate');
  } catch (err) {
    alert(err.message);
  }
}

async function handleBranchAutoExcavationToggle(enabled) {
  try {
    await runBranchAction('/api/branch-office/toggle-auto-excavation', { enabled });
  } catch (err) {
    alert(err.message);
  }
}

async function handleBranchBuyStorage() {
  try {
    await runBranchAction('/api/branch-office/buy-storage');
  } catch (err) {
    alert(err.message);
  }
}

async function handleBranchDispose(instanceId) {
  if (!confirm('아이템 처분 비용이 사용됩니다. 회사 가치는 내려가지 않습니다. 처분할까요?')) return;
  try {
    await runBranchAction('/api/branch-office/dispose-item', { instanceId });
  } catch (err) {
    alert(err.message);
  }
}

function openFragmentShopModal() {
  const user = getStoredUser();
  renderShopModal(user);
  showModal('fragmentShopModal');
}

function closeFragmentShopModal() {
  hideModal('fragmentShopModal');
}

function handleShopModalTabChange(mode) {
  shopModalMode = mode === 'general' ? 'general' : 'fragment';
  renderShopModal(getStoredUser());
}

function renderShopModal(user = getStoredUser()) {
  const isGeneral = shopModalMode === 'general';
  document.getElementById('fragmentShopTabBtn')?.classList.toggle('active', !isGeneral);
  document.getElementById('generalShopTabBtn')?.classList.toggle('active', isGeneral);
  document.getElementById('fragmentShopPanel')?.classList.toggle('hidden', isGeneral);
  document.getElementById('generalShopPanel')?.classList.toggle('hidden', !isGeneral);
  renderFragmentShopModal(user);
  renderGeneralShopModal(user);
}

function renderFragmentShopModalLegacy(user = getStoredUser()) {
  const count = getInventoryQuantityFromUser(user, 'equipment_fragment');
  const list = document.getElementById('fragmentShopItems');
  setText('fragmentShopCount', `현재 보유 파편: ${formatNumber(count)}개`);
  if (!list) return;
  const shopState = user?.shopState || {};
  const items = [
    {
      id: 'raid_entry_ticket',
      name: '회의 추가 입장권 1장',
      cost: 50,
      dailyLimit: 1,
      purchasedToday: Number(shopState.dailyFragmentRaidTicketPurchases || 0),
      desc: '파편 50개로 구매합니다. 1일 1회 구매 가능합니다.'
    },
    {
      id: 'business_card_bundle',
      name: '명함 10장',
      cost: 30,
      dailyLimit: 2,
      purchasedToday: Number(shopState.dailyFragmentBusinessCardPurchases || 0),
      desc: '파편 30개로 구매합니다. 1일 2회 구매 가능합니다.'
    }
  ];
  list.innerHTML = items.map((item) => {
    const remaining = Math.max(0, item.dailyLimit - item.purchasedToday);
    const disabled = count < item.cost || remaining <= 0;
    const status = remaining > 0
      ? `오늘 남은 구매 가능: ${formatNumber(remaining)}/${formatNumber(item.dailyLimit)}`
      : '오늘 구매 한도 도달';
    return `
      <div class="fragment-shop-item">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <div class="menu-note">${escapeHtml(item.desc)}</div>
          <div class="menu-note">${escapeHtml(status)}</div>
        </div>
        <button class="mini-btn" ${disabled ? 'disabled' : ''} onclick="handleFragmentShopBuy('${item.id}')">
          파편 ${formatNumber(item.cost)}개 구매
        </button>
      </div>
    `;
  }).join('');
}

function renderFragmentShopModal(user = getStoredUser()) {
  const count = getInventoryQuantityFromUser(user, 'equipment_fragment');
  const list = document.getElementById('fragmentShopItems');
  setText('fragmentShopCount', `현재 보유 파편: ${formatNumber(count)}개`);
  if (!list) return;

  const items = user?.fragmentShop?.items || [
    { id: 'raid_entry_ticket', name: '회의 추가 입장권 1장', cost: 50, dailyLimit: 1, purchasedToday: Number(user?.shopState?.dailyFragmentRaidTicketPurchases || 0), remainingToday: Math.max(0, 1 - Number(user?.shopState?.dailyFragmentRaidTicketPurchases || 0)) },
    { id: 'business_card_bundle', name: '명함 10장', cost: 30, dailyLimit: 2, purchasedToday: Number(user?.shopState?.dailyFragmentBusinessCardPurchases || 0), remainingToday: Math.max(0, 2 - Number(user?.shopState?.dailyFragmentBusinessCardPurchases || 0)) }
  ];

  list.innerHTML = items.map((item) => {
    const remaining = Math.max(0, Number(item.remainingToday ?? (Number(item.dailyLimit || 0) - Number(item.purchasedToday || 0))));
    const disabled = item.owned || item.canBuy === false || count < Number(item.cost || 0) || remaining <= 0;
    const status = item.owned
      ? '이미 보유 중'
      : remaining > 0
      ? `오늘 남은 구매 가능: ${formatNumber(remaining)}/${formatNumber(item.dailyLimit || 0)}`
      : '오늘 구매 한도 도달';
    const buttonLabel = item.owned
      ? '보유 중'
      : `파편 ${formatNumber(item.cost || 0)}개 구매`;
    return `
      <div class="fragment-shop-item">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          ${item.desc ? `<div class="menu-note">${escapeHtml(item.desc)}</div>` : ''}
          <div class="menu-note">파편 ${formatNumber(item.cost || 0)}개로 구매합니다.</div>
          <div class="menu-note">${escapeHtml(status)}</div>
        </div>
        <button class="mini-btn" ${disabled ? 'disabled' : ''} onclick="handleFragmentShopBuy('${item.id}')">
          ${buttonLabel}
        </button>
      </div>
    `;
  }).join('');
}

function renderGeneralShopModal(user = getStoredUser()) {
  const list = document.getElementById('generalShopItems');
  if (!list) return;
  const items = user?.emblemShop?.items || [];
  if (!items.length) {
    list.innerHTML = '<div class="menu-note">판매 중인 일반 상점 상품이 없습니다.</div>';
    return;
  }

  list.innerHTML = items.map((item) => {
    const disabled = item.owned || !item.canBuy;
    const status = item.owned
      ? (item.equipped ? '보유 중 / 장착 중' : '보유 중')
      : `가격 ${formatNumber(item.price)}원`;
    return `
      <div class="fragment-shop-item emblem-shop-item">
        <div class="emblem-shop-preview ${escapeHtml(item.className || '')}">
          <span class="online-dot online"></span>
          <span class="emblem-preview-name">사원 닉네임</span>
          ${item.imageUrl ? `<img src="${escapeAttr(item.imageUrl)}" alt="" class="emblem-preview-icon">` : ''}
        </div>
        <div class="emblem-shop-info">
          <strong>${escapeHtml(item.name)}</strong>
          <div class="menu-note">${escapeHtml(item.desc || '')}</div>
          <div class="menu-note">${escapeHtml(status)}</div>
        </div>
        <button class="mini-btn" ${disabled ? 'disabled' : ''} onclick="handleEmblemShopBuy('${item.id}')">
          ${item.owned ? '구매 완료' : '구매'}
        </button>
      </div>
    `;
  }).join('');
}

async function handleFragmentShopBuy(shopItemId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/fragment-shop/buy`, {
      userId: user._id,
      shopItemId
    }));
    updateLocalUserState(data);
    if (data.fragmentShopPurchase) {
      const purchase = data.fragmentShopPurchase;
      if (purchase.emblemId) {
        alert(`${purchase.itemName} 휘장을 구매했습니다.`);
      } else {
        alert(`${purchase.itemName} ${formatNumber(purchase.quantity)}개를 구매했습니다.`);
      }
    }
    renderShopModal(data.user || getStoredUser());
  } catch (err) {
    alert(err.message);
  }
}

async function handleEmblemShopBuy(emblemId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/emblem-shop/buy`, {
      userId: user._id,
      emblemId
    }));
    updateLocalUserState(data);
    if (data.emblemShopPurchase) {
      alert(`${data.emblemShopPurchase.emblemName} 휘장을 구매했습니다.`);
    }
    renderShopModal(data.user || getStoredUser());
    updateRankingUI();
  } catch (err) {
    alert(err.message);
  }
}

function formatMarketDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function loadMarketplaceData() {
  const user = getStoredUser();
  if (!user?._id) return;
  const data = await getJson(`${API_URL}/api/marketplace?userId=${encodeURIComponent(user._id)}`);
  marketplaceState.data = data.marketplace || { active: [], mine: [] };
  updateMarketplacePendingDot((marketplaceState.data.mine || []).filter((listing) => listing.status === 'sold').length);
  renderMarketplace();
}

function openMarketplaceModal() {
  showModal('marketplaceModal');
  renderMarketplace();
  loadMarketplaceData().catch((err) => {
    setText('marketplaceStatus', err.message || '거래소 정보를 불러오지 못했습니다.');
  });
}

function closeMarketplaceModal() {
  hideModal('marketplaceModal');
}

function openMarketplaceRegisterModal() {
  marketplaceRegisterState = { itemType: marketplaceState.itemType || 'scroll', selected: null, sort: 'acquired' };
  renderMarketplaceRegisterModal();
  showModal('marketplaceRegisterModal');
}

function closeMarketplaceRegisterModal() {
  hideModal('marketplaceRegisterModal');
  showModal('marketplaceModal');
}

function formatMarketplaceRemaining(ms) {
  const remaining = Math.max(0, Math.floor(Number(ms || 0)));
  if (remaining <= 0) return '회수 가능';
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const restHours = hours % 24;
    return `${days}일 ${restHours}시간`;
  }
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${Math.max(1, minutes)}분`;
}

function getMarketplaceListingsForView() {
  const data = marketplaceState.data || { active: [], mine: [] };
  const source = marketplaceState.view === 'active'
    ? data.active || []
    : data.mine || [];
  const filtered = source.filter((listing) => {
    if (listing.itemType !== marketplaceState.itemType) return false;
    if (marketplaceState.view === 'mine') return listing.status === 'active';
    if (marketplaceState.view === 'sold') return ['sold', 'settling', 'expired'].includes(listing.status);
    return listing.status === 'active';
  });

  filtered.sort((left, right) => {
    if (marketplaceState.sort === 'price_asc') return Number(left.price || 0) - Number(right.price || 0);
    if (marketplaceState.sort === 'price_desc') return Number(right.price || 0) - Number(left.price || 0);
    const leftTime = new Date(left.createdAt || 0).getTime();
    const rightTime = new Date(right.createdAt || 0).getTime();
    return marketplaceState.sort === 'time_asc' ? leftTime - rightTime : rightTime - leftTime;
  });
  return filtered;
}

function renderMarketplace() {
  const listEl = document.getElementById('marketplaceList');
  const statusEl = document.getElementById('marketplaceStatus');
  if (!listEl || !statusEl) return;

  const typeLabel = marketplaceState.itemType === 'equipment'
    ? '장비'
    : marketplaceState.itemType === 'item'
      ? '아이템'
      : '주문서';
  const viewLabel = marketplaceState.view === 'active'
    ? '전체 판매중'
    : marketplaceState.view === 'mine'
      ? '내 등록중'
      : '내 판매완료/회수';
  const listings = getMarketplaceListingsForView();
  statusEl.textContent = `${typeLabel} / ${viewLabel} / ${formatNumber(listings.length)}개`;
  listEl.innerHTML = listings.length ? '' : '<tr><td colspan="5">표시할 물품이 없습니다.</td></tr>';

  listings.forEach((listing) => {
    const isMine = Boolean(listing.mine);
    const statusText = listing.status === 'active'
      ? `판매중 / 회수까지 ${formatMarketplaceRemaining(listing.remainingMs)}`
      : listing.status === 'expired'
        ? `기간 만료 / ${formatMarketplaceRemaining(0)}`
        : listing.status === 'settled'
          ? '정산완료'
          : listing.status === 'settling'
            ? '정산중'
            : `판매완료 (${formatMarketDate(listing.soldAt)})`;
    const actionHtml = marketplaceState.view === 'active'
      ? `<button class="mini-btn" onclick="handleMarketplaceBuy('${listing.id}')" ${isMine ? 'disabled' : ''}>구매</button>`
      : marketplaceState.view === 'mine'
        ? `<button class="mini-btn" onclick="handleMarketplaceCancel('${listing.id}')">회수</button>`
        : listing.status === 'expired'
          ? `<button class="mini-btn" onclick="handleMarketplaceCancel('${listing.id}')">회수</button>`
          : '-';
    const quantityText = Number(listing.quantity || 1) > 1 ? ` x${formatNumber(listing.quantity)}` : '';
    listEl.insertAdjacentHTML('beforeend', `
      <tr class="${isMine ? 'market-listing-owned' : ''}">
        <td>${escapeHtml(listing.itemName || listing.itemId)}${quantityText}</td>
        <td>${escapeHtml(listing.description || '')}</td>
        <td>${formatNumber(listing.price)}원</td>
        <td>${escapeHtml(statusText)}</td>
        <td>${actionHtml}</td>
      </tr>
    `);
  });
}

function handleMarketplaceTypeChange(itemType) {
  marketplaceState.itemType = itemType;
  renderMarketplace();
}

function handleMarketplaceViewChange(view) {
  marketplaceState.view = view;
  renderMarketplace();
}

function handleMarketplaceSortChange(sort) {
  marketplaceState.sort = sort;
  renderMarketplace();
}

function getMarketplaceRegisterSortLabel() {
  if (marketplaceRegisterState.sort === 'enhance_desc') return '강화 높은순';
  if (marketplaceRegisterState.sort === 'enhance_asc') return '강화 낮은순';
  if (marketplaceRegisterState.sort === 'name') return '이름순';
  return '획득순';
}

function sortMarketplaceRegisterEntries(entries) {
  const sortMode = marketplaceRegisterState.sort || 'acquired';
  return [...entries].sort((left, right) => {
    if (sortMode === 'enhance_desc') {
      return Number(right.enhanceLevel || right.upgradeRank || 0) - Number(left.enhanceLevel || left.upgradeRank || 0);
    }
    if (sortMode === 'enhance_asc') {
      return Number(left.enhanceLevel || left.upgradeRank || 0) - Number(right.enhanceLevel || right.upgradeRank || 0);
    }
    if (sortMode === 'name') {
      return String(left.name || '').localeCompare(String(right.name || ''), 'ko');
    }
    return Number(left.index || 0) - Number(right.index || 0);
  });
}

function getMarketplaceTradeableItems(user) {
  return ['raid_entry_ticket', 'hagendaz', 'excavation_repair_coupon']
    .map((itemId, index) => ({
      itemType: 'item',
      itemId,
      index,
      quantity: getInventoryQuantityFromUser(user, itemId),
      itemInfo: ITEM_DATA[itemId] || {},
      name: ITEM_DATA[itemId]?.name || itemId
    }))
    .filter((entry) => entry.quantity > 0);
}

function renderMarketplaceRegisterModal() {
  const user = getStoredUser();
  const listEl = document.getElementById('marketplaceRegisterList');
  const selectionEl = document.getElementById('marketplaceRegisterSelection');
  const quantityInput = document.getElementById('marketplaceRegisterQuantity');
  const sortControlsEl = document.getElementById('marketplaceRegisterSortControls');
  if (!listEl || !selectionEl || !quantityInput) return;

  const selected = marketplaceRegisterState.selected;
  selectionEl.textContent = selected
    ? `선택됨: ${selected.name}${selected.quantity > 1 ? ` x${formatNumber(selected.quantity)}` : ''}`
    : '등록할 물품을 선택하세요.';
  quantityInput.disabled = marketplaceRegisterState.itemType === 'equipment';
  if (marketplaceRegisterState.itemType === 'equipment') {
    quantityInput.max = '1';
    quantityInput.value = '1';
  }
  if (sortControlsEl) {
    sortControlsEl.innerHTML = marketplaceRegisterState.itemType === 'item'
      ? `
        <button class="mini-btn ${marketplaceRegisterState.sort === 'acquired' ? 'active' : ''}" onclick="handleMarketplaceRegisterSortChange('acquired')">획득순</button>
        <button class="mini-btn ${marketplaceRegisterState.sort === 'name' ? 'active' : ''}" onclick="handleMarketplaceRegisterSortChange('name')">이름순</button>
        <span class="menu-note">현재 ${getMarketplaceRegisterSortLabel()}</span>
      `
      : `
        <button class="mini-btn ${marketplaceRegisterState.sort === 'acquired' ? 'active' : ''}" onclick="handleMarketplaceRegisterSortChange('acquired')">획득순</button>
        <button class="mini-btn ${marketplaceRegisterState.sort === 'enhance_desc' ? 'active' : ''}" onclick="handleMarketplaceRegisterSortChange('enhance_desc')">강화 높은순</button>
        <button class="mini-btn ${marketplaceRegisterState.sort === 'enhance_asc' ? 'active' : ''}" onclick="handleMarketplaceRegisterSortChange('enhance_asc')">강화 낮은순</button>
        <button class="mini-btn ${marketplaceRegisterState.sort === 'name' ? 'active' : ''}" onclick="handleMarketplaceRegisterSortChange('name')">이름순</button>
        <span class="menu-note">현재 ${getMarketplaceRegisterSortLabel()}</span>
      `;
  }

  listEl.innerHTML = '';
  if (marketplaceRegisterState.itemType === 'equipment') {
    const equipments = sortMarketplaceRegisterEntries((user?.equipmentDetails || []).map((equipment, index) => ({
      ...equipment,
      index,
      name: equipment.name || '',
      upgradeRank: Number(equipment.upgradesUsed || (7 - Number(equipment.upgradesLeft || 7)) || 0)
    })));
    listEl.innerHTML = equipments.length ? '' : '<div class="modal-note">등록 가능한 장비가 없습니다.</div>';
    equipments.forEach((equipment) => {
      listEl.insertAdjacentHTML('beforeend', `
        <button class="fusion-source-card ${selected?.itemId === equipment.equipmentId ? 'selected' : ''}" onclick="handleMarketplaceRegisterSelect('equipment', '${equipment.equipmentId}')">
          <strong>${escapeHtml(equipment.name)}</strong><br>
          <span>${escapeHtml(equipment.desc || '')}</span>
        </button>
      `);
    });
    return;
  }

  if (marketplaceRegisterState.itemType === 'item') {
    const itemEntries = sortMarketplaceRegisterEntries(getMarketplaceTradeableItems(user));
    quantityInput.disabled = false;
    listEl.innerHTML = itemEntries.length ? '' : '<div class="modal-note">등록 가능한 아이템이 없습니다.</div>';
    itemEntries.forEach((entry) => {
      listEl.insertAdjacentHTML('beforeend', `
        <button class="fusion-source-card ${selected?.itemId === entry.itemId ? 'selected' : ''}" onclick="handleMarketplaceRegisterSelect('item', '${entry.itemId}')">
          <strong>${escapeHtml(entry.itemInfo.name || entry.itemId)} x${formatNumber(entry.quantity)}</strong><br>
          <span>${escapeHtml(entry.itemInfo.desc || entry.itemInfo.hoverDesc || '')}</span>
        </button>
      `);
    });
    return;
  }

  const scrollEntries = sortMarketplaceRegisterEntries(getEquipmentScrollItemIds()
    .map((itemId, index) => ({ itemType: 'scroll', itemId, index, quantity: getInventoryQuantityFromUser(user, itemId), itemInfo: ITEM_DATA[itemId] || {}, name: ITEM_DATA[itemId]?.name || itemId }))
    .filter((entry) => entry.quantity > 0));
  listEl.innerHTML = scrollEntries.length ? '' : '<div class="modal-note">등록 가능한 주문서가 없습니다.</div>';
  scrollEntries.forEach((entry) => {
    listEl.insertAdjacentHTML('beforeend', `
      <button class="fusion-source-card ${selected?.itemId === entry.itemId ? 'selected' : ''}" onclick="handleMarketplaceRegisterSelect('scroll', '${entry.itemId}')">
        <strong>${escapeHtml(entry.itemInfo.name || entry.itemId)} x${formatNumber(entry.quantity)}</strong><br>
        <span>${escapeHtml(entry.itemInfo.desc || '')}</span>
      </button>
    `);
  });
}

function handleMarketplaceRegisterTypeChange(itemType) {
  const nextSort = itemType === 'item' && ['enhance_desc', 'enhance_asc'].includes(marketplaceRegisterState.sort)
    ? 'acquired'
    : marketplaceRegisterState.sort || 'acquired';
  marketplaceRegisterState = { itemType, selected: null, sort: nextSort };
  const quantityInput = document.getElementById('marketplaceRegisterQuantity');
  if (quantityInput) quantityInput.value = '1';
  renderMarketplaceRegisterModal();
}

function handleMarketplaceRegisterSortChange(sort) {
  marketplaceRegisterState.sort = sort;
  renderMarketplaceRegisterModal();
}

function handleMarketplaceRegisterSelect(itemType, itemId) {
  const user = getStoredUser();
  if (itemType === 'equipment') {
    const equipment = (user?.equipmentDetails || []).find((entry) => entry.equipmentId === itemId);
    marketplaceRegisterState.selected = equipment ? {
      itemType,
      itemId,
      name: equipment.name,
      quantity: 1
    } : null;
  } else {
    const itemInfo = ITEM_DATA[itemId] || {};
    const quantity = getInventoryQuantityFromUser(user, itemId);
    marketplaceRegisterState.selected = quantity > 0 ? {
      itemType,
      itemId,
      name: itemInfo.name || itemId,
      quantity
    } : null;
    const quantityInput = document.getElementById('marketplaceRegisterQuantity');
    if (quantityInput) {
      quantityInput.max = String(quantity);
      quantityInput.value = '1';
    }
  }
  renderMarketplaceRegisterModal();
}

async function handleMarketplaceRegisterConfirm() {
  const user = getStoredUser();
  const selected = marketplaceRegisterState.selected;
  if (!user?._id || !selected) return alert('등록할 물품을 선택해주세요.');
  const quantity = selected.itemType === 'equipment'
    ? 1
    : Math.max(1, Math.min(selected.quantity, Math.floor(Number(document.getElementById('marketplaceRegisterQuantity')?.value) || 1)));
  const rawPrice = Number(document.getElementById('marketplaceRegisterPrice')?.value);
  if (!Number.isFinite(rawPrice) || rawPrice < 1) return alert('판매 가격을 입력해주세요.');
  const price = Math.floor(rawPrice);

  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/marketplace/list`, {
      userId: user._id,
      itemType: selected.itemType,
      itemId: selected.itemId,
      quantity,
      price
    }));
    updateLocalUserState(data, { force: true });
    marketplaceState.data = data.marketplace || marketplaceState.data;
    marketplaceRegisterState.selected = null;
    renderMarketplaceRegisterModal();
    renderMarketplace();
    alert(data.marketplaceResult?.message || '물품을 등록했습니다.');
  } catch (err) {
    alert(err.message);
  }
}

async function handleMarketplaceBuy(listingId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  if (!confirm('이 물품을 구매하시겠습니까?')) return;
  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/marketplace/buy`, {
      userId: user._id,
      listingId
    }));
    updateLocalUserState(data, { force: true });
    marketplaceState.data = data.marketplace || marketplaceState.data;
    renderMarketplace();
    alert(data.marketplaceResult?.message || '구매했습니다.');
  } catch (err) {
    alert(err.message);
  }
}

async function handleMarketplaceCancel(listingId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  if (!confirm('등록한 물품을 회수하시겠습니까?')) return;
  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/marketplace/cancel`, {
      userId: user._id,
      listingId
    }));
    updateLocalUserState(data, { force: true });
    marketplaceState.data = data.marketplace || marketplaceState.data;
    renderMarketplace();
    alert(data.marketplaceResult?.message || '물품을 회수했습니다.');
  } catch (err) {
    alert(err.message);
  }
}

async function handleMarketplaceSettle() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/marketplace/settle`, { userId: user._id }));
    updateLocalUserState(data, { force: true });
    marketplaceState.data = data.marketplace || marketplaceState.data;
    marketplaceState.view = 'sold';
    renderMarketplace();
    alert(data.marketplaceResult?.message || '정산했습니다.');
  } catch (err) {
    alert(err.message);
  }
}

function openEquipmentEnhanceModal() {
  selectedEquipmentEnhanceId = null;
  selectedEquipmentScrollId = null;
  equipmentEnhanceLogs = [];
  renderEquipmentEnhanceModal(getStoredUser());
  showModal('equipmentEnhanceModal');
}

function closeEquipmentEnhanceModal() {
  hideModal('equipmentEnhanceModal');
}

function openEquipmentDismantleModal() {
  equipmentDismantleSelection = new Set();
  equipmentDismantleSortMode = equipmentSortMode || 'acquired';
  renderEquipmentDismantleModal(getStoredUser());
  showModal('equipmentDismantleModal');
}

function closeEquipmentDismantleModal() {
  equipmentDismantleSelection = new Set();
  hideModal('equipmentDismantleModal');
}

function handleEquipmentDismantleSortChange(mode) {
  equipmentDismantleSortMode = mode;
  renderEquipmentDismantleModal(getStoredUser());
}

function handleEquipmentDismantleSelect(equipmentId) {
  if (equipmentDismantleSelection.has(equipmentId)) {
    equipmentDismantleSelection.delete(equipmentId);
  } else {
    equipmentDismantleSelection.add(equipmentId);
  }
  renderEquipmentDismantleModal(getStoredUser());
}

function renderEquipmentDismantleModal(user) {
  const summary = document.getElementById('equipmentDismantleSummary');
  const list = document.getElementById('equipmentDismantleList');
  const confirmBtn = document.getElementById('confirmEquipmentDismantleBtn');
  if (!summary || !list || !confirmBtn) return;

  const equipments = user?.equipmentDetails || [];
  const ownedIds = new Set(equipments.map((equipment) => String(equipment.equipmentId)));
  equipmentDismantleSelection = new Set([...equipmentDismantleSelection].filter((equipmentId) => ownedIds.has(String(equipmentId))));

  const selectedCount = equipmentDismantleSelection.size;
  summary.innerHTML = `
    <strong>선택 ${formatNumber(selectedCount)}개</strong>
    <div class="menu-note">정렬: ${escapeHtml(getEquipmentSortLabel(equipmentDismantleSortMode))} / 예상 획득: 장비 1개당 장비 파편 0~5개</div>
  `;
  confirmBtn.disabled = selectedCount <= 0;

  const sortedEquipments = getSortedEquipmentDetails(equipments, equipmentDismantleSortMode);
  list.innerHTML = sortedEquipments.length
    ? sortedEquipments.map((equipment) => {
      const selected = equipmentDismantleSelection.has(equipment.equipmentId);
      return `
        <button class="fusion-source-card ${selected ? 'selected' : ''}" onclick="handleEquipmentDismantleSelect('${equipment.equipmentId}')">
          <strong>${escapeHtml(equipment.name)}${equipment.equipped ? ' (장착 중)' : ''}</strong>
          <div class="menu-note">${escapeHtml(equipment.desc || '')}</div>
          <div class="menu-note">${selected ? '분해 대상에 등록됨' : '클릭하면 분해 대상에 등록됩니다.'}</div>
        </button>
      `;
    }).join('')
    : '<div class="muted-text">보유한 장비가 없습니다.</div>';
}

async function handleEquipmentDismantleConfirm() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  const equipmentIds = [...equipmentDismantleSelection];
  if (!equipmentIds.length) {
    alert('분해할 장비를 선택해주세요.');
    return;
  }

  const ok = confirm(`선택한 장비 ${equipmentIds.length}개를 분해하시겠습니까? 장비는 복구할 수 없습니다.`);
  if (!ok) return;

  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/equipment/dismantle`, {
      userId: user._id,
      equipmentIds
    }));
    equipmentDismantleSelection = new Set();
    updateLocalUserState(data);
    const result = data.equipmentDismantle;
    if (result) {
      alert(`장비 ${result.count}개를 분해했습니다. 장비 파편 ${result.fragments}개를 획득했습니다.`);
    }
    if (isEquipmentDismantleModalOpen()) {
      renderEquipmentDismantleModal(getStoredUser());
    }
  } catch (err) {
    alert(err.message);
  }
}

async function handleToggleEquipmentEquip(equipmentId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/equipment/toggle-equip`, {
      userId: user._id,
      equipmentId
    }));
    updateLocalUserState(data);
  } catch (err) {
    alert(err.message);
  }
}

function handleOpenEquipmentEnhanceFor(equipmentId) {
  selectedEquipmentEnhanceId = equipmentId;
  selectedEquipmentScrollId = null;
  equipmentEnhanceLogs = [];
  renderEquipmentEnhanceModal(getStoredUser());
  showModal('equipmentEnhanceModal');
}

function handleEquipmentEnhanceSelect(equipmentId) {
  if (selectedEquipmentEnhanceId === equipmentId) {
    selectedEquipmentEnhanceId = null;
    selectedEquipmentScrollId = null;
    equipmentEnhanceLogs = [];
  } else {
    selectedEquipmentEnhanceId = equipmentId;
    selectedEquipmentScrollId = null;
    equipmentEnhanceLogs = [];
  }
  renderEquipmentEnhanceModal(getStoredUser());
}

function handleEquipmentScrollSelect(itemId) {
  selectedEquipmentScrollId = selectedEquipmentScrollId === itemId ? null : itemId;
  renderEquipmentEnhanceModal(getStoredUser());
}

async function handleEquipmentEnhanceConfirm() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();
  if (!selectedEquipmentEnhanceId || !selectedEquipmentScrollId) {
    alert('장비와 주문서를 모두 선택해주세요.');
    return;
  }
  try {
    const data = await runWithUserMutation(() => postJson(`${API_URL}/api/equipment/upgrade`, {
      userId: user._id,
      equipmentId: selectedEquipmentEnhanceId,
      scrollItemId: selectedEquipmentScrollId
    }));
    if (data.equipmentUpgrade?.logText) {
      equipmentEnhanceLogs.push(data.equipmentUpgrade.logText);
    }
    updateLocalUserState(data);
  } catch (err) {
    alert(err.message);
  }
}

function renderEquipmentEnhanceModal(user) {
  const selectedBox = document.getElementById('equipmentEnhanceSelected');
  const sourceList = document.getElementById('equipmentEnhanceSourceList');
  const scrollList = document.getElementById('equipmentEnhanceScrollList');
  const chanceText = document.getElementById('equipmentEnhanceChanceText');
  const preview = document.getElementById('equipmentEnhancePreview');
  const logBox = document.getElementById('equipmentEnhanceLog');
  if (!selectedBox || !sourceList || !scrollList || !chanceText || !preview || !logBox) return;

  const equipments = user?.equipmentDetails || [];
  const selectedEquipment = equipments.find((entry) => entry.equipmentId === selectedEquipmentEnhanceId) || null;
  const scrollIds = getEquipmentScrollItemIds();
  const selectedScroll = selectedEquipmentScrollId ? ITEM_DATA[selectedEquipmentScrollId] : null;

  logBox.innerHTML = equipmentEnhanceLogs.length
    ? equipmentEnhanceLogs.map((line, index) => `<div class="${index === equipmentEnhanceLogs.length - 1 ? 'latest-log' : ''}">${escapeHtml(line)}</div>`).join('')
    : '<div class="muted-text">강화 로그가 여기에 표시됩니다.</div>';

  if (!selectedEquipment) {
    selectedBox.classList.add('empty');
    selectedBox.textContent = '강화할 장비를 아래 목록에서 선택하세요.';
  } else {
    selectedBox.classList.remove('empty');
    selectedBox.innerHTML = `<strong>${escapeHtml(selectedEquipment.name)}</strong><div class="menu-note">${escapeHtml(selectedEquipment.desc)}</div>`;
  }

  sourceList.innerHTML = equipments.length
    ? equipments.map((equipment) => `
        <button class="fusion-source-card ${selectedEquipmentEnhanceId === equipment.equipmentId ? 'selected' : ''}" onclick="handleEquipmentEnhanceSelect('${equipment.equipmentId}')">
          <strong>${escapeHtml(equipment.name)}</strong>
          <div class="menu-note">${escapeHtml(equipment.desc)}</div>
        </button>
      `).join('')
    : '<div class="muted-text">보유한 장비가 없습니다.</div>';

  const allowedType = selectedEquipment?.equipmentType || null;
  scrollList.innerHTML = scrollIds.map((itemId) => {
    const item = ITEM_DATA[itemId];
    const quantity = getEquipmentScrollQuantity(user, itemId);
    const isCardScroll = itemId.startsWith('scroll_card_');
    const scrollType = isCardScroll ? 'card_effect' : 'basic_attack';
    const disabled = quantity <= 0 || (allowedType && allowedType !== scrollType);
    return `
      <button class="fusion-source-card ${selectedEquipmentScrollId === itemId ? 'selected' : ''}" onclick="handleEquipmentScrollSelect('${itemId}')" ${disabled ? 'disabled' : ''}>
        <strong>${escapeHtml(item?.name || itemId)}</strong>
        <div class="menu-note">${escapeHtml(item?.desc || '')}</div>
        <div class="menu-note">보유 ${formatNumber(quantity)}개</div>
      </button>
    `;
  }).join('');

  if (!selectedEquipment) {
    chanceText.textContent = '장비를 선택하면 사용할 수 있는 주문서와 강화 확률이 표시됩니다.';
    preview.textContent = '현재 수치와 강화 후 미리보기가 여기에 표시됩니다.';
  } else if (!selectedScroll) {
    chanceText.textContent = '주문서를 선택하면 강화 확률이 표시됩니다.';
    preview.textContent = `현재 수치: ${selectedEquipment.statValue.toFixed(1)}% / 남은 업그레이드: ${selectedEquipment.upgradesLeft}회`;
  } else {
    const successRate = selectedEquipmentScrollId === 'scroll_card_005' || selectedEquipmentScrollId === 'scroll_attack_01'
      ? 100
      : selectedEquipmentScrollId === 'scroll_card_01' || selectedEquipmentScrollId === 'scroll_attack_02'
        ? 60
        : 10;
    const addValue = selectedEquipmentScrollId === 'scroll_card_005' ? 0.5
      : selectedEquipmentScrollId === 'scroll_card_01' ? 1
      : selectedEquipmentScrollId === 'scroll_card_025' ? 2.5
      : selectedEquipmentScrollId === 'scroll_attack_01' ? 1
      : selectedEquipmentScrollId === 'scroll_attack_02' ? 2
      : 5;
    chanceText.textContent = `강화 확률 ${successRate}%`;
    preview.textContent = `현재 수치: ${selectedEquipment.statValue.toFixed(1)}% / 성공 시: ${(selectedEquipment.statValue + addValue).toFixed(1)}% / 남은 업그레이드: ${selectedEquipment.upgradesLeft}회`;
  }
}

window.handleToggleEquipmentEquip = handleToggleEquipmentEquip;
window.handleOpenEquipmentEnhanceFor = handleOpenEquipmentEnhanceFor;
window.handleEquipmentEnhanceSelect = handleEquipmentEnhanceSelect;
window.handleEquipmentScrollSelect = handleEquipmentScrollSelect;
window.handleCardGradeFilterChange = handleCardGradeFilterChange;
window.handleCardSortChange = handleCardSortChange;
window.handleEquipmentSortChange = handleEquipmentSortChange;
window.handleEquipmentPageChange = handleEquipmentPageChange;
window.handleEquipmentDismantleSelect = handleEquipmentDismantleSelect;
window.handleEquipmentDismantleSortChange = handleEquipmentDismantleSortChange;
window.handleMarketplaceTypeChange = handleMarketplaceTypeChange;
window.handleMarketplaceViewChange = handleMarketplaceViewChange;
window.handleMarketplaceSortChange = handleMarketplaceSortChange;
window.handleMarketplaceRegisterTypeChange = handleMarketplaceRegisterTypeChange;
window.handleMarketplaceRegisterSortChange = handleMarketplaceRegisterSortChange;
window.handleMarketplaceRegisterSelect = handleMarketplaceRegisterSelect;
window.handleMarketplaceBuy = handleMarketplaceBuy;
window.handleMarketplaceCancel = handleMarketplaceCancel;
window.handleBranchFound = handleBranchFound;
window.handleBranchRename = handleBranchRename;
window.handleBranchContractPercentInput = handleBranchContractPercentInput;
window.handleBranchEmployeeSortChange = handleBranchEmployeeSortChange;
window.handleBranchRecruit = handleBranchRecruit;
window.handleBranchFire = handleBranchFire;
window.handleBranchExcavate = handleBranchExcavate;
window.handleBranchAutoExcavationToggle = handleBranchAutoExcavationToggle;
window.handleBranchBuyStorage = handleBranchBuyStorage;
window.handleBranchDispose = handleBranchDispose;
window.handleFragmentShopBuy = handleFragmentShopBuy;
window.handleEmblemShopBuy = handleEmblemShopBuy;
window.handleToggleEmblem = handleToggleEmblem;
window.handlePvpCardSelect = handlePvpCardSelect;
window.handlePvpPlanSkill = handlePvpPlanSkill;
window.handlePvpBasicOnlyTurn = handlePvpBasicOnlyTurn;


function renderRaidBattle(raidState, user) {
  const battle = raidState?.activeBattle;
  if (!battle) return;
  if (lastRenderedRaidBattleId !== battle.battleId) {
    raidBarAnimationState = {
      bossHpRatio: null,
      participantHpRatios: {}
    };
    lastRenderedRaidBattleId = battle.battleId;
  }
  updateRaidReadyCountdown(battle);
  updateRaidBossPortraitToggleButtons();
  const participantCount = battle.participants?.length || 0;
  const currentTurnIndex = Number(battle.currentTurnIndex || 0);
  const isBossTurn = currentTurnIndex >= participantCount;

  setText('raidScreenBossName', `${battle.modeLabel ? `${battle.modeLabel} ` : ''}${battle.bossName}`);
  setText('raidBossTitle', battle.bossName);
  setText('raidBossHpText', `${formatNumber(battle.bossHp)} / ${formatNumber(battle.bossMaxHp)}`);
  const bossEffectList = document.getElementById('raidBossEffectList');
  if (bossEffectList) {
    bossEffectList.innerHTML = (battle.bossStatusEffects || [])
      .map((effect) => `
        <div class="raid-effect-badge ${effect.type === 'debuff' ? 'raid-effect-debuff' : 'raid-effect-buff'}" title="${escapeAttr(effect.desc || '')}">
          <div class="raid-effect-name">${escapeHtml(effect.name)}${effect.turns ? ` (${formatNumber(effect.turns)}턴)` : ''}${effect.count ? ` (${formatNumber(effect.count)}회)` : ''}</div>
          ${effect.desc ? `<div class="raid-effect-desc">${escapeHtml(effect.desc)}</div>` : ''}
        </div>
      `)
      .join('') || '<span class="muted-text">보스 버프 / 디버프 없음</span>';
  }
  renderSpectatorPanel('raidSpectatorPanel', 'raidSpectatorList', battle.spectators || []);

  const bossPortrait = document.getElementById('raidBossPortrait');
  renderRaidBossPortrait(bossPortrait, battle.bossPortrait, battle.bossName);

  const turnBanner = document.getElementById('raidTurnBanner');
  const turnLabel = document.getElementById('raidTurnLabel');
  const turnActor = document.getElementById('raidTurnActor');
  if (turnBanner && turnLabel && turnActor) {
    const turnNumber = Math.max(1, Number(battle.bossPatternIndex || 0) + 1);
    const actingParticipant = !isBossTurn ? battle.participants?.[currentTurnIndex] : null;
    turnLabel.textContent = `현재 턴 ${formatNumber(turnNumber)}`;
    turnActor.textContent = isBossTurn
      ? '보스 행동'
      : `우리팀 행동${actingParticipant?.displayName ? ` - ${actingParticipant.displayName}` : ''}`;
    turnBanner.classList.toggle('party-turn', !isBossTurn);
    turnBanner.classList.toggle('boss-turn', isBossTurn);
  }

  const bossArea = document.getElementById('raidBossArea');
  if (bossArea) bossArea.classList.toggle('active-turn', isBossTurn);

  const bossBar = document.querySelector('.raid-boss-bar');
  if (bossBar) {
    const ratio = battle.bossMaxHp > 0 ? (battle.bossHp / battle.bossMaxHp) * 100 : 0;
    const shieldRatio = battle.bossMaxHp > 0 ? Math.min(100, (battle.bossShield / battle.bossMaxHp) * 100) : 0;
    const bossLossText = Number(battle.bossLastHpLoss || 0) > 0 ? `-${formatNumber(battle.bossLastHpLoss || 0)}` : '';
    updateRaidAnimatedBar(bossBar, {
      hpRatio: ratio,
      shieldRatio,
      lossText: bossLossText,
      fillClass: 'raid-boss-bar-fill',
      trailClass: 'raid-boss-bar-trail',
      trailDelayMs: 950
    });
    raidBarAnimationState.bossHpRatio = ratio;
  }

  const battleLog = document.getElementById('raidBattleLog');
  if (battleLog) {
    const logs = [...(battle.recentLogs || [])].reverse();
    battleLog.innerHTML = logs
      .map((line, index) => `<div class="raid-log-line ${index === 0 ? 'latest' : ''}">${escapeHtml(line)}</div>`)
      .join('');
    if (raidBattleLogPinnedToBottom) {
      battleLog.scrollTop = 0;
    }
  }

  const participantList = document.getElementById('raidParticipantList');
  if (!participantList) return;
  const activeParticipantIds = new Set((battle.participants || []).map((participant) => String(participant.userId)));
  Array.from(participantList.children).forEach((child) => {
    if (!activeParticipantIds.has(String(child.dataset.userId || ''))) child.remove();
  });

  (battle.participants || []).forEach((participant) => {
    const hpRatio = participant.maxHp > 0 ? (participant.hp / participant.maxHp) * 100 : 0;
    const shieldRatio = participant.maxHp > 0 ? Math.min(100, (participant.shield / participant.maxHp) * 100) : 0;
    const ownControls = participant.isSelf ? buildRaidSkillControls(participant, battle.participants) : '';
    const isActiveParticipant = !isBossTurn && Number(participant.turnOrder) === currentTurnIndex;
    const lossTextParts = [];
    if (Number(participant.lastShieldLoss || 0) > 0) lossTextParts.push(`실드 -${formatNumber(participant.lastShieldLoss || 0)}`);
    if (Number(participant.lastHpLoss || 0) > 0) lossTextParts.push(`HP -${formatNumber(participant.lastHpLoss || 0)}`);
    const lossText = lossTextParts.join(' / ');
    const effectBadges = (participant.statusEffects || [])
      .map((effect) => `
        <div class="raid-effect-badge ${effect.type === 'debuff' ? 'raid-effect-debuff' : 'raid-effect-buff'}">
          <div class="raid-effect-name">${escapeHtml(effect.name)}${effect.turns ? ` (${formatNumber(effect.turns)}턴)` : ''}${effect.count ? ` (${formatNumber(effect.count)}회)` : ''}</div>
          ${effect.desc ? `<div class="raid-effect-desc">${escapeHtml(effect.desc)}</div>` : ''}
        </div>
      `)
      .join('');

    let participantCard = Array.from(participantList.children)
      .find((child) => String(child.dataset.userId || '') === String(participant.userId));
    if (!participantCard) {
      participantCard = createRaidParticipantCardElement(participant.userId);
    }
    participantList.appendChild(participantCard);
    const participantCardVisual = {
      specialStyle: participant.equippedCardSpecialStyle,
      potatoRehabAuraStrength: participant.equippedCardPotatoRehabAuraStrength
    };
    const isChampionCard = participant.equippedCardSpecialStyle === 'champion';
    participantCard.classList.toggle('active-turn', isActiveParticipant);
    applyCardVisualToElement(participantCard, participantCardVisual);
    participantCard.classList.toggle('raid-champion-profile', isChampionCard);
    const participantNameEl = participantCard.querySelector('[data-raid-participant-name]');
    if (participantNameEl) {
      participantNameEl.textContent = getCompactDisplayName(participant.displayName || '', 16);
      participantNameEl.title = participant.displayName || '';
    }
    participantCard.querySelector('[data-raid-participant-level]').textContent = `Lv.${formatNumber(participant.level)}`;
    const equippedCardEl = participantCard.querySelector('[data-raid-participant-card]');
    equippedCardEl.textContent = participant.equippedCardName || '장착 카드 없음';
    applyCardVisualToElement(equippedCardEl, participantCardVisual);
    participantCard.querySelector('[data-raid-participant-status]').textContent = `HP ${formatNumber(participant.hp)} / ${formatNumber(participant.maxHp)}`;
    participantCard.querySelector('[data-raid-participant-shield-text]').textContent = `보호막 ${formatNumber(participant.shield || 0)}`;

    const shieldIndicator = participantCard.querySelector('[data-raid-participant-shield-indicator]');
    if (shieldIndicator) {
      shieldIndicator.textContent = participant.shield > 0 ? `실드 ${formatNumber(participant.shield || 0)}` : '';
      shieldIndicator.classList.toggle('hidden', !(participant.shield > 0));
    }

    const lossIndicator = participantCard.querySelector('[data-raid-participant-loss]');
    if (lossIndicator) {
      lossIndicator.textContent = lossText || '';
      lossIndicator.classList.toggle('hidden', !lossText);
    }

    const effectsEl = participantCard.querySelector('[data-raid-participant-effects]');
    if (effectsEl) {
      effectsEl.innerHTML = effectBadges || '<span class="muted-text">버프 / 디버프 없음</span>';
    }

    const controlsEl = participantCard.querySelector('[data-raid-participant-controls]');
    if (controlsEl) {
      controlsEl.innerHTML = ownControls;
    }

    updateRaidAnimatedBar(participantCard.querySelector('[data-raid-participant-hp-bar]'), {
      hpRatio,
      shieldRatio,
      fillClass: 'raid-hp-fill',
      trailClass: 'raid-hp-trail-fill',
      trailDelayMs: 950
    });
    raidBarAnimationState.participantHpRatios[participant.userId] = hpRatio;
  });
}


function stopRaidReadyTicker() {
  if (raidReadyTicker) clearInterval(raidReadyTicker);
  raidReadyTicker = null;
  raidReadyEndsAtMs = 0;
}

function renderRaidReadyCountdownNumber() {
  const overlay = document.getElementById('raidReadyCountdownOverlay');
  const numberEl = document.getElementById('raidReadyCountdownNumber');
  if (!overlay || !numberEl || !raidReadyEndsAtMs) return;

  const remainingMs = raidReadyEndsAtMs - Date.now();
  const displayValue = Math.max(1, Math.ceil(remainingMs / 1000));
  numberEl.textContent = String(displayValue);
  if (remainingMs <= 0) {
    overlay.classList.add('hidden');
    stopRaidReadyTicker();
  }
}

function updateRaidReadyCountdown(battle) {
  const overlay = document.getElementById('raidReadyCountdownOverlay');
  if (!overlay) return;

  const readyEndsAtMs = battle?.phase === 'ready' && battle.readyEndsAt
    ? new Date(battle.readyEndsAt).getTime()
    : 0;
  if (!readyEndsAtMs || readyEndsAtMs <= Date.now()) {
    overlay.classList.add('hidden');
    stopRaidReadyTicker();
    return;
  }

  overlay.classList.remove('hidden');
  if (raidReadyEndsAtMs !== readyEndsAtMs) {
    stopRaidReadyTicker();
    raidReadyEndsAtMs = readyEndsAtMs;
    raidReadyTicker = setInterval(renderRaidReadyCountdownNumber, 150);
  }
  renderRaidReadyCountdownNumber();
}

function stopRaidCountdownTicker() {
  if (raidCountdownTicker) clearInterval(raidCountdownTicker);
  raidCountdownTicker = null;
  raidCountdownEndsAtMs = 0;
  raidCountdownDisplayStartMs = 0;
}

function renderRaidCountdownNumber() {
  const numberEl = document.getElementById('raidCountdownNumber');
  if (!numberEl || !raidCountdownVisible || !raidCountdownDisplayStartMs) return;

  const elapsedSeconds = Math.floor((Date.now() - raidCountdownDisplayStartMs) / 1000);
  const displayValue = Math.max(1, 3 - elapsedSeconds);
  numberEl.textContent = String(displayValue);
}

function updateRaidCountdown(raidState, user) {
  const overlay = document.getElementById('raidCountdownOverlay');
  const numberEl = document.getElementById('raidCountdownNumber');
  const cancelBtn = document.getElementById('raidCountdownCancelBtn');
  if (!overlay || !numberEl) return;

  const countdown = raidState?.countdown;
  const battle = raidState?.activeBattle;
  const isParticipant = Boolean(battle?.isParticipant);

  if (countdown?.active && isParticipant && countdown.endsAt) {
    const nextEndsAtMs = new Date(countdown.endsAt).getTime();
    if (raidCountdownEndsAtMs !== nextEndsAtMs) {
      if (raidCountdownTicker) clearInterval(raidCountdownTicker);
      raidCountdownEndsAtMs = nextEndsAtMs;
      raidCountdownDisplayStartMs = Date.now();
      raidCountdownTicker = setInterval(renderRaidCountdownNumber, 200);
    }
    if (cancelBtn) cancelBtn.disabled = false;
    showModal('raidCountdownOverlay');
    raidCountdownVisible = true;
    renderRaidCountdownNumber();
    return;
  }

  if (['ready', 'active'].includes(battle?.phase) && isParticipant) {
    hideModal('raidCountdownOverlay');
    raidCountdownVisible = false;
    stopRaidCountdownTicker();
    if (cancelBtn) cancelBtn.disabled = true;
    hideModal('raidLobbyModal');
    showRaidScreen();
    renderRaidBattle(raidState, user);
    return;
  }

  if (raidCountdownVisible) {
    hideModal('raidCountdownOverlay');
    raidCountdownVisible = false;
    stopRaidCountdownTicker();
    if (cancelBtn) cancelBtn.disabled = false;
    if (!raidState?.activeBattle && Number.isInteger(raidState?.queuedSlotIndex) && raidState.queuedSlotIndex >= 0) {
      showModal('raidLobbyModal');
    }
  }
}

async function pollRaidState() {
  const user = getStoredUser();
  if (!user?._id) return;
  if (userMutationInFlightCount > 0) return;
  if (raidPollRequestInFlight) return;

  try {
    raidPollRequestInFlight = true;
    const raidScreenOpen = !document.getElementById('raid-screen')?.classList.contains('hidden');
    const viewing = raidScreenOpen && Boolean(latestRaidState?.activeBattle);
    const data = await postJson(`${API_URL}/api/raid/state`, { userId: user._id, viewing, mode: selectedRaidMode });
    latestRaidState = data.raid;
    if (latestRaidState?.mode) selectedRaidMode = latestRaidState.mode;
    if (data.user) {
      updateLocalUserState(data, { force: false });
    }
    const currentUser = getStoredUser() || user;
    updateRaidButton(currentUser, latestRaidState);
    updateRaidLobbyUI(latestRaidState, currentUser);
    updateRaidCountdown(latestRaidState, currentUser);

    const shouldRenderBattle = ['countdown', 'ready', 'active'].includes(latestRaidState?.activeBattle?.phase)
      && (latestRaidState.activeBattle.isParticipant || raidScreenOpen);
    if (shouldRenderBattle) {
      hideModal('raidLobbyModal');
      showRaidScreen();
      renderRaidBattle(latestRaidState, currentUser);
    } else if (!latestRaidState?.activeBattle && !document.getElementById('raid-screen').classList.contains('hidden')) {
      handleRaidBackClick();
    }
  } catch (err) {
    console.error('Raid state poll failed:', err);
  } finally {
    raidPollRequestInFlight = false;
  }
}

async function handleRaidSlotClick(slotIndex) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  try {
    const data = await postJson(`${API_URL}/api/raid/toggle-slot`, {
      userId: user._id,
      slotIndex,
      mode: selectedRaidMode
    });
    latestRaidState = data.raid;
    if (latestRaidState?.mode) selectedRaidMode = latestRaidState.mode;
    updateRaidButton(user, latestRaidState);
    updateRaidLobbyUI(latestRaidState, user);
  } catch (err) {
    alert(err.message);
  }
}

async function handleRaidStartClick() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  try {
    const selectedBattle = latestRaidState?.activeBattle || latestRaidState?.activeBattles?.[selectedRaidMode];
    if (selectedBattle && !selectedBattle.isParticipant) {
      latestRaidState.activeBattle = selectedBattle;
      hideModal('raidLobbyModal');
      showRaidScreen();
      renderRaidBattle(latestRaidState, user);
      pollRaidState();
      return;
    }
    const data = await postJson(`${API_URL}/api/raid/start`, { userId: user._id, mode: selectedRaidMode });
    latestRaidState = data.raid;
    if (latestRaidState?.mode) selectedRaidMode = latestRaidState.mode;
    updateRaidLobbyUI(latestRaidState, user);
    updateRaidCountdown(latestRaidState, user);
  } catch (err) {
    alert(err.message);
  }
}

async function handleRaidCountdownCancelClick() {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  try {
    const button = document.getElementById('raidCountdownCancelBtn');
    if (button) button.disabled = true;
    const data = await postJson(`${API_URL}/api/raid/cancel-countdown`, { userId: user._id, mode: selectedRaidMode });
    latestRaidState = data.raid;
    if (latestRaidState?.mode) selectedRaidMode = latestRaidState.mode;
    hideModal('raidCountdownOverlay');
    raidCountdownVisible = false;
    updateRaidButton(user, latestRaidState);
    updateRaidLobbyUI(latestRaidState, user);
    showModal('raidLobbyModal');
  } catch (err) {
    const button = document.getElementById('raidCountdownCancelBtn');
    if (button) button.disabled = false;
    alert(err.message);
  }
}


function updateGameUI(user) {
  const activeTabName = getActiveMenuTabName();
  updateStatusUI(user);
  updateBuffUI(user);
  updateSpecialActionButtons(user);
  updateSkillTab(user);
  refreshSideJobStatus(user);
  updateShoutStatus(user);
  if (activeTabName === 'inventory' && !hasFocusedQuantityInput()) {
    updateInventoryUI(user);
  }
  if (activeTabName === 'shop' && !hasFocusedQuantityInput()) {
    updateShopUI(user);
  }
  if (activeTabName === 'stats') {
    updateStatsTab(user);
  }
  updateInfiniteOvertimeButton(user, latestInfiniteOvertimeState);
  updateStockStatus(user);
  updateStressEffect(user.gameState?.stress || 0);
  setText('adventureLog', user.meta?.lastAdventureLog || '모험에서 어떤 일이 벌어질지 모릅니다.');
  if (isFusionModalOpen()) {
    renderCardFusionModal(user);
  }
  if (isEnhanceModalOpen()) {
    renderCardEnhanceModal(user);
  }
}


function updateSkillTab(user) {
  const tabButton = document.getElementById('skillTabButton');
  const skillTab = document.getElementById('tab-skill');
  const skillButton = document.getElementById('workOptimizationSkillBtn');
  const statusEl = document.getElementById('workOptimizationSkillStatus');
  const skill = user?.skills?.workOptimization || {};
  const unlocked = Boolean(user?.skills?.unlocked && skill.unlocked);

  if (tabButton) tabButton.classList.toggle('hidden', !unlocked);
  if (!unlocked && skillTab && !skillTab.classList.contains('hidden') && typeof window.showTab === 'function') {
    window.showTab('work');
  }

  if (!skillButton || !statusEl) return;
  if (!unlocked) {
    skillButton.disabled = true;
    statusEl.textContent = `${skill.unlockLevel || 200}레벨부터 사용할 수 있습니다.`;
    return;
  }

  const remainingMs = Number(skill.remainingMs || 0);
  skillButton.disabled = !skill.available;
  statusEl.textContent = skill.available
    ? '사용 가능: 현재 온라인인 모든 유저에게 1시간 경험치 2배 버프를 부여합니다.'
    : `재사용 대기 중: ${formatDurationMs(remainingMs)} 남음`;
}

function refreshSideJobStatus(user) {
  const sideJobBtn = document.getElementById('sideJobBtn');
  const sideJobStatus = document.getElementById('sideJobStatus');
  if (!sideJobBtn || !sideJobStatus || !user?.gameState) return;

  const reward = Math.floor(Number(user.gameState.salaryPerMinute || 0) * 300);
  const stress = Number(user.gameState.stress || 0);
  const stamina = Number(user.gameState.stamina || 0);
  const canUse = stress <= 60 && stamina >= 1;
  sideJobBtn.disabled = !canUse;
  sideJobStatus.textContent = canUse
    ? `즉시 스트레스 +40 / 즉시 획득 ${formatNumber(reward)}원`
    : stress > 60
      ? `스트레스가 60 이하여야 부업 가능합니다. (현재 ${formatNumber(stress, 2)})`
      : `행동력이 부족합니다. 현재 행동력 ${formatNumber(stamina, 2)}`;
}

function updateStatusUI(user) {
  const state = user.gameState;
  const itemStats = user.itemStats || {};
  if (!state) return;

  setText('userNickname', getMainName(user));
  setText('money', formatNumber(Math.floor(state.money)));
  setText('salaryRate', formatNumber(state.salaryPerMinute ?? 0, 2));
  setText('level', state.level);
  setText('stamina', `${formatNumber(state.stamina ?? 0, 1)}/${formatNumber(state.maxStamina ?? 0, 1)}`);
  setText('businessCardCount', formatNumber(getBusinessCardCount(user)));

  const stressEl = document.getElementById('stress');
  stressEl.textContent = formatNumber(state.stress ?? 0, 2);
  stressEl.style.color = state.stress >= 100 ? 'red' : '';
  stressEl.style.fontWeight = state.stress >= 100 ? 'bold' : 'normal';

  const maxExp = state.nextLevelExp || 1000;
  setText('expText', `${formatNumber(state.exp)}/${formatNumber(maxExp)}`);
  const expBar = document.getElementById('expBar');
  if (expBar) {
    expBar.max = maxExp;
    expBar.value = state.exp;
  }

  const equippedTitle = getEquippedTitleDetail(user);
  setText('currentTitleText', equippedTitle ? equippedTitle.name : '없음');
  setText('passiveExpPreview', formatNumber(state.passiveDailyExp ?? 0, 2));
  setText('clickExpPreview', formatNumber(state.clickExp ?? 0));
  setText('stressReductionPreview', `${formatNumber(itemStats.stressReduction ?? 0, 2)}%`);
  updateStockTournamentEntryButton(user);
}

function updateBuffUI(user) {
  const buffListEl = document.getElementById('buff-list');
  if (!buffListEl) return;

  buffListEl.innerHTML = '';
  let hasAnyBuff = false;
  const now = new Date();

  const equippedTitle = getEquippedTitleDetail(user);
  if (equippedTitle) {
    hasAnyBuff = true;
    buffListEl.insertAdjacentHTML(
      'beforeend',
      `
        <div class="buff-item title-buff">
          칭호 버프: ${escapeHtml(equippedTitle.name)}
          <span class="buff-tooltip">
            <strong>${escapeHtml(equippedTitle.name)}</strong><br>
            ${escapeHtml(equippedTitle.desc)}
          </span>
        </div>
      `
    );
  }

  (user.buffs || []).forEach((buff) => {
    const info = BUFF_DATA[buff.buffId];
    if (!info) return;

    const expiresAt = new Date(buff.expiresAt);
    if (expiresAt <= now) return;

    hasAnyBuff = true;
    const remainingMs = expiresAt.getTime() - now.getTime();
    const remainingMin = Math.floor(remainingMs / 60000);
    const remainingSec = Math.floor((remainingMs % 60000) / 1000);
    const className = info.className || 'buff-item';

    buffListEl.insertAdjacentHTML(
      'beforeend',
      `
        <div class="${className}">
          ${escapeHtml(info.name)}
          <span class="buff-tooltip">
            <strong>${escapeHtml(info.name)}</strong><br>
            ${escapeHtml(info.desc || '')}${info.desc ? '<br><br>' : ''}
            (${remainingMin}분 ${remainingSec}초 남음)
          </span>
        </div>
      `
    );
  });

  if ((user.gameState?.stress || 0) >= 100) {
    hasAnyBuff = true;
    buffListEl.insertAdjacentHTML(
      'beforeend',
      `
        <div class="debuff-item">
          스트레스 과다
          <span class="buff-tooltip">
            <strong>스트레스 과다</strong><br>
            자동 경험치는 절반만 획득하고<br>
            서류 작업 클릭 경험치는 획득할 수 없습니다.
          </span>
        </div>
      `
    );
  }

  if (!hasAnyBuff) {
    buffListEl.textContent = '(없음)';
  }
}


function getCardDurationText(card) {
  if (!card) return '즉시';
  if (card.passiveOnly) return '전투 내내 또는 매 턴 자동 적용';
  const desc = String(card.skillDesc || '');
  const turnMatch = desc.match(/(\d+)턴/);
  if (turnMatch) return `${turnMatch[1]}턴`;
  if (desc.includes('다음 턴')) return '다음 턴';
  if (desc.includes('돌아오는 턴')) return '다음 자신의 턴';
  return '즉시';
}

function updateStatsTab(user) {
  const statsList = document.getElementById('stats-list');
  if (!statsList) return;

  const state = user.gameState || {};
  const itemStats = user.itemStats || {};
  const equippedTitle = getEquippedTitleDetail(user);
  const equippedCard = getEquippedCardDetail(user);
  const pendingStock = user.pendingStockInvestment?.amount > 0
    ? `${formatNumber(user.pendingStockInvestment.amount)}원 투자 완료`
    : '없음';
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const todayKey = `${kstNow.getUTCFullYear()}-${String(kstNow.getUTCMonth() + 1).padStart(2, '0')}-${String(kstNow.getUTCDate()).padStart(2, '0')}`;
  const titleChangeStatus = user.meta?.lastTitleChangeDayKey === todayKey ? '오늘 이미 변경함' : '오늘 변경 가능';

  statsList.innerHTML = `
    <tr><td>레벨</td><td>${formatNumber(state.level)}</td></tr>
    <tr><td>보유 자산</td><td>${formatNumber(Math.floor(state.money || 0))}원</td></tr>
    <tr><td>현재 분당 월급</td><td>${formatNumber(state.salaryPerMinute || 0, 2)}원</td></tr>
    <tr><td>하루 자동 경험치</td><td>${formatNumber(state.passiveDailyExp || 0, 2)}</td></tr>
    <tr><td>서류 작업 클릭 경험치</td><td>${formatNumber(state.clickExp || 0)}</td></tr>
    <tr><td>스트레스</td><td>${formatNumber(state.stress || 0, 2)} / 100</td></tr>
    <tr><td>스트레스 적용률</td><td>${formatNumber((itemStats.stressMultiplier || 1) * 100, 2)}%</td></tr>
    <tr><td>스트레스 감소율</td><td>${formatNumber(itemStats.stressReduction || 0, 2)}%</td></tr>
    <tr><td>월급 보너스</td><td>+${formatNumber(itemStats.moneyBonus || 0, 2)}%</td></tr>
    <tr><td>시간당 스트레스 회복</td><td>${formatNumber(itemStats.hourlyStressRelief || 0, 2)}</td></tr>
    <tr><td>행동력</td><td>${formatNumber(state.stamina || 0, 1)} / ${formatNumber(state.maxStamina || 0, 1)}</td></tr>
    <tr><td>모험 행동력 소모</td><td>${formatNumber(itemStats.adventureStaminaMultiplier || 1, 1)}</td></tr>
    <tr><td>장착 칭호</td><td>${escapeHtml(equippedTitle?.name || '없음')}</td></tr>
    <tr><td>장착 카드</td><td>${escapeHtml(equippedCard?.name || '없음')}</td></tr>
    <tr><td>보유 명함</td><td>${formatNumber(getBusinessCardCount(user))}장</td></tr>
    <tr><td>칭호 변경 가능 여부</td><td>${escapeHtml(titleChangeStatus)}</td></tr>
    <tr><td>고양이 참치캔 누적 지급</td><td>${formatNumber(user.meta?.catFoodGivenCount || 0)}회</td></tr>
    <tr><td>주식 투자 현황</td><td>${escapeHtml(pendingStock)}</td></tr>
    <tr><td>오늘 쇼핑 누적</td><td>${formatNumber(user.shopState?.dailySpend || 0)}원</td></tr>
  `;
}

function updateStockStatus(user) {
  const stockStatus = document.getElementById('stock-status');
  if (!stockStatus) return;
  const portfolio = Array.isArray(user.stockPortfolio) ? user.stockPortfolio : [];
  const heldShares = portfolio.reduce((sum, entry) => sum + Number(entry.shares || 0), 0);
  stockStatus.textContent = heldShares > 0
    ? '현재 보유 주식 ' + formatNumber(heldShares) + '주. 회사 주식 시장에서 언제든 매수/매도할 수 있습니다.'
    : '회사 주식 시장에서 상장 회사의 주식을 직접 사고팔 수 있습니다.';
}

function updateStressEffect(stress) {
  const gameScreen = document.getElementById('game-screen');
  if (!gameScreen) return;

  if (stress >= 90) gameScreen.classList.add('stress-warning');
  else gameScreen.classList.remove('stress-warning');
}

async function syncUserState() {
  const user = getStoredUser();
  if (!user?._id) return;
  if (userMutationInFlightCount > 0) return;
  if (syncRequestInFlight) return;

  try {
    syncRequestInFlight = true;
    const includeCounts = Date.now() - lastSyncPendingCountAt >= 60000;
    const data = await postJson(`${API_URL}/api/sync`, { userId: user._id, includeCounts });
    if (includeCounts) lastSyncPendingCountAt = Date.now();
    updateLocalUserState(data, { force: false });
  } catch (err) {
    console.error('State sync failed:', err);
  } finally {
    syncRequestInFlight = false;
  }
}

async function updateRankingUI() {
  const rankingListBody = document.getElementById('ranking-list-body');
  if (!rankingListBody) return;
  if (rankingRequestInFlight) return;
  const showRankingEmblems = isRankingEmblemsEnabled();
  updateRankingEmblemToggleButton();

  try {
    rankingRequestInFlight = true;
    const rankingData = await getJson(`${API_URL}/api/ranking?mode=${encodeURIComponent(rankingMode)}`);
    const entries = Array.isArray(rankingData)
      ? rankingData
      : (rankingMode === 'pvp' ? (rankingData.pvp || []) : (rankingMode === 'branch' ? (rankingData.branch || []) : (rankingData.level || [])));
    const valueHeader = document.getElementById('rankingValueHeader');
    if (valueHeader) valueHeader.textContent = rankingMode === 'pvp' ? '면담 점수' : (rankingMode === 'branch' ? '회사 가치' : '레벨');
    document.getElementById('rankingLevelTab')?.classList.toggle('active', rankingMode === 'level');
    document.getElementById('rankingPvpTab')?.classList.toggle('active', rankingMode === 'pvp');
    document.getElementById('rankingBranchTab')?.classList.toggle('active', rankingMode === 'branch');
    rankingListBody.innerHTML = '';

    if (entries.length === 0) {
      rankingListBody.innerHTML = '<tr><td colspan="3" class="center-text">랭킹 정보가 없습니다.</td></tr>';
      rankingRequestInFlight = false;
      return;
    }

    entries.forEach((entry, index) => {
      let rankClass = '';
      if (index === 0) rankClass = 'rank-1';
      if (index === 1) rankClass = 'rank-2';
      if (index === 2) rankClass = 'rank-3';
      const valueText = rankingMode === 'pvp'
        ? (Number(entry.pvpStats?.played || 0) > 0 ? `${formatNumber(entry.pvpStats.rating)}점` : '---점')
        : (rankingMode === 'branch' ? `${formatNumber(entry.branchOffice?.companyValue || 0)}원` : formatNumber(entry.gameState?.level || 0));
      const titleText = rankingMode === 'pvp'
        ? `전적 ${formatNumber(entry.pvpStats?.wins || 0)}승 ${formatNumber(entry.pvpStats?.losses || 0)}패`
        : (rankingMode === 'branch'
          ? `${entry.branchOffice?.companyName || '이름 없는 지사'} / 직원 ${formatNumber(entry.branchOffice?.employeeCount || 0)}명 / 창고 ${formatNumber(entry.branchOffice?.storageUsed || 0)}/${formatNumber(entry.branchOffice?.storageSlots || 0)} / 성공률 ${formatBranchPercent(entry.branchOffice?.successChance || 0)}`
          : `현재 경험치 ${formatNumber(entry.gameState?.exp || 0)}`);

      const rankingName = rankingMode === 'branch'
        ? (entry.branchOffice?.companyName || '이름 없는 회사')
        : (entry.displayName || entry.nickname || '이름 없음');
      const emblem = showRankingEmblems ? (entry.equippedEmblem || null) : null;
      const emblemClass = emblem?.className ? String(emblem.className).replace(/[^a-zA-Z0-9_-]/g, '') : '';
      const emblemIcon = showRankingEmblems && emblem?.imageUrl
        ? `<img src="${escapeAttr(emblem.imageUrl)}" alt="" class="ranking-emblem-icon" title="${escapeAttr(emblem.name || '')}">`
        : '';

      rankingListBody.insertAdjacentHTML(
        'beforeend',
        `
          <tr class="${rankClass}" title="${escapeAttr(titleText)}">
            <td class="center-text">${index + 1}</td>
            <td class="ranking-name-cell ${escapeHtml(emblemClass)}">
              <span class="online-dot ${entry.isOnline ? 'online' : 'offline'}"></span>
              <span class="ranking-display-name" title="${escapeAttr(rankingName)}">${escapeHtml(getCompactDisplayName(rankingName, 16))}</span>
              ${emblemIcon}
            </td>
            <td class="center-text">${escapeHtml(valueText)}</td>
          </tr>
        `
      );
    });
  } catch {
    rankingListBody.innerHTML = '<tr><td colspan="3" class="center-text error-text">랭킹 로딩 실패</td></tr>';
  }
  rankingRequestInFlight = false;
}

function setRankingMode(mode) {
  rankingMode = mode === 'pvp' ? 'pvp' : (mode === 'branch' ? 'branch' : 'level');
  updateRankingUI();
}

function startPeriodicUpdates() {
  clearIntervals();

  updateInterval = setInterval(() => {
    const user = getStoredUser();
    if (user) {
      updateBuffUI(user);
      updateShoutStatus(user);
    }
  }, 1000);

  updateRankingUI();
  rankingInterval = setInterval(updateRankingUI, 30000);

  syncUserState();
  syncInterval = setInterval(syncUserState, 30000);

  pollRaidState();
  raidPollInterval = setInterval(pollRaidState, 3000);

  pollPvpState();
  pvpPollInterval = setInterval(pollPvpState, 3000);
}

function startAnimation() {
  const animEl = document.getElementById('anim-display');
  if (!animEl) return;

  if (animationInterval) clearInterval(animationInterval);
  const currentAnimation = animations[Math.floor(Math.random() * animations.length)];
  let frame = 0;

  animEl.textContent = currentAnimation[0];
  animationInterval = setInterval(() => {
    animEl.textContent = currentAnimation[frame];
    frame = (frame + 1) % currentAnimation.length;
  }, 450);
}

function showAdminScreen() {
  clearIntervals();
  hideAllScreens();
  document.getElementById('admin-screen').classList.remove('hidden');
  loadAdminUsers();
}

function getAdminAuthHeaders() {
  const session = getStoredAdmin();
  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
}

async function loadAdminUsers() {
  const session = getStoredAdmin();
  if (!session?.token) return handleLogoutClick();

  try {
    const data = await getJson(`${API_URL}/api/admin/users`, getAdminAuthHeaders());
    saveStoredAdmin({
      ...session,
      giftCatalog: data.giftCatalog,
      currentRaidBossId: data.currentRaidBossId,
      raidBossOptions: data.raidBossOptions || []
    });
    renderAdminUsers(data.users);
    renderAdminGiftOptions();
    renderAdminRaidBossControls(data.currentRaidBossId, data.raidBossOptions || []);
    setText('adminStatus', `대상 유저 ${data.users.length}명을 불러왔습니다.`);
  } catch (err) {
    alert(err.message);
  }
}

function renderAdminUsers(users) {
  const giftSelect = document.getElementById('giftTargetSelect');
  const deleteSelect = document.getElementById('deleteTargetSelect');
  const levelSelect = document.getElementById('levelTargetSelect');
  const moneySelect = document.getElementById('moneyTargetSelect');
  if (!giftSelect || !deleteSelect || !levelSelect || !moneySelect) return;

  giftSelect.innerHTML = '<option value="ALL_USERS">전체 유저</option>';
  deleteSelect.innerHTML = '<option value="">삭제할 유저 선택</option>';
  levelSelect.innerHTML = '<option value="">레벨 조정할 유저 선택</option>';
  moneySelect.innerHTML = '<option value="">재화 지급 유저 선택</option>';
  users.forEach((user) => {
    giftSelect.insertAdjacentHTML(
      'beforeend',
      `<option value="${escapeHtml(user.id)}">${escapeHtml(user.label)}</option>`
    );
    deleteSelect.insertAdjacentHTML(
      'beforeend',
      `<option value="${escapeHtml(user.id)}">${escapeHtml(user.label)}</option>`
    );
    levelSelect.insertAdjacentHTML(
      'beforeend',
      `<option value="${escapeHtml(user.id)}">${escapeHtml(user.label)}</option>`
    );
    moneySelect.insertAdjacentHTML(
      'beforeend',
      `<option value="${escapeHtml(user.id)}">${escapeHtml(user.label)}</option>`
    );
  });
}

function renderAdminGiftOptions() {
  const session = getStoredAdmin();
  const giftType = document.getElementById('giftTypeSelect');
  const giftSelect = document.getElementById('giftIdSelect');
  const quantityInput = document.getElementById('giftQuantity');
  if (!session?.giftCatalog || !giftType || !giftSelect || !quantityInput) return;

  const selectedType = giftType.value;
  const entries = selectedType === 'buff'
    ? session.giftCatalog.buffs
    : selectedType === 'package'
      ? (session.giftCatalog.packages || [])
      : selectedType === 'title'
        ? (session.giftCatalog.titles || [])
        : selectedType === 'fragment'
          ? [{ id: 'equipment_fragment', name: '장비 파편' }]
          : session.giftCatalog.items;

  giftSelect.innerHTML = '';
  entries.forEach((entry) => {
    giftSelect.insertAdjacentHTML(
      'beforeend',
      `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.name)}</option>`
    );
  });

  quantityInput.disabled = selectedType === 'buff' || selectedType === 'package' || selectedType === 'title';
  if (selectedType === 'buff' || selectedType === 'package' || selectedType === 'title') quantityInput.value = '1';
}

function renderAdminRaidBossControls(currentRaidBossId, raidBossOptions) {
  const select = document.getElementById('adminRaidBossSelect');
  const currentLabel = document.getElementById('adminCurrentRaidBoss');
  const nextLabel = document.getElementById('adminNextRaidBoss');
  if (!select || !currentLabel || !nextLabel) return;

  const options = Array.isArray(raidBossOptions) ? raidBossOptions : [];
  select.innerHTML = '';
  options.forEach((entry) => {
    select.insertAdjacentHTML(
      'beforeend',
      `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.name)}</option>`
    );
  });

  if (currentRaidBossId) {
    select.value = currentRaidBossId;
  }

  const currentBoss = options.find((entry) => entry.id === currentRaidBossId);
  const nextBoss = options.find((entry) => entry.id !== currentRaidBossId) || currentBoss;
  currentLabel.textContent = currentBoss ? `현재 보스: ${currentBoss.name}` : '현재 보스: -';
  nextLabel.textContent = nextBoss ? `다음날 자동 변경: ${nextBoss.name}` : '다음날 자동 변경: -';
}

async function handleAdminGift() {
  const session = getStoredAdmin();
  if (!session?.token) return handleLogoutClick();

  const targetValue = document.getElementById('giftTargetSelect').value;
  const giftType = document.getElementById('giftTypeSelect').value;
  const giftId = document.getElementById('giftIdSelect').value;
  const quantity = Math.max(1, Math.floor(Number(document.getElementById('giftQuantity').value) || 1));

  if (!giftId) {
    alert('선물할 항목을 선택해주세요.');
    return;
  }

  const targetMode = targetValue === 'ALL_USERS' ? 'all' : 'single';

  try {
    const data = await postJson(
      `${API_URL}/api/admin/gift`,
      {
        targetMode,
        targetUserId: targetMode === 'single' ? targetValue : null,
        giftType,
        giftId,
        quantity
      },
      getAdminAuthHeaders()
    );

    setText('adminStatus', `선물을 ${data.deliveredCount}명에게 발송했습니다.`);
    alert(`운영자 선물이 ${data.deliveredCount}명에게 발송되었습니다.`);
  } catch (err) {
    alert(err.message);
  }
}

async function handleAdminDeleteUser() {
  const session = getStoredAdmin();
  if (!session?.token) return handleLogoutClick();

  const select = document.getElementById('deleteTargetSelect');
  if (!select?.value) {
    alert('삭제할 유저를 선택해주세요.');
    return;
  }

  const selectedLabel = select.options[select.selectedIndex]?.textContent || '선택한 유저';
  if (!confirm(`정말 ${selectedLabel} 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
    return;
  }

  try {
    const data = await postJson(
      `${API_URL}/api/admin/delete-user`,
      { targetUserId: select.value },
      getAdminAuthHeaders()
    );

    await loadAdminUsers();
    setText('adminStatus', `${data.deletedLabel} 계정을 삭제했습니다.`);
    alert(`${data.deletedLabel} 계정을 삭제했습니다.`);
  } catch (err) {
    alert(err.message);
  }
}

async function handleAdminSetLevel() {
  const session = getStoredAdmin();
  if (!session?.token) return handleLogoutClick();

  const targetSelect = document.getElementById('levelTargetSelect');
  const levelInput = document.getElementById('levelValueInput');
  if (!targetSelect?.value) {
    alert('레벨을 조정할 유저를 선택해주세요.');
    return;
  }

  const targetLevel = Math.max(1, Math.floor(Number(levelInput?.value) || 1));
  const selectedLabel = targetSelect.options[targetSelect.selectedIndex]?.textContent || '선택한 유저';
  if (!confirm(`${selectedLabel}의 레벨을 ${targetLevel}(으)로 변경하시겠습니까? 현재 경험치는 0으로 초기화됩니다.`)) {
    return;
  }

  try {
    const data = await postJson(
      `${API_URL}/api/admin/set-level`,
      {
        targetUserId: targetSelect.value,
        level: targetLevel
      },
      getAdminAuthHeaders()
    );

    setText('adminStatus', `${data.updatedLabel} 레벨을 ${data.level}(으)로 변경했습니다.`);
    alert(`${data.updatedLabel} 레벨을 ${data.level}(으)로 변경했습니다.`);
  } catch (err) {
    alert(err.message);
  }
}

async function handleAdminGrantMoney() {
  const session = getStoredAdmin();
  if (!session?.token) return handleLogoutClick();

  const targetSelect = document.getElementById('moneyTargetSelect');
  const amountInput = document.getElementById('moneyAmountInput');
  if (!targetSelect?.value) {
    alert('재화를 지급할 유저를 선택해주세요.');
    return;
  }

  const amount = Math.max(1, Math.floor(Number(amountInput?.value) || 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    alert('지급할 금액을 올바르게 입력해주세요.');
    return;
  }

  const selectedLabel = targetSelect.options[targetSelect.selectedIndex]?.textContent || '선택한 유저';
  if (!confirm(`${selectedLabel}에게 ${amount.toLocaleString()}원을 지급하시겠습니까?`)) {
    return;
  }

  try {
    const data = await postJson(
      `${API_URL}/api/admin/grant-money`,
      {
        targetUserId: targetSelect.value,
        amount
      },
      getAdminAuthHeaders()
    );

    setText('adminStatus', `${data.updatedLabel}에게 ${Number(data.amount).toLocaleString()}원을 지급했습니다.`);
    alert(`${data.updatedLabel}에게 ${Number(data.amount).toLocaleString()}원을 지급했습니다.`);
  } catch (err) {
    alert(err.message);
  }
}

async function handleAdminSetRaidBoss() {
  const session = getStoredAdmin();
  if (!session?.token) return handleLogoutClick();

  const select = document.getElementById('adminRaidBossSelect');
  if (!select?.value) {
    alert('변경할 보스를 선택해주세요.');
    return;
  }

  const selectedLabel = select.options[select.selectedIndex]?.textContent || '선택한 보스';
  if (!confirm(`오늘의 보스를 ${selectedLabel}(으)로 변경하시겠습니까? 다음날에는 다른 보스로 자동 변경됩니다.`)) {
    return;
  }

  try {
    const data = await postJson(
      `${API_URL}/api/admin/set-raid-boss`,
      { bossId: select.value },
      getAdminAuthHeaders()
    );

    const nextSession = {
      ...session,
      currentRaidBossId: data.currentRaidBossId
    };
    saveStoredAdmin(nextSession);
    renderAdminRaidBossControls(data.currentRaidBossId, nextSession.raidBossOptions || []);
    setText('adminStatus', `오늘의 보스를 ${data.currentRaidBossName}(으)로 변경했습니다.`);
    alert(`오늘의 보스를 ${data.currentRaidBossName}(으)로 변경했습니다. 다음날에는 ${data.nextRaidBossName}(으)로 자동 변경됩니다.`);
  } catch (err) {
    alert(err.message);
  }
}

window.showTab = function showTab(tabName) {
  document.querySelectorAll('.menu-content').forEach((element) => {
    element.classList.add('hidden');
  });

  document.querySelectorAll('.menu-tabs button').forEach((button) => {
    button.classList.remove('active');
  });

  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) targetTab.classList.remove('hidden');

  const activeButton = document.querySelector(`.menu-tabs button[data-tab="${tabName}"]`);
  if (activeButton) activeButton.classList.add('active');

  const user = getStoredUser();
  if (user) {
    if (tabName === 'inventory') updateInventoryUI(user);
    if (tabName === 'shop') updateShopUI(user);
    if (tabName === 'stats') updateStatsTab(user);
    if (tabName === 'skill') updateSkillTab(user);
  }

  if (tabName === 'work') {
    if (!currentNewsTypingPrompt) loadNewsTypingPrompt();
    const input = document.getElementById('newsTypingInput');
    if (input) window.setTimeout(() => input.focus(), 0);
  }
};

window.handleBuyClick = handleBuyClick;
window.handleUseItem = handleUseItem;
window.handleCompanyStockBuy = handleCompanyStockBuy;
window.handleCompanyStockSell = handleCompanyStockSell;
window.handleCompanyStockRumor = handleCompanyStockRumor;
window.handleToggleTitle = handleToggleTitle;
window.handleToggleCardEquip = handleToggleCardEquip;
window.handleCardFusionAdd = handleCardFusionAdd;
window.handleCardFusionAutoFill = handleCardFusionAutoFill;
window.handleCardFusionSlotRemove = handleCardFusionSlotRemove;
window.handleRaidSlotClick = handleRaidSlotClick;
window.handleRaidSkillToggle = handleRaidSkillToggle;

function buildRaidTargetButtons(participant, participants, targetSlot, disabled) {
  const selectedTargetId = targetSlot === 2 ? participant.plannedTargetUserId2 : participant.plannedTargetUserId;
  return participants
    .filter((entry) => entry.hp > 0)
    .map((entry) => `
      <button
        class="mini-btn raid-target-btn ${entry.userId === selectedTargetId ? 'selected' : ''}"
        ${disabled ? 'disabled' : ''}
        onclick="handleRaidTargetSelect('${participant.userId}', ${targetSlot}, '${entry.userId}')"
      >
        ${compactDisplayHtml(entry.displayName, 12)}
      </button>
    `)
    .join('');
}

function buildRaidSkillControls(participant, participants) {
  if (!participant.equippedCardId) {
    return '<div class="raid-skill-row"><span class="muted-text">장착한 카드가 없어 기본 공격만 사용합니다.</span></div>';
  }
  if (participant.passiveOnly) {
    return '<div class="raid-skill-row"><span class="muted-text">전투 시작 시 자동으로 적용되는 패시브 카드입니다.</span></div>';
  }

  const silenced = Number(participant.silenceTurns || 0) > 0;
  const isDead = participant.hp <= 0;
  const needsPrimaryTarget = participant.targetType === 'ally' || participant.targetType === 'ally_pair';
  const needsSecondaryTarget = participant.targetType === 'ally_pair';
  const missingPrimaryTarget = needsPrimaryTarget && !participant.plannedTargetUserId;
  const missingSecondaryTarget = needsSecondaryTarget && !participant.plannedTargetUserId2;
  const onceUsed = Boolean(participant.oncePerBattleUsed);
  const toggleDisabled = participant.plannedSkill
    ? (isDead || onceUsed)
    : (isDead || onceUsed || missingPrimaryTarget || missingSecondaryTarget);
  const targetDisabled = isDead;
  const statusText = onceUsed
    ? '이번 전투 사용 완료'
    : silenced
    ? `침묵 ${formatNumber(participant.silenceTurns)}턴`
    : (participant.skillCooldown > 0 ? `쿨다운 ${formatNumber(participant.skillCooldown)}턴` : '예약 가능');

  return `
    <div class="raid-skill-row">
      <button
        class="mini-btn"
        ${toggleDisabled ? 'disabled' : ''}
        title="${escapeHtml(participant.skillDesc || '')}"
        onclick="handleRaidSkillToggle('${participant.userId}', ${participant.plannedSkill ? 'false' : 'true'})"
      >
        ${participant.plannedSkill ? '다음 턴 스킬 사용 예정' : '다음 턴 스킬 사용'}
      </button>
      <span class="menu-note">${statusText}</span>
    </div>
    ${needsPrimaryTarget ? `
      <div class="raid-target-group">
        <div class="raid-target-label">${participant.targetType === 'ally_pair' ? '1번 대상' : '버프 대상'}</div>
        <div class="raid-target-buttons">${buildRaidTargetButtons(participant, participants, 1, targetDisabled)}</div>
      </div>
    ` : ''}
    ${needsSecondaryTarget ? `
      <div class="raid-target-group">
        <div class="raid-target-label">2번 대상</div>
        <div class="raid-target-buttons">${buildRaidTargetButtons(participant, participants, 2, targetDisabled)}</div>
      </div>
    ` : ''}
  `;
}

async function handleRaidSkillToggle(userId, useSkill) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  try {
    const data = await postJson(`${API_URL}/api/raid/plan-skill`, {
      userId: user._id,
      useSkill
    });
    if (latestRaidState) {
      latestRaidState.activeBattle = data.raid;
    }
    renderRaidBattle(latestRaidState, user);
  } catch (err) {
    alert(err.message);
  }
}

async function handleRaidTargetSelect(userId, targetSlot, targetUserId) {
  const user = getStoredUser();
  if (!user?._id) return handleLogoutClick();

  try {
    const data = await postJson(`${API_URL}/api/raid/set-target`, {
      userId: user._id,
      targetSlot,
      targetUserId
    });
    if (latestRaidState) {
      latestRaidState.activeBattle = data.raid;
    }
    renderRaidBattle(latestRaidState, user);
  } catch (err) {
    alert(err.message);
  }
}

window.handleRaidSkillToggle = handleRaidSkillToggle;
window.handleRaidTargetSelect = handleRaidTargetSelect;
window.handleCardEnhanceSelect = handleCardEnhanceSelect;


function getInventoryQuantityFromUser(user, itemId) {
  return (user.inventory || [])
    .filter((item) => item.itemId === itemId)
    .reduce((total, item) => total + Math.max(0, Number(item.quantity) || 0), 0);
}

function updateSpecialActionButtons(user) {
  const adventureBtn = document.getElementById('adventureBtn');
  if (adventureBtn && user?.gameState) {
    const staminaCost = Number(user.itemStats?.adventureStaminaMultiplier || 1);
    const currentStamina = Number(user.gameState.stamina || 0);
    const hasPendingChoice = Boolean(user.pendingAdventure?.eventId);
    const canUseAdventure = currentStamina >= staminaCost && !hasPendingChoice;
    adventureBtn.disabled = !canUseAdventure;
    adventureBtn.textContent = `모험하기 (행동력 ${formatNumber(staminaCost, staminaCost % 1 === 0 ? 0 : 1)})`;
  }

  refreshSideJobStatus(user);
}

function updateInventoryUI(user) {
  const inventoryList = document.getElementById('inventory-list');
  const titleList = document.getElementById('title-list');
  const emblemList = document.getElementById('emblem-list');
  const cardList = document.getElementById('card-list');
  if (!inventoryList || !titleList || !emblemList || !cardList) return;

  inventoryList.innerHTML = '';
  const inventoryMap = new Map();
  (user.inventory || []).forEach((item) => {
    if (!item?.itemId) return;
    const current = inventoryMap.get(item.itemId) || { ...item, quantity: 0 };
    current.quantity += Math.max(0, Number(item.quantity) || 0);
    inventoryMap.set(item.itemId, current);
  });
  const inventory = Array.from(inventoryMap.values());
  if (!inventory.length) {
    inventoryList.innerHTML = '<tr><td colspan="4">가방이 비어 있습니다.</td></tr>';
  } else {
    inventory.forEach((item) => {
      const itemInfo = ITEM_DATA[item.itemId] || {};
      const desc = itemInfo.hoverDesc || itemInfo.desc || '';
      const shortDesc = itemInfo.desc || '';
      const qtyInputId = `use-qty-${item.itemId}`;
      const ownedQuantity = getInventoryQuantityFromUser(user, item.itemId);
      const canUse = ['bacchus', 'hot6', 'tylenol', 'raid_entry_ticket', 'infinite_overtime_ticket', 'hagendaz', 'excavation_repair_coupon'].includes(item.itemId);
      const maxUseQuantity = getMaxUsableItemQuantity(user, item.itemId, ownedQuantity);
      const actionButton = canUse
        ? `<div class="qty-action-wrap"><input id="${qtyInputId}" class="qty-input" type="number" min="1" max="${Math.max(1, maxUseQuantity)}" step="1" value="${getRememberedQuantityInputValue(qtyInputId, 1, Math.max(1, maxUseQuantity))}" oninput="rememberQuantityInputValue('${qtyInputId}', this.value)" ${maxUseQuantity <= 0 ? 'disabled' : ''}><button class="mini-btn" onclick="handleUseItem('${item.itemId}', '${qtyInputId}')" ${maxUseQuantity <= 0 ? 'disabled' : ''}>사용</button></div>`
        : '<span class="muted-text">상시 적용</span>';

      inventoryList.insertAdjacentHTML(
        'beforeend',
        `
          <tr>
            <td title="${escapeHtml(desc)}">${escapeHtml(itemInfo.name || item.itemId)}</td>
            <td>${formatNumber(ownedQuantity)}</td>
            <td title="${escapeHtml(desc)}">${escapeHtml(shortDesc)}</td>
            <td>${actionButton}</td>
          </tr>
        `
      );
    });
  }

  titleList.innerHTML = '';
  const titleDetails = user.titleDetails || [];
  if (!titleDetails.length) {
    titleList.innerHTML = '<tr><td colspan="3">아직 해금된 칭호가 없습니다.</td></tr>';
  } else {
    titleDetails.forEach((title) => {
      titleList.insertAdjacentHTML(
        'beforeend',
        `
          <tr class="${title.equipped ? 'equipped-title-row' : ''}">
            <td title="${escapeHtml(title.unlockDesc || '')}">${escapeHtml(title.name)}</td>
            <td title="${escapeHtml(title.unlockDesc || '')}">${escapeHtml(title.desc)}</td>
            <td><button class="mini-btn" onclick="handleToggleTitle('${title.id}')">${title.equipped ? '해제' : '장착'}</button></td>
          </tr>
        `
      );
    });
  }

  emblemList.innerHTML = '';
  const emblemDetails = user.emblemDetails || [];
  if (!emblemDetails.length) {
    emblemList.innerHTML = '<tr><td colspan="4">아직 보유한 휘장이 없습니다.</td></tr>';
  } else {
    emblemDetails.forEach((emblem) => {
      emblemList.insertAdjacentHTML(
        'beforeend',
        `
          <tr class="${emblem.equipped ? 'equipped-title-row' : ''}">
            <td>
              <div class="ranking-name-cell emblem-preview-cell ${escapeHtml(emblem.className || '')}">
                <span class="online-dot online"></span>
                <span class="ranking-display-name">닉네임</span>
                ${emblem.imageUrl ? `<img src="${escapeAttr(emblem.imageUrl)}" alt="" class="ranking-emblem-icon">` : ''}
              </div>
            </td>
            <td>${escapeHtml(emblem.name)}</td>
            <td>${escapeHtml(emblem.desc || '')}</td>
            <td><button class="mini-btn" onclick="handleToggleEmblem('${emblem.id}')">${emblem.equipped ? '해제' : '장착'}</button></td>
          </tr>
        `
      );
    });
  }

  cardList.innerHTML = '';
  updateCardFilterControls();
  const cardDetails = getFilteredSortedCardDetails(user);
  if (!cardDetails.length) {
    cardList.innerHTML = '<tr><td colspan="5">조건에 맞는 보유 카드가 없습니다.</td></tr>';
  } else {
    cardDetails.forEach((card) => {
      const actionText = card.equipped ? '해제' : '장착';
      cardList.insertAdjacentHTML(
        'beforeend',
        `
          <tr>
            <td><span class="card-name-chip ${getCardVisualClass(card)}" style="border-color:${escapeHtml(card.borderColor || 'transparent')}; ${escapeAttr(getCardVisualStyle(card))}">${escapeHtml(card.name)}</span></td>
            <td><span class="grade-badge" style="background:${escapeHtml(card.color || '#666666')}">${escapeHtml(card.grade)}</span></td>
            <td>${formatNumber(card.quantity)}장 보유</td>
            <td>
              <strong>${escapeHtml(card.skillName || '')}</strong>
              <div class="menu-note">${escapeHtml(card.skillDesc || '')}</div>
              <div class="menu-note">지속/적용: ${escapeHtml(card.durationText || '즉시')} / 쿨타임 ${formatNumber(card.cooldown || 0)}턴</div>
            </td>
            <td><button class="mini-btn" onclick="handleToggleCardEquip('${card.cardId}', ${Number(card.enhancementLevel || 0)})">${actionText}</button></td>
          </tr>
        `
      );
    });
  }

  if (isFusionModalOpen()) {
    renderCardFusionModal(user);
  }
  if (isEnhanceModalOpen()) {
    renderCardEnhanceModal(user);
  }

  const equipmentList = document.getElementById('equipment-list');
  const equipmentScrollList = document.getElementById('equipment-scroll-list');
  if (equipmentList && equipmentScrollList) {
    const equipments = user.equipmentDetails || [];
    const sortedEquipments = getSortedEquipmentDetails(equipments);
    const totalEquipmentPages = Math.max(1, Math.ceil(sortedEquipments.length / EQUIPMENT_PAGE_SIZE));
    equipmentListPage = Math.min(totalEquipmentPages, Math.max(1, equipmentListPage));
    const pageStart = (equipmentListPage - 1) * EQUIPMENT_PAGE_SIZE;
    const pagedEquipments = sortedEquipments.slice(pageStart, pageStart + EQUIPMENT_PAGE_SIZE);
    equipmentList.innerHTML = pagedEquipments.length ? '' : '<tr><td colspan="4">보유한 장비가 없습니다.</td></tr>';
    pagedEquipments.forEach((equipment) => {
      equipmentList.insertAdjacentHTML('beforeend', `
        <tr>
          <td>${escapeHtml(equipment.name)}</td>
          <td>${escapeHtml(equipment.desc || '')}</td>
          <td><button class="mini-btn" onclick="handleToggleEquipmentEquip('${equipment.equipmentId}')">${equipment.equipped ? '해제' : '장착'}</button></td>
          <td><button class="mini-btn" onclick="handleOpenEquipmentEnhanceFor('${equipment.equipmentId}')">강화</button></td>
        </tr>
      `);
    });
    renderEquipmentPager(sortedEquipments.length, equipmentListPage, totalEquipmentPages);

    const scrollIds = new Set(getEquipmentScrollItemIds());
    const scrollMap = new Map();
    (user.inventory || []).forEach((entry) => {
      if (!scrollIds.has(entry.itemId)) return;
      scrollMap.set(entry.itemId, (scrollMap.get(entry.itemId) || 0) + Math.max(0, Number(entry.quantity) || 0));
    });
    const scrollEntries = Array.from(scrollMap.entries()).filter(([, quantity]) => quantity > 0);
    equipmentScrollList.innerHTML = scrollEntries.length ? '' : '<tr><td colspan="3">보유한 주문서가 없습니다.</td></tr>';
    scrollEntries.forEach(([itemId, quantity]) => {
      const itemInfo = ITEM_DATA[itemId] || {};
      equipmentScrollList.insertAdjacentHTML('beforeend', `
        <tr>
          <td>${escapeHtml(itemInfo.name || itemId)}</td>
          <td>${formatNumber(quantity)}</td>
          <td>${escapeHtml(itemInfo.desc || '')}</td>
        </tr>
      `);
    });
  }
  if (isEquipmentEnhanceModalOpen()) {
    renderEquipmentEnhanceModal(user);
  }
  if (isEquipmentDismantleModalOpen()) {
    renderEquipmentDismantleModal(user);
  }
}

function updateShopUI(user) {
  const shopList = document.getElementById('shop-list');
  if (!shopList) return;

  shopList.innerHTML = '';
  const dailyPurchaseLimits = { business_card: 5, bacchus: 20, hot6: 5 };
  const shopOrder = ['pen_monami', 'pen_jetstream', 'pen_applepencil', 'coffee_mix', 'bacchus', 'hot6', 'tylenol', 'business_card'];
  shopOrder.forEach((itemId) => {
    const itemInfo = ITEM_DATA[itemId];
    if (!itemInfo || itemInfo.shopHidden) return;

    const price = user.shopPrices?.[itemId] ?? itemInfo.price ?? 0;
    const qtyInputId = `buy-qty-${itemId}`;
    const ownedQuantity = getInventoryQuantityFromUser(user, itemId);
    const dailyPurchasedCount = itemId === 'business_card'
      ? Number(user.shopState?.dailyBusinessCardPurchases || 0)
      : itemId === 'bacchus'
        ? Number(user.shopState?.dailyBacchusPurchases || 0)
        : itemId === 'hot6'
          ? Number(user.shopState?.dailyHot6Purchases || 0)
          : 0;
    const dailyPurchaseLimit = dailyPurchaseLimits[itemId] || null;
    const remainingDailyBuys = dailyPurchaseLimit === null
      ? null
      : Math.max(0, dailyPurchaseLimit - dailyPurchasedCount);
    const coffeeLocked = itemId === 'coffee_mix' && Number(user.itemStats?.stressReduction || 0) >= 100;
    const disabledAttr = (dailyPurchaseLimit !== null && remainingDailyBuys <= 0) || coffeeLocked ? 'disabled' : '';
    const maxAttr = dailyPurchaseLimit !== null && remainingDailyBuys > 0 ? `max="${remainingDailyBuys}"` : '';
    const descParts = [itemInfo.desc || ''];
    if (dailyPurchaseLimit !== null) descParts.push(`오늘 남은 구매 가능: ${remainingDailyBuys}/${dailyPurchaseLimit}`);
    if (coffeeLocked) descParts.push('스트레스 감소율이 이미 100%라 구매할 수 없습니다.');
    descParts.push(`현재 보유 ${formatNumber(ownedQuantity)}개`);

    shopList.insertAdjacentHTML(
      'beforeend',
      `
        <tr>
          <td>${escapeHtml(itemInfo.name)}</td>
          <td>${formatNumber(price)}원</td>
          <td>${escapeHtml(descParts.filter(Boolean).join(' / '))}</td>
          <td><div class="qty-action-wrap"><input id="${qtyInputId}" class="qty-input" type="number" min="1" step="1" value="${getRememberedQuantityInputValue(qtyInputId, 1, Number.isFinite(remainingDailyBuys) ? remainingDailyBuys : null)}" oninput="rememberQuantityInputValue('${qtyInputId}', this.value)" ${maxAttr} ${disabledAttr}><button class="mini-btn" ${disabledAttr} onclick="handleBuyClick('${itemId}', '${qtyInputId}')">구매</button></div></td>
        </tr>
      `
    );
  });
}

function updateRaidLobbyUI(raidState, user) {
  updateRaidBossPortraitToggleButtons();
  document.querySelectorAll('[data-raid-mode]').forEach((button) => {
    button.classList.toggle('active', button.dataset.raidMode === selectedRaidMode);
  });
  const slotGrid = document.getElementById('raidSlotGrid');
  const rewardList = document.getElementById('raidRewardList');
  const skillList = document.getElementById('raidBossSkillList');
  const bossName = document.getElementById('raidBossName');
  const bossDesc = document.getElementById('raidBossDesc');
  const bossPortrait = document.getElementById('raidLobbyBossPortrait');
  const startBtn = document.getElementById('raidStartBtn');
  const queueExpireHint = document.getElementById('raidQueueExpireHint');
  if (!slotGrid || !rewardList || !skillList || !bossName || !bossDesc || !startBtn) return;

  const lobby = raidState?.lobby;
  const selectedBattle = raidState?.activeBattle || raidState?.activeBattles?.[selectedRaidMode];
  const selectedModeStatus = (raidState?.modes || []).find((entry) => entry.mode === selectedRaidMode);
  const maxLevelText = lobby?.maxLevel ? ` / 최대 레벨 ${formatNumber(lobby.maxLevel)}` : '';
  bossName.textContent = lobby ? `${lobby.modeLabel || ''} 오늘의 보스 정보: ${lobby.bossName}` : '오늘의 보스 정보';
  bossDesc.textContent = lobby ? `${lobby.bossName} / 보스 HP ${formatNumber(lobby.maxHp || 60000)} / 최소 레벨 ${formatNumber(lobby.minLevel)}${maxLevelText}` : '';
  renderRaidBossPortrait(bossPortrait, lobby?.bossPortrait, lobby?.bossName, {
    imageClass: 'raid-lobby-boss-img',
    fallbackClass: 'raid-lobby-boss-fallback'
  });

  rewardList.innerHTML = '';
  (lobby?.rewardsText || []).forEach((rewardText) => {
    rewardList.insertAdjacentHTML('beforeend', `<li>${escapeHtml(rewardText)}</li>`);
  });

  skillList.innerHTML = '';
  (lobby?.skillsText || []).forEach((skillText) => {
    skillList.insertAdjacentHTML('beforeend', `<li>${escapeHtml(skillText)}</li>`);
  });

  if (queueExpireHint) {
    const queuedSlotIndex = Number(selectedModeStatus?.queuedSlotIndex ?? raidState?.queuedSlotIndex ?? -1);
    const expiresAtMs = selectedModeStatus?.queueExpiresAt ? new Date(selectedModeStatus.queueExpiresAt).getTime() : 0;
    const fallbackRemainingMs = Number(selectedModeStatus?.queueRemainingMs ?? raidState?.queueRemainingMs ?? 0);
    const remainingMs = Number.isFinite(expiresAtMs) && expiresAtMs > 0
      ? Math.max(0, expiresAtMs - Date.now())
      : fallbackRemainingMs;
    if (!selectedBattle && queuedSlotIndex >= 0 && remainingMs > 0) {
      queueExpireHint.textContent = `대기열 자동 퇴장까지 ${formatDurationMs(remainingMs)} 남았습니다.`;
    } else {
      queueExpireHint.textContent = '대기열에 입장하면 10분 후 자동으로 슬롯에서 퇴장됩니다.';
    }
  }

  slotGrid.innerHTML = '';
  const slots = selectedBattle
    ? [
        ...(selectedBattle.participants || []).map((participant) => ({
          ...participant,
          displayName: participant.displayName,
          equippedCardName: participant.equippedCardName,
          equippedCardSkillName: participant.skillName,
          equippedCardSkillDesc: participant.skillDesc,
          equippedCardSpecialStyle: participant.equippedCardSpecialStyle,
          equippedCardBorderColor: participant.equippedCardBorderColor,
          equippedCardPotatoRehabKillCount: participant.equippedCardPotatoRehabKillCount,
          equippedCardPotatoRehabAuraStrength: participant.equippedCardPotatoRehabAuraStrength,
          equippedCardCooldown: participant.skillCooldown
        })),
        ...Array(5).fill(null)
      ].slice(0, 5)
    : (raidState?.slots || Array(5).fill(null));
  slots.forEach((slot, index) => {
    const isSelf = slot?.userId && user && String(slot.userId) === String(user._id);
    const slotCardVisual = slot ? {
      specialStyle: slot.equippedCardSpecialStyle,
      potatoRehabAuraStrength: slot.equippedCardPotatoRehabAuraStrength
    } : {};
    const cardTooltip = slot
      ? [
          slot.equippedCardName || '장착 카드 없음',
          slot.equippedCardSkillName ? `스킬: ${slot.equippedCardSkillName}` : '',
          slot.equippedCardSkillDesc || '',
          slot.equippedCardName ? (slot.equippedCardPassiveOnly ? '패시브 카드' : `쿨타임 ${formatNumber(slot.equippedCardCooldown || 0)}턴`) : ''
        ].filter(Boolean).join('\n')
      : '';
    slotGrid.insertAdjacentHTML(
      'beforeend',
      `
        <button class="raid-slot ${slot ? '' : 'empty'} ${isSelf ? 'self' : ''} ${getCardVisualClass(slotCardVisual)} ${slot?.equippedCardSpecialStyle === 'champion' ? 'raid-champion-profile' : ''}" style="${escapeAttr(getCardVisualStyle(slotCardVisual))}" onclick="handleRaidSlotClick(${index})">
          ${slot
            ? `<div class="raid-slot-name"><span class="raid-name-chip" style="border-color:${escapeHtml(slot.equippedCardBorderColor || 'transparent')}" title="${escapeAttr(slot.displayName || '')}">${escapeHtml(getCompactDisplayName(slot.displayName || '', 12))}</span></div>
               <div>Lv.${formatNumber(slot.level)}</div>
               <div class="raid-slot-card ${getCardVisualClass(slotCardVisual)}" style="${escapeAttr(getCardVisualStyle(slotCardVisual))}" title="${escapeHtml(cardTooltip)}">${escapeHtml(slot.equippedCardName || '장착 카드 없음')}</div>`
            : `<div class="raid-slot-name">${index + 1}번 슬롯</div><div>클릭해 참가 대기</div>`}
        </button>
      `
    );
  });

  startBtn.textContent = selectedBattle ? '관전하기' : '입장';
  startBtn.disabled = selectedBattle ? false : !raidState?.canStart;
}
