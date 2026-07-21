# Phase 1I-C — Public Player Directory List UI

**Owner decision:** `AUTHORIZE_PHASE_1I_C_LIST_UI_IMPLEMENTATION`  
**Branch:** `feature/player-phase-1i-c-directory-list-ui`  
**Status:** Application / UI / tests / docs only  
**Document verdict:** `READY_FOR_PHASE_1I_C_PRECOMMIT_REVIEW`

---

## 1. Page scope

Authenticated Public Player Directory **list** experience:

| Item | Value |
|------|--------|
| Route | `/athletes` |
| Title | Danh bạ vận động viên |
| Facade | `searchPublicDirectoryPlayers` only |
| Detail | **Out of scope** (Phase 1I-D) |

Does **not** implement `/athletes/:playerId`. Cards do not navigate to a detail route.

---

## 2. Route & authentication

| Decision | Choice |
|----------|--------|
| Shell | `MainLayout` (existing `RouteAccessGate`) |
| Why not `PublicLayout` | Scope freeze mentioned PublicLayout for eventual hybrid/anonymous; 1I-C is authenticated-first and must follow the existing auth-guard convention (`RouteAccessGate` lives in `MainLayout`) |
| Auth | Unauthenticated → `/login` when auth production / RBAC requires auth |
| RBAC | `/athletes` is **authenticated-only** (same pattern as `/profile`); empty route permissions |
| Navigation | Discoverable to **all authenticated roles**: PROFILE group (“Tài khoản”) for non-PLAYER; PLAYER_ZONE for PLAYER (PROFILE is hidden for PLAYER). Same `athletes-directory` key — at most one sidebar entry per user. Also in `MOBILE_QUICK_LINKS`. |
| Anonymous access | Not implemented |

Files:

- `src/router.jsx` — lazy `PublicPlayerDirectoryPage`
- `src/auth/authGuard.js` — `isAuthenticatedOnlyRoute("/athletes")`
- `src/auth/menuAccess.js` — public menu path allow-list
- `src/config/navigationConfig.js` — `ROUTE_PERMISSIONS["/athletes"]=[]`, PLAYER zone + mobile quick link

---

## 3. UI states

| State | Behavior |
|-------|----------|
| Initial loading | Skeletons + `aria-busy` |
| Incremental loading | Spinner near “Tải thêm” |
| Ready | Responsive card grid |
| Browse empty | “Hiện chưa có vận động viên công khai đã xác minh.” |
| Search/filter empty | “Không tìm thấy vận động viên phù hợp…” |
| Error | Safe message + **Thử lại** when recoverable |
| Unauthenticated | Warning via facade `DIRECTORY_NOT_AUTHENTICATED` (route guard also redirects) |

---

## 4. Query behavior

| Input | API |
|-------|-----|
| Empty / whitespace | Browse (`query=null`) |
| 1 character | **No** facade call; preserve results |
| ≥ 2 characters | Search |
| Clear control | Reset query → browse |
| Debounce | 300 ms (`DIRECTORY_LIST_DEBOUNCE_MS`) |

Search or region change: reset accumulated items + `cursor=null`, fetch first page.

---

## 5. Region filter

- Free-text field → trimmed `string \| null`
- Clear → `null`
- No invented JSON `activityRegion` objects

---

## 6. Cursor / pagination

- Opaque `nextCursor` only
- No offset, no total count, no fake pages, no `hasMore` beyond cursor presence
- Load more: same query/region + exact opaque cursor; append + dedupe by `playerId`
- UI never decodes/inspects/constructs cursors

### Invalid cursor

On `DIRECTORY_INVALID_CURSOR`:

1. Clear items + cursor
2. Show recoverable error
3. Manual **Thử lại** → first page (`cursor=null`) only
4. **No** automatic retry loop

---

## 7. Error mapping

| Code | User message intent |
|------|---------------------|
| `DIRECTORY_NOT_AUTHENTICATED` | Require login |
| `DIRECTORY_INVALID_REQUEST` | Invalid search/filter |
| `DIRECTORY_INVALID_CURSOR` | Reload list |
| `DIRECTORY_BACKEND_UNAVAILABLE` (alias brief: `DIRECTORY_UNAVAILABLE`) | Temporarily unavailable |
| `DIRECTORY_RESPONSE_INVALID` (alias brief: `DIRECTORY_UNKNOWN_ERROR`) | Generic retry |

Never show SQLSTATE, RPC names, stack traces, or internal payloads.

---

## 8. Security / privacy boundaries

Directory DTO fields only:

`playerId`, `displayName`, `isVerified`, `avatarUrl`, `activityRegion`, `gender`, `handedness`

Not retrieved or displayed: email, phone, auth user id, privacy settings, raw verification status, status, birth date/year, rating, tenant/venue/club ids, roles, audit, moderation.

UI → controller → `searchPublicDirectoryPlayers` → repository. No direct Supabase RPC from React.

---

## 9. Test coverage

`tests/player-management-phase-1i-c-directory-list-ui.test.js`

Covers: route/auth guard, initial browse, loading/empty, 2-char search, 1-char no-call, search/region reset, opaque load-more, append + dedupe, stale discard, invalid cursor, retry, DTO helpers, source facade/forbidden-field checks.

Mock facade at application boundary; no live Supabase.

---

## 10. Out of scope

- `/athletes/:playerId` (1I-D)
- SQL / migrations / Staging apply / Production
- Anonymous directory
- Total counts, rating, club membership
- Deploy / commit / PR (Owner-controlled)

---

## 11. Phase 1I-D handoff

1I-D should:

1. Add authenticated route `/athletes/:playerId`
2. Call `getPublicDirectoryPlayer` only
3. Reuse Directory DTO + verified badge
4. Wire card navigation only after detail route exists
5. Keep opaque privacy empty/not-found messaging

Do **not** start 1I-D until Owner authorizes.

---

## 12. Key files

| Path | Role |
|------|------|
| `src/pages/PublicPlayerDirectoryPage.jsx` | Page shell |
| `src/features/player/components/PublicPlayerDirectoryList.jsx` | List UI |
| `src/features/player/components/PublicDirectoryPlayerCard.jsx` | Card |
| `src/features/player/utils/publicDirectoryListController.js` | State / fetch |
| `src/features/player/utils/publicDirectoryListMessages.js` | Labels / errors |
