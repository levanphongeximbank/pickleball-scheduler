# TT-5A — Migration Proposal (Design Only)

**Date:** 2026-07-13  
**Status:** NOT CREATED OR APPLIED — TT-5B deliverable  
**Production:** UNTOUCHED

---

## Q3 — When to create Referee V5 live state?

### Recommended trigger: **After lineup publish + referee assignment**

| Stage | Action |
|-------|--------|
| Lineup submit/lock | No V5 state |
| **`team_tournament_publish_matchup` success** | Eligible for provisioning |
| **Referee assigned** (insert `referee_assignments`) | Required before edge auth |
| **Provision RPC** (TT-5C new) | Create `match_live_states` + bridge row `pending→live` |
| **`START_MATCH` command** | Transition to in-play (V5 existing) |

**Not recommended:**

- On lineup submit alone — players may change before publish
- On "call match" without assignment — edge auth fails
- Lazy create on first `get-state` without idempotency — race on multi-device

---

## Proposed migration phases

### TT-5B — Schema bridge + flags (staging)

```sql
-- team_sub_match_referee_links (see TT5-A_DATA_MODEL_MAPPING.md)
-- team_tournament_sub_match_score_ops() helper — returns blockCode when linked
-- Indexes on (external_sub_match_id), (match_state_id)
```

### TT-5C — Provisioning + assignment

```sql
-- team_tournament_provision_referee_v5_match(
--   p_tournament_id, p_sub_match_id, p_referee_user_id, p_idempotency_key
-- )
-- Inserts referee_assignments + match_live_states seed + bridge row
-- Seeds participants from published lineups
```

### TT-5D — Outbox consumer

```sql
-- team_tournament_apply_referee_v5_finalize(p_outbox_id) — service role
-- or Edge Function worker
```

### TT-5E — UI route wiring

No SQL — router + portal changes only.

### TT-5F — Pilot cutover + dreambreaker policy

Optional deprecation flags on legacy confirm RPC.

---

## Q2 — Bridge table verdict

**RECOMMENDED** — see data model doc. Required for lifecycle/idempotency beyond bare ID mapping.

---

## Rollback plan (design)

1. Feature flag off → legacy portal only
2. Bridge rows `integration_status=cancelled` — unblock legacy RPCs
3. Do not delete `match_live_states` (audit retention)
4. Outbox consumer drain then disable

---

## Staging apply order (future TT-5B runbook)

1. `team_sub_match_referee_links` DDL
2. RPC patches (block legacy when linked)
3. Provision RPC
4. Outbox consumer function
5. Re-run TT-4 + V5 staging verify scripts
6. Integration E2E script (TT-5A test strategy)

**No SQL executed in TT-5A.**
