const choice = (id, label, result, reward) => ({ id, label, result, reward });
const incident = (id, title, summary, choices, tier = 'ordinary') => ({ id, title, summary, choices, tier });

function freezeTree(value) {
  Object.values(value).forEach((child) => {
    if (child && typeof child === 'object') freezeTree(child);
  });
  return Object.freeze(value);
}

// Choices and rewards live here; popup messages only identify the selected choice.
export const INCIDENTS = freezeTree([
  incident('boss-footsteps', '복도에서 구두 소리가 들린다', '월루의 커피잔이 멈췄습니다. 팀장이 다가오기 전에 책상을 정리해야 합니다.', [
    choice('hide', '창을 접고 서류 정리', '흐트러진 서류까지 정리해 책상 관리 수당을 받았다.', { coins: 350 }),
    choice('report', '진행 보고서 펼치기', '준비된 보고서 덕분에 팀의 신뢰가 올랐다.', { coins: 180, linkPoints: 4 }),
  ]),
  incident('coffee-order', '단체 커피 주문이 시작됐다', '파이가 쓴 주문 쪽지가 바람에 섞였습니다. 메뉴와 이름을 다시 맞춰 주세요.', [
    choice('organize', '메뉴별로 주문 취합', '메뉴표를 완성하고 단체 주문 할인금을 챙겼다.', { coins: 420 }),
    choice('deliver', '동료 자리로 직접 배달', '커피를 따뜻하게 전달해 감사 인사를 받았다.', { coins: 190, linkPoints: 4 }),
  ]),
  incident('printer-jam', '복합기가 구조 신호를 보낸다', '쓰비의 삽화 원고가 복합기 속에서 종이 용으로 변하려 합니다.', [
    choice('repair', '종이 용을 달래서 꺼내기', '원고를 구해 인쇄 예산을 아꼈다.', { coins: 610 }),
    choice('call', '시설팀과 함께 분해하기', '시설팀에 문제 위치를 알려 협업 기록을 남겼다.', { coins: 260, linkPoints: 4 }),
  ]),
  incident('meeting-room-maze', '회의실 번호가 뒤섞였다', '난체가 옮긴 이름표 때문에 회의실 복도가 미로가 됐습니다.', [
    choice('map', '안내 지도를 그린다', '방문객이 무사히 도착해 안내 수당을 받았다.', { coins: 460 }),
    choice('escort', '참석자를 직접 안내한다', '회의 시작을 도와 부서 간 신뢰가 높아졌다.', { coins: 200, linkPoints: 5 }),
  ]),
  incident('spreadsheet-dragon', '합계 칸에서 꼬마 용이 튀어나왔다', '심심이가 졸다가 숫자 하나를 빠뜨렸습니다. 용은 합계가 맞아야 진정합니다.', [
    choice('formula', '수식을 다시 계산', '정확한 숫자에 만족한 용이 동전을 내려놓았다.', { coins: 560 }),
    choice('teach', '심심이와 검산 연습', '오류를 찾는 요령을 함께 익혀 업무 유대를 얻었다.', { coins: 230, linkPoints: 5 }),
  ]),
  incident('wandering-file', '최종 파일이 도망갔다', '최종_진짜최종 문서가 책상 밑으로 뛰어들었습니다. 꼬리를 잡을 기회입니다.', [
    choice('catch', '파일을 붙잡아 저장', '도망친 문서를 회수하고 복구 수당을 받았다.', { coins: 510 }),
    choice('rename', '버전 이름부터 정리', '문서 가족의 이름을 정리해 다음 혼란을 막았다.', { coins: 190, linkPoints: 6 }),
  ]),
  incident('pantry-duel', '간식 창고의 마지막 쿠키', '솜주먹과 춘식이 마지막 쿠키를 사이에 두고 눈치를 보고 있습니다.', [
    choice('split', '쿠키를 똑같이 나눈다', '서로 웃으며 간식을 나눠 우정 포인트를 모았다.', { coins: 180, linkPoints: 5 }),
    choice('bake', '남은 재료로 더 굽는다', '추가 쿠키를 사내 장터에 내놓아 수익을 냈다.', { coins: 440 }),
  ]),
  incident('elevator-riddle', '엘리베이터가 퀴즈를 낸다', '문이 열리려면 오늘의 사내 퀴즈에 답해야 합니다. 몬드가 힌트를 들고 있습니다.', [
    choice('solve', '힌트로 정답을 맞힌다', '정답 효과음과 함께 퀴즈 상금이 지급됐다.', { coins: 390 }),
    choice('stairs', '계단길을 함께 안내한다', '서두르는 동료에게 우회로를 알려 고마움을 샀다.', { coins: 170, linkPoints: 5 }),
  ]),
  incident('umbrella-garden', '우산꽂이에 작은 정원이 생겼다', '잔디가 젖은 우산에서 새싹을 발견했습니다. 퇴근길 통로가 좁아지고 있습니다.', [
    choice('pot', '새싹을 화분에 옮긴다', '총무팀이 사무실 조경 수당을 지급했다.', { coins: 380 }),
    choice('share', '동료들에게 새싹을 나눈다', '작은 초록 선물이 책상마다 자리를 잡았다.', { coins: 150, linkPoints: 5 }),
  ]),
  incident('sleepy-clock', '벽시계가 점심시간에 멈췄다', '시계 요정이 배가 고프다며 분침에 매달려 있습니다.', [
    choice('wind', '태엽을 고쳐 준다', '요정이 다시 일하며 수리비를 건넸다.', { coins: 470 }),
    choice('lunch', '점심 도시락을 나눈다', '함께 식사한 요정이 동료들에게 감사 소식을 전했다.', { coins: 210, linkPoints: 4 }),
  ]),
  incident('talking-plant', '회의실 화분이 발언권을 요구한다', '망고가 물을 주자 화분이 회의 진행에 대한 의견을 쏟아냅니다.', [
    choice('record', '개선안을 받아 적는다', '화분의 기발한 제안이 채택돼 아이디어 수당을 받았다.', { coins: 490 }),
    choice('listen', '끝까지 이야기를 듣는다', '말할 기회를 얻은 화분과 팀원들이 한결 편안해졌다.', { coins: 180, linkPoints: 6 }),
  ]),
  incident('lunch-vote', '점심 메뉴 투표가 동률이다', '라연이는 국수, 구마는 매운 덮밥을 골랐습니다. 투표판이 뜨거워집니다.', [
    choice('buffet', '반반 메뉴로 주문한다', '공동 주문 할인으로 점심 예산을 절약했다.', { coins: 430 }),
    choice('rotate', '오늘과 내일 순서를 정한다', '서로 양보하는 식사 약속이 생겼다.', { coins: 160, linkPoints: 6 }),
  ]),
  incident('calendar-blossom', '달력에서 벚꽃이 쏟아진다', '피치가 표시한 휴가 날짜가 꽃잎으로 변해 날아갑니다.', [
    choice('collect', '꽃잎 날짜를 모아 붙인다', '일정을 복원하고 일정 관리 수당을 받았다.', { coins: 400 }),
    choice('cover', '휴가 업무 인계를 돕는다', '동료가 편히 쉴 수 있도록 인계표를 완성했다.', { coins: 160, linkPoints: 5 }),
  ]),
  incident('paperplane-mail', '종이비행기 우편이 길을 잃었다', '코카가 날린 사내 우편이 천장 선풍기 주변을 빙빙 돌고 있습니다.', [
    choice('land', '안전하게 착륙시킨다', '중요 우편을 회수해 배달 보너스를 받았다.', { coins: 450 }),
    choice('route', '비행 경로를 다시 그린다', '코카가 새 우편 경로를 동료들과 공유했다.', { coins: 200, linkPoints: 4 }),
  ]),
  incident('chair-race', '의자 바퀴들이 출근 경주를 한다', '모래의 파란 스카프를 결승선 삼아 회전의자들이 복도를 달립니다.', [
    choice('brake', '바퀴 브레이크를 조인다', '충돌을 막아 시설 관리 보너스를 받았다.', { coins: 530 }),
    choice('lane', '빈 회의실로 코스를 옮긴다', '의자도 동료도 안전한 점심 놀이가 만들어졌다.', { coins: 240, linkPoints: 4 }),
  ]),
  incident('wifi-sparrow', '와이파이 참새가 둥지를 옮겼다', '인터넷 신호가 종이 더미 아래에서 짹짹거립니다.', [
    choice('router', '공유기 옆에 둥지를 만든다', '신호가 돌아와 통신 복구 수당을 챙겼다.', { coins: 570 }),
    choice('guide', '연결 방법 안내문을 붙인다', '동료들이 스스로 재접속할 수 있게 됐다.', { coins: 230, linkPoints: 5 }),
  ]),
  incident('whiteboard-tide', '화이트보드에 파도가 밀려온다', '상해가 그린 업무 흐름도가 푸른 바다가 됐습니다. 지워지기 전에 정리해야 합니다.', [
    choice('photo', '핵심 내용을 촬영한다', '보고 자료를 건져 내 기록 보존 수당을 받았다.', { coins: 480 }),
    choice('harbor', '아이디어를 항구별로 정리한다', '상해와 팀원들이 한눈에 보는 업무 지도를 완성했다.', { coins: 190, linkPoints: 6 }),
  ]),
  incident('copy-mirror', '복사본이 원본인 척한다', '거울 같은 복사기에서 동일한 결재 서류 둘이 서로 진짜라고 주장합니다.', [
    choice('stamp', '원본 도장을 확인한다', '중복 결재를 막아 검수 수당을 받았다.', { coins: 520 }),
    choice('archive', '사본 표시 규칙을 만든다', '모두가 알아볼 수 있는 문서 분류법을 남겼다.', { coins: 210, linkPoints: 5 }),
  ]),
  incident('fire-drill-phoenix', '소방 훈련에 작은 불사조가 왔다', '구마의 어깨에 앉은 불사조가 대피 안내를 도우려 합니다.', [
    choice('check', '대피 표지판을 점검한다', '가려진 표지를 찾아 안전 점검 수당을 받았다.', { coins: 420 }),
    choice('buddy', '처음 온 동료와 동행한다', '신입 동료가 안전하게 대피로를 익혔다.', { coins: 180, linkPoints: 5 }),
  ]),
  incident('cat-keyboard', '깜둥이 결재 버튼 위에서 잠들었다', '꼬리의 달빛이 키보드를 비춥니다. 서류는 아직 검토 중입니다.', [
    choice('cushion', '쿠션으로 조심히 옮긴다', '오결재를 막고 업무 복구 수당을 받았다.', { coins: 360 }),
    choice('review', '잠든 동안 동료와 재검토', '빠뜨린 항목을 함께 찾아 신뢰를 쌓았다.', { coins: 170, linkPoints: 4 }),
  ]),
  incident('sticky-note-flock', '메모지 무리가 이사를 시작했다', '붙여 둔 할 일들이 작은 노란 새가 되어 창가로 날아갑니다.', [
    choice('sort', '우선순위대로 둥지를 만든다', '급한 일을 놓치지 않아 정리 수당을 받았다.', { coins: 460 }),
    choice('board', '공용 업무판으로 초대한다', '서로의 일정을 볼 수 있는 게시판이 생겼다.', { coins: 200, linkPoints: 5 }),
  ]),
  incident('tea-cloud', '찻주전자에서 구름이 피어오른다', '겨울이 식힌 차가 너무 차가워 작은 눈구름이 생겼습니다.', [
    choice('bottle', '냉차로 병에 담는다', '사내 카페가 시원한 차를 매입했다.', { coins: 410 }),
    choice('warm', '따뜻한 물을 나누어 붓는다', '차 온도를 맞추며 동료들과 짧은 휴식을 나눴다.', { coins: 180, linkPoints: 4 }),
  ]),
  incident('courier-bridge', '택배 수레가 문턱을 못 넘는다', '상자 아래 작은 운반 골렘이 바퀴를 헛돌리고 있습니다.', [
    choice('ramp', '남은 판자로 경사로 제작', '수레를 움직여 운송 지원금을 받았다.', { coins: 550 }),
    choice('relay', '동료들과 릴레이 운반', '무거운 상자를 함께 나르며 팀워크를 다졌다.', { coins: 220, linkPoints: 5 }),
  ]),
  incident('birthday-candle', '생일 초가 소원을 까먹었다', '호이의 케이크 위 별 모양 초가 누구의 생일인지 묻고 있습니다.', [
    choice('decorate', '축하 문구를 직접 꾸민다', '멋진 장식을 완성해 행사 지원금을 받았다.', { coins: 370 }),
    choice('sing', '동료들과 축하 노래', '주인공에게 오래 기억할 합창을 선물했다.', { coins: 130, linkPoints: 6 }),
  ]),
  incident('nameplate-swap', '책상 이름표가 서로 바뀌었다', '난체의 퍼즐 조각이 이름표 글자를 뒤섞어 놓았습니다.', [
    choice('puzzle', '글자 퍼즐을 맞춘다', '이름을 복원해 정리 수당을 받았다.', { coins: 450 }),
    choice('introduce', '서로의 자리와 일을 소개한다', '낯선 부서 동료와 자연스럽게 인사를 나눴다.', { coins: 160, linkPoints: 6 }),
  ]),
  incident('cable-vines', '전선이 덩굴처럼 자랐다', '몬드가 책상 뒤에서 전선 숲의 입구를 발견했습니다.', [
    choice('label', '전선마다 이름표를 단다', '연결을 정리하고 장비 관리 수당을 받았다.', { coins: 590 }),
    choice('route', '공용 정리 지도를 만든다', '누구나 안전하게 장비를 연결할 수 있게 됐다.', { coins: 260, linkPoints: 5 }),
  ]),
  incident('keyboard-concert', '키보드가 타자 대신 노래한다', '이지의 헤드폰에서 새어 나온 리듬에 키들이 합창을 시작했습니다.', [
    choice('tune', '키 음정을 맞춰 정상화', '문서 입력이 돌아와 수리 수당을 받았다.', { coins: 440 }),
    choice('record', '짧은 휴식 음악을 녹음', '팀의 집중 시간용 음악을 함께 만들었다.', { coins: 170, linkPoints: 5 }),
  ]),
  incident('recycling-golem', '분리수거 골렘이 고민에 빠졌다', '종이컵 하나 때문에 골렘이 종이함과 일반함 사이를 오가고 있습니다.', [
    choice('sort', '표시를 확인해 직접 분류', '쌓인 쓰레기를 처리하고 정리 보너스를 받았다.', { coins: 340 }),
    choice('sign', '분리배출 안내를 그린다', '다음 동료도 쉽게 분류할 수 있게 됐다.', { coins: 140, linkPoints: 5 }),
  ]),
  incident('receipt-snow', '영수증이 눈처럼 내린다', '응가의 왕관에 붙은 영수증이 경비 정산함에서 증식하고 있습니다.', [
    choice('scan', '영수증을 스캔해 정산', '빠진 지출을 찾아 정산 포상금을 받았다.', { coins: 620 }),
    choice('coach', '동료에게 정산 방법 설명', '다음 달 서류가 줄어들도록 실용적인 요령을 나눴다.', { coins: 270, linkPoints: 5 }),
  ]),
  incident('aircon-snowman', '에어컨 아래 눈사람이 생겼다', '겨울을 닮은 눈사람이 온도 조절기를 지키고 있습니다.', [
    choice('adjust', '희망 온도를 모아 조정', '냉방 낭비를 줄여 절약 보너스를 받았다.', { coins: 410 }),
    choice('blanket', '추운 동료에게 담요 전달', '사무실 온도보다 따뜻한 배려를 나눴다.', { coins: 170, linkPoints: 5 }),
  ]),
  incident('bookshelf-stairs', '자료실 책장이 계단이 됐다', '모래가 높은 칸에서 필요한 업무 안내서를 발견했습니다.', [
    choice('retrieve', '사다리로 안내서를 꺼낸다', '필요한 자료를 찾아 자료실 수당을 받았다.', { coins: 430 }),
    choice('index', '책 위치 목록을 갱신한다', '모두가 안내서를 빨리 찾을 수 있게 됐다.', { coins: 190, linkPoints: 5 }),
  ]),
  incident('video-frog', '화상회의 화면에 개구리가 나타났다', '카메라 필터 요정이 발표자를 모두 개구리로 바꾸었습니다.', [
    choice('disable', '필터 설정을 되돌린다', '발표 화면을 복구해 진행 지원금을 받았다.', { coins: 480 }),
    choice('rehearse', '잠시 쉬며 발표 리허설', '긴장이 풀린 발표자가 자료를 차분히 설명했다.', { coins: 200, linkPoints: 5 }),
  ]),
  incident('stationery-market', '서랍 속 문구점이 문을 열었다', '귤락이 쓰지 않는 클립과 펜으로 교환 장터를 차렸습니다.', [
    choice('sell', '남는 문구를 장터에 낸다', '잠자던 물건이 필요한 자리를 찾아 수익이 생겼다.', { coins: 400 }),
    choice('donate', '신입 사원 세트로 나눈다', '첫 책상을 꾸릴 동료에게 환영 선물을 건넸다.', { coins: 160, linkPoints: 6 }),
  ]),
  incident('dust-bunnies', '먼지 토끼들이 복도를 막았다', '멍프가 청소 도구를 들고 왔지만 토끼들은 숨바꼭질을 시작했습니다.', [
    choice('sweep', '먼지를 한곳으로 모은다', '복도를 반짝이게 청소해 관리 수당을 받았다.', { coins: 460 }),
    choice('team', '팀별 청소 구역을 나눈다', '멍프와 동료들이 부담 없이 함께 청소했다.', { coins: 190, linkPoints: 5 }),
  ]),
  incident('desktop-aquarium', '상해의 모니터가 수족관이 됐다', '화면 속 물고기들이 보고서 그래프를 따라 헤엄치고 있습니다.', [
    choice('chart', '물고기로 그래프를 정리', '깔끔한 시각 자료가 완성돼 작업 수당을 받았다.', { coins: 520 }),
    choice('share', '쉬는 시간에 수족관 공개', '동료들이 잠시 물고기를 보며 기분을 환기했다.', { coins: 180, linkPoints: 6 }),
  ]),
  incident('window-rainbow', '창문에 작은 무지개가 걸렸다', '츄밍의 별 장식이 햇빛을 받아 회의 자료를 알록달록하게 비춥니다.', [
    choice('shade', '햇빛 방향을 조절한다', '자료를 읽기 쉽게 만들어 회의 지원금을 받았다.', { coins: 350 }),
    choice('photo', '팀 기념사진을 찍는다', '무지개 아래 남긴 사진이 공용 게시판을 채웠다.', { coins: 130, linkPoints: 6 }),
  ]),
  incident('supply-lockbox', '비품함이 암호를 요구한다', '상자 뚜껑에 이번 주 회의 요약 세 단어가 떠올랐습니다.', [
    choice('decode', '회의록에서 암호를 찾는다', '비품을 꺼내고 기록 활용 보너스를 받았다.', { coins: 510 }),
    choice('ask', '참석자와 기억을 모은다', '회의 내용을 함께 되짚으며 업무 이해를 높였다.', { coins: 220, linkPoints: 5 }),
  ]),
  incident('lost-mug', '월루의 머그컵이 여행을 떠났다', '커피 얼룩이 복도에 작은 발자국처럼 이어져 있습니다.', [
    choice('track', '발자국을 따라 컵을 찾는다', '회의실에서 컵을 회수하고 사례금을 받았다.', { coins: 330 }),
    choice('announce', '분실물 게시판을 정리한다', '컵과 함께 여러 동료의 잃어버린 물건이 돌아왔다.', { coins: 120, linkPoints: 6 }),
  ]),
  incident('rubber-stamp', '결재 도장이 스스로 춤춘다', '종이를 가리지 않고 도장을 찍으려는 작은 도깨비가 보입니다.', [
    choice('ink', '잉크 뚜껑을 닫아 진정', '불필요한 도장을 막아 문서 검수비를 받았다.', { coins: 470 }),
    choice('queue', '검토 완료 문서만 줄 세우기', '도깨비와 함께 안전한 결재 순서를 만들었다.', { coins: 200, linkPoints: 5 }),
  ]),
  incident('monday-slime', '월요일 슬라임이 의자에 붙었다', '심심이와 슬라임이 나란히 하품합니다. 업무 목록이 아직 비어 있습니다.', [
    choice('small', '작은 업무부터 하나 완료', '시동이 걸린 슬라임이 첫 업무 보너스를 건넸다.', { coins: 380 }),
    choice('buddy', '동료와 오늘 할 일 약속', '서로 응원할 짝을 정해 하루의 리듬을 찾았다.', { coins: 150, linkPoints: 5 }),
  ]),
  incident('snack-queue', '자판기 줄이 원을 그렸다', '망고와 귤락이 선 줄이 다시 처음 자리로 돌아오고 있습니다.', [
    choice('numbers', '대기 번호표를 나눠 준다', '주문 흐름을 바로잡아 운영 수당을 받았다.', { coins: 410 }),
    choice('group', '메뉴를 모아 한 번에 구매', '동료들이 줄 대신 휴식을 택할 수 있게 됐다.', { coins: 170, linkPoints: 5 }),
  ]),
  incident('folder-bridge', '폴더 사이에 종이 다리가 생겼다', '몬드가 부서 공유 폴더를 잇는 다리에서 누락 자료를 발견했습니다.', [
    choice('restore', '누락 자료를 복원한다', '자료 전달을 마무리해 복구 수당을 받았다.', { coins: 580 }),
    choice('permissions', '함께 접근 권한을 확인한다', '담당자들이 필요한 자료를 안전하게 공유하게 됐다.', { coins: 240, linkPoints: 5 }),
  ]),
  incident('newsletter-owl', '사내 소식지 부엉이가 도착했다', '부엉이의 빈 기사 칸에 오늘 있었던 일을 적어야 합니다.', [
    choice('tip', '업무 절약 요령을 기고', '실용적인 기사로 원고료를 받았다.', { coins: 440 }),
    choice('thanks', '도와준 동료를 소개', '작은 도움들이 사내 소식지의 첫 면을 장식했다.', { coins: 140, linkPoints: 7 }),
  ]),
  incident('quiet-hour', '고요한 시간이 찾아왔다', '이지가 헤드폰을 내려놓자 사무실 소음이 잠시 별빛 속으로 사라졌습니다.', [
    choice('focus', '미뤄 둔 업무를 마친다', '집중해서 일을 끝내고 완료 수당을 받았다.', { coins: 500 }),
    choice('checkin', '지친 동료의 일을 나눈다', '조용한 배려로 동료의 마감을 함께 넘겼다.', { coins: 180, linkPoints: 7 }),
  ]),
  incident('mystery-package', '수취인 없는 별무늬 택배', '총무팀 확인을 마친 행사 경품 상자입니다. 팩과 교환 수당 중 하나를 고를 수 있습니다.', [
    choice('open', '봉인된 카드팩 받기', '별무늬 포장에서 미개봉 카드팩 1개를 받았다.', { packs: 1 }),
    choice('return', '행사 수당으로 교환', '카드팩 대신 행사 수당을 지갑에 넣었다.', { coins: 1600 }),
  ], 'special'),
  incident('meteor-parking', '주차장에 별똥별이 내려앉았다', '호이가 작은 운석을 지키고 있습니다. 표면에는 카드 봉투와 동전 문양이 보입니다.', [
    choice('pack', '카드 문양을 비춘다', '운석이 펼쳐지며 별빛 카드팩 1개를 남겼다.', { packs: 1 }),
    choice('coin', '동전 문양을 두드린다', '운석에서 떨어진 황금 가루를 교환했다.', { coins: 1900 }),
  ], 'special'),
  incident('golden-elevator-ticket', '황금 승강기표를 발견했다', '평소에는 없는 축제층 버튼이 빛납니다. 표에는 경품 또는 봉사석 중 하나를 고르라고 적혀 있습니다.', [
    choice('prize', '경품석으로 올라간다', '축제 안내원이 입장 선물로 카드팩 1개를 건넸다.', { packs: 1 }),
    choice('volunteer', '봉사석에서 행사를 돕는다', '행사 수당과 함께 특별 감사 기록을 받았다.', { coins: 900, linkPoints: 18 }),
  ], 'special'),
  incident('time-flea-market', '오래된 회의실에 시간 장터가 열렸다', '라연이가 과거의 기념품과 미래의 빈 봉투를 진열하고 있습니다.', [
    choice('future', '미래의 봉투를 고른다', '봉투가 현재에 도착하며 카드팩 1개로 채워졌다.', { packs: 1 }),
    choice('past', '추억의 배지를 정리한다', '배지 교환 수익과 오랜 동료의 인사를 얻었다.', { coins: 1100, linkPoints: 12 }),
  ], 'special'),
  incident('moonlit-cat-post', '깜둥의 달빛 우체국', '꼬리 끝 초승달 아래 두 봉투가 떠 있습니다. 한 봉투만 오늘 배달할 수 있습니다.', [
    choice('sealed', '두툼한 봉투를 받는다', '달빛 봉투 안에서 카드팩 1개를 발견했다.', { packs: 1 }),
    choice('letter', '동료들의 감사 편지를 받는다', '따뜻한 편지와 우체국 사례금을 함께 받았다.', { coins: 700, linkPoints: 22 }),
  ], 'special'),
  incident('foxfire-workshop', '구마의 여우불 공방', '파손된 별 장식을 여우불로 수리하면 공방의 감사 선물을 고를 수 있습니다.', [
    choice('chest', '수리 보상 상자를 연다', '완성된 장식 옆에 카드팩 1개가 놓였다.', { packs: 1 }),
    choice('forge', '남은 장식도 함께 수리한다', '공방 작업 수당과 협업 감사 기록을 받았다.', { coins: 1400, linkPoints: 10 }),
  ], 'special'),
  incident('hidden-garden-map', '몬드가 비밀 정원 지도를 펼쳤다', '서류 숲 너머에서 보물 길과 정원 관리인의 집으로 이어지는 갈림길이 나타났습니다.', [
    choice('treasure', '보물 표시를 따라간다', '꽃잎으로 봉인된 카드팩 1개를 찾았다.', { packs: 1 }),
    choice('gardener', '관리인의 밀린 일을 돕는다', '정원을 돌보고 탐험 수당을 받았다.', { coins: 1800, linkPoints: 4 }),
  ], 'special'),
  incident('card-rain', '지붕 아래 카드 봉투 비가 내린다', '코카가 비에 젖지 않은 봉투를 발견했습니다. 남은 봉투는 행사장으로 보내야 합니다.', [
    choice('keep', '배정된 봉투 하나를 받는다', '행사 명부에 수령을 기록하고 카드팩 1개를 챙겼다.', { packs: 1 }),
    choice('deliver', '행사장까지 모두 운반한다', '깔끔한 배달로 특별 운송비를 받았다.', { coins: 2000 }),
  ], 'special'),
  incident('thank-you-vault', '감사함의 숨은 서랍이 열렸다', '동료들이 모은 감사 메모 뒤에 이달의 특별 선물이 놓여 있습니다.', [
    choice('gift', '기념 카드팩을 받는다', '축하 메모와 함께 카드팩 1개를 받았다.', { packs: 1, linkPoints: 5 }),
    choice('team', '팀 간식 행사로 바꾼다', '간식 행사를 마치고 남은 예산과 감사 기록을 받았다.', { coins: 1000, linkPoints: 18 }),
  ], 'special'),
  incident('puzzle-safe', '난체가 별무늬 금고를 맞췄다', '마지막 퍼즐 조각은 당신 몫입니다. 끼우는 방향에 따라 열리는 서랍이 달라집니다.', [
    choice('star', '별 조각을 위로 끼운다', '별 서랍에서 카드팩 1개가 미끄러져 나왔다.', { packs: 1 }),
    choice('sun', '해 조각을 위로 끼운다', '해 서랍에서 반짝이는 동전 꾸러미를 꺼냈다.', { coins: 2100 }),
  ], 'special'),
  incident('winter-aurora', '겨울이 옥상에 오로라를 불렀다', '오로라가 마지막으로 두 번 반짝입니다. 빛을 담거나 관측 기록을 완성할 수 있습니다.', [
    choice('light', '오로라 빛을 봉투에 담는다', '빛이 접혀 카드팩 1개로 변했다.', { packs: 1 }),
    choice('research', '관측 결과를 팀과 정리한다', '희귀 관측 자료로 연구 지원금과 유대를 얻었다.', { coins: 1500, linkPoints: 8 }),
  ], 'special'),
  incident('orchard-festival', '망고와 귤락의 수확 축제', '사내 정원에 단 하루 열리는 과일 축제입니다. 우승 경품과 진행 지원금 중 하나를 받을 수 있습니다.', [
    choice('contest', '과일 바구니 대회에 참여', '정성껏 꾸민 바구니로 경품 카드팩 1개를 받았다.', { packs: 1 }),
    choice('host', '춘식과 축제 진행을 맡는다', '축제를 무사히 마치고 진행비를 정산받았다.', { coins: 1700, linkPoints: 6 }),
  ], 'special'),
  incident('midnight-star-train', '별빛 급행열차의 임시 정차', '존재하지 않던 승강장에 우주 열차가 도착했습니다. 차장은 오늘의 초대석 하나를 내밉니다.', [
    choice('observatory', '별자리 관측칸에 탑승', '은하를 한 바퀴 돌아 기념 카드팩 2개를 받았다.', { packs: 2 }),
    choice('dining', '동료들을 위한 만찬을 준비', '열차 만찬을 도와 특별 수당과 큰 감사를 받았다.', { coins: 3400, linkPoints: 30 }),
  ], 'mythic'),
  incident('world-tree-ledger', '잔디의 세계수 장부가 깨어났다', '작은 화분 뿌리가 별들 사이로 뻗었습니다. 장부는 새로운 이야기와 오래된 약속 중 하나를 묻습니다.', [
    choice('story', '새로운 이야기를 적는다', '세계수가 새 장을 펼쳐 카드팩 2개를 맺었다.', { packs: 2, linkPoints: 8 }),
    choice('promise', '동료와의 약속을 기록한다', '약속의 열매를 나누고 세계수의 감사금을 받았다.', { coins: 3000, linkPoints: 42 }),
  ], 'mythic'),
  incident('deadline-dragon-truce', '마감 드래곤이 휴전 문서를 보냈다', '드래곤은 오늘만 업무를 쉬겠다고 합니다. 보물 분배와 동료 지원 중 휴전 조건을 정해 주세요.', [
    choice('treasure', '보물 창고를 공동 개방', '휴전 보물로 카드팩 2개와 정산금을 받았다.', { packs: 2, coins: 600 }),
    choice('rescue', '밀린 업무를 함께 해결', '드래곤과 힘을 합쳐 특별 완료 수당을 받았다.', { coins: 4400, linkPoints: 18 }),
  ], 'mythic'),
  incident('constellation-stage', '츄밍의 은하 앙코르 무대', '별빛 여우가 사무실을 작은 공연장으로 바꿉니다. 오늘의 앙코르를 완성할 역할을 고르세요.', [
    choice('encore', '호이와 별빛 응원봉을 든다', '공연을 완성한 관객 선물로 카드팩 2개를 받았다.', { packs: 2, linkPoints: 12 }),
    choice('crew', '파이와 무대 뒤를 돕는다', '완벽한 공연 뒤에서 제작 수당과 감사 기록을 받았다.', { coins: 3800, linkPoints: 28 }),
  ], 'mythic'),
]);

const INCIDENT_LOOKUP = new Map(INCIDENTS.map((entry) => [entry.id, entry]));
export const incidentById = (id) => INCIDENT_LOOKUP.get(id) || null;
