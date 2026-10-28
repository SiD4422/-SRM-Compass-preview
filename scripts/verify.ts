import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Source {
  id: string;
  title: string;
  url: string;
  kind?: string;
  captured_on?: string;
  note?: string;
}

export interface Fact<T = unknown> {
  value: T;
  unit?: string;
  status: 'verified' | 'conflict' | 'unverified' | string;
  source_id: string;
  captured_on: string;
  locator?: string;
  conflicts_with?: {
    source_id: string;
    value: unknown;
  };
}

export interface Offering {
  id: string;
  programme: string;
  campus_code: string;
  campus: string;
  degree: string;
  program_type: string;
  annual_fee: Fact<number>;
  intake: Fact<number>;
  duration: Fact<number>;
  department: Fact<string> | null;
  eligibility: Fact<string>;
  [key: string]: unknown;
}

export interface ValidationError {
  id: string;
  field: string;
  message: string;
}

export interface VerificationResult {
  valid: boolean;
  errors: ValidationError[];
}

export const ALLOWED_STATUSES = new Set(['verified', 'conflict', 'unverified']);
export const FACT_FIELDS = ['annual_fee', 'intake', 'duration', 'department', 'eligibility'] as const;

export interface StoryFact {
  text: string;
  source_id: string;
  captured_on: string;
  tier: 'sourced' | 'verified';
}

export interface StorySource {
  id: string;
  title: string;
  url: string;
  kind?: string;
  captured_on?: string;
  note?: string;
}

export interface Story {
  id: string;
  title: string;
  kind: string;
  programme_slugs: string[];
  link_basis: string;
  facts: StoryFact[];
}

export interface StoriesData {
  note?: string;
  sources: StorySource[];
  stories: Story[];
}

export interface ProgrammeEntry {
  slug: string;
  name: string;
  [key: string]: unknown;
}

/**
 * Pure verification function that validates stories against stories.json sources and programmes.json slugs.
 */
export function verifyStories(storiesData: unknown, programmesData: unknown): VerificationResult {
  const errors: ValidationError[] = [];

  if (!storiesData || typeof storiesData !== 'object') {
    return {
      valid: false,
      errors: [{ id: 'ROOT', field: 'storiesData', message: 'stories data is not an object' }]
    };
  }

  const sData = storiesData as Partial<StoriesData>;
  if (!Array.isArray(sData.sources)) {
    return {
      valid: false,
      errors: [{ id: 'ROOT', field: 'sources', message: 'stories sources must be an array' }]
    };
  }

  if (!Array.isArray(sData.stories)) {
    return {
      valid: false,
      errors: [{ id: 'ROOT', field: 'stories', message: 'stories list must be an array' }]
    };
  }

  let progList: unknown[] = [];
  if (Array.isArray(programmesData)) {
    progList = programmesData;
  } else if (programmesData && typeof programmesData === 'object' && Array.isArray((programmesData as { programmes?: unknown[] }).programmes)) {
    progList = (programmesData as { programmes: unknown[] }).programmes;
  } else {
    return {
      valid: false,
      errors: [{ id: 'ROOT', field: 'programmesData', message: 'programmes data must be an array or contain a programmes array' }]
    };
  }

  const validSourceIds = new Set<string>();
  for (const src of sData.sources) {
    if (src && typeof src === 'object' && typeof src.id === 'string' && src.id.trim() !== '') {
      validSourceIds.add(src.id);
    }
  }

  const validProgrammeSlugs = new Set<string>();
  for (const prog of progList) {
    if (prog && typeof prog === 'object' && 'slug' in prog && typeof (prog as ProgrammeEntry).slug === 'string') {
      validProgrammeSlugs.add((prog as ProgrammeEntry).slug);
    }
  }

  const seenStoryIds = new Set<string>();

  for (const storyItem of sData.stories) {
    if (!storyItem || typeof storyItem !== 'object') {
      errors.push({ id: 'UNKNOWN', field: 'story', message: 'Story entry must be an object' });
      continue;
    }

    const story = storyItem as Partial<Story>;
    const storyId = typeof story.id === 'string' && story.id.trim() !== '' ? story.id : 'UNKNOWN_STORY_ID';

    if (seenStoryIds.has(storyId)) {
      errors.push({ id: storyId, field: 'id', message: `Duplicate story id: '${storyId}'` });
    } else {
      seenStoryIds.add(storyId);
    }

    // Check programme_slugs: every programme_slug must exist in programmes.json
    if (!Array.isArray(story.programme_slugs)) {
      errors.push({ id: storyId, field: 'programme_slugs', message: 'programme_slugs must be an array' });
    } else {
      for (const slug of story.programme_slugs) {
        if (!validProgrammeSlugs.has(slug)) {
          errors.push({
            id: storyId,
            field: 'programme_slugs',
            message: `Story programme_slug '${slug}' does not exist in programmes.json`
          });
        }
      }
    }

    // Check facts
    if (!Array.isArray(story.facts)) {
      errors.push({ id: storyId, field: 'facts', message: 'facts must be an array' });
    } else {
      story.facts.forEach((fact, idx) => {
        const factField = `facts[${idx}]`;
        if (!fact || typeof fact !== 'object') {
          errors.push({ id: storyId, field: factField, message: 'fact must be an object' });
          return;
        }

        // Rule 1: every story fact has a source_id found in stories.json sources and a captured_on
        if (!fact.source_id || typeof fact.source_id !== 'string' || fact.source_id.trim() === '') {
          errors.push({ id: storyId, field: `${factField}.source_id`, message: 'Story fact has no source_id' });
        } else if (!validSourceIds.has(fact.source_id)) {
          errors.push({
            id: storyId,
            field: `${factField}.source_id`,
            message: `Story fact references unknown source_id '${fact.source_id}' not found in stories.json sources`
          });
        }

        if (!fact.captured_on || typeof fact.captured_on !== 'string' || fact.captured_on.trim() === '') {
          errors.push({ id: storyId, field: `${factField}.captured_on`, message: 'Story fact has no captured_on' });
        }

        // Rule 2: tier must be 'sourced' or 'verified'
        if (fact.tier !== 'sourced' && fact.tier !== 'verified') {
          errors.push({
            id: storyId,
            field: `${factField}.tier`,
            message: `Story fact has invalid tier '${fact.tier}'. Tier must be 'sourced' or 'verified'`
          });
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Pure verification function that validates offerings against verification rules.
 */
export function verifyData(offerings: unknown[], sources: unknown[]): VerificationResult {
  const errors: ValidationError[] = [];

  const validSourceIds = new Set<string>();
  if (Array.isArray(sources)) {
    for (const src of sources) {
      if (src && typeof src === 'object' && 'id' in src && typeof (src as Source).id === 'string') {
        validSourceIds.add((src as Source).id);
      }
    }
  }

  if (!Array.isArray(offerings)) {
    return {
      valid: false,
      errors: [{ id: 'ROOT', field: 'offerings', message: 'offerings data is not an array' }]
    };
  }

  const seenIds = new Set<string>();

  for (const item of offerings) {
    if (!item || typeof item !== 'object') {
      errors.push({ id: 'UNKNOWN', field: 'offering', message: 'Offering entry must be an object' });
      continue;
    }

    const offering = item as Partial<Offering>;
    const id = typeof offering.id === 'string' && offering.id.trim() !== '' ? offering.id : 'UNKNOWN_ID';

    // Check for duplicate ids
    if (seenIds.has(id)) {
      errors.push({
        id,
        field: 'id',
        message: `Duplicate offering id: '${id}'`
      });
    } else {
      seenIds.add(id);
    }

    // Rule 5: a null department is allowed only if status is 'unverified' and a note exists
    const dept = offering.department;
    const isDeptNull = dept === null || (typeof dept === 'object' && dept !== null && (dept.value === null || dept.value === undefined));

    if (isDeptNull) {
      const isFactObj = typeof dept === 'object' && dept !== null;
      const hasUnverifiedStatus = isFactObj && dept.status === 'unverified';
      const hasNote = isFactObj && typeof (dept as { note?: string }).note === 'string' && ((dept as { note?: string }).note || '').trim() !== '';

      if (!hasUnverifiedStatus || !hasNote) {
        errors.push({
          id,
          field: 'department',
          message: 'Null department is allowed only if status is unverified and a note exists'
        });
      }
    }

    // Inspect each fact field
    for (const factField of FACT_FIELDS) {
      const fact = offering[factField] as Partial<Fact> | null | undefined;

      // If department is null:
      if (factField === 'department' && isDeptNull) {
        if (typeof fact === 'object' && fact !== null) {
          if (!fact.source_id || typeof fact.source_id !== 'string' || fact.source_id.trim() === '') {
            errors.push({
              id,
              field: 'department',
              message: "Fact 'department' has no source_id"
            });
          }
          if (!fact.captured_on || typeof fact.captured_on !== 'string' || fact.captured_on.trim() === '') {
            errors.push({
              id,
              field: 'department',
              message: "Fact 'department' has no captured_on"
            });
          }
          if (fact.source_id && !validSourceIds.has(fact.source_id)) {
            errors.push({
              id,
              field: 'department',
              message: `Fact 'department' references unknown source_id '${fact.source_id}' not in sources.json`
            });
          }
        }
        continue;
      }

      if (!fact || typeof fact !== 'object') {
        errors.push({
          id,
          field: factField,
          message: `Fact '${factField}' is missing or not an object`
        });
        continue;
      }

      // Rule 1: a fact has no source_id or captured_on
      if (!fact.source_id || typeof fact.source_id !== 'string' || fact.source_id.trim() === '') {
        errors.push({
          id,
          field: factField,
          message: `Fact '${factField}' has no source_id`
        });
      }

      if (!fact.captured_on || typeof fact.captured_on !== 'string' || fact.captured_on.trim() === '') {
        errors.push({
          id,
          field: factField,
          message: `Fact '${factField}' has no captured_on`
        });
      }

      // Rule 2: a source_id is not in sources.json
      if (fact.source_id && !validSourceIds.has(fact.source_id)) {
        errors.push({
          id,
          field: factField,
          message: `Fact '${factField}' references unknown source_id '${fact.source_id}' not in sources.json`
        });
      }

      // Rule 6: a status is not verified/conflict/unverified
      if (!fact.status || !ALLOWED_STATUSES.has(fact.status)) {
        errors.push({
          id,
          field: factField,
          message: `Fact '${factField}' has invalid status '${fact.status}'. Allowed: verified, conflict, unverified`
        });
      }

      // Rule 7: a conflict fact has no conflicts_with
      if (fact.status === 'conflict') {
        if (!fact.conflicts_with || typeof fact.conflicts_with !== 'object' || Object.keys(fact.conflicts_with).length === 0) {
          errors.push({
            id,
            field: factField,
            message: `Conflict fact '${factField}' has no conflicts_with`
          });
        }
      }
    }

    // Rule 3: annual_fee is outside 50000-600000
    const annualFeeVal = offering.annual_fee?.value;
    if (typeof annualFeeVal !== 'number' || isNaN(annualFeeVal) || annualFeeVal < 50000 || annualFeeVal > 600000) {
      errors.push({
        id,
        field: 'annual_fee',
        message: `annual_fee ${annualFeeVal} is outside allowable range 50000-600000`
      });
    }

    // Rule 4: intake or duration is not a positive integer
    const intakeVal = offering.intake?.value;
    if (typeof intakeVal !== 'number' || !Number.isInteger(intakeVal) || intakeVal <= 0) {
      errors.push({
        id,
        field: 'intake',
        message: `intake value '${intakeVal}' is not a positive integer`
      });
    }

    const durationVal = offering.duration?.value;
    if (typeof durationVal !== 'number' || !Number.isInteger(durationVal) || durationVal <= 0) {
      errors.push({
        id,
        field: 'duration',
        message: `duration value '${durationVal}' is not a positive integer`
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * CLI execution handler
 */
export function runCli(customOfferingsPath?: string, customSourcesPath?: string): number {
  const baseDir = process.cwd();
  const sourcesPath = customSourcesPath ?? path.resolve(baseDir, 'data', 'sources.json');

  if (!fs.existsSync(sourcesPath)) {
    console.error(`[VERIFY ERROR] Sources file not found: ${sourcesPath}`);
    return 1;
  }

  let sources: unknown[];
  try {
    sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf-8'));
  } catch (e) {
    console.error(`[VERIFY ERROR] Failed to parse sources JSON at ${sourcesPath}:`, e);
    return 1;
  }

  const offeringsPaths = customOfferingsPath
    ? [customOfferingsPath]
    : [
        path.resolve(baseDir, 'data', 'offerings.m1.json'),
        path.resolve(baseDir, 'data', 'offerings.json')
      ].filter((p) => fs.existsSync(p));

  if (offeringsPaths.length === 0) {
    console.error(`[VERIFY ERROR] No offerings files found in ${path.resolve(baseDir, 'data')}`);
    return 1;
  }

  let totalErrors = 0;
  for (const offPath of offeringsPaths) {
    let offerings: unknown[];
    try {
      offerings = JSON.parse(fs.readFileSync(offPath, 'utf-8'));
    } catch (e) {
      console.error(`[VERIFY ERROR] Failed to parse offerings JSON at ${offPath}:`, e);
      return 1;
    }

    const result = verifyData(offerings, sources);
    const relPath = path.relative(baseDir, offPath);

    if (!result.valid) {
      console.error(`\n❌ VERIFICATION FAILED for ${relPath}: Found ${result.errors.length} error(s):\n`);
      for (const err of result.errors) {
        console.error(`  - Offending ID: "${err.id}" | Offending Field: "${err.field}" | Reason: ${err.message}`);
      }
      console.error('');
      totalErrors += result.errors.length;
    } else {
      console.log(`\n✅ VERIFICATION PASSED for ${relPath}: All ${offerings.length} offerings verified successfully against ${(sources as unknown[]).length} sources.`);
    }
  }

  // Also verify stories.json if present
  const storiesPath = path.resolve(baseDir, 'data', 'stories.json');
  const programmesPath = path.resolve(baseDir, 'data', 'programmes.json');
  if (fs.existsSync(storiesPath) && fs.existsSync(programmesPath)) {
    try {
      const storiesData = JSON.parse(fs.readFileSync(storiesPath, 'utf-8'));
      const programmesData = JSON.parse(fs.readFileSync(programmesPath, 'utf-8'));
      const storiesResult = verifyStories(storiesData, programmesData);
      const relStoriesPath = path.relative(baseDir, storiesPath);

      if (!storiesResult.valid) {
        console.error(`\n❌ VERIFICATION FAILED for ${relStoriesPath}: Found ${storiesResult.errors.length} error(s):\n`);
        for (const err of storiesResult.errors) {
          console.error(`  - Offending Story: "${err.id}" | Offending Field: "${err.field}" | Reason: ${err.message}`);
        }
        console.error('');
        totalErrors += storiesResult.errors.length;
      } else {
        const progCount = Array.isArray(programmesData) ? programmesData.length : ((programmesData as { programmes: unknown[] }).programmes?.length ?? 0);
        console.log(`\n✅ VERIFICATION PASSED for ${relStoriesPath}: All ${(storiesData as { stories: unknown[] }).stories?.length} stories verified successfully against ${(storiesData as { sources: unknown[] }).sources?.length} sources and ${progCount} programmes.`);
      }
    } catch (e) {
      console.error(`[VERIFY ERROR] Failed to parse stories or programmes JSON:`, e);
      totalErrors++;
    }
  }

  return totalErrors > 0 ? 1 : 0;
}

// Execute if run directly
const currentFilePath = fileURLToPath(import.meta.url);
const invokedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (invokedFilePath === currentFilePath || invokedFilePath.endsWith('verify.ts') || invokedFilePath.endsWith('verify.js')) {
  const exitCode = runCli();
  process.exit(exitCode);
}
