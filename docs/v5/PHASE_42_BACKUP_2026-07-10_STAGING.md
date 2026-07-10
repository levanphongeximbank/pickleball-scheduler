# Phase 42A — Staging backup snapshot

**Environment:** Supabase Staging (`project-0-pickleball-scheduler-supabase-staging`)  
**Timestamp:** 2026-07-10 (GO STAGING RESET)  
**Action:** Audit only in this file. Truncate/schema applied in subsequent Phase 42 steps on Staging only.

## Keep (not deleted)

- `auth.users`
- `profiles` rows (club_id/player_id cleared later)
- `roles`, `permissions`, `role_permissions`, `user_roles`
- Billing: `plans`, `plan_limits`, `tenant_subscriptions`, `invoices`, `invoice_items`, `payments`, `billing_events`, `billing_audit_logs`, `subscriptions`
- Infra: `api_clients`, `api_keys`, `api_logs`, `webhook_*`, `tenant_integration_settings`
- Migration history

## Venues (kept)

| id | name | status |
|----|------|--------|
| venue-staging-a | Venue Staging A — Ông A | active |
| venue-staging-b | Venue Staging B — Ông B | active |

## Profiles (kept accounts)

| email | role | club_id (pre-reset) | venue_id |
|-------|------|---------------------|----------|
| admin@staging.local | SUPER_ADMIN | null | null |
| cashier@staging.local | CASHIER | null | venue-staging-a |
| club@staging.local | CLUB_OWNER | club-staging-a | venue-staging-a |
| manager@staging.local | VENUE_MANAGER | null | venue-staging-a |
| owner@staging.local | VENUE_OWNER | null | venue-staging-a |
| owner-b@staging.local | VENUE_OWNER | null | venue-staging-b |
| player@staging.local | PLAYER | club-staging-a | venue-staging-a |

## Pre-reset business row counts (Staging)

| Table | Rows |
|-------|------|
| club_governance | 3 |
| club_data_v3 | 3 |
| club_ai_data | 1 |
| club_membership_requests | 0 |
| team_tournaments | 1 |
| team_tournament_* (aggregate) | see list_tables |
| court_clusters | 2 |
| user_cluster_assignments | 2 |
| checkins | 6 |
| qr_tokens | 6 |
| audit_logs | 87 |
| venues | 2 |
| profiles | 7 |

## Pre-reset club_governance

| club_id | venue_id | owner | president | status |
|---------|----------|-------|-----------|--------|
| club-staging-a | venue-staging-a | owner@staging | club@staging | active |
| club-staging-b | venue-staging-b | owner-b | owner-b | active |
| clb-ch-nh-1783420972763 | venue-staging-a | owner@staging | club@staging | active |

## Rollback

1. Re-seed from this snapshot + prior Staging dumps if available.
2. Do not touch Production.
3. Feature flag `VITE_CLUB_STORAGE_V2` remains off until `GO CLIENT V2`.

## Production

**Not modified** under `GO STAGING RESET`.
