# COMMS-ACT-05 — Remaining Blocked Capabilities

| Capability | State | Notes |
|------------|-------|-------|
| COMMUNITY | `COMMUNITY_BLOCKED_FAIL_CLOSED` | No membership SQL helper |
| REALTIME publication | `REALTIME_BLOCKED_FAIL_CLOSED` | Keep `0` rows |
| DIRECT Client RLS | Trusted-backend only | Not opened |
| SYSTEM Client RLS | Trusted-backend only | Hard default |
| Client writes | Denied | Grants remain revoked |
| Production messaging cutover | `PRODUCTION_UNTOUCHED` | Separate Owner GO later |
| Full Experience read APIs over HTTP | Partial | ACT-05 prioritizes write/smoke commands |
| Notification delivery | Deferred | Out of scope |

## Closed by ACT-05 (local wiring)

- Trusted backend host selection (`api/communication/*`)
- Direct / System / Club write authorization path
- Server-only secret boundary
- Idempotency ledger wiring
- Staging smoke readiness package (mutation gated)
