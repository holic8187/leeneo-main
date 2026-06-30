'use strict';

const mongoose = require('mongoose');

const v2CharacterSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  schemaVersion: { type: Number, default: 1 },
  displayName: { type: String, required: true },
  progression: {
    level: { type: Number, default: 1, min: 1, max: 200 },
    exp: { type: Number, default: 0 },
    unspentStatPoints: { type: Number, default: 0 },
    unspentSkillPoints: { type: Number, default: 0 },
    totalSkillPointsEarned: { type: Number, default: 0 },
    skillPointGrantVersion: { type: Number, default: 0 }
  },
  stats: {
    grit: { type: Number, default: 0 },
    processingSpeed: { type: Number, default: 0 },
    workKnowledge: { type: Number, default: 0 },
    awareness: { type: Number, default: 0 }
  },
  job: {
    departmentId: { type: String, default: 'unassigned' },
    advancementTier: { type: Number, default: 0 }
  },
  resources: {
    currentHp: { type: Number, default: 0 },
    maxHp: { type: Number, default: 0 },
    currentMp: { type: Number, default: 0 },
    maxMp: { type: Number, default: 0 }
  },
  actionPoints: {
    current: { type: Number, default: 10 },
    max: { type: Number, default: 10 }
  },
  economy: {
    money: { type: Number, default: 0 },
    stockPortfolio: { type: [mongoose.Schema.Types.Mixed], default: [] }
  },
  migration: {
    status: { type: String, enum: ['prepared', 'converted', 'failed'], default: 'prepared' },
    migrationVersion: { type: Number, default: 1 },
    sourceSnapshotId: { type: mongoose.Schema.Types.ObjectId, ref: 'LegacyUserSnapshot', required: true },
    sourceLevel: { type: Number, required: true },
    legacyCardCount: { type: Number, default: 0 },
    legacyEnhancedCardCount: { type: Number, default: 0 },
    legacyEquipmentCount: { type: Number, default: 0 },
    legacyInventoryQuantity: { type: Number, default: 0 },
    legacyCompanyPreserved: { type: Boolean, default: false },
    cardsConversionStatus: { type: String, default: 'pending' },
    equipmentConversionStatus: { type: String, default: 'pending' },
    companyConversionStatus: { type: String, default: 'pending' },
    preparedAt: { type: Date, default: Date.now }
  }
}, {
  collection: 'v2_characters',
  timestamps: true,
  minimize: false
});

module.exports = mongoose.models.V2Character
  || mongoose.model('V2Character', v2CharacterSchema);
