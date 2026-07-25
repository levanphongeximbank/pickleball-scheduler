# COMMS-ACT-06 — Production Readiness

## Mục tiêu

Xác định Production (`expuvcohlcjzvrrauvud`) có đủ điều kiện rollout Communication Core hay chưa.

ACT-06 **không** apply SQL Production, **không** deploy Production, **không** mutate dữ liệu Production.

## Baseline

| Item | Value |
|------|-------|
| Branch | `feature/communication-foundation-comms-act-06-production-readiness` |
| Fresh main | `origin/main` @ `073ced2f` (audit window) |
| Staging (CLOSED ACT-05) | `qyewbxjsiiyufanzcjcq` |
| Production target | `expuvcohlcjzvrrauvud` |
| Runtime host | Vercel serverless `api/communication/*` |

## Capability scope (candidate)

| Capability | State |
|------------|-------|
| DIRECT_TRUSTED_BACKEND | candidate |
| SYSTEM_TRUSTED_PRODUCER | candidate |
| CLUB_SELECT_CLIENT_RLS | candidate |
| CLUB_WRITE_ADMIN_TRUSTED_BACKEND | candidate |
| COMMUNITY_BLOCKED_FAIL_CLOSED | continue block |
| REALTIME_BLOCKED_FAIL_CLOSED | continue block |

## Mutation policy

`remoteMutateAllowed = false` trong toàn bộ ACT-06.

ACT-07 mới được xem xét sau khi readiness package PASS và Owner GO từng Gate.

## Verdict pointer

Xem `06_RELEASE_GATE_VERDICT.md`.
