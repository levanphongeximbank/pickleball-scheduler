# Phase 1C — Staging Browser QA Report

- **Verdict:** PASS
- **Environment URL:** `http://127.0.0.1:5191`
- **Mode:** local-vite-staging-supabase (Staging ref `qyewbxjsiiyufanzcjcq`)
- **Flag:** `VITE_CLUB_STORAGE_V2=true` (primary); flag-OFF smoke also run
- **Club fixture:** `club-smoke-42i1`
- **Baseline commit:** `c00d97dea2151d08daef5e89d5bc55b20cf95709`
- **Harness:** `scripts/verify-phase1c-browser-qa-staging.mjs`
- **Production touched:** false (no Production SQL, deploy, push, or PR)

## Final verdict

**PASS** — all browser scenarios A–K recorded PASS. Security gate remains PASS on Staging. No implementation expansion; no SQL/authz changes in this evidence pass.

## Actor matrix

| Actor | Owner assign/clear UI | Direct RPC | Result |
|-------|----------------------|------------|--------|
| TENANT_OWNER / SUPER_ADMIN path | Allowed (assign/clear exercised) | ALLOW | PASS |
| tenant_staff | Mutation controls limited / not owner-assign capable | FORBIDDEN | PASS |
| VENUE_MANAGER | No successful owner mutation | FORBIDDEN | PASS |
| COURT_MANAGER | No successful owner mutation | FORBIDDEN | PASS |
| CLUB_OWNER (no tenant admin) | Transfer control hidden under V2 | FORBIDDEN | PASS |

## Parity matrix

| Surface | Value | Result |
|---------|-------|--------|
| Canonical `active_member_count` (`club_get`) | 12 | PASS |
| Members list active (`club_list_members`) | 12 | PASS |
| Org Chart member label | 12 thành viên (screenshot) | PASS |

## Responsive matrix

| Screen | Width | Overflow | Result | Screenshot |
|--------|-------|----------|--------|------------|
| My Club Governance | 1440 | no | PASS | `screenshots/F_desktop_my_club_governance_dual_vp.png` |
| Manage Club Detail | 1440 | no | PASS | `screenshots/A_desktop_manage_detail.png` |
| My Club / Org Chart | 1440 | no | PASS | `screenshots/A_desktop_org_chart.png` |
| Members | 1440 | no | PASS | `screenshots/A_desktop_members.png` |
| My Club | 390 | no | PASS | `screenshots/J_mobile_my_club_390.png` |
| Members | 390 | no | PASS | `screenshots/J_mobile_members_390.png` |

## Scenario summary

| ID | Actor | Screen | Result |
|----|-------|--------|--------|
| A1 | TENANT_OWNER | My Club Owner label | PASS |
| A4 | TENANT_OWNER | Assign owner + reload | PASS |
| A6 | TENANT_OWNER | Org Chart Owner | PASS |
| A7 | TENANT_OWNER | Clear + restore Owner | PASS |
| B | tenant_staff | Manage Detail + RPC | PASS |
| C | VENUE_MANAGER / COURT_MANAGER | RPC deny | PASS |
| D | CLUB_OWNER | Transfer hidden + FORBIDDEN | PASS |
| E | TENANT_OWNER | VERSION_CONFLICT | PASS |
| F | TENANT_OWNER | Dual VP slots + assign/clear | PASS |
| G | TENANT_OWNER | Filters / restore / count parity | PASS |
| H | TENANT_OWNER | Cloud/V2 Manage Detail loads | PASS |
| I | TENANT_OWNER | Notification active recipients | PASS |
| J | TENANT_OWNER | Desktop + mobile responsive | PASS |
| K | TENANT_OWNER | Flag OFF no crash | PASS |

Full machine-readable rows: `PHASE_1C_BROWSER_QA_REPORT.json`.

## Screenshots

- `docs/v5/qa-evidence/phase1c-staging/screenshots/A_desktop_my_club_home.png`
- `docs/v5/qa-evidence/phase1c-staging/screenshots/A_desktop_org_chart.png`
- `docs/v5/qa-evidence/phase1c-staging/screenshots/A_desktop_manage_detail.png`
- `docs/v5/qa-evidence/phase1c-staging/screenshots/F_desktop_my_club_governance_dual_vp.png`
- `docs/v5/qa-evidence/phase1c-staging/screenshots/A_desktop_members.png`
- `docs/v5/qa-evidence/phase1c-staging/screenshots/A_after_assign_owner_reload.png`
- `docs/v5/qa-evidence/phase1c-staging/screenshots/F_dual_vp_after_assign.png`
- `docs/v5/qa-evidence/phase1c-staging/screenshots/J_mobile_my_club_390.png`
- `docs/v5/qa-evidence/phase1c-staging/screenshots/J_mobile_members_390.png`
- `docs/v5/qa-evidence/phase1c-staging/screenshots/B_tenant_staff_manage_detail.png`
- `docs/v5/qa-evidence/phase1c-staging/screenshots/C_VENUE_MANAGER_manage.png`
- `docs/v5/qa-evidence/phase1c-staging/screenshots/C_COURT_MANAGER_manage.png`
- `docs/v5/qa-evidence/phase1c-staging/screenshots/D_club_owner_no_transfer_control.png`
- `docs/v5/qa-evidence/phase1c-staging/screenshots/G_members_restore_filter.png`
- `docs/v5/qa-evidence/phase1c-staging/screenshots/K_flag_off_manage_detail.png`

## Warnings (non-blocking)

1. **Manage Club Overview empty-stats path:** when `getClubStats` is null, Overview early-returns `"Không có dữ liệu thống kê."` and does **not** render `ClubGovernancePanel`. Dual VP / Owner governance QA was validated on **My Club Home + Org Chart** (canonical V2 surfaces). No code change in this QA pass (no implementation expansion).

## Confirmation

- No Production SQL applied
- No Production deploy
- No `git push`
- No PR opened
- No authz broadening / SQL edits in this pass
