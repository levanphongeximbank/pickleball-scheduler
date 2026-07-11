# CC-01 — Legacy Adapter

**Phase:** CC-01 | **Date:** 2026-07-11

---

## 1. Purpose

Provide a **non-invasive shell** around existing engines:

```text
CompetitionEngineInput
  → resolveEngineExecutionPlan (flags + clone)
  → legacy path (CC-01 always)
  → optional legacyExecutor (injected)
  → wrapLegacyEngineResult (envelope only)
```

File: `src/features/competition-core/adapters/legacyAdapter.js`

---

## 2. Legacy engines documented (not imported)

| COMPETITION_ENGINE_TYPE | Legacy implementation(s) |
|-------------------------|---------------------------|
| `draw` | `drawEngine.generateDraw`, `seededGroupEngine`, `openConditionalRandomEngine` |
| `team_formation` | `teamPairingEngine`, `tournament.seeding.logic` |
| `matchmaking` | `ai/engine.runAI` |
| `scheduling` | `scheduleEngine`, `tournament.fixtures.logic` |
| `standings` | `rankingEngine`, `teamStandingsEngine` |
| `rating` | `eloEngine`, `eloService`, `clubEloService` |

IDs stored in `LEGACY_ENGINE_IDS` for metadata only.

---

## 3. Not yet wrapped / connected

| Surface | Reason |
|---------|--------|
| `InternalTournamentSetup` | Risk of output change if wired without shadow mode |
| `OfficialTournamentSetup` | Multiple draw paths (open vs AI balance) |
| `SelectPlayers` / `DailyPlaySetup` | AI Core tightly coupled to persist |
| `tournamentService.updateTournament` | Rating side effects |
| Tournament Engine 4.0 UI | Already has own orchestrator + run log |

**CC-01:** Adapter is **library-only**. Routes unchanged.

---

## 4. Behavior guarantees

| Guarantee | Implementation |
|-----------|----------------|
| No algorithm change | No imports of legacy engine modules |
| No DB writes | No `clubStorage`, `localStorage`, Supabase |
| Input preserved | `cloneCompetitionEngineInput` + tests |
| Legacy result passthrough | `wrapLegacyEngineResult` assigns `result` by reference |
| Flags off → legacy | `resolveEngineExecutionPlan` |
| V2 flag on → still legacy | `isEngineV2Available() === false` |

---

## 5. API summary

| Function | Role |
|----------|------|
| `resolveEngineExecutionPlan(input, env?)` | Plan only, no execution |
| `executeCompetitionEngine(input, { legacyExecutor, envSource })` | Delegate when executor provided |
| `wrapLegacyEngineResult({...})` | Envelope wrapper |
| `isEngineV2Available()` | Always `false` in CC-01 |

Without `legacyExecutor`, `executeCompetitionEngine` returns `success: false` with pending metadata — safe no-op.

---

## 6. Future wiring (CC-04+)

```javascript
await executeCompetitionEngine(input, {
  envSource: import.meta.env,
  legacyExecutor: (normalized) => generateDraw(normalized.payload),
});
```

Shadow mode (CC-12) will run legacy + V2 in parallel, compare outputs, without writing V2 to tournament blob.
