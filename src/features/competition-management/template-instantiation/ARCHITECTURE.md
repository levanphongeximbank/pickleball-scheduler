# Template Selection & Instantiation — Architecture (CM-02)

**Module home:** `src/features/competition-management/template-instantiation/`

**Status:** Domain + application commands + capability-local catalog + legacy read projector + unimplemented catalog port.  
**Not** production-wired. **No** SQL. **No** UI.

See also: `docs/competition-management/cm-02/01_TEMPLATE_SELECTION_INSTANTIATION.md`

## Layering

```
application/   list / get / select / evaluate / instantiate / register
domain/        re-exports pure validators / evaluators
contracts/     template definition + compatibility + instantiation plan/result
catalog/       in-memory/static capability-local catalog (not production DB)
constants/     scope / availability / participant mode / ownership targets
adapters/      legacy mode/preset → template candidate projector (read only)
ports/         CompetitionTemplateCatalogPort (unimplemented)
errors/        CompetitionTemplateError + stable CM02_* codes
```

## Fail-closed rules

1. No first-template fallback / no inferred template from type or route.
2. No tenant / owner / venue / club inference.
3. No silent replace of existing template reference (requires `replaceIntent`).
4. Draft-only CompetitionDefinition; explicit `expectedRevision` on instantiate.
5. Compatibility PASS required before template reference appears in proposal.
6. Instantiation returns patch/proposal only — does not mutate CM-01 input or write DB.
7. Field/issue ordering deterministic.
