# Platform Hard Cutover — Phase 6 Readiness Report

**Audit date:** 2026-08-04

**Mode:** READINESS AUDIT ONLY

**Verdict:** `PHASE6_READINESS_BLOCKED`

**Readiness:** **36%** (9.0 weighted-ready points / 25 controls; closed = 1, accepted observation = 0.5, open/unknown = 0)

**Production GO:** `NO`

## Safety markers

```text
PHASE6_DATABASE_MUTATIONS=0
PHASE6_STAGING_MUTATIONS=0
PHASE6_PRODUCTION_ACCESS=0
PHASE6_PRODUCTION_MUTATIONS=0
PRODUCTION_GO=NO
DATABASE_LIVE_RECHECK=READ_ONLY_PARTIAL
```

No SQL, migration, deploy, environment change, Staging mutation, Production access, reset, rebase, amend, clean, force-push, or merge was performed.

## Repository baseline

| Item | Evidence |
|---|---|
| Fetched baseline | `git fetch origin --prune` completed |
| Original worktree branch | `fix/phase5d-br01-br10-local-closure` |
| Original worktree HEAD | `e21ead54efeb642f963c3421dedc9c283d704037` |
| `origin/main` | `15f21e15a7127748e093cdc0494f2ca00f3dce42` |
| Phase 5 merge ancestry | Merge commit `15f21e15...` is an ancestor of `origin/main` (it is the current tip) |
| Original worktree status | Untracked `.codex/` plus two Phase 5 post-apply certification files; no modified/untracked application source file |
| Original branch history | Six Phase 5D commits ahead of its historical base; not used for Phase 6 integration |
| Stash inventory | Empty |
| Worktrees before audit | Main worktree, TT5D reconciliation worktree, original Phase 5D worktree |
| Evidence integration | Disposable worktree and `agent/platform-hard-cutover-phase6-readiness` created from fresh `origin/main` |

The two untracked certification files in the original worktree are also tracked at `origin/main` through PR #356. They were not modified or deleted. The Phase 5D BR01–BR10 package exists only on the six-commit branch and is not part of the canonical `origin/main` tree; therefore it cannot close mainline hard-cutover blockers in this audit.

## Canonical readiness inventory

### Completed controls

- Phase 4 implementation package, protected-object guards, M8 text-tenant hotfix, final Staging operator acceptance (17/17), and security reconciliation are present on main.
- Phase 5B exact-byte checksum verification and M0–M11 manifest tests pass.
- Phase AI V5.2 Staging post-apply evidence is merged and records migration `20260804011017`, expected Phase 5 objects, RLS/policies, Realtime publication, and zero smoke residue.
- Foundation locks, no-new lint gate, focused regression tests, full unit suite, build, and package/lock integrity pass on fresh `origin/main`.
- Production access and all database/environment mutations in this audit are zero.

### Open blockers and unknown gates

1. **CRITICAL — Production authorization:** `productionExecutionGo=false`; no Owner Production GO may be inferred or issued.
2. **CRITICAL — Backup/recovery:** usable Production backup, PITR state, restore target, and restore rehearsal remain unproven.
3. **HIGH — M9/TT5D provenance:** mainline Phase 5C records conflicting pre-existing TT5D topology and keeps M9 non-executable. The later BR01–BR10 closure package is not merged into `origin/main`.
4. **HIGH — Execution package/runbook:** the canonical M0–M11 execution runbook remains unaccepted and Production SQL ordering/applicability is not execution-approved.
5. **HIGH — Production environment/deployment:** Production environment variables, flag values, Realtime publication, monitoring/logging, canary plan, and deployment gates lack current Owner-certified evidence.
6. **HIGH — Production security acceptance:** Production RLS/RBAC, anonymous/public write exposure, tenant isolation, privileged RPC paths, and eight-role operator acceptance are not currently certified for this cutover.
7. **CRITICAL — Advisor findings:** current Staging read-only advisors report 516 security findings, including 2 ERROR security-definer views and 6 ERROR public tables without RLS, plus 504 performance findings. These require object-level triage before execution readiness.

### Accepted observations

- Supabase Branching tool permission validation returned “Project reference is missing”; Phase 5 classified it non-blocking for the completed Staging certification.
- `npm ci` reports 20 dependency vulnerabilities (5 moderate, 15 high). No package or lock change was authorized; exploitability and release disposition require Owner/security review.
- Build succeeds with existing large-chunk and browser `node:crypto` externalization warnings.
- Local credential-dependent Staging smoke was not run. The merged Phase 5 certificate contains equivalent read-only DB evidence; this Phase 6 audit did not fabricate a rerun.

### Deferred items and Owner decisions

- Production SQL apply, wipe/drop/reseed, deploy, flags, canary/pilot, and production smoke remain deferred until explicit Owner GO and all hard gates close.
- Owner must choose rollback decision points and abort thresholds, accept the final ordered runbook, and approve a verified backup/restore package.
- Owner/security must disposition npm vulnerabilities and the unresolved Supabase advisor findings.

## Staging evidence (repository only)

`DATABASE_LIVE_RECHECK=READ_ONLY_PARTIAL`. The Staging MCP target was proven before database inventory by active Edge Function entrypoint paths containing `user_fn_qyewbxjsiiyufanzcjcq`. Only purpose-built read-only inventory tools were used; no raw SQL or mutation tool was called.

Merged Phase 5 evidence for Staging project `qyewbxjsiiyufanzcjcq` records:

- 164 migrations are listed; the latest include `phase5d_tt5d_controlled_reconciliation` (`20260731150000`) and `phase_ai_v52_phase5` (`20260804011017`);
- `ai_workflow_checklists` with seven expected columns, PK and tenant/tournament/item unique constraint;
- RLS enabled, three authenticated INSERT/SELECT/UPDATE policies, valid indexes;
- Realtime publication includes `ai_workflow_checklists`, `court_engine_active_sessions`, and `court_engine_stores`;
- zero smoke residue across `court_engine_stores`, `ai_suggestions`, and `ai_workflow_checklists`;
- `club_data_v3`, `ai_suggestions`, `court_engine_stores`, `court_engine_active_sessions`, `team_tournament_referee_correction_requests`, and `ai_workflow_checklists` have RLS enabled and report 0 rows;
- no current advisor lint targets `ai_workflow_checklists`; `club_data_v3` has two always-true RLS policy WARNs, and `court_engine_stores` has performance observations;
- current advisors total 516 security findings: 2 ERROR security-definer views, 6 ERROR public tables without RLS, 204 WARN anon-executable security-definer functions, 271 WARN authenticated-executable security-definer functions, and other INFO/WARN findings;
- current performance advisors total 504 findings, including 109 multiple-permissive-policy WARNs and 2 duplicate-index WARNs.

Because hard safety forbids SQL, this partial live recheck does not assert exact policy definitions, Realtime publication membership, protected auth/catalog counts, or full TT5D cutover topology. Those retain merged evidence or require a future approved capability that can prove them without raw SQL.

## Production readiness conclusion

Repository evidence supports continued release preparation, but not Phase 6 execution and not Production GO. The mandatory backup/restore and authorization gates are CRITICAL; M9/TT5D provenance, execution runbook acceptance, current Production security/environment evidence, monitoring, and operator acceptance remain HIGH or unknown. Under the required rule that any unresolved HIGH/CRITICAL blocker yields BLOCKED, the only valid verdict is:

`PHASE6_READINESS_BLOCKED`

## Validation results

| Check | Result |
|---|---|
| `npm ci` | PASS; 644 packages added, 645 audited; 20 vulnerabilities observed |
| `npm run ci:foundation-lock` | PASS |
| `npm run lint:no-new` | PASS; 0 new violations (baseline debt retained) |
| Focused hard-cutover + Phase 5 regression tests | PASS; 141/141 |
| Full `npm run test:unit` | PASS; 6,837/6,837, 262 suites |
| `npm run build` | PASS; PWA generated; existing warnings observed |
| Secret scan | PASS_WITH_REVIEW: no token-format/private-key signature found; broad value-name heuristic produced expected references/fixtures and was not misreported as zero |
| `git diff` / `git diff --cached` before evidence | Clean |
| `package.json` blob | Matches `origin/main` (`57a291a90903f3f11c081f7e032598b94ba0c198`) |
| `package-lock.json` blob | Matches `origin/main` (`0bc30b2dabf45d98c3bdabb583f88ce99496999f`) |

## Primary evidence sources

- `docs/v5/PHASE_AI_V52_PHASE5_STAGING_POST_APPLY_CERTIFICATION.{md,json}`
- `docs/platform-hard-cutover-01/phase-04/` and its manifests/evidence
- `docs/platform-hard-cutover-01/phase-05-readiness/`
- `docs/platform-hard-cutover-01/phase-05b-execution-package/`
- `docs/platform-hard-cutover-01/phase-05c-tt5d-staging-certification/`
- `docs/v5/V5_2_PRODUCTION_DEPLOY_CHECKLIST.md`
- `docs/v5/V5_2_PRODUCTION_GO_REPORT.md`
- `docs/GA-PRODUCTION-ENV-CHECKLIST.md`
- `docs/SUPABASE-PRODUCTION-CHECKLIST.md`
- `docs/GA-PRODUCTION-QA.md`
- `docs/GA-FINAL-AUDIT.md`
- `ARCHITECTURE.md`, `docs/ARCHITECTURE.md`, and Phase 4 protected/runtime manifests
