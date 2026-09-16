export function mobileNotificationPermissionPrompt({
  platform,
  authenticated,
  cloudActive,
  notificationsEnabled,
  permissionDisplay,
  alreadyShown = false,
} = {}) {
  if (platform !== 'android'
    || authenticated !== true
    || cloudActive !== true
    || notificationsEnabled !== true
    || alreadyShown === true) return null;

  const display = String(permissionDisplay || '').toLowerCase();
  if (display === 'prompt') return { action: 'request', display };
  if (display === 'denied') return { action: 'settings', display };
  return null;
}
