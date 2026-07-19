# Phase 1F-B — Plan Freeze

**Owner decision:** `APPROVE_PHASE_1F_B_PLAN`  
**Decision date:** 2026-07-20  
**Branch:** `feature/player-phase-1f-b-privacy-public-projector`  
**Base `origin/main` SHA (at branch cut):** `f6ae0eec6f962b63df2637e4646f629186dcc6eb`  
**Audit verdict:** `GO WITH CONDITIONS`  
**Prerequisite:** Phase 1F-A merged (`f6ae0ee` / PR #93)

---

## Context

| Item | State |
|------|-------|
| Phase 1F freeze | Staged **A → B** (`APPROVE_PHASE_1F_SCOPE`) |
| Phase 1F-A | Merged — self profile canonical read surface |
| Privacy contract | Exists (`constants/privacy.js`) — fail-closed defaults on normalize/write |
| Public projector | **Missing** at plan freeze |
| `searchPlayers` privacy filter | **Missing** |
| Dedicated public player route | **Missing** |
| Implementation at this commit | **Docs freeze only** |

---

## Conditions (frozen)

1. Implement **canonical projector + Player Management wire-up** first.
2. Do **not** ship public directory without the projector.
3. Do **not** rewrite Club / Competition / Ranking UIs in the same wave (legacy ops remain **internal** until a separate Owner gate).
4. No Production schema migration / SQL apply / deploy expected for 1F-B.

---

## Canonical policy layer (required)

| Item | Value |
|------|--------|
| Primary module | `src/features/player/projectors/projectPublicPlayerProfile.js` |
| Optional viewer helper | `projectPlayerProfileForViewer.js` (`self` \| `internal` \| `public`) |
| Export | `src/features/player/index.js` — only public/directory projection API |
| Defaults SSOT | `src/features/player/constants/privacy.js` |

### Policy rules

1. Always `normalizePrivacySettings(privacySettings ?? null)` → fail-closed.
2. Viewer `self` → full authorized own fields (no public stripping).
3. Viewer `public`: if `!publicProfileEnabled` → opaque / not visible; else allow-list only when corresponding `show*` flags are true.
4. Never project by default: account status, verification workflow internals, phone/email/DOB unless explicitly allowed **and** public enabled.
5. `identity_verification_status`: omit from public by default; never admin workflow detail; remains read-only on self.
6. Public/directory UI consumes projected DTOs only — no per-page field policy.

---

## Sub-phases

| ID | Name | Deliverable |
|----|------|-------------|
| **1F-B1** | Policy + projector | Pure projector + matrix tests; no public UI required |
| **1F-B2** | Facade wire-up | `searchPlayers` (and new directory helpers) public/directory mode via projector; explicit **internal** mode documented if retained |
| **1F-B3** | Optional public UI | Minimal public player card/route **only** if projector-backed |

Order is mandatory: **B1 → B2 → B3**.

---

## Explicit in scope

- Canonical fail-closed public projector
- Wire Player Management public/directory reads through projector
- Optional minimal public surface behind projector
- Self privacy toggles edit UI if still missing (persist via existing write path)
- Docs: public vs internal vs self; legacy club/ops = internal
- Focused tests (allow/deny, null/malformed fail-closed, self unchanged)

## Explicit out of scope

- Identity verification admin / privileged RPC
- Legacy writer cutover / full `PlayerProfile.jsx` V2 migration
- Club blob retirement
- Broad Competition / Venue / Rating / Ranking / Notification feature rewrites
- New Production schema migration / SQL apply / deploy
- Treating club roster as public without separate Owner redesign

---

## Entry conditions

- [x] Phase 1E Production closed
- [x] Phase 1F scope frozen A → B
- [x] Phase 1F-A merged on `main`
- [x] Owner `APPROVE_PHASE_1F_B_PLAN`
- [x] Branch cut from latest `main`
- [ ] Implementation proceeds only under this freeze
- [ ] No Production mutation without separate Owner approval

---

## Exit criteria

- Single canonical projector is the only public/directory field policy.
- Null/malformed privacy fails closed on projection.
- Self still sees own authorized fields.
- Public/directory outputs never include phone/email/DOB/verification workflow by default.
- `searchPlayers` public/directory path uses projector.
- Any new public route is projector-backed.
- Tests cover allow/deny matrix + fail-closed cases.
- No expansion into C/D or cross-module rewrites.

---

## Exact Owner action next

Authorize **1F-B1 implementation** (canonical projector + tests) on this branch when ready.  
Do **not** open public UI (1F-B3) until B1+B2 pass.  
Do **not** expand into Club/Competition roster cutover without `REVISE_SCOPE`.
