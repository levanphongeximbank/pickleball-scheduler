# P1.2 Snapshot Foundation Contract (S1-A → S1-E)

**Status:** Foundation certification contract  
**Branch:** `feature/team-tournament-v6`  
**PR:** #26 (OPEN / UNMERGED)  
**Production:** unchanged — do not apply setup mutation SQL

---

## Scope certified in this milestone

| Slice | Content | Staging |
|-------|---------|---------|
| S1-A | Canonical JSON + hash + mutation envelope | N/A (client) |
| S1-B | `team_tournament_setup_snapshots` schema | Applied |
| S1-C | `team_tournament_get_setup` schemaVersion 7 | Applied |
| S1-D | `runSetupMutation` + `executeSetupMutation` foundation | Client + Staging verify |
| S1-E | Feature gate + foundation certification | Client + Staging verify |

## STOP boundary

**This milestone does NOT implement:**

- Discipline / Groups / Matchups / Schedule / Awards / Close domain RPCs
- Production SQL apply
- Enabling setup writes in Production
- Merging PR #26
- UI redesign of setup operations

Domain RPCs remain registered-by-name only and **fail closed** with `REPOSITORY_RPC_GUARD_NOT_DEPLOYED`.

---

## Feature gate

| Item | Value |
|------|-------|
| Env | `VITE_TEAM_TOURNAMENT_SETUP_MUTATION_V7` |
| Default | **OFF** |
| Ownership | Team Tournament V6 — P1.2 S1-D/S1-E foundation |
| Effect when OFF | Preview/Production setup write paths unchanged (v6/legacy) |
| Effect when ON | Unlocks foundation orchestrator + fail-closed transport on Staging/test |
| Does NOT | Deploy domain RPCs; enable blob fallback; change default get_setup to v7 |

**Retirement point:** after Discipline/Groups/Matchups domain RPCs pass Staging QA and Production apply is owner-approved.

---

## Runtime contracts

### get_setup

- Default app load remains **v6** (omit `schemaVersion`).
- Opt-in v7 via `readOptions.schemaVersion = 7` (+ optional `diagnostic: true`).
- Hook/orchestrator may surface read-only: `schemaVersion`, `snapshotMeta`, `diagnostic`, `driftDetected`, `setupBlocked`, `setupBlockCode`, `latestTournamentVersion`, `setupMutationStatus`.

### runSetupMutation

Flow: Engine → **Preview** → explicit **Confirm** → `repository.executeSetupMutation` → Reload → Render.

Companion APIs:

- `previewSetupMutation` — builds envelope; **no RPC**
- `confirmSetupMutation` — requires `confirmed: true`
- `buildSetupMutationPayload` — hashes + envelope
- `handleSetupMutationConflict` — VERSION_CONFLICT reload once / no auto-resubmit; IDEMPOTENCY_KEY_REUSED → new preview

### executeSetupMutation

- Validates envelope (S1-A)
- Resolves registered future RPC name
- Undeployed → `REPOSITORY_RPC_GUARD_NOT_DEPLOYED`
- Blob provider → `BLOB_FALLBACK_FORBIDDEN` (no silent blob write)
- No fake success

### Drift (OD-F)

- `cloud_primary`: warn; block destructive until reload/review ack
- `cloud_only`: block all setup mutations on drift
- No silent repair

### Engine version

- Read allowed on mismatch
- Confirm rebuild blocked unless `allowEngineRebuild: true`

### Version / idempotency

- `expectedTournamentVersion` from latest v7 read
- One idempotency key per confirmed UI command; reused on network retry
- VERSION_CONFLICT → reload once, no automatic resubmit
- Stale response (version &lt; latest observed) ignored
- Multi-tab duplicate scope deduped via UI command keys

---

## Remaining domain RPC work (next milestones)

1. Discipline save/remove/reorder SQL + RPC  
2. Groups replace/clear  
3. Matchups replace  
4. Schedule update/batch/publish/lock  
5. Wire confirm path to deployed RPCs (`isSetupMutationRpcDeployed` → true per RPC)  
6. Staging apply per domain; Production only after owner approval  

---

## Production safety

| Check | Status |
|-------|--------|
| Production SQL in this milestone | **NO** |
| Production get_setup v7 | **NO** (Staging only) |
| Production setup mutation enable | **NO** (gate OFF) |
| PR #26 merge | **NO** |

---

## Rollback (foundation client)

1. Leave gate OFF (default).  
2. Revert `src/features/team-tournament/setup/**` and repository `executeSetupMutation` wiring if needed.  
3. Do **not** drop Staging S1-B snapshots or S1-C get_setup v7 unless a separate Staging rollback is approved.  
4. Domain RPC rollback is N/A (not applied).

## Staging verification script

```bash
node scripts/verify-p1_2-snapshot-foundation-staging.mjs
```

Requires Staging env (`qyewbxjsiiyufanzcjcq`). Refuses Production ref.
