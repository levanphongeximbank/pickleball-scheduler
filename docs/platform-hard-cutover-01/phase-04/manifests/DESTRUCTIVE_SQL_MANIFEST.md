# Destructive SQL Manifest

| Order | File | Purpose | Executed in Phase 4? |
|------:|------|---------|----------------------|
| 0 | `sql/destructive/00_IDENTITY_PRESERVE_PRECHECK.sql` | Read-only Owner/Auth counts | No |
| 1 | `sql/destructive/01_PROTECTED_OBJECT_GUARDS.sql` | Fail-fast guards | No |
| 2 | `sql/destructive/10_ORDERED_WIPE.sql` | Exact wipe list Phase 3 §5 | No |
| 3 | `sql/destructive/20_DROP_CLUB_AI_DATA.sql` | DROP legacy table | No |
| 4 | `sql/destructive/30_POST_WIPE_VERIFY.sql` | Post verify | No |

**Never:** TRUNCATE all public; DELETE auth.users; DELETE protected profiles/venues/tenant_members; mutate roles/permissions/plans catalogs.
