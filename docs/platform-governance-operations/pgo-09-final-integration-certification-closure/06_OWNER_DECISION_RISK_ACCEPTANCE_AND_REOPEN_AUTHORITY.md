# 06 — Owner Decision, Risk Acceptance, And Reopen Authority

## Owner decision types

| Type | Meaning | Who |
|------|---------|-----|
| Production GO | Authorize Production-impacting action (deploy path affecting live, SQL/RLS apply, secret rotate, enable deferred Production track) | Owner GO only |
| Exception approval | Allow named deviation from documented control with bounds | Owner GO (+ domain owner) |
| Risk acceptance | Accept residual risk without full remediation | Owner GO |
| Temporary waiver | Time-boxed suspension of a control requirement | Owner GO |
| Structural certification acceptance | Accept PGO structural foundation package | Owner GO (via merge / explicit attest) |
| Readiness certification | Elevate domain readiness vocabulary | Owner GO after evidence |
| Deferred-track reopen | Reopen Owner-closed track | Owner GO only |
| Emergency escalation decision | Authorize emergency change / break-glass beyond normal path | Owner GO |

## Production GO

Required before:

- Production deploy-affecting change outside ordinary authorized path Owner already governs
- Production SQL / RLS / migration apply
- Production secret rotation
- Enabling Notification Production Phase 2C
- Any claim of `PRODUCTION_OPERATIONAL_READINESS_CERTIFIED` or Production release certified

Documentation merge of PGO-09 is **not** Production GO.

## Exception approval

Must record: control waived, reason, scope, compensating controls, owner, expiry/review date, and residual risk. Open-ended exceptions are prohibited.

## Risk acceptance

Must record: risk statement, affected assets/processes, likelihood/impact rationale (even if qualitative), owner, expiry, revisit trigger, and linkage to findings register (PGO-08 model).

Absence of acceptance ≠ acceptance.

## Temporary waiver

Must include hard end date or event-based expiry and mandatory review before renewal. Waivers must not reopen Notification Phase 2C.

## Decision evidence

Acceptable evidence forms (when Owner issues a decision):

- Dated Owner statement in controlled docs/PR with identity
- Ticket/issue linked from governance register with Owner confirmation
- Signed/attested checklist update with vocabulary change

Not acceptable as Owner decision:

- CI green alone
- Agent recommendation alone
- Draft vocabulary in a PR description without Owner action
- “Nobody objected”

## Expiry

Every exception, waiver, and risk acceptance requires an expiry or mandatory review date. Structural certification supersession rules are in doc 07.

## Mandatory review

| Trigger | Review required |
|---------|-----------------|
| Expiry approaching | Before expiry |
| Material incident | After containment |
| Provider / environment / access-model change | Before or immediately after change per doc 07 |
| Proposal to change certification vocabulary | Before vocabulary change |
| Proposal to reopen deferred track | Before any reopen work |

## Reopen authority

| Object | May reopen? | Authority |
|--------|-------------|-----------|
| Notification Production Phase 2C | Only with explicit Owner GO | Owner GO + notification owner |
| Closed PGO readiness certification as `NOT_READY` | Elevate only with evidence | Owner GO |
| PGO workstream for amendment | Yes, under change control | Owner GO + docs owner |
| Structural certification | Supersede via new certified package | Owner GO |

## Emergency escalation

Emergency change follows PGO-05 emergency path and PGO-06 break-glass rules:

- Still requires identifiable authority
- Must not be used to silently reopen Notification Phase 2C
- Must produce after-action evidence and Owner review

## Prohibition on implied approval

The following are **never** implied Owner approval:

1. Merge of documentation PRs
2. Structural foundation certification
3. `FINAL_INTEGRATION_CERTIFIED_WITH_CONDITIONS`
4. Green `verify` CI
5. Presence of runbooks or matrices
6. Reference to external providers
7. Provisional targets
8. Silence from Owner

Owner decisions must be explicit, attributable, and scoped.
