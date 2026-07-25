# COMMS-ACT-03 — Policy Matrix

Code SoT: `getCommsAct03PolicyMatrix()` in `src/features/communication/authorization/policyMatrix.js`.

## Legend

| Cell | Meaning |
|------|---------|
| ALLOW | Browser JWT Client RLS SELECT (after ACT-03 apply) |
| DENY | Client denied |
| TRUSTED_BACKEND | Service-role / trusted backend only |

## Summary (clients)

| Resource | Active Club member | Inactive member | Unrelated auth | Community member | Anon | Trusted backend |
|----------|-------------------|-----------------|----------------|------------------|------|-----------------|
| Club conversation SELECT | ALLOW | DENY | DENY | DENY | DENY | ALLOW |
| Club conversation mutate | BACKEND | DENY | DENY | DENY | DENY | ALLOW |
| Direct conversation | BACKEND (participant) / DENY | DENY | DENY | DENY | DENY | ALLOW |
| Community conversation | DENY | DENY | DENY | DENY | DENY | ALLOW |
| Participant forge INSERT | DENY | DENY | DENY | DENY | DENY | ALLOW |
| Message send / spoof | BACKEND | DENY | DENY | DENY | DENY | ALLOW |
| Own Club read cursor SELECT | ALLOW | DENY | DENY | DENY | DENY | ALLOW |
| Other user read cursor | DENY | DENY | DENY | DENY | DENY | ALLOW |
| Club pin SELECT | ALLOW | DENY | DENY | DENY | DENY | ALLOW |
| Pin / report / moderation mutate | BACKEND / DENY | DENY | DENY | DENY | DENY | ALLOW |
| Idempotency / RPC execute | DENY | DENY | DENY | DENY | DENY | ALLOW |

## Fail-closed rules

1. Missing `auth.uid()` → DENY
2. Missing `phase42_active_club_member_id` → ACT-03 apply refuses
3. Inactive Club membership → DENY Club SELECT
4. Cross-club / cross-community / cross-tenant → DENY
5. Community helper absent → deny-all
6. Unclear identity → typed authorization error / UNAVAILABLE gateway
