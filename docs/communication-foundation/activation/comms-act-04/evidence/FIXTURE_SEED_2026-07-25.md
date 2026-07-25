# COMMS-ACT-04 — Temporary Club certification fixtures

**Recorded:** 2026-07-25  
**Owner GO:** `OWNER GO COMMS-ACT-04 STAGING TEMPORARY CLUB CERTIFICATION FIXTURES ONLY`  
**Target:** `qyewbxjsiiyufanzcjcq`  
**Production:** `expuvcohlcjzvrrauvud` blocked  
**Verdict:** `COMMS_ACT_04_READY_FOR_STAGING_CLUB_SELECT_APPLY`

## Safety gates before insert

| Check | Result |
|-------|--------|
| Backup `…20260725-101205` present | YES |
| Manifest re-hash | PASS |
| ZIP SHA256 | `cddbad9fca12e331cbe25cbe4cc965b4e6aebc0d0a92def353bc7446a05a4bf4` (match Gate B) |
| Marker rows in backup dump | 0 |
| Pre-insert Communication totals | all 0 |
| Auth users created | NO |
| `club_members` mutated | NO |
| ACT-03 RLS applied | NO |
| Realtime changed | NO |
| Production touched | NO |

## Bindings (existing Staging only)

| Role | Binding |
|------|---------|
| Club A | `club-smoke-42i1` / tenant `venue-staging-a` |
| Club B | `club-test-tt32-qa` / tenant `venue-staging-a` |
| Active A | existing `club_members.status=active` (user prefix `be4239cf`) |
| Active B | existing active member distinct from A (prefix `b0fc05c7`) |
| Removed A | existing `status=removed` on Club A (prefix `63079e58`) |
| Same-tenant non-member | active elsewhere under `venue-staging-a` (prefix `13e0968b`) |

Marker prefix: `COMMS_ACT_04_CERT_FIXTURE_`

## Rows inserted (Communication tables only)

| Table | Marker count | Total after (= marker) |
|-------|-------------:|-----------------------:|
| `communication_conversations` | 5 | 5 |
| `communication_conversation_participants` | 2 | 2 |
| `communication_message_position_counters` | 2 | 2 |
| `communication_messages` | 2 | 2 |
| `communication_message_reactions` | 2 | 2 |
| `communication_pinned_messages` | 2 | 2 |
| `communication_read_cursors` | 2 | 2 |

Conversation types: Club A, Club B, Direct, System, Community.

## Manager / owner case

`public.phase42_active_club_member_id(text)` predicate:

- `club_members.club_id = p_club_id`
- `club_members.user_id = auth.uid()`
- `club_members.status = 'active'`

**Not role-aware / not membership_type-aware.**  
ACT-03 Club SELECT wrappers call this helper only.

Therefore manager/owner certification uses:

1. Structural policy equivalence with regular active member  
2. SQL dependency evidence (`PHASE_42C_RLS_RPC.sql` + ACT-03 helpers)  
3. Active-member runtime test after Owner apply  

No `club_members` role/membership_type mutation performed.  
Staging `membership_type` remains `regular`; governance roles exist separately (`club_owner` / `president`) and are **not** required for Club SELECT.

## Packages

| Item | Path |
|------|------|
| Fixture SQL | `sql/COMMS_ACT_04_CERT_FIXTURES_STAGING.sql` |
| Cleanup SQL | `sql/COMMS_ACT_04_CERT_FIXTURES_STAGING_CLEANUP.sql` |
| Script | `scripts/communication/comms-act-04-cert-fixtures.mjs` |

## Post-fixture certification readiness

| Case | Ready |
|------|:----:|
| Active A reads Club A scope | YES |
| Active B reads Club B scope | YES |
| Cross-Club deny | YES |
| Inactive/removed deny | YES |
| Same-tenant non-member deny | YES |
| Direct / System / Community deny (rows present) | YES |
| Writes / RPC / realtime still denied (catalog unchanged) | YES |

Live re-checks:

- Identity audit: `COMMS_ACT_04_IDENTITIES_READY`
- Catalog preflight (backup schema + anon probes): `COMMS_ACT_04_LIVE_PREFLIGHT_PASS`
- Club SELECT policies still **0** (ACT-03 not applied)

## Cleanup obligation

After post-apply Gate D certification completes, run cleanup and verify **zero** marker rows before ACT-04 close:

```powershell
node scripts/communication/comms-act-04-cert-fixtures.mjs --cleanup-fixtures
```

Or Owner SQL Editor: `sql/COMMS_ACT_04_CERT_FIXTURES_STAGING_CLEANUP.sql`

## Explicit non-actions

- ACT-03 Client RLS **not** applied  
- SQL **not** on clipboard for apply  
- No deploy / no Production  
