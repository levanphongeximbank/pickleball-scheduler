# PHASE 45B.5B — Daily / Team / Tournament Candidate Cutover

**Status:** Candidate discovery cutover for three screens. **No Private Pairing. No AI engine migration. No SQL/flags.**

## Migrated discovery

| Screen | Loader |
|---|---|
| Daily Play | `loadDailyPlayCandidatePool` / `useClubPairingCandidatePool` |
| Team Builder | club + tenant pools + `TeamRosterPanel` club filter |
| Tournament Registration Picker | Official / Internal / Individual Registration |

## Guarantees

- All discovery → `pairingCandidateService.listCandidates`
- No blob/localStorage discovery on these screens
- UI legacy picker shape via `toLegacyScreenPickerPlayer`
- Gender/rating/event filters preserved in existing UI helpers
- Repository errors → explicit Alert (`ok:false`), never silent empty success
- `athletes.id` = only pairing identity

## Out of scope

- Private Pairing picker
- AI pairing engines
- Quick-add write path (`TournamentPlayerQuickAddDialog` still blob write)
- TeamPortal / TeamRefereePortal / Eligibility page
