'use strict';

const mongoose = require('mongoose');

// One bounded coordinator document is the atomic boundary for matchmaking,
// admission and daily entries. This works on standalone MongoDB as well as a
// replica set, and cannot admit the same account twice across server workers.
const schema = new mongoose.Schema({
  _id: { type: String, default: 'cooperative-v1' },
  revision: { type: Number, default: 0 },
  data: { type: mongoose.Schema.Types.Mixed, required: true }
}, { collection: 'tcg_cooperative_raids', timestamps: true, versionKey: false });

// Finished rooms are immutable archive:<room-id> documents in this collection.
// They retain unclaimed outcomes without filling the active coordinator.
schema.index({ 'data.participants.accountId': 1 }, { name: 'cooperative_room_participants' });

module.exports = mongoose.models.TcgCooperativeRaid || mongoose.model('TcgCooperativeRaid', schema);
