# Phase 1F-B2 — Implementation Evidence

**Branch:** `feature/player-phase-1f-b2-directory-wireup`  
**Base `origin/main`:** recorded at branch cut  
**Sub-phase:** **1F-B2 only** (directory/search facade wire-up)  
**1F-B3:** Not started

---

## Caller audit

| Caller | Classification |
|--------|----------------|
| `tests/player-management-phase-1b-facade.test.js` | Test / **internal** (updated to `mode: "internal"`) |
| Production pages / Club / Competition / Ranking | **None** — `searchPlayers` was unused outside Player Management tests |

No ambiguous production PII callers found. Safe to require explicit mode.

---

## Viewer / read mode contract

| Mode | Constant | Behavior |
|------|----------|----------|
| `public` | `PLAYER_PROFILE_VIEWER_MODE.PUBLIC` | Every hit → `projectPublicPlayerProfile`; **exclude** non-visible |
| `directory` | `PLAYER_PROFILE_VIEWER_MODE.DIRECTORY` | Same projector policy as public |
| `internal` | `PLAYER_PROFILE_VIEWER_MODE.INTERNAL` | Full `normalizePlayerProfile`; **explicit only** |
| omitted / unknown | — | **Fail closed** (`ok: false`, empty `data`) |

**Default mode:** none. `options.mode` or `options.viewerMode` required.

**Hidden-profile policy (public/directory):** `meta.hiddenProfilePolicy = "exclude"` — hidden profiles are omitted from `data` (not returned as opaque list rows). Counted in `meta.hiddenCount`.

**Self-profile:** unchanged — still `getAuthenticatedSelfPlayerProfile` / Identity self path; **not** routed through `searchPlayers` or the public projector.

---

## APIs

| Export | Role |
|--------|------|
| `searchPlayers(filters, { mode, players, … })` | Core facade (mode required) |
| `searchPublicPlayers` | Wrapper → `mode: public` |
| `searchDirectoryPlayers` | Wrapper → `mode: directory` |
| `searchInternalPlayers` | Wrapper → `mode: internal` (ops only) |
| `PLAYER_PROFILE_VIEWER_MODE` / `resolvePlayerProfileViewerMode` | Mode contract |

---

## Files

| Path | Change |
|------|--------|
| `src/features/player/constants/viewerModes.js` | New |
| `src/features/player/services/searchPlayers.js` | Mode + projector wire-up |
| `src/features/player/index.js` | Exports |
| `tests/player-management-phase-1f-b2-directory-wireup.test.js` | New |
| `tests/player-management-phase-1b-facade.test.js` | Explicit `internal` mode |
| `tests/player-management-phase-1c-profile-fields.test.js` | Export list |
| `scripts/ci/unit-test-files.json` | Register test |
| `docs/player-management/phase-1f/02_SUBPHASE_PLAN.md` | Status |
| `docs/player-management/phase-1f/07_PHASE_1F_B2_IMPLEMENTATION_EVIDENCE.md` | This file |

## Explicitly not done

- Public player page / directory UI (1F-B3)
- Club roster / Competition / Ranking rewrites
- Schema SQL / Production / deploy
