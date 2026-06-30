'use strict';

const mongoose = require('mongoose');

const legacyUserSnapshotSchema = new mongoose.Schema({
  sourceUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  migrationVersion: { type: Number, required: true, default: 1 },
  username: { type: String, required: true },
  nickname: { type: String, default: '' },
  sourceLevel: { type: Number, required: true },
  mappedV2Level: { type: Number, required: true },
  checksum: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  capturedAt: { type: Date, default: Date.now }
}, {
  collection: 'v2_legacy_user_snapshots',
  minimize: false,
  versionKey: false
});

legacyUserSnapshotSchema.index(
  { sourceUserId: 1, migrationVersion: 1 },
  { unique: true }
);

module.exports = mongoose.models.LegacyUserSnapshot
  || mongoose.model('LegacyUserSnapshot', legacyUserSnapshotSchema);
