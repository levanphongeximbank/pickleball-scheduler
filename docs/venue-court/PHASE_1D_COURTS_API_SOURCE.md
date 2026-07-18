# Phase 1D — Courts API Source Correction

**Status:** Scope remediation complete (awaiting Owner review — not committed)  
**Date:** 2026-07-18  
**Branch:** `feature/venue-court-phase-1-foundation`

---

## Goal

```text
GET /api/v1/courts
    ↓
courtsHandler (local club scope guard)
    ↓
venue-court listCourts
    ↓
Club V3 courts[]
```

No AI store. No first-club auto-pick when multiple clubs are allowed.

---

## Existing scope findings

| Topic | Finding |
| ----- | ------- |
| Allowed clubs | `resolveAllowedClubIds` → `Set` of club ids (tenant-filtered, RBAC-filtered) |
| Ordering | Set insertion follows registry order — **not** an API selection contract |
| Shared `resolveScopedClubId` (no query) | Picks **first** allowed club — used by other handlers (e.g. players) |
| Missing / empty scope | Returns `null` → handlers often return empty list |
| Explicit out-of-scope | `assertClubInScope` → **403** `CLUB_OUT_OF_SCOPE` |
| Empty clubId string in assert | **403** `CLUB_REQUIRED` (shared helper) |
| Validation body | `apiError(code, message)` → `{ success: false, error: { code, message }, meta }` |
| Changing shared helper | Would affect players/other list handlers → **not done in 1D** |

---

## Final courts-handler scope matrix

| clubId supplied | Allowed clubs | Result |
| --------------- | ------------: | ------ |
| Valid authorized ID | any | Scoped courts for that club |
| Unauthorized ID | any | **403** `CLUB_OUT_OF_SCOPE` |
| Missing | 1 | Use sole allowed club |
| Missing | >1 | **400** `CLUB_REQUIRED` (“Thiếu clubId.”) |
| Missing | 0 | Secure empty `{ items: [], total: 0 }` (no leak) |

Implemented by **handler-local** `resolveCourtsHandlerClubId` — does **not** call `resolveScopedClubId`.

---

## Response contract (success)

```javascript
{
  items: [{ id, name, number, active }],
  total,
  clubId
}
```

Route, scope `courts:read`, and field mapping unchanged.

---

## Consumer analysis

* Clients with access to **multiple clubs must pass `clubId` explicitly**.
* Single-club callers may omit `clubId`.
* Observable vs pre-1D empty AI list: real Club V3 courts when scope resolves.
* Observable vs mid-1D first-club pick: multi-club callers now get **400** instead of silent first club.

---

## Files

* `src/features/api/router/handlers/courtsHandler.js`
* `src/features/venue-court/README.md`
* `tests/venue-court/courts-api-handler.test.js`
* `docs/venue-court/PHASE_1D_COURTS_API_SOURCE.md`
