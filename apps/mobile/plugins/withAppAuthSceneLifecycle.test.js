// react-native-app-auth's iOS patch must succeed on Expo SDK 58's AppDelegate template
// (__fixtures__/AppDelegate.sdk58.swift, from expo-template-bare-minimum 58.0.29).
/* global __dirname */
const { expect, it } = require('@jest/globals');
const fs = require('fs');
const path = require('path');
const {
  applyExpoAppDelegatePatch,
} = require('react-native-app-auth/plugin/build/ios/app-delegate');

const { addContinueUserActivity } = require('./withAppAuthSceneLifecycle');

const template = fs.readFileSync(
  path.join(__dirname, '__fixtures__/AppDelegate.sdk58.swift'),
  'utf8',
);

it('the SDK 58 template alone fails the react-native-app-auth patch', () => {
  expect(() => applyExpoAppDelegatePatch(template)).toThrow(
    'could not find application(_:continue',
  );
});

it('with the pass-through method the patch succeeds and resumes the AppAuth flow', () => {
  const patched = applyExpoAppDelegatePatch(addContinueUserActivity(template));
  expect(patched).toContain('RNAppAuthAuthorizationFlowManager {');
  expect(patched).toContain(
    'authorizationFlowManagerDelegate: RNAppAuthAuthorizationFlowManagerDelegate?',
  );
  expect(patched).toContain('resumeExternalUserAgentFlow(with: webpageURL)');
  expect(patched).toContain('return super.application(application, continue: userActivity');
});

it('adds the method once and leaves an AppDelegate that already has it', () => {
  const once = addContinueUserActivity(template);
  expect(addContinueUserActivity(once)).toBe(once);
  expect(once.match(/continue userActivity/g)).toHaveLength(1);
});

it('fails loudly when the template changes shape', () => {
  expect(() => addContinueUserActivity('class AppDelegate: ExpoAppDelegate {}')).toThrow(
    'reactNativeFactory not found',
  );
});
