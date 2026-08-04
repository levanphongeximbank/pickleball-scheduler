# Staging Advisor WARN remediation 01 — post-apply certification

**Migration:** `20260804074144 / phase6_staging_advisor_warn_remediation_01`  
**Owner checkpoint:** received 2026-08-04  
**Production mutation:** `0`  
**Production GO:** `NO`

## Verified

- Migration application succeeded atomically.
- All 22 exact target overloads have `search_path=pg_catalog, public`.
- All three target policies have explicit `USING (false)` and `WITH CHECK (false)`.
- Supabase Security Advisor remains at 0 ERROR.
- `function_search_path_mutable` decreased from 22 to 0.
- `rls_policy_always_true` decreased from 3 to 0.

## Runtime regression

Authenticated JWT read-only QA passed for Owner A and Owner B. Each actor saw
only their own tenant and never the foreign tenant. `club_data_v3_safe` had no
fixture rows for either actor, so that view is recorded as
`PASS_WITH_EMPTY_FIXTURE`; there was no foreign visibility and no data mutation.

The remaining 204 anon and 271 authenticated `SECURITY DEFINER` warnings are a
separate ACL workstream and are not misreported as closed here.
