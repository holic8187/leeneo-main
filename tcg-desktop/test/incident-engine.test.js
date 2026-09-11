import test from 'node:test';
import assert from 'node:assert/strict';
import { INCIDENTS, incidentById } from '../src/data/incidentCatalog.js';
import {
  chooseIncident,
  INCIDENT_ACTIVE_DURATION_MS,
  INCIDENT_TIMING,
  INCIDENT_TIER_CHANCES,
  incidentExpiresAt,
  isIncidentExpired,
  nextIncidentDelay,
  resolveIncidentChoice,
} from '../src/core/incidentEngine.js';

function rolls(...values) {
  let index = 0;
  return () => values[index++] ?? 0;
}

test('catalog has sixty distinct events with complete, meaningful choices', () => {
  assert.equal(INCIDENTS.length, 60);
  assert.equal(new Set(INCIDENTS.map((entry) => entry.id)).size, 60);
  assert.equal(new Set(INCIDENTS.map((entry) => entry.title)).size, 60);
  const tierCounts = { ordinary: 0, special: 0, mythic: 0 };
  const results = new Set();
  for (const entry of INCIDENTS) {
    tierCounts[entry.tier] += 1;
    assert.ok(entry.summary.length > 15);
    assert.ok(entry.choices.length >= 2);
    assert.equal(new Set(entry.choices.map((value) => value.id)).size, entry.choices.length);
    assert.equal(new Set(entry.choices.map((value) => JSON.stringify(value.reward))).size, entry.choices.length);
    for (const value of entry.choices) {
      assert.ok(value.label && value.result);
      assert.ok(!results.has(value.result), `duplicated result: ${value.result}`);
      results.add(value.result);
      assert.ok(Object.keys(value.reward).length);
      for (const [key, reward] of Object.entries(value.reward)) {
        assert.ok(['coins', 'linkPoints', 'packs'].includes(key));
        assert.ok(Number.isInteger(reward) && reward > 0);
      }
      if (entry.tier === 'ordinary') assert.equal(value.reward.packs, undefined);
    }
  }
  assert.deepEqual(tierCounts, { ordinary: 44, special: 12, mythic: 4 });
  assert.equal(incidentById('nonexistent'), null);
  assert.ok(Object.isFrozen(INCIDENTS[0].choices[0].reward));
});

test('tier selection honors the published 92%, 7%, 1% boundaries', () => {
  assert.equal(Object.values(INCIDENT_TIER_CHANCES).reduce((sum, value) => sum + value, 0), 1);
  for (const [roll, expected] of [[0, 'ordinary'], [0.919999, 'ordinary'], [0.92, 'special'], [0.989999, 'special'], [0.99, 'mythic'], [1, 'mythic']]) {
    assert.equal(chooseIncident({ random: rolls(roll, 0) }).tier, expected);
  }
  const counts = { ordinary: 0, special: 0, mythic: 0 };
  for (let index = 0; index < 10000; index += 1) counts[chooseIncident({ random: rolls(index / 10000, 0) }).tier] += 1;
  assert.deepEqual(counts, { ordinary: 9200, special: 700, mythic: 100 });
});

test('cooldown cannot fall outside the twelve-to-twenty-four-minute window', () => {
  assert.equal(nextIncidentDelay(() => 0), 12 * 60 * 1000);
  assert.equal(nextIncidentDelay(() => 1), 24 * 60 * 1000);
  assert.equal(nextIncidentDelay(() => -2), INCIDENT_TIMING.minimumMs);
  assert.equal(nextIncidentDelay(() => Infinity), INCIDENT_TIMING.minimumMs);
  assert.equal(nextIncidentDelay(() => NaN), INCIDENT_TIMING.minimumMs);
  assert.equal(nextIncidentDelay(() => 0.5), 18 * 60 * 1000);
});

test('an arrived incident remains actionable for ten minutes', () => {
  const arrivedAt = Date.parse('2026-09-10T08:00:00.000Z');
  const expiresAt = incidentExpiresAt(arrivedAt);
  assert.equal(INCIDENT_ACTIVE_DURATION_MS, 10 * 60 * 1000);
  assert.equal(expiresAt, arrivedAt + INCIDENT_ACTIVE_DURATION_MS);
  assert.equal(isIncidentExpired({ arrivedAt, expiresAt }, expiresAt - 1), false);
  assert.equal(isIncidentExpired({ arrivedAt, expiresAt }, expiresAt), true);
  assert.equal(isIncidentExpired({ arrivedAt }, expiresAt), true, 'legacy incidents use arrivedAt');
});

test('recent five events are excluded without changing tier odds', () => {
  const recentIds = INCIDENTS.filter((entry) => entry.tier === 'ordinary').slice(0, 5).map((entry) => entry.id);
  const next = chooseIncident({ random: rolls(0, 0), recentIds });
  assert.equal(next.tier, 'ordinary');
  assert.ok(!recentIds.includes(next.id));
  const lastAllowed = chooseIncident({ random: rolls(0, 0), recentIds: [...recentIds.slice(1), 'unused', recentIds[0]] });
  assert.equal(lastAllowed.id, recentIds[0]);
  const mythicIds = INCIDENTS.filter((entry) => entry.tier === 'mythic').map((entry) => entry.id);
  assert.equal(chooseIncident({ random: rolls(0.995, 0), recentIds: mythicIds }).id, mythicIds.at(-1));
});

test('choice resolution uses canonical rewards, ignoring popup-provided data', () => {
  const activeIncident = { id: 'mystery-package', instanceId: 'incident-123', reward: { coins: 99999999 }, choices: [{ id: 'open', reward: { packs: 1000 } }] };
  const result = resolveIncidentChoice({ activeIncident, instanceId: 'incident-123', choiceId: 'open', reward: { packs: 1000 } });
  assert.deepEqual(result.reward, { packs: 1 });
  assert.deepEqual(result.completedInstanceIds, ['incident-123']);
  assert.equal(activeIncident.instanceId, 'incident-123');
  result.reward.packs = 1000;
  assert.deepEqual(incidentById('mystery-package').choices[0].reward, { packs: 1 });
});

test('old popup choices, unknown choices and duplicate awards are rejected', () => {
  const activeIncident = { id: 'mystery-package', instanceId: 'current-2' };
  assert.throws(() => resolveIncidentChoice({ activeIncident, instanceId: 'old-1', choiceId: 'open' }), /이전/);
  assert.throws(() => resolveIncidentChoice({ activeIncident, instanceId: 'current-2', choiceId: 'hack' }), /선택지/);
  assert.throws(() => resolveIncidentChoice({ activeIncident: null, instanceId: 'current-2', choiceId: 'open' }), /종료/);
  assert.throws(() => resolveIncidentChoice({ activeIncident, choiceId: 'open' }), /번호/);
  const settled = resolveIncidentChoice({ activeIncident, instanceId: 'current-2', choiceId: 'open' });
  assert.throws(() => resolveIncidentChoice({ activeIncident, instanceId: 'current-2', choiceId: 'return', completedInstanceIds: settled.completedInstanceIds }), /이미 보상/);
  assert.throws(() => resolveIncidentChoice({ activeIncident: { id: 'unknown', instanceId: 'x' }, instanceId: 'x', choiceId: 'open' }), /정보/);
});
