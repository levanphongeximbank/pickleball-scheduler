# Team Tournament Canonical Persistence + Dashboard Lifecycle — Package 01

**Status:** LOCAL PACKAGE ONLY — **DO NOT APPLY** without separate Owner GO.  
**Workstream:** `feat/team-tournament-canonical-dashboard-lifecycle-01`  
**Staging/Production apply:** NOT in this turn.

## Contract

- **NORMAL_NEW_CREATE_PATH:** `team_tournament_create` only. Both tables in one server transaction. Same UUID.
- **HISTORICAL_HEAL_PATH:** `team_tournament_ensure_canonical` only. Not used for new creates.
- Missing RPC → **FAIL CLOSED**. No client dual-write. No `canonical_tournament_create` + header fallback.
- Preview-before-migration may fail closed. That is acceptable.
- Shared stable id: `canonical_tournaments.id` = `team_tournaments.tournament_id`.
- Status `draft` is a saved canonical state. Organizer-visible. Not athlete/public discoverable.
- Athlete dashboard visibility: `registration` | `ready` | `active` | `completed`.
- Dashboard reader is `team_tournament_get_dashboard` only. No get_setup compose. No private captain orders.
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
| `02_APPLY.sql` | `82b6379a82fc3a42eb61ca278bd348cee600bd6e805f0da48b4faf137db0ea5d` |
| `03_VERIFY.sql` | `99bf8a1c46dac46da28bd7592941cfb8775f8e17d61805c178bd4e07f478eb96` |
| `04_ROLLBACK.sql` | `604bb3e7920a48484c0989b5a2f6a25110cc99902a96521cf389b3c81ad04d8e` |

## Safety

- No Staging/Production apply from this workstream
- Anon cannot execute create/dashboard RPCs
- Tenant assert remains on create/dashboard/ensure
- Existing Captain Portal and Referee Portal are reused, not duplicated
