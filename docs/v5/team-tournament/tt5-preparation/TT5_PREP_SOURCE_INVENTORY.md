# TT-5 Preparation — Source Inventory

**Phase:** TT-5 PREPARATION (not TT-5A)  
**Date:** 2026-07-13  
**Code changes:** Documentation only

---

## A. Referee V5 project source

```text
Repository path:  c:\Users\Le Phong\pickleball-scheduler
Remote:           https://github.com/levanphongeximbank/pickleball-scheduler.git
Branch:           (no dedicated branch) — working tree on feature/competition-core-standardization
HEAD SHA:         23462878782726b9f933380071126245bd767dec (parent branch tip)
Working tree:     DIRTY — 69 untracked + 13 modified paths (Referee V5 bulk untracked)
Open PR:          Unknown — gh CLI unavailable; no Referee V5 PR identified in git remote refs
Staging project:  qyewbxjsiiyufanzcjcq
Production:       expuvcohlcjzvrrauvud (Referee V5 schema NOT applied)
Edge Function:    referee-v5-match (staging deployed 2026-07-12)
Feature flags:    VITE_REFEREE_V5_ENABLED, VITE_REFEREE_V5_DATA_MODE, VITE_REFEREE_V5_REALTIME_ENABLED, VITE_REFEREE_V5_EDGE_BASE_URL
```

### Git reality — critical finding

**Zero git commits** touch `src/features/referee-v5/` across all local and remote branches (`git log --all -- src/features/referee-v5/` → empty).

Referee V5 exists as:

1. **Uncommitted working tree** — primary source
2. **Staging database + Edge** — applied and verified via QA evidence
3. **Partial router stub** — commit `824a63921294a715acbdecd5844613de2daa1719` added `/dev/referee-v5` route importing **untracked** `RefereeV5PreviewPage.jsx`

`v5-platform-edition` branch does **not** contain Referee V5 code (merge-base = `2ff3838`, 38 commits behind TT branch, 0 ahead).

---

## B. Team Tournament project source

```text
Repository path:  c:\Users\Le Phong\pickleball-scheduler  (same repo)
Remote:           https://github.com/levanphongeximbank/pickleball-scheduler.git
Branch:           feature/competition-core-standardization
HEAD SHA:         23462878782726b9f933380071126245bd767dec
Working tree:     DIRTY (shared with Referee V5 untracked files)
Open PR:          Unknown — gh unavailable
Current TT phase: TT-4 complete (commit 92142db); competition-core CC-07 on same branch
Staging status:   Team tournament tables present on staging (TT-1B through TT-4 SQL applied per evidence)
Production status: Core TT tables present; TT-4-era objects may lag staging (fewer tables than staging)
```

### Alternate TT worktree

| Field | Value |
|-------|-------|
| Branch | `qa/team-tournament-pilot-preparation` |
| SHA | `e5126a1` |
| Worktree | `C:/Users/Le Phong/pickleball-scheduler-qa-team-tournament-pilot-preparation` |
| TT phase | TT-9 documentation closed; diverged from main TT branch (9 ahead / 7 behind) |

---

## Referee V5 phase deliverable inventory (V5-A → V5-E1)

> **Note:** No phase-specific git SHAs exist. Table uses phase ID + evidence anchor. Only partial git artifact: router stub in `824a639`.

| Commit SHA | Nội dung | Phụ thuộc | Có thể tích hợp | Chỉ QA/prototype |
| ---------- | -------- | --------- | --------------: | ---------------: |
| — (working tree) | **V5-A** Foundation — domain model, ADRs, security audit | — | 1 | 0 |
| — (working tree) | **V5-B** Match state engine — serve rotation, receiver, scoring | V5-A | 1 | 0 |
| — (working tree) | **V5-C** Court Visualizer UI — components, responsive/a11y | V5-B | 1 | 0 |
| — (working tree) | **V5-D** Persistence — RPC, RLS, repository layer | V5-C | 1 | 0 |
| — (working tree) | **V5-D.1** Hardening — atomic commit, idempotency spec | V5-D | 1 | 0 |
| — (working tree) | **V5-D.2** Staging apply + RLS runtime verification | V5-D.1 + SQL | 1 | 0 |
| — (working tree) | **V5-D.3** Edge Function deploy + HTTP command harness | V5-D.2 | 1 | 0 |
| — (working tree) | **V5-D.32** Idempotency + UNDO SQL patch | V5-D.3 | 1 | 0 |
| — (working tree) | **V5-D.4** Atomic rollback SQL + fault injection QA | V5-D.32 | 1 | 0 |
| — (working tree) | **V5-D.4.1** Browser closure — 18/18 HTTP, 25/25 E2E | V5-D.4 | 0 | 1 |
| — (working tree) | **V5-E1** Realtime sync — hook, channel, publication SQL | V5-D.4 | 1 | 0 |
| `824a639` | Router stub `/dev/referee-v5` (bundled with rating-v5 commit) | — | 0 | 1 |

Evidence anchors: `docs/v5/referee-v5/V5-*_FINAL_VERDICT.md`, `docs/v5/qa-evidence/phase-v5d*/`, `phase-v5e1/`

---

## File classification — Referee V5

### SHARED CORE (integrate)

```text
src/features/referee-v5/engines/*
src/features/referee-v5/domain/*
src/features/referee-v5/selectors/*
src/features/referee-v5/constants/* (except prototype-only)
src/features/referee-v5/adapters/RemotePersistenceAdapter.js
src/features/referee-v5/persistence/* (runtime services)
src/features/referee-v5/services/refereeV5EdgeClient.js
src/features/referee-v5/services/refereeV5RemoteEdgeService.js
src/features/referee-v5/hooks/useRefereeRemoteMatchController.js
src/features/referee-v5/hooks/useRefereeMatchController.js
src/features/referee-v5/hooks/useRefereeRealtimeSync.js
src/features/referee-v5/realtime/*
src/features/referee-v5/components/* (production workspace, not prototype page)
src/features/referee-v5/flags.js
src/features/referee-v5/index.js
tests/referee-v5/*.test.js (excluding staging-only harness deps)
```

### STAGING BACKEND

```text
docs/v5/referee-v5/PHASE_V5A_REFEREE_FOUNDATION.sql
docs/v5/referee-v5/PHASE_V5D_REFEREE_PERSISTENCE.sql
docs/v5/referee-v5/PHASE_V5D1_REFEREE_HARDENING.sql
docs/v5/referee-v5/PHASE_V5D32_IDEMPOTENCY_UNDO.sql
docs/v5/referee-v5/PHASE_V5D4_ATOMIC_ROLLBACK.sql
docs/v5/referee-v5/PHASE_V5E1_REALTIME_SYNC.sql
supabase/functions/referee-v5-match/
supabase/functions/_shared/refereeV5Server.mjs
```

### EDGE FUNCTION

```text
supabase/functions/referee-v5-match/index.ts
supabase/functions/_shared/refereeV5Server.mjs
scripts/bundle-referee-v5-edge-shared.mjs
scripts/deploy-referee-v5-edge-staging.mjs
```

### MIGRATION

All `docs/v5/referee-v5/PHASE_V5*.sql` — see `TT5_PREP_MIGRATION_DEPENDENCY.md`

### PROTOTYPE ONLY

```text
src/features/referee-v5/prototype/RefereeV5PrototypePage.jsx
src/features/referee-v5/prototype/refereeV5PrototypeFixtures.js
src/features/referee-v5/prototype/refereeV5StagingFixtures.js
src/features/referee-v5/adapters/LocalPrototypeAdapter.js
src/pages/dev/RefereeV5PreviewPage.jsx
src/router.jsx → /dev/referee-v5 route
```

### QA/EVIDENCE ONLY

```text
docs/v5/qa-evidence/phase-v5d2/
docs/v5/qa-evidence/phase-v5d3/
docs/v5/qa-evidence/phase-v5d4/
docs/v5/qa-evidence/phase-v5d41/
docs/v5/qa-evidence/phase-v5e1/
scripts/verify-referee-v5-*
scripts/seed-referee-v5-test-staging.mjs
scripts/referee-v5-staging-harness.mjs
scripts/ensure-staging-qa-password-env.mjs
scripts/reset-staging-browser-e2e-passwords.mjs (if present)
```

### DO NOT INTEGRATE (production runtime)

```text
/dev/referee-v5 route + SuperAdmin prototype page
Staging fixture dropdowns
QA password env files
Fault injection toggles in verify scripts
Evidence JSON in app bundle
```

---

## Premature TT-5A artifacts (invalid)

These files were created before source verification and **must not** be treated as TT-5A results:

```text
docs/v5/team-tournament/TT5-A_REFEREE_INTEGRATION_AUDIT.md
docs/v5/team-tournament/TT5-A_DATA_MAPPING.md
docs/v5/team-tournament/TT5-A_DUPLICATE_LOGIC_REPORT.md
docs/v5/team-tournament/TT5-A_FINAL_VERDICT.md
```

Superseded by this `tt5-preparation/` package.
