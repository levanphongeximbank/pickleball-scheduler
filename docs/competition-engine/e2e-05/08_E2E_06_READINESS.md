# E2E-05 → E2E-06 Readiness

## After E2E-05

Public Competition Experience MVP provides:

- Published-only read facade
- Publication/privacy fail-closed gates
- Match Center MVP (snapshot / poll-ready)
- Presentation section view-model (no router redesign)

## E2E-06 may consume

- `createPublicCompetitionExperienceFacade` query surface
- `buildPublicCompetitionExperienceSections`
- Publication visibility matrix
- Match Center fingerprint for refresh adapters

## Still out of E2E-05 / hand to later waves

- Production runtime wiring (`wiredToProductionRuntime: true`)
- Anonymous PublicLayout route for competition detail (still MainLayout legacy)
- Realtime live score transport
- News / sponsors / SEO / payment / CRM
- Full public directory redesign
- Player/Referee operations (E2E-04 ownership)

## Recommended E2E-06 focus (suggestion)

Integrator cutover: seed public store from Organizer publish events; deep-link `TournamentCard` → published competition experience; keep mocks out of readiness gates.
