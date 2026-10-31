# SRM Compass

> A fast, transparent, privacy-focused programme explorer and eligibility tool for SRMIST (SRM Institute of Science and Technology) B.Tech admissions.

All data is drawn from SRM documents captured on 26 October 2026 for the 2026-27 cycle. Every single offering links to its primary source table.

---

## Key Features

- **Programme Explorer (`/programmes`)**: Search, filter by campus (KTR, RMP, Trichy, NCR, VDP, BAB) and category (Code & AI, Circuits & Power, Machines & Vehicles, etc.), sort by annual fee, and inspect seat numbers and departments.
- **Side-by-Side Comparison (`/compare`)**: Compare up to 3 programmes simultaneously with badges highlighting lower fees and higher seat capacity.
- **Instant Eligibility Checker (`/eligibility`)**: Client-side eligibility evaluation covering academic boards, PCM/PMB subjects, minimum 60% aggregate threshold, and age boundary calculations. No user data is stored or transmitted over the network.
- **Student Stories (`/stories`)**: Engineering projects and startups built by SRM alumni and students (Camber Racing, Neur Industries, Torus Robotics, etc.).
- **Application Route Chooser (`/apply`)**: Guidance for SRMJEEE and 8 academic entrance routes with helpline details and direct portal links.
- **Evidence & Methodology (`/evidence`)**: Grounding evidence, source audit trails, and multi-run Lighthouse performance scores.

---

## Quality Gates and Testing

This project enforces automated testing and validation gates:

```bash
# 1. Validate data offerings and stories against source hashes
npm run verify

# 2. Run automated test suite (189 tests: unit, DOM, No-JS resilience, Axe accessibility)
npm test

# 3. Build static distribution (63 pre-rendered pages)
npm run build
```

What is tested:
- **Data integrity**: Hash checks confirm data files match baseline SHA-256 signatures.
- **Eligibility logic**: Automated tests check subject combinations (PCM/PMB), non-decimal input handling, age thresholds, and informational notes.
- **Accessibility**: Automated Axe checks test every built page in both light and dark themes at 360 px and 1440 px viewports for color contrast, landmark structure, and labels.
- **No-JS resilience**: Form submission behavior is tested with JavaScript disabled to confirm URL query strings do not expose user inputs.

---

## Security & Architecture

- **Static Site Generation (SSG)**: Built with Astro with `output: "static"`. Pre-rendered static HTML, CSS, client scripts, and images.
- **Security Headers (`public/_headers`)**: Real headers deployed to the edge:
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
- **Privacy Design**: The eligibility form uses `method="post"` and client-side JavaScript execution, preventing marks and dates of birth from appending to browser history or server access logs.
- **Dependency Audit**: Detailed in [SECURITY.md](SECURITY.md).
