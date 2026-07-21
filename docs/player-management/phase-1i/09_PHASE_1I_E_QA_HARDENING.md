# Phase 1I-E — Public Player Directory QA & Hardening

**Owner decision:** `AUTHORIZE_PHASE_1I_E_IMPLEMENTATION`
**Branch:** `feature/player-phase-1i-e-directory-qa-hardening`
**Status:** Application / tests / docs only (no SQL, no deploy)
**Document verdict:** `READY_FOR_PHASE_1I_E_PRECOMMIT_REVIEW`

---

## 1. Scope

QA and hardening for authenticated Public Player Directory:

| Surface | Route |
|---------|--------|
| List | `/athletes` |
| Detail | `/athletes/:playerId` |

Covers auth/nav matrix, search/region/cursor behaviors, stale-response protection, privacy-safe not-found, accessibility, and responsive contracts.

Does **not** implement Phase 1I-F closure or Production rollout.

---

## 2. Defects found & hardening performed

| ID | Finding | Fix |
|----|---------|-----|
| E1 | With `VITE_RBAC_ENABLED=false`, PLAYER could see `athletes-directory` in both PROFILE and PLAYER_ZONE | Honor `roles` / `excludeRoles` even when RBAC is off (`menuAccess.js`); PROFILE leaf adds `excludeRoles: [PLAYER]` (`supportMenu.js`) |
| E2 | List Retry lacked accessible name (detail already had one) | Added `aria-label="Thử lại tải danh bạ vận động viên"` on list Retry |

No SQL, migration, or facade contract changes were required for the locked directory DTO / RPC behavior.

---

## 3. Deterministic QA matrix (local)

| Check | Result |
|-------|--------|
| `/athletes` + `/athletes/:playerId` authenticated-only | PASS |
| Unauthenticated → login redirect (auth production / RBAC) | PASS |
| PLAYER + non-PLAYER access; no special permission | PASS |
| Nav entry exactly once (RBAC on **and** off) | PASS (after E1) |
| 1-char search suppressed; ≥2-char search | PASS |
| Region filter + clear/reset | PASS |
| Opaque cursor forward; append; dedupe by `playerId` | PASS |
| Stale list discard | PASS |
| Invalid cursor → recoverable error; no silent auto-restart loop | PASS |
| Detail success + optional field omit | PASS |
| Hidden / ineligible / suspended / nonexistent indistinguishable | PASS |
| Stale detail discard | PASS |
| Retry recoverable only; no SQLSTATE/RPC text | PASS |
| Card → detail + back to `/athletes` | PASS |
| Strict DTO; forbidden fields absent; no React RPC | PASS |
| A11y labels / loading announce / focus-visible | PASS |
| Responsive grid / stacked detail rows | PASS (source contracts) |

Focused suite: `tests/player-management-phase-1i-e-directory-qa-hardening.test.js`

---

## 4. Staging smoke

| Item | Value |
|------|--------|
| Allowed Staging project | `qyewbxjsiiyufanzcjcq` |
| Forbidden Production project | `expuvcohlcjzvrrauvud` |
| Local credential file detected | `.env.staging-qa.local` (gitignored) points at Staging project |
| Smoke execution | See section 4.1 |

### 4.1 Staging read-only smoke status

**Status:** `RAN_READ_ONLY`
**Script:** `scripts/smoke-player-directory-staging-1i-e.mjs`
**Project:** `qyewbxjsiiyufanzcjcq`
**Production ref used:** false

Sanitized results:

| Probe | Result |
|-------|--------|
| Authenticated search (`player_directory_search`) | ok; itemCount `0` (no eligible public rows in Staging fixture set) |
| Detail for nonexistent id | ok; `player` null |
| Missing/hidden indistinguishability (null player) | Confirmed for nonexistent id |
| Forbidden field leakage in returned rows | N/A (empty set); no Production connection |
| Profile mutations | none |
| Privacy / verification changes | none |
| Fixture creation | none |

Credentials remain in gitignored `.env.staging-qa.local` only — not committed.

---

## 5. Privacy boundaries (reconfirmed)

Approved Directory DTO only:

`playerId`, `displayName`, `isVerified`, `avatarUrl`, `activityRegion`, `gender`, `handedness`

Not retrieved or displayed: email, phone, auth user id, privacy settings, raw verification status, account status, birth date/year, rating, ranking, tenant/venue/club ids, roles, audit, moderation, suspension reason, eligibility reason.

Generic not-found (unchanged):

> Không tìm thấy vận động viên hoặc hồ sơ này hiện không được công khai.

---

## 6. Out of scope

- SQL / migrations / Production apply
- Anonymous directory
- Rating, club membership, contact actions
- Phase 1I-F closure
- Commit / push / PR / deploy (Owner-controlled)

---

## 7. Phase 1I-F handoff

1I-F should:

1. Close Phase 1I with Staging evidence package complete
2. Separate Owner Production gate (never implied by 1I-E)
3. Keep privacy indistinguishability and auth-first contracts frozen

Do **not** start 1I-F until Owner authorizes.

---

## 8. Key files

| Path | Role |
|------|------|
| `src/auth/menuAccess.js` | Role gates when RBAC off (E1) |
| `src/config/v5Menu/supportMenu.js` | PROFILE athletes `excludeRoles` (E1) |
| `src/features/player/components/PublicPlayerDirectoryList.jsx` | Retry a11y (E2) |
| `tests/player-management-phase-1i-e-directory-qa-hardening.test.js` | QA matrix tests |
| `docs/player-management/phase-1i/09_PHASE_1I_E_QA_HARDENING.md` | This package |
