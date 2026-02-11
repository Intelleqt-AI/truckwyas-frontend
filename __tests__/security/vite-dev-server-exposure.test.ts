import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Vite dev server exposure (GHSA-67mh-4wv8-2f99)', () => {
  it('should bind dev server to localhost only, not all interfaces', () => {
    const viteConfigPath = path.resolve(__dirname, '../../vite.config.ts');
    const content = fs.readFileSync(viteConfigPath, 'utf-8');

    // Must NOT bind to all interfaces (:: or 0.0.0.0)
    expect(content).not.toMatch(/host:\s*["']\s*::\s*["']/);
    expect(content).not.toMatch(/host:\s*["']\s*0\.0\.0\.0\s*["']/);

    // Must bind to localhost
    const localhostPattern = /host:\s*["'](127\.0\.0\.1|localhost)["']/;
    expect(content).toMatch(localhostPattern);
  });

  it('should document esbuild GHSA-67mh-4wv8-2f99 as accepted dev-only risk', () => {
    const securityDocPath = path.resolve(__dirname, '../../SECURITY.md');
    expect(fs.existsSync(securityDocPath)).toBe(true);

    const content = fs.readFileSync(securityDocPath, 'utf-8');
    expect(content).toContain('GHSA-67mh-4wv8-2f99');
    expect(content.toLowerCase()).toContain('esbuild');
  });
});
