# Phase 1G — Scope Freeze

**Owner decision:** `APPROVE_PHASE_1G_SCOPE`  
**Decision date:** 2026-07-20  
**Branch:** `feature/player-phase-1g-self-profile-foundation-edit`  
**Base `origin/main` SHA (at branch cut):** `8f11ed3716f1eb338d93112b45fe6276f1f61d89`  
**Classification:** **A — Self Profile Foundation Edit UI Completion**  
**Verdict at discovery:** `APPROVE_PHASE_1G_SCOPE`

---

## Context

| Item | State |
|------|-------|
| Phase 1A–1E | Complete |
| Phase 1E Production closure | Merged; preflight **`ALREADY_READY`** |
| Phase 1F | Closed (`PHASE_1F_CLOSED`) — self **read** + privacy projector + directory wire-up |
| Phase 1F-B3 | Skipped (optional public UI) |
| Phase 1F-C / 1F-D | Deferred |
| Production profile columns | Ready (`birth_year`, `birth_date`, `handedness`, `activity_region`, `privacy_settings`, `identity_verification_status`) |
| New Production schema migration for 1G | **Not required** |
| Durable self write path | Already exists (`updateSelfProfile` → `updateAuthenticatedSelfPlayerProfile` → `updatePlayerProfile`) |

Discovery evidence: Player Management Phase 1G Discovery and Scope Recommendation Audit (read-only on `main` at `8f11ed3`).

---

## Classification (frozen)

| Option | Role in Phase 1G |
|--------|------------------|
| **A. Profile edit UI completion** | **Primary — selected** |
| **B. Public player directory UI** | **Deferred** (was 1F-B3) |
| **C. Identity verification workflow** | **Deferred** (was 1F-C) |
| **D. Avatar / media integration** | **Later** — optional parity only if needed inside 1G-B |
| **E. Admin player management** | **Deferred** |
| **F. Duplicate identity resolution** | **Deferred** (1F-D class) |
| **G. Player association integration** | **Deferred** |
| **H. Audit / change history** | **Deferred** |
| **I. Legacy writer / V2 dossier cutover** | **Deferred** (was 1F-D) |

---

## Sub-phases

### 1G-A — Foundation self-edit UI + privacy toggles (PRIMARY)

1. Edit controls on Athlete (`/player/profile`) for:
   - `birth_date`
   - `handedness`
   - `activity_region`
   - `privacy_settings` toggles
   - keep `birth_year` consistent with existing date rules
2. Wire saves through existing `updateSelfProfile` → canonical Player durable path only.
3. Reload via `useAuthenticatedSelfPlayerProfile` / foundation panel confirms persistence.
4. Keep `identity_verification_status` **read-only** (no self-edit).
5. Focused UI + service tests for edit, persist, validation failures, and forbidden verification write.

### 1G-B — My Profile parity + stale field-list cleanup (OPTIONAL, same wave if small)

1. Align My Profile (`/profile`) edit surface with Athlete for foundation fields where product-appropriate.
2. Align / document stale Identity companion lists (e.g. `SELF_EDITABLE_PROFILE_FIELDS`) that omit Phase 1E foundation columns.
3. Optional avatar parity only if needed for My Profile; no new media subsystem.

### Deferred (not Phase 1G without `REVISE_SCOPE`)

| Label | Item |
|-------|------|
| **1G-C** | Identity verification admin workflow (was 1F-C) |
| **1G-D** | Legacy writer / V2 dossier / blob cutover (was 1F-D) |
| **1G-E** | Public directory UI (was 1F-B3) |

**Hard rule:** Do **not** expand into C / D / E without Owner `REVISE_SCOPE`.

---

## Explicit out of scope (this phase)

- Identity verification **admin** workflow / privileged RPC UI
- Link & dedupe tooling
- Full cutover of `PlayerProfile.jsx` off club V2 athlete stack
- Club blob write retirement / AI session player store changes
- Public player directory route (unless Owner `REVISE_SCOPE`)
- Competition / Venue / Rating / Ranking / Notification feature work
- New Production schema migration
- Production SQL apply / deploy without a separate Owner gate
- Mixing verification admin or legacy cutover into the same delivery wave

---

## Entry conditions

- [x] Phase 1F closed; projector + viewer modes on `main`
- [x] Phase 1E Production columns ready; no new schema expected
- [x] Owner `APPROVE_PHASE_1G_SCOPE`
- [x] Branch cut from latest `main` (`8f11ed3`)
- [ ] Implementation proceeds only under this freeze (1G-A, optional 1G-B)
- [ ] No Production mutation without separate Owner approval

---

## Exit criteria

- Self can **view and edit** foundation demographics + privacy via official write path; reload shows persisted values.
- Self cannot change `identity_verification_status` (app + DB still enforced); status remains displayed read-only.
- Saves use `updateSelfProfile` → `updateAuthenticatedSelfPlayerProfile` → `updatePlayerProfile` only.
- Tests cover UI + foundation edit persist + forbidden verification write.
- No Competition / Club / Rating ownership bleed.
- No Production SQL apply (expected: none).
- Docs record 1G scope vs deferred items (this file).

---

## Conditions (from discovery verdict)

1. Freeze Phase 1G as classification **A** only (optional 1G-B if small).
2. Do **not** include verification admin, link/dedupe, public directory, or full V2 dossier cutover in the same phase.
3. No Production schema apply expected; any Production change needs a separate Owner gate.
4. Do not reopen Phase 1F; this is a new wave completing deferred self-edit debt.

---

## Exact Owner action next

Authorize **1G-A implementation** on this branch when ready (foundation self-edit UI first).  
Do **not** expand into C / D / E without `REVISE_SCOPE`.
