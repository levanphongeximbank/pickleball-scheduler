# V5-D — Rollback Plan

**Status:** DRAFT  
**Applies when:** Staging or production partial apply of V5-D objects

---

## 1. Immediate mitigation (< 5 minutes)

1. Set `VITE_REFEREE_V5_ENABLED=false` in all environments
2. Redeploy frontend if flag was temporarily enabled
3. Legacy referee (`referee_get_match_by_token`, `referee_update_match_score`) continues unchanged

---

## 2. Disable RPC without dropping data

```sql
revoke execute on function public.referee_v5_apply_match_command(
  text, text, text, text, jsonb, integer, bigint, text, text
) from authenticated;

revoke execute on function public.referee_v5_finalize_match_result(
  text, text, text, integer, text, text, boolean
) from authenticated;

revoke execute on function public.referee_v5_get_match_state(text, text, text)
  from authenticated;
```

Optional: replace function bodies with `RAISE EXCEPTION 'V5-D disabled'` for clearer errors.

---

## 3. RLS rollback

Drop V5-D policies only (preserve V5-A enablement if needed):

```sql
drop policy if exists match_live_states_referee_select on public.match_live_states;
drop policy if exists match_events_referee_select on public.match_events;
drop policy if exists referee_assignments_self_select on public.referee_assignments;
drop policy if exists match_events_no_client_write on public.match_events;
drop policy if exists match_live_states_no_client_write on public.match_live_states;
drop policy if exists match_result_revisions_no_client_write on public.match_result_revisions;
drop policy if exists match_sync_mutations_no_client_write on public.match_sync_mutations;
```

Re-apply prior staging policies if any existed before V5-D.

---

## 4. Partial migration

If apply stopped mid-file:

1. Identify applied objects via `list_migrations` / migration log
2. Do **not** drop tables containing real match data without backup
3. Mark environment `V5-D PARTIAL — RPC DISABLED`
4. Export `match_events` + `match_live_states` before any destructive rollback

---

## 5. Data retention

| Rule | Action |
|------|--------|
| Append-only events | **Never DELETE** on rollback |
| Snapshots | Keep for forensic replay |
| Idempotency ledger | Keep — prevents double-apply on re-enable |

---

## 6. Edge Function rollback

1. Unpublish or route 503 on referee-v5 command handler
2. Keep read-only `get_match_state` if needed for support
3. Service role key rotation if compromise suspected

---

## 7. Re-enable path

1. Owner GO on fixed SQL
2. Apply delta migration (not full drop)
3. Run integration + RLS suite
4. Enable flag on preview only
5. Manual two-device smoke before wider rollout

---

## 8. Contact / ownership

- Feature flag owner: tournament platform team
- SQL review: owner before staging apply
- Legacy referee: unchanged — no rollback needed for legacy path
