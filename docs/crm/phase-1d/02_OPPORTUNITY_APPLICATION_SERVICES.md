# 02 — Opportunity Application Services (Phase 1D)

**Status:** Application foundation  
**Consistency model:** MODEL 1 — COMMAND RETURNS EVENTS

---

## Service factory

`createOpportunityApplicationService(deps)` in
`src/features/crm/services/opportunityApplicationService.js`.

## Commands

| Command | Permission | Aggregate write |
|---------|------------|-----------------|
| `createPipeline` | `crm.pipeline.manage` | Pipeline |
| `listPipelines` | `crm.pipeline.manage` or `crm.opportunity.view` | none |
| `createOpportunityFromLead` | `crm.opportunity.create` | Opportunity |
| `getOpportunity` | `crm.opportunity.view` | none |
| `listOpportunities` | `crm.opportunity.view` | none |
| `assignOpportunity` | `crm.opportunity.update` | Opportunity |
| `advanceOpportunityStage` | `crm.opportunity.update` | Opportunity |
| `closeOpportunityWon` | `crm.opportunity.update` | Opportunity |
| `closeOpportunityLost` | `crm.opportunity.update` | Opportunity |

## createOpportunityFromLead rules

1. Authenticated actor + explicit tenant/venue scope.
2. Require existing Lead in the same scope.
3. Lead must have a `contactRefId` (ContactReference linkage preserved).
4. Require existing **active** Pipeline in the same scope.
5. Start only at the Pipeline's approved initial open stage.
6. Preserve `leadId` + `contactRefId` on the Opportunity.
7. Use `CrmIdGenerator` and `CrmClock`.
8. Do not copy complete customer/player profiles.
9. `estimatedValue` / `amountEstimate` are **non-authoritative CRM estimates** only.
10. One Opportunity write per command.
11. Return validated `pendingApplicationEvents` (`delivery: "pending"`).

## Lead linkage / conversion

- Opportunity stores `leadId` and `contactRefId`.
- **Lead is not marked converted** in Phase 1D.
- Combined Lead update + Opportunity create would be an unsafe multi-repository
  command without a transaction coordinator.
- Documented return field: `leadConversion: { performed: false, reason: ... }`.

## Idempotency

- Optional `idempotencyKey` on create Pipeline / create Opportunity.
- Replay returns the prior aggregate with `idempotentReplay: true` and empty pending events.
- Duplicate `pipelineId` / `opportunityId` / Pipeline `code` → `CRM_IDEMPOTENCY_CONFLICT`.

## Listing filters (persistence-neutral)

- `pipelineId`, `stageCode`, `ownerUserId`, `stageCategory` / `status`, `leadId`

## Explicit non-goals

- Interaction timeline, Tasks, CRM UI boards
- Durable DB, Finance booking, campaign automation
- Best-effort multi-write rollback
