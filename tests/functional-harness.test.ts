import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

describe('Stage A: Functional Test Harness (Search, Chips, Campuses, Sort, Compare, Apply Routes)', () => {
  it('executes functional test harness against live DOM with zero failures', () => {
    const harnessScript = path.resolve(__dirname, 'run-functional-harness.py');
    const res = spawnSync('python', [harnessScript], {
      encoding: 'utf-8',
      cwd: path.resolve(__dirname, '..'),
      timeout: 60000
    });

    if (res.status !== 0) {
      console.error('STDOUT:', res.stdout);
      console.error('STDERR:', res.stderr);
    }

    expect(res.status).toBe(0);

    const rawFile = path.resolve(__dirname, '../audit/raw/functional_harness_results.json');
    expect(fs.existsSync(rawFile)).toBe(true);

    const raw = JSON.parse(fs.readFileSync(rawFile, 'utf-8'));
    expect(raw.all_passed).toBe(true);
    expect(raw.failures.length).toBe(0);
    expect(raw.search_tests.length).toBe(11);
    expect(raw.chip_tests.length).toBe(8);
    expect(raw.campus_tests.length).toBe(6);
    expect(raw.sort_tests.length).toBe(2);
    expect(raw.compare_tests.length).toBe(4);
    expect(raw.apply_route_tests.length).toBe(8);
  }, 30000);
});
