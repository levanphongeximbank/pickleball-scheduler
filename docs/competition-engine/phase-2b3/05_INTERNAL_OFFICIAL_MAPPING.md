# 05 — Internal / Official Mapping

**Module:** `src/tournament/adapters/competition-core/internal-official/`

Reuses Individual entry mapping; adds formatKind extensions.

| Evidence | Mapper |
|----------|--------|
| Internal member / BTC-style active entry | `mapInternalMemberRegistration` |
| Official open registration | `mapOfficialOpenRegistration` |
| Bundle: entry + player + division/category | `mapInternalOfficialEvidenceBundle` |

## Coverage

- Internal registration → Registration + Entry
- Official/open registration → same + open metadata extension
- Division / category via Individual classification mapper
- Seed rating snapshot when `seedLocked: true` (OD-09)
- Participant snapshots at registration/lock

**Runtime engines unchanged** (`internalTournamentEngine`, `officialTournamentEngine`).
