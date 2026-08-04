# Club Data V3 Anon Policy Remediation — Post-Apply Certification

Date: 2026-08-04 (Asia/Saigon)

Environment: **Staging only** (`qyewbxjsiiyufanzcjcq`)

## Verdict

**PASS**

Migration `20260804041304 / phase6_club_data_v3_anon_policy_remediation_02` applied successfully after explicit Owner GO.

## Structural verification

- `public.club_data_v3` RLS remains enabled.
- The three legacy anon policies are absent:
  - `club_data_v3_anon_select`
  - `club_data_v3_anon_insert`
  - `club_data_v3_anon_update`
- Four authenticated policies remain unchanged (`SELECT`, `INSERT`, `UPDATE`, `DELETE`).
- Schema, table ACLs, view definitions, and business data were not changed by the migration.

## Runtime fixture QA

| Probe | Expected | Observed | Result |
|---|---|---|---|
| Owner A reads `tenants` | only Tenant A | only `venue-staging-a` | PASS |
| Owner A reads `club_data_v3_safe` | only fixture A | exactly fixture A | PASS |
| Owner B reads `tenants` | only Tenant B | only `venue-staging-b` | PASS |
| Owner B reads `club_data_v3_safe` | only fixture B | exactly fixture B | PASS |
| anon reads `club_data_v3_safe` | 0 fixture rows | 0 | PASS |
| anon inserts `club_data_v3` | denied | RLS violation | PASS |
| anon updates fixture A | 0 affected rows | 0 | PASS |

Both Owner probes used real authenticated Supabase JWTs. Fixture payloads were non-sensitive and contained only QA markers.

## Cleanup and accounting

- Temporary rows inserted for setup: 4 (2 governance + 2 club data).
- Successful anon write rows: 0.
- Temporary rows deleted during cleanup: 4.
- Remaining fixture rows: 0 club data, 0 governance.
- Rollback: not run.
- Production access and mutations: 0.

## Decision

The Security Invoker view remediation plus the anon-policy remediation is certified on Staging for the tested Tenant A/B and anon matrix. This does not authorize a Production apply or deployment.
