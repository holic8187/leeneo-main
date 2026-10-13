import test from 'node:test';
import assert from 'node:assert/strict';
import { createRaidBattle, startRaidBattle, performPlayerAction, performFollowUpAction, performBossAction } from '../src/core/turnRaidEngine.js';
import { normalizeRaidBattle, activeRaidCardIndex, getRaidActionFeedback, raidIceSpires } from '../src/core/raidBattleView.js';
import { renderRaidArena, renderRaidBossHud, renderCooperativeInspector, renderIceSpires } from '../src/ui/raidArena.js';

function fixture(first = 'winter-ur') {
  const cards = [first,'nanche-c','coca-c','hoi-ssr'].map(cardId => ({ cardId, name: cardId, attack: 1000, image: `./assets/cards/${cardId}.png` }));
  return startRaidBattle(createRaidBattle({ cards, boss: { id: 'test-boss', name: '검증 <드래곤>', hp: 100000, maxHp: 100000, baseDamage: 10, image: './assets/bosses/test.png' } }),1000);
}

test('personal and cooperative arenas share the same four-card battlefield and own action namespace', () => {
  const battle = normalizeRaidBattle(fixture());
  const options = { battle, activeIndex: activeRaidCardIndex(battle), canAct: true, countdown: battle.turnDeadlineAt, now: 1000 };
  const personal = renderRaidArena(options);
  const cooperative = renderRaidArena({ ...options, cooperative: true, owners: ['<script>A</script>','B','C','D'] });
  for (const html of [personal,cooperative]) {
    assert.equal((html.match(/class="raid-unit-slot /g) || []).length,4);
    assert.equal((html.match(/class="raid-card-actions"/g) || []).length,1);
    assert.match(html,/class="raid-boss-card /);
    assert.match(html,/class="raid-unit-hp-track"/);
    assert.match(html,/aria-label="행동 제한 시간">20/);
  }
  assert.match(personal,/data-action="raid-basic-attack"/);
  assert.match(cooperative,/data-action="coop-basic"/);
  assert.doesNotMatch(cooperative,/data-action="raid-basic-attack"/);
  assert.match(cooperative,/&lt;script&gt;A&lt;\/script&gt;/);
  assert.doesNotMatch(cooperative,/<script>/);
});

test('only an actionable owner gets controls and unusable skills stay disabled with an explanation', () => {
  const state = fixture(); state.cards[0].cooldown = 2;
  const battle = normalizeRaidBattle(state);
  const other = renderRaidArena({ battle, activeIndex: 0, canAct: false, cooperative: true });
  const mine = renderRaidArena({ battle, activeIndex: 0, canAct: true, cooperative: true });
  assert.doesNotMatch(other,/data-action="coop-basic"/);
  assert.match(mine,/data-action="coop-skill" disabled>스킬<small>2턴 남음/);
  state.cards[0].cooldown = 0; state.cards[0].statuses.push({ id:'seal',kind:'debuff',charges:1 });
  const sealed = renderRaidArena({ battle: normalizeRaidBattle(state), activeIndex: 0, canAct: true });
  assert.match(sealed,/data-action="raid-skill-attack" disabled>스킬<small>봉인됨/);
});

test('shared feedback renders ally charge, boss hit, damage, cut-in and ice pillar creation', () => {
  const before = fixture();
  const cast = performPlayerAction(before,{type:'skill'},1001);
  const castHtml = renderRaidArena({ battle:normalizeRaidBattle(cast), animation:getRaidActionFeedback(before,cast), cooperative:true });
  assert.match(castHtml,/raid-skill-cut-in/);
  assert.equal((castHtml.match(/class="raid-ice-spire is-summoning"/g)||[]).length,3);
  const beforeAttack = fixture('coca-ssr');
  const attack = performPlayerAction(beforeAttack,{type:'skill'},1001);
  const html = renderRaidArena({ battle:normalizeRaidBattle(attack),animation:getRaidActionFeedback(beforeAttack,attack) });
  assert.match(html,/raid-unit-slot [^"]*is-attacking/);
  assert.match(html,/raid-boss-card [^"]*is-raid-hit/);
  assert.match(html,/raid-floating-number is-damage">2,100/);
  assert.match(html,/raid-floating-number is-break">BREAK 20/);
});

test('boss feedback shakes affected cards including shield-only hits and animates the broken pillar', () => {
  let before = performPlayerAction(fixture(),{type:'skill'},1001);
  before.cards.forEach(card => { card.shield=100; });
  const after = performBossAction(before,2001);
  const animation = getRaidActionFeedback(before,after);
  assert.equal(animation.attacker,'boss');
  assert.equal(animation.targets.filter(Number.isInteger).length,1);
  assert.ok(animation.targets.includes('boss'));
  assert.deepEqual(after.cards.map(card=>card.hp),before.cards.map(card=>card.hp));
  const html = renderRaidArena({ battle:normalizeRaidBattle(after),animation,cooperative:true });
  assert.match(html,/raid-boss-card [^"]*is-attacking/);
  assert.match(html,/raid-boss-card [^"]*is-raid-hit/);
  assert.match(html,/raid-unit-card [^"]*is-raid-hit/);
  assert.equal((html.match(/class="raid-ice-spire is-breaking"/g)||[]).length,1);
  assert.equal((html.match(/class="raid-ice-spire is-standing"/g)||[]).length,2);
});

test('a restored follow-up has no input countdown or ordinary action and renders its own damage animation', () => {
  let state = fixture('coca-ssr');
  state.teamStatuses.push({id:'star-follow-up',kind:'buff',name:'별빛 추격',value:50,charges:1});
  state = performPlayerAction(state,{type:'basic'},1001);
  const restored = JSON.parse(JSON.stringify(state));
  const waiting = normalizeRaidBattle(restored);
  assert.equal(waiting.activeActor.type,'follow-up');
  assert.equal(activeRaidCardIndex(waiting),-1);
  const html = renderRaidArena({battle:waiting,activeIndex:activeRaidCardIndex(waiting)});
  assert.doesNotMatch(html,/raid-card-actions|raid-battle-countdown/);
  const after = performFollowUpAction(restored,2001);
  const resolved = renderRaidArena({battle:normalizeRaidBattle(after),animation:getRaidActionFeedback(restored,after)});
  assert.match(resolved,/raid-floating-number is-damage">500/);
  assert.match(resolved,/별빛 추격/);
  assert.match(resolved,/raid-skill-cut-in/);
});

test('boss and party statuses retain named icons, counts and inspectable explanations', () => {
  const state = fixture();
  state.teamStatuses.push({id:'ice-spire',name:'얼음 첨탑',kind:'buff',charges:3,sourceId:state.cards[0].id});
  state.boss.statuses.push({id:'attack-down',name:'적 공격 약화',kind:'debuff',value:25,duration:2});
  const battle = normalizeRaidBattle(state);
  const arena = renderRaidArena({battle,cooperative:true});
  assert.equal((arena.match(/title="얼음 첨탑"/g)||[]).length,4);
  assert.match(arena,/raid-effect-icon is-buff is-shared/);
  assert.match(arena,/data-action="coop-inspect-effect"/);
  const hud = renderRaidBossHud(battle,{cooperative:true,effectAction:'coop-inspect-effect'});
  assert.match(hud,/aria-valuenow="100000"/);
  assert.match(hud,/raid-effect-icon is-debuff/);
  const tooltip = renderCooperativeInspector(battle,{type:'effect',owner:'0',index:0});
  assert.match(tooltip,/얼음 첨탑/); assert.match(tooltip,/보스 행동당 첨탑 1개/);
  const cardInfo = renderCooperativeInspector(battle,{type:'card',cardIndex:0});
  assert.match(cardInfo,/공격력 1,000/); assert.match(cardInfo,/HP 100 \/ 100/);
});

test('privacy mode hides card and boss illustrations while retaining readable names and skill information', () => {
  const battle = normalizeRaidBattle(fixture());
  const html = renderRaidArena({battle,secret:true,animation:{skillCutIn:{image:'./assets/cards/winter-ur.png',name:'얼음 첨탑',cardId:'winter-ur'}}});
  assert.doesNotMatch(html,/src="\.\/assets\/(?:cards|bosses)\//);
  assert.match(html,/겨울/); assert.match(html,/얼음 첨탑/);
});

test('copied ice spires and legacy states keep every tower identity without relying on a new save field', () => {
  const legacy = fixture(); delete legacy.pendingFollowUps;
  legacy.teamStatuses = [{id:'ice-spire',charges:3,sourceId:'old-caster'}];
  const html = renderIceSpires(raidIceSpires(legacy));
  assert.equal((html.match(/data-spire-id=/g)||[]).length,3);
  const active = performPlayerAction(legacy,{type:'basic'},1001);
  assert.equal(active.currentActor,'boss');
  const cast = performPlayerAction(fixture(),{type:'skill'},1001);
  cast.currentActor='card';cast.currentActorIndex=3;
  const copied = performPlayerAction(cast,{type:'skill'},1002);
  const towers = raidIceSpires(copied);
  assert.equal(towers.length,6); assert.equal(new Set(towers.map(t=>t.id)).size,6);
});
