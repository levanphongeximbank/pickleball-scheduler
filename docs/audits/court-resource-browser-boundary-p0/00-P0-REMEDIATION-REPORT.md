# Court Resource — Node-only Migration Tooling Browser Boundary P0

## Status

`P0_REMEDIATION_IMPLEMENTED=YES`

## Fresh base

| Field | Value |
|-------|-------|
| Worktree | `C:\Users\Le Phong\PICK_VN-Workstreams\court-resource-browser-boundary-p0-01` |
| Branch | `fix/court-resource-browser-boundary-p0-01` |
| Base SHA | `ed5e3a9b95492d70c84326a06552a153d494fabe` |
| `origin/main` at start | `ed5e3a9b95492d70c84326a06552a153d494fabe` |
| Worktree clean at start | YES |

## Revalidation

`P0_STILL_PRESENT_ON_CURRENT_MAIN=YES`

On this SHA, `src/features/court-resource/services/legacyBookingMigrationDryRun.js` still imports `node:crypto` (`createHash`), and browser-facing barrels still pulled it into the client graph.

### Original import chain (still true pre-fix)

```text
src/main.jsx
→ tournament access / tournamentService
→ src/domain/tournamentBookingService.js
→ src/features/court-resource/index.js
→ src/features/court-resource/legacy/index.js
→ src/features/court-resource/services/legacyBookingMigrationDryRun.js
→ node:crypto
```

Secondary path:

```text
courtResourceGateway.js
→ legacy/index.js
→ legacyBookingMigrationDryRun.js
→ node:crypto
```

## Root cause

`legacyBookingMigrationDryRun.js` is **Node migration tooling**. The defect was dependency-boundary leakage: browser-reachable Court Resource barrels (`legacy/index.js`, public `index.js`) and `courtResourceGateway.js` imported a barrel that re-exported the Node-only dry-run, so Vite evaluated `node:crypto` during app bootstrap.

Build alone could still succeed (externalization), while the browser white-screened at runtime.

## Remediation strategy

`OPTION_A` — isolate Node-only tooling; **no** Web Crypto rewrite.

### Exact code changes

1. **`src/features/court-resource/legacy/index.js`**  
   Stop re-exporting `planLegacyBookingMigrationDryRun` (Node leaf remains for scripts/tests).

2. **`src/features/court-resource/index.js`**  
   Import browser-safe helpers from leaf modules (`legacyReservationAdapter`, `legacyIsolationLocks`, `legacyMigrationDryRun`) instead of the broad legacy barrel that previously pulled Node migration tooling.

3. **`src/features/court-resource/services/courtResourceGateway.js`**  
   Import reservation ID helpers from `adapters/legacyReservationAdapter.js` (browser-safe leaf), not the legacy barrel.

4. **Tests**  
   - New: `tests/court-resource-browser-boundary-p0.test.js` (static import/export + transitive graph + Node script leaf path).  
   - Updated: gateway boundary assertion in `tests/court-resource-legacy-isolation-batch8.test.js` (adapter leaf allowed; migration leaf forbidden).

## Why Option A is architecture-correct

```text
BROWSER RUNTIME  ──X──►  legacyBookingMigrationDryRun.js (node:crypto)

NODE / Court Ops script  ──►  leaf module  ──►  node:crypto.createHash
```

Hashing stays migration-ID tooling. Browser never needs it. Domain/writer/read authority unchanged.

## Verification

| Gate | Result |
|------|--------|
| `tests/court-resource-browser-boundary-p0.test.js` | PASS |
| `tests/court-resource-legacy-isolation-batch8.test.js` | PASS |
| Batch 9 architecture / adapter routing | PASS |
| Node leaf import + dry-run call | PASS (`ok:true`) |
| `npm run lint:no-new` | PASS |
| `npm run build` | PASS |
| Dist symbols `legacyBookingMigrationDryRun` / `planLegacyBookingMigrationDryRun` | NONE |
| Preview `/`, `/public/tournaments`, `/login` | HTTP 200; **0** `node:crypto` console/page errors |

### Browser runtime evidence

Playwright against `vite preview` (`127.0.0.1:4173`):

- `BROWSER_WHITE_SCREEN_FROM_NODE_CRYPTO=NO`
- `CLIENT_CONSOLE_NODE_CRYPTO_ERROR=NO` (empty `nodeCryptoHits` on all three paths)

### Node migration evidence

- Leaf still imports `node:crypto`.
- `scripts/court-operations/batch10-staging-legacy-dry-run.mjs` still imports the leaf directly.
- Local Node import of `planLegacyBookingMigrationDryRun` succeeds (no staging mutation executed).

## Classification after fix

```text
NODE_ONLY_REFERENCES_REMAIN=YES
BROWSER_GRAPH_REFERENCE_REMAINS=NO
NODE_CRYPTO_RETAINED_IN_NODE_TOOLING=YES
NODE_CRYPTO_BROWSER_GRAPH_REMOVED=YES
```

## Declarations

```text
DOMAIN_BEHAVIOR_CHANGED=NO
WRITER_CHANGED=NO
READ_AUTHORITY_CHANGED=NO
SQL_CREATED=NO
SQL_EXECUTED=NO
STAGING_MUTATED=NO
PRODUCTION_MUTATED=NO
PUBLIC_WEB_SLICE_1A_TOUCHED=NO
PUBLIC_WEB_CHECKPOINT_TOUCHED=NO
PR_463_IMPLEMENTATION_TOUCHED=NO
AUTHENTICATED_SHELL_CHANGED=NO
WEB_CRYPTO_REWRITE=NO
```

## Files changed

- `src/features/court-resource/legacy/index.js`
- `src/features/court-resource/index.js`
- `src/features/court-resource/services/courtResourceGateway.js`
- `tests/court-resource-browser-boundary-p0.test.js` (new)
- `tests/court-resource-legacy-isolation-batch8.test.js`
- `docs/audits/court-resource-browser-boundary-p0/00-P0-REMEDIATION-REPORT.md` (this file)

## Remaining risks

- Other `src/**` modules still use `node:crypto` for unrelated Node/tooling paths; this P0 only closes the Court Resource migration dry-run → browser barrel leak.
- Public barrel still exports browser-safe live/maintenance migration planners (`legacyMigrationDryRun.js`, no `node:crypto`). Out of scope for this P0 unless Owner expands the boundary policy.
- Preview smoke did not mutate Staging/Production and did not complete a full authenticated session login (env secrets not present); it did prove `/login` boot without the migration `node:crypto` crash.
