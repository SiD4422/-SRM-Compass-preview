export interface Fact<T = unknown> {
  value: T;
  unit?: string;
  status: 'verified' | 'conflict' | 'unverified' | string;
  source_id?: string;
  captured_on?: string;
  locator?: string;
  conflicts_with?: {
    source_id: string;
    value: unknown;
  };
}

export interface OfferingItem {
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
  quality_notes?: string[];
  [key: string]: unknown;
}

export interface FilterOptions {
  q?: string;
  tag?: string | null;
  campuses?: string[];
  minFee?: number | null;
  maxFee?: number | null;
  sort?: string;
  tagsByOffering?: Record<string, string[]>;
  synonyms?: Record<string, string[]>;
}

export type SortOrder = 'prog-asc' | 'fee-asc' | 'fee-desc' | 'seats-desc';

/**
 * Checks if targetText matches an individual word or its synonyms.
 * Short abbreviations (<= 3 chars) match word boundaries to prevent false positives
 * (e.g. 'it' inside 'with' or 'iot' inside 'biotechnology'),
 * while longer query words match as standard substrings.
 */
export function matchesWord(
  targetText: string,
  word: string,
  synonyms: Record<string, string[]> = {}
): boolean {
  const w = word.toLowerCase().trim();
  if (!w) return true;

  // 1. Check synonym expansions
  if (synonyms[w]) {
    for (const phrase of synonyms[w]) {
      if (targetText.includes(phrase.toLowerCase())) {
        return true;
      }
    }
  }

  // 2. Check the query word itself
  if (w.length <= 3) {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(targetText)) {
      return true;
    }
  } else {
    if (targetText.includes(w)) {
      return true;
    }
  }

  return false;
}

/**
 * Search logic per prompt:
 * Lowercase, split into words; every word must match programme, campus, or department;
 * a word found in synonyms.json expands to an OR of its phrases; no fuzzy matching.
 */
export function matchesSearch(
  offering: OfferingItem,
  query: string,
  synonyms: Record<string, string[]> = {}
): boolean {
  if (!query || !query.trim()) return true;

  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const deptVal = offering.department?.value ?? '';
  const targetText = `${offering.programme} ${offering.campus} ${offering.campus_code} ${deptVal}`.toLowerCase();

  for (const word of words) {
    if (!matchesWord(targetText, word, synonyms)) {
      return false; // Logical AND across words
    }
  }

  return true;
}

/**
 * Filter an array of offerings by search query, tag, campuses, and fee boundaries.
 */
export function filterOfferings(
  offerings: OfferingItem[],
  options: FilterOptions
): OfferingItem[] {
  const {
    q = '',
    tag = null,
    campuses = [],
    minFee = null,
    maxFee = null,
    tagsByOffering = {},
    synonyms = {}
  } = options;

  const activeCampuses = new Set(campuses.map((c) => c.toUpperCase()));
  const hasCampuses = activeCampuses.size > 0;

  return offerings.filter((offering) => {
    // 1. Campus filter
    if (hasCampuses && !activeCampuses.has(offering.campus_code.toUpperCase())) {
      return false;
    }

    // 2. Tag filter
    if (tag) {
      const assignedTags = tagsByOffering[offering.id] || [];
      if (!assignedTags.includes(tag)) {
        return false;
      }
    }

    // 3. Fee range filter
    const fee = offering.annual_fee?.value;
    if (typeof fee === 'number') {
      if (minFee !== null && minFee !== undefined && fee < minFee) {
        return false;
      }
      if (maxFee !== null && maxFee !== undefined && fee > maxFee) {
        return false;
      }
    }

    // 4. Search query filter
    if (q && !matchesSearch(offering, q, synonyms)) {
      return false;
    }

    return true;
  });
}

/**
 * Sorts offerings according to the specified sort order.
 * Default is programme A-Z, then campus code.
 */
export function sortOfferings(
  offerings: OfferingItem[],
  sortOrder: SortOrder | string = 'prog-asc'
): OfferingItem[] {
  const sorted = [...offerings];

  sorted.sort((a, b) => {
    switch (sortOrder) {
      case 'fee-asc': {
        const diff = (a.annual_fee?.value ?? 0) - (b.annual_fee?.value ?? 0);
        if (diff !== 0) return diff;
        return a.programme.localeCompare(b.programme);
      }
      case 'fee-desc': {
        const diff = (b.annual_fee?.value ?? 0) - (a.annual_fee?.value ?? 0);
        if (diff !== 0) return diff;
        return a.programme.localeCompare(b.programme);
      }
      case 'seats-desc': {
        const diff = (b.intake?.value ?? 0) - (a.intake?.value ?? 0);
        if (diff !== 0) return diff;
        return a.programme.localeCompare(b.programme);
      }
      case 'prog-asc':
      default: {
        const progDiff = a.programme.localeCompare(b.programme);
        if (progDiff !== 0) return progDiff;
        return a.campus_code.localeCompare(b.campus_code);
      }
    }
  });

  return sorted;
}
