# Release 4.0.0 GA — Go/No-Go (Sprint 12)

**Phiên bản:** `4.0.0` General Availability  
**Release Date:** 2026-07-01  
**Tiền đề:** Sprint 11 RC pass (`docs/RELEASE-4.0-RC.md`)

---

## Phases

| Phase | Checklist | Ai thực hiện |
|-------|-----------|---------------|
| 1 | `docs/GA-PRODUCTION-ENV-CHECKLIST.md` | Bạn (Vercel/Supabase/GitHub) |
| 2 | `docs/SUPABASE-PRODUCTION-CHECKLIST.md` | Bạn (SQL thủ công) |
| 3 | `docs/GA-PRODUCTION-QA.md` | Bạn (QA 8 roles) |
| 4 | `RELEASE_NOTES_v4.0.md`, `CHANGELOG.md`, … | ✅ Done |
| 5 | Tag `v4.0.0` | Bạn (sau QA) |
| 6 | `docs/GA-FINAL-AUDIT.md` | Agent + bạn xác nhận |

---

## Code/CI (đã pass)

| Lệnh | Kết quả |
|------|---------|
| `npm run lint` | 0 errors |
| `npm run test:unit` | 551 pass |
| `npm run build` | PASS |

---

## Go GA khi

- [ ] Phase 1 env tick hết
- [ ] Phase 2 SQL 15 bước + verify schema
- [ ] Phase 3 QA pass
- [ ] Tag `v4.0.0` (optional push)

## No-Go nếu

- RLS chưa apply → RBAC bật sẽ chặn/lộ dữ liệu
- Profile/sync lỗi sau login production
- Blocker P0 trong QA

**Kết luận hiện tại:** `docs/GA-FINAL-AUDIT.md` → **BLOCKED** (chờ bạn Phase 1–3)
