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

  it('fails when department is null (null object or null value)', () => {
    const offerings1 = cloneOfferings();
    const targetId1 = 'ktr-biotechnology';
    const target1 = offerings1.find((o) => o.id === targetId1)!;
    target1.department = null;

    const result1 = verifyData(offerings1, realSources);
    expect(result1.valid).toBe(false);
    expect(result1.errors.some((e) => e.id === targetId1 && e.field === 'department')).toBe(true);

    const offerings2 = cloneOfferings();
    const targetId2 = 'ktr-automobile-engineering';
    const target2 = offerings2.find((o) => o.id === targetId2)!;
    // @ts-expect-error planting intentional null value
    target2.department.value = null;

    const result2 = verifyData(offerings2, realSources);
    expect(result2.valid).toBe(false);
    expect(result2.errors.some((e) => e.id === targetId2 && e.field === 'department')).toBe(true);
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

describe('Data Hash Integrity Guard', () => {
  it('asserts that data/offerings.m1.json matches stored cryptographic hash in src/data-hash.json', () => {
    const rawOfferings = fs.readFileSync(path.resolve(__dirname, '../data/offerings.m1.json'));
    const actualHash = crypto.createHash('sha256').update(rawOfferings).digest('hex');
    const storedHashes = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../src/data-hash.json'), 'utf-8')
    );
    expect(actualHash).toBe(storedHashes['offerings.m1.json'].sha256);
  });

  it('asserts that data/sources.json matches stored cryptographic hash in src/data-hash.json', () => {
    const rawSources = fs.readFileSync(path.resolve(__dirname, '../data/sources.json'));
    const actualHash = crypto.createHash('sha256').update(rawSources).digest('hex');
    const storedHashes = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../src/data-hash.json'), 'utf-8')
    );
    expect(actualHash).toBe(storedHashes['sources.json'].sha256);
  });

  it('fails if any byte of offerings.m1.json is mutated without updating the stored hash', () => {
    const rawOfferings = fs.readFileSync(path.resolve(__dirname, '../data/offerings.m1.json'), 'utf-8');
    const mutated = rawOfferings.replace('"annual_fee"', '"fee"');
    const mutatedHash = crypto.createHash('sha256').update(mutated).digest('hex');
    const storedHashes = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../src/data-hash.json'), 'utf-8')
    );
    expect(mutatedHash).not.toBe(storedHashes['offerings.m1.json'].sha256);
  });
});

