# Phase 1I-B — SQL Implementation Summary

**Wave:** Public Player Directory SQL read-model authoring only  
**Owner token:** `AUTHORIZE_PHASE_1I_B_SQL_AUTHORING_ONLY`  
**Branch:** `feature/player-phase-1i-b-directory-sql`  
**Base:** `origin/main` containing merged Phase 1I-A `d2e850d10b921f00c84118b1dd59fe6f3214c275`  
**Verdict (authoring):** `READY_FOR_PHASE_1I_B_PRECOMMIT_REVIEW`  
**SQL apply:** **NOT performed** (requires separate `AUTHORIZE_PHASE_1I_B_STAGING_APPLY`)

---

## Package layout

| Artifact | Path |
|----------|------|
| Forward migration | `docs/v5/PHASE_1I_B_PLAYER_DIRECTORY_READ_MODEL.sql` |
| Rollback SQL | `docs/v5/PHASE_1I_B_PLAYER_DIRECTORY_READ_MODEL_ROLLBACK.sql` |
| Verification SQL | `docs/v5/PHASE_1I_B_PLAYER_DIRECTORY_READ_MODEL_VERIFY.sql` |
| Docs (this folder) | `docs/player-management/phase-1i-b-sql/` |

---

## Objects authored

| Object | Kind | Client EXECUTE |
|--------|------|----------------|
| `public.player_directory_search(text, text, text, integer)` | SECURITY DEFINER RPC | `authenticated` only |
| `public.player_directory_get(text)` | SECURITY DEFINER RPC | `authenticated` only |
| `public.player_directory_format_activity_region(jsonb)` | helper | **revoked** |
| `public.player_directory_encode_cursor(text, text)` | helper | **revoked** |
| `public.player_directory_decode_cursor(text)` | helper | **revoked** |
| `public.player_directory_project_row(...)` | helper | **revoked** |
| `profiles_directory_eligible_name_id_idx` | partial index | n/a |
| `profiles_directory_player_id_idx` | partial index | n/a |

---

## Contract alignment (Phase 1I-A)

| Item | Value |
|------|-------|
| Search RPC | `player_directory_search` |
| Detail RPC | `player_directory_get` |
| Args | `p_query text`, `p_region text`, `p_cursor text`, `p_limit integer` / `p_player_id text` |
| `activity_region` output | **text or null** (not jsonb) |
| Cursor | opaque `pd1.*` matching `directoryCursor.js` |
| Invalid cursor | envelope `code: "INVALID_CURSOR"` (no first-page reset) |

---

## Explicit non-goals (this package)

- No Staging / Production apply  
- No UI / application contract changes  
- No `publicDirectoryEligible` column  
- No anon EXECUTE / peer SELECT policy expansion  
- No extensions (`pg_trgm` deferred)  
- No commit / push / PR from this authoring task alone  
