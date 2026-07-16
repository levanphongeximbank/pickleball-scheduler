# P1.2 — Canonical Vectors (Team Tournament V6)

**Phase:** P1.2 S1-A  
**Status:** Foundation module (normalization + hashing only)

> This module performs normalization and hashing only. It does not generate teams, groups, matchups or schedules.

Binding policy: [`TEAM_TOURNAMENT_V6_OWNER_ARCHITECTURE_DECISION_LOCK.md`](./TEAM_TOURNAMENT_V6_OWNER_ARCHITECTURE_DECISION_LOCK.md)

---

## Module paths

| Path | Role |
|------|------|
| `src/features/team-tournament/canonical/teamTournamentCanonical.js` | Public setup canonical API |
| `src/features/team-tournament/canonical/teamTournamentCanonicalRules.js` | Normalization + domain sort rules |
| `src/features/team-tournament/canonical/teamTournamentSetupSnapshot.js` | Schema v7 snapshot builder |
| `src/features/team-tournament/canonical/teamTournamentMutationEnvelope.js` | Setup mutation envelope |
| `src/features/team-tournament/canonical/teamTournamentCanonicalDigest.js` | SHA-256 (browser SubtleCrypto + Node sync) |
| `src/features/team-tournament/canonical/teamTournamentCanonicalLegacy.js` | Frozen TT-1B legacy hash (shadow/idempotency) |
| `src/features/team-tournament/repositories/teamTournamentCanonical.js` | Compatibility shim |

---

## Canonical rules (summary)

- Object keys sorted lexicographically at every depth.
- Strings: trim + Unicode NFC.
- UUID strings: lowercase when valid UUID format.
- Timestamps: UTC ISO-8601 with milliseconds.
- Explicit `null` preserved; `undefined` omitted.
- Empty arrays/objects preserved.
- Ratings (`avgLevel`, etc.): 2 decimal places.
- Domain arrays sorted per locked contract (teams, disciplines, groups, matchups, …).
- Unsupported: functions, symbols, BigInt, cycles, non-finite numbers, invalid dates.

---

## Hash contract

| Hash | Input |
|------|--------|
| `engineInputHash` | Canonical engine input |
| `engineOutputHash` | Canonical generated payload |
| `snapshotHash` | Full canonical setup snapshot (schema v7) |
| `payloadHash` | Mutation envelope **excluding** `payloadHash` field |

Algorithm: **SHA-256** over UTF-8 canonical JSON (lowercase 64-char hex).

---

## Golden vector IDs

Fixture: `src/features/team-tournament/canonical/teamTournamentCanonicalVectors.fixture.json`

| ID | Intent |
|----|--------|
| `key-order-equivalence` | Different key order → same hash |
| `uuid-case` | UUID case normalization |
| `unicode-nfc` | Composed vs decomposed Unicode |
| `timestamp-utc` | Same instant, different representation |
| `rating-rounding` | 3.800 vs 3.8 |
| `numeric-zero` | Preserve zero |
| `teams-sort-by-id` | Team ordering |
| `disciplines-sort` | sortOrder + id |
| `group-teamids-dedupe-sort` | Dedupe + sort teamIds |
| `matchup-null-scheduled-last` | Null `scheduledAt` last |
| `meaningful-array-order` | Unregulated arrays remain hash-sensitive |
| `roster-member-change` | Snapshot hash changes on roster change |
| `engine-input-output-differ` | Input vs output hash differ |
| `payload-hash-self-exclusion` | `payloadHash` excludes itself |

Tests: `tests/tt-v6-p1_2-canonical-vectors.test.js`, `tests/tt-v6-p1_2-hash-parity.test.js`, `tests/tt-v6-p1_2-mutation-envelope.test.js`.

---

## Compatibility

- Legacy exports (`canonicalizeTeamTournamentValue`, `hashTeamTournamentCanonicalValue`) unchanged via shim.
- New setup exports available from the same shim path for gradual adoption.
- No runtime UI/repository wiring in S1-A.

---

## Browser / server parity

- Browser: `hashUtf8Sha256Async` via `crypto.subtle.digest`.
- Node tests/scripts: `hashUtf8Sha256Sync` via `node:crypto`.
- Server SQL canonical functions (S1-B) must match golden vectors before staging apply.
