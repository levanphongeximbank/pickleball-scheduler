# Production Rollback / Controlled Activation Sequence

**Program:** PICK_VN Canonical Navigation  
**Mode:** Plan only — **do not execute** any step in this audit  
**Flag:** `VITE_CANONICAL_APP_SHELL_ENABLED` (Vite build-time)  
**Host authority:** Vercel Git Integration Production path (see PGO + OBS-P5-PM-01)  
**Baseline reference:** `origin/main` @ `f81b6c8f0c43af3f5b25dc09e688fe534f70d64c`

---

## Preconditions (all required)

1. Owner decision packages bound (see `OWNER_DECISION_PACKAGES.md`)  
2. `PRODUCTION_GO=YES` and flag/redeploy GOs bound to exact window  
3. Live Vercel attestation: Production flag currently OFF/absent  
4. Deployment owner + rollback owner named  
5. Monitoring window + rollback thresholds named  
6. Production identity matrix bound (or accepted limitations)  
7. Freeze or control merges to `main` during activation window (OBS-P5-PM-01)  
8. No Staging/Auth/SQL mutations bundled into this cutover  

---

## Controlled sequence (activation)

| Step | Action | Owner | STOP if |
|------|--------|-------|---------|
| 1 | **Production preflight** — attest flag OFF; record deployment id/SHA; run PRE-* browser checks | Operator + Owner | PRE fail; flag already true unexpectedly |
| 2 | **Owner GO binding** — write exact tokens, window, identities, thresholds | Owner | Any GO missing |
| 3 | **Production Preview or build validation** — confirm tip SHA intended for bake; CI green on that SHA | Deployment owner | CI red; wrong SHA |
| 4 | **Production flag change** — set `VITE_CANONICAL_APP_SHELL_ENABLED=true` on **Production** scope only | Owner / env authority | Mis-scope to wrong project; Preview-only by mistake when intending Production (or vice versa mid-rollback) |
| 5 | **Production deployment** — Redeploy Production so Vite rebakes env (flag change alone insufficient) | Deployment owner | Deploy fail; wrong env baked |
| 6 | **Browser smoke** — ACT-* minimum matrix | Operator | White screen; dual shell; auth loop; privilege bypass; public route down |
| 7 | **Monitoring window** — observe per thresholds | Monitoring owner | Threshold breach |
| 8 | **Rollback decision** — GO / HOLD / ROLLBACK | Owner | Ambiguous ownership |
| 9 | **Flag OFF rollback** — set Production flag false/absent | Env authority | Cannot change env |
| 10 | **Rollback redeploy** — Redeploy Production to bake OFF | Deployment owner | Redeploy fail → escalate (prior deployment promote / emergency) |
| 11 | **Post-operation evidence** — screenshots, ids, SHA, flag attestations, decision log | Operator | Evidence incomplete for audit |

---

## Rollback procedure (detail)

1. Decision: Owner declares `ROLLBACK=YES` with reason code (see risk register).  
2. Set Production `VITE_CANONICAL_APP_SHELL_ENABLED` to `false` or remove.  
3. Trigger Production redeploy (required — build-time flag).  
4. Verify `data-testid="legacy-app-shell"` present; canonical absent.  
5. Smoke: public routes + one authenticated landing.  
6. Confirm white screens = 0.  
7. Record deployment id and close incident window.  

**Does not require:** SQL, route deletions, runtime code revert (for flag-only rollback).

**Secondary (only if flag path itself is broken):** code revert of `MainLayout` flag branch via separate Owner GO — out of normal path.

---

## Exact STOP conditions

| Code | Condition |
|------|-----------|
| STOP-GO | Missing `PRODUCTION_GO` / flag GO / redeploy GO |
| STOP-ATTEST | Cannot prove current Production flag state |
| STOP-DEPLOY | Production redeploy fails or wrong SHA |
| STOP-SHELL | Dual shell, missing expected shell, or white screen |
| STOP-AUTH | Redirect loop / session collapse |
| STOP-PUBLIC | Public routes inaccessible |
| STOP-PRIV | Privilege bypass or wrong-tenant access |
| STOP-MOBILE | Mobile drawer/nav failure blocking primary paths |
| STOP-MONITOR | Threshold breach during window |
| STOP-ROLLBACK | Flag OFF redeploy fails |
| STOP-AUTODEPLOY | Uncontrolled `main` merge Production deploy mid-window without Owner acceptance |

On any STOP: freeze further flag changes; prefer rollback to legacy if flag ON already baked; escalate to Owner.

---

## Monitoring window (partial Owner binding via OD-PA-05)

Planning decisions bound 2026-08-06 do **not** authorize execution. Owners / exact window remain unbound.

| Field | Value |
|-------|-------|
| Duration | _UNBOUND — bind at execution window_ |
| Check interval | _UNBOUND — bind at execution window_ |
| Deployment / rollback / monitoring owner | _UNBOUND_ |
| Merge freeze during window | **YES** (OD-PA-05) |
| Rollback if white screens | **> 0** (OD-PA-05) |
| Rollback if auth redirect loops | **≥ 1** (OD-PA-05) |
| Rollback if public route outage | **≥ 1** (OD-PA-05) |
| Rollback if privilege bypass | **≥ 1** (OD-PA-05) |
| Rollback if wrong-tenant exposure | **≥ 1** (OD-PA-05) |
| Rollback if critical navigation route failure | **≥ 1** (OD-PA-05) |
| Owner contact | _UNBOUND_ |

---

## Relation to Preview rollback

Phase 5 proved: Preview flag OFF + Preview-only redeploy restores legacy shell.  
Production uses the **same bake-time mechanism** on Production scope + Production redeploy. Do not treat Preview rollback as Production rollback evidence.

---

## Safety (this document)

Planning only. Executions = **0**.
