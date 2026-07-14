'use strict';

const V2Account = require('../models/V2Account');
const V2Character = require('../models/V2Character');
const LegacyUserSnapshot = require('../models/LegacyUserSnapshot');
const V2DeletedAccount = require('../models/V2DeletedAccount');
const { markV2AccountsDeleted } = require('./accountDeletionService');
const {
  MIGRATION_VERSION,
  LEGACY_EXCHANGE_FORMULA_VERSION,
  ensureV2MigrationForUser
} = require('./migrationService');

let activeRun = null;

function getIncompleteMigrationIds(userIds, accountIds, snapshotIds, characterIds, deletedIds = []) {
  const accountSet = new Set(accountIds.map(String));
  const snapshotSet = new Set(snapshotIds.map(String));
  const characterSet = new Set(characterIds.map(String));
  const deletedSet = new Set(deletedIds.map(String));
  return userIds
    .map(String)
    .filter((id) => !deletedSet.has(id))
    .filter((id) => !accountSet.has(id) || !snapshotSet.has(id) || !characterSet.has(id));
}

function getOrphanedDeletedIds(userIds, accountIds, snapshotIds, characterIds, deletedIds = []) {
  const accountSet = new Set(accountIds.map(String));
  const snapshotSet = new Set(snapshotIds.map(String));
  const characterSet = new Set(characterIds.map(String));
  const deletedSet = new Set(deletedIds.map(String));
  return userIds
    .map(String)
    .filter((id) => !deletedSet.has(id))
    .filter((id) => snapshotSet.has(id) && !accountSet.has(id) && !characterSet.has(id));
}

async function findIncompleteUsers(users) {
  const userIds = users.map((user) => user._id);
  const [accounts, snapshots, characters, deletedAccounts] = await Promise.all([
    V2Account.find({
      sourceUserId: { $in: userIds }
    }).select('sourceUserId migrationVersion').lean(),
    LegacyUserSnapshot.find({
      sourceUserId: { $in: userIds }
    }).select('sourceUserId migrationVersion').lean(),
    V2Character.find({
      userId: { $in: userIds }
    }).select(
      'userId migration.migrationVersion migration.legacyExchangeFormulaVersion progression.skillPointGrantVersion'
    ).lean(),
    V2DeletedAccount.find({ sourceUserId: { $in: userIds } }).select('sourceUserId').lean()
  ]);

  const allAccountIds = accounts.map((entry) => entry.sourceUserId);
  const allSnapshotIds = snapshots.map((entry) => entry.sourceUserId);
  const allCharacterIds = characters.map((entry) => entry.userId);
  const deletedIds = deletedAccounts.map((entry) => entry.sourceUserId);
  const orphanedIds = getOrphanedDeletedIds(
    userIds,
    allAccountIds,
    allSnapshotIds,
    allCharacterIds,
    deletedIds
  );
  if (orphanedIds.length) {
    const orphanedSet = new Set(orphanedIds);
    await markV2AccountsDeleted(
      users
        .filter((user) => orphanedSet.has(String(user._id)))
        .map((user) => ({
          sourceUserId: user._id,
          username: user.username,
          nickname: user.nickname
        })),
      { reason: 'legacy-admin-delete-backfill', deletedBy: 'system' }
    );
    deletedIds.push(...orphanedIds);
  }

  const completeAccountIds = accounts
    .filter((entry) => Number(entry.migrationVersion) === MIGRATION_VERSION)
    .map((entry) => entry.sourceUserId);
  const completeSnapshotIds = snapshots
    .filter((entry) => Number(entry.migrationVersion) === MIGRATION_VERSION)
    .map((entry) => entry.sourceUserId);
  const completeCharacterIds = characters
    .filter((entry) => (
      Number(entry.migration?.migrationVersion) === MIGRATION_VERSION
      && Number(entry.migration?.legacyExchangeFormulaVersion) === LEGACY_EXCHANGE_FORMULA_VERSION
      && Number(entry.progression?.skillPointGrantVersion) === 2
    ))
    .map((entry) => entry.userId);
  const incompleteIds = new Set(getIncompleteMigrationIds(
    userIds,
    completeAccountIds,
    completeSnapshotIds,
    completeCharacterIds,
    deletedIds
  ));
  const deletedSet = new Set(deletedIds.map(String));
  return {
    users: users.filter((user) => incompleteIds.has(String(user._id))),
    deletedExcluded: users.filter((user) => deletedSet.has(String(user._id))).length
  };
}

async function executeAutomaticMigration({
  User,
  batchSize,
  concurrency,
  onProgress
}) {
  // Repair every early V2 document before Mongoose attempts any validated save.
  // This also directly recovers accounts created while the four base stats
  // could be persisted as zero.
  await V2Character.updateMany(
    {},
    {
      $max: {
        'stats.grit': 4,
        'stats.processingSpeed': 4,
        'stats.workKnowledge': 4,
        'stats.awareness': 4
      }
    },
    { runValidators: false }
  );
  let afterId = null;
  const summary = {
    scanned: 0,
    alreadyPrepared: 0,
    deletedExcluded: 0,
    migrated: 0,
    failed: 0,
    errors: []
  };

  while (true) {
    const query = afterId ? { _id: { $gt: afterId } } : {};
    const users = await User.find(query).sort({ _id: 1 }).limit(batchSize);
    if (!users.length) break;

    summary.scanned += users.length;
    const selection = await findIncompleteUsers(users);
    const incompleteUsers = selection.users;
    summary.deletedExcluded += selection.deletedExcluded;
    summary.alreadyPrepared += users.length - incompleteUsers.length - selection.deletedExcluded;

    for (let index = 0; index < incompleteUsers.length; index += concurrency) {
      const slice = incompleteUsers.slice(index, index + concurrency);
      const results = await Promise.allSettled(
        slice.map((user) => ensureV2MigrationForUser(user))
      );
      results.forEach((result, resultIndex) => {
        if (result.status === 'fulfilled') {
          summary.migrated += 1;
          return;
        }
        summary.failed += 1;
        if (summary.errors.length < 20) {
          summary.errors.push({
            userId: String(slice[resultIndex]._id),
            message: result.reason?.message || String(result.reason)
          });
        }
      });
    }

    afterId = users[users.length - 1]._id;
    if (typeof onProgress === 'function') onProgress({ ...summary });
    if (users.length < batchSize) break;
  }

  return summary;
}

function runAutomaticV2Migration({
  User,
  batchSize = 50,
  concurrency = 5,
  onProgress
}) {
  if (activeRun) return activeRun;
  const safeBatchSize = Math.max(1, Math.min(200, Math.floor(batchSize)));
  const safeConcurrency = Math.max(1, Math.min(10, Math.floor(concurrency)));

  activeRun = executeAutomaticMigration({
    User,
    batchSize: safeBatchSize,
    concurrency: safeConcurrency,
    onProgress
  }).finally(() => {
    activeRun = null;
  });

  return activeRun;
}

module.exports = {
  getIncompleteMigrationIds,
  getOrphanedDeletedIds,
  runAutomaticV2Migration
};
