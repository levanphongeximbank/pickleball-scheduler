# 04 — Authorization and Scope Matrix (Phase 1D)

---

## Fail-closed rules

- Missing actor → `CRM_MISSING_ACTOR`
- Unauthenticated actor → `CRM_UNAUTHORIZED`
- Missing tenant/venue → `CRM_MISSING_SCOPE`
- Actor tenant ≠ command scope → `CRM_FORBIDDEN_SCOPE`
- Actor venue not allowed → `CRM_FORBIDDEN_SCOPE`
- Missing permission → `CRM_FORBIDDEN_PERMISSION`
- Role names are **not** permission proof

## Permission matrix

| Action | Permission |
|--------|------------|
| Create / manage Pipeline | `crm.pipeline.manage` |
| List Pipelines (manage) | `crm.pipeline.manage` |
| List active Pipelines (view fallback) | `crm.opportunity.view` |
| Create Opportunity from Lead | `crm.opportunity.create` |
| Get / list Opportunities | `crm.opportunity.view` |
| Assign / advance / close | `crm.opportunity.update` |

## Scope isolation

- Every command requires explicit `tenantId` + `venueId`.
- Repositories key by `tenantId::venueId::id`.
- Cross-tenant Lead/Pipeline/Opportunity access rejected.
- Cross-venue Lead/Pipeline/Opportunity access rejected.
- Assignment target must match tenant; venue allow-list when present.
- Inactive / missing assignment targets rejected via `IdentityActorPort.resolveActor`.

## Resource guards

Loaded Opportunities are re-checked with `authorizeCrmResource` before mutation.
