import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { spawnSync } from 'node:child_process';
import en from '../src/i18n/en.json';
import { t } from '../src/lib/i18n';
import {
  checkEligibility,
  renderEligibilityResult,
  RULE_TEXT_GENERAL,
  RULE_TEXT_BIOTECH,
  NATIONALITY_RULE,
  AGE_RULE,
  ADDITIONAL_MATH_COURSE_NOTE,
  MANDATORY_DISCLAIMER
} from '../src/lib/eligibility';

describe('Stage E-1: i18n String Extraction and Byte-Identical English Content', () => {
  it('contains valid, stable keys in en.json with no empty strings', () => {
    const keys = Object.keys(en);
    expect(keys.length).toBeGreaterThanOrEqual(140);
    
    // Validate every string
    for (const [key, value] of Object.entries(en)) {
      expect(typeof value).toBe('string');
      expect(value.trim().length).toBeGreaterThan(0);
      // Stable key convention: dot notation
      expect(key).toMatch(/^[a-z0-9_]+(\.[a-z0-9_]+)+$/);
      // No stray unresolved interpolation syntax like %s or $name
      expect(value).not.toMatch(/%s/);
      expect(value).not.toMatch(/\$[a-zA-Z]/);
    }
  });

  it('interpolates variables formatted as {name} cleanly', () => {
    const interpolated = t('apply.routes.exam_badge', { exam: 'SRMJEEE (UG)' });
    expect(interpolated).toBe('Exam: SRMJEEE (UG)');

    const sourceLabel = t('apply.routes.source_prefix', { id: 'B1' });
    expect(sourceLabel).toBe('Source [B1]: ');

    const capturedDate = t('apply.routes.captured_date', { date: '26 Oct 2026' });
    expect(capturedDate).toBe(' (Captured 26 Oct 2026)');

    const conflictBody = t('eligibility.conflict.body', {
      conflictCount: 3,
      totalOfferings: 106
    });
    expect(conflictBody).toContain('In 3 of the 106 offerings');

    expect(() => t('non.existent.key')).toThrowError(/Missing translation key/);
  });

  it('preserves official SRM rules text in English verbatim', () => {
    // 1. General B.Tech rule
    expect(en['eligibility.rules.general']).toBe(
      'Applicant should have passed in Higher Secondary examination (10+2 pattern) or appearing in Higher Secondary examination in the current academic year with a minimum of 60% aggregate (3 subjects) in Physics (mandatory), Mathematics (mandatory) and at least one of Chemistry / Biotechnology / Biology / Computer Science / Information Technology / Informatics Practices / Engineering Graphics / Botany and Zoology.'
    );
    expect(RULE_TEXT_GENERAL).toBe(en['eligibility.rules.general']);

    // 2. Biotech rule
    expect(en['eligibility.rules.biotech']).toBe(
      'Minimum 60% aggregate in PCM / PMB / PCB / PCB or Z (Botany or Zoology). Students who have not studied Mathematics in 10+2 must undertake an additional 4-credit course in Mathematics during the first year.'
    );
    expect(RULE_TEXT_BIOTECH).toBe(en['eligibility.rules.biotech']);

    // 3. Nationality
    expect(en['eligibility.rules.nationality']).toBe('Resident Indian only.');
    expect(NATIONALITY_RULE).toBe('Resident Indian only.');

    // 4. Age rule
    expect(en['eligibility.rules.age']).toBe(
      'Age: at least 16 years and 6 months on 31st July of the exam year.'
    );
    expect(AGE_RULE).toBe('Age: at least 16 years and 6 months on 31st July of the exam year.');

    // 5. Additional math note
    expect(en['eligibility.rules.math_note']).toBe(
      'Students who have not studied Mathematics in 10+2 must undertake an additional 4-credit course in Mathematics during the first year.'
    );
    expect(ADDITIONAL_MATH_COURSE_NOTE).toBe(en['eligibility.rules.math_note']);

    // 6. Mandatory disclaimer
    expect(en['eligibility.rules.disclaimer']).toBe(
      'This checks minimum marks and age only; admission is through SRMJEEE (UG); SRM decides.'
    );
    expect(MANDATORY_DISCLAIMER).toBe(en['eligibility.rules.disclaimer']);

    // Breakdown cards in page
    expect(en['eligibility.breakdown.rule1_text']).toBe(en['eligibility.rules.general']);
    expect(en['eligibility.breakdown.rule2_text']).toBe(en['eligibility.rules.biotech']);
    expect(en['eligibility.breakdown.rule3_text']).toBe(
      'Resident Indian. Should have attained the age of 16 years and 6 months on the 31st July of the calendar year in which the 12th Board examination is held.'
    );
    expect(en['eligibility.breakdown.rule4_text']).toBe(
      'Admission is through the national-level entrance exam SRMJEEE (UG).'
    );
  });

  it('renders dynamic eligibility evaluation results using i18n lookups', () => {
    // Meets
    const resMeets = checkEligibility({
      residentIndian: true,
      qualifyingBoard: 'CBSE',
      class12Status: 'passed',
      examYear: 2026,
      dateOfBirth: '2008-05-15',
      programmeGroup: 'general',
      hasPhysics: true,
      hasMathematics: true,
      aggregatePercent: 75.5
    });
    expect(resMeets.status).toBe('meets');
    expect(resMeets.headline).toBe("You meet SRM's published minimum criteria");
    expect(resMeets.reasons[0]).toContain('Your aggregate score of 75.5%');

    const htmlMeets = renderEligibilityResult(resMeets);
    expect(htmlMeets).toContain("You meet SRM&#39;s published minimum criteria");
    expect(htmlMeets).toContain("SRM's rule, summarised");

    // Does not meet (fails marks)
    const resFails = checkEligibility({
      residentIndian: true,
      qualifyingBoard: 'CBSE',
      class12Status: 'passed',
      examYear: 2026,
      dateOfBirth: '2008-05-15',
      programmeGroup: 'general',
      hasPhysics: true,
      hasMathematics: true,
      aggregatePercent: 58.0
    });
    expect(resFails.status).toBe('does_not_meet');
    expect(resFails.headline).toBe('You do not meet these criteria');
    expect(resFails.reasons[0]).toContain('58% is below SRM\'s minimum required threshold of 60.0%');

    // Validation error
    const resErr = checkEligibility({
      residentIndian: true,
      qualifyingBoard: 'CBSE',
      examYear: 2026,
      dateOfBirth: '',
      programmeGroup: 'general',
      aggregatePercent: NaN
    });
    expect(resErr.status).toBe('error');
    expect(resErr.headline).toBe('Please correct the field errors');
    expect(resErr.fieldErrors?.aggregate).toBe('Aggregate percentage must be a valid finite number.');
    expect(resErr.fieldErrors?.dob).toBe('Date of birth is required.');
  });

  it('produces byte-identical visible text on built English pages compared to pre-refactor baseline', () => {
    const runnerScript = path.resolve(__dirname, 'compare_stage_e1_visible_text.py');
    const result = spawnSync('python', [runnerScript], {
      encoding: 'utf-8',
      timeout: 30000
    });

    if (result.status !== 0) {
      console.error('Visible text comparison failed:', result.stdout, result.stderr);
    }
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('ALL PAGES VERIFIED: 100% BYTE-IDENTICAL VISIBLE TEXT CONTENT');
  }, 35000);
});
