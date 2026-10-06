'use strict';

const { version: tcgVersion } = require('../../../tcg-desktop/package.json');

function releaseHealth(appMode, databaseReady = false) {
  const ok = databaseReady === true;
  return {
    ok,
    message: ok ? 'server is running' : 'database is unavailable',
    appMode,
    tcgVersion,
    database: ok ? 'ready' : 'unavailable'
  };
}

module.exports = { releaseHealth };
