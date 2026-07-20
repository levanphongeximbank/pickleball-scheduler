# Phase 1I-0 — SQL Contract (Design Only)

**Owner authorization:** `AUTHORIZE_PHASE_1I_0_SQL_READ_MODEL_DESIGN` · **`APPROVE_PHASE_1I_0_READ_MODEL_DESIGN_WITH_CHANGES`**  
**Branch:** `feature/player-phase-1i-0-read-model-design`  
**Base `origin/main` SHA:** `bfb8980852d3c17174b3f77f17331605a5923457`  
**Classification:** **DESIGN_ONLY — NOT AUTHORIZED FOR APPLY**  
**Document verdict:** `READY_FOR_PHASE_1I_0_COMMIT`

All SQL below is illustrative. Do **not** create migrations or apply scripts in this phase.

---

## 1. Objects

| Object | Name |
|--------|------|
| Search / list | `public.player_directory_search` |
| Detail | `public.player_directory_get` |

Type: `FUNCTION` returning `json`. No directory table. No peer SELECT policy.

---

## 2. Security mode

| Setting | Value |
|---------|--------|
| Security | `SECURITY DEFINER` |
| `search_path` | **`pg_catalog, public`** |
| Table refs | Schema-qualify **`public.profiles`** (and other objects) where practical |
| Volatility | `STABLE` |
| Language | `plpgsql` |

```sql
-- DESIGN_ONLY — NOT AUTHORIZED FOR APPLY
-- SET search_path = pg_catalog, public
```

---

## 3. Authentication

```sql
-- DESIGN_ONLY — NOT AUTHORIZED FOR APPLY
IF auth.uid() IS NULL THEN
  -- NOT_AUTHENTICATED envelope; empty data
END IF;
```

| Role | EXECUTE |
|------|---------|
| `authenticated` | GRANT |
| `anon`, `PUBLIC` | REVOKE ALL |

---

## 4. Eligibility predicate

```sql
-- DESIGN_ONLY — NOT AUTHORIZED FOR APPLY
-- FROM public.profiles AS p
p.player_id IS NOT NULL
AND length(trim(p.player_id)) > 0
AND nullif(trim(p.display_name), '') IS NOT NULL
AND p.identity_verification_status = 'verified'
AND p.privacy_settings IS NOT NULL
AND jsonb_typeof(p.privacy_settings) = 'object'
AND (p.privacy_settings ->> 'publicProfileEnabled') = 'true'
AND p.status IS DISTINCT FROM 'suspended'
```

**Active rule:** `EXCLUDE_SUSPENDED_ONLY` (confirmed: `profiles.status` CHECK includes `suspended` in `docs/supabase-rbac.sql`).  
Do not use `profileStatus`. Do not exclude NULL status as a special case beyond `IS DISTINCT FROM`.

---

## 5. Strict RPC row shape (output)

Returned `data[]` / `data` objects may contain **only**:

| Key | Rule |
|-----|------|
| `player_id` | always |
| `display_name` | always |
| `is_verified` | boolean **`true`** |
| `avatar_url` | present value or null/empty — eligible rows only (avatar is identity field under publicProfileEnabled; no `showAvatar` toggle) |
| `activity_region` | masked: null unless `showActivityRegion` |
| `gender` | masked: null unless `showGender` |
| `handedness` | masked: null unless `showHandedness` |

### Removed from prior draft / never return

- `privacy_settings`
- `identity_verification_status`
- raw `status`
- `auth_user_id` / `id`
- `venue_id`
- `club_id`
- tenant metadata

Server may **read** privacy/verification/status internally for eligibility and masking; it must **not** emit them.

---

## 6. Server-side masking expression (conceptual)

```sql
-- DESIGN_ONLY — NOT AUTHORIZED FOR APPLY
json_build_object(
  'player_id', p.player_id,
  'display_name', p.display_name,
  'is_verified', true,
  'avatar_url', nullif(trim(p.avatar_url), ''),
  'activity_region',
    CASE WHEN (p.privacy_settings ->> 'showActivityRegion') = 'true'
         THEN p.activity_region ELSE NULL END,
  'gender',
    CASE WHEN (p.privacy_settings ->> 'showGender') = 'true'
         THEN p.gender ELSE NULL END,
  'handedness',
    CASE WHEN (p.privacy_settings ->> 'showHandedness') = 'true'
         THEN p.handedness ELSE NULL END
)
```

---

## 7. `player_directory_search`

### Arguments

| Arg | Type | Notes |
|-----|------|-------|
| `p_query` | `text` | displayName search; min length 2 after trim |
| `p_region` | `jsonb` | optional equality filter |
| `p_cursor` | `text` | opaque; invalid → error |
| `p_limit` | `int` | default 20; clamp 1–50 |

### Search / region / sort / cursor

- Search: escaped `ILIKE` on `p.display_name` only.  
- Region: when `p_region` provided, require `showActivityRegion` and key equality.  
- Order: `lower(trim(p.display_name)) ASC, p.player_id ASC`.  
- Cursor logical key: `(lower(trim(display_name)), player_id)`.  
- Decode opaque `p_cursor` in function or document that repository passes already-decoded components — **preferred:** repository validates/decodes and passes structured args **or** RPC decodes; either way UI sees only opaque string.  
- **Invalid cursor:** return `{ ok: false, code: "INVALID_CURSOR", data: [], … }` — **do not** fall back to first page.

### Envelope

```json
{
  "ok": true,
  "data": [ { "player_id": "...", "display_name": "...", "is_verified": true, "avatar_url": null, "activity_region": null, "gender": null, "handedness": null } ],
  "meta": { "nextCursor": "<opaque>|null", "limit": 20, "count": 1 },
  "code": null,
  "message": null
}
```

No total count in MVP.

---

## 8. `player_directory_get`

Argument: `p_player_id text`.  
Same eligibility + masking + strict fields.  
Missing/ineligible/unauthenticated → generic not-found / `NOT_AUTHENTICATED` (no hide-reason leak).

---

## 9. Grants and revokes

```sql
-- DESIGN_ONLY — NOT AUTHORIZED FOR APPLY
REVOKE ALL ON FUNCTION public.player_directory_search(text, jsonb, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.player_directory_search(text, jsonb, text, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.player_directory_search(text, jsonb, text, int) TO authenticated;

REVOKE ALL ON FUNCTION public.player_directory_get(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.player_directory_get(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.player_directory_get(text) TO authenticated;
```

Table grants on `public.profiles`: **unchanged**.

---

## 10. RLS interaction

DEFINER bypasses RLS; compensated by eligibility + masking + strict columns. Prefer **no** new peer SELECT policies.

---

## 11. Illustrative skeleton

```sql
-- DESIGN_ONLY — NOT AUTHORIZED FOR APPLY
CREATE OR REPLACE FUNCTION public.player_directory_search(
  p_query text DEFAULT NULL,
  p_region jsonb DEFAULT NULL,
  p_cursor text DEFAULT NULL,
  p_limit int DEFAULT 20
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object(
      'ok', false,
      'data', '[]'::json,
      'meta', json_build_object('nextCursor', NULL, 'limit', 0, 'count', 0),
      'code', 'NOT_AUTHENTICATED',
      'message', 'Authentication required'
    );
  END IF;
  -- validate cursor → INVALID_CURSOR if bad (no first-page reset)
  -- query public.profiles with eligibility + masking
  -- return strict fields only
  RETURN json_build_object(
    'ok', true,
    'data', '[]'::json,
    'meta', json_build_object('nextCursor', NULL, 'limit', 20, 'count', 0),
    'code', NULL,
    'message', NULL
  );
END;
$$;
```

---

## 12. Rollback concept

`DROP FUNCTION` both RPCs; drop indexes if added in 1I-B; no data migration.

---

## 13. Sequencing note

SQL authoring/apply = **1I-B**, only after **1I-A** app contract exists. Classification after design commit: `SQL_IMPLEMENTATION_REQUIRED` under 1I-B gate.
