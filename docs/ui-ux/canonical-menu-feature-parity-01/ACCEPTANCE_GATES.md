# Acceptance gates — Wave 2 + Wave 3 + Wave 4

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

## Wave 4 (topbar responsive layout)

| Gate | Required | Evidence |
|------|----------|----------|
| TOPBAR_TEXT_OVERLAP | 0 | wave4 layout contracts + browser QA |
| TOPBAR_TEXT_COLLISION | 0 | wave4 layout contracts + browser QA |
| CRITICAL_LABEL_CLIPPING | 0 | ellipsis + title affordance |
| Desktop / tablet / mobile parity | PASS | FIGURE1: mobile≤899 (incl. 768), tablet 900–1199, desktop≥1200 |
| Viewport 768 classification | mobile | FIGURE1 `mobileMax=899` |
| `wide` claimed as runtime viewport | NO | helper-only preset |
| WAVE4_EVIDENCE_RUNTIME_MISMATCH_COUNT | 0 | breakpoint evidence correction |
| Wave1–3 preservation | 13 / 120 / 379 | wave4 preservation test |
| OBSERVATION_CANONICAL_TOPBAR_01 | PROPOSED_CLOSED_BY_IMPLEMENTATION | pending independent re-review |
| Scoped ESLint / new lint | PASS / 0 | local scoped eslint |
| Production build / lint:no-new | PASS | when run for correction |
| Push / PR / Production deploy | NO | local commit only |

Breakpoint evidence correction verdict target:

`CANONICAL_NAVIGATION_FINAL_PARITY_01_WAVE4_BREAKPOINT_CORRECTION_PASS_READY_FOR_REREVIEW`
