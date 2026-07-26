# Court Runtime Authority Certification — BUSINESS-MODULES-FINAL-02

**Workstream certified:** BM-FINAL-COURT-01 (PR #304, merge `a01f2640`)  
**Post-merge:** BM-FINAL-GAPS-02 `COURT_OPERATIONS_POST_MERGE_CLOSURE.md`  
**Classification:** `FULLY_COMPLETED_CLOSED`  
**Marker (post-merge):** `COURT_OPERATIONS_POST_MERGE_VERIFIED_CLOSED`

## Canonical code

| Area | Path |
|------|------|
| Runtime authority | `src/features/court-engine/runtime/**` |
| Compatibility storage (demoted) | `src/features/court-engine/storage/**` |
| Claim fail-closed | `src/features/court-cluster/services/courtClaimRequestService.js` |

## Authority rules (certified)

- localStorage is **not** canonical SoT under durable authority
- No silent fallback to local success on cloud/RPC failure
- Explicit local mode only via `VITE_COURT_RUNTIME_AUTHORITY=development_local|offline_local`
- Legacy `VITE_COURT_ENGINE_STORE=local` only outside Production/Staging/Preview
- No dual-write durable + localStorage as verified success
- Competition does not write court inventory

## Explicit non-claims

- Cluster inventory localStorage demotion remains out-of-scope residual (deferred)
- Production schema/rollout for related surfaces may remain deferred elsewhere
- Residual worktree cleanup not executed in this FINAL-02 pack

## Deferred gates (registered; not impl gaps)

- `COURT_OPS_RESIDUAL_WORKTREE_CLEANUP`
- `COURT_CLUSTER_INVENTORY_LS_DEMOTION`

## Evidence paths

- `docs/court-operations/bm-final-court-01-runtime-persistence-authority/`
- `docs/business-modules/module-closure-reconciliation/COURT_OPERATIONS_POST_MERGE_CLOSURE.md`
- Tests: `tests/court-engine-runtime-authority.test.js`, `tests/court-cluster-claim-authority.test.js`
