'use strict';

const { SKILL_DEFINITIONS } = require('../skills/skillDefinitions');

const questsByNpc = new Map();

function objective(type, targetName, required, options = {}) {
  return Object.freeze({
    id: String(options.id || `${type}_${targetName}_${required}`),
    type,
    targetName,
    required: Math.max(1, Math.floor(Number(required) || 1)),
    targetIds: Object.freeze([...(options.targetIds || [])]),
    mapIds: Object.freeze([...(options.mapIds || [])]),
    ...options,
    targetIds: Object.freeze([...(options.targetIds || [])]),
    mapIds: Object.freeze([...(options.mapIds || [])])
  });
}

function addQuest({
  id,
  npcId,
  departmentId,
  title,
  objectives,
  prerequisiteQuestIds = [],
  skillId = '',
  cap = 0,
  dialogue = '',
  minimumAdvancementTier = 4
}) {
  const definition = skillId ? SKILL_DEFINITIONS[skillId] : null;
  if (skillId && (!definition || !definition.departments.includes(departmentId))) {
    throw new Error(`스킬 해금 퀘스트 설정 오류: ${departmentId}/${skillId}`);
  }
  const resolvedCap = definition
    ? Math.min(definition.maxLevel, Math.max(0, Math.floor(Number(cap) || 0)))
    : 0;
  const skillUnlock = definition && resolvedCap > 0 ? Object.freeze({
    skillId,
    departmentId,
    cap: resolvedCap,
    skillName: definition.name
  }) : null;
  const displayTitle = skillUnlock
    ? `[${skillUnlock.skillName} Lv.${skillUnlock.cap} 해금] ${title}`
    : title;
  const quest = Object.freeze({
    id,
    title: displayTitle,
    category: 'skill',
    skillUnlock,
    type: objectives[0].type,
    targetId: objectives[0].targetIds[0] || objectives[0].mapIds[0] || '',
    targetName: objectives.map((entry) => entry.targetName).join(' · '),
    required: objectives.reduce((sum, entry) => sum + entry.required, 0),
    objectives: Object.freeze(objectives),
    dialogue: dialogue || `${title} 업무를 마치면 ${skillUnlock?.skillName || '새로운 스킬'} Lv.${skillUnlock?.cap || 1} 단계가 승인됩니다.`,
    repeat: 'once',
    departments: Object.freeze([departmentId]),
    minimumAdvancementTier,
    prerequisiteQuestIds: Object.freeze([...prerequisiteQuestIds]),
    rewards: Object.freeze({
      exp: 0,
      money: 0,
      items: Object.freeze([]),
      randomItems: Object.freeze([]),
      huntingMinutes: 0,
      skillUnlocks: Object.freeze(skillUnlock ? [skillUnlock] : [])
    })
  });
  if (!questsByNpc.has(npcId)) questsByNpc.set(npcId, []);
  questsByNpc.get(npcId).push(quest);
  return quest.id;
}

function addStagedChain({
  prefix,
  npcId,
  departmentId,
  skillId,
  baseTitle,
  baseObjectives,
  stage20Title,
  stage20Objectives,
  stage30Title,
  stage30Objectives,
  finalCap,
  dialogue
}) {
  const baseId = addQuest({
    id: `${prefix}_10`, npcId, departmentId, skillId, cap: 10,
    title: baseTitle, objectives: baseObjectives, dialogue
  });
  const maxLevel = SKILL_DEFINITIONS[skillId].maxLevel;
  if (maxLevel <= 10) return [baseId];
  const secondCap = Math.min(20, maxLevel);
  const secondId = addQuest({
    id: `${prefix}_${secondCap}`, npcId, departmentId, skillId, cap: secondCap,
    title: stage20Title, objectives: stage20Objectives,
    prerequisiteQuestIds: [baseId], dialogue
  });
  if (maxLevel <= 20) return [baseId, secondId];
  const lastCap = Math.min(maxLevel, finalCap || maxLevel);
  const lastId = addQuest({
    id: `${prefix}_${lastCap}`, npcId, departmentId, skillId, cap: lastCap,
    title: stage30Title, objectives: stage30Objectives,
    prerequisiteQuestIds: [secondId], dialogue
  });
  return [baseId, secondId, lastId];
}

function skillUse(skillId, required, name = '스킬 실전 사용') {
  return objective('skill-use', name, required, { targetIds: [skillId] });
}

function genericFollowUps(skillId, labels = ['숙련 시험', '최종 승인']) {
  return [
    [labels[0], [skillUse(skillId, 100)]],
    [labels[1], [skillUse(skillId, 300)]]
  ];
}

function addGenericChain(config) {
  const followUps = genericFollowUps(config.skillId, config.followUpTitles);
  return addStagedChain({
    ...config,
    stage20Title: followUps[0][0],
    stage20Objectives: followUps[0][1],
    stage30Title: followUps[1][0],
    stage30Objectives: followUps[1][1]
  });
}

const COMMON_MENTAL_SKILL = 'extended_b067160f36';
const COMMON_MENTAL_QUEST_NPCS = Object.freeze({
  accounting: 'accounting_nanche',
  marketing: 'brand_rayon',
  sales: 'sales_neo',
  facilities: 'facility_kim',
  development: 'dev_potato',
  research: 'research_simmi',
  management_support: 'lobby_peach'
});

for (const [departmentId, npcId] of Object.entries(COMMON_MENTAL_QUEST_NPCS)) {
  const prefix = `skill_${departmentId}_mental_focus`;
  const first = addQuest({
    id: `${prefix}_visit`, npcId, departmentId, title: '임원 호출',
    objectives: [objective('visit', '임원 전략회의층 방문', 1, {
      mapIds: ['executive_strategy']
    })]
  });
  const second = addQuest({
    id: `${prefix}_survival`, npcId, departmentId, title: '정신력 검증',
    objectives: [objective('kill', '사망하지 않고 몬스터 처치', 100, {
      noDeath: true
    })],
    prerequisiteQuestIds: [first]
  });
  addQuest({
    id: `${prefix}_boss`, npcId, departmentId, title: '끝나지 않은 회의',
    objectives: [objective('boss', '야근하다 미쳐버린 황과장 처치 기여', 1, {
      targetIds: ['mad_hwang_manager']
    })],
    prerequisiteQuestIds: [second],
    skillId: COMMON_MENTAL_SKILL,
    cap: 10
  });
}

// 인사팀
addQuest({
  id: 'skill_hr_firm_will_10', npcId: 'talent_meong', departmentId: 'hr',
  title: '흔들리지 않는 결재선', skillId: 'firm_will_hr', cap: 10,
  objectives: [
    objective('visit', '임원 전략회의층 방문', 1, { mapIds: ['executive_strategy'] }),
    objective('kill', '야근 몬스터 처치', 200, {
      targetIds: ['overtime_bat', 'overtime_reaper']
    })
  ]
});
addQuest({
  id: 'skill_hr_blocked_10', npcId: 'interview_ssubari', departmentId: 'hr',
  title: '방패 없는 방어 면접', skillId: 'blocked_it', cap: 10,
  objectives: [objective('hit-survive', '사망하지 않고 피격 후 생존', 500, { noDeath: true })]
});
addQuest({
  id: 'skill_hr_charge_10', npcId: 'talent_meong', departmentId: 'hr',
  title: '밀린 결재를 밀어붙여라', skillId: 'charge_hr', cap: 10,
  objectives: [objective('kill', '물류창고 멧돼지 처치', 400, {
    targetIds: ['warehouse_boar']
  })]
});
const rage10 = addQuest({
  id: 'skill_hr_true_rage_10', npcId: 'overtime_winter', departmentId: 'hr',
  title: '참을 만큼 참았다', skillId: 'true_rage', cap: 10,
  objectives: [objective('boss', '야근하다 미쳐버린 황과장 처치 기여', 1, {
    targetIds: ['mad_hwang_manager']
  })]
});
const rage20 = addQuest({
  id: 'skill_hr_true_rage_20', npcId: 'overtime_winter', departmentId: 'hr',
  title: '분노 관리 실패', skillId: 'true_rage', cap: 20,
  objectives: [objective('combo-gain', '콤보 누적 생성', 300)], prerequisiteQuestIds: [rage10]
});
addQuest({
  id: 'skill_hr_true_rage_30', npcId: 'overtime_winter', departmentId: 'hr',
  title: '최종 면담', skillId: 'true_rage', cap: 30,
  objectives: [objective('boss-combo', '콤보 10개를 소비한 공격으로 보스 처치 기여', 1, {
    minimumCombo: 10
  })], prerequisiteQuestIds: [rage20]
});

// 현장직
addGenericChain({
  prefix: 'skill_field_firm_will', npcId: 'production_morae', departmentId: 'field_operations',
  skillId: 'firm_will_hr', baseTitle: '작업중 흔들림 금지',
  baseObjectives: [objective('kill', '생산라인 몬스터 처치', 200, { mapIds: ['production_line'] })],
  followUpTitles: ['안전모 고정 시험', '무진동 작업 인증']
});
addStagedChain({
  prefix: 'skill_field_blocked', npcId: 'facility_kim', departmentId: 'field_operations',
  skillId: 'blocked_it', baseTitle: '안전수칙 제1조',
  baseObjectives: [objective('hit-survive', '사망하지 않고 피격 후 생존', 500, { noDeath: true })],
  stage20Title: '보호구 점검',
  stage20Objectives: [objective('block', '막았죠?로 피해 차단', 100)],
  stage30Title: '완전 차단',
  stage30Objectives: [objective('block', '막았죠?로 피해 차단', 300)]
});
addGenericChain({
  prefix: 'skill_field_charge', npcId: 'production_morae', departmentId: 'field_operations',
  skillId: 'charge_hr', baseTitle: '막힌 라인을 뚫어라',
  baseObjectives: [objective('kill', '생산·물류 몬스터 처치', 400, {
    mapIds: ['production_line', 'logistics_warehouse']
  })], followUpTitles: ['공정 단축', '전 라인 관통']
});
addStagedChain({
  prefix: 'skill_field_holy', npcId: 'facility_kim', departmentId: 'field_operations',
  skillId: 'element_holy', baseTitle: '야간 라인의 빛',
  baseObjectives: [objective('collect', '언데드 몬스터 전리품 수집', 150, {
    targetIds: [
      'monster_loot_overtime_bat', 'monster_loot_audit_ghost',
      'monster_loot_server_wisp', 'monster_loot_quality_spider',
      'monster_loot_overtime_reaper'
    ]
  })],
  stage20Title: '성속성 품질 인증',
  stage20Objectives: [objective('element-kill', '성 속성으로 언데드 처치', 150, {
    element: 'holy', undeadOnly: true
  })]
});
addQuest({
  id: 'skill_field_gombang_10', npcId: 'production_morae', departmentId: 'field_operations',
  title: '한 번에 옮기기', skillId: 'gombang', cap: 10,
  objectives: [objective('collect', '무거운 불량 부품 수집', 200, {
    targetIds: ['monster_loot_prototype_golem']
  })]
});

// 품질관리팀
addGenericChain({
  prefix: 'skill_quality_firm_will', npcId: 'quality_neo', departmentId: 'quality',
  skillId: 'firm_will_quality', baseTitle: '불량률 0%의 자세',
  baseObjectives: [objective('kill', '품질검사 거미 처치', 300, { targetIds: ['quality_spider'] })],
  followUpTitles: ['재검사', '최종 승인']
});
addGenericChain({
  prefix: 'skill_quality_charge', npcId: 'quality_neo', departmentId: 'quality',
  skillId: 'charge_quality', baseTitle: '검사 대기열 정리',
  baseObjectives: [objective('kill', '물류·품질 몬스터 처치', 200, {
    mapIds: ['quality_lab', 'logistics_warehouse']
  })], followUpTitles: ['표본 회수', '전수검사']
});
addQuest({
  id: 'skill_quality_firmness_10', npcId: 'quality_neo', departmentId: 'quality',
  title: '반려 사유: 전부', skillId: 'firmness', cap: 10,
  objectives: [objective('kill', '체력 50% 이하 상태로 몬스터 처치', 150, {
    maxHpPercent: 50
  })]
});
addStagedChain({
  prefix: 'skill_quality_companion_heal', npcId: 'research_simmi', departmentId: 'quality',
  skillId: 'companion_heal', baseTitle: '작은 동반자의 응급처치',
  baseObjectives: [objective('skill-use', '작은 동반자 소환', 100, {
    targetIds: ['small_companion']
  })],
  stage20Title: '회복 관찰일지',
  stage20Objectives: [objective('companion-heal', '동반자 회복 발동', 100)],
  stage30Title: '장기 관찰 승인',
  stage30Objectives: [objective('companion-heal', '동반자 회복 발동', 300)],
  finalCap: 25
});
addStagedChain({
  prefix: 'skill_quality_companion_buff', npcId: 'research_simmi', departmentId: 'quality',
  skillId: 'companion_buff', baseTitle: '작은 동반자의 첫 업무',
  baseObjectives: [objective('skill-use', '작은 동반자 소환', 100, {
    targetIds: ['small_companion']
  })],
  stage20Title: '버프 실험',
  stage20Objectives: [objective('companion-buff', '동반자 버프 발동', 100)],
  stage30Title: '자율 업무 승인',
  stage30Objectives: [objective('companion-buff', '동반자 버프 발동', 300)],
  finalCap: 25
});

// 회계팀
addQuest({
  id: 'skill_accounting_settlement_wave_10', npcId: 'accounting_nanche', departmentId: 'accounting',
  title: '누락된 결산서', skillId: 'extended_2926a732db', cap: 10,
  objectives: [objective('collect', '급여명세 잔해 수집', 150, {
    targetIds: ['monster_loot_payroll_mimic']
  })]
});
addGenericChain({
  prefix: 'skill_accounting_frozen_drone', npcId: 'audit_chunsik', departmentId: 'accounting',
  skillId: 'extended_b4d0d6df62', baseTitle: '감사 드론 시운전',
  baseObjectives: [objective('kill', '감사실 유령 처치', 300, { targetIds: ['audit_ghost'] })],
  followUpTitles: ['오탐 제거', '무인 감사 승인']
});
addQuest({
  id: 'skill_accounting_piercing_10', npcId: 'vault_fist', departmentId: 'accounting',
  title: '숫자는 벽을 통과한다', skillId: 'extended_cd94045605', cap: 10,
  objectives: [objective('kill', '급여대장 미믹 처치', 300, { targetIds: ['payroll_mimic'] })]
});
addQuest({
  id: 'skill_accounting_zero_error_10', npcId: 'accounting_nanche', departmentId: 'accounting',
  title: '마지막 1원을 찾아서', skillId: 'extended_e9c47b999a', cap: 10,
  objectives: [objective('collect', '회계 계열 전리품 수집', 200, {
    targetIds: ['monster_loot_payroll_mimic', 'monster_loot_audit_ghost']
  })]
});

// 마케팅팀
addQuest({
  id: 'skill_marketing_brand_wave_10', npcId: 'brand_rayon', departmentId: 'marketing',
  title: '브랜드 색상 복구', skillId: 'extended_2973270a08', cap: 10,
  objectives: [objective('collect', '바랜 광고 전단 수집', 300, {
    targetIds: ['monster_loot_ad_chameleon']
  })]
});
addGenericChain({
  prefix: 'skill_marketing_phoenix', npcId: 'ad_jjor', departmentId: 'marketing',
  skillId: 'extended_de542ec818', baseTitle: '죽은 캠페인 살리기',
  baseObjectives: [objective('kill', '광고촬영장 몬스터 처치', 250, { mapIds: ['ad_set'] })],
  followUpTitles: ['재론칭', '전사 캠페인']
});
addQuest({
  id: 'skill_marketing_live_ad_10', npcId: 'ad_jjor', departmentId: 'marketing',
  title: '송출 테스트', skillId: 'extended_fc89f3cfc2', cap: 10,
  objectives: [objective('kill', '서버실 도깨비불 처치', 300, { targetIds: ['server_wisp'] })]
});
addGenericChain({
  prefix: 'skill_marketing_focus', npcId: 'market_guma', departmentId: 'marketing',
  skillId: 'extended_e7c08ae117', baseTitle: '한 사람만 설득하기',
  baseObjectives: [objective('kill', '단일 대상 공격으로 몬스터 처치', 350, {
    singleTarget: true
  })], followUpTitles: ['세그먼트 분석', '전사 집중 집행']
});

// 영업팀
addGenericChain({
  prefix: 'skill_sales_hidden_team', npcId: 'market_guma', departmentId: 'sales',
  skillId: 'extended_3324d2dc32', baseTitle: '아무도 모르는 방문',
  baseObjectives: [
    objective('visit', '지정 영업 거점 5곳 방문', 5, {
      uniqueTargets: true,
      mapIds: ['brand_studio', 'ad_set', 'market_research', 'sales_floor', 'finance_analysis']
    }),
    objective('kill', '지정 거점에서 몬스터 처치', 500, {
      mapIds: ['brand_studio', 'ad_set', 'market_research', 'sales_floor', 'finance_analysis']
    })
  ], followUpTitles: ['잠복 계약', '그림자 실적']
});
addQuest({
  id: 'skill_sales_triple_offer_10', npcId: 'sales_neo', departmentId: 'sales',
  title: '세 번 거절당하기', skillId: 'extended_eb778160dd', cap: 10,
  objectives: [objective('kill', '영업 여우 처치', 350, { targetIds: ['sales_fox'] })]
});
addGenericChain({
  prefix: 'skill_sales_customer_push', npcId: 'sales_neo', departmentId: 'sales',
  skillId: 'extended_cbd5e90ff5', baseTitle: '진상 고객 퇴장',
  baseObjectives: [objective('knockback', '넉백으로 몬스터 이동', 150)],
  followUpTitles: ['거리 확보', '계약 구역 정리']
});

// 시설관리팀
addGenericChain({
  prefix: 'skill_facilities_emergency_block', npcId: 'facility_kim', departmentId: 'facilities',
  skillId: 'extended_82bcd346d1', baseTitle: '차단기 점검',
  baseObjectives: [objective('collect', '방전된 배터리 수집', 150, {
    targetIds: ['monster_loot_facility_drone']
  })], followUpTitles: ['2차 차단', '완전 봉쇄']
});
addGenericChain({
  prefix: 'skill_facilities_ambush', npcId: 'data_sseubi', departmentId: 'facilities',
  skillId: 'extended_f1561f9de2', baseTitle: '보이지 않는 정비',
  baseObjectives: [objective('kill', '은신 상태로 몬스터 처치', 80, { stealth: true })],
  followUpTitles: ['야간 잠복', '무소음 정비']
});
addGenericChain({
  prefix: 'skill_facilities_smoke', npcId: 'facility_kim', departmentId: 'facilities',
  skillId: 'extended_d1fad80ea9', baseTitle: '대피로 확보',
  baseObjectives: [objective('hit-survive', '피격 후 생존', 300)],
  followUpTitles: ['시야 차단 시험', '전 구역 대피 훈련']
});

// 개발팀
addGenericChain({
  prefix: 'skill_development_red_team', npcId: 'bug_nilnil', departmentId: 'development',
  skillId: 'extended_fae4c32e15', baseTitle: '취약점 재현',
  baseObjectives: [objective('kill', '버그 딱정벌레 처치', 350, { targetIds: ['bug_beetle'] })],
  followUpTitles: ['내부 침투', '프로덕션 검증']
});
addQuest({
  id: 'skill_development_infinite_resource_10', npcId: 'server_mingu', departmentId: 'development',
  title: '리소스 누수 조사', skillId: 'extended_0dcef657e3', cap: 10,
  objectives: [objective('collect', '그을린 케이블 수집', 200, {
    targetIds: ['monster_loot_server_wisp']
  })]
});
addGenericChain({
  prefix: 'skill_development_cooling', npcId: 'server_mingu', departmentId: 'development',
  skillId: 'extended_d46f7acd66', baseTitle: '과열 경보',
  baseObjectives: [objective('kill', '서버·연구 몬스터 처치', 250, {
    mapIds: ['server_corridor', 'data_center', 'research_annex', 'prototype_lab']
  })], followUpTitles: ['냉각 증설', '무정지 운영']
});
addQuest({
  id: 'skill_development_production_blast_10', npcId: 'dev_potato', departmentId: 'development',
  title: '배포 전 최종 백업', skillId: 'extended_efc52e591a', cap: 10,
  objectives: [
    objective('visit', '사내 데이터센터 방문', 1, { mapIds: ['data_center'] }),
    objective('boss', '야근하다 미쳐버린 황과장 처치 기여', 1, {
      targetIds: ['mad_hwang_manager']
    })
  ]
});

// 연구팀
addGenericChain({
  prefix: 'skill_research_cryo_sample', npcId: 'research_simmi', departmentId: 'research',
  skillId: 'extended_c868507ba3', baseTitle: '녹기 전 회수',
  baseObjectives: [objective('collect', '불량 부품 수집', 150, {
    targetIds: ['monster_loot_prototype_golem']
  })], followUpTitles: ['냉동 보관', '영구 표본']
});
addQuest({
  id: 'skill_research_infinite_power_10', npcId: 'prototype_hoyi', departmentId: 'research',
  title: '동력 손실 0%', skillId: 'extended_69705b66e7', cap: 10,
  objectives: [objective('kill', '연구 계열 몬스터 처치', 350, {
    mapIds: ['research_annex', 'prototype_lab']
  })]
});
addGenericChain({
  prefix: 'skill_research_heated_subject', npcId: 'prototype_hoyi', departmentId: 'research',
  skillId: 'extended_5bf5a28801', baseTitle: '온도 상한 시험',
  baseObjectives: [objective('element-kill', '불 속성으로 몬스터 처치', 200, { element: 'fire' })],
  followUpTitles: ['고온 안정화', '임계점 돌파']
});
addQuest({
  id: 'skill_research_climate_control_10', npcId: 'research_simmi', departmentId: 'research',
  title: '기후 데이터 수집', skillId: 'extended_5620bb5a09', cap: 10,
  objectives: [
    objective('element-kill', '얼음 속성으로 몬스터 처치', 100, { id: 'ice', element: 'ice' }),
    objective('element-kill', '번개 속성으로 몬스터 처치', 100, {
      id: 'lightning', element: 'lightning'
    })
  ]
});

// 경영지원팀
addGenericChain({
  prefix: 'skill_support_guardian', npcId: 'corridor_bishop', departmentId: 'management_support',
  skillId: 'extended_c6e57601ce', baseTitle: '지원 요청서',
  baseObjectives: [objective('party-support', '파티원에게 버프·회복 제공', 600)],
  followUpTitles: ['수호체 점검', '24시간 지원 체계']
});
addQuest({
  id: 'skill_support_infinite_budget_10', npcId: 'accounting_nanche',
  departmentId: 'management_support', title: '예산 누수 봉쇄',
  skillId: 'extended_4d105c3f1f', cap: 10,
  objectives: [objective('collect', '급여·회계 전리품 수집', 400, {
    targetIds: ['monster_loot_payroll_mimic', 'monster_loot_audit_ghost']
  })]
});
addQuest({
  id: 'skill_support_reinstatement_10', npcId: 'lobby_peach',
  departmentId: 'management_support', title: '복직 서류 완성',
  skillId: 'extended_76e11d2ec7', cap: 10,
  objectives: [objective('npc-visit', '지정 NPC 3명에게 서류 전달', 3, {
    uniqueTargets: true,
    targetIds: ['hr_mond', 'accounting_nanche', 'corridor_bishop']
  })]
});
addStagedChain({
  prefix: 'skill_support_strategy_line', npcId: 'corridor_bishop',
  departmentId: 'management_support', skillId: 'extended_7a0f825273',
  baseTitle: '현장 지원망 연결',
  baseObjectives: [
    objective('visit', '안전지대 3곳 방문', 3, {
      id: 'safe_maps', uniqueTargets: true,
      mapIds: ['main_lobby', 'hr_reception', 'sales_floor']
    }),
    objective('visit', '고레벨 현장 3곳 방문', 3, {
      id: 'high_maps', uniqueTargets: true,
      mapIds: ['overtime_depths', 'executive_strategy', 'deadline_rooftop']
    }),
    objective('kill', '고레벨 현장에서 파티 없이 처치', 30, {
      mapIds: ['overtime_depths', 'executive_strategy', 'deadline_rooftop'], solo: true
    })
  ],
  stage20Title: '광역 지원',
  stage20Objectives: [skillUse('extended_7a0f825273', 100)],
  stage30Title: '전사 지원망',
  stage30Objectives: [skillUse('extended_7a0f825273', 300)]
});
addQuest({
  id: 'skill_support_emergency_10', npcId: 'corridor_bishop',
  departmentId: 'management_support', title: '비상연락망 가동',
  skillId: 'extended_aef3d1db17', cap: 10,
  objectives: [objective('boss', '파티 상태로 황과장 처치 기여', 1, {
    targetIds: ['mad_hwang_manager'], partyRequired: true
  })]
});

const SKILL_UNLOCK_QUESTS_BY_NPC = Object.freeze(Object.fromEntries(
  [...questsByNpc.entries()].map(([npcId, quests]) => [npcId, Object.freeze([...quests])])
));

const SKILL_UNLOCK_QUESTS = Object.freeze(
  Object.values(SKILL_UNLOCK_QUESTS_BY_NPC).flat()
);

module.exports = {
  SKILL_UNLOCK_QUESTS,
  SKILL_UNLOCK_QUESTS_BY_NPC
};
