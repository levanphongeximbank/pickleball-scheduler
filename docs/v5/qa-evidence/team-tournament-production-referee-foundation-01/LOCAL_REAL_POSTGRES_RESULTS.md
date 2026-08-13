# Local real-Postgres results

Disposable embedded PostgreSQL 16.4 on loopback (`127.0.0.1`).  
Forbidden refs not used: `qyewbxjsiiyufanzcjcq`, `expuvcohlcjzvrrauvud`.

Harness: `tests/team-tournament-production-referee-foundation-01-real-postgres.test.js`  
Opt-in: `OPERATION_B1B_WP5_AUTO_PROVISION=1`

| Gate | Result |
|------|--------|
| PRECHECK → APPLY → VERIFY | PASS |
| APPLY second attempt | PASS |
| ROLLBACK empty restores prestate | PASS (`start_dreambreaker` retained) |
| FOUNDATION_TO_FINAL_COMPOSITION | PASS (final PRECHECK + APPLY + VERIFY) |
| partial apply → PRECHECK refuses | PASS `partial_foundation_state=referee_assignments` |
| conflicting object → PRECHECK refuses | PASS `conflict=referee_assignments.missing_column.expires_at` |
| anon grants → VERIFY refuses | PASS `anon_denied.table_write` |
| live rows → ROLLBACK refuses | PASS `ROLLBACK_REFUSED live_data=referee_assignments` |
| final continuation present → ROLLBACK refuses | PASS `ROLLBACK_REFUSED final_continuation_present` |

REAL_POSTGRES=PASS  
No credentials. No live JWT. No secrets.
