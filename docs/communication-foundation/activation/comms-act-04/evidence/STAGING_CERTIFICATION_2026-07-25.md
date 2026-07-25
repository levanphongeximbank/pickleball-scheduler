# COMMS-ACT-04 — Staging Certification (final)

**Verdict:** `COMMS_ACT_04_STAGING_CLUB_SELECT_CERTIFIED`  
**Date:** 2026-07-25  
**Staging:** `qyewbxjsiiyufanzcjcq`  
**Production:** `expuvcohlcjzvrrauvud` — **UNTOUCHED**

## Owner GO tokens honored

| Token | Purpose |
|-------|---------|
| `OWNER GO COMMS-ACT-04 STAGING CLUB_SELECT_ONLY` | Phase gates |
| `OWNER GO COMMS-ACT-04 STAGING TEMPORARY CLUB CERTIFICATION FIXTURES ONLY` | Temporary fixtures |
| `OWNER GO COMMS-ACT-04 APPLY CLUB_SELECT_ONLY TO STAGING` | SQL Editor apply |

## SQL / rollback binding

| Package | SHA256 | Bytes |
|---------|--------|------:|
| Forward `docs/supabase-communication-comms-act-03-authorization-client-rls.sql` | `4e4a19947bde5db8bc78b135b353b4c694e37bc975f926525c1389d2349a42b7` | 13173 |
| Rollback `docs/supabase-communication-comms-act-03-authorization-client-rls-rollback.sql` | `63056ec8ce8140bf06671a1bbf3e375d728047630aeb8bd06a9aefe32a016de5` | 8808 |

## Backup reference

`C:\Users\Le Phong\PICK_VN-Backups\supabase-staging\pickleball-scheduler-staging-qyewbxjsiiyufanzcjcq-20260725-101205`  
ZIP SHA256: `cddbad9fca12e331cbe25cbe4cc965b4e6aebc0d0a92def353bc7446a05a4bf4`  
(Not committed to git.)

## Gate summary

| Gate | Status |
|------|--------|
| A SQL readiness | PASS |
| B Backup | PASS |
| C Pre-apply live preflight | PASS |
| Fixtures | PASS → cleaned to 0 |
| D Post-apply certification | PASS |
| Final remote read-only | PASS |

## Authorization result matrix (Staging client)

| Capability | Result |
|------------|--------|
| Club conversation/message/participant/reaction/pin SELECT (active member) | ALLOW |
| Own Club read cursor SELECT | ALLOW (own participant only) |
| Cross-club SELECT | DENY |
| Removed/inactive member Club SELECT | DENY |
| Same-tenant non-member Club SELECT | DENY |
| Direct / System / Community client SELECT | DENY |
| Client INSERT/UPDATE/DELETE | DENY |
| RPC execute (anon/authenticated) | DENY |
| Realtime publication | DENY (0 rows) |

Manager/owner: structural equivalence with active member via `phase42_active_club_member_id` (status=active only).

## Explicit capability state

```
CLUB_SELECT_ONLY = ACTIVE_ON_STAGING
DIRECT/SYSTEM = TRUSTED_BACKEND_ONLY
CLUB_WRITES_ADMIN = TRUSTED_BACKEND_ONLY
COMMUNITY = BLOCKED_FAIL_CLOSED
REALTIME = BLOCKED_FAIL_CLOSED
PRODUCTION = UNTOUCHED
```

## Remaining blocked capabilities

- Direct / System client SELECT open
- Community client SELECT (membership helper absent)
- Club writes / participant admin / moderation / reports client access
- RPC client execute
- Realtime publication for `communication_*`
- Production apply
- App Production runtime client cutover (activation gate still fail-closed for Production)

## Rollback readiness

Rollback SQL package remains bound and data-preserving (deny-all restore; no DELETE FROM business data).  
Owner-only; not executed in ACT-04 closeout.

## Fixture lifecycle

- Seed evidence: `FIXTURE_SEED_2026-07-25.md`
- Cleanup evidence: `FIXTURE_CLEANUP_2026-07-25.md` (zero marker rows)

## Evidence index

| Artifact | Path |
|----------|------|
| Gate A | `GATE_A_SQL_READINESS_2026-07-25.md` |
| Gate B | `GATE_B_BACKUP_VERIFIED_2026-07-25.md` |
| Gate C | `GATE_C_LIVE_PREFLIGHT_2026-07-25.md` |
| Gate D | `GATE_D_POST_APPLY_2026-07-25.md` |
| Final remote | `FINAL_REMOTE_VERIFY_2026-07-25.md` |
| This certification | `STAGING_CERTIFICATION_2026-07-25.md` |

**Note:** ACT-04 is **not** declared CLOSED until post-merge verification.
