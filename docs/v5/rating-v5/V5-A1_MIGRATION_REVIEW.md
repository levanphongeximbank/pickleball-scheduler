# V5-A.1 — Migration SQL Review

**File:** `PHASE_V5A_RATING_FOUNDATION.sql` | **Date:** 2026-07-12 | **Status:** NOT APPLIED

## Verdict: **PASS** (with 3 owner notes)

---

## Checklist

| Item | Status | Notes |
|------|--------|-------|
| Table ownership | ✅ | All `public.*`; REVOKE anon |
| Tenant FK | ⚠️ | `tenant_id text` + `rating_v5_resolve_tenant_id()` — no FK table (matches club/venue pattern) |
| Player FK | ✅ | `references profiles(id) on delete restrict` |
| Unique constraint | ✅ | `(tenant_id, player_id, rating_mode)` |
| Rating 1.5–6.0 check | ✅ | `rating_v5_rating_in_range()` on all mean/display fields |
| Reliability 0–100 | ✅ | `check (reliability_score between 0 and 100)` |
| Deviation non-negative | ✅ | `rating_v5_deviation_non_negative()` |
| Rating mode enum | ✅ | `check (rating_mode in ('singles','doubles'))` |
| Status enum | ✅ | 13 V5 statuses in check constraint |
| Profile indexes | ✅ | player, tenant+status, leaderboard, shadow |
| Event history indexes | ✅ | player+time, tenant+time, source, idempotent unique |
| Cascade behavior | ✅ | `on delete restrict` — history preserved when player exists |
| History on player delete | ✅ | RESTRICT prevents orphan cascade delete |
| Timestamps | ✅ | `timestamptz` + `now()` |
| Idempotency | ✅ | `rating_v5_idempotency` + event unique index |
| Rollback strategy | ✅ | Documented at file end |
| SECURITY DEFINER search_path | ✅ | All functions use `public, pg_temp` |
| No dynamic SQL | ✅ | Static PL/pgSQL only |
| Server tenant resolution | ✅ | `rating_v5_resolve_tenant_id()` from profile |
| Shadow flag | ✅ | `is_shadow`, `rollout_cohort`, `rating_v5_rollout_config` |
| Singles incomplete | ✅ | `singles_assessment_status` + RPC blocks singles start |
| Append-only events | ✅ | Trigger denies UPDATE/DELETE |
| Public view | ✅ | `player_rating_profiles_public_v5` security_invoker |
| Role permissions seed | ✅ | PLAYER, CLUB, TOURNAMENT, SUPER_ADMIN |

## Owner notes (non-blocking)

1. **tenant_id** — text not UUID FK; align with venue_id on profiles during staging apply QA.
2. **rating_v5_complete_assessment** — stub deferred to V5-B server scoring wiring (intentional).
3. **Evidence reviewer update** — only via future `rating_v5_review_evidence` RPC (no direct UPDATE policy).

## Functions audited

| Function | search_path | Trusts client? |
|----------|-------------|----------------|
| `rating_v5_resolve_tenant_id` | ✅ | No — reads profile |
| `rating_v5_has_permission` | ✅ | No |
| `rating_v5_same_tenant` | ✅ | No |
| `rating_v5_submit_answer` | ✅ | Only answer index; validates draft ownership |
| `rating_v5_start_assessment` | ✅ | Mode only; rejects singles |
| `rating_v5_get_profile` | ✅ | Self + server tenant |
| `rating_v5_service_upsert_profile` | ✅ | service_role or override permission |
| `rating_v5_deny_event_mutation` | ✅ | N/A |

## Coexistence with V2

- `pick_vn_player_ratings` untouched
- V5 profiles default `is_shadow = true`
- No migration trigger

## Foundation tables (9/9)

See [`V5-FOUNDATION_9_TABLES.md`](./V5-FOUNDATION_9_TABLES.md).
