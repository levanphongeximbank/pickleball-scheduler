# V5-P1C.4 — Wave A Player Link Apply Results

**Gate:** P1-C.4 — APPLY PLAYER LINKS ONLY  
**Date:** 2026-07-14  
**Owner GO:** `PRODUCTION_P1C_PLAYER_LINK_GO=YES`  
**Command:** `node scripts/prepare-v5p1c-wave-a-player-links.mjs --apply`  
**Production project:** `expuvcohlcjzvrrauvud`  
**Approved plan:** `docs/v5/rating-v5/PLAYER_LINK_PLAN.md`  
**Approved evidence:** `docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a/2026-07-14T00-18-29-545Z/PLAYER_LINK_PLAN.json`

## Scope executed

Update `profiles.player_id` for exactly the five approved Wave A users whose `player_id` was `NULL`.

**Not done:** auth users · club membership · enroll · `allow_v5_assessment` · Vercel flags · deploy · Rating V2

## Pre-apply safeguards

| Check | Result |
|-------|--------|
| CSV re-read from disk | PASS (5 valid skill bands) |
| `PLAYER_LINK_PLAN` re-read from disk | PASS |
| Production URL | `https://expuvcohlcjzvrrauvud.supabase.co` |
| All 5 `player_id` still NULL | PASS |
| Proposed IDs unique | PASS (5/5) |
| Club memberships active | PASS (5/5) |
| `allow_v5_assessment` | `false` |
| Active enrollments | `0` |
| V2 `pick_vn_player_ratings` | `0` |
| Pre-apply snapshot | `docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a/2026-07-14T00-27-23-553Z-pre-apply/PRE_APPLY_SNAPSHOT.json` |

## Apply run

| Item | Value |
|------|-------|
| Apply evidence | `docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a/2026-07-14T00-27-33-565Z/DISCOVERY_REPORT.json` |
| Mode | `apply` |
| `apply_result.applied` | **5 / 5 true** |

| Slot | Email | profiles.id | player_id after apply |
|------|-------|-------------|------------------------|
| WA-01 | tudotaichinhtuoi29@gmail.com | `c13392ab-fc7e-483a-9b31-ba08d94a69a9` | `player-auth-c13392ab-fc7e-483a-9b31-ba08d94a69a9` |
| WA-02 | hoangmanhluong2405@gmail.com | `6e77321e-1182-4174-a08a-3ee2d1833c7c` | `player-auth-6e77321e-1182-4174-a08a-3ee2d1833c7c` |
| WA-03 | lephong.banker@gmail.com | `42c8ad99-3afd-4122-bf36-de1f6f9a302f` | `player-auth-42c8ad99-3afd-4122-bf36-de1f6f9a302f` |
| WA-04 | gionam76@gmail.com | `6ff822c6-c1b6-4ce0-9e20-61f7afc74a88` | `player-auth-6ff822c6-c1b6-4ce0-9e20-61f7afc74a88` |
| WA-05 | huonganna120193@gmail.com | `f776d627-a9f2-4c0c-8d81-bda239cc923b` | `player-auth-f776d627-a9f2-4c0c-8d81-bda239cc923b` |

## Post-apply verification

Evidence: `docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a/2026-07-14T00-28-28-581Z-post-apply/POST_APPLY_VERIFY.json`

| Check | Result |
|-------|--------|
| 5/5 `player_id` equals approved proposed IDs | **PASS** |
| Duplicate `player_id` values among Wave A | **0** |
| Club memberships remain active | **PASS** |
| Active enrollments | **0** |
| `allow_v5_assessment` | **false** |
| V2 rows | **0** (unchanged) |
| Production project identity | `expuvcohlcjzvrrauvud` confirmed |

## Idempotent retry

Second run (`2026-07-14T00-28-46-661Z`):

| Check | Result |
|-------|--------|
| Classification | **5/5 READY** |
| `apply_result` | **null** for all 5 (no UPDATE attempted — already linked) |
| `profiles.updated_at` | unchanged vs first apply timestamps (`00:27:36`–`00:27:41Z`) |
| Idempotency | **PASS** |

## Explicit non-actions remaining

- No enroll  
- No `allow_v5_assessment` enable  
- No Wave A activation  
- No deploy / flag changes  

---

## Final verdict

```text
PLAYER LINKS APPLIED: PASS
PROFILES UPDATED: 5 / expected 5
IDEMPOTENCY: PASS
DUPLICATES: 0 / 0
CLUB MEMBERSHIP UNCHANGED: PASS
ENROLLMENTS: 0
ALLOW_V5_ASSESSMENT: false
V2 ISOLATION: PASS
PRODUCTION CHANGED: YES — profiles.player_id only
READY FOR OWNER ENROLL REVIEW: YES
READY TO ENROLL: NO
READY TO ACTIVATE WAVE A: NO
```

**Stop after P1-C.4 for owner review.**
