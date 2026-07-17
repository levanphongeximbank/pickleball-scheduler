# Phase 2B.2 — Canonical Contracts, Validators and Repository Ports

**Phase:** 2B.2  
**Date:** 2026-07-17  
**Branch:** `feature/competition-engine-phase-2b2-participant-contracts`  
**Base:** latest `origin/main` (includes Phase 2B.1 merge `6d9d574` and subsequent main tip)  
**Mode:** Shadow / contract-only — **no Production runtime cutover**

---

## Verdict (pre-commit)

```text
PHASE 2B.2 IMPLEMENTATION READY TO COMMIT
```

(Final gate results recorded in `08_TEST_AND_PARITY_EVIDENCE.md`.)

---

## Goal delivered

Implemented pure participant-domain foundation under Competition Core:

- Canonical contracts / factories
- Status + lifecycle enums
- Identity reference model (OD-01)
- Pure validators (no side effects)
- Versioned JSON-safe DTOs (v1)
- Legacy → canonical mapping interfaces + fixture mappers
- Repository **port interfaces** only (no Supabase/SQL adapters)

## Module path

```text
src/features/competition-core/participants/
```

Exported through:

```text
src/features/competition-core/index.js
```

## Owner decisions bound in code

| OD | Status | Code reflection |
|----|--------|-----------------|
| OD-01 | OWNER APPROVED | `PARTICIPANT_REFERENCE_KIND` includes GUEST; alias link does not change id |
| OD-02 | OWNER APPROVED | `detectDuplicateActiveEntryScopes` |
| OD-03 | OWNER APPROVED | Entry requires `competitionId` |
| OD-04 | OWNER APPROVED | `ROSTER_LOCKED` status + lifecycle marker |
| OD-05 | OWNER APPROVED | Substitution reference + locked mutation guard |
| OD-06 | OWNER APPROVED | Lineup revision chain validators |
| OD-07 | OWNER APPROVED | Separate Division + Category contracts |
| OD-08 | OWNER APPROVED | `ParticipantSnapshot` |
| OD-09 | OWNER APPROVED | `SeedLockedRatingSnapshot` / `SEED_LOCKED` |
| OD-10 | OWNER APPROVED | Waitlist on Registration; not active Entry |

## Explicit non-goals (unchanged)

- No runtime adapter cutover
- No Team/Daily/Individual migration
- No SQL / schema / env / feature-flag changes
- No Phase 2B.3 start

## Document index

| File | Purpose |
|------|---------|
| `01_IMPLEMENTED_CONTRACTS.md` | Contract inventory |
| `02_VALIDATION_MODEL.md` | Validator model |
| `03_IDENTITY_IMPLEMENTATION.md` | Identity kinds |
| `04_DTO_VERSIONING.md` | DTO v1 |
| `05_MAPPING_INTERFACES.md` | Mapping interfaces |
| `06_REPOSITORY_PORTS.md` | Port shapes |
| `07_PUBLIC_API_EXPORTS.md` | Public exports |
| `08_TEST_AND_PARITY_EVIDENCE.md` | Test/gate evidence |
| `09_RISKS_AND_ROLLBACK.md` | Risks / rollback |
| `10_PHASE_2B3_ENTRY_CRITERIA.md` | Next-phase gate |
