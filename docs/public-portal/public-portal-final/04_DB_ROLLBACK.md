# Database Rollback Procedure (Production)

**SQL artifact:** `docs/public-portal/public-portal-final/sql/90_PUBLIC_PORTAL_FINAL_PRODUCTION_DB_ROLLBACK.sql`  
**Also aligned with:** `docs/public-catalog/pc-01/11_PUBLIC_CATALOG_01_STAGING_ROLLBACK.sql`

## Safety rules

- Revoke EXECUTE then drop exact RPC signatures created by the package.  
- Drop projection table `public.public_catalog_courts` only (package-created).  
- Do **not** drop base `public.clubs` / venue business tables.  
- Do **not** delete club/court business rows.  
- Opt-in columns added by the package may be dropped only if unused (no publication payload required).

## When to run

- Security/privacy verification FAIL before portal cutover.  
- Or DB state unsafe after a failed Phase B attempt.

## Post-rollback checks

- `public_catalog_list_clubs` / `public_catalog_list_courts` absent.  
- `public_catalog_courts` absent.  
- Base clubs row counts unchanged.
