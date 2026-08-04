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

## Pending runtime evidence

Authenticated Tenant A/B regression could not run from this worktree because
the Staging URL, anon key, and Owner A/B credential environment are not present.
The catalog and Advisor gates pass, but runtime certification remains pending.

The remaining 204 anon and 271 authenticated `SECURITY DEFINER` warnings are a
separate ACL workstream and are not misreported as closed here.

