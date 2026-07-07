# Phase AI V5.2 — Rollout & Env (Commercial)

**Ngày:** 2026-07-07  
**Phụ thuộc SQL:** `PHASE_AI_COURT_ENGINE_CLOUD.sql` + `supabase-ai-assistant-sprint7.sql` (đã có)

---

## Owner SQL apply log

| Migration | MCP | Ngày |
|-----------|-----|------|
| `phase_ai_court_engine_cloud_v52` | ✅ | 2026-07-06 |
| `phase_ai_v52_phase5` | ✅ Realtime + checklist + club version | 2026-07-07 |
| `ai_suggestions` (Sprint 7) | ✅ Đã có từ Gate 2 | — |

---

## Production status (2026-07-07)

| Hạng mục | Trạng thái |
|----------|------------|
| Env AI cloud (3 biến) | ✅ Production ON |
| Deploy | ✅ `dpl_5JfZ4VXnczTE9NVcfJUi7HNQ2jiB` |
| GA Report | ✅ `PHASE_AI_V52_GA_REPORT.md` |
| Backend smoke | ✅ `node scripts/verify-ai-v52-production-smoke.mjs` |
| URL | https://pickleball-scheduler-eight.vercel.app |

---

## Giai đoạn 4 (code) — 2026-07-07

| Tính năng | Mô tả |
|-----------|--------|
| Auto-pull CLB | `autoPullOnClubActivate` — máy B tự pull khi đổi CLB |
| Quyền sync xếp sân | Auto sync/pull dùng `scheduling.run` |
| Court Engine poll | 5s active / 15s hidden |
| AI Alerts | Số sân thật + hàng chờ Court Engine |

## Giai đoạn 5 (code) — 2026-07-07

| Tính năng | Mô tả |
|-----------|--------|
| **Realtime** | `courtEngineRealtime.js` — Supabase Realtime thay poll chính |
| **Checklist cloud** | Bảng `ai_workflow_checklists` + sync theo giải |
| **Club version conflict** | `club_data_v3.version` + toast event `club-data:version-conflict` |
| **Legacy cleanup** | Ngừng ghi `pickleball-ai::{clubId}` duplicate |

---

| Biến | Giá trị QA |
|------|------------|
| `VITE_COURT_ENGINE_STORE` | `supabase` |
| `VITE_AI_AUTO_CLOUD_SYNC` | `true` |
| `VITE_ENABLE_AI_ENGINE` | `true` |
| `VITE_RBAC_ENABLED` | `true` |

## Env production

| Biến | Giá trị hiện tại |
|------|------------------|
| `VITE_COURT_ENGINE_STORE` | `supabase` |
| `VITE_AI_AUTO_CLOUD_SYNC` | `true` |
| `VITE_ENABLE_AI_ENGINE` | `true` |

---

## Smoke bắt buộc (2 máy)

1. **CE-1:** Máy A check-in → Máy B refresh Court Engine thấy queue
2. **CE-2:** Máy A + B sửa cùng lúc → toast conflict + reload
3. **AI-1:** Xếp sân máy A → máy B pull cloud thấy waiting/history
4. **AI-2:** Tạo gợi ý seed → máy B thấy trong tournament AI panel
5. **RBAC:** PLAYER không vào `/court-engine`

---

## Bán thương mại — GA ✅

- ✅ AI xếp sân + auto sync + club version conflict
- ✅ Court Engine multi-staff (Supabase + Realtime)
- ✅ Trợ lý thông minh + gợi ý + checklist cloud
- ✅ Cảnh báo vận hành tại `/ai?tab=alerts`

Chi tiết: `PHASE_AI_V52_GA_REPORT.md` · Manual QA: `PHASE_AI_V52_MANUAL_QA.md`

---

## Staging (Preview / QA)

| Bước | Lệnh |
|------|------|
| Apply SQL | `npm run apply:ai-v52-staging-sql` (cần `SUPABASE_ACCESS_TOKEN` hoặc `STAGING_SUPABASE_DB_URL`) |
| Smoke | `npm run verify:ai-v52-staging-smoke` (URL staging + `STAGING_SUPABASE_SERVICE_ROLE_KEY`) |
| Manual | `PHASE_AI_V52_MANUAL_QA.md` |

**Staging ref:** `qyewbxjsiiyufanzcjcq` — SQL chưa auto-apply nếu thiếu token (chạy manual trong SQL Editor).

---

## Deploy code mới (owner)

Sau thay đổi UI/error handling:

```bash
npm run deploy
```

Hoặc Vercel Dashboard → **Deployments** → **Redeploy** deployment mới nhất.

---

## Rollback

1. Tắt `VITE_COURT_ENGINE_STORE=local`
2. Tắt `VITE_ENABLE_AI_ENGINE=false`
3. Promote deployment V5.2 trước đó
