# COMMS-ACT-04 — Gate C Live Preflight (read-only)

**Recorded:** 2026-07-25  
**Target:** `qyewbxjsiiyufanzcjcq`  
**Production:** `expuvcohlcjzvrrauvud` blocked  
**Mutation count:** `0`  
**SQL apply:** NO  
**Realtime changed:** NO  

**Catalog/live probe verdict:** `COMMS_ACT_04_LIVE_PREFLIGHT_PASS`

## Methods

1. Fresh ACT-04 `schema.sql` dump inventory (logical dump taken immediately before this gate).
2. Live anon PostgREST probes against Staging URL/ref `qyewbxjsiiyufanzcjcq`.
3. ACT-01 `--live-gates` env/backup/Owner GO gate (pass).

Script: `scripts/communication/comms-act-04-staging-preflight.mjs --live-catalog`

## Catalog inventory (from fresh Staging dump)

| Check | Expected | Observed | Pass |
|-------|----------|----------|:----:|
| Communication tables | 14 | 14 | YES |
| RLS enabled | 14 | 14 | YES |
| Deny-all policies | 14 | 14 | YES |
| Club SELECT policies | 0 | 0 | YES |
| ACT-03 auth helpers | 0 | 0 | YES |
| Authenticated SELECT grants on Club tables | 0 | 0 | YES |
| Client write grants (anon/authenticated) | 0 | 0 | YES |
| RPC execute to anon/authenticated | 0 | 0 | YES |
| `phase42_active_club_member_id` present | yes | yes | YES |
| `supabase_realtime` rows for `communication_*` | 0 | 0 | YES |

## Live anon probes

| Surface | Result |
|---------|--------|
| 14 `communication_*` tables | **14 PRESENT_DENIED** (`401` / `42501`) |
| Open count | **0** |
| Absent count | **0** |
| `communication_allocate_message_position` | PRESENT_DENIED (`42501`) |
| `communication_advance_read_cursor` | PRESENT_DENIED (`42501`) |

## Stop conditions honored

- No SQL apply
- No SQL Editor opened by Agent
- No realtime enable
- No Production touch
- No migration / deploy

## Gate C note

Catalog preflight **PASS**. Overall ACT-04 apply readiness remains blocked by **test identity/data** (see identity evidence) because positive Club SELECT scope certification cannot run against empty Communication tables.
