# Phase 1I-B — Contract Verification

Cross-check of authored SQL against merged Phase 1I-A application contract.

---

## 1. Application sources inspected

| File | Role |
|------|------|
| `src/features/player/repositories/supabasePlayerDirectoryRepository.js` | RPC names + args + envelope |
| `src/features/player/utils/directoryCursor.js` | opaque `pd1.*` encode/decode |
| `src/features/player/contracts/directoryRequests.js` | limit / region / cursor validation |
| `src/features/player/projectors/projectDirectoryPlayer.js` | strict DTO + `activity_region` text\|null |
| `src/features/player/constants/directory.js` | limits, DTO allow-list, error codes |
| `tests/player-management-phase-1i-a-directory-contract.test.js` | regression contract |

---

## 2. RPC name / argument matrix

| Adapter call | SQL object | Match |
|--------------|------------|-------|
| `player_directory_search` | `public.player_directory_search` | YES |
| `p_query` | `p_query text` | YES |
| `p_region` | `p_region text` | YES (1I-A remediation; not jsonb) |
| `p_cursor` | `p_cursor text` | YES |
| `p_limit` | `p_limit integer` | YES |
| `player_directory_get` | `public.player_directory_get` | YES |
| `p_player_id` | `p_player_id text` | YES |

---

## 3. Response field matrix

| SQL field | DTO field | Type |
|-----------|-----------|------|
| `player_id` | `playerId` | string |
| `display_name` | `displayName` | string |
| `is_verified` | `isVerified` | boolean `true` |
| `avatar_url` | `avatarUrl` | string\|null |
| `activity_region` | `activityRegion` | **string\|null** |
| `gender` | `gender` | string\|null |
| `handedness` | `handedness` | string\|null |

---

## 4. Cursor contract

| Rule | SQL | App |
|------|-----|-----|
| Prefix | `pd1.` | `pd` + `DIRECTORY_CURSOR_VERSION` (=1) |
| Payload | `{"v":1,"n":"...","p":"..."}` | same |
| Encoding | UTF-8 → base64url (no pad) | same |
| Sort key | `lower(trim(display_name)), player_id` | same |
| Malformed | `code: "INVALID_CURSOR"` | maps to `DIRECTORY_INVALID_CURSOR` |
| Silent reset | **forbidden** | **forbidden** |

Decode/encode implemented in SQL helpers to match `directoryCursor.js` without changing the 1I-A adapter (adapter still passes opaque `p_cursor` only).

---

## 5. Envelope shapes

### Search success

```json
{
  "ok": true,
  "data": [ { "player_id": "...", "display_name": "...", "is_verified": true, "avatar_url": null, "activity_region": null, "gender": null, "handedness": null } ],
  "meta": { "nextCursor": "<pd1.*>|null", "limit": 20, "count": 1 },
  "code": null,
  "message": null
}
```

### Search invalid cursor

```json
{
  "ok": false,
  "data": [],
  "meta": { "nextCursor": null, "limit": 20, "count": 0 },
  "code": "INVALID_CURSOR",
  "message": "..."
}
```

### Detail success / hidden

```json
{ "ok": true, "data": { ... } | null, "code": null, "message": null }
```

---

## 6. Forbidden fields review (RPC emit)

Confirmed absent from projector output object keys:

`privacy_settings`, `identity_verification_status`, `status`, `id`, `auth_user_id`, `email`, `phone`, `birth_date`, `birth_year`, `venue_id`, `club_id`, `role`, `roles`, `rating`, `updated_at`, `created_at`, `rejection_reason`, `moderation_notes`, `visible`

---

## 7. activity_region text remediation

See `05_ACTIVITY_REGION_TEXT_CONTRACT.md`.
