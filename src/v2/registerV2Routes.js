'use strict';

const V2Account = require('./models/V2Account');
const V2Character = require('./models/V2Character');
const LegacyUserSnapshot = require('./models/LegacyUserSnapshot');
const { MAX_LEVEL } = require('./constants/experienceTable');
const { START_MAP_ID, WORLD_MAPS } = require('./world/mapDefinitions');
const { LEGACY_CURVE, mapLegacyLevelToV2 } = require('./progression/levelMigration');
const {
  MIGRATION_VERSION,
  buildMigrationPreview,
  ensureV2MigrationForUser,
  ensureV2SkillPointGrant,
  buildCharacterResponse
} = require('./services/migrationService');

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
  V2_PLANNED_FEATURES
};
