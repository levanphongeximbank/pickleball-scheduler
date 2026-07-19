# Phase 1F-A — Implementation Evidence

**Branch:** `feature/player-phase-1f-profile-ui-privacy-foundation`  
**Scope freeze:** `0dfa28b` / `docs/player-management/phase-1f/00_PHASE_1F_SCOPE_FREEZE.md`  
**Sub-phase:** **1F-A only** (self profile UI + canonical read surface)  
**1F-B:** Not started

---

## Objective

Complete authenticated self-profile **read surface** for Production foundation fields via the canonical Player Management path.

## Canonical read path used

```
authenticated session
  → getAuthenticatedSelfPlayerProfile
  → fetchProfileByUserId (profiles row loader)
  → getPlayerProfileByAuthUser (requirePlayerRow: false)
  → getPlayerProfile → adaptProfileRow → normalizePlayerProfile
```

No second identity store. No public projector. No schema SQL.

## Routes preserved

| Route | Page | Change |
|-------|------|--------|
| `/profile` | `SelfProfilePage` → My / Athlete | Unchanged router |
| `/player/profile` | `AthleteSelfProfilePage` | Foundation read panel added |
| `/profile` (non-athlete) | `MyProfilePage` | Foundation read panel added |

## Fields displayed (read surface)

| Field | Display | Editable in 1F-A read panel |
|-------|---------|-----------------------------|
| `birth_year` | Yes (label) | Existing athlete form still edits year separately |
| `birth_date` | Yes | Read-only panel |
| `handedness` | Yes (user-facing label) | Read-only panel |
| `activity_region` | Yes (formatted) | Read-only panel |
| `privacy_settings` | Yes (summary + chips) | Read-only panel |
| `identity_verification_status` | Yes (user-facing label) | **Read-only always** |

## UI states

| Status | Behavior |
|--------|----------|
| `loading` | Spinner + copy |
| `loaded` | Six fields rendered |
| `empty` | Info alert |
| `read_error` | Error alert + retry |
| `unauthorized` | Warning alert |
| `profile_not_found` | Info alert + retry |
| `unresolved` | Error alert (ambiguous / unmapped) |

## Files added / changed

### Added
- `src/features/player/services/getAuthenticatedSelfPlayerProfile.js`
- `src/features/player/selectors/selfProfileDisplay.js`
- `src/features/player/hooks/useAuthenticatedSelfPlayerProfile.js`
- `src/features/player/components/SelfPlayerProfileFoundationRead.jsx`
- `tests/player-management-phase-1f-a-self-profile-read.test.js`
- `tests/ui/player-phase-1f-a-self-profile-read.smoke.test.jsx`
- `docs/player-management/phase-1f/03_PHASE_1F_A_IMPLEMENTATION_EVIDENCE.md`

### Changed
- `src/features/player/index.js` — exports
- `src/pages/player/AthleteSelfProfilePage.jsx` — foundation panel
- `src/pages/MyProfilePage.jsx` — foundation panel
- `scripts/ci/unit-test-files.json` — register focused test
- `docs/player-management/phase-1f/02_SUBPHASE_PLAN.md` — 1F-A status note

## Explicitly not done (out of scope)

- Privacy enforcement / public projector (1F-B)
- Verification admin workflow
- Legacy writer / V2 dossier cutover
- Schema SQL / Production mutation / deploy

## Verification checklist

- [x] Canonical Player Management read path only for foundation fields
- [x] Six fields render with empty/unknown labels
- [x] `identity_verification_status` read-only (no edit control)
- [x] Loading / error / unauthorized / not-found states
- [x] Focused node:test + UI smoke tests
- [x] Existing Player Management phase tests still targeted
