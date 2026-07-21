# 01 — Interaction Timeline Domain (Phase 1E)

**Status:** Application foundation
**Aggregate:** Interaction (append-only)

---

## Purpose

Record immutable CRM interaction timeline entries linked to a same-scope
`ContactReference`, with optional `Lead` / `Opportunity` linkage.

## Fields

| Field | Required | Notes |
|-------|----------|-------|
| `interactionId` | yes | From `CrmIdGenerator` |
| `tenantId` / `venueId` | yes | Explicit scope — no defaults |
| `contactRefId` | yes | Existing ContactReference in scope |
| `leadId` | optional | Same-scope Lead; same `contactRefId` |
| `opportunityId` | optional | Same-scope Opportunity; same `contactRefId` |
| `interactionType` | yes | Approved `INTERACTION_TYPE` |
| `direction` | yes | `inbound` / `outbound` / `internal` |
| `channel` | yes | `phone` / `email` / `sms` / `in_person` / `chat` / `system` / `other` |
| `occurredAt` | yes | Valid ISO-8601 via `CrmClock` / input |
| `summary` | yes | Non-empty, max 2000 chars |
| `outcome` | optional | Max 1000 chars |
| `recordedByActorId` | yes | Authenticated actor |
| `createdAt` / `updatedAt` | yes | From `CrmClock` |

Phase 1B aliases retained on the model: `type` (= `interactionType`),
`body` (= `summary`), `actorUserId` (= `recordedByActorId`).

## Append-only

- Phase 1E provides `recordInteraction` only — no edit or delete command.
- Memory repository exposes `create` / `getById` / `list` (no `update`).

## Forbidden payload content

- Full Customer or Player profiles
- Credentials, tokens, payment data
- Authoritative Finance records

## Deterministic timeline order

1. `occurredAt` descending
2. `createdAt` descending
3. `interactionId` ascending (stable tie-break)
