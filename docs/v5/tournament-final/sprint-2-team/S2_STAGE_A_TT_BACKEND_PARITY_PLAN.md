# Tầng A — Kế hoạch chi tiết: Nâng backend Team-Tournament Production TT-1B → TT-4

**Ngày:** 2026-07-15 · **Trạng thái:** 📋 KẾ HOẠCH (chưa thực thi) · Production chưa bị đụng.  
**Là tiền đề của:** `S2_REFEREE_V5_PRODUCTION_PLAN.md` (Tầng B/C: Referee V5 + TT-5).

---

## 1. Bằng chứng migration diff (read-only, 2026-07-15)

**Production — migration history dừng ở `phase_42ka_governance_audit_patch` (20260711).**
- Có: RBAC v52, identity, club governance (42b–42ka), court clusters, rating (phase_29/30), broadcast/vod, AI court engine.
- **KHÔNG có** bất kỳ migration `phase_tt*` / `phase_v5*_referee` / `phase_tt5*` nào.
- Backend team-tournament hiện tại (21 hàm) được seed **ad-hoc mức TT-1B sớm** (get_setup, save/confirm sub_match, submit/lock/publish lineup, upsert_standings…), **không** qua migration.

**Staging — có đầy đủ chuỗi (07-11 → 07-13):**
`phase_tt1b_*` (SSOT + version tables + command log + revisions/dreambreaker/forfeit + command rpcs) → `cc02_rating_v2` → `phase_tt2b/2c/2d_*` (nhiều hotfix) → `phase_v5a_*` (rating + **referee foundation**) → `phase_tt2e_*` → `phase_v5d/v5d1_*` → `phase_tt3_*` → `phase_v5d3_staging_fault_injection` → `phase_tt4_*` → `phase_v5d32` → `phase_tt5b_*` → `tt6b_*`.

**Cảnh báo then chốt:**
1. Staging dựng qua **~50 bước** trộn `apply_migration` + `execute_sql`, kèm nhiều **hotfix** (`tt2d_*_fix`, `tt2e publish_core` áp 2 lần + `get_setup_fix`, `tt3_get_setup_patch_fix`, `tt4_fix_standings_team_count`).
2. Nhiều phần **TT-5C/TT-5D không nằm trong migration list** (áp bằng `execute_sql`/mcp-chunks).
3. Hai môi trường đã **phân kỳ**: Production có vài thứ staging không có (broadcast/vod, ai_court_engine, avatars, 42j1/42k hotfix, `phase_42n1`) và ngược lại.

→ **Không thể** replay production sạch sẽ theo đúng chuỗi lịch sử staging. Phải dùng cách khác (xem §2).

---

## 2. Hai phương án thực hiện Tầng A

### Phương án 1 — **Schema clone từ Staging** ✅ KHUYẾN NGHỊ
Lấy trạng thái **cuối cùng** (đã kiểm chứng) của staging làm nguồn chân lý, thay vì replay lịch sử lộn xộn.

Các bước:
1. `pg_dump` **schema-only** từ staging, lọc đúng nhóm đối tượng team-tournament + referee-v5 + tt5 (tables, functions, types, policies, grants, triggers, indexes). *Không* lấy dữ liệu.
2. Rà soát script dump: bỏ tham chiếu staging-only (fault-injection `p_staging_fault` có thể giữ vì vô hại, hoặc strip), xác nhận không `DROP`/`TRUNCATE` bảng production có dữ liệu.
3. Rehearsal trên **staging clone** (hoặc project tạm) từ ảnh chụp production → chạy dump → verify.
4. Backup/PITR production → chạy trong cửa sổ bảo trì → verify object count khớp staging.

Ưu: khớp chính xác staging đã test; một lần review; tránh 50 bước hotfix.  
Nhược: cần thao tác `pg_dump`/psql (ngoài MCP); phải lọc dump cẩn thận.

### Phương án 2 — **Replay file canonical trong repo**
Áp các file PHASE_* "bản gộp cuối" trong repo theo thứ tự phụ thuộc (bỏ qua các hotfix rời vì file canonical đã gộp).

Thứ tự đề xuất (mỗi bước bọc transaction, verify sau mỗi phase):
1. `docs/v5/PHASE_TT1B_TEAM_TOURNAMENT_SSOT.sql` *(nâng TT-1B sớm → SSOT đầy đủ: version tables, command log, dreambreaker/forfeit revisions, command rpcs)*
2. `docs/v5/PHASE_TT2B_LINEUP_DEADLINE_SERVER_TIME.sql`
3. `docs/v5/PHASE_TT2C_LINEUP_VALIDATION.sql`
4. `docs/v5/PHASE_TT2C_SUBMIT_LINEUP_VALIDATION.sql`
5. `docs/v5/PHASE_TT2D_RANDOMIZE_LOCK_WORKFLOW.sql`
6. `docs/v5/PHASE_TT2E_ATOMIC_PUBLISH_WORKFLOW.sql` *(tạo `begin_command`/`finish_command`/`version_conflict`/`*_ops`)*
7. `docs/v5/PHASE_TT3_LINEUP_OVERRIDE.sql` *(+ dreambreaker states, override, republish, get_setup patch)*
8. `docs/v5/PHASE_TT4_FORFEIT_WITHDRAWAL.sql` *(tạo `recompute_matchup_result`/`recompute_standings_cache`/`apply_forfeit`/`withdraw_team`)*

⚠️ **Bắt buộc kiểm trước:** các file canonical này phải phản ánh **đúng trạng thái cuối** của staging (đã gồm mọi hotfix). Nếu file canonical bị lệch so với hotfix chỉ áp trên staging, Phương án 2 sẽ tạo ra Production **khác** staging → nên rehearsal so khớp `pg_proc`/`information_schema` với staging sau khi chạy.

**Verify sau Tầng A (cả 2 phương án):** số hàm `team_tournament_*` trên Production phải khớp staging (~90, trừ nhóm referee/tt5 sẽ thêm ở Tầng B/C), và có đủ: `begin_command`, `finish_command`, `version_conflict`, `recompute_matchup_result`, `recompute_standings_cache`, `matchup_lineup_ops`, `matchup_publish_ops`, `sub_match_forfeit_ops`, `apply_forfeit`, `withdraw_team`, bảng `team_tournament_dreambreaker_states`.

---

## 3. Rủi ro Tầng A
- **Cao nhất:** các phase này **thay thế** RPC production đang có (`get_setup`, `publish_matchup`, `confirm_sub_match`, `save_lineup_draft`, `save_sub_match_draft`). Nếu có giải/dữ liệu thật đang chạy đường server (B) trên Production → phải kiểm tương thích + **backup định nghĩa RPC cũ** trước.
- Signature RPC đổi (thêm tham số) → client cũ gọi sai. Nhưng app hiện dùng **client blob** cho phần lõi, nên tác động runtime thấp — **cần xác nhận** trước.
- Dữ liệu team-tournament server hiện có trên Production (nếu có) phải tương thích schema mới (version columns, command log…). Kiểm bằng đếm row các bảng `team_tournament_*` trước khi áp.

## 4. Backup & Rehearsal (bắt buộc)
- [ ] PITR/snapshot Production trước khi chạy.
- [ ] Export định nghĩa hiện tại của 5 RPC sẽ bị thay (`pg_get_functiondef`).
- [ ] Rehearsal trên clone → verify khớp staging → mới áp Production.
- [ ] Cửa sổ bảo trì, giờ thấp điểm.

## 5. Rollback Tầng A
- Khôi phục 5 định nghĩa RPC cũ đã export (`create or replace`).
- **Không** drop bảng có dữ liệu; nếu cần lùi hẳn schema → restore từ PITR/snapshot.
- Vì tính năng vẫn sau cờ (`VITE_REFEREE_V5_ENABLED=false`), lùi Tầng B/C bằng tắt cờ trước, không cần đụng Tầng A.

## 6. Khuyến nghị
1. **Phương án 1 (schema clone)** an toàn nhất vì khớp chính xác staging đã kiểm chứng.
2. Coi Tầng A là **một sprint migration riêng** (rủi ro cao nhất trong cả chuỗi), làm trước Tầng B/C.
3. Trước khi bỏ công: trả lời câu hỏi kiến trúc ở `S2_REFEREE_V5_PRODUCTION_PLAN.md §1` — nếu chưa cần live-scoring server thì **chưa cần Tầng A**, giữ trọng tài legacy.

---

## 7. Trạng thái thực thi
Production **KHÔNG bị đụng** — toàn bộ phân tích chỉ dùng lệnh đọc (`list_migrations`, `pg_proc`, `information_schema`).
