# E2E-07 — Deferred & Residual Risks

## Deferred (by design)

- Remote staging/production certification (`E2E_07_REMOTE_STAGING_OWNER_GO_REQUIRED`)
- INT-01/02/05/09 production adapter wiring
- OPS-06 Call Room product surface
- OPS-11 incident workflow
- EXP-07/08/09 extended experience
- Non-IND templates/formats (TPL/FMT except IND)

## Residual risks

| Risk | Mitigation |
|------|------------|
| Local in-memory stores ≠ production persistence | Remote staging runbook |
| Benchmark budgets are MVP-local only | `productionSlaClaimForbidden` |
| Capability CERTIFIED_WITH_CONDITION items | Documented notes in traceability |
| Frozen E2E-01..06 contract drift | Stop-and-report policy (no silent cross-workstream patches) |
| CORE-08 Phase 1E branch-local delta gate fails on `main` and non-CORE-08 branches | Classified `PRE_EXISTING_MAIN_FAILURE` + `BRANCH_LOCAL_DELTA_POLICY`; see [13_CORE08_GATE_CLASSIFICATION.md](./13_CORE08_GATE_CLASSIFICATION.md). Original test preserved; not an E2E-07 Core regression. |

## Blockers policy

If a frozen E2E-01..06 contract defect is found during certification, **stop and report** — do not patch upstream workstreams from E2E-07.
