import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  checkEligibility,
  isAgeEligible,
  isValidDate,
  type EligibilityInput,
  ADDITIONAL_MATH_COURSE_NOTE,
  OFFICIAL_SOURCE,
  NON_RESIDENT_PORTAL_URL,
  MANDATORY_DISCLAIMER
} from '../src/lib/eligibility';

describe('Stage M5-fix: B.Tech Eligibility Evaluation Engine (src/lib/eligibility.ts)', () => {
  // Base baseline candidate
  const baseInput: EligibilityInput = {
    residentIndian: true,
    qualifyingBoard: 'CBSE',
    class12Status: 'passed',
    examYear: 2026,
    dateOfBirth: '2008-05-15',
    programmeGroup: 'general',
    hasPhysics: true,
    hasMathematics: true,
    thirdSubject: 'Chemistry',
    aggregatePercent: 60.0
  };

  // 1. Hand-written Test: blank aggregate = error
  it('1. blank aggregate = error', () => {
    const resultNull = checkEligibility({
      ...baseInput,
      aggregatePercent: null as any
    });
    expect(resultNull.status).toBe('error');
    expect(resultNull.headline).toBe('Please correct the field errors');
    expect(resultNull.fieldErrors?.aggregate).toBeDefined();

    const resultUndefined = checkEligibility({
      ...baseInput,
      aggregatePercent: undefined as any
    });
    expect(resultUndefined.status).toBe('error');
    expect(resultUndefined.fieldErrors?.aggregate).toBeDefined();
  });

  // 2. Hand-written Test: NaN = error
  it('2. NaN = error', () => {
    const resultNaN = checkEligibility({
      ...baseInput,
      aggregatePercent: NaN
    });
    expect(resultNaN.status).toBe('error');
    expect(resultNaN.headline).toBe('Please correct the field errors');
    expect(resultNaN.fieldErrors?.aggregate).toBeDefined();

    const resultInf = checkEligibility({
      ...baseInput,
      aggregatePercent: Infinity
    });
    expect(resultInf.status).toBe('error');
    expect(resultInf.fieldErrors?.aggregate).toBeDefined();
  });

  // 3. Hand-written Test: 59.95 = does not meet (no rounding)
  it('3. 59.95 = does not meet (evaluated directly without rounding)', () => {
    const result = checkEligibility({
      ...baseInput,
      aggregatePercent: 59.95
    });

    expect(result.status).toBe('does_not_meet');
    expect(result.headline).toBe('You do not meet these criteria');
    expect(
      result.reasons.some(
        (r) => r.includes('59.95%') && r.includes('60.0%')
      )
    ).toBe(true);
  });

  // 4. Hand-written Test: 101 and -1 = error
  it('4. 101 and -1 = error', () => {
    const result101 = checkEligibility({
      ...baseInput,
      aggregatePercent: 101
    });
    expect(result101.status).toBe('error');
    expect(result101.fieldErrors?.aggregate).toBeDefined();

    const resultNeg1 = checkEligibility({
      ...baseInput,
      aggregatePercent: -1
    });
    expect(resultNeg1.status).toBe('error');
    expect(resultNeg1.fieldErrors?.aggregate).toBeDefined();
  });

  // 5. Hand-written Test: no Physics = does not meet
  it('5. no Physics = does not meet', () => {
    const result = checkEligibility({
      ...baseInput,
      hasPhysics: false,
      hasMathematics: true
    });

    expect(result.status).toBe('does_not_meet');
    expect(result.headline).toBe('You do not meet these criteria');
    expect(
      result.reasons.some((r) => r.includes('Physics is mandatory'))
    ).toBe(true);
  });

  // Hand-written Test: no Mathematics = does not meet
  it('no Mathematics = does not meet', () => {
    const result = checkEligibility({
      ...baseInput,
      hasPhysics: true,
      hasMathematics: false
    });

    expect(result.status).toBe('does_not_meet');
    expect(
      result.reasons.some((r) => r.includes('Mathematics is mandatory'))
    ).toBe(true);
  });

  // 6. Hand-written Test: DOB 2011-01-31 with exam year 2027 = meets
  it('6. DOB 2011-01-31 with exam year 2027 = meets (exactly 16y 6m boundary inclusive)', () => {
    const ageCheck = isAgeEligible('2011-01-31', 2027);
    expect(ageCheck.isEligible).toBe(true);
    expect(ageCheck.cutoffDate).toBe('2011-01-31');

    const result = checkEligibility({
      ...baseInput,
      dateOfBirth: '2011-01-31',
      examYear: 2027,
      aggregatePercent: 60.0
    });

    expect(result.status).toBe('meets');
    expect(result.headline).toBe("You meet SRM's published minimum criteria");
  });

  // 7. Hand-written Test: DOB 2011-02-01 with 2027 = does not meet
  it('7. DOB 2011-02-01 with 2027 = does not meet (1 day underage)', () => {
    const ageCheck = isAgeEligible('2011-02-01', 2027);
    expect(ageCheck.isEligible).toBe(false);

    const result = checkEligibility({
      ...baseInput,
      dateOfBirth: '2011-02-01',
      examYear: 2027,
      aggregatePercent: 60.0
    });

    expect(result.status).toBe('does_not_meet');
    expect(result.headline).toBe('You do not meet these criteria');
    expect(
      result.reasons.some(
        (r) => r.includes('16 years 6 months') && r.includes('2011-01-31')
      )
    ).toBe(true);
  });

  // 8. Hand-written Test: 29 Feb DOB handled
  it('8. 29 Feb DOB handled (valid in leap year, invalid in non-leap year)', () => {
    // 2008 was a leap year -> 2008-02-29 is valid and eligible for 2026
    expect(isValidDate('2008-02-29')).toBe(true);
    const resultLeapValid = checkEligibility({
      ...baseInput,
      dateOfBirth: '2008-02-29',
      examYear: 2026
    });
    expect(resultLeapValid.status).toBe('meets');

    // 2010 was NOT a leap year -> 2010-02-29 is an invalid calendar date
    expect(isValidDate('2010-02-29')).toBe(false);
    const resultLeapInvalid = checkEligibility({
      ...baseInput,
      dateOfBirth: '2010-02-29',
      examYear: 2026
    });
    expect(resultLeapInvalid.status).toBe('error');
    expect(resultLeapInvalid.fieldErrors?.dob).toBeDefined();

    // Blank DOB is also an error
    const resultBlankDob = checkEligibility({
      ...baseInput,
      dateOfBirth: ''
    });
    expect(resultBlankDob.status).toBe('error');
    expect(resultBlankDob.fieldErrors?.dob).toBeDefined();
  });

  // Baseline Test: 60.0 with PCM, resident, age ok = meets
  it('60.0 with PCM, resident, age ok = meets', () => {
    const result = checkEligibility({
      ...baseInput,
      aggregatePercent: 60.0,
      hasPhysics: true,
      hasMathematics: true,
      thirdSubject: 'Chemistry'
    });

    expect(result.status).toBe('meets');
    expect(result.headline).toBe("You meet SRM's published minimum criteria");
    expect(result.hasMathNote).toBe(false);
    expect(result.sourceStamp?.url).toBe(OFFICIAL_SOURCE.url);
    expect(result.disclaimer).toBe(MANDATORY_DISCLAIMER);
  });

  // Baseline Test: DOB 31 Jan 2010, exam year 2026 = meets
  it('DOB 31 Jan 2010, exam year 2026 = meets (exactly 16y 6m)', () => {
    const ageCheck = isAgeEligible('2010-01-31', 2026);
    expect(ageCheck.isEligible).toBe(true);
    expect(ageCheck.cutoffDate).toBe('2010-01-31');

    const result = checkEligibility({
      ...baseInput,
      dateOfBirth: '2010-01-31',
      examYear: 2026
    });
    expect(result.status).toBe('meets');
  });

  // Baseline Test: DOB 1 Feb 2010, exam year 2026 = does not
  it('DOB 1 Feb 2010, exam year 2026 = does not meet', () => {
    const ageCheck = isAgeEligible('2010-02-01', 2026);
    expect(ageCheck.isEligible).toBe(false);

    const result = checkEligibility({
      ...baseInput,
      dateOfBirth: '2010-02-01',
      examYear: 2026
    });
    expect(result.status).toBe('does_not_meet');
  });

  // Biotech group with PMB at 60 = meets
  it('biotech group with PMB at 60 = meets (no math course needed)', () => {
    const result = checkEligibility({
      ...baseInput,
      programmeGroup: 'biotech',
      subjectCombination: 'PMB',
      aggregatePercent: 60.0
    });

    expect(result.status).toBe('meets');
    expect(result.headline).toBe("You meet SRM's published minimum criteria");
    expect(result.hasMathNote).toBe(false);
    expect(result.ruleText).toContain('Z (Botany or Zoology)');
  });

  // Biotech group with PCB at 60 = meets plus ADDITIONAL_MATH_COURSE_NOTE
  it('biotech group with PCB at 60 = meets plus ADDITIONAL_MATH_COURSE_NOTE', () => {
    const result = checkEligibility({
      ...baseInput,
      programmeGroup: 'biotech',
      subjectCombination: 'PCB',
      aggregatePercent: 60.0
    });

    expect(result.status).toBe('meets');
    expect(result.headline).toBe("You meet SRM's published minimum criteria");
    expect(result.hasMathNote).toBe(true);
    expect(result.mathNote).toBe(ADDITIONAL_MATH_COURSE_NOTE);
    expect(result.mathNote).toContain(
      'additional 4-credit course in Mathematics'
    );
  });

  // Biotech group with Z (Botany or Zoology) at 60 = meets plus ADDITIONAL_MATH_COURSE_NOTE
  it('biotech group with Z (Botany or Zoology) at 60 = meets plus ADDITIONAL_MATH_COURSE_NOTE', () => {
    const result = checkEligibility({
      ...baseInput,
      programmeGroup: 'biotech',
      subjectCombination: 'Z (Botany or Zoology)',
      aggregatePercent: 60.0
    });

    expect(result.status).toBe('meets');
    expect(result.hasMathNote).toBe(true);
    expect(result.mathNote).toBe(ADDITIONAL_MATH_COURSE_NOTE);
  });

  // IB = Check SRM's page
  it('IB = Check SRM\'s page without AIU/Cambridge/Pearson', () => {
    const result = checkEligibility({
      ...baseInput,
      qualifyingBoard: 'IB'
    });

    expect(result.status).toBe('check_srm_page');
    expect(result.headline).toBe("Check SRM's page");
    const allReasons = result.reasons.join(' ');
    expect(allReasons).not.toMatch(/AIU|Cambridge|Pearson/i);
    expect(allReasons).toContain(
      'https://www.srmist.edu.in/admission-india/engineering/'
    );
  });

  // Non-resident = Check SRM's page with international application portal link
  it('non-resident = Check SRM\'s page with international portal URL', () => {
    const result = checkEligibility({
      ...baseInput,
      residentIndian: false
    });

    expect(result.status).toBe('check_srm_page');
    expect(result.headline).toBe("Check SRM's page");
    const allReasons = result.reasons.join(' ');
    expect(allReasons).toContain(NON_RESIDENT_PORTAL_URL);
    expect(result.sourceStamp?.url).toBe(NON_RESIDENT_PORTAL_URL);
  });

  describe('Stage A: Eligibility No-JS Resilience and Privacy Protection', () => {
    it('verifies built eligibility HTML shows method="post", disabled submit button, and noscript banner', () => {
      const htmlPath = path.resolve(__dirname, '../dist/eligibility/index.html');
      expect(fs.existsSync(htmlPath)).toBe(true);
      const html = fs.readFileSync(htmlPath, 'utf-8');

      // 1. Form has explicit method="post"
      expect(html).toMatch(/<form[^>]+method=["']post["']/i);
      // 2. Submit button is disabled in static HTML
      expect(html).toMatch(/<button[^>]+id=["']checker-submit-btn["'][^>]*disabled/i);
      // 3. Noscript tag exists with explanation
      expect(html).toContain('<noscript>');
      expect(html).toContain('JavaScript is required for interactive eligibility checking');
      // 4. No form uses method="get"
      expect(html).not.toMatch(/<form[^>]+method=["']get["']/i);
    });

    it('runs Playwright with JS disabled: pressing Enter in aggregate field does not mutate URL', () => {
      const runnerScript = path.resolve(__dirname, 'check_eligibility_nojs.py');
      expect(fs.existsSync(runnerScript)).toBe(true);

      const result = spawnSync('python', [runnerScript], {
        cwd: path.resolve(__dirname, '..'),
        encoding: 'utf-8',
        timeout: 30000
      });

      if (result.status !== 0) {
        console.error('check_eligibility_nojs stdout:', result.stdout);
        console.error('check_eligibility_nojs stderr:', result.stderr);
      }

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('PASS: Eligibility form with JS disabled guarantees zero URL mutation and zero data leakage.');
    }, 30000);
  });
});
