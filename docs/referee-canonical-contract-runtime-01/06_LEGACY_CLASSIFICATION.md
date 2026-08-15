# Legacy classification

| Asset | Classification | Notes |
|---|---|---|
| CORE-13/15/16/17 | REUSE / STILL_REQUIRED | Canonical engines |
| E2E-04 referee facade | STILL_REQUIRED | Orchestration only |
| In-memory E2E-04 store | TEST_ONLY | TEST_DOUBLE_ONLY |
| Referee V5 tables + RPC shell | REUSE_INFRASTRUCTURE | Persistence vocabulary |
| Referee V5 scoring/lifecycle/finalize engines | COMPATIBILITY_ONLY | Existing V5 UI; not CE adapter authority |
| Referee V5 realtime | COMPATIBILITY_ONLY | V5 UI |
| Referee V5 prototype UI | TEST_ONLY / UI deferred | Out of scope |
| `TEAM_MATCH_RESULT_MANAGE` on generic E2E-04 map | LEGACY_TO_RETIRE (removed from map) | Still used by Team Tournament |
| `refereeMatchesUser` name/email | LEGACY_TO_RETIRE | Not canonical authority |
| Legacy token referee (`tournament_match_live`) | COMPATIBILITY_ONLY | Do not reopen |
| Team Tournament referee (PR #418) | STILL_REQUIRED | Locked regression; do not change for End A |

Do not delete V5 domain engines in this run.
