# COMMS-ACT-04 — Staging identity / data audit (post-fixture)

**Recorded:** 2026-07-25 (after temporary cert fixtures)  
**Target:** `qyewbxjsiiyufanzcjcq`  
**Fixtures created:** YES (`COMMS_ACT_04_CERT_FIXTURE_*`)  
**ACT-03 applied:** NO  
**Verdict:** `COMMS_ACT_04_IDENTITIES_READY` → overall `COMMS_ACT_04_READY_FOR_STAGING_CLUB_SELECT_APPLY`

## Conversation inventory

| Type | Present | Count note |
|------|:-------:|------------|
| Total conversations | YES | 5 (all marker fixtures) |
| Club | YES | 2 (`club-smoke-42i1`, `club-test-tt32-qa`) |
| Direct | YES | 1 |
| System | YES | 1 |
| Community | YES | 1 |

## Certification readiness

| Case | Ready |
|------|:----:|
| Active Club member reads correct Club scope | YES |
| Cross-Club deny | YES |
| Inactive/removed deny | YES |
| Same-tenant non-member deny | YES |
| Direct / System / Community deny | YES |
| Writes / RPC / realtime deny (catalog) | YES |
| Manager/owner distinct membership row | N/A — structural equivalence (see manager/owner evidence) |

## Exact previous blocker — cleared

Previously: zero Communication conversation rows.  
Now: minimal marker fixtures bound to existing active/removed members.

## Still not done

- Owner apply of ACT-03 Club SELECT SQL  
- Gate D post-apply certification  
- Fixture cleanup (required before ACT-04 close)
