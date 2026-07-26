# Court Operations — Post-Merge Closure (PR #304)

**Module:** Court Operations  
**Workstream origin:** BM-FINAL-COURT-01  
**Classification:** `FULLY_COMPLETED_CLOSED`  
**Post-merge marker:** `COURT_OPERATIONS_POST_MERGE_VERIFIED_CLOSED`

## Merge ancestry (fresh main)

| Item | Value |
|------|-------|
| PR | [#304](https://github.com/levanphongeximbank/pickleball-scheduler/pull/304) MERGED |
| Merge commit | `a01f2640d4cba8e182de15560d64cd418f6203e2` |
| Ancestor of baseline `7866e775`? | **YES** |
| Title | BM-FINAL-COURT-01: establish Court runtime persistence authority |

Pre-merge package (still valid for design claims; merge status in that file is historical):

`docs/court-operations/bm-final-court-01-runtime-persistence-authority/`

## Canonical surfaces

| Dimension | Path / authority |
|-----------|------------------|
| Canonical source | `src/features/court-engine/runtime/**` |
| Public facade | `src/features/court-engine/runtime/facade.js` (+ `index.js`) |
| Ownership | Runtime session / queue / `courtStates` / claims lifecycle |
| Venue ownership | Inventory / hours / availability (`src/features/venue-court/`) |
| Competition | Demand / assignment / schedule — **does not write inventory** |
| Persistence authority | Durable default (Prod/Staging/Preview/dev); explicit local only |
| Authorization | Scope `tenantId`+`clubId`; mutation via `authorizeCourtRuntimeMutation` fail-closed |
| Platform Core | Composition via `repositoryFactory` → `getCourtRuntimeWriter` |
| External ports | Durable / local / memory adapters; Venue read guard; claim RPCs |

## Requirement checklist (verified on baseline)

| Requirement | Result |
|-------------|--------|
| Durable runtime persistence authority | PASS |
| localStorage not canonical | PASS |
| No silent fallback on cloud/RPC failure | PASS |
| No dual-write | PASS |
| Durable default Prod/Staging/Preview | PASS |
| Local mode explicit | PASS |
| Venue owns inventory; Court Ops owns runtime | PASS |
| Competition does not write inventory | PASS |
| Auth/scope fail-closed | PASS |
| PR #304 ancestry | PASS |
| Post-merge tests (this pack + CI suite) | PASS (see `TEST_CERTIFICATION.md`) |
| Cleanup evidence | Classified residual only — worktree cleanup **not** performed (deferred gate) |

## Persistence authority (runtime)

Resolved by `resolveCourtRuntimeAuthority.js`:

- Production / Staging / Preview → `durable` (`secure_default`)
- Development default → `durable`
- Explicit local → `VITE_COURT_RUNTIME_AUTHORITY=development_local|offline_local`
- Cloud/`RPC_NOT_DEPLOYED` signals **never** flip authority to local

## Tests (targeted / post-merge regression)

- `tests/court-engine-runtime-authority.test.js` (primary)
- `tests/court-cluster-claim-authority.test.js`
- `tests/court-engine-storage.test.js`
- `tests/court-engine-cloud.test.js`
- `tests/court-engine.test.js`
- `tests/venue-court-phase-2d-court-engine-guard.test.js`

## Cleanup evidence

BM-FINAL-EVIDENCE-01 residual inventory recorded Court worktree as dirty/out-of-scope with `cleanupPerformed=false`.  
This pack **does not** delete worktrees/branches. Cleanup remains a deferred operational gate:

`COURT_OPS_RESIDUAL_WORKTREE_CLEANUP`

## Deferred Production gates

- Claim RPC / cloud SQL assumed previously authored — Production apply not performed here
- Cluster inventory localStorage demotion (explicit out of BM-FINAL-COURT-01 scope)
- `ARCHITECTURE.md` narrative refresh (doc drift only — not an implementation gap)

## Verdict

BM-FINAL-COURT-01 implementation is on `main` and post-merge closure evidence is recorded here.  
No domain remediation required in BM-FINAL-GAPS-02.
