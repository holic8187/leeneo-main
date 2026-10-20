import { WEEKLY_REWARD_TIERS, rewardForRank } from '../core/weeklyRankingRewards.js';
import { mailRewardEntries } from '../core/mailRewards.js';

const num = value => Math.max(0, Number(value) || 0).toLocaleString('ko-KR');
const description = rewards => mailRewardEntries(rewards).map(item => `${item.label} ${num(item.amount)}${item.key === 'coins' ? '' : '개'}`).join(' · ');

export function renderWeeklyRewardGuide(ranking = {}) {
  const projected = ranking.myProjectedRewards || (ranking.myRank ? rewardForRank(ranking.myRank) : null);
  return `<details class="weekly-reward-guide"><summary><i data-lucide="gift"></i> 주간 랭킹 보상 안내 <span>${ranking.myRank ? `${num(ranking.myRank)}위 예상 보상` : '매주 월요일 00시 정산'}</span></summary>
    ${projected ? `<p class="weekly-reward-projection">현재 순위 기준: <strong>${description(projected)}</strong></p>` : ''}
    <div class="weekly-reward-tiers">${WEEKLY_REWARD_TIERS.map(tier => `<div><strong>${tier.maxRank ? `${tier.minRank}~${tier.maxRank}위` : `${tier.minRank}위 이후`}</strong><span>${description(tier.rewards)}</span></div>`).join('')}</div>
    <p>대한민국 시간 매주 월요일 00시의 최종 순위로 우편함에 지급합니다. 같은 점수는 공동 순위·같은 보상이며, 피해 점수가 있는 참여자만 대상입니다. 보상 우편은 30일 안에 수령해 주세요.</p><p>SR 이상 확정 카드팩은 1팩에 SR 이상 카드 5장입니다. 등급별 확률은 SR 70% · HR 22% · UR 7% · SSR 1%입니다.</p></details>`;
}
