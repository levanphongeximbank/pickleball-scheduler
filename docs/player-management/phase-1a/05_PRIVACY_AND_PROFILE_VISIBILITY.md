# 05 — Privacy and Profile Visibility

**Phase:** 1A — Contract Freeze  
**Status:** Official  

---

## 1. Purpose

Define what a **public profile** may expose versus what an **internal profile** may expose, and how privacy settings gate the difference.

Today: **no dedicated player privacy model exists**. Phase 1A freezes the contract; Phase 1E implements it.

---

## 2. Profile surfaces

| Surface | Audience | Purpose |
|---------|----------|---------|
| Public profile | Unauthenticated or broadly authenticated users under product rules | Safe athlete card / directory snippet |
| Internal profile | Authorized operators (RBAC + tenant/club boundaries) | Ops dossier (`PlayerProfile`-class UX) |
| Self profile | The account owner | Edit own allowed fields + privacy settings |

---

## 3. Default public profile contract

Unless privacy settings **explicitly permit**, public profile **must not** expose:

| Forbidden by default | Reason |
|----------------------|--------|
| Private phone | PII |
| Email | PII |
| Full date of birth (`birthDate`) | PII / age sensitivity |
| Internal notes | Ops-only |
| Restricted membership information | Governance / private club data |
| Account status (`suspended` / `invited`) | Security / account internals |
| Identity verification workflow details | Internal |
| Rating internal deviation / staff-only rating fields | Rating product rules |

### Default public allow-list (subject to privacy toggles)

- `playerId` (or opaque public handle if product later requires)
- `displayName`
- `avatarUrl`
- `gender` (if not hidden)
- `handedness` (if not hidden)
- `activityRegion` (if not hidden)
- Public rating summary permitted by Rating module
- Public ranking standing permitted by Ranking module
- Public club badge(s) only if privacy + club policy allow

Birth **year** may be public only when privacy explicitly allows; full DOB remains restricted.

---

## 4. Internal profile contract

Internal profile may expose authorized operational fields according to:

1. RBAC permissions (e.g. `player.view`, staff scopes)  
2. Tenant / club boundaries  
3. Membership relationship (same club ops vs cross-tenant)  

Typical internal fields:

- phone, email (if permitted by role)
- fullName, birthDate / birthYear
- profileStatus, verificationStatus
- clubMembershipReferences (detail)
- ratingReferences / rankingReferences (detail)
- internal notes (if introduced)
- accountStatus (read-only from Identity; elevated roles only)

Internal ≠ “dump everything.” Restricted fields still require elevated permission.

---

## 5. privacySettings object (contract)

Proposed shape (Phase 1C/1E persistence; Phase 1A freeze only):

```json
{
  "version": 1,
  "showPhonePublic": false,
  "showEmailPublic": false,
  "showBirthYearPublic": false,
  "showBirthDatePublic": false,
  "showGenderPublic": true,
  "showHandednessPublic": true,
  "showActivityRegionPublic": true,
  "showClubMembershipPublic": false,
  "showRatingSummaryPublic": true,
  "showRankingSummaryPublic": true
}
```

Rules:

- Defaults are fail-closed for PII (`phone`, `email`, DOB).  
- `showBirthDatePublic` default **false** and product policy may forbid enabling it.  
- Public renderers must apply settings server-side or in a single trusted projector — UI-only hiding is insufficient for security-sensitive deployments.

---

## 6. Projector rule

```text
PublicView  = project(PlayerProfile, privacySettings, publicPolicy)
InternalView = project(PlayerProfile, rbacContext, tenantContext)
```

Competition `ParticipantSnapshot` is a **competition-time snapshot**, not a public profile. It may include display/rating/eligibility fields needed for fair play without granting public PII access.

---

## 7. Related existing surfaces (not substitutes)

| Surface | Why it is not privacy settings |
|---------|--------------------------------|
| `club_data_v3_safe` / blob redaction | Storage redaction, not player-owned privacy prefs |
| Rating V5 public view | Rating field masking only |
| Public portal aggregates | Counts, not player directory PII |
| Private pairing rule visibility | Rule disclosure, not profile privacy |

---

## 8. Phase 1A freeze

No privacy tables or UI are added in Phase 1A. Implementations in later phases must satisfy this contract or explicitly amend it with Owner approval.
