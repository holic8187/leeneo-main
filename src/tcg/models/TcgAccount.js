'use strict';

const mongoose = require('mongoose');

const tcgAccountSchema = new mongoose.Schema({
  username: { type: String, required: true },
  usernameCanonical: {
    type: String,
    required: true,
    unique: true,
    index: true,
    select: false
  },
  nickname: { type: String, required: true },
  nicknameCanonical: {
    type: String,
    required: true,
    unique: true,
    index: true,
    select: false
  },
  passwordHash: { type: String, required: true, select: false },
  status: {
    type: String,
    enum: ['active', 'disabled'],
    default: 'active',
    index: true
  },
  tokenVersion: { type: Number, default: 0, min: 0 },
  lastLoginAt: { type: Date, default: null }
}, {
  collection: 'tcg_accounts',
  timestamps: true,
  versionKey: false
});

module.exports = mongoose.models.TcgAccount
  || mongoose.model('TcgAccount', tcgAccountSchema);
