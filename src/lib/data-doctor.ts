import offeringsData from '../../data/offerings.json';
import programmesData from '../../data/programmes.json';
import sourcesData from '../../data/sources.json';
import storiesData from '../../data/stories.json';
import applyRoutesData from '../../data/apply_routes.json';

export interface DataDoctorReport {
  totalOfferings: number;
  totalProgrammes: number;
  multiCampusProgrammes: number;
  eligibilityConflicts: number;
  blankDepartments: number;
  nameVariantProgrammes: number;
  qualityNotesRows: number;
}

export interface AggregatedSource {
  id: string;
  title: string;
  url: string;
  captured_on: string;
  kind?: string;
  note?: string;
}

export interface ContradictionItem {
  id: string;
  topic: string;
  claimA: {
    claim: string;
    source_id: string;
    captured_on: string;
    url: string;
  };
  claimB: {
    claim: string;
    source_id: string;
    captured_on: string;
    url: string;
  };
  scope: string;
  verdict: string;
}

export function computeDataDoctorReport(): DataDoctorReport {
  const offerings = offeringsData as any[];
  const programmes = (programmesData as any).programmes || [];

  const totalOfferings = offerings.length;
  const totalProgrammes = programmes.length;

  let multiCampusProgrammes = 0;
  for (const prog of programmes) {
    const matching = offerings.filter(
      (o) => o.programme === prog.name || (prog.aliases && prog.aliases.includes(o.programme))
    );
    const campuses = new Set(matching.map((o) => o.campus_code));
    if (campuses.size > 1) {
      multiCampusProgrammes++;
    }
  }

  const eligibilityConflicts = offerings.filter(
    (o) => o.eligibility && o.eligibility.status === 'conflict'
  ).length;

  const blankDepartments = offerings.filter(
    (o) => !o.department || o.department.value === null || o.department.value === undefined
  ).length;

  const nameVariantProgrammes = programmes.filter(
    (p) => p.aliases && p.aliases.length > 0
  ).length;

  const qualityNotesRows = offerings.filter(
    (o) => o.quality_notes && o.quality_notes.length > 0
  ).length;

  return {
    totalOfferings,
    totalProgrammes,
    multiCampusProgrammes,
    eligibilityConflicts,
    blankDepartments,
    nameVariantProgrammes,
    qualityNotesRows,
  };
}

export function getAllSources(): AggregatedSource[] {
  const sList = sourcesData as any[];
  const storySources = (storiesData as any).sources || [];
  const applySource = [(applyRoutesData as any).source];

  const map = new Map<string, AggregatedSource>();

  for (const s of [...sList, ...storySources, ...applySource]) {
    if (s && s.id && !map.has(s.id)) {
      map.set(s.id, {
        id: s.id,
        title: s.title,
        url: s.url,
        captured_on: s.captured_on || '2026-10-26',
        kind: s.kind,
        note: s.note,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const pA = a.id[0];
    const pB = b.id[0];
    if (pA !== pB) return pA.localeCompare(pB);
    return parseInt(a.id.slice(1), 10) - parseInt(b.id.slice(1), 10);
  });
}

export function getContradictions(eligConflictsCount: number): ContradictionItem[] {
  return [
    {
      id: 'eligibility-conflict',
      topic: 'Eligibility Criteria: 60% vs 50% Threshold',
      claimA: {
        claim: 'Minimum 60% aggregate in Physics, Mathematics, and one qualifying subject for B.Tech admission (2026-27 criteria).',
        source_id: 'S2',
        captured_on: '2026-10-26',
        url: 'https://www.srmist.edu.in/admission-india/engineering/',
      },
      claimB: {
        claim: 'Minimum 50% aggregate citing historical SRMJEEE 2022 rules printed directly inside the active Programs Offered table.',
        source_id: 'S1',
        captured_on: '2026-10-26',
        url: 'https://www.srmist.edu.in/admission-india/engineering/',
      },
      scope: `${eligConflictsCount} of 106 offering rows carry this discrepancy in SRM's own published tables.`,
      verdict: 'SRM Compass flags each row as a conflict, warns applicants, and links directly to both sections on SRM\'s site.'
    },
    {
      id: 'nomenclature-conflict',
      topic: 'Programme Nomenclature: Engineering vs Intelligence',
      claimA: {
        claim: 'Listed as "Artificial Engineering & Future Technologies" in the official engineering offerings table.',
        source_id: 'S1',
        captured_on: '2026-10-26',
        url: 'https://www.srmist.edu.in/admission-india/engineering/',
      },
      claimB: {
        claim: 'Listed as "Artificial Intelligence & Future Technologies" across the admissions brochure and department directories.',
        source_id: 'B3',
        captured_on: '2026-10-28',
        url: 'https://webstor.srmist.edu.in/web_assets/downloads/2026/srm-admission-brochure-2026-2027.pdf',
      },
      scope: 'Affects B.Tech Artificial Intelligence & Future Technologies offerings at Ramapuram campus.',
      verdict: 'Compass indexes both names so student search queries succeed regardless of which variant is typed.'
    },
    {
      id: 'nirf-ranking-conflict',
      topic: 'Institutional Ranking: NIRF 2025 vs 2024 Ranking',
      claimA: {
        claim: 'Prominently marketed as NIRF 2025 Ranked 11th in the 2026-2027 Admission Brochure.',
        source_id: 'B3',
        captured_on: '2026-10-28',
        url: 'https://webstor.srmist.edu.in/web_assets/downloads/2026/srm-admission-brochure-2026-2027.pdf',
      },
      claimB: {
        claim: 'Displayed as NIRF Ranked 12th in the 2024 University category on the live online B.Tech application portal.',
        source_id: 'S3',
        captured_on: '2026-10-26',
        url: 'https://applications.srmist.edu.in/btech',
      },
      scope: 'Institutional marketing banner across prospectus vs online application portal.',
      verdict: 'Documented with exact capture timestamps to clarify ranking edition and category differences for prospective students.'
    },
    {
      id: 'placements-scope-conflict',
      topic: 'Placement Statistics: 14,030+ vs 5,700+ Offers Without Stated Scope',
      claimA: {
        claim: 'Headlined as "14,030+ Job Offers" in brochure overview marketing without specifying graduating batch year or campus boundary.',
        source_id: 'B3',
        captured_on: '2026-10-28',
        url: 'https://webstor.srmist.edu.in/web_assets/downloads/2026/srm-admission-brochure-2026-2027.pdf',
      },
      claimB: {
        claim: 'Displayed as "5,700+ Job Offers" on the current B.Tech application header banner with no cohort or scope specified.',
        source_id: 'S3',
        captured_on: '2026-10-26',
        url: 'https://applications.srmist.edu.in/btech',
      },
      scope: 'Campus-wide career marketing claims seen by prospective applicants.',
      verdict: 'Compass highlights that neither number specifies whether it includes off-campus offers, non-engineering faculties, or multi-campus aggregates.'
    }
  ];
}
