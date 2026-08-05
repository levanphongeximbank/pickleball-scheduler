# Tournament Production Read-Only Query Log

**Date:** 2026-08-05  
**Owner authorization:** `GO_TOURNAMENT_PRODUCTION_READ_ONLY_QUERY_AUDIT=YES`  
**MCP server:** `supabase-production`  
**Project ref:** `expuvcohlcjzvrrauvud`  
**Read-only mode:** `true`  
**Features:** `database`  
**Authoritative Production query transport:** supabase-production MCP (`read_only=true`) — live SELECT via MCP `execute_sql` only  
**Local credential script:** `scripts/tournament-production-readonly-audit.mjs` — **not** used for live audit; `AUDIT_SCRIPT_COMMIT_ELIGIBILITY=NO_LOCAL_AUDIT_HELPER`  
**Queries executed:** 7  
**Production mutations:** 0  
**Status:** `COMPLETED_WITH_FINDINGS`

## Headline finding

All three Owner-reported tournament IDs are **absent** from Production `club_data_v3` (1 club blob exists with `tournaments_len=0`), `team_tournaments` (0 matches), and `public_catalog_tournaments` (0 published). ACCC club **does** have `tenant_id=venue-prod-main`. Missing-tenant UI errors therefore originate from **client localStorage runtime + loader/route wiring / default-tenant fallback**, not from a missing Production `clubs.tenant_id`.

## Query results

| ID | Status | Rows | Aggregate |
|----|--------|------|-----------|
| Q-001 | PASS_WITH_FINDINGS | 0 | Daily ID not in cloud blob |
| Q-002 | PASS_WITH_FINDINGS | 0 | Internal ID not in cloud blob |
| Q-003 | PASS_WITH_FINDINGS | 0 | Official ID not in cloud blob |
| Q-004 | PASS | 1 | ACCC → `tenant_id=venue-prod-main` |
| Q-005 | PASS_WITH_FINDINGS | 1 | Cloud tournament_object_count=0 |
| Q-006 | PASS | 1 | team_tournaments total=56; owner matches=0 |
| Q-007 | PASS | 1 | published_count=0; owner visible=0 |

## Exact SQL (SELECT-only)

### Q-001
```sql
SELECT CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AS utc_now, club_id, venue_id, synced_at
FROM public.club_data_v3
WHERE data->'tournaments' @> '[{"id":"tournament-1785921300822"}]'::jsonb
LIMIT 5;
```
Read-only proof: single SELECT; MCP `read_only=true`. Mutations=0.

### Q-002
```sql
SELECT CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AS utc_now, club_id, venue_id, synced_at
FROM public.club_data_v3
WHERE data->'tournaments' @> '[{"id":"tournament-1785921409840"}]'::jsonb
LIMIT 5;
```
Mutations=0.

### Q-003
```sql
SELECT CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AS utc_now, club_id, venue_id, synced_at
FROM public.club_data_v3
WHERE data->'tournaments' @> '[{"id":"tournament-1785921550968"}]'::jsonb
LIMIT 5;
```
Mutations=0.

### Q-004
```sql
SELECT CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AS utc_now, id, left(name, 32) AS name_prefix, tenant_id, status
FROM public.clubs
WHERE name ILIKE '%ACCC%'
LIMIT 10;
```
Result: `club-219e4a7cbd73437eb6271f02a53314c3`, tenant `venue-prod-main`. PII: name truncated. Mutations=0.

### Q-005
```sql
SELECT CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AS utc_now,
  count(*)::int AS tournament_object_count,
  count(*) FILTER (WHERE COALESCE(t.value->>'tenantId','') = '')::int AS missing_tenant_id,
  count(*) FILTER (WHERE lower(COALESCE(t.value->>'tenantId','')) IN ('default-tenant','default'))::int AS default_tenant_stamp,
  count(*) FILTER (WHERE COALESCE(t.value->>'clubId','') = '')::int AS missing_club_id
FROM public.club_data_v3 c
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.data->'tournaments','[]'::jsonb)) AS t(value);
```
Result: all counts 0 (empty tournaments arrays). Mutations=0.

### Q-006
```sql
SELECT CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AS utc_now,
  count(*)::int AS team_tournament_total_rows,
  count(*) FILTER (WHERE id::text IN (
    'tournament-1785921300822','tournament-1785921409840','tournament-1785921550968'
  ))::int AS owner_id_matches
FROM public.team_tournaments;
```
Result: total=56, owner matches=0. Mutations=0.

### Q-007
```sql
SELECT CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AS utc_now,
  count(*)::int AS published_count,
  count(*) FILTER (WHERE id IN (
    'tournament-1785921300822','tournament-1785921409840','tournament-1785921550968'
  ))::int AS owner_ids_visible
FROM public.public_catalog_tournaments
WHERE publication_state = 'published';
```
Result: published=0, owner visible=0. Mutations=0. (Projection table SELECT — not mutation RPC.)

## Owner ID reconciliation

| Tournament ID | Cloud blob | team_tournaments | public catalog | Match live |
|---------------|------------|------------------|----------------|------------|
| tournament-1785921300822 | NO | NO | NO | 0 |
| tournament-1785921409840 | NO | NO | NO | 0 |
| tournament-1785921550968 | NO | NO | NO | 0 |

Machine log: `TOURNAMENT_PRODUCTION_READ_ONLY_QUERY_LOG.json`
