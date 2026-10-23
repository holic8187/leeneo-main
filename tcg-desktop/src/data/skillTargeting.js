// Target profiles are shared by the authoritative duel and card information.
// Boss battles still have one enemy; their established coefficients stay intact.
const groups = [
  [2, .65, .85, ['gyullak-c','coca-c','guma-u','coca-rr','coca-hr','coca-ur','chuming-rrr','gyullak-rrr','gyullak-hr','peach-rr','peach-sr','easy-rr','easy-hr','winter-r','winter-ssr','mango-rrr','mango-ur','mond-rr','mond-ur','choonsik-r','choonsik-sr','simsim-r','simsim-hr','hoi-hr']],
  [3, .5, .7, ['rayeon-sr','nanche-rrr','sseubi-r','sseubi-rrr','sseubi-ur','jandi-r','jandi-hr','rayeon-rrr','rayeon-ur','meongpeu-rrr','choonsik-ur','simsim-ur']],
  [4, .4, .6, ['coca-ssr','hoi-ur','guma-rr','guma-ssr','rayeon-ssr','mango-ssr','mond-ssr','sseubi-ssr','jandi-ssr','choonsik-ssr','simsim-ssr','meongpeu-ssr']],
];
const profiles = Object.fromEntries(groups.flatMap(([enemyCount, damageScale, breakScale, ids]) => ids.map(id => [id, Object.freeze({ enemyCount, damageScale, debuffScale: damageScale, breakScale })])));
const single = Object.freeze({ enemyCount: 1, damageScale: 1, debuffScale: 1, breakScale: 1 });
export function skillTargeting(cardId) { return profiles[cardId] || single; }
export function targetingDescription(cardId) {
  const p = skillTargeting(cardId);
  return p.enemyCount === 1 ? '적 대상 효과: 선택한 적 1명.' : `적 대상 효과: 선택한 적부터 최대 ${p.enemyCount}명. PvP에서는 대상당 피해·약화 수치 ${Math.round(p.damageScale*100)}%, 브레이크 수치 ${Math.round(p.breakScale*100)}% 적용. 보스전에서는 1체에 기본 수치 적용.`;
}
export function pvpSkillDescription(description, cardId) {
  const scaling = cardId === 'guma-ssr' ? ' PvP에서는 저장 HP 50을 보스전 HP 1로 환산하여 반격 배율을 계산합니다.' : '';
  return `${description} ${targetingDescription(cardId)}${scaling}`;
}
