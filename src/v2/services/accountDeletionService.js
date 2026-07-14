'use strict';

const V2Account = require('../models/V2Account');
const V2Character = require('../models/V2Character');
const LegacyUserSnapshot = require('../models/LegacyUserSnapshot');
const V2DeletedAccount = require('../models/V2DeletedAccount');

const V2_ACCOUNT_DELETED_CODE = 'V2_ACCOUNT_PERMANENTLY_DELETED';

function createDeletedAccountError(marker = null) {
  const error = new Error('운영자에 의해 영구 삭제된 계정입니다.');
  error.code = V2_ACCOUNT_DELETED_CODE;
  error.statusCode = 410;
  error.marker = marker;
  return error;
}

function isV2AccountDeletedError(error) {
  return error?.code === V2_ACCOUNT_DELETED_CODE;
}

async function markV2AccountDeleted({
  sourceUserId,
  username = '',
  nickname = '',
  reason = 'admin-delete',
  deletedBy = 'admin'
}) {
  if (!sourceUserId) throw new Error('영구 삭제할 원본 계정 ID가 필요합니다.');
  return V2DeletedAccount.findOneAndUpdate(
    { sourceUserId },
    {
      $set: {
        username: String(username || ''),
        nickname: String(nickname || ''),
        reason: String(reason || 'admin-delete'),
        deletedBy: String(deletedBy || 'admin')
      },
      $setOnInsert: { deletedAt: new Date() }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function markV2AccountsDeleted(entries, options = {}) {
  const normalized = (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry?.sourceUserId);
  if (!normalized.length) return 0;
  const now = new Date();
  await V2DeletedAccount.bulkWrite(normalized.map((entry) => ({
    updateOne: {
      filter: { sourceUserId: entry.sourceUserId },
      update: {
        $set: {
          username: String(entry.username || ''),
          nickname: String(entry.nickname || ''),
          reason: String(options.reason || entry.reason || 'legacy-admin-delete-backfill'),
          deletedBy: String(options.deletedBy || entry.deletedBy || 'system')
        },
        $setOnInsert: { deletedAt: now }
      },
      upsert: true
    }
  })), { ordered: false });
  return normalized.length;
}

async function assertV2MigrationAllowed(user) {
  const sourceUserId = user?._id;
  if (!sourceUserId) throw new Error('V2 이관에 필요한 원본 계정 ID가 없습니다.');

  const [marker, accountExists] = await Promise.all([
    V2DeletedAccount.findOne({ sourceUserId }).lean(),
    V2Account.exists({ sourceUserId })
  ]);
  if (marker) throw createDeletedAccountError(marker);
  if (accountExists) return;

  // The old admin-delete flow removed the account and character but left this
  // snapshot behind. Treat that exact shape as a deletion, not as an
  // incomplete migration, so pre-patch deletions are not resurrected.
  const [snapshotExists, characterExists] = await Promise.all([
    LegacyUserSnapshot.exists({ sourceUserId }),
    V2Character.exists({ userId: sourceUserId })
  ]);
  if (!snapshotExists || characterExists) return;

  const createdMarker = await markV2AccountDeleted({
    sourceUserId,
    username: user.username,
    nickname: user.nickname,
    reason: 'legacy-admin-delete-backfill',
    deletedBy: 'system'
  });
  throw createDeletedAccountError(createdMarker?.toObject?.() || createdMarker);
}

module.exports = {
  V2_ACCOUNT_DELETED_CODE,
  createDeletedAccountError,
  isV2AccountDeletedError,
  markV2AccountDeleted,
  markV2AccountsDeleted,
  assertV2MigrationAllowed
};
