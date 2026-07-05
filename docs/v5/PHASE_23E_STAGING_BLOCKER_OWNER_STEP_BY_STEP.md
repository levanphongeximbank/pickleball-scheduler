# Phase 23E — 3 việc blocker (hướng dẫn Owner không cần biết code)

**Mục tiêu:** Sửa môi trường **thử (Preview + staging)** để chạy lại smoke. **Production không đổi.**

**Thời gian ước tính:** 20–30 phút.

---

## Việc 1 — Cài “phòng giải đồng đội” trên database thử (staging)

> Chỉ làm trên project **staging** `qyewbxjsiiyufanzcjcq`. **Không** mở Production `expuvcohlcjzvrrauvud`.

### Bước 1.1 — Mở SQL Editor staging

1. Vào https://supabase.com/dashboard  
2. Chọn project **staging** (tên thường có `stagin` / ref `qyewbxjsiiyufanzcjcq`)  
3. Menu trái → **SQL Editor** → **New query**

### Bước 1.2 — Chạy file lớn (23C)

1. Trên máy, mở file:  
   `docs/v5/PHASE_23C_TEAM_TOURNAMENT_CLOUD_SYNC.sql`  
2. **Ctrl+A** (chọn hết) → **Ctrl+C** (copy)  
3. Dán vào SQL Editor → bấm **Run** (hoặc Ctrl+Enter)  
4. Đợi xong — nếu báo lỗi đỏ, chụp màn hình gửi engineering (đừng chạy lại nhiều lần nếu không chắc)

### Bước 1.3 — Chạy file nhỏ (23D probe)

1. Mở file: `docs/v5/PHASE_23D_TEAM_TOURNAMENT_STAGING_PROBE.sql`  
2. Copy hết → dán SQL Editor → **Run**

### Bước 1.4 — Báo engineering chạy seed (hoặc tự chạy nếu có `.env.local`)

Engineering chạy trên máy dev (không phải Production):

```bash
npm run seed:team-tournament-cloud -- --blob-path=tests/fixtures/team-tournament-blob-probe.json
npm run verify:team-tournament-cloud
```

Kỳ vọng cuối: `verify` không còn lỗi “Could not find the function team_tournament_get_setup”.

---

## Việc 2 — App Preview trỏ đúng database thử (Vercel)

> Engineering có thể làm giúp. Owner kiểm tra trên Dashboard.

### Bước 2.1 — Mở Vercel

1. https://vercel.com → project **pickleball-scheduler**  
2. **Settings** → **Environment Variables**

### Bước 2.2 — Kiểm tra từng biến (scope **Preview**)

| Biến | Giá trị Preview phải là |
|------|-------------------------|
| `VITE_SUPABASE_URL` | `https://qyewbxjsiiyufanzcjcq.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Anon key **staging** (Supabase staging → Settings → API → anon public) |
| `VITE_TEAM_TOURNAMENT_SUPABASE` | `true` |
| `VITE_RBAC_ENABLED` | `true` |
| `VITE_SEED_DEMO` | `false` |

**Quan trọng:** `VITE_SUPABASE_URL` trên **Production** vẫn phải là `expuvcohlcjzvrrauvud` — hai môi trường **khác nhau**.

Engineering đã tách Preview URL staging (2026-07-05). Owner chỉ cần **xác nhận** + thêm anon key Preview nếu chưa có.

---

## Việc 3 — Deploy lại Preview và báo “chạy lại smoke”

Sau khi Việc 1 + 2 xong:

1. Vercel → **Deployments** → deployment mới nhất branch `v5-platform-edition` → **Redeploy** (hoặc engineering: `npx vercel deploy`)  
2. Nhắn engineering: *“3 blocker xong, chạy lại P23E smoke”*

---

## Checklist tick (Owner)

| # | Việc | Tick |
|---|------|------|
| 1 | SQL 23C chạy xong trên **staging** | ☐ |
| 2 | SQL 23D chạy xong trên **staging** | ☐ |
| 3 | Seed + verify staging PASS | ☐ |
| 4 | Vercel Preview URL = staging | ☐ |
| 5 | Vercel Preview anon key = staging | ☐ |
| 6 | Redeploy Preview | ☐ |

**Production:** vẫn **tắt** `VITE_TEAM_TOURNAMENT_SUPABASE` — không redeploy Production trong bước này.

---

## Nếu muốn engineering apply SQL tự động (1 lần)

Thêm **một dòng** vào `.env.local` (không commit, không gửi chat):

```env
SUPABASE_DB_URL=postgresql://postgres.qyewbxjsiiyufanzcjcq:MAT_KHAU_DB@...pooler.supabase.com:6543/postgres
```

Lấy chuỗi: Supabase staging → **Settings** → **Database** → **Connection string** → **Session pooler** → copy.

Sau đó engineering chạy:

```bash
npm install pg --save-dev
node scripts/apply-phase23d-staging-sql.mjs
```
