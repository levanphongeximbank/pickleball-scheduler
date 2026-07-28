# M8 Text Tenant Hotfix (B-STG-02)

**Marker:** `PLATFORM_HARD_CUTOVER_01_M8_TEXT_TENANT_HOTFIX_PR_READY_FOR_OWNER_MERGE`

## Root cause

Phase 4 M8 package used `tenant_id uuid` / `p_tenant_id uuid`, but PICK_VN canonical tenant/venue identity is **text**:

- `public.venues.id` → `text`
- `public.user_venue_id()` → `RETURNS text`

Staging rehearsal RLS apply failed with `operator does not exist: uuid = text`.

## Fix (package only — no DB apply)

- All `competition_ssot_*`.`tenant_id` → `text` + non-blank CHECK
- All RPC `p_tenant_id` → `text` + trim fail-closed
- RLS: `text = user_venue_id()` with non-blank venue gate; **no casts**
- Rollback drops text + legacy uuid signatures
- Verify asserts no non-text `tenant_id`
- Adapter: `assertTextTenantId()` accepts venue-style text IDs

## Companion Owner procedures (no deploy/backup executed)

- `STAGING_BACKUP_OWNER_PROCEDURE.md` (B-STG-01)
- `STAGING_VERCEL_DASHBOARD_DEPLOY_PROCEDURE.md` (B-STG-03)
