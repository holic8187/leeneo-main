import { REMAINING_ROSTER } from './remainingRoster.js';

const hit=(power,br=0,hits=1)=>({type:'hit',power,br,hits});
const heal=(power,target='all')=>({type:'heal',power,target});
const shield=(power,target='all')=>({type:'shield',power,target});
const buff=(id,name,power,duration=2,target='all',charges=null)=>({type:'buff',id,name,power,duration,target,charges});
const debuff=(id,name,power,duration=2)=>({type:'debuff',id,name,power,duration});
const cleanse=(count=1,target='all')=>({type:'cleanse',count,target});
const cooldown=(count=1,target='ally')=>({type:'cooldown',count,target});
const rows=[
  ['simsim-u','쿠션 응원 방송',2,'아군 1명의 HP를 12% 회복하고 다음 기본 공격 피해를 25% 높인다.',[heal(12,'ally'),buff('basic-bonus','쿠션 응원',25,null,'ally',1)]],
  ['simsim-r','졸음 방패',3,'자신에게 HP 24% 보호막과 도발 1회를 부여한다. 적 공격력을 2턴간 10% 낮춘다.',[shield(24,'self'),buff('taunt','졸음 도발',0,null,'self',1),debuff('attack-down','나른한 공격',10)]],
  ['simsim-rr','몰래 외운 연속기',3,'공격력 75% 피해를 3회 주고 브레이크 피해 20을 준다.',[hit(75,20,3)]],
  ['simsim-rrr','유령 관객의 박수',4,'아군 전체의 다음 기본 공격 피해를 40% 높이고 HP를 14% 회복한다.',[buff('basic-bonus','유령의 박수',40,null,'all',1),heal(14)]],
  ['simsim-sr','무음 휴게실',4,'아군 전체에게 HP 23% 보호막과 약화 차단 1회를 부여한다.',[shield(23),buff('debuff-block','무음 차단',0,null,'all',1)]],
  ['simsim-hr','꿈결 역전 버튼',4,'공격력 230% 피해와 브레이크 피해 30을 준다. 자신이 최대 HP의 50% 이하면 HP를 25% 회복한다.',[hit(230,30)],'dream-comeback'],
  ['simsim-ur','잠깐만 일시정지',0,'저장: 자신에게 HP 8% 보호막을 부여하고 정지 조각 1개를 모은다(최대 3개). 방출: 모든 조각을 소비해 아군 전체에게 조각당 HP 9% 보호막을 부여하고 적의 다음 행동을 동결한다. 조각이 없으면 저장한다.',[],'pause-bank'],
  ['simsim-ssr','엔딩 이후의 체크포인트',6,'아군 전체 HP를 20% 회복하고 현재 HP를 기록한다. 3턴간 각 아군이 행동불능이 되는 직접 공격을 처음 받을 때, 기록 HP의 60%로 살아남고 기록을 소모한다. 지속 피해는 막지 않으며 즉사 방지는 각 카드 1회다. 이미 행동불능인 카드는 부활하지 않는다.',[],'checkpoint'],
  ['rayeon-rrr','초승달의 가장자리',4,'아군 전체에게 HP 22% 보호막을 부여한다. 자신에게 도발 2회와 2턴간 피해 감소 20%를 부여한다.',[shield(22),buff('taunt','달의 유인',0,null,'self',2),buff('damage-reduction','초승달 결계',20,2,'self')]],
  ['rayeon-hr','월광 정원의 약속',4,'아군 전체 HP를 22% 회복하고 약화 효과를 1개씩 제거한다. 선택한 아군의 쿨다운을 1턴 줄인다.',[heal(22),cleanse(),cooldown()]],
  ['rayeon-ur','달의 뒷면 관측',1,'사용할 때마다 초승·보름 관측을 번갈아 실행한다. 초승은 공격력 130% 피해와 브레이크 피해 20, 보름은 공격력 200% 피해를 주고 적이 받는 피해를 1턴간 15% 높인다.',[],'moon-phase'],
  ['rayeon-ssr','새벽 봉인 역법',5,'아군 전체에게 HP 28% 보호막을 부여한다. 이후 적의 직접 공격 행동 3회 동안 매 행동마다 가장 HP가 낮은 아군에게 HP 12% 보호막을 부여한다. 세 번째 행동 뒤 적의 다음 행동을 동결하고 브레이크 피해 35를 준다.',[],'dawn-calendar'],
  ['mango-rrr','열매 등불 길잡이',3,'아군 전체 HP를 16% 회복하고 2턴간 받는 회복량을 20% 높인다.',[heal(16),buff('healing-taken-up','열매 등불',20)]],
  ['mango-sr','황금 껍질의 약속',4,'아군 전체에게 HP 25% 보호막을 부여하고 2턴간 받는 피해를 18% 줄인다.',[shield(25),buff('damage-reduction','황금 껍질',18)]],
  ['mango-ur','익을 때까지 기다려',0,'저장: 햇살 씨앗 1개를 모으고 가장 HP가 낮은 아군을 6% 회복한다(씨앗 최대 4개). 수확: 모든 씨앗을 소비해 아군 전체 HP를 씨앗당 8% 회복하고, 3개 이상 소비하면 전체 쿨다운을 1턴 줄인다. 씨앗이 없으면 저장한다.',[],'sun-seeds'],
  ['mango-ssr','첫 열매의 낙하',5,'공격력 180% 피해를 주고 태양 열매 3개를 세운다. 이후 아군의 기본 공격마다 열매 1개를 소비해 공격력 95%로 추가 공격하며 가장 HP가 낮은 아군을 8% 회복한다. 시전자의 강화 수치를 사용한다.',[],'sun-orchard'],
  ['mond-rr','안개숲 구조 신호',3,'가장 HP가 낮은 아군에게 HP 24% 보호막을 부여하고 약화 효과를 2개 제거한다. 자신의 다음 단일 피격을 유도한다.',[shield(24,'lowest'),cleanse(2,'lowest'),buff('taunt','구조 신호',0,null,'self',1)]],
  ['mond-sr','별지도 야영지',4,'아군 전체 HP를 20% 회복하고 HP 12% 보호막을 부여한다. 선택한 아군의 쿨다운을 1턴 줄인다.',[heal(20),shield(12),cooldown()]],
  ['mond-hr','절벽을 잇는 도약',4,'공격력 240% 피해와 브레이크 피해 35를 준다. 아군 전체의 회피율을 1턴간 18% 높인다.',[hit(240,35),buff('evasion','절벽의 바람',18,1)]],
  ['mond-ur','안전 좌표 재설계',1,'선택한 아군에게 HP 14% 보호막을 부여한다. 직전 사용 대상과 다른 아군을 선택했다면 이번 보호막은 HP 24%가 되고 대상의 약화 효과를 1개 제거한다. 첫 사용에는 기본 보호막만 부여한다.',[],'safe-coordinates'],
  ['mond-ssr','빈칸을 완성하는 탐험',5,'아군 전체에게 HP 20% 보호막을 부여하고 탐험 지도를 펼친다. 이후 서로 다른 아군 3명이 스킬을 쓰면 세 번째 스킬 직후 아군 전체 HP를 25% 회복하고 쿨다운을 1턴 줄이며 공격력 220%로 추가 공격한다. 시전 행동은 제외한다.',[],'explorer-passport'],
  ['shanghai-rrr','파도를 베는 응급검',4,'아군 전체의 약화 효과를 1개씩 제거하고 HP를 18% 회복한다. 적에게 공격력 100% 피해를 준다.',[cleanse(),heal(18),hit(100)]],
  ['shanghai-hr','심해 갑문 닫기',4,'자신에게 HP 40% 보호막과 도발 2회를 부여한다. 아군 전체가 2턴간 받는 피해를 20% 줄인다.',[shield(40,'self'),buff('taunt','심해 갑문',0,null,'self',2),buff('damage-reduction','닫힌 갑문',20)]],
  ['shanghai-ur','한 방울에 담긴 칼날',0,'집중: 검의 물방울 1개를 저장하고 자신에게 HP 6% 보호막을 부여한다(최대 3개). 참격: 모든 물방울을 소비해 공격력 100% + 물방울당 95% 피해와 물방울당 브레이크 피해 12를 준다. 물방울이 없으면 집중한다.',[],'sword-droplets'],
  ['shanghai-ssr','돌아오는 해류의 맹세',5,'아군 전체에게 HP 24% 보호막을 부여한다. 3턴간 적의 직접 공격에 보호막으로 막은 피해의 45%를 조류로 저장한다. 자신의 다음 스킬 사용 시 저장량을 전체 아군 보호막으로 균등 분배하고 다시 맹세한다. 저장은 시전자 최대 HP의 120%까지다.',[],'returning-tide'],
  ['meongpeu-u','잊기 전에 적어두기',2,'선택한 아군의 약화 효과를 1개 제거하고 다음 스킬 효과량을 15% 높인다.',[cleanse(1,'ally'),buff('effect-up','첫 메모',15,null,'ally',1)]],
  ['meongpeu-r','서류함 엄폐',3,'아군 전체에게 HP 15% 보호막을 부여하고 자신이 다음 단일 공격을 유도한다.',[shield(15),buff('taunt','서류함 엄폐',0,null,'self',1)]],
  ['meongpeu-rr','결재 도장 꾹',3,'공격력 190% 피해와 브레이크 피해 25를 준다. 적 공격력을 1턴간 12% 낮춘다.',[hit(190,25),debuff('attack-down','결재 보류',12,1)]],
  ['meongpeu-rrr','빈칸을 채운 메모',3,'아군 1명의 쿨다운을 2턴 줄이고 HP를 18% 회복한다.',[cooldown(2),heal(18,'ally')]],
  ['meongpeu-sr','포근한 야근 방벽',4,'아군 전체에게 HP 24% 보호막을 부여하고 다음 약화 효과를 1개씩 막는다.',[shield(24),buff('debuff-block','포근한 방벽',0,null,'all',1)]],
  ['meongpeu-hr','완벽한 인수인계',4,'아군 전체 HP를 22% 회복하고 다음 스킬 효과량을 22% 높인다. 자신의 다음 기본 공격 피해를 40% 높인다.',[heal(22),buff('effect-up','인수인계 완료',22,null,'all',1),buff('basic-bonus','잠결의 집중',40,null,'self',1)]],
  ['meongpeu-ur','내일 제출할 보고서',1,'공격력 90% 피해를 주고 보고서 1장을 작성한다(최대 3장). 방출을 선택하면 저장한 보고서를 모두 소비해 장당 공격력 90% 추가 피해와 브레이크 피해 12를 준다. 보고서는 기본 공격을 해도 유지된다.',[],'future-report'],
  ['meongpeu-ssr','꿈속 최종 결재',5,'아군 전체에게 HP 22% 보호막과 비상 결재 1회를 부여한다. 3턴간 각 아군이 직접 공격으로 최대 HP의 25% 이상을 한 번에 잃으면 그 피해 직후 잃은 HP의 50%를 회복하고 약화 효과를 1개 제거한다. 행동불능은 회복하지 않는다.',[],'emergency-approval'],
  ['sseubi-r','먹빛 우산 펼치기',3,'아군 전체에게 HP 15% 보호막을 부여하고 2턴간 받는 지속 피해를 25% 줄인다.',[shield(15),buff('dot-reduction','먹빛 우산',25)]],
  ['sseubi-rr','반격의 한 획',3,'공격력 190% 피해를 주고 자신에게 반격 2회를 부여한다. 반격은 공격력 65% 피해를 준다.',[hit(190),buff('counter','먹빛 반격',65,null,'self',2)]],
  ['sseubi-rrr','여백 잇기',3,'아군 전체의 약화 효과를 1개씩 제거하고 HP를 16% 회복한다. 가장 HP가 낮은 아군에게 HP 10% 보호막을 부여한다.',[cleanse(),heal(16),shield(10,'lowest')]],
  ['sseubi-sr','지워지지 않는 약속',4,'아군 전체에게 HP 23% 보호막을 부여하고 2턴간 약화 저항을 30% 높인다.',[shield(23),buff('debuff-resist','지워지지 않는 약속',30)]],
  ['sseubi-hr','묵룡 폭포',4,'공격력 85% 피해를 3회 주고 브레이크 피해 30을 준다. 적 명중률을 2턴간 15% 낮춘다.',[hit(85,30,3),debuff('accuracy-down','먹구름',15)]],
  ['sseubi-ur','결말 퇴고',0,'교정: 아군 1명의 약화 효과를 1개 제거하고 실제 제거했다면 먹물 1개를 모은다(최대 4개). 제거할 효과가 없으면 대상 HP를 6% 회복한다. 새 결말: 먹물을 전부 소비해 아군 전체에게 먹물당 HP 8% 보호막을 부여한다. 먹물이 없으면 교정한다.',[],'ink-edit'],
  ['sseubi-ssr','천지의 첫 획',5,'공격력 260% 피해와 브레이크 피해 35를 준다. 적에게 이미 걸린 지속시간형 약화 효과를 1턴 연장한다(최대 4턴). 동결·스턴은 연장하지 않는다. 실제 연장한 효과당 공격력 25% 피해를 더하며 최대 4개까지만 계산한다.',[],'first-stroke'],
  ['jandi-u','새싹의 인사',2,'가장 HP가 낮은 아군을 14% 회복하고 HP 8% 보호막을 부여한다.',[heal(14,'lowest'),shield(8,'lowest')]],
  ['jandi-r','가시 울타리',3,'자신에게 HP 25% 보호막과 도발 1회를 부여하고 공격력 60% 반격 2회를 준비한다.',[shield(25,'self'),buff('taunt','가시 울타리',0,null,'self',1),buff('counter','가시 반격',60,null,'self',2)]],
  ['jandi-rrr','소나기 발굽',3,'공격력 65% 피해를 3회 주고 브레이크 피해 26을 준다. 적이 받는 회복량을 2턴간 18% 낮춘다.',[hit(65,26,3),debuff('healing-down','여름 소나기',18)]],
  ['jandi-sr','겨울 정원의 온기',4,'아군 전체 HP를 22% 회복하고 약화 효과를 1개씩 제거한다. 2턴간 받는 회복량을 15% 높인다.',[heal(22),cleanse(),buff('healing-taken-up','정원의 온기',15)]],
  ['jandi-hr','뿌리 궁전',4,'아군 전체에게 HP 27% 보호막을 부여한다. 2턴간 피해를 20% 줄이고 자신이 다음 단일 공격을 유도한다.',[shield(27),buff('damage-reduction','뿌리 궁전',20),buff('taunt','뿌리의 유인',0,null,'self',1)]],
  ['jandi-ur','접어 둔 계절',0,'잎 저장: 공격력 75% 피해와 함께 계절 잎 1개를 얻는다(최대 4개). 계절 펼치기: 잎을 모두 소비해 잎당 공격력 90% 피해와 브레이크 피해 10을 준다. 잎이 없으면 잎 저장을 사용한다.',[],'season-leaves'],
  ['jandi-ssr','영원한 봄의 심장',5,'아군 전체 HP를 22% 회복하고 봄의 심장 4개를 만든다. 이후 아군이 스킬을 사용한 직후 실제 HP가 최대치보다 낮으면 심장 1개를 소비해 그 아군 HP를 18% 회복하고 HP 12% 보호막을 부여한다. 시전 행동은 제외하며 HP가 가득 차면 소비하지 않는다.',[],'spring-hearts'],
  ['choonsik-r','도시락 반씩 나누기',3,'아군 전체 HP를 15% 회복하고 가장 HP가 낮은 아군을 8% 추가 회복한다.',[heal(15),heal(8,'lowest')]],
  ['choonsik-rr','우산잎 대피소',3,'아군 전체에게 HP 19% 보호막을 부여하고 다음 약화 효과를 1개씩 막는다.',[shield(19),buff('debuff-block','우산잎',0,null,'all',1)]],
  ['choonsik-rrr','통나무 내리막 특급',3,'공격력 220% 피해와 브레이크 피해 28을 준다.',[hit(220,28)]],
  ['choonsik-sr','별빛 야영 준비',4,'아군 전체 HP를 20% 회복하고 다음 기본 공격 피해를 30% 높인다.',[heal(20),buff('basic-bonus','별빛 야영',30,null,'all',1)]],
  ['choonsik-hr','등에 업은 작은 숲',4,'아군 전체에게 HP 25% 보호막을 부여한다. 자신의 도발 2회와 2턴간 피해 감소 25%를 얻는다.',[shield(25),buff('taunt','숲의 길잡이',0,null,'self',2),buff('damage-reduction','작은 숲',25,2,'self')]],
  ['choonsik-ur','소풍길 갈림표',1,'직전과 다른 길을 선택하면 추가 효과를 얻는다. 쉼터: 아군 1명 HP 14% 회복(추가로 약화 1개 제거). 다리: 아군 1명 HP 14% 보호막(추가로 쿨다운 1턴 감소). 첫 사용에는 추가 효과가 없다.',[],'picnic-crossroads'],
  ['choonsik-ssr','내일로 출발하는 소풍',5,'공격력 220% 피해를 주고 출발 도장 4개를 준비한다. 이후 아군이 기본 공격을 하면 도장 1개를 소비해 시전자 공격력 70%로 추가 공격한다. 소비할 때마다 다음 추가 공격 위력이 35%씩 오른다. 시전 행동은 제외한다.',[],'tomorrow-picnic'],
  ['hoi-hr','별빛 환승표',4,'아군 전체에게 HP 18% 보호막을 부여하고 환승표 3장을 만든다. 이후 아군 기본 공격마다 1장을 소비해 공격한 아군의 쿨다운을 1턴 줄이고 가장 HP가 낮은 아군을 8% 회복한다.',[],'star-transfer'],
];
export const REMAINING_SKILL_RULES = Object.freeze(Object.fromEntries(rows.map(([id,name,cooldown,description,effects,mechanic])=>[id,{id,name,cooldown,description,effects,mechanic}])));
export const REMAINING_ROSTER_SKILLS = Object.freeze(REMAINING_ROSTER.map(card=>{
  const rule=REMAINING_SKILL_RULES[card.id];
  if(!rule)throw new Error(`신규 카드 스킬 누락: ${card.id}`);
  return Object.freeze({id:card.id,displayName:`${card.epithet} ${card.characterName}`,name:rule.name,cooldown:rule.cooldown,description:rule.description,
    role:({attack:'공격',defense:'방어',support:'지원'})[card.role]});
}));
export function skillChoices(cardId) {
  if(['simsim-ur','mango-ur','shanghai-ur','meongpeu-ur','sseubi-ur','jandi-ur'].includes(cardId))return [{value:'charge',label:'저장 / 준비'},{value:'release',label:'소비 / 방출'}];
  if(cardId==='choonsik-ur')return [{value:'rest',label:'쉼터 · 회복'},{value:'bridge',label:'다리 · 보호막'}];
  return [];
}
