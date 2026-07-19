# 07 — Phase 1A Non-Goals and Guardrails

**Phase:** 1A — Contract Freeze  
**Status:** Official  

---

## Non-goals (strict)

Phase 1A **must not**:

1. Modify Competition Engine behavior  
2. Modify Club Management schemas  
3. Modify Venue & Court schemas  
4. Create or apply database migrations  
5. Move existing production modules  
6. Delete legacy data  
7. Change rating algorithms  
8. Change ranking algorithms  
9. Change tournament selection behavior  
10. Change production routes  
11. Perform data migration  
12. Perform production deployment  

Additionally for this freeze:

- Do **not** create `src/features/player/` yet (that is Phase 1B)  
- Do **not** write production data  
- Do **not** change Rating / Ranking / Club / Competition / Venue runtime logic  
- Do **not** “fix” hydration bugs or picker gaps under the guise of documentation  

---

## Allowed work in Phase 1A

| Allowed | Examples |
|---------|----------|
| Documentation under `docs/player-management/phase-1a/` | This file set |
| Non-production documentation metadata only if strictly required | e.g. index links inside the same docs folder |
| Repository validation commands | lint / unit test / build — **read evidence, do not “fix” unrelated failures** |

---

## Guardrails

1. **Documentation-first** — contracts precede code.  
2. **No second identity store** — do not invent a parallel blob/table “just for Phase 1”.  
3. **Transparent failures** — pre-existing lint/test/build failures are reported separately from Phase 1A regressions.  
4. **Owner gate** — no commit/push until Owner reviews the Phase 1A report (unless Owner explicitly requests otherwise).  
5. **Alias honesty** — `profiles.player_id`, `athletes.id`, blob ids, rating/ranking keys are aliases/legacy refs, not separate people.  
6. **Lifecycle honesty** — account ≠ profile ≠ membership ≠ rating verification.  

---

## Stop conditions

Stop Phase 1A and mark **FAIL** if any of the following occur during the freeze:

- Runtime source behavior changes outside documentation metadata  
- Migrations added or applied  
- Production routes changed  
- Competition / Club / Venue / Rating / Ranking logic edited  
- `src/features/player/` created prematurely without Owner approval to enter 1B  

---

## Related phases (context only)

| Phase | Intent |
|-------|--------|
| 1A | Contract & inventory freeze ← **this phase** |
| 1B | Module skeleton `src/features/player/` facade |
| 1C | Profile foundation fields |
| 1D | Status model implementation helpers |
| 1E | Public vs internal + directory |
| 1F | Link & dedupe tooling |
