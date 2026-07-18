# 07 — Diagnostics and Shadow Evidence

## Diagnostics

All required codes exist as machine identifiers in `MAPPING_DIAGNOSTIC_CODE`.  
`createMappingDiagnostic` always sets `code`, `severity`, `sourceType`, `sourceId`.  
Messages are human-only.

Adapters emit (among others): `MISSING_COMPETITION_ID`, `INVALID_ROSTER_STATE`, `INVALID_LINEUP_REVISION`, etc.  
Business-invalid mapping does not throw.

## Shadow runner

| Constraint | Evidence |
|------------|----------|
| No executor | `attemptExecutor` throws; hooks unused in happy path |
| No persistence | `attemptPersist` throws |
| No Supabase / localStorage / pages / engines imports | Static scan of `shadowRunner.js` |
| No env auto-enable | Explicit test/QA call only |
| No input mutation | `assertSourceUnchanged` |
| Batch multi-format | Individual fail + Daily success in same run |
| Failure isolation | Step 2 fails; step 3 still runs |
| JSON-safe output | `JSON.stringify` round-trip |
| Not Production UI export | Not wired to pages; not Core public UI API |
