'use strict';

const START_MAP_ID = 'main_lobby';

const MAP_DEFINITIONS = [
  { id: 'main_lobby', name: '호이상사 중앙로비', region: '본관 초입', minLevel: 1, maxLevel: 8, theme: 'lobby', features: ['elevator'], safeZone: true },
  { id: 'newcomer_training', name: '신입사원 연수원', region: '본관 초입', minLevel: 1, maxLevel: 10, theme: 'training', features: ['ladder'] },
  { id: 'document_corridor', name: '결재서류 복도', region: '본관 초입', minLevel: 5, maxLevel: 15, theme: 'office', features: ['rope'] },
  { id: 'pantry_alley', name: '탕비실 뒷골목', region: '본관 초입', minLevel: 8, maxLevel: 18, theme: 'pantry', features: ['boxes'] },
  { id: 'parking_b1', name: '지하주차장 B1', region: '본관 초입', minLevel: 10, maxLevel: 22, theme: 'parking', features: ['ladder'] },
  { id: 'rooftop_garden', name: '옥상 휴게정원', region: '본관 초입', minLevel: 12, maxLevel: 24, theme: 'rooftop', features: ['rope'] },

  { id: 'hr_reception', name: '인사팀 접견실', region: '인사관리동', minLevel: 15, maxLevel: 28, theme: 'hr', features: ['elevator'] },
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
  { id: 'sales_floor', name: '영업본부 전진기지', region: '영업마케팅동', minLevel: 48, maxLevel: 68, theme: 'sales', features: ['elevator'] },

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
  { id: 'executive_strategy', name: '임원 전략회의층', region: '경영전략층', minLevel: 125, maxLevel: 160, theme: 'executive', features: ['elevator'] }
];

const MAP_EDGES = [
  ['main_lobby', 'newcomer_training', '연수원 통로'],
  ['main_lobby', 'document_corridor', '결재동 복도'],
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

const WORLD_MAPS = Object.freeze(buildMapGraph().map((map) => Object.freeze({
  ...map,
  features: Object.freeze([...map.features]),
  connections: Object.freeze(map.connections.map((connection) => Object.freeze(connection)))
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
  MAP_EDGES,
  WORLD_MAPS,
  getWorldMap,
  findNearestSafeMap
};
