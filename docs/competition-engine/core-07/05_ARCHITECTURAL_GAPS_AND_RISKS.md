# CORE-07 — Architectural Gaps and Migration Risks

**Phase:** 1A
**Baseline:** `fb9f482434639621d465cbc35b80e085fb82f383`

---

## 1. Architectural gaps

### G1 — Dual CORE seeding models

| Model | Path | Semantics |
|-------|------|-----------|
| Phase 3G runtime | `seeding/**` | Order external ranking/rating snapshots; assign seed numbers |
| CC-04B foundation | `seed/**` | Compute composite seed **score**, then rank |

**Gap:** No single SSOT. Shadow compare exists (`seedShadowCompare`) but production ignores both. Phase 3G ownership manifest says `seed/**` is read-only reference — but product still lacks a Owner decision on score-vs-order.

### G2 — Production SSOT outside competition-core

Individual TE `generateSeed`, official `assignSeedsToEntries`, and team `sortTeamsForGroupSeeding` remain live SSOT. Phase 3G is capability-local (not in root `competition-core/index.js` as a production capability export for UI).

### G3 — Seed / draw entanglement

Team and page APIs combine:

- competition seed ranking, and
- snake / open group placement

in one orchestration path (`teamAutoDrawEngine`, `tournament.seeding.logic`, `seededGroupEngine`). Clean CORE-07 vs draw ownership is hard without adapter splits.

### G4 — Inconsistent missing-data and unseeded policies

| Policy family | Behaviour |
|---------------|-----------|
| TE | Defaults + possible `seed: null` unseeded pool + bands |
| 3G | Nulls last; always assign 1..N among eligible |
| CC-04B | Zero components; always rank |
| Team | Stored avgLevel / top-player fallbacks; open → `seed: 0` |

### G5 — Eligibility not standardized

TE local statuses ≠ CORE-01/03 ≠ 3G `eligible` flag. Withdrawn / DQ not first-class in seeding cores.

### G6 — Bands vs pots contract drift

TE `seedBand` (random-in-band later) ≠ draw-runtime `seedTier` / pot snake. No shared CORE-07 contract for band metadata (and bands are arguably **downstream placement aids**, not seed numbers).

### G7 — Format-specific coupling

| Format path | Formula |
|-------------|---------|
| Individual TE | Weighted V5/Elo/skill/winRate/recent/manual |
| Official AI Balance | Sum of member ratings on entry |
| Team groups | `avg_level` or `top_player_then_total` |
| Open modes | Shuffle; not true competition seeding |

Same product word “seed” means different math per format.

### G8 — UI / browser / persistence coupling (legacy)

Engine tabs and tournament settings blobs hold manual overrides and audit logs. CORE-07 domain must stay pure; persistence only via ports (3G already sketches OFF-by-default persistence port).

### G9 — Naming collision with “seed data”

Demo/tenant/SQL seed scripts and deterministic-random seeds create cognitive drift in reviews and searches. Documentation must keep the three-way distinction explicit.

---

## 2. Duplication map

| Capability | Copies | Risk |
|------------|--------|------|
| Seed number assignment | 3G, CC-04B, TE, official entries, team sort | Divergent published seeds |
| Manual override | 3G, CC-04B, TE/rating adapter | Different lock/protected semantics |
| Tie-break | 3G total order; CC-04B score order; TE locale name; team id | Non-parity |
| Eligibility filter | TE statuses; 3G flag; CORE-03/01 unused | Wrong entrants seeded |
| Seeded PRNG | 3G Mulberry32; CORE-06 lineup RNG; private-pairing `seededRng`; team auto-draw | Pattern duplication OK; must not mix responsibilities |
| Snake placement | teamGroupSeedEngine, page seeding.logic, draw-runtime pots | Belongs downstream; duplicated |

---

## 3. Coupling risks

| Coupling | Severity | Notes |
|----------|----------|-------|
| Legacy seed ↔ draw in one call | **High** | Blocks clean CORE-07 cut |
| Seeding ↔ Rating recalculation in TE/CC-04B | **High** | CORE-07 should consume snapshots |
| Seeding ↔ UI settings blob | **Medium** | Manual override SSOT unclear |
| Seeding ↔ Supabase | **Low today** for 3G | Keep port-only |
| Seeding ↔ Rule Engine | **Missing** | Required before production |
| Seeding ↔ ClubContext / localStorage | **Legacy risk** | Keep out of CORE-07 |

---

## 4. Migration risks (if cutover attempted too early)

1. **Published bracket drift** — TE defaults / unseeded pools vs 3G full 1..N assignment.
2. **Shadow false confidence** — CC-04B vs legacy parity does not prove 3G vs legacy parity.
3. **Open-draw regressions** — replacing `Math.random` without Format-owned seeded RNG breaks showcase/AI draw expectations.
4. **Team mode formula loss** — `top_player_then_total` must become an injected scoring/ranking policy, not hard-coded in core.
5. **Manual override desync** — UI writes TE fields that 3G `manualSeed`/`protectedSeed` do not read.
6. **Root export / feature-flag accidents** — premature `competition-core/index.js` export invites accidental production use.
7. **Eligibility fail-open** — shipping 3G noop policy without CORE-03 port seeds ineligible entries.

---

## 5. Ownership freeze recommendation (preview)

| Item | Owner |
|------|-------|
| Competition seed assignment runtime | **CORE-07** → Phase 3G `seeding/**` |
| CC-04B score pipeline | Read-only reference until Owner model-merge decision |
| Rating/ranking computation | UPSTREAM modules |
| Eligibility adjudication | CORE-03 (+ CORE-01 rules) via ports |
| Snake / pot / bracket / schedule | DOWNSTREAM draw/Format |
| Deterministic RNG for open shuffle | Format/draw (pattern-aligned with CORE-06), not CORE-07 competition seeding |
| Production TE/team/official engines | Legacy adapters until Owner-gated cutover |

Detailed Phase 1B proposal: `06_PHASE_1B_RECOMMENDATION.md`.
