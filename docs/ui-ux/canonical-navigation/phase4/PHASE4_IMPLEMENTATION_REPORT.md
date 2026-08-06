# Phase 4 Implementation Report

**Program:** PICK_VN Canonical Navigation  
**Phase:** 4 — Runtime cutover (approved Owner decisions)  
**Branch:** `feature/canonical-navigation-phase4-runtime-cutover`  
**Base HEAD (pre-implementation):** `6ece104677ec1db4ba1b19bc666a1a41ac2c2a93`  
**Machine-readable:** [`PHASE4_IMPLEMENTATION_REPORT.json`](./PHASE4_IMPLEMENTATION_REPORT.json)  
**Remediation:** [`PHASE4_REMEDIATION_REPORT.md`](./PHASE4_REMEDIATION_REPORT.md)

## Final Verdict

**`CANONICAL_NAVIGATION_PHASE4_IMPLEMENTATION_COMPLETE_READY_FOR_REVIEW`**

Post independent-review remediation applied (BR-PLURAL-01, BR-B03-01, catalog slash, behavioral tests, inventory). Remediation verdict: `CANONICAL_NAVIGATION_PHASE4_REMEDIATION_COMPLETE_READY_FOR_REREVIEW`.

---

## Owner decisions implemented

| Decision | Code | Result |
|----------|------|--------|
| OD-B01 | `APPROVED_A_KEEP_SEPARATE` | `/messages` + `/crm/messages` dual-canonical; **no** redirect |
| OD-B02 | `APPROVED_RETAIN_ALL_42` | **43** LEGACY `/tournament*` mounts retained (42 audited + entry-fee); **0** invented redirects |
| OD-B03 | `APPROVED_PILOT_ALIGNED_SHADOW` | Shadow guard + menu/search hide; admins allowed even when V5 flag OFF |
| OD-PLURAL-AUTHZ | `APPROVED_ENGINE_PROTECTION` | `/tournaments` + `/tournaments/` public; 7 Engine routes protected independent of RBAC flag |

Production GO = **NO**. Production flag change = **NO**. SQL = **NO**. Deployment = **NO**.

---

## B01 — Dual canonical messages

- No `<Navigate>` between `/messages` and `/crm/messages`
- Canonical menu + search include both with distinct labels/RBAC
- Active menu nodes = **76** (intentional +1 vs Phase 3 value 75)

## B02 — Retain legacy tournament routes

- No route deletion / no fabricated `tournamentId` / no new redirects
- Catalog LEGACY `/tournament*` count = **43**

## B03 — Pilot-aligned shadow

- `SkillAssessmentV5RouteGuard` + page `evaluateSkillAssessmentV5PageAccess`
- SUPER_ADMIN / PLATFORM_ADMIN allow even when V5 flag OFF (page does not re-block)
- PLAYER matrix via existing `resolveRatingV5Access`
- Hidden from desktop/mobile/search

## Plural Tournament Engine authz

- Public catalog: `/tournaments` and `/tournaments/`
- Nested Engine: auth + forced `tournament.update` + forced ownership/tenant via `decideTournamentEngineRouteGate` whenever auth is active (not conditional on `VITE_RBAC_ENABLED`)
- Canonical authorities only (`can` + `assertTournamentAccess`)

---

## Exact inventory (after remediation)

| Class | Count |
|-------|------:|
| Modified tracked | **17** |
| Untracked | **29** |
| Staged | **0** |
| Exact total changed | **46** |
| Runtime | **17** |
| Test | **8** |
| Manifest | **1** |
| Documentation | **20** |
| Unrelated | **0** |

Pre-remediation independent-review baseline was **40** (17/23/0; runtime 17 / test 6 / manifest 1 / docs 16).

---

## Validation (post-remediation)

| Gate | Result |
|------|--------|
| Focused Phase 2–4 unit | PASS **53/53** |
| `npm run test:unit` | PASS **6892/6892** |
| Focused UI | PASS **42/42** |
| lint:no-new | PASS |
| build | PASS |
| secret scan | PASS **0** |
| package/lock | PASS (unchanged) |
| Route reconciliation | **179/179** |
| Active menu / contextual / duplicates | **76** / **7** / **0** |

Commit / push / PR = **NO**.
