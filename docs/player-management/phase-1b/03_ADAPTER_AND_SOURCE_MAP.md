# 03 — Adapter and Source Map

| Source | Adapter | Role in Phase 1B |
|--------|---------|------------------|
| `profiles` | `adaptProfileRow` | Account + `player_id` bridge; accountStatus |
| `club_data_v3.data.players[]` | `adaptBlobPlayerRow` | Legacy operational roster |
| `athletes` | `adaptAthleteRow` | Cloud person alias (no invented playerId) |
| `canonicalPlayerRepository.resolvePlayerForProfile` | wrapped in `resolveByAuthUser` | MAPPED/DERIVED/UNMAPPED/INVALID policy |
| `buildDerivedAuthPlayerId` | `buildAuthLinkedPlayerId` | Auth-linked convention |
| Gender (`Nam`/`Nữ`/…) | `normalizePlayerGender` | Output `male`\|`female`\|`unknown` only |

## Ownership (unchanged)

| Concern | Owner |
|---------|-------|
| Account fields | Identity |
| Player profile read normalization | Player Management (this facade) |
| Membership | Club |
| Participant refs/snapshots | Competition |
| Rating / ranking records | Rating / Ranking modules |
| Venue customers | Venue — **not** auto-treated as players |

## Explicitly not created

- New player table  
- New localStorage identity key  
- Write/create/update/delete persistence APIs  
