export function mobileNotificationPermissionPrompt({
  platform,
  authenticated,
  notificationsEnabled,
  permissionDisplay,
  alreadyShown = false,
} = {}) {
  if (platform !== 'android'
    || authenticated !== true
    || alreadyShown === true) return null;

  const display = String(permissionDisplay || '').toLowerCase();
  // A fresh Android install must get one chance to ask for the operating-
  // system permission even if an older failed request switched the in-game
  // preference off. Once Android has answered, respect the in-game toggle.
  if (display === 'prompt') return { action: 'request', display };
  if (display === 'denied' && notificationsEnabled === true) return { action: 'settings', display };
  return null;
}
