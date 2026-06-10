import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type LocalSkillSource = 'codex' | 'project' | 'agents';

export interface LocalSkill {
  id: string;
  name: string;
  description: string;
  entryPath: string;
  enabled: boolean;
  source: LocalSkillSource;
}

function parseSkillMetadata(entryPath: string): Pick<LocalSkill, 'name' | 'description'> {
  const fallbackName = path.basename(path.dirname(entryPath));

  try {
    const content = fs.readFileSync(entryPath, 'utf8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter = frontmatterMatch?.[1] ?? '';
    const name = frontmatter.match(/^name:\s*["']?(.+?)["']?\s*$/m)?.[1]?.trim() ?? fallbackName;
    const description =
      frontmatter.match(/^description:\s*["']?([\s\S]*?)["']?\s*$/m)?.[1]?.trim() ??
      content
        .split('\n')
        .find((line) => line.trim() && !line.startsWith('---') && !line.startsWith('#'))
        ?.trim() ??
      '';

    return {
      name,
      description: description.replace(/\s+/g, ' ').slice(0, 280),
    };
  } catch {
    return {
      name: fallbackName,
      description: '',
    };
  }
}

function listSkillEntryFiles(rootDir: string, maxDepth = 4): string[] {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const result: string[] = [];
  const visit = (currentDir: string, depth: number) => {
    if (depth > maxDepth) {
      return;
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isFile() && entry.name === 'SKILL.md') {
        result.push(entryPath);
        continue;
      }

      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
        visit(entryPath, depth + 1);
      }
    }
  };

  visit(rootDir, 0);
  return result;
}

export function listLocalSkills(): LocalSkill[] {
  const homeDir = os.homedir();
  const searchRoots: Array<{ dir: string; source: LocalSkillSource }> = [
    { dir: path.join(homeDir, '.codex', 'skills'), source: 'codex' },
    { dir: path.join(homeDir, '.agents', 'skills'), source: 'agents' },
    { dir: path.join(process.cwd(), 'skills'), source: 'project' },
  ];
  const seenPaths = new Set<string>();

  return searchRoots
    .flatMap(({ dir, source }) =>
      listSkillEntryFiles(dir).map((entryPath) => ({
        entryPath,
        source,
      })),
    )
    .filter(({ entryPath }) => {
      const normalizedPath = path.resolve(entryPath);
      if (seenPaths.has(normalizedPath)) {
        return false;
      }
      seenPaths.add(normalizedPath);
      return true;
    })
    .map<LocalSkill>(({ entryPath, source }) => {
      const metadata = parseSkillMetadata(entryPath);
      return {
        id: `${source}:${path.relative(source === 'project' ? process.cwd() : homeDir, entryPath)}`,
        name: metadata.name,
        description: metadata.description,
        entryPath,
        enabled: true,
        source,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'));
}
