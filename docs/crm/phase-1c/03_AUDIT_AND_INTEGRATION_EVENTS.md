# 03 — Audit and Integration Events (Phase 1C)

**Status:** MODEL 1 — pending application events (no durable bus, no active dispatch)

---

## Selected model

**MODEL 1 — COMMAND RETURNS EVENTS**

Why:

- Phase 1B event contracts are envelope validators, not a required in-process bus.
- Active port emission after persistence creates ambiguous outcomes on port failure.
- Returning validated pending envelopes keeps success/failure unambiguous in Phase 1C.

Semantics:

- `pendingApplicationEvents[]` entries use `{ kind, delivery: "pending", event }`
- `delivery: "pending"` means **not delivered** — adapters may dispatch later
- Do not claim audit delivery or integration side-effects in Phase 1C
- Envelope validation failure **before** write → command failure, no write

---

## Event types used

| Logical name | Constant | Kind |
|--------------|----------|------|
| ContactReference created | `CRM_AUDIT_EVENT_TYPE.CONTACT_REFERENCE_CREATED` | Audit |
| Lead created | `CRM_AUDIT_EVENT_TYPE.LEAD_CREATED` | Audit |
| Lead assigned | `CRM_AUDIT_EVENT_TYPE.LEAD_ASSIGNED` | Audit |
| Lead created (integration) | `CRM_INTEGRATION_EVENT_TYPE.LEAD_CREATED` | Integration |

Schema version: `CRM_EVENT_SCHEMA_VERSION` (default `1`).

---

## Envelope fields

Required on both audit and integration:

- `eventId`, `eventType`, `tenantId`, `venueId`
- `aggregateType`, `aggregateId`
- `actorUserId`, `occurredAt`
- `schemaVersion`, `payload`

Integration also requires `idempotencyKey` (optional `correlationId`).

---

## Emission points (pending only)

| Command | Pending events |
|---------|----------------|
| `createContactReference` | CONTACT_REFERENCE_CREATED (audit) |
| `createLead` | LEAD_CREATED (audit + integration) |
| `assignLead` | LEAD_ASSIGNED (audit) |

Rules:

1. Event scope must match aggregate scope.
2. Payloads carry CRM ids only — not complete external profiles.
3. No secrets or auth tokens.
4. Deterministic IDs/timestamps under injected clock/id generator.
