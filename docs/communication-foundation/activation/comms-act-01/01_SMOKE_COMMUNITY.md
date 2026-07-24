# COMMS-ACT-01 — Community Smoke Checklist

**Data:** Staging tenants `venue-staging` / `venue-staging-a|b` + test identities.  
**COMMS-ACT-01:** checklist only — no remote seed/apply in this workstream.

## Cases

- [ ] LOBBY uniqueness per tenant
- [ ] JOIN_REQUIRED visibility behavior
- [ ] READ_ONLY channel send denied
- [ ] Ban / suspension enforced
- [ ] Slow mode interval honored (application layer)
- [ ] Moderation permission path
- [ ] Wrong-tenant denial
- [ ] Missing membership/access evidence → deny

## Pass criteria

Community client RLS remains **BLOCKED_FAIL_CLOSED**. Trusted backend only after application authorization. No invented membership SoT.
