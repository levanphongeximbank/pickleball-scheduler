# 07 — Slice 1A Implementation Report

**Workstream:** PICK_VN — PUBLIC WEB EXPERIENCE  
**Phase:** PUBLIC WAVE 1 — SLICE 1A IMPLEMENTATION  
**Date:** 2026-08-22  
**Branch:** `feat/public-web-experience-01`  
**Base SHA:** `0fefcb7ddb7f3d637d6fabe51c5b1b670c96978c`

```text
SLICE_1B_IMPLEMENTED=NO
SQL_CREATED=NO
SQL_EXECUTED=NO
ROUTER_CHANGED=NO
ANON_SOFT_REDIRECT_IMPLEMENTED=NO
TOURNAMENT_23_VISUAL_REDESIGN=NO
PR_463_TOUCHED=NO
AUTHENTICATED_APP_SHELL_CHANGED=NO
```

---

## Objective completed

Integrity foundation only:

1. Public Header / Mobile drawer Giải đấu → `/public/tournaments`
2. Public Footer “Ban tổ chức giải” → `/login`
3. TournamentCard CTA ID-safe public routing
4. #23 anonymous fail-closed (no infinite `activeClub` wait)
5. Remove invented LIVE court amenities
6. Targeted tests + local verification
7. Owner preview instructions (screenshot targets)

Guest published tournament payload remains **Slice 1B** (blocked).

---

## Files changed

| File | Change type |
|------|-------------|
| `src/components/public/PublicHeader.jsx` | Nav target fix (desktop + mobile drawer share `NAV_ITEMS`) |
| `src/components/public/PublicFooter.jsx` | Organizer CTA → `/login` |
| `src/components/public/cards/TournamentCard.jsx` | ID-safe CTA via helper |
| `src/components/public/cards/resolvePublicTournamentCardHref.js` | **NEW** — proven canonical ID → public detail; else discovery |
| `src/features/public-portal/services/publicTournamentsRankingsDataSource.js` | LIVE sets `canonicalTournamentId` only when blob `t.id` exists; catalog sets `null` |
| `src/features/public-portal/services/publicClubsCourtsDataSource.js` | `mapLiveCourts` amenities → `[]` |
| `src/features/tournament/experience-a1/pages/IndividualPublicExperiencePage.jsx` | Guest/club-scope READ_GATE + unavailable ERROR_STATE |
| `tests/public-web-experience-slice-1a.test.js` | **NEW** unit/source tests |
| `tests/ui/public-web-experience-slice-1a.ui.test.jsx` | **NEW** UI tests |
| `tests/public-portal-postwipe-honesty.test.js` | Assert header uses `/public/tournaments` |
| `scripts/ci/unit-test-files.json` | Register Slice 1A unit file |
| `docs/audits/public-web-experience/wave-01/07-SLICE-1A-IMPLEMENTATION-REPORT.md` | This report |

**Not changed:** `src/router.jsx`, `src/features/canonical-shell/**`, tournament writers, SQL, legacy `IndividualTournamentPublicPage.jsx`.

---

## Root causes fixed

| Issue | Root cause | Fix |
|-------|------------|-----|
| Guest Giải đấu → login wall | Header hardcoded `/tournaments` (auth hub) | → `/public/tournaments` |
| Footer Ban tổ chức → login wall | Footer hardcoded `/tournaments` | → `/login` (organizer intent; Owner lock) |
| Card CTA → organizer detail | Card used `/tournaments/:id` | Proven canonical ID → `/tournament/:id/public`; else discovery |
| #23 infinite “Đang tải…” | Waited on `!clubScopeReady` forever for guests | Separate loading vs fail-closed unavailable |
| Fake LIVE amenities | `mapLiveCourts` hardcoded `["Đèn LED","Sân chuẩn"]` | `amenities: []` |

---

## TournamentCard ID mapping evidence

```text
TOURNAMENT_CARD_ID_SOURCE=
1. Prefer tournament.canonicalTournamentId
2. Else tournament.tournamentId
3. Never assume tournament.id === organizer tournamentId
```

| Source | Portal `id` | `canonicalTournamentId` | Card CTA after 1A |
|--------|-------------|-------------------------|-------------------|
| LIVE blob with `t.id` | real id (or synthetic key) | `t.id` when present | `/tournament/:id/public` |
| LIVE blob without `t.id` | synthetic `${clubId}-${name}` | `null` | `/public/tournaments` (fail closed) |
| Catalog DTO | opaque projection PK | `null` (unproven) | `/public/tournaments` (fail closed) |
| Mock (`t1`…) | mock id | absent | `/public/tournaments` (fail closed) |

```text
TOURNAMENT_CARD_ID_COMPATIBILITY_AFTER_IMPLEMENTATION=
PARTIAL_FAIL_CLOSED
— Detail URL only when proven canonicalTournamentId/tournamentId present.
— Catalog/mock/synthetic IDs do not fabricate /tournament/:id/public.
— Full catalog↔organizer ID contract remains Slice 1B.
```

---

## #23 gate behavior (change classification)

| Change | Class |
|--------|-------|
| Read `clubScopeStatus`; load only while `"loading"` | READ_GATE |
| Guest/`!clubScopeReady` → unavailable copy | ERROR_STATE / LOADING_STATE split |
| Authenticated ready path still uses `useCanonicalTournament` | DATA_INTEGRATION (unchanged authority) |
| Tabs / layout / tokens / chrome | **VISUAL_CHANGE=NO** |

Copy used when guest-safe payload is unavailable:

```text
Thông tin giải đấu hiện chưa khả dụng công khai.
```

Does **not** claim “Giải đấu không tồn tại” for the guest unread case.

```text
VISUAL_REDESIGN=NO
GUEST_REAL_PAYLOAD_AVAILABLE=NO
SLICE_1B_STILL_REQUIRED=YES
```

---

## Amenities truth fix

`mapLiveCourts()` now emits `amenities: []`, matching catalog honesty (`mapCatalogCourtDtoToPortalCard`).

Public `CourtCard` still does not render amenities; DTO no longer lies.

---

## Tests

| Suite | Result |
|-------|--------|
| `node --test tests/public-web-experience-slice-1a.test.js` | PASS (9) |
| `node --test tests/public-portal-postwipe-honesty.test.js` (+ Slice 1A) | PASS |
| `npx vitest run tests/ui/public-web-experience-slice-1a.ui.test.jsx` | PASS (6) |
| Full `npm run test:ui` (entire `tests/ui`) | Not used as Slice 1A gate — many unrelated env/config failures pre-exist |

Assertions covered:

- Desktop + mobile Giải đấu → `/public/tournaments`
- Footer Ban tổ chức → `/login`
- Card with canonical ID → `/tournament/:id/public`
- Card without proven ID → `/public/tournaments` (no fabricated detail)
- Guest #23 → unavailable, not infinite load
- LIVE amenities not invented

---

## Verification results

| Check | Result |
|-------|--------|
| `lint:no-new` | PASS (0 new violations) |
| typecheck | N/A (no package script) |
| Slice 1A unit + UI tests | PASS |
| `npm run build` | PASS |

---

## Owner preview / screenshots

Local preview (after build):

```powershell
cd "C:\Users\Le Phong\PICK_VN-Workstreams\public-web-experience-01"
npm run preview
```

Or:

```powershell
npm run dev
```

Open as guest (logged out).

### Screenshot targets

**Desktop 1440**

1. Homepage header — confirm Giải đấu does not hit login wall  
2. `/public/tournaments` discovery  
3. If a card has proven `canonicalTournamentId`, open `/tournament/:id/public` (expect unavailable until 1B); otherwise card stays on discovery  

**Mobile 390**

4. Public drawer open — Giải đấu → `/public/tournaments`  
5. `/public/tournaments`  
6. Direct `/tournament/<any-id>/public` → “Thông tin giải đấu hiện chưa khả dụng công khai.”  

Also confirm footer “Ban tổ chức giải” → `/login`.

```text
OWNER_VISUAL_ACCEPTANCE_REQUIRED=YES
READY_FOR_MERGE=NO
```

---

## Known Slice 1B blocker

```text
- Guest-safe published tournament projection GET (SQL) still required
- Thin client adapter to feed derivePublicExperienceModel without activeClub
- Catalog id ↔ organizer tournamentId contract must be proven
- Do NOT open canonical_tournament_get to anon
```

---

## Deferred

```text
- Slice 1B guest payload
- Anon soft-redirect /tournaments → /public/tournaments
- Delete IndividualTournamentPublicPage.jsx
- ECOSYSTEM_ITEMS latent path cleanup
- Wave 5 court-cluster redesign / amenities UI
- Wave 8 /register alias
- Full Wave 9 responsive matrix
```

---

## Safety confirmation

```text
SQL_FILES_CHANGED=NO
AUTHENTICATED_SHELL_CHANGED=NO
PR_463_FILES_CHANGED=NO
TOURNAMENT_WRITER_CHANGED=NO
ROUTER_CHANGED=NO
```
