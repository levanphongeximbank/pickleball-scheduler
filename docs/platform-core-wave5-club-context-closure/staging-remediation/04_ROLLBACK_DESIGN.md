# Wave 5 Club TRUNCATE remediation — rollback design

**Do not execute this file as SQL. Rollback is not authorized in this GO.**

```
AUTO_REGRANT_TRUNCATE_ON_VERIFY_FAILURE=NO
```

## Technical reversal (not preferred)

The exact inverse of `02_APPLY_CLUB_TRUNCATE.sql` would be:

```sql
GRANT TRUNCATE ON TABLE
  public.clubs,
  public.club_members,
  public.club_governance_assignments,
  public.club_membership_requests_v42
TO anon, authenticated;
```

That would re-open a confirmed destructive path (`TRUNCATE` is not protected by RLS). It is **not** the preferred rollback.

## Preferred failure handling

| Failure | Action |
|---|---|
| `REVOKE` fails inside the transaction | No partial commit. Database remains at pre-APPLY TRUNCATE PRESENT. |
| `03_VERIFY` fails after a committed `REVOKE` | Keep the safer DENY state. Investigate. Do **not** automatically re-grant TRUNCATE. |

Do not alter `service_role`, RLS, policies, default ACLs, or data as a rollback of this package.
