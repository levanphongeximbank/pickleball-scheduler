# COMMS-ACT-05 — Trusted Backend Architecture

**Status:** Authored in repository — Staging smoke **not** executed until Owner GO.  
**Production:** Untouched (`expuvcohlcjzvrrauvud` blocked).

## Capability state (explicit)

| Capability | State |
|------------|-------|
| DIRECT | `DIRECT_TRUSTED_BACKEND` |
| SYSTEM | `SYSTEM_TRUSTED_PRODUCER` |
| CLUB SELECT | `CLUB_SELECT_CLIENT_RLS` (ACT-04 certified) |
| CLUB write/admin | `CLUB_WRITE_ADMIN_TRUSTED_BACKEND` |
| COMMUNITY | `COMMUNITY_BLOCKED_FAIL_CLOSED` |
| Realtime | `REALTIME_BLOCKED_FAIL_CLOSED` |
| Production | `PRODUCTION_UNTOUCHED` |

## Execution path

```
Browser (user JWT only)
  → POST /api/communication/command
  → authorizeCommunicationActor (service-role auth.getUser)
  → resolve actor/tenant from profiles SoT
  → createTrustedCommunicationBackend(injected service client)
  → Direct / Club application services + Supabase repos
  → typed JSON result (no secrets)
```

System path:

```
Internal producer (COMMS_SYSTEM_PRODUCER_KEY)
  → POST /api/communication/system-produce
  → createSystemMessageProducer
  → SYSTEM conversation + message persist
```

## Security boundary (10 rules)

1. Authenticated caller from canonical Bearer JWT (or producer key for SYSTEM).
2. Never trust browser-claimed `userId` / `tenantId` / `clubId` / role for authority.
3. Identity + tenant from server `profiles`; Club membership from `club_members` (+ governance facts).
4. Authorization before persistence (application + policy adapters).
5. Privileged credential only in Vercel serverless runtime.
6. Never return service client / secrets to browser.
7. Audit-safe typed results (`ok` / `code` / no secret fields).
8. Idempotency via `communication_idempotency` + optional message key.
9. Fail-closed on unclear identity / membership / dependency.
10. No silent DEMO fallback when production path fails.

## Composition

- `createTrustedCommunicationBackend` — server composition root (injected client).
- `createTrustedBackendHttpMessagingGateway` — browser HTTP adapter (no secrets).
- `createSupabaseClubMembershipReader` — Club SoT read adapter.
- `createClubManagerAccessPolicy` — owner/manager elevation only via `externalRoleFacts`.
