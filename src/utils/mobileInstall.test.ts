import test from 'node:test';
import assert from 'node:assert/strict';
import { getMobileInstallSteps, getDeviceType } from './mobileInstall';

test('android steps mention browser and home screen', () => {
  const steps = getMobileInstallSteps('android');
  assert.ok(steps.length >= 3);
  assert.match(steps[0], /Chrome/i);
  assert.match(steps.join(' '), /Add to Home screen|Add to Home Screen/i);
});

test('ios steps mention Safari and home screen', () => {
  const steps = getMobileInstallSteps('ios');
  assert.ok(steps.length >= 3);
  assert.match(steps[0], /Safari/i);
  assert.match(steps.join(' '), /Add to Home Screen/i);
});

test('device detection uses mobile markers', () => {
  const android = getDeviceType('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36');
  const ios = getDeviceType('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');

  assert.equal(android, 'android');
  assert.equal(ios, 'ios');
});
