/**
 * SRM Compass - Eligibility Evaluation Engine (Tamil Localized Runtime)
 * Milestone 5 / Stage E-2
 *
 * Implements SRMIST's official 2026-2027 B.Tech eligibility criteria in Tamil:
 * 1. 100% localized result headlines, reasons, and field validation messages.
 * 2. Verbatim SRM English rules strictly preserved and wrapped in lang="en".
 * 3. Concise Tamil summary beside verbatim rules labeled:
 *    "எங்கள் சுருக்கம்; SRM-இன் ஆங்கில உரையே இறுதியானது".
 * 4. Separate bundle ensures client script stays < 6 kB gzip.
 */

import {
  type EligibilityInput,
  type EligibilityResult,
  type ProgrammeGroup,
  checkEligibility,
  RULE_TEXT_GENERAL,
  RULE_TEXT_BIOTECH
} from './eligibility';

export const SUMMARY_LABEL_TA = 'எங்கள் சுருக்கம்; SRM-இன் ஆங்கில உரையே இறுதியானது';
export const GENERAL_SUMMARY_TA =
  'விண்ணப்பதாரர் 10+2 முறையில் இயற்பியல் (கட்டாயம்), கணிதம் (கட்டாயம்) மற்றும் வேதியியல்/உயிரித்தொழில்நுட்பம்/உயிரியல்/கணினி அறிவியல் உள்ளிட்ட ஏதேனும் ஒரு தகுதிப் பாடத்தில் குறைந்தது 60% மொத்த மதிப்பெண் பெற்றிருக்க வேண்டும்.';
export const BIOTECH_SUMMARY_TA =
  'PCM / PMB / PCB / PCB அல்லது Z ஆகியவற்றில் குறைந்தது 60% மொத்த மதிப்பெண். 10+2-ல் கணிதம் படிக்காத மாணவர்கள் முதல் ஆண்டில் கூடுதல் 4-கிரெடிட் கணிதப் பாடத்தை எடுக்க வேண்டும்.';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderEligibilityResultTa(result: EligibilityResult, input?: EligibilityInput): string {
  if (result.status === 'error') {
    const errorList = Object.values(result.fieldErrors || {})
      .map((err) => {
        let taErr = err;
        if (err.includes('valid finite number')) {
          taErr = 'மொத்த சதவீத மதிப்பெண் ஒரு செல்லுபடியாகும் எண்ணாக இருக்க வேண்டும்.';
        } else if (err.includes('between 0.0 and 100.0')) {
          taErr = 'மொத்த சதவீத மதிப்பெண் 0.0 முதல் 100.0 வரை இருக்க வேண்டும்.';
        } else if (err.includes('Date of birth is required')) {
          taErr = 'பிறந்த தேதி கட்டாயமாகும்.';
        } else if (err.includes('valid calendar date')) {
          taErr = 'பிறந்த தேதி YYYY-MM-DD வடிவத்தில் செல்லுபடியாகும் தேதியாக இருக்க வேண்டும்.';
        }
        return `<li>${escapeHtml(taErr)}</li>`;
      })
      .join('');

    return `
      <div class="result-card verdict-error" role="alert">
        <div class="result-header">
          <span class="result-badge">பிழை</span>
          <h3 class="result-headline">படிவப் பிழைகளைச் சரிசெய்யவும்</h3>
        </div>
        <p class="error-intro">பின்வரும் படிவப் பிழைகள் சரிசெய்யப்படும் வரை தகுதியை மதிப்பீடு செய்ய முடியாது:</p>
        <ul class="result-reasons error-reasons">
          ${errorList}
        </ul>
      </div>
    `;
  }

  const badgeClass =
    result.status === 'meets'
      ? 'verdict-meets'
      : result.status === 'does_not_meet'
        ? 'verdict-does-not-meet'
        : 'verdict-refer';

  const badgeText =
    result.status === 'meets'
      ? 'அளவுகோல்களைப் பூர்த்தி செய்கிறது'
      : result.status === 'does_not_meet'
        ? 'பூர்த்தி செய்யவில்லை'
        : 'SRM தளத்தைப் பார்க்கவும்';

  let headlineTa = result.headline;
  if (result.status === 'meets') {
    headlineTa = 'SRM-இன் வெளியிடப்பட்ட குறைந்தபட்ச அளவுகோல்களைப் பூர்த்தி செய்கிறீர்கள்';
  } else if (result.status === 'does_not_meet') {
    headlineTa = 'நீங்கள் இந்த அளவுகோல்களைப் பூர்த்தி செய்யவில்லை';
  } else if (result.status === 'check_srm_page') {
    headlineTa = 'SRM-இன் அதிகாரப்பூர்வ பக்கத்தைப் பார்க்கவும்';
  }

  // Localize reason lines
  const reasonsHtml = result.reasons
    .map((r) => {
      let rTa = r;
      if (r.includes('below SRM\'s minimum required threshold of 60.0%')) {
        const percentMatch = r.match(/([0-9.]+)%/);
        const p = percentMatch ? percentMatch[1] : '';
        rTa = `மொத்த சதவீதம்: ${p}% என்பது 3 தகுதிப் பாடங்களில் SRM-இன் குறைந்தபட்ச தேவையான 60.0% வரம்பை விடக் குறைவாக உள்ளது.`;
      } else if (r.includes('qualifying threshold of 60.0%')) {
        const percentMatch = r.match(/score of ([0-9.]+)%/);
        const p = percentMatch ? percentMatch[1] : '';
        rTa = `உங்கள் மொத்த மதிப்பெண் ${p}% குறைந்தபட்சத் தேவையான 60.0% வரம்பைப் பூர்த்தி செய்கிறது.`;
      } else if (r.includes('Age threshold:')) {
        rTa = `வயதுத் தேவை: தேர்வு ஆண்டின் ஜூலை 31-ஆம் தேதிக்குள் உங்களுக்கு குறைந்தது 16 ஆண்டுகள் 6 மாதங்கள் பூர்த்தியாகியிருக்க வேண்டும்.`;
      } else if (r.includes('Mandatory subjects:')) {
        rTa = `கட்டாயப் பாடங்கள்: பொதுப் பொறியியல் புரோகிராம்களுக்கு இயற்பியல் மற்றும் கணிதம் கட்டாயமாகும்.`;
      } else if (r.includes('Non-Resident Indian (NRI)')) {
        rTa = `வெளிநாடு வாழ் இந்தியர் (NRI), PIO, OCI மற்றும் சர்வதேச விண்ணப்பதாரர்கள் SRM-இன் சர்வதேச சேர்க்கை இணையதளம் மூலம் விண்ணப்பிக்க வேண்டும்.`;
      } else if (r.includes('Candidates qualifying from')) {
        rTa = `தேர்ந்தெடுக்கப்பட்ட வாரியத்தில் தேர்ச்சி பெற்ற மாணவர்கள் சேர்க்கைத் தேவைகள் மற்றும் பாடச் சமநிலைக்கு SRM-இன் இணையதளத்தைப் பார்க்கவும்.`;
      }
      return `<li>${escapeHtml(rTa)}</li>`;
    })
    .join('');

  const isBiotech = input?.programmeGroup === 'biotech';
  const verbatimRule = isBiotech ? RULE_TEXT_BIOTECH : RULE_TEXT_GENERAL;
  const summaryRule = isBiotech ? BIOTECH_SUMMARY_TA : GENERAL_SUMMARY_TA;

  return `
    <div class="result-card ${badgeClass}">
      <div class="result-header">
        <span class="result-badge">${escapeHtml(badgeText)}</span>
        <h3 class="result-headline">${escapeHtml(headlineTa)}</h3>
      </div>

      <ul class="result-reasons">
        ${reasonsHtml}
      </ul>

      <!-- Dual rule display: short Tamil summary alongside verbatim SRM English -->
      <div class="result-rule">
        <h4>SRM-இன் விதி, சுருக்கமாக</h4>
        <div class="rule-summary-callout">
          <span class="summary-badge-inline">${escapeHtml(SUMMARY_LABEL_TA)}</span>
          <p class="rule-summary-text">${escapeHtml(summaryRule)}</p>
        </div>
        <div class="verbatim-srm-container" lang="en">
          <span class="verbatim-badge-inline">SRM Official English (Final)</span>
          <blockquote class="rule-quote">${escapeHtml(verbatimRule)}</blockquote>
        </div>
        <div class="rule-line"><strong>குடியுரிமை:</strong> இந்தியக் குடியுரிமை பெற்றவர்கள் மட்டுமே.</div>
        <div class="rule-line"><strong>வயது வரம்பு:</strong> தேர்வு ஆண்டின் ஜூலை 31-ஆம் தேதிக்குள் குறைந்தது 16 ஆண்டுகள் 6 மாதங்கள்.</div>
        <div class="result-source-row">
          <span>ஆதாரம்:</span>
          <a class="source-link" href="https://www.srmist.edu.in/admission-india/engineering/" target="_blank" rel="noopener noreferrer">
            அதிகாரப்பூர்வ SRM சேர்க்கைப் பக்கம் ↗
          </a>
        </div>
      </div>

      <div class="result-disclaimer">
        <p><strong>குறிப்பு:</strong> இது குறைந்தபட்ச மதிப்பெண்கள் மற்றும் வயதை மட்டுமே சரிபார்க்கிறது; சேர்க்கை SRMJEEE (UG) மூலமாக நடைபெறும்; SRM முடிவே இறுதியானது.</p>
        <p class="result-privacy">தனியுரிமை: எதுவும் அனுப்பப்படவோ, சேமிக்கப்படவோ அல்லது முகவரியில் (URL) சேர்க்கப்படவோ இல்லை. அனைத்து மதிப்பீடுகளும் 100% உங்கள் உலாவியிலேயே இயங்குகின்றன.</p>
      </div>
    </div>
  `;
}

export function initEligibilityCheckerTa(): void {
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
  const submitBtn = document.getElementById('checker-submit-btn') as HTMLButtonElement | null;

  if (!form || !resultContainer) return;

  if (submitBtn) {
    submitBtn.disabled = false;
  }

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

  form.addEventListener('submit', (event) => {
    event.preventDefault();
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

    if (result.status === 'error' && result.fieldErrors) {
      if (result.fieldErrors.aggregate && aggregateInput && aggregateErrorEl) {
        aggregateInput.classList.add('input-has-error');
        aggregateErrorEl.textContent = 'மொத்த சதவீத மதிப்பெண் ஒரு செல்லுபடியாகும் எண்ணாக (0-100) இருக்க வேண்டும்.';
        aggregateErrorEl.hidden = false;
      }
      if (result.fieldErrors.dob && dobInput && dobErrorEl) {
        dobInput.classList.add('input-has-error');
        dobErrorEl.textContent = 'பிறந்த தேதி கட்டாயமாகும் (YYYY-MM-DD வடிவம்).';
        dobErrorEl.hidden = false;
      }
    }

    resultContainer.innerHTML = renderEligibilityResultTa(result, input);
    resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      form.reset();
      clearInlineErrors();
      resultContainer.innerHTML = '';
      updateGroupVisibility();
    });
  }
}
