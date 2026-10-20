'use strict';

const mongoose = require('mongoose');

const tcgPersonalRaidDailySchema = new mongoose.Schema({
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  dayKey: { type: String, required: true, index: true },
  // v3 stores the Monday 00:00 KST week key in dayKey as well. Keeping dayKey
  // lets the production unique index migrate without a destructive drop.
  weekKey: { type: String, default: '', index: true },
  schemaVersion: { type: Number, default: 1, min: 1 },
  bossId: { type: String, required: true, index: true },
  nickname: { type: String, required: true },
  currentStage: { type: Number, default: 1, min: 1, max: 10 },
  currentHp: { type: Number, required: true, min: 0 },
  contribution: { type: Number, default: 0, min: 0 },
  dispatchCount: { type: Number, default: 0, min: 0 },
  clearCount: { type: Number, default: 0, min: 0 },
  dailyEntryDayKey: { type: String, default: '' },
  dailyEntryCount: { type: Number, default: 0, min: 0 },
  // Earned only by a newly committed clear, never inferred from old clearCount.
  dailyBonusEntryCount: { type: Number, default: 0, min: 0, max: 10 },
  activeSession: { type: mongoose.Schema.Types.Mixed, default: null },
  lastFinishedSessionId: { type: String, default: '' },
  lastFinishedResult: { type: mongoose.Schema.Types.Mixed, default: null },
  bonusRewards: { type: [mongoose.Schema.Types.Mixed], default: [] },
  weeklyCompleted: { type: Boolean, default: false },
  lastDispatchAt: { type: Date, default: null },
  lastDamage: { type: Number, default: 0, min: 0 },
  lastSquadScore: { type: Number, default: 0, min: 0 },
  revision: { type: Number, default: 0, min: 0 },
  rankingRewardSettledAt: { type: Date, default: null },
  rankingFrozenAt: { type: Date, default: null },
  rankingRewardRetryAt: { type: Date, default: null },
  rankingReward: { type: mongoose.Schema.Types.Mixed, default: null }
}, {
  collection: 'tcg_personal_raid_daily',
  timestamps: true,
  versionKey: false
});

tcgPersonalRaidDailySchema.index(
  { accountId: 1, dayKey: 1, bossId: 1 },
  { unique: true, name: 'one_personal_raid_state_per_account_day' }
);
tcgPersonalRaidDailySchema.index(
  { weekKey: 1, bossId: 1, schemaVersion: 1, contribution: -1, updatedAt: 1 },
  { name: 'personal_raid_weekly_ranking' }
);
tcgPersonalRaidDailySchema.index(
  { rankingRewardSettledAt: 1, rankingRewardRetryAt: 1, weekKey: 1 },
  { name: 'pending_personal_raid_weekly_rewards' }
);
tcgPersonalRaidDailySchema.index({ rankingFrozenAt: 1, weekKey: 1 }, { name: 'unfrozen_personal_raid_weeks' });

module.exports = mongoose.models.TcgPersonalRaidDaily
  || mongoose.model('TcgPersonalRaidDaily', tcgPersonalRaidDailySchema);
