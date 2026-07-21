# Phase 1I-B — Rollback Design

**Executable:** `docs/v5/PHASE_1I_B_PLAYER_DIRECTORY_READ_MODEL_ROLLBACK.sql`

## Scope

Drops:

1. `public.player_directory_search(text, text, text, integer)`
2. `public.player_directory_get(text)`
3. Internal helpers (`format_activity_region`, `encode_cursor`, `decode_cursor`, `project_row`)
4. `profiles_directory_eligible_name_id_idx`
5. `profiles_directory_player_id_idx`

## Non-scope

- Does **not** delete or alter `public.profiles` rows/columns  
- Does **not** revert Phase 1C/1D/1E profile foundation  
- Does **not** change RLS policies

## Properties

- Reversible, non-destructive to athlete data  
- Idempotent via `DROP FUNCTION IF EXISTS` / `DROP INDEX IF EXISTS`  
- Safe after partial apply (missing objects ignored)

## When to use

- Staging apply failure mid-flight  
- Security finding requiring immediate withdraw of directory RPCs  
- Owner-directed rollback before Production gate
