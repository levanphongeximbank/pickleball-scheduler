# Deployment Guide — Pickleball Scheduler Pro v4.0.0 GA

Hướng dẫn triển khai **Production** cho Version 4.0 General Availability.

**Liên quan:** `docs/DEPLOY.md` (chi tiết Vercel CLI), `docs/RELEASE-4.0-RC.md` (RC Go/No-Go)

---

## Tổng quan kiến trúc

| Thành phần | Vai trò |
|------------|---------|
| **Vercel** | Host SPA React (`dist/`) |
| **Supabase** | Auth, RLS, cloud sync, Realtime, RPC |
| **GitHub Actions** | Lint + test + build + deploy (optional) |

App chạy **local-only** nếu không có Supabase; **production GA yêu cầu** Supabase + RBAC.

---

## Quy trình GA (Sprint 12)

```
Phase 1  Env checklist     → docs/GA-PRODUCTION-ENV-CHECKLIST.md
Phase 2  SQL production    → docs/SUPABASE-PRODUCTION-CHECKLIST.md  (bạn chạy thủ công)
Phase 3  Production QA     → docs/GA-PRODUCTION-QA.md
Phase 4  Release docs      → CHANGELOG, RELEASE_NOTES, VERSION
Phase 5  Git tag v4.0.0    → sau QA pass (không auto-push)
Phase 6  Final audit       → docs/GA-FINAL-AUDIT.md
```

---

## Bước 1 — Supabase Production

1. Tạo hoặc xác nhận project **production** (tách staging).
2. Bật Email Auth.
3. **Backup** trước migration.
4. Chạy 15 file SQL theo `docs/SUPABASE-PRODUCTION-CHECKLIST.md`.
5. Bật Realtime: `tournament_match_live`.
6. Tạo SUPER_ADMIN + venue + role users vận hành.

---

## Bước 2 — Vercel Production

### Environment Variables (bắt buộc)

| Biến | Giá trị GA |
|------|------------|
| `VITE_SUPABASE_URL` | Production URL |
| `VITE_SUPABASE_ANON_KEY` | Production anon key |
| `VITE_RBAC_ENABLED` | **`true`** |
| `VITE_SEED_DEMO` | `false` |
| `VITE_PAYMENT_MODE` | `dev` (hoặc `stripe`) |

### Feature flags (GA default OFF)

```
VITE_ENABLE_AI_ENGINE=false
VITE_API_ENABLED=false
VITE_MARKETPLACE_ENABLED=false
```

Xem đầy đủ: `docs/GA-PRODUCTION-ENV-CHECKLIST.md`

### Deploy

**CLI:**

```powershell
cd C:\Users\LePhong\pickleball-scheduler
npm run build
npx vercel deploy --prod
```

**Hoặc:** push `main` → GitHub Actions (`.github/workflows/deploy.yml`)

### Domain

- Gắn custom domain trên Vercel → Production
- Xác nhận HTTPS + PWA manifest

---

## Bước 3 — GitHub Actions (optional)

Secrets cần có:

- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Variables (khuyến nghị):

- `VITE_RBAC_ENABLED=true`
- `VITE_PAYMENT_MODE=dev`

Workflow chạy: lint → test:unit → build → deploy `--prod`.

---

## Bước 4 — Smoke test sau deploy

1. Mở production URL → `/login`
2. **Cài đặt** → chip Supabase **xanh**
3. Đồng bộ cloud → kiểm tra `club_data_v3`
4. Chạy checklist `docs/GA-PRODUCTION-QA.md`

---

## Bật tính năng preview sau GA

| Tính năng | Env | SQL |
|-----------|-----|-----|
| AI Assistant | `VITE_ENABLE_AI_ENGINE=true` | `supabase-ai-assistant-sprint7.sql` (đã chạy ở bước 13) |
| API | `VITE_API_ENABLED=true` | `supabase-sprint10.sql` (bước 15) |
| Marketplace | `VITE_MARKETPLACE_ENABLED=true` | (cùng sprint10) |
| Stripe live | `VITE_PAYMENT_MODE=stripe` + links | — |

Redeploy sau mỗi lần đổi env.

---

## Rollback

| Tình huống | Hành động |
|------------|-----------|
| App lỗi sau deploy | Vercel → redeploy deployment trước |
| RBAC chặn toàn bộ | Kiểm tra SQL + profiles; tạm `VITE_RBAC_ENABLED=false` **chỉ khẩn cấp** |
| RLS lỗi | Rollback SQL theo file `*-rollback.sql` |
| Database hỏng | Restore Supabase backup/PITR |

---

## Bảo mật

- Không commit `.env` / secrets
- Anon key trong client — **RLS bắt buộc** trên production
- Referee: chỉ RPC token-scoped, không anon select trực tiếp
- Service role key **không** đặt Vercel client env
- Preview/Production: dev login và RBAC toggle UI bị khóa

---

## Release tag

Sau QA pass:

```bash
git tag -a v4.0.0 -m "Pickleball Scheduler Pro v4.0.0 GA"
git push origin v4.0.0   # chỉ khi bạn sẵn sàng
```

---

## Checklist nhanh

- [ ] SQL 15 bước production
- [ ] Vercel env + RBAC true
- [ ] Realtime bật
- [ ] SUPER_ADMIN + venue
- [ ] QA 8 roles pass
- [ ] Tag v4.0.0
- [ ] `docs/GA-FINAL-AUDIT.md` = READY
