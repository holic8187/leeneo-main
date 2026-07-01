'use strict';

const mongoose = require('mongoose');

const v2SettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now }
}, {
  collection: 'v2_settings',
  versionKey: false,
  minimize: false
});

module.exports = mongoose.models.V2Setting
  || mongoose.model('V2Setting', v2SettingSchema);
