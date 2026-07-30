# Ordered Wipe — FK closure complete (+6) package authored

**Marker:** `PLATFORM_HARD_CUTOVER_01_ORDERED_WIPE_FK_CLOSURE_COMPLETE_2026-07-30`  
**Fresh main:** `751952cc9ddca39c15365b3a1cecb4db4da3e161` (PR #338 MERGED)  
**Forensic:** Staging `qyewbxjsiiyufanzcjcq` read-only  
**Production blocked:** `expuvcohlcjzvrrauvud`  
**DB mutations this turn:** `0`

## Closure fixed point

Recursive inbound `public` FK from original wipe + Owner-approved 6 reached fixed point with:

| Class | Count |
|-------|-------|
| original wipe | 86 |
| owner-approved 6 | 6 |
| newly discovered outside approved | **0** |
| protected in closure | **0** |
| unresolved inbound FK | **0** |

No CASCADE. No scope drift beyond the approved 6.

## Approved +6 (row counts)

| Table | Rows | Tenants | Notes |
|-------|------|---------|-------|
| `referee_assignments` | 13 | 4 | bridge |
| `team_sub_match_referee_links` | 1 | 1 | bridge |
| `team_tournament_referee_correction_requests` | 3 | 1 | bridge |
| `team_tournament_referee_event_inbox` | 2 | 1 | bridge |
| `player_identity_links` | 0 | 0 | schema blocker for `DELETE clubs` |
| `referee_device_sessions` | 0 | 0 | session bridge; truncate rows only; no auth secrets |

## Package change

`10_ORDERED_WIPE.sql`:

- Adds exact 6 tables
- Multi-table `TRUNCATE` per connected component (TT+referee includes `referee_device_sessions` with `referee_assignments`)
- `player_identity_links` truncated before `DELETE FROM clubs`
- No CASCADE; BEGIN/COMMIT + protected snapshot retained
- DROP / reseed packages unchanged; destructive stage **not** executed
