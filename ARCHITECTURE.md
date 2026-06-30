# Architecture — Pickleball Scheduler Pro v3.5.1

## Module layout (freeze — non-destructive)

**Production (routes hiện tại):** `src/pages/`, `src/router.jsx` → `pages/`

**Song song (chưa route):**

```
src/features/
  tournament/director/     # Director Mode (copy tách)
  statistics/              # Thống kê (copy tách)
```

**Nháp tham chiếu (không import production):** `src/legacy/`

## Layering rules

| Layer | Responsibility |
|-------|----------------|
| `components/` | Presentational UI, props only |
| `hooks/` | React state, effects, wiring |
| `services/` | Pure business helpers, export, persistence orchestration |
| `engines/` | Algorithms (tournament, AI, booking) — no React |
| `domain/` | Club storage, tournament service, cross-cutting persistence |
| `pages/` | Route entry thin re-exports (transition) |

**Do not** mix export CSV logic inside large page components. **Do not** add new code to `src/legacy/`.

## Core modules map

| Module | Primary paths |
|--------|----------------|
| Tournament | `src/pages/tournament/`, `src/tournament/engines/`, `src/components/tournament/` |
| League / Season | `src/domain/seasonService.js`, `src/context/SeasonContext.jsx` |
| Court Management | `src/pages/courtManagement/`, `src/domain/courtBookingEngine.js` |
| Scheduler / AI | `src/ai/`, `src/pages/SelectPlayers.jsx` |
| Ranking / Elo | `src/tournament/engines/rankingEngine.js`, `eloEngine.js` |
| Statistics | `src/features/statistics/` |
| Auth | `src/auth/`, `src/context/AuthContext.jsx` |
| RBAC | `src/auth/rolePermissions.js`, `RequireRole.jsx` |
| Finance (scaffold) | `src/domain/paymentService.js`, court revenue pages |
| Notification (scaffold) | `BookingNotificationPanel.jsx` |

## Router

- `/tournament` → `TournamentShell` (not legacy `Tournament.jsx`)
- `/tournament/director/:id` → `features/tournament/director`
- `/statistics` → `features/statistics`

## Storage (unchanged v3)

- Club blob: `pickleball-club-data-v3::{clubId}`
- AI sessions via `loadAIData()` / `saveAIData()`
