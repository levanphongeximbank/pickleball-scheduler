# 05 — Phase 1D Acceptance Criteria

**Status:** Checklist

---

## Must pass

- [x] Phase 1B–1C contracts reused (no parallel contract families)
- [x] Pipeline create / list with code uniqueness and terminal validation
- [x] Opportunity create from Lead (same-scope Lead + active Pipeline + initial open stage)
- [x] Lead conversion **not** performed in the same command
- [x] Get / list Opportunities with deterministic ordering and filters
- [x] Assign via IdentityActorPort (fail closed)
- [x] Stage advance with skip/terminal/cross-pipeline rejection
- [x] Close won / close lost (loss reason required)
- [x] No Finance transaction created
- [x] MODEL 1 pending validated events; no best-effort rollback
- [x] Memory Pipeline + Opportunity repos; instance + scope isolation
- [x] Public facade exports Phase 1D APIs; test fakes not on facade
- [x] Legacy CRM pages/services/routes/menu PARTIAL unchanged
- [x] Focused Phase 1D tests + Phase 1B/1C/menu regressions
- [x] No SQL / Supabase / deploy / commit / push / PR in this phase

## Command success / failure semantics

| Result | Meaning |
|--------|---------|
| `ok: true` | Documented aggregate write committed; pending envelopes validated (not delivered) |
| `ok: false` | No aggregate write committed for that command |

## Error outcomes (canonical)

| Scenario | Code |
|----------|------|
| Missing actor / scope / permission | Phase 1B codes |
| Missing Lead / Pipeline / Opportunity | `CRM_NOT_FOUND` |
| Cross scope | `CRM_FORBIDDEN_SCOPE` |
| Invalid Pipeline terminals / duplicate stage | `CRM_INVALID_STATUS` / `CRM_INVALID_INPUT` |
| Invalid / skipped transition | `CRM_INVALID_TRANSITION` |
| Missing loss reason | `CRM_INVALID_INPUT` |
| Duplicate id / code / idempotency | `CRM_IDEMPOTENCY_CONFLICT` |

## Explicit non-goals

- Interaction timeline / Tasks
- CRM UI boards / route wiring
- SQL / RLS / Supabase repos
- Durable event bus / delivery workers
- Lead conversion multi-write
- Reopening terminal Opportunities
- Authoritative Finance revenue

## Phase 1E entry conditions

1. Phase 1D committed after owner review.
2. Interaction timeline and/or Task follow-up application services may use memory repos.
3. Event dispatch adapters remain a later concern unless owner expands scope.
4. Still no SQL until later persistence phases.
5. Still no CRM UI rewrite until a later UI phase (unless owner expands scope).
