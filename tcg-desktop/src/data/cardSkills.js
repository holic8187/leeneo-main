// Generated from docs/card-skill-draft-v2.txt. Keep ids aligned with CARD_CATALOG.

export const SKILL_ENHANCEMENT_BONUSES = Object.freeze([0, 0.04, 0.10, 0.18, 0.28, 0.40]);

const RAW_CARD_SKILLS = [
  {
    "id": "simsim-c",
    "displayName": "무심한 유령 심심이",
    "name": "딴청 감지",
    "description": "적 공격력을 2턴간 10% 낮추고, 받는 브레이크 피해를 4 증가시킨다.",
    "cooldown": 3,
    "role": "약화·지원"
  },
  {
    "id": "winter-c",
    "displayName": "눈꽃의 소녀 겨울",
    "name": "창가의 첫서리",
    "description": "아군 1명의 HP를 12% 회복하고 1턴간 받는 피해를 10% 줄인다.",
    "cooldown": 3,
    "role": "회복"
  },
  {
    "id": "kkamdung-c",
    "displayName": "달빛의 고양이 깜둥",
    "name": "초승달 웅크리기",
    "description": "자신에게 HP 12% 보호막을 부여하고 다음 단일 공격을 자신에게 유도한다.",
    "cooldown": 3,
    "role": "탱킹"
  },
  {
    "id": "nanche-c",
    "displayName": "퍼즐 친구 난체",
    "name": "빈칸에 쏙!",
    "description": "공격력 95% 피해와 브레이크 피해 18을 준다.",
    "cooldown": 3,
    "role": "브레이크"
  },
  {
    "id": "rayeon-c",
    "displayName": "달을 읽는 이 라연이",
    "name": "은월 도표",
    "description": "아군 1명의 피해량을 2턴간 12% 높이고 다음 공격의 브레이크 피해를 6 높인다.",
    "cooldown": 3,
    "role": "지원"
  },
  {
    "id": "mango-c",
    "displayName": "잎새 드래곤 망고",
    "name": "반짝 망고 박치기",
    "description": "공격력 115% 피해를 준다. 자신의 HP가 70% 이상이면 피해량이 20% 증가한다.",
    "cooldown": 3,
    "role": "공격"
  },
  {
    "id": "morae-c",
    "displayName": "사막의 길잡이 모래",
    "name": "길표식 그늘",
    "description": "가장 HP가 낮은 아군에게 HP 11% 보호막과 약화 저항 20%를 부여한다.",
    "cooldown": 3,
    "role": "방어·지원"
  },
  {
    "id": "mond-c",
    "displayName": "새내기 탐험가 몬드",
    "name": "손그림 지름길",
    "description": "아군 1명의 쿨다운을 1턴 줄이고 다음 행동의 효과량을 8% 높인다.",
    "cooldown": 4,
    "role": "유틸"
  },
  {
    "id": "somfist-c",
    "displayName": "폭신한 주먹 솜주먹",
    "name": "폭신한 가드",
    "description": "2턴간 아군 1명이 받는 피해의 절반을 대신 받고, 대신 받는 피해는 20% 감소한다.",
    "cooldown": 3,
    "role": "탱킹"
  },
  {
    "id": "shanghai-c",
    "displayName": "푸른 검객 상해",
    "name": "항구 기본 베기",
    "description": "공격력 100% 피해와 브레이크 피해 16을 준다.",
    "cooldown": 3,
    "role": "브레이크"
  },
  {
    "id": "meongpeu-c",
    "displayName": "졸린 신입 인턴 멍프",
    "name": "놓치지 않은 메모",
    "description": "가장 HP가 낮은 아군을 9% 회복하고 약화 효과 1개를 제거한다.",
    "cooldown": 4,
    "role": "회복·정화"
  },
  {
    "id": "sseubi-c",
    "displayName": "먹빛 기록가 쓰비",
    "name": "먹산 한 획",
    "description": "공격력 110% 피해를 주고 적 공격력을 2턴간 8% 낮춘다.",
    "cooldown": 3,
    "role": "공격·약화"
  },
  {
    "id": "gyullak-c",
    "displayName": "귤빛 강아지 귤락",
    "name": "데굴귤 박치기",
    "description": "공격력 35% 피해를 3회 주고 브레이크 피해 12를 준다.",
    "cooldown": 3,
    "role": "연타 공격"
  },
  {
    "id": "guma-c",
    "displayName": "여우 신사의 수습 구마",
    "name": "수습 봉인부",
    "description": "약화 효과 1개를 제거하고 새로운 약화 효과를 1회 막아준다.",
    "cooldown": 4,
    "role": "정화"
  },
  {
    "id": "wollu-c",
    "displayName": "느긋한 직장인 월루",
    "name": "머그컵 한 모금",
    "description": "자신의 HP를 15% 회복하고 2턴간 받는 피해를 15% 줄인다.",
    "cooldown": 4,
    "role": "자가 회복·방어"
  },
  {
    "id": "easy-c",
    "displayName": "헤드폰 소년 이지",
    "name": "노이즈 캔슬링",
    "description": "적의 공격력과 명중률을 2턴간 8% 낮춘다.",
    "cooldown": 4,
    "role": "약화"
  },
  {
    "id": "eungga-c",
    "displayName": "작은 왕 응가",
    "name": "방석 왕좌 칙령",
    "description": "아군 전체에게 HP 5% 보호막을 부여하고, 가장 약한 아군은 5%를 추가로 받는다.",
    "cooldown": 4,
    "role": "방어"
  },
  {
    "id": "peach-c",
    "displayName": "복숭아 요정 피치",
    "name": "복숭아 씨앗탄",
    "description": "공격력 90% 피해와 씨앗을 남긴다. 다음 아군 공격 시 씨앗이 터져 45% 추가 피해를 준다.",
    "cooldown": 3,
    "role": "연계 공격"
  },
  {
    "id": "jandi-c",
    "displayName": "꽃피는 사슴 잔디",
    "name": "개울가 숨고르기",
    "description": "3턴간 아군 전체가 턴 시작 시 HP를 3%씩 회복한다.",
    "cooldown": 4,
    "role": "지속 회복"
  },
  {
    "id": "chuming-c",
    "displayName": "별빛 연습생 츄밍",
    "name": "원 라이트 리허설",
    "description": "아군 전체 공격력을 2턴간 8% 높이고 브레이크 피해를 4 높인다.",
    "cooldown": 4,
    "role": "지원"
  },
  {
    "id": "choonsik-c",
    "displayName": "배낭 여행가 춘식",
    "name": "배낭 어깨치기",
    "description": "공격력 120% 피해를 주고 자신에게 HP 5% 보호막을 부여한다.",
    "cooldown": 3,
    "role": "공격"
  },
  {
    "id": "coca-c",
    "displayName": "붉은 물새 코카",
    "name": "물수제비 돌진",
    "description": "공격력 45% 피해를 3회 준다. 모두 적중하면 자신의 다음 행동이 10% 빨라진다.",
    "cooldown": 3,
    "role": "연타 공격"
  },
  {
    "id": "pie-c",
    "displayName": "작은 제빵 마녀 파이",
    "name": "따끈한 한 조각",
    "description": "아군 1명의 HP를 10% 회복하고 공격력을 2턴간 10% 높인다.",
    "cooldown": 3,
    "role": "회복·지원"
  },
  {
    "id": "hoi-c",
    "displayName": "별을 줍는 토끼 호이",
    "name": "주운 별의 반짝임",
    "description": "공격력 100% 피해와 브레이크 피해 10을 주고 가장 약한 아군을 4% 회복한다.",
    "cooldown": 3,
    "role": "공격·회복"
  },
  {
    "id": "winter-u",
    "displayName": "첫눈의 온기 겨울",
    "name": "모피 망토의 품",
    "description": "아군 1명에게 HP 16% 보호막과 2턴간 피해 감소 12%를 부여한다.",
    "cooldown": 4,
    "role": "방어"
  },
  {
    "id": "kkamdung-u",
    "displayName": "골목의 달지기 깜둥",
    "name": "등불 사이의 눈빛",
    "description": "적이 받는 피해를 2턴간 12% 높이고 아군 전체 회피율을 1턴간 12% 높인다.",
    "cooldown": 4,
    "role": "지원·약화"
  },
  {
    "id": "nanche-u",
    "displayName": "맞물린 해답 난체",
    "name": "퍼즐 다리 완성",
    "description": "아군 전체에게 HP 9% 보호막을 부여한다. 보호막이 유지되는 동안 받는 브레이크 피해가 20% 감소한다.",
    "cooldown": 4,
    "role": "방어"
  },
  {
    "id": "rayeon-u",
    "displayName": "초승달의 서가 라연이",
    "name": "월광 서고 열람",
    "description": "아군 전체 쿨다운을 1턴 줄이고 2턴간 받는 회복량을 12% 높인다.",
    "cooldown": 5,
    "role": "지원"
  },
  {
    "id": "mango-u",
    "displayName": "과수원의 수호자 망고",
    "name": "잎날개 비막이",
    "description": "아군 전체에게 HP 10% 보호막을 부여하고 지속 피해를 2턴간 30% 줄인다.",
    "cooldown": 4,
    "role": "방어"
  },
  {
    "id": "morae-u",
    "displayName": "푸른 스카프의 길 모래",
    "name": "스카프 길잡이",
    "description": "아군 전체의 약화 효과를 1개씩 제거하고 회피율을 2턴간 10% 높인다.",
    "cooldown": 4,
    "role": "정화·지원"
  },
  {
    "id": "mond-u",
    "displayName": "새벽 탐사대 몬드",
    "name": "작은 새의 정찰",
    "description": "공격력 120% 피해와 브레이크 피해 22를 주고, 받는 브레이크 피해를 2턴간 5 높인다.",
    "cooldown": 4,
    "role": "브레이크"
  },
  {
    "id": "somfist-u",
    "displayName": "폭신한 정면돌파 솜주먹",
    "name": "솜구름 스트레이트",
    "description": "공격력 145% 피해를 준다. 보호막을 가진 적에게는 피해가 30% 증가한다.",
    "cooldown": 4,
    "role": "공격"
  },
  {
    "id": "shanghai-u",
    "displayName": "방파제의 맹세 상해",
    "name": "폭풍 앞의 발도",
    "description": "다음 공격을 도발하고 받는 피해를 30% 줄인다. 피격 후 공격력 75%로 반격한다.",
    "cooldown": 4,
    "role": "탱킹·반격"
  },
  {
    "id": "sseubi-u",
    "displayName": "먹구름 한 획 쓰비",
    "name": "먹빛 우산",
    "description": "아군 전체에게 HP 10% 보호막과 약화 저항 25%를 부여한다.",
    "cooldown": 4,
    "role": "방어"
  },
  {
    "id": "gyullak-u",
    "displayName": "상큼한 배달부 귤락",
    "name": "과수원 특급배송",
    "description": "아군 전체를 8% 회복하고 가장 약한 아군을 6% 추가 회복한다.",
    "cooldown": 4,
    "role": "회복"
  },
  {
    "id": "guma-u",
    "displayName": "붉은 부적의 밤 구마",
    "name": "삼연 화부",
    "description": "공격력 45% 피해를 3회 주고 적 공격력을 2턴간 10% 낮춘다.",
    "cooldown": 4,
    "role": "공격·약화"
  },
  {
    "id": "easy-u",
    "displayName": "옥상의 리듬 이지",
    "name": "루프탑 비트",
    "description": "아군 전체 스킬 피해를 2턴간 13% 높이고 다음 기본 공격에 40% 추가 피해를 부여한다.",
    "cooldown": 4,
    "role": "공격 지원"
  },
  {
    "id": "peach-u",
    "displayName": "봄바람의 우편 피치",
    "name": "꽃편지 배달",
    "description": "아군 1명을 14% 회복하고 모든 약화 효과를 제거한다. 제거할 효과가 없으면 4% 추가 회복한다.",
    "cooldown": 4,
    "role": "회복·정화"
  },
  {
    "id": "choonsik-u",
    "displayName": "소풍의 대장 춘식",
    "name": "다 함께 건너기",
    "description": "아군 전체가 받는 피해를 2턴간 14% 줄인다. 처음으로 HP가 50% 아래가 된 아군은 HP 6% 보호막을 얻는다.",
    "cooldown": 5,
    "role": "방어·지원"
  },
  {
    "id": "hoi-u",
    "displayName": "별길 안내인 호이",
    "name": "떨어진 별의 길",
    "description": "아군 전체를 8% 회복하고 2턴간 피해량과 회복량을 각각 8% 높인다.",
    "cooldown": 4,
    "role": "회복·지원"
  },
  {
    "id": "winter-r",
    "displayName": "빙정의 무도회 겨울",
    "name": "빙정 왈츠",
    "description": "공격력 140% 피해와 브레이크 피해 32를 준다. 이 공격으로 브레이크시키면 1턴간 빙결시킨다.",
    "cooldown": 4,
    "role": "브레이크·제어"
  },
  {
    "id": "kkamdung-r",
    "displayName": "월광 잠입자 깜둥",
    "name": "초승달 그림자 베기",
    "description": "공격력 180% 피해를 준다. 적에게 약화 효과가 있으면 피해가 25% 증가한다.",
    "cooldown": 4,
    "role": "공격"
  },
  {
    "id": "rayeon-r",
    "displayName": "달의 항해사 라연이",
    "name": "별바다의 조류",
    "description": "공격력 145% 피해를 주고 아군 전체에게 HP 8% 보호막을 부여한다.",
    "cooldown": 4,
    "role": "공격·방어"
  },
  {
    "id": "mango-r",
    "displayName": "태양잎 비행 망고",
    "name": "황금 잎날개 강하",
    "description": "공격력 175% 피해를 준다. 적의 HP가 50% 이상이면 50% 추가 피해를 준다.",
    "cooldown": 4,
    "role": "공격"
  },
  {
    "id": "morae-r",
    "displayName": "사막별 추적자 모래",
    "name": "청람 혜성 추적",
    "description": "공격력 145% 피해와 브레이크 피해 35를 주고, 받는 브레이크 피해를 2턴간 7 높인다.",
    "cooldown": 4,
    "role": "브레이크·약화"
  },
  {
    "id": "mond-r",
    "displayName": "미지의 유적 몬드",
    "name": "고대 수호문 개방",
    "description": "아군 전체에게 HP 14% 보호막을 부여한다. 보호막이 파괴되면 해당 아군을 5% 회복한다.",
    "cooldown": 5,
    "role": "방어·회복"
  },
  {
    "id": "shanghai-r",
    "displayName": "해류의 검무 상해",
    "name": "나선 해류참",
    "description": "공격력 190% 피해를 준다. 적이 브레이크 상태라면 45% 추가 피해를 준다.",
    "cooldown": 4,
    "role": "공격"
  },
  {
    "id": "guma-r",
    "displayName": "백호의 결계 구마",
    "name": "백호 수호진",
    "description": "아군 전체에게 HP 16% 보호막을 부여하고 약화 효과 1개씩을 제거한다.",
    "cooldown": 5,
    "role": "방어·정화"
  },
  {
    "id": "chuming-r",
    "displayName": "유성 데뷔 무대 츄밍",
    "name": "코멧 스테이지",
    "description": "공격력 155% 피해를 주고 아군 전체 공격력을 2턴간 14% 높인다.",
    "cooldown": 5,
    "role": "공격·지원"
  },
  {
    "id": "coca-r",
    "displayName": "붉은 항로 코카",
    "name": "선도 비행",
    "description": "아군 전체 피해량과 회피율을 2턴간 12% 높이고 적에게 브레이크 피해 8을 준다.",
    "cooldown": 4,
    "role": "지원"
  },
  {
    "id": "pie-r",
    "displayName": "달콤한 연금술 파이",
    "name": "캐러멜 연금진",
    "description": "공격력 105% 피해를 주고 적 공격력과 회복량을 2턴간 12% 낮춘다.",
    "cooldown": 4,
    "role": "공격·약화"
  },
  {
    "id": "hoi-r",
    "displayName": "혜성 배달부 호이",
    "name": "스타 익스프레스",
    "description": "공격력 180% 피해를 주고 다음 두 아군 공격에 25% 별빛 추가 피해를 부여한다.",
    "cooldown": 5,
    "role": "공격 지원"
  },
  {
    "id": "winter-rr",
    "displayName": "서리왕관의 서약 겨울",
    "name": "수정왕관의 칙령",
    "description": "자신에게 HP 30% 보호막을 부여하고 적의 다음 두 공격을 도발한다. 지속 중 아군 전체가 받는 피해가 15% 감소한다.",
    "cooldown": 4,
    "role": "탱킹"
  },
  {
    "id": "rayeon-rr",
    "displayName": "만월의 예언 라연이",
    "name": "호수에 비친 내일",
    "description": "적의 다음 공격 피해와 브레이크 피해를 50% 줄인다. 방어에 성공하면 다음 아군 스킬 효과량이 30% 증가한다.",
    "cooldown": 4,
    "role": "예측 지원"
  },
  {
    "id": "mango-rr",
    "displayName": "황금 수확제 망고",
    "name": "황금열매 나눔",
    "description": "아군 전체를 16% 회복하고 황금 열매 3개를 만든다. 이후 아군 턴마다 가장 약한 아군을 6% 회복한다.",
    "cooldown": 5,
    "role": "광역 회복"
  },
  {
    "id": "somfist-rr",
    "displayName": "빙하를 여는 주먹 솜주먹",
    "name": "빙문 개방권",
    "description": "공격력 170% 피해와 브레이크 피해 40을 준다. 브레이크시키면 아군 전체 쿨다운을 1턴 줄인다.",
    "cooldown": 3,
    "role": "브레이크"
  },
  {
    "id": "shanghai-rr",
    "displayName": "폭풍해의 결투 상해",
    "name": "갑판 위 일기토",
    "description": "적의 다음 두 공격을 도발하고 받는 피해를 35% 줄인다. 피격마다 공격력 80%와 브레이크 피해 10으로 반격한다.",
    "cooldown": 4,
    "role": "탱킹·반격"
  },
  {
    "id": "jandi-rr",
    "displayName": "사계의 정원 잔디",
    "name": "사계 순환",
    "description": "다음 네 번의 아군 행동에 봄의 전체 회복, 여름의 효과량 증가, 가을의 브레이크 추가, 겨울의 전체 보호막이 차례로 발동한다.",
    "cooldown": 6,
    "role": "순환형 지원"
  },
  {
    "id": "chuming-rr",
    "displayName": "은하수 앙코르 츄밍",
    "name": "별여우 앙코르",
    "description": "아군 1명이 액티브 스킬을 쓰면 흰 여우가 공격력 70%로 추격하고 해당 스킬의 쿨다운을 1턴 줄인다. 2턴 지속한다.",
    "cooldown": 4,
    "role": "공격 지원"
  },
  {
    "id": "hoi-rr",
    "displayName": "밤하늘 수선공 호이",
    "name": "금실 별자리 봉합",
    "description": "아군 1명을 25% 회복하고 약화 효과 1개를 제거하며 쿨다운을 1턴 줄인다.",
    "cooldown": 4,
    "role": "회복·정비"
  },
  {
    "id": "winter-rrr",
    "displayName": "백야의 심장 겨울",
    "name": "백야의 심장박동",
    "description": "아군 전체를 18% 회복하고 약화 효과를 1개씩 제거한다. 3턴 동안 각 아군이 처음 HP 50% 아래가 되면 12% 추가 회복한다.",
    "cooldown": 5,
    "role": "회복·정화"
  },
  {
    "id": "guma-rrr",
    "displayName": "천년 여우불 구마",
    "name": "백호야행 봉인진",
    "description": "적에게 봉인을 건다. 서로 다른 아군 3명이 공격하면 공격력 180% 피해와 브레이크 피해 30을 주고 다음 공격 피해를 25% 낮춘다.",
    "cooldown": 5,
    "role": "제어·브레이크"
  },
  {
    "id": "mond-rrr",
    "displayName": "세계수의 발견 몬드",
    "name": "세계수 정상의 항로",
    "description": "다음 세 아군 행동에 차례로 브레이크 피해 30 추가, 가장 약한 아군 15% 회복, 전체 쿨다운 1턴 감소를 부여한다.",
    "cooldown": 5,
    "role": "복합 지원"
  },
  {
    "id": "pie-rrr",
    "displayName": "별가루 만찬 파이",
    "name": "별가루 풀코스",
    "description": "전채로 전체 보호막 12%, 본식으로 전체 회복 15%, 디저트로 전체 효과량 25% 증가와 쿨다운 1턴 감소를 차례로 부여한다.",
    "cooldown": 0,
    "oncePerBattle": true,
    "role": "회복·강화"
  },
  {
    "id": "kkamdung-rrr",
    "displayName": "월식의 경계 깜둥",
    "name": "월식 경계선",
    "description": "적의 다음 두 공격 동안 아군 전체 피해를 30% 줄인다. 첫 단일 공격은 그림자가 대신 받아 완전히 막고 적 명중률을 낮춘다.",
    "cooldown": 5,
    "role": "방어·교란"
  },
  {
    "id": "hoi-rrr",
    "displayName": "천체의 문지기 호이",
    "name": "황금 성문 전이",
    "description": "아군 1명의 액티브 쿨다운을 초기화하고 70% 위력으로 즉시 한 번 행동시킨다.",
    "cooldown": 0,
    "oncePerBattle": true,
    "role": "행동 지원"
  },
  {
    "id": "winter-sr",
    "displayName": "얼어붙은 시간 겨울",
    "name": "빙점 정지",
    "description": "공격력 100% 피해와 브레이크 피해 25를 주고 다음 행동을 동결한다. 보스는 행동을 건너뛰는 대신 공격 피해가 30% 감소하고 받는 브레이크 피해가 35% 증가한다.",
    "cooldown": 0,
    "oncePerBattle": true,
    "role": "제어·브레이크"
  },
  {
    "id": "rayeon-sr",
    "displayName": "달의 군주 라연이",
    "name": "만월의 칙명",
    "description": "공격력 260% 피해를 주고 2턴간 적이 받는 피해를 18% 높인다.",
    "cooldown": 5,
    "role": "공격·약화"
  },
  {
    "id": "shanghai-sr",
    "displayName": "심해의 왕검 상해",
    "name": "왕검·심해 단층",
    "description": "공격력 240% 피해와 브레이크 피해 25를 준다. 브레이크 게이지가 절반 이하라면 피해가 80% 증가한다.",
    "cooldown": 4,
    "role": "마무리 공격"
  },
  {
    "id": "hoi-sr",
    "displayName": "태양별의 계승자 호이",
    "name": "태양별 초신성",
    "description": "공격력 220% 피해와 브레이크 피해 20을 주고 다음 두 아군 공격에 40% 추가 피해와 브레이크 피해 10을 부여한다.",
    "cooldown": 4,
    "role": "공격 지원"
  },
  {
    "id": "guma-hr",
    "displayName": "구미의 신탁 구마",
    "name": "구미신탁·길흉역전",
    "description": "아래 세 신탁 중 하나를 선택한다. - 길: 아군 전체 HP 18% 회복 및 약화 효과 1개씩 제거 - 흉: 공격력 220% 피해 및 브레이크 피해 25 - 역전: 아군 전체에게 HP 18% 보호막 및 쿨다운 1턴 감소",
    "cooldown": 5,
    "role": "선택형 만능"
  },
  {
    "id": "chuming-hr",
    "displayName": "초신성 피날레 츄밍",
    "name": "피날레 스타링",
    "description": "적의 다음 두 공격 동안 아군 피해를 35% 줄이고 감소시킨 피해를 저장한다. 종료 시 공격력 160% 피해와 저장 피해를 합쳐 반격한다.",
    "cooldown": 5,
    "role": "방어·폭발"
  },
  {
    "id": "mango-hr",
    "displayName": "황금 세계수룡 망고",
    "name": "세계수룡 강하",
    "description": "공격력 260% 피해와 브레이크 피해 35를 준다. 다음 적 공격을 25% 약화시키며, 이미 브레이크 상태라면 대신 아군 전체에게 HP 15% 보호막을 부여한다.",
    "cooldown": 4,
    "role": "공격·제어"
  },
  {
    "id": "winter-ur",
    "displayName": "영원의 백색 여왕 겨울",
    "name": "영원빙궁의 칙령",
    "description": "얼음 첨탑 3개를 세운다. 적 공격마다 하나를 소비해 아군 피해를 30% 줄이고 공격력 70% 피해와 브레이크 피해 10으로 반격한다. 남은 첨탑은 각각 아군 전체 회복 8%로 전환된다.",
    "cooldown": 0,
    "oncePerBattle": true,
    "role": "요새형 탱킹"
  },
  {
    "id": "hoi-ur",
    "displayName": "별의 탄생 호이",
    "name": "신생은하 육성",
    "description": "다음 세 아군 행동을 공격, 회복, 지원으로 기록한다. 가장 많이 기록된 행동에 따라 다음 효과 중 하나가 발동한다. - 공격: 공격력 320% 피해 및 브레이크 피해 30 - 회복: 아군 전체 HP 25% 회복 및 HP 15% 보호막 - 지원: 아군 전체 쿨다운 2턴 감소 및 적 피해량 2턴간 25% 감소 동률이면 플레이어가 효과를 직접 선택한다.",
    "cooldown": 0,
    "oncePerBattle": true,
    "role": "성장형 선택 지원"
  },
  {
    "id": "hoi-ssr",
    "displayName": "첫빛의 창세 호이",
    "name": "첫빛 재현",
    "description": "직전에 다른 아군이 사용한 일반 액티브 스킬을 85% 위력으로 재현한다. 전투당 1회 스킬, 부활, 추가 행동, 복제 효과는 복제할 수 없다.",
    "cooldown": 3,
    "role": "전략형 복제"
  },
  {
    "id": "coca-u",
    "displayName": "갈대연못의 길잡이 코카",
    "name": "갈대 사이 잔물결",
    "description": "아군 전체의 회피율을 2턴간 10%, 약화 효과 저항을 2턴간 18% 높인다.",
    "cooldown": 4,
    "role": "지원"
  },
  {
    "id": "coca-rr",
    "displayName": "윙크 웨이브 라이더 코카",
    "name": "윙크 웨이브",
    "description": "공격력 90% 피해를 2회 주고 브레이크 피해 24를 준다. 사용 직후 이 스킬의 쿨다운을 1턴 줄인다.",
    "cooldown": 4,
    "role": "공격·브레이크"
  },
  {
    "id": "coca-rrr",
    "displayName": "폭우의 물장막 코카",
    "name": "우산물막 전개",
    "description": "아군 전체에게 HP 15% 보호막을 부여하고 2턴간 받는 피해를 18% 줄인다.",
    "cooldown": 5,
    "role": "방어"
  },
  {
    "id": "coca-sr",
    "displayName": "달연꽃 치유사 코카",
    "name": "달연꽃 물방울",
    "description": "아군 전체의 HP를 18% 회복하고 약화 효과를 1개씩 제거한다. 다음 세 번의 아군 행동 시작마다 아군 전체 HP를 5% 회복한다.",
    "cooldown": 5,
    "role": "회복·지원"
  },
  {
    "id": "coca-hr",
    "displayName": "협곡폭포 급강하 코카",
    "name": "폭포선 수직돌파",
    "description": "공격력 95% 피해를 3회 주고 브레이크 피해 35를 준다. 2턴간 적이 받는 브레이크 피해를 25% 높인다.",
    "cooldown": 5,
    "role": "공격·브레이크"
  },
  {
    "id": "coca-ur",
    "displayName": "오로라 수평선의 순례자 코카",
    "name": "극광 수평선 행진",
    "description": "공격력 190% 피해와 브레이크 피해 15를 준다. 다음 네 번의 아군 공격에 공격력 50% 추가 피해와 브레이크 피해 8을 부여한다.",
    "cooldown": 6,
    "role": "공격 지원"
  },
  {
    "id": "coca-ssr",
    "displayName": "성하 프리즘 항해왕 코카",
    "name": "성하 프리즘 급류",
    "description": "공격력 210% 피해와 브레이크 피해 20을 준다. 이후 서로 다른 아군 3명이 공격하면 각 실제 피해의 20%를 저장하고, 세 번째 공격 뒤 공격력 280%와 저장 피해를 합친 피해 및 브레이크 피해 35를 준다.",
    "cooldown": 5,
    "role": "공격·연계"
  }
];

// Legacy collection cards remain playable while their future illustrated variants are planned.
const LEGACY_CARD_SKILLS = [
  { id: 'rookie-analyst', displayName: '눈치 빠른 신입사원', name: '긴급 Alt+Tab', description: '공격력 100% 피해와 브레이크 피해 10을 주고 자신의 회피율을 1턴간 15% 높인다.', cooldown: 3, role: '공격·회피' },
  { id: 'sales-fox', displayName: '영업 여우', name: '계약서의 빈칸', description: '공격력 110% 피해를 주고 적 공격력을 2턴간 10% 낮춘다.', cooldown: 3, role: '공격·약화' },
  { id: 'pantry-cat', displayName: '탕비실 고양이', name: '비상 간식 배급', description: '아군 전체 HP를 10% 회복하고 받는 회복량을 2턴간 10% 높인다.', cooldown: 4, role: '회복' },
  { id: 'peach-sentry', displayName: '피치전자 게이트 센트리', name: '출입 통제 장벽', description: '아군 전체에게 HP 12% 보호막을 부여하고 약화 효과 1개씩을 막는다.', cooldown: 4, role: '방어' },
  { id: 'hwang-manager', displayName: '야근하다 미쳐버린 황과장', name: '오늘 안에 끝냅시다', description: '공격력 180% 피해를 주고 아군 전체 공격력을 2턴간 12% 높인다.', cooldown: 4, role: '공격·지원' },
  { id: 'gammam-neo', displayName: '감맘 네오', name: '감자의 복수', description: '자신에게 HP 20% 보호막과 도발 2회를 부여하고 피격 시 공격력 65%로 반격한다.', cooldown: 4, role: '탱킹·반격' },
  { id: 'kim-manager', displayName: '대머리 김부장', name: '최종 결재 강타', description: '공격력 250% 피해와 브레이크 피해 25를 주고 적이 받는 피해를 2턴간 15% 높인다.', cooldown: 5, role: '공격·브레이크' },
  { id: 'deadline-dragon', displayName: '마감기한 드래곤', name: 'D-DAY 역산', description: '공격력 220% 피해와 브레이크 피해 30을 주고 적 공격력을 2턴간 15% 낮춘다.', cooldown: 5, role: '공격·제어' },
];

const clampStage = (stage) => Math.max(0, Math.min(5, Math.floor(Number(stage) || 0)));
const scaled = (value, stage) => Math.max(0, Math.round(Number(value) * (1 + SKILL_ENHANCEMENT_BONUSES[clampStage(stage)])));

/** Scale only effect magnitudes. Durations, hit counts, target counts and cooldowns stay stable. */
export function skillDescriptionAtEnhancement(skillOrId, enhancement = 0) {
  const skill = typeof skillOrId === 'string' ? CARD_SKILL_BY_ID[skillOrId] : skillOrId;
  if (!skill) return '';
  const stage = clampStage(enhancement);
  if (!stage) return skill.description;
  const protectedValues = [];
  const protectedDescription = skill.description.replace(/\d+%\s*(?:이상|이하|아래|초과)/g, (value) => {
    protectedValues.push(value);
    return `__SKILL_CONDITION_${protectedValues.length - 1}__`;
  });
  return protectedDescription
    .replace(/(\d+)%/g, (_, value) => `${scaled(value, stage)}%`)
    .replace(/(브레이크 피해(?:를)?\s*)(\d+)/g, (_, prefix, value) => `${prefix}${scaled(value, stage)}`)
    .replace(/__SKILL_CONDITION_(\d+)__/g, (_, index) => protectedValues[Number(index)]);
}

export function skillMagnitude(value, enhancement = 0) { return scaled(value, enhancement); }

export function cardSkillAtEnhancement(cardId, enhancement = 0) {
  const skill = CARD_SKILL_BY_ID[String(cardId || '')];
  if (!skill) return null;
  const stage = clampStage(enhancement);
  return { ...skill, enhancement: stage, magnitudeMultiplier: 1 + SKILL_ENHANCEMENT_BONUSES[stage], description: skillDescriptionAtEnhancement(skill, stage) };
}

export const CARD_SKILLS = Object.freeze([...RAW_CARD_SKILLS, ...LEGACY_CARD_SKILLS].map((skill) => Object.freeze({ ...skill, oncePerBattle: Boolean(skill.oncePerBattle) })));
export const CARD_SKILL_BY_ID = Object.freeze(Object.fromEntries(CARD_SKILLS.map((skill) => [skill.id, skill])));
