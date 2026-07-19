# Phase 1F-B1 — Implementation Evidence

**Branch:** `feature/player-phase-1f-b-privacy-public-projector`  
**Plan freeze:** `7f4a2a85d7000c6b9676746114de9b794e88cd57`  
**Sub-phase:** **1F-B1 only** (canonical public projector + tests)  
**1F-B2 / 1F-B3:** Not started

---

## Artifact

| Item | Path |
|------|------|
| Projector | `src/features/player/projectors/projectPublicPlayerProfile.js` |
| Privacy SSOT | `src/features/player/constants/privacy.js` |
| Public export | `src/features/player/index.js` → `projectPublicPlayerProfile`, `PUBLIC_PROFILE_HIDE_REASON`, `buildOpaquePublicPlayerProfile` |

## Behavior

| Case | Result |
|------|--------|
| `publicProfileEnabled !== true` | `{ visible: false, reason: PUBLIC_PROFILE_DISABLED }` |
| null / missing privacy | `{ visible: false, reason: PRIVACY_MISSING }` |
| malformed privacy | `{ visible: false, reason: PRIVACY_MALFORMED }` |
| enabled | Allow-list DTO; omitted keys (not null placeholders) |

### Always included when enabled (if present)

- `playerId`, `displayName`, `avatarUrl`

### Flag-controlled

- `phone` ← `showPhone`
- `email` ← `showEmail`
- `birthDate` ← `showBirthDate`
- `birthYear` ← `showBirthYear` (never invented from `birthDate`)
- `gender` ← `showGender`
- `handedness` ← `showHandedness`
- `activityRegion` ← `showActivityRegion`
- `clubMembershipReferences` ← `showClubMemberships`

### Always omitted

- `authUserId`, `athleteId`, `accountStatus`, `profileStatus`
- `verificationStatus` / identity verification
- raw `privacySettings`, roles, source/rating/ranking refs, timestamps, `fullName`, `ageGroup`

## Explicitly not done

- `searchPlayers` wiring (1F-B2)
- Public route / page (1F-B3)
- Club / ranking / competition UI changes
- Schema SQL / Production / deploy

## Tests

- `tests/player-management-phase-1f-b1-public-projector.test.js`
- Registered in `scripts/ci/unit-test-files.json`
