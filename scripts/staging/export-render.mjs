import { cp, mkdir, mkdtemp } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const work = join(root, 'work');
await mkdir(work, { recursive: true });
const bundle = await mkdtemp(join(work, 'render-staging-'));

const paths = ['.gitignore', '.npmrc', 'package.json', 'package-lock.json', 'render.yaml',
  'packages/contracts/package.json', 'packages/contracts/src', 'services/api/package.json', 'services/api/src'];
for (const path of paths) {
  const destination = join(bundle, path);
  await mkdir(dirname(destination), { recursive: true });
  await cp(join(root, path), destination, { recursive: true, errorOnExist: true, force: false });
}

console.log(bundle);
