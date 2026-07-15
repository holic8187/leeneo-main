'use strict';

let selectedSkillPanelTab = 'beginner';

function buildSkillBody() {
  const tree = state.character?.skillTree;
  if (!tree?.skills?.length) {
    return '<div class="empty-ledger"><b>현재 부서에서 배울 수 있는 스킬이 없습니다.</b><p>전직 후 다시 확인해 주세요.</p></div>';
  }
  const preset = new Set(tree.activePreset || []);
  const buildTier = (tier) => {
    const skills = tree.skills.filter((skill) => skill.tier === tier);
    if (!skills.length) return '';
    const requirement = tree.tierRequirements?.[tier];
    const cards = skills.map((skill) => {
      const registered = preset.has(skill.id);
      return `<article class="skill-card ${skill.passive ? 'is-passive' : ''} ${skill.quest ? 'is-quest' : ''}">
        <div class="skill-card-heading">
          <span>${skill.passive ? 'P' : (skill.quest ? 'Q' : 'A')}</span>
          <div><strong>${escapeHtml(skill.name)}</strong><small>Lv.${formatNumber(skill.level)} / ${formatNumber(skill.maxLevel)} · 현재 투자 상한 ${formatNumber(skill.investmentCap ?? skill.maxLevel)}</small></div>
        </div>
        <p>${escapeHtml(skill.description || '고정 효과')}</p>
        ${skill.range ? `<small>사거리 ${formatNumber(skill.range)}</small>` : ''}
        ${skill.blockReason && skill.level < skill.maxLevel ? `<em>${escapeHtml(skill.blockReason)}</em>` : ''}
        <div class="skill-card-actions">
          <input data-skill-amount="${escapeHtml(skill.id)}" type="number" min="1" max="${Math.max(1, skill.maxLevel - skill.level)}" value="1" ${skill.canInvest ? '' : 'disabled'}>
          <button data-skill-invest="${escapeHtml(skill.id)}" type="button" ${skill.canInvest ? '' : 'disabled'}>SP 투자</button>
          ${skill.passive || skill.level <= 0 || skill.effect === 'flash-jump' ? '' : `<button class="secondary-action" data-skill-preset="${escapeHtml(skill.id)}" type="button">${registered ? '퀵슬롯 해제' : '퀵슬롯 등록'}</button>`}
          ${skill.effect === 'flash-jump' && skill.level > 0 ? '<small>공중에서 점프 버튼을 다시 누르면 자동으로 발동합니다.</small>' : ''}
        </div>
      </article>`;
    }).join('');
    return `<section class="skill-tier">
      <header>
        <div><span>${tier === 0 ? 'NEWCOMER' : `TIER ${tier}`}</span><strong>${tier === 0 ? '신입사원 스킬' : `${tier}차 스킬`}</strong></div>
        <small>${tier === 0
          ? `레벨 2~10 획득분 · 투자 ${formatNumber(tree.tierSpent?.[0])} / ${formatNumber(tree.tierEarned?.[0] ?? 9)} SP`
          : `${tier === 1 ? '1차 보직 과정' : `이전 차수 ${formatNumber(requirement)} SP 필요`} · 투자 ${formatNumber(tree.tierSpent?.[tier])} SP`}</small>
      </header>
      <div class="skill-card-list">${cards}</div>
    </section>`;
  };
  const hasAdvanced = Number(state.character?.job?.advancementTier) > 0;
  if (!hasAdvanced) selectedSkillPanelTab = 'beginner';
  if (!['beginner', 'job'].includes(selectedSkillPanelTab)) selectedSkillPanelTab = 'beginner';
  const beginnerSpent = Number(tree.tierSpent?.[0]) || 0;
  const beginnerEarned = Number(tree.tierEarned?.[0]) || 0;
  const beginnerRemaining = Math.max(0, beginnerEarned - beginnerSpent);
  const tabs = hasAdvanced
    ? `<nav class="skill-category-tabs" aria-label="스킬 과정 선택">
        <button type="button" data-skill-panel-tab="beginner" class="${selectedSkillPanelTab === 'beginner' ? 'is-active' : ''}">신입사원 스킬 <small>${formatNumber(beginnerRemaining)} SP</small></button>
        <button type="button" data-skill-panel-tab="job" class="${selectedSkillPanelTab === 'job' ? 'is-active' : ''}">전직 스킬</button>
      </nav>`
    : '<nav class="skill-category-tabs"><button type="button" class="is-active">신입사원 스킬</button></nav>';
  const tiers = selectedSkillPanelTab === 'beginner'
    ? buildTier(0)
    : [1, 2, 3, 4].map(buildTier).join('');
  return `<div class="skill-window">
    <div class="skill-summary">
      <div><span>보유 스킬 포인트</span><strong>${formatNumber(state.character?.progression?.unspentSkillPoints)} SP</strong></div>
      <div><span>신입사원 과정 미투자</span><strong>${formatNumber(beginnerRemaining)} SP</strong></div>
    </div>
    ${tabs}
    <p class="notice-line">신입사원 스킬은 레벨 2~10에서 획득한 9포인트만 투자할 수 있습니다. P 스킬은 자동 적용되며 퀵슬롯에 등록할 수 없습니다.</p>
    ${tiers}
  </div>`;
}

function isBeginnerBasicAttackEligible() {
  const character = state.character || {};
  const level = Math.max(1, Math.floor(Number(character.progression?.level) || 1));
  const job = character.job || {};
  const advancementTier = Math.max(0, Math.floor(Number(job.advancementTier) || 0));
  const departmentId = String(job.departmentId || 'unassigned');
  return level < 10 && advancementTier <= 0 && departmentId === 'unassigned';
}

function getBasicAttackAutoStorageKey() {
  const owner = String(state.character?.id || state.displayName || 'default');
  return `v2BasicAttackAuto:${owner}`;
}

function isBasicAttackAutoEnabled() {
  if (!isBeginnerBasicAttackEligible()) return false;
  try {
    return localStorage.getItem(getBasicAttackAutoStorageKey()) !== 'false';
  } catch (_) {
    return true;
  }
}

function toggleBasicAttackAuto() {
  if (!isBeginnerBasicAttackEligible()) return;
  const nextEnabled = !isBasicAttackAutoEnabled();
  try {
    localStorage.setItem(getBasicAttackAutoStorageKey(), nextEnabled ? 'true' : 'false');
  } catch (_) {
    // Local storage may be unavailable, but server-side eligibility still protects basic attacks.
  }
  renderSkillQuickbar();
}

function renderSkillQuickbar() {
  const quickbar = $('skillQuickbar');
  if (!quickbar) return;
  ensureAutoSkillPreferences();
  const tree = state.character?.skillTree;
  const definitions = new Map((tree?.skills || []).map((skill) => [skill.id, skill]));
  const preset = tree?.activePreset || [];
  const validIds = new Set(preset);
  const removedIds = [...state.autoSkillIds].filter((skillId) => !validIds.has(skillId));
  removedIds.forEach((skillId) => state.autoSkillIds.delete(skillId));
  if (removedIds.length) saveAutoSkillPreferences();
  const skillSlots = Array.from({ length: 10 }, (_, index) => {
    const skill = definitions.get(preset[index]);
    const autoEnabled = Boolean(skill && state.autoSkillIds.has(skill.id));
    return `<div class="skill-quick-slot ${autoEnabled ? 'is-auto' : ''}">
      <button class="skill-quick ${skill ? 'has-skill' : ''}" type="button"
        ${skill ? `data-use-skill="${escapeHtml(skill.id)}"` : `data-empty-skill-slot="${index}"`}>
        <b>${index + 1}</b><strong>${escapeHtml(skill?.name || '비어 있음')}</strong><small>${skill ? `Lv.${formatNumber(skill.level)}` : 'ACTIVE'}</small>
      </button>
      <button class="skill-auto-toggle" type="button"
        ${skill ? `data-auto-skill="${escapeHtml(skill.id)}"` : 'disabled'}
        aria-pressed="${autoEnabled}">
        <span>AUTO</span><strong>${autoEnabled ? 'ON' : 'OFF'}</strong>
      </button>
    </div>`;
  }).join('') + '<button class="skill-preset-edit" type="button" data-open-skill-preset>스킬 등록/해제</button>';
  const basicAttackEnabled = isBasicAttackAutoEnabled();
  const basicAttackToggle = isBeginnerBasicAttackEligible()
    ? `<button class="skill-basic-attack-toggle" type="button" data-basic-attack-toggle aria-pressed="${basicAttackEnabled}">
        <span>기본공격</span><strong>${basicAttackEnabled ? 'ON' : 'OFF'}</strong><small>Lv.10 전용</small>
      </button>`
    : '';
  quickbar.innerHTML = basicAttackToggle
    ? skillSlots.replace('<button class="skill-preset-edit"', `${basicAttackToggle}<button class="skill-preset-edit"`)
    : skillSlots;
  quickbar.querySelectorAll('[data-use-skill]').forEach((button) => {
    button.addEventListener('click', () => queueManualSkillUse(button.dataset.useSkill));
  });
  quickbar.querySelectorAll('[data-empty-skill-slot]').forEach((button) => {
    button.addEventListener('click', () => openSkillPresetEditor(Number(button.dataset.emptySkillSlot)));
  });
  quickbar.querySelectorAll('[data-auto-skill]').forEach((button) => {
    button.addEventListener('click', () => toggleAutoSkill(button.dataset.autoSkill));
  });
  quickbar.querySelector('[data-basic-attack-toggle]')?.addEventListener('click', () => toggleBasicAttackAuto());
  quickbar.querySelector('[data-open-skill-preset]')?.addEventListener('click', () => openSkillPresetEditor());
}

function getAutoSkillStorageKey() {
  const owner = String(state.character?.id || state.displayName || 'default');
  return `v2AutoSkillIds:${owner}`;
}

function ensureAutoSkillPreferences() {
  const storageKey = getAutoSkillStorageKey();
  if (state.autoSkillOwnerKey === storageKey) return;
  state.autoSkillOwnerKey = storageKey;
  const serverAutoPreset = state.character?.skillTree?.autoPreset || [];
  try {
    const raw = localStorage.getItem(storageKey);
    const stored = raw == null ? serverAutoPreset : JSON.parse(raw || '[]');
    state.autoSkillIds = new Set(Array.isArray(stored) ? stored.map(String) : []);
  } catch (_) {
    state.autoSkillIds = new Set(serverAutoPreset.map(String));
  }
  state.autoSkillRotationIndex = 0;
  syncAutoSkillPreferencesToServer();
}

function saveAutoSkillPreferences() {
  if (!state.autoSkillOwnerKey) ensureAutoSkillPreferences();
  localStorage.setItem(state.autoSkillOwnerKey, JSON.stringify([...state.autoSkillIds]));
  syncAutoSkillPreferencesToServer();
}

async function syncAutoSkillPreferencesToServer() {
  if (!state.token || state.isAdmin || !state.character?.skillTree) return;
  const skillIds = [...state.autoSkillIds];
  try {
    const data = await request('/api/v2/skills/auto-preset', {
      method: 'POST',
      body: JSON.stringify({ skillIds })
    });
    if (data.character) state.character = data.character;
  } catch (err) {
    console.warn('V2 auto skill sync failed:', err);
  }
}

function toggleAutoSkill(skillId) {
  ensureAutoSkillPreferences();
  if (state.autoSkillIds.has(skillId)) state.autoSkillIds.delete(skillId);
  else state.autoSkillIds.add(skillId);
  saveAutoSkillPreferences();
  renderSkillQuickbar();
}

const AUTO_BUFF_RECAST_WINDOW_MS = 4_000;

function shouldHoldAutoBuffUntilLater(expiresAt) {
  if (!expiresAt) return true;
  return Number(expiresAt) - Date.now() > AUTO_BUFF_RECAST_WINDOW_MS;
}

function hasActiveAutoSkillEffect(skill) {
  const tree = state.character?.skillTree || {};
  const now = Date.now();
  if (['element_fire', 'element_ice'].includes(skill.id)) {
    return (tree.activeBuffs || []).some(
      (buff) => ['element_fire', 'element_ice'].includes(buff.skillId)
        && (!buff.expiresAt || (Number(buff.expiresAt) > now && shouldHoldAutoBuffUntilLater(buff.expiresAt)))
    );
  }
  if (
    skill.effect === 'summon'
    && tree.summon?.skillId === skill.id
    && Number(tree.summon.expiresAt) > now
  ) return shouldHoldAutoBuffUntilLater(tree.summon.expiresAt);
  return (tree.activeBuffs || []).some(
    (buff) => buff.skillId === skill.id
      && (!buff.expiresAt || (Number(buff.expiresAt) > now && shouldHoldAutoBuffUntilLater(buff.expiresAt)))
  );
}

function mergeAppliedBuffIntoCharacter(character, appliedBuff) {
  if (!character?.skillTree || !appliedBuff?.skillId) return;
  const buffs = Array.isArray(character.skillTree.activeBuffs)
    ? character.skillTree.activeBuffs
    : [];
  const createdAt = new Date(appliedBuff.createdAt || Date.now()).getTime();
  const expiresAt = appliedBuff.expiresAt
    ? new Date(appliedBuff.expiresAt).getTime()
    : 0;
  character.skillTree.activeBuffs = [
    ...buffs.filter((buff) => buff.skillId !== appliedBuff.skillId),
    {
      ...appliedBuff,
      createdAt,
      expiresAt,
      durationMs: expiresAt > createdAt ? expiresAt - createdAt : 0
    }
  ];
}

function getNextAutoSkillForCombat() {
  ensureAutoSkillPreferences();
  const tree = state.character?.skillTree;
  const preset = tree?.activePreset || [];
  if (!preset.length || !state.autoSkillIds.size) return null;
  const definitions = new Map((tree.skills || []).map((skill) => [skill.id, skill]));
  for (let checked = 0; checked < preset.length; checked += 1) {
    const index = state.autoSkillRotationIndex % preset.length;
    state.autoSkillRotationIndex = (index + 1) % preset.length;
    const skill = definitions.get(preset[index]);
    if (!skill || skill.passive || skill.level <= 0 || !state.autoSkillIds.has(skill.id)) continue;
    if (Number(skill.cooldownUntil || 0) > Date.now()) continue;
    if (!skill.cooldownUntil && Number(skill.cooldownRemainingMs || skill.cooldownRemaining || 0) > 0) continue;
    if (hasActiveAutoSkillEffect(skill)) continue;
    return skill;
  }
  return null;
}

const COMBAT_BUFF_ICONS = Object.freeze({
  experience_coupon_2x_15m: '📈',
  event_experience_coupon_2x_15m: '📈',
  extended_2d39c91d21: '🎯',
  extended_47fcdc0ba0: '🥷',
  extended_51dd415210: '🔷',
  extended_0850825cc5: '🛡️',
  extended_95cc04b09a: '🥤',
  extended_f95d36e0d6: '☕',
  extended_e76286335c: '🏢',
  extended_b067160f36: '🧠',
  extended_ccb060a442: '👁️',
  extended_2dc9886c3e: '💡',
  extended_51403b1515: '💰',
  extended_47cf15f1d3: '📢',
  extended_8bf14061cf: '⚠️',
  extended_1f2faa809b: '🔥',
  extended_0dcef657e3: '♾️',
  extended_44a91b0310: '⚡',
  extended_69705b66e7: '🔋',
  extended_63286735de: '🤝',
  extended_80b1bfaa83: '🎓',
  extended_4d105c3f1f: '💳',
  extended_7fbad835e4: '💚',
  iron_body: '🛡️',
  booster_hr: '⏩',
  booster_field: '⏩',
  booster_quality: '⏩',
  rage: '🔥',
  combo_attack: '⚔️',
  firm_will_hr: '🧱',
  firm_will_quality: '🧱',
  true_rage: '💢',
  element_fire: '🔥',
  element_ice: '❄️',
  element_lightning: '⚡',
  element_holy: '✨',
  iron_wall: '🏰',
  quality_inspection: '❤️',
  bleeding_endurance: '🩸',
  small_companion: '🐾'
});

let combatBuffTrayTimerId = 0;
const combatBuffHoldTimers = new WeakMap();

function getCombatBuffIcon(skillId, name = '', effects = {}) {
  if (COMBAT_BUFF_ICONS[skillId]) return COMBAT_BUFF_ICONS[skillId];
  const label = String(name || '');
  if (/불사조|불 속성|가열|출혈|분노/.test(label)) return '🔥';
  if (/얼음|동결|냉각|극저온/.test(label)) return '❄️';
  if (/번개|전력|동력|에너지|출력|가속|신속|부스터/.test(label)) return '⚡';
  if (/성 속성|축복|성과 지원/.test(label)) return '✨';
  if (/방패|보호|방어|철벽|차단|봉쇄|굳건|연막|대피/.test(label)) return '🛡️';
  if (/회복|복지|지원|고충/.test(label)) return '💚';
  if (/드론|수호체|마스코트|동반자|실험체|장부/.test(label)) return '🤖';
  if (/은신|잠복|매복/.test(label) || Number(effects.stealth) > 0) return '🥷';
  if (/집중|인사이트|감사|검산|포착/.test(label)) return '👁️';
  if (/예산|성과급|계약|입찰|명함/.test(label)) return '💰';
  if (/경험|역량|교육/.test(label) || Number(effects.experienceBonusPercent) > 0) return '📈';
  if (/공격|파동|폭발|캠페인|분노/.test(label)) return '⚔️';
  return '🔹';
}

function formatBuffRemaining(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}시간 ${Math.ceil(seconds % 3600 / 60)}분`;
  if (seconds >= 60) return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
  return `${seconds}초`;
}

function combatBuffIconBody(buff) {
  const timed = Number(buff.expiresAt) > 0;
  const stack = Number(buff.stack ?? buff.count);
  return `<article class="combat-buff-icon" tabindex="0"
    data-buff-skill-id="${escapeHtml(buff.skillId || '')}"
    data-buff-created-at="${Number(buff.createdAt) || 0}"
    data-buff-expires-at="${Number(buff.expiresAt) || 0}"
    data-buff-duration="${Number(buff.durationMs) || 0}"
    style="--buff-expired-progress:0">
    <div class="combat-buff-face">
      <span aria-hidden="true">${escapeHtml(buff.icon || getCombatBuffIcon(buff.skillId, buff.name, buff.effects))}</span>
      ${Number.isFinite(stack) ? `<b>${formatNumber(stack)}</b>` : ''}
      ${timed ? '<i class="combat-buff-mask"></i>' : ''}
    </div>
    <small class="combat-buff-time">${timed ? '계산 중' : '유지 중'}</small>
    <div class="combat-buff-tooltip" role="tooltip">
      <strong>${escapeHtml(buff.name || '버프')}</strong>
      <p>${escapeHtml(buff.description || '현재 적용 중인 효과입니다.')}</p>
      <small data-buff-tooltip-time>${timed ? '남은 시간 계산 중' : '지속형 효과'}</small>
    </div>
  </article>`;
}

function updateCombatBuffTimers() {
  const tray = $('combatBuffTray');
  if (!tray) return;
  const now = Date.now();
  tray.querySelectorAll('.combat-buff-icon[data-buff-expires-at]').forEach((icon) => {
    const expiresAt = Number(icon.dataset.buffExpiresAt) || 0;
    if (!expiresAt) return;
    const createdAt = Number(icon.dataset.buffCreatedAt) || now;
    const duration = Math.max(1, Number(icon.dataset.buffDuration) || expiresAt - createdAt);
    const remaining = Math.max(0, expiresAt - now);
    const expiredProgress = Math.max(0, Math.min(100, (1 - remaining / duration) * 100));
    icon.style.setProperty('--buff-expired-progress', expiredProgress.toFixed(2));
    const label = formatBuffRemaining(remaining);
    const time = icon.querySelector('.combat-buff-time');
    const tooltipTime = icon.querySelector('[data-buff-tooltip-time]');
    if (time) time.textContent = label;
    if (tooltipTime) tooltipTime.textContent = `남은 시간 ${label}`;
    if (remaining <= 0) icon.remove();
  });
  const stealthActive = Boolean(
    tray.querySelector('[data-buff-skill-id="extended_47fcdc0ba0"]')
  );
  $('fieldCharacter')?.classList.toggle('is-stealthed', stealthActive);
  tray.classList.toggle('is-empty', tray.childElementCount === 0);
}

function bindCombatBuffInspection() {
  document.querySelectorAll('.combat-buff-icon').forEach((icon) => {
    const reveal = () => {
      icon.classList.add('is-inspecting');
      combatBuffHoldTimers.delete(icon);
    };
    const cancel = (keepVisible = false) => {
      const timer = combatBuffHoldTimers.get(icon);
      if (timer) clearTimeout(timer);
      combatBuffHoldTimers.delete(icon);
      if (keepVisible && icon.classList.contains('is-inspecting')) {
        setTimeout(() => icon.classList.remove('is-inspecting'), 1800);
      } else {
        icon.classList.remove('is-inspecting');
      }
    };
    icon.addEventListener('pointerdown', () => {
      cancel();
      combatBuffHoldTimers.set(icon, setTimeout(reveal, 450));
    });
    icon.addEventListener('pointerup', () => cancel(true));
    icon.addEventListener('pointercancel', () => cancel());
    icon.addEventListener('pointerleave', () => cancel(true));
    icon.addEventListener('contextmenu', (event) => event.preventDefault());
  });
}

function renderCombatBuffTray() {
  const tray = $('combatBuffTray');
  if (!tray) return;
  const tree = state.character?.skillTree || {};
  const buffs = [...(tree.activeBuffs || [])].map((buff) => ({
    ...buff,
    icon: getCombatBuffIcon(buff.skillId, buff.name, buff.effects)
  }));
  if (tree.summon) {
    buffs.push({
      ...tree.summon,
      skillId: tree.summon.skillId || 'small_companion',
      name: tree.summon.name || '작은 동반자',
      icon: '🐾'
    });
  }
  const comboBuffActive = buffs.some((buff) => buff.skillId === 'combo_attack');
  if (comboBuffActive || Number(tree.comboCount) > 0) {
    buffs.push({
      skillId: 'combo_counter',
      name: '콤보 카운트',
      description: '공격으로 쌓은 콤보입니다. 콤보 스킬의 피해량과 소비 조건에 사용됩니다.',
      icon: '⚔️',
      count: Number(tree.comboCount) || 0,
      createdAt: 0,
      expiresAt: 0,
      durationMs: 0
    });
  }
  tray.innerHTML = buffs.map(combatBuffIconBody).join('');
  tray.classList.toggle('is-empty', buffs.length === 0);
  $('fieldCharacter')?.classList.toggle(
    'is-stealthed',
    buffs.some((buff) => buff.skillId === 'extended_47fcdc0ba0')
  );
  bindCombatBuffInspection();
  updateCombatBuffTimers();
  if (!combatBuffTrayTimerId) {
    combatBuffTrayTimerId = setInterval(updateCombatBuffTimers, 250);
  }
}

function buildSkillPresetEditor(preferredSlot = null) {
  const tree = state.character?.skillTree;
  const preset = tree?.activePreset || [];
  const activeSkills = (tree?.skills || []).filter(
    (skill) => !skill.passive && skill.effect !== 'flash-jump' && skill.level > 0
  );
  const guide = Number.isInteger(preferredSlot)
    ? `${preferredSlot + 1}번 빈 슬롯에 등록할 스킬을 선택하세요.`
    : '배운 액티브 스킬을 최대 10개까지 등록하거나 해제할 수 있습니다.';
  const cards = activeSkills.length
    ? activeSkills.map((skill) => {
      const presetIndex = preset.indexOf(skill.id);
      const registered = presetIndex >= 0;
      return `<article class="skill-preset-card ${registered ? 'is-registered' : ''}">
        <div>
          <span>${registered ? `${presetIndex + 1}번 슬롯` : '미등록'}</span>
          <strong>${escapeHtml(skill.name)} <small>Lv.${formatNumber(skill.level)}</small></strong>
          <p>${escapeHtml(skill.description || '스킬 설명이 없습니다.')}</p>
        </div>
        <button type="button" data-preset-choice="${escapeHtml(skill.id)}">${registered ? '해제' : '등록'}</button>
      </article>`;
    }).join('')
    : '<div class="empty-ledger"><b>등록할 수 있는 액티브 스킬이 없습니다.</b><p>스킬 포인트를 투자해 액티브 스킬을 먼저 배우세요.</p></div>';
  return `<div class="skill-preset-editor">
    <header><strong>스킬 퀵슬롯 관리</strong><p>${guide}</p></header>
    <div class="skill-preset-list">${cards}</div>
  </div>`;
}

function openSkillPresetEditor(preferredSlot = null) {
  $('featureCode').textContent = 'QUICK SLOT';
  $('featureTitle').textContent = '스킬 등록/해제';
  $('featureBody').innerHTML = buildSkillPresetEditor(preferredSlot);
  $('featureModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
  bindSkillPresetEditor(preferredSlot);
}

async function updateSkillPreset(skillId, preferredSlot = null) {
  const current = [...(state.character?.skillTree?.activePreset || [])];
  const existingIndex = current.indexOf(skillId);
  let skillIds;
  if (existingIndex >= 0) {
    skillIds = current.filter((id) => id !== skillId);
  } else if (current.length >= 10 && !Number.isInteger(preferredSlot)) {
    setWorldActivity('액티브 스킬은 최대 10개까지 등록할 수 있습니다.');
    return;
  } else if (Number.isInteger(preferredSlot) && preferredSlot < current.length) {
    skillIds = [...current];
    skillIds[preferredSlot] = skillId;
  } else {
    skillIds = [...current, skillId];
  }
  try {
    const data = await request('/api/v2/skills/preset', {
      method: 'POST',
      body: JSON.stringify({ skillIds })
    });
    state.character = data.character;
    renderGame({ preview: state.preview, character: data.character, displayName: state.displayName });
    $('featureBody').innerHTML = buildSkillPresetEditor(preferredSlot);
    bindSkillPresetEditor(preferredSlot);
  } catch (err) {
    setWorldActivity(err.message);
  }
}

function bindSkillPresetEditor(preferredSlot = null) {
  document.querySelectorAll('[data-preset-choice]').forEach((button) => {
    button.addEventListener('click', () => updateSkillPreset(button.dataset.presetChoice, preferredSlot));
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
    showFloatingDamage(
      element,
      outcome.missed ? 'MISS' : outcome.damage,
      !outcome.missed && combat.critical ? 'critical' : 'outgoing'
    );
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

async function queueManualSkillUse(skillId) {
  if (!skillId || state.dead) return false;
  state.manualSkillQueue.push(String(skillId));
  beginManualSkillPriority();
  if (state.manualSkillQueueRunning) return true;
  state.manualSkillQueueRunning = true;
  try {
    while (state.manualSkillQueue.length && !state.dead) {
      while (state.skillUseBusy && !state.dead) await new Promise((resolve) => setTimeout(resolve, 25));
      const nextSkillId = state.manualSkillQueue.shift();
      if (!nextSkillId || state.dead) continue;
      await useActiveSkill(nextSkillId, { manual: true });
    }
  } finally {
    state.manualSkillQueue.length = 0;
    state.manualSkillQueueRunning = false;
    endManualSkillPriority();
  }
  return true;
}

async function useActiveSkill(skillId, options = {}) {
  const manual = options.manual === true;
  if (
    !skillId
    || state.skillUseBusy
    || state.dead
    || (!manual && (state.moving || state.manualSkillPriority))
  ) return false;
  const skill = state.character?.skillTree?.skills?.find((entry) => entry.id === skillId);
  if (!skill) return false;
  state.skillUseBusy = true;
  try {
    const offensive = ['enemy', 'enemies'].includes(skill.target);
    await playWorldMotion(
      offensive ? (getCombatPresentation().motion || 'slash') : 'buff',
      manual ? 'manual' : 'combat',
      manual ? 0 : state.combatRunId,
      `${skill.name} 시전`
    );
    const data = await request('/api/v2/skills/use', {
      method: 'POST',
      body: JSON.stringify({
        clientId: state.worldClientId,
        mapId: state.currentMapId,
        x: typeof getCharacterX === 'function' ? getCharacterX() : 8,
        floor: typeof getCharacterFloor === 'function' ? getCharacterFloor() : 0,
        facingLeft: $('fieldCharacter')?.classList.contains('facing-left') || false,
        direction: $('fieldCharacter')?.classList.contains('facing-left') ? 'left' : 'right',
        targetId: state.combatTargetId,
        skillId
      })
    });
    if (data.combat) {
      if (data.combat.teleport) {
        const character = $('fieldCharacter');
        const teleport = data.combat.teleport;
        state.currentMapId = teleport.mapId || state.currentMapId;
        localStorage.setItem('v2CurrentMapId', state.currentMapId);
        if (character) {
          character.classList.add('is-teleporting');
          character.style.transitionDuration = '90ms';
          character.style.left = `${Math.max(0, Math.min(94, Number(teleport.x) || 8))}%`;
          character.style.bottom = Number(teleport.floor) === 1
            ? `${getUpperPlatformBottom()}px`
            : '42px';
          setTimeout(() => {
            character.style.transitionDuration = '';
            character.classList.remove('is-teleporting');
          }, 240);
        }
      }
      applySkillCombat(data.combat);
      showGroundLoot(data.combat.drops || []);
      if (typeof handleFieldBossEvents === 'function' && Array.isArray(data.combat.fieldBossRewardResults)) {
        data.combat.fieldBossRewardResults.forEach((rewardResult) => (
          handleFieldBossEvents({ fieldBossRewards: [rewardResult] })
        ));
      }
    }
    if (typeof playSkillVisualEffect === 'function') {
      playSkillVisualEffect(data.skill, data.combat);
    }
    if (data.inventory) setInventoryData(data.inventory);
    mergeAppliedBuffIntoCharacter(data.character, data.combat?.appliedBuff);
    state.character = data.character;
    renderGame({ preview: state.preview, character: data.character, displayName: state.displayName });
    showSkillUseLabel($('fieldCharacter'), data.skill.name);
    setWorldActivity(`${data.skill.name} 사용`);
    if (!options.automatic) await sleep(300);
    return true;
  } catch (err) {
    setWorldActivity(err.message);
    return false;
  } finally {
    state.skillUseBusy = false;
  }
}

function bindSkillControls() {
  document.querySelectorAll('[data-skill-panel-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedSkillPanelTab = button.dataset.skillPanelTab;
      $('featureBody').innerHTML = buildSkillBody();
      bindSkillControls();
    });
  });
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
