import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  filterOfferings,
  sortOfferings,
  matchesSearch,
  type OfferingItem
} from '../src/lib/filter';

const offerings: OfferingItem[] = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../data/offerings.json'), 'utf-8')
);

const tagsData = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../data/tags.json'), 'utf-8')
);

const synonyms = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../data/synonyms.json'), 'utf-8')
);

const tagsByOffering: Record<string, string[]> = tagsData.by_offering;

describe('M2 Programme Finder Filter & Search Engine', () => {
  it('loads all 106 offerings without any filter', () => {
    const results = filterOfferings(offerings, {});
    expect(results).toHaveLength(106);
  });

  describe('Taxonomy Tag Filter (hand-calculated expected counts)', () => {
    // Expected counts derived from direct inspection of data/tags.json
    const expectedTagCounts: Record<string, number> = {
      'circuits-power': 19,
      'code-ai': 62,
      'machines-vehicles': 16,
      'robots-automation': 5,
      'health-bio': 13,
      'build-infrastructure': 3,
      'data-business': 17,
      'materials': 2
    };

    for (const [tag, expectedCount] of Object.entries(expectedTagCounts)) {
      it(`filters by tag '${tag}' expecting exactly ${expectedCount} offerings`, () => {
        const results = filterOfferings(offerings, { tag, tagsByOffering });
        expect(results).toHaveLength(expectedCount);
      });
    }
  });

  describe('Campus Filter (hand-calculated expected counts)', () => {
    const expectedCampusCounts: Record<string, number> = {
      KTR: 44,
      RMP: 18,
      Trichy: 20,
      NCR: 11,
      VDP: 11,
      BAB: 2
    };

    for (const [campus, expectedCount] of Object.entries(expectedCampusCounts)) {
      it(`filters by campus '${campus}' expecting exactly ${expectedCount} offerings`, () => {
        const results = filterOfferings(offerings, { campuses: [campus] });
        expect(results).toHaveLength(expectedCount);
      });
    }

    it('combines multiple campuses using OR logic', () => {
      const results = filterOfferings(offerings, { campuses: ['NCR', 'VDP'] });
      expect(results).toHaveLength(11 + 11); // 22
    });
  });

  describe('Annual Fee Boundary Filter (hand-calculated expected counts)', () => {
    it('filters minimum fee >= 1,00,000 (all 106 offerings)', () => {
      const results = filterOfferings(offerings, { minFee: 100000 });
      expect(results).toHaveLength(106);
    });

    it('filters minimum fee >= 2,50,000 expecting 82 offerings', () => {
      const results = filterOfferings(offerings, { minFee: 250000 });
      expect(results).toHaveLength(82);
    });

    it('filters minimum fee >= 4,00,000 expecting 21 offerings', () => {
      const results = filterOfferings(offerings, { minFee: 400000 });
      expect(results).toHaveLength(21);
    });

    it('filters maximum fee <= 1,50,000 expecting 7 offerings', () => {
      const results = filterOfferings(offerings, { maxFee: 150000 });
      expect(results).toHaveLength(7);
    });

    it('filters maximum fee <= 2,50,000 expecting 39 offerings', () => {
      const results = filterOfferings(offerings, { maxFee: 250000 });
      expect(results).toHaveLength(39);
    });

    it('filters fee range 2,00,000 to 2,50,000', () => {
      const results = filterOfferings(offerings, { minFee: 200000, maxFee: 250000 });
      // In range [200k, 250k]: exactly 26 offerings
      expect(results).toHaveLength(26);
    });
  });

  describe('Search Engine & Synonym Expansion (hand-calculated expected counts)', () => {
    const expectedQueryCounts: Record<string, number> = {
      eee: 3,
      ece: 14,
      cse: 44,
      it: 3,
      ai: 13,
      aiml: 8,
      ml: 8,
      vlsi: 3,
      iot: 3,
      bme: 5,
      mech: 11,
      auto: 5,
      biotech: 8,
      robotics: 3,
      cyber: 6,
      data: 20,
      civil: 3,
      chemical: 1,
      nanotechnology: 1,
      aerospace: 2,
      mechatronics: 2,
      'cse ktr': 14,
      'civil rmp': 1,
      'eee trichy': 1,
      nonexistentterm123: 0
    };

    for (const [query, expectedCount] of Object.entries(expectedQueryCounts)) {
      it(`searches '${query}' expecting exactly ${expectedCount} offerings`, () => {
        const results = filterOfferings(offerings, { q: query, synonyms });
        expect(results).toHaveLength(expectedCount);
      });
    }

    it('prevents substring false positives for 2-letter query "it"', () => {
      // Must not match "with" or "security"
      const results = filterOfferings(offerings, { q: 'it', synonyms });
      expect(results.every((o) => {
        const text = `${o.programme} ${o.campus} ${o.department?.value ?? ''}`.toLowerCase();
        return text.includes('information technology') || /\bit\b/i.test(text);
      })).toBe(true);
      expect(results).toHaveLength(3);
    });

    it('prevents substring false positives for "iot" in "biotechnology"', () => {
      const results = filterOfferings(offerings, { q: 'iot', synonyms });
      expect(results.some((o) => o.id === 'ktr-biotechnology')).toBe(false);
      expect(results).toHaveLength(3);
    });
  });

  describe('Compound Filter Scenarios', () => {
    it('combines tag=health-bio AND campus=Trichy', () => {
      const results = filterOfferings(offerings, {
        tag: 'health-bio',
        campuses: ['Trichy'],
        tagsByOffering
      });
      // Trichy has: biomedical, biotechnology, biotech food tech, CSE w/s in medical eng = 4
      expect(results).toHaveLength(4);
    });

    it('combines tag=build-infrastructure AND campus=KTR', () => {
      const results = filterOfferings(offerings, {
        tag: 'build-infrastructure',
        campuses: ['KTR'],
        tagsByOffering
      });
      expect(results).toHaveLength(2);
    });

    it('combines search="cse" AND fee >= 400000', () => {
      const results = filterOfferings(offerings, {
        q: 'cse',
        minFee: 400000,
        synonyms
      });
      expect(results).toHaveLength(14);
    });

    it('returns empty array when filters eliminate all offerings', () => {
      const results = filterOfferings(offerings, {
        campuses: ['BAB'],
        tag: 'health-bio',
        tagsByOffering
      });
      expect(results).toHaveLength(0);
    });
  });

  describe('Sorting Logic', () => {
    it('sorts prog-asc by default (programme A-Z then campus A-Z)', () => {
      const sorted = sortOfferings(offerings, 'prog-asc');
      expect(sorted[0].programme).toBe('Aeronautical Engineering');
      expect(sorted[sorted.length - 1].programme).toBe('Software product Engineering');
    });

    it('sorts fee-asc (lowest annual fee first)', () => {
      const sorted = sortOfferings(offerings, 'fee-asc');
      expect(sorted[0].annual_fee.value).toBe(100000);
      expect(sorted[sorted.length - 1].annual_fee.value).toBe(475000);
    });

    it('sorts fee-desc (highest annual fee first)', () => {
      const sorted = sortOfferings(offerings, 'fee-desc');
      expect(sorted[0].annual_fee.value).toBe(475000);
      expect(sorted[sorted.length - 1].annual_fee.value).toBe(100000);
    });

    it('sorts seats-desc (highest intake first)', () => {
      const sorted = sortOfferings(offerings, 'seats-desc');
      expect(sorted[0].intake.value).toBe(1140); // KTR CSE
      expect(sorted[sorted.length - 1].intake.value).toBe(30);
    });
  });
});
