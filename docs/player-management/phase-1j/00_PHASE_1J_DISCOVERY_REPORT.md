# Phase 1J — Discovery Report

**Owner authorization (discovery):** `AUTHORIZE_PHASE_1J_DISCOVERY`  
**Owner scope decision:** `APPROVE_PHASE_1J_SCOPE`  
**Classification:** Discovery & scope freeze only (documentation)  
**Branch:** `feature/player-phase-1j`  
**Base `origin/main` SHA:** `5f702da575d9e9c176a8faf5742f27bdb7d74129`  
**Discovery / freeze date:** 2026-07-21 (UTC+7)  
**Prerequisite:** Phase 1I closed on main; Phase 1I-B Production directory SQL applied under separate Owner tokens  
**Document verdict:** `READY_FOR_SCOPE_FREEZE_COMMIT`

---

## 0. Executive summary

Phases **1A–1I** delivered the Player Management foundation through an **authenticated Public Player Directory** (`/athletes`, `/athletes/:playerId`) with durable Production RPCs (`player_directory_search` / `player_directory_get`).

Remaining gap after 1I product MVP + Production SQL apply:

| Gap | Evidence |
|-----|----------|
| Live eligible public rows | Staging and Production SQL smoke observed **empty** eligible sets |
| Production browser matrix | PLAYER / non-PLAYER / anonymous / president / mobile **NOT VERIFIED** in 1I-B apply report |
| Privacy live sampling | Unit/contract tests strong; live masking evidence limited without fixtures |

Phase 1J freezes **Candidate A — Production directory operational hardening** as the sole primary scope.

**Naming disambiguation:** CRM docs reference a separate “Phase 1J” for CRM UI migration. That is **out of scope** for Player Management Phase 1J.

---

## 1. Candidate inventory (discovery)

| ID | Candidate | Disposition |
|----|-----------|-------------|
| **A** | Production directory operational hardening (fixtures, browser smoke, empty-state proof; optional indexes) | **SELECTED — frozen** |
| B | Verification ops UX polish (rejection reason, pagination, bulk) | Deferred |
| C | Self-profile polish | Deferred (optional thin follow-on only via `REVISE_SCOPE`) |
| D | Anonymous / hybrid PublicLayout directory | Deferred (`SQL_REQUIRED`) |
| E | Full Admin Player Management | Deferred |
| F | Legacy V2 dossier / club-blob write cutover | Deferred |
| G | Duplicate link / merge tooling | Deferred |
| H | Self-service verification | Deferred (`SQL_REQUIRED`) |

---

## 2. Why Candidate A

1. Completes the **directory product line** without reopening high-risk deferred cutovers.  
2. Addresses the only remaining **operational truth** gaps after 1I-B Production apply.  
3. Keeps Directory DTO, privacy contract, and facade architecture **unchanged**.  
4. Aligns with Phase 1I-F handoff language (fixture pack **or** 1J operational checklist).

---

## 3. Prerequisites confirmed

| Phase | Status for 1J entry |
|-------|---------------------|
| 1A–1E | Foundation + Production profile columns |
| 1F–1G | Self read/edit + public projector |
| 1H | Admin verification workflow |
| 1I | Authenticated directory UI + Staging SQL + closure |
| 1I-B Production apply | RPCs + indexes applied on `expuvcohlcjzvrrauvud` under Owner tokens |

---

## 4. Hard non-goals (discovery)

- No anonymous directory in 1J.  
- No Directory DTO expansion.  
- No Production profile seeding without a **separate** Owner write token (default: Staging fixtures only).  
- No CRM UI migration.  
- No legacy blob/dossier cutover, dedupe, full admin rewrite, or self-service verification.

---

## 5. Exact Owner action after freeze commit

1. Merge scope-freeze docs.  
2. Authorize **1J-A** Staging fixtures only when ready (`AUTHORIZE_PHASE_1J_STAGING_FIXTURES` or equivalent).  
3. Do **not** authorize runtime/SQL implementation under this freeze document alone.

---

## Key references

| Path | Role |
|------|------|
| `docs/player-management/phase-1i/10_PHASE_1I_F_FINAL_CLOSURE.md` | 1I-F next-phase recommendation |
| `docs/player-management/phase-1i/02_PHASE_1I_DATA_PRIVACY_CONTRACT.md` | Directory privacy freeze (unchanged) |
| `docs/v5/PHASE_1I_B_PLAYER_DIRECTORY_READ_MODEL.sql` | Durable directory RPCs (do not reopen casually) |
| `src/features/player/services/searchPublicDirectoryPlayers.js` | List facade |
| `src/features/player/services/getPublicDirectoryPlayer.js` | Detail facade |
