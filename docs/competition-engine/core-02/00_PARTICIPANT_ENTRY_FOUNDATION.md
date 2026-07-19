# Core-02 — Participant & Competition Entry Foundation

**Wave:** 1 / CORE-02  
**Status:** Contracts + validators + shadow adapters (no persistence / UI / cutover)  
**Branch intent:** `feature/competition-core-02-participant-entry`

---

## 1. Concept separation

| Concept | Meaning |
|---------|---------|
| **ParticipantReference.kind** | Source identity of a **person** (`PLATFORM_USER`, `PLAYER_PROFILE`, `GUEST`, …). Never `PAIR` / `TEAM`. |
| **CompetitionParticipant** | One **person** with standing inside a **competition**. |
| **CompetitionEntry.entryType** | The **competing unit**: `INDIVIDUAL` \| `PAIR` \| `TEAM` (`COMPETITION_ENTRY_TYPE`). |
| **CompetitionRegistration** | Adjacent **workflow** object (submit / waitlist / approve). Owned by registration track (Core-03). |

```text
Person (Player Mgmt aliases)
  → ParticipantReference
    → CompetitionParticipant (person-in-competition)
      → CompetitionEntry (competing unit; entryType)
CompetitionRegistration ──(OD-10)──► may activate Entry after APPROVED
```

---

## 2. Why PAIR is an Entry type

Doubles/mixed register as **one competing unit with two people**. Draw/seed/match engines consume that unit, not two independent people. Therefore PAIR belongs on `CompetitionEntry.entryType`.

PAIR is **not**:

- a `ParticipantReference.kind` (that would collapse person identity with unit shape)
- a `REGISTRATION_KIND` (registration remains `INDIVIDUAL` \| `TEAM` unless an existing contract already required PAIR — it does not)

---

## 3. Why TEAM Entry is optional

Team Tournament already seeds/draws with **team candidates**. Core-02 provides an **optional compatibility bridge**:

- `entryType = TEAM`
- `teamRef` + deterministic `identityKey`
- optional `representativeRef` / captain

TT runtime is **not** required to consume this Entry. Athlete-level Entries are **not** generated merely because a team exists.

---

## 4. Entry vs Registration ownership

| Concern | Owner |
|---------|-------|
| Competing unit shape, membership cardinality, entry identity | **Entry (Core-02)** |
| Waitlist, submit/approve/reject workflow | **Registration (OD-10 / Core-03)** |
| Eligibility evaluation | Format / Rule Engine (Core-01) — not Core-02 |

**WAITLISTED** is a **Registration** status. It must never silently become an active `CompetitionEntry` state.

### Canonical statuses (preserved — no rename)

**CompetitionEntry** (`COMPETITION_ENTRY_STATUS`):

- `DRAFT`, `PENDING`, `APPROVED`, `ACTIVE`, `WITHDRAWN`, `DISQUALIFIED`, `COMPLETED`
- Active (OD-02 uniqueness): `APPROVED`, `ACTIVE`
- Terminal (not active): `WITHDRAWN`, `DISQUALIFIED`, `COMPLETED`

**CompetitionRegistration** (`COMPETITION_REGISTRATION_STATUS`):

- `DRAFT`, `SUBMITTED`, `PENDING`, `WAITLISTED`, `APPROVED`, `REJECTED`, `WITHDRAWN`, `CANCELLED`

### Legacy Individual status → Entry (compatibility only)

| Legacy | Entry | Notes |
|--------|-------|-------|
| waitlisted | *(no Entry)* | Registration owns waitlist |
| draft | DRAFT | |
| pending | PENDING | |
| approved | APPROVED | |
| active | ACTIVE | |
| withdrawn / cancelled | WITHDRAWN | |
| rejected | DISQUALIFIED | mapping representation only |

---

## 5. Identity key construction

```text
competitionId::ENTRY::entryType::stableSourceIdentity
```

Helpers: `buildEntryIdentityKey`, `createEntryIdentity`, `validateEntryIdentity`.

| entryType | stableSourceIdentity |
|-----------|----------------------|
| INDIVIDUAL | `kind::id` of the sole member |
| PAIR | sorted `kind::id` tokens joined by `+` |
| TEAM | `TEAM::{teamId}` or team `identityKey` |

Rules:

- Same canonical input → same key
- Different competition or entryType → different key
- No displayName, timestamps, random UUIDs, or mutable metadata in the key
- PAIR membership order is **canonicalized** before hashing material

---

## 6. Tenant isolation

`tenantScope: { tenantId?, clubId?, organizationId? }`

- Cross-tenant declared conflicts **fail closed**
- Missing scope **never** falls back to a first/default tenant
- Metadata cannot invent tenant ownership

---

## 7. Snapshot vs live

- `ratingSnapshot` / `participantSnapshot` capture lock-time attributes (OD-08/09)
- Snapshots **do not** replace identity refs
- Live Player/Club data is read via adapters; Core identity keys stay stable

---

## 8. Parallel ownership boundaries

| Area | Owner | Core-02 rule |
|------|-------|--------------|
| Rule Engine / `constraints/**` | Core-01 | **Zero semantic changes** |
| Division / Category definitions | Core-04 | Store **opaque** `divisionId` / `categoryId` only; do not expand `divisionCategory.js` |
| Registration workflow | Core-03 | Do not redesign; keep OD-10 waitlist on Registration |
| Team/Roster/Lineup ops | Format / later cores | Structure OK; no MLP/ops rules here |
| Draw / schedule / UI / SQL | Other tracks | Out of scope |

Prefer **deep imports** or the **participants-local barrel**. Avoid editing `competition-core/index.js`.

---

## 9. Shadow compatibility strategy

| Format | Behavior |
|--------|----------|
| Individual | Explicit mapper infers INDIVIDUAL (1 player) / PAIR (2 distinct); ambiguous → typed error; waitlisted → no Entry |
| Team Tournament | Optional TEAM Entry bridge; `athleteEntriesCreated = 0` |
| Daily Play | Maps to `CompetitionParticipant` only; **proves** `entry === null` |
| Player / Club | Read-map only; no write-module imports |

Production SSOT remains legacy until Owner cutover.

---

## 10. Duplicate active-entry protection (foundation only)

Active Entry uniqueness helpers (`detectDuplicateActiveEntryIdentities`, `createInMemoryActiveEntryIdentityRegistry`) operate on **APPROVED** and **ACTIVE** statuses only. Terminal statuses (`WITHDRAWN`, `DISQUALIFIED`, `COMPLETED`) do not participate.

The **in-memory** active-entry identity registry is provided only for domain validation, shadow-mode integration and tests. It is **not** a Production persistence or database uniqueness guarantee — it does not write to a database and does not enforce uniqueness at the storage layer.

---

## 11. Deferred work

- Persistence / repository implementations
- Production runtime wiring / feature-flag enablement
- Mandatory TT Entry cutover
- Registration redesign
- Division/Category taxonomy (Core-04)
- Rule evaluation (Core-01)

---

## 12. Module map

```text
src/features/competition-core/participants/
  enums/entryTypes.js
  contracts/entryIdentity.js
  contracts/teamReference.js
  contracts/tenantScope.js
  contracts/entryRegistration.js   (additive fields)
  validators/index.js               (type / tenant / identity / duplicates)
  compatibility/*                   (shadow adapters)
```

Import example:

```js
import {
  COMPETITION_ENTRY_TYPE,
  createCompetitionEntry,
  mapLegacyIndividualEntryToCompetitionEntry,
} from "../src/features/competition-core/participants/index.js";
```
