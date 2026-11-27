const projectPattern = /^[a-z][a-z0-9-]{4,61}[a-z0-9]$/;

export function assertLoopbackHost(value, name) {
  const match = /^(127\.0\.0\.1|localhost|\[::1\]):([1-9]\d{0,4})$/.exec(value ?? '');
  if (!match || Number(match[2]) > 65535) throw new Error(`${name} must be a loopback host:port without a URL scheme.`);
  return value;
}

export function readConfig(env = process.env) {
  const mode = env.FIREBASE_MODE || 'emulator';
  if (!['emulator', 'production'].includes(mode)) throw new Error('FIREBASE_MODE must be emulator or production.');
  const projectId = env.FIREBASE_PROJECT_ID || 'demo-foodordernext';
  if (!projectPattern.test(projectId)) throw new Error('FIREBASE_PROJECT_ID is invalid.');
  const port = Number(env.PORT || '5000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
  const config = { mode, projectId, port, bindHost: env.API_BIND_HOST || '127.0.0.1', storageBucket: env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com` };
  config.fcmEnabled = env.FCM_SEND_ENABLED === 'true';
  if (!/^[a-z0-9][a-z0-9._-]{2,221}$/.test(config.storageBucket)) throw new Error('FIREBASE_STORAGE_BUCKET must be a bucket name without a URL scheme.');
  if (!['127.0.0.1', 'localhost', '0.0.0.0', '::1'].includes(config.bindHost)) throw new Error('API_BIND_HOST must be a local binding address.');
  if (mode === 'emulator') {
    if (config.fcmEnabled) throw new Error('FCM sending requires a real Firebase project.');
    if (!projectId.startsWith('demo-')) throw new Error('Emulator mode requires a demo- project ID.');
    if (env.GOOGLE_APPLICATION_CREDENTIALS || env.FIREBASE_SERVICE_ACCOUNT_PATH || env.FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS === 'true') throw new Error('Cloud credentials are forbidden in emulator mode.');
    config.authEmulatorHost = assertLoopbackHost(env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099', 'FIREBASE_AUTH_EMULATOR_HOST');
    config.firestoreEmulatorHost = assertLoopbackHost(env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080', 'FIRESTORE_EMULATOR_HOST');
    config.storageEmulatorHost = assertLoopbackHost(env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199', 'FIREBASE_STORAGE_EMULATOR_HOST');
    if (env.STORAGE_EMULATOR_HOST && env.STORAGE_EMULATOR_HOST !== `http://${config.storageEmulatorHost}`) throw new Error('STORAGE_EMULATOR_HOST must match the configured local storage emulator.');
  } else {
    if (env.ALLOW_PRODUCTION_FIREBASE !== 'true' || projectId.startsWith('demo-')) throw new Error('Cloud mode requires explicit ALLOW_PRODUCTION_FIREBASE=true and a non-demo project.');
    if (env.FIREBASE_AUTH_EMULATOR_HOST || env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_STORAGE_EMULATOR_HOST || env.STORAGE_EMULATOR_HOST) throw new Error('Emulator hosts are forbidden in cloud mode.');
    config.serviceAccountPath = env.FIREBASE_SERVICE_ACCOUNT_PATH;
    config.useApplicationDefaultCredentials = env.FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS === 'true';
    if (!config.serviceAccountPath && !config.useApplicationDefaultCredentials) throw new Error('Cloud credentials must be selected explicitly.');
  }
  return Object.freeze(config);
}
