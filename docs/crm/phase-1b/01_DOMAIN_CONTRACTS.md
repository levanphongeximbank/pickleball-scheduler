# 01 — Domain Contracts (Phase 1B)

**Status:** Foundation freeze

---

## Aggregates / models

| Model | Mandatory scope | Notes |
|-------|-----------------|-------|
| `TenantVenueScope` | self | `tenantId`, `venueId` required |
| `CrmContactReference` | yes | External IDs optional; snapshot non-authoritative |
| `Lead` | yes | Status/source from constants |
| `Opportunity` | yes | Stage codes from constants |
| `Pipeline` / `PipelineStage` | yes | Default stage order provided |
| `Interaction` | yes | Typed timeline events |
| `CrmTask` | yes | Follow-up foundation |
| `CrmTag` / `ContactTagLink` | yes | CRM tags ≠ venue customer groups |
| Audit / integration envelopes | yes | Integration requires `idempotencyKey` |

## Ports

- `CrmLeadRepository`, `CrmOpportunityRepository`, `CrmInteractionRepository`, `CrmTaskRepository`
- `VenueCustomerDirectoryPort`, `PlayerDirectoryPort` (read-only)
- `IdentityActorPort`, `CrmAuthorizationPort`
- `CrmAuditPort`, `CrmClock`, `CrmIdGenerator`
- `NotificationEmitPort` (delegate delivery — not CRM SoT)

## Error taxonomy

See `CRM_ERROR_CODES` in `src/features/crm/constants/errorCodes.js`.

## Permission namespace

See `CRM_PERMISSIONS` in `src/features/crm/constants/permissions.js`.  
**Not** wired to Identity SQL in Phase 1B.

## Public facade

`src/features/crm/index.js` — explicit exports only; legacy LS services are not canonical repository exports.
