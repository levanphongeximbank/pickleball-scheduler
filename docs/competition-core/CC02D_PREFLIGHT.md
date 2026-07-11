# CC-02D — Pre-flight

Phase: **CC-02D** | Date: 2026-07-11

## Project identification

| Environment | Ref | Name | Source |
|-------------|-----|------|--------|
| **STAGING** | `qyewbxjsiiyufanzcjcq` | pickleball-scheduler-stagin | `docs/v5/V5_SAAS_COMPLETION_ROADMAP.md`, MCP `supabase-staging` |
| **PRODUCTION** | `expuvcohlcjzvrrauvud` | pickleball-scheduler-production | Same roadmap — **NOT touched** |

## Guards

| Check | Status |
|-------|--------|
| Staging ref confirmed | PASS |
| Production ref documented, not used | PASS |
| Production service-role key used | NO |
| Stash `wip-before-competition-core-cc02-2026-07-11` restored | NO (unchanged) |
| TT1B/team-tournament files in CC-02D commit | NO |

## Env sources

- Supabase MCP: `project-0-pickleball-scheduler-supabase-staging`
- Local helper: `scripts/load-env.mjs` → `getStagingSupabaseEnv()` validates ref `qyewbxjsiiyufanzcjcq`

## Verdict

**GO** for staging-only CC-02D apply.

Production migration: **NOT APPLIED**  
Feature flags production: **OFF**  
CC-03: **NOT STARTED**
