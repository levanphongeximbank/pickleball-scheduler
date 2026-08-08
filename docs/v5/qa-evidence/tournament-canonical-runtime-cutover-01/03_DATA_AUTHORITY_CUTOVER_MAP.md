# Data Authority Cutover Map

| Domain | Authority | Notes |
|--------|-----------|-------|
| Organizer Tournament CRUD | `canonical_tournaments` via cloud repo | Single SSOT |
| Daily Play durable state | same payload | Engines compute; persist via update |
| Internal / Official config + events | same payload | |
| EngineV4 applied state | `engine_v4` column + payload settings | One apply writer |
| Team Tournament (cutover) | TT cloud RPCs `cloud_only` | No active blob mirror |
| Public catalog | remote | mock fallback off |
| Club players / courts pool | club blob (non-Tournament SSOT) | Not Tournament authority |
| Legacy `domain/tournamentService` blob CRUD | demoted / unused on primary routes | TournamentHome not mounted |

## Removed from active path

- `transitionalBlobTournamentRepository`
- Sync placeholder cloud ops (`[]` / `null` / CLOUD_UNAVAILABLE stubs)
- Legacy Tournament data migration script
- default-tenant invent
