# Ordered Wipe — Expand-5 HARD STOP (residual FK)

**Marker:** `PLATFORM_HARD_CUTOVER_01_ORDERED_WIPE_FK_EXPAND5_HARD_STOP_RESIDUAL`  
**Fresh main:** `8885dbf7087b478b9f53e618507ff2c0538c8075` (PR #337 MERGED)  
**Forensic target:** Staging `qyewbxjsiiyufanzcjcq` (read-only)  
**Production blocked:** `expuvcohlcjzvrrauvud`  
**Database mutations this turn:** `0`

## Owner decision under test

- No `TRUNCATE ... CASCADE`
- Allow wipe manifest expand by **exactly** these 5 tables:
  1. `referee_assignments`
  2. `team_sub_match_referee_links`
  3. `team_tournament_referee_correction_requests`
  4. `team_tournament_referee_event_inbox`
  5. `player_identity_links`
- Do not expand beyond those 5

## Audit result

The approved 5 tables **would** clear the prior inbound blockers from PR #337 against Team Tournament parents.

**However**, adding `referee_assignments` introduces a **new** inbound FK from outside the approved expand set:

| Source (NOT approved) | Target (in approved +5) | ON DELETE | Rows |
|-----------------------|-------------------------|-----------|------|
| `referee_device_sessions` | `referee_assignments` | CASCADE* | 0 |

\*FK `ON DELETE CASCADE` still blocks `TRUNCATE` of the parent unless the child is listed in the same `TRUNCATE` statement or `TRUNCATE ... CASCADE` is used.

## Live row counts (Staging read-only)

| Table | Rows | Distinct tenants |
|-------|------|------------------|
| `referee_assignments` | 13 | 4 |
| `team_sub_match_referee_links` | 1 | 1 |
| `team_tournament_referee_correction_requests` | 3 | 1 |
| `team_tournament_referee_event_inbox` | 2 | 1 |
| `player_identity_links` | 0 | 0 |
| `referee_device_sessions` (residual) | 0 | 0 |

All five approved tables are business/bridge data (not protected identity/RBAC/plans).  
`player_identity_links` is empty but remains a schema blocker for `DELETE FROM clubs` (`NO ACTION`).

## Package change this PR

**None** to `10_ORDERED_WIPE.sql` — hard stop prevents shipping a non-executable expand-5 rewrite.

## Not run

wipe re-run · DROP `club_ai_data` · reseed · Restore · Production / Staging mutations

## Owner next decision

Approve **+1** wipe table `public.referee_device_sessions` (still no CASCADE), **or** explicitly allow `TRUNCATE ... CASCADE`.
