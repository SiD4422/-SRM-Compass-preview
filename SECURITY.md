# Security Policy & Vulnerability Audit Analysis

## Overview

SRM Compass is architected as an offline-first, pure Static Site Generated (SSG) web application (`output: "static"` in `astro.config.mjs`). It is deployed to Cloudflare Workers / Cloudflare Pages as pre-rendered static HTML, CSS, JavaScript, and SVG assets. It has no backend API, no Node.js server in production, and accepts no user file uploads.

---

## Dependency Vulnerability Audit (`npm audit`)

As part of the Stage A Security Verification, `npm audit` was evaluated. Eight vulnerability advisories were identified in build-time and development tooling. A dedicated upgrade branch (`deps-upgrade`) was tested with major version bumps (`astro@7.4.4`, `vitest@5.0.5`). While all 166 automated tests passed, the major framework upgrade altered HTML rendering semantics (whitespace minification, asset bundle hashes, internal data attributes) across all 62 static pages. Per project policy, zero unintended HTML churn is permitted.

Below is an engineering analysis detailing each advisory and why it poses **zero threat** to the static production deployment:

### 1. Vitest & Tinypool Tooling
- **Advisories:**
  - `GHSA-82fw-gwwq-j7x9` (Arbitrary file read via `@vitest/mocker`)
  - `GHSA-qxg6-89mg-rqv8` (Code injection via manual mock registration)
  - `GHSA-5gmw-xhrv-c9v3` (Tinypool prototype pollution in worker options)
  - `GHSA-85c8-ppgw-ccpr` (Tinypool prototype pollution in `run()` options)
- **Classification:** Development / CI toolchain only (`devDependencies`).
- **Why it does not affect production:** Vitest and Tinypool run strictly during local testing (`npm test`) and in CI pipelines. They are never compiled, packaged, or shipped in the production `dist/` directory. Zero lines of Vitest or Tinypool code are executed by Cloudflare or served to website visitors.

### 2. Astro Framework Core
- **Advisories:**
  - `GHSA-j687-52p2-xcff` (XSS in `define:vars` via incomplete `</script>` sanitization)
  - `GHSA-xr5h-phrj-8vxv` (Server island encrypted parameter replay)
  - `GHSA-jrpj-wcv7-9fh9`, `GHSA-f48w-9m4c-m7f5` (Spread props attribute name XSS)
  - `GHSA-7pw4-f3q4-r2p2`, `GHSA-4g3v-8h47-v7g6` (View Transitions animation properties XSS)
  - `GHSA-2pvr-wf23-7pc7` (Host header SSRF in prerendered error page fetch)
  - `GHSA-8hv8-536x-4wqp` (Reflected XSS via slot name)
  - `GHSA-26w7-cxv4-gfx2` (Remote code execution through AVIF image optimization)
  - `GHSA-376h-93r7-7g6f` (Authorization bypass when stripping base URL)
  - `GHSA-98hj-9722-w3j8` (XSS via unescaped script/style in JSX/MDX)
- **Classification:** Server-side runtime & SSR-specific features.
- **Why it does not affect production:**
  1. **Pure Static SSG:** SRM Compass operates in 100% static mode. There is no active Node.js server, no Astro SSR runtime adapter, and no server-side route handling in production.
  2. **No Server Islands:** The application does not use Astro Server Islands (`server:defer`) or server-side encrypted cookies/parameters.
  3. **No Dynamic Prop Reflection:** Dynamic user input is never interpolated into template prop names, component slot names, or `define:vars`. All templates use static props or local JSON datasets (`data/offerings.json`, `data/sources.json`, `data/programmes.json`).
  4. **No User Media Ingestion:** No user-submitted AVIF or external image assets are processed. All site media consist of audited, version-controlled static SVGs and images.
  5. **Client-Side Defense-in-Depth:** All dynamic client features (Search, Campus Filters, Compare Matrix, Eligibility Calculator) execute in the browser using explicit sanitization (`escapeHtml()` in `src/lib/compare.ts` and `textContent` in `src/lib/eligibility.ts`).

### 3. esbuild Dev Server
- **Advisories:** `GHSA-g7r4-m6w7-qqqr` (Arbitrary file read on Windows development server).
- **Classification:** Local development web server.
- **Why it does not affect production:** This vulnerability only affects `astro dev` running locally on a developer's machine when exposed to untrusted local networks. The production build uses pre-compiled static files hosted on Cloudflare's global edge network.

### 4. Sharp & Image Dependencies
- **Advisories:**
  - `CVE-2026-33327`, `CVE-2026-33328`, `CVE-2026-35590`, `CVE-2026-35591` (libvips)
  - `GHSA-g89c-p67h-r497`, `GHSA-2jg2-4ch7-h545` (libheif)
  - `CVE-2026-96889` (librsvg)
- **Classification:** Image transformation engine.
- **Why it does not affect production:** Sharp is executed at build time only. SRM Compass does not provide user image upload capabilities or dynamic image resizing endpoints.

### 5. Zod Schema Validation
- **Advisories:** `GHSA-mrhx-c7xc-m3w5` (Memory exhaustion via oversized collections).
- **Classification:** Schema parsing library.
- **Why it does not affect production:** Zod is utilized solely during the build process to validate static content collection configurations. No runtime endpoints accept external JSON payloads.

---

## Production Security Posture & Hardening

SRM Compass implements strict production security controls configured via `public/_headers` (deployed to Cloudflare Workers static edge):

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'none'
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=(), microphone=()
```

- **Zero-Storage Privacy Model:** The eligibility checker runs 100% client-side without storing data in `localStorage`, `sessionStorage`, cookies, or URL search parameters.
- **No-JS URL Leakage Protection:** The eligibility form enforces `method="post"` and has its submit button disabled in static HTML until client JavaScript initialises, preventing accidental transmission of academic marks or dates of birth via HTTP GET query parameters.
