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
  ['somfist-c', '폭신한 주먹'], ['shanghai-c', '푸른 검객'], ['meongpeu-c', '졸린 신입 인턴'], ['sseubi-c', '먹빛 기록가'],
  ['gyullak-c', '귤빛 강아지'], ['guma-c', '여우 신사의 수습'], ['wollu-c', '느긋한 직장인'], ['easy-c', '헤드폰 소년'],
  ['eungga-c', '작은 왕'], ['peach-c', '복숭아 요정'], ['jandi-c', '꽃피는 사슴'], ['chuming-c', '별빛 연습생'],
  ['choonsik-c', '배낭 여행가'], ['coca-c', '붉은 물새'], ['pie-c', '작은 제빵 마녀'], ['hoi-c', '별을 줍는 토끼'],
  ['winter-u', '첫눈의 온기'], ['kkamdung-u', '골목의 달지기'], ['nanche-u', '맞물린 해답'], ['rayeon-u', '초승달의 서가'],
  ['mango-u', '과수원의 수호자'], ['morae-u', '푸른 스카프의 길'], ['mond-u', '새벽 탐사대'], ['somfist-u', '폭신한 정면돌파'],
  ['shanghai-u', '방파제의 맹세'], ['sseubi-u', '먹구름 한 획'], ['gyullak-u', '상큼한 배달부'], ['guma-u', '붉은 부적의 밤'],
  ['easy-u', '옥상의 리듬'], ['peach-u', '봄바람의 우편'], ['choonsik-u', '소풍의 대장'], ['hoi-u', '별길 안내인'],
  ['winter-r', '빙정의 무도회'], ['kkamdung-r', '월광 잠입자'], ['rayeon-r', '달의 항해사'], ['mango-r', '태양잎 비행'],
  ['morae-r', '사막별 추적자'], ['mond-r', '미지의 유적'], ['shanghai-r', '해류의 검무'], ['guma-r', '백호의 결계'],
  ['chuming-r', '유성 데뷔 무대'], ['coca-r', '붉은 항로'], ['pie-r', '달콤한 연금술'], ['hoi-r', '혜성 배달부'],
  ['winter-rr', '서리왕관의 서약'], ['rayeon-rr', '만월의 예언'], ['mango-rr', '황금 수확제'], ['somfist-rr', '빙하를 여는 주먹'],
  ['shanghai-rr', '폭풍해의 결투'], ['jandi-rr', '사계의 정원'], ['chuming-rr', '은하수 앙코르'], ['hoi-rr', '밤하늘 수선공'],
  ['winter-rrr', '백야의 심장'], ['guma-rrr', '천년 여우불'], ['mond-rrr', '세계수의 발견'], ['pie-rrr', '별가루 만찬'],
  ['kkamdung-rrr', '월식의 경계'], ['hoi-rrr', '천체의 문지기'],
  ['winter-sr', '얼어붙은 시간'], ['rayeon-sr', '달의 군주'], ['shanghai-sr', '심해의 왕검'], ['hoi-sr', '태양별의 계승자'],
  ['guma-hr', '구미의 신탁'], ['chuming-hr', '초신성 피날레'], ['mango-hr', '황금 세계수룡'],
  ['winter-ur', '영원의 백색 여왕'], ['hoi-ur', '별의 탄생'], ['hoi-ssr', '첫빛의 창세'],
]);

const STAT_KEYS = Object.freeze(['work', 'sense', 'grit', 'luck']);

function statsFor(total, profile) {
  let assigned = 0;
  const stats = {};
  STAT_KEYS.forEach((key, index) => {
    const value = index === STAT_KEYS.length - 1
      ? total - assigned
      : Math.max(1, Math.floor(total * profile[index] / 100));
    stats[key] = value;
    assigned += value;
  });
  return Object.freeze(stats);
}

function createCard([id, epithet], cardIndex) {
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
    image: `./assets/cards/${id}.webp`,
    combatPower,
    stats: statsFor(Math.round(combatPower / 100), character.profile),
    trait: character.trait,
    traitText: `${rarityInfo.label} 등급의 ${character.specialty} 중심 전력으로 자동 모험을 지원합니다.`,
    flavor: `${epithet}. ${character.flavor}`,
  });
}

export const CARD_CATALOG = Object.freeze(CARD_VARIANTS.map(createCard));

export const LEGACY_CARDS = Object.freeze([
  { id: 'rookie-analyst', name: '눈치 빠른 신입사원', rarity: 'common', department: '경영지원', category: '사원', image: './assets/cards/rookie-analyst.webp', stats: { work: 11, sense: 18, grit: 10, luck: 8 }, trait: '상사의 발소리', traitText: '돌발 업무에서 눈치 판정이 조금 유리해집니다.', flavor: 'Alt+Tab보다 빠른 손놀림으로 오늘도 살아남는다.' },
  { id: 'sales-fox', name: '영업 여우', rarity: 'common', department: '영업본부', category: '몬스터', image: './assets/cards/sales-fox.webp', stats: { work: 13, sense: 17, grit: 8, luck: 9 }, trait: '계약의 냄새', traitText: '영업 모험의 동전 보상이 조금 증가합니다.', flavor: '계약서는 이미 준비했다. 이제 사인만 남았다.' },
  { id: 'pantry-cat', name: '탕비실 고양이', rarity: 'rare', department: '공용시설', category: '지원', image: './assets/cards/pantry-cat.webp', stats: { work: 7, sense: 24, grit: 16, luck: 23 }, trait: '간식 감별사', traitText: '모험 중 소모품 발견 확률이 증가합니다.', flavor: '부장님의 고급 참치는 결재 없이 집행한다.' },
  { id: 'peach-sentry', name: '피치전자 게이트 센트리', rarity: 'rare', department: '피치전자', category: '기계', image: './assets/cards/peach-sentry.webp', stats: { work: 22, sense: 12, grit: 25, luck: 8 }, trait: '출입 기록', traitText: '보안 지역 모험의 성공률이 증가합니다.', flavor: '사원증을 대십시오. 커피는 별도 승인 대상입니다.' },
  { id: 'hwang-manager', name: '야근하다 미쳐버린 황과장', rarity: 'epic', department: '경영전략', category: '필드보스', image: './assets/cards/hwang-manager.webp', stats: { work: 34, sense: 18, grit: 31, luck: 11 }, trait: '퇴근 반려', traitText: '장시간 모험의 업무력 보정이 증가합니다.', flavor: '오늘 안에 끝내자는 말은 내일도 출근하자는 뜻이다.' },
  { id: 'gammam-neo', name: '감맘 네오', rarity: 'epic', department: '히든스트리트', category: '필드보스', image: './assets/cards/gammam-neo.webp', stats: { work: 28, sense: 27, grit: 34, luck: 16 }, trait: '감자의 복수', traitText: '보스 모험에서 멘탈 손실을 줄입니다.', flavor: '부러진 다리만큼 복수심도 단단해졌다.' },
  { id: 'kim-manager', name: '대머리 김부장', rarity: 'legendary', department: '본부장실', category: '레이드보스', image: './assets/cards/kim-manager.webp', stats: { work: 42, sense: 33, grit: 46, luck: 17 }, trait: '가발 낙하주의', traitText: '협동 레이드 기여 피해가 크게 증가합니다.', flavor: '빛나는 것은 이마인가, 결재권인가.' },
  { id: 'deadline-dragon', name: '마감기한 드래곤', rarity: 'legendary', department: '프로덕션', category: '재해', image: './assets/cards/deadline-dragon.webp', stats: { work: 48, sense: 29, grit: 40, luck: 22 }, trait: 'D-DAY', traitText: '마감 직전 모험에서 모든 능력치가 증가합니다.', flavor: '일정표의 마지막 칸에서 깨어난 재앙.' },
].map((card) => Object.freeze({ ...card, stats: Object.freeze(card.stats), legacy: true })));

export const ALL_CARDS = Object.freeze([...CARD_CATALOG, ...LEGACY_CARDS]);

export const PACK_DEFINITION = Object.freeze({
  standard: Object.freeze({
    id: 'standard',
    name: '사내 인물 파일 Vol. 2',
    description: '호이상사의 9개 등급 인물 카드 5장이 들어 있습니다.',
    cardCount: 5,
    coinPrice: 1200,
    weights: Object.freeze({ c: 55, u: 25, r: 12, rr: 5, rrr: 2, sr: 0.7, hr: 0.22, ur: 0.07, ssr: 0.01 }),
    rarityOrder: RARITY_ORDER,
    guaranteedRarity: 'u',
    pityPacks: 50,
    pityRarity: 'sr',
  }),
});

export const EXPEDITIONS = Object.freeze([
  { id: 'pantry-sweep', name: '탕비실 비품 회수', location: '호이상사 7층', durationMs: 60 * 1000, recommendedScore: 105, requiredCards: 1, description: '회의 전에 사라진 간식 상자를 조용히 회수합니다.', reward: { coins: [420, 620], packChance: 0.08 } },
  { id: 'security-audit', name: '피치전자 야간 출입', location: '피치전자 보안동', durationMs: 5 * 60 * 1000, recommendedScore: 190, requiredCards: 2, description: '게이트 센트리의 교대 시간에 자료를 확보합니다.', reward: { coins: [1200, 1700], packChance: 0.22 } },
  { id: 'deadline-rescue', name: '마감 직전 구조 작전', location: '프로덕션 대회의실', durationMs: 20 * 60 * 1000, recommendedScore: 290, requiredCards: 3, description: '불타는 일정표 속에서 최종 파일을 찾아냅니다.', reward: { coins: [3600, 5200], packChance: 0.55 } },
]);

export const RAID_DEFINITION = Object.freeze({
  id: 'deadline-dragon-raid', name: '마감기한 드래곤', subtitle: '비동기 협동 시범 레이드',
  maxHp: 2800000, durationMs: 24 * 60 * 60 * 1000, dispatchCooldownMs: 20 * 1000,
});

export const cardById = (id) => ALL_CARDS.find((card) => card.id === id) || null;
export const expeditionById = (id) => EXPEDITIONS.find((mission) => mission.id === id) || null;
