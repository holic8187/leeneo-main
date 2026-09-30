import assert from 'node:assert/strict';
import test from 'node:test';
import { characterIdForCard, createCooperativeBoss, getCooperativeDifficulty, rollCooperativeRewards, selectCooperativeParty } from '../src/core/cooperativeRaidRules.js';

const candidate = (id, attack = 100, role = 'attack') => ({ cardId: `${id}-c`, attack, role });
const player = (accountId, ids) => ({ accountId, cards: ids.map((id) => candidate(id)) });
const pools = { sr: ['winter-sr'], hr: ['guma-hr'], ur: ['winter-ur'], ssr: ['hoi-ssr'] };

test('same person at different rarities shares identity; legacy IDs stay whole', () => {
  assert.equal(characterIdForCard('morae-ssr'), 'morae');
  assert.equal(characterIdForCard({ cardId: 'morae-r' }), 'morae');
  assert.equal(characterIdForCard('sales-fox'), 'sales-fox');
});

test('exact search avoids greedy matching trap and does not mutate inputs', () => {
  const players = [player('1', ['a', 'b', 'c']), player('2', ['a', 'b', 'c']), player('3', ['a', 'b', 'c']), player('4', ['a', 'b', 'd'])];
  const before = structuredClone(players);
  const party = selectCooperativeParty(players, () => 0.5);
  assert.equal(new Set(party.map((entry) => characterIdForCard(entry.card))).size, 4);
  assert.equal(party[3].card.cardId, 'd-c');
  assert.deepEqual(players, before);
});

test('impossible parties and duplicate accounts/representative people are rejected', () => {
  const players = ['1', '2', '3', '4'].map((id) => player(id, ['a', 'b', 'c']));
  assert.equal(selectCooperativeParty(players), null);
  players[3] = player('1', ['d', 'e', 'f']);
  assert.equal(selectCooperativeParty(players), null);
  players[3] = player('4', ['d', 'e', 'f']);
  players[0].cards[1] = { cardId: 'a-ssr' };
  assert.equal(selectCooperativeParty(players), null);
});

test('automatic composition values role coverage before raw power', () => {
  const players = ['1', '2', '3', '4'].map((id) => ({ accountId: id, cards: [candidate(`a${id}`, 999), candidate(`d${id}`, 10, 'defense'), candidate(`s${id}`, 10, 'support')] }));
  const party = selectCooperativeParty(players, () => 0.5);
  assert.equal(new Set(party.map(({ card }) => card.role)).size, 3);
  assert.equal(party.filter(({ card }) => card.role === 'attack').length, 2);
});

test('all forty-sum difficulty endpoints and unlocks stay monotonic', () => {
  assert.equal(getCooperativeDifficulty(4).maxHp, 50_000);
  assert.equal(getCooperativeDifficulty(40).maxHp, 500_000);
  assert.equal(getCooperativeDifficulty(4).relicChance, 0.001);
  assert.equal(getCooperativeDifficulty(40).relicChance, 0.01);
  assert.equal(getCooperativeDifficulty(23).guaranteedSrCard, false);
  assert.equal(getCooperativeDifficulty(24).guaranteedSrCard, true);
  for (let sum = 4; sum <= 40; sum += 1) {
    const difficulty = getCooperativeDifficulty(sum);
    const boss = createCooperativeBoss(sum);
    assert.equal(boss.skills.length, difficulty.skillCount);
    assert.ok(boss.skills.every((skill) => skill.cooperativePattern && skill.description));
    assert.ok(difficulty.relicChance >= 0.001 && difficulty.relicChance <= 0.01);
    if (sum > 4) assert.ok(difficulty.maxHp > getCooperativeDifficulty(sum - 1).maxHp);
  }
  assert.equal(createCooperativeBoss(40).skills.length, 6);
});

test('victory loot threshold, guaranteed SR+, and defeat consolation are exact', () => {
  assert.equal(rollCooperativeRewards(23, { random: () => 0.99, cardPools: pools }).cards.length, 0);
  const result = rollCooperativeRewards(24, { random: () => 0.99, cardPools: pools });
  assert.deepEqual(result.cards, [{ cardId: 'hoi-ssr', quantity: 1 }]);
  assert.equal(result.standardPacks, 6);
  assert.deepEqual(rollCooperativeRewards(40, { victory: false }), { coins: 2000, standardPacks: 0, cards: [], relics: [], equipment: [] });
});

test('rare drops are independent and equipment keeps authoritative variance data', () => {
  const result = rollCooperativeRewards(40, { cardPools: pools, random: () => 0, equipmentFactory: (options) => ({ id: 'equipment-test', ...options, random: undefined, bonusPercent: 2.7 }) });
  assert.deepEqual(result.relics, [{ relicId: 'luxury-bag', quantity: 1 }]);
  assert.equal(result.equipment[0].rarity, 'c');
  assert.equal(result.equipment[0].source.type, 'cooperative-raid');
  assert.equal(result.equipment[0].bonusPercent, 2.7);
  assert.throws(() => rollCooperativeRewards(24, { random: () => 0, cardPools: {} }), /보상 풀이/);
});
