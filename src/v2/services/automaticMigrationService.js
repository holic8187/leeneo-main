'use strict';

const V2Account = require('../models/V2Account');
const V2Character = require('../models/V2Character');
const LegacyUserSnapshot = require('../models/LegacyUserSnapshot');
const { MIGRATION_VERSION, ensureV2MigrationForUser } = require('./migrationService');

let activeRun = null;

function getIncompleteMigrationIds(userIds, accountIds, snapshotIds, characterIds) {
  const accountSet = new Set(accountIds.map(String));
  const snapshotSet = new Set(snapshotIds.map(String));
  const characterSet = new Set(characterIds.map(String));
  return userIds
    .map(String)
    .filter((id) => !accountSet.has(id) || !snapshotSet.has(id) || !characterSet.has(id));
}

async function findIncompleteUsers(users) {
  const userIds = users.map((user) => user._id);
  const [accounts, snapshots, characters] = await Promise.all([
    V2Account.find({
      sourceUserId: { $in: userIds },
      migrationVersion: MIGRATION_VERSION
    }).select('sourceUserId').lean(),
    LegacyUserSnapshot.find({
      sourceUserId: { $in: userIds },
      migrationVersion: MIGRATION_VERSION
    }).select('sourceUserId').lean(),
    V2Character.find({
      userId: { $in: userIds },
      'migration.migrationVersion': MIGRATION_VERSION,
      'progression.skillPointGrantVersion': 2
    }).select('userId').lean()
  ]);
  const incompleteIds = new Set(getIncompleteMigrationIds(
    userIds,
    accounts.map((entry) => entry.sourceUserId),
    snapshots.map((entry) => entry.sourceUserId),
    characters.map((entry) => entry.userId)
  ));
  return users.filter((user) => incompleteIds.has(String(user._id)));
}

async function executeAutomaticMigration({
  User,
  batchSize,
  concurrency,
  onProgress
}) {
  let afterId = null;
  const summary = {
    scanned: 0,
    alreadyPrepared: 0,
    migrated: 0,
    failed: 0,
    errors: []
  };

  while (true) {
    const query = afterId ? { _id: { $gt: afterId } } : {};
    const users = await User.find(query).sort({ _id: 1 }).limit(batchSize);
    if (!users.length) break;

    summary.scanned += users.length;
    const incompleteUsers = await findIncompleteUsers(users);
    summary.alreadyPrepared += users.length - incompleteUsers.length;

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
  runAutomaticV2Migration
};
