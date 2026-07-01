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
const { DEPARTMENTS } = require('./jobs/advancementRules');
const {
  updatePresence,
  attackMonster,
  updatePlayerResources,
  leaveWorld
} = require('./world/worldRuntime');
const { LEGACY_CURVE, mapLegacyLevelToV2 } = require('./progression/levelMigration');
const {
  MIGRATION_VERSION,
  buildMigrationPreview,
  ensureV2MigrationForUser,
  ensureV2SkillPointGrant,
  buildCharacterResponse
} = require('./services/migrationService');
const { getItemDefinition, listAdminGrantItems } = require('./items/itemCatalog');
const {
  assignPotionQuickSlot,
  useQuickSlotPotion,
  useInventoryExpansionTicket,
  buildInventoryView,
  createAdminMail,
  serializeMail,
  purgeExpiredMail,
  getPendingMail,
  claimMail,
  claimAllMail
} = require('./services/inventoryService');

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
  const gained = Math.max(0, Math.floor(Number(amount) || 0));
  let levels = 0;
  character.progression.exp = Math.max(0, Number(character.progression.exp) || 0) + gained;
  while (character.progression.level < MAX_LEVEL) {
    const required = getRequiredExpV2(character.progression.level);
    if (!required || character.progression.exp < required) break;
    character.progression.exp -= required;
    character.progression.level += 1;
    character.progression.unspentStatPoints += 5;
    character.progression.unspentSkillPoints += 3;
    character.progression.totalSkillPointsEarned += 3;
    levels += 1;
  }
  if (character.progression.level >= MAX_LEVEL) character.progression.exp = 0;
  return { gained, levels };
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

  function buildMailResponse(character) {
    const mails = getPendingMail(character)
      .map(serializeMail)
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
    return { mails, pendingCount: mails.length };
  }

  async function getWorldProfile(userId, force = false) {
    const key = String(userId);
    const cached = worldProfileCache.get(key);
    if (!force && cached && Date.now() - cached.loadedAt < 30_000) return cached;
    const character = await V2Character.findOne({ userId }).lean();
    if (!character) return null;
    const response = buildCharacterResponse(character);
    const profile = {
      loadedAt: Date.now(),
      displayName: response.displayName,
      resources: response.resources,
      derivedStats: response.derivedStats,
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
      return res.json({ character: buildCharacterResponse(character) });
    } catch (err) {
      console.error('V2 character load error:', err);
      return res.status(500).json({ msg: 'V2 캐릭터를 불러오지 못했습니다.' });
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

  app.post('/api/v2/world/heartbeat', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const profile = await getWorldProfile(auth.id);
      if (!profile) return res.status(404).json({ msg: 'V2 캐릭터를 찾을 수 없습니다.' });
      const requestedMapId = String(req.body?.mapId || '');
      const requestedMap = getWorldMap(requestedMapId);
      if (!requestedMap) return res.status(400).json({ msg: '존재하지 않는 맵입니다.' });
      const isDead = Number(profile.resources.currentHp) <= 0;
      const mapId = isDead
        ? String(profile.worldState?.mapId || START_MAP_ID)
        : requestedMapId;
      if (!isDead && mapId !== profile.worldState?.mapId) {
        const x = Math.max(0, Math.min(94, Number(req.body?.x) || 8));
        const floor = Number(req.body?.floor) === 1 ? 1 : 0;
        await V2Character.updateOne(
          { userId: auth.id },
          { $set: { worldState: { mapId, x, floor } } }
        );
        profile.worldState = { mapId, x, floor };
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
        maxHp: profile.resources.maxHp
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
              character.worldState = {
                mapId: state.mapId,
                x: Math.max(0, Math.min(94, Number(event.x) || 8)),
                floor: Number(req.body?.floor) === 1 ? 1 : 0
              };
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
      const self = state.players.find((player) => player.userId === String(auth.id));
      if (self) {
        profile.resources.currentHp = self.currentHp;
        profile.resources.maxHp = self.maxHp;
      }
      return res.json({
        mapId: state.mapId,
        players: state.players,
        monsters: state.monsters,
        self,
        contactEvents: state.contactEvents,
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
    try {
      const profile = await getWorldProfile(auth.id);
      if (!profile) return res.status(404).json({ msg: 'V2 캐릭터를 찾을 수 없습니다.' });
      const minimum = Math.max(0, Number(profile.derivedStats.attackMinimum) || 0);
      const maximum = Math.max(minimum, Number(profile.derivedStats.attackMaximum) || 0);
      const rolledDamage = maximum > 0
        ? minimum + Math.random() * (maximum - minimum)
        : 5;
      const archetype = DEPARTMENTS[profile.job?.departmentId]?.archetype;
      const result = attackMonster({
        userId: String(auth.id),
        mapId: String(req.body?.mapId || ''),
        monsterId: String(req.body?.monsterId || ''),
        damage: rolledDamage,
        rangePx: profile.combatPresentation?.rangePx || profile.derivedStats.attackRange,
        damageType: archetype === 'mage' ? 'magic' : 'physical'
      });
      if (!result.success) {
        return res.status(['out-of-range', 'dead'].includes(result.reason) ? 409 : 404).json({
          msg: result.reason === 'dead'
            ? '사망 상태에서는 공격할 수 없습니다.'
            : (result.reason === 'out-of-range' ? '몬스터가 공격 사거리 밖에 있습니다.' : '공격 대상을 찾을 수 없습니다.'),
          reason: result.reason
        });
      }

      let character = null;
      let experience = null;
      if (result.expReward > 0) {
        character = await V2Character.findOne({ userId: auth.id });
        experience = grantV2Experience(character, result.expReward);
        await character.save();
        worldProfileCache.delete(String(auth.id));
      }
      return res.json({
        ...result,
        experience,
        character: character ? buildCharacterResponse(character) : null
      });
    } catch (err) {
      console.error('V2 world attack error:', err);
      return res.status(500).json({ msg: '필드 공격을 처리하지 못했습니다.' });
    }
  });

  app.post('/api/v2/world/revive', async (req, res) => {
    const auth = requireV2User(req, res);
    if (!auth) return;
    try {
      const result = await withCharacterMutation(auth.id, async () => {
        const character = await V2Character.findOne({ userId: auth.id });
        if (!character) throw new Error('V2 캐릭터를 찾을 수 없습니다.');
        if (Number(character.resources?.currentHp) > 0) {
          throw new Error('현재 사망 상태가 아닙니다.');
        }
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
        character.resources.currentHp = 1;
        character.worldState = { mapId: safeMap.id, x: 8, floor: 0 };
        await character.save();
        worldProfileCache.delete(String(auth.id));
        updatePlayerResources(auth.id, character.resources);
        leaveWorld(String(auth.id));
        return {
          map: safeMap,
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
      const mapId = String(req.body?.mapId || '');
      if (getWorldMap(mapId)) {
        await V2Character.updateOne(
          { userId: auth.id },
          {
            $set: {
              worldState: {
                mapId,
                x: Math.max(0, Math.min(94, Number(req.body?.x) || 8)),
                floor: Number(req.body?.floor) === 1 ? 1 : 0
              }
            }
          }
        );
      }
      leaveWorld(String(auth.id));
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
