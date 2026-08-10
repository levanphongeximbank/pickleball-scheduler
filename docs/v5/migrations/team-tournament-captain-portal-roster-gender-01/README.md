# team-tournament-captain-portal-roster-gender-01

**Workstream:** `TEAM-TOURNAMENT-PR412-CAPTAIN-PORTAL-ROSTER-GENDER-AND-MLP4-OPTION-REMEDIATION-01`

**Status:** LOCAL PACKAGE ONLY — do **not** apply without Owner GO.

## Problem

Captain Portal athlete pool previously resolved teammate `gender` via `profiles` under PLAYER self-only RLS. Own-team roster members other than the signed-in captain got `gender=null`, so MLP4 gendered slot options collapsed (e.g. male doubles showed only the captain).

## Fix

`team_tournament_get_captain_portal` (SECURITY DEFINER) returns scoped own-team `rosterAthletes`:

| Field | Required |
|-------|----------|
| `athleteId` | yes |
| `displayName` | yes |
| `gender` | yes (`male` / `female` / null) |

Client lineup eligibility must consume this contract (`CAPTAIN_PORTAL_SCOPED_ROSTER`) and must **not** query teammate profiles to repair gender.

## Files

| File | Purpose |
|------|---------|
| `01_PRECHECK.sql` | Dependencies present |
| `02_APPLY.sql` | Replace captain portal reader contract |
| `03_VERIFY.sql` | RPC shape / grants / no profiles RLS package change |
| `04_ROLLBACK.sql` | Restore playerIds-only myTeam contract |

## Safety

- Does **not** broaden `profiles` RLS
- Does **not** expose email / phone / full profile
- Own team roster only; opponents remain id/name stubs
- Matchups remain viewer-team scoped
- Grants unchanged: `authenticated` execute, `anon` denied
- Captain access gate preserved

## Apply order (Owner only)

1. `01_PRECHECK.sql`
2. `02_APPLY.sql`
3. `03_VERIFY.sql`

Rollback: `04_ROLLBACK.sql`
