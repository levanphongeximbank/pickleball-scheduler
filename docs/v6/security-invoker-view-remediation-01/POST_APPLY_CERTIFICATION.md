# Staging Security Invoker View — Post-Apply Certification

Date: 2026-08-04 (Asia/Saigon)

Environment: **Staging only** (`qyewbxjsiiyufanzcjcq`)
Production access/apply: **0**

## Certification status

**PASS WITH EMPTY-FIXTURE LIMITATION**

The database remediation is installed and its structural/security-advisor checks pass. Owner A and Owner B completed real authenticated JWT read-only probes. Bidirectional isolation on `public.tenants` passes. `public.club_data_v3_safe` exposed no foreign rows, but positive own-row visibility cannot be certified because the view currently has zero Staging rows.

## Proven apply state

| Check | Result | Evidence |
|---|---|---|
| Merged remediation baseline | PASS | PR #358 merge commit `a7c7a1d4a4f53c9c19edfde6a641c0ee159a9740` |
| Staging migration recorded | PASS | `20260804031702 / phase6_security_invoker_view_remediation_01` |
| `public.tenants` | PASS | `security_invoker=true` |
| `public.club_data_v3_safe` | PASS | `security_invoker=true` |
| Existing SELECT ACLs preserved | PASS | `anon`, `authenticated`, `service_role` retain SELECT on both views; underlying-table RLS now governs invoker reads |
| Target advisor findings | PASS | Both former `security_definer_view` findings are absent after apply; observed advisor total changed from 516 to 514 |
| Staging Owner fixtures | READY | `owner@staging.local` → `venue-staging-a`; `owner-b@staging.local` → `venue-staging-b`; both active `VENUE_OWNER` |
| Data mutation during certification | PASS | 0 rows mutated; read-only inspection only |

## Authenticated Tenant A/B matrix

| Actor | Expected own-tenant result | Expected foreign-tenant result | Status |
|---|---|---|---|
| Owner A (`venue-staging-a`) | `tenants`: exactly `venue-staging-a`; `club_data_v3_safe`: 0 rows | Tenant B visible: no | PASS for `tenants`; EMPTY_FIXTURE for `club_data_v3_safe` |
| Owner B (`venue-staging-b`) | `tenants`: exactly `venue-staging-b`; `club_data_v3_safe`: 0 rows | Tenant A visible: no | PASS for `tenants`; EMPTY_FIXTURE for `club_data_v3_safe` |

The read-only certification harness is `scripts/verify-phase6-security-invoker-views-staging.mjs`. It signs in using the public anon key plus real passwords, queries only the two remediated views, performs no writes, and does not use `service_role` to judge user authorization.

## Exact unblock command

To reproduce with credentials stored only in uncommitted `.env.local`, run:

```powershell
node scripts/verify-phase6-security-invoker-views-staging.mjs
```

Do not paste passwords into this evidence file or commit them. The harness completed with `PASS_WITH_EMPTY_FIXTURE` and zero data mutations. `club_data_v3_safe` positive own-row visibility remains unproven until a fixture exists.

## Decision

- Staging remediation structural status: **PASS**
- Authenticated bidirectional isolation on `public.tenants`: **PASS**
- `public.club_data_v3_safe`: **NO FOREIGN ROW VISIBLE; POSITIVE PATH LIMITED BY EMPTY FIXTURE**
- Rollback: **not run**
- Production GO: **NO CHANGE / NO-GO remains**
