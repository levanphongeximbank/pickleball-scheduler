# Ecosystem & Integrations

Foundation workstream for canonical connectors, provider-neutral envelopes,
webhook verification ports, secret/environment boundary, legacy Vite secret
cutover, provider adapter foundation, webhook ingress foundation, and
integration observability / structural final certification.

| Phase | Status | Summary |
|-------|--------|---------|
| ECO-01 | Implemented (structural) | Canonical connector & event foundation |
| ECO-02 | Implemented (structural) | Secret & environment boundary (no live credentials) |
| ECO-02b | Implemented (structural) | Legacy `VITE_*` browser-secret cutover (fail-closed) |
| ECO-03 | Implemented (structural) | Provider adapter foundation (no live providers) |
| ECO-04 | Implemented (structural) | Webhook ingress foundation (no Production routes) |
| ECO-05 | Implemented (structural) | Observability + structural final certification |
| ECO-06+ | Not started | Live provider / staging webhook activation (Owner GO) |

## Boundaries

- **In:** `src/features/ecosystem-integrations/**`, legacy integration config
  cutover under `src/features/integrations/config/**`, matching docs/tests
- **Out:** Platform Core internals, Competition Engine, Finance ledger,
  Notification worker, live provider activation, public Production webhooks

See:

- `eco-01/01_CANONICAL_CONNECTOR_EVENT_FOUNDATION.md`
- `eco-02/01_SECRET_ENVIRONMENT_BOUNDARY.md`
- `eco-02b/01_LEGACY_VITE_SECRET_CUTOVER.md`
- `eco-03/01_PROVIDER_ADAPTER_FOUNDATION.md`
- `eco-04/01_WEBHOOK_INGRESS_FOUNDATION.md`
- `eco-05/01_OBSERVABILITY_FINAL_CERTIFICATION.md`
