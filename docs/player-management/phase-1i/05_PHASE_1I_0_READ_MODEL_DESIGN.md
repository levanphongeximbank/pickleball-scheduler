# Phase 1I-0 — Durable Read-Model Design

**Owner decisions:**  
`ACCEPT_PHASE_1I_OWNER_RECOMMENDATION` · `AUTHORIZE_PHASE_1I_0_SQL_READ_MODEL_DESIGN` · **`APPROVE_PHASE_1I_0_READ_MODEL_DESIGN_WITH_CHANGES`**  
**Branch:** `feature/player-phase-1i-0-read-model-design`  
**Base `origin/main` SHA:** `bfb8980852d3c17174b3f77f17331605a5923457`  
**Design date:** 2026-07-21 (UTC+7)  
**Remediation date:** 2026-07-21 (UTC+7)  
**Classification:** Documentation + SQL **design only** — **NOT AUTHORIZED FOR APPLY**  
**Document verdict:** `READY_FOR_PHASE_1I_0_COMMIT`

---

## 1. Objective

```
Authenticated UI
  → Player Directory facade
  → Player Directory repository
  → authenticated SECURITY DEFINER RPC
  → eligibility + server-side privacy masking
  → strict Directory-safe JSON only
  → app validates / maps to Directory DTO (second line of defense)
```

**Hard rule:** The RPC is the **first** privacy boundary. The app projector may re-validate but must **not** be the first gate. The RPC **must not** return `privacy_settings`, raw verification status, or tenant metadata.

---

## 2. Owner remediations locked

| # | Change |
|---|--------|
| 1 | Strict RPC output = Directory-safe fields only |
| 2 | Server-side privacy masking inside RPC |
| 3 | Active rule: **`EXCLUDE_SUSPENDED_ONLY`** (`status IS DISTINCT FROM 'suspended'`) |
| 4 | `SET search_path = pg_catalog, public` + schema-qualify `public.profiles` |
| 5 | Opaque cursor; invalid → `INVALID_CURSOR` (no silent first-page reset) |
| 6 | Sequence: **1I-0 → 1I-A → 1I-B → 1I-C → 1I-D → 1I-E → 1I-F**; **do not authorize 1I-B before 1I-A** |

---

## 3. Canonical read mechanism

**SECURITY DEFINER RPCs** (unchanged recommendation):

1. `public.player_directory_search(...)`  
2. `public.player_directory_get(p_player_id text)`  

| Setting | Value |
|---------|--------|
| Security | `SECURITY DEFINER` |
| `search_path` | **`pg_catalog, public`** |
| Grants | `EXECUTE` → `authenticated` only; revoke `anon` / `PUBLIC` |
| Table policies | **Unchanged** |

---

## 4. Strict RPC return fields

Each data row returned by either RPC may contain **only**:

| Field | Type / notes |
|-------|----------------|
| `player_id` | text |
| `display_name` | text |
| `is_verified` | **boolean** (always `true` for returned rows) |
| `avatar_url` | text or null |
| `activity_region` | **text or null** (masked label; Phase 1I-A remediation — **not** jsonb) |
| `gender` | text or **null** (masked) |
| `handedness` | text or **null** (masked) |

> **1I-B addendum:** Phase 1I-0 originally drafted `activity_region` as jsonb. Merged Phase 1I-A locks Directory I/O to **text \| null**. Storage column `profiles.activity_region` remains jsonb; RPC **emits** a formatted text label only. See `docs/player-management/phase-1i-b-sql/05_ACTIVITY_REGION_TEXT_CONTRACT.md`.

### Forbidden in RPC JSON (never return)

- `privacy_settings`
- `identity_verification_status` (raw)
- raw `status`
- `auth_user_id` / `id` (auth uuid)
- `venue_id`
- `club_id`
- tenant membership / roles / tokens
- `email`, `phone`, birth fields
- `visible`
- `updated_at` / audit / moderation / rejectionReason

Pagination cursor components (`lower(trim(display_name))`, `player_id`) may be used **internally** to build opaque `meta.nextCursor`. They must not become extra public DTO fields beyond `player_id` / `display_name` already allowed.

---

## 5. Server-side privacy masking (RPC)

Eligibility (row must satisfy all):

```text
player_id present and non-empty
AND display_name non-empty after trim
AND identity_verification_status = 'verified'
AND privacy_settings IS NOT NULL
AND jsonb_typeof(privacy_settings) = 'object'
AND (privacy_settings ->> 'publicProfileEnabled') = 'true'
AND status IS DISTINCT FROM 'suspended'
```

Field masking **before** emission:

| Output field | Rule |
|--------------|------|
| `activity_region` | **text label** only if `(privacy_settings ->> 'showActivityRegion') = 'true'`; else **NULL** (never emit jsonb object) |
| `gender` | value only if `(privacy_settings ->> 'showGender') = 'true'`; else **NULL** |
| `handedness` | value only if `(privacy_settings ->> 'showHandedness') = 'true'`; else **NULL** |
| `is_verified` | constant **`true`** (boolean) — never raw status string |
| `avatar_url` | see §6 |
| `privacy_settings` | **never returned** |

NULL / malformed privacy → row **excluded** (fail closed), not returned with nulls.

App Directory mapper may assert the same allow-list; it must not receive raw privacy JSON from the RPC.

---

## 6. Avatar privacy rule

Evidence:

- Phase 1A / `projectPublicPlayerProfile`: when `publicProfileEnabled`, `avatarUrl` is an **always-public identity field** (no separate `showAvatar` toggle in `DEFAULT_PRIVACY_SETTINGS`).
- Directory eligibility already requires `publicProfileEnabled === true`.

**Approved Directory avatar contract:**

- If row is eligible, emit `avatar_url` when present/non-empty; otherwise null/omit.  
- No additional avatar toggle.  
- Do not invent `showAvatar`.

---

## 7. Active / suspended decision

| Evidence | Source |
|----------|--------|
| Column | `public.profiles.status text NOT NULL DEFAULT 'active'` |
| CHECK | `status in ('active', 'suspended', 'invited')` — `docs/supabase-rbac.sql` |
| Semantics | Canonical account status including **`suspended`** |

**Owner decision applied:** `EXCLUDE_SUSPENDED_ONLY`

```sql
-- DESIGN_ONLY — NOT AUTHORIZED FOR APPLY
AND public.profiles.status IS DISTINCT FROM 'suspended'
```

| Behavior | Result |
|----------|--------|
| `suspended` | Excluded |
| `active` / `invited` | Eligible if other rules pass |
| NULL status | **Not applicable** (column NOT NULL); rule does **not** invent NULL exclusion — `IS DISTINCT FROM` would include NULL if it ever appeared |

**Do not use** `profileStatus`. **Do not invent** fields. Classification: **`EXCLUDE_SUSPENDED_ONLY`** (confirmed), not `NO_RELIABLE_ACTIVE_RULE`.

---

## 8. Authentication

- `auth.uid() IS NOT NULL` inside RPC.  
- No anon EXECUTE.  
- No browser service-role.

---

## 9. Search / region / pagination

Unchanged product rules from prior design, with remediations:

| Topic | Design |
|-------|--------|
| Search | `display_name` ILIKE substring; min length 2; escape `%`/`_`; empty = browse |
| Region filter | Optional **text** `p_region` (1I-A); case-insensitive match on allow-listed region fields / formatted label; only rows with `showActivityRegion = true` |
| Cursor logical key | `lower(trim(display_name)), player_id` |
| Cursor to UI | **Opaque** token only (`meta.nextCursor`) |
| Invalid cursor | **`INVALID_CURSOR`** — empty data; **must not** silently reset to first page |
| Limit | default 20, max 50 |

Repository encodes/decodes the opaque cursor; UI never sees raw sort tuples as a separate DTO.

---

## 10. Detail lookup

`player_directory_get`: same eligibility, same strict fields, same masking, generic not-found (no hide-reason leak).

---

## 11. Facade / repository APIs

```js
searchPublicDirectoryPlayers({ query, activityRegion, cursor, limit }, { session })
getPublicDirectoryPlayer(playerId, { session })
```

UI Directory DTO (camelCase mapping of strict RPC fields):

```js
{
  playerId,
  displayName,
  isVerified,       // boolean true
  avatarUrl?,
  activityRegion?,  // string | null (already masked text label)
  gender?,
  handedness?,
}
```

No `visible`. No raw privacy. No raw verification status.

---

## 12. Locked implementation sequence

```
1I-0  design                          ← this package
1I-A  facade / repository / app contract   ← required before SQL
1I-B  SQL authoring + Staging apply        ← NOT before 1I-A
1I-C  list UI /athletes
1I-D  detail UI /athletes/:playerId
1I-E  privacy / Staging QA
1I-F  closure + separate Production gate
```

**Do not authorize 1I-B before 1I-A.**

---

## 13. Open items after this remediation

None blocking design commit. Next: Owner authorize commit of 1I-0 docs, then `AUTHORIZE_PHASE_1I_A_DIRECTORY_CONTRACT`.

---

## 14. Exact Owner action next

1. Confirm remediation package.  
2. Authorize **commit** of 1I-0 docs (`READY_FOR_PHASE_1I_0_COMMIT`).  
3. Then authorize **1I-A** only (not 1I-B yet).
