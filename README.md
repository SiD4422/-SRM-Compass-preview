# SRM Compass

> A fast, transparent, privacy-first programme explorer and eligibility tool for SRMIST (SRM Institute of Science and Technology) B.Tech admissions.

All data is grounded directly in official SRM documents copied on 26 October 2026 for the 2026-27 cycle. Every single offering links to its primary source table.

---

## Key Features

- **Programme Explorer (`/programmes`)**: Search, filter by campus (KTR, RMP, Trichy, NCR, VDP, BAB) and taxonomy category (Code & AI, Circuits & Power, Machines & Vehicles, etc.), sort by annual fee, and view verified seat numbers and departments.
- **Side-by-Side Comparison (`/compare`)**: Compare up to 3 programmes simultaneously with automated badges for lowest fee and highest seat capacity.
- **Instant Eligibility Checker (`/eligibility`)**: 100% client-side eligibility evaluation covering academic boards, PCM/PMB subjects, minimum 60% aggregate threshold, and exact age boundary validation. Zero user data is stored or transmitted over the network.
- **Student Stories (`/stories`)**: Real engineering projects and startups built by SRM alumni and students (Camber Racing, Neur Industries, Torus Robotics, etc.).
- **Application Route Chooser (`/apply`)**: Step-by-step guidance for SRMJEEE and all 8 academic entrance routes with official helpline and direct portal links.
- **Evidence & Methodology (`/evidence`)**: Grounding evidence, primary source audit trails, and multi-run Lighthouse performance scores.

---

## Verification & Quality Gates

This project enforces rigorous verification gates:

```bash
# 1. Verify all data offerings and stories against source hashes
npm run verify

# 2. Run automated test suite (166 tests: unit, DOM, No-JS resilience, Axe accessibility)
npm test

# 3. Execute live functional harness (Search, Chips, Campuses, Sort, Compare, Apply Routes)
python tests/run-functional-harness.py

# 4. Build static distribution (62 pre-rendered pages)
npm run build
```

---

## Security & Architecture

- **Static Site Generation (SSG)**: Built with Astro with `output: "static"`. Zero server-side runtime vulnerabilities.
- **Security Headers (`public/_headers`)**: Cloudflare Workers static edge configuration enforces strict Content Security Policy (`default-src 'self'`), `Strict-Transport-Security: max-age=31536000`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`.
- **Privacy by Design**: The eligibility form enforces `method="post"` and disables the submit button until client JavaScript initializes, guaranteeing that marks and dates of birth never leak into browser history or URL query strings.
- **Vulnerability Audit**: Documented in [SECURITY.md](SECURITY.md).
