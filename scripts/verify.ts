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

  return totalErrors > 0 ? 1 : 0;
}

// Execute if run directly
const currentFilePath = fileURLToPath(import.meta.url);
const invokedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (invokedFilePath === currentFilePath || invokedFilePath.endsWith('verify.ts') || invokedFilePath.endsWith('verify.js')) {
  const exitCode = runCli();
  process.exit(exitCode);
}
