import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(rootDir, 'src', 'lib');
const srcStylesDir = path.join(rootDir, 'src', 'styles');
const publicLibDir = path.join(rootDir, 'public', 'lib');
const rootLibDir = path.join(rootDir, 'lib');
const publicStylesDir = path.join(rootDir, 'public', 'styles');
const rootStylesDir = path.join(rootDir, 'styles');

for (const dir of [publicLibDir, rootLibDir, publicStylesDir, rootStylesDir]) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
}

await cp(srcDir, publicLibDir, { recursive: true });
await cp(srcDir, rootLibDir, { recursive: true });
await cp(srcStylesDir, publicStylesDir, { recursive: true });
await cp(srcStylesDir, rootStylesDir, { recursive: true });

console.log('Synced src/lib + src/styles -> root/public');
