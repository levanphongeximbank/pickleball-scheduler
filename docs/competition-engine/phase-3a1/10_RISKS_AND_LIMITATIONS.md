# 10 — Risks and Limitations

| Risk | Mitigation |
|------|------------|
| Callers assume control plane dispatches executors | Docs + API returns decision only |
| Future env loader leaks into core | Architecture tests ban env reads in runtime-control |
| Premature mode activation | `clampDecisionToPhase3A1` + activatable check |
| Reason-code drift | Frozen `RUNTIME_DECISION_CODE` enum |

## Limitations (Phase 3A.1)

```text
No Production wiring
No shadow runner
No override store
No remote kill switch
No UI
```
