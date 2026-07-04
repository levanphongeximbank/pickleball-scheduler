# Phase 21B — Sửa cấu hình Staging (dành cho Owner)

**Mục đích:** Làm cho 2 lệnh kiểm tra staging chạy **PASS** trước khi pilot 1 sân.  
**Không cần biết lập trình.** Không gửi key qua chat — chỉ copy **thông báo lỗi** nếu FAIL.

---

## Bước 1 — Lấy key từ Supabase

1. Mở trình duyệt → [Supabase Dashboard](https://supabase.com/dashboard).
2. Chọn project **staging** có tên/ref: `qyewbxjsiiyufanzcjcq`.
3. Vào **Settings** (bánh răng) → **API**.
4. Copy **Project URL** (dạng `https://qyewbxjsiiyufanzcjcq.supabase.co`).
5. Copy **anon / public** key (tab *Project API keys*).
6. Copy **service_role** key (cùng trang — **không** chia sẻ công khai).

> ⚠️ Dùng đúng project **staging** `qyewbxjsiiyufanzcjcq`, không phải Production `expuvcohlcjzvrrauvud`.

---

## Bước 2 — Cập nhật `.env.local`

7. Mở file `.env.local` ở thư mục gốc project (cùng cấp `package.json`).
8. Dán hoặc sửa 3 dòng sau (thay `<...>` bằng key vừa copy):

```bash
VITE_SUPABASE_URL=https://qyewbxjsiiyufanzcjcq.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key staging>
SUPABASE_SERVICE_ROLE_KEY=<service role key staging>
```

9. **Lưu file.** Không commit file này lên Git.

---

## Bước 3 — Chạy kiểm tra

10. Mở terminal trong thư mục project, chạy lần lượt:

```bash
npm run test:verify-staging-env
npm run test:verify-billing-tenant-mapping
```

11. Cả hai phải kết thúc bằng **PASS** (không có dòng ❌).

---

## Bước 4 — Sau khi PASS

12. Làm **owner smoke** theo checklist có sẵn: `docs/v5/PHASE_20B_OWNER_STAGING_SMOKE_CHECKLIST.md` (17 mục trên Vercel Preview).
13. Kiểm tra **mobile** ít nhất 1 OS: `docs/v5/PHASE_20_MOBILE_PILOT_QA.md`.

---

## Nếu FAIL

- Copy **toàn bộ thông báo lỗi** từ terminal (không copy key).
- Gửi cho engineering/support — **không** gửi `anon` hay `service_role` key.

### Lỗi thường gặp — Staging env (`test:verify-staging-env`)

| Thông báo | Ý nghĩa | Cách xử lý |
|-----------|---------|------------|
| Key placeholder / quá ngắn | Chưa dán key thật hoặc còn giá trị mẫu | Lấy lại anon key từ Dashboard staging |
| Thiếu `VITE_SUPABASE_URL` | Chưa có URL trong `.env.local` | Thêm URL staging ở Bước 2 |
| URL khác `qyewbxjsiiyufanzcjcq` | Sai project | Sửa URL đúng staging |
| Unregistered / Invalid API key | Key không thuộc project | Copy lại cả URL + anon từ **cùng** project staging |
| Thiếu `SUPABASE_SERVICE_ROLE_KEY` | Cảnh báo, script env vẫn có thể PASS | Thêm key để billing mapping kiểm tra đủ profiles |

### Billing tenant mapping (`test:verify-billing-tenant-mapping`)

| Lỗi | Ý nghĩa | Hướng xử lý |
|-----|---------|-------------|
| `Unregistered API key` | Key sai hoặc không cùng project | Sửa `.env.local` |
| `tenant_not_found` | Owner chưa gắn đúng venue | Kiểm tra `profiles.venue_id` |
| `no_subscription` | Venue chưa có trial/active subscription | Tạo trial subscription |
| `owner_not_found` | Email owner chưa có profile | Tạo/cập nhật owner |
| `permission denied` | RLS/role chưa đúng | Kiểm tra role/profile |

SQL alignment (nếu support yêu cầu): `docs/supabase-billing-phase10e-staging-tenant-align.sql`

---

## Tham chiếu

| Tài liệu | Vai trò |
|----------|---------|
| `PHASE_20B_OWNER_STAGING_SMOKE_CHECKLIST.md` | Smoke 17 mục (không tạo checklist mới) |
| `PHASE_21B_GATE1_STAGING_CLOSURE_REPORT.md` | Trạng thái Gate 1 |
| `PHASE_21_COMMERCIAL_READINESS_REPORT.md` | Báo cáo Phase 21 tổng |
