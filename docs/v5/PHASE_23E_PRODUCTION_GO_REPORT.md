# Phase 23E — Production GO Report

**Ngày:** 2026-07-05  
**Owner:** GO Production (explicit)  
**Deployment ID (rollback):** `dpl_53CoU4LCf48ERhekZt2TVPrBuLD9`  
**Production URL:** https://pickleball-scheduler-eight.vercel.app  
**Alias deploy URL:** https://pickleball-scheduler-oonddahyd-pickleball-scheduler.vercel.app

---

## Prerequisites (đã đạt)

| Hạng mục | Verdict |
|----------|---------|
| Phase 23C SQL Production | ✅ PASS |
| Preview smoke | ⚠️ PARTIAL (staging verify 28/28) |
| Inventory blob | ✅ SKIP (Q1=0, Q2=0) |
| Migration | ✅ Không cần |

---

## Production enable

| Biến | Scope | Giá trị |
|------|-------|---------|
| `VITE_TEAM_TOURNAMENT_SUPABASE` | **Production** | `true` |
| `VITE_TEAM_TOURNAMENT_SUPABASE` | Preview | `true` (giữ nguyên) |
| `VITE_SUPABASE_URL` | Production | `expuvcohlcjzvrrauvud` |
| `VITE_SUPABASE_URL` | Preview | `qyewbxjsiiyufanzcjcq` |

**Redeploy Production:** ✅ `dpl_53CoU4LCf48ERhekZt2TVPrBuLD9`

---

## Production smoke (PROD-23E-1 → 5) — owner manual

| ID | Scenario | Tick | Notes |
|----|----------|------|-------|
| PROD-23E-1 | BTC tạo giải đồng đội mới | ☐ | Giải đấu → Team tournament |
| PROD-23E-2 | Tạo đội + gán captain (`player_id` khớp) | ☐ | |
| PROD-23E-3 | Captain portal + submit lineup | ☐ | |
| PROD-23E-4 | Referee sau publish | ☐ | |
| PROD-23E-5 | BXH cập nhật sau confirm KQ | ☐ | |

**Gợi ý:** DevTools Network — mutation gọi `team_tournament_*` RPC (không `RPC_NOT_DEPLOYED`).

---

## Rollback

1. Vercel Production → `VITE_TEAM_TOURNAMENT_SUPABASE=false`  
2. Redeploy hoặc promote deployment trước `dpl_53CoU4LCf48ERhekZt2TVPrBuLD9`  
3. App vẫn blob-first khi flag tắt

---

## Sign-off

| Role | Production GO | Date |
|------|---------------|------|
| Owner | ☑ | 2026-07-05 |
| Engineering | ☑ deploy | 2026-07-05 |
