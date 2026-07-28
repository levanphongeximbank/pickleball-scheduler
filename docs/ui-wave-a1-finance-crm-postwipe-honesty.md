# UI Wave A1 — Finance & CRM post-wipe honesty

**Branch:** `fix/ui-wave-a1-finance-crm-postwipe-honesty`  
**Baseline:** `origin/main` @ `324767e9`  
**Audit marker:** `PICK_VN_UI_UX_PRE_CUTOVER_AUDIT_01_COMPLETE`  
**Remediation marker:** `PICK_VN_UI_WAVE_A1_FINANCE_CRM_HONESTY_PR_READY_FOR_OWNER_MERGE`

## Problem

Under platform hard cutover, `/finance/*` and `/crm/*` still treated **localStorage** as SoT and fell back to **`demo-club`**, presenting local/mock create/send as durable success.

## Fix

| Domain | Hard cutover ON | Hard cutover OFF |
|--------|-----------------|------------------|
| Finance | Typed `UNAVAILABLE` (`FINANCE_AUTHORITY_UNAVAILABLE`); no LS read/write; no demo-club | Legacy local only with real `activeClubId`; demo banner; demo-club blocked |
| CRM | Typed `UNAVAILABLE` (`CRM_AUTHORITY_UNAVAILABLE`); no LS/mock success | Legacy local + explicit demo banner; demo-club blocked |

## Authority

- Matrix domains `finance` / `crm` updated forbidden fallbacks + verification test path.
- New asserts: `assertFinanceLocalStorageAuthorityAllowed`, `assertFinanceDemoClubFallbackAllowed`, `assertCrmLocalStorageAuthorityAllowed`, `assertCrmDemoClubFallbackAllowed`.

## UI states

- **loading:** not applicable (sync local path); retry control on UNAVAILABLE.
- **empty:** honest empty copy when legacy local has no rows.
- **unavailable:** Vietnamese guidance + matrix code.
- **missing club:** select-club guidance (no demo-club invent).
- **success:** only after local write when HC OFF; labeled as local/demo compatibility — never under HC.

## Out of scope

- Wiring durable `finance_*` / `crm_*` RPC to these routes.
- Feature flag toggles, DB/SQL, deploy, hard-cutover worktrees.

## Tests

`tests/platform-hard-cutover-01-pre-staging-finance-crm.test.js`  
Extended: `tests/platform-hard-cutover-01-pre-staging-authority.test.js`
