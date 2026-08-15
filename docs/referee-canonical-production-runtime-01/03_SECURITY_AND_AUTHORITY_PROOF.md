# Security and authority proof

Canonical identity: `auth.uid()` / `actor.actorId`. Fuzzy name/email/phone is discovery-only and cannot authorize writes.

## Live Staging (read-only)

- Anon cannot execute internal commit RPCs
- Authenticated cannot write canonical tables (`*_no_client_write`)
- Authenticated SELECT of live/events is assignment-scoped
- Service role is the intended commit path
- `match_events` UPDATE/DELETE raise `APPEND_ONLY_VIOLATION`
- Team-specific `referee_v5_assert_assignment_write` is **not** used by generic CE runtime (would require Team bridge)

## Runtime

- Missing actorId → fail-closed
- authUid / refereeId mismatch → fail-closed
- Cross-tenant command without assignment in that tenant → fail-closed
- Non-assigned referee → fail-closed
- Assigned referee command → allowed
- Generic E2E-04 permission map does not require `TEAM_MATCH_RESULT_MANAGE`

Do not weaken RLS. Do not introduce frontend-only authorization.
