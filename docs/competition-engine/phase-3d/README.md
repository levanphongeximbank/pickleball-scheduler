# Phase 3D — Team / Roster Resolution Runtime

```text
Chat: Phase 3D Team Runtime
Phase: 3D — Team and Roster Runtime
Branch: feature/competition-engine-phase-3d-team-runtime
Base: f76afd9 (latest origin/main; post Phase 3C + player/venue merges)
Pattern: Strangler (Legacy Team Runtime remains Production primary)
Owner: KEEP IN FORMAT — ports / mapping / identity / shadow stubs only
```

## Purpose

Introduce Competition Core **Team Runtime** that maps legacy Team Tournament team/roster sources into canonical models:

```text
Competition Core
  → Team Runtime (competition-core/teams/**)
    → TeamResolver / RosterResolver
      → LegacyTeamAdapter / LegacyRosterAdapter
        → CompetitionTeam / CompetitionRoster
```

Production behavior is unchanged. No root export. No official CI manifest merge. No persistence. No runtime cutover. No Lineup / MLP / Match / Scheduling / substitution workflow.

## Owner architecture locks

| Decision | Value |
|----------|-------|
| Capability root | `competition-core/teams/**` |
| Owns | CompetitionTeam, CompetitionRoster, Team/Roster resolvers, mapping, identity |
| Does not own | Lineup, Scheduling, MLP, Substitution workflow, Match |
| Participant Runtime | DI only — never import |
| Registration Runtime | Do not modify `registrations/**` |
| Format adapters | Keep `teamTournamentParticipantAdapters` map-only |
| Persistence | Stub only |
| Production | Legacy Team Runtime primary |

## Document index

| File | Topic |
|------|-------|
| [architecture.md](./architecture.md) | Layering and ownership |
| [source-audit.md](./source-audit.md) | Pre-implementation audit summary |
| [canonical-model.md](./canonical-model.md) | Canonical Team / Roster fields |
| [identity-contract.md](./identity-contract.md) | Deterministic identity |
| [adapter-contract.md](./adapter-contract.md) | Adapter rules |
| [resolver-behavior.md](./resolver-behavior.md) | Resolver responsibilities |
| [error-model.md](./error-model.md) | Typed runtime errors |
| [production-safety.md](./production-safety.md) | Safety evidence |
| [ownership-manifest.md](./ownership-manifest.md) | File ownership |
| [integrator-handoff.md](./integrator-handoff.md) | Integrator Wave checklist |
| [known-limitations.md](./known-limitations.md) | Known gaps |

## Related

- Phase 3B Participant Runtime: `docs/competition-engine/phase-3b/`
- Phase 3C Registration Runtime: `docs/competition-engine/phase-3c/`
- Phase 3P ownership: `docs/competition-engine/phase-3p/`
- Contracts: `participants/contracts/teamRosterLineup.js`
