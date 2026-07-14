'use strict';

const mongoose = require('mongoose');

const v2DeletedAccountSchema = new mongoose.Schema({
  sourceUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  username: { type: String, default: '', index: true },
  nickname: { type: String, default: '', index: true },
  reason: { type: String, default: 'admin-delete' },
  deletedBy: { type: String, default: 'admin' },
  deletedAt: { type: Date, default: Date.now }
}, {
  collection: 'v2_deleted_accounts',
  versionKey: false
});

module.exports = mongoose.models.V2DeletedAccount
  || mongoose.model('V2DeletedAccount', v2DeletedAccountSchema);
