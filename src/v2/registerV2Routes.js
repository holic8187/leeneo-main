'use strict';

const V2Account = require('./models/V2Account');
const V2Character = require('./models/V2Character');
const LegacyUserSnapshot = require('./models/LegacyUserSnapshot');
const V2Setting = require('./models/V2Setting');
const { MAX_LEVEL, getRequiredExpV2 } = require('./constants/experienceTable');
const {
  START_MAP_ID,
  WORLD_MAPS,
  getWorldMap,
  findNearestSafeMap
} = require('./world/mapDefinitions');
const {
  DEPARTMENTS,
  applyAdvancement
} = require('./jobs/advancementRules');
const {
  claimWorldControl,
  hasWorldControl,
  releaseWorldControl,
  updatePresence,
  attackMonster,
  useSkillOnMonsters,
  updatePlayerResources,
  listActivePlayers,
  leaveWorld
} = require('./world/worldRuntime');
const { LEGACY_CURVE, mapLegacyLevelToV2 } = require('./progression/levelMigration');
const {
  MIGRATION_VERSION,
  buildMigrationPreview,
  ensureV2MigrationForUser,
  ensureV2SkillPointGrant,
  ensureV2CharacterFoundation,
  buildCharacterResponse
} = require('./services/migrationService');
const {
  calculateReferenceResources,
  applyReferenceResources,
  applyLevelGrowth
} = require('./progression/resourceGrowth');
const { getItemDefinition, listAdminGrantItems } = require('./items/itemCatalog');
const {
  addInventoryItem,
  consumeInventoryItem,
  assignPotionQuickSlot,
  setPotionAutoThreshold,
  useQuickSlotPotion,
  useInventoryExpansionTicket,
  equipInventoryWeapon,
  unequipInventoryWeapon,
  buildInventoryView,
  createAdminMail,
  serializeMail,
  purgeExpiredMail,
  getPendingMail,
  claimMail,
  claimAllMail
} = require('./services/inventoryService');
const { changeDepartment } = require('./services/jobChangeService');
const {
  ensureDailyHuntingMail,
  getKoreaDateKey,
  setHuntingEnabled,
  tickHuntingTime,
  addHuntingMinutes,
  serializeHuntingTime
} = require('./services/huntingTimeService');
const {
  getPartyState,
  getPartyMemberIds,
  invitePlayer,
  acceptInvitation,
  declineInvitation,
  removeMember
} = require('./services/partyService');
const { reconcileHpGrowthSkillBonus } = require('./services/hpGrowthBonusService');
const { reconcileMaxResourceBuff } = require('./services/maxResourceBuffService');
const {
  buyShopItem,
  sellInventoryStack,
  buildShopView
} = require('./services/shopService');
const { SKILL_DEFINITIONS } = require('./skills/skillDefinitions');
const {
  ensureSkillState,
  getSkillLevel,
  resolveSkillValues,
  investSkill,
  setActivePreset,
  getActiveSkillEffects
} = require('./skills/skillService');

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
  '특수 행동',
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
  const experienceMultiplier = 1
    + Math.max(0, Number(getActiveSkillEffects(character).experienceBonusPercent) || 0) / 100;
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

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
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

  function getActivePartyPlayers(userId, mapId) {
    const partyMemberIds = new Set(getPartyMemberIds(userId));
    return listActivePlayers(mapId).filter((player) => partyMemberIds.has(String(player.userId)));
  }

  async function applyBuffToActivePartyMembers(casterId, mapId, buff) {
    const casterKey = String(casterId);
    const targets = getActivePartyPlayers(casterKey, mapId)
      .filter((player) => String(player.userId) !== casterKey);
    for (const player of targets) {
      const teammate = await V2Character.findOne({ userId: player.userId });
      if (!teammate) continue;
      const teammateSkills = ensureSkillState(teammate);
      teammateSkills.activeBuffs = teammateSkills.activeBuffs.filter(
        (entry) => entry.skillId !== buff.skillId
      );
      teammateSkills.activeBuffs.push({
        ...buff,
        effects: { ...(buff.effects || {}) },
        createdAt: new Date(buff.createdAt),
        expiresAt: new Date(buff.expiresAt)
      });
      teammate.markModified('skills');
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
        const maxHp = Math.max(1, Number(caster.resources?.maxHp) || 1);
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
      const maxHp = Math.max(1, Number(teammate.resources?.maxHp) || 1);
      const healed = currentHp > 0
        ? Math.max(0, Math.min(maxHp - currentHp, amount))
        : 0;
      if (healed > 0) {
        teammate.resources.currentHp = currentHp + healed;
        await teammate.save();
        updatePlayerResources(targetId, teammate.resources);
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
    return drops.map((drop) => {
      if (drop.kind === 'money') {
        character.economy.money = Math.max(0, Number(character.economy.money) || 0)
          + Math.max(0, Math.floor(Number(drop.amount) || 0));
        return { ...drop, stored: true };
      }
      try {
        addInventoryItem(character, drop.itemId, drop.quantity);
        return { ...drop, stored: true };
      } catch (_) {
        return { ...drop, stored: false };
      }
    });
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
      worldState: response.worldState
    };
    worldProfileCache.set(key, profile);
    return profile;
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
        let character = await V2Character.findOne({ userId: v2Account.sourceUserId });
        if (!character) {
          const sourceUser = await User.findById(v2Account.sourceUserId);
          if (!sourceUser) {
            return res.status(404).json({ msg: '이관할 원본 유저 정보를 찾을 수 없습니다.' });
          }
          const migration = await ensureV2MigrationForUser(sourceUser);
          character = migration.character;
        } else {
          await ensureV2SkillPointGrant(character);
          await ensureV2CharacterFoundation(character);
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
      console.error('V2 migration prepare error:', err);
      return res.status(500).json({ msg: 'V2 이관 데이터를 준비하지 못했습니다.' });
    }
  });

  app.get('/api/v2/world/maps', (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    return res.json({
      startMapId: START_MAP_ID,
      maps: WORLD_MAPS
    });
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
        applyReferenceResources(character, reference, { fullyRestore: true });
        reconcileHpGrowthSkillBonus(character, { resetAppliedBonus: true });
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

  app.post('/api/v2/skills/use', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    if (!requireWorldControl(req, res, auth)) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        const skillId = String(req.body?.skillId || '');
        const definition = SKILL_DEFINITIONS[skillId];
        const level = getSkillLevel(character, skillId);
        const skillState = ensureSkillState(character);
        if (!definition || definition.passive || level <= 0) {
          throw new Error('사용할 수 없는 스킬입니다.');
        }
        if (!skillState.activePreset.includes(skillId)) {
          throw new Error('전투 프리셋에 등록된 스킬만 사용할 수 있습니다.');
        }
        const values = resolveSkillValues(definition, level);
        const now = Date.now();
        const cooldownUntil = Number(skillState.cooldowns?.[skillId]) || 0;
        if (cooldownUntil > now) {
          throw new Error(`재사용 대기시간이 ${Math.ceil((cooldownUntil - now) / 1000)}초 남았습니다.`);
        }
        const currentHp = Math.max(0, Number(character.resources?.currentHp) || 0);
        const currentMp = Math.max(0, Number(character.resources?.currentMp) || 0);
        const maxHp = Math.max(1, Number(character.resources?.maxHp) || 1);
        if (values.minimumHpPercent && currentHp / maxHp * 100 < values.minimumHpPercent) {
          throw new Error(`체력이 ${values.minimumHpPercent}% 이상일 때만 사용할 수 있습니다.`);
        }
        const hpCost = Math.max(
          0,
          Math.floor(Number(values.hpCost) || maxHp * Number(values.maxHpCostPercent || 0) / 100)
        );
        const mpCost = Math.max(0, Math.floor(Number(values.mpCost) || 0));
        if (currentHp <= hpCost) throw new Error('체력이 부족합니다.');
        if (currentMp < mpCost) throw new Error('정신력이 부족합니다.');
        character.resources.currentHp = currentHp - hpCost;
        character.resources.currentMp = currentMp - mpCost;

        let combat = null;
        let partyBuffToShare = null;
        const damageEffects = new Set([
          'damage', 'multi-damage', 'ignore-defense-damage', 'damage-stun',
          'damage-lock', 'charge', 'consume-combo-damage', 'pull',
          'element-explosion', 'nonlethal-damage', 'fixed-damage'
        ]);
        if (damageEffects.has(definition.effect)) {
          if (definition.effect === 'consume-combo-damage' && skillState.comboCount <= 0) {
            throw new Error('콤보 카운터가 필요합니다.');
          }
          const response = buildCharacterResponse(character);
          const activeEffects = response.skillEffects || {};
          const archetype = DEPARTMENTS[character.job?.departmentId]?.archetype || 'beginner';
          const ammunition = definition.effect === 'fixed-damage'
            ? null
            : getCombatAmmunition(response);
          const ammunitionCount = Math.max(1, Number(values.hits) || 1);
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
          let baseDamage = definition.effect === 'fixed-damage'
            ? Math.max(1, Number(values.fixedDamage) || 1)
            : (archetype === 'mage'
              ? Math.max(1, Number(response.derivedStats.magic) || 4)
              : Math.max(1, Number(response.derivedStats.attackMaximum) || 4));
          baseDamage += Number(ammunition?.attackBonus) || 0;
          const critical = definition.effect !== 'fixed-damage'
            && Math.random() * 100 < Number(response.derivedStats.criticalChance || 0);
          if (critical) {
            baseDamage *= Number(response.derivedStats.criticalDamagePercent || 200) / 100;
          }
          baseDamage *= 1 + Number(activeEffects.damageIncreasePercent || 0) / 100;
          if (activeElements.length) {
            baseDamage *= 1 + Number(activeEffects.elementDamageIncreasePercent || 0) / 100;
          }
          if (activeEffects.comboEnabled) {
            baseDamage *= 1
              + Number(skillState.comboCount || 0)
                * Number(activeEffects.comboDamagePerCount || 0) / 100;
          }
          const resourcePercent = currentHp / maxHp * 100;
          if (
            activeEffects.lowHpThresholdPercent
            && resourcePercent <= Number(activeEffects.lowHpThresholdPercent)
          ) {
            baseDamage *= 1 + Number(activeEffects.lowHpDamageIncreasePercent || 0) / 100;
          }
          const doubleStrike = Math.random() * 100
            < Number(activeEffects.doubleStrikeChance || 0);
          combat = useSkillOnMonsters({
            userId: String(auth.id),
            mapId: String(req.body?.mapId || ''),
            targetId: String(req.body?.targetId || ''),
            baseDamage,
            skillPercent: definition.effect === 'element-explosion'
              ? Number(activeEffects.elementExplosionDamagePercent || values.damagePercent || 250)
              : Number(values.damagePercent) || 100,
            rangePx: Number(values.range ?? definition.range) || 100,
            maxTargets: Number(values.targetCount ?? definition.maxTargets) || 1,
            hits: Number(values.hits) || 1,
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
            stunChance: Number(values.stunChance) || 0,
            stunSeconds: Number(values.stunSeconds) || 0,
            pull: ['charge', 'pull'].includes(definition.effect),
            dealDamage: definition.effect !== 'pull',
            leaveAtOneHp: definition.effect === 'nonlethal-damage',
            piercing: Boolean(definition.piercing)
          });
          if (!combat.success) throw new Error('사거리 안에 공격할 대상이 없습니다.');
          combat.critical = critical;
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
          grantV2Experience(character, combat.expReward);
          combat.drops = applyCombatDrops(character, combat.drops);
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
          combat = {
            success: true,
            healed: targets.reduce((sum, target) => sum + target.healed, 0),
            healingAmount,
            targets
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
          skillState.activeBuffs = skillState.activeBuffs.filter((buff) => buff.skillId !== skillId);
          skillState.activeBuffs.push({
            skillId,
            name: definition.name,
            effects: {
              damageIncreasePercent: Number(values.damageIncreasePercent) || 0,
              accuracyIncrease: Number(values.accuracyIncrease) || 0
            },
            createdAt: new Date(now),
            expiresAt: new Date(now + Number(values.durationSeconds || 1) * 1000)
          });
        } else if (definition.effect === 'summon') {
          skillState.summon = {
            skillId,
            name: definition.name,
            masteryIncrease: Number(values.masteryIncrease) || 0,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + Number(values.durationSeconds || 0) * 1000)
          };
        } else {
          if (definition.effect === 'combo-buff') skillState.comboCount = 0;
          const effects = {};
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
          for (const key of [
            'attackIncrease', 'defenseIncrease', 'magicDefenseIncrease',
            'accuracyIncrease', 'evasionIncrease',
            'attackSpeedStage', 'shieldDefensePercent', 'stanceChance',
            'reflectPercent', 'targetMaxHpCapPercent', 'maxResourcePercent',
            'maxCombo', 'damagePerComboPercent', 'damageIncreasePercent',
            'noAmmoConsumption', 'movementSpeedIncrease', 'criticalChance',
            'criticalDamagePercent', 'damageReductionPercent', 'experienceBonusPercent'
          ]) {
            if (Number.isFinite(Number(values[key]))) effects[key] = Number(values[key]);
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
          skillState.activeBuffs = skillState.activeBuffs.filter((buff) => buff.skillId !== skillId);
          const activeBuff = {
            skillId,
            name: definition.name,
            effects,
            createdAt: new Date(now),
            expiresAt: new Date(now + Number(values.durationSeconds || 1) * 1000)
          };
          skillState.activeBuffs.push(activeBuff);
          if (definition.target === 'party') partyBuffToShare = activeBuff;
        }
        if (Number(values.cooldownSeconds) > 0) {
          skillState.cooldowns[skillId] = now + Number(values.cooldownSeconds) * 1000;
        }
        reconcileMaxResourceBuff(character);
        character.markModified('skills');
        await character.save();
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
          inventory: buildInventoryView(character)
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

  app.post('/api/v2/inventory/quick-slot', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        assignPotionQuickSlot(character, req.body?.slot, req.body?.itemId);
        await character.save();
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
        const used = useQuickSlotPotion(character, req.body?.slot);
        await character.save();
        worldProfileCache.delete(String(auth.id));
        updatePlayerResources(auth.id, character.resources);
        return {
          used,
          character: buildCharacterResponse(character),
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
        const equipment = equipInventoryWeapon(character, req.body?.stackId);
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
        const equipment = unequipInventoryWeapon(character);
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
      return res.status(400).json({ msg: err.message || '무기를 해제하지 못했습니다.' });
    }
  });

  app.get('/api/v2/shop', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const character = await V2Character.findOne({ userId: auth.id });
      if (!character) return res.status(404).json({ msg: 'V2 캐릭터를 찾을 수 없습니다.' });
      const map = getWorldMap(character.worldState?.mapId);
      if (!map?.safeZone) {
        return res.status(403).json({ msg: '상점은 안전지대에서만 이용할 수 있습니다.' });
      }
      return res.json({ shop: buildShopView(character, map.shopId) });
    } catch (err) {
      return res.status(500).json({ msg: '상점 정보를 불러오지 못했습니다.' });
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
        if (!map?.safeZone) {
          throw new Error('상점은 안전지대에서만 이용할 수 있습니다.');
        }
        const purchase = buyShopItem(character, req.body?.itemId, req.body?.quantity, map.shopId);
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

  app.post('/api/v2/inventory/use-item', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        const item = getItemDefinition(req.body?.itemId);
        if (!item || !['return-scroll', 'experience-buff', 'hunting-time'].includes(item.itemType)) {
          throw new Error('사용할 수 없는 아이템입니다.');
        }
        if (
          item.itemType === 'hunting-time'
          && Number(character.huntingTime?.remainingSeconds) >= 24000
        ) {
          throw new Error('자동사냥 시간이 이미 최대 400분입니다.');
        }
        if (!consumeInventoryItem(character, item.id, 1)) {
          throw new Error('해당 아이템이 부족합니다.');
        }

        let map = null;
        let message = '';
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
          skillState.activeBuffs = skillState.activeBuffs.filter(
            (buff) => buff.skillId !== item.id
          );
          skillState.activeBuffs.push({
            skillId: item.id,
            name: item.name,
            effects: { experienceBonusPercent: Number(item.experienceBonusPercent) || 100 },
            createdAt: new Date(now),
            expiresAt: new Date(now + Math.max(1, Number(item.durationSeconds) || 900) * 1000)
          });
          character.markModified('skills');
          message = `${item.name} 효과가 15분간 적용됩니다.`;
        } else {
          const huntingTime = addHuntingMinutes(character, item.huntingMinutes);
          message = huntingTime.addedSeconds > 0
            ? `자동사냥 시간이 ${Math.floor(huntingTime.addedSeconds / 60)}분 충전되었습니다.`
            : '자동사냥 시간이 이미 최대 400분입니다.';
        }
        await character.save();
        worldProfileCache.delete(String(auth.id));
        return {
          message,
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
        purgeExpiredMail(character);
        const claimed = claimMail(character, req.body?.mailId);
        await character.save();
        return {
          claimed,
          inventory: buildInventoryView(character),
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
        purgeExpiredMail(character);
        const claimedCount = claimAllMail(character);
        await character.save();
        return {
          claimedCount,
          inventory: buildInventoryView(character),
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
      const control = claimWorldControl(auth.id, clientId);
      await V2Character.updateOne(
        { userId: auth.id },
        { $set: { 'worldState.controlSessionId': clientId } }
      );
      worldProfileCache.delete(String(auth.id));
      return res.json({ success: true, control });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '월드 조작권을 연결하지 못했습니다.' });
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
        const result = setHuntingEnabled(character, req.body?.enabled === true);
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
        const result = tickHuntingTime(character, req.body?.active === true);
        await character.save();
        worldProfileCache.delete(String(auth.id));
        return result;
      });
      return res.json({ success: true, huntingTime });
    } catch (err) {
      return res.status(400).json({ msg: err.message || '자동사냥 시간을 동기화하지 못했습니다.' });
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
      if (!isDead && mapId !== profile.worldState?.mapId) {
        const x = Math.max(0, Math.min(94, Number(req.body?.x) || 8));
        const floor = Number(req.body?.floor) === 1 ? 1 : 0;
        await V2Character.updateOne(
          { userId: auth.id },
          {
            $set: {
              'worldState.mapId': mapId,
              'worldState.x': x,
              'worldState.floor': floor
            }
          }
        );
        profile.worldState = { ...profile.worldState, mapId, x, floor };
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
        blockChance: profile.skillEffects?.blockChance,
        stanceChance: profile.skillEffects?.stanceChance,
        contactReflectPercent: profile.skillEffects?.contactReflectPercent,
        contactReflectCapPercent: profile.skillEffects?.contactReflectCapPercent,
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
        idleHealIntervalMs: Number(endureSkill?.values?.intervalSeconds || 0) * 1000
      });
      if (state.contactEvents.length) {
        await Promise.all(state.contactEvents.map((event) => (
          withCharacterMutation(event.userId, async () => {
            const character = await V2Character.findOne({ userId: event.userId });
            if (!character) return;
            const currentHp = Math.max(0, Number(character.resources.currentHp) || 0);
            character.resources.currentHp = Math.max(0, currentHp - event.damage);
            event.currentHp = character.resources.currentHp;
            event.expLost = 0;
            if (currentHp > 0 && character.resources.currentHp <= 0) {
              const requiredExp = getRequiredExpV2(character.progression?.level);
              const currentExp = Math.max(0, Number(character.progression?.exp) || 0);
              event.expLost = Math.min(currentExp, Math.floor(requiredExp * 0.1));
              character.progression.exp = currentExp - event.expLost;
              character.worldState.mapId = state.mapId;
              character.worldState.x = Math.max(0, Math.min(94, Number(event.x) || 8));
              character.worldState.floor = Number(req.body?.floor) === 1 ? 1 : 0;
            }
            await character.save();
            updatePlayerResources(event.userId, character.resources);
            worldProfileCache.delete(String(event.userId));
          })
        )));
        for (const event of state.contactEvents) {
          const player = state.players.find((entry) => entry.userId === event.userId);
          if (player) player.currentHp = event.currentHp;
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
      return res.json({
        mapId: state.mapId,
        players: state.players,
        monsters: state.monsters,
        self,
        contactEvents: state.contactEvents,
        recoveryEvents: state.recoveryEvents,
        lootCollections: state.lootCollections,
        partyState: getPartyState(auth.id),
        serverTime: Date.now()
      });
    } catch (err) {
      console.error('V2 world heartbeat error:', err);
      return res.status(400).json({ msg: err.message || '필드 상태를 동기화하지 못했습니다.' });
    }
  });

  app.post('/api/v2/world/attack', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    if (!requireWorldControl(req, res, auth)) return;
    try {
      const profile = await getWorldProfile(auth.id);
      if (!profile) return res.status(404).json({ msg: 'V2 캐릭터를 찾을 수 없습니다.' });
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
      const minimum = Math.max(0, Number(profile.derivedStats.attackMinimum) || 0);
      const maximum = Math.max(minimum, Number(profile.derivedStats.attackMaximum) || 0);
      let rolledDamage = maximum > 0
        ? minimum + Math.random() * (maximum - minimum)
        : 5;
      rolledDamage += Number(ammunition?.attackBonus) || 0;
      const skillEffects = profile.skillEffects || {};
      const critical = Math.random() * 100
        < Number(profile.derivedStats.criticalChance || 0);
      if (critical) {
        rolledDamage *= Number(profile.derivedStats.criticalDamagePercent || 200) / 100;
      }
      const activeElements = getActiveWeaponElements(profile.skillTree);
      rolledDamage *= 1 + Number(skillEffects.damageIncreasePercent || 0) / 100;
      if (activeElements.length) {
        rolledDamage *= 1 + Number(skillEffects.elementDamageIncreasePercent || 0) / 100;
      }
      const comboCount = Math.max(0, Number(profile.skillTree?.comboCount) || 0);
      if (skillEffects.comboEnabled) {
        rolledDamage *= 1 + comboCount * Number(skillEffects.comboDamagePerCount || 0) / 100;
      }
      const hpPercent = Number(profile.resources?.currentHp) / Math.max(1, Number(profile.resources?.maxHp)) * 100;
      if (
        skillEffects.lowHpThresholdPercent
        && hpPercent <= Number(skillEffects.lowHpThresholdPercent)
      ) {
        rolledDamage *= 1 + Number(skillEffects.lowHpDamageIncreasePercent || 0) / 100;
      }
      const archetype = DEPARTMENTS[profile.job?.departmentId]?.archetype;
      const result = attackMonster({
        userId: String(auth.id),
        mapId: String(req.body?.mapId || ''),
        monsterId: String(req.body?.monsterId || ''),
        damage: rolledDamage,
        rangePx: profile.combatPresentation?.rangePx || profile.derivedStats.attackRange,
        damageType: archetype === 'mage' ? 'magic' : 'physical',
        elements: activeElements,
        freezeSeconds: activeElements.includes('ice') ? 4 : 0,
        accuracy: profile.derivedStats.accuracy,
        playerLevel: profile.progression?.level,
        mpAbsorbChance: archetype === 'mage' ? Number(skillEffects.mpAbsorbChance) || 0 : 0,
        mpAbsorbPercent: archetype === 'mage' ? Number(skillEffects.mpAbsorbPercent) || 0 : 0
      });
      if (!result.success) {
        return res.status(['out-of-range', 'dead'].includes(result.reason) ? 409 : 404).json({
          msg: result.reason === 'dead'
            ? '사망 상태에서는 공격할 수 없습니다.'
            : (result.reason === 'out-of-range' ? '몬스터가 공격 사거리 밖에 있습니다.' : '공격 대상을 찾을 수 없습니다.'),
          reason: result.reason
        });
      }
      result.critical = critical;
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
          damage: rolledDamage * Number(skillEffects.doubleStrikeDamagePercent || 0) / 100,
          rangePx: profile.combatPresentation?.rangePx || profile.derivedStats.attackRange,
          damageType: archetype === 'mage' ? 'magic' : 'physical',
          elements: activeElements,
          freezeSeconds: activeElements.includes('ice') ? 4 : 0,
          accuracy: profile.derivedStats.accuracy,
          playerLevel: profile.progression?.level
        });
        if (second.success) {
          result.damage += Number(second.damage) || 0;
          result.doubleStrike = true;
          result.knockedBack = result.knockedBack || second.knockedBack;
          result.defeated = second.defeated;
          result.expReward += Number(second.expReward) || 0;
          result.drops.push(...(second.drops || []));
          result.monster = second.monster;
          result.players = second.players;
          result.monsters = second.monsters;
        }
      }

      let character = null;
      let experience = null;
      let inventory = null;
      if (result.expReward > 0 || result.mpAbsorbed > 0 || skillEffects.comboEnabled) {
        character = await V2Character.findOne({ userId: auth.id });
        if (result.mpAbsorbed > 0) {
          character.resources.currentMp = Math.min(
            Math.max(0, Number(character.resources.maxMp) || 0),
            Math.max(0, Number(character.resources.currentMp) || 0)
              + Number(result.mpAbsorbed)
          );
        }
        if (result.expReward > 0) {
          experience = grantV2Experience(character, result.expReward);
          result.drops = applyCombatDrops(character, result.drops);
        }
        if (skillEffects.comboEnabled && !result.missed && result.damage > 0) {
          const skills = ensureSkillState(character);
          const charge = Math.random() * 100 < Number(skillEffects.comboDoubleChargeChance || 0) ? 2 : 1;
          skills.comboCount = Math.min(
            Number(skillEffects.comboMaximum) || 5,
            Math.max(0, Number(skills.comboCount) || 0) + charge
          );
          character.markModified('skills');
        }
        await character.save();
        worldProfileCache.delete(String(auth.id));
        inventory = buildInventoryView(character);
      }
      return res.json({
        ...result,
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
              'worldState.floor': Number(req.body?.floor) === 1 ? 1 : 0,
              'huntingTime.enabled': false,
              'huntingTime.lastTickAt': null
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
      await ensureV2MigrationForUser(user);
      const mail = await withCharacterMutation(user._id, async () => {
        const character = await V2Character.findOne({ userId: user._id });
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
      console.error('V2 admin mail send error:', err);
      return res.status(500).json({ msg: err.message || '운영자 선물을 보내지 못했습니다.' });
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
      return res.json({
        totalUsers: users.length,
        accountCount: await V2Account.countDocuments({ migrationVersion: MIGRATION_VERSION }),
        snapshotCount: await LegacyUserSnapshot.countDocuments({ migrationVersion: MIGRATION_VERSION }),
        characterCount: await V2Character.countDocuments({}),
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
      for (const user of users) {
        const result = await ensureV2MigrationForUser(user);
        results.push({
          userId: String(user._id),
          name: user.nickname || user.username,
          sourceLevel: result.preview.sourceLevel,
          mappedLevel: result.preview.mappedLevel
        });
      }
      return res.json({
        success: true,
        processed: results.length,
        results,
        nextAfterId: users.length === limit ? String(users[users.length - 1]._id) : '',
        complete: users.length < limit
      });
    } catch (err) {
      console.error('V2 snapshot batch error:', err);
      return res.status(500).json({ msg: 'V2 일괄 스냅샷 생성에 실패했습니다.' });
    }
  });
}

module.exports = {
  registerV2Routes,
  V2_RETAINED_FEATURES,
  V2_REMOVED_FEATURES,
  V2_PLANNED_FEATURES,
  validateSignupPayload
};
