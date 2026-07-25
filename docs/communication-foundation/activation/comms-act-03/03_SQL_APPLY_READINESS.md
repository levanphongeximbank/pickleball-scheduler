# COMMS-ACT-03 — SQL Apply Readiness

**Authored SQL does NOT mean applied.**

| Package | Path |
|---------|------|
| Forward | `docs/supabase-communication-comms-act-03-authorization-client-rls.sql` |
| Rollback | `docs/supabase-communication-comms-act-03-authorization-client-rls-rollback.sql` |

## Prerequisites

1. COMMS-ACT-02 Staging deny-all schema present (14 tables)
2. `public.phase42_active_club_member_id(text)` present
3. Staging backup / PITR evidence
4. **New Owner GO** for ACT-03 Staging apply (not granted by this workstream)

## What apply would change (Staging only, after GO)

- Add Communication auth helpers + immutable triggers
- Add Club SELECT policies
- Grant narrow `SELECT` to `authenticated` on 6 tables
- Keep RPCs revoked from clients
- Keep Direct/System/Community deny-all for practical access (no open policies; no write grants)
- **Not** enable realtime

## What apply must NOT do

- Production
- Realtime publication
- Community Client RLS open
- Direct Client RLS open
- Broad table grants / write grants

## Current remote state (unchanged by ACT-03)

Staging `qyewbxjsiiyufanzcjcq`: COMMS-05 deny-all (ACT-02).  
Production: untouched.  
Realtime publication for `communication_*`: **0**.

## Gate verdict

`CLIENT_RLS_READY_FOR_STAGING_APPLY` (Club SELECT only) — awaiting Owner GO.
