# 01 — Module Ownership Boundaries

**Phase:** 1A — Contract Freeze  
**Status:** Official  
**Baseline:** Phase 1 Read-Only Audit (2026-07-18)

---

## Principle

Each concern has **one owner**. Other modules may **read** or **reference**, but must not redefine person identity, membership, or account security as a second source of truth.

```text
Identity  = who can log in and what they may do
Player    = who the athlete is (person profile)
Club      = which club the person belongs to
Venue     = venue commerce (customer / booking / debt)
Competition = how the person appears inside a competition
Rating / Ranking = measured performance linked to person
```

---

## 1. Identity & Authentication

**Module home:** `src/features/identity/`, `src/auth/`  
**Primary store:** `auth.users`, `public.profiles`

### Owns

| Concern | Notes |
|---------|--------|
| Login account | Supabase Auth user |
| Authentication | Sign-in / sign-out / session restore |
| Account status | `active` \| `suspended` \| `invited` |
| RBAC roles & permissions | Role matrix, `can()` |
| Session | Client AuthContext / JWT session |
| Security & account audit | Account audit logs, identity admin RPCs |

### Does not own

- Canonical athlete demographics as Player Management SSOT (may temporarily hold mirrored fields such as `gender`, `birth_year` until Player write-path cutover)
- Club membership
- Competition brackets / snapshots
- Rating / ranking scores

### Boundary rule

Identity may expose `profiles.player_id` as a **link alias** to Player Management. Clearing or rewriting that link without Player Management policy is forbidden after Phase 1B cutover.

---

## 2. Player Management (Phase 1 home)

**Module home (future):** `src/features/player/` — **not created in Phase 1A**  
**Contract owner starting Phase 1A:** this documentation set

### Owns

| Concern | Notes |
|---------|--------|
| Canonical player identity | Official `player_id` space |
| Player profile | Display/full name, contacts (as profile fields), avatar |
| Demographics | Gender, birth date / birth year, derived age group |
| Handedness | Tay thuận (new field; missing today) |
| Activity region | Khu vực hoạt động (new field; missing today) |
| Player profile lifecycle | `active` \| `inactive` \| `archived` |
| Player verification status | Identity/KYC-style verification — **not** rating verification |
| Privacy settings | Public / internal visibility controls |
| Public & internal player views | Projection contracts |
| Player directory & profile resolution | Resolve / search / hydrate by `player_id` |

### Does not own

- Login credentials or RBAC
- Club membership edges
- Venue customers / bookings / debts
- Competition engine behavior
- Rating algorithms or ranking point math

### Boundary rule

Player Management is the **only** module allowed to define “this string identifies a person as a player.” Other modules store **references** to `player_id`.

---

## 3. Club Management

**Module home:** `src/features/club/`, club blob via `src/domain/clubStorage.js`  
**Primary stores:** `clubs`, `club_members`, `club_data_v3` (including legacy `players[]` until migration)

### Owns

| Concern | Notes |
|---------|--------|
| Club membership | Membership edge rows |
| Membership status | `active` \| `left` \| `removed` (+ pending requests if supported) |
| Club role & governance | President / officers / governance flows |
| Club roster relationships | Who is on which club roster |
| References to canonical `player_id` | Must point at Player Management identity |

### Does not own

- Canonical person demographics SSOT (blob `players[]` is **legacy operational** until cutover)
- Account suspension
- Venue customer CRM identity

### Boundary rule

`club_members` is membership SSOT. `profiles.club_id` is **not** membership SSOT (Phase 42 deprecated for membership).

During Phase 1, Club may continue to host legacy blob player rows, but those IDs are classified as **legacy aliases**, not a second person SSOT.

---

## 4. Venue & Court

**Module home:** court management, CRM customer models (`src/models/customer.js`, court customer UI)

### Owns

| Concern | Notes |
|---------|--------|
| Venue customers | Booking CRM persons |
| Bookings | Court reservations |
| Debts | Outstanding balances |
| Packages / membership plans (venue commerce) | Venue product plans |
| Court operations | Clusters, courts, ops |

### Does not own

- Player identity
- Athlete demographics
- Club membership

### Boundary rule

Venue **customer** ≠ Player ≠ RBAC role `CUSTOMER`. Optional future link is allowed only as an explicit reference, never by conflating IDs.

---

## 5. Competition Engine

**Module home:** `src/features/competition-core/`, competition-engine docs  
**Contracts:** `ParticipantReference`, `ParticipantSnapshot`

### Owns

| Concern | Notes |
|---------|--------|
| `ParticipantReference` | Discriminated kind + id |
| `ParticipantSnapshot` | Display / rating / eligibility snapshot at competition time |
| Competition eligibility snapshots | Frozen competition-facing attributes |

### Does not own

- Full player profile CRUD
- Person demographics write path
- Club membership lifecycle

### Boundary rule

Competition Engine stores **references and snapshots only**. It must not become a third person profile store. Phase 1A forbids Competition Engine behavior changes.

---

## 6. Player Rating

**Module homes:** `src/features/pick-vn-rating/`, `src/features/pick-vn-rating-v5/`, competition-core rating tables

### Owns

| Concern | Notes |
|---------|--------|
| Rating records | Skill / Elo / Pick_VN / V5 profiles |
| Rating verification status | e.g. provisional / verified / under_review |

### Does not own

- Player identity verification (KYC)
- Demographics SSOT

### Boundary rule

Rating rows **link to** canonical `player_id` (or documented legacy alias of it). Rating keys that currently use `auth_user_id` or `profiles.id` are **legacy operational keys** pending adapter alignment — not separate people.

---

## 7. Ranking

**Module home:** `src/features/vpr-ranking/`  
**Primary stores:** `vpr_athletes`, `vpr_athlete_links`

### Owns

| Concern | Notes |
|---------|--------|
| Ranking records | National / VPR points and standings |
| Ranking athlete registry rows | `vpr_athletes` as ranking identity **alias** |

### Does not own

- Club roster
- Player profile demographics SSOT

### Boundary rule

Ranking links **to** canonical `player_id` via `vpr_athlete_links.player_id` (text) and related aliases.

---

## Cross-module reference matrix

| From → To | Allowed reference | Forbidden |
|-----------|-------------------|-----------|
| Identity → Player | `profiles.player_id` alias | Creating a second profile on link |
| Club → Player | Membership / roster refs `player_id` | Owning demographics SSOT long-term |
| Venue → Player | Optional future explicit link | Treating customer id as player id |
| Competition → Player | `ParticipantReference` | Full profile tables inside competition |
| Rating → Player | Rating record foreign key / text link | Redefining gender/DOB/privacy |
| Ranking → Player | `vpr_athlete_links.player_id` | Owning club membership |

---

## Hard rules (Phase 1+)

1. Identity owns **account**; Player Management owns **athlete profile**.  
2. Club owns **membership**; Player Management owns **who the person is**.  
3. Competition / Rating / Ranking **reference** `player_id`; they do not redefine person demographics.  
4. Customer / CRM stay on **venue commerce** unless explicitly linked later.  
5. Do **not** invent another independent player identity store.
