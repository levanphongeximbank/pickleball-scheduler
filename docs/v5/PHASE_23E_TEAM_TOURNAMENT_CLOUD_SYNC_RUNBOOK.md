# Phase 23E — Team Tournament Cloud Sync Enable (Owner Runbook)

**Ngày cập nhật:** 2026-07-05  
**Branch:** `v5-platform-edition`  
**Prerequisite:** Phase 23C SQL ✅ PASS (V23-1→V23-5 trên Production) · Phase 23D ✅ PASS trên **staging only**  
**Production Supabase:** `expuvcohlcjzvrrauvud`  
**Staging Supabase:** `qyewbxjsiiyufanzcjcq` — **không** dùng cho Production env

---

## 1. Mục tiêu Phase 23E

Bật **cloud sync giải đồng đội** (`VITE_TEAM_TOURNAMENT_SUPABASE=true`) theo thứ tự an toàn:

1. **Vercel Preview** — smoke test runtime trước  
2. **Migrate blob thật** (nếu venue đã có giải `team_tournament` trên `club_data_v3`) — xem [`PHASE_23E_PRODUCTION_BLOB_MIGRATION.md`](./PHASE_23E_PRODUCTION_BLOB_MIGRATION.md)  
3. **Vercel Production** — chỉ sau Preview PASS + owner sign-off

Phase 23E **không** thêm schema SQL mới (23C đã apply). Phase 23E chỉ: env flags, migration dữ liệu thật (tùy chọn), runtime QA.

---

## 2. Ràng buộc bắt buộc

| ⛔ Không làm trong Phase 23E (trước owner GO) | Lý do |
|-----------------------------------------------|-------|
| Seed fixture / probe lên Production | `tests/fixtures/team-tournament-blob-probe.json`, `phase23d-*` — staging only |
| Apply `PHASE_23D_TEAM_TOURNAMENT_STAGING_PROBE.sql` trên Production | Staging profile/permission helpers |
| Chạy `npm run verify:team-tournament-cloud` với Production URL | Script chặn non-staging ref |
| Redeploy Production trước khi runbook §5 hoàn tất | Tránh bật cloud sync khi chưa migrate / chưa test Preview |
| Ghi `SUPABASE_SERVICE_ROLE_KEY` vào repo hoặc Vercel `VITE_*` | Bảo mật — chỉ local `.env.local` khi migrate |

---

## 3. Trạng thái hiện tại

| Hạng mục | Verdict |
|----------|---------|
| Phase 23C SQL Production | ✅ **PASS** — V23-1→V23-5 (2026-07-05) |
| `team_tournament_*` tables + RLS + RPC | ✅ Applied trên `expuvcohlcjzvrrauvud` |
| `team.*` permissions | ✅ 8 permissions + role_permissions |
| Phase 23D staging seed + probe | ✅ Staging only — **không** mirror sang Production |
| `VITE_TEAM_TOURNAMENT_SUPABASE` Production | ✅ **`true`** — GO 2026-07-05 `dpl_53CoU4LCf48ERhekZt2TVPrBuLD9` |
| `VITE_TEAM_TOURNAMENT_SUPABASE` Preview | ✅ **`true`** |
| Preview cloud sync smoke | ⚠️ **PARTIAL** — Owner chọn **A** 2026-07-05 · [`PHASE_23E_PREVIEW_SMOKE_REPORT.md`](./PHASE_23E_PREVIEW_SMOKE_REPORT.md) |
| Production blob inventory | ✅ **SKIP migrate** — Q1=0, Q2=0 (MCP 2026-07-05) · [`PHASE_23E_PRODUCTION_BLOB_INVENTORY_REPORT.md`](./PHASE_23E_PRODUCTION_BLOB_INVENTORY_REPORT.md) |
| Production redeploy + bật flag | ⛔ **BLOCKED** — chờ Preview PASS + owner signature |

---

## 4. Hành vi env flag (engineering)

App resolve store mode trong `teamTournamentRepository.js`:

| Biến | Giá trị | Hành vi |
|------|---------|---------|
| `VITE_TEAM_TOURNAMENT_SUPABASE` | `false` | **Blob only** — mutations không gọi RPC cloud |
| `VITE_TEAM_TOURNAMENT_SUPABASE` | `true` | **Cloud + blob mirror** — RPC khi Supabase config OK |
| *(unset)* | — | Coi như **bật** cloud nếu có Supabase URL — **Production phải set `false` rõ ràng cho đến GO** |

**Khuyến nghị Production (pre-GO):** `VITE_TEAM_TOURNAMENT_SUPABASE=false`  
**Sau GO:** đổi thành `true` + redeploy (§8)

Ghi đè tùy chọn: `VITE_TEAM_TOURNAMENT_STORE_MODE=local|supabase|memory`

---

## 5. Phase 23C verification đã PASS (V23-1→V23-5)

Owner đã xác nhận trên Production SQL Editor (`expuvcohlcjzvrrauvud`):

| ID | Kiểm tra | Kỳ vọng | Tick |
|----|----------|---------|------|
| **V23-1** | 10 bảng `team_tournament_*` tồn tại | `count = 10` | ✅ |
| **V23-2** | RLS enabled | Mọi bảng `rowsecurity = true` | ✅ |
| **V23-3** | Permissions `team.*` | 8 rows + role_permissions theo role | ✅ |
| **V23-4** | RPC cloud sync | 13 functions `team_tournament_*` + GRANT authenticated | ✅ |
| **V23-5** | Production sạch probe | `count(*)` trên `team_tournaments` = 0 (không seed fixture) | ✅ |

Query mẫu: [`PHASE_23E_PRODUCTION_VERIFICATION_QUERIES.sql`](./PHASE_23E_PRODUCTION_VERIFICATION_QUERIES.sql)

---

## 6. Bước A — Vercel Preview (bật cloud sync trước Production)

> **Mục tiêu:** Runtime smoke với Supabase **staging** + flag bật — **không** đụng Production DB.

### A0 — Prerequisites

- [ ] Staging đã apply 23C + 23D probe (engineering)
- [ ] Staging seed probe **đã chạy** (staging only)
- [ ] Preview env trỏ **staging** ref `qyewbxjsiiyufanzcjcq` — **không** `expuvcohlcjzvrrauvud`

### A1 — Set Preview env (Vercel Dashboard)

1. **Settings → Environment Variables**
2. Filter **Preview**
3. Thêm / cập nhật:

| Biến | Giá trị Preview | Tick |
|------|-----------------|------|
| `VITE_SUPABASE_URL` | `https://qyewbxjsiiyufanzcjcq.supabase.co` | ☐ |
| `VITE_SUPABASE_ANON_KEY` | Staging anon key | ☐ |
| `VITE_RBAC_ENABLED` | `true` | ☐ |
| `VITE_TEAM_TOURNAMENT_SUPABASE` | `true` | ☐ |
| `VITE_SEED_DEMO` | `false` | ☐ |

4. **Save** — trigger redeploy Preview (branch `v5-platform-edition` hoặc PR)

### A2 — Preview smoke checklist (manual)

Đăng nhập staging account (owner / captain / referee theo Phase 23D doc):

| # | Scenario | Kỳ vọng | Tick |
|---|----------|---------|------|
| P23E-1 | BTC mở `/tournament/team/:id` (probe giải) | Load setup; không lỗi RPC | ☐ |
| P23E-2 | Captain A `/team-portal/:tournamentId` | Thấy lineup đội mình; **không** thấy đối thủ trước publish | ☐ |
| P23E-3 | Captain submit lineup | OK; blob + cloud đồng bộ | ☐ |
| P23E-4 | Referee trước publish | Blocked | ☐ |
| P23E-5 | Admin publish → Referee nhập KQ | OK | ☐ |
| P23E-6 | DevTools Network — mutation | Gọi `team_tournament_*` RPC, không fallback `RPC_NOT_DEPLOYED` | ☐ |
| P23E-7 | Tắt flag (`false`) trên Preview build khác | App dùng blob only — regression | ☐ |

**Verdict Preview:** ☐ PASS · ☐ FAIL — ghi vào [`PHASE_23E_PREVIEW_SMOKE_REPORT.md`](./PHASE_23E_PREVIEW_SMOKE_REPORT.md)

---

## 7. Bước B — Production blob migration (chỉ khi cần)

Chỉ chạy khi Production đã có giải `team_tournament` thật trong `club_data_v3` **trước** khi bật flag.

| Tình huống | Hành động |
|------------|-----------|
| Chưa có giải đồng đội thật trên Production | **Bỏ qua** migration — bật flag; giải mới sẽ sync cloud khi tạo |
| Đã có giải đang chạy trên blob | **Bắt buộc** migrate trước GO — xem migration runbook |

Runbook chi tiết: [`PHASE_23E_PRODUCTION_BLOB_MIGRATION.md`](./PHASE_23E_PRODUCTION_BLOB_MIGRATION.md)

---

## 8. Bước C — Production enable (sau Preview PASS)

> ⛔ **Không redeploy Production** cho đến khi: Preview PASS · migration (nếu cần) xong · owner ký §9.

### C1 — Verify Production env (read-only)

| Biến | Trước GO | Sau GO |
|------|----------|--------|
| `VITE_SUPABASE_URL` | ref `expuvcohlcjzvrrauvud` | giữ nguyên |
| `VITE_TEAM_TOURNAMENT_SUPABASE` | `false` hoặc unset → **set `false` rõ** | `true` |
| `VITE_RBAC_ENABLED` | `true` | `true` |

### C2 — Redeploy Production

1. Set `VITE_TEAM_TOURNAMENT_SUPABASE=true` trên **Production** scope  
2. Redeploy từ deployment đã QA (không mix staging env)  
3. Ghi **Deployment ID** rollback

### C3 — Production smoke (24h window)

| # | Scenario | Tick |
|---|----------|------|
| PROD-23E-1 | BTC tạo giải đồng đội mới | ☐ |
| PROD-23E-2 | Tạo đội + gán captain (`profiles.player_id` khớp) | ☐ |
| PROD-23E-3 | Captain portal + submit lineup | ☐ |
| PROD-23E-4 | Referee sau publish | ☐ |
| PROD-23E-5 | BXH cập nhật sau confirm KQ | ☐ |

---

## 9. Rollback

| Sự cố | Rollback |
|-------|----------|
| RPC lỗi / data lệch | Set `VITE_TEAM_TOURNAMENT_SUPABASE=false` → redeploy — app blob-first vẫn hoạt động |
| Migration sai | **Không** xóa bảng; liên hệ engineering — seed idempotent, có thể dry-run diff |
| Preview FAIL | Không tiến sang §8; giữ Production flag OFF |

---

## 10. Owner sign-off

| Vai trò | Preview PASS | Migration (nếu có) | Production GO |
|---------|--------------|--------------------|---------------|
| Engineering | ☐ | ☐ | ☐ |
| Owner | ☐ | ☐ | ☐ |

**Chữ ký / ngày:** _______________

---

## 11. Files liên quan

| File | Vai trò |
|------|---------|
| [`PHASE_23C_TEAM_TOURNAMENT_CLOUD_SYNC.sql`](./PHASE_23C_TEAM_TOURNAMENT_CLOUD_SYNC.sql) | Schema + RLS + RPC (đã apply Production) |
| [`PHASE_23C_PRODUCTION_PERMISSIONS_PATCH.sql`](./PHASE_23C_PRODUCTION_PERMISSIONS_PATCH.sql) | Recovery permissions (nếu cần re-apply) |
| [`PHASE_23D_TEAM_TOURNAMENT_SEED_RLS.md`](./PHASE_23D_TEAM_TOURNAMENT_SEED_RLS.md) | **Staging only** |
| [`PHASE_23E_PRODUCTION_BLOB_MIGRATION.md`](./PHASE_23E_PRODUCTION_BLOB_MIGRATION.md) | Migrate giải thật blob → cloud |
| [`PHASE_23E_PRODUCTION_VERIFICATION_QUERIES.sql`](./PHASE_23E_PRODUCTION_VERIFICATION_QUERIES.sql) | V23-1→V23-5 queries |
| [`PHASE_23E_PREVIEW_SMOKE_REPORT.md`](./PHASE_23E_PREVIEW_SMOKE_REPORT.md) | Template báo cáo Preview |
