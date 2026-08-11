# Team Tournament Stage Tie-break Policy — Package 01

**Status:** LOCAL PACKAGE ONLY — **DO NOT APPLY** without separate Owner GO.  
**Workstream:** `feat/team-tournament-stage-tiebreak-policy-01`  
**Staging/Production apply:** NOT in this turn.

## Contract

Per-stage matchup tie-break policy lives on `team_tournaments.settings.stageTieBreakPolicy`.

Allowed keys (derived from existing group / knockout remaining-teams identity):

- `group`
- `round_of_16`
- `quarterfinal`
- `semifinal`
- `final`

Allowed values:

- `DREAMBREAKER` — existing 2–2 Dreambreaker lifecycle (default)
- `TOTAL_SUBMATCH_POINTS` — if normal child wins are tied, higher sum of normal child points wins; Dreambreaker does **not** activate when totals differ

Missing key / missing object → **`DREAMBREAKER`**. Existing tournaments do not switch to total points.

`STAGE_TIEBREAK_POLICY_IMPLEMENTED=YES`

`TOTAL_POINTS_SECONDARY_TIE_CONTRACT=DREAMBREAKER_FALLBACK`

If normal wins are tied **and** total points are also tied: fall back to the existing canonical Dreambreaker lifecycle (`needsDreambreaker=true`). Do not leave the matchup unresolved. Do not invent a second Dreambreaker.

## Storage

JSONB key on existing `team_tournaments.settings`.  
No new table. No new column. No RLS changes.

## Lock boundary

A stage’s policy cannot change once any matchup in that stage is `in_progress` / `completed`, has a playing/completed/forfeit child match, or has a non-pending Dreambreaker state.

Lineup submission alone does **not** lock the policy.

## Apply order (Owner GO only)

1. `01_PRECHECK.sql`
2. `02_APPLY.sql`
3. `03_VERIFY.sql`

Rollback: `04_ROLLBACK.sql` (restores prior RPC bodies; leaves JSON keys).

## Locked SHA256

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `ecb59ca5b3ea7e94ed7464e360a23ba7fdb2a6145264b8f86d7819243b9c7c75` |
| `02_APPLY.sql` | `b536dd994daaacf15a660030a302533ed0500fdb7bf0f3ae9fef3ff43b66818e` |
| `03_VERIFY.sql` | `76107b9b6543c2f3a4c980146e498160713f48407afb82e7e0baa805f88f6bdc` |
| `04_ROLLBACK.sql` | `203b0d90c2852b64fd817180fe7220cadea007177aa3615ffcaf872501c04647` |

## Safety

- No Staging/Production apply from this workstream
- No Super Admin-only setter
- Writes go through `team_tournament_setup_mutation_prepare` (auth + tenant + can_manage)
- Dreambreaker capability is not deleted
