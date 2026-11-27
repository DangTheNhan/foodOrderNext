import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cli = resolve(root, 'node_modules/firebase-tools/lib/bin/firebase.js');
const benchmark = process.argv[2] === '--benchmark';
const command = benchmark ? 'node scripts/performance/local.mjs' : 'node scripts/dev/check-emulators.mjs';
const project = benchmark ? 'demo-foodordernext-p08' : 'demo-foodordernext';
const isolated = benchmark || process.argv[2] === '--isolated';
let configPath;
if (isolated) {
  const config = JSON.parse(await readFile(resolve(root, 'firebase.json'), 'utf8'));
  const emulators = ['auth', 'firestore', 'storage', 'hub', 'logging'];
  const reservations = emulators.map(() => createServer());
  try {
    await Promise.all(reservations.map(server => {
      server.listen(0, '127.0.0.1');
      return once(server, 'listening');
    }));
    for (const [index, name] of emulators.entries()) {
      config.emulators[name] = { host: '127.0.0.1', port: reservations[index].address().port };
    }
  } finally {
    await Promise.all(reservations.map(server => new Promise(resolve => server.close(resolve))));
  }
  config.emulators.ui.enabled = false;
  const target = resolve(root, '.firebase-local-' + randomUUID() + '.json');
  await writeFile(target, JSON.stringify(config), { flag: 'wx' });
  configPath = target;
}

try {
  const args = [cli, 'emulators:exec', '--project', project,
    ...(configPath ? ['--config', configPath] : []), '--only', 'auth,firestore,storage', command];
  const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      FIREBASE_EMULATORS_PATH: resolve(root, '.cache/firebase/emulators'),
      XDG_CONFIG_HOME: resolve(root, '.cache/config'),
      CI: 'true',
      NO_UPDATE_NOTIFIER: '1',
      GCLOUD_PROJECT: project,
      GOOGLE_CLOUD_PROJECT: project,
      FIREBASE_PROJECT_ID: project,
      FOODORDER_EMULATOR_ISOLATED: isolated ? '1' : '0',
      [benchmark ? 'RUN_LOCAL_BENCHMARK' : 'RUN_EMULATOR_TESTS']: '1',
    },
  });
  const [code] = await once(child, 'exit');
  process.exitCode = code ?? 1;
} finally {
  if (configPath) await unlink(configPath);
}

