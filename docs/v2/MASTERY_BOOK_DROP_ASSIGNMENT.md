# V2 마스터리북 드랍 배정표

이 문서는 마스터리북을 드랍할 몬스터와 확률을 정하기 위한 편집용 표다.

- 생성된 마스터리북: **65종**
- 일반 몬스터: **20종**
- 필드보스: **1종**
- 마스터리북은 소비 아이템이며 한 칸에 1개만 보관된다.
- 20북은 기본 성공 확률 90%, 30북은 기본 성공 확률 70%다.
- 실패할 때마다 같은 캐릭터·스킬·단계의 다음 성공 확률이 1%p 증가한다.

## 몬스터 목록

| 레벨 | 몬스터 | ID | 분류 |
|---:|---|---|---|
| 3 | 서류 먼지뭉치 | `paper_dust` | 일반 |
| 10 | 도망친 스테이플러 | `runaway_stapler` | 일반 |
| 17 | 커피 얼룩 슬라임 | `coffee_slime` | 일반 |
| 24 | 회의실 생쥐 | `meeting_mouse` | 일반 |
| 31 | 야근 박쥐 | `overtime_bat` | 일반 |
| 38 | 급여대장 미믹 | `payroll_mimic` | 일반 |
| 45 | 감사실 유령 | `audit_ghost` | 일반 |
| 59 | 광고 카멜레온 | `ad_chameleon` | 일반 |
| 60 | 야근하다 미쳐버린 황과장 | `mad_hwang_manager` | 필드보스 |
| 62 | 영업 여우 | `sales_fox` | 일반 |
| 66 | 버그 딱정벌레 | `bug_beetle` | 일반 |
| 73 | 서버실 도깨비불 | `server_wisp` | 일반 |
| 80 | 시제품 골렘 | `prototype_golem` | 일반 |
| 87 | 컨베이어 게 | `conveyor_crab` | 일반 |
| 94 | 품질검사 거미 | `quality_spider` | 일반 |
| 101 | 물류창고 멧돼지 | `warehouse_boar` | 일반 |
| 108 | 시설관리 드론 | `facility_drone` | 일반 |
| 115 | 연구동 키메라 | `research_chimera` | 일반 |
| 122 | 임원실 사자 | `executive_lion` | 일반 |
| 131 | 무한야근 사신 | `overtime_reaper` | 일반 |
| 140 | 마감기한 드래곤 | `deadline_dragon` | 일반 |

## 마스터리북 배정

`드랍 몬스터`와 `확률` 칸을 수정해 주면 해당 값으로 드랍 테이블을 연결할 수 있다.

| 부서 | 스킬 | 20북 ID | 20북 드랍 몬스터 / 확률 | 30북 ID | 30북 드랍 몬스터 / 확률 |
|---|---|---|---|---|---|
| 인사팀 | 굳건한의지 | `mastery_book_firm_will_hr_20` | 미지정 | `mastery_book_firm_will_hr_30` | 미지정 |
| 인사팀 | 막았죠? | `mastery_book_blocked_it_20` | 미지정 | `mastery_book_blocked_it_30` | 미지정 |
| 인사팀 | 돌진 | `mastery_book_charge_hr_20` | 미지정 | `mastery_book_charge_hr_30` | 미지정 |
| 현장직 | 곰방 | `mastery_book_gombang_20` | 미지정 | `mastery_book_gombang_30` | 미지정 |
| 품질관리팀 | 단호함 | `mastery_book_firmness_20` | 미지정 | `mastery_book_firmness_30` | 미지정 |
| 회계팀 | 결산 충격파 | `mastery_book_extended_2926a732db_20` | 미지정 | `mastery_book_extended_2926a732db_30` | 미지정 |
| 회계팀 | 누적 관통결산 | `mastery_book_extended_cd94045605_20` | 미지정 | `mastery_book_extended_cd94045605_30` | 미지정 |
| 회계팀 | 오차 0원 | `mastery_book_extended_e9c47b999a_20` | 미지정 | `mastery_book_extended_e9c47b999a_30` | 미지정 |
| 마케팅팀 | 브랜드 파동 | `mastery_book_extended_2973270a08_20` | 미지정 | `mastery_book_extended_2973270a08_30` | 미지정 |
| 마케팅팀 | 실시간 광고 송출 | `mastery_book_extended_fc89f3cfc2_20` | 미지정 | `mastery_book_extended_fc89f3cfc2_30` | 미지정 |
| 영업팀 | 삼중 제안 | `mastery_book_extended_eb778160dd_20` | 미지정 | `mastery_book_extended_eb778160dd_30` | 미지정 |
| 개발팀 | 무한 리소스 | `mastery_book_extended_0dcef657e3_20` | 미지정 | `mastery_book_extended_0dcef657e3_30` | 미지정 |
| 개발팀 | 프로덕션 대폭발 | `mastery_book_extended_efc52e591a_20` | 미지정 | `mastery_book_extended_efc52e591a_30` | 미지정 |
| 연구팀 | 무한 동력 | `mastery_book_extended_69705b66e7_20` | 미지정 | `mastery_book_extended_69705b66e7_30` | 미지정 |
| 연구팀 | 기후 제어 실험 | `mastery_book_extended_5620bb5a09_20` | 미지정 | `mastery_book_extended_5620bb5a09_30` | 미지정 |
| 경영지원팀 | 무한 예산 | `mastery_book_extended_4d105c3f1f_20` | 미지정 | `mastery_book_extended_4d105c3f1f_30` | 미지정 |
| 경영지원팀 | 전사 비상지원 | `mastery_book_extended_aef3d1db17_20` | 미지정 | `mastery_book_extended_aef3d1db17_30` | 미지정 |
| 공통 7개 부서 | 전 직원 역량강화 | `mastery_book_extended_e76286335c_20` | 미지정 | 없음 | - |
| 회계팀 | 회계감사의 눈 | `mastery_book_extended_ccb060a442_20` | 미지정 | `mastery_book_extended_ccb060a442_30` | 미지정 |
| 마케팅팀 | 소비자 인사이트 | `mastery_book_extended_2dc9886c3e_20` | 미지정 | `mastery_book_extended_2dc9886c3e_30` | 미지정 |
| 영업팀 | 가짜 일정 | `mastery_book_extended_69a82b671f_20` | 미지정 | `mastery_book_extended_69a82b671f_30` | 미지정 |
| 영업팀 | 공개 경쟁입찰 | `mastery_book_extended_47cf15f1d3_20` | 미지정 | `mastery_book_extended_47cf15f1d3_30` | 미지정 |
| 시설관리팀 | 안전 대피 | `mastery_book_extended_403879a67d_20` | 미지정 | `mastery_book_extended_403879a67d_30` | 미지정 |
| 시설관리팀 | 위험구역 표식 | `mastery_book_extended_8bf14061cf_20` | 미지정 | `mastery_book_extended_8bf14061cf_30` | 미지정 |
| 시설관리팀 | 왕복 점검 | `mastery_book_extended_83bf2e5362_20` | 미지정 | `mastery_book_extended_83bf2e5362_30` | 미지정 |
| 개발팀 | 대규모 리팩터링 | `mastery_book_extended_b517ab1d69_20` | 미지정 | `mastery_book_extended_b517ab1d69_30` | 미지정 |
| 개발팀 | 오류 반환 | `mastery_book_extended_bb8a82a4b8_20` | 미지정 | `mastery_book_extended_bb8a82a4b8_30` | 미지정 |
| 연구팀 | 입자 가속 폭발 | `mastery_book_extended_2e29f80103_20` | 미지정 | `mastery_book_extended_2e29f80103_30` | 미지정 |
| 연구팀 | 에너지 역류 | `mastery_book_extended_c074142eb3_20` | 미지정 | `mastery_book_extended_c074142eb3_30` | 미지정 |
| 연구팀 | 연쇄 방전 | `mastery_book_extended_4561b07dd3_20` | 미지정 | `mastery_book_extended_4561b07dd3_30` | 미지정 |
| 경영지원팀 | 지원 예산 폭발 | `mastery_book_extended_72b5477b43_20` | 미지정 | `mastery_book_extended_72b5477b43_30` | 미지정 |
| 경영지원팀 | 민원 반송 | `mastery_book_extended_e3ac6849e3_20` | 미지정 | `mastery_book_extended_e3ac6849e3_30` | 미지정 |
| 경영지원팀 | 복지 방패 | `mastery_book_extended_7fbad835e4_20` | 미지정 | `mastery_book_extended_7fbad835e4_30` | 미지정 |
