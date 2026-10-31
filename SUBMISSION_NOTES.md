# Submission Notes: SRM Compass

## 1. Project Description
SRM Compass is a static web application for prospective students exploring B.Tech programmes across SRM Institute of Science and Technology (SRMIST) campuses (Kattankulathur, Ramapuram, Vadapalani, Tiruchirappalli, Delhi-NCR Modinagar, and Babatpur) for the 2026–2027 admissions cycle.

Features include:
- Multi-campus programme explorer with campus and category filters.
- Side-by-side comparison matrix for up to three programmes.
- Client-side eligibility evaluation covering academic boards, subject requirements, and age boundaries.
- Summaries of entrance exam routes and counselling procedures.
- Source linkage to published SRM admission tables and brochures.

## 2. Requirements & How to Run
- Node.js 18+ or 20+
- npm 9+

```bash
# 1. Install dependencies
npm ci

# 2. Start local development server
npm run dev

# 3. Build static distribution
npm run build

# 4. Preview built static files
npm run preview
```

## 3. How to Validate Data and Tests
```bash
# 1. Validate dataset integrity against SHA-256 baselines
npm run verify

# 2. Execute automated test suite (unit tests, DOM tests, accessibility checks)
npm test
```

## 4. Known Boundaries & Limitations
1. **Tamil Translation Status**: String extraction and layout components for Tamil support are implemented. However, the Tamil strings have not yet undergone review by an external native speaker. To ensure accuracy, the bilingual routes are gated behind `TAMIL_ENABLED=false` by default.
2. **Admissions Cycle Scope**: Data reflects SRM's published 2026–2027 admissions documents captured on 26 October 2026. SRM reserves the authority to alter seat allocations, fee structures, or eligibility criteria for future admissions cycles.
3. **Usability Testing Scope**: Testing includes automated test suites, Playwright headless browser checks, and Axe accessibility audits across all pages. Direct physical user testing sessions with high school applicants have not been recorded.
4. **Development Dependencies**: Eight advisories reported by `npm audit` reside in build-time devDependencies (Vite/Tinypool). Because production files are static pre-rendered HTML/JS without an active Node.js server runtime, these packages do not execute in user browsers or at the edge.
