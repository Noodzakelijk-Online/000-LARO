import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const RUNTIME_ROOTS = ['server', 'src-main', 'shared'];

function runtimeTypeScriptFiles(root: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...runtimeTypeScriptFiles(path));
    } else if (['.ts', '.tsx'].includes(extname(entry.name))) {
      files.push(path);
    }
  }

  return files;
}

describe('runtime TypeScript coverage', () => {
  it('does not disable type checking in shipped runtime modules', () => {
    const bypasses = RUNTIME_ROOTS.flatMap((relativeRoot) =>
      runtimeTypeScriptFiles(join(ROOT, relativeRoot))
        .filter((file) => readFileSync(file, 'utf8').includes('@ts-nocheck'))
        .map((file) => file.slice(ROOT.length + 1).replaceAll('\\', '/'))
    );

    expect(bypasses).toEqual([]);
  });
});
