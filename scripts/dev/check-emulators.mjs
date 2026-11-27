import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

if (process.env.FIREBASE_PROJECT_ID !== 'demo-foodordernext' ||
    !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    !process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  throw new Error('Run with npm run test:emulator; only the local demo Emulator project is allowed.');
}
const tests = [];
for (const directory of ['tests/rules', 'tests/integration']) {
  for (const name of await readdir(directory)) {
    if (/\.test\.(?:mjs|js)$/.test(name)) tests.push(resolve(directory, name));
  }
}
if (!tests.length) throw new Error('No emulator tests found; refusing an empty successful test run.');
const child = spawn(process.execPath, ['--test', '--test-concurrency=1', ...tests], {
  stdio: 'inherit', env: { ...process.env, RUN_EMULATOR_TESTS: '1' },
});
child.once('error', error => { console.error(error.message); process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 1; });

