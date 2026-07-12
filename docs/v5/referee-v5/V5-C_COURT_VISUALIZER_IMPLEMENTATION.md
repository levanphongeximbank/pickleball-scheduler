# Referee V5-C — Court Visualizer Implementation

**Date:** 2026-07-12  
**Phase:** V5-C (Court Visualizer Prototype)  
**Feature flag:** `VITE_REFEREE_V5_ENABLED=false` (default)

---

## Precondition (owner requirement)

| Item | Status |
|------|--------|
| `UNDO_LAST_EVENT` via `dispatchMatchCommand` | ✅ PASS |
| `UNDO_LAST_EVENT` via `applyMatchEvent` + `eventHistory` | ✅ PASS |
| MLP rally scoring rejected | ✅ PASS |
| UI commands only (no direct state mutation) | ✅ PASS |

---

## Delivered

### Command layer
- `dispatchMatchCommand()` — official UI entry point
- `applyMatchEvent()` handles `UNDO_LAST_EVENT`, `PAUSE_MATCH`, `RESUME_MATCH`
- `RALLY_VARIANT.MLP` rejected at `initializeMatchState`

### UI module (`src/features/referee-v5/`)
- `RefereeV5Workspace` — mobile-first layout
- `CourtVisualizer` + `PlayerPositionCard` + `ServeDirectionArrow`
- `RefereeScoreboard`, `ServeContextPanel`, `RefereeActionPanel`
- `MatchEventTimeline`, `RefereeMatchHeader`
- `useRefereeMatchController`, `useCourtVisualizerState`
- Prototype fixtures + `/dev/referee-v5` route (Super Admin + flag)

### Scoring scope in prototype
| Mode | Status |
|------|--------|
| Doubles side-out | ✅ Enabled |
| Singles side-out | ✅ Enabled |
| Basic rally | ⚠️ Engine only — not exposed in UI picker |
| MLP rally | ❌ Rejected / NOT SUPPORTED |

---

## Route

```text
/dev/referee-v5
```

- Guard: `SuperAdminRouteGuard`
- Content: gated by `isRefereeV5Enabled()`
- Not in production navigation
- Uses fixture data only

---

## Out of scope (unchanged)

SQL, RPC, Supabase, realtime, offline, production deploy, legacy referee routes.

---

## Recommended next phase

**V5-D** — Persistence, RPC, RLS, transactional event application.
