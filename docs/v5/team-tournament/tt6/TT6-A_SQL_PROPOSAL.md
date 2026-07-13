# TT-6A — SQL Proposal (Not Applied)

**Date:** 2026-07-13  
**Status:** PROPOSAL ONLY — **do not apply in TT-6A**  
**Apply target:** Staging only after TT-6B implementation + owner approval  
**Production:** UNTOUCHED

---

## 1. Summary

Team Tournament Realtime requires **narrow publication** of row-level tables with **RLS policies verified before** `ALTER PUBLICATION`. Internal tables (outbox, inbox, command log) must **never** be published.

Proposed migration file (TT-6B): `docs/v5/team-tournament/tt6/TT6-B_REALTIME_PUBLICATION.sql`

---

## 2. Publication plan

### 2.1 ADD to `supabase_realtime` (after RLS)

| Table | Rationale | Scope |
|-------|-----------|-------|
| `team_tournament_matchups` | Matchup status transitions | Filter: `id=eq.{matchupId}` |
| `team_tournament_sub_matches` | V5 propagation visibility | Filter: `id=eq.{subMatchId}` |
| `team_tournament_lineups` | Captain own-row + post-publish | Filter: `matchup_id=eq.{id}` + RLS |
| `team_sub_match_referee_links` | Bridge status for BTC/referee | Filter: `sub_match_id=eq.{id}` |
| `team_tournament_standings_cache` | Version bump signal | Optional — or infer from sub-match |

### 2.2 Already published (no change)

| Table | Owner |
|-------|-------|
| `match_live_states` | Referee V5-E1 |

### 2.3 NEVER publish

| Table | Reason |
|-------|--------|
| `match_integration_outbox` | service_role consumer only |
| `team_tournament_referee_event_inbox` | dedupe internal |
| `team_tournament_command_log` | audit |
| `team_tournament_audit_logs` | audit |
| `team_tournament_referee_correction_requests` | workflow internal |
| `match_events` | append-only via edge |
| `match_result_revisions` | read via edge/RPC only |

---

## 3. RLS additions / verification (proposal)

### 3.1 Lineups — captain isolation

```sql
-- TT6-B proposal sketch — requires review against PHASE_TT3 lineups policies
-- Policy: team_tournament_lineups_realtime_select
-- USING (
--   team_tournament_assert_tenant(tenant_id)
--   AND (
--     team_tournament_can_manage()
--     OR team_tournament_is_captain_of_team(team_id)
--     OR team_tournament_matchup_is_published_for_lineup(matchup_id)
--   )
-- )
```

**Gate:** Staging test — Captain A session receives WAL for team A row only pre-publish.

### 3.2 Sub-matches — participant read

```sql
-- USING (
--   team_tournament_assert_tenant(tenant_id)
--   AND (
--     team_tournament_can_manage()
--     OR team_tournament_is_participant_of_sub_match(id)
--     OR team_tournament_referee_has_active_link(id)
--   )
-- )
```

### 3.3 Bridge links

Reuse TT-5B RLS patterns — extend SELECT for assigned referee on linked sub-match.

---

## 4. Optional: event signal table (alternative design)

If WAL on wide tables is too heavy, introduce lightweight signal table:

```sql
-- Alternative — evaluate in TT-6B if WAL noise too high
-- team_tournament_realtime_signals (
--   id uuid primary key,
--   tenant_id uuid not null,
--   tournament_id text not null,
--   scope_type text not null,
--   scope_id text not null,
--   entity_version int not null,
--   event_type text not null,
--   payload_hash text not null,
--   occurred_at timestamptz not null default now()
-- )
-- RLS: same as scope
-- Publication: this table only
-- Trigger on sub_matches/matchups/lineups → insert signal row
```

**Trade-off:** Extra write path vs cleaner subscriptions. Default TT-6B path: direct table publication unless staging proves noise issue.

---

## 5. Broadcast RPC (optional — not MVP)

```sql
-- NOT recommended for TT-6B MVP
-- team_tournament_broadcast_scope_event(...) — SECURITY DEFINER
-- Must validate caller role before pg_notify / realtime broadcast
```

Prefer `postgres_changes` + RLS for TT-6B.

---

## 6. Indexes (proposal)

| Table | Index | Purpose |
|-------|-------|---------|
| `team_tournament_sub_matches` | `(tenant_id, tournament_id, updated_at desc)` | Poll fallback ordering |
| `team_tournament_matchups` | `(tenant_id, tournament_id, status)` | Setup reload |
| `team_sub_match_referee_links` | `(sub_match_id)` where active | Bridge scope |
| `team_tournament_lineups` | `(matchup_id, team_id)` | Captain scope |

Verify existing TT-1B indexes before adding duplicates.

---

## 7. Rollback

```sql
-- TT6-B rollback sketch
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.team_tournament_matchups;
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.team_tournament_sub_matches;
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.team_tournament_lineups;
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.team_sub_match_referee_links;
-- DROP POLICY IF EXISTS team_tournament_lineups_realtime_select ON public.team_tournament_lineups;
-- (repeat for other added policies)
```

**Client rollback:** `VITE_TT_REALTIME_ENABLED=false` — immediate polling fallback without SQL rollback.

---

## 8. Staging apply runbook (TT-6B)

1. Apply RLS policies — verify with JWT probes (no Realtime yet)
2. Apply publication ALTER — one table at a time
3. Run `scripts/verify-phase-tt6-staging.mjs` security cases
4. Run Captain A/B lineup isolation cases
5. Document in `docs/v5/qa-evidence/phase-tt6/`

---

## 9. Production impact

| Item | TT-6A |
|------|-------|
| SQL applied | **NO** |
| Publication changed | **NO** |
| RLS changed | **NO** |

---

## 10. Safety verdict

| Criterion | Status |
|-----------|--------|
| No broad publication | YES |
| Internal tables excluded | YES |
| RLS before publication | YES |
| Rollback documented | YES |
| Production untouched | YES |

**SQL proposal: SAFE TO REVIEW** — apply only in TT-6B staging gate.
