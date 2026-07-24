# Competition Definition — Architecture (CM-01)

**Module home:** `src/features/competition-management/competition-definition/`

**Status:** Domain + application commands + legacy read projector + unimplemented repository port.  
**Not** production-wired. **No** SQL. **No** UI.

See also: `docs/competition-management/cm-01/01_COMPETITION_DEFINITION.md`

## Layering

```
application/   createDraft / updateDraft / tenant read guard
domain/        re-exports pure validators
contracts/     CompetitionDefinition + periods + refs + validation envelope
constants/     type / scope / visibility / status / revision / owner kinds
adapters/      legacy tournament → definition projector (read only)
ports/         CompetitionDefinitionRepositoryPort (unimplemented)
errors/        CompetitionDefinitionError + stable codes
```

## Fail-closed rules

1. No silent tenant / venue / club / organizer inference.
2. No silent repair of invalid dates, types, or identity.
3. No first-record fallbacks.
4. Field errors sorted deterministically.
5. Update-draft only when `status === draft`.
6. Immutable: `competitionId`, `tenantId`, `owner`, `createdAt`.
