# TT-5C — Rollback Plan

**Staging only | Production impact:** NONE

---

## Rollback triggers

- Consumer double-applies standings
- Cross-tenant inbox exposure
- Sub-match updated but standings not (partial apply)
- BTC resync corrupts snapshot

---

## Staging steps

### 1. Stop consumer

```sql
revoke execute on function public.team_tournament_consume_referee_v5_outbox(uuid, text) from service_role;
revoke execute on function public.team_tournament_drain_referee_v5_outbox(integer) from service_role;
```

### 2. Revert client (integration branch)

- Remove `TeamSubMatchRefereeProvisionRow` wiring
- Remove resync RPC client calls
- Revert `teamRefereeV5BridgeEngine` TT-5C helpers

TT-5B bridge/provision remains functional; legacy lock unchanged.

### 3. Restore SQL functions (optional)

Re-apply TT-5B versions of:
- `team_tournament_sub_match_referee_link_ops`
- `team_tournament_sub_match_score_ops`

Leave inbox table for audit or drop staging-only:

```sql
-- STAGING ONLY
drop table if exists public.team_tournament_referee_event_inbox cascade;
```

### 4. Recompute standings from TT source

```sql
select public.team_tournament_recompute_standings_cache(id)
from public.team_tournaments
where tournament_id = '<tournament_id>';
```

---

## Git rollback

```bash
cd pickleball-scheduler-tt5-referee-integration
git checkout -- <tt5c files>
# or revert commit after TT-5C commit
```

Keep TT-5B commit `84810bf` intact if rolling back only TT-5C.

---

## Do not

- Apply TT-5C SQL to Production
- Delete bridge rows (soft revoke only)
- Run `git clean` on integration worktree
