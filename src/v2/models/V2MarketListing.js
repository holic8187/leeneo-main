'use strict';

const mongoose = require('mongoose');

const v2MarketListingSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sellerName: { type: String, required: true },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  itemId: { type: String, required: true, index: true },
  itemName: { type: String, required: true },
  itemIcon: { type: String, default: '📦' },
  itemCategory: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  instanceData: { type: mongoose.Schema.Types.Mixed, default: null },
  pricePerItem: { type: Number, required: true, min: 1 },
  totalPrice: { type: Number, required: true, min: 1 },
  registrationFee: { type: Number, required: true, min: 0 },
  sellerProceeds: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: ['pending', 'active', 'processing', 'sold', 'settled', 'expired', 'returned', 'cancelled'],
    default: 'pending',
    index: true
  },
  expiresAt: { type: Date, required: true, index: true },
  soldAt: { type: Date, default: null },
  settledAt: { type: Date, default: null },
  returnedAt: { type: Date, default: null }
}, {
  collection: 'v2_market_listings',
  timestamps: true,
  minimize: false
});

v2MarketListingSchema.index({ status: 1, createdAt: -1 });
v2MarketListingSchema.index({ sellerId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.V2MarketListing
  || mongoose.model('V2MarketListing', v2MarketListingSchema);
