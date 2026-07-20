# CORE-06 — Domain Model (Phase 1B Scope Freeze)

**Status:** Documentation only — contracts already partially exist; Phase 1B does not invent new runtime entities  
**Source:** Phase 1A discovery + existing `createCompetitionLineup*` factories + Phase 3E identity contract

---

## 1. Entities overview

| Entity | Kind | Role |
|--------|------|------|
| **CompetitionLineup** | Aggregate root | Selection for one team in one competition context |
| **CompetitionLineupSlot** | Value / child | One person in one discipline/side position |
| **CompetitionLineupRevision** | Immutable artifact | Point-in-time snapshot of slots + status |
| **VisibilityGrant** | Contract (not persisted Core table yet) | Actor-scoped visibility decision for a lineup |
| **MissingLineupResolution** | Contract | Outcome of missing-lineup policy (random / forfeit / manual) |

---

## 2. CompetitionLineup

Canonical fields (from existing contract; Phase 1A inventory):

| Field | Notes |
|-------|-------|
| `schemaVersion` | Participant schema version |
| `id` | Stable lineup id |
| `competitionId` | Required competition scope |
| `teamId` | Competing unit |
| `contextId` | Opaque matchup / tie / fixture ref (legacy `matchupId`) |
| `status` | `COMPETITION_LINEUP_STATUS` |
| `revision` | Monotonic revision number (optimistic concurrency) |
| `rosterId` | Optional link to Core-05 roster |
| `previousRevisionId` | Chain pointer |
| `submittedAt` / `submittedBy` | Submit metadata |
| `lockedAt` / `publishedAt` | Lock / publish timestamps |
| `reason` | Override / void reason carrier |
| `slots[]` | Current slot set |
| `revisions[]` | Immutable revision history |
| `identityKey` | Deterministic identity (see §7) |
| `extensions` | Format extension bag (MLP extras, TT source flags) |
| `audit` | Audit metadata envelope |

**Optional scoping (opaque refs, not Core-06 owned):** `tenantId` (via team/competition context), `divisionId`, `divisionCategoryId`, `rosterVersion` (from Core-05 for membership checks).

---

## 3. CompetitionLineupSlot

| Field | Notes |
|-------|-------|
| `id` | Deterministic slot id (see §7) |
| `disciplineOrSideKey` | Format taxonomy key (e.g. discipline id) — Format owns catalog |
| `index` | Position within that key (canonically meaningful) |
| `person` | `ParticipantReference` |

Slots are **not** CompetitionEntry / registration rows.

---

## 4. CompetitionLineupRevision

Immutable revision (OD-06):

| Field | Notes |
|-------|-------|
| `schemaVersion` | |
| `lineupId` | Parent lineup |
| `revision` | Revision number |
| `previousRevisionId` | Prior revision link |
| `submittedAt` / `submittedBy` | |
| `lockedAt` | |
| `status` | Status at this revision |
| `slots[]` | Frozen slot copy |
| `reason` | Why this revision exists (override, void, etc.) |

Once written, a revision must not be mutated in place. Overrides create a **new** revision and mark prior active lineage as `SUPERSEDED` (see lifecycle).

---

## 5. VisibilityGrant (contract)

Phase 1A proposed name: `LineupVisibilityGrant`. Canonical Phase 1B name: **VisibilityGrant** (same contract).

| Field | Notes |
|-------|-------|
| `actor` | Subject requesting visibility |
| `contextId` | Matchup / fixture |
| `teamId` | Lineup team |
| `visible` | boolean |
| `reason` | e.g. own-team, published, TD, referee-assigned, hidden-pre-publish, requires-republish |

Server SoT for visibility; UI must never be trusted for opponent selections.

---

## 6. MissingLineupResolution (contract)

| Field | Notes |
|-------|-------|
| `policy` | `random` \| `forfeit_pending` \| `manual_pending` |
| `seed` | Optional deterministic seed for random fill |
| `outcome` | Resulting lineup revision id / status / forfeit flag |

Algorithm details remain Format-owned; Core-06 owns the **port** and outcome contract (see `05_PORTS.md`).

---

## 7. Identity rules

Owner-locked formulas (Phase 3E / Phase 1A):

```text
LINEUP identityKey =
  competitionId + "::" + "LINEUP" + "::" + contextId + "::" + teamId

SLOT id =
  lineupIdentityKey + "::" + disciplineOrSideKey + "::" + index
```

Rules:

- Deterministic across resolves
- Competition-scoped
- No wall-clock / `Date.now` in identity
- No `Math.random` / UUID in resolver identity
- Display name, visibility flags, ratings do **not** alter keys
- Collision → typed identity collision (no overwrite)
- Same key + same payload → idempotent

---

## 8. Relationships

```text
Competition (opaque)
  └── CompetitionTeam (Core-05)
        └── CompetitionRoster (Core-05)
              └── CompetitionLineup (Core-06) ── contextId ──▶ Matchup/Tie (opaque)
                    ├── CompetitionLineupSlot[]
                    └── CompetitionLineupRevision[]

VisibilityGrant ── evaluates ──▶ CompetitionLineup × Actor
MissingLineupResolution ── may produce ──▶ new CompetitionLineupRevision
```

One **active** lineup identity per `(competitionId, contextId, teamId)`.

---

## 9. Invariants

| ID | Invariant |
|----|-----------|
| INV-01 | `competitionId`, `teamId`, `contextId` required for a valid lineup |
| INV-02 | At most one active lineup per identity key |
| INV-03 | Every slot `person` must be ⊆ active roster membership (Core-05 lookup) |
| INV-04 | No duplicate person across slots within the same lineup (core rule; Format may tighten further) |
| INV-05 | Slot `id` must match identity formula when identity is present |
| INV-06 | `LOCKED` / `PUBLISHED` / `SUPERSEDED` / `VOIDED` are immutable for captain draft edits |
| INV-07 | Override never mutates a published revision in place — new revision + prior `SUPERSEDED` |
| INV-08 | Tenant / competition predicates fail closed on mismatch |
| INV-09 | Composition (gender, MLP counts, reuse) enforced by injected `LineupPolicy`, not hard-coded Core |
| INV-10 | Writes require expected revision / version + idempotency key (contract; TT already does this) |

---

## 10. Explicit non-inventions

Phase 1B does **not** add:

- New status values beyond the frozen canonical set
- Daily Play court sides as `CompetitionLineup`
- Individual doubles “team” as lineup aggregate
- DreamBreaker / forfeit as Core-06 entities
- SQL tables or persistence schemas
