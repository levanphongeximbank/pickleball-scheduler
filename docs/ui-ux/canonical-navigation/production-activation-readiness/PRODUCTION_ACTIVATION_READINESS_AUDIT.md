# Canonical Navigation — Production Activation Readiness Audit (Read-Only)

**Program:** PICK_VN Canonical Navigation  
**Document:** Production activation readiness audit  
**Mode:** READ ONLY — no flag enablement, deploy, env mutation, SQL, Auth, Staging, or Production mutation  
**Audited:** 2026-08-06  
**Expected / audit content baseline:** `f81b6c8f0c43af3f5b25dc09e688fe534f70d64c` (PR #387 merge — Canonical Navigation Phase 5 post-merge evidence)  
**Fresh `origin/main` at audit close:** `d4fcb31dbd42927f9b8e02e2b63331b9233ccdc7` (ancestor chain includes expected baseline; tip adds unrelated Operation B1B docs via PR #386)  
**Owner repository local HEAD:** `cae5e6f7496522ea1ba33a474d2c939084ba9844` (behind fresh `origin/main` by **115** commits)  
**Machine-readable:** [`PRODUCTION_ACTIVATION_READINESS_AUDIT.json`](./PRODUCTION_ACTIVATION_READINESS_AUDIT.json)

---

## Final verdict

**`CANONICAL_NAVIGATION_PRODUCTION_ACTIVATION_READINESS_READY_FOR_PLANNING`**

Phase 5 Preview acceptance, Preview rollback, post-merge verification, and critical automated coverage are on `origin/main`. No authoritative Production-activation phase charter exists yet. Enough evidence exists to plan a controlled Production cutover; **Production GO remains NO** and the flag must stay OFF until Owner binds a separate activation package.

This audit does **not** enable the feature, does **not** deploy, and does **not** invent a phase number.

---

## Step 1 — Fresh baseline

| Item | Value |
|------|--------|
| `git fetch origin --prune` | Done |
| Current branch | `main` |
| Current HEAD (owner repo) | `cae5e6f7496522ea1ba33a474d2c939084ba9844` |
| Fresh `origin/main` SHA (audit close) | `d4fcb31dbd42927f9b8e02e2b63331b9233ccdc7` |
| Expected main baseline | `f81b6c8f0c43af3f5b25dc09e688fe534f70d64c` — **ancestor of fresh tip** |
| Tip delta after expected baseline | PR #386 Operation B1B planning docs only — **0** paths under canonical navigation / shell |
| Local vs fresh `origin/main` | **0 ahead / 115 behind** |
| Staged files | none |
| Modified tracked files | none |
| Untracked (pre-existing, preserved) | **10** known owner-repo files (hard-cutover evidence + `scripts/_hc_owner_final_run_tmp.mjs`) |
| Worktrees | Many unrelated worktrees present; none created/removed by this audit |
| Stash list | empty |

**Authority note:** Canonical Navigation evidence and runtime assessment use **expected baseline `f81b6c8f`** (and identical canonical paths on fresh tip `d4fcb31d`). Local checkout tip is stale and is not the authority for shell/docs content.

### Known pre-existing untracked files (preserved)

1. `docs/platform-hard-cutover-01/phase-04/staging-rehearsal/evidence/13_DESTRUCTIVE_STAGE_STAGING_EXECUTED_2026-07-30.json`
2. `docs/platform-hard-cutover-01/phase-04/staging-rehearsal/evidence/14_OPERATOR_JWT_RESEED_BLOCKED_NO_OPERATOR_SESSION_2026-07-30.json`
3. `docs/platform-hard-cutover-01/phase-04/staging-rehearsal/evidence/16_A_COURT_RPC_PACKAGE_POST_MERGE_VERIFIED_2026-07-30.json`
4. `docs/platform-hard-cutover-01/phase-04/staging-rehearsal/evidence/17_A_COURT_RPC_STAGING_APPLY_2026-07-30.json`
5. `docs/platform-hard-cutover-01/phase-04/staging-rehearsal/evidence/19_A_COURT_VENUE_OWNER_AUTH_APPLIED_2026-07-30.json`
6. `docs/platform-hard-cutover-01/phase-04/staging-rehearsal/evidence/21_A_RATE_OWNER_ASSESS_SELF_RBAC_APPLIED_2026-07-30.json`
7. `docs/platform-hard-cutover-01/phase-04/staging-rehearsal/evidence/23_A_RATE_PILOT_POST_MERGE_VERIFIED_2026-07-30.json`
8. `docs/platform-hard-cutover-01/phase-04/staging-rehearsal/evidence/24_FULL_REMAINING_ACCEPTANCE_PREFLIGHT_2026-07-30.json`
9. `docs/platform-hard-cutover-01/phase-04/staging-rehearsal/evidence/26_REMAINING_ACCEPTANCE_REMEDIATION_ACTIVATED_2026-07-30.json`
10. `scripts/_hc_owner_final_run_tmp.mjs`

---

## Step 2 — Discover existing program plan

### Searched

- `docs/ui-ux/canonical-navigation/**` on `origin/main`
- `VITE_CANONICAL_APP_SHELL_ENABLED`, production activation/cutover, rollback/monitoring, Phase 6/7, Owner GO
- Directory inventory: `phase2` … `phase5` only — **no** `phase6`, **no** `phase7`, **no** prior `production-activation-readiness`

### What exists

| Artifact | Relevance |
|----------|-----------|
| `NAVIGATION_IMPLEMENTATION_PLAN.md` | Original roadmap; “Phase 6 — QA Matrix” = mobile/10-role QA (historical), **not** Production flag activation |
| `phase2`–`phase5` | Implementation + Preview acceptance + rollback evidence |
| Phase 2/3 rollback plans | Reusable flag-OFF + redeploy pattern |
| Phase 5 Owner attestation | `PRODUCTION_GO=NO`; Production flag `OFF_OR_ABSENT` |
| Phase 5 post-merge (#387) | OBS-P5-PM-01 retained (Vercel auto Production deploy on merge) |
| COACH backlog `BL-P5-COACH-ROLE-SCHEMA` | Post–Phase 5 schema gap; still OPEN |

### Classification

**`PARTIAL_PLAN_FOUND`**

Reusable Preview/rollback/flag mechanics and Phase 5 evidence exist. **No authoritative next-phase charter** for Production activation (no numbered phase directory, no Owner-bound Production GO package).

Do **not** treat historical “Phase 6 — QA Matrix” as the Production activation phase.

**Authoritative plan path for this planning pack:**  
`docs/ui-ux/canonical-navigation/production-activation-readiness/`  
(created by this audit; not a numbered phase).

---

## Step 3 — Production flag inventory

| Topic | Finding |
|-------|---------|
| Flag name | `VITE_CANONICAL_APP_SHELL_ENABLED` |
| Code constant | `CANONICAL_APP_SHELL_FLAG` in `src/features/canonical-shell/flags.js` |
| Primary reader | `isCanonicalAppShellEnabled()` |
| Layout switch | `src/layouts/MainLayout.jsx` — if enabled → `CanonicalAppShell`; else → `LegacyMainLayoutContent` |
| Dual shell | Forbidden by design — exclusive branch |
| Default when absent | **OFF** (`raw === true \| "true" \| "1"` only) |
| Evaluation mode | **Vite build-time** (`import.meta.env`) — bake into bundle |
| Runtime toggle alone | **Insufficient** — requires rebuild/redeploy |
| Preview scope | Proven ON then OFF (Phase 5 acceptance + rollback) |
| Production scope | Attested **`OFF_OR_ABSENT`**; **not** proven live from this audit (no dashboard read) |
| Rollback mechanism | Set Production flag OFF/absent → **Production redeploy** → verify `legacy-app-shell` |
| Redeploy required for flag change | **YES** |
| Merge to `main` auto Production deploy | **YES** (PGO + OBS-P5-PM-01) — docs-only merges still trigger Vercel Production pipeline |
| Production flag state directly proven here | **NO** — last Owner attestation only; re-attest before activation |

**Code readers (runtime):**

1. `src/features/canonical-shell/flags.js` — definition + evaluator  
2. `src/features/canonical-shell/runtime.js` / `index.js` — re-exports  
3. `src/layouts/MainLayout.jsx` — exclusive shell switch  
4. Tests under `tests/canonical-shell-*.test.js` and `tests/ui/canonical-shell-*.ui.test.jsx` (not Production readers)

---

## Step 4 — Cutover dependency summary

See full matrix: [`PRODUCTION_CUTOVER_DEPENDENCY_MATRIX.md`](./PRODUCTION_CUTOVER_DEPENDENCY_MATRIX.md)

| Bucket | Count (approx.) |
|--------|----------------:|
| SATISFIED | 10 |
| SATISFIED_WITH_OBSERVATION | 8 |
| MUST_CLOSE_BEFORE_PRODUCTION | 11 |
| MAY_DEFER_WITH_OWNER_ACCEPTANCE | 7 |
| OUT_OF_SCOPE | 2 |

---

## Step 5 — Production identity coverage (minimum)

Staging Preview identities are **not** Production-safe by default. Production activation needs an Owner-bound Production identity matrix (or explicit risk acceptance).

| Role | Available (Staging evidence) | Production-safe default | Separate Owner GO |
|------|------------------------------|-------------------------|-------------------|
| SUPER_ADMIN / PLATFORM_ADMIN-eq | Staging SUPER_ADMIN Package A | **No** (Staging ≠ Production) | **YES** for any Production login |
| VENUE_OWNER | Staging ready | **No** until Production-bound | **YES** |
| VENUE_MANAGER | Staging ready | **No** until Production-bound | **YES** |
| CLUB_OWNER / CLUB_MANAGER | Ready / limited | **No** until Production-bound | **YES** |
| REFEREE | Ready with limitations | **No** until Production-bound | **YES** |
| PLAYER | Staging ready | **No** until Production-bound | **YES** |
| Unauthenticated | READY | **YES** (no account) | No for public smoke |
| COACH | `WAIVED_WITH_KNOWN_SCHEMA_GAP` | Not available without schema workstream | Schema + fixture GOs separate |

Prefer **read-only** browser checks. Avoid writes unless Owner authorizes a write cell.

---

## Step 6 — Browser acceptance plan

See [`PRODUCTION_BROWSER_ACCEPTANCE_PLAN.md`](./PRODUCTION_BROWSER_ACCEPTANCE_PLAN.md).

Phases: pre-activation → activation-window → post-activation → rollback verification.  
Devices: desktop, tablet, mobile. Behaviors: direct link, refresh, back/forward, menu expand, public/protected/unauthorized, shell exclusivity, white screen = 0, console errors = 0, high contrast, keyboard.

---

## Step 7 — Deployment and rollback

See [`PRODUCTION_ROLLBACK_PLAN.md`](./PRODUCTION_ROLLBACK_PLAN.md).

Controlled sequence (not executed): preflight → Owner GO binding → build validation → Production flag change → Production redeploy → browser smoke → monitoring window → rollback decision → flag OFF → rollback redeploy → evidence.

**STOP** if: Production GO missing; flag mis-scoped; white screen; auth redirect loop; privilege bypass; public route failure; rollback redeploy fails; automatic unrelated merge deploy mid-window without Owner control.

---

## Step 8 — Risk register

See [`PRODUCTION_RISK_REGISTER.md`](./PRODUCTION_RISK_REGISTER.md).

Highest risks: build-time flag mismatch, Vercel automatic Production deploy (OBS-P5-PM-01), incomplete Production role coverage, auth redirect loop / white screen, rollback redeploy failure.

---

## Step 9 — Decision

| Option | Selected? |
|--------|:---------:|
| `CANONICAL_NAVIGATION_PRODUCTION_ACTIVATION_READINESS_READY_FOR_PLANNING` | **YES** |
| `CANONICAL_NAVIGATION_PRODUCTION_ACTIVATION_READINESS_BLOCKED_BY_PREREQUISITES` | no |
| `CANONICAL_NAVIGATION_AUTHORITATIVE_NEXT_PHASE_ALREADY_DEFINED` | no |

**Rationale:** Partial reusable plans exist; no authoritative next phase blocks creating this pack; prerequisites for **activation** remain open, but planning may proceed.

### Program-state cross-check

| Owner-stated program fact | Audit finding on `origin/main` |
|---------------------------|--------------------------------|
| Phase 5 CLOSED | Evidence pack merged (#385, #387); some Phase 5 docs still say “does not claim CLOSED” — treat **Owner program state = CLOSED** for planning, keep documentary nuance |
| PR #385 / #387 MERGED | Confirmed |
| Preview acceptance PASS_WITH_OBSERVATIONS | Confirmed |
| Preview rollback PASS | Confirmed |
| Focused critical tests 99/99 | Confirmed on post-merge evidence |
| Production flag OFF_OR_ABSENT | Attested; not live-reproven here |
| Production GO = NO | Confirmed |
| COACH WAIVED_WITH_KNOWN_SCHEMA_GAP | Confirmed; backlog OPEN |
| OBS-P5-PM-01 retained | Confirmed on main via #387 |

---

## Owner decisions still required (before activation)

See [`OWNER_DECISION_PACKAGES.md`](./OWNER_DECISION_PACKAGES.md).

1. Bind Production activation charter (name/path — **do not invent phase number here**)  
2. `PRODUCTION_GO` / flag-change GO / redeploy GO  
3. Production identity matrix GO (or accept Staging/Preview evidence transfer with bounds)  
4. Accept or close Phase 5 NOT_TESTED cells for Production (refresh, back/forward, HC, non-admin roles, manual Engine/B03/PP)  
5. Accept or remediate OBS-UI-01 / OBS-RUNTIME-* / OBS-DATA-01 for Production  
6. Name deployment owner, rollback owner, monitoring owner, windows, rollback thresholds  
7. Re-attest Production flag state in Vercel dashboard before and after change  
8. Decide COACH: continue waiver vs require schema workstream before GO  

---

## Safety attestation (this audit)

| Item | Value |
|------|------:|
| Runtime changes | **0** |
| Test changes | **0** |
| Environment changes | **0** |
| Deployments | **0** |
| SQL mutations | **0** |
| Staging mutations | **0** |
| Auth mutations | **0** |
| Production mutations | **0** |
| Commit | **NO** |
| Push | **NO** |
| PR | **NO** |

### Files created (uncommitted)

- `docs/ui-ux/canonical-navigation/production-activation-readiness/PRODUCTION_ACTIVATION_READINESS_AUDIT.md`
- `docs/ui-ux/canonical-navigation/production-activation-readiness/PRODUCTION_ACTIVATION_READINESS_AUDIT.json`
- `docs/ui-ux/canonical-navigation/production-activation-readiness/PRODUCTION_CUTOVER_DEPENDENCY_MATRIX.md`
- `docs/ui-ux/canonical-navigation/production-activation-readiness/PRODUCTION_CUTOVER_DEPENDENCY_MATRIX.json`
- `docs/ui-ux/canonical-navigation/production-activation-readiness/PRODUCTION_BROWSER_ACCEPTANCE_PLAN.md`
- `docs/ui-ux/canonical-navigation/production-activation-readiness/PRODUCTION_ROLLBACK_PLAN.md`
- `docs/ui-ux/canonical-navigation/production-activation-readiness/PRODUCTION_RISK_REGISTER.md`
- `docs/ui-ux/canonical-navigation/production-activation-readiness/OWNER_DECISION_PACKAGES.md`
