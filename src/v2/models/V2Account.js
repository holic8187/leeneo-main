'use strict';

const mongoose = require('mongoose');

const v2AccountSchema = new mongoose.Schema({
  sourceUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  migrationVersion: { type: Number, required: true, default: 1 },
  username: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  nickname: { type: String, default: '' },
  migratedAt: { type: Date, default: Date.now }
}, {
  collection: 'v2_accounts',
  timestamps: true,
  versionKey: false
});

module.exports = mongoose.models.V2Account
  || mongoose.model('V2Account', v2AccountSchema);
