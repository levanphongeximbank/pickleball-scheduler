# team-tournament-captain-dreambreaker-reader-01

**Workstream:** `TEAM-TOURNAMENT-PR412-CAPTAIN-DREAMBREAKER-ORDER-REMEDIATION-01`

**Status:** LOCAL PACKAGE ONLY — do **not** apply without Owner GO.

## Problem

Referee Portal already shows Dreambreaker pending (`A: 0/4, B: 0/4`) from `get_setup`.

Captain Portal has `CaptainDreambreakerPanel`, but `team_tournament_get_captain_portal` omitted Dreambreaker state, so the order form never mounted.

Live target (read-only evidence):

| Field | Value |
|-------|--------|
| Tournament | `team-tournament-ikae8fpk` |
| Matchup | `matchup-1o9rud3t` |
| Status | `lineup_open` |
| Orders | `0/4` + `0/4` |

## Contract

Viewer-scoped `matchup.dreambreaker`:

| Field | Meaning |
|-------|---------|
| `required` | `true` when persisted Dreambreaker is not `pending` |
| `status` | `lineup_open` / `ready` / … |
| `version` | `team_tournament_dreambreaker_states.version` (submit CAS) |
| `canSubmitOwnOrder` | captain/deputy + `lineup_open` + unlocked + own order ≠ 4 |
| `ownOrder` | viewer team's athlete ids only |
| `opponentOrderSubmitted` | `true` iff opponent order length = 4 |

**Privacy:** never project `teamAOrder` / `teamBOrder` / opponent athlete ids.

Also exposes `settings.dreambreakerEnabled` and discipline `activationRule` / `disciplineKind` so render fallback can detect MLP 2–2 without `get_setup`.

## Files

| File | Purpose |
|------|---------|
| `01_PRECHECK.sql` | Unique signature + current reader omits Dreambreaker + target 0/4 |
| `02_APPLY.sql` | Viewer-safe Dreambreaker projection; keep published subMatches |
| `03_VERIFY.sql` | Signature preserved; own-order privacy; grants; no order mutation |
| `04_ROLLBACK.sql` | Restore official-submatches reader (no Dreambreaker) |

## Locked SHA256

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `39209a5ccbafa3acc1624d25baef03e317af022ca5a8593152715b838d3a1c2f` |
| `02_APPLY.sql` | `5e44d89ad0099876c558a94778570f54ada8b8e87e51f805f9bf87dbbac092af` |
| `03_VERIFY.sql` | `9a75a8618ad625c1709b585bfe007f98da6e1ba759ad557a670d99661b5c1ff4` |
| `04_ROLLBACK.sql` | `3337fbc0b6da370d0fbc8ad1a806d3439b35b676a0e4dfeb2b1f227d3379e3df` |

## Client pairing

`mapCaptainPortalResponse` → `matchup.dreambreaker`

`handleDreambreakerSubmit` expectedVersion = `matchup.dreambreaker.version` only.

Do not apply this package without Owner GO. Zero Staging/Production mutations in this workstream.
