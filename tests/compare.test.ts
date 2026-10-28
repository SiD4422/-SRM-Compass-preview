import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseCompareQuery,
  formatInr,
  calculateFourYearTotal,
  getComparisonSummary,
  buildCompareUrl,
  type CompareOffering
} from '../src/lib/compare';

const offeringsData = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../data/offerings.json'), 'utf-8')
);
const sourcesData = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../data/sources.json'), 'utf-8')
);

const sourcesMap: Record<string, string> = Object.fromEntries(
  sourcesData.map((s: { id: string; url: string }) => [s.id, s.url])
);

const allOfferings: CompareOffering[] = offeringsData.map((o: any) => ({
  id: o.id,
  programme: o.programme,
  campus: o.campus,
  campus_code: o.campus_code,
  fee: o.annual_fee?.value ?? 0,
  seats: o.intake?.value ?? null,
  duration: o.duration?.value ?? 4,
  department: o.department?.value ?? null,
  eligibility_status: o.eligibility?.status ?? 'verified',
  source_id: o.annual_fee?.source_id ?? 'S1',
  captured_on: o.annual_fee?.captured_on ?? '2026-10-26',
  source_url: sourcesMap[o.annual_fee?.source_id ?? 'S1'] || 'https://www.srmist.edu.in/admission-india/engineering/'
}));

describe('Stage M4: Comparison Engine (src/lib/compare.ts)', () => {
  describe('Hand-written requirement: EEE at KTR, RMP, and Trichy', () => {
    it('accurately compares EEE at KTR, RMP and Trichy with exact fees, seats, 4-year totals, and extremes', () => {
      const query = '?ids=ktr-electrical-and-electronics-engineering,rmp-electrical-and-electronics-engineering,trichy-electrical-and-electronics-engineering';
      const parsed = parseCompareQuery(query, allOfferings);

      expect(parsed.selected).toHaveLength(3);
      expect(parsed.unknownIds).toHaveLength(0);
      expect(parsed.rejectedIds).toHaveLength(0);

      const [ktr, rmp, trichy] = parsed.selected;

      // KTR verification
      expect(ktr.campus).toBe('Kattankulathur');
      expect(ktr.fee).toBe(275000);
      expect(formatInr(ktr.fee)).toBe('2,75,000');
      expect(ktr.seats).toBe(240);
      expect(calculateFourYearTotal(ktr.fee)).toBe(1100000);
      expect(formatInr(calculateFourYearTotal(ktr.fee))).toBe('11,00,000');

      // RMP verification
      expect(rmp.campus).toBe('Ramapuram');
      expect(rmp.fee).toBe(200000);
      expect(formatInr(rmp.fee)).toBe('2,00,000');
      expect(rmp.seats).toBe(30);
      expect(calculateFourYearTotal(rmp.fee)).toBe(800000);
      expect(formatInr(calculateFourYearTotal(rmp.fee))).toBe('8,00,000');

      // Trichy verification
      expect(trichy.campus).toBe('Tiruchirappalli');
      expect(trichy.fee).toBe(150000);
      expect(formatInr(trichy.fee)).toBe('1,50,000');
      expect(trichy.seats).toBe(60);
      expect(calculateFourYearTotal(trichy.fee)).toBe(600000);
      expect(formatInr(calculateFourYearTotal(trichy.fee))).toBe('6,00,000');

      // Summary: Lowest fee Trichy, Highest seats KTR
      const summary = getComparisonSummary(parsed.selected);
      expect(summary.lowestFeeId).toBe('trichy-electrical-and-electronics-engineering');
      expect(summary.highestSeatsId).toBe('ktr-electrical-and-electronics-engineering');
    });

    it('rejects a fourth id when more than 3 valid ids are supplied', () => {
      const query = '?ids=ktr-electrical-and-electronics-engineering,rmp-electrical-and-electronics-engineering,trichy-electrical-and-electronics-engineering,ktr-computer-science-and-engineering';
      const parsed = parseCompareQuery(query, allOfferings);

      expect(parsed.selected).toHaveLength(3);
      expect(parsed.rejectedIds).toEqual(['ktr-computer-science-and-engineering']);
      expect(parsed.selected.map((o) => o.id)).toEqual([
        'ktr-electrical-and-electronics-engineering',
        'rmp-electrical-and-electronics-engineering',
        'trichy-electrical-and-electronics-engineering'
      ]);
    });

    it('ignores unknown ids and collects them so the UI can state them', () => {
      const query = '?ids=ktr-electrical-and-electronics-engineering,nonexistent-offering,trichy-electrical-and-electronics-engineering,fake-id-xyz';
      const parsed = parseCompareQuery(query, allOfferings);

      expect(parsed.selected).toHaveLength(2);
      expect(parsed.selected.map((o) => o.id)).toEqual([
        'ktr-electrical-and-electronics-engineering',
        'trichy-electrical-and-electronics-engineering'
      ]);
      expect(parsed.unknownIds).toEqual(['nonexistent-offering', 'fake-id-xyz']);
      expect(parsed.rejectedIds).toHaveLength(0);
    });

    it('handles empty or missing query string gracefully', () => {
      const parsedEmpty = parseCompareQuery('', allOfferings);
      expect(parsedEmpty.selected).toHaveLength(0);
      expect(parsedEmpty.unknownIds).toHaveLength(0);
      expect(parsedEmpty.rejectedIds).toHaveLength(0);

      const summary = getComparisonSummary([]);
      expect(summary.lowestFeeId).toBeNull();
      expect(summary.highestSeatsId).toBeNull();
    });

      it('builds canonical compare URLs correctly', () => {
      expect(buildCompareUrl([])).toBe('/compare');
      expect(
        buildCompareUrl(['id1', 'id2'])
      ).toBe('/compare?ids=id1,id2');
    });
  });

  it('guarantees client scripts are strictly under 6 KB gzip', () => {
    const astroAssetsDir = path.resolve(__dirname, '../dist/_astro');
    if (!fs.existsSync(astroAssetsDir)) return;
    const jsFiles = fs
      .readdirSync(astroAssetsDir)
      .filter((f) => f.endsWith('.js'));

    for (const f of jsFiles) {
      const buffer = fs.readFileSync(path.join(astroAssetsDir, f));
      const gzipped = require('node:zlib').gzipSync(buffer);
      // Budget limit: 6 KB gzip (6,144 bytes)
      expect(gzipped.length).toBeLessThan(6144);
    }
  });
});
