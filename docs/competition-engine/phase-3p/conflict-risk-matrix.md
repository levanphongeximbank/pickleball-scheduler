# Conflict Risk Matrix — Phase 3P

Levels: **LOW** | **MEDIUM** | **HIGH** | **CRITICAL**

| Phase | Shared index | Shared manifest | Shared contract | Shared fixture | Runtime registry | Legacy adapter | Database | Prod request-path | Overall |
|-------|--------------|-----------------|-----------------|----------------|------------------|----------------|----------|-------------------|---------|
| 3B Participant | HIGH | MEDIUM | HIGH | MEDIUM | MEDIUM | MEDIUM | LOW | LOW* | **HIGH** |
| 3C Registration | HIGH | MEDIUM | HIGH | MEDIUM | MEDIUM | MEDIUM | LOW | LOW* | **HIGH** |
| 3D Team | MEDIUM | MEDIUM | HIGH | MEDIUM | LOW | MEDIUM | MEDIUM† | LOW* | **HIGH** |
| 3E Lineup | MEDIUM | MEDIUM | HIGH | MEDIUM | LOW | MEDIUM | MEDIUM† | LOW* | **HIGH** |
| 3F Seeding | MEDIUM | LOW | MEDIUM | LOW | LOW | MEDIUM | LOW | LOW* | **MEDIUM** |
| 3G Draw | MEDIUM | LOW | MEDIUM | MEDIUM | LOW | HIGH | LOW | MEDIUM‡ | **HIGH** |
| 3H Match | MEDIUM | LOW | MEDIUM | MEDIUM | LOW | HIGH | LOW | MEDIUM‡ | **HIGH** |
| 3I Schedule | MEDIUM | LOW | MEDIUM | MEDIUM | LOW | HIGH | LOW | MEDIUM‡ | **HIGH** |
| 3J Lifecycle | MEDIUM | LOW | MEDIUM | MEDIUM | MEDIUM | CRITICAL | HIGH | **CRITICAL** | **CRITICAL** |
| 3K Standings | MEDIUM | LOW | MEDIUM | MEDIUM | LOW | HIGH | LOW | MEDIUM‡ | **HIGH** |
| 3L Publication | MEDIUM | LOW | LOW | MEDIUM | LOW | HIGH | MEDIUM† | HIGH | **HIGH** |
| 3M Cutover | CRITICAL | MEDIUM | HIGH | HIGH | CRITICAL | CRITICAL | HIGH | **CRITICAL** | **CRITICAL** |
| 3N Retirement | HIGH | LOW | MEDIUM | LOW | HIGH | CRITICAL | MEDIUM | CRITICAL | **CRITICAL** |

\* LOW only while Production wiring is forbidden (Phase 3P policy through early waves).  
† TT cloud / publish RPCs — format path.  
‡ Existing wrappers may already touch Production engines as map-only; risk rises if chats edit those engines.

## Highest-risk files

1. `src/features/competition-core/index.js`
2. `src/features/competition-core/participants/contracts/**` (especially `teamRosterLineup.js`, barrels)
3. `scripts/ci/unit-test-files.json`
4. `src/features/competition-core/runtime-control/**`
5. `src/domain/tournamentLifecycle.js` / match live paths (3J+)
6. `src/tournament/engines/internalTournamentEngine.js` / `officialTournamentEngine.js`
7. `src/features/competition-core/config/featureFlags.js`

## Highest-risk phases

```text
CRITICAL: 3J Lifecycle, 3M Cutover, 3N Retirement
HIGH:     3B, 3C, 3D, 3E, 3G, 3H, 3I, 3K, 3L
MEDIUM:   3F Seeding (best isolated existing module)
```

## Mitigation summary

| Risk | Mitigation |
|------|------------|
| Index | Integrator-only root export |
| Manifest | Phase sub-manifest + Integrator merge |
| Contract | File partition + freeze gates |
| Registry | Integrator-owned registration |
| Prod path | Explicit forbid until Owner GO |
| Database | No migrations in 3B–3L runtime phases |
