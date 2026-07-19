# CORE-01 — Test Matrix

**Suite:** `tests/competition-core-rules-core01-foundation.test.js`
**Import:** `src/features/competition-core/constraints/index.js` (local barrel)

| # | Case | Expected |
|---|------|----------|
| 1 | Authority values | 1000/800/600/400/0 |
| 2 | SUPER_ADMIN &gt; TOURNAMENT | compare &gt; 0 |
| 3 | TOURNAMENT &gt; CLUB | compare &gt; 0 |
| 4 | CLUB &gt; SESSION | compare &gt; 0 |
| 5 | SESSION &gt; DEFAULT | compare &gt; 0 |
| 6 | Explicit sourcePriority | Numeric override wins |
| 7 | Rule priority tie-break | critical &gt; low |
| 8 | ruleSetVersion tie-break | Higher version wins |
| 9 | updatedAt tie-break | Newer wins |
| 10 | id ASC | Lower id wins |
| 11 | Scope ignored by comparator | Scope does not change authority |
| 12 | Operation exact match | true |
| 13 | ALL operation | true |
| 14 | Operation mismatch | suppressed |
| 15 | Alias mapping | PAIRING→PARTNER_PAIRING etc. |
| 16 | CC-03A scope filter | expandApplicableRules still works |
| 17 | Tenant mismatch | suppressed |
| 18 | Competition mismatch | suppressed |
| 19 | Missing tenant required | fail closed |
| 20 | Missing competition required | fail closed |
| 21 | Disabled rule | suppressed |
| 22 | Invalid rule | fail closed |
| 23 | Unsupported operation | fail closed |
| 24 | Empty set | ok, empty selected |
| 25 | No input mutation | JSON snapshot equal |
| 26 | Determinism | Identical traces |
| 27 | Trace explainability | winner + suppressed steps |
| 28 | Authority conflict suppress | higher wins |
| 29 | Unresolvable conflict | fail closed |
| 30 | Flag OFF passthrough | no isolation fail |
| 31 | evaluateCandidate flag OFF | feasible true |
| 32 | Ports stubs | null / in-memory |
| 33 | No Core-02/04 imports | source scan |
| 34 | PP priority parity | equal numerics |
| 35 | PP comparator sign parity | sourcePriority ladder |

## Regression

Also run existing:

- `tests/competition-core-rules-engine.test.js`
- `tests/competition-core-rules-engine-verification.test.js`
- `tests/competition-core-rules-integration.test.js`
- `tests/competition-core-rules-cc07.test.js`
- `tests/competition-core-rules-cc07c.test.js`
