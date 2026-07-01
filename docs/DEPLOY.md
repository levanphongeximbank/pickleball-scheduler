# Deploy — Pickleball Scheduler Pro v4.0 GA

Hướng dẫn deploy **Vercel** + **Supabase**.  
**GA (Sprint 12):** `DEPLOYMENT_GUIDE.md`  
**Staging/RC:** `docs/SUPABASE-STAGING-CHECKLIST.md`

**Kiến trúc:** `docs/ARCHITECTURE.md`  
**Go/No-Go RC:** `docs/RELEASE-4.0-RC.md`  
**QA RBAC:** `docs/RBAC-RC-QA.md`

---

## Tổng quan

| Thành phần | Vai trò |
|------------|---------|
| **Vercel** | Host app React (file tĩnh trong `dist/`) |
| **Supabase** | Lưu backup CLB trên cloud (tùy chọn nhưng nên có) |

App vẫn chạy được **không có Supabase** — dữ liệu chỉ trong trình duyệt. Production nên cấu hình Supabase để đồng bộ giữa các máy.

---

## Bước 1 — Supabase

### Dev / local (không RLS)

1. [supabase.com](https://supabase.com) → project.
2. Copy **Project URL** → `VITE_SUPABASE_URL`, **anon key** → `VITE_SUPABASE_ANON_KEY`.
3. SQL Editor → `docs/supabase-club-v3.sql` (đủ cho cloud sync dev).

### Staging (RLS + RBAC)

Chạy đủ checklist: **`docs/SUPABASE-STAGING-CHECKLIST.md`**

Thứ tự SQL (đầy đủ Sprint 1–10): **`docs/SUPABASE-STAGING-CHECKLIST.md`**

Tóm tắt:

1. `supabase-club-v3.sql` → `supabase-rbac.sql` → `supabase-club-v3-rls.sql`
2. Match live + security hardening + identity sprint1/phaseB/phaseC
3. `supabase-multi-tenant-sprint2.sql` → `supabase-subscription-sprint4.sql`
4. (Tuỳ chọn) `supabase-ai-assistant-sprint7.sql`, `supabase-mobile-sprint9.sql`, `supabase-sprint10.sql`

Env staging/production RC: `VITE_RBAC_ENABLED=true`, `VITE_PAYMENT_MODE=dev`.

### Trọng tài / Realtime

Sau `supabase-match-live.sql` → bật Replication bảng `tournament_match_live` (`docs/REFEREE-E2E.md`).

---

## Bước 2 — Deploy lên Vercel (lần đầu)

Mở **PowerShell** trong thư mục dự án:

```powershell
cd C:\Users\LePhong\pickleball-scheduler
npx vercel login
npx vercel link
```

Khi `vercel link`, chọn:
- Tạo project mới hoặc chọn project có sẵn
- Framework: **Vite** (hoặc Other)
- Build: `npm run build`
- Output: `dist`

### Đặt biến môi trường trên Vercel

Vercel Dashboard → Project → **Settings → Environment Variables**:

| Tên | Giá trị | Môi trường |
|-----|---------|------------|
| `VITE_SUPABASE_URL` | URL Supabase | Production |
| `VITE_SUPABASE_ANON_KEY` | Anon key | Production |
| `VITE_SEED_DEMO` | `false` | Production |
| `VITE_RBAC_ENABLED` | `false` (local dev) / **`true`** (staging & production RC) | Production |
| `VITE_PAYMENT_MODE` | `dev` (RC) hoặc `stripe` khi có Payment Links | Production |
| `VITE_ENABLE_AI_ENGINE` | `false` (bật sau QA + SQL sprint7) | Optional |
| `VITE_API_ENABLED` | `false` (preview) | Optional |
| `VITE_MARKETPLACE_ENABLED` | `false` (preview) | Optional |

### Feature flag readiness (RC)

| Flag | Trạng thái |
|------|------------|
| RBAC, Supabase Auth | Production-ready |
| Subscription (`dev` mode) | Beta |
| AI Assistant | Beta (opt-in) |
| API / Marketplace / VNPay / MoMo / Zalo / Email / SMS | Preview hoặc mock — menu ẩn khi tắt |

Sau khi bật RBAC production, chạy SQL theo `docs/SUPABASE-STAGING-CHECKLIST.md` (15 bước).

Đăng nhập production: `/login` hoặc **Cài đặt → Đăng nhập & Phân quyền**.

Sau khi thêm biến, **Redeploy** một lần.

### Deploy

```powershell
.\scripts\deploy-vercel.ps1
```

Hoặc:

```powershell
npm run deploy
```

URL production dạng: `https://ten-project.vercel.app`

---

## Bước 3 — Kiểm tra sau deploy

1. Mở URL Vercel trên điện thoại / máy khác.
2. Vào **Cài đặt** → mục **Đồng bộ cloud**:
   - Chip xanh **Supabase** = đã cấu hình đúng.
   - Chip vàng **Chưa cấu hình Supabase** = thiếu biến môi trường trên Vercel.
3. Bấm **Đồng bộ lên cloud** → kiểm tra bảng `club_data_v3` trong Supabase Table Editor.

---

## Deploy tự động qua GitHub (tùy chọn)

Khi đã có Git + repo GitHub:

1. Push code lên nhánh `main`.
2. Trong GitHub repo → **Settings → Secrets** thêm:
   - `VERCEL_TOKEN` (tạo tại Vercel → Account → Tokens)
   - `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (trong `.vercel/project.json` sau `vercel link`)
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
3. Workflow `.github/workflows/deploy.yml` sẽ build + deploy mỗi lần push `main`.

---

## Lệnh hữu ích

```powershell
npm run dev              # Chạy local
npm run build            # Build thử production
npm run preview          # Xem bản build local
npm run deploy:preview   # Deploy bản preview (không phải production)
```

---

## Deploy preview (staging)

```powershell
npm run deploy:preview
```

Gắn env **staging** Supabase + `VITE_RBAC_ENABLED=true` cho môi trường Preview trên Vercel. **Không** dùng production URL cho đến khi `RLS-TEST-PLAN.md` pass.

---

## Lưu ý bảo mật

- **Không** commit file `.env` / `.env.production.local` (đã nằm trong `.gitignore`).
- Anon key nằm trong client — RLS staging bảo vệ `profiles`, `club_data_v3`, `payment_events`, `tournament_match_live`.
- Referee: anon không `select *` trực tiếp — chỉ RPC token-scoped (`referee_get_match_by_token`, `referee_update_match_score`).
- Dev local không chạy RLS SQL vẫn dùng `supabase-match-live.sql` (anon-open) + fallback app.
