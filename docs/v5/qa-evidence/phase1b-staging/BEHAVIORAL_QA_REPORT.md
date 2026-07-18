# Phase 1B — Live Staging Behavioral QA Report

**Verdict:** PASS (61/61 live cases)  
**Staging:** `qyewbxjsiiyufanzcjcq`  
**Production:** `expuvcohlcjzvrrauvud` — **NOT USED**  
**Approved / applied commit:** `dbb968bc4c3321a32640b9ef93df61b87719a128`  
**Club:** `club-smoke-42i1` (CLB Smoke 42I1; name restored after QA)  
**Harness:** `node scripts/verify-phase1b-staging-live-qa.mjs`  
**Machine-readable:** `BEHAVIORAL_QA_REPORT.json` / `LIVE_QA_REPORT.json`

## Actors (role only — no passwords/tokens)

| Role | Notes |
|------|--------|
| Club Owner | Primary authorized actor |
| Club President | Same smoke fixture as owner identity on this club |
| SUPER_ADMIN | Staging superadmin account |
| Authorized tenant administrator | `tenant_owner` on club tenant |
| Ordinary tenant member | Non-owner tenant staff — DENY VP |
| Ordinary club member | Seeded PLAYER member — DENY VP |
| Vice President | Temporary assign target — DENY alone |
| Unrelated authenticated user | Nomember — DENY |
| Ephemeral member target | Fresh PLAYER for add/remove/restore |

## Matrices (summary)

### A. Club update
All PASS: authorized update, reload/canonical persistence, version increment, stale `VERSION_CONFLICT`, unauthorized unrelated DENY, `club.update` audit present.

### B. VP lifecycle
All PASS: assign 1→2, reject 3rd, reject president-as-VP, reject inactive, clear one, clear all (`p_member_user_id=null`), canonical reload empty, audits `club.assign_vice_president` / `club.clear_vice_president`.

### C. Authorization (assign / clear)

| Actor | Assign | Clear |
|-------|--------|-------|
| SUPER_ADMIN | ALLOW | ALLOW |
| Club Owner | ALLOW | ALLOW |
| Club President | ALLOW | ALLOW |
| Authorized tenant administrator | ALLOW | ALLOW |
| Ordinary tenant member | DENY | DENY |
| Ordinary club member | DENY | DENY |
| Unrelated authenticated user | DENY | DENY |
| Vice President alone | DENY | DENY |

### D. Member admin
All PASS: add → active row → Home/Members +1 → duplicate `ALREADY_MEMBER` → remove → count −1 → restore → counts restore → stale member-version conflict → unauthorized FORBIDDEN. Audits add/remove/restore present.  
Note: `p_expected_version` is **club_members.version**, not `clubs.version`.

### E. Notification recipients
V2: `club_list_members` active+user_id only; left/removed excluded; no duplicates; null user_id rows = 0.  
V1: source contract still has `getClubMembers` / `loadPlayersForClub` under flag OFF.

### F. Parity
Canonical `active_member_count` matches `club_list_members` active list; VP/president fields present; version present. (Browser UI My Club / Org chart not screenshot-tested.)

## Local / CI regression
- Phase 1B + 45A.3C/4C1/4D1 + related club governance/membership/runtime contracts: **139/139 pass** (filtered CI manifest subset).
- Additional: `phase1b-audit-whitelist-preflight` **6/6**.

## Closure status

- Phase 1B Staging behavioral QA: **PASS**
- Owner-approved for closure
- PR #51 opened: `feat(club): complete Phase 1B V2 command and governance layer`
- Production not deployed (`expuvcohlcjzvrrauvud` untouched)

## Gaps / notes
1. No Playwright screenshots for My Club / Org chart / Governance panel UI.
2. Blob-only exclusion validated via SSOT + source contract (no injected blob-only fixture).
3. Seeded ephemeral PLAYER users remain in Auth (club membership soft-removed).
4. At the time of this behavioral run (commit `dbb968b`), `club_update` still allowed any `phase42_is_tenant_member`; unauthorized update was tested with an unrelated non-tenant user. Narrow `phase42_can_update_club` authz was applied afterward and verified separately (`CLUB_UPDATE_AUTHZ_GATE_REPORT.json`).

## Production
**Untouched / not deployed.**
