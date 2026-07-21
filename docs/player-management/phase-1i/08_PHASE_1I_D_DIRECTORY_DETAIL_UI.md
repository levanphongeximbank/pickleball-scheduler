# Phase 1I-D — Public Player Directory Detail UI

**Owner decision:** `AUTHORIZE_PHASE_1I_D_IMPLEMENTATION`
**Branch:** `feature/player-phase-1i-d-directory-detail-ui`
**Status:** Application / UI / tests / docs only
**Document verdict:** `READY_FOR_PHASE_1I_D_PRECOMMIT_REVIEW`

---

## 1. Page scope

Authenticated Public Player Directory **detail** experience:

| Item | Value |
|------|--------|
| Route | `/athletes/:playerId` |
| Title | Player display name (when available) |
| Facade | `getPublicDirectoryPlayer` only |
| List | Remains `/athletes` (Phase 1I-C) |

Does **not** invent biography, match history, rating, rankings, club/team membership, availability, achievements, social links, or contact actions.

---

## 2. Route & authentication

| Decision | Choice |
|----------|--------|
| Shell | `MainLayout` (existing `RouteAccessGate`) |
| Auth | Same convention as `/athletes` — authenticated-only |
| RBAC | No special role/permission; `isAuthenticatedOnlyRoute("/athletes/…")` already covers prefix |
| Unauthenticated | Existing login redirect |
| Anonymous `PublicLayout` | **Not** created |
| Conflict with `/players` | None — routes remain separate |

Files:

- `src/router.jsx` — lazy `PublicPlayerDirectoryDetailPage`
- `src/auth/authGuard.js` — existing `/athletes/` prefix (unchanged)
- `src/features/player/utils/publicDirectoryRoutes.js` — path helper

---

## 3. Strict DTO fields

Only approved public fields:

`playerId`, `displayName`, `isVerified`, `avatarUrl`, `activityRegion`, `gender`, `handedness`

`playerId` is used for route construction only — not shown as visible UI text.

---

## 4. UI structure

1. **Back navigation** → “Danh bạ vận động viên” (`/athletes`)
2. **Public profile header** — avatar (safe fallback), display name, modest verified indicator
3. **Public information** — activity region / gender / handedness when present
4. **Privacy-safe notice** — general public-directory context only

---

## 5. Fetch behavior

On route load:

1. Read `playerId` from route params
2. Validate non-empty string
3. Call `getPublicDirectoryPlayer(playerId)` with the route value (no list reconstruction, no localStorage source of truth)
4. Handle param changes; discard stale responses via request-sequence in the detail controller

Empty route param → generic not-found **without** calling the facade.

---

## 6. Loading / success / optional fields

| State | Behavior |
|-------|----------|
| Loading | Skeleton + `aria-busy` / accessible status |
| Ready | Approved fields only |
| Optional nulls | Omitted cleanly (no empty placeholder rows for null gender/region/handedness beyond a single “no extra public info” line when all absent) |
| Param change | Clears prior player before fetch (no stale paint) |

---

## 7. Generic not-found / privacy

Backend intentionally returns the same null player for nonexistent, ineligible, privacy-hidden, and suspended profiles.

UI shows **one** generic message:

> Không tìm thấy vận động viên hoặc hồ sơ này hiện không được công khai.

Does **not** reveal existence, verification workflow, privacy setting, account status, suspension, or hidden reason.

---

## 8. Error mapping

| Code / alias | User message intent |
|--------------|---------------------|
| `DIRECTORY_NOT_AUTHENTICATED` | Require login |
| `DIRECTORY_INVALID_REQUEST` | Invalid request / path |
| `DIRECTORY_BACKEND_UNAVAILABLE` (`DIRECTORY_UNAVAILABLE`) | Temporarily unavailable + **Retry** |
| `DIRECTORY_RESPONSE_INVALID` (`DIRECTORY_UNKNOWN_ERROR`) | Generic retry + **Retry** |

Never show SQLSTATE, RPC names, stack traces, tokens, or internal payloads.

---

## 9. Card → detail navigation

Phase 1I-C cards now link to `/athletes/:playerId` via `buildPublicDirectoryPlayerPath`:

- Accessible `CardActionArea` + `RouterLink`
- Visible focus state
- No detail prefetch that bypasses the facade
- No additional hidden fields

---

## 10. Test coverage

`tests/player-management-phase-1i-d-directory-detail-ui.test.js`

Covers: authenticated route, unauthenticated redirect, no special permission, single facade call, unchanged param, DTO fields, optional nulls, verified badge, loading, generic not-found indistinguishability, forbidden fields, recoverable error + Retry, no raw backend text, stale discard, card navigation + keyboard a11y, back link, no direct RPC, no anonymous PublicLayout detail.

Mock facade at application boundary; no live Supabase.

---

## 11. Out of scope

- SQL / migrations / Staging apply / Production
- Anonymous directory
- Phase 1I-E Privacy / Staging QA
- Deploy / commit / PR (Owner-controlled)

---

## 12. Phase 1I-E handoff

1I-E should:

1. Privacy / Staging QA against live read-model
2. Auth, masking, suspended exclusion, privacy revoke
3. Abuse / availability checks
4. Keep generic hidden/nonexistent messaging intact

Do **not** start 1I-E until Owner authorizes.

---

## 13. Key files

| Path | Role |
|------|------|
| `src/pages/PublicPlayerDirectoryDetailPage.jsx` | Page shell + `useParams` |
| `src/features/player/components/PublicDirectoryPlayerDetail.jsx` | Detail UI |
| `src/features/player/components/PublicDirectoryPlayerCard.jsx` | Card → detail link |
| `src/features/player/utils/publicDirectoryDetailController.js` | State / fetch / stale guard |
| `src/features/player/utils/publicDirectoryDetailMessages.js` | Safe messages |
| `src/features/player/utils/publicDirectoryRoutes.js` | Path helpers |
| `src/router.jsx` | `/athletes/:playerId` registration |
