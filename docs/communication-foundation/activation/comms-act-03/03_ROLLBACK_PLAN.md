# COMMS-ACT-03 — Rollback Plan

## Goal

Return Client RLS to **deny-all** without deleting Communication data.

## Package

`docs/supabase-communication-comms-act-03-authorization-client-rls-rollback.sql`

## Steps (Owner SQL Editor, Staging only, after GO)

1. Confirm Staging project ref `qyewbxjsiiyufanzcjcq`
2. Apply rollback SQL once
3. Verify:
   - Club SELECT policies dropped
   - ACT-03 helpers dropped
   - 14 deny-all policies present
   - Client grants revoked
   - Tables/data still present
   - Realtime publication still 0

## Guarantees

| Guarantee | Value |
|-----------|-------|
| Data preserved | true |
| No `DROP TABLE` | true |
| Club membership SoT untouched | true |
| Realtime unchanged | true |

## Not a substitute for

COMMS-05 destructive rollback (drops tables) — use only when intentionally removing schema.
