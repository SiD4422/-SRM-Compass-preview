import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { spawnSync } from 'node:child_process';

describe('Stage E-2: Tamil Beta, Dual-Build Flag, and Localized Layout', () => {
  const distDir = path.resolve(__dirname, '../dist');

  it('TAMIL_ENABLED build flag defaults to false and excludes /ta routes', () => {
    // Build with default environment (TAMIL_ENABLED not set)
    const envWithoutTamil = { ...process.env };
    delete envWithoutTamil.TAMIL_ENABLED;

    const buildRes = spawnSync('npm', ['run', 'build'], {
      cwd: path.resolve(__dirname, '..'),
      env: envWithoutTamil,
      shell: true,
      encoding: 'utf-8',
      timeout: 120000
    });
    expect(buildRes.status).toBe(0);

    const taDir = path.join(distDir, 'ta');
    expect(fs.existsSync(taDir)).toBe(false);

    // Verify English apply has no hreflang and no toggle
    const applyHtml = fs.readFileSync(path.join(distDir, 'apply/index.html'), 'utf-8');
    expect(applyHtml).not.toContain('hreflang="ta"');
    expect(applyHtml).not.toContain('lang-toggle-link');
    expect(applyHtml).not.toContain('Tamil beta');
  }, 140000);

  it('builds /ta/eligibility and /ta/apply with correct meta and hreflang when TAMIL_ENABLED=true', () => {
    // Build with TAMIL_ENABLED=true
    const buildRes = spawnSync('npm', ['run', 'build'], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, TAMIL_ENABLED: 'true' },
      shell: true,
      encoding: 'utf-8',
      timeout: 120000
    });
    expect(buildRes.status).toBe(0);

    const taEligibilityPath = path.join(distDir, 'ta/eligibility/index.html');
    const taApplyPath = path.join(distDir, 'ta/apply/index.html');

    expect(fs.existsSync(taEligibilityPath)).toBe(true);
    expect(fs.existsSync(taApplyPath)).toBe(true);

    const eligHtml = fs.readFileSync(taEligibilityPath, 'utf-8');
    const applyHtml = fs.readFileSync(taApplyPath, 'utf-8');

    // 1. Check <html lang="ta">
    expect(eligHtml).toMatch(/<html[^>]*lang="ta"/);
    expect(applyHtml).toMatch(/<html[^>]*lang="ta"/);

    // 2. Check hreflang tags on /ta/eligibility
    expect(eligHtml).toContain('rel="alternate" hreflang="en"');
    expect(eligHtml).toContain('rel="alternate" hreflang="ta"');
    expect(eligHtml).toContain('rel="alternate" hreflang="x-default"');

    // 3. Check Visible label 'Tamil beta: eligibility and apply'
    expect(eligHtml).toContain('Tamil beta: eligibility and apply');
    expect(applyHtml).toContain('Tamil beta: eligibility and apply');

    // 4. Check header links that lead to English-only pages get '(English)'
    expect(eligHtml).toContain('புரோகிராம்கள் (English)');
    expect(eligHtml).toContain('ஒப்பீடு (English)');
    expect(eligHtml).toContain('கதைகள் (English)');

    // 5. Wrap each verbatim SRM English text on Tamil pages in lang="en"
    expect(eligHtml).toMatch(/<div[^>]*lang="en"[^>]*>[\s\S]*?Applicant should have passed[\s\S]*?<\/div>/);
    expect(eligHtml).toMatch(/<div[^>]*lang="en"[^>]*>[\s\S]*?Minimum 60% aggregate in PCM[\s\S]*?<\/div>/);

    // 6. Check short Tamil summary beside verbatim rules
    expect(eligHtml).toContain('எங்கள் சுருக்கம்; SRM-இன் ஆங்கில உரையே இறுதியானது');
  }, 70000);

  it('includes both /ta routes in sitemap with bidirectional alternates when TAMIL_ENABLED=true', () => {
    const sitemapPath = path.join(distDir, 'sitemap-0.xml');
    expect(fs.existsSync(sitemapPath)).toBe(true);

    const sitemapContent = fs.readFileSync(sitemapPath, 'utf-8');
    expect(sitemapContent).toContain('/ta/eligibility/');
    expect(sitemapContent).toContain('/ta/apply/');
    expect(sitemapContent).toContain('hreflang="ta"');
    expect(sitemapContent).toContain('hreflang="en"');
  });

  it('guarantees client-side bundle size on /ta/eligibility is under 6 kB gzip', () => {
    const astroDir = path.join(distDir, '_astro');
    const files = fs.readdirSync(astroDir);
    const taBundle = files.find(f => f.startsWith('TamilEligibility') && f.endsWith('.js'));
    expect(taBundle).toBeDefined();

    const zlib = require('zlib');
    const bundleContent = fs.readFileSync(path.join(astroDir, taBundle!));
    const gzipped = zlib.gzipSync(bundleContent);
    expect(gzipped.length).toBeLessThan(6144);
  });

  it('scans /ta/eligibility and /ta/apply for English sentence leaks outside allow-list', () => {
    const taEligibilityPath = path.join(distDir, 'ta/eligibility/index.html');
    const taApplyPath = path.join(distDir, 'ta/apply/index.html');

    const ALLOW_LIST_WORDS = new Set([
      'srm', 'srmist', 'srmjeee', 'srmjeel', 'srmjeem', 'srmjeeh',
      'btech', 'mtech', 'barch', 'march', 'mba', 'mbbs', 'bds', 'tech', 'arch',
      'cbse', 'icse', 'isce', 'nios', 'gce', 'dghs', 'mcc',
      'neet', 'nata', 'pgeta', 'clat', 'cat', 'xat', 'mat', 'gmat', 'nmat', 'cmat', 'tancet',
      'pcm', 'pmb', 'pcb', 'level', 'state', 'board', 'main', 'github',
      'physics', 'chemistry', 'mathematics', 'biology', 'biotechnology', 'biomedical',
      'computer', 'science', 'engineering', 'information', 'technology',
      'informatics', 'practices', 'graphics', 'botany', 'zoology',
      'english', 'tamil', 'beta', 'eligibility', 'apply',
      'post', 'method', 'url', 'https', 'email', 'tel', 'com', 'edu', 'in', 'india',
      'official', 'final', 'summary', 'note', 'view', 'phase'
    ]);

    for (const p of [taEligibilityPath, taApplyPath]) {
      const html = fs.readFileSync(p, 'utf-8');

      // Strip script, style, elements explicitly marked lang="en", tags, and HTML entities
      const cleanText = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<([a-z0-9]+)[^>]*\blang=["']en["'][^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-zA-Z0-9#]+;/g, ' ');

      // Extract words with 4+ English letters
      const words = cleanText.match(/[A-Za-z]{4,}/g) || [];
      for (const word of words) {
        const lower = word.toLowerCase();
        const isAllowed = ALLOW_LIST_WORDS.has(lower) ||
          lower.includes('srm') ||
          lower.includes('jeee') ||
          lower.includes('english') ||
          lower.includes('admissions');
        
        if (!isAllowed) {
          console.error(`[Leak Check Error] Unexpected English word in ${path.basename(p)}: "${word}"`);
        }
        expect(isAllowed).toBe(true);
      }
    }
  });

  it('restores default TAMIL_ENABLED=false build and verifies byte-identical visible text', () => {
    // Rebuild with TAMIL_ENABLED=false (default)
    const buildRes = spawnSync('npm', ['run', 'build'], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, TAMIL_ENABLED: 'false' },
      shell: true,
      encoding: 'utf-8',
      timeout: 120000
    });
    expect(buildRes.status).toBe(0);

    // Verify /ta directory does not exist
    const taDir = path.join(distDir, 'ta');
    expect(fs.existsSync(taDir)).toBe(false);

    // Run baseline comparison script across all 10 routes
    const runnerScript = path.resolve(__dirname, 'compare_stage_e1_visible_text.py');
    const result = spawnSync('python', [runnerScript], {
      encoding: 'utf-8',
      timeout: 45000
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('ALL PAGES VERIFIED: 100% BYTE-IDENTICAL VISIBLE TEXT CONTENT');
  }, 140000);
});
