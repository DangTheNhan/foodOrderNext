import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this check through npm test.');
const packages = spawnSync(process.execPath, [npmCli, 'run', 'test', '--workspaces', '--if-present'], { stdio: 'inherit', cwd: root });
if (packages.status !== 0) process.exit(packages.status ?? 1);
const tests = [];
for (const directory of ['scripts/seed', 'scripts/migration']) {
  for (const name of readdirSync(directory)) {
    if (name.endsWith('.test.mjs')) tests.push(join(directory, name));
  }
}
if (!tests.length) throw new Error('Seed/migration safety checks are missing.');
const local = spawnSync(process.execPath, ['--test', ...tests], { stdio: 'inherit', cwd: root });
process.exitCode = local.status ?? 1;
