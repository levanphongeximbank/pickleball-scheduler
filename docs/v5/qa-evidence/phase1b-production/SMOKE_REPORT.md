# Phase 1B — Production Smoke Report

**Verdict:** PASS
**Totals:** 29 pass / 0 fail
**Production:** `expuvcohlcjzvrrauvud`
**Code SHA:** `959c8067ea756aa32e50b549a97cd4e762786ff7`
**Club:** `club-219e4a7cbd73437eb6271f02a53314c3`

## Authorization matrix (club_update)
- PASS UPDATE_Owner: expected ALLOW, actual ALLOW
- PASS UPDATE_President: expected ALLOW, actual ALLOW
- PASS UPDATE_Tenant admin: expected ALLOW, actual ALLOW
- PASS UPDATE_Ordinary tenant: expected DENY, actual DENY
- PASS UPDATE_Player: expected DENY, actual DENY
- PASS UPDATE_Unrelated: expected DENY, actual DENY
- PASS UPDATE_restore_name: expected ALLOW, actual ALLOW
- PASS UPDATE_stale_version: expected VERSION_CONFLICT, actual VERSION_CONFLICT

## Audit
- PASS audit_club.update
- PASS audit_club.assign_vice_president
- PASS audit_club.clear_vice_president
- PASS audit_club.member.add
- PASS audit_club.member.remove
- PASS audit_club.member.restore
