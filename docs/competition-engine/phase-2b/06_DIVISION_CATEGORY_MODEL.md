# 06 — Division and Category Model

**Phase:** 2B.1  
**Status:** Design — OD-07 **OWNER APPROVED** (separate Division + Category)

---

## Current dual taxonomy (verified)

### Individual / Internal / Official — Event type as category

`EVENT_TYPE` in `src/models/tournament/constants.js`:

```text
men_single, women_single, men_double, women_double, mixed_double, open_double
```

Stored on `event.eventType`. Entries belong to an `eventId`. Groups (`group`) are pools within an event — often called “bảng”, not “division” in code.

### Team Tournament — Discipline category

`DISCIPLINE_CATEGORY`:

```text
singles | doubles | mixed
```

Plus `genderRequirement` on each discipline. Team “division” in product language often means **group bảng of teams** (`normalizeGroup` in team data / draw policies), not a player attribute.

### Daily Play

No division/category entity — session of players.

---

## Proposed concepts

| Concept | Meaning | Typical use |
|---------|---------|-------------|
| **CompetitionCategory** | What kind of contest (gender/format class) | men_double, mixed, open |
| **CompetitionDivision** | Competitive subdivision / pool / skill band | Bảng A, Div 1, U18 |
| **Event** (legacy Individual) | Often = Category instance within a tournament | Keep as adapter aggregate |
| **Discipline** (TT) | Sub-match template inside a team tie | Maps to category facet + scoring |

---

## OD-07 — OWNER APPROVED

Keep **two entities**: `CompetitionCategory` + `CompetitionDivision`.

| Entity | Meaning |
|--------|---------|
| **Division** | Branch/zone with own standings, draw, schedule, or progression |
| **Category** | Condition classification (age, gender, skill, content) |

A Division may reference one or more Categories. **Do not** merge into one polymorphic classification field.

### Mapping (adapters)

- Entry references both when needed: `categoryId` + optional `divisionId`
- TT: discipline → category facet; team group → division
- Individual: eventType → category; group → division

---

## Core ownership

Core may own:

- Reference fields on Entry/Team/SeedIdentity
- Validation that referenced ids exist in competition aggregate
- Neutral codes registry (optional)

Core must **not** own:

- Which EVENT_TYPE allowed in Official Open
- MLP discipline list presets
- Gender requirement matrices

---

## Mapping table (adapter)

| Legacy | Canonical |
|--------|-----------|
| `event.eventType` | `CompetitionCategory.code` |
| `event.id` | Category instance or Event aggregate id (adapter) |
| `group.id` (individual) | `CompetitionDivision.id` |
| TT `discipline.categoryType` | Category facet on discipline extension |
| TT team `groups[]` | `CompetitionDivision` for teams |
| Daily | None |

---

## Seed / draw implication

Seed identity should carry optional `divisionId` + `categoryId` so the same person in two categories does not collide in ranking maps.
