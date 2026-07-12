# ADR-001 — Server-authoritative rating

**Status:** Accepted (V5-A)  
**Date:** 2026-07-12

## Context

`pick_vn_sync_rating` accepts full JSON including `verified_rating`, `rating_status`, and `rating_match_count` from authenticated clients.

## Decision

1. Frontend sends **input only** (answers, match scores, evidence artifacts).
2. All `rating_mean`, `display_rating`, `reliability_score`, `rating_status`, `evidence_level` computed server-side.
3. `ratingPayloadGuard.js` rejects forbidden fields at client boundary (defense in depth).
4. RLS blocks direct `player_rating_profiles` writes.

## Consequences

- Requires RPC for every canonical mutation.
- Existing `pick_vn_sync_rating` must be hardened before V5 cutover (separate task).
