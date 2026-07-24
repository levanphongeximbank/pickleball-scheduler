# E2E-05 — Blocker Resolution

| Blocker | Status | Notes |
|---------|--------|-------|
| **BG-09 — Public portal runtime readiness** | **PARTIAL → CLOSED for E2E-05 capability** | Public facade/projection ready; production wiring still `wiredToProductionRuntime: false`; EC-01 certifies portal channel separately |
| Public Match Center gap | **CLOSED (MVP)** | `getPublicMatchCenter` + contract; no realtime backend |
| Live score mock / deferred | **DEFERRED (documented)** | Legacy `getPublicLiveScores` remains mock; Match Center uses published accepted scores only |
| Publication / privacy gaps | **CLOSED (MVP)** | Fail-closed gates + allowlists + forbidden keys |
| Archive visibility gap | **CLOSED (MVP)** | Explicit `archiveVisible` gate |
| Global router / PublicLayout redesign | **OUT_OF_SCOPE** | Presentation view-model only |
| Deep CM-06 manifest UI wiring | **DEFERRED** | Consume E2E-03 publication states; CM manifest available for later integrator |
| E2E-04 collision | **NONE** | Owned paths disjoint (`operations/public` vs `operations/player|referee`) |

## New blockers introduced

None within E2E-05 scope.
