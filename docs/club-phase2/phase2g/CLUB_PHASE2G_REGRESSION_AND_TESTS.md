# Club Phase 2G — Regression & Test Evidence

## Regression surfaces

| Surface | Automated | Live | Result |
|---------|-----------|------|--------|
| Club Home (`/my-club`) | Phase 2F + My Club SoT | BLOCKED | **CODE_PASS** |
| My Club Governance panel | Phase 2F 3, 9–15 | BLOCKED | **CODE_PASS** |
| Member List | Phase 2F 6–7, 16–17, 26 + myclub-members-v2 | BLOCKED | **CODE_PASS** |
| Governance Management (Manage) | Phase 2F 5, 15 | BLOCKED | **CODE_PASS** |
| Organization Chart | Phase 2F 4, 9–14, 24 | BLOCKED | **CODE_PASS** |

No Phase 2F regressions detected in automated suites. No production code changes in 2G → no new regression surface introduced.

## Targeted smoke (Phase 2F certification reused)

```text
node --test tests/club-phase-2f-governance-ui-certification.test.js
→ 28/28 PASS
```

## Club governance pack

```text
node --test \
  tests/club-phase-2f-governance-ui-certification.test.js \
  tests/club-phase-2e-governance-read-model.test.js \
  tests/club-phase-2d-governance-writer.test.js \
  tests/club-phase-2c-membership-parity.test.js \
  tests/club-governance.test.js \
  tests/club-v2-myclub-source-of-truth.test.js \
  tests/myclub-members-v2.test.js \
  tests/club-v2-manage-members-read.test.js \
  tests/club-phase-1c-integration-ui.test.js
→ 141/141 PASS
```

## Build

```text
Not run — no application source changes in Phase 2G.
```

## ci:prod-gate / full unit

```text
Not re-run — no application source changes; Phase 2F already green on merged main.
```

## Secret / scope

- No credentials committed  
- Docs-only evidence under `docs/club-phase2/phase2g/`  
- SQL: **NO_SQL**  
- Production mutations: **NONE**
