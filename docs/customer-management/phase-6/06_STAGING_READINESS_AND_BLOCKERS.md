# 06 — Staging Readiness And Blockers (CUSTOMER-06)

## Ready when

- CUSTOMER-03 → CUSTOMER-05 SQL already applied (or same controlled window).
- Phase-6 SQL pack reviewed and Owner-authorized.
- Service-role path available for RPCs.
- JWT cannot write merge tables (verified).

## Blockers

| Blocker | Severity |
|---------|----------|
| Phase-6 SQL not applied | Hard |
| Missing MergeApprovalPort in Production composition | Hard for merge writes |
| Authenticated write policies accidentally enabled | Hard |
| Live Identity/Player directories unavailable for conflict evaluation | Medium (search still works) |
| UI merge console not built | Soft (out of scope) |

## Non-goals for this pack

- No Staging/Production apply in this change set
- No auto-merge
- No Identity/Player/CRM table queries
- No package.json / lockfile changes
