import { cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');

const extraPages = [
  'feed.html',
  'ouija.html',
  'settings.html',
  'story-ritual.html',
  'tarot.html',
  'tts-api-test.html',
  'tts-diagnostic.html',
];

for (const page of extraPages) {
  await cp(path.join(rootDir, page), path.join(distDir, page), { force: true });
}

for (const target of ['lib', 'styles', 'output.css']) {
  await rm(path.join(distDir, target), { recursive: true, force: true });
}

await cp(path.join(rootDir, 'lib'), path.join(distDir, 'lib'), { recursive: true, force: true });
await cp(path.join(rootDir, 'styles'), path.join(distDir, 'styles'), { recursive: true, force: true });
await cp(path.join(rootDir, 'output.css'), path.join(distDir, 'output.css'), { force: true });

console.log('Copied static HTML/lib/styles/output.css to dist');
