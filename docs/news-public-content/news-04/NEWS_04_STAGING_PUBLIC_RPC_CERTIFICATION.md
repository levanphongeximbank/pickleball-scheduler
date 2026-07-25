# NEWS-04 — Staging Public RPC LIVE-only Certification

## Verdict

`NEWS_04_STAGING_LIVE_ONLY_ALREADY_APPLIED_CERTIFIED`

Owner GO phrase used: `NEWS_04_OWNER_GO_STAGING_PUBLIC_RPC_LIVE_ONLY`

## Staging target

| Field | Value |
|-------|-------|
| Project ref | `qyewbxjsiiyufanzcjcq` |
| Metadata status | `ACTIVE_HEALTHY` |
| Production ref blocked | `expuvcohlcjzvrrauvud` |
| Production touched | **No** |

## Remediation commit / SQL

| Field | Value |
|-------|-------|
| Remediation commit (SQL authored) | `5496c74a` |
| Harness / certify branch HEAD (at certify) | `9c75642e` |
| SQL path | `docs/news-public-content/news-04/10_NEWS_PHASE_04_PUBLIC_RPC_LIVE_ONLY.sql` |
| SQL SHA-256 (LF-canonical via harness) | `b357823a0925a8cd42b972be2c0331afb62128bd0feb73c9a7861d7ae01ae08f` |
| Verify path | `docs/news-public-content/news-04/99_NEWS_PHASE_04_PUBLIC_BOUNDARY_VERIFICATION.sql` |

## Pre-state

- NEWS-03 database: **FULLY_APPLIED_VERIFIED** (7 tables, 6 `news.*` permissions, RLS forced, 0 `USING(true)` policies)
- `news_public_content_query_public` body: **MOCK_EXCLUDE_ONLY** (`provenance <> 'MOCK'`, defect equivalent = true)
- Public window index present (pre-remediation predicate)

## Apply state

1. Controlled apply executed with Owner GO against Staging Management API.
2. Single file applied: `10_NEWS_PHASE_04_PUBLIC_RPC_LIVE_ONLY.sql`
3. Stop-on-first-error; **no auto-rollback**
4. Subsequent certify run classified Staging as **ALREADY_APPLIED_VERIFIED** (LIVE-only body present)

## Post-state

| Check | Result |
|-------|--------|
| RPC body `provenance = 'LIVE'` | PASS |
| No `provenance <> 'MOCK'` residual as sole filter | PASS |
| Non-LIVE leak count via RPC | **0** |
| Public window index LIVE-only | PASS (1 index) |
| RLS still forced | PASS |
| `USING(true)` policies | **0** |
| Grants broadened | No (anon/authenticated/service_role EXECUTE retained only) |
| Base-table RLS changed | No |

## Live matrix (anon RPC + adapter + portal)

| Case | Expected | Actual | Result |
|------|----------|--------|--------|
| LIVE + PUBLISHED + PUBLIC + active | visible | visible | PASS |
| PREVIEW + PUBLISHED + PUBLIC + active | not_visible | not_visible | PASS |
| MOCK + PUBLISHED (schema CHECK) | not insertable / not visible | constraint_or_skipped | PASS |
| LIVE + DRAFT | not_visible | not_visible | PASS |
| LIVE + UNPUBLISHED | not_visible | not_visible | PASS |
| LIVE + ARCHIVED | not_visible | not_visible | PASS |
| LIVE + expired window | not_visible | not_visible | PASS |
| LIVE + future publishAt | not_visible | not_visible | PASS |
| Adapter simulated PREVIEW RPC row | PROVENANCE_MISMATCH | PROVENANCE_MISMATCH | PASS |
| Portal live failure | typed error, no MOCK fallback | typed_error | PASS |
| Facade live query | LIVE fixture only | `NEWS04_TEST_live_ok` | PASS |

## Fixture cleanup

- Prefix: `NEWS04_TEST_*`
- Residue items/revisions: **0**
- Canonical `news.*` permissions untouched
- News schema not dropped
- RPC not rolled back; still LIVE-only after cleanup

## Public Portal path

`getPublicNews` → News facade → `createSupabaseContentRepository({ preferRpc: true })` → `news_public_content_query_public`

- Client PREVIEW skip remains **defense in depth**
- No silent mock fallback on live failure

## Evidence

Runtime (gitignored, redacted): `docs/news-public-content/news-04/evidence/NEWS_04_STAGING_CERTIFICATION.json`

## Explicit exclusions

- Production not applied / not touched
- NEWS-02/03 full packages not re-applied
- No automatic rollback
- No package/lockfile changes
- No PR merge in this step
