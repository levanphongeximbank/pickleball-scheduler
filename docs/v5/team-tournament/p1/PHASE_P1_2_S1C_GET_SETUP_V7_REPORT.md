# P1.2 S1-C — get_setup v7 Read Contract Report

**Phase:** P1.2 S1-C (authoring)  
**Branch:** `feature/team-tournament-v6`  
**SQL:** `PHASE_P1_2_S1C_GET_SETUP_V7.sql`  
**Staging apply:** NOT in this pre-commit phase (allowed only after approval)  
**Production:** DO NOT APPLY

---

## STOP boundary

| In scope | Out of scope |
|----------|--------------|
| get_setup versioning (v6 default / v7 opt-in) | S1-D mutation foundation |
| Snapshot metadata read | Discipline write RPCs |
| Diagnostic drift (read-only) | Production SQL |
| App read-path mapping | Setup write wiring |
| Contract tests | Staging apply (post-approval) |

This module extends **read** only. It does not generate teams, groups, matchups, or schedules. It does not create snapshots.

---

## 1. Existing get_setup audit

| Item | Finding |
|------|---------|
| Latest SQL | `docs/v5/team-tournament/tt5/TT5-B_GET_SETUP_PATCH.sql` |
| Signature (pre-S1-C) | `(p_tournament_id text, p_viewer_team_id text default null)` |
| schemaVersion | Absent |
| Staging | TT-5B live; S1-B snapshots present |
| Production snapshots | Absent |

---

## 2. Versioning

| Input | Behavior |
|-------|----------|
| `p_schema_version` omitted / null | **v6** TT-5B response (unchanged) |
| `p_schema_version = 6` | Same as v6 |
| `p_schema_version = 7` | **v7** contract |
| Other | `VALIDATION_ERROR` |

PostgreSQL: drop 2-arg overload; create 4-arg with defaults so existing PostgREST 2-arg calls remain valid.

---

## 3. V7 top-level contract

```
ok, schemaVersion=7, serverTime, tournament, viewer, permissions, operations, snapshot, diagnostic
```

Legacy top-level deadline fields retained for gradual clients.

---

## 4. Tournament read model

Normalized tables + `settings` jsonb only:

- teams, disciplines (+ `disciplineKind`/`activationRule` = **null** until P1.2 discipline DDL)
- groups = **`[]`** (P1.3; no blob fallback)
- matchups with `scheduleMeta` / extracted `groupId`/`roundNumber`/… (null when absent)
- schedule projection from matchups
- lineups, standings
- dreambreaker from `team_tournament_dreambreaker_states`
- awards / closing / schedulePublish from settings with empty conventions
- `teamData` nest kept for `mapTournamentToAggregate` compatibility

---

## 5. Snapshot metadata

Latest **active** row from `team_tournament_setup_snapshots` by `tournament_version desc`.

If none: `snapshot = null`; diagnostic may report `SNAPSHOT_NOT_INITIALIZED` (BTC only).

**No INSERT** during get_setup.

---

## 6. Diagnostic

`p_diagnostic` default false. Only BTC/`team_tournament_can_manage` or Super Admin receive payload; others get `null`.

Uses `team_tournament_normalized_read_hash` (S1-B stub) on a read projection — reports drift only.

---

## 7. Application mapping

| File | Change |
|------|--------|
| `teamTournamentRpcService.js` | Optional `schemaVersion` / `diagnostic` params |
| `mapGetSetupV7.js` | **NEW** — v7 envelope → meta + aggregate normalize |
| `cloudTeamTournamentRepository.js` | Opt-in via `readOptions.schemaVersion=7`; expose snapshot/diagnostic/setupBlocked |
| Default Preview path | **Unchanged** (omits schemaVersion → v6) |

---

## 8. Dependencies / pending

| Domain | Status |
|--------|--------|
| `disciplineKind` / `activationRule` columns | Not on Staging — return null |
| Normalized groups table | Not present — return `[]` (P1.3) |
| `schedule_meta` | Present — exposed in v7 |

---

## 9. Rollback (Staging, after future apply)

1. `drop function public.team_tournament_get_setup(text, text, integer, boolean);`
2. Re-apply `TT5-B_GET_SETUP_PATCH.sql`
3. No snapshot table changes

---

## 10. Risks

1. Large plpgsql must use `$ttsetup$` (not `$$`) for MCP apply (learned from S1-B.1).
2. Diagnostic hash uses S1-B stub (`jsonb::text`) — not full S1-A canonical; fine for drift signal until S1-E.
3. V7 remains opt-in until S1-E certification.
