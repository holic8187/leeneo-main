import assert from 'node:assert/strict';
import test from 'node:test';
import { mobileNotificationPermissionPrompt } from '../src/core/mobileNotificationPermission.js';

const eligible = {
  platform: 'android',
  authenticated: true,
  cloudActive: true,
  notificationsEnabled: true,
  permissionDisplay: 'prompt',
  alreadyShown: false,
};

test('Android requests notification permission after authenticated cloud play becomes active', () => {
  assert.deepEqual(mobileNotificationPermissionPrompt(eligible), {
    action: 'request',
    display: 'prompt',
  });
});

test('an earlier Android denial offers the app notification settings instead of a dead permission request', () => {
  assert.deepEqual(mobileNotificationPermissionPrompt({
    ...eligible,
    permissionDisplay: 'denied',
  }), {
    action: 'settings',
    display: 'denied',
  });
});

test('the permission prompt respects game settings and only appears once per app session', () => {
  assert.equal(mobileNotificationPermissionPrompt({ ...eligible, notificationsEnabled: false }), null);
  assert.equal(mobileNotificationPermissionPrompt({ ...eligible, alreadyShown: true }), null);
});

test('the permission prompt never interrupts signed-out, disconnected, non-Android, or already granted play', () => {
  assert.equal(mobileNotificationPermissionPrompt({ ...eligible, authenticated: false }), null);
  assert.equal(mobileNotificationPermissionPrompt({ ...eligible, cloudActive: false }), null);
  assert.equal(mobileNotificationPermissionPrompt({ ...eligible, platform: 'pc' }), null);
  assert.equal(mobileNotificationPermissionPrompt({ ...eligible, permissionDisplay: 'granted' }), null);
  assert.equal(mobileNotificationPermissionPrompt({ ...eligible, permissionDisplay: 'unavailable' }), null);
});
