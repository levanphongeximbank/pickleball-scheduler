# COMMS-ACT-04 — Staging Client RLS Apply & Certification

**Phase:** COMMS-ACT-04  
**Owner GO (gates):** `OWNER GO COMMS-ACT-04 STAGING CLUB_SELECT_ONLY`  
**Owner GO (fixtures):** `OWNER GO COMMS-ACT-04 STAGING TEMPORARY CLUB CERTIFICATION FIXTURES ONLY`  
**Owner GO (apply):** `OWNER GO COMMS-ACT-04 APPLY CLUB_SELECT_ONLY TO STAGING`  
**Capability scope:** `CLUB_SELECT_ONLY`  
**Staging target:** `qyewbxjsiiyufanzcjcq`  
**Production block:** `expuvcohlcjzvrrauvud`

## Absolute scope

Applied **only** the canonical ACT-03 Club SELECT Client RLS package on Staging.

Did not open: Direct/System/Community client access; Club INSERT/UPDATE/DELETE; Club participant/moderation admin; realtime publication; Production.

## Canonical SQL (unchanged from ACT-03)

Semantic SQL content is identical to ACT-03. Binding distinguishes Windows apply raw (CRLF, historical Owner apply) vs repository canonical LF (CI):

```
WINDOWS_APPLY_RAW_SHA256=4e4a19947bde5db8bc78b135b353b4c694e37bc975f926525c1389d2349a42b7
WINDOWS_APPLY_RAW_BYTES=13173
REPOSITORY_CANONICAL_LF_SHA256=90b3ff7af7070b6709349cefd570d61f258449f3dc9d3908658b0df0acc65f26
REPOSITORY_CANONICAL_LF_BYTES=12870
EOL_EQUIVALENCE_VERIFIED=PASS
SQL_SEMANTIC_DRIFT=NO
```

| Package | Path | Representation | SHA256 | Bytes |
|---------|------|----------------|--------|------:|
| Forward | `docs/supabase-communication-comms-act-03-authorization-client-rls.sql` | Windows apply raw | `4e4a19947bde5db8bc78b135b353b4c694e37bc975f926525c1389d2349a42b7` | 13173 |
| Forward | same | Repository canonical LF | `90b3ff7af7070b6709349cefd570d61f258449f3dc9d3908658b0df0acc65f26` | 12870 |
| Rollback | `docs/supabase-communication-comms-act-03-authorization-client-rls-rollback.sql` | Windows apply raw | `63056ec8ce8140bf06671a1bbf3e375d728047630aeb8bd06a9aefe32a016de5` | 8808 |
| Rollback | same | Repository canonical LF | `3de26ec8301d5b53bca350a5dde8f69e82ae90cd230bb2f04962f2cd9737dcc9` | 8660 |

## Gate status (live)

| Gate | Status |
|------|--------|
| A — Fresh-main + SQL readiness | **PASS** |
| B — Fresh Staging backup | **PASS** (`…20260725-101205`) |
| C — Live preflight (pre-apply) | **PASS** |
| Certification fixtures | **PASS** → cleaned after Gate D |
| D — Post-apply certification | **PASS** |
| Fixture cleanup | **PASS** (zero marker rows) |
| Final remote read-only | **PASS** |

## Current verdict

`COMMS_ACT_04_STAGING_CLUB_SELECT_CERTIFIED`

```
CLUB_SELECT_ONLY = ACTIVE_ON_STAGING
DIRECT/SYSTEM = TRUSTED_BACKEND_ONLY
CLUB_WRITES_ADMIN = TRUSTED_BACKEND_ONLY
COMMUNITY = BLOCKED_FAIL_CLOSED
REALTIME = BLOCKED_FAIL_CLOSED
PRODUCTION = UNTOUCHED
```

Not declared CLOSED until post-merge verification.

## Evidence

- `evidence/STAGING_CERTIFICATION_2026-07-25.md` (final certification)
- `evidence/FINAL_REMOTE_VERIFY_2026-07-25.md`
- `evidence/GATE_A_SQL_READINESS_2026-07-25.md`
- `evidence/GATE_B_BACKUP_VERIFIED_2026-07-25.md`
- `evidence/GATE_C_LIVE_PREFLIGHT_2026-07-25.md`
- `evidence/GATE_D_POST_APPLY_2026-07-25.md`
- `evidence/FIXTURE_SEED_2026-07-25.md`
- `evidence/FIXTURE_CLEANUP_2026-07-25.md`
- `evidence/MANAGER_OWNER_PREDICATE_EQUIVALENCE_2026-07-25.md`
- `evidence/OWNER_APPLY_ACTION_2026-07-25.md`
- Fixture SQL: `sql/COMMS_ACT_04_CERT_FIXTURES_STAGING.sql`
- Cleanup SQL: `sql/COMMS_ACT_04_CERT_FIXTURES_STAGING_CLEANUP.sql`

## Hard rules (retained)

- Production blocked
- Realtime not enabled
- No client writes
- package.json / package-lock.json unchanged
