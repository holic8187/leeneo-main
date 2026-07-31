'use strict';

const START_MAP_ID = 'main_lobby';

const MAP_LAYOUT_PRESETS = Object.freeze({
  safe: Object.freeze({
    worldWidth: 920,
    worldHeight: 390,
    maxMonsters: 0,
    spawnPerWave: 0,
    platforms: Object.freeze([
      Object.freeze({ id: 'ground', floor: 0, x: 0, width: 100, bottom: 42, spawnEnabled: false, spawnSlots: 0 })
    ]),
    connectors: Object.freeze([])
  }),
  tiny: Object.freeze({
    worldWidth: 820,
    worldHeight: 390,
    maxMonsters: 15,
    spawnPerWave: 8,
    platforms: Object.freeze([
      Object.freeze({ id: 'ground', floor: 0, x: 0, width: 100, bottom: 42, spawnEnabled: true, spawnSlots: 11 }),
      Object.freeze({ id: 'jump-ledge', floor: 1, x: 37, width: 28, bottom: 172, spawnEnabled: true, spawnSlots: 5 })
    ]),
    connectors: Object.freeze([
      Object.freeze({ id: 'jump-01', fromFloor: 0, toFloor: 1, x: 40, type: 'jump' })
    ])
  }),
  compact: Object.freeze({
    worldWidth: 1_080,
    worldHeight: 470,
    maxMonsters: 21,
    spawnPerWave: 9,
    platforms: Object.freeze([
      Object.freeze({ id: 'ground-left', floor: 0, x: 0, width: 46, bottom: 42, spawnEnabled: true, spawnSlots: 8 }),
      Object.freeze({ id: 'ground-right', floor: 0, x: 54, width: 46, bottom: 42, spawnEnabled: true, spawnSlots: 8 }),
      Object.freeze({ id: 'jump-deck', floor: 1, x: 18, width: 26, bottom: 178, spawnEnabled: true, spawnSlots: 5 }),
      Object.freeze({ id: 'quiet-deck', floor: 1, x: 60, width: 25, bottom: 178, spawnEnabled: false, spawnSlots: 0 }),
      Object.freeze({ id: 'ladder-deck', floor: 2, x: 48, width: 27, bottom: 322, spawnEnabled: true, spawnSlots: 5 })
    ]),
    connectors: Object.freeze([
      Object.freeze({ id: 'jump-01', fromFloor: 0, toFloor: 1, x: 22, type: 'jump' }),
      Object.freeze({ id: 'ladder-12', fromFloor: 1, toFloor: 2, x: 63, type: 'ladder' })
    ])
  }),
  wide: Object.freeze({
    worldWidth: 1_560,
    worldHeight: 520,
    maxMonsters: 32,
    spawnPerWave: 11,
    platforms: Object.freeze([
      Object.freeze({ id: 'ground', floor: 0, x: 0, width: 100, bottom: 42, spawnEnabled: true, spawnSlots: 14 }),
      Object.freeze({ id: 'west-deck', floor: 1, x: 8, width: 28, bottom: 184, spawnEnabled: true, spawnSlots: 8 }),
      Object.freeze({ id: 'center-rest', floor: 1, x: 42, width: 16, bottom: 184, spawnEnabled: false, spawnSlots: 0 }),
      Object.freeze({ id: 'east-deck', floor: 1, x: 65, width: 28, bottom: 184, spawnEnabled: true, spawnSlots: 8 }),
      Object.freeze({ id: 'high-deck', floor: 2, x: 34, width: 32, bottom: 342, spawnEnabled: true, spawnSlots: 8 })
    ]),
    connectors: Object.freeze([
      Object.freeze({ id: 'jump-west', fromFloor: 0, toFloor: 1, x: 12, type: 'jump' }),
      Object.freeze({ id: 'ladder-east', fromFloor: 0, toFloor: 1, x: 78, type: 'ladder' }),
      Object.freeze({ id: 'ladder-high', fromFloor: 1, toFloor: 2, x: 50, type: 'ladder' })
    ])
  }),
  tower: Object.freeze({
    worldWidth: 1_240,
    worldHeight: 700,
    maxMonsters: 36,
    spawnPerWave: 11,
    platforms: Object.freeze([
      Object.freeze({ id: 'ground', floor: 0, x: 0, width: 100, bottom: 42, spawnEnabled: true, spawnSlots: 11 }),
      Object.freeze({ id: 'first-left', floor: 1, x: 6, width: 37, bottom: 190, spawnEnabled: true, spawnSlots: 8 }),
      Object.freeze({ id: 'first-right', floor: 1, x: 55, width: 38, bottom: 190, spawnEnabled: true, spawnSlots: 8 }),
      Object.freeze({ id: 'second-left', floor: 2, x: 18, width: 30, bottom: 354, spawnEnabled: false, spawnSlots: 0 }),
      Object.freeze({ id: 'second-right', floor: 2, x: 60, width: 31, bottom: 354, spawnEnabled: true, spawnSlots: 8 }),
      Object.freeze({ id: 'summit', floor: 3, x: 34, width: 34, bottom: 524, spawnEnabled: true, spawnSlots: 8 })
    ]),
    connectors: Object.freeze([
      Object.freeze({ id: 'ladder-01', fromFloor: 0, toFloor: 1, x: 72, type: 'ladder' }),
      Object.freeze({ id: 'jump-12', fromFloor: 1, toFloor: 2, x: 24, type: 'jump' }),
      Object.freeze({ id: 'ladder-23', fromFloor: 2, toFloor: 3, x: 64, type: 'ladder' })
    ])
  }),
  sprawling: Object.freeze({
    worldWidth: 2_080,
    worldHeight: 650,
    maxMonsters: 47,
    spawnPerWave: 14,
    platforms: Object.freeze([
      Object.freeze({ id: 'ground-west', floor: 0, x: 0, width: 31, bottom: 42, spawnEnabled: true, spawnSlots: 9 }),
      Object.freeze({ id: 'ground-center', floor: 0, x: 35, width: 29, bottom: 42, spawnEnabled: true, spawnSlots: 9 }),
      Object.freeze({ id: 'ground-east', floor: 0, x: 68, width: 32, bottom: 42, spawnEnabled: true, spawnSlots: 9 }),
      Object.freeze({ id: 'lower-west', floor: 1, x: 6, width: 23, bottom: 190, spawnEnabled: true, spawnSlots: 8 }),
      Object.freeze({ id: 'lower-center', floor: 1, x: 38, width: 24, bottom: 190, spawnEnabled: false, spawnSlots: 0 }),
      Object.freeze({ id: 'lower-east', floor: 1, x: 72, width: 22, bottom: 190, spawnEnabled: true, spawnSlots: 8 }),
      Object.freeze({ id: 'upper-west', floor: 2, x: 18, width: 25, bottom: 358, spawnEnabled: true, spawnSlots: 5 }),
      Object.freeze({ id: 'upper-east', floor: 2, x: 58, width: 27, bottom: 358, spawnEnabled: true, spawnSlots: 5 })
    ]),
    connectors: Object.freeze([
      Object.freeze({ id: 'jump-west', fromFloor: 0, toFloor: 1, x: 14, type: 'jump' }),
      Object.freeze({ id: 'ladder-east', fromFloor: 0, toFloor: 1, x: 80, type: 'ladder' }),
      Object.freeze({ id: 'ladder-upper-west', fromFloor: 1, toFloor: 2, x: 25, type: 'ladder' }),
      Object.freeze({ id: 'jump-upper-east', fromFloor: 1, toFloor: 2, x: 67, type: 'jump' })
    ])
  }),
  boss: Object.freeze({
    worldWidth: 1_420,
    worldHeight: 430,
    maxMonsters: 1,
    spawnPerWave: 1,
    platforms: Object.freeze([
      Object.freeze({ id: 'boss-arena', floor: 0, x: 0, width: 100, bottom: 42, spawnEnabled: true, spawnSlots: 1 }),
      Object.freeze({ id: 'spectator-ledge', floor: 1, x: 37, width: 26, bottom: 198, spawnEnabled: false, spawnSlots: 0 })
    ]),
    connectors: Object.freeze([
      Object.freeze({ id: 'arena-jump', fromFloor: 0, toFloor: 1, x: 40, type: 'jump' })
    ])
  }),
  frozen_dispatch: Object.freeze({
    worldWidth: 825,
    worldHeight: 430,
    maxMonsters: 18,
    spawnPerWave: 8,
    platforms: Object.freeze([
      Object.freeze({
        id: 'lower-route',
        floor: 0,
        x: 0,
        width: 100,
        bottom: 42,
        spawnEnabled: true,
        spawnSlots: 9,
        spawnPerWave: 4,
        monsterIds: Object.freeze(['overtime_reaper'])
      }),
      Object.freeze({
        id: 'upper-route',
        floor: 1,
        x: 7,
        width: 86,
        bottom: 214,
        spawnEnabled: true,
        spawnSlots: 9,
        spawnPerWave: 4,
        monsterIds: Object.freeze(['deadline_dragon'])
      })
    ]),
    connectors: Object.freeze([
      Object.freeze({ id: 'dispatch-ladder', fromFloor: 0, toFloor: 1, x: 76, type: 'ladder' })
    ])
  }),
  bus_stop: Object.freeze({
    worldWidth: 980,
    worldHeight: 390,
    maxMonsters: 0,
    spawnPerWave: 0,
    platforms: Object.freeze([
      Object.freeze({ id: 'roadside', floor: 0, x: 0, width: 100, bottom: 42, spawnEnabled: false, spawnSlots: 0 })
    ]),
    connectors: Object.freeze([])
  })
});

const MAP_DEFINITIONS = [
  { id: 'main_lobby', name: '호이상사 중앙로비', region: '본관 초입', minLevel: 1, maxLevel: 8, theme: 'lobby', features: ['elevator'], safeZone: true, shopId: 'headquarters' },
  { id: 'newcomer_training', name: '신입사원 연수원', region: '본관 초입', minLevel: 1, maxLevel: 10, theme: 'training', features: ['ladder'] },
  { id: 'document_corridor', name: '결재서류 복도', region: '본관 초입', minLevel: 5, maxLevel: 15, theme: 'office', features: ['rope'] },
  { id: 'pantry_alley', name: '탕비실 뒷골목', region: '본관 초입', minLevel: 8, maxLevel: 18, theme: 'pantry', features: ['boxes'] },
  { id: 'parking_b1', name: '지하주차장 B1', region: '본관 초입', minLevel: 10, maxLevel: 22, theme: 'parking', features: ['ladder'] },
  { id: 'rooftop_garden', name: '옥상 휴게정원', region: '본관 초입', minLevel: 12, maxLevel: 24, theme: 'rooftop', features: ['rope'] },

  { id: 'hr_reception', name: '인사팀 접견실', region: '인사관리동', minLevel: 15, maxLevel: 28, theme: 'hr', features: ['elevator'], safeZone: true, shopId: 'personnel_annex', scrollShopId: 'scroll_vendor' },
  { id: 'interview_maze', name: '채용면접 미로', region: '인사관리동', minLevel: 18, maxLevel: 32, theme: 'hr', features: ['ladder'] },
  { id: 'talent_center', name: '인재개발원 수련관', region: '인사관리동', minLevel: 22, maxLevel: 36, theme: 'training', features: ['rope', 'ladder'] },
  { id: 'org_archive', name: '조직문화 기록관', region: '인사관리동', minLevel: 26, maxLevel: 40, theme: 'archive', features: ['boxes'] },

  { id: 'accounting_records', name: '회계장부 보관실', region: '재무회계동', minLevel: 28, maxLevel: 44, theme: 'accounting', features: ['ladder'] },
  { id: 'payroll_vault', name: '급여자료 금고', region: '재무회계동', minLevel: 34, maxLevel: 50, theme: 'vault', features: ['rope'] },
  { id: 'finance_analysis', name: '재무분석 상황실', region: '재무회계동', minLevel: 38, maxLevel: 55, theme: 'accounting', features: ['elevator'] },
  { id: 'audit_archive', name: '감사자료 봉인창고', region: '재무회계동', minLevel: 44, maxLevel: 62, theme: 'archive', features: ['ladder', 'boxes'] },

  { id: 'brand_studio', name: '브랜드 스튜디오', region: '영업마케팅동', minLevel: 30, maxLevel: 48, theme: 'studio', features: ['rope'] },
  { id: 'ad_set', name: '야외 광고촬영장', region: '영업마케팅동', minLevel: 36, maxLevel: 54, theme: 'studio', features: ['ladder'] },
  { id: 'market_research', name: '시장조사 거리', region: '영업마케팅동', minLevel: 42, maxLevel: 60, theme: 'street', features: ['boxes'] },
  { id: 'sales_floor', name: '영업본부 전진기지', region: '영업마케팅동', minLevel: 48, maxLevel: 68, theme: 'sales', features: ['elevator'], safeZone: true, shopId: 'sales_outpost' },

  { id: 'dev_floor', name: '개발팀 스프린트실', region: '개발연구동', minLevel: 50, maxLevel: 70, theme: 'development', features: ['ladder'] },
  { id: 'server_corridor', name: '서버실 냉각통로', region: '개발연구동', minLevel: 56, maxLevel: 76, theme: 'server', features: ['rope'] },
  { id: 'bug_quarantine', name: '버그 격리구역', region: '개발연구동', minLevel: 62, maxLevel: 84, theme: 'server', features: ['ladder', 'hazard'] },
  { id: 'research_annex', name: '기업연구소 별관', region: '개발연구동', minLevel: 68, maxLevel: 90, theme: 'laboratory', features: ['elevator'] },
  { id: 'prototype_lab', name: '시제품 실험실', region: '개발연구동', minLevel: 74, maxLevel: 98, theme: 'laboratory', features: ['rope', 'hazard'] },
  { id: 'data_center', name: '사내 데이터센터', region: '개발연구동', minLevel: 82, maxLevel: 108, theme: 'server', features: ['ladder'] },

  { id: 'production_line', name: '현장직 생산라인', region: '생산관리동', minLevel: 76, maxLevel: 100, theme: 'factory', features: ['conveyor', 'ladder'] },
  { id: 'facility_engine', name: '시설관리 기계실', region: '생산관리동', minLevel: 84, maxLevel: 110, theme: 'factory', features: ['rope', 'hazard'] },
  { id: 'quality_lab', name: '품질검사 통제실', region: '생산관리동', minLevel: 92, maxLevel: 118, theme: 'quality', features: ['elevator'] },
  { id: 'logistics_warehouse', name: '야간 물류창고', region: '생산관리동', minLevel: 100, maxLevel: 128, theme: 'warehouse', features: ['boxes', 'ladder'] },

  { id: 'overtime_depths', name: '무한야근 심층구역', region: '경영전략층', minLevel: 112, maxLevel: 145, theme: 'overtime', features: ['rope', 'hazard'] },
  { id: 'executive_strategy', name: '임원 전략회의층', region: '경영전략층', minLevel: 125, maxLevel: 160, theme: 'executive', features: ['elevator'] },
  {
    id: 'frozen_dispatch_yard',
    name: '출장 준비 빙결통로',
    region: '신대륙 출장로',
    minLevel: 130,
    maxLevel: 140,
    theme: 'frozen-dispatch',
    features: ['ladder', 'ice'],
    monsterIds: ['overtime_reaper', 'deadline_dragon'],
    layoutPreset: 'frozen_dispatch'
  },
  {
    id: 'company_bus_stop',
    name: '호이상사 정문 버스정류장',
    region: '회사 외곽',
    minLevel: 1,
    maxLevel: 200,
    theme: 'bus-stop',
    features: ['bus-stop'],
    safeZone: true,
    layoutPreset: 'bus_stop'
  },

  { id: 'memo_shredder_room', name: '파쇄기 문서더미실', region: '단일 사냥터', minLevel: 3, maxLevel: 8, theme: 'office', features: ['boxes'], monsterIds: ['paper_dust'] },
  { id: 'stapler_repair_bay', name: '스테이플러 수리대', region: '단일 사냥터', minLevel: 9, maxLevel: 14, theme: 'training', features: ['ladder'], monsterIds: ['runaway_stapler'] },
  { id: 'coffee_storage', name: '식은 커피 보관실', region: '단일 사냥터', minLevel: 15, maxLevel: 22, theme: 'pantry', features: ['boxes'], monsterIds: ['coffee_slime'] },
  { id: 'meeting_mouse_hole', name: '회의실 쥐구멍', region: '단일 사냥터', minLevel: 23, maxLevel: 30, theme: 'office', features: ['rope'], monsterIds: ['meeting_mouse'] },
  { id: 'overtime_roost', name: '야근 박쥐 둥지', region: '단일 사냥터', minLevel: 31, maxLevel: 36, theme: 'overtime', features: ['rope'], monsterIds: ['overtime_bat'] },
  { id: 'payroll_mimic_vault', name: '급여함 미믹 금고', region: '단일 사냥터', minLevel: 37, maxLevel: 44, theme: 'vault', features: ['boxes'], monsterIds: ['payroll_mimic'] },
  { id: 'sales_fox_den', name: '영업여우 접선로', region: '단일 사냥터', minLevel: 57, maxLevel: 67, theme: 'sales', features: ['ladder'], monsterIds: ['sales_fox'] },
  { id: 'bug_nest', name: '버그 딱정벌레 둥지', region: '단일 사냥터', minLevel: 64, maxLevel: 72, theme: 'server', features: ['hazard'], monsterIds: ['bug_beetle'] },
  { id: 'prototype_hangar', name: '시제품 골렘 격납고', region: '단일 사냥터', minLevel: 78, maxLevel: 86, theme: 'laboratory', features: ['elevator'], monsterIds: ['prototype_golem'] },
  { id: 'deadline_rooftop', name: '마감기한 드래곤 옥상', region: '단일 사냥터', minLevel: 132, maxLevel: 145, theme: 'executive', features: ['hazard', 'rope'], monsterIds: ['deadline_dragon'] }
  ,
  {
    id: 'hidden_hwang_sales',
    name: '히든 스트리트 - 미쳐버린 영업 회의실',
    region: '히든 스트리트',
    minLevel: 57,
    maxLevel: 67,
    theme: 'sales',
    features: ['hazard'],
    monsterIds: [],
    fieldBossId: 'mad_hwang_manager',
    hidden: true
  },
  {
    id: 'hidden_hwang_overtime',
    name: '히든 스트리트 - 감맘 네오의 폐쇄실',
    region: '히든 스트리트',
    minLevel: 112,
    maxLevel: 128,
    theme: 'overtime',
    features: ['hazard'],
    monsterIds: [],
    fieldBossId: 'gammam_neo',
    hidden: true
  }
];

const MAP_EDGES = [
  ['main_lobby', 'newcomer_training', '연수원 통로'],
  ['main_lobby', 'document_corridor', '결재동 복도'],
  ['newcomer_training', 'memo_shredder_room', '파쇄기실 쪽문'],
  ['parking_b1', 'stapler_repair_bay', '수리대 계단'],
  ['pantry_alley', 'coffee_storage', '커피창고 문'],
  ['interview_maze', 'meeting_mouse_hole', '회의실 틈새'],
  ['payroll_vault', 'overtime_roost', '야근 둥지 사다리'],
  ['payroll_vault', 'payroll_mimic_vault', '미믹 금고문'],
  ['sales_floor', 'sales_fox_den', '접선로'],
  ['bug_quarantine', 'bug_nest', '버그 둥지'],
  ['prototype_lab', 'prototype_hangar', '골렘 격납고'],
  ['overtime_depths', 'deadline_rooftop', '옥상 비상문'],
  ['newcomer_training', 'pantry_alley', '비상계단'],
  ['newcomer_training', 'hr_reception', '교육동 엘리베이터'],
  ['document_corridor', 'parking_b1', '지하 연결계단'],
  ['document_corridor', 'accounting_records', '관리동 연결문'],
  ['pantry_alley', 'rooftop_garden', '옥상 사다리'],
  ['pantry_alley', 'brand_studio', '촬영장 뒷문'],
  ['parking_b1', 'facility_engine', '설비동 엘리베이터'],
  ['parking_b1', 'logistics_warehouse', '화물차 통로'],
  ['rooftop_garden', 'brand_studio', '옥상 구름다리'],
  ['hr_reception', 'interview_maze', '면접 대기문'],
  ['hr_reception', 'talent_center', '인재개발 연결로'],
  ['interview_maze', 'org_archive', '인사기록 통로'],
  ['talent_center', 'org_archive', '수료생 전용문'],
  ['talent_center', 'dev_floor', '직무교육 엘리베이터'],
  ['org_archive', 'accounting_records', '문서이관 통로'],
  ['accounting_records', 'payroll_vault', '보안금고 문'],
  ['accounting_records', 'finance_analysis', '재무동 계단'],
  ['payroll_vault', 'audit_archive', '감사전용 통로'],
  ['finance_analysis', 'audit_archive', '봉인창고 문'],
  ['finance_analysis', 'sales_floor', '실적보고 통로'],
  ['audit_archive', 'executive_strategy', '임원전용 엘리베이터'],
  ['brand_studio', 'ad_set', '스튜디오 세트문'],
  ['brand_studio', 'market_research', '시장조사 출구'],
  ['ad_set', 'sales_floor', '캠페인 통로'],
  ['market_research', 'sales_floor', '영업전선 입구'],
  ['market_research', 'prototype_lab', '고객실험 통로'],
  ['sales_floor', 'executive_strategy', '실적보고 엘리베이터'],
  ['dev_floor', 'server_corridor', '개발망 게이트'],
  ['dev_floor', 'bug_quarantine', '격리 브랜치'],
  ['server_corridor', 'data_center', '냉각 덕트'],
  ['bug_quarantine', 'research_annex', '실험망 통로'],
  ['bug_quarantine', 'data_center', '장애대응 문'],
  ['research_annex', 'prototype_lab', '연구동 연결로'],
  ['prototype_lab', 'data_center', '검증 서버문'],
  ['prototype_lab', 'quality_lab', '품질이관 통로'],
  ['data_center', 'overtime_depths', '야간 접속구'],
  ['production_line', 'facility_engine', '생산설비 통로'],
  ['production_line', 'quality_lab', '검사 라인'],
  ['facility_engine', 'logistics_warehouse', '화물 엘리베이터'],
  ['quality_lab', 'logistics_warehouse', '출고검사 문'],
  ['logistics_warehouse', 'overtime_depths', '야간배송 통로'],
  ['overtime_depths', 'executive_strategy', '최종보고 계단']
  ,
  ['executive_strategy', 'frozen_dispatch_yard', '출장 준비 통로'],
  ['frozen_dispatch_yard', 'company_bus_stop', '회사 정문 출구']
  ,
  ['sales_fox_den', 'hidden_hwang_sales', '히든 영업 회의실'],
  ['overtime_depths', 'hidden_hwang_overtime', '히든 감맘 폐쇄실']
];

function buildMapGraph() {
  const byId = new Map(MAP_DEFINITIONS.map((map) => [map.id, { ...map, connections: [] }]));
  for (const [fromId, toId, portalName] of MAP_EDGES) {
    const from = byId.get(fromId);
    const to = byId.get(toId);
    if (!from || !to) throw new Error(`존재하지 않는 맵 연결입니다: ${fromId} -> ${toId}`);
    from.connections.push({ targetId: toId, portalName });
    to.connections.push({ targetId: fromId, portalName });
  }
  return Array.from(byId.values());
}

function stableMapNumber(mapId = '') {
  return Array.from(String(mapId)).reduce(
    (total, character) => (total * 31 + character.charCodeAt(0)) >>> 0,
    17
  );
}

function mirrorLayoutEntry(entry = {}) {
  if (!Number.isFinite(Number(entry.x))) return { ...entry };
  if (Number.isFinite(Number(entry.width))) {
    return { ...entry, x: 100 - Number(entry.x) - Number(entry.width) };
  }
  return { ...entry, x: 100 - Number(entry.x) };
}

function chooseMapLayoutPreset(map, index) {
  if (map.layoutPreset && MAP_LAYOUT_PRESETS[map.layoutPreset]) return map.layoutPreset;
  if (map.safeZone) return 'safe';
  if (map.fieldBossId) return 'boss';
  if (map.id === 'newcomer_training') return 'compact';
  if (map.region === '단일 사냥터') return index % 2 ? 'tiny' : 'compact';
  if (map.features.includes('ladder') && map.features.includes('rope')) return 'tower';
  if (map.features.includes('hazard') || map.connections.length >= 4) return 'sprawling';
  return index % 3 === 0 ? 'wide' : 'compact';
}

function buildMapLayout(map, index = 0) {
  const presetId = chooseMapLayoutPreset(map, index);
  const preset = MAP_LAYOUT_PRESETS[presetId];
  const seed = stableMapNumber(map.id);
  const mirrored = seed % 2 === 1 && !map.safeZone;
  const widthOffset = map.safeZone || map.fieldBossId || map.layoutPreset
    ? 0
    : (seed % 3 - 1) * 80;
  const platforms = preset.platforms.map((platform) => (
    mirrored ? mirrorLayoutEntry(platform) : { ...platform }
  ));
  const connectors = preset.connectors.map((connector) => (
    mirrored ? mirrorLayoutEntry(connector) : { ...connector }
  ));
  return {
    id: presetId,
    variant: seed % 4,
    mirrored,
    worldWidth: Math.max(760, preset.worldWidth + widthOffset),
    worldHeight: preset.worldHeight,
    maxMonsters: preset.maxMonsters,
    spawnPerWave: preset.spawnPerWave,
    platforms,
    connectors
  };
}

const WORLD_MAPS = Object.freeze(buildMapGraph().map((map) => Object.freeze({
  ...map,
  features: Object.freeze([...map.features]),
  connections: Object.freeze(map.connections.map((connection) => Object.freeze(connection))),
  layout: (() => {
    const layout = buildMapLayout(map, MAP_DEFINITIONS.findIndex((entry) => entry.id === map.id));
    return Object.freeze({
      ...layout,
      platforms: Object.freeze(layout.platforms.map((platform) => Object.freeze(platform))),
      connectors: Object.freeze(layout.connectors.map((connector) => Object.freeze(connector)))
    });
  })()
})));

function getWorldMap(mapId) {
  return WORLD_MAPS.find((map) => map.id === mapId) || null;
}

function findNearestSafeMap(mapId) {
  const start = getWorldMap(mapId) || getWorldMap(START_MAP_ID);
  if (!start) return null;
  const queue = [start];
  const visited = new Set([start.id]);
  while (queue.length) {
    const current = queue.shift();
    if (current.safeZone) return current;
    for (const connection of current.connections) {
      if (visited.has(connection.targetId)) continue;
      const next = getWorldMap(connection.targetId);
      if (!next) continue;
      visited.add(next.id);
      queue.push(next);
    }
  }
  return getWorldMap(START_MAP_ID);
}

module.exports = {
  START_MAP_ID,
  MAP_DEFINITIONS,
  MAP_LAYOUT_PRESETS,
  MAP_EDGES,
  WORLD_MAPS,
  buildMapLayout,
  getWorldMap,
  findNearestSafeMap
};
