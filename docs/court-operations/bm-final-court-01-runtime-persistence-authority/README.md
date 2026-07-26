# BM-FINAL-COURT-01 — Court Runtime Persistence Authority

Workstream closure package for Court Operations runtime persistence authority and localStorage demotion.

## Contents

1. [README.md](./README.md) (this file)
2. [readiness-audit.md](./readiness-audit.md) — Phase A matrices
3. [ownership-matrix.md](./ownership-matrix.md)
4. [runtime-write-inventory.md](./runtime-write-inventory.md)
5. [persistence-authority.md](./persistence-authority.md)
6. [localstorage-demotion.md](./localstorage-demotion.md)
7. [integration-certification.md](./integration-certification.md)
8. [test-certification.md](./test-certification.md)
9. [final-report.md](./final-report.md)

Also see parent audit: `docs/court-operations/bm-final-court-01-readiness-audit.md`

## Canonical code

- `src/features/court-engine/runtime/**` — authority, writer, adapters, facade
- Compatibility storage: `src/features/court-engine/storage/**` (demoted)
- Claim fail-closed: `src/features/court-cluster/services/courtClaimRequestService.js`

## Explicit local mode

Set `VITE_COURT_RUNTIME_AUTHORITY=development_local` (or `offline_local`) for explicit non-durable adapters.  
Legacy `VITE_COURT_ENGINE_STORE=local` is honored only outside Production/Staging/Preview.

## Markers (truthful)

See `final-report.md` for issued markers and blockers.
