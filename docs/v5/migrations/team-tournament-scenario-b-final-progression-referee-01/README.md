# team-tournament-scenario-b-final-progression-referee-01

**LOCAL PACKAGE ONLY. Do NOT apply to Staging/Production without Owner GO.**

**Forward-only.** NEVER re-run:

- `team-tournament-scenario-b-ko-lineup-remediation-01`
- `team-tournament-close-uuid-type-remediation-01`
- `team-tournament-post-lineup-complete-lifecycle-01`
- `team-tournament-owner-browser-acceptance-remediation-01`

## Why

Owner Scenario B (`e3f37ef7-befe-4421-b694-8af57ba92a5d`) after SF generation PASS:

| ID | Defect |
|----|--------|
| C1 | Unresolved Final placeholder shown as captain/My Tournaments task (`lineup_open vs`) |
| C2 | Both SFs completed but Final teams not filled — `nextSlot` dropped; server recompute does not advance |
| C3 | `referee_assignments` unique `(tenant, tournament, match_id, role, referee_user_id)` violated on retry/reactivate after revoke |
| C4 | Known SQL/RPC failures surface as generic `Repository operation failed.` |

Client Preview (this PR) filters C1 operational tasks and maps C4 domain errors. C2 auto-progression and C3 atomic assign require this SQL GO.

## Fix (APPLY)

1. Persist `nextSlot` in `team_tournament_replace_matchups` `schedule_meta`
2. `team_tournament_advance_knockout_winner` + trigger: after KO `status=completed`, copy canonical `result.winnerTeamId` into next matchup slot (A/B from `nextSlot` or `matchNumberInRound`)
3. One-time backfill of already-completed KO rows (Owner B SFs)
4. `team_tournament_create_referee_assignment`: reject unresolved placeholders; idempotent same-ref; reactivate revoked; atomic supersede other live rows; catch `unique_violation` → `REFEREE_ASSIGNMENT_CONFLICT`
5. **Keep** unique constraint

No second progression SSOT. No `Tạo Chung kết` CTA. No client-derived winners.

## Apply order (Owner GO only)

1. `01_PRECHECK.sql`
2. `02_APPLY.sql` **once**
3. `03_VERIFY.sql`
4. `04_ROLLBACK.sql` emergency only

## Package LF SHA256 lock

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `82e0f1c0b60ca51bced45024b49d4761884e85634cd6717ff2e8f0564dd68a35` |
| `02_APPLY.sql` | `ba3dc54ed467b30e09331e5e721b1c6c43fd9e7e45a15b722f73bafa90a8f251` |
| `03_VERIFY.sql` | `23bdffc79431cabebff07903008f8ede6fceeb1c311f5a5e75714b5706170079` |
| `04_ROLLBACK.sql` | `703bea0609dfc92b1cdf8936b54fb56e0908d667f27a2bef11d5ff52dc3a72ca` |
