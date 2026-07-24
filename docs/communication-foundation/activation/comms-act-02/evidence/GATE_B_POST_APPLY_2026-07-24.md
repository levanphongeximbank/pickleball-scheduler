# COMMS-ACT-02 — Gate B Post-Apply Evidence

**Verdict:** `GO_STAGING_PERSISTENCE`
**Owner final marker:** `COMMS_ACT_02_FINAL_VERIFICATION_PASS`
**Recorded (local):** 2026-07-24 22:00+07
**SQL applied:** YES (Owner SQL Editor, run count 1)
**Realtime enabled:** NO
**Client RLS opened:** NO
**Production touched:** NO

## Owner apply marker

| Field | Value |
|-------|-------|
| Marker | `SQL_EDITOR_APPLY_SUCCESS` |
| Project ref | `qyewbxjsiiyufanzcjcq` |
| Run count | 1 |
| Realtime changed | NO |
| Client RLS opened | NO |
| Canonical SQL | `docs/supabase-communication-comms05.sql` |
| SQL SHA256 (pre-apply bind) | `74f04eed7fdecbadca0a20d0f57605a921b22974ca9305d1b042a3528deffef3` |

## Owner final SQL Editor verification

Marker: `FINAL_VERIFICATION_SUCCESS`

| Metric | Expected | Observed | Pass |
|--------|---------:|---------:|:----:|
| Communication tables | 14 | 14 | YES |
| RLS enabled tables | 14 | 14 | YES |
| Deny-all policies | 14 | 14 | YES |
| Canonical triggers | 2 | 2 | YES |
| Realtime publication rows (`communication_*`) | 0 | 0 | YES |
| Run count | 1 | 1 | YES |

Consolidated catalog query (Owner): single-row SELECT over PostgreSQL catalogs only — no DDL/DML, no publication mutation, no RLS open.

## Target

| Check | Result |
|-------|--------|
| Live URL inventory ref | `qyewbxjsiiyufanzcjcq` |
| Production ref active | NO |
| Probe credential | Staging anon (CRM staging-qa env) — values not recorded |

## Remote inventory (Agent, read-only PostgREST)

Pre-apply (Gate A): `PRESENT_COUNT=0` `ABSENT_COUNT=14` (`PGRST205`).

Post-apply anon `GET /rest/v1/{table}?select=*&limit=0`:

| Table | HTTP | Class | Code |
|-------|-----:|-------|------|
| communication_conversations | 401 | PRESENT_DENIED | 42501 |
| communication_conversation_participants | 401 | PRESENT_DENIED | 42501 |
| communication_message_position_counters | 401 | PRESENT_DENIED | 42501 |
| communication_messages | 401 | PRESENT_DENIED | 42501 |
| communication_message_reactions | 401 | PRESENT_DENIED | 42501 |
| communication_read_cursors | 401 | PRESENT_DENIED | 42501 |
| communication_direct_requests | 401 | PRESENT_DENIED | 42501 |
| communication_pinned_messages | 401 | PRESENT_DENIED | 42501 |
| communication_user_blocks | 401 | PRESENT_DENIED | 42501 |
| communication_message_reports | 401 | PRESENT_DENIED | 42501 |
| communication_moderation_actions | 401 | PRESENT_DENIED | 42501 |
| communication_community_restrictions | 401 | PRESENT_DENIED | 42501 |
| communication_idempotency | 401 | PRESENT_DENIED | 42501 |
| communication_persistence_events | 401 | PRESENT_DENIED | 42501 |

Summary: `PRESENT_COUNT=14` `ABSENT_COUNT=0` `DENIED_COUNT=14` `OPEN_COUNT=0`

### RPC (anon)

| RPC | HTTP | Class | Notes |
|-----|-----:|-------|-------|
| `communication_allocate_message_position` | 401 | PRESENT_DENIED | `42501` permission denied for counters table |
| `communication_advance_read_cursor` | 401 | PRESENT_DENIED | `42501` permission denied for read_cursors table |

## Negative client path (anon)

| Check | Result |
|-------|--------|
| anon SELECT on all 14 tables | DENIED (`42501`) |
| anon execute both RPCs | DENIED (`42501`) |
| Client open/grant regression | NOT observed (`OPEN_COUNT=0`) |
| Club/Community client RLS opened | NO |

Authenticated negative matrix + trusted service-role smoke: **deferred** (deny-all Staging persistence certified; membership-mapped client RLS remains separate gate).

## Catalog SQL certification

| Check | Result |
|-------|--------|
| Tables + `relrowsecurity` | 14 / all true |
| `pg_policies` deny-all on `communication_*` | 14; no `USING (true)` |
| Canonical triggers | `communication_messages_reply_same_conversation_trg`, `communication_pinned_same_conversation_trg` |
| `pg_publication_tables` for `communication_*` | **0 rows** |

## Stop conditions honored

- No agent-side SQL apply
- No Production touch
- No realtime enable
- No Club/Community client RLS / GRANT open
- No deploy
- No package/lockfile change
- No secrets recorded in evidence

## Worktree

| Check | Result |
|-------|--------|
| Branch | `ops/communication-foundation-comms-act-02-staging-apply` |
| Base commit (pre-evidence) | `3f4e40b3` |
| Evidence | Gate A + Gate B + Staging activation evidence |

## Final Gate B verdict

```
overall: GO_STAGING_PERSISTENCE
clientRls: FAIL_CLOSED_DENY_ALL
realtime: NOT_ENABLED
production: BLOCKED
ownerFinalVerification: COMMS_ACT_02_FINAL_VERIFICATION_PASS
```
