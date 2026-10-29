import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

describe('Stage M7-fix-2: Full-Site Axe Accessibility Suite', () => {
  const distDir = path.resolve(__dirname, '../dist');
  const runnerScript = path.resolve(__dirname, 'run-axe.py');

  it('verifies dist directory exists with all 62 built pages', () => {
    expect(fs.existsSync(distDir)).toBe(true);

    const getHtmlFiles = (dir: string): string[] => {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results = results.concat(getHtmlFiles(fullPath));
        } else if (file.endsWith('.html')) {
          results.push(fullPath);
        }
      }
      return results;
    };

    const htmlFiles = getHtmlFiles(distDir);
    expect(htmlFiles.length).toBe(62);
  });

  it('runs axe on every built page in both light and dark themes at 360 and 1440 px and fails on any violation', () => {
    // Execute python axe runner script
    const result = spawnSync('python', [runnerScript], {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
      timeout: 120000
    });

    if (result.status !== 0) {
      console.error('Axe runner stdout:', result.stdout);
      console.error('Axe runner stderr:', result.stderr);
    }

    expect(result.status).toBe(0);

    const report = JSON.parse(result.stdout);
    expect(report.pages_count).toBe(62);
    expect(report.total_audits).toBe(248); // 62 pages * 2 themes * 2 viewports
    expect(report.violations_count).toBe(0);
    expect(report.violations).toEqual([]);
  }, 120000);
});
