# 04 — Pending Event Dispatch Foundation (Phase 1F)

**Status:** Implemented

---

## PendingEventRecord

| Field | Notes |
|-------|-------|
| `pendingEventId` | Queue row id |
| `tenantId` / `venueId` | Mandatory scope |
| `eventId` / `eventType` | Source application event metadata |
| `aggregateType` / `aggregateId` | Safe identifiers only |
| `payload` | Validated safe metadata — no secrets |
| `status` | `PENDING`, `CLAIMED`, `ACKNOWLEDGED`, `FAILED` |
| `availableAt` | Claim eligibility time |
| `attemptCount` | Incremented on each claim |
| `claimedBy` / `claimedAt` / `claimExpiresAt` | Set on claim |
| `acknowledgedAt` / `failedAt` / `failureReason` | Terminal metadata |

## Claim order (deterministic)

1. `availableAt` ascending
2. `createdAt` ascending
3. `pendingEventId` ascending

## Services

| Service | Behavior |
|---------|----------|
| `enqueuePendingEvents` | Persist queue rows from validated audit envelopes only |
| `listPendingEvents` | Scoped list with optional filters |
| `claimPendingEvents` | Atomic claim within one repository instance |
| `acknowledgePendingEvent` | Requires `CLAIMED` |
| `failPendingEvent` | Requires `CLAIMED` + non-empty reason |
| `releaseExpiredClaims` | Returns expired `CLAIMED` rows to `PENDING` |

## Non-goals

- Background worker
- Notification / Email / SMS / Push delivery
- Provider adapters
- Durable external broker

## Authorization

Pending dispatch commands use `crm.audit.view` (infrastructure read/dispatch gate in Phase 1F).

## Events

- `crm.audit.pending_events.enqueued`
- `crm.audit.pending_event.claimed`
- `crm.audit.pending_event.acknowledged`
- `crm.audit.pending_event.failed`
