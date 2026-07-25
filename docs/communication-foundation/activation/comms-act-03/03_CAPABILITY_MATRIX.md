# COMMS-ACT-03 — Explicit Capability Matrix

Code SoT: `getCommsAct03CapabilityMatrix()`.

| Capability | Verdict |
|------------|---------|
| DIRECT read/write | **TRUSTED_BACKEND_ONLY** |
| SYSTEM read/write | **TRUSTED_BACKEND_ONLY** |
| CLUB SELECT (Client RLS authored) | **CLIENT_RLS_READY** |
| CLUB create / send / mutate / admin | **TRUSTED_BACKEND_ONLY** |
| COMMUNITY (all client) | **BLOCKED_FAIL_CLOSED** |
| Reports / moderation client | **TRUSTED_BACKEND_ONLY** |
| Idempotency / RPCs client | **TRUSTED_BACKEND_ONLY** |
| Attachments storage RLS | **BLOCKED_FAIL_CLOSED** |
| Realtime publication | **BLOCKED_FAIL_CLOSED** |

## Next gate

**`CLIENT_RLS_READY_FOR_STAGING_APPLY`** — scope: **CLUB_SELECT_ONLY**.

Requires new Owner GO. Do not open remote activation in ACT-03 itself.

## Reminder

Authored SQL ≠ applied. Staging currently remains deny-all from ACT-02.
