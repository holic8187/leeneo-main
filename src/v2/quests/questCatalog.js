'use strict';

const { EQUIPMENT_SCROLLS } = require('../items/scrollCatalog');

function item(itemId, name, quantity) {
  return Object.freeze({ itemId, name, quantity });
}

function scrollPool(name, predicate) {
  return Object.freeze({
    name,
    options: Object.freeze(EQUIPMENT_SCROLLS.filter(predicate).map((scroll) => Object.freeze({
      itemId: scroll.id,
      name: scroll.name,
      quantity: 1
    })))
  });
}

const RANDOM_REWARDS = Object.freeze({
  weapon60: scrollPool('무기 주문서 60% 중 무작위 1장', (scroll) => (
    scroll.applicableSlot === 'weapon' && scroll.successRate === 60
  )),
  weapon10: scrollPool('무기 주문서 10% 중 무작위 1장', (scroll) => (
    scroll.applicableSlot === 'weapon' && scroll.successRate === 10
  )),
  armor60: scrollPool('방어구 주문서 60% 중 무작위 1장', (scroll) => (
    scroll.applicableSlot !== 'weapon' && scroll.successRate === 60
  )),
  glovesAttack10Or60: scrollPool('장갑 공격력 주문서 10%/60% 중 무작위 1장', (scroll) => (
    ['scroll_gloves_공격력_10', 'scroll_gloves_공격력_60'].includes(scroll.id)
  )),
  helmetDex: scrollPool('투구 민첩성 주문서 중 무작위 1장', (scroll) => (
    ['scroll_helmet_민첩성_10', 'scroll_helmet_민첩성_60', 'scroll_helmet_민첩성_100'].includes(scroll.id)
  ))
});

function quest(id, title, type, targetId, targetName, required, dialogue, exp, money = 0, options = {}) {
  return Object.freeze({
    id, title, type, targetId, targetName, required, dialogue,
    repeat: ['daily', 'weekly'].includes(options.repeat) ? options.repeat : 'once',
    rewards: Object.freeze({
      exp,
      money,
      items: Object.freeze(options.items || []),
      randomItems: Object.freeze(options.randomItems || []),
      huntingMinutes: Math.max(0, Number(options.huntingMinutes) || 0)
    })
  });
}

function npc(id, name, mapId, icon, x, quests) {
  return Object.freeze({ id, name, mapId, icon, x, quests: Object.freeze(quests) });
}

const NPC_CATALOG = Object.freeze([
  npc('lobby_peach', '출근 도장을 잃어버린 피치', 'main_lobby', '🍑', 24, [quest('peach_orientation', '첫 출근의 자세', 'visit', 'newcomer_training', '신입사원 연수원', 1, '신입사원 연수원에 다녀와 주세요. 회사에서 길을 잃지 않는 것도 중요한 능력이랍니다.', 30, 0, { items: [item('bacchus', '박카스', 50)] })]),
  npc('training_simsim', '훈련을 빼먹은 심심쓰', 'newcomer_training', '🐣', 72, [quest('simsim_dust', '서류 먼지 소탕', 'kill', 'paper_dust', '서류 먼지 뭉치', 40, '연수원 바닥에 서류 먼지가 너무 많아요. 마흔 뭉치만 정리해 주실래요?', 70, 3000, { items: [item('hard_candy', '알사탕', 50)] })]),
  npc('corridor_bishop', '월급루팡중인 비숍이', 'document_corridor', '🕊️', 38, [quest('bishop_memo', '사라진 결재 메모', 'collect', 'monster_loot_paper_dust', '구겨진 메모지', 50, '결재 메모가 바람에 날아갔어요. 구겨진 메모지 쉰 장이면 복원할 수 있을 거예요.', 90, 0, { items: [item('safe_zone_return_scroll', '안전지대 귀환서', 3)] })]),
  npc('pantry_winter', '냉장고를 지키는 겨부장', 'pantry_alley', '🧊', 64, [quest('winter_coffee', '식어버린 탕비실', 'kill', 'coffee_slime', '커피 얼룩 슬라임', 150, '누가 냉장고 안에 커피를 쏟았지? 슬라임이 되기 전에 치웠어야 하는데 말이야.', 160, 2500)]),
  npc('parking_coca', '주차선을 닦는 코카', 'parking_b1', '🥤', 20, [quest('coca_stapler', '주차장 안전 점검', 'kill', 'runaway_stapler', '도망친 스테이플러', 180, '도망친 스테이플러가 타이어를 찌르고 있어요. 안전을 위해 정리해 주세요.', 150, 2200, { items: [item('experience_coupon_2x_15m', '경험치 2배 쿠폰 (15분)', 2)] })]),
  npc('rooftop_hoi', '옥상에서 퇴근각을 보는 호이', 'rooftop_garden', '🌇', 76, [quest('hoi_delivery', '옥상의 긴급 연락', 'visit', 'hr_reception', '인사팀 접견실', 1, '이 메모를 인사팀 접견실까지 전달해 줘. 내가 내려가면 퇴근 타이밍을 놓치거든.', 180, 3000, { items: [item('blue_potion', '파란 포션', 50)] })]),
  npc('hr_mond', '지원서를 분류하는 몬드', 'hr_reception', '📋', 30, [quest('mond_mouse', '면접 자료 회수', 'collect', 'monster_loot_meeting_mouse', '갉아먹힌 회의록', 30, '면접 자료가 회의실 생쥐에게 뜯겼어요. 남은 조각을 모아 복구해야 합니다.', 260, 4000)]),
  npc('interview_ssubari', '압박면접을 연습하는 쓰바리', 'interview_maze', '🎙️', 70, [quest('ssubari_mouse', '면접장 소음 단속', 'kill', 'meeting_mouse', '회의실 생쥐', 60, '내 질문보다 생쥐 소리가 더 크잖아. 조용한 면접장을 만들어 줘.', 300, 4500, { items: [item('orange_potion', '주황 포션', 100)] })]),
  npc('talent_meong', '교육자료를 씹어먹은 멍프', 'talent_center', '🐶', 52, [quest('meong_archive', '교육 이수 확인서', 'visit', 'org_archive', '조직문화 기록관', 1, '내가 교육자료를 조금... 먹어버렸어. 기록관에서 이수 확인서를 받아와 줘.', 320)]),
  npc('archive_easy', '기록을 쉽게 찾는 이지', 'org_archive', '🗂️', 25, [quest('easy_audit', '희미한 감사 기록', 'collect', 'monster_loot_audit_ghost', '희미한 감사 도장', 50, '감사 도장이 있어야 오래된 기록을 열 수 있어요. 쉰 개만 찾아 주세요.', 480, 6000)]),
  npc('accounting_nanche', '영수증과 싸우는 난체', 'accounting_records', '🧾', 68, [quest('nanche_payroll', '급여 명세 대조', 'kill', 'payroll_mimic', '급여대장 미믹', 100, '가짜 급여대장이 진짜 명세서 사이에 숨어들었어요. 숫자가 더 꼬이기 전에 찾아주세요.', 520, 8000, { randomItems: [RANDOM_REWARDS.weapon60] })]),
  npc('vault_fist', '금고문을 두드리는 솜주먹', 'payroll_vault', '🥊', 35, [quest('fist_payroll_loot', '찢어진 급여명세서', 'collect', 'monster_loot_payroll_mimic', '찢어진 급여명세서', 90, '금고가 열리지 않아. 찢어진 명세서를 맞추면 비밀번호가 보일지도 몰라.', 600, 9000)]),
  npc('finance_pi', '소수점에 집착하는 파이', 'finance_analysis', '🥧', 74, [quest('pi_sales', '시장 표본 확보', 'kill', 'sales_fox', '영업 여우', 250, '표본이 부족하면 분석은 감이 됩니다. 영업 여우의 활동 기록을 확보해 주세요.', 900)]),
  npc('audit_chunsik', '도장을 거꾸로 찍는 춘식이', 'audit_archive', '🐥', 28, [quest('chunsik_ghost', '감사실 야간 순찰', 'kill', 'audit_ghost', '감사실 유령', 180, '내가 도장을 거꾸로 찍은 뒤로 유령이 나온대. 우연이겠지만 확인은 해줘.', 750, 0, { repeat: 'daily', items: [item('mana_elixir', '마나 엘릭서', 100)] })]),
  npc('brand_rayon', '색상표를 잃은 라연', 'brand_studio', '🎨', 22, [quest('rayon_ad', '바랜 광고 복원', 'collect', 'monster_loot_ad_chameleon', '바랜 광고 전단', 100, '색상표 대신 바랜 광고 전단을 모아오면 새로운 팔레트를 만들 수 있어요.', 900)]),
  npc('ad_jjor', '카메라를 들고 뛰는 김주임', 'ad_set', '📹', 78, [quest('jjor_chameleon', '도망가는 모델', 'kill', 'ad_chameleon', '광고 카멜레온', 240, '모델들이 배경색에 숨어버렸어요. 촬영이 끝나기 전에 찾아주세요!', 1100, 0, { repeat: 'weekly', items: [item('experience_coupon_2x_15m', '경험치 2배 쿠폰 (15분)', 4)] })]),
  npc('market_guma', '설문지를 접는 구마', 'market_research', '📊', 44, [quest('guma_sales_floor', '현장 설문 전달', 'visit', 'sales_floor', '영업본부 전진기지', 1, '이 설문 묶음을 영업본부에 전해주세요. 응답률보다 전달률이 먼저예요.', 950)]),
  npc('sales_neo', '계약서를 숨긴 이대리', 'sales_floor', '🤝', 58, [quest('neo_contract', '특약 계약서 회수', 'collect', 'monster_loot_sales_fox', '특약 계약서', 50, '영업 여우가 중요한 특약서를 물고 갔어요. 회수하면 성과는 반씩... 농담입니다.', 1300, 0, { randomItems: [RANDOM_REWARDS.glovesAttack10Or60] })]),
  npc('dev_potato', '배포를 미룬 최팀장', 'dev_floor', '🥔', 26, [quest('potato_bug', '긴급 버그 수정', 'kill', 'bug_beetle', '버그 딱정벌레', 150, '배포 버튼을 누르기 전에 버그가 실물로 튀어나왔어요. 백쉰 마리만 잡아주세요.', 1600)]),
  npc('server_mingu', '케이블을 안고 자는 밍구', 'server_corridor', '🔌', 73, [quest('mingu_cable', '그을린 케이블 교체', 'collect', 'monster_loot_server_wisp', '그을린 케이블', 200, '서버실 온도가 수상해요. 그을린 케이블을 모아오면 한꺼번에 교체할게요.', 1900, 26000, { randomItems: [RANDOM_REWARDS.helmetDex] })]),
  npc('bug_nilnil', '재현 영상을 찍는 곽프로', 'bug_quarantine', '🪲', 34, [quest('nilnil_bug', '재현율 100퍼센트', 'kill', 'bug_beetle', '버그 딱정벌레', 300, '버그가 한 번만 나오면 기능이래요. 삼백 번 재현해서 확실한 버그로 만들어 주세요.', 2300, 10000, { repeat: 'weekly', huntingMinutes: 180 })]),
  npc('research_simmi', '시약 냄새를 맡는 하연구원', 'research_annex', '🧪', 66, [quest('simmi_golem', '시제품 내구 실험', 'kill', 'prototype_golem', '시제품 골렘', 180, '시제품이 연구실을 탈출했어요. 파괴 데이터도 실험 결과니까 회수해 주세요.', 2600, 3400, { randomItems: [RANDOM_REWARDS.weapon10] })]),
  npc('prototype_hoyi', '도면 위에서 야근하는 호이', 'prototype_lab', '📐', 20, [quest('hoyi_parts', '불량 부품 분석', 'collect', 'monster_loot_prototype_golem', '불량 부품', 100, '불량 부품 백 개면 원인을 특정할 수 있어. 아마도 납기 때문이겠지만.', 3000, 3800, { randomItems: [RANDOM_REWARDS.armor60] })]),
  npc('data_sseubi', '로그를 세는 쓰비', 'data_center', '💾', 80, [quest('sseubi_wisp', '서버실 방화벽', 'kill', 'server_wisp', '서버실 도깨비불', 200, '도깨비불이 방화벽을 문자 그대로 태우고 있어요. 로그가 끊기기 전에 막아주세요.', 3600, 45000, { items: [item('scroll_helmet_지력_60', '투구 지력 주문서 60%', 1)] })]),
  npc('production_morae', '컨베이어를 거슬러 걷는 모래', 'production_line', '🏭', 24, [quest('morae_crab', '라인 이물 제거', 'kill', 'conveyor_crab', '컨베이어 게', 300, '컨베이어에 게가 끼었는데 생산량에는 잡히고 있어. 숫자가 더 좋아지기 전에 치워줘.', 4000, 400000)]),
  npc('facility_kim', '렌치를 잃은 김부장', 'facility_engine', '🔧', 69, [quest('kim_battery', '예비 배터리 확보', 'collect', 'monster_loot_facility_drone', '방전된 배터리', 150, '방전됐어도 부품은 쓸 수 있지. 드론 배터리를 모아오게.', 4800, 6000, { huntingMinutes: 180 })]),
  npc('quality_neo', '불량표를 붙이는 정과장', 'quality_lab', '✅', 30, [quest('ineo_spider', '전수 품질검사', 'kill', 'quality_spider', '품질검사 거미', 400, '표본검사는 불안해요. 이번만큼은 사백 마리 전수검사로 갑시다.', 5600, 7000, { items: [item('grilled_eel', '장어구이', 200)] })]),
  npc('logistics_jjor', '송장을 접어 날리는 몬드', 'logistics_warehouse', '📦', 76, [quest('jjor_boar', '파손 배송 추적', 'kill', 'warehouse_boar', '물류창고 멧돼지', 400, '멧돼지가 송장을 등에 붙이고 달아났어요. 배송 완료 처리 전에 찾아주세요.', 6500, 8000, { items: [item('experience_coupon_2x_15m', '경험치 2배 쿠폰 (15분)', 6)] })]),
  npc('overtime_winter', '퇴근을 봉인한 겨부장', 'overtime_depths', '🌙', 18, [quest('winter_hwang', '야근실의 주인', 'boss', 'mad_hwang_manager', '야근하다 미쳐버린 황과장', 1, '히든 야근실의 황과장을 막아야 모두 퇴근할 수 있다. 살아서 돌아오게.', 12000, 20000, { items: [item('scroll_gloves_공격력_60', '장갑 공격력 주문서 60%', 1)] })])
]);

const NPC_BY_ID = new Map(NPC_CATALOG.map((entry) => [entry.id, entry]));
const QUEST_BY_ID = new Map(NPC_CATALOG.flatMap((entry) => (
  entry.quests.map((entryQuest) => [entryQuest.id, { ...entryQuest, npcId: entry.id, mapId: entry.mapId }])
)));

function getNpc(npcId) { return NPC_BY_ID.get(String(npcId || '')) || null; }
function getQuest(questId) { return QUEST_BY_ID.get(String(questId || '')) || null; }
function getNpcsForMap(mapId) { return NPC_CATALOG.filter((entry) => entry.mapId === mapId); }

module.exports = { NPC_CATALOG, getNpc, getQuest, getNpcsForMap };
