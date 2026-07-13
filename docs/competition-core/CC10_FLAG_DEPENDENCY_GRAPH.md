# CC-10 — Flag Dependency Graph

```mermaid
flowchart TD
  CORE[VITE_COMPETITION_CORE_ENABLED]
  RATING[RATING_V2]
  RULES[RULES_V2]
  RULES_ALIAS[CONSTRAINTS_V2 alias]
  DRAW[DRAW_V2]
  FORM[FORMATION_V2]
  MM[MATCHMAKING_V2]
  STAND[STANDINGS_V2]
  SCHED[SCHEDULING_V2]

  CORE --> RATING
  CORE --> RULES
  CORE --> DRAW
  CORE --> FORM
  CORE --> MM
  CORE --> STAND
  CORE --> SCHED
  RULES_ALIAS -.-> RULES
```

## Resolution order

1. Read raw env via `readEnvBoolean` / `resolveRulesV2Flag`
2. If `CORE=false` → all module gates false
3. If `CORE=true` → evaluate each sub-flag independently
4. `resolveCompetitionCoreExecutionMode` → LEGACY if any gate false
5. Production environment → force LEGACY regardless of flags

No circular dependencies. No module flag implies another module flag.
