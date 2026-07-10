# Phase 42J.2.2 — Nav Cache Polish

**Version:** 5.3.32

## Scope

1. Session-scoped membership cache mirror (not SoT) for bfcache/back-forward survival within 30s TTL.
2. `shouldFetchMembership` gate — no RPC when cache/session fresh.
3. `bumpRevision` invalidates before refetch (approve/leave/create).
4. Sidebar/mobile `aria-current="page"` + cross-route matcher guards.
