## Summary

Wave 2 — Shared Design System for the authenticated PICK_VN web app (Draft PR — **do not merge until Owner final GO**).

### Batches
- **2A** — Master audit (ownership / gap / token / a11y matrices)
- **2B** — Foundations & tokens (`#3B82F6` / `#10B981` / Inter; Figure 1 + Public isolation)
- **2C** — Shared primitives (`StatusToneChip`, `FieldError`, button / IconButton contracts)
- **2D** — Shared patterns (`AuthPageHeader`, confirm/empty/loading/error, filter bar, responsive data, snackbar)
- **2E** — Pilot adoption: `/dashboard`, `/players`, `/audit`, `/court-management/courts`
- **2E-R1** — Live Players remediation (no club-scoped work before readiness; no blank white screen)
- **2F** — Final regression, main sync, certification, Waves 3–5 adoption contract

### Architecture
- Canonical theme/tokens: `src/theme/theme.js` + `src/theme/designTokens.js`
- Shared UI: `src/features/web-app-ui/`
- No second workspace ThemeProvider / parallel design system
- Wave 1 shell chrome frozen; Tournament Experience 23 frozen; Public visual system not redesigned by Wave 2 (font isolation only)
- `club_members` Preview HTTP 500 classified **pre-existing / backend** — does **not** block Wave 2

### Owner visual review
Dashboard / Players (after R1) / Audit / Courts = **PASS**

## Test plan
- [x] Wave 2 targeted unit + UI (2B–2E / R1)
- [x] Foundation lock + lint:no-new
- [x] Full unit + build
- [x] Main sync (court-resource P0 + public-web wave1) with overlap audit; `FORCE_PUSH=NO`
- [ ] Owner final GO before merge
- [ ] Confirm Vercel + Netlify SUCCESS on final HEAD

## Docs
- `docs/v5/web-app-experience/wave2/batch-2f/FINAL_CERTIFICATION_REPORT.md`
- `docs/v5/web-app-experience/wave2/batch-2f/FINAL_VISUAL_EVIDENCE.md`
- `docs/v5/web-app-experience/wave2/AUTHENTICATED_DESIGN_SYSTEM_ADOPTION_CONTRACT.md`
