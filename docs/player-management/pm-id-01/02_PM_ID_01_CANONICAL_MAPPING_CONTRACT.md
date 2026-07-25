# PM-ID-01 — Canonical Mapping Contract

## Ownership

| Concern | Owner |
|---------|-------|
| Mapping table, helpers, admin RPCs, JS resolver | **Player Management** |
| Auth session / `auth.uid()` / profiles account | **Identity** (consumed) |
| Club membership edges | **Club** (consumed read-only) |
| Coaching RLS / `coaching.self.*` | **Coaching** (consumer only; not authored here) |

---

## Resolution input

Trusted inputs only:

| Input | Source | Notes |
|-------|--------|-------|
| Principal | `auth.uid()` / authenticated session | **Never** from UI/RPC caller as identity selector |
| `tenant_id` | Trusted caller scope (validated) | Must match club.tenant_id |
| `club_id` | Trusted caller scope (validated) | Must match active membership |

Forbidden identity inputs for resolve:

- `principal_id`
- `authUserId`
- `playerId` (as identity selector)

Admin management RPCs may accept subject `principal_id` / `player_id` because they mutate under admin permission — not for self-resolve.

---

## Output shape

```json
{
  "status": "MAPPED|UNMAPPED|INACTIVE|AMBIGUOUS|INVALID",
  "playerId": "text|null",
  "tenantId": "text|null",
  "clubId": "text|null",
  "source": "player_identity_links|null",
  "reasonCode": "string|null"
}
```

Rules:

1. `playerId` is non-null **only** when `status = MAPPED`.
2. Non-MAPPED must set `playerId = null` (never leak candidate ids through this contract).
3. No first-row silent pick on AMBIGUOUS.
4. No DERIVED status in PM-ID-01 (explicit ACTIVE link required).

---

## Status semantics

### MAPPED

All of:

1. Authenticated (`auth.uid()` not null).
2. Exactly one row in `player_identity_links` with:
   - `tenant_id` / `club_id` match inputs;
   - `principal_id = auth.uid()`;
   - `status = 'ACTIVE'`.
3. Target `player_id` non-empty and structurally plausible.
4. Club belongs to tenant (`clubs.id = club_id` AND `clubs.tenant_id = tenant_id`).
5. Active membership: `club_members` row for principal with `status = 'active'` in that tenant/club.
6. Principal account not unusable for membership resolution (fail closed if membership missing).

### UNMAPPED

Authenticated + scope valid + **zero** ACTIVE or REVOKED candidate links for that principal×tenant×club.

### INACTIVE

Authenticated + scope valid + **no** ACTIVE link, but ≥1 REVOKED link for principal×tenant×club  
**OR** ACTIVE link exists but membership is not active (left/removed/missing) — treated as INACTIVE for consumer self-scope (no playerId).  
Revoke must take effect immediately (no grace in this contract).

### AMBIGUOUS

More than one ACTIVE link for the same principal×tenant×club (should be prevented by unique index; if observed at read time → AMBIGUOUS, never pick first).

### INVALID

Any of:

- Unauthenticated;
- Empty/malformed tenant_id or club_id;
- Club/tenant mismatch (club not in tenant);
- Mapping row references inconsistent tenant/club;
- ACTIVE link with empty/malformed player_id;
- Other inconsistent data that cannot be classified safely.

---

## Database invariants

1. At most one ACTIVE mapping per `(tenant_id, club_id, principal_id)`.
2. At most one ACTIVE mapping per `(tenant_id, club_id, player_id)`.
3. No cross-tenant or cross-club references (club must belong to tenant; membership must match).
4. Principals cannot self-link arbitrarily (no PLAYER/COACH self upsert RPC).
5. Revoke → self-scope boolean helper returns false immediately.
6. No hard-delete of mapping history via client RPC (revoke only).
7. Invalid foreign references fail closed (admin write rejects; resolve → INVALID/INACTIVE as defined).

---

## Relationship to Phase 1B facade

| Surface | Role after PM-ID-01 |
|---------|---------------------|
| `resolveByAuthUser` / DERIVED | Remains for directory/self-profile app paths |
| `resolveAuthenticatedCanonicalPlayerMapping` | **New** fail-closed tenant/club scoped contract for Coaching and RLS consumers |
| `profiles.player_id` | Alias remains; **not** PM-ID-01 SQL SoT |

Consumers that need RLS-safe mapping must use PM-ID-01, not Phase 1B DERIVED.
