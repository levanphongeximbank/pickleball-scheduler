# Competition Configuration — Architecture (CM-04)

**Module home:** `src/features/competition-management/competition-configuration/`

**Status:** Domain + application commands + comparison + snapshot projection + template-proposal apply + capability-local in-memory repository + unimplemented production port + partial legacy projector.  
**Not** production-wired. **No** SQL. **No** UI.

See also: `docs/competition-management/cm-04/01_COMPETITION_CONFIGURATION.md`

## Layering

```
application/         create / update / apply-proposal / validate / compare / snapshot commands
domain/              re-exports pure validators
contracts/           aggregate + sections + capability references + validation envelope
comparison/          typed field differences
snapshot/            deterministic CM-03-ready snapshot projection (does not create versions)
template-proposal/   CM-02 fragment extraction / mapping
repository/          capability-local in-memory store (tests only)
ports/               CompetitionConfigurationRepositoryPort (unimplemented production)
adapters/            partial legacy read projector
constants/           status / revision / sections / capability owners
errors/              CompetitionConfigurationError + stable CM04_* codes
```

## Fail-closed rules

1. No silent tenant / competition / policy inference.
2. No CM-01 definition mutation or revision bump.
3. No CM-02 template selection; apply only CM-04-owned fragments.
4. No CM-03 CompetitionVersion creation.
5. No Competition Core engine execution.
6. Unknown section / ownership target / capability owner → typed error.
7. Field errors sorted deterministically.
8. Lookup always tenant + competition scoped.
