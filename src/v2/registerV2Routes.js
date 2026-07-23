'use strict';

const V2Account = require('./models/V2Account');
const V2Character = require('./models/V2Character');
const LegacyUserSnapshot = require('./models/LegacyUserSnapshot');
const V2DeletedAccount = require('./models/V2DeletedAccount');
const V2Setting = require('./models/V2Setting');
const V2MarketListing = require('./models/V2MarketListing');
const { MAX_LEVEL, getRequiredExpV2 } = require('./constants/experienceTable');
const {
  START_MAP_ID,
  WORLD_MAPS,
  getWorldMap,
  findNearestSafeMap
} = require('./world/mapDefinitions');
const { MONSTER_CATALOG } = require('./world/monsterCatalog');
const {
  DEPARTMENTS,
  applyAdvancement,
  getJobName
} = require('./jobs/advancementRules');
const { canUseBasicAttack } = require('./combat/basicAttackPolicy');
const {
  claimWorldControl,
  hasWorldControl,
  hasRecentWorldControl,
  releaseWorldControl,
  updatePresence,
  attackMonster,
  useSkillOnMonsters,
  isPlayerSilenced,
  clearPlayerNegativeStatus,
  updatePlayerResources,
  setPlayerStealth,
  recordSkillUse,
  listActivePlayers,
  listAllActivePlayers,
  leaveWorld
} = require('./world/worldRuntime');
const {
  LEGACY_CURVE,
  mapLegacyLevelToV2,
  getStatPointsForLevel
} = require('./progression/levelMigration');
const {
  MIGRATION_VERSION,
  buildMigrationPreview,
  ensureV2MigrationForUser,
  repairV2CharacterStatBaselinesByUserId,
  ensureV2SkillPointGrant,
  ensureV2CharacterFoundation,
  buildCharacterResponse
} = require('./services/migrationService');
const {
  isV2AccountDeletedError,
  markV2AccountDeleted
} = require('./services/accountDeletionService');
const {
  calculateReferenceResources,
  applyReferenceResources,
  applyLevelGrowth
} = require('./progression/resourceGrowth');
const { getItemDefinition, listAdminGrantItems } = require('./items/itemCatalog');
const {
  addInventoryItem,
  ensureInventory,
  consumeInventoryItem,
  consumeInventoryStack,
  assertInventorySpace,
  assignPotionQuickSlot,
  setPotionAutoThreshold,
  useQuickSlotPotion,
  useConfiguredAutoPotions,
  useInventoryExpansionTicket,
  equipInventoryEquipment,
  unequipInventoryEquipment,
  buildInventoryView,
  createAdminMail,
  serializeMail,
  purgeExpiredMail,
  getPendingMail,
  claimMail,
  claimAllMail,
  sortInventory
} = require('./services/inventoryService');
const {
  enhanceEquippedItem
} = require('./services/equipmentEnhancementService');
const {
  getSettlementEventView,
  rollSettlementEventCoin,
  purchaseSettlementEventItem
} = require('./services/settlementEventService');
const { changeDepartment } = require('./services/jobChangeService');
const { applyLevelUpCoupon } = require('./services/levelUpCouponService');
const {
  validateMasteryBookUse,
  resolveMasteryBookUse
} = require('./services/masteryBookService');
const {
  buildNpcView,
  buildQuestJournal,
  acceptQuest,
  recordQuestEvent,
  recordMapVisit,
  recordNpcVisit,
  recordMonsterKills,
  recordBossKill,
  claimQuest,
  getPublicNpcsForMap
} = require('./services/questService');
const {
  ensureDailyHuntingMail,
  getKoreaDateKey,
  setHuntingEnabled,
  tickHuntingTime,
  addHuntingMinutes,
  addHuntingCapacityMinutes,
  serializeHuntingTime,
  getOfflineHuntingSummaryId,
  createOfflineHuntingSummary,
  acknowledgeOfflineHuntingSummary
} = require('./services/huntingTimeService');
const {
  getCashShopView,
  grantCashPoints,
  purchaseCashProduct
} = require('./services/cashShopService');
const {
  ensureDailyActionPoints,
  spendActionPoints,
  restoreActionPoints
} = require('./services/actionPointService');
const {
  applyOfflinePassiveMpRecovery,
  restoreCharacterMp
} = require('./services/offlinePassiveRecoveryService');
const {
  getPartyState,
  getPartyMemberIds,
  invitePlayer,
  acceptInvitation,
  declineInvitation,
  removeMember
} = require('./services/partyService');
const {
  createPartyReturnPortals,
  listVisiblePartyPortals,
  usePartyPortal
} = require('./services/partyPortalService');
const {
  requestTrade,
  respondTrade,
  setTradeOffer,
  confirmTrade,
  resetTradeConfirmations,
  closeTrade,
  getTradeState
} = require('./services/tradeService');
const { reconcileHpGrowthSkillBonus } = require('./services/hpGrowthBonusService');
const { reconcileMpGrowthSkillBonus } = require('./services/mpGrowthBonusService');
const { reconcileMaxResourceBuff } = require('./services/maxResourceBuffService');
const {
  buyShopItem,
  sellInventoryStack,
  rechargeThrowingStarStack,
  buildShopView
} = require('./services/shopService');
const { SKILL_DEFINITIONS } = require('./skills/skillDefinitions');
const {
  ensureSkillState,
  getSkillLevel,
  resolveSkillValues,
  resolveSkillCastProfile,
  investSkill,
  setActivePreset,
  setAutoPreset,
  buildActiveBuffEffects,
  upsertActiveBuff,
  getActiveSkillEffects
} = require('./skills/skillService');
const {
  buildSummonState,
  isAttackingSummon,
  isSummonAttackDue,
  isCompanionSummon
} = require('./skills/summonService');
const { calculateMagicDamageRange } = require('./combat/combatFormulas');

const STEALTH_SKILL_ID = 'extended_47fcdc0ba0';
const MONSTER_QUEST_LOOKUP = new Map(
  MONSTER_CATALOG.map((monster) => [String(monster.id), monster])
);

function clearStealthBuff(skillState) {
  const activeBuffs = Array.isArray(skillState?.activeBuffs) ? skillState.activeBuffs : [];
  const filtered = activeBuffs.filter((buff) => buff.skillId !== STEALTH_SKILL_ID);
  const removed = filtered.length !== activeBuffs.length;
  if (removed) skillState.activeBuffs = filtered;
  return removed;
}

const V2_RETAINED_FEATURES = Object.freeze([
  '계정 및 닉네임',
  '행동력',
  '주식 시장',
  '사내 번개장터',
  '우편함 및 운영자 지급',
  '매일 증강 선택 구조',
  '회사 운영 데이터'
]);

const V2_REMOVED_FEATURES = Object.freeze([
  '분당 월급 및 자동 급여',
  '스트레스',
  '열일 클릭 및 뉴스 타이핑',
  '가방 탭',
  '기존 카드 턴제 전투',
  '개인면담',
  '기존 레이드 전투 엔진'
]);

const ELEMENT_BUFF_SKILL_IDS = Object.freeze([
  'element_fire',
  'element_ice',
  'element_lightning',
  'element_holy'
]);

function getActiveWeaponElements(skillState, now = Date.now()) {
  return (skillState?.activeBuffs || [])
    .filter((buff) => (
      ELEMENT_BUFF_SKILL_IDS.includes(buff.skillId)
      && (!buff.expiresAt || new Date(buff.expiresAt).getTime() > now)
    ))
    .map((buff) => SKILL_DEFINITIONS[buff.skillId]?.element)
    .filter(Boolean);
}

const SIGNUP_CODE_SETTING_KEY = 'signup-code';
const OFFLINE_HUNTING_SWEEP_MS = 5_000;
const OFFLINE_HUNTING_BATCH_SIZE = 20;
const OFFLINE_HUNTING_ACTION_INTERVAL_MS = 1_200;
const OFFLINE_HUNTING_MAX_ACTIONS_PER_SWEEP = 8;
const V2_PATCH_NOTE_VERSION = '2026-07-09-field-boss-1';
const V2_PATCH_NOTES = Object.freeze({
  version: V2_PATCH_NOTE_VERSION,
  title: '필드보스와 지도 기능 1차 패치',
  publishedAt: '2026-07-09',
  lines: Object.freeze([
    '히든 스트리트 필드보스 야근하다 미쳐버린 황과장을 추가했습니다.',
    '황과장은 기여자 기준 경험치, 돈, 표식, 주문서와 60~70제 무기를 분배합니다.',
    '텔레포트가 캐릭터의 현재 바라보는 방향 기준으로 이동하도록 수정했습니다.',
    '지도 버튼을 추가해 일반 필드 연결 구조를 볼 수 있게 했습니다.',
    'V1 S카드, 명함, 박카스 보유량을 특수 교환권으로 반영했습니다.'
  ])
});

const V2_PATCH_NOTE_HISTORY = Object.freeze([
  V2_PATCH_NOTES,
  Object.freeze({
    version: '2026-07-10-combat-polish-1',
    title: '전투 편의성과 오프라인 사냥 보강',
    publishedAt: '2026-07-10',
    lines: Object.freeze([
      '마법사 계열 텔레포트 스킬 3종을 실제 순간이동 효과와 전용 애니메이션에 연결했습니다.',
      '필드 보스가 등장하면 전투 화면 최상단에 남은 HP 바가 표시됩니다.',
      '전사 계열 2차, 3차, 4차 전직 시 추가 최대 체력 보너스를 지급하도록 반영했습니다.',
      '오프라인 사냥 중 자동 스킬 사용, MP 소모, 경험치와 드랍 기록이 처리되도록 보강했습니다.',
      '재접속 시 오프라인 사냥 정산 창이 뜨고 획득 결과를 확인할 수 있게 했습니다.'
    ])
  }),
  Object.freeze({
    version: '2026-07-21-special-actions-1',
    title: '특수행동과 전투 안정화',
    publishedAt: '2026-07-21',
    lines: Object.freeze([
      '행동력 6을 사용하는 월급루팡을 추가했습니다. 40분 동안 경험치가 10% 증가하며 경험치 쿠폰과 곱연산으로 중첩됩니다.',
      '행동력을 1 회복하는 캐시 소비 아이템 핫식스를 추가하고, 부업은 추후 공개 항목으로 특수행동 화면에 배치했습니다.',
      '실시간 광고 송출의 연타마다 숙련도와 크리티컬을 따로 판정하고 애니메이션 타이밍에 맞춰 피해가 표시되도록 개선했습니다.',
      '공격형 소환수, 업무 축소, 오프라인 자동 스킬 순환을 보강하고 불필요한 소환수 하트비트 조회를 줄였습니다.',
      '영구 소비 아이템 자동 합치기, 실시간 버프 스탯, 공용 귀걸이 착용과 장비 무기 종류 표시를 정비했습니다.'
    ])
  }),
  Object.freeze({
    version: '2026-07-21-equipment-drop-pool-1',
    title: '장비 드랍 풀 확대',
    publishedAt: '2026-07-21',
    lines: Object.freeze([
      '모든 일반 몬스터가 전사, 궁수, 도적, 마법사 무기를 각각 최소 1종 이상 드랍하도록 조정했습니다.',
      '모든 몬스터의 드랍 풀에 무기 외 직업 방어구를 최소 3종 이상 포함하고 전사와 도적 방어구 누락을 수정했습니다.',
      '방어구를 10레벨 간격으로 추가해 저레벨부터 고레벨까지 몬스터 레벨에 맞는 방어구가 고르게 등장합니다.',
      '기존 공용 망토와 귀걸이 드랍도 유지하면서 몬스터별 전체 장비 후보를 최대 16종으로 확대했습니다.'
    ])
  })
]);
const V2_CURRENT_PATCH_NOTES = V2_PATCH_NOTE_HISTORY[V2_PATCH_NOTE_HISTORY.length - 1];

function validateSignupPayload(payload = {}) {
  const username = String(payload.username || '').trim();
  const password = String(payload.password || '');
  const passwordConfirm = String(payload.passwordConfirm || '');
  const signupCode = String(payload.signupCode || '').trim();
  const nickname = String(payload.nickname || '').trim();
  if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
    return { valid: false, message: '아이디는 영문, 숫자, 밑줄을 사용해 3~24자로 입력해주세요.' };
  }
  if (password.length < 6 || password.length > 72) {
    return { valid: false, message: '비밀번호는 6~72자로 입력해주세요.' };
  }
  if (password !== passwordConfirm) {
    return { valid: false, message: '비밀번호 확인이 일치하지 않습니다.' };
  }
  if (nickname.length < 2 || nickname.length > 12) {
    return { valid: false, message: '닉네임은 2~12자로 입력해주세요.' };
  }
  if (!signupCode) {
    return { valid: false, message: '가입 코드를 입력해주세요.' };
  }
  return { valid: true, username, password, signupCode, nickname };
}

async function getSignupCodeSetting() {
  return V2Setting.findOne({ key: SIGNUP_CODE_SETTING_KEY }).lean();
}

async function isSignupCodeValid(code, bcrypt) {
  const setting = await getSignupCodeSetting();
  const hash = String(setting?.value?.codeHash || '');
  return Boolean(hash && code && await bcrypt.compare(String(code), hash));
}

const V2_PLANNED_FEATURES = Object.freeze([
  '200레벨 진행도',
  '맷집·처리속도·업무지식·눈치 스탯',
  '부서 및 전직',
  'HP·MP와 장비창',
  '인벤토리',
  '사냥터·자동사냥·파티 사냥',
  '직업별 스킬 트리',
  '실시간 보스 전투'
]);

function grantV2Experience(character, amount) {
  if (!character) return { gained: 0, levels: 0 };
  const activeEffects = getActiveSkillEffects(character);
  const experienceMultiplier = (
    1 + Math.max(0, Number(activeEffects.experienceBonusPercent) || 0) / 100
  ) * (
    1 + Math.max(0, Number(activeEffects.experienceMultiplierPercent) || 0) / 100
  );
  const gained = Math.max(0, Math.floor((Number(amount) || 0) * experienceMultiplier));
  let levels = 0;
  const previousLevel = Math.max(1, Number(character.progression?.level) || 1);
  character.progression.exp = Math.max(0, Number(character.progression.exp) || 0) + gained;
  while (character.progression.level < MAX_LEVEL) {
    const required = getRequiredExpV2(character.progression.level);
    if (!required || character.progression.exp < required) break;
    character.progression.exp -= required;
    character.progression.level += 1;
    character.progression.unspentStatPoints += 5;
    const earnedSkillPoints = character.progression.level <= 10 ? 1 : 3;
    character.progression.unspentSkillPoints += earnedSkillPoints;
    character.progression.totalSkillPointsEarned += earnedSkillPoints;
    levels += 1;
  }
  if (character.progression.level >= MAX_LEVEL) character.progression.exp = 0;
  if (levels > 0) {
    const department = DEPARTMENTS[character.job?.departmentId];
    applyLevelGrowth(character, {
      previousLevel,
      archetype: department?.archetype || 'beginner',
      departmentId: character.job?.departmentId,
      advancementTier: character.job?.advancementTier
    });
    reconcileHpGrowthSkillBonus(character);
    reconcileMpGrowthSkillBonus(character);
  }
  return { gained, levels };
}

function getCombatAmmunition(profile) {
  const weaponType = profile?.equipmentLoadout?.weapon?.weaponType
    || profile?.loadout?.weapon?.weaponType;
  if (['bow', 'crossbow'].includes(weaponType)) {
    return { itemId: 'basic_arrow', attackBonus: 2 };
  }
  if (weaponType === 'claw') {
    return { itemId: 'crude_throwing_star', attackBonus: 15 };
  }
  return null;
}

function isMageProfile(profile) {
  return (profile?.derivedStats?.archetype || DEPARTMENTS[profile?.job?.departmentId]?.archetype) === 'mage';
}

function scaleDamageRange(range, multiplier = 1) {
  const minimum = Math.max(0, Number(range?.minimum) || 0);
  const maximum = Math.max(minimum, Number(range?.maximum) || 0);
  const safeMultiplier = Math.max(0, Number(multiplier) || 0);
  return {
    minimum: minimum * safeMultiplier,
    maximum: maximum * safeMultiplier
  };
}

function buildProfileMagicDamageRange(profile, skillAttack = 100) {
  return calculateMagicDamageRange({
    magic: profile?.derivedStats?.magic,
    workKnowledge: profile?.derivedStats?.effectiveStats?.workKnowledge
      ?? profile?.stats?.workKnowledge,
    skillAttack,
    mastery: profile?.derivedStats?.weaponMastery
      || profile?.skillEffects?.weaponMastery
      || 0
  });
}

function calculatePartyExperienceShares({ baseExp = 0, members = [], killerId = '' } = {}) {
  const killerFixedRatio = 0.2;
  const partyShareRatio = 0.8;
  const partyBonusPerMember = 0.05;
  const exp = Math.max(0, Math.floor(Number(baseExp) || 0));
  const normalizedMembers = [...new Map(
    members
      .filter((member) => member?.userId)
      .map((member) => [
        String(member.userId),
        {
          userId: String(member.userId),
          level: Math.max(1, Math.floor(Number(member.level) || 1))
        }
      ])
  ).values()];
  const killerKey = String(killerId || '');
  if (exp <= 0) {
    return normalizedMembers.map((member) => ({
      ...member,
      exp: 0,
      killer: member.userId === killerKey
    }));
  }
  if (normalizedMembers.length <= 1) {
    return [{
      userId: killerKey || normalizedMembers[0]?.userId || '',
      level: normalizedMembers[0]?.level || 1,
      exp,
      killer: true
    }];
  }
  const totalLevel = normalizedMembers.reduce((sum, member) => sum + member.level, 0) || 1;
  const partyBonus = 1 + partyBonusPerMember * normalizedMembers.length;
  return normalizedMembers.map((member) => {
    const baseShare = exp * partyShareRatio * member.level / totalLevel;
    const killerBonus = member.userId === killerKey ? exp * killerFixedRatio : 0;
    return {
      ...member,
      exp: Math.max(0, Math.floor((baseShare + killerBonus) * partyBonus)),
      killer: member.userId === killerKey
    };
  });
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function serializeMarketplaceListing(listing = {}) {
  const item = getItemDefinition(listing.itemId);
  const instanceData = listing.instanceData || null;
  const enhancement = instanceData?.enhancement || null;
  const equipmentSpec = item?.category === 'equipment'
    ? {
      equipmentSlot: item.equipmentSlot || '',
      weaponType: item.weaponType || '',
      requiredLevel: Number(item.requiredLevel ?? item.requirements?.level) || 1,
      requirements: item.requirements || {},
      stats: instanceData?.stats || item.stats || {},
      enhancement: enhancement || {
        level: 0,
        remaining: Number(item.upgradeSlots) || 0,
        maximum: Number(item.upgradeSlots) || 0,
        bonusStats: {}
      }
    }
    : null;
  return {
    id: String(listing._id || listing.id || ''),
    sellerId: String(listing.sellerId || ''),
    sellerName: String(listing.sellerName || ''),
    itemId: String(listing.itemId || ''),
    itemName: String(listing.itemName || ''),
    itemIcon: String(listing.itemIcon || '📦'),
    itemCategory: String(listing.itemCategory || ''),
    quantity: Math.max(1, Number(listing.quantity) || 1),
    instanceData,
    equipmentSpec,
    pricePerItem: Math.max(1, Number(listing.pricePerItem) || 1),
    totalPrice: Math.max(1, Number(listing.totalPrice) || 1),
    sellerProceeds: Math.max(0, Number(listing.sellerProceeds) || 0),
    status: String(listing.status || ''),
    createdAt: listing.createdAt || null,
    expiresAt: listing.expiresAt || null,
    soldAt: listing.soldAt || null
  };
}

function calculateWelfareSupportDamage({
  workKnowledge = 0,
  awareness = 0,
  magic = 0,
  targetCount = 1,
  healPercent = 100,
  random = Math.random
} = {}) {
  const intelligence = Math.max(0, Number(workKnowledge) || 0);
  const luck = Math.max(0, Number(awareness) || 0);
  const magicAttack = Math.max(0, Number(magic) || 0);
  const count = Math.max(1, Math.floor(Number(targetCount) || 1));
  const mobCoefficient = 1.5 + 5 / count;
  const minimum = (intelligence * 0.3 + luck) * magicAttack / 1000 * mobCoefficient;
  const maximum = (intelligence * 1.2 + luck) * magicAttack / 1000 * mobCoefficient;
  const rolled = minimum + Math.max(0, Math.min(1, Number(random()) || 0)) * (maximum - minimum);
  return Math.max(1, Math.floor(rolled * Math.max(0, Number(healPercent) || 0) / 100));
}

function calculateMoneyDropAmount(baseAmount, increasePercent = 0) {
  const base = Math.max(0, Math.floor(Number(baseAmount) || 0));
  const multiplier = 1 + Math.max(0, Number(increasePercent) || 0) / 100;
  return Math.max(0, Math.floor(base * multiplier));
}

function registerV2Routes({
  app,
  User,
  bcrypt,
  jwt,
  jwtSecret,
  adminUsername,
  adminPassword,
  requireAdmin
}) {
  const worldProfileCache = new Map();
  const characterMutationQueues = new Map();
  const pendingAutoPotionUpdates = new Map();

  function queueAutoPotionUpdate(userId, character, uses = []) {
    if (!uses.length) return;
    const key = String(userId);
    const pending = pendingAutoPotionUpdates.get(key);
    const inventory = buildInventoryView(character);
    pendingAutoPotionUpdates.set(key, {
      uses: [...(pending?.uses || []), ...uses].slice(-4),
      quickSlots: inventory.quickSlots
    });
  }

  function takeAutoPotionUpdate(userId) {
    const key = String(userId);
    const update = pendingAutoPotionUpdates.get(key) || null;
    pendingAutoPotionUpdates.delete(key);
    return update;
  }

  async function withCharacterMutation(userId, operation) {
    const key = String(userId);
    const previous = characterMutationQueues.get(key) || Promise.resolve();
    const current = previous.catch(() => {}).then(operation);
    characterMutationQueues.set(key, current);
    try {
      return await current;
    } finally {
      if (characterMutationQueues.get(key) === current) characterMutationQueues.delete(key);
    }
  }

  async function withCharacterMutations(userIds, operation) {
    const keys = [...new Set((userIds || []).map(String).filter(Boolean))].sort();
    const acquire = (index) => (
      index >= keys.length
        ? operation()
        : withCharacterMutation(keys[index], () => acquire(index + 1))
    );
    return acquire(0);
  }

  async function withTwoCharacterMutations(leftId, rightId, operation) {
    return withCharacterMutations([leftId, rightId], operation);
  }

  function getActivePartyPlayers(userId, mapId) {
    const partyMemberIds = new Set(getPartyMemberIds(userId));
    return listActivePlayers(mapId).filter((player) => partyMemberIds.has(String(player.userId)));
  }

  async function grantCombatExperience(character, baseExp, mapId) {
    const killerId = String(character?.userId || '');
    const activePartyPlayers = getActivePartyPlayers(killerId, mapId);
    const activePartyIds = [...new Set(activePartyPlayers.map((player) => String(player.userId)))];
    if (!activePartyIds.includes(killerId)) activePartyIds.push(killerId);
    if (activePartyIds.length <= 1) {
      return {
        self: grantV2Experience(character, baseExp),
        party: []
      };
    }

    const partyCharacters = await V2Character.find({ userId: { $in: activePartyIds } });
    const byUserId = new Map(partyCharacters.map((partyCharacter) => (
      [String(partyCharacter.userId), partyCharacter]
    )));
    if (!byUserId.has(killerId)) byUserId.set(killerId, character);
    const members = activePartyIds
      .map((userId) => {
        const partyCharacter = byUserId.get(userId);
        if (!partyCharacter) return null;
        return {
          userId,
          level: partyCharacter.progression?.level
        };
      })
      .filter(Boolean);
    if (members.length <= 1) {
      return {
        self: grantV2Experience(character, baseExp),
        party: []
      };
    }

    const shares = calculatePartyExperienceShares({ baseExp, members, killerId });
    let self = { gained: 0, levels: 0 };
    const party = [];
    for (const share of shares) {
      const target = share.userId === killerId ? character : byUserId.get(share.userId);
      if (!target) continue;
      const granted = grantV2Experience(target, share.exp);
      if (share.userId === killerId) {
        self = granted;
      } else {
        await target.save();
        worldProfileCache.delete(share.userId);
        updatePlayerResources(share.userId, buildCharacterResponse(target).resources);
        party.push({
          userId: share.userId,
          gained: granted.gained,
          levels: granted.levels
        });
      }
    }
    return { self, party };
  }

  async function applyBuffToActivePartyMembers(casterId, mapId, buff) {
    const casterKey = String(casterId);
    const targets = getActivePartyPlayers(casterKey, mapId)
      .filter((player) => String(player.userId) !== casterKey);
    for (const player of targets) {
      const teammate = await V2Character.findOne({ userId: player.userId });
      if (!teammate) continue;
      upsertActiveBuff(teammate, {
        ...buff,
        effects: { ...(buff.effects || {}) },
        createdAt: new Date(buff.createdAt),
        expiresAt: new Date(buff.expiresAt)
      });
      await teammate.save();
      worldProfileCache.delete(String(player.userId));
    }
    return targets.map((player) => String(player.userId));
  }

  async function healActivePartyMembers({
    caster,
    mapId,
    rangePx,
    amount
  }) {
    const casterId = String(caster.userId);
    const activePlayers = getActivePartyPlayers(casterId, mapId);
    const casterPresence = activePlayers.find((player) => String(player.userId) === casterId);
    const rangePercent = Math.max(1, Number(rangePx) || 100) / 1200 * 100;
    const targetIds = new Set([casterId]);
    if (casterPresence) {
      for (const player of activePlayers) {
        if (
          player.floor === casterPresence.floor
          && Math.abs(Number(player.x) - Number(casterPresence.x)) <= rangePercent + 4.5
        ) targetIds.add(String(player.userId));
      }
    }

    const outcomes = [];
    for (const targetId of targetIds) {
      if (targetId === casterId) {
        const currentHp = Math.max(0, Number(caster.resources?.currentHp) || 0);
        const maxHp = buildCharacterResponse(caster).resources.maxHp;
        const healed = currentHp > 0
          ? Math.max(0, Math.min(maxHp - currentHp, amount))
          : 0;
        caster.resources.currentHp = currentHp + healed;
        outcomes.push({ userId: targetId, healed });
        continue;
      }
      const teammate = await V2Character.findOne({ userId: targetId });
      if (!teammate) continue;
      const currentHp = Math.max(0, Number(teammate.resources?.currentHp) || 0);
      const maxHp = buildCharacterResponse(teammate).resources.maxHp;
      const healed = currentHp > 0
        ? Math.max(0, Math.min(maxHp - currentHp, amount))
        : 0;
      if (healed > 0) {
        teammate.resources.currentHp = currentHp + healed;
        await teammate.save();
        updatePlayerResources(targetId, buildCharacterResponse(teammate).resources);
        worldProfileCache.delete(targetId);
      }
      outcomes.push({ userId: targetId, healed });
    }
    return outcomes;
  }

  function buildMailResponse(character) {
    const mails = getPendingMail(character)
      .map(serializeMail)
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
    return { mails, pendingCount: mails.length };
  }

  function applyCombatDrops(character, drops = []) {
    if (!character.economy || typeof character.economy !== 'object') character.economy = {};
    const moneyDropIncreasePercent = Math.max(
      0,
      Number(getActiveSkillEffects(character).moneyDropIncreasePercent) || 0
    );
    return drops.map((drop) => {
      if (drop.kind === 'money') {
        const baseAmount = Math.max(0, Math.floor(Number(drop.amount) || 0));
        const amount = calculateMoneyDropAmount(baseAmount, moneyDropIncreasePercent);
        character.economy.money = Math.max(0, Number(character.economy.money) || 0)
          + amount;
        return {
          ...drop,
          amount,
          ...(amount !== baseAmount ? { baseAmount } : {}),
          stored: true
        };
      }
      try {
        addInventoryItem(character, drop.itemId, drop.quantity, drop.instanceData);
        return { ...drop, stored: true };
      } catch (_) {
        return { ...drop, stored: false };
      }
    });
  }

  function applySettlementEventDrops(character, monsterLevels = [], drops = []) {
    const awarded = [];
    for (const monsterLevel of monsterLevels) {
      try {
        const eventDrop = rollSettlementEventCoin(character, monsterLevel);
        if (eventDrop) awarded.push(eventDrop);
      } catch (_) {
        // A full inventory should not invalidate the monster kill or its normal rewards.
      }
    }
    drops.push(...awarded);
    return drops;
  }

  function getQuestPartySize(character, mapId) {
    if (!character) return 1;
    return Math.max(1, getActivePartyPlayers(String(character.userId), mapId).length);
  }

  function recordCombatQuestProgress(character, combat = {}, context = {}) {
    if (!character) return false;
    const outcomes = Array.isArray(combat.outcomes)
      ? combat.outcomes
      : (combat.success === false ? [] : [combat]);
    const targetCount = Math.max(
      1,
      Number(context.targetCount)
        || outcomes.filter((outcome) => !outcome.missed).length
        || 1
    );
    const mapId = String(context.mapId || character.worldState?.mapId || '');
    const maxHp = Math.max(1, Number(character.resources?.maxHp) || 1);
    const sharedContext = {
      mapId,
      targetCount,
      partySize: Math.max(
        1,
        Number(context.partySize) || getQuestPartySize(character, mapId)
      ),
      hpPercent: Number.isFinite(Number(context.hpPercent))
        ? Number(context.hpPercent)
        : Math.max(0, Number(character.resources?.currentHp) || 0) / maxHp * 100,
      stealth: Boolean(context.stealth),
      element: context.element,
      elements: context.elements
    };
    let changed = false;
    for (const outcome of outcomes) {
      const targetId = String(outcome.speciesId || context.targetId || '');
      if (!targetId) continue;
      const monster = MONSTER_QUEST_LOOKUP.get(targetId);
      const eventContext = {
        ...sharedContext,
        undead: Boolean(monster?.undead)
      };
      if (outcome.defeated) {
        changed = recordMonsterKills(character, [targetId], eventContext) || changed;
      }
      if (outcome.knockedBack) {
        changed = recordQuestEvent(character, {
          ...eventContext,
          type: 'knockback',
          targetId,
          amount: 1
        }) || changed;
      }
    }
    return changed;
  }

  function recordSkillQuestProgress(character, {
    skillId,
    skillIds = [],
    combat = {},
    mapId = '',
    comboBefore = 0,
    comboAfter = 0,
    supportTargetIds = []
  } = {}) {
    if (!character || !skillId) return false;
    const combatResult = combat && typeof combat === 'object' ? combat : {};
    const partySize = getQuestPartySize(character, mapId);
    const normalizedSkillIds = [...new Set([
      skillId,
      ...(Array.isArray(skillIds) ? skillIds : [])
    ].map(String).filter(Boolean))];
    let changed = recordQuestEvent(character, {
      type: 'skill-use',
      targetId: String(skillId),
      targetIds: normalizedSkillIds,
      mapId: String(mapId || ''),
      partySize,
      amount: 1
    });
    const comboGained = Math.max(0, Number(comboAfter) - Number(comboBefore));
    if (comboGained > 0) {
      changed = recordQuestEvent(character, {
        type: 'combo-gain',
        mapId: String(mapId || ''),
        amount: comboGained
      }) || changed;
    }
    const supported = [...new Set(
      (supportTargetIds || [])
        .map(String)
        .filter((userId) => userId && userId !== String(character.userId))
    )];
    if (supported.length) {
      changed = recordQuestEvent(character, {
        type: 'party-support',
        mapId: String(mapId || ''),
        partySize,
        amount: supported.length
      }) || changed;
    }
    const comboSpent = Math.max(0, Number(comboBefore) - Number(comboAfter));
    for (const rewardEvent of combatResult.fieldBossRewards || []) {
      changed = recordQuestEvent(character, {
        type: 'boss-combo',
        targetId: String(rewardEvent.bossId || ''),
        mapId: String(mapId || ''),
        partySize,
        comboSpent,
        amount: 1
      }) || changed;
    }
    if (combatResult.fieldBossReward) {
      changed = recordQuestEvent(character, {
        type: 'boss-combo',
        targetId: String(combatResult.fieldBossReward.bossId || ''),
        mapId: String(mapId || ''),
        partySize,
        comboSpent,
        amount: 1
      }) || changed;
    }
    return changed;
  }

  function recordCompanionQuestTicks(character, now = Date.now()) {
    const skills = ensureSkillState(character);
    const summon = skills.summon;
    if (!summon) return false;
    const createdAt = new Date(summon.createdAt || now).getTime();
    const expiresAt = summon.expiresAt ? new Date(summon.expiresAt).getTime() : now;
    const effectiveNow = Math.min(now, Number.isFinite(expiresAt) ? expiresAt : now);
    if (!Number.isFinite(createdAt) || effectiveNow <= createdAt) return false;
    let changed = false;
    let timestampChanged = false;
    for (const [skillId, eventType, timestampKey] of [
      ['companion_heal', 'companion-heal', 'questHealAt'],
      ['companion_buff', 'companion-buff', 'questBuffAt']
    ]) {
      const definition = SKILL_DEFINITIONS[skillId];
      const level = getSkillLevel(character, skillId);
      if (!definition || level <= 0) continue;
      const values = resolveSkillValues(definition, level);
      const intervalMs = Math.max(1, Number(values.intervalSeconds) || 1) * 1000;
      const storedAt = new Date(summon[timestampKey] || createdAt).getTime();
      const previousAt = Math.max(
        createdAt,
        Number.isFinite(storedAt) ? storedAt : createdAt
      );
      const ticks = Math.max(0, Math.floor((effectiveNow - previousAt) / intervalMs));
      if (!ticks) continue;
      summon[timestampKey] = new Date(previousAt + ticks * intervalMs);
      timestampChanged = true;
      changed = recordQuestEvent(character, { type: eventType, amount: ticks }) || changed;
    }
    if (timestampChanged && typeof character.markModified === 'function') {
      character.markModified('skills');
    }
    return changed || timestampChanged;
  }

  function isCompanionQuestTickDue(profile, now = Date.now()) {
    const summon = profile?.skillTree?.summon;
    if (!isCompanionSummon(summon, now)) return false;
    const createdAt = new Date(summon.createdAt || now).getTime();
    const expiresAt = new Date(summon.expiresAt || now).getTime();
    const effectiveNow = Math.min(now, Number.isFinite(expiresAt) ? expiresAt : now);
    if (!Number.isFinite(createdAt) || effectiveNow <= createdAt) return false;
    const skills = new Map(
      (profile.skillTree?.skills || []).map((skill) => [String(skill.id), skill])
    );
    return [
      ['companion_heal', 'questHealAt'],
      ['companion_buff', 'questBuffAt']
    ].some(([skillId, timestampKey]) => {
      const skill = skills.get(skillId);
      if (!skill || Number(skill.level) <= 0) return false;
      const intervalMs = Math.max(1, Number(skill.values?.intervalSeconds) || 1) * 1000;
      const storedAt = new Date(summon[timestampKey] || createdAt).getTime();
      const baseline = Math.max(createdAt, Number.isFinite(storedAt) ? storedAt : createdAt);
      return effectiveNow - baseline >= intervalMs;
    });
  }

  function ensureOfflineHuntingSummary(character, now = Date.now()) {
    if (!character.huntingTime || typeof character.huntingTime !== 'object') {
      character.huntingTime = {};
    }
    if (
      !character.huntingTime.offlineSummary
      || typeof character.huntingTime.offlineSummary !== 'object'
    ) {
      character.huntingTime.offlineSummary = createOfflineHuntingSummary(now);
    } else if (!character.huntingTime.offlineSummary.id) {
      character.huntingTime.offlineSummary.id = getOfflineHuntingSummaryId(
        character.huntingTime.offlineSummary
      ) || createOfflineHuntingSummary(now).id;
    }
    return character.huntingTime.offlineSummary;
  }

  function mergeOfflineSummaryItem(summary, drop = {}) {
    if (drop.kind === 'money') {
      summary.money += Math.max(0, Math.floor(Number(drop.amount) || 0));
      return;
    }
    if (drop.kind !== 'item' || drop.stored === false || !drop.itemId) return;
    const definition = getItemDefinition(drop.itemId);
    const quantity = Math.max(1, Math.floor(Number(drop.quantity) || 1));
    const existing = summary.items.find((entry) => entry.itemId === drop.itemId);
    if (existing) {
      existing.quantity += quantity;
      return;
    }
    summary.items.push({
      itemId: drop.itemId,
      name: drop.name || definition?.name || drop.itemId,
      icon: drop.icon || definition?.icon || '?',
      quantity,
      stored: true
    });
  }

  function recordOfflineHuntingSummary(character, {
    elapsedMs = 0,
    exp = 0,
    kills = 0,
    skillUses = 0,
    drops = []
  } = {}, now = Date.now()) {
    const summary = ensureOfflineHuntingSummary(character, now);
    summary.updatedAt = new Date(now).toISOString();
    summary.elapsedSeconds += Math.max(0, Math.floor(Number(elapsedMs) || 0) / 1000);
    summary.kills += Math.max(0, Math.floor(Number(kills) || 0));
    summary.skillUses += Math.max(0, Math.floor(Number(skillUses) || 0));
    summary.exp += Math.max(0, Math.floor(Number(exp) || 0));
    for (const drop of drops || []) mergeOfflineSummaryItem(summary, drop);
    if (typeof character.markModified === 'function') character.markModified('huntingTime');
    return summary;
  }

  async function applyFieldBossRewards(rewardEvent = {}, currentCharacter = null) {
    const rewards = Array.isArray(rewardEvent.rewards) ? rewardEvent.rewards : [];
    const results = [];
    const applyReward = async (character, reward, { save = true } = {}) => {
      if (!character) return null;
      await ensureV2CharacterFoundation(character);
      if (!character.economy || typeof character.economy !== 'object') character.economy = {};
      const experience = grantV2Experience(character, reward.exp);
      character.economy.money = Math.max(0, Number(character.economy.money) || 0)
        + Math.max(0, Math.floor(Number(reward.money) || 0));
      const items = [];
      for (const item of reward.items || []) {
        try {
          addInventoryItem(
            character,
            item.itemId,
            Math.max(1, Math.floor(Number(item.quantity) || 1)),
            item.instanceData
          );
          items.push({ ...item, stored: true });
        } catch (_) {
          items.push({ ...item, stored: false });
        }
      }
      recordBossKill(character, rewardEvent.bossId);
      if (save) await character.save();
      worldProfileCache.delete(String(character.userId));
      updatePlayerResources(character.userId, character.resources);
      return {
        userId: String(character.userId),
        exp: Math.max(0, Math.floor(Number(reward.exp) || 0)),
        money: Math.max(0, Math.floor(Number(reward.money) || 0)),
        experience,
        items
      };
    };

    for (const reward of rewards) {
      const userId = String(reward.userId || '');
      if (!userId) continue;
      if (currentCharacter && String(currentCharacter.userId) === userId) {
        const result = await applyReward(currentCharacter, reward, { save: false });
        if (result) results.push(result);
        continue;
      }
      const result = await withCharacterMutation(userId, async () => {
        const character = await V2Character.findOne({ userId });
        return applyReward(character, reward, { save: true });
      });
      if (result) results.push(result);
    }

    return {
      bossId: rewardEvent.bossId || '',
      bossName: rewardEvent.bossName || '',
      mapId: rewardEvent.mapId || '',
      defeatedAt: rewardEvent.defeatedAt || null,
      respawnAt: rewardEvent.respawnAt || null,
      rewards: results
    };
  }

  async function getWorldProfile(userId, force = false) {
    const key = String(userId);
    const cached = worldProfileCache.get(key);
    const now = Date.now();
    if (
      !force
      && cached
      && now - cached.loadedAt < 30_000
      && (!cached.nextSkillExpiryAt || now < cached.nextSkillExpiryAt)
    ) return cached;
    const character = await V2Character.findOne({ userId }).lean();
    if (!character) return null;
    const resourceBuff = reconcileMaxResourceBuff(character, now);
    if (resourceBuff.changed) {
      await V2Character.updateOne(
        { _id: character._id },
        { $set: { resources: character.resources, skills: character.skills } }
      );
      updatePlayerResources(userId, character.resources);
    }
    const response = buildCharacterResponse(character);
    const skillExpirations = [
      ...(response.skillTree?.activeBuffs || []).map((buff) => Number(buff.expiresAt) || 0),
      Number(response.skillTree?.summon?.expiresAt) || 0
    ].filter((expiresAt) => expiresAt > now);
    const profile = {
      loadedAt: now,
      nextSkillExpiryAt: skillExpirations.length ? Math.min(...skillExpirations) : 0,
      displayName: response.displayName,
      progression: response.progression,
      stats: response.stats,
      resources: response.resources,
      derivedStats: response.derivedStats,
      skillTree: response.skillTree,
      skillEffects: response.skillEffects,
      job: response.job,
      combatPresentation: response.combatPresentation,
      worldState: response.worldState,
      huntingTime: response.huntingTime,
      inventory: response.inventory,
      equipmentLoadout: response.equipmentLoadout
    };
    worldProfileCache.set(key, profile);
    return profile;
  }

  function buildWorldPresenceFromResponse(response, {
    userId = response.userId || response.id,
    x = response.worldState?.x,
    floor = response.worldState?.floor,
    activity = 'combat',
    motion = response.combatPresentation?.motion || 'idle',
    offline = false,
    now = Date.now()
  } = {}) {
    const recoverySkill = response.skillTree?.skills?.find(
      (skill) => skill.id === 'recovery_improvement' && skill.level > 0
    );
    const endureSkill = response.skillTree?.skills?.find(
      (skill) => skill.id === 'endure' && skill.level > 0
    );
    const strongMindSkill = response.skillTree?.skills?.find(
      (skill) => skill.id === 'strong_mind' && skill.level > 0
    );
    return updatePresence({
      userId: String(userId),
      nickname: response.displayName,
      mapId: String(response.worldState?.mapId || START_MAP_ID),
      x,
      floor,
      activity,
      motion,
      currentHp: response.resources.currentHp,
      maxHp: response.resources.maxHp,
      currentMp: response.resources.currentMp,
      maxMp: response.resources.maxMp,
      playerLevel: response.progression?.level,
      playerStats: response.stats,
      physicalDefense: response.derivedStats.physicalDefense ?? response.derivedStats.defense,
      magicDefense: response.derivedStats.magicDefense,
      archetype: DEPARTMENTS[response.job?.departmentId]?.archetype || 'beginner',
      damageReductionPercent: response.skillEffects?.damageReductionPercent,
      dodgeChance: response.skillEffects?.dodgeChance,
      blockChance: response.skillEffects?.blockChance,
      stanceChance: response.skillEffects?.stanceChance,
      contactReflectPercent: response.skillEffects?.contactReflectPercent,
      contactReflectCapPercent: response.skillEffects?.contactReflectCapPercent,
      mpDamageGuardPercent: response.skillEffects?.mpDamageGuardPercent,
      stealth: response.skillEffects?.stealth,
      periodicHealPercent: recoverySkill?.values?.healPercent,
      periodicHealAmount: Number(response.skillEffects?.periodicHpRestore) || 0,
      periodicHealIntervalMs: Number(
        recoverySkill?.values?.intervalSeconds
        || response.skillEffects?.periodicRestoreIntervalSeconds
        || 0
      ) * 1000,
      periodicMpIntervalMs: Number(
        strongMindSkill?.values?.intervalSeconds
        || response.skillEffects?.periodicRestoreIntervalSeconds
        || 0
      ) * 1000,
      periodicMpAmount: Number(strongMindSkill?.values?.mpRestore)
        || Number(response.skillEffects?.periodicMpRestore)
        || 0,
      idleHealAmount: endureSkill?.values?.heal,
      idleHealIntervalMs: Number(endureSkill?.values?.intervalSeconds || 0) * 1000,
      autoHunting: Boolean(response.huntingTime?.enabled),
      autoHuntRemainingSeconds: Number(response.huntingTime?.remainingSeconds) || 0,
      offline,
      now
    });
  }

  function rollBasicAttackDamage(profile, {
    activeElements = [],
    comboCount = 0,
    hpPercent = null
  } = {}) {
    const ammunition = getCombatAmmunition(profile);
    const skillEffects = profile.skillEffects || {};
    const critical = Math.random() * 100
      < Number(profile.derivedStats?.criticalChance || 0);
    let multiplier = 1 + Number(skillEffects.damageIncreasePercent || 0) / 100;
    if (activeElements.length) {
      multiplier *= 1 + Number(skillEffects.elementDamageIncreasePercent || 0) / 100;
    }
    if (skillEffects.comboEnabled) {
      multiplier *= 1
        + Math.max(0, Number(comboCount) || 0)
          * Number(skillEffects.comboDamagePerCount || 0) / 100;
    }
    if (
      hpPercent != null
      && skillEffects.lowHpThresholdPercent
      && Number(hpPercent) <= Number(skillEffects.lowHpThresholdPercent)
    ) {
      multiplier *= 1 + Number(skillEffects.lowHpDamageIncreasePercent || 0) / 100;
    }
    if (critical) {
      multiplier *= Number(profile.derivedStats?.criticalDamagePercent || 200) / 100;
    }
    if (isMageProfile(profile)) {
      return {
        damage: 1,
        damageRange: scaleDamageRange(buildProfileMagicDamageRange(profile, 100), multiplier),
        critical,
        ammunition
      };
    }
    const minimum = Math.max(0, Number(profile.derivedStats?.attackMinimum) || 0);
    const maximum = Math.max(minimum, Number(profile.derivedStats?.attackMaximum) || 0);
    let damage = maximum > 0
      ? minimum + Math.random() * (maximum - minimum)
      : 5;
    damage += Number(ammunition?.attackBonus) || 0;
    damage *= multiplier;
    return { damage, damageRange: null, critical, ammunition };
  }

  function applyConfiguredAutoPotions(character) {
    const consumableMultiplier = Math.max(
      100,
      Number(getActiveSkillEffects(character).consumableEffectPercent) || 100
    );
    const resourceCaps = buildCharacterResponse(character).resources;
    return useConfiguredAutoPotions(
      character,
      consumableMultiplier,
      { hp: resourceCaps.maxHp, mp: resourceCaps.maxMp }
    );
  }

  const OFFLINE_AUTO_SKILL_DAMAGE_EFFECTS = new Set([
    'damage', 'multi-damage', 'ignore-defense-damage', 'damage-stun',
    'damage-lock', 'charge', 'consume-combo-damage', 'pull',
    'element-explosion', 'nonlethal-damage', 'fixed-damage'
  ]);

  function hasActiveOfflineSkillEffect(skillState, skillId, definition, now) {
    const refreshBeforeMs = 3_000;
    if (['element_fire', 'element_ice'].includes(skillId)) {
      return (skillState.activeBuffs || []).some((buff) => (
        ['element_fire', 'element_ice'].includes(buff.skillId)
        && (!buff.expiresAt || new Date(buff.expiresAt).getTime() > now + refreshBeforeMs)
      ));
    }
    if (
      definition.effect === 'summon'
      && skillState.summon?.skillId === skillId
      && (
        !skillState.summon.expiresAt
        || new Date(skillState.summon.expiresAt).getTime() > now + refreshBeforeMs
      )
    ) {
      return true;
    }
    return (skillState.activeBuffs || []).some((buff) => (
      buff.skillId === skillId
      && (!buff.expiresAt || new Date(buff.expiresAt).getTime() > now + refreshBeforeMs)
    ));
  }

  function getOfflineAutoSkill(character, profile, target, now) {
    const skillState = ensureSkillState(character);
    const activePreset = [...(skillState.activePreset || [])].map(String);
    const autoPreset = [...(skillState.autoPreset || [])].map(String);
    if (!autoPreset.length) return null;
    const autoSet = new Set(autoPreset);
    const equippedWeaponType = String(character.loadout?.weapon?.weaponType || '');
    const currentHp = Math.max(0, Number(character.resources?.currentHp) || 0);
    const currentMp = Math.max(0, Number(character.resources?.currentMp) || 0);
    const maxHp = Math.max(1, Number(character.resources?.maxHp) || 1);
    const preUseEffects = getActiveSkillEffects(character, now);
    const archetype = DEPARTMENTS[character.job?.departmentId]?.archetype || 'beginner';
    const startIndex = skillState.offlineAutoRotationCursor % activePreset.length;
    for (let offset = 0; offset < activePreset.length; offset += 1) {
      const presetIndex = (startIndex + offset) % activePreset.length;
      const skillId = activePreset[presetIndex];
      if (!autoSet.has(skillId)) continue;
      const definition = SKILL_DEFINITIONS[skillId];
      const level = getSkillLevel(character, skillId);
      if (!definition || definition.passive || level <= 0) continue;
      if (definition.effect === 'party-portal') continue;
      if (definition.effect === 'teleport') continue;
      if (
        definition.effect === 'cleanse-self'
        && !isPlayerSilenced(
          String(character.userId),
          String(profile.worldState?.mapId || character.worldState?.mapId || ''),
          now
        )
      ) continue;
      if (Number(skillState.cooldowns?.[skillId]) > now) continue;
      if (hasActiveOfflineSkillEffect(skillState, skillId, definition, now)) continue;
      if (
        Array.isArray(definition.weaponTypes)
        && definition.weaponTypes.length
        && !definition.weaponTypes.includes(equippedWeaponType)
      ) {
        continue;
      }
      if (OFFLINE_AUTO_SKILL_DAMAGE_EFFECTS.has(definition.effect) && !target) continue;
      if (definition.effect === 'consume-combo-damage' && skillState.comboCount <= 0) continue;
      if (definition.effect === 'element-explosion' && !getActiveWeaponElements(skillState, now).length) {
        continue;
      }
      const values = resolveSkillValues(definition, level);
      const castProfile = resolveSkillCastProfile(values);
      if (values.minimumHpPercent && currentHp / maxHp * 100 < values.minimumHpPercent) continue;
      const hpCost = Math.max(
        0,
        Math.floor(Number(values.hpCost) || maxHp * Number(values.maxHpCostPercent || 0) / 100)
      );
      const baseMpCost = Math.max(0, Number(values.mpCost) || 0);
      const magicAttackAmplified = archetype === 'mage'
        && ['enemy', 'enemies'].includes(definition.target);
      const mpCost = Math.max(0, Math.floor(
        baseMpCost * (
          1 + (
            magicAttackAmplified
              ? Number(preUseEffects.magicMpCostIncreasePercent) || 0
              : 0
          ) / 100
        ) * castProfile.mpCostMultiplier
      ));
      if (currentHp <= hpCost || currentMp < mpCost) continue;
      skillState.offlineAutoRotationCursor = (presetIndex + 1) % activePreset.length;
      return {
        skillId, definition, level, values, castProfile,
        hpCost, mpCost, preUseEffects, archetype
      };
    }
    return null;
  }

  async function applyOfflineAutoSkill({ character, profile, target, now }) {
    const selected = getOfflineAutoSkill(character, profile, target, now);
    if (!selected) return null;
    const {
      skillId, definition, values, castProfile,
      hpCost, mpCost, preUseEffects, archetype
    } = selected;
    const skillState = ensureSkillState(character);
    const mapId = String(profile.worldState?.mapId || character.worldState?.mapId || '');
    const targetId = String(target?.id || '');
    let combat = null;
    let partyBuffToShare = null;
    let supportTargetIds = [];
    const comboBefore = Math.max(0, Number(skillState.comboCount) || 0);

    if (OFFLINE_AUTO_SKILL_DAMAGE_EFFECTS.has(definition.effect)) {
      const upgradedAudit = definition.name === '4중 감사'
        && Number(preUseEffects.upgradedAuditHits) > 0;
      const ammunition = definition.effect === 'fixed-damage'
        ? null
        : getCombatAmmunition(profile);
      const ammunitionCount = Math.max(
        1,
        upgradedAudit
          ? Number(preUseEffects.upgradedAuditHits)
          : castProfile.hitCount
      );
      if (
        ammunition
        && !preUseEffects.noAmmoConsumption
        && !(profile.inventory?.items || []).some(
          (item) => item.id === ammunition.itemId && Number(item.quantity) >= ammunitionCount
        )
      ) {
        return null;
      }
      let skillPercentForRuntime = upgradedAudit
        ? Number(preUseEffects.upgradedAuditDamagePercent)
        : (definition.effect === 'element-explosion'
          ? Number(preUseEffects.elementExplosionDamagePercent || values.damagePercent || 250)
          : Number(values.damagePercent) || 100);
      let damageRange = null;
      let baseDamage = definition.effect === 'fixed-damage'
        ? Math.max(1, Number(values.fixedDamage) || 1)
        : Math.max(1, Number(profile.derivedStats.attackMaximum) || 4);
      if (archetype === 'mage' && definition.effect !== 'fixed-damage') {
        damageRange = buildProfileMagicDamageRange(profile, skillPercentForRuntime);
        baseDamage = 1;
        skillPercentForRuntime = 100;
      } else {
        baseDamage += Number(ammunition?.attackBonus) || 0;
      }
      const activeElements = getActiveWeaponElements(skillState, now);
      const rollCriticalPerHit = castProfile.channelDurationSeconds > 0
        && definition.effect !== 'fixed-damage';
      const critical = !rollCriticalPerHit && definition.effect !== 'fixed-damage'
        && Math.random() * 100 < Number(profile.derivedStats.criticalChance || 0);
      let damageMultiplier = 1;
      if (critical) {
        damageMultiplier *= Number(profile.derivedStats.criticalDamagePercent || 200) / 100;
      }
      damageMultiplier *= 1 + Number(preUseEffects.damageIncreasePercent || 0) / 100;
      if (activeElements.length) {
        damageMultiplier *= 1 + Number(preUseEffects.elementDamageIncreasePercent || 0) / 100;
      }
      if (preUseEffects.comboEnabled) {
        damageMultiplier *= 1
          + Number(skillState.comboCount || 0)
            * Number(preUseEffects.comboDamagePerCount || 0) / 100;
      }
      const resourcePercent = Math.max(0, Number(character.resources?.currentHp) || 0)
        / Math.max(1, Number(character.resources?.maxHp) || 1)
        * 100;
      if (
        preUseEffects.lowHpThresholdPercent
        && resourcePercent <= Number(preUseEffects.lowHpThresholdPercent)
      ) {
        damageMultiplier *= 1 + Number(preUseEffects.lowHpDamageIncreasePercent || 0) / 100;
      }
      if (damageRange) damageRange = scaleDamageRange(damageRange, damageMultiplier);
      else baseDamage *= damageMultiplier;
      const doubleStrike = Math.random() * 100
        < Number(preUseEffects.doubleStrikeChance || 0);
      combat = useSkillOnMonsters({
        userId: String(character.userId),
        mapId,
        targetId,
        baseDamage,
        damageRange,
        skillPercent: skillPercentForRuntime,
        rangePx: Number(values.range ?? definition.range) || 100,
        maxTargets: Number(values.targetCount ?? definition.maxTargets) || 1,
        hits: upgradedAudit
          ? Number(preUseEffects.upgradedAuditHits)
          : castProfile.hitCount,
        bonusAttackPercent: doubleStrike
          ? Number(preUseEffects.doubleStrikeDamagePercent || 0)
          : 0,
        element: definition.element,
        elements: activeElements.length ? activeElements : [definition.element],
        ignoreDefense: ['ignore-defense-damage', 'fixed-damage'].includes(definition.effect),
        damageType: archetype === 'mage' ? 'magic' : 'physical',
        accuracy: profile.derivedStats.accuracy,
        playerLevel: profile.progression?.level,
        mpAbsorbChance: Number(preUseEffects.mpAbsorbChance) || 0,
        mpAbsorbPercent: Number(preUseEffects.mpAbsorbPercent) || 0,
        poisonChance: Number(preUseEffects.poisonChance) || 0,
        poisonAttack: Number(preUseEffects.poisonAttack) || 0,
        poisonDurationSeconds: Number(preUseEffects.poisonDurationSeconds) || 0,
        poisonMaxStacks: Number(preUseEffects.poisonMaxStacks) || 0,
        stunChance: Number(values.stunChance) || 0,
        stunSeconds: Number(values.stunSeconds) || 0,
        moveCasterToTarget: Boolean(values.moveCasterToTarget),
        pull: ['charge', 'pull'].includes(definition.effect),
        dealDamage: definition.effect !== 'pull',
        leaveAtOneHp: definition.effect === 'nonlethal-damage',
        piercing: Boolean(definition.piercing),
        verticalFloorRange: Number(values.verticalFloorRange ?? definition.verticalFloorRange) || 0,
        criticalChance: Number(profile.derivedStats.criticalChance) || 0,
        criticalDamagePercent: Number(profile.derivedStats.criticalDamagePercent) || 200,
        rollCriticalPerHit,
        retargetEachHit: castProfile.channelDurationSeconds > 0,
        now
      });
      if (!combat.success) return null;
      if (combat.casterMovement) {
        character.worldState.mapId = mapId;
        character.worldState.x = combat.casterMovement.x;
        character.worldState.floor = combat.casterMovement.floor;
      }
      combat.critical = rollCriticalPerHit
        ? combat.outcomes.some((outcome) => outcome.hitResults?.some((hit) => hit.critical))
        : critical;
      if (castProfile.channelDurationSeconds > 0) {
        combat.channel = {
          durationMs: Math.round(castProfile.channelDurationSeconds * 1000),
          intervalMs: Math.round(castProfile.channelIntervalSeconds * 1000),
          hitCount: castProfile.hitCount,
          projectileSpeedMultiplier: Number(values.projectileSpeedMultiplier) || 1,
          hitResults: combat.outcomes.flatMap((outcome) => outcome.hitResults || [])
        };
      }
      clearStealthBuff(skillState);
      character.resources.currentHp = Math.max(0, Number(character.resources.currentHp) - hpCost);
      character.resources.currentMp = Math.max(0, Number(character.resources.currentMp) - mpCost);
      if (ammunition && !preUseEffects.noAmmoConsumption) {
        consumeInventoryItem(character, ammunition.itemId, ammunitionCount);
      }
      if (Number(combat.mpAbsorbed) > 0) {
        restoreCharacterMp(character, combat.mpAbsorbed);
      }
      if (definition.effect === 'consume-combo-damage') skillState.comboCount = 0;
      if (definition.effect === 'damage-stun' && Number(values.consumeCombo)) {
        skillState.comboCount = Math.max(0, skillState.comboCount - Number(values.consumeCombo));
      }
      if (
        preUseEffects.comboEnabled
        && !['consume-combo-damage', 'damage-stun'].includes(definition.effect)
        && combat.outcomes?.some((outcome) => !outcome.missed && outcome.damage > 0)
      ) {
        const charge = Math.random() * 100
          < Number(preUseEffects.comboDoubleChargeChance || 0) ? 2 : 1;
        skillState.comboCount = Math.min(
          Number(preUseEffects.comboMaximum) || 5,
          Number(skillState.comboCount || 0) + charge
        );
      }
      if (Number(combat.expReward) > 0) {
        const expGrant = await grantCombatExperience(character, combat.expReward, mapId);
        combat.experience = expGrant.self;
        combat.partyExperience = expGrant.party;
        combat.drops = applyCombatDrops(character, combat.drops);
        combat.drops = applySettlementEventDrops(
          character,
          (combat.outcomes || [])
            .filter((outcome) => outcome.defeated)
            .map((outcome) => outcome.monsterLevel),
          combat.drops
        );
      }
      recordCombatQuestProgress(character, combat, {
        mapId,
        elements: activeElements.length ? activeElements : [definition.element],
        stealth: Number(preUseEffects.stealth) > 0
      });
      if (
        definition.effect === 'element-explosion'
        && Math.random() * 100 >= Number(preUseEffects.elementPreserveChance || 0)
      ) {
        skillState.activeBuffs = skillState.activeBuffs.filter(
          (buff) => !ELEMENT_BUFF_SKILL_IDS.includes(buff.skillId)
        );
      }
    } else if (definition.effect === 'heal') {
      character.resources.currentHp = Math.max(0, Number(character.resources.currentHp) - hpCost);
      character.resources.currentMp = Math.max(0, Number(character.resources.currentMp) - mpCost);
      const healingAmount = Math.max(
        1,
        Math.floor(
          Math.max(1, Number(profile.derivedStats?.magic) || 1)
            * Math.max(0, Number(values.healPercent) || 0)
            / 100
        )
      );
      const healedTargets = await healActivePartyMembers({
        caster: character,
        mapId,
        rangePx: Number(values.range ?? definition.range) || 400,
        amount: healingAmount
      });
      supportTargetIds = healedTargets
        .filter((entry) => Number(entry.healed) > 0)
        .map((entry) => String(entry.userId));
      const welfareDamage = definition.name === '복지 지원'
        ? calculateWelfareSupportDamage({
          workKnowledge: profile.derivedStats?.effectiveStats?.workKnowledge,
          awareness: profile.derivedStats?.effectiveStats?.awareness,
          magic: profile.derivedStats?.magic,
          targetCount: 1,
          healPercent: values.healPercent
        })
        : Math.max(1, Number(profile.derivedStats?.magic) || 1);
      combat = useSkillOnMonsters({
        userId: String(character.userId),
        mapId,
        targetId,
        baseDamage: welfareDamage,
        skillPercent: definition.name === '복지 지원'
          ? 100
          : Math.max(0, Number(values.healPercent) || 0),
        rangePx: Number(values.range ?? definition.range) || 400,
        maxTargets: 15,
        damageType: 'magic',
        element: 'holy',
        accuracy: profile.derivedStats?.accuracy,
        playerLevel: profile.progression?.level,
        undeadOnly: true,
        now
      });
      if (combat.success && Number(combat.expReward) > 0) {
        const expGrant = await grantCombatExperience(character, combat.expReward, mapId);
        combat.experience = expGrant.self;
        combat.partyExperience = expGrant.party;
        combat.drops = applyCombatDrops(character, combat.drops);
      }
      if (combat.success) {
        recordCombatQuestProgress(character, combat, {
          mapId,
          element: 'holy',
          elements: ['holy'],
          stealth: Number(preUseEffects.stealth) > 0
        });
      }
    } else if (definition.effect === 'monster-transform') {
      combat = useSkillOnMonsters({
        userId: String(character.userId),
        mapId,
        targetId,
        baseDamage: 1,
        skillPercent: 0,
        rangePx: Number(values.range ?? definition.range) || 350,
        maxTargets: Number(values.targetCount ?? definition.maxTargets) || 6,
        accuracy: profile.derivedStats.accuracy,
        playerLevel: profile.progression?.level,
        dealDamage: false,
        excludeFieldBoss: true,
        outgoingDamageReductionPercent: Number(values.enemyDamageReductionPercent) || 50,
        debuffChance: Number(values.successChance) || 0,
        debuffDurationSeconds: Number(values.durationSeconds) || 20,
        now
      });
      if (!combat.success) return null;
      character.resources.currentHp = Math.max(0, Number(character.resources.currentHp) - hpCost);
      character.resources.currentMp = Math.max(0, Number(character.resources.currentMp) - mpCost);
    } else if (definition.effect === 'cleanse-self') {
      character.resources.currentHp = Math.max(0, Number(character.resources.currentHp) - hpCost);
      character.resources.currentMp = Math.max(0, Number(character.resources.currentMp) - mpCost);
      const cleansed = clearPlayerNegativeStatus(String(character.userId), mapId);
      combat = { success: true, cleansed };
    } else if (definition.effect === 'debuff-self-buff') {
      combat = useSkillOnMonsters({
        userId: String(character.userId),
        mapId,
        targetId,
        baseDamage: 1,
        skillPercent: 0,
        rangePx: Number(values.range ?? definition.range) || 450,
        maxTargets: Number(values.targetCount ?? definition.maxTargets) || 15,
        accuracy: profile.derivedStats.accuracy,
        playerLevel: profile.progression?.level,
        dealDamage: false,
        outgoingDamageReductionPercent: Number(values.enemyDamageReductionPercent) || 0,
        debuffChance: Number(values.successChance) || 0,
        debuffDurationSeconds: Number(values.durationSeconds) || 0,
        now
      });
      if (!combat.success) return null;
      character.resources.currentHp = Math.max(0, Number(character.resources.currentHp) - hpCost);
      character.resources.currentMp = Math.max(0, Number(character.resources.currentMp) - mpCost);
      const activeBuff = upsertActiveBuff(character, {
        skillId,
        name: definition.name,
        effects: {
          damageIncreasePercent: Number(values.damageIncreasePercent) || 0,
          accuracyIncrease: Number(values.accuracyIncrease) || 0
        },
        createdAt: new Date(now),
        durationSeconds: Math.max(1, Number(values.durationSeconds) || 1)
      });
      combat = { ...combat, appliedBuff: activeBuff };
    } else if (definition.effect === 'summon') {
      character.resources.currentHp = Math.max(0, Number(character.resources.currentHp) - hpCost);
      character.resources.currentMp = Math.max(0, Number(character.resources.currentMp) - mpCost);
      skillState.summon = buildSummonState(definition, values, now);
      combat = { success: true, summon: skillState.summon };
    } else {
      character.resources.currentHp = Math.max(0, Number(character.resources.currentHp) - hpCost);
      character.resources.currentMp = Math.max(0, Number(character.resources.currentMp) - mpCost);
      if (definition.effect === 'combo-buff') skillState.comboCount = 0;
      const effects = buildActiveBuffEffects(values);
      if (definition.effect === 'element-buff') {
        const conflicting = skillId === 'element_fire'
          ? new Set(['element_fire', 'element_ice'])
          : (skillId === 'element_ice'
            ? new Set(['element_fire', 'element_ice'])
            : new Set([skillId]));
        skillState.activeBuffs = skillState.activeBuffs.filter(
          (buff) => !conflicting.has(buff.skillId)
        );
      }
      if (Number.isFinite(Number(values.reflectPercent))) {
        effects.reflectPercent = Number(values.reflectPercent);
      }
      if (Number.isFinite(Number(values.targetMaxHpCapPercent))) {
        effects.targetMaxHpCapPercent = Number(values.targetMaxHpCapPercent);
      }
      if (effects.reflectPercent) effects.contactReflectPercent = effects.reflectPercent;
      if (effects.targetMaxHpCapPercent) {
        effects.contactReflectCapPercent = effects.targetMaxHpCapPercent;
      }
      if (definition.effect === 'combo-buff') {
        effects.comboEnabled = 1;
        effects.comboMaximum = Number(values.maxCombo) || 5;
        effects.comboDamagePerCount = Number(values.damagePerComboPercent) || 0;
      }
      const activeBuff = upsertActiveBuff(character, {
        skillId,
        name: definition.name,
        effects,
        createdAt: new Date(now),
        durationSeconds: Math.max(1, Number(values.durationSeconds) || 1)
      });
      if (definition.target === 'party') partyBuffToShare = activeBuff;
      combat = { success: true, appliedBuff: activeBuff };
    }

    if (castProfile.lockSeconds > 0) {
      skillState.cooldowns[skillId] = now + castProfile.lockSeconds * 1000;
    }
    reconcileMaxResourceBuff(character);
    character.markModified('skills');
    recordSkillUse(String(character.userId), mapId, definition.name, now);
    if (partyBuffToShare) {
      const buffedPartyMemberIds = await applyBuffToActivePartyMembers(
        String(character.userId),
        mapId,
        partyBuffToShare
      );
      supportTargetIds.push(...buffedPartyMemberIds);
      combat = {
        ...(combat || { success: true }),
        buffedPartyMemberIds
      };
    }
    recordSkillQuestProgress(character, {
      skillId,
      skillIds: [definition.id],
      combat,
      mapId,
      comboBefore,
      comboAfter: Number(skillState.comboCount) || 0,
      supportTargetIds
    });
    return { skillId, name: definition.name, combat };
  }

  async function processAttackingSummon({ character, profile, now = Date.now() }) {
    const skillState = ensureSkillState(character);
    const summon = skillState.summon;
    if (!isAttackingSummon(summon, now) || !isSummonAttackDue(summon, now)) return null;

    // Advance the summon clock even when no target is in range so a heartbeat cannot
    // repeatedly retry the same attack and overload the combat queue.
    summon.lastAttackAt = new Date(now);
    if (typeof character.markModified === 'function') character.markModified('skills');

    const mapId = String(profile.worldState?.mapId || character.worldState?.mapId || '');
    const archetype = DEPARTMENTS[character.job?.departmentId]?.archetype || 'beginner';
    const activeEffects = profile.skillEffects || getActiveSkillEffects(character);
    const critical = Math.random() * 100
      < Math.max(0, Number(profile.derivedStats?.criticalChance) || 0);
    let multiplier = 1 + Math.max(0, Number(activeEffects.damageIncreasePercent) || 0) / 100;
    if (critical) {
      multiplier *= Math.max(100, Number(profile.derivedStats?.criticalDamagePercent) || 200) / 100;
    }
    let damageRange = null;
    let baseDamage = Math.max(1, Number(profile.derivedStats?.attackMaximum) || 4);
    let skillPercent = Math.max(1, Number(summon.attackPower) || 1);
    if (archetype === 'mage') {
      damageRange = scaleDamageRange(
        buildProfileMagicDamageRange(profile, skillPercent),
        multiplier
      );
      baseDamage = 1;
      skillPercent = 100;
    } else {
      baseDamage *= multiplier;
    }

    const combat = useSkillOnMonsters({
      userId: String(character.userId),
      mapId,
      targetId: '',
      baseDamage,
      damageRange,
      skillPercent,
      rangePx: Math.max(1, Number(summon.range) || 100),
      maxTargets: Math.max(1, Number(summon.maxTargets) || 1),
      damageType: archetype === 'mage' ? 'magic' : 'physical',
      element: String(summon.element || 'neutral'),
      accuracy: profile.derivedStats?.accuracy,
      playerLevel: profile.progression?.level,
      stunChance: Number(summon.stunChance) || 0,
      stunSeconds: Number(summon.stunSeconds) || 0,
      now
    });
    if (!combat.success) return { ...combat, summonAttack: true, critical };

    combat.summonAttack = true;
    combat.summon = {
      skillId: summon.skillId,
      name: summon.name,
      icon: summon.icon
    };
    combat.critical = critical;
    if (Array.isArray(combat.fieldBossRewards) && combat.fieldBossRewards.length) {
      combat.fieldBossRewardResults = [];
      for (const rewardEvent of combat.fieldBossRewards) {
        combat.fieldBossRewardResults.push(await applyFieldBossRewards(rewardEvent, character));
      }
    }
    if (Number(combat.expReward) > 0) {
      const expGrant = await grantCombatExperience(character, combat.expReward, mapId);
      combat.experience = expGrant.self;
      combat.partyExperience = expGrant.party;
      combat.drops = applyCombatDrops(character, combat.drops);
      combat.drops = applySettlementEventDrops(
        character,
        (combat.outcomes || [])
          .filter((outcome) => outcome.defeated)
          .map((outcome) => outcome.monsterLevel),
        combat.drops
      );
    }
    recordCombatQuestProgress(character, combat, {
      mapId,
      elements: [String(summon.element || 'neutral')],
      stealth: Number(activeEffects.stealth) > 0
    });
    return combat;
  }

  async function processOfflineHunterAction({ character, userId, now, passiveBaselineAt }) {
    applyOfflinePassiveMpRecovery(character, { now, baselineAt: passiveBaselineAt });
    recordCompanionQuestTicks(character, now);
    let response = buildCharacterResponse(character);
    let state = buildWorldPresenceFromResponse(response, { userId, offline: true, now });
    const selfContact = state.contactEvents.find(
      (event) => String(event.userId) === String(userId)
    );
    if (selfContact) {
      const beforeHp = Math.max(0, Number(character.resources.currentHp) || 0);
      const beforeMp = Math.max(0, Number(character.resources.currentMp) || 0);
      character.resources.currentHp = Number.isFinite(Number(selfContact.currentHp))
        ? Math.max(0, Number(selfContact.currentHp))
        : Math.max(0, beforeHp - Number(selfContact.damage || 0));
      character.resources.currentMp = Number.isFinite(Number(selfContact.currentMp))
        ? Math.max(0, Number(selfContact.currentMp))
        : beforeMp;
      character.worldState.x = Math.max(0, Math.min(94, Number(selfContact.x) || 8));
      character.worldState.floor = Number(selfContact.floor) === 1 ? 1 : 0;
      if (beforeHp > 0 && character.resources.currentHp <= 0) {
        recordQuestEvent(character, { type: 'death' });
        const requiredExp = getRequiredExpV2(character.progression?.level);
        const currentExp = Math.max(0, Number(character.progression?.exp) || 0);
        character.progression.exp = currentExp - Math.min(
          currentExp,
          Math.floor(requiredExp * 0.1)
        );
        character.huntingTime.enabled = false;
      } else if (
        beforeHp > 0
        && character.resources.currentHp > 0
        && Number(selfContact.damage) > 0
      ) {
        recordQuestEvent(character, {
          type: 'hit-survive',
          mapId: String(character.worldState?.mapId || ''),
          hpPercent: character.resources.currentHp
            / Math.max(1, Number(character.resources.maxHp) || 1)
            * 100,
          amount: 1
        });
      }
      updatePlayerResources(userId, character.resources);
    }
    const selfRecovery = state.recoveryEvents.find(
      (event) => String(event.userId) === String(userId)
    );
    if (selfRecovery && Number(character.resources?.currentHp) > 0) {
      character.resources.currentHp = Math.min(
        Math.max(1, Number(character.resources.maxHp) || 1),
        Math.max(0, Number(character.resources.currentHp) || 0)
          + Math.max(0, Number(selfRecovery.hpAmount) || 0)
      );
      updatePlayerResources(userId, character.resources);
    }
    applyConfiguredAutoPotions(character);
    response = buildCharacterResponse(character);
    updatePlayerResources(userId, response.resources);
    if (!character.huntingTime.enabled || Number(character.resources.currentHp) <= 0) {
      return { stopped: true };
    }

    state = buildWorldPresenceFromResponse(response, {
      userId,
      x: character.worldState?.x,
      floor: character.worldState?.floor,
      activity: 'combat',
      motion: response.combatPresentation?.motion || 'idle',
      offline: true,
      now
    });
    const self = state.players.find((player) => String(player.userId) === String(userId));
    const sameFloorMonsters = state.monsters.filter(
      (monster) => Number(monster.floor) === Number(self?.floor)
    );
    const target = sameFloorMonsters.sort((left, right) => (
      Math.abs(Number(left.x) - Number(self?.x))
      - Math.abs(Number(right.x) - Number(self?.x))
    ))[0];
    if (!target) return { idle: true };

    const summonCombat = await processAttackingSummon({ character, profile: response, now });
    if (summonCombat?.success) {
      const summonKills = (summonCombat.outcomes || [])
        .filter((outcome) => outcome.defeated).length;
      recordOfflineHuntingSummary(character, {
        exp: summonCombat.experience?.gained,
        kills: summonKills,
        drops: summonCombat.drops || []
      }, now);
      response = buildCharacterResponse(character);
    }

    const rangePx = Number(response.combatPresentation?.rangePx)
      || Number(response.derivedStats?.attackRange)
      || 100;
    const rangePercent = Math.max(1, rangePx / 1200 * 100);
    const distance = Math.abs(Number(target.x) - Number(self?.x));
    if (distance > rangePercent + 4.5) {
      const direction = Number(target.x) >= Number(self?.x) ? 1 : -1;
      const movementStep = Math.max(
        1,
        Math.min(8, 4 * (Number(response.derivedStats?.movementSpeed) || 100) / 100)
      );
      const nextX = Math.max(0, Math.min(
        94,
        Number(self?.x) + direction * Math.min(movementStep, distance - rangePercent - 3.5)
      ));
      character.worldState.x = nextX;
      character.worldState.floor = Number(self?.floor) === 1 ? 1 : 0;
      buildWorldPresenceFromResponse(response, {
        userId,
        x: nextX,
        floor: character.worldState.floor,
        activity: 'moving',
        motion: 'walk',
        offline: true,
        now
      });
      return { moved: true };
    }

    const autoSkillResult = await applyOfflineAutoSkill({
      character,
      profile: response,
      target,
      now
    });
    if (autoSkillResult?.combat?.success) {
      const combat = autoSkillResult.combat;
      const kills = (combat.outcomes || []).filter((outcome) => outcome.defeated).length;
      recordOfflineHuntingSummary(character, {
        exp: combat.experience?.gained,
        kills,
        skillUses: 1,
        drops: combat.drops || []
      }, now);
      updatePlayerResources(userId, character.resources);
      return { acted: true, usedSkill: true };
    }

    if (!canUseBasicAttack(character)) return { idle: true };

    response = buildCharacterResponse(character);
    const activeElements = getActiveWeaponElements(response.skillTree);
    const rolled = rollBasicAttackDamage(response, { activeElements });
    const consumesAmmunition = rolled.ammunition
      && !response.skillEffects?.noAmmoConsumption;
    const hasAmmunition = !consumesAmmunition
      || (response.inventory?.items || []).some(
        (item) => item.id === rolled.ammunition.itemId && Number(item.quantity) > 0
      );
    if (!hasAmmunition) return { idle: true };

    const result = attackMonster({
      userId: String(userId),
      mapId: String(response.worldState.mapId),
      monsterId: String(target.id),
      damage: rolled.damage,
      damageRange: rolled.damageRange,
      rangePx,
      damageType: DEPARTMENTS[response.job?.departmentId]?.archetype === 'mage'
        ? 'magic'
        : 'physical',
      elements: activeElements,
      accuracy: response.derivedStats.accuracy,
      playerLevel: response.progression.level,
      now
    });
    if (!result.success) return { idle: true };
    if (consumesAmmunition) consumeInventoryItem(character, rolled.ammunition.itemId, 1);
    if (result.expReward > 0) {
      const expGrant = await grantCombatExperience(character, result.expReward, response.worldState.mapId);
      result.experience = expGrant.self;
      result.drops = applyCombatDrops(character, result.drops);
      result.drops = applySettlementEventDrops(character, [result.monsterLevel], result.drops);
    }
    recordCombatQuestProgress(character, result, {
      mapId: String(response.worldState.mapId || ''),
      elements: activeElements,
      stealth: Number(response.skillEffects?.stealth) > 0
    });
    if (response.skillEffects?.comboEnabled && !result.missed && result.damage > 0) {
      const skills = ensureSkillState(character);
      const previousCombo = Math.max(0, Number(skills.comboCount) || 0);
      const charge = Math.random() * 100
        < Number(response.skillEffects.comboDoubleChargeChance || 0) ? 2 : 1;
      skills.comboCount = Math.min(
        Number(response.skillEffects.comboMaximum) || 5,
        previousCombo + charge
      );
      const gained = Math.max(0, skills.comboCount - previousCombo);
      if (gained > 0) recordQuestEvent(character, { type: 'combo-gain', amount: gained });
      character.markModified('skills');
    }
    recordOfflineHuntingSummary(character, {
      exp: result.experience?.gained,
      kills: result.defeated ? 1 : 0,
      drops: result.drops || []
    }, now);
    updatePlayerResources(userId, character.resources);
    return { acted: true };
  }

  async function processOfflineHunter(userId, now = Date.now()) {
    if (hasRecentWorldControl(userId, now)) return;
    return withCharacterMutation(userId, async () => {
      if (hasRecentWorldControl(userId)) return;
      const character = await V2Character.findOne({ userId });
      if (!character?.huntingTime?.enabled) return;
      const lastTickAt = character.huntingTime?.lastTickAt
        ? new Date(character.huntingTime.lastTickAt).getTime()
        : now;
      const elapsedMs = Math.max(0, now - lastTickAt);
      tickHuntingTime(character, true, now);
      if (elapsedMs > 0) {
        recordOfflineHuntingSummary(character, { elapsedMs }, now);
      }
      if (!character.huntingTime.enabled || Number(character.resources?.currentHp) <= 0) {
        await character.save();
        worldProfileCache.delete(String(userId));
        return;
      }

      const actionCount = Math.max(
        1,
        Math.min(
          OFFLINE_HUNTING_MAX_ACTIONS_PER_SWEEP,
          Math.floor(Math.max(elapsedMs, OFFLINE_HUNTING_SWEEP_MS) / OFFLINE_HUNTING_ACTION_INTERVAL_MS)
        )
      );
      for (let index = 0; index < actionCount; index += 1) {
        if (!character.huntingTime.enabled || Number(character.resources?.currentHp) <= 0) break;
        const actionNow = now - Math.max(0, actionCount - index - 1) * OFFLINE_HUNTING_ACTION_INTERVAL_MS;
        const result = await processOfflineHunterAction({
          character,
          userId,
          now: actionNow,
          passiveBaselineAt: lastTickAt
        });
        if (result?.stopped) break;
      }

      await character.save();
      worldProfileCache.delete(String(userId));
    });
  }

  let offlineHuntingSweepRunning = false;
  async function runOfflineHuntingSweep() {
    if (offlineHuntingSweepRunning || V2Character.db?.readyState !== 1) return;
    offlineHuntingSweepRunning = true;
    try {
      const onlineIds = new Set(
        listAllActivePlayers()
          .filter((player) => player.online)
          .map((player) => String(player.userId))
      );
      const query = {
        'huntingTime.enabled': true,
        'huntingTime.remainingSeconds': { $gt: 0 },
        'resources.currentHp': { $gt: 0 }
      };
      if (onlineIds.size) query.userId = { $nin: [...onlineIds] };
      const candidates = await V2Character.find(query)
        .select('userId')
        .sort({ updatedAt: 1 })
        .limit(OFFLINE_HUNTING_BATCH_SIZE)
        .lean();
      for (const candidate of candidates) {
        const userId = String(candidate.userId);
        await processOfflineHunter(userId);
      }
    } catch (err) {
      console.error('V2 offline hunting sweep error:', err);
    } finally {
      offlineHuntingSweepRunning = false;
    }
  }

  function requireV2User(req, res) {
    try {
      const token = getBearerToken(req);
      if (!token) {
        res.status(401).json({ msg: '로그인이 필요합니다.' });
        return null;
      }
      const payload = jwt.verify(token, jwtSecret);
      if (!payload?.id || payload?.admin) {
        res.status(403).json({ msg: '유저 계정 인증이 필요합니다.' });
        return null;
      }
      return payload;
    } catch (err) {
      res.status(401).json({ msg: '로그인이 만료되었습니다.' });
      return null;
    }
  }

  function requireWorldControl(req, res, auth) {
    const clientId = String(req.body?.clientId || '').trim();
    if (!clientId || !hasWorldControl(auth.id, clientId)) {
      res.status(409).json({
        code: 'WORLD_CONTROL_LOST',
        msg: '다른 기기에서 같은 계정으로 접속하여 현재 기기의 월드 연결이 종료되었습니다.'
      });
      return null;
    }
    return clientId;
  }

  app.get('/api/v2/meta', (req, res) => {
    res.json({
      version: '2.0.0-prealpha',
      phase: 'migration-foundation',
      maxLevel: MAX_LEVEL,
      migrationVersion: MIGRATION_VERSION,
      levelCurve: LEGACY_CURVE,
      retainedFeatures: V2_RETAINED_FEATURES,
      removedFeatures: V2_REMOVED_FEATURES,
      plannedFeatures: V2_PLANNED_FEATURES,
      departments: Object.entries(DEPARTMENTS).map(([id, department]) => ({
        id,
        name: department.name,
        jobs: department.jobs,
        primaryStat: department.primaryStat,
        secondaryStat: department.secondaryStat,
        archetype: department.archetype
      })),
      v1Unaffected: true
    });
  });

  app.get('/api/v2/signup/config', async (req, res) => {
    try {
      const setting = await getSignupCodeSetting();
      return res.json({ codeConfigured: Boolean(setting?.value?.codeHash) });
    } catch (err) {
      console.error('V2 signup config error:', err);
      return res.status(500).json({ msg: '가입 설정을 확인하지 못했습니다.' });
    }
  });

  app.post('/api/v2/signup/validate-code', async (req, res) => {
    try {
      const valid = await isSignupCodeValid(String(req.body?.signupCode || '').trim(), bcrypt);
      return res.json({ valid });
    } catch (err) {
      console.error('V2 signup code validation error:', err);
      return res.status(500).json({ msg: '가입 코드를 확인하지 못했습니다.' });
    }
  });

  app.post('/api/v2/signup', async (req, res) => {
    try {
      const validation = validateSignupPayload(req.body);
      if (!validation.valid) return res.status(400).json({ msg: validation.message });
      if (!await isSignupCodeValid(validation.signupCode, bcrypt)) {
        return res.status(400).json({ msg: '가입 코드가 올바르지 않습니다.' });
      }
      const duplicate = await User.findOne({
        $or: [
          { username: validation.username },
          { nickname: validation.nickname }
        ]
      }).select('_id username nickname').lean();
      if (duplicate) {
        const field = duplicate.username === validation.username ? '아이디' : '닉네임';
        return res.status(409).json({ msg: `이미 사용 중인 ${field}입니다.` });
      }
      const passwordHash = await bcrypt.hash(validation.password, 10);
      const user = new User({
        username: validation.username,
        password: passwordHash,
        nickname: validation.nickname,
        gameState: {
          money: 0,
          level: 1,
          exp: 0,
          stamina: 10,
          maxStamina: 10,
          stress: 0
        }
      });
      await user.save();
      await ensureV2MigrationForUser(user);
      return res.status(201).json({
        success: true,
        username: validation.username,
        message: '호이상사 사원 등록이 완료되었습니다. 로그인해주세요.'
      });
    } catch (err) {
      if (err?.code === 11000) {
        return res.status(409).json({ msg: '이미 사용 중인 아이디 또는 닉네임입니다.' });
      }
      console.error('V2 signup error:', err);
      return res.status(500).json({ msg: '회원가입 중 서버 오류가 발생했습니다.' });
    }
  });

  app.post('/api/v2/login', async (req, res) => {
    try {
      const username = String(req.body?.username || '').trim();
      const password = String(req.body?.password || '');
      if (!username || !password) {
        return res.status(400).json({ msg: '아이디와 비밀번호를 입력해주세요.' });
      }

      if (username === adminUsername && password === adminPassword) {
        const token = jwt.sign({ admin: true, username: adminUsername }, jwtSecret, { expiresIn: '1d' });
        return res.json({ token, isAdmin: true, displayName: '운영자' });
      }

      const v2Account = await V2Account.findOne({ username }).select('+passwordHash');
      if (v2Account) {
        if (!(await bcrypt.compare(password, v2Account.passwordHash))) {
          return res.status(400).json({ msg: '아이디 또는 비밀번호가 올바르지 않습니다.' });
        }
        await repairV2CharacterStatBaselinesByUserId(v2Account.sourceUserId);
        let character = await V2Character.findOne({ userId: v2Account.sourceUserId });
        if (!character) {
          const sourceUser = await User.findById(v2Account.sourceUserId);
          if (!sourceUser) {
            return res.status(404).json({ msg: '이관할 원본 유저 정보를 찾을 수 없습니다.' });
          }
          const migration = await ensureV2MigrationForUser(sourceUser);
          character = migration.character;
        } else {
          const sourceUser = await User.findById(v2Account.sourceUserId);
          if (sourceUser) {
            const migration = await ensureV2MigrationForUser(sourceUser);
            character = migration.character;
          } else {
            await ensureV2CharacterFoundation(character);
            await ensureV2SkillPointGrant(character);
          }
        }
        const token = jwt.sign({ id: v2Account.sourceUserId, v2: true }, jwtSecret, { expiresIn: '1d' });
        return res.json({
          token,
          isAdmin: false,
          displayName: v2Account.nickname || v2Account.username,
          migrationPrepared: Boolean(character),
          migrationAutomatic: true
        });
      }

      const user = await User.findOne({ username });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ msg: '아이디 또는 비밀번호가 올바르지 않습니다.' });
      }

      await repairV2CharacterStatBaselinesByUserId(user._id);
      const migration = await ensureV2MigrationForUser(user);
      const token = jwt.sign({ id: user._id, v2: true }, jwtSecret, { expiresIn: '1d' });
      return res.json({
        token,
        isAdmin: false,
        displayName: user.nickname || user.username,
        migrationPrepared: Boolean(migration.character),
        migrationAutomatic: true
      });
    } catch (err) {
      if (isV2AccountDeletedError(err)) {
        return res.status(410).json({ msg: err.message });
      }
      console.error('V2 login error:', err);
      return res.status(500).json({ msg: 'V2 로그인 중 서버 오류가 발생했습니다.' });
    }
  });

  app.get('/api/v2/migration/preview', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const user = await User.findById(auth.id).select('-password');
      if (!user) return res.status(404).json({ msg: '유저 정보를 찾을 수 없습니다.' });
      const character = await V2Character.findOne({ userId: user._id });
      await ensureV2CharacterFoundation(character);
      if (ensureDailyHuntingMail(character)) await character.save();
      return res.json({
        displayName: user.nickname || user.username,
        preview: buildMigrationPreview(user),
        character: buildCharacterResponse(character),
        v1Unaffected: true
      });
    } catch (err) {
      console.error('V2 migration preview error:', err);
      return res.status(500).json({ msg: 'V2 이관 미리보기를 불러오지 못했습니다.' });
    }
  });

  app.post('/api/v2/migration/prepare', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const user = await User.findById(auth.id);
      if (!user) return res.status(404).json({ msg: '유저 정보를 찾을 수 없습니다.' });
      const result = await ensureV2MigrationForUser(user);
      return res.json({
        success: true,
        snapshotId: String(result.snapshot._id),
        character: buildCharacterResponse(result.character),
        preview: result.preview,
        message: 'V1 원본 스냅샷과 V2 캐릭터 준비가 완료되었습니다. V1 데이터는 변경되지 않았습니다.'
      });
    } catch (err) {
      if (isV2AccountDeletedError(err)) {
        return res.status(410).json({ msg: err.message });
      }
      console.error('V2 migration prepare error:', err);
      return res.status(500).json({ msg: 'V2 이관 데이터를 준비하지 못했습니다.' });
    }
  });

  app.get('/api/v2/world/maps', (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    return res.json({
      startMapId: START_MAP_ID,
      maps: WORLD_MAPS.map((map) => ({
        ...map,
        npcs: getPublicNpcsForMap(map.id)
      }))
    });
  });

  app.get('/api/v2/quests', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    const character = await V2Character.findOne({ userId: auth.id });
    if (!character) return res.status(404).json({ msg: '캐릭터를 찾을 수 없습니다.' });
    return res.json({ journal: buildQuestJournal(character) });
  });

  app.get('/api/v2/npcs/:npcId', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const npc = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('캐릭터를 찾을 수 없습니다.');
        const questChanged = recordNpcVisit(character, String(req.params.npcId || ''));
        if (questChanged) await character.save();
        return buildNpcView(character, req.params.npcId);
      });
      if (!npc) return res.status(404).json({ msg: 'NPC를 찾을 수 없습니다.' });
      return res.json({ npc });
    } catch (err) {
      return res.status(400).json({ msg: err.message || 'NPC 정보를 불러오지 못했습니다.' });
    }
  });

  app.post('/api/v2/quests/accept', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('캐릭터를 찾을 수 없습니다.');
        const quest = acceptQuest(character, String(req.body?.questId || ''));
        await character.save();
        worldProfileCache.delete(String(auth.id));
        return { quest, journal: buildQuestJournal(character) };
      });
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ msg: err.message || '퀘스트를 수락하지 못했습니다.' });
    }
  });

  app.post('/api/v2/quests/visit', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    const mapId = String(req.body?.mapId || '');
    if (!getWorldMap(mapId)) return res.status(400).json({ msg: '존재하지 않는 맵입니다.' });
    try {
      const journal = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('캐릭터를 찾을 수 없습니다.');
        const changed = recordMapVisit(character, mapId);
        if (changed) await character.save();
        return buildQuestJournal(character);
      });
      return res.json({ journal });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '퀘스트 진행도를 갱신하지 못했습니다.' });
    }
  });

  app.post('/api/v2/quests/claim', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('캐릭터를 찾을 수 없습니다.');
        const rewards = claimQuest(character, String(req.body?.questId || ''));
        const experience = grantV2Experience(character, rewards.exp);
        if (!character.economy || typeof character.economy !== 'object') character.economy = {};
        character.economy.money = Math.max(0, Number(character.economy?.money) || 0)
          + Math.max(0, Number(rewards.money) || 0);
        for (const item of rewards.items || []) {
          addInventoryItem(character, item.itemId, item.quantity);
        }
        if (Number(rewards.huntingMinutes) > 0) {
          addHuntingMinutes(character, rewards.huntingMinutes);
        }
        await character.save();
        worldProfileCache.delete(String(auth.id));
        return {
          rewards,
          experience,
          character: buildCharacterResponse(character),
          journal: buildQuestJournal(character)
        };
      });
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ msg: err.message || '퀘스트 보상을 받지 못했습니다.' });
    }
  });

  app.get('/api/v2/patch-notes', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const character = await V2Character.findOne({ userId: auth.id })
        .select('ui.patchNotesSeenVersion')
        .lean();
      return res.json({
        patchNotes: V2_CURRENT_PATCH_NOTES,
        patchNotesHistory: V2_PATCH_NOTE_HISTORY,
        seen: String(character?.ui?.patchNotesSeenVersion || '') === V2_CURRENT_PATCH_NOTES.version
      });
    } catch (err) {
      return res.status(500).json({ msg: '패치노트 정보를 불러오지 못했습니다.' });
    }
  });

  app.post('/api/v2/patch-notes/seen', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      await V2Character.updateOne(
        { userId: auth.id },
        { $set: { 'ui.patchNotesSeenVersion': V2_CURRENT_PATCH_NOTES.version } }
      );
      return res.json({ success: true, version: V2_CURRENT_PATCH_NOTES.version });
    } catch (err) {
      return res.status(500).json({ msg: '패치노트 확인 상태를 저장하지 못했습니다.' });
    }
  });

  app.get('/api/v2/me', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const character = await V2Character.findOne({ userId: auth.id });
      await ensureV2CharacterFoundation(character);
      if (ensureDailyHuntingMail(character)) await character.save();
      return res.json({ character: buildCharacterResponse(character) });
    } catch (err) {
      console.error('V2 character load error:', err);
      return res.status(500).json({ msg: 'V2 캐릭터를 불러오지 못했습니다.' });
    }
  });

  app.post('/api/v2/stats/allocate', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const character = await withCharacterMutation(auth.id, async () => {
        const current = await V2Character.findOne({ userId: auth.id });
        if (!current) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        await ensureV2CharacterFoundation(current);
        const allocations = req.body?.allocations || {};
        const allowedStats = ['grit', 'processingSpeed', 'workKnowledge', 'awareness'];
        const normalized = Object.fromEntries(allowedStats.map((stat) => [
          stat,
          Math.max(0, Math.floor(Number(allocations[stat]) || 0))
        ]));
        const total = Object.values(normalized).reduce((sum, value) => sum + value, 0);
        if (total <= 0) throw new Error('투자할 스탯 포인트를 입력해주세요.');
        if (total > Number(current.progression?.unspentStatPoints || 0)) {
          throw new Error('사용 가능한 스탯 포인트가 부족합니다.');
        }
        for (const [stat, value] of Object.entries(normalized)) {
          current.stats[stat] = Number(current.stats?.[stat] || 4) + value;
        }
        current.progression.unspentStatPoints -= total;
        reconcileHpGrowthSkillBonus(current);
        reconcileMpGrowthSkillBonus(current);
        await current.save();
        worldProfileCache.delete(String(auth.id));
        return current;
      });
      return res.json({ success: true, character: buildCharacterResponse(character) });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '스탯을 투자하지 못했습니다.' });
    }
  });

  app.post('/api/v2/advancement', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        await ensureV2CharacterFoundation(character);
        const advancement = applyAdvancement(character, req.body?.departmentId);
        const department = DEPARTMENTS[advancement.departmentId];
        const reference = calculateReferenceResources({
          level: character.progression?.level,
          departmentId: advancement.departmentId,
          advancementTier: advancement.advancementTier,
          archetype: department.archetype
        });
        character.resources.hpGrowthSkillBonus = 0;
        character.resources.mpGrowthSkillBonus = 0;
        applyReferenceResources(character, reference, { fullyRestore: true });
        reconcileHpGrowthSkillBonus(character, { resetAppliedBonus: true });
        reconcileMpGrowthSkillBonus(character, { resetAppliedBonus: true });
        await character.save();
        worldProfileCache.delete(String(auth.id));
        updatePlayerResources(auth.id, character.resources);
        return {
          advancement,
          character: buildCharacterResponse(character)
        };
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '전직을 완료하지 못했습니다.' });
    }
  });

  app.post('/api/v2/skills/invest', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const character = await withCharacterMutation(auth.id, async () => {
        const current = await V2Character.findOne({ userId: auth.id });
        if (!current) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        await ensureV2CharacterFoundation(current);
        investSkill(current, req.body?.skillId, req.body?.amount);
        reconcileHpGrowthSkillBonus(current);
        reconcileMpGrowthSkillBonus(current);
        await current.save();
        worldProfileCache.delete(String(auth.id));
        return current;
      });
      return res.json({ success: true, character: buildCharacterResponse(character) });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '스킬 포인트를 투자하지 못했습니다.' });
    }
  });

  app.post('/api/v2/skills/preset', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const character = await withCharacterMutation(auth.id, async () => {
        const current = await V2Character.findOne({ userId: auth.id });
        if (!current) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        setActivePreset(current, req.body?.skillIds);
        await current.save();
        return current;
      });
      return res.json({ success: true, character: buildCharacterResponse(character) });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '스킬 프리셋을 저장하지 못했습니다.' });
    }
  });

  app.post('/api/v2/skills/auto-preset', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const character = await withCharacterMutation(auth.id, async () => {
        const current = await V2Character.findOne({ userId: auth.id });
        if (!current) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        setAutoPreset(current, req.body?.skillIds);
        await current.save();
        return current;
      });
      return res.json({ success: true, character: buildCharacterResponse(character) });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '자동 스킬 설정을 저장하지 못했습니다.' });
    }
  });

  app.post('/api/v2/skills/use', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    if (!requireWorldControl(req, res, auth)) return;
    try {
      const requestedSkillId = String(req.body?.skillId || '');
      const requestedDefinition = SKILL_DEFINITIONS[requestedSkillId];
      const mutationUserIds = requestedDefinition?.target === 'party'
        ? getPartyMemberIds(auth.id)
        : [auth.id];
      const result = await withCharacterMutations(mutationUserIds, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        const skillId = String(req.body?.skillId || '');
        const definition = SKILL_DEFINITIONS[skillId];
        const level = getSkillLevel(character, skillId);
        const skillState = ensureSkillState(character);
        const comboBefore = Math.max(0, Number(skillState.comboCount) || 0);
        if (!definition || definition.passive || level <= 0) {
          throw new Error('사용할 수 없는 스킬입니다.');
        }
        if (definition.effect !== 'flash-jump' && !skillState.activePreset.includes(skillId)) {
          throw new Error('전투 프리셋에 등록된 스킬만 사용할 수 있습니다.');
        }
        const equippedWeaponType = String(character.loadout?.weapon?.weaponType || '');
        if (
          Array.isArray(definition.weaponTypes)
          && definition.weaponTypes.length
          && !definition.weaponTypes.includes(equippedWeaponType)
        ) {
          throw new Error('현재 장착한 무기로는 이 스킬을 사용할 수 없습니다.');
        }
        const values = resolveSkillValues(definition, level);
        const castProfile = resolveSkillCastProfile(values);
        const now = Date.now();
        const cooldownUntil = Number(skillState.cooldowns?.[skillId]) || 0;
        if (cooldownUntil > now) {
          throw new Error(`재사용 대기시간이 ${Math.ceil((cooldownUntil - now) / 1000)}초 남았습니다.`);
        }
        const currentHp = Math.max(0, Number(character.resources?.currentHp) || 0);
        const currentMp = Math.max(0, Number(character.resources?.currentMp) || 0);
        const maxHp = Math.max(1, Number(character.resources?.maxHp) || 1);
        const sourceMapId = String(req.body?.mapId || character.worldState?.mapId || '');
        if (
          isPlayerSilenced(auth.id, sourceMapId, now)
          && ![
            'heal', 'buff', 'cleanse-self', 'party-portal', 'teleport', 'flash-jump'
          ].includes(definition.effect)
        ) {
          throw new Error('침묵 상태에서는 공격 스킬을 사용할 수 없습니다.');
        }
        const preUseEffects = getActiveSkillEffects(character);
        const preUseArchetype = DEPARTMENTS[character.job?.departmentId]?.archetype || 'beginner';
        if (values.minimumHpPercent && currentHp / maxHp * 100 < values.minimumHpPercent) {
          throw new Error(`체력이 ${values.minimumHpPercent}% 이상일 때만 사용할 수 있습니다.`);
        }
        const hpCost = Math.max(
          0,
          Math.floor(Number(values.hpCost) || maxHp * Number(values.maxHpCostPercent || 0) / 100)
        );
        const baseMpCost = Math.max(0, Number(values.mpCost) || 0);
        const magicAttackAmplified = preUseArchetype === 'mage'
          && ['enemy', 'enemies'].includes(definition.target);
        const mpCost = Math.max(0, Math.floor(
          baseMpCost * (
            1 + (
              magicAttackAmplified
                ? Number(preUseEffects.magicMpCostIncreasePercent) || 0
                : 0
            ) / 100
          ) * castProfile.mpCostMultiplier
        ));
        if (currentHp <= hpCost) throw new Error('체력이 부족합니다.');
        if (currentMp < mpCost) throw new Error('정신력이 부족합니다.');
        character.resources.currentHp = currentHp - hpCost;
        character.resources.currentMp = currentMp - mpCost;

        let combat = null;
        let partyBuffToShare = null;
        let supportTargetIds = [];
        const damageEffects = new Set([
          'damage', 'multi-damage', 'ignore-defense-damage', 'damage-stun',
          'damage-lock', 'charge', 'consume-combo-damage', 'pull',
          'element-explosion', 'nonlethal-damage', 'fixed-damage'
        ]);
        if (definition.effect === 'flash-jump') {
          if (!req.body?.airborne) throw new Error('플래시 점프는 공중에서만 사용할 수 있습니다.');
          const activeMapId = String(
            req.body?.mapId || character.worldState?.mapId || START_MAP_ID
          );
          const distancePx = Math.max(
            1,
            Math.min(320, Number(values.distance ?? definition.range) || 320)
          );
          const direction = String(req.body?.direction || '').toLowerCase() === 'left'
            || Boolean(req.body?.facingLeft)
            ? -1
            : 1;
          const currentX = Math.max(
            0,
            Math.min(94, Number(req.body?.x ?? character.worldState?.x) || 8)
          );
          const nextX = Math.max(
            0,
            Math.min(94, currentX + direction * distancePx / 760 * 100)
          );
          const nextFloor = Number(req.body?.floor ?? character.worldState?.floor) === 1 ? 1 : 0;
          if (!character.worldState || typeof character.worldState !== 'object') {
            character.worldState = {};
          }
          character.worldState.mapId = activeMapId;
          character.worldState.x = nextX;
          character.worldState.floor = nextFloor;
          character.markModified('worldState');
          combat = {
            success: true,
            flashJump: {
              mapId: activeMapId,
              x: nextX,
              floor: nextFloor,
              direction,
              distancePx
            }
          };
        } else if (damageEffects.has(definition.effect)) {
          if (definition.effect === 'consume-combo-damage' && skillState.comboCount <= 0) {
            throw new Error('콤보 카운터가 필요합니다.');
          }
          const response = buildCharacterResponse(character);
          const activeEffects = response.skillEffects || {};
          const archetype = DEPARTMENTS[character.job?.departmentId]?.archetype || 'beginner';
          const upgradedAudit = definition.name === '4중 검산'
            && Number(activeEffects.upgradedAuditHits) > 0;
          const ammunition = definition.effect === 'fixed-damage'
            ? null
            : getCombatAmmunition(response);
          const ammunitionCount = Math.max(
            1,
            upgradedAudit
              ? Number(activeEffects.upgradedAuditHits)
              : castProfile.hitCount
          );
          if (
            ammunition
            && !activeEffects.noAmmoConsumption
            && !consumeInventoryItem(character, ammunition.itemId, ammunitionCount)
          ) {
            throw new Error('공격에 필요한 탄약이 부족합니다.');
          }
          const activeElements = getActiveWeaponElements(skillState, now);
          if (definition.effect === 'element-explosion' && !activeElements.length) {
            throw new Error('폭발시킬 무기 속성이 없습니다.');
          }
          let skillPercentForRuntime = upgradedAudit
            ? Number(activeEffects.upgradedAuditDamagePercent)
            : (definition.effect === 'element-explosion'
              ? Number(activeEffects.elementExplosionDamagePercent || values.damagePercent || 250)
              : Number(values.damagePercent) || 100);
          let damageRange = null;
          let baseDamage = definition.effect === 'fixed-damage'
            ? Math.max(1, Number(values.fixedDamage) || 1)
            : Math.max(1, Number(response.derivedStats.attackMaximum) || 4);
          if (archetype === 'mage' && definition.effect !== 'fixed-damage') {
            damageRange = buildProfileMagicDamageRange(response, skillPercentForRuntime);
            baseDamage = 1;
            skillPercentForRuntime = 100;
          } else {
            baseDamage += Number(ammunition?.attackBonus) || 0;
          }
          const rollCriticalPerHit = castProfile.channelDurationSeconds > 0
            && definition.effect !== 'fixed-damage';
          const critical = !rollCriticalPerHit && definition.effect !== 'fixed-damage'
            && Math.random() * 100 < Number(response.derivedStats.criticalChance || 0);
          let damageMultiplier = 1;
          if (critical) {
            damageMultiplier *= Number(response.derivedStats.criticalDamagePercent || 200) / 100;
          }
          damageMultiplier *= 1 + Number(activeEffects.damageIncreasePercent || 0) / 100;
          if (activeElements.length) {
            damageMultiplier *= 1 + Number(activeEffects.elementDamageIncreasePercent || 0) / 100;
          }
          if (activeEffects.comboEnabled) {
            damageMultiplier *= 1
              + Number(skillState.comboCount || 0)
                * Number(activeEffects.comboDamagePerCount || 0) / 100;
          }
          const resourcePercent = currentHp / maxHp * 100;
          if (
            activeEffects.lowHpThresholdPercent
            && resourcePercent <= Number(activeEffects.lowHpThresholdPercent)
          ) {
            damageMultiplier *= 1 + Number(activeEffects.lowHpDamageIncreasePercent || 0) / 100;
          }
          if (damageRange) damageRange = scaleDamageRange(damageRange, damageMultiplier);
          else baseDamage *= damageMultiplier;
          const doubleStrike = Math.random() * 100
            < Number(activeEffects.doubleStrikeChance || 0);
          combat = useSkillOnMonsters({
            userId: String(auth.id),
            mapId: String(req.body?.mapId || ''),
            targetId: String(req.body?.targetId || ''),
            baseDamage,
            damageRange,
            skillPercent: skillPercentForRuntime,
            rangePx: Number(values.range ?? definition.range) || 100,
            maxTargets: Number(values.targetCount ?? definition.maxTargets) || 1,
            hits: upgradedAudit
              ? Number(activeEffects.upgradedAuditHits)
              : castProfile.hitCount,
            bonusAttackPercent: doubleStrike
              ? Number(activeEffects.doubleStrikeDamagePercent || 0)
              : 0,
            element: definition.element,
            elements: activeElements.length ? activeElements : [definition.element],
            ignoreDefense: ['ignore-defense-damage', 'fixed-damage'].includes(definition.effect),
            damageType: archetype === 'mage' ? 'magic' : 'physical',
            accuracy: response.derivedStats.accuracy,
            playerLevel: response.progression?.level,
            mpAbsorbChance: Number(activeEffects.mpAbsorbChance) || 0,
            mpAbsorbPercent: Number(activeEffects.mpAbsorbPercent) || 0,
            poisonChance: Number(activeEffects.poisonChance) || 0,
            poisonAttack: Number(activeEffects.poisonAttack) || 0,
            poisonDurationSeconds: Number(activeEffects.poisonDurationSeconds) || 0,
            poisonMaxStacks: Number(activeEffects.poisonMaxStacks) || 0,
            stunChance: Number(values.stunChance) || 0,
            stunSeconds: Number(values.stunSeconds) || 0,
            moveCasterToTarget: Boolean(values.moveCasterToTarget),
            pull: ['charge', 'pull'].includes(definition.effect),
            dealDamage: definition.effect !== 'pull',
            leaveAtOneHp: definition.effect === 'nonlethal-damage',
            piercing: Boolean(definition.piercing),
            verticalFloorRange: Number(
              values.verticalFloorRange ?? definition.verticalFloorRange
            ) || 0,
            criticalChance: Number(response.derivedStats.criticalChance) || 0,
            criticalDamagePercent: Number(response.derivedStats.criticalDamagePercent) || 200,
            rollCriticalPerHit,
            retargetEachHit: castProfile.channelDurationSeconds > 0
          });
          if (!combat.success) throw new Error('사거리 안에 공격할 대상이 없습니다.');
          if (combat.casterMovement) {
            const activeMapId = String(
              req.body?.mapId || character.worldState?.mapId || START_MAP_ID
            );
            character.worldState.mapId = activeMapId;
            character.worldState.x = combat.casterMovement.x;
            character.worldState.floor = combat.casterMovement.floor;
            combat.teleport = {
              mapId: activeMapId,
              x: combat.casterMovement.x,
              floor: combat.casterMovement.floor,
              direction: combat.casterMovement.facingLeft ? 'left' : 'right',
              distancePx: 0
            };
          }
          combat.critical = rollCriticalPerHit
            ? combat.outcomes.some((outcome) => outcome.hitResults?.some((hit) => hit.critical))
            : critical;
          if (castProfile.channelDurationSeconds > 0) {
            combat.channel = {
              durationMs: Math.round(castProfile.channelDurationSeconds * 1000),
              intervalMs: Math.round(castProfile.channelIntervalSeconds * 1000),
              hitCount: castProfile.hitCount,
              projectileSpeedMultiplier: Number(values.projectileSpeedMultiplier) || 1,
              hitResults: combat.outcomes.flatMap((outcome) => outcome.hitResults || [])
            };
          }
          clearStealthBuff(skillState);
          if (Array.isArray(combat.fieldBossRewards) && combat.fieldBossRewards.length) {
            combat.fieldBossRewardResults = [];
            for (const rewardEvent of combat.fieldBossRewards) {
              combat.fieldBossRewardResults.push(
                await applyFieldBossRewards(rewardEvent, character)
              );
            }
          }
          if (Number(combat.mpAbsorbed) > 0) {
            character.resources.currentMp = Math.min(
              Math.max(0, Number(character.resources.maxMp) || 0),
              Math.max(0, Number(character.resources.currentMp) || 0)
                + Number(combat.mpAbsorbed)
            );
          }
          if (definition.effect === 'consume-combo-damage') skillState.comboCount = 0;
          if (definition.effect === 'damage-stun' && Number(values.consumeCombo)) {
            skillState.comboCount = Math.max(0, skillState.comboCount - Number(values.consumeCombo));
          }
          if (
            activeEffects.comboEnabled
            && !['consume-combo-damage', 'damage-stun'].includes(definition.effect)
            && combat.outcomes.some((outcome) => !outcome.missed && outcome.damage > 0)
          ) {
            const charge = Math.random() * 100
              < Number(activeEffects.comboDoubleChargeChance || 0) ? 2 : 1;
            skillState.comboCount = Math.min(
              Number(activeEffects.comboMaximum) || 5,
              Number(skillState.comboCount || 0) + charge
            );
          }
          const expGrant = await grantCombatExperience(
            character,
            combat.expReward,
            String(req.body?.mapId || character.worldState?.mapId || '')
          );
          combat.partyExperience = expGrant.party;
          combat.drops = applyCombatDrops(character, combat.drops);
          combat.drops = applySettlementEventDrops(
            character,
            (combat.outcomes || [])
              .filter((outcome) => outcome.defeated)
              .map((outcome) => outcome.monsterLevel),
            combat.drops
          );
          recordCombatQuestProgress(character, combat, {
            mapId: String(req.body?.mapId || character.worldState?.mapId || ''),
            elements: activeElements.length ? activeElements : [definition.element],
            stealth: Number(activeEffects.stealth) > 0
          });
          if (
            definition.effect === 'element-explosion'
            && Math.random() * 100 >= Number(activeEffects.elementPreserveChance || 0)
          ) {
            skillState.activeBuffs = skillState.activeBuffs.filter(
              (buff) => !ELEMENT_BUFF_SKILL_IDS.includes(buff.skillId)
            );
          }
        } else if (definition.effect === 'heal') {
          const response = buildCharacterResponse(character);
          const healingAmount = Math.max(
            1,
            Math.floor(
              Math.max(1, Number(response.derivedStats?.magic) || 1)
                * Math.max(0, Number(values.healPercent) || 0)
                / 100
            )
          );
          const targets = await healActivePartyMembers({
            caster: character,
            mapId: String(req.body?.mapId || character.worldState?.mapId || ''),
            rangePx: Number(values.range ?? definition.range) || 400,
            amount: healingAmount
          });
          supportTargetIds = targets
            .filter((entry) => Number(entry.healed) > 0)
            .map((entry) => String(entry.userId));
          const welfareDamage = definition.name === '복지 지원'
            ? calculateWelfareSupportDamage({
              workKnowledge: response.derivedStats?.effectiveStats?.workKnowledge,
              awareness: response.derivedStats?.effectiveStats?.awareness,
              magic: response.derivedStats?.magic,
              targetCount: targets.length,
              healPercent: values.healPercent
            })
            : Math.max(1, Number(response.derivedStats?.magic) || 1);
          const undeadCombat = useSkillOnMonsters({
            userId: String(auth.id),
            mapId: String(req.body?.mapId || character.worldState?.mapId || ''),
            targetId: String(req.body?.targetId || ''),
            baseDamage: welfareDamage,
            skillPercent: definition.name === '복지 지원'
              ? 100
              : Math.max(0, Number(values.healPercent) || 0),
            rangePx: Number(values.range ?? definition.range) || 400,
            maxTargets: 15,
            damageType: 'magic',
            element: 'holy',
            accuracy: response.derivedStats?.accuracy,
            playerLevel: response.progression?.level,
            undeadOnly: true
          });
          if (undeadCombat.success) {
            if (Array.isArray(undeadCombat.fieldBossRewards) && undeadCombat.fieldBossRewards.length) {
              undeadCombat.fieldBossRewardResults = [];
              for (const rewardEvent of undeadCombat.fieldBossRewards) {
                undeadCombat.fieldBossRewardResults.push(
                  await applyFieldBossRewards(rewardEvent, character)
                );
              }
            }
            const expGrant = await grantCombatExperience(
              character,
              undeadCombat.expReward,
              String(req.body?.mapId || character.worldState?.mapId || '')
            );
            undeadCombat.partyExperience = expGrant.party;
            undeadCombat.drops = applyCombatDrops(character, undeadCombat.drops);
          }
          combat = {
            success: true,
            healed: targets.reduce((sum, target) => sum + target.healed, 0),
            healingAmount,
            targets,
            undeadCombat: undeadCombat.success ? undeadCombat : null,
            outcomes: undeadCombat.success ? undeadCombat.outcomes : [],
            drops: undeadCombat.success ? undeadCombat.drops : [],
            expReward: undeadCombat.success ? undeadCombat.expReward : 0
          };
          if (undeadCombat.success) {
            recordCombatQuestProgress(character, undeadCombat, {
              mapId: String(req.body?.mapId || character.worldState?.mapId || ''),
              element: 'holy',
              elements: ['holy'],
              stealth: Number(preUseEffects.stealth) > 0
            });
          }
        } else if (definition.effect === 'party-portal') {
          const sourceMapId = String(req.body?.mapId || character.worldState?.mapId || '');
          const safeMap = findNearestSafeMap(sourceMapId);
          if (!safeMap) throw new Error('연결할 안전지대를 찾지 못했습니다.');
          combat = {
            success: true,
            portals: createPartyReturnPortals({
              casterId: auth.id,
              memberIds: getPartyMemberIds(auth.id),
              fieldMapId: sourceMapId,
              fieldX: Number(req.body?.x ?? character.worldState?.x) || 8,
              fieldFloor: Number(req.body?.floor ?? character.worldState?.floor) || 0,
              safeMapId: safeMap.id,
              durationSeconds: Number(values.durationSeconds) || 30
            })
          };
        } else if (definition.effect === 'teleport' || String(skillId).includes('teleport')) {
          const activeMapId = String(req.body?.mapId || character.worldState?.mapId || START_MAP_ID);
          const distancePx = Math.max(1, Math.min(300, Number(values.distance ?? definition.range) || 300));
          const direction = String(req.body?.direction || '').toLowerCase() === 'left'
            || Boolean(req.body?.facingLeft)
            ? -1
            : 1;
          const currentX = Math.max(
            0,
            Math.min(94, Number(req.body?.x ?? character.worldState?.x) || 8)
          );
          const nextX = Math.max(
            0,
            Math.min(94, currentX + direction * distancePx / 760 * 100)
          );
          const nextFloor = Number(req.body?.floor ?? character.worldState?.floor) === 1 ? 1 : 0;
          character.worldState.mapId = activeMapId;
          character.worldState.x = nextX;
          character.worldState.floor = nextFloor;
          combat = {
            success: true,
            teleport: {
              mapId: activeMapId,
              x: nextX,
              floor: nextFloor,
              direction,
              distancePx
            }
          };
        } else if (definition.effect === 'monster-transform') {
          const response = buildCharacterResponse(character);
          combat = useSkillOnMonsters({
            userId: String(auth.id),
            mapId: String(req.body?.mapId || character.worldState?.mapId || ''),
            targetId: String(req.body?.targetId || ''),
            baseDamage: 1,
            skillPercent: 0,
            rangePx: Number(values.range ?? definition.range) || 350,
            maxTargets: Number(values.targetCount ?? definition.maxTargets) || 6,
            accuracy: response.derivedStats.accuracy,
            playerLevel: response.progression?.level,
            dealDamage: false,
            excludeFieldBoss: true,
            outgoingDamageReductionPercent: Number(values.enemyDamageReductionPercent) || 50,
            debuffChance: Number(values.successChance) || 0,
            debuffDurationSeconds: Number(values.durationSeconds) || 20,
            now
          });
          if (!combat.success) throw new Error('사거리 안에 축소할 일반 몬스터가 없습니다.');
        } else if (definition.effect === 'cleanse-self') {
          combat = {
            success: true,
            cleansed: clearPlayerNegativeStatus(
              String(auth.id),
              String(req.body?.mapId || character.worldState?.mapId || '')
            )
          };
        } else if (definition.effect === 'debuff-self-buff') {
          const response = buildCharacterResponse(character);
          combat = useSkillOnMonsters({
            userId: String(auth.id),
            mapId: String(req.body?.mapId || ''),
            targetId: String(req.body?.targetId || ''),
            baseDamage: 1,
            skillPercent: 0,
            rangePx: Number(values.range ?? definition.range) || 450,
            maxTargets: Number(values.targetCount ?? definition.maxTargets) || 15,
            accuracy: response.derivedStats.accuracy,
            playerLevel: response.progression?.level,
            dealDamage: false,
            outgoingDamageReductionPercent: Number(values.enemyDamageReductionPercent) || 0,
            debuffChance: Number(values.successChance) || 0,
            debuffDurationSeconds: Number(values.durationSeconds) || 0
          });
          if (!combat.success) throw new Error('사거리 안에 약화시킬 대상이 없습니다.');
          const activeBuff = upsertActiveBuff(character, {
            skillId,
            name: definition.name,
            effects: {
              damageIncreasePercent: Number(values.damageIncreasePercent) || 0,
              accuracyIncrease: Number(values.accuracyIncrease) || 0
            },
            createdAt: new Date(now),
            durationSeconds: Math.max(1, Number(values.durationSeconds) || 1)
          });
          combat = { ...combat, appliedBuff: activeBuff };
        } else if (definition.effect === 'summon') {
          skillState.summon = buildSummonState(definition, values, now);
          combat = { success: true, summon: skillState.summon };
        } else if (definition.effect === 'toggle-amplifier') {
          const activeIndex = skillState.activeBuffs.findIndex((buff) => buff.skillId === skillId);
          if (activeIndex >= 0) {
            skillState.activeBuffs.splice(activeIndex, 1);
            combat = { success: true, toggled: false };
          } else {
            const activeBuff = upsertActiveBuff(character, {
              skillId,
              name: definition.name,
              effects: {
                magicMpCostIncreasePercent: Number(values.magicMpCostIncreasePercent) || 0,
                damageIncreasePercent: Number(values.damageIncreasePercent) || 0
              },
              createdAt: new Date(now),
              expiresAt: null
            });
            combat = { success: true, toggled: true, appliedBuff: activeBuff };
          }
        } else {
          if (definition.effect === 'combo-buff') skillState.comboCount = 0;
          const effects = buildActiveBuffEffects(values);
          if (definition.effect === 'element-buff') {
            const conflicting = skillId === 'element_fire'
              ? new Set(['element_fire', 'element_ice'])
              : (skillId === 'element_ice'
                ? new Set(['element_fire', 'element_ice'])
                : new Set([skillId]));
            skillState.activeBuffs = skillState.activeBuffs.filter(
              (buff) => !conflicting.has(buff.skillId)
            );
          }
          if (Number.isFinite(Number(values.reflectPercent))) {
            effects.reflectPercent = Number(values.reflectPercent);
          }
          if (Number.isFinite(Number(values.targetMaxHpCapPercent))) {
            effects.targetMaxHpCapPercent = Number(values.targetMaxHpCapPercent);
          }
          if (
            definition.name === '성과 지원'
            && Number.isFinite(Number(values.experienceBonusPercent))
            && getActivePartyPlayers(
              auth.id,
              String(req.body?.mapId || character.worldState?.mapId || '')
            ).length < 2
          ) effects.experienceBonusPercent = 10;
          if (effects.reflectPercent) effects.contactReflectPercent = effects.reflectPercent;
          if (effects.targetMaxHpCapPercent) {
            effects.contactReflectCapPercent = effects.targetMaxHpCapPercent;
          }
          if (definition.effect === 'combo-buff') {
            effects.comboEnabled = 1;
            effects.comboMaximum = Number(values.maxCombo) || 5;
            effects.comboDamagePerCount = Number(values.damagePerComboPercent) || 0;
          }
          const activeBuff = upsertActiveBuff(character, {
            skillId,
            name: definition.name,
            effects,
            createdAt: new Date(now),
            durationSeconds: Math.max(1, Number(values.durationSeconds) || 1)
          });
          if (definition.target === 'party') partyBuffToShare = activeBuff;
          combat = { ...(combat || { success: true }), appliedBuff: activeBuff };
        }
        if (partyBuffToShare) {
          supportTargetIds.push(...getActivePartyPlayers(
            auth.id,
            String(req.body?.mapId || character.worldState?.mapId || '')
          ).map((player) => String(player.userId)));
        }
        recordCompanionQuestTicks(character, now);
        const questProgressed = recordSkillQuestProgress(character, {
          skillId,
          skillIds: [definition.id],
          combat,
          mapId: String(req.body?.mapId || character.worldState?.mapId || ''),
          comboBefore,
          comboAfter: Number(skillState.comboCount) || 0,
          supportTargetIds
        });
        if (castProfile.lockSeconds > 0) {
          skillState.cooldowns[skillId] = now + castProfile.lockSeconds * 1000;
        }
        reconcileMaxResourceBuff(character);
        const autoPotionUses = applyConfiguredAutoPotions(character);
        character.markModified('skills');
        await character.save();
        recordSkillUse(
          auth.id,
          String(req.body?.mapId || character.worldState?.mapId || ''),
          definition.name
        );
        if (skillId === STEALTH_SKILL_ID) {
          setPlayerStealth(
            auth.id,
            String(req.body?.mapId || character.worldState?.mapId || ''),
            true
          );
        }
        if (partyBuffToShare) {
          combat = {
            ...(combat || { success: true }),
            buffedPartyMemberIds: await applyBuffToActivePartyMembers(
              auth.id,
              String(req.body?.mapId || character.worldState?.mapId || ''),
              partyBuffToShare
            )
          };
        }
        worldProfileCache.delete(String(auth.id));
        updatePlayerResources(auth.id, character.resources);
        return {
          skill: { id: definition.id, name: definition.name, values },
          combat,
          character: buildCharacterResponse(character),
          inventory: buildInventoryView(character),
          autoPotionUses,
          questProgressed,
          questJournal: buildQuestJournal(character)
        };
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '스킬을 사용하지 못했습니다.' });
    }
  });

  app.get('/api/v2/inventory', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const character = await V2Character.findOne({ userId: auth.id });
      if (!character) return res.status(404).json({ msg: 'V2 캐릭터를 찾을 수 없습니다.' });
      return res.json({ inventory: buildInventoryView(character) });
    } catch (err) {
      console.error('V2 inventory load error:', err);
      return res.status(500).json({ msg: '인벤토리를 불러오지 못했습니다.' });
    }
  });

  app.post('/api/v2/inventory/sort', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        const inventory = sortInventory(character);
        await character.save();
        return inventory;
      });
      return res.json({ success: true, inventory: result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '인벤토리를 정렬하지 못했습니다.' });
    }
  });

  app.post('/api/v2/inventory/quick-slot', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        assignPotionQuickSlot(character, req.body?.slot, req.body?.itemId);
        await character.save();
        worldProfileCache.delete(String(auth.id));
        return buildInventoryView(character);
      });
      return res.json({ success: true, inventory: result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '포션 슬롯을 설정하지 못했습니다.' });
    }
  });

  app.post('/api/v2/inventory/auto-potion', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        const percent = setPotionAutoThreshold(
          character,
          req.body?.slot,
          req.body?.percent
        );
        await character.save();
        worldProfileCache.delete(String(auth.id));
        return { percent, inventory: buildInventoryView(character) };
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '자동 포션 기준을 저장하지 못했습니다.' });
    }
  });

  app.post('/api/v2/inventory/use-potion', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        if (Number(character.resources?.currentHp) <= 0) {
          throw new Error('사망 상태에서는 포션을 사용할 수 없습니다. 먼저 안전지대에서 부활해주세요.');
        }
        const skillEffects = getActiveSkillEffects(character);
        const resourceCaps = buildCharacterResponse(character).resources;
        const used = useQuickSlotPotion(
          character,
          req.body?.slot,
          skillEffects.consumableEffectPercent,
          { hp: resourceCaps.maxHp, mp: resourceCaps.maxMp }
        );
        await character.save();
        worldProfileCache.delete(String(auth.id));
        const characterResponse = buildCharacterResponse(character);
        updatePlayerResources(auth.id, characterResponse.resources);
        return {
          used,
          character: characterResponse,
          inventory: buildInventoryView(character)
        };
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '포션을 사용하지 못했습니다.' });
    }
  });

  app.post('/api/v2/inventory/expand', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        const expansion = useInventoryExpansionTicket(character, req.body?.category);
        await character.save();
        return {
          expansion,
          inventory: buildInventoryView(character)
        };
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '인벤토리를 확장하지 못했습니다.' });
    }
  });

  app.post('/api/v2/inventory/use-job-change', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        const jobChange = changeDepartment(character, req.body?.departmentId);
        await character.save();
        worldProfileCache.delete(String(auth.id));
        updatePlayerResources(auth.id, character.resources);
        return {
          jobChange,
          character: buildCharacterResponse(character),
          inventory: buildInventoryView(character)
        };
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '보직을 변경하지 못했습니다.' });
    }
  });

  app.post('/api/v2/equipment/equip', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        const equipment = equipInventoryEquipment(character, req.body?.stackId);
        await character.save();
        worldProfileCache.delete(String(auth.id));
        return {
          equipment,
          character: buildCharacterResponse(character),
          inventory: buildInventoryView(character)
        };
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '무기를 장착하지 못했습니다.' });
    }
  });

  app.post('/api/v2/equipment/unequip', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        const equipment = unequipInventoryEquipment(character, req.body?.slot);
        await character.save();
        worldProfileCache.delete(String(auth.id));
        return {
          equipment,
          character: buildCharacterResponse(character),
          inventory: buildInventoryView(character)
        };
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '장비를 해제하지 못했습니다.' });
    }
  });

  app.post('/api/v2/equipment/enhance', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        const enhancement = enhanceEquippedItem(
          character,
          req.body?.slot,
          req.body?.scrollStackId
        );
        await character.save();
        worldProfileCache.delete(String(auth.id));
        return {
          enhancement,
          character: buildCharacterResponse(character),
          inventory: buildInventoryView(character)
        };
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '장비 강화에 실패했습니다.' });
    }
  });

  app.post('/api/v2/inventory/use-stat-reset', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        const requestedItemId = String(req.body?.itemId || 'stat_reset_coupon');
        const resetItem = getItemDefinition(requestedItemId);
        if (resetItem?.itemType !== 'stat-reset' || !consumeInventoryItem(character, requestedItemId, 1)) {
          throw new Error('스탯 초기화 쿠폰이 부족합니다.');
        }
        for (const stat of ['grit', 'processingSpeed', 'workKnowledge', 'awareness']) {
          character.stats[stat] = 4;
        }
        character.progression.unspentStatPoints = getStatPointsForLevel(
          character.progression?.level
        );
        reconcileHpGrowthSkillBonus(character);
        reconcileMpGrowthSkillBonus(character);
        character.markModified('stats');
        character.markModified('progression');
        await character.save();
        worldProfileCache.delete(String(auth.id));
        return {
          character: buildCharacterResponse(character),
          inventory: buildInventoryView(character)
        };
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '스탯을 초기화하지 못했습니다.' });
    }
  });

  app.get('/api/v2/event/settlement-support', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const character = await V2Character.findOne({ userId: auth.id });
      if (!character) return res.status(404).json({ msg: 'V2 캐릭터를 찾을 수 없습니다.' });
      return res.json({
        event: getSettlementEventView(character),
        inventory: buildInventoryView(character)
      });
    } catch (err) {
      return res.status(500).json({ msg: '이벤트 정보를 불러오지 못했습니다.' });
    }
  });

  app.post('/api/v2/event/settlement-support/buy', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        const purchased = purchaseSettlementEventItem(character, req.body?.key);
        await character.save();
        worldProfileCache.delete(String(auth.id));
        return {
          purchased,
          event: getSettlementEventView(character),
          character: buildCharacterResponse(character),
          inventory: buildInventoryView(character)
        };
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '이벤트 상품을 구매하지 못했습니다.' });
    }
  });

  app.get('/api/v2/marketplace', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const now = new Date();
      await V2MarketListing.updateMany(
        { status: 'active', expiresAt: { $lte: now } },
        { $set: { status: 'expired' } }
      );
      const search = String(req.query?.search || '').trim().slice(0, 40);
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const listings = await V2MarketListing.find({
        status: 'active',
        expiresAt: { $gt: now },
        ...(escapedSearch ? { itemName: { $regex: escapedSearch, $options: 'i' } } : {})
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
      const mine = await V2MarketListing.find({
        sellerId: auth.id,
        status: { $in: ['active', 'sold', 'expired'] }
      }).sort({ createdAt: -1 }).limit(100).lean();
      return res.json({
        listings: listings.map(serializeMarketplaceListing),
        mine: mine.map(serializeMarketplaceListing),
        rules: {
          registrationFeePercent: 1,
          settlementFeePercent: 3,
          listingHours: 48
        }
      });
    } catch (err) {
      console.error('V2 marketplace load error:', err);
      return res.status(500).json({ msg: '거래소 정보를 불러오지 못했습니다.' });
    }
  });

  app.post('/api/v2/marketplace/list', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    let pendingListing = null;
    try {
      const stackId = String(req.body?.stackId || '');
      const quantity = Math.max(1, Math.floor(Number(req.body?.quantity) || 1));
      const pricePerItem = Math.floor(Number(req.body?.pricePerItem) || 0);
      if (!Number.isSafeInteger(pricePerItem) || pricePerItem <= 0) {
        throw new Error('판매 가격을 올바르게 입력해주세요.');
      }
      const character = await V2Character.findOne({ userId: auth.id });
      if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
      const stack = ensureInventory(character).items.find(
        (entry) => String(entry.stackId) === stackId && Number(entry.quantity) >= quantity
      );
      const item = getItemDefinition(stack?.itemId);
      if (
        !item
        || !['equipment', 'consumable', 'misc'].includes(item.category)
        || item.tradeable === false
      ) {
        throw new Error('거래소에 등록할 수 없는 아이템입니다.');
      }
      if (item.category === 'equipment' && quantity !== 1) {
        throw new Error('장비는 한 번에 1개만 등록할 수 있습니다.');
      }
      const totalPrice = pricePerItem * quantity;
      if (!Number.isSafeInteger(totalPrice)) throw new Error('판매 가격이 너무 큽니다.');
      const registrationFee = Math.max(1, Math.ceil(totalPrice * 0.01));
      pendingListing = await V2MarketListing.create({
        sellerId: auth.id,
        sellerName: character.displayName,
        itemId: item.id,
        itemName: item.name,
        itemIcon: item.icon,
        itemCategory: item.category,
        quantity,
        instanceData: stack.data || null,
        pricePerItem,
        totalPrice,
        registrationFee,
        sellerProceeds: Math.floor(totalPrice * 0.97),
        status: 'pending',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
      });
      const result = await withCharacterMutation(auth.id, async () => {
        const current = await V2Character.findOne({ userId: auth.id });
        if (!current) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        const currentStack = ensureInventory(current).items.find(
          (entry) => String(entry.stackId) === stackId && Number(entry.quantity) >= quantity
        );
        if (!currentStack) throw new Error('등록할 아이템 수량이 부족합니다.');
        const money = Math.max(0, Number(current.economy?.money) || 0);
        if (money < registrationFee) throw new Error('등록 수수료가 부족합니다.');
        const consumed = consumeInventoryStack(current, stackId, quantity);
        if (!consumed || consumed.quantity !== quantity) throw new Error('아이템 등록에 실패했습니다.');
        current.economy.money = money - registrationFee;
        await current.save();
        pendingListing.instanceData = consumed.data || null;
        pendingListing.status = 'active';
        await pendingListing.save();
        worldProfileCache.delete(String(auth.id));
        return {
          listing: serializeMarketplaceListing(pendingListing.toObject()),
          character: buildCharacterResponse(current),
          inventory: buildInventoryView(current)
        };
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      if (pendingListing?.status === 'pending') await V2MarketListing.deleteOne({ _id: pendingListing._id });
      return res.status(400).json({ msg: err.message || '물품을 등록하지 못했습니다.' });
    }
  });

  app.post('/api/v2/marketplace/buy', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    let listing = null;
    try {
      listing = await V2MarketListing.findOneAndUpdate(
        {
          _id: req.body?.listingId,
          status: 'active',
          expiresAt: { $gt: new Date() },
          sellerId: { $ne: auth.id }
        },
        { $set: { status: 'processing', buyerId: auth.id } },
        { new: true }
      );
      if (!listing) throw new Error('이미 판매되었거나 만료된 물품입니다.');
      const result = await withCharacterMutation(auth.id, async () => {
        const buyer = await V2Character.findOne({ userId: auth.id });
        if (!buyer) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        const money = Math.max(0, Number(buyer.economy?.money) || 0);
        if (money < listing.totalPrice) throw new Error('구매 금액이 부족합니다.');
        addInventoryItem(buyer, listing.itemId, listing.quantity, listing.instanceData);
        buyer.economy.money = money - listing.totalPrice;
        await buyer.save();
        listing.status = 'sold';
        listing.soldAt = new Date();
        await listing.save();
        worldProfileCache.delete(String(auth.id));
        return {
          listing: serializeMarketplaceListing(listing.toObject()),
          character: buildCharacterResponse(buyer),
          inventory: buildInventoryView(buyer)
        };
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      if (listing?.status === 'processing') {
        listing.status = listing.expiresAt <= new Date() ? 'expired' : 'active';
        listing.buyerId = null;
        await listing.save();
      }
      return res.status(400).json({ msg: err.message || '물품을 구매하지 못했습니다.' });
    }
  });

  app.post('/api/v2/marketplace/cancel', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    let listing = null;
    try {
      listing = await V2MarketListing.findOneAndUpdate(
        {
          _id: req.body?.listingId,
          sellerId: auth.id,
          status: 'active',
          expiresAt: { $gt: new Date() }
        },
        { $set: { status: 'processing' } },
        { new: true }
      );
      if (!listing) throw new Error('취소할 수 있는 판매 물품이 없습니다.');
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        addInventoryItem(character, listing.itemId, listing.quantity, listing.instanceData);
        await character.save();
        listing.status = 'cancelled';
        listing.returnedAt = new Date();
        await listing.save();
        worldProfileCache.delete(String(auth.id));
        return {
          listing: serializeMarketplaceListing(listing.toObject()),
          character: buildCharacterResponse(character),
          inventory: buildInventoryView(character)
        };
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      if (listing?.status === 'processing') {
        listing.status = listing.expiresAt <= new Date() ? 'expired' : 'active';
        await listing.save();
      }
      return res.status(400).json({ msg: err.message || '판매 취소에 실패했습니다.' });
    }
  });

  app.post('/api/v2/marketplace/settle', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      await V2MarketListing.updateMany(
        { sellerId: auth.id, status: 'active', expiresAt: { $lte: new Date() } },
        { $set: { status: 'expired' } }
      );
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        const sold = await V2MarketListing.find({ sellerId: auth.id, status: 'sold' });
        const expired = await V2MarketListing.find({ sellerId: auth.id, status: 'expired' });
        const proceeds = sold.reduce(
          (sum, entry) => sum + Math.max(0, Number(entry.sellerProceeds) || 0),
          0
        );
        character.economy.money = Math.max(0, Number(character.economy?.money) || 0) + proceeds;
        const returned = [];
        for (const entry of expired) {
          try {
            addInventoryItem(character, entry.itemId, entry.quantity, entry.instanceData);
            returned.push(entry);
          } catch (_) {
            // Keep the listing in expired state until inventory space is available.
          }
        }
        await character.save();
        const now = new Date();
        if (sold.length) {
          await V2MarketListing.updateMany(
            { _id: { $in: sold.map((entry) => entry._id) }, status: 'sold' },
            { $set: { status: 'settled', settledAt: now } }
          );
        }
        if (returned.length) {
          await V2MarketListing.updateMany(
            { _id: { $in: returned.map((entry) => entry._id) }, status: 'expired' },
            { $set: { status: 'returned', returnedAt: now } }
          );
        }
        worldProfileCache.delete(String(auth.id));
        return {
          proceeds,
          returnedCount: returned.length,
          pendingReturnCount: expired.length - returned.length,
          character: buildCharacterResponse(character),
          inventory: buildInventoryView(character)
        };
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '거래소 정산에 실패했습니다.' });
    }
  });

  function resolveSafeZoneShopId(map, requestedShopId = '') {
    if (!map?.safeZone) {
      throw new Error('상점은 안전지대에서만 이용할 수 있습니다.');
    }
    const allowedShopIds = [map.shopId, map.scrollShopId].filter(Boolean);
    const candidate = String(requestedShopId || '').trim();
    if (!candidate) return map.shopId;
    if (!allowedShopIds.includes(candidate)) {
      throw new Error('현재 위치에서 이용할 수 없는 상점입니다.');
    }
    return candidate;
  }

  app.get('/api/v2/shop', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const character = await V2Character.findOne({ userId: auth.id });
      if (!character) return res.status(404).json({ msg: 'V2 캐릭터를 찾을 수 없습니다.' });
      const map = getWorldMap(character.worldState?.mapId);
      const shopId = resolveSafeZoneShopId(map, req.query?.shopId);
      return res.json({ shop: buildShopView(character, shopId) });
    } catch (err) {
      return res.status(err.message?.includes('상점') ? 403 : 500).json({ msg: err.message || '상점 정보를 불러오지 못했습니다.' });
    }
  });

  app.post('/api/v2/shop/buy', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        const map = getWorldMap(character.worldState?.mapId);
        const shopId = resolveSafeZoneShopId(map, req.body?.shopId);
        const purchase = buyShopItem(character, req.body?.itemId, req.body?.quantity, shopId);
        await character.save();
        worldProfileCache.delete(String(auth.id));
        return purchase;
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '아이템을 구매하지 못했습니다.' });
    }
  });

  app.post('/api/v2/shop/sell', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        if (!getWorldMap(character.worldState?.mapId)?.safeZone) {
          throw new Error('상점은 안전지대에서만 이용할 수 있습니다.');
        }
        const sale = sellInventoryStack(character, req.body?.stackId, req.body?.quantity);
        await character.save();
        worldProfileCache.delete(String(auth.id));
        return sale;
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '아이템을 판매하지 못했습니다.' });
    }
  });

  app.post('/api/v2/shop/recharge-throwing-star', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        if (!getWorldMap(character.worldState?.mapId)?.safeZone) {
          throw new Error('표창 충전은 안전지대 상점에서만 이용할 수 있습니다.');
        }
        const recharge = rechargeThrowingStarStack(character, req.body?.stackId);
        await character.save();
        worldProfileCache.delete(String(auth.id));
        return recharge;
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '표창을 충전하지 못했습니다.' });
    }
  });

  app.post('/api/v2/special-actions/salary-lupin', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        const now = Date.now();
        ensureDailyActionPoints(character, now);
        const skillState = ensureSkillState(character);
        const active = skillState.activeBuffs.some((buff) => (
          buff.skillId === 'special_action_salary_lupin'
          && (!buff.expiresAt || new Date(buff.expiresAt).getTime() > now)
        ));
        if (active) throw new Error('월급루팡 효과가 이미 적용 중입니다.');
        spendActionPoints(character, 6, now);
        const appliedBuff = upsertActiveBuff(character, {
          skillId: 'special_action_salary_lupin',
          name: '월급루팡',
          effects: { experienceMultiplierPercent: 10 },
          createdAt: new Date(now),
          durationSeconds: 40 * 60
        }, now);
        await character.save();
        worldProfileCache.delete(String(auth.id));
        return {
          message: '40분 동안 획득 경험치가 10% 추가됩니다.',
          appliedBuff,
          character: buildCharacterResponse(character)
        };
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '특수행동을 실행하지 못했습니다.' });
    }
  });

  app.get('/api/v2/cash-shop', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const character = await V2Character.findOne({ userId: auth.id });
      if (!character) return res.status(404).json({ msg: 'V2 캐릭터를 찾을 수 없습니다.' });
      await ensureV2CharacterFoundation(character);
      return res.json(getCashShopView(character));
    } catch (err) {
      return res.status(500).json({ msg: '캐시상점을 불러오지 못했습니다.' });
    }
  });

  app.post('/api/v2/cash-shop/buy', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        await ensureV2CharacterFoundation(character);
        const purchase = purchaseCashProduct(character, req.body?.productId);
        await character.save();
        return {
          ...purchase,
          character: buildCharacterResponse(character)
        };
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '캐시 상품을 구매하지 못했습니다.' });
    }
  });

  app.post('/api/v2/inventory/use-item', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        const item = getItemDefinition(req.body?.itemId);
        if (!item || !['return-scroll', 'experience-buff', 'hunting-time', 'hunting-capacity', 'level-up', 'skill-reset', 'mastery-book', 'action-point', 'cash-point'].includes(item.itemType)) {
          throw new Error('사용할 수 없는 아이템입니다.');
        }
        if (item.itemType === 'level-up' && Number(character.progression?.level) >= MAX_LEVEL) {
          throw new Error('만렙에서는 레벨업 쿠폰을 사용할 수 없습니다.');
        }
        if (
          item.itemType === 'hunting-time'
          && Number(character.huntingTime?.remainingSeconds) >= Math.max(
            24000,
            Number(character.huntingTime?.maximumSeconds) || 24000
          )
        ) {
          throw new Error('자동사냥 시간이 이미 현재 최대치입니다.');
        }
        if (
          item.itemType === 'hunting-capacity'
          && Number(character.huntingTime?.maximumSeconds || 24000) >= 48000
        ) throw new Error('자동사냥 시간 최대치가 이미 800분입니다.');
        const masteryValidation = item.itemType === 'mastery-book'
          ? validateMasteryBookUse(character, item)
          : null;
        if (item.itemType === 'action-point') {
          ensureDailyActionPoints(character);
          if (Number(character.actionPoints?.current) >= Number(character.actionPoints?.max)) {
            throw new Error('행동력이 이미 최대치입니다.');
          }
        }
        if (!consumeInventoryItem(character, item.id, 1)) {
          throw new Error('해당 아이템이 부족합니다.');
        }

        let map = null;
        let message = '';
        let masteryResult = null;
        let appliedBuff = null;
        if (item.itemType === 'return-scroll') {
          map = findNearestSafeMap(character.worldState?.mapId);
          character.worldState.mapId = map.id;
          character.worldState.x = 8;
          character.worldState.floor = 0;
          leaveWorld(auth.id);
          message = `${map.name}(으)로 귀환했습니다.`;
        } else if (item.itemType === 'experience-buff') {
          const skillState = ensureSkillState(character);
          const now = Date.now();
          const existing = skillState.activeBuffs.find((buff) => buff.skillId === item.id);
          const existingExpiry = existing?.expiresAt ? new Date(existing.expiresAt).getTime() : 0;
          const baseTime = Number.isFinite(existingExpiry) && existingExpiry > now
            ? existingExpiry
            : now;
          const durationMs = Math.max(1, Number(item.durationSeconds) || 900) * 1000;
          appliedBuff = upsertActiveBuff(character, {
            skillId: item.id,
            name: item.name,
            effects: { experienceBonusPercent: Number(item.experienceBonusPercent) || 100 },
            createdAt: new Date(now),
            expiresAt: new Date(baseTime + durationMs)
          });
          message = `${item.name} 효과 시간이 누적되었습니다.`;
        } else if (item.itemType === 'hunting-time') {
          const huntingTime = addHuntingMinutes(character, item.huntingMinutes);
          message = huntingTime.addedSeconds > 0
            ? `자동사냥 시간이 ${Math.floor(huntingTime.addedSeconds / 60)}분 충전되었습니다.`
            : '자동사냥 시간이 이미 현재 최대치입니다.';
        } else if (item.itemType === 'hunting-capacity') {
          const capacity = addHuntingCapacityMinutes(character, item.huntingCapacityMinutes);
          message = capacity.addedSeconds > 0
            ? `자동사냥 시간 최대치가 ${Math.floor(capacity.maximumSeconds / 60)}분으로 증가했습니다.`
            : '자동사냥 시간 최대치가 이미 800분입니다.';
        } else if (item.itemType === 'cash-point') {
          const cash = grantCashPoints(character, item.cashPoints || 100);
          message = `캐시 ${cash.granted}P가 충전되었습니다. 현재 잔액은 ${cash.cashPoints}P입니다.`;
        } else if (item.itemType === 'action-point') {
          const restored = restoreActionPoints(character, item.actionPoints || 1);
          message = `행동력을 ${restored.restored} 회복했습니다.`;
        } else if (item.itemType === 'skill-reset') {
          const skillState = ensureSkillState(character);
          const skillDefinitionIds = new Set(Object.keys(SKILL_DEFINITIONS));
          skillState.levels = {};
          skillState.activePreset = [];
          skillState.autoPreset = [];
          skillState.cooldowns = {};
          skillState.summon = null;
          skillState.comboCount = 0;
          skillState.activeBuffs = skillState.activeBuffs.filter(
            (buff) => !skillDefinitionIds.has(String(buff.skillId || ''))
          );
          character.progression.unspentSkillPoints = Math.max(
            0,
            Math.floor(Number(character.progression?.totalSkillPointsEarned) || 0)
          );
          reconcileHpGrowthSkillBonus(character);
          reconcileMpGrowthSkillBonus(character);
          reconcileMaxResourceBuff(character);
          character.markModified('skills');
          character.markModified('progression');
          character.markModified('resources');
          message = '투자한 스킬포인트를 모두 회수했습니다.';
        } else if (item.itemType === 'mastery-book') {
          masteryResult = resolveMasteryBookUse(character, masteryValidation);
          message = masteryResult.message;
        } else {
          const levelUp = applyLevelUpCoupon(character);
          message = `레벨업 쿠폰을 사용하여 Lv.${levelUp.level}이 되었습니다. 경험치는 0%로 초기화되었습니다.`;
        }
        await character.save();
        worldProfileCache.delete(String(auth.id));
        return {
          message,
          masteryResult,
          appliedBuff,
          map,
          character: buildCharacterResponse(character),
          inventory: buildInventoryView(character)
        };
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '아이템을 사용하지 못했습니다.' });
    }
  });

  app.get('/api/v2/mail', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const character = await V2Character.findOne({ userId: auth.id });
      if (!character) return res.status(404).json({ msg: 'V2 캐릭터를 찾을 수 없습니다.' });
      if (purgeExpiredMail(character) > 0) await character.save();
      return res.json(buildMailResponse(character));
    } catch (err) {
      console.error('V2 mail load error:', err);
      return res.status(500).json({ msg: '우편함을 불러오지 못했습니다.' });
    }
  });

  app.get('/api/v2/mail/status', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const character = await V2Character.findOne({ userId: auth.id }).select('mailbox');
      if (!character) return res.status(404).json({ msg: 'V2 캐릭터를 찾을 수 없습니다.' });
      if (purgeExpiredMail(character) > 0) await character.save();
      const pendingCount = getPendingMail(character).length;
      return res.json({ pendingCount });
    } catch (err) {
      return res.status(500).json({ msg: '우편 상태를 확인하지 못했습니다.' });
    }
  });

  app.post('/api/v2/mail/claim', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        await ensureV2CharacterFoundation(character);
        purgeExpiredMail(character);
        const claimed = claimMail(character, req.body?.mailId);
        await character.save();
        return {
          claimed,
          inventory: buildInventoryView(character),
          huntingTime: serializeHuntingTime(character),
          ...buildMailResponse(character)
        };
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '우편을 수령하지 못했습니다.' });
    }
  });

  app.post('/api/v2/mail/claim-all', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        await ensureV2CharacterFoundation(character);
        purgeExpiredMail(character);
        const claimedCount = claimAllMail(character);
        await character.save();
        return {
          claimedCount,
          inventory: buildInventoryView(character),
          huntingTime: serializeHuntingTime(character),
          ...buildMailResponse(character)
        };
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '우편을 일괄 수령하지 못했습니다.' });
    }
  });

  app.post('/api/v2/world/claim-control', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const clientId = String(req.body?.clientId || '').trim();
      const now = Date.now();

      // Finish the last offline interval before marking this session online.
      // This makes the settlement available in the reconnect response itself.
      await processOfflineHunter(auth.id, now);
      const control = claimWorldControl(auth.id, clientId, now);
      const character = await withCharacterMutation(auth.id, async () => {
        const current = await V2Character.findOne({ userId: auth.id });
        if (!current) throw new Error('V2 character not found.');
        current.worldState.controlSessionId = clientId;
        await current.save();
        return current;
      });
      worldProfileCache.delete(String(auth.id));
      return res.json({
        success: true,
        control,
        character: buildCharacterResponse(character),
        huntingTime: serializeHuntingTime(character)
      });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '월드 조작권을 연결하지 못했습니다.' });
    }
  });

  app.get('/api/v2/ranking', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const onlinePlayers = listAllActivePlayers();
      const onlineById = new Map(
        onlinePlayers.map((player) => [String(player.userId), player])
      );
      const characters = await V2Character.find({})
        .select('userId displayName progression job worldState')
        .sort({ 'progression.level': -1, 'progression.exp': -1, updatedAt: 1 })
        .lean();
      const ranking = characters.map((character, index) => {
        const presence = onlineById.get(String(character.userId));
        const departmentId = character.job?.departmentId || 'unassigned';
        const advancementTier = Number(character.job?.advancementTier) || 0;
        return {
          rank: index + 1,
          userId: String(character.userId),
          displayName: character.displayName,
          level: Number(character.progression?.level) || 1,
          exp: Math.max(0, Number(character.progression?.exp) || 0),
          departmentId,
          departmentName: DEPARTMENTS[departmentId]?.name || '부서 미정',
          advancementTier,
          jobName: getJobName(departmentId, advancementTier),
          mapId: presence ? presence.mapId : character.worldState?.mapId,
          online: Boolean(presence?.online),
          autoHunting: Boolean(presence?.autoHunting)
        };
      });
      return res.json({
        ranking,
        online: ranking.filter((entry) => entry.online)
      });
    } catch (err) {
      return res.status(500).json({ msg: '랭킹을 불러오지 못했습니다.' });
    }
  });

  app.get('/api/v2/party', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    const profile = await getWorldProfile(auth.id);
    if (!profile) return res.status(404).json({ msg: 'V2 캐릭터를 찾을 수 없습니다.' });
    const nearbyPlayers = listActivePlayers(profile.worldState?.mapId)
      .filter((player) => player.userId !== String(auth.id))
      .map(({ userId, nickname, activity }) => ({ userId, nickname, activity }));
    return res.json({ ...getPartyState(auth.id), nearbyPlayers });
  });

  app.post('/api/v2/hunting-time/toggle', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const huntingTime = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        const enabled = req.body?.enabled === true;
        if (enabled && getWorldMap(character.worldState?.mapId)?.safeZone) {
          throw new Error('안전지대에서는 자동전투를 사용할 수 없습니다.');
        }
        const result = setHuntingEnabled(character, enabled);
        await character.save();
        worldProfileCache.delete(String(auth.id));
        return result;
      });
      return res.json({ success: true, huntingTime });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '자동사냥 상태를 변경하지 못했습니다.' });
    }
  });

  app.post('/api/v2/hunting-time/tick', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const huntingTime = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        const safeZone = Boolean(getWorldMap(character.worldState?.mapId)?.safeZone);
        const result = safeZone
          ? setHuntingEnabled(character, false)
          : tickHuntingTime(character, req.body?.active === true);
        await character.save();
        worldProfileCache.delete(String(auth.id));
        return result;
      });
      return res.json({ success: true, huntingTime });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '자동사냥 시간을 동기화하지 못했습니다.' });
    }
  });

  app.post('/api/v2/hunting-time/offline-summary/seen', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 character not found.');
        if (!character.huntingTime || typeof character.huntingTime !== 'object') {
          character.huntingTime = {};
        }
        const acknowledgement = acknowledgeOfflineHuntingSummary(
          character,
          req.body?.summaryId
        );
        if (acknowledgement.cleared) await character.save();
        return {
          acknowledged: acknowledgement.acknowledged,
          huntingTime: serializeHuntingTime(character)
        };
      });
      worldProfileCache.delete(String(auth.id));
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '오프라인 사냥 정산 확인 처리에 실패했습니다.' });
    }
  });

  app.post('/api/v2/party/invite', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const profile = await getWorldProfile(auth.id);
      const targetId = String(req.body?.targetId || '');
      const target = listActivePlayers(profile?.worldState?.mapId)
        .find((player) => player.userId === targetId);
      if (!profile || !target) throw new Error('같은 맵에 있는 플레이어만 초대할 수 있습니다.');
      const invitation = invitePlayer(
        { userId: auth.id, nickname: profile.displayName },
        { userId: target.userId, nickname: target.nickname }
      );
      return res.json({ success: true, invitation, ...getPartyState(auth.id) });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '파티 초대를 보내지 못했습니다.' });
    }
  });

  app.post('/api/v2/party/accept', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const profile = await getWorldProfile(auth.id);
      const invitation = getPartyState(auth.id).invitation;
      const inviterPresent = listActivePlayers(profile?.worldState?.mapId)
        .some((player) => player.userId === invitation?.inviterId);
      if (!inviterPresent) throw new Error('초대한 플레이어가 같은 맵에 없습니다.');
      const party = acceptInvitation(
        { userId: auth.id, nickname: profile?.displayName },
        req.body?.invitationId
      );
      return res.json({ success: true, party, invitation: null });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '파티 초대를 수락하지 못했습니다.' });
    }
  });

  app.post('/api/v2/party/decline', (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    declineInvitation(auth.id, req.body?.invitationId);
    return res.json({ success: true, ...getPartyState(auth.id) });
  });

  app.post('/api/v2/party/leave', (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      removeMember(auth.id);
      return res.json({ success: true, ...getPartyState(auth.id) });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '파티를 탈퇴하지 못했습니다.' });
    }
  });

  app.post('/api/v2/party/kick', (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      removeMember(req.body?.targetId, auth.id);
      return res.json({ success: true, ...getPartyState(auth.id) });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '파티원을 추방하지 못했습니다.' });
    }
  });

  app.get('/api/v2/trade', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const profile = await getWorldProfile(auth.id);
      const nearbyPlayers = listActivePlayers(profile?.worldState?.mapId)
        .filter((player) => String(player.userId) !== String(auth.id))
        .map((player) => ({
          userId: player.userId,
          nickname: player.nickname
        }));
      return res.json({ ...getTradeState(auth.id), nearbyPlayers });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '교환 정보를 불러오지 못했습니다.' });
    }
  });

  app.post('/api/v2/trade/request', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const profile = await getWorldProfile(auth.id);
      const target = listActivePlayers(profile?.worldState?.mapId).find(
        (player) => String(player.userId) === String(req.body?.targetId)
      );
      if (!target) throw new Error('교환 상대가 같은 맵에 없습니다.');
      const request = requestTrade(
        {
          userId: auth.id,
          nickname: profile.displayName,
          mapId: profile.worldState?.mapId
        },
        target
      );
      return res.json({ success: true, request });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '교환을 요청하지 못했습니다.' });
    }
  });

  app.post('/api/v2/trade/respond', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      if (req.body?.accepted === true) {
        const profile = await getWorldProfile(auth.id);
        const pending = getTradeState(auth.id).request;
        const inviterPresent = listActivePlayers(profile?.worldState?.mapId)
          .some((player) => String(player.userId) === String(pending?.inviterId));
        if (!pending || pending.mapId !== profile?.worldState?.mapId || !inviterPresent) {
          throw new Error('교환을 요청한 플레이어가 같은 맵에 없습니다.');
        }
      }
      respondTrade(auth.id, req.body?.requestId, req.body?.accepted === true);
      return res.json({ success: true, ...getTradeState(auth.id) });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '교환 요청에 응답하지 못했습니다.' });
    }
  });

  app.post('/api/v2/trade/offer', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const character = await V2Character.findOne({ userId: auth.id }).select('inventory');
      if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
      const items = (Array.isArray(req.body?.items) ? req.body.items : []).map((requested) => {
        const stack = character.inventory?.items?.find(
          (entry) => String(entry.stackId) === String(requested.stackId)
        );
        const item = getItemDefinition(stack?.itemId);
        if (item?.tradeable === false || item?.category === 'cash') {
          throw new Error('캐쉬 아이템은 교환할 수 없습니다.');
        }
        return {
          stackId: String(requested.stackId || ''),
          itemId: item?.id || '',
          name: item?.name || '',
          icon: item?.icon || '',
          quantity: requested.quantity
        };
      });
      const session = setTradeOffer(auth.id, {
        money: req.body?.money,
        items
      });
      return res.json({ success: true, session: getTradeState(auth.id).session, id: session.id });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '교환 물품을 등록하지 못했습니다.' });
    }
  });

  app.post('/api/v2/trade/confirm', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    const confirmation = confirmTrade(auth.id);
    if (!confirmation.ready) {
      return res.json({ success: true, completed: false, ...getTradeState(auth.id) });
    }
    const session = confirmation.session;
    const [leftUser, rightUser] = session.users;
    try {
      const result = await withTwoCharacterMutations(
        leftUser.userId,
        rightUser.userId,
        async () => {
          const [leftCharacter, rightCharacter] = await Promise.all([
            V2Character.findOne({ userId: leftUser.userId }),
            V2Character.findOne({ userId: rightUser.userId })
          ]);
          if (!leftCharacter || !rightCharacter) throw new Error('교환 캐릭터를 찾지 못했습니다.');
          if (
            String(leftCharacter.worldState?.mapId) !== session.mapId
            || String(rightCharacter.worldState?.mapId) !== session.mapId
          ) throw new Error('두 플레이어가 같은 맵에 있지 않습니다.');

          const characterById = {
            [leftUser.userId]: leftCharacter,
            [rightUser.userId]: rightCharacter
          };
          const transferPlans = session.users.map((sourceUser) => {
            const targetUser = session.users.find((user) => user.userId !== sourceUser.userId);
            const source = characterById[sourceUser.userId];
            const target = characterById[targetUser.userId];
            const offer = session.offers[sourceUser.userId];
            const sourceMoney = Math.max(0, Math.floor(Number(source.economy?.money) || 0));
            if (sourceMoney < offer.money) throw new Error('교환할 돈이 부족합니다.');
            const items = offer.items.map(({ stackId, quantity }) => {
              const stack = source.inventory?.items?.find(
                (entry) => String(entry.stackId) === stackId
              );
              const item = getItemDefinition(stack?.itemId);
              if (
                !stack
                || !item
                || item.tradeable === false
                || item.category === 'cash'
                || Number(stack.quantity) < quantity
              ) {
                throw new Error('교환할 아이템 수량이 부족합니다.');
              }
              assertInventorySpace(target, item, quantity);
              return { stackId, itemId: item.id, quantity };
            });
            return { source, target, offer, items };
          });

          for (const plan of transferPlans) {
            plan.source.economy.money = Math.max(
              0,
              Math.floor(Number(plan.source.economy?.money) || 0) - plan.offer.money
            );
            plan.target.economy.money = Math.max(
              0,
              Math.floor(Number(plan.target.economy?.money) || 0)
                + Math.floor(plan.offer.money * 0.95)
            );
            for (const item of plan.items) {
              const consumed = consumeInventoryStack(plan.source, item.stackId, item.quantity);
              if (!consumed || consumed.quantity !== item.quantity) {
                throw new Error('교환 중 아이템 수량이 변경되었습니다.');
              }
              addInventoryItem(plan.target, item.itemId, item.quantity, consumed.data);
            }
          }
          leftCharacter.markModified('economy');
          rightCharacter.markModified('economy');
          await Promise.all([leftCharacter.save(), rightCharacter.save()]);
          worldProfileCache.delete(leftUser.userId);
          worldProfileCache.delete(rightUser.userId);
          return {
            left: buildCharacterResponse(leftCharacter),
            right: buildCharacterResponse(rightCharacter)
          };
        }
      );
      closeTrade(auth.id);
      const myCharacter = String(auth.id) === String(leftUser.userId) ? result.left : result.right;
      return res.json({
        success: true,
        completed: true,
        feePercent: 5,
        character: myCharacter,
        inventory: buildInventoryView(
          String(auth.id) === String(leftUser.userId)
            ? await V2Character.findOne({ userId: leftUser.userId })
            : await V2Character.findOne({ userId: rightUser.userId })
        )
      });
    } catch (err) {
      resetTradeConfirmations(session);
      return res.status(400).json({ msg: err.message || '교환을 완료하지 못했습니다.' });
    }
  });

  app.post('/api/v2/trade/cancel', (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    closeTrade(auth.id);
    return res.json({ success: true });
  });

  app.post('/api/v2/world/heartbeat', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    if (!requireWorldControl(req, res, auth)) return;
    try {
      const profile = await getWorldProfile(auth.id);
      if (!profile) return res.status(404).json({ msg: 'V2 캐릭터를 찾을 수 없습니다.' });
      if (String(profile.huntingTime?.lastDailyGrantDate || '') !== getKoreaDateKey()) {
        await withCharacterMutation(auth.id, async () => {
          const character = await V2Character.findOne({ userId: auth.id });
          if (character && ensureDailyHuntingMail(character)) await character.save();
        });
        worldProfileCache.delete(String(auth.id));
      }
      const requestedMapId = String(req.body?.mapId || '');
      const requestedMap = getWorldMap(requestedMapId);
      if (!requestedMap) return res.status(400).json({ msg: '존재하지 않는 맵입니다.' });
      const isDead = Number(profile.resources.currentHp) <= 0;
      const recoverySkill = profile.skillTree?.skills?.find(
        (skill) => skill.id === 'recovery_improvement' && skill.level > 0
      );
      const endureSkill = profile.skillTree?.skills?.find(
        (skill) => skill.id === 'endure' && skill.level > 0
      );
      const strongMindSkill = profile.skillTree?.skills?.find(
        (skill) => skill.id === 'strong_mind' && skill.level > 0
      );
      const mapId = isDead
        ? String(profile.worldState?.mapId || START_MAP_ID)
        : requestedMapId;
      const enteringSafeZoneWithAutoCombat = !isDead
        && requestedMap.safeZone
        && Boolean(profile.huntingTime?.enabled);
      if (!isDead && (mapId !== profile.worldState?.mapId || enteringSafeZoneWithAutoCombat)) {
        const x = Math.max(0, Math.min(94, Number(req.body?.x) || 8));
        const floor = Number(req.body?.floor) === 1 ? 1 : 0;
        const safeZoneHuntingUpdate = requestedMap.safeZone
          ? {
            'huntingTime.enabled': false,
            'huntingTime.lastTickAt': null
          }
          : {};
        await V2Character.updateOne(
          { userId: auth.id },
          {
            $set: {
              'worldState.mapId': mapId,
              'worldState.x': x,
              'worldState.floor': floor,
              ...safeZoneHuntingUpdate
            }
          }
        );
        profile.worldState = { ...profile.worldState, mapId, x, floor };
        if (requestedMap.safeZone) {
          profile.huntingTime = {
            ...(profile.huntingTime || {}),
            enabled: false,
            lastTickAt: null
          };
        }
      }
      const state = updatePresence({
        userId: String(auth.id),
        nickname: profile.displayName,
        mapId,
        x: req.body?.x,
        floor: req.body?.floor,
        activity: req.body?.activity,
        motion: req.body?.motion,
        facingLeft: req.body?.facingLeft,
        jumpEvent: req.body?.jumpEvent,
        currentHp: profile.resources.currentHp,
        maxHp: profile.resources.maxHp,
        currentMp: profile.resources.currentMp,
        maxMp: profile.resources.maxMp,
        playerLevel: profile.progression?.level,
        playerStats: profile.stats,
        physicalDefense: profile.derivedStats.physicalDefense ?? profile.derivedStats.defense,
        magicDefense: profile.derivedStats.magicDefense,
        archetype: DEPARTMENTS[profile.job?.departmentId]?.archetype || 'beginner',
        damageReductionPercent: profile.skillEffects?.damageReductionPercent,
        dodgeChance: profile.skillEffects?.dodgeChance,
        blockChance: profile.skillEffects?.blockChance,
        stanceChance: profile.skillEffects?.stanceChance,
        contactReflectPercent: profile.skillEffects?.contactReflectPercent,
        contactReflectCapPercent: profile.skillEffects?.contactReflectCapPercent,
        mpDamageGuardPercent: profile.skillEffects?.mpDamageGuardPercent,
        stealth: profile.skillEffects?.stealth,
        periodicHealPercent: recoverySkill?.values?.healPercent,
        periodicHealAmount: Number(profile.skillEffects?.periodicHpRestore) || 0,
        periodicHealIntervalMs: Number(
          recoverySkill?.values?.intervalSeconds
          || profile.skillEffects?.periodicRestoreIntervalSeconds
          || 0
        ) * 1000,
        periodicMpIntervalMs: Number(
          strongMindSkill?.values?.intervalSeconds
          || profile.skillEffects?.periodicRestoreIntervalSeconds
          || 0
        ) * 1000,
        periodicMpAmount: Number(strongMindSkill?.values?.mpRestore)
          || Number(profile.skillEffects?.periodicMpRestore)
          || 0,
        idleHealAmount: endureSkill?.values?.heal,
        idleHealIntervalMs: Number(endureSkill?.values?.intervalSeconds || 0) * 1000,
        autoHunting: !requestedMap.safeZone && Boolean(profile.huntingTime?.enabled),
        autoHuntRemainingSeconds: Number(profile.huntingTime?.remainingSeconds) || 0
      });
      let summonCombat = null;
      const summonSnapshot = profile.skillTree?.summon;
      const summonNow = Date.now();
      const shouldProcessSummon = isSummonAttackDue(summonSnapshot, summonNow)
        || isCompanionQuestTickDue(profile, summonNow);
      if (shouldProcessSummon) {
        await withCharacterMutation(auth.id, async () => {
          const character = await V2Character.findOne({ userId: auth.id });
          if (!character) return;
          const companionProgressed = recordCompanionQuestTicks(character, summonNow);
          const freshProfile = buildCharacterResponse(character);
          summonCombat = await processAttackingSummon({
            character,
            profile: freshProfile,
            now: summonNow
          });
          if (companionProgressed || summonCombat) {
            await character.save();
            worldProfileCache.delete(String(auth.id));
          }
        });
      }
      if (state.contactEvents.length) {
        await Promise.all(state.contactEvents.map((event) => (
          withCharacterMutation(event.userId, async () => {
            const character = await V2Character.findOne({ userId: event.userId });
            if (!character) return;
            const currentHp = Math.max(0, Number(character.resources.currentHp) || 0);
            const currentMp = Math.max(0, Number(character.resources.currentMp) || 0);
            const nextHp = Number.isFinite(Number(event.currentHp))
              ? Math.max(0, Number(event.currentHp))
              : Math.max(0, currentHp - Number(event.damage || 0));
            const nextMp = Number.isFinite(Number(event.currentMp))
              ? Math.max(0, Number(event.currentMp))
              : currentMp;
            character.resources.currentHp = nextHp;
            character.resources.currentMp = nextMp;
            event.currentHp = nextHp;
            event.currentMp = nextMp;
            event.expLost = 0;
            character.worldState.mapId = state.mapId;
            character.worldState.x = Math.max(0, Math.min(94, Number(event.x) || 8));
            character.worldState.floor = Number(event.floor) === 1 ? 1 : 0;
            if (currentHp > 0 && nextHp <= 0) {
              recordQuestEvent(character, { type: 'death' });
              const requiredExp = getRequiredExpV2(character.progression?.level);
              const currentExp = Math.max(0, Number(character.progression?.exp) || 0);
              event.expLost = Math.min(currentExp, Math.floor(requiredExp * 0.1));
              character.progression.exp = currentExp - event.expLost;
            } else if (currentHp > 0 && nextHp > 0 && Number(event.damage) > 0) {
              recordQuestEvent(character, {
                type: 'hit-survive',
                mapId: String(state.mapId || ''),
                hpPercent: nextHp / Math.max(1, Number(character.resources.maxHp) || 1) * 100,
                amount: 1
              });
            }
            const autoPotionUses = applyConfiguredAutoPotions(character);
            event.currentHp = Math.max(0, Number(character.resources.currentHp) || 0);
            event.currentMp = Math.max(0, Number(character.resources.currentMp) || 0);
            await character.save();
            queueAutoPotionUpdate(event.userId, character, autoPotionUses);
            updatePlayerResources(event.userId, character.resources);
            worldProfileCache.delete(String(event.userId));
          })
        )));
        for (const event of state.contactEvents) {
          const player = state.players.find((entry) => entry.userId === event.userId);
          if (player) {
            player.currentHp = event.currentHp;
            player.currentMp = event.currentMp;
          }
        }
      }
      if (state.recoveryEvents.length) {
        for (const event of state.recoveryEvents) {
          await withCharacterMutation(event.userId, async () => {
            const character = await V2Character.findOne({ userId: event.userId });
            if (!character) return;
            const currentHp = Math.max(0, Number(character.resources?.currentHp) || 0);
            const maxHp = Math.max(1, Number(character.resources?.maxHp) || 1);
            const healed = currentHp > 0
              ? Math.max(0, Math.min(maxHp - currentHp, Math.floor(Number(event.hpAmount) || 0)))
              : 0;
            const currentMp = Math.max(0, Number(character.resources?.currentMp) || 0);
            const maxMp = Math.max(0, Number(character.resources?.maxMp) || 0);
            const restoredMp = currentHp > 0
              ? Math.max(0, Math.min(maxMp - currentMp, Math.floor(Number(event.mpAmount) || 0)))
              : 0;
            character.resources.currentHp = currentHp + healed;
            character.resources.currentMp = currentMp + restoredMp;
            event.healed = healed;
            event.restoredMp = restoredMp;
            event.currentHp = character.resources.currentHp;
            event.currentMp = character.resources.currentMp;
            if (healed > 0 || restoredMp > 0) await character.save();
            updatePlayerResources(event.userId, character.resources);
            worldProfileCache.delete(String(event.userId));
          });
          const player = state.players.find((entry) => entry.userId === event.userId);
          if (player) {
            player.currentHp = event.currentHp;
            player.currentMp = event.currentMp;
          }
        }
      }
      const self = state.players.find((player) => player.userId === String(auth.id));
      if (self) {
        profile.resources.currentHp = self.currentHp;
        profile.resources.maxHp = self.maxHp;
        profile.resources.currentMp = self.currentMp;
        profile.resources.maxMp = self.maxMp;
      }
      const fieldBossRewards = [];
      for (const rewardEvent of state.fieldBossRewards || []) {
        fieldBossRewards.push(await applyFieldBossRewards(rewardEvent));
      }
      return res.json({
        mapId: state.mapId,
        players: state.players,
        monsters: state.monsters,
        self,
        contactEvents: state.contactEvents,
        recoveryEvents: state.recoveryEvents,
        summonCombat,
        fieldBossStatusEvents: state.fieldBossStatusEvents,
        fieldBossRewards,
        lootCollections: state.lootCollections,
        partyState: getPartyState(auth.id),
        tradeState: getTradeState(auth.id),
        partyPortals: listVisiblePartyPortals(auth.id, state.mapId),
        autoPotionUpdate: takeAutoPotionUpdate(auth.id),
        serverTime: Date.now()
      });
    } catch (err) {
      console.error('V2 world heartbeat error:', err);
      return res.status(400).json({ msg: err.message || '필드 상태를 동기화하지 못했습니다.' });
    }
  });

  app.post('/api/v2/world/party-portal/use', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    if (!requireWorldControl(req, res, auth)) return;
    try {
      const destination = usePartyPortal(
        auth.id,
        req.body?.portalId,
        req.body?.mapId
      );
      const map = getWorldMap(destination.mapId);
      if (!map) throw new Error('포탈 목적지를 찾지 못했습니다.');
      await V2Character.updateOne(
        { userId: auth.id },
        {
          $set: {
            'worldState.mapId': destination.mapId,
            'worldState.x': destination.x,
            'worldState.floor': destination.floor
          }
        }
      );
      leaveWorld(auth.id);
      worldProfileCache.delete(String(auth.id));
      return res.json({ success: true, destination, map });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '귀환 포탈을 사용하지 못했습니다.' });
    }
  });

  app.post('/api/v2/world/attack', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    if (!requireWorldControl(req, res, auth)) return;
    try {
      const profile = await getWorldProfile(auth.id);
      if (!profile) return res.status(404).json({ msg: 'V2 캐릭터를 찾을 수 없습니다.' });
      if (!canUseBasicAttack(profile)) {
        return res.status(400).json({
          msg: '기본공격은 전직하지 않은 10레벨 미만 신입사원만 사용할 수 있습니다.'
        });
      }
      if (!profile.huntingTime?.enabled || Number(profile.huntingTime?.remainingSeconds) <= 0) {
        return res.status(400).json({ msg: '자동사냥 시간이 활성화되어 있지 않습니다.' });
      }
      const ammunition = getCombatAmmunition(profile);
      const consumesAmmunition = ammunition && !profile.skillEffects?.noAmmoConsumption;
      if (consumesAmmunition) {
        const quantity = (profile.inventory?.items || [])
          .filter((item) => item.id === ammunition.itemId)
          .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        if (quantity <= 0) {
          return res.status(400).json({ msg: '공격에 필요한 탄약이 부족합니다.' });
        }
      }
      const skillEffects = profile.skillEffects || {};
      const activeElements = getActiveWeaponElements(profile.skillTree);
      const comboCount = Math.max(0, Number(profile.skillTree?.comboCount) || 0);
      const hpPercent = Number(profile.resources?.currentHp) / Math.max(1, Number(profile.resources?.maxHp)) * 100;
      const rolled = rollBasicAttackDamage(profile, { activeElements, comboCount, hpPercent });
      const archetype = DEPARTMENTS[profile.job?.departmentId]?.archetype;
      const result = attackMonster({
        userId: String(auth.id),
        mapId: String(req.body?.mapId || ''),
        monsterId: String(req.body?.monsterId || ''),
        damage: rolled.damage,
        damageRange: rolled.damageRange,
        rangePx: profile.combatPresentation?.rangePx || profile.derivedStats.attackRange,
        damageType: archetype === 'mage' ? 'magic' : 'physical',
        elements: activeElements,
        freezeSeconds: activeElements.includes('ice') ? 4 : 0,
        accuracy: profile.derivedStats.accuracy,
        playerLevel: profile.progression?.level,
        mpAbsorbChance: archetype === 'mage' ? Number(skillEffects.mpAbsorbChance) || 0 : 0,
        mpAbsorbPercent: archetype === 'mage' ? Number(skillEffects.mpAbsorbPercent) || 0 : 0,
        poisonChance: Number(skillEffects.poisonChance) || 0,
        poisonAttack: Number(skillEffects.poisonAttack) || 0,
        poisonDurationSeconds: Number(skillEffects.poisonDurationSeconds) || 0,
        poisonMaxStacks: Number(skillEffects.poisonMaxStacks) || 0,
        closeRangeChance: Number(skillEffects.closeRangeChance) || 0,
        closeRangeDamagePercent: Number(skillEffects.closeRangeDamagePercent) || 0,
        executeThresholdPercent: Number(skillEffects.executeThresholdPercent) || 0,
        executeChance: Number(skillEffects.executeChance) || 0
      });
      if (!result.success) {
        return res.status(['out-of-range', 'dead'].includes(result.reason) ? 409 : 404).json({
          msg: result.reason === 'dead'
            ? '사망 상태에서는 공격할 수 없습니다.'
            : (result.reason === 'out-of-range' ? '몬스터가 공격 사거리 밖에 있습니다.' : '공격 대상을 찾을 수 없습니다.'),
          reason: result.reason
        });
      }
      result.critical = rolled.critical;
      if (consumesAmmunition) {
        await V2Character.updateOne(
          {
            userId: auth.id,
            'inventory.items': {
              $elemMatch: { itemId: ammunition.itemId, quantity: { $gte: 1 } }
            }
          },
          { $inc: { 'inventory.items.$.quantity': -1 } }
        );
        if (ammunition.itemId === 'basic_arrow') {
          await V2Character.updateOne(
            { userId: auth.id },
            { $pull: { 'inventory.items': { itemId: ammunition.itemId, quantity: { $lte: 0 } } } }
          );
        }
        worldProfileCache.delete(String(auth.id));
      }
      if (
        !result.defeated
        && !result.missed
        && Math.random() * 100 < Number(skillEffects.doubleStrikeChance || 0)
      ) {
        const second = attackMonster({
          userId: String(auth.id),
          mapId: String(req.body?.mapId || ''),
          monsterId: String(result.targetId || req.body?.monsterId || ''),
          damage: rolled.damage * Number(skillEffects.doubleStrikeDamagePercent || 0) / 100,
          damageRange: rolled.damageRange
            ? scaleDamageRange(rolled.damageRange, Number(skillEffects.doubleStrikeDamagePercent || 0) / 100)
            : null,
          rangePx: profile.combatPresentation?.rangePx || profile.derivedStats.attackRange,
          damageType: archetype === 'mage' ? 'magic' : 'physical',
          elements: activeElements,
          freezeSeconds: activeElements.includes('ice') ? 4 : 0,
          accuracy: profile.derivedStats.accuracy,
          playerLevel: profile.progression?.level,
          poisonChance: Number(skillEffects.poisonChance) || 0,
          poisonAttack: Number(skillEffects.poisonAttack) || 0,
          poisonDurationSeconds: Number(skillEffects.poisonDurationSeconds) || 0,
          poisonMaxStacks: Number(skillEffects.poisonMaxStacks) || 0,
          closeRangeChance: Number(skillEffects.closeRangeChance) || 0,
          closeRangeDamagePercent: Number(skillEffects.closeRangeDamagePercent) || 0,
          executeThresholdPercent: Number(skillEffects.executeThresholdPercent) || 0,
          executeChance: Number(skillEffects.executeChance) || 0
        });
        if (second.success) {
          result.damage += Number(second.damage) || 0;
          result.doubleStrike = true;
          result.knockedBack = result.knockedBack || second.knockedBack;
          result.defeated = second.defeated;
          if (second.monsterLevel) result.monsterLevel = second.monsterLevel;
          result.expReward += Number(second.expReward) || 0;
          result.drops.push(...(second.drops || []));
          if (second.fieldBossReward) result.fieldBossReward = second.fieldBossReward;
          result.monster = second.monster;
          result.players = second.players;
          result.monsters = second.monsters;
        }
      }

      let character = null;
      let experience = null;
      let inventory = null;
      let fieldBossRewardResult = null;
      if (result.fieldBossReward) {
        fieldBossRewardResult = await applyFieldBossRewards(result.fieldBossReward);
        character = await V2Character.findOne({ userId: auth.id });
        if (character) inventory = buildInventoryView(character);
      }
      const attackedWhileStealthed = Number(skillEffects.stealth) > 0;
      if (
        result.expReward > 0
        || result.mpAbsorbed > 0
        || skillEffects.comboEnabled
        || attackedWhileStealthed
        || result.knockedBack
      ) {
        character = character || await V2Character.findOne({ userId: auth.id });
        if (attackedWhileStealthed) {
          const skills = ensureSkillState(character);
          if (clearStealthBuff(skills)) character.markModified('skills');
        }
        if (result.mpAbsorbed > 0) {
          character.resources.currentMp = Math.min(
            Math.max(0, Number(character.resources.maxMp) || 0),
            Math.max(0, Number(character.resources.currentMp) || 0)
              + Number(result.mpAbsorbed)
          );
        }
        if (result.expReward > 0) {
          const expGrant = await grantCombatExperience(
            character,
            result.expReward,
            String(req.body?.mapId || profile.worldState?.mapId || '')
          );
          experience = expGrant.self;
          result.partyExperience = expGrant.party;
          result.drops = applyCombatDrops(character, result.drops);
          result.drops = applySettlementEventDrops(
            character,
            [result.monsterLevel],
            result.drops
          );
        }
        recordCombatQuestProgress(character, result, {
          mapId: String(req.body?.mapId || profile.worldState?.mapId || ''),
          elements: activeElements,
          stealth: attackedWhileStealthed
        });
        if (skillEffects.comboEnabled && !result.missed && result.damage > 0) {
          const skills = ensureSkillState(character);
          const previousCombo = Math.max(0, Number(skills.comboCount) || 0);
          const charge = Math.random() * 100 < Number(skillEffects.comboDoubleChargeChance || 0) ? 2 : 1;
          skills.comboCount = Math.min(
            Number(skillEffects.comboMaximum) || 5,
            previousCombo + charge
          );
          const gained = Math.max(0, skills.comboCount - previousCombo);
          if (gained > 0) recordQuestEvent(character, { type: 'combo-gain', amount: gained });
          character.markModified('skills');
        }
        await character.save();
        worldProfileCache.delete(String(auth.id));
        inventory = buildInventoryView(character);
      }
      return res.json({
        ...result,
        fieldBossRewardResult,
        experience,
        character: character ? buildCharacterResponse(character) : null,
        inventory,
        money: character ? Math.max(0, Number(character.economy?.money) || 0) : null
      });
    } catch (err) {
      console.error('V2 world attack error:', err);
      return res.status(500).json({ msg: '필드 공격을 처리하지 못했습니다.' });
    }
  });

  app.post('/api/v2/world/revive', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    if (!requireWorldControl(req, res, auth)) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        const wasDead = Number(character.resources?.currentHp) <= 0;
        const safeMap = findNearestSafeMap(character.worldState?.mapId);
        if (!safeMap) throw new Error('부활할 안전지대를 찾을 수 없습니다.');
        const storedMaxHp = Math.max(0, Number(character.resources?.maxHp) || 0);
        const storedMaxMp = Math.max(0, Number(character.resources?.maxMp) || 0);
        const storedCurrentMp = Math.max(0, Number(character.resources?.currentMp) || 0);
        character.resources.maxHp = storedMaxHp || 120;
        character.resources.maxMp = storedMaxMp || 80;
        character.resources.currentMp = storedMaxMp
          ? Math.min(character.resources.maxMp, storedCurrentMp)
          : character.resources.maxMp;
        character.resources.currentHp = wasDead
          ? 1
          : Math.max(1, Math.min(character.resources.maxHp, Number(character.resources.currentHp) || 1));
        character.worldState.mapId = safeMap.id;
        character.worldState.x = 8;
        character.worldState.floor = 0;
        await character.save();
        worldProfileCache.delete(String(auth.id));
        updatePlayerResources(auth.id, character.resources);
        leaveWorld(String(auth.id));
        return {
          map: safeMap,
          wasDead,
          character: buildCharacterResponse(character)
        };
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '캐릭터를 부활시키지 못했습니다.' });
    }
  });

  app.post('/api/v2/world/leave', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const clientId = String(req.body?.clientId || '').trim();
      if (!hasWorldControl(auth.id, clientId)) return res.json({ success: true, ignored: true });
      const mapId = String(req.body?.mapId || '');
      if (getWorldMap(mapId)) {
        await V2Character.updateOne(
          { userId: auth.id },
          {
            $set: {
              'worldState.mapId': mapId,
              'worldState.x': Math.max(0, Math.min(94, Number(req.body?.x) || 8)),
              'worldState.floor': Number(req.body?.floor) === 1 ? 1 : 0
            }
          }
        );
      }
      releaseWorldControl(auth.id, clientId);
      worldProfileCache.delete(String(auth.id));
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ msg: '마지막 위치를 저장하지 못했습니다.' });
    }
  });

  app.get('/api/v2/admin/grant-items', (req, res) => {
    if (!requireAdmin(req, res)) return;
    return res.json({ items: listAdminGrantItems() });
  });

  app.post('/api/v2/admin/cash/grant', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const target = String(req.body?.target || '').trim();
      const points = Math.floor(Number(req.body?.points) || 0);
      const allowedPoints = new Set([450, 800, 1700, 5200]);
      if (!target) return res.status(400).json({ msg: '대상 아이디 또는 닉네임을 입력해주세요.' });
      if (!allowedPoints.has(points)) return res.status(400).json({ msg: '지급 가능한 캐시 단위를 선택해주세요.' });
      const user = await User.findOne({ $or: [{ username: target }, { nickname: target }] });
      if (!user) return res.status(404).json({ msg: '대상 유저를 찾을 수 없습니다.' });
      await ensureV2MigrationForUser(user);
      const result = await withCharacterMutation(user._id, async () => {
        const character = await V2Character.findOne({ userId: user._id });
        await ensureV2CharacterFoundation(character);
        const granted = grantCashPoints(character, points);
        await character.save();
        return granted;
      });
      return res.json({
        success: true,
        recipient: user.nickname || user.username,
        ...result
      });
    } catch (err) {
      if (isV2AccountDeletedError(err)) return res.status(410).json({ msg: err.message });
      return res.status(500).json({ msg: err.message || '캐시를 지급하지 못했습니다.' });
    }
  });

  app.post('/api/v2/admin/mail/send', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const target = String(req.body?.target || '').trim();
      const allRecipients = req.body?.allRecipients === true;
      const itemId = String(req.body?.itemId || '');
      const quantity = Math.max(1, Math.min(999999, Math.floor(Number(req.body?.quantity) || 1)));
      const item = getItemDefinition(itemId);
      if (!item?.adminGrantOnly) return res.status(400).json({ msg: '운영자 지급 품목이 아닙니다.' });
      if (allRecipients) {
        const entry = createAdminMail({
          itemId,
          quantity,
          message: req.body?.message
        });
        const result = await V2Character.updateMany({}, { $push: { mailbox: entry } });
        return res.json({
          success: true,
          allRecipients: true,
          recipientCount: result.modifiedCount,
          mail: serializeMail(entry)
        });
      }
      if (!target) return res.status(400).json({ msg: '대상 아이디 또는 닉네임을 입력해주세요.' });
      const user = await User.findOne({
        $or: [{ username: target }, { nickname: target }]
      });
      if (!user) return res.status(404).json({ msg: '대상 유저를 찾을 수 없습니다.' });
      await V2Character.updateOne(
        { userId: user._id },
        {
          $max: {
            'stats.grit': 4,
            'stats.processingSpeed': 4,
            'stats.workKnowledge': 4,
            'stats.awareness': 4
          }
        },
        { runValidators: false }
      );
      await ensureV2MigrationForUser(user);
      const mail = await withCharacterMutation(user._id, async () => {
        const character = await V2Character.findOne({ userId: user._id });
        await ensureV2CharacterFoundation(character);
        const entry = createAdminMail({
          itemId,
          quantity,
          message: req.body?.message
        });
        character.mailbox.push(entry);
        await character.save();
        return serializeMail(entry);
      });
      return res.json({
        success: true,
        recipient: user.nickname || user.username,
        mail
      });
    } catch (err) {
      if (isV2AccountDeletedError(err)) {
        return res.status(410).json({ msg: err.message });
      }
      console.error('V2 admin mail send error:', err);
      return res.status(500).json({ msg: err.message || '운영자 선물을 보내지 못했습니다.' });
    }
  });

  app.post('/api/v2/admin/account/delete', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const target = String(req.body?.target || '').trim();
      if (!target) return res.status(400).json({ msg: '삭제할 계정 아이디 또는 닉네임을 입력해주세요.' });
      const legacyUser = await User.findOne({
        $or: [{ username: target }, { nickname: target }]
      }).select('_id username nickname').lean();
      const v2Account = await V2Account.findOne({
        $or: [
          { username: target },
          { nickname: target },
          ...(legacyUser?._id ? [{ sourceUserId: legacyUser._id }] : [])
        ]
      }).lean();
      const v2Character = await V2Character.findOne({
        $or: [
          { displayName: target },
          ...(legacyUser?._id ? [{ userId: legacyUser._id }] : []),
          ...(v2Account?.sourceUserId ? [{ userId: v2Account.sourceUserId }] : [])
        ]
      }).lean();
      const sourceUserId = legacyUser?._id || v2Account?.sourceUserId || v2Character?.userId;
      if (!sourceUserId && !v2Account?._id && !v2Character?._id) {
        return res.status(404).json({ msg: '삭제할 V2 계정을 찾을 수 없습니다.' });
      }
      if (sourceUserId) {
        await markV2AccountDeleted({
          sourceUserId,
          username: legacyUser?.username || v2Account?.username || '',
          nickname: legacyUser?.nickname || v2Account?.nickname || v2Character?.displayName || '',
          reason: 'admin-delete',
          deletedBy: adminUsername
        });
        leaveWorld(sourceUserId);
        worldProfileCache.delete(String(sourceUserId));
      }
      const [accountResult, characterResult, snapshotResult] = await Promise.all([
        sourceUserId
          ? V2Account.deleteMany({ sourceUserId })
          : V2Account.deleteMany({ _id: v2Account?._id }),
        sourceUserId
          ? V2Character.deleteMany({ userId: sourceUserId })
          : V2Character.deleteMany({ _id: v2Character?._id }),
        sourceUserId
          ? LegacyUserSnapshot.deleteMany({ sourceUserId })
          : Promise.resolve({ deletedCount: 0 })
      ]);
      return res.json({
        success: true,
        target,
        permanentlyExcluded: Boolean(sourceUserId),
        deleted: {
          displayName: legacyUser?.nickname || v2Account?.nickname || v2Character?.displayName || target,
          username: legacyUser?.username || v2Account?.username || ''
        },
        deletedAccounts: accountResult.deletedCount || 0,
        deletedCharacters: characterResult.deletedCount || 0,
        deletedSnapshots: snapshotResult.deletedCount || 0
      });
    } catch (err) {
      console.error('V2 admin account delete error:', err);
      return res.status(500).json({ msg: err.message || 'V2 계정을 삭제하지 못했습니다.' });
    }
  });

  app.get('/api/v2/admin/signup-code', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const setting = await getSignupCodeSetting();
      return res.json({
        configured: Boolean(setting?.value?.codeHash),
        updatedAt: setting?.updatedAt || null
      });
    } catch (err) {
      console.error('V2 admin signup code load error:', err);
      return res.status(500).json({ msg: '가입 코드 설정을 불러오지 못했습니다.' });
    }
  });

  app.post('/api/v2/admin/signup-code', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const code = String(req.body?.signupCode || '').trim();
      if (code.length < 4 || code.length > 64) {
        return res.status(400).json({ msg: '가입 코드는 4~64자로 설정해주세요.' });
      }
      const codeHash = await bcrypt.hash(code, 10);
      const updatedAt = new Date();
      await V2Setting.findOneAndUpdate(
        { key: SIGNUP_CODE_SETTING_KEY },
        { $set: { value: { codeHash }, updatedAt } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return res.json({ success: true, configured: true, updatedAt });
    } catch (err) {
      console.error('V2 admin signup code save error:', err);
      return res.status(500).json({ msg: '가입 코드를 저장하지 못했습니다.' });
    }
  });

  app.get('/api/v2/admin/migration-summary', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const users = await User.find({}).select('_id username nickname gameState.level').lean();
      const sourceLevels = users.map((user) => Math.max(1, Number(user.gameState?.level) || 1)).sort((a, b) => a - b);
      const mappings = users
        .map((user) => ({
          userId: String(user._id),
          name: user.nickname || user.username,
          sourceLevel: Math.max(1, Number(user.gameState?.level) || 1),
          mappedLevel: mapLegacyLevelToV2(user.gameState?.level)
        }))
        .sort((a, b) => b.sourceLevel - a.sourceLevel);
      const middle = sourceLevels.length ? sourceLevels[Math.floor(sourceLevels.length / 2)] : 0;
      const [deletedAccountCount, accountCount, snapshotCount, characterCount] = await Promise.all([
        V2DeletedAccount.countDocuments({}),
        V2Account.countDocuments({ migrationVersion: MIGRATION_VERSION }),
        LegacyUserSnapshot.countDocuments({ migrationVersion: MIGRATION_VERSION }),
        V2Character.countDocuments({})
      ]);
      return res.json({
        totalUsers: users.length,
        eligibleUserCount: Math.max(0, users.length - deletedAccountCount),
        deletedAccountCount,
        accountCount,
        snapshotCount,
        characterCount,
        sourceLevelStats: {
          min: sourceLevels[0] || 0,
          median: middle,
          max: sourceLevels[sourceLevels.length - 1] || 0
        },
        highestLevelPreview: mappings.slice(0, 30)
      });
    } catch (err) {
      console.error('V2 migration summary error:', err);
      return res.status(500).json({ msg: 'V2 이관 현황을 불러오지 못했습니다.' });
    }
  });

  app.post('/api/v2/admin/snapshot-batch', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const limit = Math.max(1, Math.min(100, Math.floor(Number(req.body?.limit) || 50)));
      const afterId = String(req.body?.afterId || '').trim();
      const query = afterId ? { _id: { $gt: afterId } } : {};
      const users = await User.find(query).sort({ _id: 1 }).limit(limit);
      const results = [];
      let skippedDeleted = 0;
      for (const user of users) {
        try {
          const result = await ensureV2MigrationForUser(user);
          results.push({
            userId: String(user._id),
            name: user.nickname || user.username,
            sourceLevel: result.preview.sourceLevel,
            mappedLevel: result.preview.mappedLevel
          });
        } catch (err) {
          if (!isV2AccountDeletedError(err)) throw err;
          skippedDeleted += 1;
        }
      }
      return res.json({
        success: true,
        processed: users.length,
        migrated: results.length,
        skippedDeleted,
        results,
        nextAfterId: users.length === limit ? String(users[users.length - 1]._id) : '',
        complete: users.length < limit
      });
    } catch (err) {
      console.error('V2 snapshot batch error:', err);
      return res.status(500).json({ msg: 'V2 일괄 스냅샷 생성에 실패했습니다.' });
    }
  });

  if (String(process.env.APP_MODE || '').toLowerCase() === 'v2') {
    const offlineHuntingTimer = setInterval(
      runOfflineHuntingSweep,
      OFFLINE_HUNTING_SWEEP_MS
    );
    offlineHuntingTimer.unref?.();
  }
}

module.exports = {
  registerV2Routes,
  V2_RETAINED_FEATURES,
  V2_REMOVED_FEATURES,
  V2_PLANNED_FEATURES,
  validateSignupPayload,
  calculatePartyExperienceShares,
  calculateWelfareSupportDamage,
  calculateMoneyDropAmount,
  serializeMarketplaceListing
};
