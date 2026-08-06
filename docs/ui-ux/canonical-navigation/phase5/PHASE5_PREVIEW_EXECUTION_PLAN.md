# Phase 5 Preview Acceptance Execution Plan

**Program:** PICK_VN Canonical Navigation  
**Phase:** 5 — Planned execution (not run in this audit)  
**Prerequisite verdict:** `CANONICAL_NAVIGATION_PHASE5_PREVIEW_ACCEPTANCE_READY_WITH_BLOCKERS`  
**Owner decisions:** [`PHASE5_OWNER_DECISIONS_RECORDED.md`](./PHASE5_OWNER_DECISIONS_RECORDED.md)  
**Preflight gate:** [`PHASE5_IDENTITY_ENV_PREFLIGHT.md`](./PHASE5_IDENTITY_ENV_PREFLIGHT.md)  
**Owner attestation:** [`PHASE5_OWNER_ATTESTATION.md`](./PHASE5_OWNER_ATTESTATION.md) — **`PREVIEW_GO=YES`**  
**Manual evidence:** [`PHASE5_MANUAL_PREVIEW_ACCEPTANCE_REPORT.md`](./PHASE5_MANUAL_PREVIEW_ACCEPTANCE_REPORT.md) — **`PASS_WITH_OBSERVATIONS`** (partial matrix; PR #385)  
**Rollback evidence:** [`PHASE5_PREVIEW_ROLLBACK_REPORT.md`](./PHASE5_PREVIEW_ROLLBACK_REPORT.md) — **`CANONICAL_NAVIGATION_PHASE5_PREVIEW_ROLLBACK_PASS`**  
**Production GO:** **NO**

Machine-readable: [`PHASE5_PREVIEW_EXECUTION_PLAN.json`](./PHASE5_PREVIEW_EXECUTION_PLAN.json)

### Owner binding (first pass)

| Topic | Binding |
|-------|---------|
| Environment | **Vercel Preview only** (Netlify out of first pass) |
| Trigger | **Draft PR** (exact SHA) |
| Flag | Preview `VITE_CANONICAL_APP_SHELL_ENABLED=true`; Production OFF/absent |
| Observability | **Manual browser only** (no bypass secrets / no authed probes) |
| Rollback | Preview flag OFF → Redeploy Preview only |

---

## Goal

Certify Canonical Navigation on a **controlled Vercel Preview** deployment with `VITE_CANONICAL_APP_SHELL_ENABLED=true`, without touching Production env, Production deploy, or SQL.

---

## Exact order

### Phase A — Owner gate (blockers)

1. **Attest Production baseline**  
   - Record Production deployment id for `pickvn.app` / Production host.  
   - Confirm Production `VITE_CANONICAL_APP_SHELL_ENABLED` is OFF/unset.  
2. **Resolve BLK-PREVIEW-FLAG**  
   - Vercel → Settings → Environment Variables → **Preview** only → set `VITE_CANONICAL_APP_SHELL_ENABLED=true`.  
   - Confirm Production column unchanged.  
   - If Netlify is an acceptance target: set same flag on Deploy Preview context only.  
3. **Resolve BLK-TEST-IDENTITY / BLK-ROLE-COVERAGE**  
   - Provision Staging `PLATFORM_ADMIN` + `COACH` **or** formally waive those browser cells to automated suite evidence.  
   - Decide CLUB_MANAGER Staging approach.  
4. **Resolve BLK-OBSERVABILITY**  
   - Manual-only evidence **or** operator-local `VERCEL_AUTOMATION_BYPASS_SECRET` for scripts (never commit).  
5. **Choose BLK-PREVIEW-DEPLOYMENT trigger**  
   - Option 1 (recommended): docs-only/no-op PR from `feature/canonical-navigation-phase5-preview-acceptance`.  
   - Option 2: Redeploy Preview for tip SHA after env set (no PR).  

### Phase B — Automated preflight (local / CI)

Run **before** or **on** the Preview PR. Acceptance criteria = all PASS.

| Order | Gate | Command / suite | Pass criteria |
|------:|------|-----------------|---------------|
| B1 | Unit Phase 2–4 shell | `tests/canonical-shell-phase2.test.js` … `phase4-*.test.js` | All pass |
| B2 | UI + a11y | `tests/ui/canonical-shell-phase*.ui.test.jsx` | All pass |
| B3 | Route registry | Phase 3/4 registry assertions in unit suites | 179/179 |
| B4 | Authorization | phase4 tournament + B03 suites | All pass |
| B5 | Full unit (optional CI) | `npm run test:unit` | All pass |
| B6 | Lint | `npm run lint:no-new` | PASS |
| B7 | Build | `npm run build` | PASS |
| B8 | Secret scan | PR diff credential scan | 0 hits |

**Do not** change runtime code to “make Preview pass.” Failures are blockers.

### Phase C — Preview deploy

1. Trigger PR or Redeploy (Owner choice from A5).  
2. Wait for: GitHub `verify`, Vercel Preview Ready, Netlify `deploy-preview` Ready (if used).  
3. Record: Preview URLs, deployment IDs, git SHA, timestamp.  
4. Confirm bundle was built **after** Preview flag set (Vite bake-time).  
5. Re-attest Production unchanged.

### Phase D — Manual Preview acceptance (flag ON)

Use Staging identities only. Capture screenshots + console notes with timestamps.

| Order | Area | Checks | Pass criteria |
|------:|------|--------|---------------|
| D1 | Shell exclusivity | Canonical marker present; legacy absent; dual shell = 0 | PASS |
| D2 | Metrics | Menu 76; contextual 7; duplicates 0; registry 179/179 | PASS |
| D3 | Public routes | Matrix P-01…P-06 | All PASS |
| D4 | Messaging | M-01 + M-02 separate; 0 redirects | PASS |
| D5 | Engine | E-01…E-11 (owned tournament id required) | PASS |
| D6 | Rating V5 | R-01…R-07 (waive R-03 if identity missing) | PASS / waived |
| D7 | Private Pairing | PP-01…PP-03 (pairing flag ON) | PASS |
| D8 | Devices | Desktop, tablet, mobile — shell layout, drawer, no clipping | PASS |
| D9 | A11y | Keyboard-only; Escape focus restore; Tab/Shift+Tab; HC ON/OFF | PASS |
| D10 | Navigation chrome | Breadcrumbs; active highlight; collapse state | PASS |
| D11 | Console | Errors = 0 on exercised routes | PASS |
| D12 | Role menus | SUPER_ADMIN, VENUE_OWNER, VENUE_MANAGER, CLUB_OWNER, PLAYER, REFEREE | PASS |

### Phase E — Flag OFF / rollback Preview

1. Set Preview `VITE_CANONICAL_APP_SHELL_ENABLED` to unset/`false`.  
2. Redeploy **Preview only**.  
3. Verify legacy shell exclusive; Inter not loaded; Production still untouched.  
4. (Optional) Re-enable Preview flag ON for continued QA — still no Production change.

### Phase F — Evidence package

Create (post-execution, separate task):

- `PHASE5_PREVIEW_ACCEPTANCE_EVIDENCE.md` + `.json`  
- Screenshot set: desktop / tablet / mobile  
- Deployment log references (IDs only)  
- Owner Production isolation sign-off  

---

## Rollback plan (Preview only)

| Step | Action |
|------|--------|
| 1 | Preview env flag → OFF/unset |
| 2 | Redeploy Preview |
| 3 | Verify `legacy-app-shell`; canonical unmounted |
| 4 | Confirm Production deployment id unchanged |
| 5 | Confirm Production flag still OFF |

No data migration. No SQL. No Production Redeploy.

---

## Automated vs manual split

### Automated

- Unit (shell, registry, authz, B01/B02/B03)  
- UI (shell mount exclusivity, a11y Escape)  
- Build / lint / secret scan  
- CI on PR  

### Manual Preview

- Real browser navigation on Preview URLs  
- Direct links / refresh / back-forward  
- Responsive + keyboard + high contrast  
- Role-specific menus with Staging logins  
- Console + network inspection  
- Rollback verification  

---

## Acceptance criteria (execution complete)

Execution may be declared successful only when:

1. Preview flag-ON evidence complete for non-waived matrix rows.  
2. Automated gates green on the Preview SHA.  
3. Rollback Preview flag-OFF verified.  
4. Production mutations = 0; Production flag changes = 0.  
5. Owner signs isolation attestation.  

**Status update (2026-08-06, HEAD `7cc0fdee`):** Phase A–E Preview path closed (acceptance `PASS_WITH_OBSERVATIONS`, rollback `PASS`). Remaining critical automated coverage re-executed and recorded in [`PHASE5_REMAINING_CRITICAL_COVERAGE_AUDIT.md`](./PHASE5_REMAINING_CRITICAL_COVERAGE_AUDIT.md) + [`PHASE5_FINAL_COVERAGE_MATRIX.md`](./PHASE5_FINAL_COVERAGE_MATRIX.md). Verdict: **`CANONICAL_NAVIGATION_PHASE5_CRITICAL_COVERAGE_PASS_WITH_LIMITATIONS`**. Manual-only cells (HC, browser refresh/back-forward, unauthenticated Preview browse, Engine/B03/PP screenshots) remain documented limitations — not Phase A blockers.

---

## Safety

| Item | Value |
|------|------:|
| Deployments in this audit | **0** |
| Env changes in this audit | **0** |
| SQL | **0** |
| Production flag changes | **0** |
| Commit / push / PR (this audit) | **NO** |
