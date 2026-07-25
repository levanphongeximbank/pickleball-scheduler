# Ecosystem & Integrations

Foundation workstream for canonical connectors, provider-neutral envelopes,
webhook verification ports, secret/environment boundary, and integration
observability metadata.

| Phase | Status | Summary |
|-------|--------|---------|
| ECO-01 | Implemented (structural) | Canonical connector & event foundation |
| ECO-02 | Implemented (structural) | Secret & environment boundary (no live credentials) |
| ECO-03+ | Not started | Provider adapters, webhook ingress (Owner GO) |

## Boundaries

- **In:** `src/features/ecosystem-integrations/**`, matching docs/tests
- **Out:** Platform Core internals, Competition Engine, Finance ledger,
  Notification worker, Sprint 10 marketplace settings cutover (deferred)

See:

- `eco-01/01_CANONICAL_CONNECTOR_EVENT_FOUNDATION.md`
- `eco-02/01_SECRET_ENVIRONMENT_BOUNDARY.md`
