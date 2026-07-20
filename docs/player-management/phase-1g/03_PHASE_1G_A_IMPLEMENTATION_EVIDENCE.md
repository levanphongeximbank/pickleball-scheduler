# Phase 1G-A — Implementation Evidence

**Branch:** `feature/player-phase-1g-self-profile-foundation-edit`  
**Base `origin/main` SHA:** `8f11ed3716f1eb338d93112b45fe6276f1f61d89`  
**Scope-freeze docs commit:** `af0d1a665b41fb513985afeacbedd6f41791a3b5`  
**Owner authorization:** `AUTHORIZE_PHASE_1G_A_IMPLEMENTATION`  
**Sub-phase:** **1G-A only** (Athlete foundation self-edit)  
**Optional 1G-B:** **Excluded** (not wired — kept scope isolated)

---

## Objective

Complete authenticated self-profile **foundation editing** on the Athlete surface via the existing durable write path only.

## Canonical write path used

```
AthleteSelfProfilePage
  → updateSelfProfile (Identity bridge)
  → updateAuthenticatedSelfPlayerProfile
  → updatePlayerProfile
  → durable profiles repository (session JWT + RLS)
```

No new direct Supabase `.from("profiles")` write.  
No Player facade bypass.

After save: `useAuthenticatedSelfPlayerProfile.reload()` then re-seed form from persisted profile.

## UI surfaces changed

| Route | Page | Change |
|-------|------|--------|
| `/player/profile` | `AthleteSelfProfilePage` | Foundation edit card + single save; removed duplicate Năm sinh from personal card |
| `/profile` (My Profile) | unchanged | **1G-B excluded** |

## Editable fields delivered

| Field | Editable | Notes |
|-------|----------|-------|
| `birth_date` | Yes | Date input; authoritative when set |
| `birth_year` | Yes | Synced from date when date present; year-only when date empty |
| `handedness` | Yes | Select: right / left / ambidextrous / unknown |
| `activity_region` | Yes | provinceName, city, district, countryCode |
| `privacy_settings` | Yes | All supported boolean keys from privacy SSOT |
| `identity_verification_status` | **No** | Read-only label only |

Preserved: avatar, display name, phone, gender, rating summary, club card, password change.

## birth_date / birth_year rule (canonical)

1. **`birthDate` is authoritative when present.**  
2. Changing `birthDate` always derives `birthYear` from that date (YYYY of ISO date).  
3. **Never invent `birthDate` from `birthYear` alone.**  
4. `birthYear` alone is allowed when `birthDate` is empty.  
5. When both are present, years must match; conflict rejected client-side (`buildSelfFoundationUpdatePatch`) and again by `normalizeAndValidateWritePatch`.  
6. UI locks Năm sinh input while Ngày sinh is set (clear date to edit year independently).

Documented in: `src/features/player/utils/selfFoundationForm.js`.

## Privacy setting behavior

- Uses `DEFAULT_PRIVACY_SETTINGS` / `normalizePrivacySettings` / `validatePrivacySettings`.  
- Toggle keys: `SELF_FOUNDATION_PRIVACY_KEYS` (fail-closed defaults unchanged).  
- Public/directory projector still omits raw `privacySettings` (regression covered).

## Verification write protection

1. Edit UI has **no** verification control (label only).  
2. `buildSelfFoundationUpdatePatch` never includes verification fields.  
3. `stripVerificationFromSelfPatch` strips injection before `updateSelfProfile`.  
4. `updatePlayerProfile` still returns `FORBIDDEN_FIELD` for verification keys.  
5. DB trigger remains authoritative for Production self-modify block (unchanged; no SQL this wave).

## Field validation rules

| Concern | Rule |
|---------|------|
| birthDate | YYYY-MM-DD, real calendar day, not future |
| birthYear | integer 1900…current year |
| handedness | strict canonical values |
| activityRegion | structured object via `validateActivityRegion` |
| privacySettings | boolean keys only via `validatePrivacySettings` |
| Client fail | Invalid patch → error Alert; **no** persist call |

## Files changed / added

### Added

- `src/features/player/utils/selfFoundationForm.js`
- `src/features/player/components/SelfPlayerProfileFoundationEdit.jsx`
- `tests/player-management-phase-1g-a-self-profile-edit.test.js`
- `tests/ui/player-phase-1g-a-self-profile-edit.smoke.test.jsx`
- `docs/player-management/phase-1g/03_PHASE_1G_A_IMPLEMENTATION_EVIDENCE.md`

### Changed

- `src/pages/player/AthleteSelfProfilePage.jsx`
- `src/features/player/index.js` — public exports for form helpers
- `tests/player-management-phase-1c-profile-fields.test.js` — approved export list
- `scripts/ci/unit-test-files.json` — register 1G-A test

### Scope-freeze docs (separate prior commit)

- `docs/player-management/phase-1g/00_PHASE_1G_SCOPE_FREEZE.md`
- `docs/player-management/phase-1g/01_IN_SCOPE_OUT_OF_SCOPE.md`
- `docs/player-management/phase-1g/02_SUBPHASE_PLAN.md`

## Focused tests

| Suite | Result |
|-------|--------|
| `tests/player-management-phase-1g-a-self-profile-edit.test.js` | **18/18 pass** |
| `tests/ui/player-phase-1g-a-self-profile-edit.smoke.test.jsx` | **3/3 pass** |

Coverage includes: birth_date edit, birth_year sync, handedness, activity_region, privacy, updateSelfProfile bridge, durable persist + reload seed path assertions, verification strip/forbid, validation failure, projector/directory unchanged.

## Regressions

| Suite | Result |
|-------|--------|
| Phase 1F-A + 1F-B1 + 1F-B2 + all `tests/player-management*.test.js` | **161/161 pass** |
| 1F-A UI smoke | **pass** |
| ESLint (changed files) | **pass** |

## Explicitly not done

- Optional **1G-B** My Profile parity  
- Verification admin (1F-C / 1G-C)  
- Public directory UI (1F-B3 / 1G-E)  
- `PlayerProfile.jsx` cutover / blob retirement (1F-D / 1G-D)  
- SQL / schema / Production mutation / deploy  

## Boundary checks

| Check | Result |
|-------|--------|
| New SQL files | **No** |
| Schema changes | **No** |
| Production mutation | **No** |
| Deployment | **No** |
| Direct profiles write from Athlete page | **No** |

## Closure status

**1G-A closed** on `main` at `288f601` (PR #101).  
Optional **1G-B excluded**. **1G-C / 1G-D / 1G-E deferred**.  
Formal phase closure: `08_PHASE_1G_CLOSURE.md` (docs PR pending merge).
