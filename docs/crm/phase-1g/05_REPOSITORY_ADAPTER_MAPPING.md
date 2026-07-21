# 05 — Repository Adapter Mapping (Phase 1G)

**Status:** Implemented in `src/features/crm/persistence/`

---

## Explicit maps (no implicit case conversion)

| Domain | Persistence |
|--------|-------------|
| tagId | tag_id |
| tenantId | tenant_id |
| venueId | venue_id |
| createdAt | created_at |
| normalized code | normalized_code |
| payload | payload_json |

Mapping modules:

- `mapTagDomainToRow` / `mapTagRowToDomain`
- `mapTagAssignmentDomainToRow` / `mapTagAssignmentRowToDomain`
- `mapConsentDomainToRow` / `mapConsentRowToDomain`
- `mapPendingEventDomainToRow` / `mapPendingEventRowToDomain`

## Rules

- Timestamps normalized via `normalizeIsoTimestamp`
- JSON payloads cloned and validated as objects
- Missing mandatory columns fail closed
- Unique violations → `CRM_IDEMPOTENCY_CONFLICT`
- Missing rows → `CRM_NOT_FOUND` (or `null` on get-by-id)
- Scope mismatch does not leak cross-scope row existence (queries always include tenant_id + venue_id)
- Defensive cloning via domain model factories (`Object.freeze`)

## Consent append-only

Durable consent repository exposes create/get/list only. `update` / `delete` throw. Optional DB trigger blocks UPDATE/DELETE.

## Tag assignment delete boundary

`remove(assignmentId)` deletes only `crm_tag_assignments` for the scoped id. Returns `false` when missing (idempotent not-found matching Phase 1F memory behavior). Never deletes tag definitions or target aggregates.
