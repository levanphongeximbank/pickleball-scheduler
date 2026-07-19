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

### Cleanup strategy (Phase 1.5 QA RPC)

After checks, the script cleans **only** inbox rows created in this run via:

`notification_qa_cleanup_namespaced_inbox` (SECURITY DEFINER, Staging-only)

Guards:

- `notification_runtime_config.allow_qa_cleanup=true` and `environment≠production`
- exact project ref `qyewbxjsiiyufanzcjcq`
- authenticated caller must be the recipient
- scoped by `tenant_id` + `recipient_user_id` (auth.uid)
- filtered to tracked notification ids
- and `idempotency_key LIKE 'phase14s:<runUuid>:%'`

The script also creates an **untracked sentinel** namespaced row, proves cleanup does **not** delete it, then deletes the sentinel in a separate tracked call.

No broad DELETE RLS is granted to normal users. No service_role in this smoke path.

## Prerequisites

- Phase 1.3S SQL + RPC hardening applied
- Phase 1.5 SQL applied (for QA cleanup RPC)
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
- Cleanup deletes only tracked namespaced QA rows; unrelated rows remain
