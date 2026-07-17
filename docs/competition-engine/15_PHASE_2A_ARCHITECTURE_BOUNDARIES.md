# 15 — Phase 2A Architecture Boundaries

**Status:** COMPLETE (2026-07-17)  
**Owner verdict:** GO WITH CONDITIONS  
**Scope:** Dependency boundaries and public API lock — **no runtime behavior change**

---

## 1. Architecture ownership map

```text
┌─────────────────────────────────────────────────────────────┐
│  UI / Pages / Components / Portals                          │
│  src/pages/, src/components/, format UI                     │
└───────────────────────────┬─────────────────────────────────┘
                            │ application services, orchestrators
┌───────────────────────────▼─────────────────────────────────┐
│  Format modules                                             │
│  team-tournament, individual-tournament, tournament-engine  │
└───────────────────────────┬─────────────────────────────────┘
                            │ public API only (index.js)
┌───────────────────────────▼─────────────────────────────────┐
│  Competition Core — CANONICAL CONTRACT OWNER (per capability)│
│  src/features/competition-core/                             │
│  domain · contracts · adapters (transitional) · config      │
└───────────────────────────┬─────────────────────────────────┘
                            │ ports (Phase 2B+)
┌───────────────────────────▼─────────────────────────────────┐
│  Repository / infrastructure ports (stubs Phase 2B)         │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Infrastructure adapters — Supabase, blob, local              │
│  auth/supabaseClient, format repos, clubStorage               │
└─────────────────────────────────────────────────────────────┘

Legacy parallel path (unchanged in 2A):
  src/tournament/engines/, src/ai/  →  Production execution until adapter cutover
```

| Layer | Path | Owner | Phase 2A action |
|-------|------|-------|-----------------|
| Public API | `competition-core/index.js` | Competition Core | Locked as sole entry |
| Domain / contracts | `competition-core/{draw,seed,...}` | Competition Core | No new outward deps |
| Transitional adapters | `competition-core/*/adapters/` | Competition Core | Grandfathered TT/legacy calls |
| Format | `features/team-tournament`, `individual-tournament` | Format teams | Must use `index.js` |
| Legacy engines | `tournament/engines`, `ai/` | Legacy (frozen) | Grandfathered page imports |
| UI | `pages/`, `components/` | Product UI | Unchanged |
| Persistence | repos, `clubStorage`, Supabase | Infrastructure | Not moved in 2A |

---

## 2. Allowed dependency matrix

| From | To | Status |
|------|-----|--------|
| `team-tournament` | `competition-core/index.js` | ✅ Allowed |
| `individual-tournament` | `competition-core/index.js` | ✅ Allowed |
| `tournament-engine` | `competition-core` public API or approved bridge | ✅ Allowed (no bridge yet) |
| `pages/UI` | application services, orchestrators, adapters | ✅ Allowed |
| `infrastructure adapters` | Supabase, blob storage | ✅ Allowed |
| `format adapters` | Competition Core contracts | ✅ Allowed |
| `competition-core` | internal modules, shared `models/` | ✅ Allowed (transitional) |
| `competition-core adapters` | legacy executors (injected) | ✅ Transitional — parity required |

---

## 3. Forbidden dependency matrix

| From | To | Enforcement |
|------|-----|-------------|
| `competition-core` | `team-tournament`, `individual-tournament`, `tournament-engine` | CI lock + baseline |
| `competition-core` | `pages/`, `*.logic.js` | ESLint + CI lock |
| `competition-core` | React, MUI | ESLint + CI lock |
| `competition-core` | `auth/supabaseClient`, `@supabase/supabase-js` | CI lock + baseline |
| `competition-core` | `domain/clubStorage` | CI lock + baseline |
| `competition-core` | `tournament/engines` (legacy) | CI lock + baseline |
| `tournament/engines`, `team-tournament/engines`, `ai/` | `pages/*.logic` | CI lock + baseline |
| Domain engines | React / `components/` | CI lock (zero violations) |
| `competition-core` | Production execution path changes | Owner decision — **blocked in 2A** |

---

## 4. Grandfathered violations (13)

Source of truth: `scripts/ci/competition-architecture-lock-baseline.json`

| Rule | File | Removal phase |
|------|------|---------------|
| `cc-no-format-module` | `constraints/adapters/teamTournamentRulesBridge.js` | 2B–3 |
| `cc-no-format-module` | `draw/adapters/teamDrawAdapter.js` | 3C |
| `cc-no-format-module` | `formation/adapters/teamFormationAdapter.js` | 3C |
| `cc-no-legacy-tournament-engines` | `rating/competitionEloEngine.js` | 2B |
| `cc-no-legacy-tournament-engines` | `rating/monthlyReviewV2.js` | 2B |
| `cc-no-supabase-gateway` | `rating/ratingRpcService.js` | 2B |
| `cc-no-domain-persistence` | `rating/ratingAtomicApply.js` | 2B |
| `cc-no-domain-persistence` | `rating/ratingServiceV2.js` | 2B |
| `engine-no-page-logic` | `tournament/engines/bracketEngine.js` | 2B–3 |
| `engine-no-page-logic` | `tournament/engines/scheduleEngine.js` | 2B–3 |
| `engine-no-page-logic` | `tournament/engines/seededGroupEngine.js` | 2B–3 |
| `engine-no-page-logic` | `tournament/engines/teamPairingEngine.js` | 2B–3 |
| `engine-no-page-logic` | `team-tournament/engines/teamRoundRobinScheduleEngine.js` | 3G |

**Zero-tolerance (no baseline):** `cc-no-react-ui`, `cc-no-page-logic` in competition-core; `engine-no-react-ui`.

---

## 5. Violations fixed in Phase 2A

| File | Change |
|------|--------|
| `team-tournament/engines/lineupValidationEngine.js` | Deep import → `competition-core/index.js` |
| `individual-tournament/adapters/individualStandingsAdapter.js` | Deep import → `competition-core/index.js` |
| `ai/scoring.js` | Deep import → `competition-core/index.js` |

No algorithm, standings, scheduling, or Production path changes.

---

## 6. Public Core API boundary

**Single entry:** `src/features/competition-core/index.js`

- Exports: constants, feature flags, contracts, canonical engines, runtime adapters, shadow parity helpers.
- **Do not import** internal paths like `competition-core/draw/adapters/*` from format modules — use `index.js`.
- Internal implementation files remain in place; barrel export is the stability contract.
- Sub-flags require `VITE_COMPETITION_CORE_ENABLED=true`; all default **OFF**.

---

## 7. Enforcement mechanism

| Mechanism | Location | Behavior |
|-----------|----------|----------|
| Architecture CI lock | `scripts/ci/competition-architecture-lock.mjs` | Baseline debt; fail on new/changed imports |
| Foundation gate | `npm run ci:foundation-lock` | Runs ownership-lock + architecture-lock |
| Prebuild | `npm run prebuild` | Runs foundation-lock before `vite build` |
| ESLint | `eslint.config.js` | `no-restricted-imports` for pages/React in core |
| Unit tests | `tests/competition-architecture-boundaries.test.js` | Public API, flags OFF, zero-tolerance rules |

```bash
node scripts/ci/competition-architecture-lock.mjs          # check
node scripts/ci/competition-architecture-lock.mjs --report # inventory
node scripts/ci/competition-architecture-lock.mjs --init   # refresh baseline (debt only)
```

---

## 8. Rollback plan

1. Revert the Phase 2A commit(s) on the working branch.
2. No database migration to roll back.
3. No feature flags were enabled — no env rollback required.
4. Production execution paths unchanged — no cutover rollback needed.
5. If CI lock blocks emergency hotfix: temporary `--init` baseline update requires Owner approval (debt increase).

---

## 9. Phase 2B entry criteria

Phase 2B may start when **all** are true:

| # | Criterion |
|---|-----------|
| 1 | Phase 2A verdict: PASS (build, test, lint, architecture lock) |
| 2 | Owner decisions recorded in `14_OWNER_DECISION_MATRIX.md` |
| 3 | No new architecture violations since 2A baseline |
| 4 | P0 capabilities approved for contract work: rules, participants, standings, persistence ports |
| 5 | Rating RPC port design approved (extract from `ratingRpcService.js`) |
| 6 | Page logic extraction plan approved for `tournament.fixtures.logic.js` / seeding / bracket |
| 7 | Production flags remain OFF per capability |
| 8 | No Production database migration until ports are stubbed and reviewed |

**Phase 2B scope (not started):** participant module stubs, repository port interfaces, rating RPC port, extract shared domain from `pages/*.logic.js`.

---

## 10. Production behavior impact

**None.** Phase 2A adds CI enforcement and import-path hygiene only.

---

## Related documents

- `02_TARGET_ARCHITECTURE.md`
- `05_SSOT_MAP.md`
- `08_DEPENDENCY_VIOLATIONS.md`
- `11_FEATURE_FLAG_AND_PARITY_PLAN.md`
- `14_OWNER_DECISION_MATRIX.md`
- `docs/audit/PICK_VN_DEPENDENCY_VIOLATIONS.md`
