'use strict';

const mongoose = require('mongoose');

const tcgPersonalRaidDailySchema = new mongoose.Schema({
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  dayKey: { type: String, required: true, index: true },
  bossId: { type: String, required: true, index: true },
  nickname: { type: String, required: true },
  currentHp: { type: Number, required: true, min: 0 },
  contribution: { type: Number, default: 0, min: 0 },
  dispatchCount: { type: Number, default: 0, min: 0 },
  clearCount: { type: Number, default: 0, min: 0 },
  lastDispatchAt: { type: Date, default: null },
  lastDamage: { type: Number, default: 0, min: 0 },
  lastSquadScore: { type: Number, default: 0, min: 0 },
  revision: { type: Number, default: 0, min: 0 }
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
  { dayKey: 1, bossId: 1, contribution: -1, updatedAt: 1 },
  { name: 'personal_raid_daily_ranking' }
);

module.exports = mongoose.models.TcgPersonalRaidDaily
  || mongoose.model('TcgPersonalRaidDaily', tcgPersonalRaidDailySchema);
