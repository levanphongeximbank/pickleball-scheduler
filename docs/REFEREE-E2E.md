# Test E2E — Chế độ Trọng tài (Supabase Realtime)

Hướng dẫn cấu hình Supabase trên máy local để test **Director ↔ Trọng tài** thật (điện thoại + máy tính).

---

## Bước 1 — Tạo / mở project Supabase

1. Vào [supabase.com](https://supabase.com) → đăng nhập.
2. **New project** (hoặc dùng project đã có cho app).
3. Chờ project khởi tạo xong (~2 phút).

---

## Bước 2 — Lấy API key

1. Supabase Dashboard → **Project Settings** (bánh răng) → **API**.
2. Copy 2 giá trị:

| Biến | Lấy từ |
|------|--------|
| `VITE_SUPABASE_URL` | **Project URL** |
| `VITE_SUPABASE_ANON_KEY` | **anon public** key |

---

## Bước 3 — Ghi vào file `.env.development`

Mở file `C:\Users\LePhong\pickleball-scheduler\.env.development` và thêm (hoặc sửa):

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Giữ nguyên nếu đã có:
VITE_SEED_DEMO=true
```

**Lưu ý:** File này không commit lên Git (đã nằm trong `.gitignore`).

---

## Bước 4 — Chạy SQL trên Supabase

Mở **SQL Editor** trong Supabase Dashboard.

### Lần đầu (chưa có bảng cloud sync)

Dán và **Run** toàn bộ:

- `docs/supabase-club-v3.sql` (đồng bộ CLB — nên có)
- `docs/supabase-match-live.sql` (bảng điểm live trọng tài)

### Đã chạy `supabase-match-live.sql` trước đó

Chỉ cần thêm migration:

- `docs/supabase-match-live-v2.sql` (cột `stage_label`, `audit_log`)

---

## Bước 5 — Bật Realtime

**Cách 1 (Dashboard):**

1. **Database** → **Publications**
2. Mở publication `supabase_realtime`
3. Bật bảng `tournament_match_live`

**Cách 2 (SQL):**

```sql
alter publication supabase_realtime add table tournament_match_live;
```

---

## Bước 6 — Kiểm tra tự động

Trong PowerShell, thư mục dự án:

```powershell
npm run test:supabase-referee
```

Kết quả mong đợi: tất cả dòng ✅, kết thúc bằng `Supabase sẵn sàng cho test E2E`.

Nếu lỗi, script sẽ ghi rõ thiếu gì (env, bảng, cột, Realtime).

---

## Bước 7 — Chạy app và test trên 2 thiết bị

### Máy tính (BTC / Director)

```powershell
npm run dev:lan
```

Terminal sẽ hiện URL dạng `http://192.168.x.x:5173` — dùng IP này trên điện thoại (cùng Wi‑Fi).

### Checklist test tay

1. **Cài đặt** → chip xanh **Supabase** (không phải Local).
2. Tạo / mở giải → vào **Director Mode**.
3. Chọn trận đang chơi → **Gán trọng tài** → Copy link / WhatsApp / **QR**.
4. Trên điện thoại mở link `/referee/:token`.
5. Trọng tài bấm **+1** → Director thấy điểm đổi realtime (không cần refresh).
6. Trọng tài **Chốt** → Director tự finalize → bracket/BXH cập nhật.
7. Mở lại link trọng tài → thấy thông báo khóa.
8. (Tuỳ chọn) BTC ghi đè điểm → xem lịch sử audit.

---

## Xử lý lỗi thường gặp

| Triệu chứng | Cách sửa |
|-------------|----------|
| Director báo "Cần cấu hình Supabase" | Kiểm tra `.env.development`, **restart** `npm run dev` |
| Trọng tài: "chưa cấu hình Supabase" | Cùng nguyên nhân — env chưa load |
| Điểm không realtime | Bật Replication bảng `tournament_match_live` |
| Lỗi cột `audit_log` | Chạy `docs/supabase-match-live-v2.sql` |
| Điện thoại không mở được link | Dùng `dev:lan` + IP LAN, không dùng `localhost` |
| QR mở sai máy | QR phải trỏ URL có IP máy chạy dev server |

---

## Production (Vercel)

Giống `docs/DEPLOY.md`: đặt `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` trên Vercel, chạy cùng bộ SQL, bật Realtime, rồi redeploy.
