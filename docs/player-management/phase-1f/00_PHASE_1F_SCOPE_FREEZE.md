# Phase 1F — Scope Freeze

**Owner decision:** `APPROVE_PHASE_1F_SCOPE`  
**Decision date:** 2026-07-20  
**Branch:** `feature/player-phase-1f-profile-ui-privacy-foundation`  
**Base `origin/main` SHA (at branch cut):** `7a5e6b9e35f8db91736f05827a8b549f9b5ce107`  
**Classification:** **E — staged combination**, led by **A** then **B**  
**Verdict at discovery:** `GO WITH CONDITIONS`

---

## Context

| Item | State |
|------|-------|
| Phase 1A–1E | Complete |
| Phase 1E Production closure | Merged; preflight **`ALREADY_READY`** |
| Production profile columns | `birth_year`, `birth_date`, `handedness`, `activity_region`, `privacy_settings`, `identity_verification_status` |
| New Production schema migration for 1F | **Not required** |
| Phase 1F implementation | Not started at freeze authoring |

Discovery evidence: Player Management Phase 1F Discovery and Scope Freeze (read-only audit on `main`).

---

## Classification (frozen)

| Option | Role in Phase 1F |
|--------|------------------|
| **A. Profile UI completion** | **Primary — sub-phase 1F-A** |
| **B. Privacy and public-profile enforcement** | **Primary — sub-phase 1F-B (after 1F-A)** |
| **C. Identity verification workflow** | **Deferred** (not primary 1F) |
| **D. Legacy writer cutover** | **Deferred** (not primary 1F) |
| **E. Staged combination** | **Selected** = A → B only |

---

## Sub-phases

### 1F-A — Self profile UI + read surface

1. Map Phase 1E fields into self fetch / session model as needed.
2. Edit UI on Athlete (and align My Profile where product-appropriate) for:
   - `birth_date`
   - `handedness`
   - `activity_region`
   - `privacy_settings` toggles
   - keep `birth_year` consistent
3. Read-only display of `identity_verification_status` for self (**no** self-edit).
4. Align / remove misleading stale auth field lists that contradict the durable writer.
5. Focused UI + service tests.

### 1F-B — Privacy enforcement foundation

1. Privacy settings UI (self) — may land with 1F-A; enforcement completes here.
2. Fail-closed **public profile projector** (app and/or RPC).
3. Optional minimal public / directory surface **only** if it uses the projector.
4. Ensure `searchPlayers` / any new directory path filters by privacy (no raw `profiles` dump).

**Hard rule:** Do **not** ship public directory without the privacy projector.

---

## Explicit out of scope (this phase)

- Identity verification **admin** workflow / privileged RPC UI
- Link & dedupe tooling (original 1A label for “1F”)
- Full cutover of `PlayerProfile.jsx` off club V2 athlete stack
- Club blob write retirement / AI session player store changes
- Competition / Venue / Rating / Ranking / Notification feature work
- New Production schema migration
- Production SQL apply / deploy without a separate Owner gate
- Verification admin, link/dedupe, or full V2 dossier cutover in the same delivery wave

---

## Entry conditions

- [x] Phase 1E Production closed; official preflight `ALREADY_READY`
- [x] Owner `APPROVE_PHASE_1F_SCOPE`
- [x] Branch cut from latest `main`
- [ ] Implementation proceeds only under this freeze (A → B)
- [ ] No Production mutation without separate Owner approval

---

## Exit criteria

- Self can view/edit foundation demographics + privacy via official write path; reload shows persisted values.
- Self cannot change `identity_verification_status` (app + DB still enforced); status may be displayed read-only.
- Public/directory (if shipped in 1F-B) only returns projector-safe fields under fail-closed defaults.
- Tests cover UI + privacy projector + forbidden verification write.
- No Competition / Club / Rating ownership bleed.
- No Production SQL apply unless separately approved (expected: none).
- Docs record 1F scope vs deferred items (this file).

---

## Conditions (from discovery verdict)

1. Freeze Phase 1F as staged **A → B** only.
2. Do **not** include verification admin, link/dedupe, or full V2 dossier cutover in the same phase.
3. Do **not** ship public directory without the privacy projector.
4. No Production schema apply expected; any Production change needs a separate Owner gate.

---

## Exact Owner action next

Authorize **1F-A implementation** on this branch when ready (UI + self read surface first).  
Do **not** start 1F-B public directory until the projector is ready.  
Do **not** expand into C/D without `REVISE_SCOPE`.
