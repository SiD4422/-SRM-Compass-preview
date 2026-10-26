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

  for (const item of offerings) {
    if (!item || typeof item !== 'object') {
      errors.push({ id: 'UNKNOWN', field: 'offering', message: 'Offering entry must be an object' });
      continue;
    }

    const offering = item as Partial<Offering>;
    const id = typeof offering.id === 'string' && offering.id.trim() !== '' ? offering.id : 'UNKNOWN_ID';

    // Rule 5: a department is null
    if (offering.department === null || (typeof offering.department === 'object' && offering.department !== null && offering.department.value === null)) {
      errors.push({
        id,
        field: 'department',
        message: 'Department is null'
      });
    }

    // Inspect each fact field
    for (const factField of FACT_FIELDS) {
      const fact = offering[factField] as Partial<Fact> | null | undefined;

      // If department is null, it was already recorded above
      if (factField === 'department' && (fact === null || (fact && fact.value === null))) {
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
  const offeringsPath = customOfferingsPath ?? path.resolve(baseDir, 'data', 'offerings.m1.json');
  const sourcesPath = customSourcesPath ?? path.resolve(baseDir, 'data', 'sources.json');

  if (!fs.existsSync(offeringsPath)) {
    console.error(`[VERIFY ERROR] Offerings file not found: ${offeringsPath}`);
    return 1;
  }

  if (!fs.existsSync(sourcesPath)) {
    console.error(`[VERIFY ERROR] Sources file not found: ${sourcesPath}`);
    return 1;
  }

  let offerings: unknown[];
  let sources: unknown[];

  try {
    offerings = JSON.parse(fs.readFileSync(offeringsPath, 'utf-8'));
  } catch (e) {
    console.error(`[VERIFY ERROR] Failed to parse offerings JSON at ${offeringsPath}:`, e);
    return 1;
  }

  try {
    sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf-8'));
  } catch (e) {
    console.error(`[VERIFY ERROR] Failed to parse sources JSON at ${sourcesPath}:`, e);
    return 1;
  }

  const result = verifyData(offerings, sources);

  if (!result.valid) {
    console.error(`\n❌ VERIFICATION FAILED: Found ${result.errors.length} error(s):\n`);
    for (const err of result.errors) {
      console.error(`  - Offending ID: "${err.id}" | Offending Field: "${err.field}" | Reason: ${err.message}`);
    }
    console.error('');
    return 1;
  }

  console.log(`\n✅ VERIFICATION PASSED: All ${offerings.length} offerings verified successfully against ${sources.length} sources.`);
  return 0;
}

// Execute if run directly
const currentFilePath = fileURLToPath(import.meta.url);
const invokedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (invokedFilePath === currentFilePath || invokedFilePath.endsWith('verify.ts') || invokedFilePath.endsWith('verify.js')) {
  const exitCode = runCli();
  process.exit(exitCode);
}
