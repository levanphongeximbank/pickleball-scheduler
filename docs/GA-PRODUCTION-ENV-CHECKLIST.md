# Phase 1 — Production Environment Checklist (Sprint 12 GA)

**Mục tiêu:** Xác nhận môi trường Production sẵn sàng trước khi gắn tag `v4.0.0`.  
**Không tự thay đổi** cấu hình Vercel/Supabase/GitHub — bạn thực hiện thủ công và tick từng mục.

---

## 1. Vercel Environment Variables (Production)

Vercel Dashboard → Project → **Settings → Environment Variables** → scope **Production**.

| Biến | Giá trị GA | Bắt buộc | Ghi chú |
|------|------------|----------|---------|
| `VITE_SUPABASE_URL` | URL project **production** | ✅ | Khác staging |
| `VITE_SUPABASE_ANON_KEY` | Anon key production | ✅ | |
| `VITE_RBAC_ENABLED` | **`true`** | ✅ | Deny-by-default khi build PROD |
| `VITE_SEED_DEMO` | `false` | ✅ | Không seed demo trên production |
| `VITE_PAYMENT_MODE` | `dev` hoặc `stripe` | ✅ | GA: `dev` nếu chưa có Payment Links |
| `VITE_ENABLE_AI_ENGINE` | `false` | Khuyến nghị | Bật sau QA + SQL sprint7 |
| `VITE_API_ENABLED` | `false` | Khuyến nghị | Preview-only |
| `VITE_MARKETPLACE_ENABLED` | `false` | Khuyến nghị | Preview-only |
| `VITE_PAYMENT_DEFAULT_PROVIDER` | `mock` | Tùy chọn | Sprint 10 integrations |
| `VITE_STRIPE_LINK_*` | (trống hoặc links) | Khi `stripe` | Starter/Pro/Enterprise |

### Feature flags preview (mặc định GA = OFF)

| Flag | GA default | Khi bật cần thêm |
|------|------------|------------------|
| `VITE_ENABLE_AI_ENGINE` | `false` | SQL `supabase-ai-assistant-sprint7.sql` |
| `VITE_API_ENABLED` | `false` | SQL `supabase-sprint10.sql` |
| `VITE_MARKETPLACE_ENABLED` | `false` | SQL `supabase-sprint10.sql` |
| `VITE_VNPAY_ENABLED` | `false` | Credentials + Edge/webhook |
| `VITE_MOMO_ENABLED` | `false` | Credentials + Edge/webhook |
| `VITE_STRIPE_ENABLED` | `false` | Secret keys (server-side only) |
| `VITE_ZALO_OA_ENABLED` | `false` | Zalo OA tokens |
| `VITE_EMAIL_ENABLED` | `false` | SMTP |
| `VITE_SMS_ENABLED` | `false` | SMS provider |

- [ ] Tất cả biến bắt buộc đã set trên **Production**
- [ ] Preview/Development dùng project Supabase **staging** (không lẫn production)
- [ ] **Redeploy** Production sau khi đổi env

**Tham chiếu:** `.env.production.example`, `.env.example`

---

## 2. Supabase Production

- [ ] Project Supabase **production** tách biệt staging
- [ ] **Email Auth** bật (Authentication → Providers)
- [ ] Email confirmation policy đã chọn (bật/tắt theo chính sách vận hành)
- [ ] **Realtime** bật cho bảng `tournament_match_live` (Database → Replication)
- [ ] Backup / PITR đã bật (Settings → Database → Backups)
- [ ] Service role key **không** đặt trong Vercel client env

**SQL:** Chạy theo `docs/SUPABASE-PRODUCTION-CHECKLIST.md` (Phase 2).

---

## 3. GitHub Actions

File: `.github/workflows/deploy.yml`

| Bước CI | Kỳ vọng GA |
|---------|------------|
| `npm run lint` | 0 errors (warnings hooks OK) |
| `npm run test:unit` | 551+ pass |
| `npm run build` | Pass |
| Deploy Vercel `--prod` | Chỉ sau push `main`/`master` |

### Secrets (GitHub → Settings → Secrets and variables)

| Secret / Variable | Mục đích |
|-------------------|----------|
| `VERCEL_TOKEN` | Deploy |
| `VERCEL_ORG_ID` | Deploy |
| `VERCEL_PROJECT_ID` | Deploy |
| `VITE_SUPABASE_URL` | Build production |
| `VITE_SUPABASE_ANON_KEY` | Build production |
| `VITE_RBAC_ENABLED` (variable) | Mặc định workflow: `true` |
| `VITE_PAYMENT_MODE` (variable) | Mặc định: `dev` |

- [ ] Secrets đã cấu hình đủ
- [ ] Workflow chạy pass trên nhánh `main` gần nhất
- [ ] Branch protection (nếu có) không chặn deploy hợp lệ

---

## 4. Production Domain

- [ ] Domain custom gắn Vercel Production (hoặc chấp nhận `*.vercel.app`)
- [ ] HTTPS hoạt động
- [ ] DNS không trỏ nhầm sang preview/staging
- [ ] PWA manifest load đúng origin (icon, `manifest.webmanifest`)

---

## 5. RBAC Enabled

Code: `src/auth/config.js` — production build mặc định RBAC **bật** khi `VITE_RBAC_ENABLED` không set.

- [ ] Vercel Production: `VITE_RBAC_ENABLED=true` (explicit, không rely mặc định)
- [ ] Sau deploy: đăng nhập user thường **không** bypass guard
- [ ] Dev login / RbacDevPanel **không** hiện trên Production
- [ ] Profile load từ `public.profiles` (không fallback PLAYER metadata)

---

## 6. Feature Flags — Bảo vệ preview

- [ ] Menu Marketplace, Tích hợp, Admin Integration **ẩn** khi flags OFF
- [ ] Truy cập URL trực tiếp `/marketplace`, integration pages → thông báo "chưa bật", không white screen
- [ ] Tab AI Assistant **ẩn** khi `VITE_ENABLE_AI_ENGINE=false`
- [ ] API router trả lỗi có ý nghĩa khi `VITE_API_ENABLED=false`

---

## Phase 1 — Kết luận

| Trạng thái | Điều kiện |
|------------|-----------|
| **PASS** | Tất cả checkbox trên đã tick |
| **BLOCKED** | Thiếu env, RBAC chưa true, hoặc lẫn staging/production |

**Bước tiếp:** `docs/SUPABASE-PRODUCTION-CHECKLIST.md` → `docs/GA-PRODUCTION-QA.md`
