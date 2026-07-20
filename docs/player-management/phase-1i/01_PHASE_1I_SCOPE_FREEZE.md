# Phase 1I — Scope Freeze

**Owner decision:** `APPROVE_PHASE_1I_SCOPE_WITH_CHANGES`  
**Document status:** Owner-approved scope freeze (documentation only)  
**Branch:** `feature/player-phase-1i-public-directory-discovery`  
**Base `origin/main` SHA:** `0c37f1dfb152c24a9b9eccde5b0d1b3180773d7d`  
**Freeze date:** 2026-07-20 (UTC+7)  
**Remediation date:** 2026-07-20 (UTC+7)  
**Prerequisite:** Phase 1H closed on main (`06_PHASE_1H_FINAL_CLOSURE.md`)  
**Document verdict:** `READY_FOR_SCOPE_FREEZE_COMMIT`

This document freezes product/technical scope for **Public Player Directory UI**. It does **not** authorize SQL apply, Production mutation, deploy, or implementation code.

---

## 1. Frozen product intent

Ship a **privacy-safe, verified-only, platform-wide Player identity directory** (authenticated-first hybrid) with list + minimal detail, strict Directory DTO, and no club/venue/rating/social surfaces.

---

## 2. IN SCOPE

### Access model (Owner-approved)

| Item | Frozen |
|------|--------|
| Architecture | **Hybrid** |
| Phase 1I MVP | **Authenticated-first** |
| Anonymous access | **DEFERRED** (later phase; separately authorized) |
| Layout | `PublicLayout` shell |

### Routes (Owner-approved)

| Item | Value |
|------|-------|
| List | `/athletes` |
| Detail | `/athletes/:playerId` |
| Do not use | `/players`, `/players/profile/:playerId`, `/player/profile` |

### Directory model (Owner-approved)

| Item | Frozen |
|------|--------|
| Scope | **Platform-wide** Player identity directory |
| Venue / club participation | **Do not expose** |
| Tenant/venue fields in DTO | **Forbidden** |

### Surface shape (Owner-approved)

| Item | Frozen |
|------|--------|
| Mode | Directory **list** + **minimal** Player detail |
| Search | `displayName` |
| Filter | `activityRegion` |
| Pagination | Deterministic + hard caps |
| Verification badge | Yes — `isVerified` boolean |
| UX states | Loading, empty, error, **authorization** |
| Rating | **EXCLUDED / DEFERRED** |
| Club | **EXCLUDED / DEFERRED** |
| SEO | **DEFERRED** |

### Eligibility rules (Owner-approved)

A Player appears in directory list/detail **only if all** are true:

1. `privacySettings.publicProfileEnabled === true`  
   — approved visibility flag; **no** `showInPublicDirectory` schema field required.
2. Privacy payload present and valid (fail closed).
3. `verificationStatus === "verified"`.
4. Profile can be projected to Directory DTO successfully.
5. Inactive or otherwise ineligible profiles **excluded if** the existing contract supports that safely (no new schema in 1I without a separate Owner gate).

Non-eligible profiles are **filtered out before return**. They are **not** returned to UI as opaque `{ visible: false }` objects.

### Privacy rule (directory-stricter)

Directory surfaces use a **strict Directory DTO allow-list** that:

- Requires `publicProfileEnabled === true`.
- Requires verified identity.
- **Never** emits `email`, `phone`, `birthDate`, `birthYear` — even if privacy toggles allow them on the general public projector.
- May emit `gender`, `handedness`, `activityRegion` only when corresponding privacy flags are true.
- Never emits club/venue fields, raw privacy, raw verification status, roles, tokens, ratings, or competition history.

Implementation (1I-A): new directory projector **or** post-filter wrapper over public projector policy — result must match this allow-list.

Hard rule: UI renders Directory DTO fields only; no raw internal profile dump; no UI→Supabase.

### Approved Directory DTO (Owner-approved)

UI-facing Directory DTO (**no `visible` field**):

```js
{
  playerId,
  displayName,
  avatarUrl?,          // when present
  isVerified,          // true for eligible rows (verified-only MVP)
  activityRegion?,     // when showActivityRegion === true
  gender?,             // when showGender === true
  handedness?,         // when showHandedness === true
}
```

`activityRegion` subkeys only when present: `countryCode`, `provinceCode`, `provinceName`, `city`, `district`.

List and detail use the **same** field set.

Facade/list responses return **only** eligible Directory DTOs (and meta such as count/pagination). Detail miss → generic not-found / not-available / unauthorized — **not** a `visible` flag.

### Explicitly excluded fields (Owner-approved)

- `authUserId`
- `email`
- `phone`
- birth date or birth year (`birthDate`, `birthYear`)
- full address
- raw `privacySettings`
- raw `verificationStatus`
- roles
- tokens
- venue membership
- `venueId`
- club membership
- club name
- club role
- rating (any)
- competition history
- audit metadata
- moderation data
- rejection reason
- `visible` (must not be returned to UI consumers)
- `athleteId`, `fullName`, account/profile status internals, `sourceReferences`, rating/ranking refs, `clubMembershipReferences`

### Search / filter / pagination

| Capability | In scope |
|------------|----------|
| Search by `displayName` | Yes |
| Filter by `activityRegion` | Yes |
| Verified-only | Yes (eligibility) |
| Privacy eligibility | Yes |
| Deterministic pagination | Yes |
| Match on authUserId / email / phone | **No** |

### Loading / empty / error / authorization

| State | Behavior |
|-------|----------|
| Loading | Explicit loading UI |
| Empty | Empty state when zero eligible results |
| Error | Fail closed — no raw profile dump |
| Unauthorized (unauthenticated under auth-first) | Authorization state / redirect-deny per product UX |
| Detail not found / ineligible | Generic not-available |

### Facade / repository ownership

| Layer | Owner |
|-------|-------|
| UI | Directory pages/components call Player facade only |
| Facade | Directory list/get APIs (names flexible; introduced in **1I-A**) |
| Projector | Strict Directory DTO projector/wrapper (**1I-A**) |
| Repository port | Directory repository port (**1I-A**); durable adapter (**1I-B**) |
| Write APIs | **Out of scope** |

### Tests required

- Directory DTO exclusions (PII/club/venue/rating never present).
- No `visible` field on UI-facing DTOs.
- Eligibility: verified + `publicProfileEnabled`.
- Search isolation from auth IDs / email / phone.
- Region filter on allow-listed region only.
- Pagination determinism + caps.
- Auth-first denial for unauthenticated callers (facade and/or UI).
- Facade-only wiring (no direct Supabase in directory UI).
- Regression: Phase 1F–1H Player suites still pass.

### Rollout gates

1. Scope-freeze docs committed after Owner request.  
2. **1I-0** Owner-approved SQL/read-model **design** gate.  
3. **1I-A** app contract without Production SQL apply.  
4. **1I-B** SQL/RLS only after **separate** Owner authorization (Staging first).  
5. **1I-C / 1I-D** UI after read path available.  
6. **1I-E** Staging QA signed.  
7. **1I-F** closure; Production rollout is a **separate** Owner decision (no deploy implied).

---

## 3. OUT OF SCOPE

- Messaging / chat  
- Follow / friends / social graph  
- Social feed / comments / endorsements  
- Public phone / email / birth data  
- Direct booking invitations  
- Match invitations  
- Export / bulk download / scraping-oriented APIs  
- Full competition history  
- Full club history / club role / club name exposure  
- Venue membership / `venueId` exposure  
- Admin mutation / verification mutation  
- Identity verification self-submit workflow  
- Rating recalculation or rating badges  
- Profile edit (remains Phase 1G)  
- Anonymous access (deferred)  
- SEO (deferred)  
- SQL / migration / schema **unless separately Owner-authorized in 1I-B**  
- Anonymous table grants  
- Browser service-role credentials  
- Production mutation / deploy under this freeze alone  
- Remediating unrelated direct `profiles` reads in other modules  

---

## 4. SQL / schema stance (Owner-approved)

| Item | Status |
|------|--------|
| `showInPublicDirectory` column | **Not required** |
| Durable public-directory read gate | **Required** |
| SQL design | Allowed only after **1I-0** design gate; implementation in **1I-B** |
| SQL write/apply in this docs task | **Forbidden** |
| Anonymous table access | **Forbidden** |
| Browser service-role | **Forbidden** |
| Classification | **`SQL_REQUIRED`** for platform directory (via 1I-B) |

---

## 5. Owner-approved changes vs discovery draft

| Discovery draft | Owner freeze |
|-----------------|--------------|
| `{ visible: true/false }` consumer shapes | **No `visible` to UI**; filter first |
| Sub-phases 1I-0, 1I-A, 1I-A-SQL, 1I-B…1I-E | Locked as **1I-0 … 1I-F** (SQL = **1I-B**) |
| Club-blob-only NO_SQL alternative | **Not** the approved MVP (platform durable read required) |

---

## 6. Entry conditions for implementation

- [x] Phase 1H closed on `main`  
- [x] Discovery + Owner scope remediation authored  
- [x] Owner `APPROVE_PHASE_1I_SCOPE_WITH_CHANGES`  
- [ ] Scope-freeze package committed (Owner-requested)  
- [ ] **1I-0** SQL/read-model design authorized  
- [ ] Fresh implementation work under approved sub-phases  
- [ ] No Production credentials used for writes  

---

## 7. Exit criteria (full Phase 1I — later)

- Authenticated list + detail on `/athletes` and `/athletes/:playerId`.  
- Only eligible verified + public-enabled Players returned.  
- Directory DTO exclusions + no `visible` field proven by tests.  
- No UI direct Supabase Player reads for this feature.  
- Staging privacy/auth/pagination/abuse QA signed (**1I-E**).  
- Closure recorded (**1I-F**); Production only if separately authorized.  

---

## 8. Locked sub-phase plan

| Sub-phase | Objective |
|-----------|-----------|
| **1I-0** | Owner-approved SQL/read-model design gate |
| **1I-A** | Strict directory read contract, DTO, facade, and repository port |
| **1I-B** | Durable SQL/RLS read model, separately authorized |
| **1I-C** | Authenticated directory list UI at `/athletes` |
| **1I-D** | Minimal public Player detail UI at `/athletes/:playerId` |
| **1I-E** | Staging privacy, auth, pagination, and abuse QA |
| **1I-F** | Final closure and separate Production rollout decision |

---

## 9. Exact Owner action next

1. Request **commit** of this scope-freeze package when ready.  
2. Do **not** authorize SQL apply or deploy under this docs-only step.  
3. Next technical gate: **1I-0** SQL/read-model design authorization.  
