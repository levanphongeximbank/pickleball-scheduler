# Ecosystem & Integrations

Foundation workstream for canonical connectors, provider-neutral envelopes,
webhook verification ports, secret/environment boundary, legacy Vite secret
cutover, and integration observability metadata.

| Phase | Status | Summary |
|-------|--------|---------|
| ECO-01 | Implemented (structural) | Canonical connector & event foundation |
| ECO-02 | Implemented (structural) | Secret & environment boundary (no live credentials) |
| ECO-02b | Implemented (structural) | Legacy `VITE_*` browser-secret cutover (fail-closed) |
| ECO-03+ | Not started | Provider adapters, webhook ingress (Owner GO) |

## Boundaries

- **In:** `src/features/ecosystem-integrations/**`, legacy integration config
  cutover under `src/features/integrations/config/**`, matching docs/tests
- **Out:** Platform Core internals, Competition Engine, Finance ledger,
  Notification worker, live provider activation

See:

- `eco-01/01_CANONICAL_CONNECTOR_EVENT_FOUNDATION.md`
- `eco-02/01_SECRET_ENVIRONMENT_BOUNDARY.md`
- `eco-02b/01_LEGACY_VITE_SECRET_CUTOVER.md`
