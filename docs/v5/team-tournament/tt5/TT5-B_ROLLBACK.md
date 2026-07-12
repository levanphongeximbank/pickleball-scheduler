# TT-5B — Rollback Plan

**Phase:** TT-5B  
**Environment:** Staging only  
**Production impact:** NONE (no Production SQL applied)

---

## Rollback triggers

- Provision creates duplicate V5 matches under concurrency
- Legacy lock blocks valid pre-provision workflows incorrectly
- Cross-tenant data exposure in bridge RLS
- Idempotency replay returns wrong link
- Staging smoke / security reports FAIL

---

## Staging rollback steps

### 1. Stop client usage

- Do not merge integration branch to production branches
- Revert client changes on `feature/tt5-referee-v5-integration` if needed:
  - `teamRefereeV5BridgeEngine.js`
  - RPC service / repository provision methods
  - `TeamRefereePortal.jsx` lock UI

Legacy referee portal resumes normal behavior when bridge rows absent or revoked.

### 2. Revoke active links (preferred soft rollback)

For each active bridge row on staging:

```sql
-- Run as service role / admin on staging only
select public.team_tournament_revoke_referee_link(
  p_tournament_id := '<tournament_id>',
  p_sub_match_id := '<external_sub_match_id>',
  p_reason := 'tt5b_rollback',
  p_expected_link_version := <version>
);
```

Revoke is soft (`status = revoked`); history retained.

### 3. Disable provision (without dropping data)

```sql
revoke execute on function public.team_tournament_provision_referee_match(
  text, text, text, uuid, integer, text, text, text
) from authenticated;

revoke execute on function public.team_tournament_revoke_referee_link(
  text, text, text, integer, text
) from authenticated;
```

Legacy score RPCs continue; new links cannot be created.

### 4. Full SQL rollback (last resort — Staging only)

**Non-destructive preference:** leave `team_sub_match_referee_links` rows for audit.

If table must be removed (staging lab reset only):

```sql
-- STAGING ONLY — do not run on production
drop function if exists public.team_tournament_provision_referee_match(
  text, text, text, uuid, integer, text, text, text
);
drop function if exists public.team_tournament_revoke_referee_link(
  text, text, text, integer, text
);
-- Restore prior save_sub_match_draft / confirm_sub_match from TT-4 patch backup
-- drop table if exists public.team_sub_match_referee_links cascade;
```

Restore `team_tournament_get_setup` from TT-4 patch (remove `scoreOps` / `refereeLinkOps` fields).

### 5. V5 live state cleanup (optional)

Orphaned `match_live_states` from failed provisions may remain. Safe to delete on staging by `match_id` if no production dependency:

```sql
-- STAGING ONLY
delete from public.match_live_states
where match_id = '<external_sub_match_id>'
  and tournament_id = '<tournament_id>';
```

---

## Git rollback

Integration worktree only — do not reset main worktree.

```bash
cd pickleball-scheduler-tt5-referee-integration
git checkout -- <files>   # discard TT-5B client changes
# or
git reset --hard ef16a323   # back to TT-5A docs commit (loses TT-5B work)
```

Integration merge commit `2140c817` (TT-5A Referee V5 merge) remains valid without TT-5B SQL/client.

---

## Verification after rollback

1. Legacy referee draft + confirm work on sub-match without bridge row
2. `team_tournament_get_setup` no longer exposes block codes (if patch reverted)
3. TT-4 staging verify PASS
4. Team Tournament full test suite PASS
5. Referee V5 unit/UI PASS

---

## Production note

**No TT-5B artifacts deployed to Production.** Rollback on Production is not required for TT-5B. If accidental Production apply occurred (should not):

1. Immediately revoke execute on provision/revoke RPCs
2. Engage DBA for bridge table assessment
3. Do not DROP without owner approval

---

## Forward path

After rollback on Staging, fix blockers and re-apply:

1. `node scripts/apply-phase-tt5b-staging-sql.mjs`
2. `node scripts/verify-phase-tt5b-staging.mjs`
3. Full regression gate

Do not proceed to TT-5C until owner re-approves GO.
