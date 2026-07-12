# V5 — Terminology & Data Consistency Final Verdict

**Date:** 2026-07-12

## Verdict matrix

```text
TERMINOLOGY FORMAT:              PASS
GLOSSARY COVERAGE:               PASS
QUESTION DATA CONSISTENCY:       PASS
DOMAIN DATA CONSISTENCY:         PASS
ROUTING DATA CONSISTENCY:        PASS
SQL/CODE CONTRACT CONSISTENCY:   PASS
VERSION REPRODUCIBILITY:         PASS
V2/V5 ISOLATION:                 PASS
RUNTIME CONSISTENCY:             NOT VERIFIED
READY FOR STAGING MIGRATION:     YES (with owner content revision from V5-B0)
OWNER APPROVAL REQUIRED:         YES
```

## Deliverables

| Item | Path |
|------|------|
| Glossary SSOT | `src/features/pick-vn-rating-v5/constants/ratingGlossary.js` |
| Terminology helpers | `src/features/pick-vn-rating-v5/constants/terminology.js` |
| Canonical domain codes | `src/features/pick-vn-rating-v5/constants/domainCodes.js` |
| Version contract | `src/features/pick-vn-rating-v5/constants/versions.js` |
| Consistency validator | `src/features/pick-vn-rating-v5/audit/dataConsistencyValidator.js` |
| Automated tests | `tests/pick-vn-rating-v5-data-consistency.test.js` |
| Audit report | `docs/v5/rating-v5/V5-DATA_CONSISTENCY_AUDIT.md` |

## UI format rule

```text
formatRatingTerm("serve") → "Serve (giao bóng)"
```

Question prompts dùng `{{term_code}}` → `resolvePromptText()` khi hiển thị.

## Tests

```bash
node --test tests/pick-vn-rating-v5-data-consistency.test.js
node scripts/generate-v5-data-consistency-audit.mjs
```

**39/39 V5 tests PASS** (consistency + benchmark + security + foundation)
