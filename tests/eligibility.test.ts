import { describe, it, expect } from 'vitest';
import {
  checkEligibility,
  isAgeEligible,
  type EligibilityInput,
  MATH_BRIDGE_NOTE,
  OFFICIAL_SOURCE,
  MANDATORY_DISCLAIMER
} from '../src/lib/eligibility';

describe('Stage M5: B.Tech Eligibility Evaluation Engine (src/lib/eligibility.ts)', () => {
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

  // Hand-written Test 1: 60.0 with PCM, resident, age ok = meets
  it('1. 60.0 with PCM, resident, age ok = meets', () => {
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
    expect(result.sourceStamp.url).toBe(OFFICIAL_SOURCE.url);
    expect(result.disclaimer).toBe(MANDATORY_DISCLAIMER);
  });

  // Hand-written Test 2: 59.9 = does not
  it('2. 59.9 = does not meet criteria', () => {
    const result = checkEligibility({
      ...baseInput,
      aggregatePercent: 59.9
    });

    expect(result.status).toBe('does_not_meet');
    expect(result.headline).toBe('You do not meet these criteria');
    expect(result.reasons.some((r) => r.includes('59.9%') && r.includes('60.0%'))).toBe(true);
  });

  // Hand-written Test 3: no Mathematics (general) = does not
  it('3. no Mathematics (general) = does not meet criteria', () => {
    const result = checkEligibility({
      ...baseInput,
      hasMathematics: false
    });

    expect(result.status).toBe('does_not_meet');
    expect(result.headline).toBe('You do not meet these criteria');
    expect(result.reasons.some((r) => r.includes('Mathematics is mandatory'))).toBe(true);
  });

  // Hand-written Test 4: DOB 31 Jan 2010, exam year 2026 = meets (exactly 16y6m)
  it('4. DOB 31 Jan 2010, exam year 2026 = meets (exactly 16y6m boundary inclusive)', () => {
    const ageCheck = isAgeEligible('2010-01-31', 2026);
    expect(ageCheck.isEligible).toBe(true);
    expect(ageCheck.cutoffDate).toBe('2010-01-31');

    const result = checkEligibility({
      ...baseInput,
      dateOfBirth: '2010-01-31',
      examYear: 2026,
      aggregatePercent: 60.0
    });

    expect(result.status).toBe('meets');
    expect(result.headline).toBe("You meet SRM's published minimum criteria");
  });

  // Hand-written Test 5: DOB 1 Feb 2010, exam year 2026 = does not
  it('5. DOB 1 Feb 2010, exam year 2026 = does not meet criteria', () => {
    const ageCheck = isAgeEligible('2010-02-01', 2026);
    expect(ageCheck.isEligible).toBe(false);

    const result = checkEligibility({
      ...baseInput,
      dateOfBirth: '2010-02-01',
      examYear: 2026
    });

    expect(result.status).toBe('does_not_meet');
    expect(result.headline).toBe('You do not meet these criteria');
    expect(result.reasons.some((r) => r.includes('16 years 6 months') && r.includes('2010-01-31'))).toBe(true);
  });

  // Hand-written Test 6: biotech group with PMB at 60 = meets
  it('6. biotech group with PMB at 60 = meets (no math bridge needed)', () => {
    const result = checkEligibility({
      ...baseInput,
      programmeGroup: 'biotech',
      subjectCombination: 'PMB',
      aggregatePercent: 60.0
    });

    expect(result.status).toBe('meets');
    expect(result.headline).toBe("You meet SRM's published minimum criteria");
    expect(result.hasMathNote).toBe(false);
  });

  // Hand-written Test 7: biotech group with PCB at 60 = meets plus the Mathematics note
  it('7. biotech group with PCB at 60 = meets plus the 4-credit Mathematics note', () => {
    const result = checkEligibility({
      ...baseInput,
      programmeGroup: 'biotech',
      subjectCombination: 'PCB',
      aggregatePercent: 60.0
    });

    expect(result.status).toBe('meets');
    expect(result.headline).toBe("You meet SRM's published minimum criteria");
    expect(result.hasMathNote).toBe(true);
    expect(result.mathNote).toBe(MATH_BRIDGE_NOTE);
    expect(result.mathNote).toContain('additional 4-credit course in Mathematics');
  });

  // Hand-written Test 8: IB = Check SRM's page
  it('8. IB = Check SRM\'s page', () => {
    const result = checkEligibility({
      ...baseInput,
      qualifyingBoard: 'IB'
    });

    expect(result.status).toBe('check_srm_page');
    expect(result.headline).toBe("Check SRM's page");
    expect(result.reasons.some((r) => r.includes('IB') || r.includes('International Baccalaureate'))).toBe(true);
    expect(result.sourceStamp.url).toBe(OFFICIAL_SOURCE.url);
  });

  // Hand-written Test 9: non-resident = Check SRM's page
  it('9. non-resident = Check SRM\'s page', () => {
    const result = checkEligibility({
      ...baseInput,
      residentIndian: false
    });

    expect(result.status).toBe('check_srm_page');
    expect(result.headline).toBe("Check SRM's page");
    expect(result.reasons.some((r) => r.includes('International') || r.includes('NRI'))).toBe(true);
    expect(result.sourceStamp.url).toBe(OFFICIAL_SOURCE.url);
  });

  // Additional edge cases: GCE A-level and multiple failures
  it('handles GCE A-level as Check SRM\'s page', () => {
    const result = checkEligibility({
      ...baseInput,
      qualifyingBoard: 'GCE A-level'
    });
    expect(result.status).toBe('check_srm_page');
    expect(result.headline).toBe("Check SRM's page");
  });

  it('aggregates multiple failed rules (underage and marks below 60)', () => {
    const result = checkEligibility({
      ...baseInput,
      aggregatePercent: 55.4,
      dateOfBirth: '2011-06-01',
      examYear: 2026
    });
    expect(result.status).toBe('does_not_meet');
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
  });
});
