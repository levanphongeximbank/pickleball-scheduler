# Phase 1I — Data Privacy Contract

**Surface:** Hybrid / Authenticated-first Player Directory (list + minimal detail)  
**Owner decision:** `APPROVE_PHASE_1I_SCOPE_WITH_CHANGES`  
**Branch:** `feature/player-phase-1i-public-directory-discovery`  
**Base `origin/main` SHA:** `0c37f1dfb152c24a9b9eccde5b0d1b3180773d7d`  
**Remediation date:** 2026-07-20 (UTC+7)  
**Document verdict:** `READY_FOR_SCOPE_FREEZE_COMMIT`  

**Related SSOT:**  
- `src/features/player/constants/privacy.js`  
- `src/features/player/projectors/projectPublicPlayerProfile.js`  
- `docs/player-management/phase-1a/05_PRIVACY_AND_PROFILE_VISIBILITY.md`  
- Phase 1G self privacy edit; Phase 1H verification (admin); this freeze for Directory UI  

---

## 1. Purpose

Define the **directory-specific** privacy contract. The directory is a **narrower** surface than the general public profile projector allow-list, and UI consumers never receive opaque `visible` envelopes.

---

## 2. Eligibility (who may appear)

| Rule | Source | Required |
|------|--------|----------|
| Master opt-in | `privacySettings.publicProfileEnabled === true` | Yes |
| Privacy present & valid | Fail closed | Yes |
| Verified-only | `verificationStatus === "verified"` | Yes |
| Projectable to Directory DTO | Successful strict projection | Yes |
| Inactive / ineligible | Exclude if existing contract supports safely | Yes (no new schema without separate gate) |

**Visibility flag:** `publicProfileEnabled` (approved).  
**`showInPublicDirectory` column:** not required.  
**SCHEMA_DEPENDENCY for visibility flag:** None.

Athletes disable discovery by setting `publicProfileEnabled` to `false` (Phase 1G self UI).

### Consumer return rule (Owner-approved)

- **Do not** return a `visible` field to UI consumers.  
- Filter non-visible / ineligible profiles **before** returning list results.  
- Detail for ineligible/missing ids → generic not-found / not-available / unauthorized.

---

## 3. Directory DTO allow-list (Owner-approved)

### UI-facing fields

| Field | Condition | Notes |
|-------|-----------|-------|
| `playerId` | always when eligible | Public routing id |
| `displayName` | always when present | Search target |
| `avatarUrl` | when present | Optional |
| `isVerified` | always `true` for MVP eligible rows | Badge only; raw status never returned |
| `activityRegion` | `showActivityRegion === true` | Allow-listed subkeys only |
| `gender` | `showGender === true` | Optional |
| `handedness` | `showHandedness === true` | Optional |

### Activity region subkeys only

`countryCode`, `provinceCode`, `provinceName`, `city`, `district`

### Absolute exclusions (Owner-approved)

| Field / class | Why |
|---------------|-----|
| `visible` | Not a UI consumer field — filter server/facade-side |
| `email`, `phone` | Contact PII |
| `birthDate`, `birthYear` | Age sensitivity |
| Full address | Beyond allow-listed region |
| `authUserId` | Auth correlation |
| Raw `verificationStatus`, rejection reason, moderation | Workflow internals |
| Raw `privacySettings` | Policy leakage |
| Roles / tokens | Authz / system |
| `venueId`, venue membership | Tenant leakage |
| Club membership / name / role | Tenant / club leakage |
| Rating (any) | Deferred |
| Competition history | Out of scope |
| Audit metadata | System |

---

## 4. Relationship to `projectPublicPlayerProfile`

| Aspect | General public projector | Directory contract (1I) |
|--------|--------------------------|-------------------------|
| Master switch | `publicProfileEnabled` | Same |
| Phone/email/birth | Allowed if toggles true | **Never** |
| Clubs | If `showClubMemberships` | **Never** |
| Verification | Never projected | **`isVerified` boolean only** |
| `visible` envelope | Used internally today | **Must not** reach Directory UI consumers |
| Ratings | Never | Never |

Directory implementation may reuse projector **policy** but must emit only the Directory allow-list above.

---

## 5. Enforcement layers

| Layer | Responsibility |
|-------|----------------|
| Durable read model (**1I-B**) | Prefer server-side filters: public-enabled + verified; narrow columns |
| Facade (**1I-A**) | Auth-first gate; Directory projection; pagination caps; filter before return |
| Projector (**1I-A**) | Strict allow-list; fail closed |
| UI (**1I-C / 1I-D**) | Render Directory DTO only; no raw profiles; no direct Supabase |
| RLS | Row access — **not** a substitute for field allow-list |

---

## 6. Authentication & privacy risk posture

| Access | Contract implication |
|--------|----------------------|
| Authenticated-first (MVP) | Required for Phase 1I |
| Anonymous | Deferred — same DTO rules when later authorized; no anon table grants |

---

## 7. `playerId` routing safety

- Canonical `playerId` is the path param for `/athletes/:playerId`.  
- Treat as enumerable; mitigate with auth-first, rate limits, generic not-found.  
- Never use `authUserId` as the public path parameter.

---

## 8. Defaults reminder

From `DEFAULT_PRIVACY_SETTINGS`:

- `publicProfileEnabled: false` → not in directory  
- Contact/birth/region/club toggles default false (gender/handedness default true but still gated by master switch for public/directory surfaces)

---

## 9. Non-goals

- Changing Production privacy jsonb schema  
- Adding `showInPublicDirectory` column  
- Returning opaque `{ visible: false }` Directory results to UI  
- Exposing admin queue fields on directory surfaces  
- Writing/applying SQL in this documentation wave  
