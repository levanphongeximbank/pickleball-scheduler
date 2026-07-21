# 01 — ContactReference and Lead Services (Phase 1C)

**Status:** Application foundation (remediated)
**Module entry:** `createLeadApplicationService` from `src/features/crm/index.js`

---

## Consistency model: MODEL 1 — COMMAND RETURNS EVENTS

Selected because Phase 1B does not require active audit/integration port dispatch
inside Phase 1C application commands, and MODEL 1 gives unambiguous outcomes
without a transaction coordinator:

- Each mutating command performs **exactly one** aggregate write.
- Validated audit/integration envelopes are returned as `pendingApplicationEvents`
  with `delivery: "pending"`.
- Dispatch is deferred to a later adapter/phase.
- Event-side-effect ports are **not** invoked by Phase 1C commands.
- Envelope validation runs **before** the aggregate write; invalid envelopes →
  failure with **no** write.
- Success means the documented aggregate write committed and pending envelopes
  are validated (not delivered).
- Failure means **no** aggregate write committed for that command.

`createContactReference` and `createLead` are **separate** commands.
`createLead` requires an existing `contactRefId` — it does **not** silently
create ContactReference + Lead in one command.

---

## Responsibilities

| Service method | Permission | Aggregate write | Pending events |
|----------------|------------|-----------------|----------------|
| `createContactReference` | `crm.lead.create` | ContactReference | audit CONTACT_REFERENCE_CREATED |
| `createLead` | `crm.lead.create` | Lead (existing contactRefId) | audit + integration LEAD_CREATED |
| `getLead` | `crm.lead.view` | none | — |
| `listLeads` | `crm.lead.view` | none | — |
| `assignLead` | `crm.lead.assign` | Lead owner update | audit LEAD_ASSIGNED |

---

## ContactReference rules

CRM owns a **reference object**, not a customer/player profile.

Application create requires **at least one** of `customerId` | `playerId` | `authUserId`.

External records:

- Resolved only through read-only **scoped** ports (`getById(scope, id)`)
- Cross-tenant / cross-venue → `CRM_FORBIDDEN_SCOPE`
- Missing record / missing scope on record → `CRM_CONTACT_UNRESOLVED`
- No complete profile copy into CRM aggregates

---

## Lead ownership boundary

- Lead owns CRM relationship state: status, source, owner, notes, title, `contactRefId`
- Lead does **not** own customer/player master data
- Default `ownerUserId` on create = authenticated actor when omitted
- Opportunity conversion is **out of scope** for Phase 1C

---

## Explicit non-goals

- Active event bus dispatch / delivery claims
- Non-deterministic rollback after multi-write failure
- Dual-write ContactReference+Lead in one command
- Complete lead lifecycle / Opportunity / UI / SQL
