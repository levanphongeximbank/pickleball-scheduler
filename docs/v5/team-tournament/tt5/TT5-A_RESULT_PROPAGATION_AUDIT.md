# TT-5A — Result Propagation Audit

**Date:** 2026-07-13

---

## Q6 — Referee V5 finalize emits what?

### Verified writers (SQL: `PHASE_V5D1_REFEREE_HARDENING.sql`)

**On finalize (atomic transaction via `referee_v5_commit_match_finalization`):**

1. **`match_result_revisions`** — new row per revision
   - `tenant_id`, `tournament_id`, `match_id`
   - `revision` (monotonic)
   - `final_score` jsonb
   - `winner_team_id`
   - `idempotency_key` = `finalize::{p_idempotency_key}`
   - `is_override`, `override_reason` (correction path)

2. **`match_live_states`** — status locked / finalized fields updated

3. **`match_integration_outbox`** — one or more rows:
   - `STANDINGS_RECALC_REQUESTED`
   - `RATING_EVIDENCE_REQUESTED`
   - `BRACKET_ADVANCE_REQUESTED`
   - `NOTIFICATION_REQUESTED`

**Edge transport:** POST `referee-v5-match` action `finalize` (`refereeV5Server.mjs`).

**No row written today to `team_tournament_sub_matches`.**

---

## Q7 — Team Tournament consumer update path (proposed TT-5D)

```
V5 finalize
  → match_result_revisions (revision N)
  → match_integration_outbox (STANDINGS_RECALC_REQUESTED, idempotency_key)
       ↓
TT-5D consumer (service role, idempotent)
  → read outbox WHERE status=pending FOR UPDATE SKIP LOCKED
  → map match_id → external_sub_match_id via bridge
  → UPDATE team_tournament_sub_matches SET
       status='completed',
       score=mapFinalScore(revision.final_score),
       winner_team_id=revision.winner_team_id,
       result_confirmed_at=revision.finalized_at,
       version=version+1
  → team_tournament_recompute_matchup_result(matchup_id)
  → team_tournament_recompute_standings_cache(team_tournament_id)
  → UPDATE bridge SET integration_status='finalized', result_revision_id=...
  → INSERT team_tournament_audit_logs
  → mark outbox processed (same idempotency_key)
```

---

## Q8 — Anti-double-count controls

| Threat | Mitigation (verify in TT-5D SQL) |
|--------|----------------------------------|
| Double finalize | V5: `match_sync_mutations` + finalize idempotency key replay returns same revision |
| Duplicate outbox delivery | Outbox `idempotency_key` unique; consumer upsert with `ON CONFLICT DO NOTHING` |
| Double standings increment | Consumer uses revision number; ignore revision ≤ last_applied_revision on bridge |
| Stale version overwrite | TT sub-match update `WHERE version = expected`; V5 already uses `expectedVersion` on commands |
| Legacy confirm after V5 finalize | Block confirm RPC when bridge `integration_status IN ('live','finalized')` |

---

## Q9 — Result revision / override backward to TT

V5 override = new `match_result_revisions` row with `is_override=true`.

**TT-5D consumer must:**

1. Detect revision > last applied
2. Replace sub-match summary (not append points)
3. Recompute matchup + standings from all sub-matches
4. Audit log `action=referee_v5_result_override_applied`

**Legacy `team_tournament_apply_forfeit` on completed sub-match:** already blocked (`forfeit_blocked_confirmed_result`). Same guard needed for V5-finalized rows.

---

## Official result source of truth (recommended)

| Phase | Authority |
|-------|-----------|
| Pre-publish | Team Tournament lineups |
| Live rally | **Referee V5** `match_live_states` + events |
| Official sub-match result | **Referee V5** `match_result_revisions` (via outbox consumer → TT tables) |
| Matchup tie / team win | **Team Tournament** aggregate on `team_tournament_matchups.result` |
| Standings | **Team Tournament** `team_tournament_standings` cache (recomputed from sub-match summaries) |

---

## Current state (pre-integration)

Legacy path only:

```
TeamRefereePortal.handleConfirm
  → confirmSubMatchResult (local engine validation)
  → runMutation confirmSubMatchResult
  → team_tournament_confirm_sub_match RPC
  → sub_match completed + matchup partial result
  → refreshStandings (client-side compute + optional upsert)
```

This path **must remain** for unlinked sub-matches until TT-5F cutover.
