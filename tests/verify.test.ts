import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { verifyData, type Offering, type Source } from '../scripts/verify';

// Load the pristine real data
const realOfferings: Offering[] = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../data/offerings.m1.json'), 'utf-8')
);

const realSources: Source[] = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../data/sources.json'), 'utf-8')
);

// Helper to deep clone real data
function cloneOfferings(): Offering[] {
  return JSON.parse(JSON.stringify(realOfferings));
}

function cloneSources(): Source[] {
  return JSON.parse(JSON.stringify(realSources));
}

describe('M0 Data Verification Suite (scripts/verify.ts)', () => {
  it('asserts that pristine real data passes verification with zero errors', () => {
    const result = verifyData(realOfferings, realSources);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('asserts that pristine 106-offering dataset (data/offerings.json) passes verification with zero errors', () => {
    const fullOfferingsPath = path.resolve(__dirname, '../data/offerings.json');
    expect(fs.existsSync(fullOfferingsPath)).toBe(true);
    const fullOfferings = JSON.parse(fs.readFileSync(fullOfferingsPath, 'utf-8'));
    const result = verifyData(fullOfferings, realSources);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(fullOfferings).toHaveLength(106);
  });

  it('fails when a fact has no source_id', () => {
    const offerings = cloneOfferings();
    const targetId = 'ktr-electrical-and-electronics-engineering';
    const target = offerings.find((o) => o.id === targetId)!;
    // @ts-expect-error planting intentional error
    delete target.annual_fee.source_id;

    const result = verifyData(offerings, realSources);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.id === targetId && e.field === 'annual_fee')).toBe(true);
  });

  it('fails when a fact has no captured_on', () => {
    const offerings = cloneOfferings();
    const targetId = 'rmp-electrical-and-electronics-engineering';
    const target = offerings.find((o) => o.id === targetId)!;
    // @ts-expect-error planting intentional error
    target.intake.captured_on = '';

    const result = verifyData(offerings, realSources);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.id === targetId && e.field === 'intake')).toBe(true);
  });

  it('fails when a source_id is not present in sources.json', () => {
    const offerings = cloneOfferings();
    const targetId = 'trichy-electrical-and-electronics-engineering';
    const target = offerings.find((o) => o.id === targetId)!;
    target.duration.source_id = 'S999_NON_EXISTENT';

    const result = verifyData(offerings, realSources);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.id === targetId && e.field === 'duration')).toBe(true);
  });

  it('fails when annual_fee is below 50,000 (lower boundary violation)', () => {
    const offerings = cloneOfferings();
    const targetId = 'ktr-computer-science-and-engineering';
    const target = offerings.find((o) => o.id === targetId)!;
    target.annual_fee.value = 49999;

    const result = verifyData(offerings, realSources);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.id === targetId && e.field === 'annual_fee')).toBe(true);
  });

  it('fails when annual_fee is above 600,000 (upper boundary violation)', () => {
    const offerings = cloneOfferings();
    const targetId = 'rmp-computer-science-and-engineering';
    const target = offerings.find((o) => o.id === targetId)!;
    target.annual_fee.value = 600001;

    const result = verifyData(offerings, realSources);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.id === targetId && e.field === 'annual_fee')).toBe(true);
  });

  it('fails when intake is not a positive integer (e.g. 0, negative, or decimal)', () => {
    const offerings = cloneOfferings();
    const targetId = 'ktr-automobile-engineering';
    const target = offerings.find((o) => o.id === targetId)!;
    target.intake.value = 0;

    const resultZero = verifyData(offerings, realSources);
    expect(resultZero.valid).toBe(false);
    expect(resultZero.errors.some((e) => e.id === targetId && e.field === 'intake')).toBe(true);

    target.intake.value = -10;
    const resultNeg = verifyData(offerings, realSources);
    expect(resultNeg.valid).toBe(false);
    expect(resultNeg.errors.some((e) => e.id === targetId && e.field === 'intake')).toBe(true);

    target.intake.value = 60.5;
    const resultFloat = verifyData(offerings, realSources);
    expect(resultFloat.valid).toBe(false);
    expect(resultFloat.errors.some((e) => e.id === targetId && e.field === 'intake')).toBe(true);
  });

  it('fails when duration is not a positive integer', () => {
    const offerings = cloneOfferings();
    const targetId = 'ktr-mechatronics-engineering';
    const target = offerings.find((o) => o.id === targetId)!;
    target.duration.value = -4;

    const result = verifyData(offerings, realSources);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.id === targetId && e.field === 'duration')).toBe(true);
  });

  it('allows a null department only if status is unverified and a note exists', () => {
    const offerings = cloneOfferings();
    const targetId = 'ktr-biotechnology';
    const target = offerings.find((o) => o.id === targetId)!;
    target.department = {
      value: null,
      status: 'unverified',
      note: 'Department not confirmed in official table',
      source_id: 'S1',
      captured_on: '2026-10-26'
    };

    const result = verifyData(offerings, realSources);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when a null department has verified status or is missing a note', () => {
    // Case 1: value is null, but status is verified
    const offerings1 = cloneOfferings();
    const targetId1 = 'ktr-biotechnology';
    const target1 = offerings1.find((o) => o.id === targetId1)!;
    target1.department = {
      value: null,
      status: 'verified',
      note: 'Some note',
      source_id: 'S1',
      captured_on: '2026-10-26'
    };
    const result1 = verifyData(offerings1, realSources);
    expect(result1.valid).toBe(false);
    expect(result1.errors.some((e) => e.id === targetId1 && e.field === 'department')).toBe(true);

    // Case 2: value is null, status is unverified, but note is missing or empty
    const offerings2 = cloneOfferings();
    const targetId2 = 'ktr-automobile-engineering';
    const target2 = offerings2.find((o) => o.id === targetId2)!;
    target2.department = {
      value: null,
      status: 'unverified',
      source_id: 'S1',
      captured_on: '2026-10-26'
    };
    const result2 = verifyData(offerings2, realSources);
    expect(result2.valid).toBe(false);
    expect(result2.errors.some((e) => e.id === targetId2 && e.field === 'department')).toBe(true);

    // Case 3: department is null directly without object wrapper
    const offerings3 = cloneOfferings();
    const targetId3 = 'ktr-mechatronics-engineering';
    const target3 = offerings3.find((o) => o.id === targetId3)!;
    target3.department = null;
    const result3 = verifyData(offerings3, realSources);
    expect(result3.valid).toBe(false);
    expect(result3.errors.some((e) => e.id === targetId3 && e.field === 'department')).toBe(true);
  });

  it('fails when offerings contain duplicate ids', () => {
    const offerings = cloneOfferings();
    const dup = cloneOfferings()[0];
    offerings.push(dup);

    const result = verifyData(offerings, realSources);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.id === dup.id && e.field === 'id')).toBe(true);
  });

  it('fails when status is not verified, conflict, or unverified', () => {
    const offerings = cloneOfferings();
    const targetId = 'ktr-biotechnology';
    const target = offerings.find((o) => o.id === targetId)!;
    // @ts-expect-error planting invalid status
    target.annual_fee.status = 'provisional';

    const result = verifyData(offerings, realSources);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.id === targetId && e.field === 'annual_fee')).toBe(true);
  });

  it('fails when a conflict fact has no conflicts_with', () => {
    const offerings = cloneOfferings();
    // ktr-electrical-and-electronics-engineering has an eligibility with status === 'conflict'
    const targetId = 'ktr-electrical-and-electronics-engineering';
    const target = offerings.find((o) => o.id === targetId)!;
    expect(target.eligibility.status).toBe('conflict');
    delete target.eligibility.conflicts_with;

    const result = verifyData(offerings, realSources);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.id === targetId && e.field === 'eligibility')).toBe(true);
  });
});

describe('Data File Integrity Suite (data/HASHES.json)', () => {
  const dataDir = path.resolve(__dirname, '../data');
  const hashesPath = path.resolve(dataDir, 'HASHES.json');

  it('asserts that every data file matches its SHA-256 in data/HASHES.json', () => {
    expect(fs.existsSync(hashesPath)).toBe(true);
    const storedHashes: Record<string, string> = JSON.parse(fs.readFileSync(hashesPath, 'utf-8'));

    const dataFiles = fs.readdirSync(dataDir).filter((f) => {
      const fullPath = path.join(dataDir, f);
      return f !== 'HASHES.json' && fs.statSync(fullPath).isFile();
    });

    expect(dataFiles.length).toBeGreaterThan(0);

    for (const file of dataFiles) {
      expect(storedHashes).toHaveProperty(file);
      const content = fs.readFileSync(path.join(dataDir, file));
      const actualHash = crypto.createHash('sha256').update(content).digest('hex');
      expect(actualHash).toBe(storedHashes[file]);
    }
  });

  it('fails if any data file SHA-256 differs from data/HASHES.json', () => {
    const storedHashes: Record<string, string> = JSON.parse(fs.readFileSync(hashesPath, 'utf-8'));
    const dataFiles = ['offerings.m1.json', 'offerings.json', 'sources.json'];

    for (const file of dataFiles) {
      const content = fs.readFileSync(path.join(dataDir, file));
      const mutated = Buffer.concat([content, Buffer.from(' ')]);
      const mutatedHash = crypto.createHash('sha256').update(mutated).digest('hex');

      expect(mutatedHash).not.toBe(storedHashes[file]);
    }
  });
});

