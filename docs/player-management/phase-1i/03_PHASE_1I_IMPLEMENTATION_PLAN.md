# Phase 1I — Implementation Plan

**Status:** Phase 1I sub-phases 1I-0 → 1I-E merged on `main`; 1I-F closure package in review
**Owner design decision:** `APPROVE_PHASE_1I_0_READ_MODEL_DESIGN_WITH_CHANGES`
**1I-0 design branch:** `feature/player-phase-1i-0-read-model-design`
**Closure base `origin/main` SHA:** `49d5a53b14b0b8bf40958caa574b1ee78b2dd048`
**Document verdict:** `READY_FOR_PHASE_1I_F_PRECOMMIT_REVIEW`

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
**Status on `main`:** merged (PR #121). Card → detail navigation is wired in **1I-D**.

---

## 1I-D — Detail UI

`/athletes/:playerId`: same Directory DTO; generic not-found; authenticated-only under `MainLayout`.

| Item | Detail |
|------|--------|
| Facade | `getPublicDirectoryPlayer` only |
| Auth | Same as `/athletes` (no special permission) |
| Privacy | Single generic message for null/hidden/ineligible/nonexistent |
| Cards | 1I-C cards navigate via `buildPublicDirectoryPlayerPath` |
| Package | `docs/player-management/phase-1i/08_PHASE_1I_D_DIRECTORY_DETAIL_UI.md` |
| Stop gate | Owner precommit review → then may authorize **1I-E** |

---

## 1I-E — Privacy / Staging QA & hardening

| Item | Detail |
|------|--------|
| Objective | Deterministic QA matrix + scoped hardening for `/athletes` and `/athletes/:playerId` |
| Hardening | Nav uniqueness when RBAC off; list Retry a11y; CI remediation preserves club-nav override when RBAC on |
| Staging | Project `qyewbxjsiiyufanzcjcq` only; Production `expuvcohlcjzvrrauvud` forbidden |
| Package | `docs/player-management/phase-1i/09_PHASE_1I_E_QA_HARDENING.md` |
| Tests | `tests/player-management-phase-1i-e-directory-qa-hardening.test.js` |
| Status on `main` | Merged (PR #125), including tip `2acd2cc` |

---

## 1I-F — Closure / certification

| Item | Detail |
|------|--------|
| Objective | Final audit, containment evidence, and certification of Phase 1I |
| Package | `docs/player-management/phase-1i/10_PHASE_1I_F_FINAL_CLOSURE.md` |
| Runtime / SQL / deploy | **None** in 1I-F |
| Production | Separate Owner gate — **not** authorized by 1I-F |
| Status | Completed pending Owner precommit review of this closure package |

---

## Sequencing diagram

```
1I-0 design commit
  → 1I-A app contract (required first)
  → 1I-B SQL author + Staging apply
  → 1I-C list UI
  → 1I-D detail UI
  → 1I-E QA (+ CI remediation)
  → 1I-F closure (docs/audit only)
  → separate Owner Production gate (not part of 1I-F runtime)
```
