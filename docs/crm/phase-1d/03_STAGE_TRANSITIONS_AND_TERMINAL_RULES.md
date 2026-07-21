# 03 — Stage Transitions and Terminal Rules (Phase 1D)

---

## Transition matrix (default pipeline)

Open stages advance only along `allowedTransitions` (default: consecutive open order).

| From | To | Via |
|------|----|-----|
| `qualification` | `proposal` | `advanceOpportunityStage` |
| `proposal` | `negotiation` | `advanceOpportunityStage` |
| any open | `won` | `closeOpportunityWon` only |
| any open | `lost` | `closeOpportunityLost` only |
| `won` / `lost` | * | **rejected** (no reopen in 1D) |

## advanceOpportunityStage

- Require `crm.opportunity.update` + scope.
- Verify Opportunity, Pipeline, and stage membership in the same scope.
- Reject stage skipping unless Pipeline `allowedTransitions` explicitly permits it.
- Reject transitions out of terminal stages.
- Reject advancing directly to won/lost (use close commands).
- Reject target stages from another Pipeline.
- Emit `crm.audit.opportunity.stage_changed` (pending).

## closeOpportunityWon

- Transition only to the Pipeline's won terminal stage.
- Record `closedAt`.
- Reject already-terminal Opportunities.
- **No Finance transaction**; `financeTransactionCreated: false`.
- Emit audit `opportunity.won`, stage_changed, and integration `opportunity.won` (pending).

## closeOpportunityLost

- Transition only to the Pipeline's lost terminal stage.
- Require non-empty `lossReason` or `lossReasonCode`.
- Record `closedAt` and preserve loss reason for CRM reporting.
- Reject already-terminal Opportunities.
- Emit audit `opportunity.lost`, stage_changed, and integration `opportunity.lost` (pending).

## Reopening

Out of Phase 1D scope — requires an explicit later workflow decision.
