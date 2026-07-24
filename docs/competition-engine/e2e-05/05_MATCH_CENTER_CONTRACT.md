# E2E-05 — Match Center Contract

## Purpose

Public Match Center MVP over **published** match snapshots. No new realtime backend.

## Fields (allowlisted)

- `matchId`, `divisionId`, `stage`, `round`
- `participants` (`participantId`, `displayName`)
- `scheduledTime`, `timezone`
- `venue` / `court` public descriptors
- `status` ∈ SCHEDULED | DELAYED | SUSPENDED | ACTIVE | COMPLETED | CANCELLED | VOID | PENDING
- `score` (only when publication/acceptance policy allows)
- `validatedResult` (public-safe subset)
- `nextMatchId`
- `updateVersion`
- aggregate `statusSummary`
- `projectionFingerprint`
- `realtimeEnabled: false`

## Explicit non-goals

- Referee private/contact fields
- Organizer blockers / diagnostics
- Winner inference
- Supabase subscription wiring in this facade
- Enabling realtime transport

## Refresh model

Caller may re-invoke `getPublicMatchCenter` (polling adapter). Facade remains deterministic for identical published snapshots.
