# COMMS-ACT-04 — Staging identity / data audit (read-only)

**Recorded:** 2026-07-25  
**Target:** `qyewbxjsiiyufanzcjcq`  
**Mutation count:** `0`  
**Fixtures created:** NO  
**Verdict:** `COMMS_ACT_04_BLOCKED_TEST_IDENTITIES`

## Sources

- Live Staging service-role SELECT inventory (no writes)
- Cross-check with ACT-04 `data.sql` dump aggregates (counts only; no row dumps in evidence)

Script: `scripts/communication/comms-act-04-identity-audit.mjs`

## Available Staging assets

| Asset | Count / note |
|-------|--------------|
| `profiles` | ~87 |
| `auth.users` `@staging.local` | 80 (dump aggregate) |
| `clubs` | 22 (19 active / 3 inactive) |
| `club_members` | 86 (79 `active` / 7 `removed`) |
| `club_members.membership_type` | all sampled `regular` (`club_managers` rows = 0) |
| Distinct clubs with members | 22 |
| Distinct tenants with members | 2 |
| `communication_conversations` | **0** |
| `communication_*` message/participant/reaction/pin/cursor rows | **0** |

## Positive certification readiness

| Case | Ready? | Blocker |
|------|:------:|---------|
| Active Club member reads correct Club conversation scope | **NO** | No Club conversations exist |
| Club manager/owner reads correct Club scope | **NO** | No Club conversations; no non-regular membership_type / club_managers rows |

## Negative certification readiness

| Case | Ready? | Notes |
|------|:------:|-------|
| anon denied | YES | Live Gate C: 14/14 PRESENT_DENIED |
| authenticated unrelated user denied | YES | Non-member / unrelated profiles exist |
| same-tenant non-member denied | PARTIAL | Identities exist; still needs Club conversation rows to prove scoped deny vs empty allow |
| inactive/removed Club member denied | PARTIAL | 7 `removed` members exist; needs Club conversation in that club |
| cross-Club user denied | PARTIAL | 22 clubs; needs Club conversation rows |
| cross-tenant user denied | PARTIAL | 2 tenants; needs Club conversation rows |
| Direct conversation denied | PARTIAL | Policy denies Direct; **no Direct rows** to assert row-level deny against data |
| System conversation denied | PARTIAL | No System rows |
| Community conversation denied | PARTIAL | No Community rows |
| all client writes denied | YES | No write grants; deny-all still present |
| participant forgery / sender spoofing denied | YES | No INSERT/UPDATE grants + immutable triggers after apply |
| RPC execution denied | YES | Gate C anon RPC PRESENT_DENIED |
| realtime remains disabled | YES | communication_* publication rows = 0 |

## Exact blocker

**Positive Club SELECT certification cannot be completed** because Staging has:

1. **Zero** `communication_conversations` rows (Club/Direct/System/Community all empty).
2. Therefore no Club conversation scope for an active member to read.

Existing Club membership + `@staging.local` identities are sufficient **after** minimal Club conversation fixtures exist.

## Not done (requires separate Owner authorization)

- Create auth users
- Seed durable Club conversations / participants / messages
- Any write to Staging business tables

## Owner options to unblock

1. Authorize a **minimal Staging-only Communication Club fixture seed** (1–2 Club conversations bound to existing active `club_members`, plus optional Direct/Community rows for negative cases), **or**
2. Point Agent at an already-approved fixture package / identities to reuse.

Until then: **do not apply** Club SELECT SQL.
