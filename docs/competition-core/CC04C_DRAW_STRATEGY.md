# CC-04C — Canonical Draw Strategy Model

**Phase:** CC-04C | **Status:** Foundation only | **Runtime:** NOT changed

## Purpose

Standardize draw **strategy** as a catalog contract separate from CC-04A draw modes and CC-04B seed pipeline. No calls to `assignGroupsWithConstraints`, snake, heuristic, or balancing runtime.

## DrawStrategyDefinition

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Catalog id (`strategy_snake`, …) |
| `name` | string | Human label |
| `distributionType` | string | See distribution model |
| `requiresSeed` | boolean | Strategy expects ordered seeds |
| `supportsConstraints` | boolean | Constraint policy applicable |
| `supportsBalance` | boolean | Balance policy applicable |
| `supportsRandomization` | boolean | Random draw allowed |
| `supportsManualPlacement` | boolean | Manual slot assignment |
| `supportsGroups` | boolean | Multi-group draw |
| `supportsByes` | boolean | Bye slots supported |
| `supportsTeams` | boolean | Team tournament context |
| `legacyKey` | string? | Legacy runtime mapping key |

Factory: `createDrawStrategyDefinition()`  
Catalog: `CANONICAL_DRAW_STRATEGY_CATALOG` (11 strategies)

## Strategy inventory (audit)

| Strategy | Legacy key | Runtime path (reference) |
|----------|------------|--------------------------|
| Snake | `skill_controlled` | `seededGroupEngine` / `seedTeamsIntoGroups` |
| Random | `open` | `openConditionalRandomEngine` |
| Balanced | `official_ai_balance` | `officialTournamentEngine` + `assignGroupsWithConstraints` |
| Manual | `manual` | Manual group UI |
| AI Heuristic | `heuristic` | `features/tournament-engine/drawEngine` |
| Open | `official_open` | `buildOfficialOpenPlan` |
| Team | `mlp_auto_draw` | `teamAutoDrawEngine` |
| Round Robin | `group_stage_schedule` | `scheduleEngine` group stage |
| Swiss | `swiss` | Contract placeholder — not implemented |
| Knockout Prep | `knockout_bracket` | `bracketEngine` |
| Legacy Custom | `custom` / `constraint_repair` | Custom / repair heuristics |

## Module

`src/features/competition-core/draw/strategy/`

Engine version: `DRAW_STRATEGY_ENGINE_VERSION = "cc04c-v1"`

## Out of scope

- Runtime draw execution
- CC-04D+
- Deploy / migration
