# ADR-002 — Open vs verified rating tracks

**Status:** Accepted (V5-A)  
**Date:** 2026-07-12

## Context

Legacy system conflates self-assessment, match Elo, and verified skill into `current_rating`.

## Decision

- `open_rating_mean` — levels 1–3 evidence + open matches.
- `verified_rating_mean` — levels 4–5 only.
- `display_rating` resolved by `displayRatingResolver` using reliability threshold.
- **Never** multiply rating × reliability.

## Consequences

- UI must show source badge (Tự đánh giá / Dự kiến / Đã xác minh).
- Tournament seeding config chooses which track + min reliability.
