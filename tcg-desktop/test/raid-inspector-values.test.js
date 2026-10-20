import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRaidBattle } from '../src/core/raidBattleView.js';
import { updateRaidInspectorValues } from '../src/ui/raidInspectorValues.js';

function fixture() {
  const state = { cards: [{ cardId: 'winter-ur', attack: 1200, hp: 100, maxHp: 100, cooldown: 0 }], boss: { hp: 100000, maxHp: 100000 } };
  const nodes = Object.fromEntries(['attack', 'hp', 'maxHp', 'status'].map((key) => [key, { dataset: { raidInspectorValue: key }, textContent: '' }]));
  const root = {
    scrollTop: 184,
    querySelectorAll(selector) { assert.equal(selector, '[data-raid-inspector-value]'); return Object.values(nodes); },
    set innerHTML(_value) { throw new Error('Updating current stats must not replace the explanation or its scroll container'); },
  };
  return { state, root, nodes };
}

test('open personal/coop information updates current HP, attack and cooldown without replacing its popup', () => {
  const { state, root, nodes } = fixture();
  updateRaidInspectorValues(root, normalizeRaidBattle(state), { type: 'skill', cardIndex: 0 });
  assert.equal(nodes.attack.textContent, '1,200');
  assert.equal(nodes.hp.textContent, '100');
  assert.equal(nodes.status.textContent, '행동 가능');
  const originalHpNode = nodes.hp;
  Object.assign(state.cards[0], { attack: 1500, hp: 64, cooldown: 3 });
  updateRaidInspectorValues(root, normalizeRaidBattle(state), { type: 'card', cardIndex: 0 });
  assert.equal(nodes.attack.textContent, '1,500');
  assert.equal(nodes.hp.textContent, '64');
  assert.equal(nodes.status.textContent, '스킬 3턴 남음');
  assert.equal(root.scrollTop, 184);
  assert.equal(nodes.hp, originalHpNode);
  state.cards[0].hp = 0;
  updateRaidInspectorValues(root, normalizeRaidBattle(state), { type: 'card', cardIndex: 0 });
  assert.equal(nodes.status.textContent, '행동 불능');
});

test('unchanged stats are not rewritten by polling and effect explanations are left intact', () => {
  const { state, root, nodes } = fixture();
  const battle = normalizeRaidBattle(state);
  updateRaidInspectorValues(root, battle, { type: 'skill', cardIndex: 0 });
  for (const node of Object.values(nodes)) {
    const value = node.textContent;
    Object.defineProperty(node, 'textContent', { get: () => value, set: () => { throw new Error('Unchanged text should retain browser selection'); } });
  }
  for (let tick = 0; tick < 30; tick++) updateRaidInspectorValues(root, battle, { type: 'skill', cardIndex: 0 });
  state.cards[0].attack = 3000;
  updateRaidInspectorValues(root, normalizeRaidBattle(state), { type: 'effect', cardIndex: 0 });
  assert.equal(nodes.attack.textContent, '1,200');
});
