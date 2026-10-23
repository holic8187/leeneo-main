'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, required: true },
  seasonKey: { type: String, required: true },
  nickname: { type: String, default: '' },
  revision: { type: Number, default: 0, min: 0 },
  clearedFloor: { type: Number, default: 0, min: 0 },
  bestProgress: { type: Number, default: 0, min: 0, max: 999999 },
  rankingScore: { type: Number, default: 0, min: 0 },
  augments: { type: [String], default: [] },
  offer: { type: mongoose.Schema.Types.Mixed, default: null },
  battle: { type: mongoose.Schema.Types.Mixed, default: null },
  battleId: { type: String, default: '' },
  attempts: { type: Number, default: 0, min: 0 },
  rankingFrozenAt: { type: Date, default: null },
  rankingRewardSettledAt: { type: Date, default: null },
  rankingRewardRetryAt: { type: Date, default: null },
  rankingReward: { type: mongoose.Schema.Types.Mixed, default: null },
}, { collection: 'tcg_tower_seasons', timestamps: true, versionKey: false });
schema.index({ accountId: 1, seasonKey: 1 }, { unique: true, name: 'one_tower_run_per_account_month' });
schema.index({ seasonKey: 1, rankingScore: -1, _id: 1 }, { name: 'tower_monthly_ranking' });
schema.index({ seasonKey: 1, rankingRewardSettledAt: 1, rankingRewardRetryAt: 1 }, { name: 'tower_reward_retry' });
module.exports = mongoose.models.TcgTowerSeason || mongoose.model('TcgTowerSeason', schema);
