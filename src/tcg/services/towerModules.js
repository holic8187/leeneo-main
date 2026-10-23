'use strict';
const path = require('node:path');
const { pathToFileURL } = require('node:url');
let pending;
function loadTowerModules() {
  pending ||= Promise.all(['core/towerRules.js', 'data/towerAugments.js', 'core/towerBattle.js', 'data/cardCatalog.js', 'core/cardProgression.js']
    .map(file => import(pathToFileURL(path.resolve(__dirname, '../../..', 'tcg-desktop/src', file)).href)))
    .then(([rules, augments, battle, catalog, progression]) => ({ rules, augments, battle, catalog, progression }))
    .catch(error => { pending = null; throw error; });
  return pending;
}
module.exports = { loadTowerModules };
