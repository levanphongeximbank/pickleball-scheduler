# Batch 3B — Regression report

## Required gates

| Gate | Result | Evidence |
|---|---|---|
| Batch 3B targeted / route smoke / functional parity | PASS | `tests/web-app-wave3-batch3b-court-operations.test.js` |
| Booking regression / court authority | PASS | `court-booking` and canonical booking architecture/lifecycle/live-projection tests |
| Check-in regression | PASS | mobile Phase 8 product/hardening + Sprint 9 tests |
| Wave 2 design system | PASS | Batch 2D/2E source contracts and isolated shared-pattern UI test (9/9) |
| Wave 1 shell | PASS | Batch 1A–1D source contracts |
| Wave 0 auth | PASS | organizer authorization Wave 0 contracts |
| Full menu audit | PASS | B-18 closure + V5 menu audit |
| Tournament Experience 23 | PASS | Tournament Experience waves A1–F, including Screen 23 contracts |
| Foundation lock | PASS | error registry, ownership, competition architecture and platform-runtime boundary |
| Lint | PASS | `npm run lint:no-new`; zero new/changed violations |
| Full unit | PASS | `npm run test:unit` |
| Build | PASS | `npx vite build` after the required foundation and lint gates |
| Responsive evidence | PASS | 16 viewport checks; 8 required screenshots; zero page overflow |

An additional all-files `tests/ui` exploratory run hit existing broad-suite context/time-out failures outside Batch 3B. The required Wave 2 shared UI file was rerun alone with one worker and passed 9/9. No Batch 3B targeted, unit, architecture, lint or build gate failed.

## Safety verification

- `CourtCalendarWeekMatrix.jsx` SHA-256 remained `1e8ad4b79855983de6998ba3bacc2632025e4300537a0ab1912b755e070baa78`.
- The calendar matrix source has no Batch 3B diff.
- Booking data still enters through the existing outlet props and existing forms/detail workflow.
- Check-in still calls `getCheckinDashboard`, `getOfflineSnapshotSummary`, `flushOfflineQueue`, `getOfflineQueueStatusSummary` and `useOfflineStatus`.
- QR destinations remain `/mobile/qr-scan` and `/mobile/qr-generate`.
- No shared component contract, route, permission, domain writer, SQL or remote environment changed.

## Certification

`BATCH3B_TARGETED=PASS`  
`ROUTE_SMOKE=PASS`  
`FUNCTIONAL_PARITY=PASS`  
`BOOKING_REGRESSION=PASS`  
`CHECKIN_REGRESSION=PASS`  
`COURT_AUTHORITY_REGRESSION=PASS`  
`WAVE2_DESIGN_SYSTEM_REGRESSION=PASS`  
`WAVE1_SHELL_REGRESSION=PASS`  
`WAVE0_AUTH_REGRESSION=PASS`  
`FULL_MENU_AUDIT=PASS`  
`TOURNAMENT_23_TARGETED=PASS`  
`FOUNDATION_LOCK=PASS`  
`LINT=PASS`  
`FULL_UNIT=PASS`  
`BUILD=PASS`  
`INTRODUCED_FAILURES=0`
