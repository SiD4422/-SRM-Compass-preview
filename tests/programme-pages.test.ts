import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const distDir = path.resolve(__dirname, '../dist');
const programmesData = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../data/programmes.json'), 'utf-8')
);
const offeringsData = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../data/offerings.json'), 'utf-8')
);

describe('Stage M3: Programme Detail Pages (/programmes/[slug])', () => {
  it('builds exactly 53 static pages (5 root pages + 48 programme pages)', () => {
    // 5 root pages
    const rootPages = [
      'index.html',
      'apply/index.html',
      'eligibility/index.html',
      'evidence/index.html',
      'programmes/index.html'
    ];
    for (const p of rootPages) {
      expect(fs.existsSync(path.join(distDir, p))).toBe(true);
    }

    // 48 programme pages
    expect(programmesData.programmes).toHaveLength(48);
    for (const prog of programmesData.programmes) {
      const pagePath = path.join(distDir, `programmes/${prog.slug}/index.html`);
      expect(fs.existsSync(pagePath)).toBe(true);
    }
  });

  it('generates sitemap-index.xml and sitemap-0.xml with site URL', () => {
    const sitemapPath = path.join(distDir, 'sitemap-index.xml');
    expect(fs.existsSync(sitemapPath)).toBe(true);
    const content = fs.readFileSync(sitemapPath, 'utf-8');
    expect(content).toContain('sitemap-0.xml');

    const sitemap0Path = path.join(distDir, 'sitemap-0.xml');
    expect(fs.existsSync(sitemap0Path)).toBe(true);
    const sitemap0Content = fs.readFileSync(sitemap0Path, 'utf-8');
    expect(sitemap0Content).toContain('https://srm-compass.spartensid12.workers.dev/programmes/');
  });

  it('guarantees ZERO client JavaScript on all 48 programme pages', () => {
    for (const prog of programmesData.programmes) {
      const htmlPath = path.join(distDir, `programmes/${prog.slug}/index.html`);
      const html = fs.readFileSync(htmlPath, 'utf-8');

      // Match all script tags
      const scriptMatches = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
      for (const match of scriptMatches) {
        const attrs = match[1];
        // Only application/ld+json is allowed
        expect(attrs).toContain('application/ld+json');
      }
    }
  });

  it('guarantees page HTML size is strictly under 25 KB gzip for all 48 pages', () => {
    for (const prog of programmesData.programmes) {
      const htmlPath = path.join(distDir, `programmes/${prog.slug}/index.html`);
      const rawBuffer = fs.readFileSync(htmlPath);
      const gzipped = zlib.gzipSync(rawBuffer);

      // Budget limit: 25 KB gzip (25,600 bytes)
      expect(gzipped.length).toBeLessThan(25600);
    }
  });

  describe('Hand-calculated benchmark verifications', () => {
    it('verifies Computer Science and Engineering page content and schema', () => {
      const htmlPath = path.join(distDir, 'programmes/computer-science-and-engineering/index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');

      // Title & Meta
      expect(html).toContain('<title>Computer Science and Engineering at SRM: fees, seats, eligibility | SRM Compass</title>');
      expect(html).toContain('Fees range from ₹2,50,000 to ₹4,75,000 per year across 6 campuses.');
      expect(html).toContain('<link rel="canonical" href="https://srm-compass.spartensid12.workers.dev/programmes/computer-science-and-engineering"');

      // Anchors
      expect(html).toContain('href="#fees"');
      expect(html).toContain('href="#eligibility"');
      expect(html).toContain('href="#apply"');
      expect(html).toContain('href="#sources"');

      // Headings & Campuses
      expect(html).toContain('Offered at 6 campuses (KTR, RMP, NCR, VDP, Trichy, BAB)');
      expect(html).toContain('Kattankulathur');
      expect(html).toContain('Ramapuram');
      expect(html).toContain('Delhi-NCR');
      expect(html).toContain('Vadapalani');
      expect(html).toContain('Tiruchirappalli');
      expect(html).toContain('Baburayanpettai');

      // Eligibility conflict text
      expect(html).toContain("In 5 of 6 offerings of this programme, SRM's table still carries older text that says 50%");

      // JSON-LD
      const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      expect(jsonLdMatch).not.toBeNull();
      const jsonLd = JSON.parse(jsonLdMatch![1]);

      expect(jsonLd['@type']).toBe('EducationalOccupationalProgram');
      expect(jsonLd.name).toBe('Computer Science and Engineering');
      expect(jsonLd.educationalProgramMode).toBe('full-time');
      expect(jsonLd.timeToComplete).toBe('P4Y');
      expect(jsonLd.provider.name).toBe('SRM Institute of Science and Technology');
      expect(jsonLd.offers).toHaveLength(6);
      expect(jsonLd.offers[0].priceCurrency).toBe('INR');
      expect(jsonLd.offers[0].price).toBe(475000); // KTR CSE fee
    });

    it('verifies Mechanical Engineering page content and schema', () => {
      const htmlPath = path.join(distDir, 'programmes/mechanical-engineering/index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');

      expect(html).toContain('<title>Mechanical Engineering at SRM: fees, seats, eligibility | SRM Compass</title>');
      expect(html).toContain('Fees range from ₹1,00,000 to ₹2,75,000 per year across 5 campuses.');
      expect(html).toContain('Offered at 5 campuses (KTR, RMP, NCR, VDP, Trichy)');
      expect(html).toContain("In 4 of 5 offerings of this programme, SRM's table still carries older text that says 50%");

      const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      const jsonLd = JSON.parse(jsonLdMatch![1]);
      expect(jsonLd.offers).toHaveLength(5);
    });

    it('verifies Chemical Engineering page content and related programmes', () => {
      const htmlPath = path.join(distDir, 'programmes/chemical-engineering/index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');

      expect(html).toContain('<title>Chemical Engineering at SRM: fees, seats, eligibility | SRM Compass</title>');
      expect(html).toContain('Fees are ₹2,75,000 per year across 1 campus.');
      expect(html).toContain('Offered at 1 campus (KTR)');

      // Related programme: only Nanotechnology shares 'materials' tag
      expect(html).toContain('href="/programmes/nanotechnology"');
    });

    it('verifies Aerospace Engineering page content and 4 related programmes', () => {
      const htmlPath = path.join(distDir, 'programmes/aerospace-engineering/index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');

      expect(html).toContain('<title>Aerospace Engineering at SRM: fees, seats, eligibility | SRM Compass</title>');
      expect(html).toContain('Fees are ₹4,00,000 per year across 1 campus.');

      // 4 related programmes sharing 'machines-vehicles'
      expect(html).toContain('href="/programmes/aeronautical-engineering"');
      expect(html).toContain('href="/programmes/automobile-engineering"');
      expect(html).toContain('href="/programmes/automobile-engineering-automotive-electronics"');
      expect(html).toContain('href="/programmes/mechanical-engineering"');
    });

    it('verifies spelling aliases details element on programmes with multiple spellings', () => {
      // Biomedical Engineering has 1 alias (2 ways total)
      const bmeHtml = fs.readFileSync(
        path.join(distDir, 'programmes/biomedical-engineering/index.html'),
        'utf-8'
      );
      expect(bmeHtml).toContain('SRM spells this programme 2 ways');

      // Electronics and Communication Engineering (Data Science) has 4 aliases (5 ways total)
      const eceDsHtml = fs.readFileSync(
        path.join(distDir, 'programmes/electronics-and-communication-engineering-data-science/index.html'),
        'utf-8'
      );
      expect(eceDsHtml).toContain('SRM spells this programme 5 ways');
    });
  });

  describe('Cross-linking from other pages', () => {
    it('links each programme name in /programmes to /programmes/[slug]', () => {
      const htmlPath = path.join(distDir, 'programmes/index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');

      // Must link to programme detail pages
      expect(html).toContain('href="/programmes/computer-science-and-engineering"');
      expect(html).toContain('href="/programmes/electrical-and-electronics-engineering"');
      expect(html).toContain('href="/programmes/mechanical-engineering"');
    });

    it('links each programme heading on the home page to /programmes/[slug]', () => {
      const htmlPath = path.join(distDir, 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');

      expect(html).toContain('href="/programmes/computer-science-and-engineering"');
      expect(html).toContain('href="/programmes/electrical-and-electronics-engineering"');
      expect(html).toContain('href="/programmes/automobile-engineering"');
      expect(html).toContain('href="/programmes/mechatronics-engineering"');
      expect(html).toContain('href="/programmes/biotechnology"');
    });
  });
});
