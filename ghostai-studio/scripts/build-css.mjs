import { spawn } from 'node:child_process';
import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(rootDir, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs');
const rootCssPath = path.join(rootDir, 'output.css');
const publicCssPath = path.join(rootDir, 'public', 'output.css');

const child = spawn(process.execPath, [cliPath, '-i', 'src/input.css', '-o', 'output.css'], {
  cwd: rootDir,
  stdio: 'inherit',
});

child.on('exit', async (code) => {
  if (code && code !== 0) {
    process.exit(code);
    return;
  }

  await mkdir(path.dirname(publicCssPath), { recursive: true });
  await cp(rootCssPath, publicCssPath, { force: true });
  process.exit(0);
});
