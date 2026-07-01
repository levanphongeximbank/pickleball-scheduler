# Staging Apply & QA — Mobile Sprint 9 (Phase 8 GA)

**Ngày chạy:** 2026-07-01  
**Project staging:** `qyewbxjsiiyufanzcjcq.supabase.co` (từ `.env.local`)  
**SQL:** `docs/supabase-mobile-sprint9.sql`  
**GA checklist:** [PHASE_8_MOBILE_GA_CHECKLIST.md](./PHASE_8_MOBILE_GA_CHECKLIST.md)

---

## 1. Apply SQL trên staging

### Kết quả

| Bước | Trạng thái | Ghi chú |
|------|------------|---------|
| Apply `supabase-mobile-sprint9.sql` | ✅ **Đã có sẵn** | Verify script xác nhận 4/4 bảng tồn tại |
| Rollback cần thiết? | Không | Không apply lại nếu đã có bảng |

### Cách verify (đã chạy)

```bash
node scripts/verify-mobile-sprint9-staging.mjs
```

**Output:**

```
✅ push_subscriptions — tồn tại (RLS chặn anon)
✅ notifications — tồn tại (RLS chặn anon)
✅ qr_tokens — tồn tại (RLS chặn anon)
✅ checkins — tồn tại (RLS chặn anon)
```

### Nếu cần apply lần đầu (project mới)

1. Supabase Dashboard → **SQL Editor** → New query  
2. Dán nội dung `docs/supabase-mobile-sprint9.sql` → **Run**  
3. Verify:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('push_subscriptions','notifications','qr_tokens','checkins');
```

Kỳ vọng: 4 dòng, `rowsecurity = true`.

### Verify RLS sâu hơn (tuỳ chọn)

Thêm vào `.env.local` (không commit):

```
SUPABASE_SERVICE_ROLE_KEY=<service_role từ Dashboard → Settings → API>
```

Chạy lại `node scripts/verify-mobile-sprint9-staging.mjs` — script sẽ probe thêm với service role.

---

## 2. GA checklist — kết quả đã chạy

### §1 RLS / Supabase

| # | Mục | Kết quả | Bằng chứng |
|---|-----|---------|-----------|
| 1.1 | RLS bật 4 bảng | ✅ PASS | `verify-mobile-sprint9-staging.mjs` — anon bị chặn |
| 1.2 | Tenant A ≠ notification tenant B | ⚠️ CODE | `mobile-phase8-product.test.js` — dispatch tenant filter |
| 1.3 | Tenant A ≠ push_subscriptions tenant B | ☐ STAGING | Cần 2 user + service role SQL |
| 1.4 | PLAYER không đọc admin notification | ✅ PASS | `filterNotificationsByRole` tests |
| 1.5 | QR không bypass tenant_id | ✅ PASS | `mobile-phase8-hardening` QR suite |
| 1.6 | Expired tenant lock | ✅ PASS | `canAccessMobileRoute` test |

### §2 RBAC mobile routes

| # | Route | Kết quả |
|---|-------|---------|
| 2.1–2.6 | Mobile routes | ✅ PASS — `mobile-phase8-hardening` + `mobile-phase8-product` |
| 2.7 | Referee match guard | ✅ PASS — 5 tests |
| 2.8 | Cashier không billing | ✅ PASS — operations dashboard test |

### §3 Push notification

| # | Mục | Kết quả |
|---|-----|---------|
| 3.4–3.5 | Tenant/role dispatch | ✅ PASS — product tests |
| 3.7 | Unsupported browser | ✅ PASS |
| 3.1–3.3, 3.6, 3.8 | UI / staging E2E | ☐ MANUAL — cần mở app staging trên browser |

### §4 PWA

| # | Mục | Kết quả |
|---|-----|---------|
| 4.1–4.2 | Icons + manifest config | ✅ PASS |
| 4.3 | Build `manifest.webmanifest` + `sw.js` | ✅ PASS |
| 4.4–4.5 | Install prompt / standalone | ☐ MANUAL — device hoặc Chrome DevTools |

### §5 Device QA

| Nền tảng | Kết quả |
|----------|---------|
| Android Chrome | ☐ MANUAL |
| iPhone Safari | ☐ MANUAL |
| Desktop Chrome PWA | ☐ MANUAL |

### §6–§8 Player / Operations / Offline

| Mục | Kết quả |
|-----|---------|
| Player shell service | ✅ PASS — product tests |
| Operations dashboard | ✅ PASS — product tests |
| Offline match_score block | ✅ PASS — hardening tests |

### §9 Automated tests

| Lệnh | Kết quả |
|------|---------|
| `mobile-phase8-hardening.test.js` | ✅ 24/24 |
| `mobile-phase8-product.test.js` | ✅ 14/14 |
| `mobile-sprint9.test.js` | ✅ 19/19 |
| `npm run lint` | ✅ 0 errors, 125 warnings |
| `npm run build` | ✅ `dist/manifest.webmanifest`, `dist/sw.js` |

**Tổng:** 57/57 tests PASS

---

## 3. Manual QA trên staging app (bạn làm trên điện thoại)

Mở app staging (Vercel Preview hoặc `npm run dev` + `.env.local`):

### Checklist nhanh (~30 phút)

**PWA**
- [ ] Android/iOS: Add to Home Screen
- [ ] Icon hiển thị đúng
- [ ] Mở từ icon → standalone (không URL bar)

**Mobile routes (đăng nhập từng role)**
- [ ] PLAYER: vào được `/mobile/player`, **không** vào `/mobile/check-in`
- [ ] COURT_OWNER: bottom nav "Vận hành" → `/mobile/operations`
- [ ] CASHIER: `/mobile/operations` — thấy booking chờ thanh toán, không thấy billing admin

**QR**
- [ ] `/mobile/qr-generate` → tạo QR
- [ ] `/mobile/qr-scan` → quét OK
- [ ] QR tenant khác → từ chối

**Notifications**
- [ ] `/mobile/notifications` → Bật thông báo (chỉ khi bấm)
- [ ] Toggle từng loại ON/OFF

**Offline**
- [ ] Airplane mode → banner offline
- [ ] Check-in offline → pending → sync khi online

---

## 4. Go / No-Go staging

| Tiêu chí | Trạng thái |
|----------|------------|
| SQL Sprint 9 trên staging | ✅ Đã apply |
| Automated mobile tests | ✅ 57/57 |
| Lint / build | ✅ PASS |
| RLS bảng mobile (probe) | ✅ PASS |
| Device QA manual | ☐ Chưa — cần spot-check 1 Android + 1 iOS |
| 2-user tenant RLS SQL | ☐ Tuỳ chọn — service role |

**Đề xuất:** **Conditional Go** cho staging technical QA — tiếp tục device manual QA trước khi GA production mobile.

---

## 5. Lệnh tái chạy

```bash
# Verify bảng staging
node scripts/verify-mobile-sprint9-staging.mjs

# Full automated GA
node --test tests/mobile-phase8-hardening.test.js
node --test tests/mobile-phase8-product.test.js
node --test tests/mobile-sprint9.test.js
npm run lint
npm run build
```
