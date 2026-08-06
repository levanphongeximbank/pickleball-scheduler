# Phase 5 Preview Flag-ON Acceptance Readiness Audit

**Program:** PICK_VN Canonical Navigation  
**Phase:** 5 — Preview acceptance readiness (audit only)  
**Mode:** Readiness audit — **no implementation, no deploy, no env change, no PR, no commit**  
**Generated:** 2026-08-06  
**Worktree:** `C:\Users\Le Phong\PICK_VN-Workstreams\ui-ux\canonical-navigation-phase5`  
**Branch:** `feature/canonical-navigation-phase5-preview-acceptance`  
**Base HEAD (expected):** `087c61c7d8bb1efdae343685269e53aa75767e21`

Machine-readable twin: [`PHASE5_PREVIEW_ACCEPTANCE_READINESS_AUDIT.json`](./PHASE5_PREVIEW_ACCEPTANCE_READINESS_AUDIT.json)

Related matrices:

- [`PHASE5_PREVIEW_ROUTE_MATRIX.md`](./PHASE5_PREVIEW_ROUTE_MATRIX.md)
- [`PHASE5_ROLE_AND_IDENTITY_MATRIX.md`](./PHASE5_ROLE_AND_IDENTITY_MATRIX.md)
- [`PHASE5_PREVIEW_EXECUTION_PLAN.md`](./PHASE5_PREVIEW_EXECUTION_PLAN.md)

---

## Final Verdict

**`CANONICAL_NAVIGATION_PHASE5_PREVIEW_ACCEPTANCE_READY_WITH_BLOCKERS`**

Phase 4 runtime cutover is merged on `origin/main`. Code, route registry (179/179), menu (76 / contextual 7 / duplicates 0), B01 separate, B02 retain, B03 guarded, and seven Engine routes protected are ready for controlled Preview flag-ON acceptance.

Execution is **not** clear yet: Preview flag remains historically OFF; Owner must set Preview-scoped env without touching Production; a Preview redeploy/PR trigger is required; PLATFORM_ADMIN and COACH staging identities are missing; CLUB_MANAGER coverage is limited.

---

## STEP 1 — Baseline

| Field | Value |
|-------|-------|
| `git fetch origin --prune` | Done |
| Current branch | `feature/canonical-navigation-phase5-preview-acceptance` |
| Current HEAD | `087c61c7d8bb1efdae343685269e53aa75767e21` |
| Fresh `origin/main` SHA | `087c61c7d8bb1efdae343685269e53aa75767e21` |
| Ahead / behind `origin/main` | **0 ahead / 0 behind** |
| Worktree status | Clean before deliverables (tracked) |
| Staged files | **0** |
| Untracked (this worktree, pre-deliverables) | **0** |
| Owner repository 10 pre-existing untracked | **Preserved** (not modified; not probed destructively) |
| Unrelated worktrees / branches / stashes | Untouched |
| Runtime / tests / env / deploy / PR / commit / push | **NO** |

### Phase 4 ancestor confirmation (fresh `origin/main`)

| SHA | Ancestor of `origin/main` |
|-----|---------------------------|
| `14bd1fb0fc530a6aa56214060d822e71fd7239f6` | **YES** |
| `295c3f21fe2591fead9192d415f20b38cf20be26` | **YES** |
| `1c5ff4d81ab5cff007d4324dadb91a27ce6924c6` | **YES** |
| `087c61c7d8bb1efdae343685269e53aa75767e21` | **YES** (tip) |

Tip message: Merge PR #383 Phase 4 post-merge verification docs; Phase 4 runtime cutover via PR #382.

### Phase 4 readiness inherited (code)

| Metric | Value | Evidence |
|--------|------:|----------|
| Route reconciliation | **179/179** | Phase 4 post-merge verification |
| Active menu nodes | **76** | OD-B01 dual-canonical (+1 vs Phase 3) |
| Contextual routes | **7** | Engine family |
| Duplicate active entries | **0** | |
| B01 | Separate `/messages` + `/crm/messages` | OD-B01 |
| B02 | 43 LEGACY `/tournament*` retained; 0 invented redirects | OD-B02 |
| B03 | Pilot-aligned shadow guard | OD-B03 |
| Plural Engine authz | 7 routes protected | OD-PLURAL-AUTHZ |
| Production flag | **OFF** | Binding |

---

## STEP 2 — Preview environment readiness

Flag: `VITE_CANONICAL_APP_SHELL_ENABLED` (`src/features/canonical-shell/flags.js`)

| Truthy inputs | `true` / `"true"` / `"1"` |
| Default | OFF (absent / false-like) |
| Bake-time | **Vite build-time** — runtime toggle alone is insufficient |

### How Preview can enable without Production impact

| Provider | Isolation mechanism | Evidence |
|----------|---------------------|----------|
| **Vercel** | Environment Variables scoped **Preview** (not Production) | Phase 2 Preview report; Staging Vercel dashboard procedure (`pickleball-scheduler`) |
| **Netlify** | Deploy Preview / context env separate from Production site env | Phase 2 Netlify `deploy-preview` SUCCESS; site `stirring-bombolone-280231` |

| Question | Finding |
|----------|---------|
| Can enable on Preview without Production? | **YES** if scoped Preview-only |
| Separate Vercel Preview vs Netlify Deploy Preview values? | **YES** — independent consoles; both must be set if dual-provider acceptance is required |
| Tied to branch or PR? | **Both** — Vercel git-branch Preview URLs + PR deployments; Netlify `deploy-preview-<PR>` |
| Redeploy required after env change? | **YES** (Vite bake-time) |
| Production value isolated? | **YES** when Production scope untouched |
| Secrets / Production credentials exposed by flag toggle? | **NO** for this boolean flag; Preview already uses Staging Supabase anon (public client) — do not paste service-role into SPA |
| Repo `.env` file change required? | **NO** — dashboard Preview env only |

### Classification

**`PREVIEW_FLAG_CONTROL_READY_WITH_BLOCKERS`**

Mechanism is proven. Blockers: Owner must authorize and set Preview-scoped value; both providers need alignment if both are acceptance targets; redeploy/PR required; current historical Preview state is flag **OFF** (Phase 2 attestation).

---

## STEP 3 — Preview deployment path

### Safe path (Phase 5)

1. Owner sets `VITE_CANONICAL_APP_SHELL_ENABLED=true` on **Vercel → Preview** only (confirm Production remains unset/false).  
2. Optionally mirror on **Netlify Deploy Preview** context only.  
3. Open documentation-only (or no-op) PR from this branch **or** Redeploy an existing Preview SHA after env set.  
4. Wait for CI + Vercel Preview + Netlify Deploy Preview.  
5. Execute acceptance matrices against Preview URLs (Staging identities).  
6. Rollback = Preview flag OFF + Preview redeploy only.

| Item | Detail |
|------|--------|
| Vercel Preview | Project `pickleball-scheduler`; URL pattern `pickleball-scheduler-git-<branch>-….vercel.app` |
| Netlify Deploy Preview | `https://deploy-preview-<PR>--stirring-bombolone-280231.netlify.app` |
| GitHub PR checks | Production CI Gate `verify` + Vercel + Netlify checks (Phase 2 pattern) |
| Branch deployment | Branch equals `main` tip today — **docs PR recommended** to mint unique Preview |
| Docs-only / no-op PR sufficient? | **YES** after Preview env set (or Redeploy without PR if Owner prefers) |
| Rollback | Unset/false Preview flag → Redeploy Preview → verify legacy shell; Production untouched |

**Do not deploy Production. Do not change Production env.**

---

## STEP 4 — Test accounts and role coverage

See [`PHASE5_ROLE_AND_IDENTITY_MATRIX.md`](./PHASE5_ROLE_AND_IDENTITY_MATRIX.md). Credentials must never appear in reports; use operator-local `.env.staging-qa.local` / known Staging QA password vault.

| Role / identity | Classification |
|-----------------|----------------|
| Unauthenticated visitor | **READY** |
| PLAYER | **READY** |
| VENUE_OWNER | **READY** |
| VENUE_MANAGER | **READY** |
| CLUB_OWNER | **READY** |
| CLUB_MANAGER | **READY_WITH_LIMITATIONS** |
| REFEREE | **READY_WITH_LIMITATIONS** |
| COACH | **MISSING** |
| PLATFORM_ADMIN | **MISSING** |
| SUPER_ADMIN | **READY** |

Counts: audited **10** · ready **5** · ready_with_limitations **2** · missing **2** · not_required **0** (visitor counted in ready).

---

## STEP 5 — Acceptance route matrix

See [`PHASE5_PREVIEW_ROUTE_MATRIX.md`](./PHASE5_PREVIEW_ROUTE_MATRIX.md).

Coverage classes: Public, Messaging, Tournament Engine (7 + denial cases), Rating V5 shadow, Private Pairing.

Routes in acceptance matrix: **≥ 30** discrete acceptance rows (public 6 + messaging 2 + engine 11 + rating 7 + pairing 3 + shell invariants).

---

## STEP 6 — Device and accessibility matrix

| Profile | Required |
|---------|----------|
| Desktop | YES |
| Tablet | YES |
| Mobile | YES |
| Keyboard-only | YES |
| High-contrast ON | YES |
| High-contrast OFF | YES |

Required checks (flag ON Preview):

- App shell renders once; no dual shell  
- Menu open/close; Escape restores focus  
- Tab / Shift+Tab trap; no keyboard dead-end  
- Mobile drawer works  
- Breadcrumbs + active route highlighting correct  
- Collapsed navigation behaves correctly  
- Responsive layout: no shell clipping  
- Console errors = **0** (filter known MUI DOM-prop noise only if previously accepted)

---

## STEP 7 — Flag ON/OFF acceptance

### Flag OFF

| Check | Expectation |
|-------|-------------|
| Legacy shell only | `legacy-app-shell` present |
| Canonical shell absent | No mounted canonical shell |
| Production-compatible rollback | Same as Production default |
| Inter CSS | Not loaded (dynamic import on canonical mount only) |

### Flag ON

| Check | Expectation |
|-------|-------------|
| Canonical shell only | `canonical-app-shell` present |
| Legacy shell absent | Not mounted |
| Menu count | **76** |
| Contextual routes | **7** |
| Duplicates | **0** |
| Route registry | **179/179** |
| B01 | Separate dual-canonical |
| B02 | Retained legacy mounts; no invented redirects |
| B03 | Guarded shadow |
| Seven Engine routes | Protected |

### Rollback

1. Return Preview flag to OFF / unset  
2. Redeploy **Preview only**  
3. Verify legacy shell restored  
4. Confirm Production deployment id + Production env unchanged  

---

## STEP 8 — Observability

| Signal | Preview capture readiness |
|--------|---------------------------|
| Browser console errors | READY (manual DevTools + Playwright if bypass available) |
| Network failures | READY (DevTools Network) |
| Failed route loads / lazy imports | READY |
| Authorization denial responses | READY (UI `/403` + network) |
| React runtime errors | READY (error boundary + console) |
| Redirect loops | READY (manual navigation) |
| Vercel deployment logs | READY (dashboard) |
| Netlify deployment logs | READY (dashboard) |
| Screenshots desktop/tablet/mobile | READY (manual; timestamped filenames) |
| Timestamped evidence pack | READY (operator procedure in execution plan) |
| Production monitoring enablement | **NOT REQUIRED / FORBIDDEN** for this phase |

Classification: observability **READY_WITH_LIMITATIONS** — automated Preview HTTP probes may need `VERCEL_AUTOMATION_BYPASS_SECRET` when Deployment Protection is on (do not commit secret).

---

## STEP 9 — Automation and manual plan

See [`PHASE5_PREVIEW_EXECUTION_PLAN.md`](./PHASE5_PREVIEW_EXECUTION_PLAN.md).

**Automated (pre-Preview / CI):** unit Phase 2–4 shell suites, UI/a11y focused, route registry, authorization unit, `lint:no-new`, `build`, secret scan.

**Manual Preview (flag ON):** real browser navigation, direct links, refresh, back/forward, responsive, keyboard, role menus, console, rollback.

---

## STEP 10 — Blockers

| ID | Impact | Owner decision | Implementation | Production risk |
|----|--------|----------------|----------------|-----------------|
| **BLK-PREVIEW-FLAG** | Cannot certify flag-ON Preview until Preview-scoped env set | **YES** | NO (dashboard) | Low if Preview-only |
| **BLK-PREVIEW-DEPLOYMENT** | Need Redeploy/PR after env; branch tip == main | **YES** (trigger method) | NO (docs PR optional) | None if Preview-only |
| **BLK-TEST-IDENTITY** | PLATFORM_ADMIN + COACH missing; passwords operator-local | **YES** if provisioning | NO for audit; optional seed later | None if Staging-only |
| **BLK-ROLE-COVERAGE** | Incomplete role×menu acceptance without missing identities | **YES** (waive or provision) | NO for audit | None |
| **BLK-ROUTE-COVERAGE** | None — matrix defined | NO | NO | None |
| **BLK-AUTHORIZATION** | None — Phase 4 closed on main | NO | NO | None |
| **BLK-ROLLBACK** | None — path clear | NO | NO | None if Preview-only |
| **BLK-OBSERVABILITY** | Bypass secret may block automated Preview probes | **YES** if automation required | NO | None |
| **BLK-PRODUCTION-ISOLATION** | Process discipline only — mechanism OK | **YES** (attest Production untouched) | NO | **Critical if mis-scoped** |

Active blockers requiring action before execution: **BLK-PREVIEW-FLAG**, **BLK-PREVIEW-DEPLOYMENT**, **BLK-TEST-IDENTITY**, **BLK-ROLE-COVERAGE**, **BLK-OBSERVABILITY** (if automated probes mandated), **BLK-PRODUCTION-ISOLATION** (attestation).

### Blocker details

#### BLK-PREVIEW-FLAG

- **Evidence:** Phase 2 Preview attestation kept flag OFF; no Phase 5 dashboard change performed (forbidden in this audit).  
- **Impact:** Flag-ON acceptance cannot start.  
- **Remediation:** Owner sets Preview-only `VITE_CANONICAL_APP_SHELL_ENABLED=true` on Vercel (and Netlify DP if used); confirm Production remains OFF; Redeploy Preview.  
- **Owner decision required:** YES  
- **Implementation required:** NO  
- **Production risk:** Low if scoped correctly; High if Production scope edited by mistake  

#### BLK-PREVIEW-DEPLOYMENT

- **Evidence:** Branch HEAD == `origin/main`; no unique Preview SHA until PR/redeploy.  
- **Impact:** No dedicated Preview URL for Phase 5 until trigger.  
- **Remediation:** Docs-only PR from this branch after env set, or Owner Redeploy Preview for tip SHA.  
- **Owner decision required:** YES (PR vs Redeploy)  
- **Implementation required:** NO  
- **Production risk:** None  

#### BLK-TEST-IDENTITY / BLK-ROLE-COVERAGE

- **Evidence:** Staging QA docs list SUPER_ADMIN, VENUE_OWNER, VENUE_MANAGER, CLUB_OWNER, PLAYER, REFEREE; no dedicated `PLATFORM_ADMIN` or `COACH` Staging emails; CLUB_MANAGER mainly via `manager@futurearena.local` (dev) not Staging seed table.  
- **Impact:** OD-B03 PLATFORM_ADMIN cell and COACH unrelated-role denial cannot be browser-certified without identities or Owner waiver.  
- **Remediation:** Owner provisions Staging identities **or** waives those cells to unit/UI suite evidence only.  
- **Owner decision required:** YES  
- **Implementation required:** NO for audit (SQL/account create forbidden here)  
- **Production risk:** None  

#### BLK-OBSERVABILITY

- **Evidence:** Historical Preview automation blocked without `VERCEL_AUTOMATION_BYPASS_SECRET`.  
- **Impact:** Manual browser acceptance still possible; scripted Preview smoke may fail.  
- **Remediation:** Operator supplies bypass locally for scripts; or accept manual-only evidence.  
- **Owner decision required:** YES if automation required  
- **Implementation required:** NO  
- **Production risk:** None  

#### BLK-PRODUCTION-ISOLATION

- **Evidence:** Production GO = NO; Production flag must remain OFF.  
- **Impact:** Process risk only.  
- **Remediation:** Pre/post checklist: Production deployment id unchanged; Production env flag unchanged; no Production Redeploy.  
- **Owner decision required:** YES (sign-off attestation)  
- **Implementation required:** NO  
- **Production risk:** Critical if violated  

---

## Proposed files (execution phase — not created here)

| Class | Paths |
|-------|-------|
| Proposed implementation files | **0** (flag/dashboard only; no runtime code required for Preview enable) |
| Proposed test files | Optional evidence harness only — prefer existing `tests/canonical-shell-phase*.test.js` + `tests/ui/canonical-shell-phase*.ui.test.jsx` |
| Proposed documentation files | This package + future `PHASE5_PREVIEW_ACCEPTANCE_EVIDENCE.*` after execution |

---

## Safety attestation

| Check | Value |
|-------|------:|
| Production mutations | **0** |
| SQL execution | **0** |
| Deployments | **0** |
| Production feature flag changes | **0** |
| Runtime code modified | **NO** |
| Tests modified | **NO** |
| Environment variables changed | **NO** |
| Commit | **NO** |
| Push | **NO** |
| PR | **NO** |
| Reset / rebase / restore / clean / amend / force-push | **NO** |
