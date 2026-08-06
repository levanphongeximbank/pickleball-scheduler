# Phase 4 Tournament Authorization Parity Matrix

**Program:** PICK_VN Canonical Navigation  
**Phase:** 4 — Blocker resolution planning (read-only)  
**HEAD:** `6ece104677ec1db4ba1b19bc666a1a41ac2c2a93`  
**Blocker:** `BLK-PLURAL-AUTHZ`

Machine-readable twin: [`PHASE4_TOURNAMENT_AUTHZ_PARITY_MATRIX.json`](./PHASE4_TOURNAMENT_AUTHZ_PARITY_MATRIX.json)

---

## Summary

| Metric | Value |
|--------|------:|
| Plural Engine routes audited | **7** |
| Authorization parity PASS | **0** |
| Authorization parity GAP | **7** |
| Classification | All **weaker** than protected legacy `/tournament/*` |

Public catalog `/tournaments` (`PublicTournamentsPage`) is intentionally public and **excluded** from Engine PASS/GAP scoring.

---

## Shared gap evidence

| Layer | Finding | Evidence |
|-------|---------|----------|
| Public-auth prefix | `PUBLIC_PATH_PREFIXES` includes `/tournaments`, so `/tournaments/:id/*` matches as public-auth | `src/auth/authGuard.js` |
| Route RBAC matcher | Prefix rule covers `/tournament/` only — not `/tournaments/` | `src/auth/menuAccess.js` |
| Page gate | `PermissionGate permission={TOURNAMENT_UPDATE}` after engine hook runs | `TournamentEnginePage.jsx` |
| Tenant / ownership | Hook uses active club/profile; no assert that route `tournamentId` belongs to caller scope | `useTournamentEngine.js` |
| Router | All seven tabs mount `TournamentEnginePage` under MainLayout | `src/router.jsx` |

---

## Parity matrix

| Canonical route | Component | Role / auth guard | Permission gate | Tenant check | Ownership check | Closest legacy equivalent | Parity |
|-----------------|-----------|-------------------|-----------------|--------------|-----------------|---------------------------|--------|
| `/tournaments/:tournamentId/engine` | TournamentEnginePage | Public-auth via `/tournaments` prefix | Route: none; Page: `tournament.update` | None on route | None | `/tournament/internal\|official/:id` setup | **weaker** |
| `/tournaments/:tournamentId/seed` | TournamentEnginePage | same | same | None | None | Mode setup seeding (unproven) | **weaker** |
| `/tournaments/:tournamentId/draw` | TournamentEnginePage | same | same | None | None | `/tournament/*/bracket` (unproven) | **weaker** |
| `/tournaments/:tournamentId/schedule` | TournamentEnginePage | same | same | None | None | `/tournament/schedule` / mode setup | **weaker** |
| `/tournaments/:tournamentId/courts` | TournamentEnginePage | same | same | None | None | Director / court ops (unproven) | **weaker** |
| `/tournaments/:tournamentId/ranking` | TournamentEnginePage | same | same | None | None | Results surfaces (unproven) | **weaker** |
| `/tournaments/:tournamentId/logs` | TournamentEnginePage | same | same | None | None | No proven legacy equivalent | **weaker** |

---

## Missing tests (aggregate)

1. Unauthenticated plural deep link → login  
2. RBAC denied (`tournament.view` / `tournament.update`) → 403  
3. Cross-tenant / cross-club `tournamentId` rejected **before** engine load  
4. Role matrix: player / manager / referee / admin  
5. Read-only tabs (`ranking` / `logs`) vs mutating tabs permission split  
6. Engine missing-ID / breadcrumb must not rely on unprotected public plural access  

---

## Recommended target policy (pending OD-PLURAL-AUTHZ-PARITY)

1. Keep `/tournaments` public catalog public.  
2. Protect `/tournaments/:tournamentId/*`: require authentication (exclude from public-auth descendants).  
3. Route-level permission at least `tournament.update` (match page gate) or a documented per-tab split.  
4. Add tenant/club ownership (or membership) check before engine data load.  
5. Add the missing tests above before Preview flag ON.

---

## Safety

| Check | Value |
|-------|------:|
| Runtime / guards changed | NO |
| Production mutations | 0 |
| Commit / push / PR | NO |
