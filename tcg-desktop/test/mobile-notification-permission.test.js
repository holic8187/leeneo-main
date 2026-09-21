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

test('Android requests notification permission after authentication', () => {
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

test('a fresh Android permission request is offered even if an earlier failed flow disabled game notifications', () => {
  assert.deepEqual(mobileNotificationPermissionPrompt({ ...eligible, notificationsEnabled: false }), {
    action: 'request',
    display: 'prompt',
  });
});

test('the permission prompt only appears once per app session', () => {
  assert.equal(mobileNotificationPermissionPrompt({ ...eligible, alreadyShown: true }), null);
});

test('the permission prompt never interrupts signed-out, non-Android, or already granted play', () => {
  assert.equal(mobileNotificationPermissionPrompt({ ...eligible, authenticated: false }), null);
  assert.equal(mobileNotificationPermissionPrompt({ ...eligible, platform: 'pc' }), null);
  assert.equal(mobileNotificationPermissionPrompt({ ...eligible, permissionDisplay: 'granted' }), null);
  assert.equal(mobileNotificationPermissionPrompt({ ...eligible, permissionDisplay: 'unavailable' }), null);
});

test('Android permission does not wait for the cross-device cloud lease', () => {
  assert.deepEqual(mobileNotificationPermissionPrompt({ ...eligible, cloudActive: false }), {
    action: 'request',
    display: 'prompt',
  });
});

test('a denied permission opens settings only while game notifications are enabled', () => {
  assert.equal(mobileNotificationPermissionPrompt({
    ...eligible,
    notificationsEnabled: false,
    permissionDisplay: 'denied',
  }), null);
});
