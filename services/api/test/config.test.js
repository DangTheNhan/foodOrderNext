import assert from 'node:assert/strict';
import test from 'node:test';
import { readConfig } from '../src/config.js';

test('default environment is a demo project and loopback emulators', () => {
  const config = readConfig({});
  assert.equal(config.projectId, 'demo-foodordernext');
  assert.equal(config.mode, 'emulator');
  assert.equal(config.authEmulatorHost, '127.0.0.1:9099');
  assert.equal(config.port, 5000);
});
for (const [name, value] of [
  ['FIREBASE_AUTH_EMULATOR_HOST', 'example.com:9099'],
  ['FIRESTORE_EMULATOR_HOST', 'http://127.0.0.1:8080'],
  ['FIREBASE_STORAGE_EMULATOR_HOST', '127.0.0.1:70000'],
  ['STORAGE_EMULATOR_HOST', 'https://remote.example'],
  ['GOOGLE_APPLICATION_CREDENTIALS', 'private-service-account.json'],
  ['FIREBASE_PROJECT_ID', 'real-foodorder-project'],
  ['FCM_SEND_ENABLED', 'true'],
]) test(`emulator rejects unsafe ${name}`, () => assert.throws(() => readConfig({ [name]: value })));
test('cloud mode requires both explicit opt-in and selected credentials', () => {
  assert.throws(() => readConfig({ FIREBASE_MODE: 'production', FIREBASE_PROJECT_ID: 'real-foodorder' }));
  assert.throws(() => readConfig({ FIREBASE_MODE: 'production', FIREBASE_PROJECT_ID: 'real-foodorder', ALLOW_PRODUCTION_FIREBASE: 'true' }));
  const config = readConfig({ FIREBASE_MODE: 'production', FIREBASE_PROJECT_ID: 'real-foodorder', ALLOW_PRODUCTION_FIREBASE: 'true', FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS: 'true' });
  assert.equal(config.mode, 'production');
  assert.throws(() => readConfig({ FIREBASE_MODE: 'production', FIREBASE_PROJECT_ID: 'real-foodorder', ALLOW_PRODUCTION_FIREBASE: 'true', FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS: 'true', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }));
});
test('invalid ports, bucket URLs and modes fail before network initialization', () => {
  assert.throws(() => readConfig({ PORT: 'not-a-port' }));
  assert.throws(() => readConfig({ PORT: '3.5' }));
  assert.throws(() => readConfig({ FIREBASE_STORAGE_BUCKET: 'https://remote' }));
  assert.throws(() => readConfig({ FIREBASE_MODE: 'automatic' }));
});
