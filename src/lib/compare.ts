export interface CompareOffering {
  id: string;
  programme: string;
  campus: string;
  campus_code: string;
  fee: number;
  seats: number | null;
  duration: number;
  department: string | null;
  eligibility_status: 'verified' | 'conflict';
  source_id: string;
  captured_on: string;
  source_url: string;
}

export interface ParseResult {
  selected: CompareOffering[];
  unknownIds: string[];
  rejectedIds: string[];
}

export interface ComparisonSummary {
  lowestFeeId: string | null;
  highestSeatsId: string | null;
}

export function formatInr(val: number | null | undefined): string {
  if (typeof val !== 'number' || isNaN(val)) return 'Not listed';
  const s = Math.round(val).toString();
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  let rest = s.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest.length > 0) parts.unshift(rest);
  return `${parts.join(',')},${last3}`;
}

export function calculateFourYearTotal(fee: number): number {
  return fee * 4;
}

export function parseCompareQuery(
  queryStringOrParams: string | URLSearchParams,
  offerings: CompareOffering[] | Map<string, CompareOffering>
): ParseResult {
  const map: Map<string, CompareOffering> =
    offerings instanceof Map
      ? offerings
      : new Map(offerings.map((o) => [o.id, o]));

  let rawIdsParam = '';
  if (typeof queryStringOrParams === 'string') {
    const q = queryStringOrParams.startsWith('?')
      ? queryStringOrParams.slice(1)
      : queryStringOrParams;
    const params = new URLSearchParams(q);
    rawIdsParam = params.get('ids') || '';
  } else {
    rawIdsParam = queryStringOrParams.get('ids') || '';
  }

  const rawTokens = rawIdsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const uniqueTokens: string[] = [];
  for (const token of rawTokens) {
    if (!seen.has(token)) {
      seen.add(token);
      uniqueTokens.push(token);
    }
  }

  const selected: CompareOffering[] = [];
  const unknownIds: string[] = [];
  const rejectedIds: string[] = [];

  for (const id of uniqueTokens) {
    const offering = map.get(id);
    if (!offering) {
      unknownIds.push(id);
    } else {
      if (selected.length < 3) {
        selected.push(offering);
      } else {
        rejectedIds.push(id);
      }
    }
  }

  return { selected, unknownIds, rejectedIds };
}

export function getComparisonSummary(offerings: CompareOffering[]): ComparisonSummary {
  if (offerings.length === 0) {
    return { lowestFeeId: null, highestSeatsId: null };
  }

  let lowestFee = Infinity;
  let lowestFeeId: string | null = null;
  for (const o of offerings) {
    if (typeof o.fee === 'number' && o.fee < lowestFee) {
      lowestFee = o.fee;
      lowestFeeId = o.id;
    }
  }

  let highestSeats = -1;
  let highestSeatsId: string | null = null;
  for (const o of offerings) {
    if (typeof o.seats === 'number' && o.seats > highestSeats) {
      highestSeats = o.seats;
      highestSeatsId = o.id;
    }
  }

  return { lowestFeeId, highestSeatsId };
}

export function buildCompareUrl(ids: string[]): string {
  if (ids.length === 0) return '/compare';
  return `/compare?ids=${ids.join(',')}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderCompareGrid(
  offerings: CompareOffering[],
  summary: ComparisonSummary
): string {
  return `
    <div class="compare-grid columns-${offerings.length}" role="region" aria-label="Programmes comparison table">
      ${offerings
        .map((o) => {
          const isLowestFee = o.id === summary.lowestFeeId;
          const isHighestSeats = o.id === summary.highestSeatsId;
          const fourYearTotal = calculateFourYearTotal(o.fee);

          return `
            <article class="compare-card" data-id="${escapeHtml(o.id)}">
              <header class="card-head">
                <div class="card-head-info">
                  <h2 class="card-programme">${escapeHtml(o.programme)}</h2>
                  <div class="card-campus">
                    <strong>${escapeHtml(o.campus)}</strong>
                    <span class="campus-pill">${escapeHtml(o.campus_code)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  class="btn-remove-offering"
                  data-id="${escapeHtml(o.id)}"
                  aria-label="Remove ${escapeHtml(o.programme)} at ${escapeHtml(o.campus)} from comparison"
                >
                  Remove
                </button>
              </header>

              <div class="card-rows">
                <div class="compare-row">
                  <span class="row-label">Annual fee</span>
                  <div class="row-val">
                    <div class="val-main fee-highlight">
                      ₹${formatInr(o.fee)} <span class="val-sub">/ year</span>
                    </div>
                    ${
                      isLowestFee
                        ? `<span class="badge-extreme badge-lowest">Lowest fee</span>`
                        : ''
                    }
                    <div class="source-stamp">
                      <a href="${escapeHtml(o.source_url)}" target="_blank" rel="noopener">
                        [${escapeHtml(o.source_id)}] (${escapeHtml(o.captured_on)})
                      </a>
                    </div>
                  </div>
                </div>

                <div class="compare-row">
                  <span class="row-label">Four-year total</span>
                  <div class="row-val">
                    <div class="val-main total-highlight">
                      ₹${formatInr(fourYearTotal)}
                    </div>
                    <p class="estimate-note">
                      Estimate: assumes the fee stays the same; hostel and one-time charges not in SRM's table
                    </p>
                  </div>
                </div>

                <div class="compare-row">
                  <span class="row-label">Seats</span>
                  <div class="row-val">
                    <div class="val-main">
                      ${o.seats !== null ? formatInr(o.seats) : '<span class="muted-text">Not listed</span>'}
                    </div>
                    ${
                      isHighestSeats
                        ? `<span class="badge-extreme badge-highest">Highest seats</span>`
                        : ''
                    }
                  </div>
                </div>

                <div class="compare-row">
                  <span class="row-label">Duration</span>
                  <div class="row-val">
                    <div class="val-main">${o.duration} years</div>
                  </div>
                </div>

                <div class="compare-row">
                  <span class="row-label">Department</span>
                  <div class="row-val">
                    ${
                      o.department
                        ? `<div class="val-main">${escapeHtml(o.department)}</div>`
                        : `<span class="muted-text">Not confirmed in SRM's table</span>`
                    }
                  </div>
                </div>

                <div class="compare-row">
                  <span class="row-label">Eligibility</span>
                  <div class="row-val">
                    <p class="elig-rule">Min 60% aggregate in qualifying subjects (PCM / PMB).</p>
                    ${
                      o.eligibility_status === 'conflict'
                        ? `<p class="conflict-note">
                            <strong>Note:</strong> In SRM's fee table, older text still says 50% (<a href="/eligibility">conflict</a>).
                          </p>`
                        : `<p class="verified-note">Verified 60% rule</p>`
                    }
                  </div>
                </div>

                <div class="compare-row">
                  <span class="row-label">Source check</span>
                  <div class="row-val">
                    <a href="${escapeHtml(o.source_url)}" target="_blank" rel="noopener" class="source-link">
                      SRMIST Programs Offered table (${escapeHtml(o.captured_on)})
                    </a>
                  </div>
                </div>
              </div>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}

export function initComparePage(): void {
  const dataScript = document.getElementById('compare-data');
  if (!dataScript) return;

  let allOfferings: CompareOffering[] = [];
  try {
    allOfferings = JSON.parse(dataScript.textContent || '[]');
  } catch (e) {
    console.error('Failed to parse compare data', e);
    return;
  }

  const offeringsMap = new Map<string, CompareOffering>(
    allOfferings.map((o) => [o.id, o])
  );

  const container = document.getElementById('compare-container');
  const emptyState = document.getElementById('compare-empty');
  const noticeEl = document.getElementById('compare-notice');
  const liveRegion = document.getElementById('compare-live-region');
  const toolbar = document.getElementById('compare-toolbar');
  const copyBtn = document.getElementById('copy-link-btn');
  const copyStatus = document.getElementById('copy-status');
  const copyFallback = document.getElementById('copy-fallback');
  const copyFallbackInput = document.getElementById(
    'copy-fallback-input'
  ) as HTMLInputElement | null;

  function render() {
    const { selected, unknownIds, rejectedIds } = parseCompareQuery(
      window.location.search,
      offeringsMap
    );

    // Notices for unknown or rejected IDs
    const notices: string[] = [];
    if (unknownIds.length > 0) {
      notices.push(`Ignored unknown offering ID(s): ${unknownIds.join(', ')}.`);
    }
    if (rejectedIds.length > 0) {
      notices.push(`Maximum 3 offerings allowed. Omitted: ${rejectedIds.join(', ')}.`);
    }

    if (noticeEl) {
      if (notices.length > 0) {
        noticeEl.textContent = notices.join(' ');
        noticeEl.hidden = false;
      } else {
        noticeEl.textContent = '';
        noticeEl.hidden = true;
      }
    }

    if (selected.length === 0) {
      if (toolbar) toolbar.hidden = true;
      if (container) {
        container.innerHTML = '';
        container.hidden = true;
      }
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (emptyState) emptyState.hidden = true;
    if (toolbar) toolbar.hidden = false;
    if (container) container.hidden = false;

    const summary = getComparisonSummary(selected);

    // Build comparison HTML
    if (container) {
      container.innerHTML = renderCompareGrid(selected, summary);

      // Attach remove listeners
      const removeBtns = container.querySelectorAll<HTMLButtonElement>(
        '.btn-remove-offering'
      );
      removeBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const idToRemove = btn.getAttribute('data-id');
          if (!idToRemove) return;
          const newIds = selected
            .map((o) => o.id)
            .filter((id) => id !== idToRemove);
          const newUrl = buildCompareUrl(newIds);
          window.history.pushState(null, '', newUrl);
          if (liveRegion) {
            const removed = selected.find((o) => o.id === idToRemove);
            liveRegion.textContent = `Removed ${removed?.programme ?? ''} at ${
              removed?.campus ?? ''
            } from comparison.`;
          }
          render();
        });
      });
    }
  }

  // Copy link handler
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const fullUrl = window.location.href;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(fullUrl);
          if (copyStatus) {
            copyStatus.textContent = 'Link copied to clipboard!';
            setTimeout(() => {
              if (copyStatus) copyStatus.textContent = '';
            }, 3000);
          }
        } else {
          showFallback(fullUrl);
        }
      } catch (err) {
        showFallback(fullUrl);
      }
    });
  }

  function showFallback(url: string) {
    if (copyFallback && copyFallbackInput) {
      copyFallback.hidden = false;
      copyFallbackInput.value = url;
      copyFallbackInput.focus();
      copyFallbackInput.select();
      if (copyStatus) {
        copyStatus.textContent = 'Press Ctrl+C to copy link';
      }
    }
  }

  window.addEventListener('popstate', render);

  // Initial render
  render();
}
