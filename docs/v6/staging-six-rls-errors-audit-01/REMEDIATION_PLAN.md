# Six RLS ERROR Remediation Plan

Status: **APPLIED TO STAGING — VERIFIED**

## Recommended first remediation

Use a single Staging-only fail-closed migration:

1. Preflight that all six tables exist, are regular tables, have RLS disabled, contain zero rows, and still have no policies.
2. Enable RLS on exactly the six tables.
3. Revoke INSERT/UPDATE/DELETE from `anon` on exactly the six tables as defense in depth.
4. Do not create permissive policies in the first migration.
5. Preserve authenticated ACLs temporarily, but RLS with no policies makes direct authenticated access fail closed.

This closes the current exposure without inventing authorization rules for unused/future tables.

## Rollback design

Rollback must require separate Owner GO and should:

1. verify no policies were added after forward apply;
2. disable RLS on exactly the six tables;
3. restore only the anon DML grants removed by the forward migration;
4. make no data changes.

Rollback restores the insecure pre-state and is for emergency compatibility only.

## Verification requirements

- Metadata: all six `relrowsecurity=true` and policy count remains zero.
- Advisor: all six `rls_disabled_in_public` ERRORs disappear.
- anon: SELECT returns zero and INSERT/UPDATE/DELETE are denied or affect zero rows.
- authenticated Owner A/B: direct reads return zero because no policy exists.
- service role / migration owner: schema verification remains possible.
- Repository regression: Referee and Rating test suites pass.
- Cleanup: zero fixtures; preferred verification requires no fixtures because preflight confirms tables are empty.

## Later activation policy design

Do not combine activation policies with this security closure.

- Referee tables: future authenticated policies must scope `tenant_id` and assignment/match authorization, preferably through reviewed helper functions with explicit EXECUTE grants.
- Rating child tables: future policies must join `player_ratings` and authorize by its tenant/user relationship. Do not add a blanket `TO authenticated USING (true)` policy.
- Anon direct writes should remain permanently denied unless a separately reviewed public workflow proves a requirement.

## Owner gate

The Owner approved and the fail-closed migration was applied to Staging as `20260804054802 phase6_six_rls_errors_fail_closed_remediation_03`. Production remains out of scope. Rollback still requires a separate explicit Owner GO.
