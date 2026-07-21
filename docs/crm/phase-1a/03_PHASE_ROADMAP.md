# 03 — CRM Phase Roadmap

**Status:** Official (Phase 1A design; Phase 1B in progress)

---

## Roadmap

| Phase | Focus |
|-------|--------|
| **1A** | Current-state audit & architecture — **complete** |
| **1B** | Domain contracts, permission keys proposal, module skeleton, COMPATIBILITY map, menu PARTIAL correction |
| **1C** | ContactReference + Lead foundation (application services on memory/fake repos) |
| **1D** | Opportunity + pipeline stages |
| **1E** | Interaction timeline + tasks/follow-ups |
| **1F** | Authorization wiring readiness, tenant/venue isolation hardening, audit events |
| **1G** | Durable persistence design (schema intent, idempotency) |
| **1H** | SQL authoring + RLS fail-closed |
| **1I** | Adapters: venue customer port, legacy LS bridge, notification emit readiness |
| **1J** | UI integration; further readiness labeling |
| **1K** | Certification & closure |

---

## Sequencing rationale

- Freeze boundaries and demote overstated LIVE menu **before** deep pipeline work.
- Authz/scope contracts **before** SQL.
- Keep legacy LS pages operational until UI phase (1J).

---

## Phase 1B′ note

Menu status corrected to `FEATURE_STATUS.PARTIAL` for CRM paths (no BETA enum exists). Notifications cross-link remains `LIVE` (external module).
