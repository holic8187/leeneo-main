'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  revision: { type: Number, default: 0, min: 0 },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
}, { collection: 'tcg_pvp', timestamps: true, versionKey: false });
schema.index({ 'data.kind': 1, 'data.seasonKey': 1, 'data.rating': -1 }, { name: 'pvp_season_ranking' });
schema.index({ 'data.kind': 1, 'data.participants.accountId': 1 }, { name: 'pvp_finished_participants' });
module.exports = mongoose.models.TcgPvp || mongoose.model('TcgPvp', schema);
