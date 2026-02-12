import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Regression test: ensures no console.log statements exist in source code.
 * This prevents sensitive data (auth tokens, user data) from being logged
 * and ensures production builds remain clean.
 */

function getAllSourceFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__') continue;
      getAllSourceFiles(fullPath, files);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('Console.log security', () => {
  it('should not contain console.log statements in source code', () => {
    const srcDir = path.resolve(__dirname, '../../');
    const files = getAllSourceFiles(srcDir);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        // Skip commented-out lines
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        if (/console\.log\s*\(/.test(line)) {
          const relativePath = path.relative(srcDir, file);
          violations.push(`${relativePath}:${index + 1}: ${trimmed}`);
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('should have ESLint no-console rule configured', () => {
    const eslintConfig = fs.readFileSync(
      path.resolve(__dirname, '../../../eslint.config.js'),
      'utf-8'
    );
    expect(eslintConfig).toContain('"no-console"');
  });

  it('should have Vite configured to drop console in production', () => {
    const viteConfig = fs.readFileSync(
      path.resolve(__dirname, '../../../vite.config.ts'),
      'utf-8'
    );
    expect(viteConfig).toContain("drop");
    expect(viteConfig).toContain("'console'");
  });
});
