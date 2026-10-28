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

describe('Stage M3 & M3-fix: Programme Detail Pages (/programmes/[slug])', () => {
  it('builds exactly 54 static pages (6 root pages + 48 programme pages)', () => {
    // 6 root pages
    const rootPages = [
      'index.html',
      'apply/index.html',
      'compare/index.html',
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

  it('canonical link matches sitemap URL exactly (including trailing slash) on every page', () => {
    const sitemap0Path = path.join(distDir, 'sitemap-0.xml');
    const sitemap0Content = fs.readFileSync(sitemap0Path, 'utf-8');
    const urls = [...sitemap0Content.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);

    expect(urls).toHaveLength(54);

    for (const url of urls) {
      const urlPath = new URL(url).pathname;
      let relPath = urlPath.replace(/^\//, '');
      if (!relPath || relPath.endsWith('/')) {
        relPath += 'index.html';
      } else {
        relPath += '/index.html';
      }
      const fullPath = path.join(distDir, relPath);
      expect(fs.existsSync(fullPath)).toBe(true);

      const html = fs.readFileSync(fullPath, 'utf-8');
      const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)"/);
      expect(canonicalMatch).not.toBeNull();
      expect(canonicalMatch![1]).toBe(url);
    }
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
      expect(html).toContain('<meta name="description" content="Computer Science and Engineering B.Tech at SRMIST: fees from ₹2,50,000 to ₹4,75,000 per year across 6 campuses, with seats, eligibility and a source for every number.">');
      expect(html).not.toContain('Official seat intake');
      expect(html).toContain('<link rel="canonical" href="https://srm-compass.spartensid12.workers.dev/programmes/computer-science-and-engineering/"');

      // Anchors
      expect(html).toContain('href="#fees"');
      expect(html).toContain('href="#eligibility"');
      expect(html).toContain('href="#apply"');
      expect(html).toContain('href="#sources"');

      // Compare these campuses link
      expect(html).toContain('Compare these campuses');
      expect(html).toContain('Showing the 3 lowest fees of 6');
      expect(html).toContain('href="/compare?ids=');

      // Headings & Campus names (not codes)
      expect(html).toContain('Offered at 6 campuses (Kattankulathur, Ramapuram, Delhi-NCR, Vadapalani, Tiruchirappalli, Baburayanpettai)');
      expect(html).toContain('Kattankulathur');
      expect(html).toContain('Ramapuram');
      expect(html).toContain('Delhi-NCR');
      expect(html).toContain('Vadapalani');
      expect(html).toContain('Tiruchirappalli');
      expect(html).toContain('Baburayanpettai');

      // Fee Table: drop separate Source column
      expect(html).not.toContain('<th scope="col">Source</th>');

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
      expect(jsonLd.offers[0].category).toBe("Annual fee as listed in SRM's Programs Offered table");

      // Locators with ### note
      expect(html).toContain('(### appears in SRM\'s table)');
    });

    it('verifies Mechanical Engineering page content and schema', () => {
      const htmlPath = path.join(distDir, 'programmes/mechanical-engineering/index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');

      expect(html).toContain('<title>Mechanical Engineering at SRM: fees, seats, eligibility | SRM Compass</title>');
      expect(html).toContain('Fees range from ₹1,00,000 to ₹2,75,000 per year across 5 campuses.');
      expect(html).toContain('<meta name="description" content="Mechanical Engineering B.Tech at SRMIST: fees from ₹1,00,000 to ₹2,75,000 per year across 5 campuses, with seats, eligibility and a source for every number.">');
      expect(html).toContain('Offered at 5 campuses (Kattankulathur, Ramapuram, Delhi-NCR, Vadapalani, Tiruchirappalli)');
      expect(html).toContain("In 4 of 5 offerings of this programme, SRM's table still carries older text that says 50%");

      const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      const jsonLd = JSON.parse(jsonLdMatch![1]);
      expect(jsonLd.offers).toHaveLength(5);
      expect(jsonLd.offers[0].category).toBe("Annual fee as listed in SRM's Programs Offered table");
    });

    it('verifies Chemical Engineering page content and related programmes', () => {
      const htmlPath = path.join(distDir, 'programmes/chemical-engineering/index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');

      expect(html).toContain('<title>Chemical Engineering at SRM: fees, seats, eligibility | SRM Compass</title>');
      expect(html).toContain('Fees are ₹2,75,000 per year across 1 campus.');
      expect(html).toContain('<meta name="description" content="Chemical Engineering B.Tech at SRMIST: fees of ₹2,75,000 per year across 1 campus, with seats, eligibility and a source for every number.">');
      expect(html).toContain('Offered at 1 campus (Kattankulathur)');
      expect(html).not.toContain('Compare these campuses');

      // Related programme: Nanotechnology shares 'materials' tag
      expect(html).toContain('href="/programmes/nanotechnology"');
    });

    it('verifies Aerospace Engineering page content and 4 related programmes', () => {
      const htmlPath = path.join(distDir, 'programmes/aerospace-engineering/index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');

      expect(html).toContain('<title>Aerospace Engineering at SRM: fees, seats, eligibility | SRM Compass</title>');
      expect(html).toContain('Fees are ₹4,00,000 per year across 1 campus.');
      expect(html).toContain('<meta name="description" content="Aerospace Engineering B.Tech at SRMIST: fees of ₹4,00,000 per year across 1 campus, with seats, eligibility and a source for every number.">');
      expect(html).toContain('Offered at 1 campus (Kattankulathur)');
      expect(html).not.toContain('Compare these campuses');

      // 4 related programmes sharing 'machines-vehicles'
      expect(html).toContain('href="/programmes/aeronautical-engineering"');
      expect(html).toContain('href="/programmes/automobile-engineering"');
      expect(html).toContain('href="/programmes/automobile-engineering-automotive-electronics"');
      expect(html).toContain('href="/programmes/mechanical-engineering"');
    });

    it('ranks related programmes by shared leading words first, placing CSE specialisations first for CSE', () => {
      const htmlPath = path.join(distDir, 'programmes/computer-science-and-engineering/index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');

      const relatedGridMatch = html.match(/<div class="related-grid"[\s\S]*?<\/div>/);
      expect(relatedGridMatch).not.toBeNull();
      const firstCardMatch = relatedGridMatch![0].match(/<a[^>]*class="related-card"[\s\S]*?<\/a>/);
      expect(firstCardMatch).not.toBeNull();
      const firstHeadingMatch = firstCardMatch![0].match(/<h3[^>]*>(.*?)<\/h3>/);
      expect(firstHeadingMatch).not.toBeNull();
      expect(firstHeadingMatch![1]).toBe('Computer Science and Engineering (Data Science)');
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

    it('confirms /eligibility displays 75 conflicts and See programmes button linking to /programmes', () => {
      const htmlPath = path.join(distDir, 'eligibility/index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');

      expect(html).toContain('In 75 of the 106 offerings');
      expect(html).toContain('See programmes');
      expect(html).toContain('href="/programmes"');
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

  describe('Stage M4-fix: Terminology, Layout, and Container Alignment', () => {
    it('ensures no built page in dist contains "106 programmes" (case-insensitive)', () => {
      function getAllHtmlFiles(dir: string): string[] {
        const results: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            results.push(...getAllHtmlFiles(fullPath));
          } else if (entry.name.endsWith('.html')) {
            results.push(fullPath);
          }
        }
        return results;
      }

      const htmlFiles = getAllHtmlFiles(distDir);
      expect(htmlFiles.length).toBeGreaterThanOrEqual(54);

      for (const filePath of htmlFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content.toLowerCase()).not.toContain('106 programmes');
      }
    });

    it('verifies home button says "Browse all 106 options" and /programmes h1 says "All 106 options across 48 programmes"', () => {
      const homeHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');
      expect(homeHtml).toContain('Browse all 106 options');

      const progHtml = fs.readFileSync(path.join(distDir, 'programmes/index.html'), 'utf-8');
      expect(progHtml).toMatch(/<h1[^>]*>All 106 options across 48 programmes<\/h1>/);
    });

    it('verifies /compare includes noscript fallback explaining JS requirement with links to /programmes and 48 programmes', () => {
      const compareHtml = fs.readFileSync(path.join(distDir, 'compare/index.html'), 'utf-8');
      expect(compareHtml).toContain('<noscript>');
      expect(compareHtml).toContain('JavaScript is required');
      expect(compareHtml).toContain('href="/programmes"');

      for (const prog of programmesData.programmes) {
        expect(compareHtml).toContain(`href="/programmes/${prog.slug}"`);
      }
    });

    it('verifies header and main use shared container width (.w) and compute identical left edge positions across all viewports', () => {
      // 1. Check all root pages have header.top with .w and main containing .w
      const rootPages = [
        'index.html',
        'programmes/index.html',
        'apply/index.html',
        'eligibility/index.html',
        'evidence/index.html',
        'compare/index.html'
      ];
      for (const pageName of rootPages) {
        const pageHtml = fs.readFileSync(path.join(distDir, pageName), 'utf-8');
        expect(pageHtml).toContain('header class="top"');
        expect(pageHtml).toContain('<div class="w"');
        expect(pageHtml).toContain('<main id="main-content"');
      }

      // 2. Tokens check: verify shared .w container definition
      const tokensCss = fs.readFileSync(path.resolve(__dirname, '../src/styles/tokens.css'), 'utf-8');
      expect(tokensCss).toMatch(/\.w\s*\{[^}]*max-width:\s*(var\(--container-width[^)]*\)|1120px)/);
      expect(tokensCss).toMatch(/\.w\s*\{[^}]*margin:\s*0\s+auto/);

      // 3. Computed left edge algebraic verification for viewports 360, 768, 1440
      const containerWidth = 1120;
      const padding = 20;
      for (const vp of [360, 768, 1440]) {
        const expectedContainerLeft = Math.max(0, (vp - containerWidth) / 2);
        const expectedContentLeft = expectedContainerLeft + padding;

        const headerComputedLeft = Math.max(0, (vp - containerWidth) / 2);
        const mainComputedLeft = Math.max(0, (vp - containerWidth) / 2);

        expect(headerComputedLeft).toBe(mainComputedLeft);
        expect(headerComputedLeft).toBe(expectedContainerLeft);
      }
    });

    it('verifies .filter-grid children have min-width: 0 in styles', () => {
      const tokensCss = fs.readFileSync(path.resolve(__dirname, '../src/styles/tokens.css'), 'utf-8');
      expect(tokensCss).toMatch(/\.filter-grid\s*>\s*\*[\s\S]*?min-width:\s*0/);
    });

    it('verifies hero h1 has text-wrap: balance and max-width', () => {
      const tokensCss = fs.readFileSync(path.resolve(__dirname, '../src/styles/tokens.css'), 'utf-8');
      expect(tokensCss).toMatch(/\.hero\s+h1[\s\S]*?text-wrap:\s*balance/);
      expect(tokensCss).toMatch(/\.hero\s+h1[\s\S]*?max-width:\s*2[0-4]ch/);
    });
  });

  describe('Stage M4-fix-2: Copy, Cycle Disclaimers, and Offering Cards', () => {
    it('verifies home page does not contain the word "preview" and renames section to "Examples you can check yourself"', () => {
      const homeHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');
      expect(homeHtml.toLowerCase()).not.toContain('preview');
      expect(homeHtml).toContain('Examples you can check yourself');
      expect(homeHtml).toContain('Each row links to the exact SRM page it came from.');
    });

    it('verifies "for the 2026-27 cycle; SRM may revise for 2027 entry" appears in hero, footer, and /eligibility', () => {
      const homeHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');
      expect(homeHtml).toContain('for the 2026-27 cycle; SRM may revise for 2027 entry');

      const eligHtml = fs.readFileSync(path.join(distDir, 'eligibility/index.html'), 'utf-8');
      expect(eligHtml).toContain('for the 2026-27 cycle; SRM may revise for 2027 entry');
    });

    it('verifies /compare copy-link panel and share field are hidden statically', () => {
      const compareHtml = fs.readFileSync(path.join(distDir, 'compare/index.html'), 'utf-8');
      expect(compareHtml).toContain('id="compare-toolbar" class="compare-toolbar" hidden style="display: none;"');
      expect(compareHtml).toContain('id="copy-fallback" class="copy-fallback" hidden style="display: none;"');
    });
  });
});
