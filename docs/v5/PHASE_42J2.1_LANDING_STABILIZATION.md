# Phase 42J.2.1 — Final Club Landing Stabilization

**Version:** 5.3.31

## Fixes

1. **State machine** `IDLE | LOADING | ACTIVE | NONE | ERROR` — no redirect in pending phases.
2. **`resolvePostLoginClubPath`** — sole post-login landing; ignores stale `from=/discover-clubs`.
3. **`resolveDirectMyClubPath`** — guard-only direct `/my-club` redirect.
4. **Hook** — stable `userId` fetch; `fetchGenRef` cancels stale RPC; no refetch on `user` object churn.
5. **Cache** — scoped `projectRef:userId`; clear only on `SIGNED_OUT` / user switch; skip `TOKEN_REFRESHED`.
6. **Guard** — `redirectIssuedRef` prevents duplicate `Navigate` on same mount.
