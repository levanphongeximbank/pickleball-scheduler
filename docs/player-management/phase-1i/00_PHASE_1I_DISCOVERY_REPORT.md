# Phase 1I — Discovery Report

**Owner authorization (discovery):** `AUTHORIZE_PHASE_1I_DISCOVERY_AND_SCOPE_FREEZE`  
**Owner scope decision:** `APPROVE_PHASE_1I_SCOPE_WITH_CHANGES`  
**Classification:** Discovery & scope freeze only (documentation)  
**Branch:** `feature/player-phase-1i-public-directory-discovery`  
**Base `origin/main` SHA:** `0c37f1dfb152c24a9b9eccde5b0d1b3180773d7d`  
**Discovery date:** 2026-07-20 (UTC+7)  
**Scope remediation date:** 2026-07-20 (UTC+7)  
**Phase 1H closure present on main:** `docs/player-management/phase-1h/06_PHASE_1H_FINAL_CLOSURE.md` ✅  

**MVP verdict (Owner-approved):** `APPROVE_PHASE_1I_SCOPE_WITH_CHANGES`  
**Document verdict:** `READY_FOR_SCOPE_FREEZE_COMMIT`

---

## 0. Executive summary

Phase 1F delivered a **fail-closed public projector** and an **injected-roster search facade**. Phase 1G delivered self privacy edit. Phase 1H delivered admin verification. **No public directory UI, durable public list API, or anon/authenticated cross-user public read path exists.**

Owner has approved Phase 1I scope **with changes**. Frozen product direction:

| Topic | Owner-approved |
|-------|----------------|
| Access | **Hybrid architecture**; **authenticated-first** MVP; **anonymous deferred** |
| Routes | `/athletes`, `/athletes/:playerId` |
| Directory model | **Platform-wide** Player identity directory; **no** venue/club participation in DTO |
| Eligibility | `publicProfileEnabled === true` **and** `verificationStatus === "verified"` (+ safe inactive/ineligible exclusion if contract supports) |
| Surfaces | List + minimal detail; search; region filter; deterministic pagination; verification badge; loading/empty/error/auth states |
| DTO | Strict Directory DTO (**no `visible` field** returned to UI — non-visible profiles filtered out before return) |
| Rating / club / SEO / anon | **EXCLUDED / DEFERRED** |
| SQL/RLS | Durable public-directory read gate **required**; SQL only in **separately authorized** sub-phase **1I-B** |

Implementation must not start until scope-freeze docs are committed and Owner authorizes the next sub-phase (1I-0 / 1I-A).

---

## 1. Existing public Player read APIs

### 1.1 Missing APIs (grep: no exports)

| Desired API | Status |
|-------------|--------|
| `listPublicPlayers` | **Does not exist** |
| `getPublicPlayerProfile` | **Does not exist** |
| `getPublicPlayerById` | **Does not exist** |
| Directory list/get facade (1I) | **Does not exist** — planned in **1I-A** |

### 1.2 Existing equivalents

#### `searchPlayers`

| Attribute | Value |
|-----------|--------|
| File | `src/features/player/services/searchPlayers.js` |
| Exported name | `searchPlayers` |
| Input | `filters = { query\|q, clubId, gender }`, `options = { mode\|viewerMode (required), players[], limit }` |
| Output DTO | `{ ok, outcome, code, message, data[], meta }` — `data` projected or full profiles |
| Authorization | **None** on the function; mode must be explicit; caller owns roster + authz |
| Storage dependency | **Injected** `options.players` only — no Supabase |
| Pagination | `limit` only (clamped **1–200**, default 50); **no** offset/cursor |
| Search | Case-insensitive substring on `displayName` + `playerId` (public modes); internal also matches `authUserId` |
| Filter | `gender`; `clubId` seeds membership refs only — **does not filter** roster |
| UI usage | **None** in production UI (tests only) |

#### `searchPublicPlayers` / `searchDirectoryPlayers` / `searchInternalPlayers`

| Export | File | Notes |
|--------|------|-------|
| `searchPublicPlayers` | `searchPlayers.js` | Forces `mode: "public"`; projected DTOs; hidden excluded |
| `searchDirectoryPlayers` | same | Same projector policy as public |
| `searchInternalPlayers` | same | Full normalized profiles — ops only |

All use **injected roster** only. **Not** sufficient as the durable platform directory read path.

#### `projectPublicPlayerProfile` / `buildOpaquePublicPlayerProfile`

| Attribute | Value |
|-----------|--------|
| File | `src/features/player/projectors/projectPublicPlayerProfile.js` |
| Also re-exported | `src/features/player/index.js` |
| Auth / storage | Pure functions — no auth, no DB |

#### Related non-public reads (must not be used as directory UI source)

| API | File | Notes |
|-----|------|-------|
| `getPlayerProfile` / `getPlayerProfileByAuthUser` | `getPlayerProfile.js` | Full normalized profile — **not** Directory DTO |
| `getAuthenticatedSelfPlayerProfile` | `getAuthenticatedSelfPlayerProfile.js` | Self only |
| `listPlayerVerificationQueue` | `listPlayerVerificationQueue.js` | Admin privileged |

### 1.3 Facade surface

`src/features/player/index.js` exports search wrappers + public projector + privacy/verification constants. **No** dedicated directory repository or list/get-by-id facade exists yet (1I-A).

---

## 2. Existing public projector

| Item | Detail |
|------|--------|
| File | `src/features/player/projectors/projectPublicPlayerProfile.js` |
| Function | `projectPublicPlayerProfile(profile, options = {})` |
| Opaque output | `{ visible: false, reason }` |
| Visible allow-list | May include `playerId`, `displayName`, `avatarUrl`, and privacy-gated `phone`/`email`/`birth*`/`gender`/`handedness`/`activityRegion`/`clubMembershipReferences` |

### Relevance to Owner-approved Directory DTO

| Concern | General public projector | Owner-approved Directory (1I) |
|---------|--------------------------|-------------------------------|
| Phone/email/birth | Possible if toggles true | **Never** |
| Clubs | Possible if toggle true | **Never** |
| Verification | Never projected | **`isVerified` boolean** |
| `visible` on consumer DTO | Returned on opaque/visible shapes | **Do not return `visible` to UI** — filter non-eligible out |
| Ratings / authUserId | Never | Never |

1I-A must introduce a **strict Directory projector/DTO** (or post-filter wrapper). Do not ship UI that consumes raw `projectPublicPlayerProfile` output as the card/detail contract.

---

## 3. Privacy contract (aligned to Owner freeze)

| Topic | Finding / freeze |
|-------|------------------|
| Visibility flag | `privacySettings.publicProfileEnabled` (default `false`, opt-in) |
| `showInPublicDirectory` | **Not required** — `publicProfileEnabled` is the approved flag |
| SCHEMA_DEPENDENCY for eligibility flag | **None** |
| Enforcement today | Projector + public/directory search exclude; RLS does not column-filter |
| Directory stricter rule | Absolute exclude contact/birth; no clubs; no raw privacy object |

Storage: `public.profiles.privacy_settings` (Phase 1E). Self edit: Phase 1G.

---

## 4. Verification dependency

| Topic | Finding / freeze |
|-------|------------------|
| Canonical app field | `verificationStatus` |
| DB column | `public.profiles.identity_verification_status` |
| MVP filter | **Must be `verified`** |
| Public badge | Owner-approved: **`isVerified: true`** on Directory DTO only (never raw status / rejection reason) |
| Durable Production filter | Requires **1I-B** SQL/RLS read model |

---

## 5. Rating exposure

**Owner decision:** `EXCLUDED / DEFERRED`

---

## 6. Club exposure

**Owner decision:** `EXCLUDED / DEFERRED`  
No club name, membership, role, or venue participation on Directory DTO.

---

## 7. Tenant and venue model

| Topic | Owner-approved |
|-------|----------------|
| Scope | **Platform-wide** Player identity directory |
| Venue/club in DTO | **Forbidden** |
| Tenant leakage mitigation | Omit venueId, club fields, membership edges from all directory responses |

---

## 8. Authentication model

| Option | Owner decision |
|--------|----------------|
| Architecture | **Hybrid** |
| Phase 1I MVP | **Authenticated-first** |
| Anonymous | **DEFERRED** (separate later phase; not 1I MVP) |

Do not grant anonymous table access. Do not use service-role credentials in browser code.

---

## 9. Routes and navigation

| Route | Role |
|-------|------|
| `/athletes` | Directory list (authenticated-first) |
| `/athletes/:playerId` | Minimal Player detail |
| Do not use | `/players`, `/players/profile/:playerId`, `/player/profile` |

Shell: `PublicLayout` + narrow `PublicHeader` nav addition (implementation later). SEO deferred.

---

## 10. Existing UI components

Ops `PlayerCard` / `PlayerFilters` are **not** privacy-safe for directory. New directory components required in 1I-C / 1I-D. No reusable public verification badge today.

---

## 11. Repository / Supabase boundary

**Frozen target:**

```
UI → Player facade/service → repository port → durable read model (1I-B SQL/RLS)
```

No UI→Supabase Player reads for directory. Legacy direct `profiles` reads elsewhere remain out of 1I remediation scope (report-only in discovery).

---

## 12. RLS and Production dependency

| Classification | Value |
|----------------|--------|
| Platform durable directory | **`SQL_REQUIRED`** |
| This documentation task | No SQL written/applied |
| Sub-phase for SQL | **1I-B** (separately Owner-authorized) |
| Anon table grants | **Forbidden** |
| Browser service-role | **Forbidden** |

Preferred future shape (design intent only): authenticated-callable RPC or safe view returning **allow-listed columns** for rows with `publicProfileEnabled` + `identity_verification_status = 'verified'`.

---

## 13. Pagination and search

| Capability | Owner-approved MVP |
|------------|-------------------|
| Search | `displayName` (case-insensitive; never match auth IDs / email / phone) |
| Filter | `activityRegion` (on allow-listed projected region only) |
| Pagination | Deterministic; hard page-size cap |
| Sort | Stable (e.g. `displayName`, `playerId`) |

Current `searchPlayers` is limit-only on injected arrays — insufficient for platform MVP without 1I-A/1I-B.

---

## 14. Data leakage / DTO consumer rule

**Hard rule (Owner):** Do **not** return a `visible` field to UI consumers. Filter non-visible / ineligible profiles **before** returning results.

List returns only Directory DTO objects. Detail returns one Directory DTO or a generic not-found/unauthorized outcome — **not** `{ visible: false, reason }` to the UI.

---

## 15. Abuse and scraping risks

Authenticated-first reduces casual scraping. Still require pagination caps, search rate limits, generic not-found, no export APIs (implement in later sub-phases; QA in 1I-E).

---

## 16. SEO

**Owner decision:** `DEFERRED`

---

## 17. Detail page

**Owner decision:** List **+** minimal detail (`/athletes/:playerId`), same Directory DTO field set.

---

## 18. Phase dependency matrix

| Dependency | Classification |
|------------|----------------|
| Phase 1E Production foundation | **READY** |
| Phase 1F public projector/facade | **PARTIAL** (policy reusable; Directory DTO + durable repo missing) |
| Phase 1G privacy contracts | **READY** |
| Phase 1H verification workflow | **PARTIAL** (status ready; public badge via Directory DTO in 1I-A) |
| Club / Rating / Competition | **DEFERRED** |
| Production RLS public/peer directory read | **BLOCKING** until **1I-B** authorized and applied on Staging |

---

## 19. Owner-approved MVP assessment

**Verdict:** `APPROVE_PHASE_1I_SCOPE_WITH_CHANGES` (locked).

Material changes vs initial discovery proposal:

1. No `visible` on UI-facing Directory DTO.  
2. Sub-phase plan locked as **1I-0 … 1I-F** (SQL as **1I-B**).  
3. Platform-wide identity directory with **zero** club/venue DTO fields.  
4. Anonymous explicitly deferred; hybrid authenticated-first for MVP.

---

## 20. Remaining Owner decisions

Not blocking scope-freeze **commit**, but required before later gates:

1. **1I-0 / 1I-B:** Authorize SQL/read-model **design** then separately authorize Staging apply.  
2. Confirm inactive/ineligible exclusion fields if any beyond privacy + verification (use existing contract only — no new schema in 1I without separate gate).  
3. Authorize implementation start for **1I-A** after freeze commit.  
4. Production rollout remains a **separate** decision at **1I-F** (no deploy implied by 1I).

---

## 21. Safety confirmations (this remediation)

| Check | Result |
|-------|--------|
| Feature / UI / routes / APIs | **None added** |
| SQL / schema | **None** |
| Production mutation / deploy | **None** |
| Commit / push / PR | **Stopped before commit** |

---

## 22. Final sub-phase plan (Owner-locked)

| Sub-phase | Objective |
|-----------|-----------|
| **1I-0** | Owner-approved SQL/read-model **design** gate |
| **1I-A** | Strict directory read contract, DTO, facade, repository port |
| **1I-B** | Durable SQL/RLS read model (**separately authorized**) |
| **1I-C** | Authenticated directory list UI at `/athletes` |
| **1I-D** | Minimal Player detail UI at `/athletes/:playerId` |
| **1I-E** | Staging privacy, auth, pagination, and abuse QA |
| **1I-F** | Final closure and **separate** Production rollout decision |
