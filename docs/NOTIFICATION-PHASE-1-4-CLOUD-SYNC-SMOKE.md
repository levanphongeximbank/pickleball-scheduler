# Notification Phase 1.4S — Staging cloud sync smoke

**Target:** Supabase Staging `qyewbxjsiiyufanzcjcq` only. Never Production.

## Automated run (preferred)

```bash
npm run notification:verify:phase14s
# or
node scripts/verify-notification-phase14s-cloud-sync-staging.mjs
```

### Required env (gitignored `.env.staging-qa.local`)

| Key | Purpose |
|-----|---------|
| `STAGING_SUPABASE_URL` | Must contain ref `qyewbxjsiiyufanzcjcq` |
| `STAGING_SUPABASE_ANON_KEY` | Browser-equivalent anon key |
| `STAGING_OWNER_A_EMAIL` / `STAGING_OWNER_B_EMAIL` | QA Owner emails (not hard-coded in script) |
| `STAGING_OWNER_A_PASSWORD` / `STAGING_OWNER_B_PASSWORD` | QA passwords |

Uses **anon key + user JWT only**. `STAGING_SUPABASE_SERVICE_ROLE_KEY` is ignored if present.

### Safety guards

- Abort if URL contains Production ref `expuvcohlcjzvrrauvud`
- Require Staging ref `qyewbxjsiiyufanzcjcq`
- Require authenticated Owner A and Owner B sessions
- Never print passwords, JWTs, keys, emails, or DB URLs
- QA rows use namespaced ids: `phase14s:<runUuid>:…`

### Cleanup strategy

After checks, the script deletes **only** inbox rows created in this run:

- scoped by `tenant_id` + `recipient_user_id` (Owner A)
- filtered to tracked notification ids
- and `idempotency_key LIKE 'phase14s:<runUuid>:%'`

If Staging RLS has no DELETE policy, cleanup is reported as skipped and namespaced rows remain (safe to identify/revisit later). Unrelated inbox rows are never deleted.

## Prerequisites

- Phase 1.3S SQL + RPC hardening applied
- QA Owner A / B on `venue-staging-a` / `venue-staging-b`
- Optional UI chrome with `VITE_NOTIFICATION_REQUIRE_SUPABASE=true`

## Manual UI chrome (optional)

1. Sign in as QA Owner A.
2. Trigger or observe a canonical notification.
3. Confirm Header badge unread count.
4. Open `/notifications`.
5. Mark read in one browser; confirm sync in a second session.
6. Logout/login — read state persists.
7. Owner B cannot see Owner A rows.
8. Mobile home shows no duplicate canonical/legacy event pairs.

## Pass criteria

- Automated script PASS (0 blockers)
- No service_role in the smoke path
- No cross-tenant inbox leakage
