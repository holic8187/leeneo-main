export const RARITY_ORDER = Object.freeze(['c', 'u', 'r', 'rr', 'rrr', 'sr', 'hr', 'ur', 'ssr']);

const rarity = (label, fullLabel, name, rank, color, minPower, maxPower) => Object.freeze({
  label, fullLabel, name, rank, color, minPower, maxPower,
  powerRange: Object.freeze([minPower, maxPower]),
});

export const RARITY_META = Object.freeze({
  c: rarity('C', 'Common', '커먼', 0, '#7d8985', 1800, 2999),
  u: rarity('U', 'Uncommon', '언커먼', 1, '#3c9c91', 3200, 4499),
  r: rarity('R', 'Rare', '레어', 2, '#3676b7', 4800, 6299),
  rr: rarity('RR', 'Double Rare', '더블 레어', 3, '#7455b8', 6600, 7999),
  rrr: rarity('RRR', 'Triple Rare', '트리플 레어', 4, '#ad4b91', 8200, 9299),
  sr: rarity('SR', 'Super Rare', '슈퍼 레어', 5, '#c96c32', 9500, 10999),
  hr: rarity('HR', 'Hyper Rare', '하이퍼 레어', 6, '#c99a23', 11500, 12999),
  ur: rarity('UR', 'Ultra Rare', '울트라 레어', 7, '#bf3f45', 13600, 15499),
  ssr: rarity('SSR', 'Shiny Super Rare', '샤이니 슈퍼 레어', 8, '#5f4bba', 16500, 18000),
});

const CHARACTERS = Object.freeze({
  simsim: { name: '심심이', department: '휴게실', category: '유령', profile: [18, 34, 25, 23], trait: '무료함의 직감', specialty: '눈치', flavor: '한가해 보여도 사무실의 작은 변화를 가장 먼저 알아챈다.' },
  winter: { name: '겨울', department: '설원기획실', category: '눈 정령', profile: [25, 27, 31, 17], trait: '첫눈의 결재', specialty: '멘탈', flavor: '차가운 바람 속에서도 동료가 쉴 자리를 먼저 만든다.' },
  kkamdung: { name: '깜둥', department: '야간순찰팀', category: '고양이', profile: [18, 31, 21, 30], trait: '월광 잠입', specialty: '눈치와 행운', flavor: '달빛이 닿는 곳이라면 어떤 잠긴 문도 조용히 지난다.' },
  nanche: { name: '난체', department: '문제해결실', category: '퍼즐 정령', profile: [29, 32, 22, 17], trait: '맞물린 해답', specialty: '업무와 눈치', flavor: '흩어진 조각을 모으면 복잡한 문제도 하나의 길이 된다.' },
  rayeon: { name: '라연이', department: '천문전략실', category: '달 마도사', profile: [24, 31, 20, 25], trait: '달의 예지', specialty: '눈치', flavor: '달의 움직임에서 아직 오지 않은 보고서의 답을 읽는다.' },
  mango: { name: '망고', department: '과수개발팀', category: '잎새 드래곤', profile: [25, 19, 30, 26], trait: '황금 수확', specialty: '멘탈과 행운', flavor: '황금빛 열매가 익을 때마다 작은 날개에도 힘이 차오른다.' },
  morae: { name: '모래', department: '현장탐사팀', category: '사막여우', profile: [19, 31, 31, 19], trait: '푸른 길잡이', specialty: '눈치와 멘탈', flavor: '큰 귀와 푸른 스카프로 모래바람 속 안전한 길을 찾는다.' },
  mond: { name: '몬드', department: '탐험사업부', category: '탐험가', profile: [28, 29, 25, 18], trait: '미지의 지도', specialty: '업무와 눈치', flavor: '손으로 그린 지도와 작은 새 한 마리면 어디든 출발할 수 있다.' },
  somfist: { name: '솜주먹', department: '복지체육실', category: '곰', profile: [31, 17, 36, 16], trait: '폭신한 정면돌파', specialty: '멘탈', flavor: '부드러운 털 안에 포기하지 않는 단단한 주먹을 숨기고 있다.' },
  shanghai: { name: '상해', department: '해양경비팀', category: '상어 검객', profile: [34, 22, 31, 13], trait: '해류 검법', specialty: '업무와 멘탈', flavor: '거친 파도일수록 검끝은 더 차분하고 정확해진다.' },
  meongpeu: { name: '멍프', department: '인턴지원실', category: '강아지 인턴', profile: [20, 32, 24, 24], trait: '졸음 속 메모', specialty: '눈치', flavor: '졸린 눈으로도 작은 수첩에는 빠뜨리는 것 없이 적어 둔다.' },
  sseubi: { name: '쓰비', department: '기록보존실', category: '고슴도치', profile: [28, 30, 24, 18], trait: '먹빛 기록', specialty: '업무와 눈치', flavor: '커다란 붓 한 획으로 오늘의 소동을 오래 남을 기록으로 바꾼다.' },
  gyullak: { name: '귤락', department: '물류배송팀', category: '귤 강아지', profile: [24, 21, 25, 30], trait: '상큼 배송', specialty: '행운', flavor: '싱그러운 잎사귀 갈기를 흔들며 가장 빠른 과수원 길을 달린다.' },
  guma: { name: '구마', department: '신사보안팀', category: '여우 마도사', profile: [30, 28, 25, 17], trait: '여우불 결계', specialty: '업무와 눈치', flavor: '붉은 부적과 흰 여우의 불빛으로 위험한 길목을 봉인한다.' },
  wollu: { name: '월루', department: '경영지원실', category: '나무늘보 사원', profile: [19, 31, 22, 28], trait: '느긋한 완급조절', specialty: '눈치와 행운', flavor: '느려 보여도 마감 직전에는 필요한 서류가 정확히 놓여 있다.' },
  easy: { name: '이지', department: '사내방송팀', category: '토끼귀 사원', profile: [22, 29, 20, 29], trait: '옥상의 리듬', specialty: '눈치와 행운', flavor: '헤드폰의 박자에 맞추면 복잡한 하루도 가볍게 풀린다.' },
  eungga: { name: '응가', department: '왕실총무팀', category: '갈색 정령', profile: [19, 22, 31, 28], trait: '작은 왕의 명령', specialty: '멘탈과 행운', flavor: '작은 왕관 하나로 평범한 방석도 당당한 왕좌가 된다.' },
  peach: { name: '피치', department: '봄바람홍보실', category: '복숭아 요정', profile: [21, 26, 22, 31], trait: '복사꽃 우편', specialty: '행운', flavor: '복사꽃 편지를 바람에 실어 필요한 사람에게 정확히 보낸다.' },
  jandi: { name: '잔디', department: '조경관리팀', category: '꽃사슴', profile: [20, 25, 34, 21], trait: '사계의 정원', specialty: '멘탈', flavor: '꽃으로 덮인 뿔이 지나간 자리에는 계절이 다시 피어난다.' },
  chuming: { name: '츄밍', department: '별빛공연팀', category: '아이돌', profile: [26, 25, 19, 30], trait: '유성 앙코르', specialty: '업무와 행운', flavor: '하얀 여우와 함께라면 작은 연습실도 은하수 무대가 된다.' },
  choonsik: { name: '춘식', department: '사내여행팀', category: '곰', profile: [23, 23, 29, 25], trait: '소풍 대장', specialty: '멘탈과 행운', flavor: '잎사귀 배낭을 메고 누구보다 먼저 햇살 좋은 길로 나선다.' },
  coca: { name: '코카', department: '수상운송팀', category: '물새', profile: [27, 24, 22, 27], trait: '붉은 항로', specialty: '업무와 행운', flavor: '붉은 깃과 둥근 메달이 반짝이면 물 위에 새 항로가 열린다.' },
  pie: { name: '파이', department: '마법제과실', category: '제빵 마녀', profile: [29, 23, 23, 25], trait: '달콤한 연금술', specialty: '업무와 행운', flavor: '코기 조수와 구운 파이 한 조각이면 긴 야근도 견딜 만해진다.' },
  hoi: { name: '호이', department: '별빛본부', category: '별 토끼', profile: [27, 25, 23, 25], trait: '별빛 창세', specialty: '균형 능력', flavor: '긴 귀에 별빛을 담아 어두운 하늘에 새로운 길을 만든다.' },
});

const CARD_VARIANTS = Object.freeze([
  ['simsim-c', '무심한 유령'], ['winter-c', '눈꽃의 소녀'], ['kkamdung-c', '달빛의 고양이'], ['nanche-c', '퍼즐 친구'],
  ['rayeon-c', '달을 읽는 이'], ['mango-c', '잎새 드래곤'], ['morae-c', '사막의 길잡이'], ['mond-c', '새내기 탐험가'],
  ['somfist-c', '폭신한 주먹'], ['shanghai-c', '푸른 검객'], ['meongpeu-c', '졸린 신입 인턴'], ['sseubi-c', '먹빛 기록가', './assets/cards/sseubi-c.png'],
  ['gyullak-c', '귤빛 강아지'], ['guma-c', '여우 신사의 수습', './assets/cards/guma-c.png'], ['wollu-c', '느긋한 직장인'], ['easy-c', '헤드폰 소년', './assets/cards/easy-c.png'],
  ['eungga-c', '작은 왕'], ['peach-c', '복숭아 요정'], ['jandi-c', '꽃피는 사슴'], ['chuming-c', '별빛 연습생'],
  ['choonsik-c', '배낭 여행가'], ['coca-c', '붉은 물새'], ['pie-c', '작은 제빵 마녀'], ['hoi-c', '별을 줍는 토끼'],
  ['winter-u', '첫눈의 온기'], ['kkamdung-u', '골목의 달지기'], ['nanche-u', '맞물린 해답'], ['rayeon-u', '초승달의 서가'],
  ['mango-u', '과수원의 수호자'], ['morae-u', '푸른 스카프의 길'], ['mond-u', '새벽 탐사대'], ['somfist-u', '폭신한 정면돌파'],
  ['shanghai-u', '방파제의 맹세', './assets/cards/shanghai-u.png'], ['sseubi-u', '먹구름 한 획', './assets/cards/sseubi-u.png'], ['gyullak-u', '상큼한 배달부'], ['guma-u', '붉은 부적의 밤'],
  ['easy-u', '옥상의 리듬', './assets/cards/easy-u.png'], ['peach-u', '봄바람의 우편'], ['choonsik-u', '소풍의 대장'], ['hoi-u', '별길 안내인'],
  ['winter-r', '빙정의 무도회'], ['kkamdung-r', '월광 잠입자'], ['rayeon-r', '달의 항해사'], ['mango-r', '태양잎 비행'],
  ['morae-r', '사막별 추적자'], ['mond-r', '미지의 유적'], ['shanghai-r', '해류의 검무', './assets/cards/shanghai-r.png'], ['guma-r', '백호의 결계'],
  ['chuming-r', '유성 데뷔 무대'], ['coca-r', '붉은 항로'], ['pie-r', '달콤한 연금술'], ['hoi-r', '혜성 배달부'],
  ['winter-rr', '서리왕관의 서약'], ['rayeon-rr', '만월의 예언'], ['mango-rr', '황금 수확제'], ['somfist-rr', '빙하를 여는 주먹'],
  ['shanghai-rr', '폭풍해의 결투', './assets/cards/shanghai-rr.png'], ['jandi-rr', '사계의 정원'], ['chuming-rr', '은하수 앙코르'], ['hoi-rr', '밤하늘 수선공'],
  ['winter-rrr', '백야의 심장'], ['guma-rrr', '천년 여우불'], ['mond-rrr', '세계수의 발견'], ['pie-rrr', '별가루 만찬'],
  ['kkamdung-rrr', '월식의 경계'], ['hoi-rrr', '천체의 문지기'],
  ['winter-sr', '얼어붙은 시간'], ['rayeon-sr', '달의 군주'], ['shanghai-sr', '심해의 왕검'], ['hoi-sr', '태양별의 계승자'],
  ['guma-hr', '구미의 신탁'], ['chuming-hr', '초신성 피날레'], ['mango-hr', '황금 세계수룡'],
  ['winter-ur', '영원의 백색 여왕'], ['hoi-ur', '별의 탄생'], ['hoi-ssr', '첫빛의 창세'],
  // New variants stay after the original 76-card sequence. createCard derives
  // combat power from cardIndex, so inserting them into the rarity groups would
  // silently change every following card's established stats.
  ['coca-u', '갈대연못의 길잡이', './assets/cards/coca-u.png'],
  ['coca-rr', '윙크 웨이브 라이더', './assets/cards/coca-rr.png'],
  ['coca-rrr', '폭우의 물장막', './assets/cards/coca-rrr.png'],
  ['coca-sr', '달연꽃 치유사', './assets/cards/coca-sr.png'],
  ['coca-hr', '협곡폭포 급강하', './assets/cards/coca-hr.png'],
  ['coca-ur', '오로라 수평선의 순례자', './assets/cards/coca-ur.png'],
  ['coca-ssr', '성하 프리즘 항해왕', './assets/cards/coca-ssr.png'],
]);

function createCard([id, epithet, suppliedImage], cardIndex) {
  const separator = id.lastIndexOf('-');
  const characterId = id.slice(0, separator);
  const rarityId = id.slice(separator + 1);
  const character = CHARACTERS[characterId];
  const rarityInfo = RARITY_META[rarityId];
  if (!character || !rarityInfo) throw new Error(`Invalid card blueprint: ${id}`);
  const characterIndex = Object.keys(CHARACTERS).indexOf(characterId);
  const span = rarityInfo.maxPower - rarityInfo.minPower + 1;
  const combatPower = rarityInfo.minPower
    + ((cardIndex * 137 + characterIndex * 211 + rarityInfo.rank * 389) % span);
  return Object.freeze({
    id,
    characterId,
    name: `${epithet} ${character.name}`,
    characterName: character.name,
    epithet,
    rarity: rarityId,
    department: character.department,
    category: character.category,
    image: suppliedImage || `./assets/cards/${id}.webp`,
    combatPower,
    trait: character.trait,
    traitText: `${rarityInfo.label} 등급의 ${character.specialty} 중심 전력으로 자동 모험을 지원합니다.`,
    flavor: `${epithet}. ${character.flavor}`,
  });
}

export const CARD_CATALOG = Object.freeze(CARD_VARIANTS.map(createCard));

export const LEGACY_CARDS = Object.freeze([
  { id: 'rookie-analyst', name: '눈치 빠른 신입사원', rarity: 'common', department: '경영지원', category: '사원', image: './assets/cards/rookie-analyst.webp', combatPower: 4700, trait: '상사의 발소리', traitText: '상사의 움직임을 읽어 전투 흐름을 앞당깁니다.', flavor: 'Alt+Tab보다 빠른 손놀림으로 오늘도 살아남는다.' },
  { id: 'sales-fox', name: '영업 여우', rarity: 'common', department: '영업본부', category: '몬스터', image: './assets/cards/sales-fox.webp', combatPower: 4700, trait: '계약의 냄새', traitText: '계약 표식이 있는 적에게 더 강한 피해를 줍니다.', flavor: '계약서는 이미 준비했다. 이제 사인만 남았다.' },
  { id: 'pantry-cat', name: '탕비실 고양이', rarity: 'rare', department: '공용시설', category: '지원', image: './assets/cards/pantry-cat.webp', combatPower: 7000, trait: '간식 감별사', traitText: '간식으로 아군의 체력과 전투 의지를 회복합니다.', flavor: '부장님의 고급 참치는 결재 없이 집행한다.' },
  { id: 'peach-sentry', name: '피치전자 게이트 센트리', rarity: 'rare', department: '피치전자', category: '기계', image: './assets/cards/peach-sentry.webp', combatPower: 6700, trait: '출입 기록', traitText: '적의 강화와 침입 행동을 차단합니다.', flavor: '사원증을 대십시오. 커피는 별도 승인 대상입니다.' },
  { id: 'hwang-manager', name: '야근하다 미쳐버린 황과장', rarity: 'epic', department: '경영전략', category: '필드보스', image: './assets/cards/hwang-manager.webp', combatPower: 9400, trait: '퇴근 반려', traitText: '전투가 길어질수록 공격력이 증가합니다.', flavor: '오늘 안에 끝내자는 말은 내일도 출근하자는 뜻이다.' },
  { id: 'gammam-neo', name: '감맘 네오', rarity: 'epic', department: '히든스트리트', category: '필드보스', image: './assets/cards/gammam-neo.webp', combatPower: 10500, trait: '감자의 복수', traitText: '받은 피해를 축적해 강하게 반격합니다.', flavor: '부러진 다리만큼 복수심도 단단해졌다.' },
  { id: 'kim-manager', name: '대머리 김부장', rarity: 'legendary', department: '본부장실', category: '레이드보스', image: './assets/cards/kim-manager.webp', combatPower: 13800, trait: '가발 낙하주의', traitText: '강한 결재력으로 적의 방어를 무너뜨립니다.', flavor: '빛나는 것은 이마인가, 결재권인가.' },
  { id: 'deadline-dragon', name: '마감기한 드래곤', rarity: 'legendary', department: '프로덕션', category: '재해', image: './assets/cards/deadline-dragon.webp', combatPower: 13900, trait: 'D-DAY', traitText: '전투가 길어질수록 마감 공격이 강해집니다.', flavor: '일정표의 마지막 칸에서 깨어난 재앙.' },
].map((card) => Object.freeze({ ...card, legacy: true })));

export const ALL_CARDS = Object.freeze([...CARD_CATALOG, ...LEGACY_CARDS]);

export const PACK_DEFINITION = Object.freeze({
  standard: Object.freeze({
    id: 'standard',
    name: '사내 인물 파일 Vol. 2',
    description: '호이 카드 데스크의 9개 등급 인물 카드 5장이 들어 있습니다.',
    cardCount: 5,
    coinPrice: 1200,
    weights: Object.freeze({ c: 55, u: 25, r: 12, rr: 5, rrr: 2, sr: 0.7, hr: 0.22, ur: 0.07, ssr: 0.01 }),
    rarityOrder: RARITY_ORDER,
    guaranteedRarity: 'u',
    pityPacks: 50,
    pityRarity: 'sr',
  }),
});

const MINUTE_MS = 60 * 1000;

const expedition = ({
  id,
  name,
  location,
  durationMinutes,
  minimumPower,
  requiredCards,
  powerBand,
  description,
  coins,
  packChance,
}) => Object.freeze({
  id,
  name,
  location,
  durationMs: durationMinutes * MINUTE_MS,
  minimumPower,
  // Keep the former field as an alias so existing saved clients and UI code
  // can move to minimumPower without breaking during an update.
  recommendedScore: minimumPower,
  requiredCards,
  powerBand,
  description,
  reward: Object.freeze({
    coins: Object.freeze(coins),
    packChance,
    powerBonusRate: 0.22,
    powerBonusCap: 0.35,
  }),
});

export const EXPEDITIONS = Object.freeze([
  expedition({
    id: 'pantry-sweep', name: '탕비실 번개 회수', location: '카드 데스크 7층', durationMinutes: 1,
    minimumPower: 5400, requiredCards: 1, powerBand: 'starter', coins: [70, 110], packChance: 0.002,
    description: '회의 시작 전에 사라진 간식 상자를 빠르게 회수합니다.',
  }),
  expedition({
    id: 'executive-express', name: '임원실 특급 결재', location: '카드 데스크 임원층', durationMinutes: 1,
    minimumPower: 26700, requiredCards: 2, powerBand: 'expert', coins: [200, 280], packChance: 0.006,
    description: '단 1분 동안 결재 동선을 완벽하게 읽고 긴급 문서를 통과시킵니다.',
  }),
  expedition({
    id: 'security-audit', name: '피치전자 야간 출입', location: '피치전자 보안동', durationMinutes: 5,
    minimumPower: 8700, requiredCards: 1, powerBand: 'starter', coins: [280, 400], packChance: 0.01,
    description: '게이트 센트리의 짧은 교대 시간에 자료를 확보합니다.',
  }),
  expedition({
    id: 'firewall-counterattack', name: '심야 방화벽 역습', location: '피치전자 중앙 서버실', durationMinutes: 5,
    minimumPower: 33300, requiredCards: 4, powerBand: 'expert', coins: [760, 1040], packChance: 0.025,
    description: '숙련된 카드 넷으로 침입 신호를 추적하고 서버를 안정화합니다.',
  }),
  expedition({
    id: 'lobby-lost-found', name: '로비 분실물 순찰', location: '카드 데스크 중앙 로비', durationMinutes: 15,
    minimumPower: 11300, requiredCards: 2, powerBand: 'starter', coins: [700, 1000], packChance: 0.025,
    description: '퇴근 인파가 빠진 로비를 돌며 중요한 분실물을 찾아냅니다.',
  }),
  expedition({
    id: 'archive-breach', name: '봉인 문서고 잠입', location: '지하 기록보존실', durationMinutes: 15,
    minimumPower: 40000, requiredCards: 4, powerBand: 'expert', coins: [1900, 2500], packChance: 0.06,
    description: '복잡한 보안 장치 사이에서 봉인된 원본 장부를 회수합니다.',
  }),
  expedition({
    id: 'deadline-rescue', name: '마감 직전 구조 작전', location: '프로덕션 대회의실', durationMinutes: 30,
    minimumPower: 14700, requiredCards: 2, powerBand: 'starter', coins: [1250, 1750], packChance: 0.045,
    description: '불타는 일정표 속에서 최종 파일과 지친 동료를 찾아냅니다.',
  }),
  expedition({
    id: 'moonlight-procurement', name: '월광 비밀 조달', location: '야간 물류 터미널', durationMinutes: 30,
    minimumPower: 45300, requiredCards: 4, powerBand: 'expert', coins: [3500, 4500], packChance: 0.1,
    description: '달빛 아래에서 희귀 자재를 추적해 들키지 않고 반입합니다.',
  }),
  expedition({
    id: 'branch-support', name: '외곽 지점 긴급 지원', location: '제3 영업지점', durationMinutes: 60,
    minimumPower: 18700, requiredCards: 2, powerBand: 'starter', coins: [2300, 3300], packChance: 0.08,
    description: '인력이 부족한 외곽 지점의 밀린 업무를 한 번에 정리합니다.',
  }),
  expedition({
    id: 'executive-briefing', name: '이사회 극비 브리핑', location: '최상층 전략회의실', durationMinutes: 60,
    minimumPower: 49300, requiredCards: 4, powerBand: 'expert', coins: [6300, 8100], packChance: 0.16,
    description: '한 치의 실수도 허용되지 않는 극비 전략 보고를 완수합니다.',
  }),
  expedition({
    id: 'market-survey', name: '신사업 상권 조사', location: '별빛 상업지구', durationMinutes: 120,
    minimumPower: 22700, requiredCards: 4, powerBand: 'starter', coins: [4300, 6100], packChance: 0.13,
    description: '거리 곳곳의 단서를 모아 다음 분기의 유망 사업을 발굴합니다.',
  }),
  expedition({
    id: 'storm-data-center', name: '폭풍권 데이터센터', location: '해안 제2 전산기지', durationMinutes: 120,
    minimumPower: 52000, requiredCards: 4, powerBand: 'expert', coins: [11400, 14600], packChance: 0.25,
    description: '폭풍에 고립된 데이터센터로 진입해 핵심 기록을 보전합니다.',
  }),
  expedition({
    id: 'warehouse-inventory', name: '대형 창고 전수 조사', location: '과수개발 물류창고', durationMinutes: 240,
    minimumPower: 28000, requiredCards: 4, powerBand: 'starter', coins: [8000, 11200], packChance: 0.2,
    description: '쌓여 있는 상자와 오래된 장부를 대조해 재고를 바로잡습니다.',
  }),
  expedition({
    id: 'world-tree-contract', name: '세계수 정상의 계약', location: '미지의 세계수', durationMinutes: 240,
    minimumPower: 54700, requiredCards: 4, powerBand: 'expert', coins: [21000, 27000], packChance: 0.36,
    description: '강한 수호자들을 지나 정상에서 전설의 계약서를 체결합니다.',
  }),
  expedition({
    id: 'overnight-observation', name: '설원 야간 관측', location: '설원기획실 관측소', durationMinutes: 480,
    minimumPower: 33300, requiredCards: 4, powerBand: 'starter', coins: [14400, 20800], packChance: 0.28,
    description: '밤새 설원과 별의 변화를 기록해 다음 계절을 예측합니다.',
  }),
  expedition({
    id: 'aurora-migration', name: '오로라 서버 대이동', location: '극광 클라우드 기지', durationMinutes: 480,
    minimumPower: 57300, requiredCards: 4, powerBand: 'expert', coins: [39000, 49000], packChance: 0.52,
    description: '멈출 수 없는 핵심 서비스를 밤새 새 기지로 이전합니다.',
  }),
  expedition({
    id: 'long-weekend-patrol', name: '연휴 무인 사옥 순찰', location: '카드 데스크 전 사옥', durationMinutes: 720,
    minimumPower: 37300, requiredCards: 4, powerBand: 'starter', coins: [19800, 28200], packChance: 0.35,
    description: '사람이 떠난 사옥을 반나절 동안 지키며 이상 신호를 점검합니다.',
  }),
  expedition({
    id: 'starfall-contingency', name: '별똥별 비상 계획', location: '천문전략실 외우주 관제소', durationMinutes: 720,
    minimumPower: 58000, requiredCards: 4, powerBand: 'expert', coins: [54000, 66000], packChance: 0.65,
    description: '최정예 카드 넷으로 반나절에 걸친 별빛 재난을 막아냅니다.',
  }),
]);

export const RAID_DEFINITION = Object.freeze({
  id: 'deadline-dragon-raid', name: '마감기한 드래곤', subtitle: '주간 단계형 개인 레이드',
  maxHp: 100000, durationMs: 7 * 24 * 60 * 60 * 1000, dispatchCooldownMs: 0,
  maxDailyClears: 5, maxDailyEntries: 5, maxStage: 10, maxRounds: 7,
});

export const cardById = (id) => ALL_CARDS.find((card) => card.id === id) || null;
export const expeditionById = (id) => EXPEDITIONS.find((mission) => mission.id === id) || null;
