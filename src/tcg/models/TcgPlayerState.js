'use strict';

const mongoose = require('mongoose');

const activeLeaseSchema = new mongoose.Schema({
  leaseId: { type: String, default: '' },
  deviceId: { type: String, default: '' },
  platform: {
    type: String,
    enum: ['pc', 'android', 'ios', 'web', null],
    default: null
  },
  generation: { type: Number, default: 0, min: 0 },
  heartbeatAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
  appVersion: { type: String, default: '' }
}, {
  _id: false,
  id: false
});

const mailboxRewardSchema = new mongoose.Schema({
  coins: { type: Number, default: 0, min: 0 },
  standardPacks: { type: Number, default: 0, min: 0 }
}, {
  _id: false,
  id: false
});

const mailboxEntrySchema = new mongoose.Schema({
  id: { type: String, required: true },
  requestHash: { type: String, default: '' },
  sender: { type: String, default: '운영자' },
  title: { type: String, required: true },
  message: { type: String, default: '' },
  rewards: { type: mailboxRewardSchema, default: () => ({}) },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  readAt: { type: Date, default: null },
  claimedAt: { type: Date, default: null }
}, {
  _id: false,
  id: false
});

const tcgPlayerStateSchema = new mongoose.Schema({
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  state: { type: mongoose.Schema.Types.Mixed, default: null },
  revision: { type: Number, default: 0, min: 0 },
  initialized: { type: Boolean, default: false },
  mailbox: { type: [mailboxEntrySchema], default: [] },
  activeLease: {
    type: activeLeaseSchema,
    default: () => ({
      leaseId: '',
      deviceId: '',
      platform: null,
      generation: 0,
      heartbeatAt: null,
      expiresAt: null,
      appVersion: ''
    })
  }
}, {
  collection: 'tcg_player_states',
  timestamps: true,
  versionKey: false
});

tcgPlayerStateSchema.index(
  { accountId: 1 },
  { unique: true, name: 'one_tcg_player_state_per_account' }
);

module.exports = mongoose.models.TcgPlayerState
  || mongoose.model('TcgPlayerState', tcgPlayerStateSchema);
