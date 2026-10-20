export const MAIL_REWARD_TYPES = Object.freeze([
  Object.freeze({ key: 'coins', label: '동전', icon: 'coins' }),
  Object.freeze({ key: 'standardPacks', label: '표준 카드팩', icon: 'package-open' }),
  Object.freeze({ key: 'premiumPacks', label: '고급 카드팩', icon: 'package-open' }),
  Object.freeze({ key: 'srPremiumPacks', label: 'SR 이상 확정 카드팩', icon: 'sparkles' }),
  Object.freeze({ key: 'ssrTickets', label: 'SSR 확정 랜덤 뽑기권', icon: 'sparkles' }),
]);

const amountOf = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
};

export function mailRewardEntries(rewards = {}) {
  return MAIL_REWARD_TYPES.map((type) => ({ ...type, amount: amountOf(rewards?.[type.key]) }))
    .filter((entry) => entry.amount > 0);
}

export function hasMailRewards(mail) {
  return mailRewardEntries(mail?.rewards).length > 0;
}

export function createAdminMailDraft() {
  return {
    target: 'all', presetId: 'custom', title: '', message: '',
    ...Object.fromEntries(MAIL_REWARD_TYPES.map(({ key }) => [key, '0'])),
    expiresInHours: '168',
  };
}

// Disabled form fields are omitted by FormData. A selected server preset is
// therefore the complete reward source; custom drafts read all four fields.
export function adminMailRewards(formData, preset = null) {
  return Object.fromEntries(MAIL_REWARD_TYPES.map(({ key }) => [
    key, amountOf(preset ? preset.rewards?.[key] : formData.get(key)),
  ]));
}
