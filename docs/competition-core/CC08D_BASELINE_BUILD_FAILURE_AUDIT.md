# CC-08D — Baseline Build Failure Audit

## Symptom

```
[UNRESOLVED_IMPORT] Could not resolve './pages/dev/RefereeV5PreviewPage' in src/router.jsx
```

On `origin/feature/competition-core-standardization` @ `cb32ae2`.

## 1. Commit that introduced the router import

| Field | Value |
|-------|-------|
| Commit | `824a63921294a715acbdecd5844613de2daa1719` |
| Message | `feat(rating-v5): wire V5-B.2 adaptive assessment UI for staging preview` |
| Date | 2026-07-13 |
| File | `src/router.jsx` (+12 lines) |

The same commit correctly added `SkillAssessmentV5Page` and `/player/skill-assessment-v5` with a committed page file. The referee route was added in the same diff but **without** the page module.

## 2. RefereeV5PreviewPage provenance

| Location | Present? |
|----------|----------|
| `origin/feature/competition-core-standardization` | **No** |
| `origin/feature/competition-core-cc08-standings` | **No** |
| Any committed branch (grep remote) | **No** |
| Main worktree WIP (`pickleball-scheduler`) | **Yes** — untracked `src/pages/dev/RefereeV5PreviewPage.jsx` |
| Stash | **No** |
| Different path on standardization | **No** — only `PairingInterventionPreviewPage.jsx` exists under `pages/dev/` |

Main-worktree page depends on **untracked** `src/features/referee-v5/` (full module WIP).

## 3. Route classification

| Property | Value |
|----------|-------|
| Path | `/dev/referee-v5` |
| Guard | `SuperAdminRouteGuard` |
| Production runtime | **No** — dev-only super-admin preview |
| Feature-flagged page | Intended (`VITE_REFEREE_V5_ENABLED`) but module not committed |
| Navigation menu | **Not wired** — router-only |

**Verdict:** Accidental incomplete commit — referee route bundled into rating-v5 commit without its dependency tree.

## 4. Workstream ownership

| Workstream | Relation |
|------------|----------|
| rating-v5 | Commit author; primary intent was V5-B.2 assessment route |
| referee-v5 | **Owner of missing page** — WIP exists only in main worktree |
| TT / Competition Core | Not involved |
| Unrelated WIP | referee-v5 module (~entire feature folder untracked) |

## 5. Safe fix chosen

**Approach B** — remove premature `/dev/referee-v5` lazy import and route from `router.jsx`.

Rationale:
- Page and `referee-v5` feature module are not in any reviewed commit.
- Copying main-worktree WIP would drag unreviewed referee-v5 code.
- Dev route is not production-critical; restore when referee-v5 preview lands in a scoped commit.

Future restoration documented in `CC08D_MERGE_PLAN.md`.
