# AI V5.2 — Manual QA 2 máy (Owner)

**Thời gian:** ~20 phút · **Cần:** 2 trình duyệt (hoặc 2 máy), 2 tài khoản staff cùng venue.

**Production:** https://pickleball-scheduler-eight.vercel.app  
**Staging (nếu test Preview):** Vercel Preview URL + Supabase staging

---

## Chuẩn bị

1. Đăng nhập **Máy A** và **Máy B** bằng 2 user cùng `venue_id` (VD: `admin@...` + `staff@...`).
2. Chọn **cùng CLB** trên cả hai máy.
3. Mở DevTools → Network (tùy chọn) để thấy request Supabase.

---

## M1 — Court Engine (CE-1 / CE-2)

| Bước | Máy A | Máy B |
|------|-------|-------|
| 1 | Vào **Xếp sân** → Court Engine | Cùng trang, cùng CLB |
| 2 | Check-in 1–2 người chơi | Trong ~5s thấy queue cập nhật (Realtime) |
| 3 | Xếp 1 trận lên sân | Máy B thấy sân đổi trạng thái |
| 4 | Cùng lúc đổi queue (nếu có conflict) | Một máy thấy dữ liệu refresh / không ghi đè lẫn nhau |

**Pass:** Đồng bộ queue & sân giữa 2 máy.  
**Fail:** Máy B không đổi sau 30s → kiểm tra `VITE_COURT_ENGINE_STORE=supabase`.

---

## M2 — AI xếp sân (AI-1)

| Bước | Máy A | Máy B |
|------|-------|-------|
| 1 | **Xếp sân** → chạy AI xếp 1 lượt | Chờ |
| 2 | — | Refresh hoặc đổi CLB rồi quay lại |
| 3 | — | Thấy lịch/sân giống Máy A (auto-pull) |

**Pass:** Dữ liệu CLB đồng bộ sau vài giây.  
**Fail:** Kiểm tra `VITE_AI_AUTO_CLOUD_SYNC=true`.

---

## M3 — Trợ lý AI + Checklist (AI-2)

| Bước | Máy A | Máy B |
|------|-------|-------|
| 1 | Mở giải **Internal/Official** → tab **AI Assistant** | Cùng giải |
| 2 | Bấm **Gợi ý hạt giống** (hoặc chia bảng) | Thấy card gợi ý sau refresh |
| 3 | Tick 1 mục **Workflow checklist** | Máy B refresh → tick giữ nguyên |

**Pass:** Gợi ý + checklist đồng bộ.  
**Fail:** Kiểm tra `VITE_ENABLE_AI_ENGINE=true` và bảng `ai_workflow_checklists`.

---

## M4 — RBAC PLAYER

| Bước | Kết quả mong đợi |
|------|------------------|
| Đăng nhập `player@...` | Vào `/court-engine` → **403** hoặc redirect |
| Đăng nhập staff | Vào `/court-engine` → OK |

---

## Ghi nhận

| Test | Pass | Ghi chú |
|------|------|---------|
| M1 CE | ☐ | |
| M2 AI sync | ☐ | |
| M3 Assistant | ☐ | |
| M4 RBAC | ☐ | |

Khi 4/4 pass → cập nhật checkbox M1–M4 trong `PHASE_AI_V52_GA_REPORT.md`.
