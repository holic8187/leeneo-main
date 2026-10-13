const number = (value) => Math.max(0, Number(value) || 0).toLocaleString('ko-KR');

// Keep the explanation, selected text and scroll node intact while updating
// values explicitly labelled as current during automatic or remote turns.
export function updateRaidInspectorValues(root, battle, inspector) {
  if (!root || !battle || !inspector || !['skill', 'card'].includes(inspector.type)) return;
  const member = battle.squad?.[inspector.cardIndex];
  if (!member) return;
  const cooldown = Number(member.skillCooldown ?? member.cooldown) || 0;
  const values = {
    attack: number(member.attack),
    hp: number(member.hp),
    maxHp: number(member.maxHp),
    status: member.hp <= 0 ? '행동 불능' : cooldown > 0 ? `스킬 ${number(cooldown)}턴 남음` : '행동 가능',
  };
  for (const node of root.querySelectorAll('[data-raid-inspector-value]')) {
    const value = values[node.dataset.raidInspectorValue];
    if (value !== undefined && node.textContent !== value) node.textContent = value;
  }
}
