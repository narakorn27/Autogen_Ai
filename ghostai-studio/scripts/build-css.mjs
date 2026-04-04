import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(rootDir, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs');

const child = spawn(process.execPath, [cliPath, '-i', 'src/input.css', '-o', 'output.css'], {
  cwd: rootDir,
  stdio: 'inherit',
});

child.on('exit', async (code) => {
  if (code && code !== 0) {
    process.exit(code);
    return;
  }
  process.exit(0);
});
