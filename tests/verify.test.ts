import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { verifyData, verifyStories, type Offering, type Source, type StoriesData } from '../scripts/verify';

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

    // Also assert source CSV matches its SHA-256
    const sourceCsvRel = 'source/programs_offered_table_all_254_rows.csv';
    const sourceCsvPath = path.join(dataDir, sourceCsvRel);
    expect(fs.existsSync(sourceCsvPath)).toBe(true);
    const sourceCsvContent = fs.readFileSync(sourceCsvPath);
    const actualCsvHash = crypto.createHash('sha256').update(sourceCsvContent).digest('hex');
    expect(actualCsvHash).toBe(storedHashes[sourceCsvRel]);

    // Also assert evidence/lighthouse.json matches its SHA-256
    const lighthouseRel = 'evidence/lighthouse.json';
    const lighthousePath = path.join(dataDir, lighthouseRel);
    expect(fs.existsSync(lighthousePath)).toBe(true);
    const lighthouseContent = fs.readFileSync(lighthousePath);
    const actualLhHash = crypto.createHash('sha256').update(lighthouseContent).digest('hex');
    expect(actualLhHash).toBe(storedHashes[lighthouseRel]);
  });

  it('fails if any data file SHA-256 differs from data/HASHES.json', () => {
    const storedHashes: Record<string, string> = JSON.parse(fs.readFileSync(hashesPath, 'utf-8'));
    const dataFiles = [
      'offerings.m1.json',
      'offerings.json',
      'sources.json',
      'synonyms.json',
      'tags.json',
      'programmes.json',
      'stories.json',
      'apply_routes.json',
      'source/programs_offered_table_all_254_rows.csv',
      'evidence/lighthouse.json'
    ];

    for (const file of dataFiles) {
      const filePath = path.join(dataDir, file);
      const content = fs.readFileSync(filePath);
      const mutated = Buffer.concat([content, Buffer.from(' ')]);
      const mutatedHash = crypto.createHash('sha256').update(mutated).digest('hex');

      expect(mutatedHash).not.toBe(storedHashes[file]);
    }
  });
});

function parseCsv(content: string): Array<Record<string, string>> {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let entry = '';

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    const next = content[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        entry += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(entry);
      entry = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      row.push(entry);
      if (row.some((cell) => cell.length > 0)) {
        lines.push(row);
      }
      row = [];
      entry = '';
    } else {
      entry += c;
    }
  }
  if (entry || row.length > 0) {
    row.push(entry);
    if (row.some((cell) => cell.length > 0)) {
      lines.push(row);
    }
  }

  const [header, ...dataRows] = lines;
  return dataRows.map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      obj[h.trim()] = (r[idx] ?? '').trim();
    });
    return obj;
  });
}

describe('Raw Source Table Audit (data/source/programs_offered_table_all_254_rows.csv)', () => {
  it('cross-verifies all 106 offerings against raw source table rows', () => {
    const csvPath = path.resolve(__dirname, '../data/source/programs_offered_table_all_254_rows.csv');
    expect(fs.existsSync(csvPath)).toBe(true);

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const rows = parseCsv(csvContent);

    const offeringsPath = path.resolve(__dirname, '../data/offerings.json');
    const offerings: Offering[] = JSON.parse(fs.readFileSync(offeringsPath, 'utf-8'));
    expect(offerings).toHaveLength(106);

    let conflicts = 0;
    let verified = 0;

    for (const off of offerings) {
      const campusCode = off.campus_code;
      const programme = off.programme;

      // Extract exact Branch text from locator e.g. Branch='...' or match programme
      const locMatch = off.annual_fee?.locator?.match(/Branch='([^']+)'/);
      const exactBranch = locMatch ? locMatch[1] : programme;

      const matches = rows.filter(
        (r) =>
          r['Campus'] === campusCode &&
          r['Degree'].replace(/\s+/g, '') === 'B.Tech' &&
          r['Program Type'] === 'Full Time' &&
          (r['Branch With Specialization'] === exactBranch ||
            r['Branch With Specialization'].replace(' ###', '') === programme)
      );

      expect(matches).toHaveLength(1);
      const row = matches[0];

      // Assert fee matches
      const csvFee = parseInt(row['Annual Fees'].replace(/[,#\s]/g, ''), 10);
      expect(off.annual_fee.value).toBe(csvFee);

      // Assert intake matches
      const csvIntake = row['Intake'] ? parseInt(row['Intake'].replace(/[,#\s]/g, ''), 10) : null;
      const offIntake = off.intake ? off.intake.value : null;
      expect(offIntake).toBe(csvIntake);

      // Assert duration matches
      const csvDuration = parseInt(row['Duration (Years)'].replace(/[,#\s]/g, ''), 10);
      expect(off.duration.value).toBe(csvDuration);

      // Assert department matches
      const csvDept = row['Dept'] || null;
      const offDept = off.department ? off.department.value : null;
      expect(offDept).toBe(csvDept);

      // Assert eligibility status is 'conflict' iff row's Eligibility cell is non-empty
      const csvElig = row['Eligibility'];
      if (csvElig && csvElig.length > 0) {
        expect(off.eligibility.status).toBe('conflict');
        conflicts++;
      } else {
        expect(off.eligibility.status).toBe('verified');
        verified++;
      }
    }

    expect(conflicts).toBe(75);
    expect(verified).toBe(31);
  });
});

describe('M6 Stories Verification Suite (stories.json & programmes.json)', () => {
  const storiesPath = path.resolve(__dirname, '../data/stories.json');
  const programmesPath = path.resolve(__dirname, '../data/programmes.json');

  const realStoriesData: StoriesData = JSON.parse(fs.readFileSync(storiesPath, 'utf-8'));
  const realProgrammesData = JSON.parse(fs.readFileSync(programmesPath, 'utf-8'));

  function cloneStoriesData(): StoriesData {
    return JSON.parse(JSON.stringify(realStoriesData));
  }

  it('verifies that pristine real stories.json passes verification with zero errors', () => {
    const result = verifyStories(realStoriesData, realProgrammesData);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('contains exactly 7 stories in stories.json', () => {
    expect(realStoriesData.stories).toHaveLength(7);
  });

  it('contains exactly 6 sources in stories.json (B1, B2, C1, C2, C3, C4)', () => {
    expect(realStoriesData.sources).toHaveLength(6);
    expect(realStoriesData.sources.map((s) => s.id)).toEqual(['B1', 'B2', 'C1', 'C2', 'C3', 'C4']);
  });

  it('verifies programmes with stories are exactly mechanical-engineering, automobile-engineering, mechatronics-engineering, electronics-and-communication-engineering', () => {
    const tiedSlugs = new Set<string>();
    for (const story of realStoriesData.stories) {
      for (const slug of story.programme_slugs) {
        tiedSlugs.add(slug);
      }
    }
    const expected = [
      'mechanical-engineering',
      'automobile-engineering',
      'mechatronics-engineering',
      'electronics-and-communication-engineering'
    ];
    expect(Array.from(tiedSlugs).sort()).toEqual(expected.sort());
  });

  it('verifies story counts per programme: mechanical 1 story, automobile 2, mechatronics 3, ECE 2', () => {
    const progCounts: Record<string, number> = {
      'mechanical-engineering': 0,
      'automobile-engineering': 0,
      'mechatronics-engineering': 0,
      'electronics-and-communication-engineering': 0
    };
    for (const story of realStoriesData.stories) {
      for (const slug of story.programme_slugs) {
        if (slug in progCounts) {
          progCounts[slug]++;
        }
      }
    }
    expect(progCounts['mechanical-engineering']).toBe(1);
    expect(progCounts['automobile-engineering']).toBe(2);
    expect(progCounts['mechatronics-engineering']).toBe(3);
    expect(progCounts['electronics-and-communication-engineering']).toBe(2);
  });

  it('fails when a story fact has no source_id', () => {
    const cloned = cloneStoriesData();
    // @ts-expect-error test mutation
    cloned.stories[0].facts[0].source_id = '';
    const result = verifyStories(cloned, realProgrammesData);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('source_id'))).toBe(true);
  });

  it('fails when a story fact references a source_id not found in stories.json sources', () => {
    const cloned = cloneStoriesData();
    cloned.stories[0].facts[0].source_id = 'NON_EXISTENT_SOURCE';
    const result = verifyStories(cloned, realProgrammesData);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('source_id') && e.message.includes('NON_EXISTENT_SOURCE'))).toBe(true);
  });

  it('fails when a story fact has no captured_on', () => {
    const cloned = cloneStoriesData();
    cloned.stories[0].facts[0].captured_on = '';
    const result = verifyStories(cloned, realProgrammesData);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('captured_on'))).toBe(true);
  });

  it('fails when a story programme_slug does not exist in programmes.json', () => {
    const cloned = cloneStoriesData();
    cloned.stories[0].programme_slugs.push('non-existent-programme-slug');
    const result = verifyStories(cloned, realProgrammesData);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'programme_slugs' && e.message.includes('non-existent-programme-slug'))).toBe(true);
  });

  it('fails when a story fact tier is neither sourced nor verified', () => {
    const cloned = cloneStoriesData();
    // @ts-expect-error test mutation
    cloned.stories[0].facts[0].tier = 'unverified';
    const result = verifyStories(cloned, realProgrammesData);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('tier'))).toBe(true);
  });
});

describe('M6 Campus Fee Ranges Computation Suite', () => {
  it('computes fee ranges across all campuses from offerings.json and asserts Baburayanpettai is 2,75,000 to 3,75,000', () => {
    const offeringsPath = path.resolve(__dirname, '../data/offerings.json');
    const offerings: Offering[] = JSON.parse(fs.readFileSync(offeringsPath, 'utf-8'));

    const campusFees = new Map<string, number[]>();
    for (const off of offerings) {
      const c = off.campus || off.campus_code;
      if (!campusFees.has(c)) {
        campusFees.set(c, []);
      }
      campusFees.get(c)!.push(off.annual_fee.value);
    }

    // Find Baburayanpettai entry (campus code BPR or campus name containing Baburayanpettai)
    const bprOfferings = offerings.filter(
      (o) => o.campus_code === 'BPR' || o.campus.toLowerCase().includes('baburayanpettai')
    );
    expect(bprOfferings.length).toBeGreaterThan(0);

    const bprFees = bprOfferings.map((o) => o.annual_fee.value);
    const minBprFee = Math.min(...bprFees);
    const maxBprFee = Math.max(...bprFees);

    expect(minBprFee).toBe(275000);
    expect(maxBprFee).toBe(375000);
  });
});

