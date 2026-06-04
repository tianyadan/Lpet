import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = resolve(projectRoot, 'electron/prompts');
const targetDir = resolve(projectRoot, 'dist-electron/prompts');

if (!existsSync(sourceDir)) {
  throw new Error(`Prompt directory does not exist: ${sourceDir}`);
}

mkdirSync(targetDir, { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true });
