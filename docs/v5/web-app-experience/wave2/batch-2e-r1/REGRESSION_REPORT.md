# Batch 2E-R1 — REGRESSION REPORT

## Targeted

| Check | Result |
|-------|--------|
| Architecture lock `tests/web-app-wave2-batch2e-r1-players-readiness.test.js` | PASS |
| UI readiness regression `tests/ui/web-app-wave2-batch2e-r1-players-readiness.ui.test.jsx` (4 cases) | PASS |
| Players no-club readiness (no club-scoped call / no throw) | PASS |
| Players valid club path preserved | PASS |
| Players platform mode without club | PASS |
| Fake club fallback absent | PASS |
| Batch 2B–2E unit suite (66) | PASS |
| `lint:no-new` | PASS |
| `build` | PASS |

## Design freeze

```
PLAYERS_TOURNAMENT_HEADER_LEAK_POST=0
PLAYERS_TOURNAMENT_STATE_LEAK_POST=0
NEW_CLUB_CONTEXT_SYSTEM=NO
FAKE_CLUB_FALLBACK=NO
CANONICAL_CLUB_REQUIREMENT_PRESERVED=YES
BLANK_WHITE_SCREEN_ALLOWED=NO
STATE_SEMANTICS_COLLAPSED=NO
```

## Domain freeze

```
PLAYER_DOMAIN_LOGIC_CHANGED=NO
CLUB_AUTHORITY_CHANGED=NO
TENANT_AUTHORITY_CHANGED=NO
AUTHORIZATION_CHANGED=NO
BACKEND_CHANGED=NO
DATABASE_CHANGED=NO
SQL_EXECUTED=NO
```

## Batch 2E re-certification note

Live Preview evidence has precedence for the prior Players blank-screen failure. Prior 2E “PASS” for Players functional pilot is superseded until Owner Preview re-check confirms render.

```
PILOT_FUNCTIONAL_PARITY=PENDING_OWNER_PREVIEW
INTRODUCED_FAILURES=PLAYERS_CLUB_REQUIRED_BLANK_FIXED_IN_R1
```
