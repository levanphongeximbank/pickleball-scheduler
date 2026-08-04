# Platform Hard Cutover — Phase 6 Readiness Report

**Audit date:** 2026-08-04

**Mode:** READINESS AUDIT ONLY

**Verdict:** `PHASE6_READINESS_BLOCKED`

**Readiness:** **40%** (10.5 weighted-ready points / 26 controls; closed = 1, accepted observation = 0.5, open/unknown = 0; rounded down)

**Production GO:** `NO`

## Safety markers

```text
PHASE6_DATABASE_MUTATIONS=0
PHASE6_STAGING_MUTATIONS=0
PHASE6_PRODUCTION_ACCESS=0
PHASE6_PRODUCTION_MUTATIONS=0
PRODUCTION_GO=NO
DATABASE_LIVE_RECHECK=READ_ONLY_PARTIAL
AUTHORIZED_STAGING_MIGRATIONS_ALREADY_CERTIFIED=3
```

This reconciliation performed no SQL, migration, deploy, environment change, Staging mutation, or Production access. It incorporates three previously authorized and certified Staging migrations from PRs #358–#360 and #362; no Production claim is inferred from them.

## Repository baseline

| Item | Evidence |
|---|---|
| Fetched baseline | `git fetch origin --prune` completed |
| Original worktree branch | `fix/phase5d-br01-br10-local-closure` |
| Original worktree HEAD | `e21ead54efeb642f963c3421dedc9c283d704037` |
| `origin/main` | `8114daae` (PR #362 merged) |
| Phase 5 merge ancestry | Merge commit `15f21e15...` remains an ancestor of current `origin/main@8114daae` |
| Original worktree status | Untracked `.codex/` plus two Phase 5 post-apply certification files; no modified/untracked application source file |
| Original branch history | Six Phase 5D commits ahead of its historical base; not used for Phase 6 integration |
| Stash inventory | Empty |
| Worktrees before audit | Main worktree, TT5D reconciliation worktree, original Phase 5D worktree |
| Evidence integration | Evidence-only branch `agent/phase6-final-readiness-reconciliation` created from fresh `origin/main@8114daae` in the disposable worktree |

The two untracked certification files in the original worktree are also tracked at `origin/main` through PR #356. They were not modified or deleted. The Phase 5D BR01–BR10 package exists only on the six-commit branch and is not part of the canonical `origin/main` tree; therefore it cannot close mainline hard-cutover blockers in this audit.

## Canonical readiness inventory

### Completed controls

- Phase 4 implementation package, protected-object guards, M8 text-tenant hotfix, final Staging operator acceptance (17/17), and security reconciliation are present on main.
- Phase 5B exact-byte checksum verification and M0–M11 manifest tests pass.
- Phase AI V5.2 Staging post-apply evidence is merged and records migration `20260804011017`, expected Phase 5 objects, RLS/policies, Realtime publication, and zero smoke residue.
- Foundation locks, no-new lint gate, focused regression tests, full unit suite, build, and package/lock integrity pass on fresh `origin/main`.
- Production access and all database/environment mutations in this audit are zero.
- Staging Security Invoker remediation is merged and certified: both target views use `security_invoker=true`; authenticated Owner A/B positive and negative isolation passes.
- Staging `club_data_v3` legacy anon SELECT/INSERT/UPDATE policies are removed by migration `20260804041304`; anon read returns 0, anon INSERT is denied by RLS, anon UPDATE affects 0 rows, and fixture cleanup is 0/0.
- Staging migration `20260804054802` enables RLS without policies on the six previously exposed empty public tables and revokes anon INSERT/UPDATE/DELETE. Both anon and authenticated runtime visibility is 0; Advisor reports 0 ERROR.

### Open blockers and unknown gates

1. **CRITICAL — Production authorization:** `productionExecutionGo=false`; no Owner Production GO may be inferred or issued.
2. **CRITICAL — Backup/recovery completion:** Production daily database backups and a restore-to-new-project drill are evidenced; Owner accepted max RPO 24 hours without PITR. Storage objects are excluded, Storage backup remains open, and measured/accepted RTO is not recorded.
3. **HIGH — M9/TT5D provenance:** mainline Phase 5C records conflicting pre-existing TT5D topology and keeps M9 non-executable. The later BR01–BR10 closure package is not merged into `origin/main`.
4. **HIGH — Execution package/runbook:** the canonical M0–M11 execution runbook remains unaccepted and Production SQL ordering/applicability is not execution-approved.
5. **HIGH — Production environment/deployment:** Production environment variables, flag values, Realtime publication, monitoring/logging, canary plan, and deployment gates lack current Owner-certified evidence.
6. **HIGH — Production security acceptance:** Staging target remediation is certified, but Production RLS/RBAC, anonymous/public write exposure, tenant isolation, privileged RPC paths, and eight-role operator acceptance are not currently certified for this cutover.

### Accepted observations

- Supabase Branching tool permission validation returned “Project reference is missing”; Phase 5 classified it non-blocking for the completed Staging certification.
- Owner accepted scheduled daily Production database backups with `ACCEPTED_RPO_MAX=24_HOURS`; PITR is not required for this phase. This acceptance does not cover Storage objects or establish RTO.
- `npm ci` on `origin/main@8114daae` reports 6 high dependency vulnerabilities. No package or lock change was authorized; exploitability and release disposition require Owner/security review.
- Build succeeds with existing large-chunk and browser `node:crypto` externalization warnings.
- Supabase Security Advisor now reports 0 ERROR. The remaining 501 WARN and 11 INFO findings are retained as an accepted observation requiring object-level Owner/security disposition; six INFO findings intentionally record the fail-closed tables with RLS enabled and no policy.
- Local credential-dependent Staging smoke was not run. The merged Phase 5 certificate contains equivalent read-only DB evidence; this Phase 6 audit did not fabricate a rerun.

### Deferred items and Owner decisions

- Production SQL apply, wipe/drop/reseed, deploy, flags, canary/pilot, and production smoke remain deferred until explicit Owner GO and all hard gates close.
- Owner must choose rollback decision points and abort thresholds, accept the final ordered runbook, and approve a verified backup/restore package.
- Owner/security must disposition npm vulnerabilities and the remaining Supabase Advisor WARN inventory.

## Staging evidence (repository only)

`DATABASE_LIVE_RECHECK=READ_ONLY_PARTIAL`. The original audit used purpose-built read-only inventory. Later sessions used explicit Owner-authorized Staging SQL for the three target remediations and fixture QA; those mutations are bounded by the merged certification evidence. This reconciliation itself performed no database call or mutation.

Merged Phase 5 plus PRs #358–#360 and #362 evidence for Staging project `qyewbxjsiiyufanzcjcq` records:

- migration history contains all three certified Phase 6 migrations: `20260804031702`, `20260804041304`, and `20260804054802`;
- `ai_workflow_checklists` with seven expected columns, PK and tenant/tournament/item unique constraint;
- RLS enabled, three authenticated INSERT/SELECT/UPDATE policies, valid indexes;
- Realtime publication includes `ai_workflow_checklists`, `court_engine_active_sessions`, and `court_engine_stores`;
- zero smoke residue across `court_engine_stores`, `ai_suggestions`, and `ai_workflow_checklists`;
- `club_data_v3`, `ai_suggestions`, `court_engine_stores`, `court_engine_active_sessions`, `team_tournament_referee_correction_requests`, and `ai_workflow_checklists` have RLS enabled and report 0 rows;
- no current advisor lint targets `ai_workflow_checklists`; the two prior always-true anon policies on `club_data_v3` are removed, while `court_engine_stores` retains performance observations;
- migration `20260804031702 / phase6_security_invoker_view_remediation_01` set `public.tenants` and `public.club_data_v3_safe` to `security_invoker=true`;
- migration `20260804041304 / phase6_club_data_v3_anon_policy_remediation_02` removed the three legacy anon policies on `public.club_data_v3` while retaining RLS and four authenticated policies;
- authenticated Owner A/B fixtures prove own-tenant positive reads and foreign-tenant denial through both remediated views; anon read/write negative probes pass after the second remediation; cleanup counts are zero;
- migration `20260804054802 / phase6_six_rls_errors_fail_closed_remediation_03` enables RLS with zero policies on the six audited empty tables and revokes anon DML; metadata is 6/6 PASS and anon/authenticated reads each return 0;
- current Security Advisor evidence reports 0 ERROR, 501 WARN, and 11 INFO. Six INFO notices are the expected `rls_enabled_no_policy` fail-closed state; the WARN inventory is not silently classified closed;
- current performance advisors total 504 findings, including 109 multiple-permissive-policy WARNs and 2 duplicate-index WARNs.

The targeted certifications assert exact view/policy state and runtime behavior only for the remediated objects. Realtime publication membership, protected auth/catalog counts, full TT5D cutover topology, and the broader platform inventory retain prior evidence or require separate approved verification.

## Production readiness conclusion

Repository and Staging evidence support continued release preparation, but not Phase 6 execution and not Production GO. The six remaining Staging Advisor ERRORs are closed with evidence. Storage recovery/RTO and authorization remain CRITICAL; M9/TT5D provenance, execution runbook acceptance, current Production security/environment evidence, monitoring, and operator acceptance remain HIGH/CRITICAL or unknown. Under the required rule that any unresolved HIGH/CRITICAL blocker yields BLOCKED, the only valid verdict is:

`PHASE6_READINESS_BLOCKED`

## Validation results

| Check | Result |
|---|---|
| `npm ci` | PASS; 644 packages added, 645 audited; 6 high vulnerabilities observed |
| `npm run ci:foundation-lock` | PASS |
| `npm run lint:no-new` | PASS; 0 new violations (baseline debt retained) |
| Focused hard-cutover + Phase 5/6 regression tests | PASS; 38/38 final reconciliation selection (prior broader 141/141 evidence retained) |
| Full `npm run test:unit` | PASS; 6,837/6,837, 262 suites |
| `npm run build` | PASS; PWA generated; existing warnings observed |
| Secret scan | PASS; no token-format, connection-string, JWT, or private-key signature found in the exact evidence diff |
| `git diff` / `git diff --cached` before evidence | Clean |
| Security remediation contract tests | PASS; 9/9 targeted tests across all three Phase 6 remediation packages |
| `package.json` blob | Matches `origin/main` (`57a291a90903f3f11c081f7e032598b94ba0c198`) |
| `package-lock.json` blob | Matches `origin/main` (`0bc30b2dabf45d98c3bdabb583f88ce99496999f`) |

## Primary evidence sources

- `docs/v5/PHASE_AI_V52_PHASE5_STAGING_POST_APPLY_CERTIFICATION.{md,json}`
- `docs/v6/security-invoker-view-remediation-01/POST_APPLY_CERTIFICATION.{md,json}`
- `docs/v6/security-invoker-view-remediation-01/FINAL_FIXTURE_QA_EVIDENCE.{md,json}`
- `docs/v6/club-data-v3-anon-policy-remediation-02/POST_APPLY_CERTIFICATION.{md,json}`
- `docs/v6/staging-six-rls-errors-audit-01/`
- `docs/v6/staging-six-rls-errors-remediation-01/POST_APPLY_CERTIFICATION.md`
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
