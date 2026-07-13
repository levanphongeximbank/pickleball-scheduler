# CC-09M — Conflict Resolution

## Conflict 1: `package.json`

| Field | Standardization (HEAD) | CC-09 branch | Resolution | Risk | Test coverage |
|---|---|---|---|---|---|
| `test:unit` | Includes `tests/referee-v5/referee-v5-e1-realtime.test.js` (TT-5) | Includes `tests/competition-core-scheduling-cc09.test.js` | **Keep both** — insert CC-09 scheduling test after standings-cc08c, retain referee-v5-e1 | Low — additive test list only | Full `npm test`; CC-09 suite 204/204; referee-v5-e1 loads in runner |

No other conflicts. All CC-09 source files merged cleanly:

- `src/features/competition-core/scheduling/**`
- `featureFlags.js`, `index.js`, `legacyAdapter.js`
- 16 × `CC09_*.md` docs
- `tests/competition-core-scheduling-cc09.test.js`

No manual file copy. No ours/theirs blind resolution.
