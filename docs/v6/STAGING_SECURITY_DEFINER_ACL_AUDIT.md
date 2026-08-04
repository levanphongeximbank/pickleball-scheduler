# Phase 6 — Staging SECURITY DEFINER ACL audit

**Observed:** 2026-08-04  
**Target:** Supabase Staging  
**Mode:** read-only catalog and repository audit  
**Disposition:** `OPEN_HIGH_REQUIRES_OWNER_APPROVED_REMEDIATION_OR_ACCEPTANCE`

## Result

All 298 `SECURITY DEFINER` functions in `public` are owned by `postgres`.

| Exposure | Count |
|---|---:|
| Callable by `anon` | 204 |
| Callable by `authenticated` | 271 |
| ACL entry for pseudo-role `PUBLIC` | 151 |
| Repository-explicit anonymous public contract present on Staging | 7 |
| Anonymous callable without a matched explicit public contract | 197 |

The `postgres` default function ACL in schema `public` grants `EXECUTE` to
`anon`, `authenticated`, and `service_role`. This explains why newly created
functions can become API-callable unless each migration explicitly revokes and
regrants privileges.

## Confirmed anonymous contracts

The repository explicitly grants anonymous execution and the exact overload is
present on Staging for:

1. `news_public_content_query_public(timestamptz,text,text,integer)`
2. `public_catalog_list_clubs(integer,integer,text)`
3. `public_catalog_list_courts(integer,integer,text,text)`
4. `public_catalog_list_rankings(integer,integer,text,text)`
5. `public_catalog_list_tournaments(integer,integer,text)`
6. `referee_get_match_by_token(text)`
7. `referee_update_match_score(text,jsonb)`

The repository also contains an anonymous grant for
`vpr_list_public_leaderboard(...)`, but that function is not present on the
current Staging catalog and therefore is not part of the live allowlist.

## Safety disposition

A blanket revoke was **not** applied. It could break public catalog, public news,
or token-scoped referee operation. Conversely, accepting all 204 functions as
intentional is not supported by repository evidence.

Before Production GO, Owner/security must choose one of:

- approve a reviewed exact-overload allowlist and revoke all other anonymous and
  pseudo-`PUBLIC` execution privileges; or
- explicitly accept this as a time-bounded HIGH observation with compensating
  controls and an owner/date for closure.

Authenticated execution is not automatically a defect because the application
uses many guarded RPCs. It remains subject to authenticated Tenant A/B and role
negative QA; it is not silently classified safe by count alone.

Reference: [Supabase database linter — anon SECURITY DEFINER executable](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)

