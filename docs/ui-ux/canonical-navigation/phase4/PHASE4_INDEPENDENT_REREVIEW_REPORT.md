# Phase 4 Independent Remediation Re-Review

**Program:** PICK_VN Canonical Navigation  
**Phase:** 4 — Independent remediation re-review (no commit)  
**Branch:** `feature/canonical-navigation-phase4-runtime-cutover`  
**Base HEAD:** `6ece104677ec1db4ba1b19bc666a1a41ac2c2a93`  
**Prior review:** `CANONICAL_NAVIGATION_PHASE4_INDEPENDENT_REVIEW_CHANGES_REQUIRED`  
**Remediation claim:** `CANONICAL_NAVIGATION_PHASE4_REMEDIATION_COMPLETE_READY_FOR_REREVIEW`  
**Machine-readable:** [`PHASE4_INDEPENDENT_REREVIEW_REPORT.json`](./PHASE4_INDEPENDENT_REREVIEW_REPORT.json)

## Final Verdict

**`CANONICAL_NAVIGATION_PHASE4_INDEPENDENT_REREVIEW_PASS_READY_FOR_COMMIT`**

Remediated defects BR-PLURAL-01 and BR-B03-01 are closed by independent code-branch inspection and behavioral tests. B01/B02 preserved. Public catalog exact-match holds for `/tournaments` and `/tournaments/`. No runtime or test files were modified during this re-review. No commit / push / PR / deploy / Production changes.

---

## 1. Exact inventory (independently recomputed)

| Class | At re-review start (claimed 46) | After this deliverable |
|-------|-------------------------------:|-----------------------:|
| Modified tracked | **17** | **17** |
| Untracked | **29** | **31** |
| Staged | **0** | **0** |
| Exact total changed | **46** | **48** |
| Runtime | **17** | **17** |
| Test | **8** | **8** |
| Manifest | **1** | **1** |
| Documentation | **20** | **22** |
| Unrelated | **0** | **0** |

Claimed pre-re-review inventory **46 / 17 / 29 / 0 / 17 / 8 / 1 / 20 / 0** matches independent recount. Delta +2 is this re-review report pair only. package/lock / SQL / env / deploy diffs = **0**.

---

## 2. BR-PLURAL-01 — CLOSED (PASS)

### Code branches inspected

- `decideTournamentEngineRouteGate` forces `can(user, tournament.update, scope, { rbacEnabled: true })` whenever `authProductionEnabled || rbacEnabled`.
- Ownership uses `evaluateTournamentEngineRouteAccess({ forceAuthz: true })` → `assertTournamentAccess` with RBAC semantics.
- `RouteAccessGate` calls the decision helper **before** the `if (!rbacEnabled) return children` short-circuit — RBAC-off cannot skip Engine enforcement when auth is active.
- No weaker Engine path under Auth ON + RBAC ON (same forced permission + ownership).

### Matrix

| Scenario | Result |
|----------|--------|
| Auth ON + RBAC OFF — unauthenticated | PASS → login |
| Auth ON + RBAC OFF — no `tournament.update` | PASS → forbidden |
| Auth ON + RBAC OFF — permission, bad tenant/ownership | PASS → forbidden |
| Auth ON + RBAC OFF — permission + ownership | PASS → allow |
| Auth ON + RBAC OFF — unknown role | PASS → fail-closed |
| Auth ON + RBAC ON — same requirements | PASS |
| Auth OFF + RBAC OFF | Gate `apply:false` (local/dev open) — **does not weaken Production** when `authProductionEnabled=true` |

Seven Engine tabs detected and permission-mapped. Behavioral unit + real `RouteAccessGate` UI tests exercise RBAC-off and RBAC-on cells.

---

## 3. Public tournament catalog — PASS

| Path | Public? | Nested Engine? |
|------|---------|----------------|
| `/tournaments` | YES | no |
| `/tournaments/` | YES | no |
| `/tournaments?x=1` | YES (query stripped) | no |
| `/tournaments/?x=1` | YES | no |
| `/tournaments/t1` | NO (login required when auth on) | not Engine tab |
| `/tournaments/t1/engine` (and 6 siblings) | NO | YES protected |

`/tournaments` is **not** in `PUBLIC_PATH_PREFIXES` — no prefix accidental publicity. Hash is not part of React Router `pathname`; helper given a literal `#` string fail-closes (non-public) — observation only.

---

## 4. BR-B03-01 — CLOSED (PASS)

| Cell | Guard sync | Page access |
|------|------------|-------------|
| Unauthenticated | deny → login | unauthorized |
| SUPER_ADMIN flag OFF | allow | allow `ADMIN_TECH_EVAL` |
| SUPER_ADMIN flag ON | allow | allow |
| PLATFORM_ADMIN flag OFF | allow | allow |
| PLATFORM_ADMIN flag ON | allow | allow |
| PLAYER flag OFF | controlled_unavailable (guard pass-through) | **denied** workspace |
| PLAYER flag ON + enrollment | allow (async) | allow |
| PLAYER flag ON + no enrollment | deny → 403 | n/a |
| Unrelated roles | deny → 403 | forbidden |
| Unknown role | deny → 403 | forbidden |

Page uses `evaluateSkillAssessmentV5PageAccess` — admins are not re-blocked after the guard allows. Hidden from desktop/mobile/search verified by Phase 4 B03 tests + Phase 3 RBAC suite.

---

## 5. B01 preservation — PASS

- Distinct mounts: `MessagingExperiencePage` vs `CrmMessagesPage`
- No redirect either direction (router regex probe)
- Distinct menu/search/RBAC; duplicate active entries **0**

## 6. B02 preservation — PASS

- LEGACY `/tournament*` catalog mounts = **43** (42 audited + entry-fee)
- Redirects invented = **0**
- No fabricated `tournamentId` / no plural rewrite of hubs
- Legacy writers retained under flag OFF (documented)

## 7. Route registry — PASS

| Metric | Value |
|--------|------:|
| Reconciliation | **179/179** |
| Active menu | **76** |
| Contextual | **7** |
| Duplicate active | **0** |
| Private Pairing protected | PASS (Phase 3) |
| V5 hidden menu/search | PASS |
| Shell OFF=legacy / ON=canonical | PASS (`MainLayout`) |
| Rollback = flag OFF | PASS |

---

## 8. Test quality — PASS

- No `.only` / skipped in Phase 4 suites
- Engine unit tests exercise RBAC OFF permission/ownership/unknown-role cells explicitly
- Public trailing slash explicitly asserted
- Nested Engine login + gate decision asserted for all 7 tabs
- Admin flag OFF + page helper + UI guard/page behavioral tests present
- UI Engine test mocks contexts only; **real** `RouteAccessGate` + real `can`/`assertTournamentAccess` path
- Enrollment service stubbed only to control PLAYER enrolled/not cells (canonical authority interface)

---

## 9. Documentation consistency — PASS WITH NOTE

Current implementation + remediation reports agree on OD codes, 42/43, 7 Engine routes, public slash variants, ACTIVE_MENU **76**, redirects **0**, Production OFF, mutations/SQL/deploy **0**, commit/push/PR **NO**.

**Note:** Historical body of `PHASE4_INDEPENDENT_REVIEW_REPORT.md` still contains original FAIL prose below a remediation addendum — archive, not current status. Does not block commit.

---

## 10. Independent validation (re-run)

| Gate | Result |
|------|--------|
| Focused Phase 2–4 unit | PASS **53/53** |
| `npm run test:unit` | PASS **6892/6892** |
| Focused UI (phase2/3/4 a11y/authz + rating v5) | PASS **42/42** |
| lint:no-new | PASS |
| build | PASS |
| secret scan | PASS **0** |
| package/lock | PASS (no diff; Inter `^5.3.0`) |
| `git diff --cached` | EMPTY |

---

## 11. Scope integrity — PASS

Unrelated **0**; no SQL/env/deploy/package-lock/Production config changes in worktree diff. Re-review did not modify runtime or tests. Owner repo untracked set not mutated by this worktree.

---

## Blockers / Warnings

**Blockers:** none

**Warnings:**

1. Auth OFF + RBAC OFF leaves Engine gate unapplied (intentional local/dev); Production remains protected whenever `authProductionEnabled` is true.
2. Catalog helper does not strip `#` if present in a non-Router pathname string (fail-closed); React Router `pathname` never includes hash.
3. Historical independent-review FAIL prose retained under remediation addendum.
4. Static CanonicalAppShell import observation retained; Vite chunk-size warning non-blocking.

---

## Safety attestation

| Check | Value |
|-------|------:|
| Production mutations | **0** |
| SQL execution | **0** |
| Deployments | **0** |
| Production feature flag changes | **0** |
| Runtime/tests modified by re-review | **NO** |
| Commit / push / PR | **NO** |

### Final git status (summary)

- Branch: `feature/canonical-navigation-phase4-runtime-cutover` @ `6ece1046…`
- Staged: empty
- Uncommitted Phase 4 implementation + docs + tests remain local only
