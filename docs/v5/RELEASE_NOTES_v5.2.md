# Release Notes — V5.2 Production Pilot

**Package:** `5.2.0`  
**UI label:** `V5.2 Production Pilot`  
**Tag:** `v5.2.0`  
**Ngày:** 2026-07-05  
**Branch:** `v5-platform-edition`

---

## Đã đạt (V5.2)

### RBAC & Identity
- Vai trò **SYSTEM_TECHNICIAN** (kỹ thuật viên hệ thống) + menu zone riêng
- Vai trò **TEAM_CAPTAIN** (đội trưởng) + scope `tournament_id` / `team_id`
- Ma trận permission V5.2 (~40 quyền mới: kỹ thuật, đội trưởng, giải đồng đội)
- Menu lọc theo RBAC fail-closed (sidebar + in-page hub)
- SQL production: `PHASE_V52_PRODUCTION_RBAC_ROLES.sql`

### Navigation V5
- Sidebar accordion 2 cấp (cấp 1 → cấp 2)
- Menu audit **100% LIVE** (77 mục sidebar)
- **Vui chơi mỗi ngày** dưới **CLB & Huấn luyện**
- Trang tạo giải bỏ nhãn V3.3

### Modules (Phases 24–29)
- Dashboard action queue, venue ops, customer groups
- Tournament phase 25 (presets, eligibility, fees, referee, awards)
- Finance ledger, CRM, coaching, AI alerts, admin hours/staff, support FAQ

### Team tournament cloud
- `VITE_TEAM_TOURNAMENT_SUPABASE=true` trên Production (Phase 23E)

### Quality gates
- **902/902** unit tests PASS
- `npm run build` PASS
- `rbac-v52.test.js` trong CI

---

## Phạm vi Production Pilot

| ✅ Trong phạm vi | ⛔ Ngoài phạm vi |
|-----------------|-----------------|
| Deploy Vercel Production | Commercial GA / bán rộng |
| RBAC production bật | Payment live |
| Owner smoke 24h | API/Marketplace production |
| Bootstrap tenant test | Gate 4/5 |

---

## Owner actions sau deploy

1. Apply `docs/v5/PHASE_V52_PRODUCTION_RBAC_ROLES.sql` trên Supabase Production
2. Cập nhật `tournament_id` / `team_id` cho `doitruong@gmail.com`
3. Supabase Auth → Site URL Production (sửa reset password localhost)
4. Smoke §16 `PHASE_19B_CONTROLLED_PRODUCTION_TEST_REPORT.md`
5. PROD-23E-1 → 5 team tournament smoke

---

## Rollback

- **App:** Vercel Promote deployment trước V5.2 (ghi trong `V5_2_PRODUCTION_GO_REPORT.md`)
- **SQL:** Additive only — không rollback trừ khi owner quyết định revert role

---

## Tham chiếu

| File | Mục đích |
|------|----------|
| `V5_2_PRODUCTION_DEPLOY_CHECKLIST.md` | Checklist deploy |
| `V5_2_PRODUCTION_GO_REPORT.md` | GO report + deployment ID |
| `PHASE_V52_PRODUCTION_RBAC_ROLES.sql` | SQL V5.2 roles |
