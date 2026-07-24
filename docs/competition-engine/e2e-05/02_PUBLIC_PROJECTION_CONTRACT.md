# E2E-05 — Public Projection Contract

## Facade

`createPublicCompetitionExperienceFacade(deps?)`

| Method | Gate | Returns |
|--------|------|---------|
| `getPublicCompetitionOverview` | competition published | overview projection |
| `getPublicParticipants` | competition + participants visible | allowlisted participants |
| `getPublicSchedule` | competition + schedule published | matches + public courts |
| `getPublicPools` | competition published | pool groups (published composition) |
| `getPublicStandings` | competition + results published | published standings rows only |
| `getPublicQualification` | competition + results published | qualifiers; empty if unresolved tie |
| `getPublicBracket` | competition + bracket published | rounds/slots/byes; champion if final published |
| `getPublicMatchCenter` | competition published | match center MVP |
| `getPublicFinalResults` | competition + final results published | ranking + awards |
| `getPublicArchiveState` | competition + archive visible | archive status |
| `getPublicCompetitionExperience` | competition published | aggregate of all sections |
| `putPublishedCompetitionSnapshot` | integrator/test seed | store write (not Organizer cmd) |

## Projection invariants

1. **Allowlist mapping only** — never spread canonical objects.
2. **Fail-closed** — missing publication → typed `PublicCompetitionExperienceError`.
3. **Deterministic fingerprints** — `e2e05-*` SHA-256 prefixes; no `Date.now` / `Math.random`.
4. **No parallel engines** — standings/bracket/schedule consumed as published snapshots.
5. **Unresolved ties preserved** — qualification does not silently promote.
6. **No Organizer mutations** — public facade never calls Organizer commands.

## Visibility defaults (from E2E-03 `PUBLICATION_OPS_STATE`)

| State | Competition | Schedule | Participants | Results | Bracket | Final | Archive |
|-------|-------------|----------|--------------|---------|---------|-------|---------|
| `NONE` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `OPERATIONAL_PLAN_PUBLISHED` | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `FINAL_RESULT_PUBLISHED` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗* |

\* Archive requires explicit `visibility.archiveVisible: true`.

## Forbidden fields

See `PUBLIC_FORBIDDEN_KEYS` in `operations/public/projections/allowlists.js` (email, phone, audit, permissions, diagnostics, referee contact, etc.).
