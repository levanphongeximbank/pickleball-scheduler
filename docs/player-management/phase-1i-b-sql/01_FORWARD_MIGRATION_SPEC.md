# Phase 1I-B — Forward Migration Spec

**Source:** `docs/v5/PHASE_1I_B_PLAYER_DIRECTORY_READ_MODEL.sql`  
**Classification:** Additive / reversible SQL authoring  
**Apply gate:** Separate Owner token `AUTHORIZE_PHASE_1I_B_STAGING_APPLY`

---

## 1. RPC signatures (exact)

```sql
public.player_directory_search(
  p_query  text    default null,
  p_region text    default null,
  p_cursor text    default null,
  p_limit  integer default 20
) returns json

public.player_directory_get(
  p_player_id text
) returns json
```

Hardening (both):

- `SECURITY DEFINER`
- `STABLE`
- `SET search_path = pg_catalog, public`
- schema-qualified `public.profiles`
- `auth.uid() IS NOT NULL` gate
- no dynamic SQL

---

## 2. Eligibility predicate

Row appears only when **all** hold:

```text
player_id present (non-empty trim)
AND display_name non-empty after trim
AND identity_verification_status = 'verified'
AND privacy_settings IS NOT NULL
AND jsonb_typeof(privacy_settings) = 'object'
AND (privacy_settings ->> 'publicProfileEnabled') = 'true'
AND status IS DISTINCT FROM 'suspended'
AND caller authenticated (auth.uid() IS NOT NULL)
```

Active rule: **`EXCLUDE_SUSPENDED_ONLY`**.  
No second eligibility column (`publicDirectoryEligible` not created).

---

## 3. Server-side masking (before emit)

| Output | Rule |
|--------|------|
| `activity_region` | text label only if `showActivityRegion = true`; else null |
| `gender` | only if `showGender = true`; else null |
| `handedness` | only if `showHandedness = true`; else null |
| `is_verified` | constant boolean `true` |
| `avatar_url` | identity field when eligible; null if empty |

Never returned: `privacy_settings`, raw verification, raw `status`, auth uuid, venue/club/tenant, email/phone/birth, audit/moderation.

---

## 4. Search behavior

| Topic | Behavior |
|-------|----------|
| Empty query | Browse eligible set |
| Non-empty query | `ILIKE` substring on `display_name`; min length 2; escape `%` / `_` |
| Region filter | Optional trimmed text; case-insensitive equality on allow-listed region fields or formatted label; requires `showActivityRegion` |
| Limit | default 20; `<=0`/null → 20; max 50 |
| Order | `lower(trim(display_name)) ASC, trim(player_id) ASC` |
| Cursor | opaque `pd1.*`; malformed → `INVALID_CURSOR` (no reset) |
| nextCursor | encoded from last returned row when a further page exists; else null |
| Count | page `meta.count` only — **no total count** |

---

## 5. Detail behavior

- Eligible → one strict row in `data`
- Missing / unverified / privacy-off / suspended / malformed → `{ ok: true, data: null }` (indistinguishable)
- Unauthenticated → `{ ok: false, code: "NOT_AUTHENTICATED" }`
- Empty `p_player_id` → `{ ok: false, code: "INVALID_REQUEST" }`

---

## 6. Indexes

| Index | Purpose |
|-------|---------|
| `profiles_directory_eligible_name_id_idx` | Eligibility + sort key covering |
| `profiles_directory_player_id_idx` | Detail lookup by `player_id` |

Deferred: GIN on `activity_region`, `pg_trgm` on `display_name`.

---

## 7. Grants

| Function | PUBLIC | anon | authenticated |
|----------|--------|------|---------------|
| search / get | REVOKE | REVOKE | GRANT EXECUTE |
| helpers | REVOKE | REVOKE | REVOKE |

Table grants / RLS policies on `public.profiles`: **unchanged**.
