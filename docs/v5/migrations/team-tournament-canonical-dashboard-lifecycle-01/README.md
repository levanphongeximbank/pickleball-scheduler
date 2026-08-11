# Team Tournament Canonical Persistence + Dashboard Lifecycle — Package 01

**Status:** LOCAL PACKAGE ONLY — **DO NOT APPLY** without separate Owner GO.  
**Workstream:** `feat/team-tournament-canonical-dashboard-lifecycle-01`  
**Staging/Production apply:** NOT in this turn.

## Contract

- Save Draft / first persist writes **both** `canonical_tournaments` and `team_tournaments`.
- Shared stable id: `canonical_tournaments.id` = `team_tournaments.tournament_id`.
- Status `draft` is a saved canonical state. Organizer-visible. Not athlete/public discoverable.
- Athlete dashboard visibility: `registration` | `ready` | `active` | `completed`.
- Dashboard reader is visibility-aware and does **not** expose private captain orders.
- Referee self-assignments are listed for `auth.uid()` only.
- Stage tie-break policy is displayed only. Winner resolution stays on existing runtime/server logic.
- Registration: foundation only. No fake team self-registration UI.

## Apply order (Owner GO only)

1. `01_PRECHECK.sql`
2. `02_APPLY.sql`
3. `03_VERIFY.sql`

Rollback: `04_ROLLBACK.sql` (drops new RPCs; restores `canonical_tournament_list_mine`; leaves rows).

## Locked SHA256

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `17fe70356201190c125e3722ae7968c178c158f0e5e74c0758688645b6693c56` |
| `02_APPLY.sql` | `28e78c8e6d09d12e9d444050efcf6efe41ea8695d82e8fb9f738d0c4b03881b5` |
| `03_VERIFY.sql` | `8ffcd6ee1716f6ae248ce59faccf1eb338d5ef4e4c8048d8fd7fb8147e08367e` |
| `04_ROLLBACK.sql` | `604bb3e7920a48484c0989b5a2f6a25110cc99902a96521cf389b3c81ad04d8e` |

## Safety

- No Staging/Production apply from this workstream
- Anon cannot execute create/dashboard RPCs
- Tenant assert remains on create/dashboard/ensure
- Existing Captain Portal and Referee Portal are reused, not duplicated
