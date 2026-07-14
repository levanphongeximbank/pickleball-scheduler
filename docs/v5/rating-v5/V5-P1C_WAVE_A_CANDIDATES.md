# V5-P1C — Wave A Candidate Validation (P1-C.2)

**Gate:** P1-C.2 — candidate validation only  
**Date:** 2026-07-14  
**Branch:** `feature/rating-v5-production-wave-a`  
**Production ref:** `expuvcohlcjzvrrauvud`  
**Pilot club:** `club-219e4a7cbd73437eb6271f02a53314c3`  
**Pilot tenant:** `venue-prod-main`  
**Mode:** read-only (`--dry-run` only; **no `--apply`**)

## Production safety snapshot

| Check | Value |
|-------|-------|
| `allow_v5_assessment` | `false` |
| Active enrollments | **0** |
| V2 `pick_vn_player_ratings` | **0** |
| Production writes this gate | **NONE** |

## SKILL BAND VALIDATION

**PASS — 5/5**

| Slot | `expected_skill_band` | Valid |
|------|----------------------|-------|
| WA-01 | `1.5-2.5` | PASS |
| WA-02 | `3.0-3.5` | PASS |
| WA-03 | `3.0-3.5` | PASS |
| WA-04 | `3.0-3.5` | PASS |
| WA-05 | `1.5-2.5` | PASS |

Allowlist: `1.5-2.5` | `3.0-3.5` | `4.0-4.5` (ASCII hyphen only).

**Note:** On re-read, WA-01 initially still had en-dash `1.5–2.5` (`U+2013`). Normalized to ASCII `1.5-2.5` before dry-run so it matches owner intent / allowlist.

## Owner input CSV

File: `docs/v5/rating-v5/V5-P1C_WAVE_A_CANDIDATE_INPUT.csv`

1. **Column shift:** rows include an extra `CLB ACCC` field after skill band. Parser still reads `email` and `expected_skill_band` correctly; club checks use fixed pilot `club_id`.
2. Skill bands are now allowlist-valid (ASCII hyphens).

## Dry-run command

```bash
node scripts/prepare-v5p1c-wave-a-player-links.mjs --dry-run
```

**Re-run 2026-07-14T00:02:54Z:** **5/5** → `NEEDS_PLAYER_LINK`

Evidence: `docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a/2026-07-14T00-02-54-496Z/DISCOVERY_REPORT.json`  
Latest pointer: `docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a/LATEST_DISCOVERY_REPORT.json`

## Candidate matrix

| Slot | Email | Auth | Profile | Player ID | Club membership | Skill band | Result |
|------|-------|------|---------|-----------|-----------------|------------|--------|
| WA-01 | `tudotaichinhtuoi29@gmail.com` | yes | yes | **null** | active | `1.5-2.5` ✓ | **NEEDS_PLAYER_LINK** |
| WA-02 | `hoangmanhluong2405@gmail.com` | yes | yes | **null** | active | `3.0-3.5` ✓ | **NEEDS_PLAYER_LINK** |
| WA-03 | `lephong.banker@gmail.com` | yes | yes | **null** | active | `3.0-3.5` ✓ | **NEEDS_PLAYER_LINK** |
| WA-04 | `gionam76@gmail.com` | yes | yes | **null** | active | `3.0-3.5` ✓ | **NEEDS_PLAYER_LINK** |
| WA-05 | `huonganna120193@gmail.com` | yes | yes | **null** | active | `1.5-2.5` ✓ | **NEEDS_PLAYER_LINK** |

### Per-person summary

| Slot | Primary result | Auth / Profile | Club | Player link | Proposed `player_id` |
|------|----------------|----------------|------|-------------|----------------------|
| WA-01 Lương Hữu Kiên | **NEEDS_PLAYER_LINK** | PASS | PASS (active) | planned (dry-run) | `player-auth-c13392ab-fc7e-483a-9b31-ba08d94a69a9` |
| WA-02 Hoàng Mạnh Lương | **NEEDS_PLAYER_LINK** | PASS | PASS (active) | planned (dry-run) | `player-auth-6e77321e-1182-4174-a08a-3ee2d1833c7c` |
| WA-03 Lê Văn Phong | **NEEDS_PLAYER_LINK** | PASS | PASS (active) | planned (dry-run) | `player-auth-42c8ad99-3afd-4122-bf36-de1f6f9a302f` |
| WA-04 Đình Phong | **NEEDS_PLAYER_LINK** | PASS | PASS (active) | planned (dry-run) | `player-auth-6ff822c6-c1b6-4ce0-9e20-61f7afc74a88` |
| WA-05 Nguyễn Thị Hương | **NEEDS_PLAYER_LINK** | PASS | PASS (active) | planned (dry-run) | `player-auth-f776d627-a9f2-4c0c-8d81-bda239cc923b` |

**INVALID:** 0  
**NEEDS_OWNER_SKILL_BAND:** 0  
**NEEDS_CLUB_MEMBERSHIP:** 0  
**NEEDS_PLAYER_LINK:** **5 / 5**  
**READY:** 0 / 5 (expected until links applied)

## Duplicates

| Check | Count |
|-------|-------|
| Duplicate email in CSV | **0** |
| Duplicate `profiles.player_id` among candidates | **0** (all null) |

## Link plan (dry-run only — not applied)

For each candidate, plan is:

- `UPDATE profiles.player_id` **only if null** → `player-auth-<auth_user_id>`
- Duplicate guard: skip if another profile already owns that `player_id`
- Note: `club_data_v3` empty for pilot club — club roster sync may need a separate owner step later

## What remains for owner

1. Optional: remove stray `CLB ACCC` column so CSV headers align with values.
2. Separate owner GO for `--apply` player links: `PRODUCTION_P1C_PLAYER_LINK_GO=YES` (not this gate).
3. After links applied and readiness re-checked → separate enroll GO (later).
4. Do **not** enable `allow_v5_assessment` until enroll GO.

## Explicit non-actions (this gate)

- No enroll  
- No `--apply` / player-link write  
- No Edge / frontend deploy  
- No `allow_v5_assessment` / feature flag change  

---

## Final status

```text
SKILL BAND VALIDATION: PASS (5/5)
NEEDS_PLAYER_LINK: 5/5
DUPLICATES: 0
CLUB MEMBERSHIP ACTIVE: 5/5
PRODUCTION CHANGED: NO
ENROLLMENTS: 0
READY FOR OWNER ENROLL REVIEW: NO
READY TO ENROLL: NO
```

**Next gate:** owner GO for player-link `--apply` only (still no enroll / no flag).
