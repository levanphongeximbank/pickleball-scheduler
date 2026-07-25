# COMMS-ACT-04 — Owner SQL Editor apply action

**Recorded:** 2026-07-25  
**Owner GO received:** `OWNER GO COMMS-ACT-04 APPLY CLUB_SELECT_ONLY TO STAGING`  
**Status:** `OWNER_SQL_EDITOR_APPLY_REQUIRED`  
**Agent apply:** NO (clipboard prepared only)

## Pre-apply re-check (PASS)

| Check | Result |
|-------|--------|
| Forward SQL path | `docs/supabase-communication-comms-act-03-authorization-client-rls.sql` |
| WINDOWS_APPLY_RAW_SHA256 (clipboard / Editor) | `4e4a19947bde5db8bc78b135b353b4c694e37bc975f926525c1389d2349a42b7` |
| WINDOWS_APPLY_RAW_BYTES | `13173` |
| REPOSITORY_CANONICAL_LF_SHA256 | `90b3ff7af7070b6709349cefd570d61f258449f3dc9d3908658b0df0acc65f26` |
| REPOSITORY_CANONICAL_LF_BYTES | `12870` |
| EOL_EQUIVALENCE_VERIFIED | `PASS` |
| SQL_SEMANTIC_DRIFT | `NO` |
| Rollback Windows raw SHA256 | `63056ec8ce8140bf06671a1bbf3e375d728047630aeb8bd06a9aefe32a016de5` |
| Rollback Windows raw bytes | `8808` |
| Offline SQL package | `COMMS_ACT_04_SQL_PACKAGE_PASS` |
| Cert fixtures present | YES (5 conversations; totals = markers) |
| Backup primary | `…20260725-101205` |
| Staging target | `qyewbxjsiiyufanzcjcq` |
| Production | `expuvcohlcjzvrrauvud` BLOCKED |
| Clipboard SHA256 = file | YES |

## Capability opened by this SQL (only)

- Club SELECT Client RLS on 6 tables / 6 policies
- Narrow `GRANT SELECT` to `authenticated` on those 6 tables
- `GRANT EXECUTE` on 3 SELECT gate helpers to `authenticated`

## Must remain denied

- Direct / System / Community client SELECT
- All client INSERT / UPDATE / DELETE
- Club participant admin / moderation / reports client access
- RPC execute to anon/authenticated
- Realtime publication
- Production

## Exactly one Owner action

Canonical ACT-03 forward SQL is on the **local clipboard** (SHA256 verified).

1. Open **Supabase Dashboard → project `qyewbxjsiiyufanzcjcq` (Staging only)**.  
   Refuse if project is Production `expuvcohlcjzvrrauvud`.
2. Open **SQL Editor → New query**.
3. Paste clipboard (must be ACT-03 Club SELECT package; Windows apply raw bytes `13173` / SHA `4e4a1994…a42b7`; EOL-equivalent to repository LF `12870` / `90b3ff7a…65f26`).
4. **Run once**.
5. Do **not** alter `supabase_realtime`.
6. Do **not** paste rollback, fixture SQL, or any other script in this step.
7. Do **not** deploy.

## After success — reply to Agent with only

1. `SQL_EDITOR_APPLY_SUCCESS`
2. Optional: SQL Editor run success confirmation (no dump / no secrets)

Agent will then run Gate D post-apply certification (and later fixture cleanup before ACT-04 close).

## If apply fails

Reply with `SQL_EDITOR_APPLY_FAILED` + error code/message (redact secrets).  
Do **not** retry with edited SQL. Rollback package remains available if Owner authorizes rollback separately.
