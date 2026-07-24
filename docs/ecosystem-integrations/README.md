# Ecosystem & Integrations

Foundation workstream for canonical connectors, provider-neutral envelopes, webhook verification ports, and integration observability metadata.

| Phase | Status | Summary |
|-------|--------|---------|
| ECO-01 | Implemented (structural) | Canonical connector & event foundation |
| ECO-02+ | Not started | Real provider adapters (Owner GO), secret boundary migration, webhook ingress |

## Boundaries

- **In:** `src/features/ecosystem-integrations/**`, matching docs/tests
- **Out:** Platform Core internals, Competition Engine, Finance ledger, Notification worker, Sprint 10 marketplace settings

See `eco-01/01_CANONICAL_CONNECTOR_EVENT_FOUNDATION.md`.
