# Referee V5 + TT-5 — Production Rollout Plan

**Ngày:** 2026-07-15  
**Trạng thái:** 📋 KẾ HOẠCH (chưa thực thi) — Production chưa bị đụng.  
**Người yêu cầu:** Owner (sau khi chọn HOLD Production TT-5).  
**Cơ sở:** Phân tích read-only 18 file SQL + đối chiếu trực tiếp Production vs Staging (MCP).

---

## 0. TÓM TẮT ĐIỀU HÀNH (đọc phần này trước)

Ban đầu tưởng "Production GO cho TT-5" = áp ~18 file SQL. **Kiểm tra thực tế cho thấy khác hẳn:**

> **Backend team-tournament trên Production đang ở mức ~TT-2. Staging đã ở mức TT-5.**
> Khoảng cách = **toàn bộ** TT-2C/2D/2E + TT-3 + TT-4 (competition-core) **+** nền Referee V5 **+** TT-5.

Nghĩa là muốn đưa TT-5 (trọng tài) lên Production, phải **nâng cả backend giải đồng đội** từ TT-2 → TT-4 **trước**, rồi mới tới Referee V5 + TT-5. Đây là **một dự án migration lớn nhiều tầng**, không phải một lần bấm.

**Số liệu bằng chứng (2026-07-15, read-only):**

| Hạng mục | Production | Staging |
|----------|-----------|---------|
| Hàm `team_tournament_*` | **21** | **~90** |
| Command framework (`begin_command`/`finish_command`/`version_conflict`) | ❌ | ✅ |
| Recompute (`recompute_matchup_result`/`recompute_standings_cache`) | ❌ (chỉ có `upsert_standings` cũ) | ✅ |
| Ops descriptors (`matchup_lineup_ops`/`matchup_publish_ops`/`sub_match_forfeit_ops`) | ❌ | ✅ |
| Forfeit/Withdraw (`apply_forfeit`/`withdraw_team`) | ❌ | ✅ |
| Lineup override / validate / randomize (TT-2C/2D/3) | ❌ | ✅ |
| DreamBreaker (`team_tournament_dreambreaker_states`) | ❌ | ✅ |
| Backend Referee V5 (`match_live_states`,…) | ❌ | ✅ |
| TT-5 bridge/outbox/correction | ❌ | ✅ |
| Rating V5 | ✅ | ✅ |
| Team-tournament base tables (teams/matchups/sub_matches/lineups/standings) | ✅ | ✅ |

**Kết luận:** HOLD của Owner là đúng. TT-5 production **không thể** làm gọn trong 18 file.

---

## 1. CÂU HỎI PHẢI TRẢ LỜI TRƯỚC (quyết định kiến trúc)

Hiện có **2 đường lưu dữ liệu giải đồng đội** song song:

- **(A) Client blob:** app gọi `saveClubData`/`loadClubData` → bảng `club_data_v3`. Đây là đường **các tính năng Sprint 2 lõi** đang dùng (sao chép đội, thay người, KO, BXH, trao giải, đóng giải) → chạy được trên Production hiện tại **không cần** SQL server.
- **(B) Server-authoritative:** bộ RPC/bảng `team_tournament_*` (Production đang ở TT-2). **Referee V5 / TT-5 / TT-6 / mobile multi-device** xây trên đường (B) mức TT-4/TT-5.

→ **Quyết định cần Owner:** có thật sự cần đưa trọng tài giải đồng đội sang **live-scoring server (đường B)** trên Production không?
- **Nếu KHÔNG (khuyến nghị trước mắt):** giữ trọng tài trên đường **legacy** (`tournament_match_live` đã có ở Production). Không cần dự án lớn này. TT-5/TT-6 để sau.
- **Nếu CÓ:** thực hiện dự án 4 tầng ở §2.

---

## 2. CHUỖI ROLLOUT ĐẦY ĐỦ (nếu Owner quyết làm live-scoring server)

### TẦNG A — Nâng backend team-tournament TT-2 → TT-4 (PREREQUISITE lớn nhất)
> 📄 **Kế hoạch chi tiết Tầng A:** `S2_STAGE_A_TT_BACKEND_PARITY_PLAN.md` (đã có migration diff + 2 phương án + rehearsal + rollback).
> Tóm tắt: Production migration history dừng ở 07-11 (không có `tt*`/`v5*` nào); staging dựng qua ~50 bước ad-hoc + hotfix nên **không replay sạch được** → khuyến nghị **schema clone từ staging**.

Áp các phase competition-core còn thiếu (xác nhận danh sách chính xác bằng cách so `list_migrations` staging vs production):
- `PHASE_TT2C_LINEUP_VALIDATION.sql`, `PHASE_TT2C_SUBMIT_LINEUP_VALIDATION.sql`, `PHASE_TT2B_LINEUP_DEADLINE_SERVER_TIME.sql`
- `PHASE_TT2D_RANDOMIZE_LOCK_WORKFLOW.sql`
- `PHASE_TT2E_ATOMIC_PUBLISH_WORKFLOW.sql` (tạo `begin_command`/`finish_command`/`version_conflict`/`*_ops`)
- `PHASE_TT3_LINEUP_OVERRIDE.sql` (+ DreamBreaker states)
- `PHASE_TT4_FORFEIT_WITHDRAWAL.sql` (tạo `recompute_matchup_result`/`recompute_standings_cache`/`apply_forfeit`/`withdraw_team`)

⚠️ **Rủi ro chính:** các phase này **thay thế** RPC đang có ở Production (`get_setup`, `publish_matchup`, `confirm_sub_match`, `save_lineup_draft`…). Nếu có dữ liệu/giải thật đang chạy đường (B) trên Production, phải kiểm tra tương thích + backup định nghĩa RPC cũ trước.

### TẦNG B — Nền Referee V5 (6 file, thứ tự cứng)
1. `referee-v5/PHASE_V5A_REFEREE_FOUNDATION.sql` — 10 bảng (match_live_states, referee_assignments, match_events, match_result_revisions, match_sync_mutations,…) + RLS enable + permissions
2. `referee-v5/PHASE_V5D_REFEREE_PERSISTENCE.sql` — cột bổ sung, helper auth, RLS policies, read RPC
3. `referee-v5/PHASE_V5D1_REFEREE_HARDENING.sql` — `match_integration_outbox`, trigger append-only, commit RPC (service_role), khóa grant
4. `referee-v5/PHASE_V5D32_IDEMPOTENCY_UNDO.sql` — `commit_match_transition` (17-arg) bản idempotency/undo chuẩn
5. `referee-v5/PHASE_V5D4_ATOMIC_ROLLBACK.sql` — `commit_match_finalization` (11-arg) bản chuẩn
6. `referee-v5/PHASE_V5E1_REALTIME_SYNC.sql` — thêm `match_live_states` vào publication `supabase_realtime` *(chỉ cần khi làm TT-6 realtime; TT-5 không bắt buộc → có thể hoãn sang tầng TT-6)*

> Ghi chú: file 4 & 5 có tham số `p_staging_fault` nhưng **vô hại ở Production** (chỉ kích hoạt với match id `REFEREE_V5_TEST_%`) và chứa logic đã sửa đúng → dùng được. Muốn "sạch" thì tạo bản bỏ fault.

### TẦNG C — TT-5 (12 file, thứ tự cứng)
- **TT-5B:** `TT5-B_BRIDGE_SCHEMA.sql` → `TT5-B_PROVISION_RPC.sql` → `TT5-B_LEGACY_LOCK_GUARD.sql` → `TT5-B_GET_SETUP_PATCH.sql`
- **TT-5C:** `TT5-C_RESULT_OUTBOX_CONSUMER.sql` → `TT5-C_RESULT_PROPAGATION.sql` → `TT5-C_STANDINGS_RECOMPUTE.sql` → `TT5-C_REPROVISION_STATE.sql`
- **TT-5D:** `TT5-D_ASSIGNMENT_SAFETY.sql` → `TT5-D_REOPEN_RESULT_REVISION.sql` → `TT5-D_CORRECTION_WORKFLOW.sql` → `TT5-D_SECURITY_GUARDS.sql`

Ràng buộc: outbox FK (TT-5C) cần V5-D1 trước; REOPEN/CORRECTION (TT-5D) gọi consumer của TT-5C; REPROVISION (TT-5C) định nghĩa lại `*_ops` của TT-5B nên chạy sau TT-5B; SECURITY_GUARDS chạy cuối (định nghĩa lại `referee_v5_current_user_has_assignment`).

### TẦNG D — Bật cờ + E2E
- Vercel Production env: `VITE_REFEREE_V5_ENABLED=true`, `VITE_REFEREE_V5_DATA_MODE=remote` (giữ `VITE_TT_REALTIME_ENABLED=false` cho tới TT-6).
- E2E probe: provision 1 trận → nhập điểm → finalize → BXH cập nhật → correction/reopen thử.

---

## 3. PREREQUISITE nền đã CÓ ở Production (đã verify ✅)
`permissions`, `profiles`, `is_super_admin()`, `user_has_permission()`, `gen_random_uuid()`, các bảng team base (teams/matchups/sub_matches/lineups/lineup_entries/disciplines/standings), và các helper TT-2 cơ bản (`resolve_header`, `assert_tenant`, `can_manage`, `write_audit`, `get_setup`, `save_sub_match_draft`, `confirm_sub_match`).

**Thiếu (phải tạo qua Tầng A/B/C):** command framework, recompute, ops descriptors, forfeit/withdraw, lineup override/validate/randomize, dreambreaker, toàn bộ Referee V5 + TT-5.

---

## 4. RỦI RO
- **Tầng A** là rủi ro cao nhất: thay thế RPC production đang có → cần backup định nghĩa cũ + kiểm dữ liệu thật.
- **Tầng B/C:** additive, idempotent, **không** có `DROP TABLE`/`TRUNCATE`/`DELETE` không điều kiện; `ALTER TABLE` chỉ đụng bảng do chính V5-A/V5-D1 tạo (không đụng bảng production cũ). Grant đều qua RLS/SECURITY DEFINER có kiểm auth; nội bộ chỉ `service_role`; không cấp `anon`.
- Nên **bọc mỗi file trong transaction** (một số file chưa tự bọc `begin/commit`).
- Backup/PITR toàn bộ trước Tầng A.

---

## 5. ROLLBACK
| Tầng | Cách lùi |
|------|----------|
| A (TT-2E→TT-4) | Khôi phục định nghĩa RPC cũ đã backup; không drop bảng có dữ liệu |
| B (Referee V5) | `VITE_REFEREE_V5_ENABLED=false`; `revoke execute` RPC V5; **không** xóa `match_events`/revisions/idempotency; legacy referee giữ nguyên |
| C-TT5B | `team_tournament_revoke_referee_link` mỗi link; revoke provision RPC; khôi phục TT-4 của `save_sub_match_draft`/`confirm_sub_match`/`get_setup` |
| C-TT5C | revoke `consume_/drain_referee_v5_outbox`; giữ inbox để audit; recompute lại từ nguồn TT |
| C-TT5D | drop RPC TT-5D theo thứ tự ngược → drop `apply_admin_result_revision` → drop bảng correction → revert `current_user_has_assignment` về bản V5-D1 |

Chi tiết: `referee-v5/V5-D_ROLLBACK_PLAN.md`, `tt5/TT5-B_ROLLBACK.md`, `TT5-C_ROLLBACK.md`, `TT5-D_ROLLBACK.md`.

> **Cần chuẩn bị trước:** export định nghĩa TT-4 hiện tại của `save_sub_match_draft`, `confirm_sub_match`, `get_setup` (bị TT-5B thay) để rollback nhanh không cần restore toàn bộ.

---

## 6. KHUYẾN NGHỊ
1. **Trước mắt:** trả lời câu hỏi §1. Nếu chưa cần live-scoring server cho giải đồng đội → **giữ legacy**, đóng băng kế hoạch này (Sprint 2 lõi vẫn dùng tốt qua client blob).
2. **Nếu quyết làm:** tách thành dự án riêng, ưu tiên **Tầng A** như một sprint độc lập (rủi ro cao nhất), chạy trên **cửa sổ bảo trì** + **backup** + **staging rehearsal** trước.
3. Không gộp TT-6 realtime vào lần này (chỉ thêm sau khi Tầng B/C ổn định).

---

## 7. Trạng thái thực thi
- Production: **KHÔNG đụng** (toàn bộ chỉ chạy lệnh đọc).
- Bằng chứng verify: mục §0 (Production 21 hàm vs Staging ~90 hàm; thiếu backend Referee V5).
