# ADR-001: Referee State Source of Truth

**Status:** Proposed (V5-A)  
**Date:** 2026-07-12

## Context

Current system splits truth across `tournament_match_live`, club blob matches, and team cloud tables. UI components hold local score state. No canonical model for player positions or serve rotation.

## Decision

1. **Canonical history:** `match_events` (append-only).
2. **Canonical read model:** `match_live_states` (materialized snapshot with monotonic `version`).
3. **Canonical official outcome:** `match_result_revisions` after `referee_v5_finalize_match_result`.
4. UI and client caches are **never** source of truth.

## Consequences

- Every rally action → RPC → engine → append event → update snapshot.
- Reload = fetch snapshot or rebuild from events.
- Legacy `tournament_match_live` remains until migration phase; V5 writes to new tables only when flag on.

## Alternatives rejected

- **UI-owned state:** rejected — cannot sync multi-device or rebuild.
- **Extend `audit_log` JSON:** rejected — not queryable, no version conflict model.
