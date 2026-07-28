# Protected Object Manifest

| Object | Preserve method | Pre | Post | Fail |
|--------|-----------------|-----|------|------|
| auth.users | never DELETE/TRUNCATE | count | count equal | abort |
| profiles | never wipe Auth-linked | count/roles | equal | abort |
| venues | never DELETE | count>=1 | equal | abort |
| tenant_members | never DELETE Owner rows | count | equal | abort |
| roles/permissions/role_permissions | never wipe catalog | counts | equal | abort |
| plans/plan_limits | never wipe catalog | counts | equal | abort |
| club_data_v3 DDL/policies | keep | policy list | same | abort |
| public_catalog_list_* | keep | 4 RPCs | 4 | abort |
| Rating V5 DDL | keep | tables exist | exist | abort |
| Vercel/domain/env/secrets | external | Owner checklist | intact | stop |

Guards: `sql/destructive/01_PROTECTED_OBJECT_GUARDS.sql` + in-wipe snapshot compare.
