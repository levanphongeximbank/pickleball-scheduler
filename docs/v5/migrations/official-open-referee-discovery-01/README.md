# Official/Open authenticated referee discovery 01

**LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT SEPARATE OWNER GO STAGING.**

This package adds the missing authenticated discovery and secure-open boundary
for Official/Open assignments in the existing **Giải của tôi** dashboard.

## Authority

- `canonical_tournaments.payload.settings.refereeAssignments` remains the
  assignment authority.
- `tournament_match_live` remains execution state only.
- Dashboard discovery does not read or require a live row.
- Secure open creates or reuses only the exact authorized match live row.
- `settings.refereeAssignments[matchId].token` is the sole token-release
  authority. `match.referee.token` is a denormalized compatibility copy.
- `settings.refereeAssignments[matchId].canonicalUserId` is the sole
  authenticated platform-account identity authority. Match/roster identity
  copies are never authorization fallback.

## Identity order

1. `canonicalUserId == auth.uid()` is authoritative.
2. If and only if `canonicalUserId` is absent, a legacy stored value may match
   the authenticated JWT email by exact normalized equality.
3. Both values must be syntactically complete emails.
4. Display name, partial email, prefix, substring, roster label, and fuzzy
   matching are forbidden.

Manual referee entries remain external/token-based and do not appear in an
authenticated account dashboard unless an existing canonical account was
explicitly selected.

`LEGACY_REFEREE_EMAIL_COMPATIBILITY_DEFERRED_FOR_REMOVAL=YES`

Future assignment writes preserve an existing roster `canonicalUserId`; this
package does not create another identity registry or invent user IDs.

## RPCs

Authenticated only:

- `official_open_list_my_referee_assignments()`
  - sanitized match cards
  - no token, canonical row, payload, settings, ledger, or unrelated assignment
- `official_open_open_my_referee_match(uuid, text)`
  - repeats the same identity authorization
  - requires the assignment-map token
  - denies a nonblank mismatched `match.referee.token`
  - denies an existing live row carrying a different token
  - never repairs or rotates either token
  - locks the canonical Tournament row `FOR UPDATE` before inspecting or
    creating the live row
  - creates/reuses one deterministic `tournament_match_live` row
  - returns only `tournamentId`, `matchId`, and the exact `routeToken`

Private identity/token helpers have no client execute grant. Both client RPCs are
`SECURITY DEFINER SET search_path = public`. No table DML grant is added.

## Current-assignment token revocation

`official_open_assert_current_referee_token(text)` is a private shared guard.
It resolves live identity without a lock, locks the canonical Tournament
`FOR UPDATE`, revalidates the current assignment, then locks the live row
`FOR UPDATE` and requires exact assignment/live/match token consistency.

Official live-row creators and the current-assignment token guard use the
same order: canonical Tournament row first, then `tournament_match_live`.

The package hardens:

- `official_open_ensure_match_live`
- `official_open_referee_get_match`
- `official_open_adjust_live_score`
- `official_open_commit_match_result`

All three must pass the current-assignment guard. Legacy
`referee_get_match_by_token` and `referee_update_match_score` retain their
non-Official behavior but deny rows belonging to an Official/Open canonical
Tournament.

## No data migration

- `BACKFILL_REQUIRED=NO`
- no fixture mutation
- no live-row pre-creation
- no score/result mutation
- no canonical Tournament mutation
- no court, Daily, Team, Internal, or Side-out schema mutation

## Proposed Staging order after separate Owner GO

1. `01_PRECHECK.sql` — read only
2. `02_APPLY.sql` — functions and exact grants, one transaction
3. `03_VERIFY.sql` — read only
4. `04_ROLLBACK.sql` — only with separate Owner authorization

Rollback restores the exact pre-discovery bodies/grants of the six replaced
token RPCs, then drops only the six new discovery/private functions. It does
not delete live rows or mutate canonical business data.
