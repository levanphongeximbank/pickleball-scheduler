# Tournament Route Inventory

**Audit date:** 2026-08-05  
**Source:** `src/router.jsx` (static read-only inspection)  
**Authoritative count:** **54** routes  
**Primary classification sum:** 54 (matches total)

## Classification policy

Each route has **exactly one** primary classification: `CANONICAL | LEGACY | DUPLICATE | SHADOW | DEAD | UNRESOLVED`.

`DUPLICATE` as a **primary** class is unused in this inventory. Engine 4.0 routes are primary **CANONICAL** and carry a **secondary** attribute `duplicateConflictWithLegacySetup` (they conflict with active legacy `/tournament/*` setup authority on the same blob).

### A. Primary route classification

| Class | Count |
|-------|------:|
| CANONICAL | 8 |
| LEGACY | 46 |
| DUPLICATE | 0 |
| SHADOW | 0 |
| DEAD | 0 |
| UNRESOLVED | 0 |
| **PRIMARY_CLASSIFICATION_SUM** | **54** |
| Matches total | **YES** |

- **CANONICAL (8):** `/tournaments` public catalog (1) + `/tournaments/:id/*` Engine 4.0 (7)
- **LEGACY (46):** `/tournament/*` hubs/setup/brackets/director (43) + related portals `/daily-play`, `/team-portal/:id`, `/team-referee/:id` (3)

### B. Secondary route attributes

| Attribute | Count |
|-----------|------:|
| DUPLICATE_CONFLICT_ROUTE_COUNT | 7 |
| ROUTE_CONFLICT_COUNT | 1 |
| LEGACY_ACTIVE_RUNTIME_COUNT | 4 |
| COMPATIBILITY_REDIRECT_COUNT | 0 |
| ENGINE_4_ROUTE_COUNT | 7 |
| PUBLIC_ROUTE_COUNT | 1 |
| RELATED_PORTAL_ROUTE_COUNT | 3 |

**Prior arithmetic error:** reporting `CANONICAL=8 + LEGACY=44 + DUPLICATE=7` mixed a secondary conflict attribute into primary totals. Corrected: primary DUPLICATE=0; secondary duplicateConflict=7; primary LEGACY=46.

## Owner-observed Production routes (defect evidence)

| Route | Component | Defect | Primary |
|-------|-----------|--------|---------|
| `/tournament/daily/tournament-1785921300822` | `DailyPlaySetup` | TP-UI-001 | LEGACY |
| `/tournament/internal/tournament-1785921409840` | `InternalTournamentSetup` | TP-UI-002 | LEGACY |
| `/tournament/official/tournament-1785921550968` | `OfficialTournamentSetup` | TP-UI-003 | LEGACY |

## High-risk legacy active runtime (secondary)

| Path | Component |
|------|-----------|
| `/tournament/daily/:tournamentId` | DailyPlaySetup |
| `/tournament/internal/:tournamentId` | InternalTournamentSetup |
| `/tournament/official/:tournamentId` | OfficialTournamentSetup |
| `/tournament/team/:tournamentId` | TeamTournamentSetup |

## Layout provider stack (MainLayout routes)

```
TenantProvider → ClubProvider → SeasonProvider → TenantGate → RouteAccessGate → Outlet
```

Machine-readable inventory: `TOURNAMENT_ROUTE_INVENTORY.json`
