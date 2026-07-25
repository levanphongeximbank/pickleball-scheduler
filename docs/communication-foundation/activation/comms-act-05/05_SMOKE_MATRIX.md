# COMMS-ACT-05 — Smoke Matrix

Marker prefix: `COMMS_ACT_05_SMOKE_FIXTURE_`

| # | Case | Expected |
|---|------|----------|
| 1 | Direct trusted-backend message success | Persist + ok |
| 2 | Unrelated Direct user denied | 403 |
| 3 | Sender spoof denied | 403 |
| 4 | System trusted producer success | Persist + ok |
| 5 | Browser/System invocation denied | 403 |
| 6 | Authorized Club write success | Persist + ok |
| 7 | Unauthorized / inactive / cross-Club Club write denied | 403 |
| 8 | Club SELECT client visibility after trusted write | Active member sees row |
| 9 | Idempotent retry | No duplicate message |
| 10 | RPC/client direct write still denied | Deny-all / no grants |
| 11 | Community still denied | BLOCKED_FAIL_CLOSED |
| 12 | Realtime publication rows | `0` |

## Fixture rules

- Deterministic ids with smoke marker
- Communication ownership tables only
- No new auth users
- No membership mutations
- Dedicated cleanup package → zero markers before closure

## Execution

Blocked until Owner GO token. Local package may dry-run with `--read-only`.
