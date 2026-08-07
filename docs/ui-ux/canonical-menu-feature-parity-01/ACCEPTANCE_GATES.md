# Acceptance gates — Wave 2 + Wave 3

## Wave 2 (feature exposure)

| Gate | Required | Evidence |
|------|----------|----------|
| Wave 1 Tournament preserved | 13 targets | wave1 + wave2 tests |
| B02 allowlist | 11; unapproved=0 | validateCanonicalRegistry / wave2 tests |
| B03 preserved | YES | wave2 + phase4 B03 tests |
| Proposed count sync | menu=catalog=inventory=120 | wave2 registry test |
| Group 12 proposed | 11 → 27 / promoted 16 | Wave2 evidence correction |
| No duplicate authority | 0 | validateCanonicalRegistry |
| Production mutations | 0 | no deploy/SQL/env |

## Wave 3 (localization + technical leakage)

| Gate | Required | Evidence |
|------|----------|----------|
| Vietnamese coverage | 100% | wave3 coverage test + report |
| Unapproved English canonical labels | 0 | wave3 banlist test |
| `dashboard_no_live_rows` not raw-rendered | YES | wave3 technical leakage test |
| Tenant terminology | Tổ chức | wave3 tenant test + TenantSwitcher |
| Wave1/Wave2 node preservation | 13 / 120 | wave3 preservation test |
| B03 hidden | YES | wave3 + phase4 B03 |
| Private pairing access unchanged | YES | wave3 private pairing test |
| Scoped ESLint / new lint | PASS / 0 | local scoped eslint |
| Production build / lint:no-new | PASS | `npm run build` |
| Push / PR | NO | local commit only |

Final Wave 3 verdict target:

`CANONICAL_NAVIGATION_FINAL_PARITY_01_WAVE3_IMPLEMENTATION_PASS_READY_FOR_INDEPENDENT_REVIEW`
