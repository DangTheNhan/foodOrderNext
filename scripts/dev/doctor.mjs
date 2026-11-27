import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const executable = process.platform === 'win32' ? '.exe' : '';
const [major, minor] = process.versions.node.split('.').map(Number);
const checks = [
  ['Node >=22.11', major > 22 || (major === 22 && minor >= 11), process.versions.node],
  ['API dependencies', existsSync(join(root, 'node_modules/firebase-admin/package.json')), 'npm install'],
  ['Mobile dependencies', existsSync(join(root, 'apps/mobile/node_modules/react-native/package.json')), 'cd apps/mobile; npm install'],
  ['JAVA_HOME', !!process.env.JAVA_HOME && existsSync(process.env.JAVA_HOME), process.env.JAVA_HOME ?? 'not set'],
  ['ANDROID_HOME', !!process.env.ANDROID_HOME && existsSync(process.env.ANDROID_HOME), process.env.ANDROID_HOME ?? 'not set'],
];
for (const [label, ok, detail] of checks) console.log(`${ok ? 'OK' : 'MISSING'} ${label}: ${detail}`);
if (process.env.JAVA_HOME) {
  const java = spawnSync(join(process.env.JAVA_HOME, 'bin', `java${executable}`), ['-version'], { encoding: 'utf8', timeout: 8000 });
  console.log(java.error ? `Java check: ${java.error.message}` : (java.stderr || java.stdout).trim());
}
if (process.env.ANDROID_HOME) {
  const adb = spawnSync(join(process.env.ANDROID_HOME, 'platform-tools', `adb${executable}`), ['devices', '-l'], { encoding: 'utf8', timeout: 8000 });
  console.log(adb.error ? `ADB check: ${adb.error.message}` : adb.stdout.trim());
}
console.log('Local project: demo-foodordernext. Emulator does not verify real FCM/Performance/AI integrations.');
process.exitCode = checks.every(([, ok]) => ok) ? 0 : 1;
