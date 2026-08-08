# Tournament Canonical Runtime Cutover 01 — Implementation Summary (Remediation)

**Branch:** `fix/tournament-canonical-runtime-cutover-01`  
**Base:** `06e5c7058e1a8297cea2c61171198173936c10ad`  
**Live mutations:** none

## Remediation architecture (cloud-only)

```
Canonical Tournament UI
  → async Tournament Queries / Commands
  → ONE Cloud Tournament Repository
  → canonical Tournament RPCs
  → canonical_tournaments (+ JSONB payload + engine_v4)
```

## What landed

1. **Cloud-only repository** — all ops async RPC: list/get/listMine/create/update/delete/applyEngineState. Transitional blob repository **removed**.
2. **Async application boundary** — queries/commands/hooks (`useCanonicalTournament*`).
3. **Mapper** — DB row ↔ Tournament domain (full payload for Daily/Internal/Official/EngineV4).
4. **Setup/detail cutover** — Daily / Internal / Official + registration/awards/bracket/director/engine/VPR write through canonical commands.
5. **listMine** — real mine semantics (createdBy / ownerPlayerId / entries / team members).
6. **SQL** — `supabase/migrations/20260808100000_canonical_tournaments_cutover.sql` with `user_has_permission` + tenant + REVOKE PUBLIC/anon.
7. **Team Tournament** — cutover prefers `cloud_only`; create path skips blob SoT; blob mirror disabled in cloud_only.
8. **EngineV4** — `applyEngineV4StateCommand` → cloud `applyEngineState` only.
9. **Data policy** — `LEGACY_TOURNAMENT_DATA_MIGRATION=SKIPPED_BY_OWNER_POLICY` (no blob→canonical copy).

## Owner live GO still required

- Apply migration (Staging → Production) — **not done in this PR**
- Set Production/Staging env flags
- Smoke on live after apply
