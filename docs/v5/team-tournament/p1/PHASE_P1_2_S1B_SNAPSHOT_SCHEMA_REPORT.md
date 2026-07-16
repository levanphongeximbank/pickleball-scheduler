# P1.2 S1-B — Setup Snapshot Schema Report

**Phase:** P1.2 S1-B (authoring only)  
**Branch:** `feature/team-tournament-v6`  
**Prerequisite commit:** `6f11807` — S1-A canonical JSON + hash foundation  
**SQL artifact:** `PHASE_P1_2_S1B_SNAPSHOT_SCHEMA.sql`  
**Apply status:** NOT applied to Staging or Production

---

## STOP boundary

This phase authors SQL and contract tests only.

| In scope | Out of scope |
|----------|--------------|
| `team_tournament_setup_snapshots` DDL | Staging/Production apply |
| Hash format helpers | Full S1-A canonical normalization in SQL |
| Immutability + RLS | `get_setup` v7 (S1-C) |
| `team_tournament_create_setup_snapshot` helper | Domain RPCs (Discipline, Groups, …) |
| Rollback instructions | Runtime/UI wiring (S1-D+) |
| Static contract tests | DB integration tests |

**This module performs snapshot persistence schema and hash verification helpers only. It does not generate teams, groups, matchups, or schedules.**

---

## 1. Audited existing schema references

| Object | Source | Convention used in S1-B |
|--------|--------|-------------------------|
| `public.venues(id)` | `docs/supabase-rbac.sql` | `tenant_id text` FK target |
| `public.team_tournaments(id)` | `docs/v5/PHASE_23C_TEAM_TOURNAMENT_CLOUD_SYNC.sql` | `team_tournament_id uuid` FK |
| `public.team_tournaments.version` | `docs/v5/PHASE_TT1B_TEAM_TOURNAMENT_SSOT.sql` | maps to `tournament_version` on snapshot |
| `auth.users(id)` | Supabase auth | `actor_id` ON DELETE SET NULL |
| `team_tournament_command_log` | `PHASE_TT1B` | idempotency key alignment |
| `team_tournament_begin_command` | `PHASE_TT1B` L237 | pre-transaction replay |
| `team_tournament_finish_command` | `PHASE_TT1B` L285 | stores `result_json` metadata |
| `team_tournament_assert_tenant` | `PHASE_23C` L410 | tenant guard in helper |
| `team_tournament_can_manage` | `PHASE_23C` L385 | RLS SELECT policy |
| `team_tournament_payload_hash` | `PHASE_TT1B` L228 | legacy envelope hash (unchanged) |
| S1-A `SETUP_COMMAND_REGISTRY` | `teamTournamentCanonicalRules.js` | mirrored in `command_name` CHECK |

---

## 2. Table contract — `team_tournament_setup_snapshots`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid PK` | `gen_random_uuid()` |
| `tenant_id` | `text NOT NULL` | FK → `venues(id)` |
| `tournament_id` | `text NOT NULL` | logical tournament key |
| `team_tournament_id` | `uuid NOT NULL` | FK → `team_tournaments(id)` |
| `tournament_version` | `integer NOT NULL` | `>= 1`; one snapshot per version |
| `schema_version` | `integer NOT NULL DEFAULT 7` | `>= 7` |
| `command_name` | `text NOT NULL` | locked 20-command registry |
| `idempotency_key` | `text NOT NULL` | length 1–128 |
| `payload_hash` | `text NOT NULL` | lowercase SHA-256 hex |
| `engine_input_hash` | `text NOT NULL` | lowercase SHA-256 hex |
| `engine_output_hash` | `text NOT NULL` | lowercase SHA-256 hex |
| `snapshot_hash` | `text NOT NULL` | lowercase SHA-256 hex |
| `engine_version` | `text NOT NULL` | e.g. `team-tournament-engines@1.0.0` |
| `rules_version` | `text NULL` | required for pairing commands at helper level |
| `snapshot_json` | `jsonb NOT NULL` | full canonical setup snapshot |
| `normalized_read_hash` | `text NOT NULL` | read-model fingerprint (stub in S1-B) |
| `actor_id` | `uuid NULL` | FK → `auth.users` SET NULL |
| `retention_class` | `text DEFAULT 'active'` | `active` / `archived` / `compacted` |
| `archived_at` | `timestamptz NULL` | set by maintenance pathway |
| `legal_hold` | `boolean NOT NULL DEFAULT false` | blocks archive |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | append-only timestamp |

---

## 3. Constraints and indexes

### Unique constraints

1. `(tenant_id, tournament_id, tournament_version)` — one snapshot per accepted mutation version  
2. `(tenant_id, tournament_id, command_name, idempotency_key)` — idempotent replay key

### Check constraints

- `tournament_version >= 1`
- `schema_version >= 7`
- all hash columns: `^[0-9a-f]{64}$`
- `idempotency_key` length 1–128
- `command_name` in locked registry (20 values)
- `retention_class` in (`active`, `archived`, `compacted`)

### Indexes (non-redundant)

| Index | Purpose |
|-------|---------|
| `idx_..._latest` | latest snapshot by tournament/version DESC |
| `idx_..._timeline` | audit timeline by `created_at DESC` |
| `idx_..._command_history` | command audit trail |
| `idx_..._retention` | archived/compacted maintenance |
| `idx_..._team_tournament` | lookup by `team_tournament_id` |

Idempotency lookup uses the unique index on `(tenant_id, tournament_id, command_name, idempotency_key)`.

---

## 4. RLS and immutability

### RLS

- `ENABLE ROW LEVEL SECURITY`
- `REVOKE ALL` from `anon`, `authenticated`
- `GRANT SELECT` to `authenticated`
- **SELECT policy:** `is_super_admin()` OR (`tenant_id = profiles.venue_id` AND `team_tournament_can_manage()`)
- **No INSERT/UPDATE/DELETE policies** for `authenticated`

### Immutability

- `BEFORE UPDATE OR DELETE` trigger raises `SNAPSHOT_IMMUTABLE`
- Platform maintenance sets `team_tournament.snapshot_maintenance = allow` and may update only `retention_class`, `archived_at`, `legal_hold`
- `team_tournament_setup_snapshot_archive` — `SECURITY DEFINER`, super-admin only, respects `legal_hold`
- `DELETE` always forbidden

---

## 5. Server hash helper design

| Function | Role | S1-A parity |
|----------|------|-------------|
| `team_tournament_is_sha256_hex(text)` | format validation | **YES** |
| `team_tournament_sha256_utf8(text)` | SHA-256 over UTF-8 | **YES** when input is exact canonical string |
| `team_tournament_verify_canonical_text_hash(text, text)` | verify submitted hash | **YES** with client canonical text |
| `team_tournament_normalized_read_hash(jsonb)` | read-model stub | **NO** — `jsonb::text` ≠ S1-A canonical |

### Hash parity limitation (documented)

Full S1-A canonical normalization (recursive key sort without spaces, Unicode NFC, UUID lowercase, domain array ordering, rating rounding) is **not** implemented in SQL.

**Rationale:** PostgreSQL `jsonb::text` emits spaced key order (`{"a": 1}`) and does not apply S1-A domain rules. Re-implementing S1-A in PL/pgSQL would risk incompatible behavior.

**Verification strategy:**

1. Client canonicalizes per S1-A (`serializeCanonicalSetupSnapshot`)
2. Client computes `snapshot_hash` over canonical UTF-8
3. Server verifies via `team_tournament_verify_canonical_text_hash(p_snapshot_canonical_text, p_snapshot_hash)`
4. Golden vectors remain enforced in S1-A tests + future S1-E staging certification

**Verdict:** Not `BLOCKED BY HASH PARITY` for S1-B authoring — safe minimum helpers authored with explicit limitation. Full SQL↔JS structural parity deferred to S1-E integration tests.

---

## 6. Snapshot helper contract

### `team_tournament_create_setup_snapshot(...)`

**Security:** `SECURITY DEFINER`; **not granted** to `authenticated`

**Parameters:** tenant, tournament, team_tournament_id, tournament_version, schema_version, command_name, idempotency_key, payload_hash, engine_input_hash, engine_output_hash, snapshot_hash, **snapshot_canonical_text**, engine_version, rules_version, snapshot_json, normalized_read_hash, actor_id

**Responsibilities:**

- Assert tenant via `team_tournament_assert_tenant`
- Validate hash formats and pairing `rules_version`
- Verify `snapshot_hash` against canonical UTF-8 text
- Idempotent replay on `(tenant_id, tournament_id, command_name, idempotency_key)`
- Hash mismatch → `IDEMPOTENCY_KEY_REUSED`
- Version conflict → `SNAPSHOT_VERSION_CONFLICT`
- Insert exactly one immutable row
- **Does not** increment `team_tournaments.version`
- **Does not** write `team_tournament_command_log`
- **Does not** commit independently

**Return shape:**

```json
{
  "ok": true,
  "replay": false,
  "snapshotId": "uuid",
  "snapshotVersion": 2,
  "snapshotHash": "64-char-hex",
  "normalizedReadHash": "64-char-hex",
  "engineVersion": "team-tournament-engines@1.0.0",
  "rulesVersion": "optional",
  "engineInputHash": "64-char-hex",
  "engineOutputHash": "64-char-hex",
  "createdAt": "ISO-8601"
}
```

---

## 7. Command-log / idempotency integration

```
┌─────────────────────────────────────────────────────────────┐
│ Setup mutation transaction (future S1-D domain RPC)         │
├─────────────────────────────────────────────────────────────┤
│ 1. team_tournament_begin_command                            │
│    └─ replay? → return command_log.result_json (STOP)        │
│ 2. Domain writes + bump team_tournaments.version            │
│ 3. team_tournament_create_setup_snapshot                    │
│    └─ replay? → return existing snapshot metadata           │
│ 4. team_tournament_finish_command(result_json := metadata)  │
└─────────────────────────────────────────────────────────────┘
```

| Scenario | Behavior |
|----------|----------|
| Same idempotency key + same hashes | Replay; no second snapshot; `replay: true` |
| Same idempotency key + different hashes | `IDEMPOTENCY_KEY_REUSED` |
| New command | New `tournament_version`; one new snapshot row |
| Duplicate `tournament_version` | `SNAPSHOT_VERSION_CONFLICT` |

`team_tournament_command_log.result_json` stores the snapshot metadata returned by step 3/4.

---

## 8. Rollback plan (Staging reference)

### Safe pre-data rollback (table empty)

1. Drop `team_tournament_create_setup_snapshot`
2. Drop `team_tournament_setup_snapshot_archive`
3. Drop immutability trigger + guard function
4. Drop snapshot-specific hash stubs (`normalized_read_hash`)
5. Drop RLS policy
6. `DROP TABLE team_tournament_setup_snapshots`

Shared helpers (`team_tournament_sha256_utf8`, `team_tournament_is_sha256_hex`) may be retained if referenced by future patches.

### Rollback after snapshots exist

- **Irreversible** if `DROP TABLE` without backup — destroys immutable audit history
- Preferred: revoke execute on create helper; leave table for read-only audit
- Rows with `legal_hold = true` must not be archived

### Unrelated data

Rollback steps do **not** touch `team_tournaments`, disciplines, matchups, lineups, or command log rows from other phases.

---

## 9. Risks

| Risk | Mitigation |
|------|------------|
| SQL cannot reproduce S1-A golden vectors on raw `jsonb` | Verify via client canonical UTF-8 text parameter |
| `normalized_read_hash` stub uses `jsonb::text` | Replace in S1-C with get_setup v7 read projection |
| Maintenance trigger complexity | Super-admin-only archive; legal_hold guard |
| Duplicate version if RPC forgets begin_command | Unique constraint on `tournament_version` |

---

## 10. Golden vector IDs (S1-A reference)

For staging certification (S1-E), verify these S1-A vectors before trusting server hash helpers:

`key-order-equivalence`, `uuid-case`, `unicode-nfc`, `timestamp-utc`, `rating-rounding`, `numeric-zero`, `teams-sort-by-id`, `disciplines-sort`, `group-teamids-dedupe-sort`, `matchup-null-scheduled-last`, `meaningful-array-order`, `roster-member-change`, `engine-input-output-differ`, `payload-hash-self-exclusion`

See `docs/v5/team-tournament/P1_2_CANONICAL_VECTORS.md`.

---

## 11. Cross-references

- Owner lock: `docs/v5/team-tournament/TEAM_TOURNAMENT_V6_OWNER_ARCHITECTURE_DECISION_LOCK.md` §8
- S1-A vectors: `docs/v5/team-tournament/P1_2_CANONICAL_VECTORS.md`
- S1-A module: `src/features/team-tournament/canonical/`
