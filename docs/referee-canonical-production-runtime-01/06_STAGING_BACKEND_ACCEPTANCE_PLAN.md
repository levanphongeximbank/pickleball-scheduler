# Staging backend acceptance plan

This workstream: **STAGING_MUTATIONS=0**. Local composition is certified. Live backend GO is Owner-gated.

## Preconditions for Owner GO

1. Apply nothing unless a later GO names a package (none required now).
2. Edge/service-role only for `referee_v5_commit_match_transition` / `referee_v5_commit_match_finalization`.
3. Browser must not call internal commit RPCs.
4. Seed assignment in `referee_assignments` with real `profiles.id` (`auth.uid`).
5. Ensure `match_live_states` row exists before first transition (`team_a_id`/`team_b_id` NOT NULL).
6. Prove: assigned command, stale version deny, idempotent replay, conflict deny, official revision, F5 GET equals commit.
7. Do not exercise Team bridge RPCs as generic CE runtime.

STAGING_BACKEND_CERTIFIED remains NO until that GO completes.
