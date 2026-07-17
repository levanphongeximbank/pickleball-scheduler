# 10 — Phase 2B.2 Implementation Plan

**Phase:** 2B.2 — **NOT STARTED**  
**Gate:** Owner explicit GO after Phase 2B.1 revalidation (OD-01…OD-10 are **OWNER APPROVED**)  
**Revalidation base:** `origin/main` @ `45442d54` (Phase 2A docs 14/15 present)

---

## Goal of 2B.2

Materialize **shadow / contract-only** participant types and pure validators under Competition Core, plus mapping interfaces that describe legacy → canonical shapes **without** changing Production execution paths, database, or feature flags.

---

## In scope (2B.2)

Only:

1. **Pure contracts** under `src/features/competition-core/participants/` (or equivalent)
2. **Pure validation types** / normalize-validate functions (no React, no Supabase)
3. **Identity references** (`ParticipantReference` kinds per OD-01)
4. **Status enums** (participant, entry, registration, roster, lineup, lifecycle markers)
5. **Versioned DTOs** (lineup revision chain per OD-06; snapshots per OD-08)
6. **Mapping interfaces** (legacy → canonical; no production wiring)
7. **Repository port interfaces** only — **no** database implementation

Also:

- Unit tests for pure validate/normalize + golden fixture mapping (in-memory)
- Export new public symbols only via `competition-core/index.js`
- Keep all Competition Core feature flags **OFF**
- Respect Phase 2A forbidden dependency matrix

---

## Out of scope (2B.2)

- Production path cutover
- Database migrations / SQL
- Repository adapter implementations (Supabase, blob)
- Deleting/renaming legacy models
- Changing TT V6 behavior
- Enabling flags / env changes
- Starting Phase 3 capability cutovers
- Runtime registration/roster/lineup workflows

---

## Owner-approved policy defaults (bind contracts)

| OD | Status | Contract / validator implication |
|----|--------|----------------------------------|
| OD-01 | OWNER APPROVED | `ParticipantReference.kind` includes platform_user, player_profile, club_member, guest, external; post-create link/alias must not change participant id |
| OD-02 | OWNER APPROVED | Allow multi-entry; default unique active `(competitionId, divisionId, categoryId, entryRole)` |
| OD-03 | OWNER APPROVED | `competitionId` required on Entry; `divisionId`/`categoryId` optional at type level, Format config may require |
| OD-04 | OWNER APPROVED | Lifecycle marker `ROSTER_LOCKED` before `IN_PROGRESS`; UI lock is not SSOT |
| OD-05 | OWNER APPROVED | Default substitution policy `false`; exception DTO requires full audit fields |
| OD-06 | OWNER APPROVED | Lineup revision DTO with minimum fields listed in `11_` |
| OD-07 | OWNER APPROVED | Separate `CompetitionDivision` + `CompetitionCategory` types |
| OD-08 | OWNER APPROVED | Snapshot DTO at registration/lock; does not replace profile source |
| OD-09 | OWNER APPROVED | Seed inputs read rating at `SEED_LOCKED` only |
| OD-10 | OWNER APPROVED | Waitlist fields on `CompetitionRegistration`; waitlisted ≠ active Entry |

Provisional defaults from the pre-approval draft are **retired**.

---

## Suggested work packages

| WP | Deliverable | Bound by |
|----|-------------|----------|
| WP1 | Contract files + status / lifecycle enums | OD-04, OD-09 status names |
| WP2 | `ParticipantReference` + snapshot types | OD-01, OD-08 |
| WP3 | Entry / Registration / waitlist contracts + uniqueness validators | OD-02, OD-03, OD-10 |
| WP4 | Team / Roster / Lineup / Substitution versioned DTOs | OD-04, OD-05, OD-06 |
| WP5 | Division / Category reference types | OD-07 |
| WP6 | Seed snapshot input types (`SEED_LOCKED`) | OD-09 |
| WP7 | Mapping interfaces + pure golden fixture tests | WP1–6 |
| WP8 | Repository **port interfaces** only (no impl) | Phase 2A persistence APPROVE |
| WP9 | Phase 2B.2 completion report | All |

---

## Test plan (2B.2)

1. Contract validation unit tests (required/optional/immutable markers as pure checks)
2. Golden map: sample Individual entry blob → CompetitionEntry (+ Registration waitlist)
3. Golden map: sample TT teamData → Team/Roster/Lineup revisions
4. Golden map: Daily check-in ids → ParticipantReference[]
5. Negative: Core package import graph must not include format modules
6. Architecture lock: no new violations vs Phase 2A baseline
7. `npm run build` unchanged Production behavior
8. No flag env changes in CI

---

## Exit criteria for 2B.2

- Contracts exist in code (shadow)
- Validators + mapping interfaces tested
- Repository ports declared without implementations
- Flags still OFF
- No Production execution change
- No DB migration
- Completion report
- Explicit stop — do not auto-start 2B.3 / Phase 3

---

## Explicit non-start

```text
Phase 2B.2 must not begin until Owner says GO.
Phase 2B.1 ends at documentation deliverables only.
OD-01…OD-10 are OWNER APPROVED but do not by themselves start 2B.2.
```
