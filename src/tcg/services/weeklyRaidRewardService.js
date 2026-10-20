'use strict';

const { createHash } = require('node:crypto');
const { RAID_SCHEMA_VERSION, getKstRaidWeekWindow } = require('./personalRaidService');
const { DEFAULT_MAIL_EXPIRY_HOURS, deliverMailToAccount, normalizeMailRewards } = require('./mailboxService');
const { WEEKLY_RAID_REWARD_START_WEEK, WEEKLY_RAID_REWARD_POLICY_VERSION, weeklyRaidRewardsForRank } = require('./weeklyRaidRewardPolicy');

const WEEKLY_REWARD_SWEEP_INTERVAL_MS = 60_000;
const WEEKLY_REWARD_RETRY_MS = 60 * 60_000;
const WEEKLY_REWARD_BATCH_SIZE = 200;

async function lean(value) { return typeof value?.lean === 'function' ? value.lean() : value; }

function weeklyRankingMail(record, rank, now) {
  const id = `ranking:v${WEEKLY_RAID_REWARD_POLICY_VERSION}:${record.weekKey}:${record.bossId}`;
  const rewards = normalizeMailRewards(weeklyRaidRewardsForRank(rank));
  const title = `주간 개인 레이드 ${rank}위 보상`;
  const message = `${record.weekKey} 시작 주간 개인 레이드에서 ${Number(record.contribution).toLocaleString('ko-KR')}점을 기록했습니다. 최종 ${rank}위 보상을 보내드립니다. 동일 점수는 공동 순위로 같은 보상을 받습니다.`;
  return {
    id, sender: '레이드 협회', title, message, rewards,
    requestHash: createHash('sha256').update(JSON.stringify({ id, rank, score: record.contribution, rewards })).digest('hex'),
    createdAt: new Date(now), expiresAt: new Date(now + DEFAULT_MAIL_EXPIRY_HOURS * 60 * 60_000),
    readAt: null, claimedAt: null
  };
}

async function settleWeeklyRaidRewards({ TcgPersonalRaidDaily, TcgPlayerState, accountId, now = Date.now(), limit = WEEKLY_REWARD_BATCH_SIZE } = {}) {
  const timestamp = Number(now instanceof Date ? now.getTime() : now);
  const currentWeek = getKstRaidWeekWindow(timestamp).weekKey;
  // Close every record in the finished week before counting anyone's rank.
  // Raid writes include rankingFrozenAt:null in their CAS, so an old request
  // cannot add score between one recipient's payout and the next recipient.
  await TcgPersonalRaidDaily.updateMany({
    schemaVersion: RAID_SCHEMA_VERSION,
    weekKey: { $gte: WEEKLY_RAID_REWARD_START_WEEK, $lt: currentWeek }, rankingFrozenAt: null
  }, { $set: { rankingFrozenAt: new Date(timestamp) } }, { timestamps: false });
  const query = {
    schemaVersion: RAID_SCHEMA_VERSION,
    weekKey: { $gte: WEEKLY_RAID_REWARD_START_WEEK, $lt: currentWeek },
    contribution: { $gt: 0 }, rankingRewardSettledAt: null,
    ...(accountId ? { accountId } : { $or: [{ rankingRewardRetryAt: null }, { rankingRewardRetryAt: { $lte: new Date(timestamp) } }] })
  };
  const records = await lean(TcgPersonalRaidDaily.find(query).sort({ weekKey: 1, _id: 1 }).limit(Math.max(1, Math.min(1000, Number(limit) || WEEKLY_REWARD_BATCH_SIZE))));
  const result = { checkedCount: records?.length || 0, deliveredCount: 0, recoveredCount: 0, deferredCount: 0, errors: [] };
  for (const record of records || []) {
    try {
      // Finished-week records remain immutable: raid start/finish always use
      // the current week. Count strictly higher scores to preserve shared ranks.
      const rank = 1 + await TcgPersonalRaidDaily.countDocuments({
        weekKey: record.weekKey, bossId: record.bossId, schemaVersion: RAID_SCHEMA_VERSION,
        contribution: { $gt: Number(record.contribution) }
      });
      const mail = weeklyRankingMail(record, rank, timestamp);
      const delivered = await deliverMailToAccount({ TcgPlayerState, accountId: record.accountId, mail, receiptId: mail.id, now: timestamp });
      // Receipt + mailbox append are atomic in the player document. A crash
      // between that write and this marker is safely retried, even after the
      // mail has been claimed/pruned. Avoid mutating ranking tie timestamps.
      await TcgPersonalRaidDaily.updateOne({ _id: record._id, rankingRewardSettledAt: null }, { $set: {
        rankingRewardSettledAt: new Date(timestamp), rankingRewardRetryAt: null,
        rankingReward: { rank, score: record.contribution, mailId: mail.id, rewards: mail.rewards, policyVersion: WEEKLY_RAID_REWARD_POLICY_VERSION }
      } }, { runValidators: true, timestamps: false });
      if (delivered) result.deliveredCount += 1;
      else result.recoveredCount += 1;
    } catch (error) {
      result.deferredCount += 1;
      if (error?.code !== 'MAILBOX_FULL') result.errors.push({ recordId: String(record._id), code: String(error?.code || 'WEEKLY_REWARD_FAILED') });
      // A full inbox must not block other players, and never consumes a receipt.
      await TcgPersonalRaidDaily.updateOne({ _id: record._id, rankingRewardSettledAt: null }, {
        $set: { rankingRewardRetryAt: new Date(timestamp + WEEKLY_REWARD_RETRY_MS) }
      }, { timestamps: false });
    }
  }
  return result;
}

function startWeeklyRaidRewardScheduler({ TcgPersonalRaidDaily, TcgPlayerState, now = Date.now, logger = console, canRun = () => true } = {}) {
  let inFlight = false;
  const sweep = async () => {
    if (inFlight || !canRun()) return;
    inFlight = true;
    try {
      const result = await settleWeeklyRaidRewards({ TcgPersonalRaidDaily, TcgPlayerState, now: now() });
      if (result.errors.length) logger.error('TCG weekly ranking reward retries:', result.errors);
    } catch (error) {
      logger.error('TCG weekly ranking reward sweep failed:', error);
    } finally { inFlight = false; }
  };
  const timer = setInterval(sweep, WEEKLY_REWARD_SWEEP_INTERVAL_MS);
  timer.unref?.();
  void sweep();
  return { sweep, stop: () => clearInterval(timer) };
}

module.exports = { WEEKLY_REWARD_SWEEP_INTERVAL_MS, WEEKLY_REWARD_RETRY_MS, weeklyRankingMail, settleWeeklyRaidRewards, startWeeklyRaidRewardScheduler };
