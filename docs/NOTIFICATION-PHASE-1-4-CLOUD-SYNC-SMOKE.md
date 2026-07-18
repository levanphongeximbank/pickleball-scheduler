# Notification Phase 1.4 — Staging cloud sync manual smoke

**Target:** Supabase Staging `qyewbxjsiiyufanzcjcq` only. Never Production.

## Prerequisites

- Phase 1.3S SQL + RPC hardening applied
- QA Owner A / B assigned to `venue-staging-a` / `venue-staging-b`
- App Preview or local build with Staging Supabase env
- `VITE_NOTIFICATION_REQUIRE_SUPABASE=true` for Staging builds

## Procedure

1. Sign in as QA Owner A.
2. Create a notification for User A (booking create pilot, or schedule publish, or Staging RPC create for self).
3. Confirm Header badge unread count increases.
4. Open `/notifications` (Notification Center).
5. Mark one notification read.
6. Open another browser/session as the same User A → read state is synchronized.
7. Logout/login as User A → read state retained (cloud SoT).
8. Sign in as QA Owner B → cannot see User A notification.
9. Confirm runtime status mode is `supabase` (Notification Center subtitle) — no silent local fallback.
10. On mobile Player Home, confirm no duplicate rows for the same canonical event.

## Pass criteria

- All 10 steps pass
- No service_role in browser
- No cross-tenant inbox leakage
