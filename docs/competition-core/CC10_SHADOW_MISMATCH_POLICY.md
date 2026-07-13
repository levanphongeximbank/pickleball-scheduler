# CC-10 — Shadow Mismatch Policy

## Severity levels

| Level | Action | Examples |
|---|---|---|
| INFO | Log only | trace metadata, expected ordering noise |
| EXPECTED_DIFFERENCE | Document in trace | legacy instability, tie-break draw lot |
| WARNING | Monitor, non-blocking | soft score delta, minor time rounding |
| BLOCKING | Stop staging promotion | see below |

## Blocking mismatches

- Missing or duplicate entry/match in membership comparison
- Different pair/team membership in formation or draw
- Different hard-rule reject vs accept
- Different group membership after draw
- Different final rank without documented legacy instability
- Schedule assignment changed by adapter (output not preserved)
- Public skill level changed unexpectedly
- Duplicate Elo application
- Duplicated rule score (founder double-count)
- Lost manual override

## Shadow mode rules

- Business output always legacy
- Blocking mismatch → staging rollout stage blocked, not production
- Mismatch recorded in Decision Trace `parityStatus` and adapter comparison objects
- No automatic remediation in CC-10

## CC-10 staging shadow status

Staging shadow **not enabled** in CC-10 (readiness phase only). Static matrix and unit tests verify policy wiring.
