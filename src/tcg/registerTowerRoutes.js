'use strict';
const DefaultTcgTowerSeason = require('./models/TcgTowerSeason');
const { TowerError, createTowerService } = require('./services/towerService');
const { startTowerRewardScheduler } = require('./services/towerRewardService');

function registerTowerRoutes({ app, requireTcgAccount, sendPlayerStateError = () => false, TcgPlayerState, TcgTowerSeason = DefaultTcgTowerSeason, now = Date.now, random, rewardTiers, startScheduler = true, logger = console }) {
  const tower = createTowerService({ TcgTowerSeason, TcgPlayerState, now, random, rewardTiers });
  const scheduler = startScheduler && TcgTowerSeason === DefaultTcgTowerSeason ? startTowerRewardScheduler({ TcgTowerSeason, TcgPlayerState, now, rewardTiers, logger, canRun: () => TcgTowerSeason.db.readyState === 1 }) : null;
  for (const operation of ['state', 'ranking', 'choose', 'reroll', 'enter', 'action', 'abandon']) {
    const read = ['state', 'ranking'].includes(operation);
    app[read ? 'get' : 'post'](`/api/tcg/tower/${operation}`, async (req, res) => {
      const account = await requireTcgAccount(req, res);
      if (!account) return;
      res.set?.('Cache-Control', 'no-store');
      try { return res.json(await tower[operation]({ account, request: (read ? req.query : req.body) || {} })); }
      catch (error) {
        if (sendPlayerStateError(error, res)) return;
        if (error instanceof TowerError || (error?.name === 'PersonalRaidError')) return res.status(error.status || 400).json({ code: error.code, msg: error.message });
        logger.error(`TCG tower ${operation} error:`, error);
        return res.status(500).json({ code: 'TOWER_REQUEST_FAILED', msg: '무한의 탑 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
      }
    });
  }
  return { tower, scheduler };
}
module.exports = { registerTowerRoutes };
