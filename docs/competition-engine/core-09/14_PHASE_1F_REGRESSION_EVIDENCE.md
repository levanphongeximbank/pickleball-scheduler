# CORE-09 — Phase 1F Regression Evidence

**Purpose:** Capture verification evidence for Phase 1F certification.
**Branch:** `feature/competition-core-09-phase-1f-integration-certification`
**HEAD at evidence capture (pre-commit working tree):** `f588da417567c2693575f7b5b6e1f9c98f698585` (docs-only uncommitted Phase 1F artifacts)
**Generator identity version:** `1.0.0-phase1d` (unchanged; Phase 1F is docs-only)

---

## 1. Unit / domain regression

| Suite | Command | Expected | Result |
|-------|---------|----------|--------|
| Phase 1B | `node --test tests/competition-core-match-generation-core09-phase1b.test.js` | 42 pass | **42 pass / 0 fail** |
| Phase 1C | `node --test tests/competition-core-match-generation-core09-phase1c.test.js` | 43 pass | **43 pass / 0 fail** |
| Phase 1D | `node --test tests/competition-core-match-generation-core09-phase1d.test.js` | 51 pass | **51 pass / 0 fail** |
| Phase 1E | `node --test tests/competition-core-match-generation-core09-phase1e.test.js` | 6 pass | **6 pass / 0 fail** |
| Combined | All four files in one `node --test` invocation | 142 pass / 0 fail | **142 pass / 0 fail** |

---

## 2. Lint / build / architecture / ownership

| Gate | Command | Result |
|------|---------|--------|
| Lint (no new) | `npm run lint:no-new` | **PASS** — `lint-gate: OK — 0 new lint violations` |
| Build | `npm run build` | **PASS** — Vite production build completed |
| Architecture lock | `npm run ci:competition-architecture-lock` | **PASS** — 0 new/changed violations |
| Ownership lock | `npm run ci:ownership-lock` | **PASS** — 0 new/changed violations |
| Whitespace | `git diff --check` | **PASS** |

**Dependency access:** `node_modules` is a Junction to `C:\Users\Le Phong\pickleball-scheduler\node_modules`. No `npm install` was run in Phase 1F.

---

## 3. Large-N determinism evidence (Phase 1E)

| Case | Test name | Evidence |
|------|-----------|----------|
| Round Robin N=128 | `1E-stress-RR-128: deterministic fingerprint and stable ordering` | Repeat runs produce identical generation fingerprint and stable match ordering; played-match count matches expected single RR formula |
| Single Elimination N=1024 | `1E-stress-SE-1024: graph integrity and deterministic output` | Repeat runs produce identical output; dependency graph integrity holds at scale |
| Group Stage 8×16 | `1E-stress-GROUP-8x16: cross-group isolation at scale` | Eight groups × sixteen participants; no cross-group pairing; deterministic ordering preserved |

Additional Phase 1E coverage:

- Duplicate `dependencyInputs` edges rejected (`DUPLICATE_DEPENDENCY_EDGE`)
- Distinct dependency edges remain valid
- Generated SE plans have no duplicate dependency edges

---

## 4. Scope of this evidence

Phase 1F **does not** change generator source or tests. Evidence reconfirms Phase 1B–1E baselines after documentation-only work under `docs/competition-engine/core-09/`.

---

## 5. Related artifacts

- Integration certification: `10_PHASE_1F_INTEGRATION_CERTIFICATION.md`
- Closure checklist: `15_CORE_09_CLOSURE_CHECKLIST.md`
- Strategy matrix: `13_PHASE_1F_STRATEGY_SUPPORT_MATRIX.md`
