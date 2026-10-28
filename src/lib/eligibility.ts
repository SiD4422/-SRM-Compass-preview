/**
 * SRM Compass - Eligibility Evaluation Engine
 * Milestone 5 (Stage M5 / M5-fix)
 *
 * Implements SRMIST's official 2026-2027 B.Tech eligibility criteria:
 * 1. Validation before evaluating: aggregate finite, 0 to 100, date of birth required & valid.
 * 2. No rounding: compares entered aggregate directly to 60.
 * 3. Matching checkbox controls for Physics and Mathematics; unticked means does not meet.
 * 4. SRM's exact wording for Biotech: 'Z (Botany or Zoology)', box labeled 'SRM\'s rule, summarised',
 *    nationality and age kept on separate lines.
 * 5. Non-resident portal link: https://intlapplications.srmist.edu.in/international-application-2026.
 * 6. Class 12 exam year choice of 2026 or 2027; active use of class12Status in verification text.
 * 7. Renamed ADDITIONAL_MATH_COURSE_NOTE.
 * 8. Privacy: 100% client-side execution, zero network requests, zero storage.
 */

export type ProgrammeGroup = 'general' | 'biotech';

export type QualifyingBoard =
  | 'CBSE'
  | 'ISCE'
  | 'State board'
  | 'NIOS'
  | 'IB'
  | 'GCE A-level';

export type Class12Status = 'passed' | 'appearing';

export type GeneralElectiveSubject =
  | 'Chemistry'
  | 'Biotechnology'
  | 'Biology'
  | 'Computer Science'
  | 'Information Technology'
  | 'Informatics Practices'
  | 'Engineering Graphics'
  | 'Botany and Zoology';

export type BiotechSubjectCombination =
  | 'PCM'
  | 'PMB'
  | 'PCB'
  | 'Botany and Zoology'
  | 'Z (Botany or Zoology)';

export interface EligibilityInput {
  residentIndian: boolean;
  qualifyingBoard: QualifyingBoard | string;
  class12Status?: Class12Status | string;
  examYear: number;
  dateOfBirth: string; // YYYY-MM-DD
  programmeGroup: ProgrammeGroup;
  // Subject selections
  hasPhysics?: boolean; // Default true for general
  hasMathematics?: boolean; // Default true for general
  thirdSubject?: GeneralElectiveSubject | string;
  subjectCombination?: BiotechSubjectCombination | string;
  subjects?: string[]; // Optional explicit list of subjects
  aggregatePercent: number; // 0 to 100
}

export type EligibilityStatus =
  | 'meets'
  | 'does_not_meet'
  | 'check_srm_page'
  | 'error';

export interface EligibilityResult {
  status: EligibilityStatus;
  headline: string;
  reasons: string[];
  fieldErrors?: {
    aggregate?: string;
    dob?: string;
    examYear?: string;
  };
  ruleText?: string;
  nationalityText?: string;
  ageRuleText?: string;
  sourceStamp?: {
    sourceId: string;
    label: string;
    url: string;
    captureDate: string;
  };
  hasMathNote: boolean;
  mathNote?: string;
  disclaimer: string;
  privacyNotice: string;
}

export const OFFICIAL_SOURCE = {
  sourceId: 'S2',
  label: 'Verified 26 Oct 2026',
  url: 'https://www.srmist.edu.in/admission-india/engineering/',
  captureDate: '2026-10-26'
};

export const NON_RESIDENT_PORTAL_URL =
  'https://intlapplications.srmist.edu.in/international-application-2026';

export const RULE_TEXT_GENERAL =
  'Applicant should have passed in Higher Secondary examination (10+2 pattern) or appearing in Higher Secondary examination in the current academic year with a minimum of 60% aggregate (3 subjects) in Physics (mandatory), Mathematics (mandatory) and at least one of Chemistry / Biotechnology / Biology / Computer Science / Information Technology / Informatics Practices / Engineering Graphics / Botany and Zoology.';

export const RULE_TEXT_BIOTECH =
  'Minimum 60% aggregate in PCM / PMB / PCB / PCB or Z (Botany or Zoology). Students who have not studied Mathematics in 10+2 must undertake an additional 4-credit course in Mathematics during the first year.';

export const NATIONALITY_RULE = 'Resident Indian only.';

export const AGE_RULE =
  'Age: at least 16 years and 6 months on 31st July of the exam year.';

export const ADDITIONAL_MATH_COURSE_NOTE =
  'Students who have not studied Mathematics in 10+2 must undertake an additional 4-credit course in Mathematics during the first year.';

export const MANDATORY_DISCLAIMER =
  'This checks minimum marks and age only; admission is through SRMJEEE (UG); SRM decides.';

export const PRIVACY_NOTICE =
  'Privacy: Nothing is sent, stored or put in the URL. All evaluation runs 100% locally in your browser.';

/**
 * Validates whether a given date string is a real calendar date (YYYY-MM-DD).
 * Correctly accounts for leap years and month lengths (e.g. 29 Feb).
 */
export function isValidDate(dobString: string): boolean {
  if (!dobString || typeof dobString !== 'string') return false;
  const match = dobString.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
}

/**
 * Checks age requirement: At least 16 years 6 months on 31 July of the exam year.
 * Boundary inclusive:
 * On 31 July of Year Y, candidate must have attained 16 years and 6 months.
 * Cutoff birth date: (Y - 16) - 6 months = (Y - 16) January 31st.
 * Example for Y=2026: Cutoff = 2010-01-31.
 * Example for Y=2027: Cutoff = 2011-01-31.
 */
export function isAgeEligible(
  dobString: string,
  examYear: number
): { isEligible: boolean; cutoffDate: string } {
  if (!dobString || !examYear) {
    return { isEligible: false, cutoffDate: '' };
  }

  const cutoffYear = examYear - 16;
  const cutoffDate = `${cutoffYear}-01-31`;

  // ISO string comparison YYYY-MM-DD works lexicographically
  const isEligible = dobString <= cutoffDate;
  return { isEligible, cutoffDate };
}

/**
 * Evaluates full eligibility against SRMIST criteria.
 * Validates inputs first; returns error status with field errors if invalid.
 * Does NOT round aggregate percentages.
 */
export function checkEligibility(input: EligibilityInput): EligibilityResult {
  const isBiotech = input.programmeGroup === 'biotech';
  const ruleText = isBiotech ? RULE_TEXT_BIOTECH : RULE_TEXT_GENERAL;

  // 1. Validation Before Evaluating
  const fieldErrors: {
    aggregate?: string;
    dob?: string;
    examYear?: string;
  } = {};

  // Aggregate validation: finite number, 0 to 100
  if (
    input.aggregatePercent === undefined ||
    input.aggregatePercent === null ||
    typeof input.aggregatePercent !== 'number' ||
    !Number.isFinite(input.aggregatePercent) ||
    Number.isNaN(input.aggregatePercent)
  ) {
    fieldErrors.aggregate =
      'Aggregate percentage must be a valid finite number.';
  } else if (input.aggregatePercent < 0 || input.aggregatePercent > 100) {
    fieldErrors.aggregate =
      'Aggregate percentage must be between 0.0 and 100.0.';
  }

  // Date of birth validation: required and real calendar date
  if (
    !input.dateOfBirth ||
    typeof input.dateOfBirth !== 'string' ||
    input.dateOfBirth.trim() === ''
  ) {
    fieldErrors.dob = 'Date of birth is required.';
  } else if (!isValidDate(input.dateOfBirth)) {
    fieldErrors.dob =
      'Date of birth must be a valid calendar date in YYYY-MM-DD format.';
  }

  // If any field error is present, return error status with NO verdict
  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: 'error',
      headline: 'Please correct the field errors',
      reasons: Object.values(fieldErrors),
      fieldErrors,
      hasMathNote: false,
      disclaimer: MANDATORY_DISCLAIMER,
      privacyNotice: PRIVACY_NOTICE
    };
  }

  // 2. Check for "Check SRM's page" conditions:
  // Non-resident Indian, IB, GCE A-level
  if (!input.residentIndian) {
    return {
      status: 'check_srm_page',
      headline: "Check SRM's page",
      reasons: [
        `Check SRM's page: Non-Resident Indian (NRI), PIO, OCI, and international candidates must apply through SRM's international admissions portal: ${NON_RESIDENT_PORTAL_URL}.`
      ],
      ruleText,
      nationalityText: 'Non-resident / International candidate',
      ageRuleText: AGE_RULE,
      sourceStamp: {
        sourceId: 'S2-intl',
        label: 'Verified 26 Oct 2026',
        url: NON_RESIDENT_PORTAL_URL,
        captureDate: '2026-10-26'
      },
      hasMathNote: false,
      disclaimer: MANDATORY_DISCLAIMER,
      privacyNotice: PRIVACY_NOTICE
    };
  }

  const normalizedBoard = (input.qualifyingBoard || '').trim();
  if (normalizedBoard === 'IB' || normalizedBoard === 'GCE A-level') {
    return {
      status: 'check_srm_page',
      headline: "Check SRM's page",
      reasons: [
        `Check SRM's page: Candidates qualifying from ${normalizedBoard} should consult SRM's own sections on https://www.srmist.edu.in/admission-india/engineering/ for admission requirements and subject equivalences.`
      ],
      ruleText,
      nationalityText: NATIONALITY_RULE,
      ageRuleText: AGE_RULE,
      sourceStamp: OFFICIAL_SOURCE,
      hasMathNote: false,
      disclaimer: MANDATORY_DISCLAIMER,
      privacyNotice: PRIVACY_NOTICE
    };
  }

  // 3. Evaluate Standard Rules: Marks, Age, Mandatory Subjects
  const failedRules: string[] = [];

  // Marks check: DO NOT ROUND; compare directly to 60
  if (input.aggregatePercent < 60) {
    failedRules.push(
      `Aggregate percentage: ${input.aggregatePercent}% is below SRM's minimum required threshold of 60.0% across the 3 qualifying subjects.`
    );
  }

  // Age check: Minimum 16 years 6 months on 31 July of exam year
  const { isEligible: ageOk, cutoffDate } = isAgeEligible(
    input.dateOfBirth,
    input.examYear
  );
  if (!ageOk) {
    failedRules.push(
      `Age requirement: Applicant must be at least 16 years 6 months on 31 July ${input.examYear}. For the ${input.examYear} exam year, date of birth must be on or before ${cutoffDate} (entered: ${input.dateOfBirth}).`
    );
  }

  // Subject checks
  let requiresMathBridge = false;

  if (!isBiotech) {
    // General engineering programme
    // Physics and Mathematics are mandatory; unticked means does not meet
    let physicsPresent = input.hasPhysics !== false;
    let mathPresent = input.hasMathematics !== false;

    if (Array.isArray(input.subjects)) {
      physicsPresent = input.subjects.some((s) => /physics/i.test(s));
      mathPresent = input.subjects.some((s) => /math/i.test(s));
    }

    if (!physicsPresent || !mathPresent) {
      const missing: string[] = [];
      if (!physicsPresent) missing.push('Physics');
      if (!mathPresent) missing.push('Mathematics');
      failedRules.push(
        `Mandatory subjects: ${missing.join(
          ' and '
        )} is mandatory for General engineering programmes.`
      );
    }
  } else {
    // Biotechnology, Genetic Engineering or Biomedical programme
    // Combinations: PCM, PMB, PCB, or Z (Botany or Zoology)
    const combo = (input.subjectCombination || '').toUpperCase().trim();
    const hasMathInCombo =
      combo === 'PCM' ||
      combo === 'PMB' ||
      (Array.isArray(input.subjects) &&
        input.subjects.some((s) => /math/i.test(s)));

    if (!hasMathInCombo) {
      // Studied PCB or Z (Botany or Zoology) without 10+2 Mathematics
      requiresMathBridge = true;
    }
  }

  // 4. Assemble Verdict
  if (failedRules.length > 0) {
    return {
      status: 'does_not_meet',
      headline: 'You do not meet these criteria',
      reasons: failedRules,
      ruleText,
      nationalityText: NATIONALITY_RULE,
      ageRuleText: AGE_RULE,
      sourceStamp: OFFICIAL_SOURCE,
      hasMathNote: false,
      disclaimer: MANDATORY_DISCLAIMER,
      privacyNotice: PRIVACY_NOTICE
    };
  }

  // Meets all published minimum criteria!
  const statusNote =
    input.class12Status === 'appearing'
      ? `appearing in ${input.examYear} Class 12 exam`
      : 'passed Class 12';

  return {
    status: 'meets',
    headline: "You meet SRM's published minimum criteria",
    reasons: [
      `Your aggregate score of ${input.aggregatePercent}%, qualifying board (${normalizedBoard}), status (${statusNote}), and date of birth satisfy SRM's published minimum thresholds.`
    ],
    ruleText,
    nationalityText: NATIONALITY_RULE,
    ageRuleText: AGE_RULE,
    sourceStamp: OFFICIAL_SOURCE,
    hasMathNote: requiresMathBridge,
    mathNote: requiresMathBridge ? ADDITIONAL_MATH_COURSE_NOTE : undefined,
    disclaimer: MANDATORY_DISCLAIMER,
    privacyNotice: PRIVACY_NOTICE
  };
}

/**
 * Escapes HTML characters for safe client rendering.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formats EligibilityResult into accessible HTML markup.
 */
export function renderEligibilityResult(result: EligibilityResult): string {
  if (result.status === 'error') {
    const errorsList = result.reasons
      .map((r) => `<li>${escapeHtml(r)}</li>`)
      .join('');

    return `
      <div class="result-card verdict-error" role="alert" aria-live="assertive">
        <div class="result-header">
          <span class="result-badge" aria-hidden="true">⚠</span>
          <h3 class="result-headline">${escapeHtml(result.headline)}</h3>
        </div>
        <p class="error-intro">Eligibility cannot be evaluated until the following field errors are corrected:</p>
        <ul class="result-reasons error-reasons">
          ${errorsList}
        </ul>
        <div class="result-disclaimer">
          <p><strong>Note:</strong> ${escapeHtml(result.disclaimer)}</p>
        </div>
        <div class="result-privacy">
          <p><small>${escapeHtml(result.privacyNotice)}</small></p>
        </div>
      </div>
    `;
  }

  const statusClass =
    result.status === 'meets'
      ? 'verdict-meets'
      : result.status === 'does_not_meet'
      ? 'verdict-fails'
      : 'verdict-refer';

  const badgeIcon =
    result.status === 'meets' ? '✓' : result.status === 'does_not_meet' ? '✕' : 'ℹ';

  const reasonsList = result.reasons
    .map((r) => `<li>${escapeHtml(r)}</li>`)
    .join('');

  const mathNoteBlock =
    result.hasMathNote && result.mathNote
      ? `
    <div class="result-math-note" role="note" aria-label="Additional Mathematics Requirement Note">
      <strong>Additional 4-Credit Course in Mathematics:</strong>
      <p>${escapeHtml(result.mathNote)}</p>
    </div>`
      : '';

  return `
    <div class="result-card ${statusClass}">
      <div class="result-header">
        <span class="result-badge" aria-hidden="true">${badgeIcon}</span>
        <h3 class="result-headline">${escapeHtml(result.headline)}</h3>
      </div>

      <ul class="result-reasons">
        ${reasonsList}
      </ul>

      ${mathNoteBlock}

      <div class="result-rule">
        <h4>SRM's rule, summarised</h4>
        <p class="rule-quote">${escapeHtml(result.ruleText || '')}</p>
        <p class="rule-line"><strong>Nationality:</strong> ${escapeHtml(
          result.nationalityText || NATIONALITY_RULE
        )}</p>
        <p class="rule-line"><strong>Age threshold:</strong> ${escapeHtml(
          result.ageRuleText || AGE_RULE
        )}</p>
        <div class="result-source-row">
          <a class="stamp" href="${escapeHtml(
            result.sourceStamp?.url || OFFICIAL_SOURCE.url
          )}" target="_blank" rel="noopener">
            ${escapeHtml(result.sourceStamp?.label || OFFICIAL_SOURCE.label)}
          </a>
          <a class="source-link" href="${escapeHtml(
            result.sourceStamp?.url || OFFICIAL_SOURCE.url
          )}" target="_blank" rel="noopener">
            Official SRM admissions page ↗
          </a>
        </div>
      </div>

      <div class="result-disclaimer">
        <p><strong>Note:</strong> ${escapeHtml(result.disclaimer)}</p>
      </div>

      <div class="result-privacy">
        <p><small>${escapeHtml(result.privacyNotice)}</small></p>
      </div>
    </div>
  `;
}

/**
 * Attaches client-side form listener on the /eligibility page.
 * Pure DOM reader and renderer, zero network traffic.
 */
export function initEligibilityChecker(): void {
  const form = document.getElementById('eligibility-form') as HTMLFormElement | null;
  const resultContainer = document.getElementById('checker-result');
  const groupSelect = document.getElementById('group-select') as HTMLSelectElement | null;
  const generalSubjectsDiv = document.getElementById('general-subjects-row');
  const biotechSubjectsDiv = document.getElementById('biotech-subjects-row');
  const resetBtn = document.getElementById('checker-reset-btn');
  const aggregateInput = document.getElementById('aggregate') as HTMLInputElement | null;
  const dobInput = document.getElementById('dob') as HTMLInputElement | null;
  const aggregateErrorEl = document.getElementById('aggregate-error');
  const dobErrorEl = document.getElementById('dob-error');

  if (!form || !resultContainer) return;

  function clearInlineErrors() {
    if (aggregateInput) aggregateInput.classList.remove('input-has-error');
    if (dobInput) dobInput.classList.remove('input-has-error');
    if (aggregateErrorEl) {
      aggregateErrorEl.textContent = '';
      aggregateErrorEl.hidden = true;
    }
    if (dobErrorEl) {
      dobErrorEl.textContent = '';
      dobErrorEl.hidden = true;
    }
  }

  // Toggle subject controls based on Programme Group
  function updateGroupVisibility() {
    if (!groupSelect || !generalSubjectsDiv || !biotechSubjectsDiv) return;
    const isBiotech = groupSelect.value === 'biotech';
    generalSubjectsDiv.hidden = isBiotech;
    biotechSubjectsDiv.hidden = !isBiotech;
  }

  if (groupSelect) {
    groupSelect.addEventListener('change', updateGroupVisibility);
    updateGroupVisibility();
  }

  // Handle Form Submission
  form.addEventListener('submit', (event) => {
    event.preventDefault(); // Guarantee NO network request or URL mutation
    clearInlineErrors();

    const formData = new FormData(form);
    const residentVal = formData.get('resident') as string;
    const residentIndian = residentVal === 'yes';

    const board = (formData.get('board') as string) || 'CBSE';
    const status = (formData.get('status') as string) || 'passed';
    const examYear = parseInt((formData.get('examYear') as string) || '2026', 10);
    const dob = ((formData.get('dob') as string) || '').trim();
    const group = ((formData.get('programmeGroup') as string) || 'general') as ProgrammeGroup;

    const aggregateStr = ((formData.get('aggregate') as string) || '').trim();
    const aggregatePercent = aggregateStr === '' ? NaN : Number(aggregateStr);

    const hasPhysicsCheckbox = form.querySelector('#has-physics') as HTMLInputElement | null;
    const hasPhysics = hasPhysicsCheckbox ? hasPhysicsCheckbox.checked : true;

    const hasMathCheckbox = form.querySelector('#has-math') as HTMLInputElement | null;
    const hasMathematics = hasMathCheckbox ? hasMathCheckbox.checked : true;

    const thirdSubject = (formData.get('thirdSubject') as string) || 'Chemistry';
    const subjectCombo = (formData.get('biotechCombo') as string) || 'PCM';

    const input: EligibilityInput = {
      residentIndian,
      qualifyingBoard: board,
      class12Status: status,
      examYear,
      dateOfBirth: dob,
      programmeGroup: group,
      hasPhysics,
      hasMathematics,
      thirdSubject,
      subjectCombination: subjectCombo,
      aggregatePercent
    };

    const result = checkEligibility(input);

    // If result has field errors, highlight the invalid fields
    if (result.status === 'error' && result.fieldErrors) {
      if (result.fieldErrors.aggregate && aggregateInput) {
        aggregateInput.classList.add('input-has-error');
        if (aggregateErrorEl) {
          aggregateErrorEl.textContent = result.fieldErrors.aggregate;
          aggregateErrorEl.hidden = false;
        }
      }
      if (result.fieldErrors.dob && dobInput) {
        dobInput.classList.add('input-has-error');
        if (dobErrorEl) {
          dobErrorEl.textContent = result.fieldErrors.dob;
          dobErrorEl.hidden = false;
        }
      }
    }

    resultContainer.innerHTML = renderEligibilityResult(result);
    resultContainer.hidden = false;

    // Scroll result into view smoothly
    resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  // Handle Reset
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      form.reset();
      clearInlineErrors();
      resultContainer.innerHTML = '';
      resultContainer.hidden = true;
      updateGroupVisibility();
    });
  }
}
