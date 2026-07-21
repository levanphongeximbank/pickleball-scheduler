# CORE-07 Phase 1A — Existing Seeding Audit (Re-run)

**Module:** Competition Seeding
**Phase:** 1A — Audit only (no production code)
**Date:** 2026-07-21
**Branch:** `feature/competition-core-07-seeding`
**Expected / actual baseline SHA:** `fb9f482434639621d465cbc35b80e085fb82f383`

---

## 1. Safety baseline (independently verified)

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Current working directory | **PASS** | `C:\Users\Le Phong\PICK_VN-Workstreams\competition-engine\competition-core-07-seeding` |
| 2 | Current branch | **PASS** | `feature/competition-core-07-seeding` |
| 3 | Current HEAD SHA | **PASS** | `fb9f482434639621d465cbc35b80e085fb82f383` |
| 4 | Latest `origin/main` after `git fetch origin` | **PASS** | `fb9f482434639621d465cbc35b80e085fb82f383` |
| 5 | Working-tree status | **PASS** | Clean (`git status --porcelain` empty before docs) |
| 6 | HEAD matches / based on latest `origin/main` | **PASS** | HEAD == `origin/main`; left-right count `0 0` |
| 7 | CORE-01…CORE-06 merged outputs present | **PASS** | See §1.1 (repo content + Git history, not sibling worktrees) |
| 8 | Unrelated local changes | **PASS** | None at audit start |

**Safety gate outcome:** Proceed. No `BLOCKED_WRONG_WORKSPACE`, `BLOCKED_DIRTY_BASELINE`, or `BLOCKED_MISSING_PREREQUISITES`.

### 1.1 Prerequisite evidence (current repository)

| Core | Docs evidence | Source evidence | Merge / history evidence |
|------|---------------|-----------------|--------------------------|
| **CORE-01** Rule Engine | `docs/competition-core/CORE01_*.md` (foundation under `docs/competition-core/`, not `docs/competition-engine/core-01/`) | `src/features/competition-core/constraints/**` (47 files); tests `competition-core-rules-core01-foundation.test.js` | PR #87 `a09bfe2` — `feature/competition-core-01-rule-engine` |
| **CORE-02** Participant Entry | `docs/competition-engine/core-02/00_PARTICIPANT_ENTRY_FOUNDATION.md` | `src/features/competition-core/participants/**` | PR #91 `3744dae` |
| **CORE-03** Registration Eligibility | `docs/competition-engine/core-03/**` | `src/features/competition-core/registration-eligibility/**` | Phases through PR #111 / commits `11300e6`…`64215a4` |
| **CORE-04** Division / Category | `docs/competition-engine/core-04/01_PHASE1_DIVISION_CATEGORY_FOUNDATION.md` | `src/features/competition-core/classification/**` | PR #85 `19cee3e` |
| **CORE-05** Team Roster | `docs/competition-engine/core-05/**` | `src/features/competition-core/teams/**` | PR #97 `8296083` |
| **CORE-06** Lineup | `docs/competition-engine/core-06/**` (incl. certification) | `src/features/competition-core/lineups/**` | PR #119 `fb9f482` (this baseline tip) |

Baseline tip message: `Merge pull request #119 … competition-core-06-lineup-integration-certification`.

---

## 2. Audit scope

Re-run of CORE-07 Phase 1A Existing Seeding Audit, limited to:

1. Existing seeding implementation inventory
2. Deterministic seeding behaviour assessment
3. Dependency / integration boundaries with CORE-01 Rule Engine
4. Duplication, architectural drift, coupling, migration risks

**Not in scope:** CORE-07 production implementation, tests, SQL, refactors, commits, PRs, deploys.

---

## 3. Executive findings

### 3.1 Three concepts must stay separated

1. **Competition seeding** — assign seed numbers (CORE-07).
2. **Deterministic random seed** — PRNG reproducibility utility (not competition seeding).
3. **Draw / grouping** — place entities into groups/brackets (downstream; Phase 3H / Format).

### 3.2 Dual non-production CORE foundations already exist

| Layer | Path | Role | Production-wired? |
|-------|------|------|-------------------|
| Phase 3G runtime | `src/features/competition-core/seeding/**` | Order external ranking/rating + assign seed numbers; manual/protected; no draw | **No** (capability-local; not root-exported) |
| CC-04B foundation | `src/features/competition-core/seed/**` | Composite seed **score** → rank; shadow compare | **Shadow only** (`draw/adapters/seedShadowCompare.js`) |

These models are **not equivalent**. Production still uses legacy engines.

### 3.3 Production SSOT remains legacy

| Surface | Path | Notes |
|---------|------|-------|
| Individual TE | `src/features/tournament-engine/engines/seedEngine.js` (`generateSeed`) | Score blend + bands + unseeded pool |
| Official entries | `src/tournament/engines/teamPairingEngine.js` (`assignSeedsToEntries`) | Sort by entry rating sum |
| Team groups | `src/features/team-tournament/engines/teamGroupSeedEngine.js` | Seed numbers **and** snake helpers |
| Page logic | `src/pages/tournament.seeding.logic.js` | Pairing + group placement; open uses `Math.random` |

### 3.4 Rule Engine coupling

Phase 3G / CC-04B seeding have **zero direct imports** of `constraints/**`. Eligibility is a structural `eligible` flag + noop policy. CORE-03 / CORE-01 patterns (injected ports) are **not** wired into seeding yet.

### 3.5 Highest migration risks

1. Dual CORE models (score pipeline vs ranking-order runtime).
2. Seed + draw entanglement in team / page APIs.
3. Inconsistent missing-data / unseeded / withdrawn-DQ policies.
4. Open-draw non-determinism (`Math.random`) adjacent to seeding.
5. Format-specific formulas (individual TE vs official entry sum vs team avg/top).

---

## 4. Ownership classification (summary)

| Concern | Classification |
|---------|----------------|
| Rating / ranking snapshots | **UPSTREAM** (consume; do not recalculate) |
| Eligibility / withdrawn / DQ | **UPSTREAM** (CORE-03 primary; CORE-01 for `SEEDING` operation rules) |
| Competition seed assignment | **CORE-07** |
| Seed bands / pots used for placement | **DOWNSTREAM** metadata / draw (not seed numbering) |
| Snake / pot / bracket / schedule | **DOWNSTREAM** |
| UI / Supabase writers / browser state | **OUT** of CORE-07 domain core |
| Demo/tenant SQL seed scripts | **OUT** (unrelated “seed” naming) |

Full inventory: `02_EXISTING_SEEDING_INVENTORY.md`.

---

## 5. Related documents

| Doc | Role |
|-----|------|
| `docs/competition-engine/phase-3g/**` | Phase 3G ownership / architecture (existing runtime docs) |
| `docs/competition-core/CC04B_*.md` | CC-04B seed foundation model |
| `docs/competition-core/CORE01_*.md` | Rule Engine foundation |
| `docs/competition-engine/core-06/10_PHASE_1D_DETERMINISTIC_RANDOM.md` | Parallel deterministic-RNG pattern |

---

## 6. Final verdict

### READY_WITH_CONDITIONS

Phase 1B (architecture / scope freeze / ports) may proceed **only if** Owner accepts the conditions in `06_PHASE_1B_RECOMMENDATION.md`, principally:

1. Treat Phase 3G `seeding/**` as the intended CORE-07 runtime ownership target; freeze CC-04B `seed/**` as read-only reference until an explicit model-merge decision.
2. Do not production-wire or root-export seeding in Phase 1B.
3. Add eligibility via **injected ports** (CORE-03 primary; optional CORE-01 `RULE_OPERATION.SEEDING`) — never re-implement Rule Engine rules inside CORE-07.
4. Keep draw / snake / pot / bracket **out of CORE-07** ownership; legacy mixed APIs must be split at the adapter boundary in later phases.
5. Phase 1B remains documentation + (if approved later) contract/port design only — no production cutover.

**Not** `READY_FOR_PHASE_1B` without conditions (dual foundation + production legacy SSOT + missing eligibility ports).
**Not** `BLOCKED` (safety baseline and prerequisites satisfied).
