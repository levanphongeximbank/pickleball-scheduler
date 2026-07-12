# ADR-005 — V2 coexistence without migration

**Status:** Accepted (V5-A)  
**Date:** 2026-07-12

## Context

Production and staging have `pick_vn_player_ratings` and blob mirrors in active use.

## Decision

- V5 tables are additive (`player_rating_profiles`, etc.).
- No auto-backfill, no delete V2, no overwrite `verified_rating`.
- Feature flag `VITE_PICK_VN_RATING_V5_ENABLED=false` until owner approval.

## Consequences

- Dual-read adapter needed in V5-F integration phase.
- Owner approves migration plan separately.
