# S2 — Production GO Runbook (TT-5 / TT-6)

**Trạng thái:** ⛔ **HOLD (2026-07-15)** — Owner chọn HOLD; Production giữ nguyên trạng, chưa áp SQL.  
**Nguyên tắc:** merge PR ≠ deploy Production. Feature giữ khóa sau cờ đến khi các bước dưới hoàn tất.

> **⚠️ Chặn cứng phát hiện khi pre-check Production (read-only, 2026-07-15):**
> Production **thiếu toàn bộ backend Referee V5** (`match_live_states`, `match_result_revisions`, `referee_assignments`, `match_events`).
> TT-5 là lớp cầu nối Team Tournament ↔ Referee V5 nên **KHÔNG thể áp 12 file TT-5 khi chưa có nền Referee V5**.
> Trước TT-5 phải áp nền Referee V5: `docs/v5/referee-v5/PHASE_V5A_REFEREE_FOUNDATION.sql`, `PHASE_V5D_REFEREE_PERSISTENCE.sql`, `PHASE_V5D1_REFEREE_HARDENING.sql`, `PHASE_V5D32_IDEMPOTENCY_UNDO.sql`, `PHASE_V5D4_ATOMIC_ROLLBACK.sql`, `PHASE_V5E1_REALTIME_SYNC.sql` (xác nhận thứ tự/deps trước khi chạy).
> Nền đã có sẵn ở Production: Team Tournament (TT-1…TT-4) ✅, Rating V5 ✅.

---

## 0. Điều kiện tiên quyết

- [ ] PR #11 đã merge vào `main`
- [ ] Smoke Staging (`S2_STAGING_SMOKE_CHECKLIST.md`) đạt
- [ ] Backup / snapshot Supabase Production
- [ ] Cửa sổ bảo trì (giờ thấp điểm)

---

## 0.5. Pre-check nền Production (read-only, chạy trước)

TT-5/TT-6 phụ thuộc nền team-tournament + referee-v5. Chạy query này **trước** để chắc nền đã có:

```sql
select
  to_regclass('public.team_tournament_sub_matches')       as tt_base,
  to_regclass('public.match_live_states')                 as referee_v5_base,
  to_regclass('public.match_result_revisions')            as revisions_base,
  to_regclass('public.team_sub_match_referee_links')      as tt5_bridge_already,
  to_regclass('public.team_tournament_realtime_events')   as tt6_realtime_already;
```

- `tt_base` và `referee_v5_base` = NULL → **DỪNG**: nền chưa có, không apply TT-5.
- `tt5_bridge_already` đã tồn tại → TT-5 đã áp một phần, rà trước khi chạy lại.

## 1. TT-5 Referee — apply SQL Production (đúng thứ tự)

Chạy lần lượt từng file (Supabase SQL Editor hoặc MCP `apply_migration`):

**TT-5B (bridge + provision + legacy lock):**
- [ ] `docs/v5/team-tournament/tt5/TT5-B_BRIDGE_SCHEMA.sql`
- [ ] `docs/v5/team-tournament/tt5/TT5-B_PROVISION_RPC.sql`
- [ ] `docs/v5/team-tournament/tt5/TT5-B_LEGACY_LOCK_GUARD.sql`
- [ ] `docs/v5/team-tournament/tt5/TT5-B_GET_SETUP_PATCH.sql`

**TT-5C (outbox consumer + propagation):**
- [ ] `docs/v5/team-tournament/tt5/TT5-C_RESULT_OUTBOX_CONSUMER.sql`
- [ ] `docs/v5/team-tournament/tt5/TT5-C_RESULT_PROPAGATION.sql`
- [ ] `docs/v5/team-tournament/tt5/TT5-C_STANDINGS_RECOMPUTE.sql`
- [ ] `docs/v5/team-tournament/tt5/TT5-C_REPROVISION_STATE.sql`

**TT-5D (assignment safety + correction + reopen):**
- [ ] `docs/v5/team-tournament/tt5/TT5-D_ASSIGNMENT_SAFETY.sql`
- [ ] `docs/v5/team-tournament/tt5/TT5-D_REOPEN_RESULT_REVISION.sql`
- [ ] `docs/v5/team-tournament/tt5/TT5-D_CORRECTION_WORKFLOW.sql`
- [ ] `docs/v5/team-tournament/tt5/TT5-D_SECURITY_GUARDS.sql`

**TT-6B (realtime — chỉ khi bật realtime):**
- [ ] `docs/v5/team-tournament/tt6/TT6-B_REALTIME_CORE.sql`
- [ ] `docs/v5/team-tournament/tt6/TT6-B_REALTIME_SECURITY.sql`

Kiểm tra sau apply (`execute_sql`, Production):
- [ ] Có đủ bảng: `team_sub_match_referee_links`, `match_integration_outbox`, `team_tournament_referee_event_inbox`, `team_tournament_referee_correction_requests`, `match_result_revisions`, `match_live_states`, `referee_assignments`, `match_events`
- [ ] Có đủ RPC: `team_tournament_provision_referee_match`, `team_tournament_revoke_referee_link`, `team_tournament_resync_referee_link`, `team_tournament_consume_referee_v5_outbox`, `referee_v5_apply_admin_result_revision`
- [ ] Panel **Sẵn sàng trọng tài** (Production) chuyển từ NOT_APPLIED → READY

---

## 2. Cờ ứng dụng (Production env)

Bật tuần tự, kiểm tra sau mỗi bước:

- [ ] `VITE_REFEREE_V5_ENABLED=true`
- [ ] `VITE_REFEREE_V5_DATA_MODE=remote`
- [ ] `VITE_TT_REALTIME_ENABLED=true` (chỉ khi muốn realtime; mặc định giữ OFF)
- [ ] `VITE_TT_REALTIME_DEBUG` = false

Cổng chính sách S2-G: Production ON cần Owner override — kiểm bằng panel **Cổng realtime**.

---

## 3. E2E Production (probe)

- [ ] Provision 1 trận trọng tài trên giải probe
- [ ] Nhập điểm → finalize → BXH đội cập nhật đúng
- [ ] Đa thiết bị: BTC + đội trưởng + trọng tài thấy cập nhật; đội trưởng vẫn bị cô lập lineup đối thủ
- [ ] Mất mạng → poll fallback → reconnect OK

---

## 4. Rollback

| Lớp | Cách lùi |
|-----|----------|
| Cờ realtime | `VITE_TT_REALTIME_ENABLED=false` |
| Referee V5 | `VITE_REFEREE_V5_ENABLED=false` |
| Bridge | Ngừng provision; legacy lock nhả khi revoke/flag off |
| Consumer | Thu hồi quyền gọi `team_tournament_consume_referee_v5_outbox`; giữ outbox |
| SQL | Theo `TT5-B/C/D_ROLLBACK.md` (đảo thứ tự D→C→B) |

**Không** hard-delete `match_result_revisions` / inbox đã áp — giữ lịch sử chính thức.

---

## 5. Ký duyệt

- [ ] Owner xác nhận Production GO
- [ ] Người thực hiện: __________  Ngày: __________
- [ ] Kết quả E2E: ☐ PASS ☐ FAIL (đính kèm evidence)
