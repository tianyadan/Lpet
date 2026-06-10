import { app, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const PET_SKIN_ROOT_NAME = 'pet-skins';

export interface ImportedPetSkin {
  id: string;
  displayName: string;
  description: string;
  spritesheetUrl: string;
  source: 'imported';
  directoryPath: string;
}

function getImportedSkinRoot(): string {
  return path.join(app.getPath('userData'), PET_SKIN_ROOT_NAME);
}

function sanitizeSkinDirectoryName(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || `skin-${Date.now()}`;
}

function getImageMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.png') {
    return 'image/png';
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg';
  }
  if (extension === '.gif') {
    return 'image/gif';
  }
  return 'image/webp';
}

function readImageDataUrl(filePath: string): string {
  const mimeType = getImageMimeType(filePath);
  const imageData = fs.readFileSync(filePath).toString('base64');
  return `data:${mimeType};base64,${imageData}`;
}

function normalizeImportedSkinDirectory(directoryPath: string): ImportedPetSkin | null {
  const petJsonPath = path.join(directoryPath, 'pet.json');
  if (!fs.existsSync(petJsonPath)) {
    return null;
  }

  try {
    const rawDefinition = JSON.parse(fs.readFileSync(petJsonPath, 'utf8')) as Record<string, unknown>;
    const rawId = typeof rawDefinition.id === 'string' && rawDefinition.id.trim()
      ? rawDefinition.id.trim()
      : path.basename(directoryPath);
    const spritesheetPath =
      typeof rawDefinition.spritesheetPath === 'string' && rawDefinition.spritesheetPath.trim()
        ? rawDefinition.spritesheetPath.trim()
        : 'spritesheet.webp';
    const spritesheetFilePath = path.join(directoryPath, spritesheetPath);
    if (!fs.existsSync(spritesheetFilePath)) {
      return null;
    }

    return {
      id: `imported:${sanitizeSkinDirectoryName(rawId)}`,
      displayName:
        typeof rawDefinition.displayName === 'string' && rawDefinition.displayName.trim()
          ? rawDefinition.displayName.trim()
          : rawId,
      description:
        typeof rawDefinition.description === 'string' && rawDefinition.description.trim()
          ? rawDefinition.description.trim()
          : 'Imported Codex-compatible pet skin.',
      // WHY：开发模式渲染页是 http://127.0.0.1，直接加载 file:// 皮肤图会被浏览器安全策略拦截。
      spritesheetUrl: readImageDataUrl(spritesheetFilePath),
      source: 'imported',
      directoryPath,
    };
  } catch {
    return null;
  }
}

export function listImportedPetSkins(): ImportedPetSkin[] {
  const skinRoot = getImportedSkinRoot();
  if (!fs.existsSync(skinRoot)) {
    return [];
  }

  return fs
    .readdirSync(skinRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => normalizeImportedSkinDirectory(path.join(skinRoot, entry.name)))
    .filter((skin): skin is ImportedPetSkin => Boolean(skin))
    .sort((left, right) => left.displayName.localeCompare(right.displayName, 'zh-Hans-CN'));
}

export async function importPetSkinFromFolder(): Promise<ImportedPetSkin | null> {
  const result = await dialog.showOpenDialog({
    title: '选择 Codex 适配皮肤文件夹',
    properties: ['openDirectory'],
    message: '请选择包含 pet.json 和 spritesheet.webp 的皮肤父文件夹。',
  });
  if (result.canceled || !result.filePaths[0]) {
    return null;
  }

  const sourceDirectory = result.filePaths[0];
  const sourceSkin = normalizeImportedSkinDirectory(sourceDirectory);
  if (!sourceSkin) {
    throw new Error('导入失败：请选择包含 pet.json 和 spritesheet.webp 的 Codex 适配皮肤文件夹。');
  }

  const skinRoot = getImportedSkinRoot();
  fs.mkdirSync(skinRoot, { recursive: true });
  const destinationDirectory = path.join(skinRoot, sanitizeSkinDirectoryName(sourceSkin.id.replace(/^imported:/, '')));
  if (path.resolve(sourceDirectory) !== path.resolve(destinationDirectory)) {
    fs.rmSync(destinationDirectory, { recursive: true, force: true });
    fs.cpSync(sourceDirectory, destinationDirectory, { recursive: true });
  }

  const importedSkin = normalizeImportedSkinDirectory(destinationDirectory);
  if (!importedSkin) {
    throw new Error('导入失败：复制后的皮肤文件不完整。');
  }

  return importedSkin;
}
