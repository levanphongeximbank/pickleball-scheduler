# 03 — Canonical Participant Contracts

**Phase:** 2B.1  
**Status:** Type proposal in documentation only — **not** added to Production code  
**Independence:** No React, Supabase client, or page imports in these contracts

---

## Shared primitives

```text
AuditMetadata {
  createdAt?: string | null
  createdBy?: string | null
  updatedAt?: string | null
  updatedBy?: string | null
  decidedAt?: string | null
  decidedBy?: string | null
}

ValidationResult {
  ok: boolean
  codes: string[]
  messages?: string[]
  details?: Record<string, unknown>
}

FormatExtension {
  formatKey: string              // e.g. "team_tournament" | "daily_play" | "individual"
  payload: Record<string, unknown>  // opaque to Core; validated by Format module
}
```

Extension rule: Core **must ignore** unknown `FormatExtension.payload` keys. Format modules own schema for their key.

---

## 1. CompetitionParticipant

**Purpose:** Person or organization with standing to compete in a competition.

| Aspect | Spec |
|--------|------|
| Required | `id`, `competitionId`, `person` (`ParticipantReference`), `status` |
| Optional | `displayName`, `clubMemberId`, `registeredByPlatformUserId`, `extensions`, `audit` |
| Immutable after create | `id`, `competitionId`, `person.kind`, `person.id` (primary) |
| Mutable | `status`, `displayName`, secondary links, `extensions` |
| Identity | Unique `(competitionId, id)`; multi-entry policy OD-02 APPROVED |
| Validation | `person.id` non-empty; `status` in allowed set |
| Versioning | Not required for base row; snapshot via Registration/Entry |
| Format extension | `extensions.formatKey` for TT/Daily extras |
| Persistence | Port-backed; Core never reads tables |
| Legacy map | Implicit today (player checked in / on roster / on entry) → materialize in 2B.2 adapters |

---

## 2. CompetitionEntry

**Purpose:** Concrete registration of a Participant (or set of people) into a division/category.

| Aspect | Spec |
|--------|------|
| Required | `id`, `competitionId`, `status`, `memberRefs[]` (≥1 `ParticipantReference` or participant ids) |
| Optional | `divisionId`, `categoryId`, `entryRole`, `name`, `seed`, `ratingSnapshot`, `groupId`, `extensions`, `audit` |
| Immutable after IN_PROGRESS (recommended) | `id`, `competitionId`, `divisionId`/`categoryId` (OD-03 APPROVED), `memberRefs` primary set |
| Mutable before lock | `status`, `name`, `seed` (until `SEED_LOCKED`) |
| Identity | Unique `id` within competition; default unique active `(competitionId, divisionId, categoryId, entryRole)` (OD-02) |
| Validation | member count matches category policy (Format owns count rules); status transitions |
| Versioning | Snapshot rating/name on approval/lock — OD-08 APPROVED |
| Waitlist | **Not owned here** — waitlist belongs to `CompetitionRegistration` (OD-10 APPROVED) |
| Format extension | partner invite, pairType, unitName, clubName (Individual) |
| Persistence | Independent |
| Legacy map | `normalizeEntry` → this contract; Daily has **no** Entry (session players only) |

---

## 3. CompetitionTeam

**Purpose:** Competing unit composed of roster members (Team Tournament primary).

| Aspect | Spec |
|--------|------|
| Required | `id`, `competitionId`, `name`, `status` |
| Optional | `seed`, `captainRef`, `deputyRefs[]`, `ratingAggregates`, `extensions`, `audit` |
| Immutable after create | `id`, `competitionId` |
| Mutable | `name`, branding, `seed` until draw lock, captain/deputies (Format policy) |
| Identity | Unique team id; seed subjectKind=`team` |
| Validation | Name non-empty; captain ∈ roster (Format) |
| Versioning | Setup snapshot (existing TT pattern) |
| Format extension | MLP fields, color, logo, clonedFrom |
| Persistence | Independent |
| Legacy map | `normalizeTeam` |

---

## 4. CompetitionRoster

**Purpose:** Set of people allowed to represent a Team in a competition.

| Aspect | Spec |
|--------|------|
| Required | `id`, `competitionId`, `teamId`, `members[]`, `status` |
| Optional | `lockedAt`, `lockReason`, `maxSize`, `extensions`, `audit` |
| Immutable after `ROSTER_LOCKED` | Member set (substitution only via OD-05 workflow; default NOT ALLOWED after start) |
| Mutable before lock | Add/remove members |
| Identity | One active roster per `(competitionId, teamId)` unless versioned |
| Validation | Size/gender composition → Format (MLP) |
| Versioning | Version or snapshot on lock recommended |
| Format extension | absentPlayerIds, lockedPlayerIds |
| Persistence | Independent |
| Legacy map | `team.playerIds[]` + hydration; cloud `team_tournament_team_members` |

---

## 5. CompetitionRosterMember

**Purpose:** One person on a roster.

| Aspect | Spec |
|--------|------|
| Required | `id`, `rosterId`, `person` (`ParticipantReference`), `status` |
| Optional | `role` (player/captain/deputy — or role on Team), `joinedAt`, `extensions` |
| Immutable | `id`, `rosterId`, `person` primary |
| Mutable | `status` (active/absent/replaced) |
| Identity | Unique person per roster (recommended) |
| Validation | EligibilityDecision required before ACTIVE (policy) |
| Versioning | Inherit roster lock |
| Format extension | — |
| Legacy map | element of `playerIds` / team_members row |

---

## 6. CompetitionLineup

**Purpose:** Selected players for a specific match, tie, or round.

| Aspect | Spec |
|--------|------|
| Required | `id`, `competitionId`, `teamId`, `contextId` (matchup/match/round), `status`, `slots[]`, `revision` |
| Optional | `previousRevisionId`, `submittedAt`, `submittedBy`, `lockedAt`, `publishedAt`, `reason`, `source`, `extensions`, `audit` |
| Immutable after LOCKED/PUBLISHED | `slots` except override workflow (Format) — each change creates a new revision |
| Mutable in DRAFT/SUBMITTED | selections (new revision on submit/change) |
| Identity | Unique per `(contextId, teamId)` active lineup; revisions versioned (`lineupId` + `revision`) |
| Validation | Core: structure + roster membership check; Format: MLP/gender/hidden |
| Versioning | **OD-06 OWNER APPROVED** — full immutable chain; minimum fields: lineupId, revision, previousRevisionId, submittedAt, submittedBy, lockedAt, status, slots, reason |
| Format extension | discipline selections map, overrideReason, dreambreaker order |
| Persistence | Independent |
| Legacy map | `normalizeLineup` / SQL lineups |

```text
CompetitionLineupSlot {
  id: string
  disciplineOrSideKey: string
  index: number
  person: ParticipantReference
}
```

---

## 7. CompetitionRegistration

**Purpose:** Process record for applying to compete (workflow around Entry).

| Aspect | Spec |
|--------|------|
| Required | `id`, `competitionId`, `status` |
| Optional | `entryId` (set when Entry created/activated), `waitlistPosition`, `windowId`, `submittedAt`, `decidedAt`, `decidedBy`, `rejectionReason`, `registeredByPlatformUserId`, `extensions` |
| Immutable | `id`, `competitionId` |
| Mutable | `status`, `entryId` on approval, decision fields, waitlist fields |
| Identity | Workflow record; waitlist owned here (OD-10 APPROVED) |
| Validation | Status machine (see `04_`, `09_`); waitlisted ≠ active Entry |
| Versioning | Decision audit trail |
| Format extension | partner invite token flow |
| Legacy map | Fields currently **embedded on Entry** (`waitlistPosition`, `registeredAt`, …) — split in adapters |

---

## 8. EligibilityDecision

**Purpose:** Result of evaluating eligibility rules for a person/entry/roster add.

| Aspect | Spec |
|--------|------|
| Required | `id`, `subjectKind`, `subjectId`, `result` (`eligible` \| `ineligible` \| `requires_review`), `evaluatedAt` |
| Optional | `ruleSetId`, `violations[]`, `snapshot`, `extensions` |
| Immutable | Entire decision once recorded (new decision supersedes) |
| Mutable | None — append-only |
| Identity | Decision id; latest-by-subject query |
| Validation | result enum |
| Versioning | Append-only history |
| Format extension | Format-specific violation codes |
| Legacy map | Individual `eligibilityEngine` + TT `checkPlayerEligibility` + rating status — **no unified decision object today** |

---

## 9. CompetitionDivision

**Purpose:** Competitive bracket/pool grouping (e.g. bảng A/B, skill division).

| Aspect | Spec |
|--------|------|
| Required | `id`, `competitionId`, `name` |
| Optional | `sortOrder`, `groupPolicyRef`, `extensions` |
| Notes | Today TT “division” ≈ group bảng of **teams**; Individual uses `group` under event — not always named Division |
| OD-07 | **OWNER APPROVED** — keep separate Division + Category entities |

---

## 10. CompetitionCategory

**Purpose:** Classification of competition content (singles/doubles/mixed; men/women/open).

| Aspect | Spec |
|--------|------|
| Required | `id` or `code`, `competitionId` (or template-level), `code` |
| Optional | `label`, `playerCount`, `genderPolicyRef`, `extensions` |
| Legacy map | Individual `EVENT_TYPE`; TT `DISCIPLINE_CATEGORY` — **parallel taxonomies** |
| OD-07 | **OWNER APPROVED** — two entities; Division may reference one or more Categories |

---

## 11. ParticipantReference

Defined in `02_IDENTITY_AND_REFERENCE_MODEL.md`. Required on Participant, RosterMember, LineupSlot, and Entry members.

---

## Competition Participant Status (minimum)

Aligns with brief + current `ENTRY_STATUS` (extended):

```text
DRAFT
PENDING
ELIGIBLE
INELIGIBLE
APPROVED
WAITLISTED
WITHDRAWN
DISQUALIFIED
ACTIVE
COMPLETED
```

Mapping from current `ENTRY_STATUS`:

| Current | Canonical |
|---------|-----------|
| draft | DRAFT |
| pending | PENDING |
| approved | APPROVED |
| waitlisted | WAITLISTED |
| withdrawn | WITHDRAWN |
| cancelled | WITHDRAWN or separate CANCELLED extension |
| rejected | INELIGIBLE (or REJECTED extension) |
| active (legacy) | ACTIVE / APPROVED draw-eligible |

`DISQUALIFIED` / `ELIGIBLE` / `COMPLETED` are **new** Core statuses — not all present on Entry today.

---

## What must NOT appear on Core contracts

- MLP gender matrix
- Captain portal UX fields
- Hidden lineup visibility rules
- Dreambreaker rotation state
- Daily queue priority / walk-in
- Partner invite SMS/email payloads
- React keys, MUI props, Supabase `Row` types
