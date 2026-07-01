'use strict';

const mongoose = require('mongoose');

const inventoryStackSchema = new mongoose.Schema({
  stackId: { type: String, default: '' },
  itemId: { type: String, required: true },
  quantity: { type: Number, default: 0, min: 0 }
}, { _id: false });

const mailAttachmentSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  quantity: { type: Number, default: 1, min: 1 }
}, { _id: false });

const mailboxEntrySchema = new mongoose.Schema({
  id: { type: String, required: true },
  sender: { type: String, default: '운영자' },
  title: { type: String, default: '운영자 선물' },
  message: { type: String, default: '' },
  attachments: { type: [mailAttachmentSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
  claimedAt: { type: Date, default: null }
}, { _id: false });

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
  loadout: {
    weapon: { type: mongoose.Schema.Types.Mixed, default: null },
    helmet: { type: mongoose.Schema.Types.Mixed, default: null },
    gloves: { type: mongoose.Schema.Types.Mixed, default: null },
    shoes: { type: mongoose.Schema.Types.Mixed, default: null },
    cape: { type: mongoose.Schema.Types.Mixed, default: null },
    top: { type: mongoose.Schema.Types.Mixed, default: null },
    bottom: { type: mongoose.Schema.Types.Mixed, default: null },
    necklace: { type: mongoose.Schema.Types.Mixed, default: null },
    earrings: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  inventory: {
    items: { type: [inventoryStackSchema], default: [] },
    potions: { type: [inventoryStackSchema], default: [] },
    slotCapacities: {
      equipment: { type: Number, default: 20, min: 20, max: 64 },
      consumable: { type: Number, default: 20, min: 20, max: 64 },
      misc: { type: Number, default: 20, min: 20, max: 64 },
      cash: { type: Number, default: 20, min: 20, max: 64 }
    },
    quickSlots: {
      hp: { type: String, default: '' },
      mp: { type: String, default: '' }
    }
  },
  mailbox: { type: [mailboxEntrySchema], default: [] },
  resources: {
    currentHp: { type: Number, default: 120 },
    maxHp: { type: Number, default: 120 },
    currentMp: { type: Number, default: 80 },
    maxMp: { type: Number, default: 80 }
  },
  actionPoints: {
    current: { type: Number, default: 10 },
    max: { type: Number, default: 10 }
  },
  worldState: {
    mapId: { type: String, default: 'main_lobby' },
    x: { type: Number, default: 8, min: 0, max: 94 },
    floor: { type: Number, default: 0, min: 0, max: 1 }
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
