# CORE-06 — Source of Truth (Phase 1B Scope Freeze)

**Status:** Frozen SoT strategy until Owner cutover  
**Non-negotiable:** Team Tournament V6 remains Production **write** SoT

---

## 1. Current Production SoT

| Concern | Source of truth | Location |
|---------|-----------------|----------|
| Lineup write (draft/submit/lock/publish/override/randomize) | **TT V6** | SQL RPC + `team-tournament` engines / cloud repos |
| Lineup revision history | **TT V6** | `team_tournament_lineup_revisions` (+ audit writers) |
| Visibility projection | **TT V6 server** | `team_tournament_get_visible_lineups` |
| Deadline clock | **TT V6 server time** | Deadline RPCs / services; client countdown UX-only |
| Optimistic concurrency / idempotency | **TT V6** | `expectedVersion` + command log |
| Validation (cloud mutations) | **TT V6 SQL** | TT-2C validate RPC; client engine UX-only |
| Canonical contracts (dormant) | Competition Core factories / Phase 3E shell | **Not Production write path** |

Phase 3E `competition-core/lineups/**`:

- Map / normalize / transition helpers
- Persistence stub **OFF** by default
- **No** Production callers, flags, shadow, SQL, or UI impact

---

## 2. Future Core SoT

When Owner approves cutover, CORE-06 becomes write SoT for:

- Lineup aggregate + revisions
- Lifecycle transitions
- Identity / concurrency / idempotency / audit contracts
- Persistence via Production adapter implementing `LineupPersistencePort`

Format continues to own:

- Composition policy (MLP, gender, …)
- Product UX
- Matchup scheduling machine

Consumers (match, referee, scoring, standings) read published lineup projections from Core (or adapter façade).

---

## 3. Ownership during transition

| Phase | Write SoT | Read / map | Shadow |
|-------|-----------|------------|--------|
| Now → 1B–1E | TT V6 | Core map-only allowed | OFF |
| 1F | TT V6 | In-memory Core persistence for tests | OFF |
| 1G | TT V6 | TT → Core shadow **read** parity | Owner-gated, default deny |
| Dual-write (later) | TT V6 primary + Core secondary | Compare | Owner gate |
| Cutover (later) | Core primary | TT adapter optional | Owner gate + rollback plan |

---

## 4. Cutover strategy (documentary)

Minimum Owner-approved plan before any Production writer move:

1. **Parity gate:** shadow read shows zero material drift on status, slots, revision, visibility for agreed window
2. **Dual-write or freeze-window cutover** chosen explicitly (do not invent in 1B)
3. **Backfill** TT tables ↔ Core tables (schema deferred to later phase)
4. **Rollback:** re-point writers to TT RPC; Core flag OFF
5. **UI/API:** façade or Integrator wiring only after flag + Owner GO
6. **No silent cutover** from Phase 1B–1G docs alone

---

## 5. Shadow strategy (documentary)

| Rule | Detail |
|------|--------|
| Default | Shadow **OFF** / deny |
| Mode | Read-path compare: TT visible lineup vs Core-normalized projection |
| Writes | Forbidden on Core during shadow-only |
| Leak risk | Dual-path must not expose opponent selections earlier than TT (R-05 Critical) |
| Exit | Owner GO on parity thresholds (program-level; not defined numerically in 1B) |

---

## 6. Ownership matrix (frozen)

| Artifact | Owner now | Owner after cutover |
|----------|-----------|---------------------|
| TT engines / UI / RPC | TT Format product | May become adapters / façade |
| Core contracts / lifecycle / ports | CORE-06 (structure) | CORE-06 (runtime SoT) |
| Composition / reveal policy | Format (`LineupPolicy`) | Format (`LineupPolicy`) |
| SQL migrations / RLS | TT docs/SQL (deferred Core SQL) | Owner-chosen schema owner |
| Root `competition-core/index.js` | Integrator | Integrator |

---

## 7. Phase 1B statements

- Documentation does **not** change SoT.
- CORE-06 owns structure/contracts/ports/domain/lifecycle/identity/revision **as architecture**.
- Production write SoT remains **Team Tournament V6**.
