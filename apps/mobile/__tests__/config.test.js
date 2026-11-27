import { emulatorConfig } from '../src/config/runtime.config.example';
import { validateConfig } from '../src/config/validateConfig';

test('Android emulator defaults never point at a real Firebase project', () => {
  expect(validateConfig(emulatorConfig, { platform: 'android', isDevelopment: true })).toMatchObject({
    projectId: 'demo-foodordernext', emulatorHost: '10.0.2.2', apiBaseUrl: 'http://10.0.2.2:5000/api/v1',
  });
});
test('release rejects emulator configuration', () => {
  expect(() => validateConfig(emulatorConfig, { platform: 'android', isDevelopment: false })).toThrow('debug');
});
test('staging requires explicit HTTPS API and non-demo project', () => {
  expect(() => validateConfig({ ...emulatorConfig, environment: 'staging' }, { isDevelopment: false })).toThrow('HTTPS');
  expect(validateConfig({ environment: 'staging', projectId: 'example-staging', apiBaseUrl: 'https://api.example/api/v1' }, { isDevelopment: false })).toMatchObject({ environment: 'staging' });
});
