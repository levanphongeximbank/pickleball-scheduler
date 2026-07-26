# BM-FINAL-RATING-01 — Boundary Notes

## Player identity

- Canonical FK: Player Management `playerId`.
- `athleteId` / `memberId` / `participantId` / auth user ID are aliases only.
- Adapter: `createCanonicalPlayerIdResolverAdapter`.
- Ambiguous / unresolved → typed fail closed (no first-match).

## Competition

- Competition Elo stays inside `competition-core/rating`.
- Not projected as public Player Rating.
- `MatchResultRatingPort` remains unimplemented (no invented algorithm).

## Ranking

- Ranking / VPR is consumer-only relative to Player Rating.
- No Ranking-owned Player Rating writer in this workstream.

## Production

- Production untouched.
- No SQL apply, no feature-flag enablement, no database writes from this PR.
