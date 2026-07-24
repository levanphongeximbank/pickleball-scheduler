# Competition Versioning — Architecture (CM-03)

**Module home:** `src/features/competition-management/competition-versioning/`

**Status:** Domain + application commands + comparison + restore proposal + capability-local in-memory repository + unimplemented production port.  
**Not** production-wired. **No** SQL. **No** UI.

See also: `docs/competition-management/cm-03/01_COMPETITION_VERSIONING.md`

## Layering

```
application/   create / get / list / compare / restore-proposal commands
domain/        re-exports pure validators / fingerprint helpers
contracts/     snapshot + identity + validation envelope + fingerprint
comparison/    typed field differences
restore/       deterministic restore proposal (no execution)
repository/    capability-local in-memory store (tests only)
ports/         CompetitionVersionRepositoryPort (unimplemented production)
constants/     state / numbering / change types / fingerprint algorithm
errors/        CompetitionVersionError + stable CM03_* codes
```

## Fail-closed rules

1. No silent tenant / competition / parent version inference.
2. No first-version or latest-version fallback.
3. Linear lineage only — parent must be current latest.
4. No CM-01 definition mutation or revision bump.
5. No publication / audit / replay / recovery ownership.
6. Field errors sorted deterministically.
7. Lookup always tenant + competition scoped.
