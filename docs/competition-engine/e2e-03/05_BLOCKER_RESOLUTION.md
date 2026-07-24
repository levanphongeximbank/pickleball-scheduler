# E2E-03 — Blocker Resolution

## BG-07 — Organizer runtime wiring / publication / archive operations

| Field | Content |
|-------|---------|
| Before | E2E-02 closed composition boundary only; Organizer publish/archive ops unwired |
| Evidence | `createOrganizerOperationsFacade` wires prepare→pool→schedule→courts→publish→check-in→match→KO→complete→final publish→archive readiness |
| After | **CLOSED for Organizer Operations MVP path** |
| Carry-forward | Full CM-06/CM-08 persistence + legacy UI adapter cutover; production `wiredToProductionRuntime` remains false until portal cutover |

## BG-08 — Permission / tenant path on Organizer operations

| Field | Content |
|-------|---------|
| Before | No Organizer action→Identity permission enforcement at competition-engine ops boundary |
| Evidence | `organizerActionMap` + `authorizeOrganizerCommand` fail-closed; client grants rejected; cross-tenant rejected |
| After | **CLOSED for Organizer Operations path only** (not system-wide portal certification) |

## BG-09 — Portal-wide runtime readiness (Organizer scope)

| Field | Content |
|-------|---------|
| Before | Organize/Operations hubs are nav shells; no unified ops projection |
| Evidence | Operational projection + `buildOrganizerPortalSections` (10 sections); no global router change |
| After | **CLOSED for Organizer MVP contract / view-model scope** |
| Carry-forward | Full Director/Registration/Schedule page adapters remain REUSE_WITH_ADAPTER for later waves |

## New blockers

None requiring stop. Player/Referee portals and public Match Center remain E2E-04 / E2E-05.
