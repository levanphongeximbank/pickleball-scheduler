# Production cutover prerequisites

`OWNER_GO_MERGE=NO` for this Draft PR.

Later, separate Owner GOs are required for:

1. Live `tenant_members` read-only preflight (pass)
2. Identity RPC live verification (no client fallback)
3. Optional SQL GO to retire `user_tenant_id()` venue COALESCE (`DATABASE_USER_TENANT_VENUE_FALLBACK_RETIRE=NOT_YET`)
4. RLS verification of `platform_tenants` / identity RPCs
5. Production actor membership backfill if any operator lacks `tenant_members`
6. Mark Ready / merge — only after Owner GO

This Wave 4 PR implements application fail-closed behavior. It does **not** close PC-AUTH-01 / PC-ACCESS-01 live.
