# Private Pairing Rules V2 — RC-1 Staging Release Candidate Report

**Phase:** RC-1 — Staging Release Candidate (feature reopened for release)
**Date:** 2026-07-15
**Prepared by:** Release engineering (agent, isolated worktree)
**Scope of this GO:** Staging only. **No** Production deploy / flags / migration / merge.

---

## 0. Executive summary

Private Pairing Rules V2 was reopened from `FEATURE COMPLETE — NOT RELEASED` for a **Staging Release Candidate**. No new features were added; the PR chain is closed. This RC-1 re-verifies the branch, the build, the test freeze, the staging database migration, feature-flag posture, security, and rollback.

- **Staging RC-1 verdict: GREEN** — code, DB schema/RLS/RPC, and security posture all verified on live staging.
- **RC-1a/1b (2026-07-15) — live SA browser smoke found and fixed two blockers:** (a) the player picker showed no athletes with real cloud data because it resolved canonical mapping via `profiles.player_id` but nothing loaded that index at runtime (`club_list_members` RPC returns no `player_id`) — fixed in `d22e19d` + staging mapping top-up (6/7 members); (b) saving a rule hit DB check `private_pairing_rules_other_reason_chk` because the form allowed empty `reason_text` while `reason_category = OTHER` — fixed in `438a3c6` (UI validation). Redeployed Preview. See §9a.
- **Production verdict: NO-GO (now)** — by owner constraint (no Production actions in this GO) and because owner-manual gates remain (finish live SUPER_ADMIN browser smoke on the RC-1a Preview, PITR/backup confirmation, explicit separate Production GO). Deferred non-goals (legacy migration, Apply-to-live, disclosure UI) are out of scope and do not block Staging.

---

## 1. Branch

| Item | Value |
|------|-------|
| Branch | `feature/private-pairing-rules-v2` |
| Merged to production branch | **No** (forbidden this GO) |
| PR chain | Closed at PR-5 (no PR-6; no new features) |

---

## 2. HEAD

| Item | Value |
|------|-------|
| HEAD commit | `d22e19d` (RC-1a picker fix) on top of `58f3506` (final-status doc) / PR-5 tip `1fbc1ae` |
| Working tree at start | Clean |

---

## 3. Worktree

| Item | Value |
|------|-------|
| RC worktree | `C:\Users\Le Phong\pickleball-scheduler-pr45-private-pairing` |
| Main tree | `C:\Users\Le Phong\pickleball-scheduler` (parallel WIP — not used for this feature) |
| `node_modules` | Present (junction to main worktree) |
| Isolation | Dedicated worktree; no concurrent writes to this feature during RC-1 |

---

## 4. Build

| Item | Result |
|------|--------|
| Command | `npm run build` (vite v8.1.0) |
| Result | **PASS** (exit 0) |
| Modules transformed | 2875 |
| Feature route chunk | `PrivatePairingRulesAdminPage-*.js` (72.10 kB / gzip 20.46 kB) present |
| Notes | Standard large-chunk warning only; PWA generateSW OK (413 precache entries) |

---

## 5. Tests

| Suite | Result |
|-------|--------|
| Private Pairing + pairing regression batch (16 files) | **124/124 PASS, 0 fail** |
| — PR-2 canonical types + conflict detector | PASS |
| — PR-3 unified runtime (hard reject / soft score / determinism / certified) | PASS |
| — PR-4 SQL security contract + client RBAC matrix + repository adapter | PASS |
| — PR-4.25 canonical picker | PASS |
| — PR-4.26 cross-consumer canonical parity (Daily Play / Tournament / Athlete) | PASS |
| — PR-4.5 simulation (determinism, hard/soft, fairness, Top N, certified, flags) | PASS |
| — PR-4.5 benchmark (8/16/24/32 players under timeout) | PASS |
| — PR-5 UI permissions + admin UI composition (no Apply-to-live button) | PASS |
| — pairing-constraints / -guard, pairing-intervention / -guard / -qa | PASS |
| — tournament-player-picker, platform-athlete-service | PASS |

Full-suite lint baseline unchanged from PR-5 freeze (0 new errors); this RC did not add code.

---

## 6. Migration

| Item | Result |
|------|--------|
| Migration file | `docs/v5/PHASE_PRIVATE_PAIRING_RULES_V2_PR4.sql` |
| Raise patch | `docs/v5/PHASE_PRIVATE_PAIRING_RULES_V2_PR4_RAISE_PATCH.sql` |
| Staging apply | **Already applied** (2026-07-14, Management API) — re-verified live this RC-1 |
| Idempotency | Safe re-apply (`create table if not exists`, `create or replace`) |
| Production apply | **NOT applied** (forbidden this GO) |

### Live staging schema verification (2026-07-15, Management API, staging ref `qyewbxjsiiyufanzcjcq`)

| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| Tables | 4 | 4 (`rule_sets`, `rules`, `rule_targets`, `rule_audit_logs`) | PASS |
| User-facing RPCs | 11 | 11 present | PASS |
| RLS enabled | yes | yes | PASS |
| SELECT-only policies | >0, no `using(true)` | 4 select policies | PASS |
| One-active unique index | present | `private_pairing_rule_sets_one_active_uidx` | PASS |
| Realtime publication rows | 0 | 0 | PASS |
| Audit append-only | UPDATE/DELETE blocked | P0001 `AUDIT_APPEND_ONLY` | PASS |

Evidence: `docs/v5/qa-evidence/phase-private-pairing-staging/STAGING_SECURITY_VERIFY.json` (regenerated this RC-1).

> Note: The staging MCP `execute_sql`/`apply_migration` client could not register in this session (same limitation as the prior session). Verification used the approved Supabase Management API path (staging ref only; Production ref `expuvcohlcjzvrrauvud` explicitly not touched).

---

## 7. Feature flags

| Flag | Code default | Staging / Preview | Production |
|------|--------------|-------------------|------------|
| `VITE_PRIVATE_PAIRING_RULES_ENABLED` | `false` | `true` (set 2026-07-14, Preview) | **OFF / not set by this GO** |
| `VITE_UNIFIED_CONSTRAINT_ENGINE_ENABLED` | `false` | `true` (set 2026-07-14, Preview) | **OFF / not set by this GO** |
| `VITE_PRIVATE_PAIRING_SIMULATION_ENABLED` | `false` | `true` (set 2026-07-15, Preview — read-only sim for RC-1 E2E) | **OFF / not set by this GO** |
| `VITE_CANONICAL_CLUB_REPOSITORY_ENABLED` | `false` | dev/preview only | **OFF** |
| `VITE_CANONICAL_PLAYER_REPOSITORY_ENABLED` | `false` | dev/preview only | **OFF** |

- Defaults verified OFF in `src/features/private-pairing-rules/constants/codes.js` and by test `feature flags default OFF`.
- Vercel treats these as Sensitive; plaintext value confirmation on Preview is owner-manual (`vercel env pull` shows placeholders).

---

## 8. Staging deploy

| Item | Value |
|------|-------|
| Stable alias (project default / flags OFF) | `https://pickleball-scheduler-levanphongeximbank-pickleball-scheduler.vercel.app` — **feature switch OFF here** (project default build); menu correctly hidden |
| **Fresh Preview (RC-1, flags ON)** | `https://pickleball-scheduler-6aip3pn6u-pickleball-scheduler.vercel.app` — deployed 2026-07-15, `target: null` (Preview, not production), HTTP 200 open |
| RC-1a Preview (picker fix) | `https://pickleball-scheduler-4jxit5zj9-pickleball-scheduler.vercel.app` — superseded (commit `d22e19d`) |
| RC-1b Preview (picker + reason_text fix) | `https://pickleball-scheduler-hqbfot4a0-pickleball-scheduler.vercel.app` — superseded (commit `438a3c6`) |
| **RC-1c Preview (+ simulation flag ON)** | `https://pickleball-scheduler-cp7ytzkyx-pickleball-scheduler.vercel.app` — **current** (2026-07-15), `readyState: READY`, `target: null` (Preview), `VITE_PRIVATE_PAIRING_SIMULATION_ENABLED=true` on Preview. Use this URL for the SA browser smoke incl. Top-N simulation. |
| Preview env flags | `VITE_PRIVATE_PAIRING_RULES_ENABLED`, `VITE_UNIFIED_CONSTRAINT_ENGINE_ENABLED`, `VITE_RBAC_ENABLED` all set in **Preview** scope (encrypted) |
| Route | `/admin/ai-pairing/private-rules` |
| Menu | Quản trị → Quy tắc ghép cặp riêng (`admin-private-pairing-rules`) |
| Production deploy | **None** (no `--prod`; production alias untouched) |

---

## 9. Staging QA (E2E)

| Area | Result | Notes |
|------|--------|-------|
| Runtime unit / integration (flags ON) | **PASS** | hard reject, soft score, determinism, certified policy, no legacy double-scoring |
| Simulation Top N (read-only) | **PASS** | no Apply-to-live path in UI source |
| Cross-consumer canonical parity | **PASS** | Daily Play / Tournament / Athlete share canonical playerIds |
| Non-SA menu hidden / route deny | **CODE PASS** | `SuperAdminRouteGuard` → `/403`; menu roles gated |
| Active rule set not editable | **CODE PASS** | RPC `RULE_SET_NOT_EDITABLE` + UI draft gate |
| Cross-tenant blocked | **CODE PASS** | `private_pairing_tenant_visible` / `CROSS_TENANT_ACCESS` |
| Live SUPER_ADMIN browser flow on Preview | **OWNER_MANUAL** | needs SA login + Preview auth session (no credentials in agent session) |
| Mobile UI smoke | **OWNER_MANUAL** | checklist in release readiness docs |

---

## 9a. RC-1a — Live SA browser smoke: finding & fix (2026-07-15)

During the owner's live SUPER_ADMIN browser smoke on the Preview, the **"Thêm Rule" player pickers were empty for every source club** ("CLB có thành viên active nhưng chưa map playerId" / "CLB này chưa có vận động viên").

### Root cause (confirmed by code + live staging data)

1. **Runtime wiring gap (primary defect).** The Private Pairing picker classifies a member as selectable only when it can resolve a canonical player mapping (`profiles.player_id`, or a derived `player-auth-*`). But at runtime nothing supplied that mapping:
   - RPC `club_list_members` returns `id, user_id, athlete_id, display_name, email, status, membership_type, governance_roles, version` — **no `player_id`**.
   - `createCanonicalPlayerRepository` default had `loadProfilesByUserIds = null`, and the admin view/adapter never passed a `profilesByUserId` map.
   - On cloud the legacy blob is empty, so the DERIVED fallback also missed.
   - Net: every active member resolved as **UNMAPPED** → picker empty for all clubs.
2. **Sparse staging mapping data (secondary).** In `club-smoke-42i1` only `player@staging.local` had `profiles.player_id` set (1/7).

### Fix

- **Code** (`d22e19d`): added `fetchProfilesByUserIds(userIds)` in `privatePairingPlayerPickerAdapter.js` (reads `profiles(id, player_id, display_name)` via the authenticated Supabase client; SUPER_ADMIN reads all profiles via RLS) and wired it into the adapter's canonical player repository (`loadProfilesByUserIds`). Fails safe (returns `[]`) when Supabase is unavailable → unit tests and legacy/blob paths unchanged.
- **Staging data:** mapped `profiles.player_id` for the remaining `club-smoke-42i1` members (excluding the admin account) → **6/7 active members mapped** (verified via Management API). `profiles.player_id` is free `text` with no FK, so this is non-destructive.
- **Re-verify:** private-pairing + canonical picker + simulation tests **36/36 PASS**; `npm run build` **PASS**; redeployed Preview (`4jxit5zj9`, READY).

### Status

- Picker fix: **DONE**, awaiting owner re-test on the current Preview.
- Expected: source club **CLB Smoke 42I1** now lists **6 selectable athletes**, enabling the full create → add rule → simulate (Top N) → activate → audit flow.

### RC-1b — second finding: reason_text constraint (commit `438a3c6`)

On the next attempt, saving a rule failed with `new row for relation "private_pairing_rules" violates check constraint "private_pairing_rules_other_reason_chk"`.

- **Root cause:** constraint requires `reason_category IS DISTINCT FROM 'OTHER' OR reason_text` non-empty. The "Thêm Rule" form defaults `reason_category = OTHER` but allowed an empty `reason_text`, so the DB rejected the insert with a raw error.
- **Fix (UI):** `handleSaveRule` now blocks with a friendly message, the Save button is gated via `canSaveRule`, and the Reason text field is marked `required`/`error` with helper text when category = OTHER. No schema change.
- **Re-verify:** PR-5 UI + picker tests **17/17 PASS**; build **PASS**; redeployed Preview (`hqbfot4a0`, READY).

---

## 10. Security QA

Fresh live staging probe (2026-07-15, read-only, Management API):

| Check | Result |
|-------|--------|
| Permissions seeded | `pairing.private_rules.{view,manage,audit,simulate}` present |
| Role grants | **only** `SUPER_ADMIN` (4) and `PLATFORM_ADMIN` (4) — no other roles |
| `anon` table grants | **none** (deny-by-default) |
| `authenticated` table grants | **SELECT only** (no INSERT/UPDATE/DELETE) on all 4 tables |
| Writes | SECURITY DEFINER RPCs only; `search_path` fixed |
| RLS policies | SELECT gated by `private_pairing_can(...)` + tenant visibility; no `using(true)` |
| Audit | append-only (UPDATE/DELETE → P0001) |
| Realtime | tables not published |
| Client RBAC test | blocked roles (TECHNICIAN, DIRECTOR, CLUB/VENUE, PLAYER, …) receive none |

Security verdict: **PASS** on staging.

---

## 11. Rollback

| Layer | Mechanism | Status |
|-------|-----------|--------|
| Feature (fast) | Set `VITE_PRIVATE_PAIRING_RULES_ENABLED=false` + `VITE_UNIFIED_CONSTRAINT_ENGINE_ENABLED=false`, redeploy | **Verified** — repository adapter returns `FEATURE_DISABLED` and performs no query when flag OFF (unit tests: “does not query when feature flag is OFF”, “createRuleSet returns FEATURE_DISABLED when flag OFF”) |
| Migration re-apply | Idempotent DDL | **Verified** by SQL construction (`if not exists` / `create or replace`) |
| Schema rollback (staging) | Drop RPCs/triggers/policies/tables + remove `pairing.private_rules.%` grants | Documented in `PRIVATE_PAIRING_RULES_V2_PRODUCTION_RUNBOOK.md` §4 — **not executed** (destructive; not needed; staging kept intact) |
| Production | No Production DB applied → nothing to roll back | N/A |

Rollback verdict: **PASS** (flag-off is sufficient to make the feature inert).

---

## 12. Production readiness

| Gate | Status |
|------|--------|
| Staging QA matrix signed PASS | Automated + code PASS; **live SA browser smoke = OWNER_MANUAL** |
| Owner GO for merge to release/main | **Not given** (forbidden this GO) |
| Owner GO for Production SQL apply | **Not given** |
| Owner GO for Production feature flags | **Not given** |
| Production PITR / backup confirmation | **Pending owner** |
| Rollback rehearsal understood | Yes (flag-off verified; schema rollback documented) |
| Deferred non-goals (legacy migration, Apply-to-live, disclosure UI) | Intentionally out of scope; do not block Staging |

---

## 13. Conclusion — GO / NO-GO for Production

**Staging RC-1: GO (GREEN).** The build, tests, migration, RLS/RPC security, feature-flag posture, and flag-off rollback are all verified on staging; Production remains untouched with all flags OFF.

**Production: NO-GO (now).**

Production is blocked by owner-gated conditions, not by defects. Promote to Production only after the owner explicitly approves **all** of:

1. Live SUPER_ADMIN browser smoke on Preview signed PASS (menu, direct route, create draft → add rules → ANY_OF/ALL_OF → clone → activate → rollback → audit; non-SA denied).
2. Owner GO to merge `feature/private-pairing-rules-v2` into the release/main branch.
3. Owner GO to apply `PHASE_PRIVATE_PAIRING_RULES_V2_PR4.sql` on Production, with PITR/backup confirmed, then re-run the verification SQL against Production.
4. Owner GO to enable Production flags (`VITE_PRIVATE_PAIRING_RULES_ENABLED`, `VITE_UNIFIED_CONSTRAINT_ENGINE_ENABLED`) after a Production UI smoke.
5. Explicit decision on the deferred non-goals (legacy `founderPairingConstraints` migration, Apply-to-live, disclosure UI) — each is a separate owner-gated step.

---

## Kết luận (tóm tắt tiếng Việt)

- **Staging (RC-1): GO** — build PASS, test 124/124 PASS, migration đã áp trên staging và xác minh lại (4 bảng, 11 RPC, RLS chỉ SELECT, realtime tắt, audit append-only), phân quyền chỉ cho SUPER_ADMIN/PLATFORM_ADMIN, anon không có quyền. Rollback bằng tắt cờ đã kiểm chứng.
- **Production: NO-GO (chưa)** — không phải vì lỗi, mà vì đang bị chặn theo đúng yêu cầu (không đụng Production) và còn các bước cần chủ sở hữu duyệt: smoke UI SUPER_ADMIN trên Preview, xác nhận backup/PITR, và các lệnh GO riêng để merge / apply SQL / bật cờ Production.
- Không có thay đổi nào chạm Production trong RC-1 này.
