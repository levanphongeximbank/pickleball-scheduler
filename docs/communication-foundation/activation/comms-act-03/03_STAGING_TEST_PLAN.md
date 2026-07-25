# COMMS-ACT-03 — Staging Test Plan (post-apply; Owner GO required)

**Do not execute against remote until Owner GO.** This plan is readiness-only.

## Positive

1. Active Club member SELECT own club CLUB conversations → rows returned
2. Club manager/owner with active membership SELECT → allowed
3. Active Club member SELECT messages/participants/pins for that club → allowed
4. Active Club member SELECT own read cursor for Club conversation → allowed

## Negative

1. Anon → deny all communication_* 
2. Authenticated unrelated user → no Club rows
3. Inactive/left/removed Club member → deny Club SELECT
4. Same-tenant but not club member → deny
5. Cross-club user → deny other club rows
6. Community member → deny Community client access (still deny-all)
7. Participant forgery INSERT → deny (no INSERT grant)
8. Sender spoof UPDATE → trigger deny / no UPDATE grant
9. Conversation ownership mutation → trigger deny
10. Read other user's cursor → deny
11. Report/moderation client write → deny
12. RPC execute as authenticated → deny
13. Realtime publication count remains 0

## Trusted backend

Service-role path continues to read/write all tables after application authorization.

## Rollback verification

Apply rollback → deny-all restored; data intact.
