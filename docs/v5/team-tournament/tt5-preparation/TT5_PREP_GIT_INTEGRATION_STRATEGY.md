# TT-5 Preparation — Git Integration Strategy

**Phase:** TT-5 PREPARATION  
**Date:** 2026-07-13

---

## Relationship determination

```text
Primary case:  CASE A — Same repository, different logical branch/workstream
Secondary:     CASE D — Referee V5 partially exists (router stub committed, module untracked)
Not applicable: CASE B (worktree exists for TT pilot, not for Referee V5)
Not applicable: CASE C (different repository)
```

Both "projects" live in `pickleball-scheduler`. Referee V5 was developed on the **same working tree** as Team Tournament without a dedicated git branch or commit series.

---

## Branch topology

| Branch | SHA | Role |
|--------|-----|------|
| `feature/competition-core-standardization` | `2346287` | **Team Tournament base** (TT-4 + competition-core) |
| `qa/team-tournament-pilot-preparation` | `e5126a1` | TT pilot prep (TT-9 docs); separate worktree |
| `v5-platform-edition` | `2ff3838` | Club platform v5 — **no Referee V5** |
| `main` | `916107d` | GA v4 — far behind TT branch |
| Referee V5 (proposed) | — | **Does not exist yet** |

### Merge-base analysis

| Comparison | Merge-base | Ahead | Behind |
|------------|------------|-------|--------|
| TT branch vs `v5-platform-edition` | `2ff3838` | 38 | 0 |
| TT branch vs `qa/team-tournament-pilot-preparation` | `c433a27` | 9 | 7 |

**Referee V5 vs TT branch:** N/A — no Referee V5 commits to diff.

---

## Commits only on Referee side

**None in git.** All Referee V5 deliverables are uncommitted files (see `TT5_PREP_SOURCE_INVENTORY.md`).

Partial committed artifact:

- `824a639` — adds `/dev/referee-v5` route (12 lines in `router.jsx`) without committing target page or module

---

## Commits only on Team Tournament side (sample — 38 ahead of v5-platform)

Recent TT-specific commits on `feature/competition-core-standardization`:

```text
92142db feat(team-tournament): complete TT-4 forfeit withdrawal workflow
15e85ff feat(team-tournament): complete TT-3 controlled lineup override
7f297d8 feat(team-tournament): add TT-2E atomic publish workflow
c433a27 feat(team-tournament): complete TT-2D randomize and lock workflow
44d7ce3 feat(team-tournament): add TT-1B repository and SSOT foundation
... (+ competition-core CC-07, rating-v5 824a639, etc.)
```

---

## Expected conflicts (when Referee V5 is committed and merged)

### Router

| File | Conflict risk | Reason |
|------|---------------|--------|
| `src/router.jsx` | **HIGH** | `/dev/referee-v5` stub already on TT branch; TT pilot branch may differ |
| `src/auth/authGuard.js` | LOW | Both define portal prefixes |

### Database

| Area | Conflict risk | Reason |
|------|---------------|--------|
| Referee `match_*` vs TT `team_tournament_*` | **LOW** | Separate table namespaces |
| Shared `audit_logs` / permissions | MEDIUM | Permission keys may overlap naming |
| Migration apply order | MEDIUM | Must apply V5A→V5E1 before TT-5 consumer RPCs |

### Services

| Area | Conflict risk | Reason |
|------|---------------|--------|
| `teamTournamentService.js` | **HIGH** | TT-5B will add V5 adapter calls alongside legacy referee RPCs |
| `teamRefereeEngine.js` | MEDIUM | Deprecation vs coexistence flag |
| Scoring engines (duplicate) | MEDIUM | Two `rallyScoringEngine.js` paths |

### Tests

| Area | Conflict risk | Reason |
|------|---------------|--------|
| `package.json` test:unit | **HIGH** | qa branch removed referee-v5 tests from script; current branch may add them |
| `tests/team-tournament-referee.test.js` | MEDIUM | Must extend for V5 path |

### Dependencies

| Area | Conflict risk | Reason |
|------|---------------|--------|
| `package.json` scripts | MEDIUM | Many untracked `verify-referee-v5-*` scripts |
| Supabase edge bundle | LOW | Separate function from rating-v5 |

---

## Recommended integration branch

```text
Recommended base branch:     feature/competition-core-standardization
Recommended base SHA:        23462878782726b9f933380071126245bd767dec
                             (or next clean commit after owner stabilizes tree)

Referee source branch:       feature/referee-v5-platform (PROPOSED — not created)
Referee source SHA:          TBD after initial Referee V5 commit

Merge/cherry-pick/package:   TWO-STEP (see below)
Expected conflicts:          Router HIGH, Services HIGH, package.json HIGH
```

### Why not Referee branch as base

Team Tournament SSOT (TT-1B repository, TT-4 workflows) must remain the integration trunk. Referee V5 is a **module graft**, not the product branch.

### Why not qa/team-tournament-pilot-preparation as base

Diverged 9/7 from main TT line; contains pilot-only doc churn; would merge conflict on `TeamRefereePortal.jsx`, `package.json`, TT engines.

---

## Strategy recommendation

```text
Recommended integration strategy: OTHER (two-step git workflow)
```

### Step 0 — Prerequisite (owner action, not done in preparation)

Commit current Referee V5 working tree to:

```text
feature/referee-v5-platform
```

Single or phased commits by layer (engines → persistence → UI → edge → tests → docs). **No manual file copy.**

### Step 1 — Create integration branch (when working tree clean)

```text
git checkout feature/competition-core-standardization
git pull
git checkout -b feature/tt5-referee-v5-integration
```

### Step 2 — Integrate Referee V5

```text
git merge feature/referee-v5-platform
```

Preferred over cherry-pick series because Referee V5 has **no existing commit history** — first commit will be monolithic; merge preserves one merge commit for audit.

**Cherry-pick series** only if owner splits Referee V5 into ordered commits (V5A→V5E1) on `feature/referee-v5-platform`.

**Package/internal library** — not recommended; monorepo module import is sufficient.

**Manual copy** — **forbidden** per owner spec.

---

## Working tree safety

| Check | Status |
|-------|--------|
| Uncommitted Referee V5 files | **69 untracked** |
| Modified tracked files | **13 modified** |
| Safe to create integration branch now | **NO** |

Owner must either commit or stash Referee V5 work before branch creation.

---

## PR policy

Do **not** use existing Draft PRs as integration development target unless owner explicitly approves. No PR numbers verified in this preparation (gh unavailable).

---

## Pilot worktree note

`qa/team-tournament-pilot-preparation` worktree at `C:/Users/Le Phong/pickleball-scheduler-qa-team-tournament-pilot-preparation` is active. Avoid branch checkout that would disrupt pilot QA without owner coordination.
