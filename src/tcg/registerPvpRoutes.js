'use strict';
const DefaultTcgPvp = require('./models/TcgPvp');
const { PvpError, createPvpService } = require('./services/pvpService');
const { PlayerStateError } = require('./services/playerStateService');

function registerPvpRoutes({ app, authenticate, TcgPlayerState, TcgPvp = DefaultTcgPvp, now = Date.now, random, rewardPolicy }) {
  const service = createPvpService({ TcgPvp, TcgPlayerState, ...(random ? { random } : {}), rewardPolicy });
  for (const operation of ['state', 'queue', 'leave', 'accept', 'action', 'claim', 'rankings']) {
    app[['state', 'rankings'].includes(operation) ? 'get' : 'post'](`/api/tcg/pvp/${operation}`, async (req, res) => {
      try {
        const account = await authenticate(req, res);
        if (!account) return res.headersSent ? undefined : res.status(401).json({ code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' });
        return res.json(await service[operation]({ account, request: req.body || {}, now: now() }));
      } catch (error) {
        if (error instanceof PvpError || error instanceof PlayerStateError) return res.status(error.status || 400).json({ code: error.code, message: error.message, ...(error.details || {}) });
        if (error.status === 401 || error.status === 403) return res.status(error.status).json({ code: error.code || 'AUTH_REQUIRED', message: error.message });
        console.error(`TCG PvP ${operation} error:`, error);
        return res.status(500).json({ code: 'PVP_UNAVAILABLE', message: '대전 요청을 처리하지 못했습니다. 다시 확인해주세요.' });
      }
    });
  }
  return service;
}
module.exports = { registerPvpRoutes };
