# Phase 3B pre-APPLY Daily Play baseline

Reviewed durable repository baseline for routines that `02_APPLY.sql`
replaces. Rollback restores these bodies. PRECHECK fingerprints the live
`pg_get_functiondef` of assign/change against Staging-captured SHA256.

## Provenance

`origin/main` (`0ed70e8924f23b2b8d32bc692031644019acb1c2`) Daily Play
session-close bodies do **not** call `court_assert_available`. Staging live
`daily_play_assign_court` / `daily_play_change_court` **do**.

Authoritative source that produced Staging:

- Package: `docs/v5/migrations/official-open-canonical-court-reservation-01/02_APPLY_SCHEMA.sql`
- Branch (not merged to main): `fix/official-open-tournament-end-to-end-closure-01`
- Commit: `a9a5426ace7d9cce9efe4679f5db8eddd09ed2fe`
- Staging migration: `official_open_canonical_court_reservation_01_schema` (`20260814161332`)

`daily_play_submit_score`, `daily_play_cancel_match`, and
`daily_play_close_session` match main session-close
(`docs/v5/migrations/daily-play-canonical-session-close-final-lifecycle-01/02_APPLY.sql`)
and Staging `pg_get_functiondef`.

`court_assert_available` is a **dependency**, not replaced by Phase 3B.

## Fingerprint method

PRECHECK computes SHA256 of `pg_get_functiondef` using pgcrypto
`digest(bytea,text)` discovered from `pg_catalog.pg_extension.extnamespace`
and invoked schema-qualified (not via `search_path`):

```sql
encode(<pgcrypto_schema>.digest(convert_to(pg_get_functiondef(oid), 'UTF8'), 'sha256'), 'hex')
```

No extra whitespace normalization. `pg_get_functiondef` is already canonical
(`$function$`, `SET search_path TO 'public'`). Captured 2026-08-15 on Staging
`qyewbxjsiiyufanzcjcq` (read-only):

| Routine | SHA256 of `pg_get_functiondef` |
| ------- | ------------------------------ |
| `daily_play_assign_court` | `4c751a97d8e8ee8fc658d3b7647fc2d84b870b042f1f0211b23ba1632aa369e5` |
| `daily_play_change_court` | `d1b043a29dbee4d6e1d553ac5227052a645c115ded8f07d7cd1034ddb4a8cf59` |

Mismatch → `PREEXISTING_ROUTINE_DRIFT` (fail closed). Do not APPLY over an
unknown newer body.

## Object class

| Routine | Class |
| ------- | ----- |
| `daily_play_assign_court` | PREEXISTING_OBJECT |
| `daily_play_change_court` | PREEXISTING_OBJECT |
| `daily_play_submit_score` | PREEXISTING_OBJECT |
| `daily_play_cancel_match` | PREEXISTING_OBJECT |
| `daily_play_close_session` | PREEXISTING_OBJECT |
| `court_assert_available` | DEPENDENCY_NOT_MODIFIED |
