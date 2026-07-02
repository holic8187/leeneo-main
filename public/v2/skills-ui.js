'use strict';

function buildSkillBody() {
  const tree = state.character?.skillTree;
  if (!tree?.skills?.length) {
    return '<div class="empty-ledger"><b>현재 부서에서 배울 수 있는 스킬이 없습니다.</b><p>전직 후 다시 확인해 주세요.</p></div>';
  }
  const preset = new Set(tree.activePreset || []);
  const tiers = [1, 2, 3, 4].map((tier) => {
    const skills = tree.skills.filter((skill) => skill.tier === tier);
    if (!skills.length) return '';
    const requirement = tree.tierRequirements?.[tier];
    const cards = skills.map((skill) => {
      const registered = preset.has(skill.id);
      return `<article class="skill-card ${skill.passive ? 'is-passive' : ''} ${skill.quest ? 'is-quest' : ''}">
        <div class="skill-card-heading">
          <span>${skill.passive ? 'P' : (skill.quest ? 'Q' : 'A')}</span>
          <div><strong>${escapeHtml(skill.name)}</strong><small>Lv.${formatNumber(skill.level)} / ${formatNumber(skill.maxLevel)}</small></div>
        </div>
        <p>${escapeHtml(skill.description || '고정 효과')}</p>
        ${skill.range ? `<small>사거리 ${formatNumber(skill.range)}</small>` : ''}
        ${skill.blockReason && skill.level < skill.maxLevel ? `<em>${escapeHtml(skill.blockReason)}</em>` : ''}
        <div class="skill-card-actions">
          <input data-skill-amount="${escapeHtml(skill.id)}" type="number" min="1" max="${Math.max(1, skill.maxLevel - skill.level)}" value="1" ${skill.canInvest ? '' : 'disabled'}>
          <button data-skill-invest="${escapeHtml(skill.id)}" type="button" ${skill.canInvest ? '' : 'disabled'}>SP 투자</button>
          ${skill.passive || skill.level <= 0 ? '' : `<button class="secondary-action" data-skill-preset="${escapeHtml(skill.id)}" type="button">${registered ? '퀵슬롯 해제' : '퀵슬롯 등록'}</button>`}
        </div>
      </article>`;
    }).join('');
    return `<section class="skill-tier">
      <header>
        <div><span>TIER ${tier}</span><strong>${tier}차 스킬</strong></div>
        <small>${tier === 1 ? '공용 기초 과정' : `이전 차수 ${formatNumber(requirement)} SP 필요`} · 투자 ${formatNumber(tree.tierSpent?.[tier])} SP</small>
      </header>
      <div class="skill-card-list">${cards}</div>
    </section>`;
  }).join('');
  return `<div class="skill-window">
    <div class="skill-summary">
      <div><span>보유 스킬 포인트</span><strong>${formatNumber(state.character?.progression?.unspentSkillPoints)} SP</strong></div>
      <div><span>액티브 프리셋</span><strong>${formatNumber(tree.activePreset?.length)} / 10</strong></div>
    </div>
    <p class="notice-line">상위 차수는 이전 차수의 필수 SP를 모두 투자해야 배울 수 있습니다. P 스킬은 자동 적용되며 퀵슬롯에 등록할 수 없습니다.</p>
    ${tiers}
  </div>`;
}

function renderSkillQuickbar() {
  const quickbar = $('skillQuickbar');
  if (!quickbar) return;
  const tree = state.character?.skillTree;
  const definitions = new Map((tree?.skills || []).map((skill) => [skill.id, skill]));
  const preset = tree?.activePreset || [];
  quickbar.innerHTML = Array.from({ length: 10 }, (_, index) => {
    const skill = definitions.get(preset[index]);
    return `<button class="skill-quick ${skill ? 'has-skill' : ''}" type="button" data-use-skill="${escapeHtml(skill?.id || '')}" ${skill ? '' : 'disabled'}>
      <b>${index + 1}</b><strong>${escapeHtml(skill?.name || '비어 있음')}</strong><small>${skill ? `Lv.${formatNumber(skill.level)}` : 'ACTIVE'}</small>
    </button>`;
  }).join('');
  quickbar.querySelectorAll('[data-use-skill]').forEach((button) => {
    button.addEventListener('click', () => useActiveSkill(button.dataset.useSkill));
  });
}

function renderCompanion() {
  const stage = $('worldStage');
  if (!stage) return;
  let companion = $('fieldCompanion');
  const summon = state.character?.skillTree?.summon;
  if (!summon) {
    companion?.remove();
    return;
  }
  if (!companion) {
    companion = document.createElement('div');
    companion.id = 'fieldCompanion';
    companion.className = 'field-companion';
    companion.innerHTML = '<span>작은 동반자</span><b>◖•ᴗ•◗</b>';
    stage.appendChild(companion);
  }
  const character = $('fieldCharacter');
  companion.style.left = `calc(${character.style.left || '8%'} + 22px)`;
  companion.style.bottom = `calc(${character.style.bottom || '42px'} + 8px)`;
}

async function investActiveSkill(skillId, amount) {
  try {
    const data = await request('/api/v2/skills/invest', {
      method: 'POST',
      body: JSON.stringify({ skillId, amount })
    });
    state.character = data.character;
    renderGame({ preview: state.preview, character: data.character, displayName: state.displayName });
    $('featureBody').innerHTML = buildSkillBody();
    bindSkillControls();
  } catch (err) {
    setWorldActivity(err.message);
  }
}

async function toggleSkillPreset(skillId) {
  const current = [...(state.character?.skillTree?.activePreset || [])];
  const skillIds = current.includes(skillId)
    ? current.filter((id) => id !== skillId)
    : [...current, skillId];
  if (skillIds.length > 10) {
    setWorldActivity('액티브 스킬은 최대 10개까지 등록할 수 있습니다.');
    return;
  }
  try {
    const data = await request('/api/v2/skills/preset', {
      method: 'POST',
      body: JSON.stringify({ skillIds })
    });
    state.character = data.character;
    renderGame({ preview: state.preview, character: data.character, displayName: state.displayName });
    $('featureBody').innerHTML = buildSkillBody();
    bindSkillControls();
  } catch (err) {
    setWorldActivity(err.message);
  }
}

function applySkillCombat(combat = {}) {
  for (const outcome of combat.outcomes || []) {
    const element = Array.from($('monsterLayer').children).find(
      (node) => node.dataset.monsterId === outcome.monsterId
    );
    showFloatingDamage(element, outcome.missed ? 'MISS' : outcome.damage, 'outgoing');
    if (outcome.knockedBack) {
      element?.classList.add('is-knockback');
      setTimeout(() => element?.classList.remove('is-knockback'), 420);
    }
    if (outcome.defeated || !outcome.monster) {
      state.worldMonsters = state.worldMonsters.filter((monster) => monster.id !== outcome.monsterId);
      element?.remove();
      continue;
    }
    state.worldMonsters = state.worldMonsters.map((monster) => (
      monster.id === outcome.monsterId
        ? { ...monster, hp: outcome.monster.hp, maxHp: outcome.monster.maxHp, state: outcome.monster.state }
        : monster
    ));
    const hpBar = element?.querySelector('.monster-hp i');
    if (hpBar) hpBar.style.width = `${ratio(outcome.monster.hp, outcome.monster.maxHp)}%`;
  }
}

async function useActiveSkill(skillId) {
  if (!skillId || state.skillUseBusy || state.dead || state.moving) return;
  const skill = state.character?.skillTree?.skills?.find((entry) => entry.id === skillId);
  if (!skill) return;
  state.skillUseBusy = true;
  try {
    const offensive = ['enemy', 'enemies'].includes(skill.target);
    await playWorldMotion(
      offensive ? (getCombatPresentation().motion || 'slash') : 'buff',
      'combat',
      state.combatRunId
    );
    const data = await request('/api/v2/skills/use', {
      method: 'POST',
      body: JSON.stringify({
        clientId: state.worldClientId,
        mapId: state.currentMapId,
        targetId: state.combatTargetId,
        skillId
      })
    });
    if (data.combat) {
      applySkillCombat(data.combat);
      showGroundLoot(data.combat.drops || []);
    }
    if (data.inventory) setInventoryData(data.inventory);
    state.character = data.character;
    renderGame({ preview: state.preview, character: data.character, displayName: state.displayName });
    setWorldActivity(`${data.skill.name} 사용`);
    await sleep(300);
  } catch (err) {
    setWorldActivity(err.message);
  } finally {
    state.skillUseBusy = false;
  }
}

function bindSkillControls() {
  document.querySelectorAll('[data-skill-invest]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.querySelector(`[data-skill-amount="${button.dataset.skillInvest}"]`);
      investActiveSkill(button.dataset.skillInvest, input?.value);
    });
  });
  document.querySelectorAll('[data-skill-preset]').forEach((button) => {
    button.addEventListener('click', () => toggleSkillPreset(button.dataset.skillPreset));
  });
}
