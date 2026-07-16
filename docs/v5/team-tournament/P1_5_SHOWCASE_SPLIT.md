# Team Tournament V6 — P1.5 Showcase Split

**Status:** Active for Owner showcase (tomorrow)  
**Branch:** `feature/team-tournament-v6`  
**PR #26:** OPEN / UNMERGED (do not merge for this phase)  
**P1.4:** Deferred  
**Production:** Untouched

---

## Split

| Track | Purpose | Timing |
|-------|---------|--------|
| **P1.5A — Showcase Tomorrow** | Presentation layer so Owner can conduct and publicly present AI team draw + group draw | Mandatory before the event |
| **P1.5B — Remaining UX polish** | Visual/export/mobile polish that is not required to run the ceremony | After the event |

P1.5A is a **presentation layer only**. It must not rewrite team/group engines, canonical rating, private pairing, setup mutation, snapshot/version/idempotency, or `get_setup` v7.

---

## Architecture lock (both tracks)

```
Existing engine
  → fixed generated result
  → presentation animation
  → Owner review
  → confirm
  → canonical persistence
  → get_setup v7 read-back
  → final saved-result screen
```

The animation must never determine or alter the generated result.

---

## P1.5A — Showcase Tomorrow (in scope)

Mandatory delivery:

1. Presentation entry point — **“Bắt đầu lễ bốc thăm”** (+ xem lại / chế độ trình chiếu / thoát)
2. Pre-flight validation (athletes, gender, team counts, rules, identity, ratings)
3. 10-second countdown (pause/skip/Escape; no DB write)
4. AI processing sequence (stages reveal only; engine runs **once**)
5. Reveal 8 teams (roster, gender, canonical rating, average, 2M+2F)
6. Reveal athletes and ratings
7. Reveal captains (stable; never re-pick on replay)
8. Select 2-group or 4-group format
9. Reveal groups (engine-first, animation-second)
10. Confirm and save (canonical persistence only)
11. Persisted-result replay (`get_setup` v7; no AI rerun; no save)
12. Full-screen presentation shell
13. Stable projector / browser operation

### P0 (must ship)

- Entry, pre-flight, countdown, fixed team generation, team reveal, captain reveal, group select/reveal, confirm/save, persisted replay, full-screen stability, no Console errors

### P1 (only after P0 stable)

- Pause/resume polish, sound toggle (default OFF), improved transitions, final-results polish

---

## P1.5B — Deferred polish (out of scope for tomorrow)

Defer explicitly:

- Advanced export design
- Elaborate sound design
- Large particle effects
- Advanced print templates
- Social-media graphics
- Custom video backgrounds
- Secondary celebration animations
- Extended mobile polish
- Complex particles / casino aesthetics

Do not sacrifice correctness or persistence to complete P1/P2 visuals.

---

## Non-goals (both tracks)

- Do not begin P1.4
- Do not merge PR #26
- Do not apply Production SQL
- Do not change Production data or feature flags
- Do not rewrite existing team/group engines
- Do not use blob authority for showcase success
- Do not invent success before cloud read-back

---

## Module location

`src/features/team-tournament/showcase/`

Reuse:

- `teamAutoDrawEngine` / `assignSeededTeamsToGroups`
- `teamGroupDivisionPolicy` / `buildGroupDivisionPreview`
- Canonical athlete pool + rating
- Setup mutation + `groups.replace` + `get_setup` v7
