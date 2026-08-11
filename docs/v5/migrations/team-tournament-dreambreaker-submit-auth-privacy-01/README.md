# team-tournament-dreambreaker-submit-auth-privacy-01

**Workstream:** `TEAM-TOURNAMENT-PR412-CAPTAIN-DREAMBREAKER-SUBMIT-CANONICAL-AUTH-PRIVACY-REMEDIATION-01`

**Status:** LOCAL PACKAGE ONLY — do **not** apply without Owner GO.

## Problem

Captain Dreambreaker form works. Submit fails with `CLUB_UNASSIGNED` because the client called `captainSubmitDreambreakerOrder` → `guardClubAccess` after Identity V2 strips `session.clubId`.

Server submit RPC also:

1. Did not prove `p_team_id ∈ {team_a_id, team_b_id}`
2. Returned `teamAOrder` + `teamBOrder` (opponent athlete IDs)

## Client pairing

`TeamPortal.handleDreambreakerSubmit` → `runMutation({ method: "submitDreambreakerOrder" })`

- no profile club / `guardClubAccess`
- `expectedVersion = matchup.dreambreaker.version`
- client asserts viewer team + matchup participant + own roster
- RPC wrapper sanitizes any leaked `teamAOrder` / `teamBOrder`

## Server contract (this package)

| Check | Behavior |
|-------|----------|
| Participant | `p_team_id` must be matchup A or B — else `FORBIDDEN`, zero write |
| Captain | `team_tournament_guard_captain_portal_write` (unchanged) |
| CAS | `dreambreaker_states.version` before UPDATE |
| Response | `ownOrder` + `opponentOrderSubmitted` boolean only |

## Files

| File | Purpose |
|------|---------|
| `01_PRECHECK.sql` | Unique signature; participant assert missing; both orders leaked |
| `02_APPLY.sql` | Participant assert + viewer-safe submit result |
| `03_VERIFY.sql` | Signature, privacy, CAS, grants; no order mutation |
| `04_ROLLBACK.sql` | Restore prior submit RPC body only |

## Locked SHA256

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `16cda296bb33473af7d5c29953eaca864ab6334a7109a752e25baf1115009bdb` |
| `02_APPLY.sql` | `0603e5420c3acfea3eb8bb18ade1e0acfb04197651a076ee8e051093267b1bcb` |
| `03_VERIFY.sql` | `35ba4966213f2ecd99fa6f113bfb9077f364896a5b16562d37c9c79d0962bd0f` |
| `04_ROLLBACK.sql` | `309080e8675c25957b4c732629befab827464aceb65389a9c6c175b0b6b9ef76` |

Do not apply this package without Owner GO. Zero Staging/Production mutations in this workstream.
