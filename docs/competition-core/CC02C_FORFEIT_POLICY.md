# CC-02C — FORFEIT Policy

Phase: **CC-02C** | Owner-approved hardening

## Principle

**Match scores alone are NOT proof that a forfeit should update Competition Elo.**

Removed from codebase:

- `forfeitConfirmed` derived from `scoreA + scoreB > 0` in `playerHistoryEngine.js`
- `allowForfeit` / `forfeitConfirmed` eligibility bypass in `isMatchRatingEligible.js`

## Subtype matrix

| Subtype / case | Eligibility | Status |
|----------------|-------------|--------|
| `forfeit_before_start` | No Elo update | `ineligible` |
| `walkover` | No Elo update | `ineligible` |
| `walkover_before_start` | No Elo update | `ineligible` |
| `administrative_forfeit` | No auto Elo | `requires_review` |
| `forfeit_after_start` | No auto Elo (default) | `requires_review` |
| Legacy `forfeit` without subtype | No auto Elo | `requires_review` |
| Forfeit + scores, no subtype | No auto Elo | `requires_review` |

## Field resolution

Subtype read from (first non-empty):

- `record.forfeitSubtype`
- `record.ratingForfeitSubtype`
- `match.forfeitSubtype`
- `match.ratingForfeitSubtype`

## Future owner policy

`forfeit_after_start` with verified operational data may become eligible under an owner-approved ruleset. Until then: **REQUIRES_REVIEW only**.

Constants: `FORFEIT_SUBTYPE` in `ratingConstants.js`  
Implementation: `isMatchRatingEligible.js`

Preview deployment: **NOT DEPLOYED**  
Feature flags production: **OFF**
