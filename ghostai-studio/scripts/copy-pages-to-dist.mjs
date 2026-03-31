import { cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');

for (const page of ['feed.html', 'settings.html', 'tarot.html']) {
  await cp(path.join(rootDir, page), path.join(distDir, page), { force: true });
}

console.log('Copied extra HTML pages to dist');
