# Ordered Wipe FK Remediation — HARD STOP

**Marker:** `PLATFORM_HARD_CUTOVER_01_ORDERED_WIPE_FK_HARD_STOP_OUT_OF_MANIFEST`  
**Target forensic:** Staging `qyewbxjsiiyufanzcjcq`  
**Production blocked:** `expuvcohlcjzvrrauvud`  
**Database mutations this turn:** `0`

## Root cause

Postgres `TRUNCATE` default is **RESTRICT**: any table with an FK *into* a truncate target must appear in the **same** `TRUNCATE` statement (or use `CASCADE`, which Owner forbids).

Initial failure (`lineup_entries` → `lineups`) is only the first internal edge. Forensic shows additional **out-of-manifest** inbound FKs that still block wiping Team Tournament parents even after multi-table grouping of the current manifest.

## Out-of-manifest inbound FKs (hard stop)

| Source (NOT in wipe) | Target (in wipe) | ON DELETE | Rows |
|----------------------|------------------|-----------|------|
| `referee_assignments` | `team_tournament_matchups` / `sub_matches` | SET NULL | 13 |
| `team_sub_match_referee_links` | matchups / sub_matches / tournaments | CASCADE* | 1 |
| `team_tournament_referee_correction_requests` | matchups / sub_matches / tournaments | SET NULL / CASCADE* | 3 |
| `team_tournament_referee_event_inbox` | matchups / sub_matches | SET NULL | 2 |
| `player_identity_links` | `clubs` | NO ACTION | 0 |

\*FK `ON DELETE CASCADE` does **not** allow truncating the referenced table without listing the source or using `TRUNCATE ... CASCADE`.

## Why multi-table TRUNCATE “within exact manifest” is insufficient

Grouping only tables already listed in `10_ORDERED_WIPE.sql` still leaves the four referee-bridge tables outside the statement. Wipe remains non-executable without:

1. **Owner GO to expand wipe manifest** to include those four tables (preferred under no-CASCADE policy), or  
2. **Owner GO for `TRUNCATE ... CASCADE`** (explicitly declined).

## Package change this PR

**None** to `10_ORDERED_WIPE.sql` — hard stop prevents a false “fixed” package.

## Evidence included

- `05_STAGING_BACKUP_OWNER_CONFIRMATION.json`
- `06_DESTRUCTIVE_STAGE_STOPPED_WIPE_FK_2026-07-30.json`
- `07_ORDERED_WIPE_FK_GRAPH_HARD_STOP_2026-07-30.json`

## Not run

wipe re-run · DROP `club_ai_data` · reseed · Restore · Production mutations
