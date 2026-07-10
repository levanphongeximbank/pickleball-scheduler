# Phase 42J.2 — Redirect & Membership RPC Deduplication

**Version:** 5.3.30  
**Production:** NOT deployed  
**42K:** NOT started  

## Root causes (42J.1 residual)

| Symptom | Root cause |
|---------|------------|
| `/my-club` hit 2× before `/discover-clubs` | Login `getDefaultHomePath` → `/my-club` before RPC; guard redirect second hop |
| `club_get_my_active_membership` ×4–6 | Duplicate hooks: guard + page + DiscoverClubsPage + login landing |
| Back/forward RPC spam | 3s cache + remount refetch per route |
| Dashboard → `/my-club` flash | `RouteAccessGate` blind PLAYER home redirect |

## Fixes (42J.2)

1. **`MyClubMembershipRootProvider`** — single hook at router level (inside `AuthProvider`).
2. **Cache-first hook** — 30s TTL; skip refetch when snapshot fresh; service in-flight dedupe.
3. **`ClubPostAuthRedirect`** — V2 PLAYER login waits for RPC, one `replace` navigate.
4. **`ClubPlayerHomeRedirect`** — dashboard home without blind `/my-club`.
5. **Guards/pages** — `useRequiredMyClubMembership()` only; no nested providers/hooks.
6. **`menuAccess`** — V2 PLAYER static home `/discover-clubs` (membership-aware redirects via post-auth components).

## Tests

```bash
node --test tests/club-route-42j.test.js tests/club-route-42j1.test.js tests/club-route-42j2.test.js
# 30/30 PASS
```

## Preview / browser QA

After commit: `npx vercel deploy` → set `STAGING_PREVIEW_URL` → run:

```bash
node scripts/verify-phase42j1-nomember-real-qa.mjs
```

## Checkpoint

Await **GO DEPLOY 42J.2** (Preview promote separate; Production not in scope).
