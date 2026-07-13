# TT-5A — Security & RLS Audit

**Date:** 2026-07-13  
**Production:** UNTOUCHED — audit references staging SQL only

---

## Team Tournament RLS (existing)

**Source:** `PHASE_TT1B_TEAM_TOURNAMENT_SSOT.sql`, TT-2/3/4 patches

| Pattern | Behavior |
|---------|----------|
| Tenant isolation | `team_tournament_assert_tenant(tenant_id)` on all command RPCs |
| Role gates | `team_tournament_can_manage()`, `team_tournament_can_manage_results()` |
| Lineup visibility | Server-side `team_tournament_get_visible_lineups` — opponent hidden pre-publish |
| Command idempotency | `team_tournament_command_log` + payload hash replay |
| Optimistic lock | `expected_version` on sub-matches, lineups, matchups |

**Referee permissions (client):**

- `TEAM_MATCH_RESULT_MANAGE` — score entry
- `TEAM_FORFEIT_APPLY`, `TEAM_WITHDRAW` — TT-4

---

## Referee V5 RLS (existing)

**Source:** `PHASE_V5A_REFEREE_FOUNDATION.sql`, `PHASE_V5D1_REFEREE_HARDENING.sql`

| Table | Client access |
|-------|---------------|
| `match_live_states` | SELECT/UPDATE via assignment check |
| `match_events` | Append via service/edge only |
| `match_integration_outbox` | **No client policy** (`match_integration_outbox_no_client`) |
| `match_result_revisions` | Read via assignment |
| `referee_assignments` | User sees own assignments |

**Helper:** `referee_v5_current_user_has_assignment(tenant_id, tournament_id, match_id)`

**Edge trust boundary:** `refereeV5TrustBoundary.js`, `refereeV5Authorization.js` — JWT + assignment row required.

---

## Q4 — Prevent lineup leak before publish

| Layer | Control |
|-------|---------|
| Client | `getVisibleLineup` returns `opponentLineup: null` unless organizer or matchup published+ |
| Server read RPC | `team_tournament_get_visible_lineups` enforces same |
| Referee engine gate | `hasOfficialLineups`, `isMatchupPublishedForReferee` in `teamRefereeEngine.js` |
| V5 provisioning (TT-5C) | **Must add:** reject if lineups not both `published` or matchup status < `published` |

**P0 gap:** V5 edge has no TT lineup check today — integration RPC must enforce before seeding participants.

---

## Q5 — Legacy score entry when V5 linked

**Recommendation:** **LOCK WHEN LINKED**

| `integration_status` | Legacy draft/confirm |
|----------------------|----------------------|
| (no bridge row) | Allow (current behavior) |
| `pending` / `live` | Block write — read-only summary optional |
| `finalized` | Read-only |

Implement in:

- `team_tournament_save_sub_match_draft` RPC
- `team_tournament_confirm_sub_match` RPC
- Client: disable buttons via `forfeitOps`-style `scoreOps.blockCode`

---

## Integration security requirements (TT-5B–D)

1. **Bridge table RLS** — tenant-scoped; only service role + BTC manage inserts
2. **Outbox consumer** — service role only; no anon/authenticated direct outbox write
3. **Assignment provisioning** — only BTC or automated job after publish; audit log
4. **Cross-tenant match_id** — composite key includes `tenant_id`; reject mismatch
5. **Token path isolation** — classic `/referee/:token` must not accept V5 `match_id` without assignment

---

## Q8 — Idempotency & integrity (security angle)

| Mechanism | Location |
|-----------|----------|
| V5 command idempotency | `match_sync_mutations.idempotency_key` |
| V5 finalize replay | Same revision returned |
| TT command idempotency | `team_tournament_command_log` |
| Outbox dedup | Unique idempotency per event type |

Consumer must use **single transaction** with row locks to prevent TOCTOU double apply.

---

## Findings

| ID | Severity | Finding |
|----|----------|---------|
| SEC-01 | P0 | No server-side lineup gate on V5 match load/provision |
| SEC-02 | P0 | Outbox readable/writable only by service — consumer not yet deployed (expected) |
| SEC-03 | P1 | Two permission models (TT permissions vs `referee_assignments`) — need mapping in TT-5C |
| SEC-04 | P2 | `/dev/referee-v5` super-admin only — ensure production flag off |
