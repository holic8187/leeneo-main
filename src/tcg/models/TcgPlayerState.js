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

const tcgPlayerStateSchema = new mongoose.Schema({
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  state: { type: mongoose.Schema.Types.Mixed, default: null },
  revision: { type: Number, default: 0, min: 0 },
  initialized: { type: Boolean, default: false },
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
