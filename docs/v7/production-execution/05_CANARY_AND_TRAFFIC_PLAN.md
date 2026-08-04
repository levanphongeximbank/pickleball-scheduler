# Canary and Traffic Plan

Initial canary scope:
- exact routes, RPCs, or read-only checks documented in the ordered ledger only
- no full-user expansion before canary pass
- no traffic expansion before monitoring thresholds are satisfied

Observation window:
- retain the canonical monitoring window from the Phase 6 abort/monitoring evidence until the exact execution ledger defines a step-specific window

Metrics and thresholds:
- HTTP 5xx below 1%
- auth success at least 98%
- controlled API p95 below 2 seconds
- advisor ERROR count zero
- DB health without transaction or connection exhaustion
- no cutover-caused queue or dead-letter growth

Automatic abort triggers:
- tenant isolation failure
- auth failure regression
- RPC critical failure
- integrity mismatch
- Advisor ERROR
- any unexpected drift or hidden dependency
