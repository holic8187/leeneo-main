import { skillChoices } from '../data/remainingRosterSkills.js';

export function battleActionChoices(cardId, lastCopyableSkill = null) {
  const effectiveId = cardId === 'hoi-ssr' ? lastCopyableSkill?.cardId || cardId : cardId;
  if (effectiveId === 'guma-hr') return [
    {value:'fortune',label:'길 · 전체 회복 · 약화 제거'},
    {value:'misfortune',label:'흉 · 강한 피해 · 브레이크'},
    {value:'reversal',label:'역전 · 전체 보호막 · 쿨다운 감소'},
  ];
  return skillChoices(effectiveId);
}
export function resolveBattleChoice(cardId, lastCopyableSkill, choice) {
  const choices = battleActionChoices(cardId, lastCopyableSkill);
  return choices.length ? choices.find(item => item.value === choice)?.value || choices[0].value : undefined;
}
