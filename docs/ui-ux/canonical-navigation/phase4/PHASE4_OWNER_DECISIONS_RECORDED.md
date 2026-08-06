# Phase 4 Owner Decisions — Recorded

**Program:** PICK_VN Canonical Navigation  
**Phase:** 4  
**Recorded at HEAD:** `6ece104677ec1db4ba1b19bc666a1a41ac2c2a93`  
**Branch:** `feature/canonical-navigation-phase4-runtime-cutover`  
**Source package:** [`PHASE4_OWNER_DECISION_PACKAGE.md`](./PHASE4_OWNER_DECISION_PACKAGE.md)  
**Machine-readable:** [`PHASE4_OWNER_DECISIONS_RECORDED.json`](./PHASE4_OWNER_DECISIONS_RECORDED.json)

## Verdict

**`CANONICAL_NAVIGATION_PHASE4_OWNER_DECISIONS_RECORDED_READY_FOR_IMPLEMENTATION`**

All four blockers have Owner-approved remediation direction. Runtime implementation proceeded under these bindings — see [`PHASE4_IMPLEMENTATION_REPORT.md`](./PHASE4_IMPLEMENTATION_REPORT.md).

---

## Binding decisions

| Decision ID | Owner code | Status | Binding rule |
|-------------|------------|--------|--------------|
| OD-B01-MESSAGES | `APPROVED_A_KEEP_SEPARATE` | **APPROVED** | `/messages` and `/crm/messages` remain separate canonical business functions. **No redirect** between them in Phase 4. |
| OD-B02-TOURNAMENT-RETAIN | `APPROVED_RETAIN_ALL_42` | **APPROVED** | Retain all **42** legacy `/tournament/*` routes. Do **not** invent plural redirect mappings or `tournamentId` values. |
| OD-B03-V5-SHADOW-AUTHZ | `APPROVED_PILOT_ALIGNED_SHADOW` | **APPROVED** | Hide `/player/skill-assessment-v5` from menu and search. Allow `SUPER_ADMIN` and `PLATFORM_ADMIN`. Allow `PLAYER` only when Rating V5 flag enabled **and** enrollment valid. All other roles → **403**. |
| OD-PLURAL-AUTHZ-PARITY | `APPROVED_ENGINE_PROTECTION` | **APPROVED** | Keep public `/tournaments` catalog public. Protect Tournament Engine routes with authentication, `tournament.update`, and ownership/tenant checks. |

---

### OD-B01 — APPROVED_A_KEEP_SEPARATE

- Revise Phase 1 B01 redirect disposition for Phase 4 runtime: **do not** redirect `/messages` → `/crm/messages`.
- Restore `/messages` as canonical Communication (COMMS Messaging Experience) in registry/menu/search with clear labeling.
- Keep `/crm/messages` as canonical CRM outreach.
- Both pages remain mounted as distinct handlers.

### OD-B02 — APPROVED_RETAIN_ALL_42

- Disposition for all 42 unmapped `/tournament/*` routes: **retain**.
- Phase 4 implements **zero** invented `/tournament/*` → `/tournaments/:id/*` redirects.
- Flag ON menu/search continue excluding legacy `/tournament/*` hubs.
- Optional writer hygiene only where a same-workflow target is already proven (not bulk cutover).

### OD-B03 — APPROVED_PILOT_ALIGNED_SHADOW

Exact authorization policy to implement:

1. Never show `/player/skill-assessment-v5` in menu or search (any shell, any flag).
2. Authenticated `SUPER_ADMIN` / `PLATFORM_ADMIN` may direct-access (tech eval).
3. Authenticated `PLAYER` may direct-access **only if** `VITE_PICK_VN_RATING_V5_ENABLED` and valid pilot enrollment.
4. All other roles → **403**.
5. No redirect to `/player/skill-assessment` unless a later Owner decision adds one.

### OD-PLURAL-AUTHZ — APPROVED_ENGINE_PROTECTION

Exact Engine protection policy to implement:

1. `/tournaments` public catalog remains public.
2. `/tournaments/:tournamentId/{engine,seed,draw,schedule,courts,ranking,logs}` require authentication (not public-auth descendants).
3. Route-level authorization requires `tournament.update` (parity with page gate) unless a later documented per-tab split is approved.
4. Ownership / tenant (club) checks before Engine data load.
5. Missing authz tests from the parity matrix are required before Preview flag ON.

---

## Production / safety constraints (binding)

| Constraint | Value |
|------------|-------|
| `PRODUCTION_GO` | **NO** |
| `PRODUCTION_FLAG_CHANGE` | **NO** |
| SQL | **NO** |
| Deployment | **NO** |
| Production mutations | **0** |
| `VITE_CANONICAL_APP_SHELL_ENABLED` in Production | remains **OFF** |

---

## Blocker closure status (planning)

| Blocker | Owner decision | Implementation status |
|---------|----------------|----------------------|
| BLK-B01-SEMANTIC | Closed by OD-B01 | Pending runtime |
| BLK-B02-NO-MAP | Closed by OD-B02 | Pending runtime (retain = no redirects) |
| BLK-B03-GUARD | Closed by OD-B03 | Pending runtime |
| BLK-PLURAL-AUTHZ | Closed by OD-PLURAL-AUTHZ | Pending runtime |

---

## Next implementation order (unchanged plan)

1. Authz hardening: `authGuard` + `menuAccess` plural Engine + B03 pilot-aligned shadow  
2. B01 dual-canonical registry/menu/search (no redirect)  
3. Optional Engine breadcrumb/back writer hygiene (no B02 redirects)  
4. Phase 4 tests  
5. Preview verification — Production flag remains OFF  

Proposed file lists remain in [`PHASE4_BLOCKER_RESOLUTION_PLAN.md`](./PHASE4_BLOCKER_RESOLUTION_PLAN.md).

---

## Safety attestation (this recording)

| Check | Value |
|-------|------:|
| Runtime code changed | **NO** |
| Route guards changed | **NO** |
| Redirects created | **NO** |
| Tests changed | **NO** |
| Production mutations | **0** |
| SQL / deployments / Production flag changes | **0** |
| Commit / push / PR | **NO** |
