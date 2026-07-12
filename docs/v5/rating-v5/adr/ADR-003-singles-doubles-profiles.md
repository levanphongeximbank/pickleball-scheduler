# ADR-003 — Singles and doubles profiles

**Status:** Accepted (V5-A)  
**Date:** 2026-07-12

## Context

Pickleball singles and doubles require different skill emphasis.

## Decision

- Unique profile per `(tenant_id, player_id, rating_mode)`.
- No auto-copy doubles → singles.
- Other mode may be used as weak prior in match engine (V5-D), not as official rating.

## Consequences

- Assessment questionnaire runs per mode (domain weights differ).
- UI shows both ratings on athlete profile.
