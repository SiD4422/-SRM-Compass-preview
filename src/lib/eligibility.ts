/**
 * SRM Compass - Eligibility Evaluation Engine
 * Milestone 5 (Stage M5)
 *
 * Implements SRMIST's official 2026-2027 B.Tech eligibility criteria:
 * 1. Minimum 60% aggregate across 3 qualifying subjects (one decimal place).
 * 2. Minimum age of 16 years 6 months on 31 July of the exam year (boundary inclusive).
 * 3. Resident Indian only (non-residents refer to SRM's international portal).
 * 4. Physics and Mathematics mandatory for General engineering programmes.
 * 5. Biotechnology / Biomedical group accepts PCM, PMB, PCB, or Botany & Zoology.
 *    Non-math entrants must take an additional 4-credit Mathematics course in year 1.
 * 6. IB and GCE A-level follow specialized equivalence criteria (refer to SRM's page).
 * 7. Privacy: 100% client-side execution, zero network requests, zero storage.
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
  | 'Botany and Zoology';

export interface EligibilityInput {
  residentIndian: boolean;
  qualifyingBoard: QualifyingBoard | string;
  class12Status: Class12Status | string;
  examYear: number;
  dateOfBirth: string; // YYYY-MM-DD
  programmeGroup: ProgrammeGroup;
  // Subject selections
  hasPhysics?: boolean; // Default true for general
  hasMathematics?: boolean; // Default true for general
  thirdSubject?: GeneralElectiveSubject | string;
  subjectCombination?: BiotechSubjectCombination | string;
  subjects?: string[]; // Optional explicit list of subjects
  aggregatePercent: number; // 0 to 100, one decimal
}

export type EligibilityStatus = 'meets' | 'does_not_meet' | 'check_srm_page';

export interface EligibilityResult {
  status: EligibilityStatus;
  headline: string;
  reasons: string[];
  ruleText: string;
  sourceStamp: {
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

export const RULE_TEXT_GENERAL =
  'Applicant should have passed in Higher Secondary examination (10+2 pattern) or appearing in Higher Secondary examination in the current academic year with a minimum of 60% aggregate (3 subjects) in Physics (mandatory), Mathematics (mandatory) and at least one of Chemistry / Biotechnology / Biology / Computer Science / Information Technology / Informatics Practices / Engineering Graphics / Botany and Zoology. Resident Indian. Age: at least 16 years and 6 months on 31st July of the exam year.';

export const RULE_TEXT_BIOTECH =
  'Minimum 60% aggregate in PCM / PMB / PCB / PCB or Z (Botany and Zoology). Students who have not studied Mathematics in 10+2 must undertake an additional 4-credit course in Mathematics during the first year. Resident Indian. Age: at least 16 years and 6 months on 31st July of the exam year.';

export const MATH_BRIDGE_NOTE =
  'Students who have not studied Mathematics in 10+2 must undertake an additional 4-credit course in Mathematics during the first year.';

export const MANDATORY_DISCLAIMER =
  'This checks minimum marks and age only; admission is through SRMJEEE (UG); SRM decides.';

export const PRIVACY_NOTICE =
  'Privacy: Nothing is sent, stored or put in the URL. All evaluation runs 100% locally in your browser.';

/**
 * Checks age requirement: At least 16 years 6 months on 31 July of the exam year.
 * Boundary inclusive:
 * On 31 July of Year Y, candidate must have attained 16 years and 6 months.
 * Cutoff birth date: (Y - 16) - 6 months = (Y - 16) January 31st.
 * Example for Y=2026:
 * Cutoff = 2010-01-31.
 * DOB 2010-01-31 -> Exactly 16y 6m on 2026-07-31 -> Eligible.
 * DOB 2010-02-01 -> 16y 5m 30d on 2026-07-31 -> Ineligible.
 */
export function isAgeEligible(
  dobString: string,
  examYear: number
): { isEligible: boolean; cutoffDate: string } {
  if (!dobString || !examYear) {
    return { isEligible: false, cutoffDate: '' };
  }

  // Format cutoff as YYYY-01-31
  const cutoffYear = examYear - 16;
  const cutoffDate = `${cutoffYear}-01-31`;

  // ISO string comparison YYYY-MM-DD works lexicographically
  const isEligible = dobString <= cutoffDate;
  return { isEligible, cutoffDate };
}

/**
 * Evaluates full eligibility against SRMIST 2026-27 rules.
 */
export function checkEligibility(input: EligibilityInput): EligibilityResult {
  const isBiotech = input.programmeGroup === 'biotech';
  const ruleText = isBiotech ? RULE_TEXT_BIOTECH : RULE_TEXT_GENERAL;

  // 1. Check for "Check SRM's page" conditions first:
  // Non-resident Indian, IB, GCE A-level, or unhandled boards
  if (!input.residentIndian) {
    return {
      status: 'check_srm_page',
      headline: "Check SRM's page",
      reasons: [
        "Non-Resident Indian (NRI), PIO, OCI, and international applicants follow SRM's International Admissions criteria and fee structures rather than domestic criteria."
      ],
      ruleText,
      sourceStamp: OFFICIAL_SOURCE,
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
        `Applicants qualifying via ${normalizedBoard} must consult SRM's official admissions office for specialized subject conversions, grade equivalences, and Association of Indian Universities (AIU) certificates.`
      ],
      ruleText,
      sourceStamp: OFFICIAL_SOURCE,
      hasMathNote: false,
      disclaimer: MANDATORY_DISCLAIMER,
      privacyNotice: PRIVACY_NOTICE
    };
  }

  // 2. Validate standard rules: Marks, Age, Subjects
  const failedRules: string[] = [];

  // Marks check: Minimum 60.0% aggregate
  const roundedAggregate = Math.round(input.aggregatePercent * 10) / 10;
  if (roundedAggregate < 60.0) {
    failedRules.push(
      `Aggregate percentage: ${roundedAggregate.toFixed(
        1
      )}% is below SRM's minimum required threshold of 60.0% across the 3 qualifying subjects.`
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
    // Physics and Mathematics are mandatory
    let mathPresent = input.hasMathematics !== false;
    let physicsPresent = input.hasPhysics !== false;

    if (Array.isArray(input.subjects)) {
      mathPresent = input.subjects.some((s) => /math/i.test(s));
      physicsPresent = input.subjects.some((s) => /physics/i.test(s));
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
    // Allowed combinations: PCM, PMB, PCB, Botany & Zoology
    const combo = (input.subjectCombination || '').toUpperCase().trim();
    const hasMathInCombo =
      combo === 'PCM' ||
      combo === 'PMB' ||
      (Array.isArray(input.subjects) &&
        input.subjects.some((s) => /math/i.test(s)));

    if (!hasMathInCombo) {
      // Studied PCB or Botany & Zoology without Mathematics -> meets marks, but needs 4-credit course!
      requiresMathBridge = true;
    }
  }

  // 3. Assemble verdict
  if (failedRules.length > 0) {
    return {
      status: 'does_not_meet',
      headline: 'You do not meet these criteria',
      reasons: failedRules,
      ruleText,
      sourceStamp: OFFICIAL_SOURCE,
      hasMathNote: false,
      disclaimer: MANDATORY_DISCLAIMER,
      privacyNotice: PRIVACY_NOTICE
    };
  }

  // Meets all criteria!
  return {
    status: 'meets',
    headline: "You meet SRM's published minimum criteria",
    reasons: [
      `Your aggregate score of ${roundedAggregate.toFixed(
        1
      )}%, qualifying board (${normalizedBoard}), and date of birth satisfy SRM's published minimum thresholds.`
    ],
    ruleText,
    sourceStamp: OFFICIAL_SOURCE,
    hasMathNote: requiresMathBridge,
    mathNote: requiresMathBridge ? MATH_BRIDGE_NOTE : undefined,
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
    <div class="result-math-note" role="note" aria-label="Mathematics Requirement Note">
      <strong>4-Credit Mathematics Requirement:</strong>
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
        <h4>SRM's Published Rule:</h4>
        <p class="rule-quote">${escapeHtml(result.ruleText)}</p>
        <div class="result-source-row">
          <a class="stamp" href="${escapeHtml(
            result.sourceStamp.url
          )}" target="_blank" rel="noopener">
            ${escapeHtml(result.sourceStamp.label)}
          </a>
          <a class="source-link" href="${escapeHtml(
            result.sourceStamp.url
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

  if (!form || !resultContainer) return;

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

    const formData = new FormData(form);
    const residentVal = formData.get('resident') as string;
    const residentIndian = residentVal === 'yes';

    const board = (formData.get('board') as string) || 'CBSE';
    const status = (formData.get('status') as string) || 'passed';
    const examYear = parseInt((formData.get('examYear') as string) || '2026', 10);
    const dob = (formData.get('dob') as string) || '';
    const group = ((formData.get('programmeGroup') as string) || 'general') as ProgrammeGroup;
    const aggregateStr = (formData.get('aggregate') as string) || '0';
    const aggregatePercent = parseFloat(aggregateStr);

    const hasPhysics = formData.get('hasPhysics') !== 'no';
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
    resultContainer.innerHTML = renderEligibilityResult(result);
    resultContainer.hidden = false;

    // Scroll result into view smoothly
    resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  // Handle Reset
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      form.reset();
      resultContainer.innerHTML = '';
      resultContainer.hidden = true;
      updateGroupVisibility();
    });
  }
}
