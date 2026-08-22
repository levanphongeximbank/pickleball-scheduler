# team-tournament-production-alignment-01

**PACKAGE AUTHORING ONLY. Do NOT apply to Staging or Production without a separate Owner GO.**

This package does **not** replay the historical #417/#418 package chain, does **not** copy Staging rows, and does **not** backfill the existing ~82 Production Team Tournament headers.

## Why

Production (`expuvcohlcjzvrrauvud`) failed Owner browser create at `/tournament/create` because current-main frontend requires `public.team_tournament_create(...)` and Production does not have it.

Read-only audit classification: **C**

Required lifecycle objects: **74**  
Production prestate: **PRESENT=41 / MISSING=33 / DRIFTED=7**

PR **#423** referee foundation is already LIVE and is preserved. This package does **not** apply `team-tournament-canonical-referee-lifecycle-01`.

## Contract

- `EXISTING_TOURNAMENT_BACKFILL_REQUIRED=NO`
- `EXISTING_BUSINESS_DATA_MUTATION_REQUIRED=NO`
- Fresh Owner test tournament uses the new canonical create path after apply
- `captainAccessEnabled` is a settings JSONB key; missing/null/false → closed. **No** backfill of the existing 82
- Player identity: `auth.uid()` → `athletes.user_id` → `athletes.id`
- Captain remains temporary tournament/team authority. **No** CAPTAIN global account role
- Historical packages are semantic sources only. APPLY does not `\i` or EXECUTE them

## Apply order (Owner GO only, later)

1. `01_PRECHECK.sql`
2. `02_APPLY.sql`
3. `03_VERIFY.sql`

Rollback: `04_ROLLBACK.sql` restores exact pre-alignment bodies from `team_tournament_alignment_01_prestate`. Refuses if any `canonical_tournaments.mode='team_tournament'` rows exist.

## Separate Owner GOs still required

1. Staging alignment rehearsal
2. Production apply
3. Later: canonical referee continuation (`team-tournament-canonical-referee-lifecycle-01`)

## Package LF SHA256 lock

Filled after authoring freeze.

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `99312a92810834b45c467337fdb664451d641c7f97b05fcaa3dfa7483d72b4f5` |
| `02_APPLY.sql` | `e7d5f4e9326a1768bdde6c05e0a415c80d253d23558bf38250c3efe6fff7278d` |
| `03_VERIFY.sql` | `4d858d7c6af73fc1e837a384ce2034f42b4c32ccbfe3c21e67ec5398d73f2221` |
| `04_ROLLBACK.sql` | `7819cbfb1ed63e8d2ced2aa8595c4da667e3bc51c7d4e4ad110ead38b973c7d7` |
