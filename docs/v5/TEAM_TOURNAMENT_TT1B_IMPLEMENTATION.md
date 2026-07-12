# Team Tournament — Phase TT-1B Implementation Report

**Phase:** TT-1B — SSOT foundation (data layer only)  
**Date:** 2026-07-11  
**Status:** Complete — **STOP for owner review** (do not proceed to TT-1C without GO)  
**Verdict:** **READY FOR TT-1C WITH CONDITIONS**

---

## 1. Scope delivered

TT-1B implements the **data foundation** for migrating team tournaments from local blob to Supabase as source of truth. Per owner decisions:

| In scope (TT-1B) | Out of scope (TT-1C+) |
|------------------|------------------------|
| SQL migration (staging/preview only) | UI reads cloud instead of blob |
| Repository boundary + blob/cloud/shadow adapters | Remove blob / dual-write from pages |
| Migration dry-run + shadow compare scripts | Production SQL apply |
| Version + idempotency + lineup security (DB + client helpers) | Runtime mode `cloud_primary` / `cloud_only` |
| DreamBreaker / forfeit / schedule schema contracts | Wire repository into TeamPortal pages |

**Runtime unchanged:** Pages still call `getTournament()` / `clubStorage`. Blob is preserved for rollback.

---

## 2. Architecture summary

### Data mode enum

```
legacy → shadow → cloud_primary → cloud_only → retire_blob (ops state, not runtime flag)
```

TT-1B allows only **`legacy`** or **`shadow`** via `VITE_TEAM_TOURNAMENT_DATA_MODE`. Invalid combinations fail fast in `teamTournamentDataMode.js`.

### Repository boundary

```
UI / engine (TT-1C) ──► TeamTournamentRepository (interface)
                              ├── BlobTeamTournamentRepository   (legacy read)
                              ├── CloudTeamTournamentRepository  (RPC target)
                              └── ShadowTeamTournamentRepository   (blob read + cloud compare log)
```

Factory: `createTeamTournamentRepository()` in `teamTournamentRepositoryFactory.js`.

### Lineup security (Plan B)

- Direct `SELECT` on `team_tournament_lineups` / `team_tournament_lineup_entries` revoked for authenticated role.
- Reads go through `team_tournament_get_visible_lineups` RPC with role/team/status filtering.
- Opponent selections are `null` until matchup lineups are **published**.

### Optimistic locking

`version integer not null default 1` on:

- `team_tournaments`
- `team_tournament_matchups`
- `team_tournament_lineups`
- `team_tournament_sub_matches`
- `team_tournament_standings`

Updates check `expected_version`; mismatch returns `version_conflict` with `actual_version` — no silent overwrite.

### Idempotency

`team_tournament_command_log` with unique `(tenant_id, tournament_id, command_name, idempotency_key)`.

Commands covered in SQL: submit lineup, lock, publish, randomize, confirm result, apply forfeit, complete matchup, recalculate standings.

Client helper: `teamTournamentIdempotency.js` (payload hash + replay semantics).

### Lineup history

One active lineup per team/matchup. Changes recorded in `team_tournament_lineup_revisions` (before/after, actor, reason, version, request_id, action_type).

### DreamBreaker / forfeit / schedule

| Domain | Cloud table / column |
|--------|----------------------|
| DreamBreaker | `team_tournament_dreambreaker_states` |
| Forfeit | `team_tournament_forfeit_events` + `matchups.result_type` |
| Schedule / court | `team_tournament_matchups.schedule_meta` (jsonb) |

Repository interface includes stubs for these; cloud impl delegates to RPC where available.

---

## 3. Files changed / added

### SQL (apply staging/preview only)

| File | Purpose |
|------|---------|
| `docs/v5/PHASE_TT1B_TEAM_TOURNAMENT_SSOT.sql` | Idempotent migration: versions, command_log, revisions, dreambreaker, forfeit, sync_mismatch, RPC updates, lineup RLS revoke |
| `docs/v5/PHASE_TT1B_VERIFICATION_QUERIES.sql` | Post-apply checks (V1–V7) |

### Repository layer

| File | Purpose |
|------|---------|
| `src/features/team-tournament/repositories/TeamTournamentRepository.interface.js` | Interface contract |
| `src/features/team-tournament/repositories/teamTournamentDataMode.js` | Mode enum + TT-1B validation |
| `src/features/team-tournament/repositories/teamTournamentIdempotency.js` | Client idempotency helpers |
| `src/features/team-tournament/repositories/teamTournamentCompare.js` | Shadow blob vs cloud compare |
| `src/features/team-tournament/repositories/blobTeamTournamentRepository.js` | Legacy blob adapter |
| `src/features/team-tournament/repositories/cloudTeamTournamentRepository.js` | Cloud/RPC implementation |
| `src/features/team-tournament/repositories/shadowTeamTournamentRepository.js` | Shadow orchestration |
| `src/features/team-tournament/repositories/teamTournamentRepositoryFactory.js` | Factory + singleton |
| `src/features/team-tournament/repositories/teamTournamentRepository.js` | Re-exports factory (compat) |

### RPC client

| File | Purpose |
|------|---------|
| `src/features/team-tournament/services/teamTournamentRpcService.js` | Extended params (`expectedVersion`, `idempotencyKey`); `get_visible_lineups`, `apply_forfeit`; version conflict + replay passthrough |

### Scripts

| File | Purpose |
|------|---------|
| `scripts/migrate-team-tournament-blob-to-cloud.mjs` | Per-tournament migrate, dry-run default, conflict report, blocks Production ref |
| `scripts/compare-team-tournament-blob-cloud.mjs` | Shadow compare helper |

### Tests

| File | Covers |
|------|--------|
| `tests/team-tournament-idempotency.test.js` | Payload hash, replay, mismatch |
| `tests/team-tournament-version-conflict.test.js` | Version conflict + idempotency replay from RPC |
| `tests/team-tournament-lineup-security.test.js` | Engine + RPC visible lineups |
| `tests/team-tournament-repository.test.js` | Factory modes, shadow compare |

### Package scripts

| Script | Command |
|--------|---------|
| `npm run test:team-tournament-tt1b` | TT-1B unit tests |
| `npm run migrate:team-tournament-blob-to-cloud:dry-run` | Migration dry-run (requires env args) |
| `npm run compare:team-tournament-blob-cloud` | Blob vs cloud compare |

### Documentation

| File | Purpose |
|------|---------|
| `docs/v5/TEAM_TOURNAMENT_DATA_CONTRACT.md` | TT-1A design (reference) |
| `docs/v5/TEAM_TOURNAMENT_PILOT_AUDIT.md` | TT-0 audit (reference) |
| `docs/v5/TEAM_TOURNAMENT_TT1B_IMPLEMENTATION.md` | This report |

---

## 4. Test results

Run on 2026-07-11 (local):

```text
npm run test:team-tournament-tt1b
→ 16 tests, 16 pass

node --test tests/team-tournament*.test.js
→ 82 tests, 82 pass (includes TT-1B + existing team tournament suite)
```

| Test area | File | Result |
|-----------|------|--------|
| Idempotency | `team-tournament-idempotency.test.js` | PASS (4) |
| Optimistic locking | `team-tournament-version-conflict.test.js` | PASS (3) |
| Lineup security | `team-tournament-lineup-security.test.js` | PASS (3) |
| Repository / shadow | `team-tournament-repository.test.js` | PASS (4) |
| Existing cloud/regression | `team-tournament-*.test.js` (others) | PASS (68) |

**Not run in CI yet:** SQL integration tests against live staging (requires owner to apply migration first).

---

## 5. Staging apply procedure (owner only)

1. Confirm target is **staging/preview**, not Production (`expuvcohlcjzvrrauvud` blocked in scripts).
2. Apply prerequisite: `PHASE_23C_TEAM_TOURNAMENT_CLOUD_SYNC.sql` (if not already applied).
3. Apply: `docs/v5/PHASE_TT1B_TEAM_TOURNAMENT_SSOT.sql` via Supabase SQL editor or existing apply script pattern.
4. Run: `docs/v5/PHASE_TT1B_VERIFICATION_QUERIES.sql` — expect V1 version columns, V2 new tables, V3 lineup SELECT policies removed/restricted.
5. Set env on preview: `VITE_TEAM_TOURNAMENT_DATA_MODE=shadow` (optional shadow logging).
6. Dry-run migrate pilot tournament:
   ```bash
   npm run migrate:team-tournament-blob-to-cloud:dry-run -- --club-id=CLUB --tournament-id=TOUR
   ```
7. Compare:
   ```bash
   npm run compare:team-tournament-blob-cloud -- --club-id=CLUB --tournament-id=TOUR
   ```

---

## 6. Rollback procedure

1. **App:** Set `VITE_TEAM_TOURNAMENT_DATA_MODE=legacy` (default). No UI change required — blob remains authoritative.
2. **SQL (optional, staging):** New TT-1B tables can be dropped if empty. Version columns may remain (default 1, harmless).
3. **Lineup RLS:** If full SQL rollback needed, re-apply Phase 23C lineup SELECT policies from backup.
4. **Data:** Blob is never deleted by TT-1B scripts. Cloud rows from failed migrate can be ignored while in legacy mode.

---

## 7. Remaining risks

| Risk | Severity | Mitigation in TT-1C |
|------|----------|---------------------|
| SQL not yet applied on staging | High | Owner apply + verification queries before pilot |
| Pages still dual-write via `teamTournamentService.js` | High | Refactor to repository orchestration layer |
| `TeamPortal.jsx` missing `await` on async mutations | High | Fix in TT-1C |
| Realtime subscriptions may still expose lineup if enabled | Medium | Audit Supabase realtime publications in TT-1C |
| `randomize_lineup` / `complete_matchup` / `recalculate_standings` RPC idempotency not fully exercised in unit tests | Medium | Staging integration tests after SQL apply |
| Blob/cloud conflicts during migrate require manual owner decision | Medium | Migrate script reports conflicts, does not auto-pick winner |
| Shadow mode only logs mismatches; does not auto-sync | Low | Expected for TT-1B |

---

## 8. Conditions before TT-1C

1. Owner applies TT-1B SQL on **staging** and confirms verification queries pass.
2. Pilot tournament dry-run migrate completes with **zero unresolved conflicts** (or owner documents resolution).
3. Shadow mode run during internal QA shows acceptable mismatch rate.
4. Explicit GO from owner to wire repository into UI and enable `cloud_primary` for pilot CLB only.

---

## 9. Verdict

**READY FOR TT-1C WITH CONDITIONS**

Foundation code, tests, migration scripts, and SQL are complete. Runtime behavior is intentionally unchanged. TT-1C may proceed after staging SQL apply, pilot dry-run migrate, and owner GO — not before.

**Do not:** deploy Production, apply Production SQL, switch UI to cloud read, or enable `cloud_primary`/`cloud_only` in this phase.

---

## 10. Owner review checklist

- [ ] Review SQL migration (`PHASE_TT1B_TEAM_TOURNAMENT_SSOT.sql`)
- [ ] Apply on staging only
- [ ] Run verification queries
- [ ] Run migrate dry-run on pilot tournament
- [ ] Review conflict report (if any)
- [ ] Approve or reject TT-1C scope

**STOP — awaiting owner review.**
