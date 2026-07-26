# BM-FINAL-RATING-01 — Compatibility Behavior

## UI import/call surface

Exported V2 symbols remain importable. Writer **behavior** is frozen:

- Success no longer means “localStorage/club blob mutated”.
- Typed `PLAYER_RATING_WRITER_FROZEN` / `PLAYER_RATING_DURABLE_RUNTIME_UNAVAILABLE` / persistence errors are returned.

## Local draft

- `playerRatingAssessmentLocalStore` remains draft-only for onboarding.
- `hasCompletedPickVnOnboarding` prefers assessment draft (not rating SSOT).

## Mirrors

- Local Pick_VN rating store: read compatibility / hydrate cache only.
- Club blob rating fields: mirror-only; never independent verified success after durable failure.

## Failure behavior

- Durable runtime missing → typed failure (no silent local success).
- Durable failure → typed failure (no club-blob verified write).
- Identity unresolved/ambiguous → fail closed.
- Unauthorized actor → fail closed.
- Match-result algorithm → remains unimplemented / fail closed.
