# Security Policy & Dependency Audit Analysis

## Overview

SRM Compass is an offline-first, pure Static Site Generated (SSG) web application (`output: "static"` in `astro.config.mjs`). It is deployed to Cloudflare Pages as pre-rendered static HTML, CSS, JavaScript, and SVG assets. It has no backend API, no Node.js runtime in production, and accepts no user file uploads.

---

## Dependency Audit (`npm audit`)

As part of security auditing, `npm audit` was evaluated. Eight vulnerability advisories exist in build-time and development tooling:

### 1. Vitest & Tinypool Tooling
- **Advisories:**
  - `GHSA-82fw-gwwq-j7x9` (Arbitrary file read via `@vitest/mocker`)
  - `GHSA-qxg6-89mg-rqv8` (Code injection via manual mock registration)
  - `GHSA-5gmw-xhrv-c9v3` (Tinypool prototype pollution in worker options)
  - `GHSA-85c8-ppgw-ccpr` (Tinypool prototype pollution in `run()` options)
- **Classification:** Development and CI toolchain only (`devDependencies`).
- **Production Assessment:** Vitest and Tinypool run only during local testing (`npm test`) and in CI pipelines. They are not bundled into `dist/`. No lines of Vitest or Tinypool code execute at the edge or run in user browsers.

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
- **Classification:** Server-side runtime and dynamic SSR features.
- **Production Assessment:**
  1. **Static Pre-Rendering:** SRM Compass runs in static mode. There is no active Node.js server, no Astro SSR adapter, and no dynamic server-side route handling in production.
  2. **No Server Islands:** The application does not use server islands or server-side cookies.
  3. **No Dynamic Prop Reflection:** Dynamic user input is never interpolated into template prop names or component slot names.
  4. **No External Media Processing:** No user-submitted image assets are processed.
  5. **Client Sanitization:** Client utilities run in the browser using explicit sanitization (`escapeHtml()` in `src/lib/compare.ts` and `textContent` in `src/lib/eligibility.ts`).

### 3. Development Server (`esbuild`)
- **Advisories:** `GHSA-g7r4-m6w7-qqqr` (Arbitrary file read on Windows development server).
- **Classification:** Local development web server.
- **Production Assessment:** Affects `astro dev` on local machines when exposed to local networks. The production build serves static files from the edge.

### 4. Sharp & Image Dependencies
- **Advisories:**
  - `CVE-2026-33327`, `CVE-2026-33328`, `CVE-2026-35590`, `CVE-2026-35591` (libvips)
  - `GHSA-g89c-p67h-r497`, `GHSA-2jg2-4ch7-h545` (libheif)
  - `CVE-2026-96889` (librsvg)
- **Classification:** Build-time image transformation.
- **Production Assessment:** Sharp executes during build time only. The site provides no image upload or dynamic image resizing endpoints.

### 5. Schema Validation (`zod`)
- **Advisories:** `GHSA-mrhx-c7xc-m3w5` (Memory consumption via oversized collections).
- **Classification:** Schema parsing library.
- **Production Assessment:** Zod is used during build time to validate static collections. No runtime endpoints accept external JSON payloads.

---

## Production Security Headers

The real headers deployed via `public/_headers`:

```http
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'none';
  Strict-Transport-Security: max-age=31536000
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), camera=(), microphone=()

/_astro/*
  Cache-Control: public, max-age=31536000, immutable
```

---

## Privacy Architecture

- **Client-Side Execution:** The eligibility checker runs in the user's browser without storing data in `localStorage`, `sessionStorage`, cookies, or URL search parameters.
- **Form Method Isolation:** The eligibility form specifies `method="post"` and keeps the submit button disabled in static HTML until client JavaScript initialises, preventing academic marks or dates of birth from appearing in HTTP GET query parameters.
