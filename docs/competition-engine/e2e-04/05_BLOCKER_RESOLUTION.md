# E2E-04 — Blocker Resolution

| Blocker | Status | Notes |
|---------|--------|-------|
| BG-08 — Player/Referee permission and tenant path | **CLOSED (E2E-04 scope)** | Facades authorize via E2E-01; ownership + assignment gates; no client grants |
| BG-09 — Player/Referee portal runtime readiness | **PARTIAL / HARDENED** | Application facades + view-models ready; legacy pages not fully rewired to production runtime |
| Score-entry / result-validation runtime gap | **CLOSED (ops handoff)** | Wired to CORE-16/17 inside referee facade; not production Supabase persistence |
| Referee assignment runtime gap | **CLOSED (ops handoff)** | Consumes CORE-13 assignment records via `seedAssignments` / store upsert; no parallel planner |
| Production portal wiring / SQL remote | **OPEN (out of scope)** | Deferred |
| E2E-05 Public Experience | **OUT OF SCOPE** | No collision edits |

## New blockers

None raised that block E2E-04 MVP completion inside owned paths.
