# Phase 1I — Implementation Plan

**Status:** Scope freeze on `main` (PR #112) + 1I-0 design remediated  
**Owner design decision:** `APPROVE_PHASE_1I_0_READ_MODEL_DESIGN_WITH_CHANGES`  
**1I-0 design branch:** `feature/player-phase-1i-0-read-model-design`  
**Base `origin/main` SHA:** `bfb8980852d3c17174b3f77f17331605a5923457`  
**Document verdict:** `READY_FOR_PHASE_1I_0_COMMIT`

Do **not** implement feature/SQL apply until the matching Owner gate is issued.  
**Do not authorize 1I-B before 1I-A.**

---

## 0. Locked sub-phase sequence (Owner)

| Sub-phase | Objective |
|-----------|-----------|
| **1I-0** | SQL / read-model **design** gate |
| **1I-A** | Facade / repository **application contract** |
| **1I-B** | SQL authoring and Staging apply (**after 1I-A**) |
| **1I-C** | Authenticated list UI `/athletes` |
| **1I-D** | Minimal detail UI `/athletes/:playerId` |
| **1I-E** | Privacy / Staging QA |
| **1I-F** | Closure and separate Production gate |

Platform MVP requires durable read (**1I-B**). Club-blob-only is **not** the approved product path.

---

## 1I-0 — Design gate

| Item | Detail |
|------|--------|
| Status | Design package remediated — `READY_FOR_PHASE_1I_0_COMMIT` |
| Docs | `05`–`09` under `docs/player-management/phase-1i/` |
| Mechanism | `SECURITY DEFINER` RPCs `player_directory_search` / `player_directory_get` |
| `search_path` | `pg_catalog, public` |
| RPC output | Strict Directory-safe fields only; **server-side masking**; no `privacy_settings` |
| Active rule | `EXCLUDE_SUSPENDED_ONLY` (`status IS DISTINCT FROM 'suspended'`) |
| SQL apply | **None** in 1I-0 |
| Stop gate | Commit 1I-0 docs → Owner `AUTHORIZE_PHASE_1I_A_DIRECTORY_CONTRACT` |

---

## 1I-A — Facade / repository application contract

| Item | Detail |
|------|--------|
| Objective | Directory DTO mapping, auth-first facade, repository port + test doubles aligned to strict RPC contract |
| APIs | `searchPublicDirectoryPlayers`, `getPublicDirectoryPlayer` |
| Tests | DTO exclusions; no privacy_settings in responses; auth-first; invalid cursor; pagination caps |
| SQL | **None applied**; port interfaces match 1I-0 contract |
| Dependencies | Approved + committed 1I-0 design |
| Stop gate | Unit tests green → then Owner may authorize **1I-B** |

---

## 1I-B — SQL authoring and Staging apply

| Item | Detail |
|------|--------|
| Objective | Author executable SQL package; Staging apply after separate authorize |
| Dependencies | **1I-A complete**; separate `AUTHORIZE_PHASE_1I_B_SQL_AUTHORING_ONLY` then `AUTHORIZE_PHASE_1I_B_STAGING_APPLY` |
| Package | `docs/v5/PHASE_1I_B_PLAYER_DIRECTORY_READ_MODEL*.sql` + `docs/player-management/phase-1i-b-sql/` |
| Contract note | `p_region` + emitted `activity_region` are **text\|null** (1I-A remediation) |
| Forbidden | anon table SELECT; browser service-role; authorizing before 1I-A; apply under authoring-only token |
| Stop gate | Authoring → precommit review; Staging evidence only after apply token; Production hold until 1I-F |

---

## 1I-C — List UI

`/athletes`: search, region filter, pagination, cards, loading/empty/error/authorization. Facade only.

**Implementation package:** `docs/player-management/phase-1i/07_PHASE_1I_C_DIRECTORY_LIST_UI.md`

---

## 1I-D — Detail UI

`/athletes/:playerId`: same Directory DTO; generic not-found.

---

## 1I-E — Privacy / Staging QA

Auth, masking, suspended exclusion, privacy revoke, invalid cursor, abuse limits.

---

## 1I-F — Closure / Production gate

Separate Owner Production decision. No deploy implied by earlier phases.

---

## Sequencing diagram

```
1I-0 design commit
  → 1I-A app contract (required first)
  → 1I-B SQL author + Staging apply
  → 1I-C list UI
  → 1I-D detail UI
  → 1I-E QA
  → 1I-F closure (+ separate Production)
```
