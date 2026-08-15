# 07 — Conformance and architecture lock

## Conformance

`runCompetitionAdapterConformance(adapter, definition, options)`

Checks for each of the 14 contracts:

- correct ID
- version `1.0.0`
- `locked=true`
- required methods present
- QUERY/COMMAND/EVENT declared
- forbidden authority keys/methods fail closed
- malformed context fail closed
- cross-tenant fail closed
- canonical identity (email/phone rejected)
- immutable metadata
- `NOT_CONFIGURED` does not empty-succeed

Registry checks (separate tests):

- duplicate catalog registration rejected
- duplicate implementation registration rejected
- catalog/registry frozen after construction
- version mismatch fail closed

Compatibility: existing Identity, Participant, Membership, and Rating adapters remain callable unchanged.

Referee regression: `competition.referee.adapter.v1` / `1.0.0` + reference conformance.

Court regression: `Competition Court Adapter Contract` version `1` on main. No PR #432 branch dependency.

## Architecture lock

Tests: `tests/competition-engine-canonical-adapters-14-architecture-lock.test.js`

Protects:

- A. the 14 contract IDs
- B. V1 `1.0.0`
- C. `locked=true`
- D. no Competition Core engine keys inside adapters
- E. no second canonical implementation declared in this workstream
- F. competition mode modules must not embed alternate owned contract IDs
- G. new contract files must not import `clubStorage` / supabase client
- H. Court/Referee protected files are not in this branch diff

CI: both new test files are registered in `scripts/ci/unit-test-files.json`.
This delta does not touch E2E-07-owned paths, so the CORE-08 registry-addition special case is not used to weaken allowlists.
