# A-RATE FORBIDDEN remediation — Owner self-assessment RBAC

**Target only:** Staging `qyewbxjsiiyufanzcjcq`  
**Production forbidden:** `expuvcohlcjzvrrauvud`  
**Owner GO required before apply. Do not auto-apply.**

## Diagnosis

`rating_v5_start_assessment('doubles')` returns `FORBIDDEN` when:

```sql
not public.rating_v5_has_permission('rating_v5.assess_self')
```

Live grants for `rating_v5.assess_self`: `PLAYER`, `SUPER_ADMIN`, `SYSTEM_TECHNICIAN` only.

Operator actor is app `TENANT_OWNER` / DB `VENUE_OWNER` → normalize `COURT_OWNER`, so permission check fails.

Runner already calls the canonical Rating V5 writer (`rating_v5_start_assessment`).

## Chosen remediation

Staging-only RBAC grant (additive `INSERT ... ON CONFLICT DO NOTHING`):

- roles: `COURT_OWNER`, `VENUE_OWNER`
- permissions: `rating_v5.assess_self`, `rating_v5.view_own`

Does **not**:

- grant to every authenticated user
- elevate SUPER_ADMIN
- broaden calibration/admin rating permissions
- change RPC function bodies

## After apply note

If A-RATE still fails, next gates observed empty on Staging are likely `ROLLOUT_BLOCKED` / `PILOT_NOT_ENROLLED` (no default rollout config / enrollments). Those are separate from this FORBIDDEN fix.
