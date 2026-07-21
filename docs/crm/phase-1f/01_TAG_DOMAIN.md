# 01 — Tag Domain (Phase 1F)

**Status:** Implemented

---

## CrmTag aggregate

| Field | Required | Notes |
|-------|----------|-------|
| `tagId` | yes | Stable identifier |
| `tenantId` | yes | Mandatory scope |
| `venueId` | yes | Mandatory scope |
| `name` | yes | Non-empty, max 120 chars |
| `code` | yes | Normalized; unique within tenant/venue |
| `description` | no | Max 500 chars |
| `active` | yes | Explicit boolean (default `true`) |
| `createdAt` | yes | ISO-8601 |
| `updatedAt` | yes | ISO-8601 |

## Normalization

- `normalizeTagCode()` lowercases, trims, collapses whitespace to `_`, strips unsafe chars
- Duplicate normalized code within the same tenant/venue is rejected (`CRM_IDEMPOTENCY_CONFLICT`)

## Listing order

Deterministic sort: normalized `name` → `code` → `tagId`.

## Storage

Memory repository only — instance-local, tenant/venue isolated, defensive cloning via freeze.
