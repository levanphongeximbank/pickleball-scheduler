# 04 — Phase 1C Acceptance Criteria

**Status:** Checklist (post-remediation)

---

## Must pass

- [x] Phase 1B contracts reused (no parallel contract families)
- [x] PlayerDirectoryPort scoped: `getById(scope, playerId)` — no unscoped fallback
- [x] ContactReference application create with directory resolution
- [x] Lead create requires existing ContactReference (single aggregate write)
- [x] MODEL 1: commands return pending validated event envelopes (no active dispatch)
- [x] No compensating multi-write rollback in Phase 1C services
- [x] Fail-closed authz + explicit tenant/venue on every command
- [x] Memory repos only; instance isolation; deterministic ordering
- [x] Public facade exports Phase 1C services; test fakes not on facade
- [x] Legacy CRM pages/services/routes/menu PARTIAL unchanged
- [x] Focused Phase 1C tests + Phase 1B / compatibility / menu regression
- [x] No SQL / Supabase / deploy / commit / push / PR in this phase

---

## Command success / failure semantics

| Result | Meaning |
|--------|---------|
| `ok: true` | Documented aggregate write committed; pending envelopes validated (not delivered) |
| `ok: false` | No aggregate write committed for that command |

---

## Error outcomes (canonical)

| Scenario | Code |
|----------|------|
| Missing actor | `CRM_MISSING_ACTOR` |
| Missing scope | `CRM_MISSING_SCOPE` |
| Missing permission | `CRM_FORBIDDEN_PERMISSION` |
| Cross scope | `CRM_FORBIDDEN_SCOPE` |
| Missing external customer/player | `CRM_CONTACT_UNRESOLVED` |
| Invalid source/status | `CRM_INVALID_STATUS` |
| Missing contactRefId on createLead | `CRM_INVALID_INPUT` |
| Duplicate id / idempotency conflict | `CRM_IDEMPOTENCY_CONFLICT` |
| Invalid event envelope before write | `CRM_INVALID_ENVELOPE` |
| Lead not found | `CRM_NOT_FOUND` |

---

## Explicit non-goals

- Complete lead lifecycle
- Opportunity conversion
- UI wiring
- SQL / RLS / Supabase repos
- Durable event bus / delivery workers
- Non-deterministic rollback after multi-write failure

---

## Phase 1D entry conditions

1. Phase 1C committed after owner review.
2. Opportunity + pipeline stage application services may use memory repos first.
3. Event dispatch adapters remain a later concern unless owner expands scope.
4. Still no SQL until 1G/1H.
5. Still no CRM UI rewrite until 1J (unless owner expands scope).
