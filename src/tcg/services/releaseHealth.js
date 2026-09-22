'use strict';

const { version: tcgVersion } = require('../../../tcg-desktop/package.json');

function releaseHealth(appMode) {
  return { ok: true, message: 'server is running', appMode, tcgVersion };
}

module.exports = { releaseHealth };
