# CC-01 — Legacy Terminology Mapping

**Phase:** CC-01 | **Date:** 2026-07-11  
**Source:** CC-00 audit finding — `open` has ≥5 meanings

---

## 1. Rules

1. **Do not** auto-replace legacy values in CC-01.
2. Use `previewCanonicalDrawModeFromLegacy()` for **read-only** migration planning only.
3. Do not map unrelated domains (finance, animation) to `DrawMode`.

Canonical reference: `src/features/competition-core/utils/legacyTerminology.js` → `LEGACY_OPEN_TERMINOLOGY`.

---

## 2. Full mapping table

| Legacy value | Context | Current meaning | Future canonical | Migration phase |
|--------------|---------|-----------------|------------------|-----------------|
| `open` | `tournament.seeding.logic` / seedMode UI | Random shuffle teams/groups | `pure_random` | CC-04 |
| `official_open` | `OFFICIAL_MODE.OPEN` | Open draw + club/unit separation | `constrained_random` | CC-04 |
| `open_double` | `EVENT_TYPE.OPEN_DOUBLE` | Event type (gender-open doubles) | *(not DrawMode)* | N/A |
| `open` | `ai/competition.js` | Scheduling format without mixed requirement | *(matchmaking format)* | CC-06 |
| `open` | `ClubManagement` leagueCompetitionType | League classification | *(workflow config)* | CC-08 |
| `open` | `tournamentFlowAdapters` | Animation UI variant | *(UI only)* | CC-09 |
| `open` | `financeLedgerService` | Open debt status | *(out of scope)* | — |
| `skill_controlled` | seeding / official AI balance | Snake + skill pairing | `skill_controlled` | CC-04 (rename only) |

---

## 3. DrawMode target enum (Competition Core)

```text
pure_random
constrained_random
skill_controlled
manual
```

Legacy `open` (seeding) → **`pure_random`**  
Legacy `official_open` → **`constrained_random`** (not pure — has separation rules)

---

## 4. Pairing-constraints vs Competition constraints

Legacy `pairing-constraints` uses:

- `prefer_partner`, `avoid_partner`, `avoid_same_group`
- `CONSTRAINT_MODE.HARD` / `SOFT`

Competition Core `COMPETITION_CONSTRAINT_TYPE` is a **superset** for CC-03. CC-01 does not bridge them automatically.

---

## 5. Rating terminology (unchanged CC-01)

| Legacy | Stays until |
|--------|-------------|
| `ratingInternal` | CC-02 split to `competitionElo` |
| `skillLevel` / `current_rating` | CC-02 `publicSkillLevel` |
| Pick_VN `rating_status` (8 values) | CC-02 mapping layer |

Do not conflate Pick_VN DB enum with `COMPETITION_RATING_STATUS`.
