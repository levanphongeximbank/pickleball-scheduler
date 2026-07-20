# Phase 1I — Implementation Plan

**Status:** Owner-approved scope freeze plan (`APPROVE_PHASE_1I_SCOPE_WITH_CHANGES`)  
**Branch (docs only):** `feature/player-phase-1i-public-directory-discovery`  
**Base `origin/main` SHA:** `0c37f1dfb152c24a9b9eccde5b0d1b3180773d7d`  
**Remediation date:** 2026-07-20 (UTC+7)  
**Document verdict:** `READY_FOR_SCOPE_FREEZE_COMMIT`  

Do **not** implement feature code on the discovery branch unless Owner explicitly redirects after freeze commit.

---

## 0. Locked sub-phase plan (Owner-approved)

| Sub-phase | Objective |
|-----------|-----------|
| **1I-0** | Owner-approved SQL/read-model **design** gate |
| **1I-A** | Strict directory read contract, DTO, facade, and repository port |
| **1I-B** | Durable SQL/RLS read model, **separately authorized** |
| **1I-C** | Authenticated directory list UI at `/athletes` |
| **1I-D** | Minimal public Player detail UI at `/athletes/:playerId` |
| **1I-E** | Staging privacy, auth, pagination, and abuse QA |
| **1I-F** | Final closure and **separate** Production rollout decision |

Platform MVP requires durable read (**1I-B**). Club-blob-only is **not** the approved product path.

---

## 1I-0 — Owner-approved SQL/read-model design gate

| Item | Detail |
|------|--------|
| Objective | Freeze design intent for authenticated directory reads: RPC vs view, column allow-list, filters (`publicProfileEnabled`, verified), pagination, **no** anon table grants, **no** browser service-role |
| Files | Design docs under `docs/player-management/phase-1i/` (and/or future `phase-1i-sql` design-only package) — **no apply** |
| Tests | None (design gate) |
| SQL expectation | Design only — **do not write apply scripts unless Owner expands 1I-0**; **do not apply** |
| Dependencies | Approved scope freeze |
| Stop gate | Written Owner authorization to proceed to **1I-A** and (separately) to author/apply **1I-B** |

---

## 1I-A — Strict directory read contract / DTO / facade / repository port

| Item | Detail |
|------|--------|
| Objective | Directory projector/DTO (no `visible` to consumers), `listDirectoryPlayers` / `getDirectoryPlayerById` (names flexible), auth-first checks, search/region/pagination ports, repository **port** with test doubles |
| Files likely affected | `src/features/player/projectors/*`, `services/*`, `repositories/*`, `index.js`, `tests/player-management-phase-1i-*.test.js` |
| Tests | DTO exclusions; no `visible` on returned DTOs; eligibility; search isolation; pagination caps; auth-first fail closed |
| SQL expectation | **None applied**; port may define adapter interface for 1I-B |
| Dependencies | Scope freeze commit; 1I-0 design gate preferred before locking adapter assumptions |
| Stop gate | Unit tests green; no UI; no Production SQL |

### API sketch (non-binding names)

```js
listDirectoryPlayers({ query, activityRegion, cursor|offset, limit }, { session })
getDirectoryPlayerById(playerId, { session })
```

Both return **only** eligible Directory DTOs (or empty / not-found outcomes) — never `{ visible: false }` to UI.

---

## 1I-B — Durable SQL/RLS read model (separately authorized)

| Item | Detail |
|------|--------|
| Objective | Staging-first durable read for authenticated directory: narrow columns; server-side eligibility filters; grants for authenticated callers as designed; **no** anonymous table access |
| Files likely affected | Future `docs/player-management/phase-1i-sql/*` (only after Owner authorize); repository adapter wiring |
| Tests | Static SQL review; Staging smoke (not Production) |
| SQL expectation | **`SQL_REQUIRED`** — separately Owner-authorized; Staging apply before Production consideration |
| Dependencies | 1I-0 design approval; separate `AUTHORIZE_*_SQL_*` decision |
| Stop gate | Staging evidence; Production **hold** until 1I-F separate decision |

**Forbidden:** anon `SELECT` on full `profiles`; browser `service_role`.

---

## 1I-C — Authenticated directory list UI

| Item | Detail |
|------|--------|
| Objective | `/athletes` list: search, region filter, pagination, cards, loading/empty/error/authorization |
| Files likely affected | `src/router.jsx`, `PublicHeader.jsx`, new directory page/components |
| Tests | Facade-only wiring; auth state; no direct Supabase |
| SQL expectation | None in UI; consumes 1I-A + 1I-B adapter |
| Dependencies | 1I-A; 1I-B for real Staging data |
| Stop gate | List works on Staging; privacy exclusions verified |

---

## 1I-D — Minimal Player detail UI

| Item | Detail |
|------|--------|
| Objective | `/athletes/:playerId` using same Directory DTO |
| Files likely affected | Router + detail page/component |
| Tests | Not-found / unauthorized / field allow-list render |
| SQL expectation | None in UI |
| Dependencies | 1I-A (+ 1I-B); 1I-C recommended first |
| Stop gate | Detail does not leak excluded fields |

---

## 1I-E — Staging privacy, auth, pagination, and abuse QA

| Item | Detail |
|------|--------|
| Objective | Manual + automated privacy/auth/pagination/abuse proof on Staging |
| Files | QA checklist under `docs/player-management/phase-1i/` |
| Tests | Unit suites + QA script |
| SQL expectation | Staging only (if 1I-B applied) |
| Dependencies | 1I-C / 1I-D |
| Stop gate | Checklist signed; no Production apply |

### QA themes

- Unverified / privacy-off absent  
- Verified + public-on present  
- No email/phone/birth/`authUserId`/`visible`/club/venue/rating in payloads or DOM  
- Search cannot find by email/phone/auth id  
- Pagination caps + deterministic order  
- Unauthenticated denied under auth-first  
- Basic abuse controls exercised (rate/limit behavior as implemented)  

---

## 1I-F — Final closure and separate Production rollout decision

| Item | Detail |
|------|--------|
| Objective | Evidence package; deferred items; **separate** Owner decision on Production rollout |
| Files | Final closure doc |
| Tests | Regression counts |
| SQL expectation | Confirm no unauthorized Production SQL/deploy |
| Dependencies | 1I-E |
| Stop gate | Owner `AUTHORIZE_PHASE_1I_CLOSURE`; Production only if separately authorized |

---

## Sequencing

```
Scope freeze commit
  → 1I-0 design gate
  → 1I-A app contract / port
  → 1I-B SQL/RLS (separate authorize → Staging)
  → 1I-C list UI
  → 1I-D detail UI
  → 1I-E Staging QA
  → 1I-F closure (+ separate Production decision)
```

Do not start UI before Directory DTO exclusion tests exist.

---

## Explicit non-implementation in this docs wave

Documentation remediation only: **no** source, UI, routes, APIs, SQL, schema, Supabase mutation, deploy, commit, push, or PR unless Owner later requests commit of these docs.
