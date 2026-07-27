# PROD-SEC-G3-B12-01 — `club_ai_data` Anonymous Write Lockdown

**Status:** AUTHORED_NOT_APPLIED (Production / Staging)  
**Canonical cloud club SoT:** `public.club_data_v3`  
**Marker (PR ready):** `PROD_SEC_G3_B12_01_PR_READY_FOR_OWNER_MERGE`

## Vulnerability (Production forensic)

| Surface | Finding |
|---------|---------|
| Table | `public.club_ai_data` (`club_id`, `data`, `synced_at`) |
| Policies | `club_ai_data_anon_insert` WITH CHECK `true`; `club_ai_data_anon_update` USING/WITH CHECK `true`; `club_ai_data_anon_select` USING `true` |
| Grants | `anon` / `authenticated` had INSERT/UPDATE/DELETE/SELECT |
| Client | Legacy `src/ai/cloudSync.js` still referenced `club_ai_data` (read fallback); SPA bundle retained path |
| Exploitability | **CRITICAL_CONFIRMED** — anonymous write via PostgREST + policies (no live write test performed) |

## Remediation package

| File | Purpose |
|------|---------|
| `10_CLUB_AI_DATA_ANON_WRITE_LOCKDOWN.sql` | Drop anon policies, FORCE RLS, revoke anon/authenticated, deny-all restrictive policy, keep `service_role` |
| `11_VERIFY.sql` | Read-only post-apply checks |
| `90_ROLLBACK.sql` | Leave locked by default; insecure restore commented |
| Client cutover | `cloudSync.js` — no REST to `club_ai_data`; `mergeLegacyClubAiToV3` → `LEGACY_TABLE_LOCKED` |

## What this does **not** change

- `public.club_data_v3` policies / grants
- Public Catalog RPCs (`public_catalog_*`)
- Clubs / Courts / tenant isolation paths on v3
- Production apply (Owner GO + separate apply plan)

## Apply order

1. Merge PR (Owner)
2. Staging apply + `11_VERIFY.sql` + smoke club sync / catalog
3. Production apply + verify (see `PRODUCTION_APPLY_PLAN.md`)
