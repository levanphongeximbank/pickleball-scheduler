# Phase 6 — Staging Advisor WARN remediation 01

Status: **AUTHORED ONLY — NOT APPLIED**

This package addresses the actionable subset of the 501 Supabase Security Advisor
warnings observed on Staging on 2026-08-04. Staging currently reports **0 ERROR**.

## Scope

- Harden the fixed `search_path` of the 22 functions reported by
  `function_search_path_mutable`.
- Replace three broad RLS policies with fail-closed expressions:
  - `club_membership_requests_update`
  - `court_claim_requests_update`
  - `rating_v5_review_no_client_write`
- Fail closed for direct authenticated writes to the two request tables. The
  application uses guarded RPCs for these mutations; no direct table write was
  found under `src/`.
- Make the rating client-write denial explicit with both `USING (false)` and
  `WITH CHECK (false)`.

## Deliberately deferred warnings

- 204 anon-executable and 271 authenticated-executable `SECURITY DEFINER`
  overloads require an RPC-by-RPC public/authenticated contract allowlist. A
  blanket revoke can break public catalog and token-scoped referee flows.
- 11 `rls_enabled_no_policy` items are fail-closed by PostgreSQL RLS and are INFO.
- leaked-password protection is a dashboard Auth setting and must be enabled by
  an Owner; it is not a SQL migration.
- Performance Advisor warnings are observations, not Phase 6 security blockers.

## Execution gate

Do not run `01_APPLY.sql` without the exact checkpoint:

`OWNER GO — APPLY STAGING ADVISOR WARN REMEDIATION 01`

Then run `02_VERIFY.sql`. Use `03_ROLLBACK.sql` only if verification or
authenticated Tenant A/B regression QA fails.
