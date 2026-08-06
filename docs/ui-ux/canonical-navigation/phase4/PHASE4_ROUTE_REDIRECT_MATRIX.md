# Phase 4 Route Redirect Matrix

**Program:** PICK_VN Canonical Navigation  
**Phase:** 4 — Audit only  
**Fresh `origin/main` SHA:** `6ece104677ec1db4ba1b19bc666a1a41ac2c2a93`  
**Verdict:** `CANONICAL_NAVIGATION_PHASE4_READY_WITH_BLOCKERS`

Machine-readable twin: [`PHASE4_ROUTE_REDIRECT_MATRIX.json`](./PHASE4_ROUTE_REDIRECT_MATRIX.json)

---

## Legend

| Status | Meaning |
|--------|---------|
| `IMPLEMENT_NOW` | Safe to implement without further product decision |
| `VERIFY_ONLY` | Already implemented (or within-family alias); verify query/hash policy |
| `OWNER_RECONFIRM_REQUIRED` | Disposition exists; semantic proof failed |
| `RETAIN_NO_REDIRECT` | Keep compatibility mount; do **not** invent redirect |
| `GUARD_ONLY` | No redirect; tighten authorization / visibility |

---

## Summary

| Status | Count |
|--------|------:|
| IMPLEMENT_NOW | **0** |
| VERIFY_ONLY | **5** |
| OWNER_RECONFIRM_REQUIRED | **1** |
| RETAIN_NO_REDIRECT | **42** |
| GUARD_ONLY | **1** |

Proven **new** Phase 4 redirect mappings ready to ship: **0**.

---

## B01 — Messages

| From | To | Type | Status |
|------|----|------|--------|
| `/messages` | — | **no redirect** | `APPROVED_A_KEEP_SEPARATE` (implemented) |
| `/crm/messages` | — | retain canonical CRM | `RETAIN_CANONICAL` |

Notes:

- Owner OD-B01: keep both as separate canonical business functions
- Runtime handlers remain distinct: `MessagingExperiencePage` vs `CrmMessagesPage`
- Menu/search/breadcrumb/RBAC authorities remain distinct
- Phase 4 does **not** redirect either route to the other

---

## Pre-existing redirects (verify only)

| From | To | Runtime | Query/hash today | Status |
|------|----|---------|------------------|--------|
| `/onboarding/pick-vn-rating` | `/player/skill-assessment` | `<Navigate replace>` | Not explicit | `VERIFY_ONLY` |
| `/clubs/discover` | `/discover-clubs` | `<Navigate replace>` | Not explicit | `VERIFY_ONLY` |
| `/club/activity` | `/my-club?view=schedule` | `<Navigate replace>` | Target overwrites source query | `VERIFY_ONLY` |
| `/courts-ops` | `/court-management/courts` | `<Navigate replace>` | Not explicit | `VERIFY_ONLY` |

---

## B02 — Within-legacy alias

| From | To | Status | Notes |
|------|----|--------|-------|
| `/tournament/entry-fee` | `/tournament/config/fee` | `VERIFY_ONLY` | Same `TournamentFeePage`; not a plural-family cutover |

---

## B02 — Unresolved legacy family (`RETAIN_NO_REDIRECT`)

No proven mapping to `/tournaments/:tournamentId/*`. Retain mounts.

### Hub / admin (no ID → cannot map)

| From |
|------|
| `/tournament` |
| `/tournament/list` |
| `/tournament/create` |
| `/tournament/types` |
| `/tournament/types/:category` |
| `/tournament/roster` |
| `/tournament/organize` |
| `/tournament/operations` |
| `/tournament/results` |
| `/tournament/config` |
| `/tournament/register` |
| `/tournament/bracket` |
| `/tournament/teams` |
| `/tournament/teams/presets` |
| `/tournament/teams/build/manual` |
| `/tournament/teams/build/random` |
| `/tournament/teams/build/draft` |
| `/tournament/schedule` |
| `/tournament/match-reports` |
| `/tournament/config/format` |
| `/tournament/config/settings` |
| `/tournament/config/age-rules` |
| `/tournament/config/gender-rules` |
| `/tournament/config/fee` |
| `/tournament/config/regulations` |
| `/tournament/eligibility` |
| `/tournament/eligibility/check` |
| `/tournament/publish-schedule` |
| `/tournament/referee-assign` |
| `/tournament/awards` |
| `/tournament/withdrawal` |

### Parameterized (syntactic `:tournamentId` only — semantic map unproven)

| From | Why not redirect |
|------|------------------|
| `/tournament/my` | Player portal ≠ Engine tabs |
| `/tournament/my/:tournamentId` | Player portal ≠ Engine tabs |
| `/tournament/:tournamentId/public` | Public portal ≠ Engine tabs |
| `/tournament/:tournamentId/register` | Registration ≠ Engine tabs |
| `/tournament/daily/:tournamentId` | Daily setup ≠ Engine tabs |
| `/tournament/internal/:tournamentId` | Internal setup ≠ Engine tabs |
| `/tournament/internal/:tournamentId/bracket` | Bracket page ≠ Engine draw contract proven |
| `/tournament/official/:tournamentId` | Official setup ≠ Engine tabs |
| `/tournament/official/:tournamentId/bracket` | Bracket page ≠ Engine draw contract proven |
| `/tournament/team/:tournamentId` | Team setup ≠ Engine tabs |
| `/tournament/director/:tournamentId` | Director mode ≠ Engine tabs |

### Canonical plural family (targets — retain, do not redirect away)

| Path | Handler |
|------|---------|
| `/tournaments/:tournamentId/engine` | `TournamentEnginePage` |
| `/tournaments/:tournamentId/seed` | `TournamentEnginePage` |
| `/tournaments/:tournamentId/draw` | `TournamentEnginePage` |
| `/tournaments/:tournamentId/schedule` | `TournamentEnginePage` |
| `/tournaments/:tournamentId/courts` | `TournamentEnginePage` |
| `/tournaments/:tournamentId/ranking` | `TournamentEnginePage` |
| `/tournaments/:tournamentId/logs` | `TournamentEnginePage` |

---

## B03 — Shadow (no redirect)

| Path | Status | Action |
|------|--------|--------|
| `/player/skill-assessment-v5` | `GUARD_ONLY` | SUPER_ADMIN direct access; keep hidden from menu/search; **no redirect** |

---

## Redirect contract (for any future proven redirect)

1. Use `replace` (browser Back skips legacy)  
2. Preserve `location.search` unless target documents an overwrite  
3. Preserve `location.hash`  
4. Map path params only when semantic target contract is proven  
5. Apply target auth + RBAC after redirect  
6. Add unit/UI coverage before Preview enablement  

---

## Safety

- No redirects created in this audit  
- No runtime code changed  
- Production mutations = 0  
