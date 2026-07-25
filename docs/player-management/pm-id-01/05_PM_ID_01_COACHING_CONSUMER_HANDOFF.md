# PM-ID-01 — Coaching Consumer Handoff (COACHING-04)

## Ownership split

| May consume | Must not own |
|-------------|--------------|
| Player public JS resolver | Mapping table DDL |
| Player SQL resolve helper / boolean RLS helper | Admin upsert/revoke policy |
| Status semantics below | Backfill / ambiguity remediation |
| Trusted `tenant_id` + `club_id` inputs | Principal selection / inventing player ids |

Coaching remains **consumer only**. This branch does **not**:

- author Coaching PLAYER RLS policies;
- seed or grant `coaching.self.read`;
- create `coaching_04_mapped_player_id()`;
- flip COACHING-04 runtime defaults;
- claim COACHING-04 PLAYER self-scope unblocked.

Until Staging apply of PM-ID-01 **and** separate Coaching follow-up + Owner GO, marker remains:

**`COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKED`**

---

## Public JavaScript import

```js
import {
  PLAYER_IDENTITY_MAPPING_STATUS,
  resolveAuthenticatedCanonicalPlayerMapping,
  validatePlayerIdentityMappingResult,
} from "../../../features/player/index.js";
// or: from "src/features/player"
```

### Runtime method

```js
const result = await resolveAuthenticatedCanonicalPlayerMapping({
  tenantId,
  clubId,
  // optional test doubles only:
  // repository, getSessionUserId
});
```

**Must not pass:** `principalId`, `authUserId`, `playerId` as identity selectors.

### Expected result

```js
{
  status,      // MAPPED | UNMAPPED | INACTIVE | AMBIGUOUS | INVALID
  playerId,    // string only when status === MAPPED; else null
  tenantId,
  clubId,
  source,      // "player_identity_links" when resolved from SoT
  reasonCode,  // opaque machine code; do not show raw SQL errors to end users
}
```

---

## SQL helper / RPC signatures

### Resolve (authenticated)

```sql
public.player_identity_resolve_mapping(
  p_tenant_id text,
  p_club_id text
) returns jsonb
```

Uses `auth.uid()` only. No principal argument.

Example payload:

```json
{
  "status": "MAPPED",
  "player_id": "player-auth-…",
  "tenant_id": "venue-1",
  "club_id": "club-1",
  "source": "player_identity_links",
  "reason_code": "OK"
}
```

Non-MAPPED payloads set `"player_id": null`.

### RLS boolean helper

```sql
public.player_identity_is_mapped(
  p_tenant_id text,
  p_club_id text
) returns boolean
```

| Resolve status | Boolean |
|----------------|---------|
| MAPPED | `true` |
| UNMAPPED / INACTIVE / AMBIGUOUS / INVALID | `false` |

No reason leakage.

---

## Tenant / club inputs

Coaching must pass the **trusted** tenant/club of the request (same values already used for Coaching scope helpers). Do not accept client-forged scope without server validation already present in Coaching.

---

## Revoked behavior

After admin revoke:

- `player_identity_is_mapped` → `false` immediately;
- resolve status → `INACTIVE` (when only revoked rows remain);
- Coaching must deny self-scope access (when/if policies are authored later).

---

## Expected error behavior

| Condition | Consumer handling |
|-----------|-------------------|
| Unauthenticated | `INVALID` / boolean false — deny |
| Wrong tenant/club | `INVALID` or non-MAPPED — deny |
| UNMAPPED / INACTIVE / AMBIGUOUS | deny self-scope; do not guess |
| Repository/network failure (JS) | translated error; fail closed |

---

## What Coaching may consume later (after Owner GOs)

1. Boolean helper inside future PLAYER self-scope policies.
2. Resolve helper/RPC for UI “am I mapped?” checks.
3. JS resolver for client feature gating.

## What Coaching must not own

1. Writing `player_identity_links`.
2. Defining canonical `player_id` mint rules.
3. Heuristic backfill.
4. Equating `auth.uid()` to `player_id`.
5. Reusing `profiles.player_id` as Coaching SoT.
