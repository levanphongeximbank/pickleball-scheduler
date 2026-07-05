# Phase 23E — Preview Smoke Report

**Ngày:** 2026-07-05  
**Preview Deployment ID:** `dpl_5ZFQqQsp3N3jce9saxdiTdJWwZBT`  
**Preview URL:** https://pickleball-scheduler-k6egkcdr0-pickleball-scheduler.vercel.app  
**Branch / PR:** `v5-platform-edition`  
**Supabase:** staging `qyewbxjsiiyufanzcjcq`  
**Env:** `VITE_TEAM_TOURNAMENT_SUPABASE=true` (Preview only)

---

## Verdict

| Verdict | ☐ PASS · ☑ **PARTIAL** · ☐ FAIL |
|---------|----------------------------------|
| Block Production GO? | ☑ **YES (PARTIAL)** · ☐ NO (PASS) |

**Tóm tắt:** 3 blocker **đã xử lý**. Staging SQL + seed + RPC verify **PASS** (28 probes). Thiếu mật khẩu account trọng tài staging → P23E-5 (referee nhập KQ sau publish) chưa verify đủ. Preview env đã tách staging. **Chưa** chuyển production blob inventory.

---

## Prerequisites

| # | Check | Tick | Notes |
|---|-------|------|-------|
| 1 | Preview `VITE_SUPABASE_URL` = staging ref | ☑ | Preview-only `qyewbxjsiiyufanzcjcq`; Production restored `expuvcohlcjzvrrauvud` |
| 2 | Staging 23C + 23D probe seed applied | ☑ | Owner SQL 2026-07-05 + seed probe PASS |
| 3 | `VITE_RBAC_ENABLED=true` on Preview | ☑ | |
| 4 | `VITE_SUPABASE_ANON_KEY` on Preview | ☑ | Sync staging anon → Preview scope |

---

## Smoke results (P23E-1 → P23E-7)

| ID | Scenario | Result | Notes |
|----|----------|--------|-------|
| P23E-1 | BTC team setup load | ☑ **PASS** | `OwnerA get_setup: OK (2 teams)` |
| P23E-2 | Captain hidden opponent lineup | ☑ **PASS** | Opponent hidden before publish |
| P23E-3 | Captain submit lineup | ☑ **PASS** | `save_lineup_draft` own team OK |
| P23E-4 | Referee blocked pre-publish | ☑ **PASS** | `FORBIDDEN` before publish |
| P23E-5 | Publish + referee score | ☑ **PARTIAL** | `lock_matchup` + `publish_matchup` OK; referee after publish **BLOCKED** (thiếu `STAGING_MANAGER_PASSWORD`) |
| P23E-6 | RPC calls (no RPC_NOT_DEPLOYED) | ☑ **PASS** | 13 RPC staging hoạt động; verify script PASS |
| P23E-7 | Flag false regression | ☐ SKIP · ☑ **PASS** (unit) | Unit fallback blob OK; chưa Preview build `false` |

**Automated:** `npm run verify:team-tournament-cloud` → **PASS=28 FAIL=0** (BLOCKED=2: referee/viewer login — thiếu password staging).

**Seed:** `npm run seed:team-tournament-cloud` → ✅ 1 giải probe (`phase23d-probe-tournament`).

**Engineering fix:** `team-tournament-seed-core.mjs` — insert trả `id` sau upsert header (seed staging).

---

## Owner decision (2026-07-05)

**Chọn A** — Chấp nhận Preview PARTIAL, tiếp tục inventory Production blob.

---

## Issues / follow-ups

| # | Issue | Severity | Owner |
|---|-------|----------|-------|
| 1 | Chạy SQL inventory Production (Q1 + Q2) | **P0** | Owner — [`PHASE_23E_PRODUCTION_BLOB_INVENTORY.sql`](./PHASE_23E_PRODUCTION_BLOB_INVENTORY.sql) |
| 2 | P23E-5 referee sau publish (tùy chọn) | **P2** | `STAGING_MANAGER_PASSWORD` |
| 3 | Production GO (bật flag) | **BLOCKED** | Sau inventory + owner ký |

---

## Sign-off

| Role | Name | Date | GO Production enable? |
|------|------|------|---------------------|
| Engineering | Auto-run 2026-07-05 | 2026-07-05 | ☐ |
| Owner | | | ☐ |

**Production:** `VITE_TEAM_TOURNAMENT_SUPABASE` vẫn **OFF** · không redeploy Production.
