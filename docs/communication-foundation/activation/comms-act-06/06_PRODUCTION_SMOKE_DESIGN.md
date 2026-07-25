# COMMS-ACT-06 — Production Smoke Design (do not run)

Marker: `COMMS_ACT_07_PROD_SMOKE_`

## Constraints

- Use existing QA/test identities on Production if present
- Do **not** use real customer accounts without explicit permission
- Do **not** create new auth users by default
- Deterministic cleanup to 0 marker rows
- No Community open; realtime must remain 0

## Cases (design only)

| # | Case | Expect |
|---|------|--------|
| 1 | Direct success | PASS |
| 2 | Sender spoof deny | DENY |
| 3 | System producer success | PASS |
| 4 | Browser System deny | DENY |
| 5 | Club authorized write | PASS |
| 6 | Unauthorized / inactive / cross-Club deny | DENY |
| 7 | Club client SELECT | PASS (authorized) |
| 8 | Idempotency replay | PASS (same result) |
| 9 | Direct client write deny | DENY |
| 10 | Community denied | DENY |
| 11 | Realtime publication count | 0 |

## Identity gate

If Production lacks safe test identities → ACT-07 verdict **`BLOCKED_TEST_IDENTITIES`**.

## Execution

Smoke runs only under Gate D4 Owner GO in ACT-07 — **not** in ACT-06.
