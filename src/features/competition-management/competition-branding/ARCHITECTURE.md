# Competition Branding — Architecture (CM-05)

**Status:** capability-local / dormant  
**Owns:** competition-level visual identity metadata and explicit asset references  
**Does not own:** CM-01 name/description, CM-04 configuration, upload/storage, publication, platform/tenant/venue/club branding

## Layering

```
application/     create/update/validate/compare/snapshot/readiness commands
domain/          re-exports of aggregate validators + accessibility
contracts/       aggregate, assets, colors, typography, presentation
accessibility/   WCAG 2.1 relative luminance baseline (deterministic)
readiness/       publication-facing readiness (no network / no publish)
comparison/      deterministic field diffs
snapshot/        CM-03-ready projection (does not create versions)
repository/      capability-local in-memory only
ports/           unimplemented production persistence port
adapters/        explicit legacy partial projector
```

## Runtime

- `wiredToProductionRuntime: false`
- `hasPersistence: false`
- `hasUi: false`
- `hasMigration: false`
- `sponsorMarksDeferred: true`
