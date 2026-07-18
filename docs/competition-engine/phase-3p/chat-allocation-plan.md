# Chat Allocation Plan — Phase 3P

## Evaluation of chat counts

| Count | Assessment |
|-------|------------|
| **3 chats** | Feasible but slow: (1) Participant family, (2) Seed/Draw/Match/Schedule, (3) Integrator. Under-utilizes format-local Team work. |
| **4 chats** | **OPTIMAL** — balances dependency, conflict, Owner review, CI load. |
| **5 chats** | Acceptable after Wave 1 if Owner review capacity exists. |
| **6+ chats** | **NOT recommended** early — Owner review + Integrator become bottleneck; protected-file thrash; CI queue noise. |

## Official recommendation

```text
Recommended chat count: 4
  Chat 1 — Capability (wave-assigned)
  Chat 2 — Capability (wave-assigned)
  Chat 3 — Capability (wave-assigned)
  Chat I — Integrator (standing)
```

Do **not** open Chat 2–3 until parallel-start checklist is green.

---

## Standing roles

### Chat I — INTEGRATOR (standing)

- Owns all protected files
- Registry registration
- Official test manifest merges
- Root public exports
- Cross-capability integration tests
- Merge wave sequencing PRs
- Architecture documentation indexes

### Chat 1 / 2 / 3 — Capability chats (reassigned per wave)

Same three Codex sessions rotate through wave assignments below. Do not spawn a new chat per phase letter unless Owner explicitly expands capacity.

---

## Wave assignments (using 4-chat model)

### Wave 0 — PHASE 3A.3 Integration Bootstrap (Integrator only) — **REQUIRED**

| Chat | Work |
|------|------|
| Chat I | Phase **3A.3** — empty registries, export/test conventions locked, docs index |
| Chat 1–3 | **CLOSED** until Phase 3A.3 complete |

### Wave 1 — Participant

| Chat | Work |
|------|------|
| Chat 1 | Phase **3B** Participant Runtime (**after** 3A.3) |
| Chat 2–3 | Idle / prep docs only |
| Chat I | Export + manifest after 3B |

### Wave 2 — Registration + Team

| Chat | Work |
|------|------|
| Chat 1 | Phase **3C** Registration Runtime |
| Chat 2 | Phase **3D** Team Runtime (format KEEP) |
| Chat 3 | Idle |
| Chat I | Integrate 3C+3D |

### Wave 3 — Lineup + Seeding

| Chat | Work |
|------|------|
| Chat 1 | Phase **3E** Lineup Runtime (**only after 3D merged**) |
| Chat 2 | Phase **3F** Seeding Runtime |
| Chat 3 | Idle (or prep Draw fixtures) |
| Chat I | Integrate after 3E←3D prerequisite confirmed |

### Wave 4 — Draw + Match

| Chat | Work |
|------|------|
| Chat 1 | Phase **3G** Draw Runtime |
| Chat 2 | Phase **3H** Match Runtime (fixture-based until 3G merges) |
| Chat 3 | Idle |
| Chat I | Integrate; enforce 3G before 3H Production-facing parity |

### Wave 5 — Schedule + Lifecycle + Standings

| Chat | Work |
|------|------|
| Chat 1 | Phase **3I** Schedule Runtime |
| Chat 2 | Phase **3J** Lifecycle Runtime |
| Chat 3 | Phase **3K** Standings Runtime (fixtures OK) |
| Chat I | Result DTO freeze + integrate |

### Wave 6 — Publication

| Chat | Work |
|------|------|
| Chat 1 | Phase **3L** Publication Runtime |
| Chat 2–3 | Support / idle |
| Chat I | Integrate |

### Later (Owner-gated, not parallelized casually)

| Phase | Chat |
|-------|------|
| 3M Production Cutover | Chat I + Owner; capability chats only for kill-switch evidence |
| 3N Legacy Retirement | Chat I + Owner |

---

## Why not open 6 capability chats at once?

1. HARD chain Participant → Registration → Seed → Draw → Match
2. Shared `participants/*` and root index
3. Owner cannot review 6 Production-safety PRs concurrently without regression risk
4. Integrator becomes serial bottleneck anyway

## Expansion rule

Owner may open a **5th capability chat** only after Wave 2 merges cleanly and Integrator reports LOW conflict on protected files.
