/** Expansion hooks share the deterministic engine on the client and server.
 * Delayed effects hold their own cast snapshot so a copy never steals another
 * caster's charges, and a defeated caster does not erase a placed effect.
 */
export function createFiveCharacterMechanics(api) {
  const { alive, magnitude, log, addStatus, statusIsActive, activeStatuses, heal, shield,
    addCardStatus, addBossStatus, cleanse, reduceCooldown, damageBoss, applyBreak, targetsFor, queueFollowUp } = api;
  const living = state => state.cards.filter(alive);
  const snapshot = actor => ({ id: actor.id, cardId: actor.cardId, name: actor.name, attack: actor.attack,
    enhancement: actor.enhancement, skillScale: actor.skillScale ?? 1, maxHp: actor.maxHp, hp: actor.hp, statuses: [] });
  const team = (state, actor, effect) => {
    const value = { kind: 'buff', sourceId: actor.id, sourceSnapshot: snapshot(actor), ...effect };
    const old = state.teamStatuses.find(status => status.id === value.id && status.sourceId === value.sourceId);
    if (old) Object.assign(old, value); else state.teamStatuses.push(value);
  };
  const sourceOf = (state, effect) => effect.sourceSnapshot || state.cards.find(card => card.id === effect.sourceId);
  const pending = (state, actor, id, name, effect) => team(state, actor, {
    id, name, charges: 1, pending: true, ...effect,
  });
  const statuses = (state, id) => state.teamStatuses.filter(status => status.id === id && statusIsActive(status));
  const removeBuffs = (state, count) => {
    const removed = state.boss.statuses.filter(status => status.kind === 'buff' && statusIsActive(status)).slice(0, count);
    state.boss.statuses = state.boss.statuses.filter(status => !removed.includes(status));
    return removed.length;
  };
  function redistribute(state, source) {
    const cards = living(state);
    const total = cards.reduce((sum, card) => sum + card.hp, 0);
    const maximum = cards.reduce((sum, card) => sum + card.maxHp, 0);
    if (!cards.length || !maximum) return;
    // Keep exact total HP, including half-HP support growth, rather than creating
    // HP through per-card rounding. Living members always retain positive HP.
    cards.forEach(card => { card.hp = total * card.maxHp / maximum; });
    log(state, 'spring-redistribute', '생존 아군의 HP가 같은 비율로 연결되었습니다.', { sourceId: source.id, totalHp: total });
  }

  function cast(state, actor, targetId, scale) {
    const all = living(state), low = targetsFor(state, actor, 'lowest');
    const attack = (power, count = 1, breakDamage = 0) => damageBoss(state, actor, power, count, breakDamage, scale, { skill: true });
    switch (actor.cardId) {
      case 'guma-rr': cleanse(all, 1); attack(180, 1, 20); break;
      case 'guma-sr': {
        const tainted = all.filter(card => card.statuses.some(status => status.kind === 'debuff'));
        heal(state, all, 20, actor, scale); cleanse(all, 1); shield(state, tainted, 12, actor, scale); break;
      }
      case 'guma-ur':
        cleanse(all, 1);
        all.forEach(card => addStatus(card, { id: 'scarlet-exchange', name: '주홍 부적 환전', kind: 'buff', duration: 3, charges: 2,
          value: magnitude(12, actor, scale), break: magnitude(10, actor, scale), sourceId: actor.id, sourceSnapshot: snapshot(actor) })); break;
      case 'guma-ssr':
        shield(state, all, 18, actor, scale);
        team(state, actor, { id: 'karma-ledger', name: '윤회 화인의 장부', charges: 3, storedDamage: 0, ready: false,
          finisher: magnitude(240, actor, scale), perHp: magnitude(2, actor, scale), break: magnitude(30, actor, scale), heal: magnitude(18, actor, scale) }); break;
      case 'kkamdung-rr': heal(state, low, 22, actor, scale); addCardStatus(all, actor, 'evasion', '달꽃 숨바꼭질', 12, 2); break;
      case 'kkamdung-sr': {
        const removed = Math.min(state.boss.shield, Math.round(actor.attack * magnitude(80, actor, scale) / 100));
        state.boss.shield -= removed;
        if (removed) log(state, 'shield-erode', '흑요석 발톱이 보호막을 찢었습니다.', { sourceId: actor.id, amount: removed });
        attack(230); addBossStatus(state, actor, 'accuracy-down', '흑요석 잔상', 16, 2); break;
      }
      case 'kkamdung-hr': shield(state, all, 22, actor, scale); addCardStatus(all, actor, 'debuff-block', '안개 은신처', 0, null, 'buff', 1); addCardStatus(all, actor, 'evasion', '안개 걸음', 15, 2); break;
      case 'kkamdung-ur':
        low.forEach(card => addStatus(card, { id: 'moon-double', name: '달그림자 대역', kind: 'buff', duration: 3, charges: 2,
          value: magnitude(110, actor, scale), break: magnitude(15, actor, scale), sourceId: actor.id, sourceSnapshot: snapshot(actor) })); break;
      case 'kkamdung-ssr':
        attack(280); removeBuffs(state, 2);
        team(state, actor, { id: 'moon-usurp', name: '월식 왕관 약탈', duration: 3, charges: 3,
          value: magnitude(20, actor, scale), break: magnitude(18, actor, scale) }); break;
      case 'somfist-r': attack(170, 1, 20); shield(state, [actor], 12, actor, scale); break;
      case 'somfist-rrr': heal(state, all, 20, actor, scale); cleanse(all, 1); break;
      case 'somfist-sr': attack(260, 1, 35); addCardStatus(all, actor, 'skill-damage-up', '백은 링의 응원', 15, 2); break;
      case 'somfist-hr': shield(state, all, 26, actor, scale); addCardStatus(all, actor, 'counter', '구름 성채의 반격', 50, null, 'buff', 1); addCardStatus([actor], actor, 'taunt', '구름 성채의 문지기', 0, null, 'buff', 2); break;
      case 'somfist-ur':
        shield(state, all, 24, actor, scale);
        team(state, actor, { id: 'cushion-relay', name: '별구름 쿠션 릴레이', duration: 3, value: magnitude(60, actor, scale) }); break;
      case 'somfist-ssr':
        heal(state, all, 18, actor, scale); shield(state, all, 30, actor, scale);
        team(state, actor, { id: 'cushion-vault', name: '모두의 쿠션 금고', duration: 3 }); break;
      case 'easy-r': heal(state, all, 16, actor, scale); reduceCooldown(low); break;
      case 'easy-rr': attack(190, 1, 22); addBossStatus(state, actor, 'attack-down', '네온 역위상', 15, 2); break;
      case 'easy-rrr': shield(state, all, 20, actor, scale); addCardStatus(all, actor, 'damage-reduction', '노이즈 캔슬', 18, 2); break;
      case 'easy-sr': cleanse(all, 2); heal(state, all, 22, actor, scale); break;
      case 'easy-hr': attack(250, 1, 40); addCardStatus(all, actor, 'quick', '오로라 선행 박자', 0, null, 'buff', 1); break;
      case 'easy-ur':
        shield(state, all, 18, actor, scale);
        team(state, actor, { id: 'crossfade-beat', name: '엇박자 크로스페이드', charges: 4, previous: null,
          startsAfterPlayerAction: state.playerActionCount + 1, value: magnitude(90, actor, scale), break: magnitude(12, actor, scale), heal: magnitude(8, actor, scale) }); break;
      case 'easy-ssr':
        heal(state, all, 18, actor, scale);
        all.forEach(card => addStatus(card, { id: 'backbeat-rewind', name: '백비트 역재생', kind: 'buff', duration: 3, charges: 1,
          recordedHp: card.hp, startsAfterPlayerAction: state.playerActionCount + 1, value: magnitude(18, actor, scale), sourceId: actor.id, sourceSnapshot: snapshot(actor) })); break;
      case 'peach-r': shield(state, all, 16, actor, scale); addCardStatus(all, actor, 'dot-reduction', '꽃잎 방풍 울타리', 25, 2); break;
      case 'peach-rr': attack(190, 1, 20); addBossStatus(state, actor, 'damage-taken-up', '향기로운 가시', 15, 2); break;
      case 'peach-rrr': heal(state, all, 20, actor, scale); addCardStatus(all, actor, 'healing-taken-up', '달이슬의 포근함', 20, 2); break;
      case 'peach-sr': attack(230); shield(state, low, 20, actor, scale); break;
      case 'peach-hr': attack(100, 3, 35); addBossStatus(state, actor, 'break-taken-up', '홍도 꽃가시', 20, 2); break;
      case 'peach-ur':
        all.forEach(card => addStatus(card, { id: 'blossom-letter', name: '내일 피는 꽃편지', kind: 'buff', duration: 3, charges: 1,
          value: magnitude(30, actor, scale), growth: magnitude(6, actor, scale), growthCount: 0, shield: magnitude(15, actor, scale),
          sourceId: actor.id, sourceSnapshot: snapshot(actor) })); break;
      case 'peach-ssr':
        redistribute(state, actor); heal(state, all, 20, actor, scale);
        team(state, actor, { id: 'spring-link', name: '연결된 봄의 맥박', charges: 2, value: magnitude(6, actor, scale) }); break;
      default: return false;
    }
    return true;
  }

  function beforePlayer(state, actor) {
    if (!alive(actor)) return;
    for (const letter of activeStatuses(actor, 'blossom-letter')) {
      const source = sourceOf(state, letter);
      if (!source) continue;
      if (actor.hp / actor.maxHp <= .6) {
        heal(state, [actor], letter.value + letter.growth * letter.growthCount, source, 1, { scaleMagnitude: false });
        shield(state, [actor], letter.shield, source, 1, { scaleMagnitude: false });
        letter.charges = 0;
        log(state, 'blossom-open', '미래의 꽃편지가 피어나 회복시켰습니다.', { sourceId: source.id, targetId: actor.id });
      } else {
        letter.growthCount = Math.min(3, letter.growthCount + 1);
        log(state, 'blossom-grow', '아직 필요하지 않은 꽃편지가 자랐습니다.', { sourceId: source.id, targetId: actor.id, growthCount: letter.growthCount });
      }
    }
  }

  function afterPlayer(state, actor, actionType) {
    // Every deferred strike is a real follow-up phase before the boss, not a
    // hidden recursive attack. It does not consume another action or cooldown.
    for (const effect of statuses(state, 'karma-ledger').filter(effect => effect.ready)) {
      queueFollowUp(state, { type: 'expansion-karma', name: effect.name, source: sourceOf(state, effect),
        multiplier: effect.finisher + effect.storedDamage * effect.perHp, breakDamage: effect.break, heal: effect.heal });
      effect.charges = 0;
    }
    for (const effect of statuses(state, 'shadow-retaliation')) {
      for (let index = 0; index < effect.strikes; index += 1) queueFollowUp(state, {
        name: effect.name, source: sourceOf(state, effect), multiplier: effect.value, breakDamage: effect.break,
      });
      effect.charges = 0;
    }
    for (const beat of statuses(state, 'crossfade-beat')) {
      if (state.playerActionCount < beat.startsAfterPlayerAction) continue;
      if (beat.previous && beat.previous !== actionType) queueFollowUp(state, {
        type: 'expansion-crossfade', name: beat.name, source: sourceOf(state, beat), multiplier: beat.value, breakDamage: beat.break, heal: beat.heal,
      });
      beat.previous = actionType; beat.charges -= 1;
      log(state, 'crossfade-record', `${actionType === 'skill' ? '스킬' : '기본 공격'} 박자를 기록했습니다.`, { sourceId: beat.sourceId, actionType, remaining: beat.charges });
    }
    if (actionType === 'skill') for (const rewind of activeStatuses(actor, 'backbeat-rewind')) {
      if (state.playerActionCount < rewind.startsAfterPlayerAction) continue;
      // A successful heal may already have restored the snapshot. Preserve the
      // one-use rewind until a later skill actually needs to restore lost HP.
      if (actor.hp >= Math.min(actor.maxHp, rewind.recordedHp)) continue;
      const before = actor.hp;
      actor.hp = Math.min(actor.maxHp, Math.max(actor.hp, rewind.recordedHp));
      shield(state, [actor], rewind.value, sourceOf(state, rewind), 1, { scaleMagnitude: false });
      rewind.charges = 0;
      log(state, 'backbeat-rewind', '기록된 박자로 HP를 되감았습니다.', { sourceId: rewind.sourceId, targetId: actor.id, amount: actor.hp - before });
    }
    state.teamStatuses = state.teamStatuses.filter(statusIsActive);
  }

  function beforeBossHit(state, target, damage) {
    if (!(damage > 0)) return damage;
    const double = activeStatuses(target, 'moon-double')[0];
    if (!double) return damage;
    double.charges -= 1;
    const source = sourceOf(state, double);
    const existing = statuses(state, 'shadow-retaliation').find(effect => effect.sourceId === double.sourceId);
    if (existing) existing.strikes += 1;
    else pending(state, source, 'shadow-retaliation', '달그림자 추격', { strikes: 1, value: double.value, break: double.break });
    log(state, 'moon-double-block', '달그림자 대역이 피격을 대신했습니다.', { sourceId: double.sourceId, targetId: target.id, remaining: double.charges });
    return 0;
  }

  function beforeShieldAbsorption(state, target, damage) {
    if (!statuses(state, 'cushion-vault').length) return;
    let required = Math.max(0, damage - target.shield);
    let collected = 0;
    for (const donor of living(state).filter(card => card !== target)) {
      const amount = Math.min(donor.shield, required);
      donor.shield -= amount; target.shield += amount; required -= amount; collected += amount;
      if (required <= 0) break;
    }
    if (collected) log(state, 'cushion-vault', '다른 아군의 쿠션을 가져와 피해를 막았습니다.', { targetId: target.id, amount: collected });
  }

  function afterBossHit(state, target, hpDamage, absorbed) {
    for (const ledger of statuses(state, 'karma-ledger').filter(effect => !effect.ready)) ledger.storedDamage += hpDamage;
    if (!absorbed) return;
    const index = state.cards.indexOf(target);
    const next = Array.from({ length: state.cards.length - 1 }, (_, offset) => state.cards[(index + offset + 1) % state.cards.length]).find(alive);
    if (!next) return;
    for (const relay of statuses(state, 'cushion-relay')) {
      const amount = Math.round(absorbed * relay.value / 100);
      next.shield += amount;
      if (amount) log(state, 'cushion-relay', '흡수한 충격이 다음 아군의 쿠션이 되었습니다.', { sourceId: relay.sourceId, targetId: next.id, amount });
    }
  }

  function interceptDebuff(state, target) {
    const talisman = activeStatuses(target, 'scarlet-exchange')[0];
    if (!talisman) return false;
    talisman.charges -= 1;
    const source = sourceOf(state, talisman);
    shield(state, [target], talisman.value, source, 1, { scaleMagnitude: false });
    applyBreak(state, { ...source, enhancement: 0 }, talisman.break, 1);
    log(state, 'scarlet-exchange', '약화가 주홍 부적으로 바뀌었습니다.', { sourceId: source.id, targetId: target.id, remaining: talisman.charges });
    return true;
  }

  function afterBoss(state) {
    if (!state.bossActionEffects?.performed) return;
    for (const usurp of statuses(state, 'moon-usurp')) {
      if (!removeBuffs(state, 1)) continue;
      const source = sourceOf(state, usurp);
      usurp.charges -= 1;
      applyBreak(state, { ...source, enhancement: 0 }, usurp.break, 1);
      for (const card of living(state)) addStatus(card, { id: 'damage-up', name: '훔친 월식 왕관', value: usurp.value,
        kind: 'buff', duration: 1, sourceId: source.id });
      log(state, 'moon-usurp', '보스의 강화를 빼앗아 아군에게 돌려주었습니다.', { sourceId: source.id });
    }
    if (!state.bossActionEffects?.expansionAttacked) return;
    for (const ledger of statuses(state, 'karma-ledger').filter(effect => !effect.ready)) {
      ledger.charges -= 1;
      if (ledger.charges <= 0) { ledger.ready = true; ledger.charges = 1; }
    }
    for (const link of statuses(state, 'spring-link')) {
      const source = sourceOf(state, link);
      redistribute(state, source); heal(state, living(state), link.value, source, 1, { scaleMagnitude: false });
      link.charges -= 1;
    }
  }

  function followUp(state, effect) {
    if (!['expansion-karma', 'expansion-crossfade'].includes(effect.type)) return false;
    damageBoss(state, effect.source, effect.multiplier, 1, effect.breakDamage, 1, { secondary: true, followUp: true, scaleMagnitude: false, skill: true });
    const targets = effect.type === 'expansion-karma' ? living(state) : targetsFor(state, effect.source, 'lowest');
    heal(state, targets, effect.heal, effect.source, 1, { scaleMagnitude: false });
    log(state, effect.type, `${effect.name}의 조건이 완성되었습니다.`, { sourceId: effect.source.id });
    return true;
  }
  return { cast, beforePlayer, afterPlayer, beforeBossHit, beforeShieldAbsorption, afterBossHit, interceptDebuff, afterBoss, followUp };
}
