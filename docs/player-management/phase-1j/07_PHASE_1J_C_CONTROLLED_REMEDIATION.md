# Phase 1J-C — Controlled Directory Auth + Repository Remediation

**Owner authorization:** `AUTHORIZE_PHASE_1J_C_CONTROLLED_REMEDIATION`
**Classification:** Player Management application wiring only
**Status:** Implementation complete — awaiting precommit review
**Document verdict:** `READY_FOR_PHASE_1J_C_PRECOMMIT_REVIEW`

---

## 1. Defects addressed

| Defect | Production symptom |
|--------|-------------------|
| Facade required injected session; UI passed none | False `DIRECTORY_NOT_AUTHENTICATED` / “Vui lòng đăng nhập…” while shell was authenticated |
| Facade defaulted to stub directory repository | Latent `DIRECTORY_BACKEND_UNAVAILABLE` after auth fix |

## 2. Remediation (minimum)

1. **`resolveDirectorySession`** — when no `user` / `session` / `getSession` / `getCurrentUser` is injected, call `getCurrentUser()` from `src/auth/authService.js` (same pattern as other Player Management facades).
2. **`searchPublicDirectoryPlayers` / `getPublicDirectoryPlayer`** — when no repository is injected, default to `createSupabasePlayerDirectoryRepository` wired with `getSupabaseAuthClient` + `hasSupabaseConfig`.
3. **`createSupabasePlayerDirectoryRepository`** — same shared-client default as other durable Player Management adapters.
4. Stub `createPlayerDirectoryRepository` retained for explicit test DI.

## 3. Explicit non-changes

- No SQL / RPC / schema changes
- No privacy or Directory DTO changes
- No route / auth-provider redesign
- No Production data writes, deploy, commit, push, or PR under this token

## 4. Tests

`tests/player-management-phase-1j-c-directory-auth-repository-remediation.test.js`

Covers authenticated default session, unauthenticated rejection, DI compatibility, Supabase default wiring, privacy/cursor regression.

## 5. Exact Owner action next

1. Precommit review of this remediation.
2. After merge + Production deploy (separate Owner tokens), re-run Phase 1J-C Production browser smoke on `https://pickvn.app/athletes`.
