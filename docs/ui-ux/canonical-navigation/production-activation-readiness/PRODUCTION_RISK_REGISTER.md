# Production Risk Register — Canonical Navigation Activation

**Program:** PICK_VN Canonical Navigation  
**Baseline:** `origin/main` @ `f81b6c8f0c43af3f5b25dc09e688fe534f70d64c`  
**Mode:** Read-only planning  

## Severity scale

| Level | Meaning |
|-------|---------|
| CRITICAL | Immediate Production outage or security breach class |
| HIGH | Major user-facing failure or authz risk |
| MEDIUM | Partial degradation / incomplete coverage |
| LOW | Cosmetic or deferred observation |

---

## Register

| ID | Risk | Severity | Likelihood | Mitigation (required before/during activation) |
|----|------|----------|------------|--------------------------------------------------|
| R-01 | Navigation outage (shell fail / blank nav) | CRITICAL | Med | Preflight + smoke ACT-01–05; instant flag OFF + redeploy |
| R-02 | White screen | CRITICAL | Low–Med | Smoke zero-tolerance; STOP-SHELL → rollback |
| R-03 | Auth redirect loop | CRITICAL | Low–Med | Unauth + auth landing checks; STOP-AUTH → rollback |
| R-04 | Inaccessible public routes | HIGH | Low | PRE/ACT public matrix; STOP-PUBLIC → rollback |
| R-05 | Privilege bypass | CRITICAL | Low | Engine/B03/PP deny cells on Production identities; STOP-PRIV |
| R-06 | Wrong tenant access | CRITICAL | Low | Cross-tenant deny cell with Production-bound tenants |
| R-07 | Mobile drawer failure | HIGH | Med | Mobile ACT-14; tablet ACT-15; rollback if primary paths blocked |
| R-08 | Stale assets / CDN cache after redeploy | HIGH | Med | Hard refresh checks; verify deployment id in UI if available; wait for Vercel ready |
| R-09 | Build-time flag mismatch (env changed, old bake) | CRITICAL | Med | Always redeploy after flag change; attest baked behavior via shell testids |
| R-10 | Automatic Vercel Production deploy on `main` merge (OBS-P5-PM-01) | HIGH | **High** (observed) | Freeze merges / Owner-controlled release during window; never assume docs merge is deploy-noop for ops |
| R-11 | Rollback redeploy failure | CRITICAL | Low | Pre-nominate emergency: promote last known-good Production deployment; on-call Owner |
| R-12 | Incomplete role coverage | HIGH | High (Phase 5 gap) | Bind Production identity matrix or Owner waiver with bounds |
| R-13 | COACH schema gap | MEDIUM | Certain if required | Continue waiver **or** separate schema workstream before requiring COACH cell |
| R-14 | OBS-UI-01 tenant selector overlap | LOW | Observed on Preview | Accept or schedule UI fix outside activation critical path |
| R-15 | OBS-RUNTIME-01 `/messages` inactive | LOW–MED | Observed | Defer; not shell blocker |
| R-16 | OBS-RUNTIME-02 CRM authority unavailable | LOW–MED | Observed | Defer; not shell blocker |
| R-17 | OBS-DATA-01 MISSING_IDENTITY_LINK | LOW | Staging-observed | Production data Owner-scoped; do not treat as nav failure |
| R-18 | High contrast / refresh / back-forward untested | MEDIUM | High residual | Close via ACT-11/12/31 or Owner acceptance in GO pack |
| R-19 | Operator uses Staging credentials on Production | CRITICAL | Med process | Forbid; Production-only identities under Owner GO |
| R-20 | Accidental Preview/Production env scope confusion | CRITICAL | Med | Dual attestation screenshots of Vercel scope before save |

---

## Residual observations retained from Phase 5

- OBS-P5-PM-01 — auto Production deploy on merge  
- OBS-UI-01, OBS-RUNTIME-01/02, OBS-DATA-01 — accepted for Phase 5; need Production GO stance  

## Monitoring readiness

**NOT_BOUND** until Owner fills monitoring owner, duration, and thresholds in the rollback plan template.
