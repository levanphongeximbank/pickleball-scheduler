# COMMS-ACT-05 — Staging trusted-backend smoke certification

**Recorded:** 2026-07-25  
**Target:** `qyewbxjsiiyufanzcjcq`  
**Production:** `expuvcohlcjzvrrauvud` UNTOUCHED  
**Owner GO:** `OWNER GO COMMS-ACT-05 STAGING TRUSTED_BACKEND_SMOKE_ONLY`  
**Verdict:** `COMMS_ACT_05_STAGING_SMOKE_CERTIFIED`

**Harness:** `scripts/communication/comms-act-05-staging-trusted-backend-smoke.mjs`  
**Path:** Node + Staging service-role (server-only). No browser service-role. No Vercel deploy required for this cert.

## Case results (15/15)

| Case | Result |
|------|:------:|
| DIRECT_TRUSTED_MESSAGE_SUCCESS | PASS |
| UNRELATED_DIRECT_DENIED | PASS |
| SENDER_SPOOF_DENIED | PASS |
| SYSTEM_PRODUCER_SUCCESS | PASS |
| SYSTEM_BROWSER_INVOCATION_DENIED | PASS |
| CLUB_AUTHORIZED_WRITE_SUCCESS | PASS |
| CLUB_INACTIVE_DENIED | PASS |
| CLUB_CROSS_CLUB_DENIED | PASS |
| CLUB_SELECT_AFTER_TRUSTED_WRITE | PASS |
| IDEMPOTENT_RETRY_NO_DUPLICATE | PASS |
| CLIENT_DIRECT_WRITE_DENIED | PASS |
| RPC_CLIENT_DENIED | PASS |
| COMMUNITY_FAIL_CLOSED | PASS |
| CLUB_MANAGER_PIN_SUCCESS | PASS |
| REALTIME_REMAINS_ZERO | PASS |

## Persistence note (wired in ACT-05)

Domain Direct `pairKey` uses U+0000; Postgres rejects NUL (`22P05`). Persistence boundary encodes/decodes via U+001F in `rowMappers.js` (`encodeDirectPairKeyForDb` / `decodeDirectPairKeyFromDb`). In-memory domain keys unchanged.

## Mutations

| Item | Value |
|------|------:|
| Approx trusted commands this run | 6 |
| Auth users created | 0 |
| `club_members` / governance mutated | 0 |
| Realtime publications added | 0 |
| Production project touched | 0 |
| Secrets / PII printed | NO |

## Cleanup (same run)

| Marker scan | Before | After |
|-------------|-------:|------:|
| conversations | 1 | **0** |
| messages | 3 | **0** |
| idempotency | 3 | **0** |

**Cleanup zero:** YES (`COMMS_ACT_05_SMOKE_FIXTURE_` + `system:comms_act_05_smoke%` cleared).

## Capability states certified

- `DIRECT_TRUSTED_BACKEND`
- `SYSTEM_TRUSTED_PRODUCER`
- `CLUB_SELECT_CLIENT_RLS` (re-confirmed after trusted write)
- `CLUB_WRITE_ADMIN_TRUSTED_BACKEND`
- `COMMUNITY_BLOCKED_FAIL_CLOSED`
- `REALTIME_BLOCKED_FAIL_CLOSED`
- `PRODUCTION_UNTOUCHED`
