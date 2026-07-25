# COMMS-ACT-04 — Gate D Post-Apply Certification

**Recorded:** 2026-07-25  
**Owner apply marker:** `SQL_EDITOR_APPLY_SUCCESS`  
**Target:** `qyewbxjsiiyufanzcjcq`  
**Production:** `expuvcohlcjzvrrauvud` blocked  
**Verdict:** `COMMS_ACT_04_GATE_D_PASS`

## Applied package

| Field | Value |
|-------|-------|
| Forward SQL | `docs/supabase-communication-comms-act-03-authorization-client-rls.sql` |
| SHA256 | `4e4a19947bde5db8bc78b135b353b4c694e37bc975f926525c1389d2349a42b7` |
| Bytes | `13173` |
| Scope | `CLUB_SELECT_ONLY` |
| Realtime changed | NO |
| Production touched | NO |

## Catalog (Management SQL, Staging only)

| Check | Expected | Observed | Pass |
|-------|----------|----------|:----:|
| Club SELECT policies | 6 | 6 | YES |
| Deny-all policies retained | 14 | 14 | YES |
| ACT-03 auth helpers | 6 + phase42 | present | YES |
| Authenticated SELECT grants | 6 | 6 | YES |
| Client write grants | 0 | 0 | YES |
| Realtime `communication_*` | 0 | 0 | YES |
| Immutable ownership triggers | ≥3 | 3 | YES |

## Anon probes

| Check | Result |
|-------|--------|
| 14 tables | 14/14 DENIED |
| RPCs | DENIED (`42501`) |

## Authenticated runtime matrix

Accounts (redacted): `pl***@staging.local` (Club A active), `ca***@staging.local` (Club B active), `qa***@staging.local` (removed Club A), `cl***@staging.local` (same-tenant non-member of A/B).

| Case | Pass |
|------|:----:|
| Club A member reads Club A conversation | YES |
| Club A member reads messages/participants/pins/reactions | YES |
| Club A member Club B deny | YES |
| Club B member reads Club B | YES |
| Club B member Club A deny | YES |
| Removed member Club A deny | YES |
| Same-tenant non-member deny A/B | YES |
| Direct / System / Community deny | YES |
| Authenticated INSERT deny | YES (`42501`) |
| Authenticated RPC deny | YES (`42501`) |
| Service-role trusted read | YES |
| Manager/owner structural equivalence | YES |

Script: `scripts/communication/comms-act-04-gate-d-certify.mjs`  
Result: `failed=[]`, `pass=true`

## Fixture cleanup

After Gate D PASS, marker fixtures deleted and verified **zero** remaining:

`COMMS_ACT_04_FIXTURE_CLEANUP_COMPLETE` (all marker counts = 0)

See `FIXTURE_CLEANUP_2026-07-25.md`.

## Stop conditions honored

- No Production touch
- No realtime enable
- No Direct/System/Community client SELECT open
- No client write grants
- No deploy
- No secrets in evidence

## Final Gate D posture

```
overall: COMMS_ACT_04_GATE_D_PASS
clientRls: CLUB_SELECT_ONLY
realtime: NOT_ENABLED
production: BLOCKED
fixtures: CLEANED_ZERO_MARKERS
```
