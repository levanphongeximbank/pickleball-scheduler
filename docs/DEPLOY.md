# Deploy Production — Pickleball Scheduler Pro v3.5.0

Hướng dẫn đưa app lên **Vercel** và bật **đồng bộ Supabase**.

---

## Tổng quan

| Thành phần | Vai trò |
|------------|---------|
| **Vercel** | Host app React (file tĩnh trong `dist/`) |
| **Supabase** | Lưu backup CLB trên cloud (tùy chọn nhưng nên có) |

App vẫn chạy được **không có Supabase** — dữ liệu chỉ trong trình duyệt. Production nên cấu hình Supabase để đồng bộ giữa các máy.

---

## Bước 1 — Supabase (5 phút)

1. Vào [supabase.com](https://supabase.com) → **New project**.
2. Mở **Project Settings → API**:
   - Copy **Project URL** → `VITE_SUPABASE_URL`
   - Copy **anon public** key → `VITE_SUPABASE_ANON_KEY`
3. Mở **SQL Editor** → dán toàn bộ file `docs/supabase-club-v3.sql` → **Run**.
4. (Trọng tài) Chạy thêm `docs/supabase-match-live.sql` → bật Realtime bảng `tournament_match_live` (xem `docs/REFEREE-E2E.md`).

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
| `VITE_RBAC_ENABLED` | `false` (hoặc `true` nếu bật phân quyền) | Production |
| `VITE_PAYMENT_MODE` | `dev` hoặc `stripe` | Production |

Sau khi bật RBAC, chạy thêm SQL: `docs/supabase-rbac.sql`, `docs/supabase-club-v3-rls.sql` (xem `docs/supabase-auth-setup.md`, `docs/RBAC-MATRIX.md`).

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

## Lưu ý bảo mật

- **Không** commit file `.env` / `.env.production.local` (đã nằm trong `.gitignore`).
- Anon key Supabase nằm trong app client — phù hợp CLB nhỏ; SQL đã bật RLS cơ bản.
- Nếu cần bảo mật cao hơn: thêm Supabase Auth và policy theo user.
