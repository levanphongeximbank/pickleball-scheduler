# CORE-07 — Existing Seeding Inventory

**Phase:** 1A
**Baseline:** `fb9f482434639621d465cbc35b80e085fb82f383`
**Scope:** Competition seeding (seed number / rank assignment). Demo DB / tenant / SQL seed scripts excluded.

---

## 1. Inventory summary

| ID | Surface | Kind | Assigns seed # | Mixes draw/group | Prod wired | Ownership |
|----|---------|------|----------------|------------------|------------|-----------|
| A1 | `competition-core/seeding/**` | Phase 3G runtime | Yes | No | No | **CORE-07** target |
| A2 | `competition-core/seed/**` | CC-04B foundation | Yes (via score rank) | No | Shadow only | **CORE-07** reference |
| B1 | `draw/seedModel.js` | Draw seed contracts | No (tags only) | N/A | Helper | DOWNSTREAM |
| B2 | `draw-runtime/**` seed refs | Consume / validate / pot | Consumes | Placement | Not prod UI | DOWNSTREAM |
| C1 | `tournament-engine/.../seedEngine.js` | Legacy TE | Yes + bands | No | **Yes** | Legacy → migrate |
| C2 | `ratingV5SeedAdapter.js` | Rating + manual helpers | Partial (override) | No | **Yes** | UPSTREAM support |
| C3 | `teamPairingEngine.assignSeedsToEntries` | Official entries | Yes | No | **Yes** | Legacy → migrate |
| C4 | `tournament.seeding.logic.js` | Pair + groups | Implicit order | **Yes** | **Yes** | Mostly DOWNSTREAM |
| C5 | `seededGroupEngine.js` | Snake into groups | Uses C4 | **Yes** | **Yes** | DOWNSTREAM |
| C6 | `teamGroupSeedEngine.js` | Team seed + snake helpers | Yes | Helpers yes | **Yes** | Split CORE-07 / draw |
| C7 | `teamAutoDrawEngine` | Orchestrates seed+snake | Via C6 | **Yes** | **Yes** | DOWNSTREAM orch. |
| C8 | `aiDrawSeedAudit.js` | AI draw RNG metadata | No | Audit | **Yes** | Deterministic-random util |
| C9 | `ai-assistant/.../seedSuggestion.js` | Advisory over C1 | Via C1 | No | Flagged | DOWNSTREAM AI |
| C10 | `EngineSeedTab.jsx` / `PlayerSeedStandingsPanel.jsx` | UI | Via engine | Display | **Yes** | OUT of core |

---

## 2. CORE-07 surfaces

### 2.1 Phase 3G — `src/features/competition-core/seeding/**`

**Primary exports:** `createSeedingResolver` / `SeedingResolver`, `assignSeeds`, `compareCandidatesForSeed`, `orderCandidatesDeterministically`, `createLegacySeedingAdapter`, contracts, ports, policies.

| Topic | Behaviour |
|-------|-----------|
| Ranking / rating | Immutable snapshots (`rankingPosition`, `ratingValue`) or injected resolvers; **never recalculates** |
| Seed assignment | Manual / `protectedSeed` lock numbers; remaining fill free slots `1..N` (`assignSeeds`) |
| Seed bands / pots | **None** (draw-runtime owns `seedTier` / pot snake) |
| Manual overrides | Yes — `manualSeed`, `protectedSeed`; duplicate / OOR rejected |
| Tie-break | Policy → ranking ASC (missing last) → rating DESC (missing last) → `sourcePriority` → optional deterministic key → identity ASC |
| Missing score | Nulls sort after present values; no synthetic default rating |
| Withdrawn / DQ | Soft only: `eligible !== false` / `ineligible !== true` + noop policy; **no** status enum |
| Deterministic RNG | Optional Mulberry32 when `deterministicSeed` set; default clock fixed epoch |
| UI / Supabase | None (optional persistence port default OFF) |
| Rule Engine | **Not coupled** |
| Format | Agnostic (`PARTICIPANT` / `ENTRY` / `TEAM` / `UNKNOWN`) |

Docs: `docs/competition-engine/phase-3g/**`. Ownership: capability-local; must not rewrite `seed/**`.

### 2.2 CC-04B foundation — `src/features/competition-core/seed/**`

**Primary exports:** `runCanonicalSeedPipeline`, normalize / score / sort / legacy mapping helpers.

| Topic | Behaviour |
|-------|-----------|
| Inputs | Elo, level, internal rating, winRate, performance, manual fields; `DEFAULT_SEED_SCORE_WEIGHTS` |
| Assignment | Sort by composite score → `seedNumber = index + 1` |
| Manual | `manualOverride` + `manualSeedNumber` (score transform) |
| Tie-break | Score DESC then `DEFAULT_SEED_TIEBREAK_ORDER` (incl. `randomTieKey` / id) |
| Missing metrics | Components contribute **0**; confidence / provisional penalties |
| Withdrawn / DQ | **Not handled** |
| Production use | Exported from root for **shadow compare** only |

Docs: `docs/competition-core/CC04B_*.md`, `CC04A_*` (draw seed contracts), `CC04E_*` (shadow).

---

## 3. Downstream draw consumption

### 3.1 `draw/seedModel.js`

Helpers for DrawSeed source tags (`createManualDrawSeed`, `normalizeDrawSeeds`, …). Does **not** assign competition seed numbers.

### 3.2 Draw-runtime

- `drawSeedReference.js` / `validateSeedAssignments.js` / `mergeCandidatesAndSeeds` — consume Phase 3G-shaped assignments.
- Pot snake (`assignPotGroups`) uses `seedTier` — **placement**, not competition seeding.

---

## 4. Production / legacy surfaces

### 4.1 `seedEngine.js` — individual tournament engine (production primary)

- `generateSeed`: weighted score (Rating V5 preferred → Elo → `skillLevel*200` default **700**).
- Seeded pool `seed = 1..n`; new players may be **unseeded** (`seed: null`).
- `attachSeedBands` (default band size 4) for later random-in-band draw.
- Manual: `manualSeedOverride` / `applyManualSeedOverride`.
- Status exclude via `INELIGIBLE_SEED_STATUSES` (absent/injured/unpaid/pending/inactive) — **not** CORE-01.
- Tie: score → `displayRating` → `localeCompare(..., "vi")`.

### 4.2 `ratingV5SeedAdapter.js`

Upstream rating snapshot resolution, band helpers, manual override, audit append. Audit ids use `Date.now`.

### 4.3 `assignSeedsToEntries` (`teamPairingEngine.js`)

Official / AI Balance: sort entries by summed member ratings → `seed: index+1`. No explicit tie-break beyond numeric sort. No CORE-01.

### 4.4 `tournament.seeding.logic.js`

`createTeamsFromPlayers`, `seedTeamsIntoGroups`, `buildSeededGroups`. Open mode: `Math.random` shuffle. Skill mode: high+low pairing + avgLevel snake. **Does not** assign explicit competition seed numbers on teams in the primary path — primarily **grouping**.

### 4.5 `seededGroupEngine.js`

Sort by avgLevel → calls page seeding.logic → groups. Group ids use `Date.now()` (non-deterministic ids).

### 4.6 `teamGroupSeedEngine.js`

- `sortTeamsForGroupSeeding` → `seed: index + 1` (modes: `avg_level`, `top_player_then_total`).
- Tie: `localeCompare` on team id (**no locale**).
- `shuffleTeamsForOpenDraw` → `seed: 0`, default `Math.random`.
- Snake helpers: **DOWNSTREAM** placement.

### 4.7 `teamAutoDrawEngine` / `aiDrawSeedAudit.js`

Orchestration + AI draw **randomSeed** metadata (`crypto.getRandomValues` / `Math.random` + `Date.now`). Not competition seeding.

### 4.8 AI Assistant / UI

- `seedSuggestion.js` wraps `generateSeed`.
- `EngineSeedTab.jsx` — generate + manual override UI.
- `PlayerSeedStandingsPanel.jsx` — display only.

---

## 5. Feature matrix

| Concern | 3G `seeding/` | CC-04B `seed/` | TE `seedEngine` | `assignSeedsToEntries` | `teamGroupSeedEngine` |
|---------|---------------|----------------|-----------------|------------------------|------------------------|
| Seed numbers | Yes 1..N eligible | Yes via score | Yes + null unseeded | Yes | Yes / 0 open |
| Bands/pots | No | No | Bands yes | No | No |
| Manual | Yes | Yes | Yes | No | No |
| Missing rating | Nulls last | Zero contrib | Defaults (700 / 0.5) | 0 | avgLevel fallback |
| Withdrawn/DQ | Soft eligible flag | None | Status set (partial) | None | None |
| Rule Engine | None | None | None | None | None |
| Draw mixed | No | No | No | No | Helpers yes |

---

## 6. Explicit non-inventory (name collision)

Out of CORE-07 competition-seeding scope:

- `src/demo/seed/**`, `src/data/seedDemoData.js`, `src/features/tenant/seed/**`, `src/features/club/seed/**`
- `scripts/seed-*.mjs`, staging SQL `*seed*.sql`
- CORE-06 `lineups/random/seed.js` (deterministic random composition for lineup fallback)

---

## 7. Upstream / CORE-07 / downstream map

```text
UPSTREAM
  Rating V5 / Elo / skill snapshots
  Ranking / standings positions
  Registration eligibility (CORE-03) + Rule Engine (CORE-01)
  Participant / entry / team identity (CORE-02 / CORE-05)

CORE-07
  Order candidates + assign seedNumber
  Manual / protected seed locks
  Deterministic tie policy (optional seeded PRNG for ties only)
  Explain / trace of assignment reasons

DOWNSTREAM
  Seed bands / seedTier / pot snake / serpentine groups
  Bracket bye placement / matchup / schedule
  UI presentation / publish workflows
  AI draw randomSeed audit metadata
```
