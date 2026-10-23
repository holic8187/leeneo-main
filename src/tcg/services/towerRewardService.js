'use strict';
const { createHash } = require('node:crypto');
const { deliverMailToAccount, normalizeMailRewards, DEFAULT_MAIL_EXPIRY_HOURS } = require('./mailboxService');
const { loadTowerModules } = require('./towerModules');
const RETRY_MS = 3600000;
const lean = value => typeof value?.lean === 'function' ? value.lean() : value;

function towerRankingMail(record, rank, rewards, now) {
  const id = `tower:monthly:v1:${record.seasonKey}`;
  const normalized = normalizeMailRewards(rewards);
  return {
    id, sender: '무한의 탑 관리인', title: `${record.seasonKey} 무한의 탑 ${rank}위 보상`,
    message: `${record.clearedFloor}층 클리어 · 다음 층 최고 피해 ${(record.bestProgress / 10000).toFixed(2)}%로 월간 ${rank}위를 기록했습니다. 다음 달에도 새로운 증강으로 도전해 주세요.`,
    rewards: normalized,
    requestHash: createHash('sha256').update(JSON.stringify({ id, rank, score: record.rankingScore, rewards: normalized })).digest('hex'),
    createdAt: new Date(now), expiresAt: new Date(now + DEFAULT_MAIL_EXPIRY_HOURS * 3600000), readAt: null, claimedAt: null,
  };
}

async function settleTowerRewards({ TcgTowerSeason, TcgPlayerState, now = Date.now(), accountId, limit = 200, rewardTiers } = {}) {
  const { rules } = await loadTowerModules();
  const timestamp = Number(now), current = rules.towerMonthWindow(timestamp).seasonKey;
  // Every score is frozen before counting ranks. All battle CAS writes include
  // rankingFrozenAt:null; completed month records are never overwritten/reset.
  await TcgTowerSeason.updateMany({ seasonKey: { $lt: current }, rankingFrozenAt: null }, { $set: { rankingFrozenAt: new Date(timestamp) } }, { timestamps: false });
  const records = await lean(TcgTowerSeason.find({ seasonKey: { $lt: current }, rankingScore: { $gt: 0 }, rankingRewardSettledAt: null,
    ...(accountId ? { accountId } : { $or: [{ rankingRewardRetryAt: null }, { rankingRewardRetryAt: { $lte: new Date(timestamp) } }] }),
  }).sort({ seasonKey: 1, _id: 1 }).limit(Math.max(1, Math.min(1000, Number(limit) || 200))));
  const result = { checkedCount: records.length, deliveredCount: 0, recoveredCount: 0, deferredCount: 0, errors: [] };
  for (const record of records) {
    try {
      const rank = 1 + await TcgTowerSeason.countDocuments({ seasonKey: record.seasonKey, rankingScore: { $gt: record.rankingScore } });
      // Persist the exact payout before appending mail. A changed deployment's
      // reward table can never change an already prepared retry.
      let prepared = record.rankingReward;
      if (!prepared) {
        const rewards = rules.towerRewardForRank(rank, rewardTiers);
        const mail = towerRankingMail(record, rank, rewards, timestamp);
        await TcgTowerSeason.updateOne({ _id: record._id, rankingReward: null }, { $set: { rankingReward: { rank, score: record.rankingScore, mail } } }, { timestamps: false });
        prepared = (await lean(TcgTowerSeason.findOne({ _id: record._id }))).rankingReward;
      }
      // A full mailbox may defer this mail for longer than its normal lifetime.
      // Give it a complete claim window from actual delivery, keeping the
      // immutable receipt/reward/hash identical across retries.
      const mail = { ...prepared.mail, createdAt: new Date(timestamp), expiresAt: new Date(timestamp + DEFAULT_MAIL_EXPIRY_HOURS * 3600000) };
      const delivered = await deliverMailToAccount({ TcgPlayerState, accountId: record.accountId, mail, receiptId: mail.id, now: timestamp });
      await TcgTowerSeason.updateOne({ _id: record._id, rankingRewardSettledAt: null }, { $set: { rankingRewardSettledAt: new Date(timestamp), rankingRewardRetryAt: null } }, { timestamps: false });
      result[delivered ? 'deliveredCount' : 'recoveredCount'] += 1;
    } catch (error) {
      result.deferredCount += 1;
      if (error?.code !== 'MAILBOX_FULL') result.errors.push({ recordId: String(record._id), code: String(error?.code || 'TOWER_REWARD_RETRY') });
      await TcgTowerSeason.updateOne({ _id: record._id, rankingRewardSettledAt: null }, { $set: { rankingRewardRetryAt: new Date(timestamp + RETRY_MS) } }, { timestamps: false });
    }
  }
  return result;
}

function startTowerRewardScheduler({ now = Date.now, logger = console, canRun = () => true, ...dependencies } = {}) {
  let busy = false;
  const sweep = async () => {
    if (busy || !canRun()) return;
    busy = true;
    try { const result = await settleTowerRewards({ ...dependencies, now: now() }); if (result.errors.length) logger.error('TCG tower reward retries:', result.errors); }
    catch (error) { logger.error('TCG tower reward settlement failed:', error); }
    finally { busy = false; }
  };
  const timer = setInterval(sweep, 60000); timer.unref?.(); void sweep();
  return { sweep, stop: () => clearInterval(timer) };
}
module.exports = { towerRankingMail, settleTowerRewards, startTowerRewardScheduler };
