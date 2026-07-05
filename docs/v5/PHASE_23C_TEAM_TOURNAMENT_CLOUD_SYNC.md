# Phase 23C — Team Tournament Cloud Sync (RPC + RLS)

## Mục tiêu

Đưa dữ liệu giải đồng đội từ club blob sang Supabase cloud sync an toàn, multi-tenant, có RLS và RPC rõ ràng — cho phép BTC, đội trưởng, trọng tài dùng chung dữ liệu thật.

**Phạm vi Phase 23C:**
- Schema + RLS + RPC Supabase
- Service layer cloud mode (fallback blob)
- Unit tests wrapper
- **Không** thay đổi UI lớn
- **Không** RefereeHub

## Kiến trúc

```
App (blob-first, không đổi UI)
  └── teamTournamentService.js
        ├── local: loadClubData / saveClubData (demo + offline)
        └── cloud: teamTournamentCloudSync.js
              └── teamTournamentRpcService.js → Supabase RPC
```

### Chế độ lưu trữ

| Mode | Điều kiện |
|------|-----------|
| `memory` | `NODE_ENV=test` hoặc `VITEST=true` |
| `supabase` | `hasSupabaseConfig()` + `VITE_TEAM_TOURNAMENT_SUPABASE !== false` |
| `local` | Mặc định — chỉ blob |

Ghi đè: `VITE_TEAM_TOURNAMENT_STORE_MODE=supabase|local|memory`

## Bảng Supabase

Migration: [`PHASE_23C_TEAM_TOURNAMENT_CLOUD_SYNC.sql`](./PHASE_23C_TEAM_TOURNAMENT_CLOUD_SYNC.sql)

| Bảng | Mô tả |
|------|-------|
| `team_tournaments` | Header giải (`tenant_id`, `club_id`, `tournament_id`, `settings`) |
| `team_tournament_teams` | Đội (`external_team_id` ↔ blob `id`) |
| `team_tournament_team_members` | Roster normalized + role (`member`/`captain`/`deputy`) |
| `team_tournament_disciplines` | Nội dung thi đấu |
| `team_tournament_matchups` | Lượt đối đầu + `result` jsonb |
| `team_tournament_lineups` | Đội hình per team per matchup (`selections` jsonb) |
| `team_tournament_lineup_entries` | Selections normalized (discipline + player) |
| `team_tournament_sub_matches` | Trận con + score |
| `team_tournament_standings` | BXH cache |
| `team_tournament_audit_logs` | Audit chuyên giải đồng đội |

Tất cả bảng có: `tenant_id` (FK → `venues.id`), `tournament_id`, `created_at`/`updated_at`, `created_by`/`updated_by` (nếu phù hợp).

> **Lưu ý:** `tenant_id` dùng `text` (khớp `venues.id` production). Phase 23 gốc dùng `uuid` — 23C chuẩn hóa lại.

## RLS

### Tenant isolation (tất cả bảng)

```sql
-- SELECT: super admin OR cùng venue
tenant_id = (select venue_id from profiles where id = auth.uid())

-- WRITE: super admin OR (cùng venue AND team_tournament_can_manage())
```

### Quy tắc nghiệp vụ (trong RPC security definer)

| Vai trò | Quyền |
|---------|-------|
| BTC/admin | `team.manage` hoặc `tournament.update` — toàn bộ giải trong venue |
| Đội trưởng/đội phó | `team.lineup.submit` + `team_tournament_is_captain()` — chỉ lineup đội mình, trước `lineup_lock_at` |
| Đội trưởng | **Không** xem `selections` lineup đối thủ trước `published_at` / matchup `published` |
| Trọng tài | `team.match.result.manage` — chỉ sau matchup `published`; không sửa KQ đã `result_confirmed_at` (trừ BTC) |
| Viewer | `team.standings.view` — BXH khi giải `active`/`completed` |

Cross-tenant: `team_tournament_assert_tenant()` raise `access_denied: cross-tenant`.

## RPC

| RPC | Mô tả |
|-----|-------|
| `team_tournament_get_setup(tournament_id, viewer_team_id?)` | Load full setup; ẩn lineup đối thủ theo quy tắc |
| `team_tournament_save_team(tournament_id, team jsonb)` | Tạo/sửa đội |
| `team_tournament_assign_member(...)` | Gán VĐV; chặn cross-team nếu `allowPlayerCrossTeam=false` |
| `team_tournament_remove_member(...)` | Xóa VĐV; chặn xóa captain |
| `team_tournament_set_captain(...)` | Gán đội trưởng/đội phó; captain phải là member |
| `team_tournament_save_lineup_draft(...)` | Lưu nháp; validate count + membership |
| `team_tournament_submit_lineup(...)` | Nộp đội hình |
| `team_tournament_lock_matchup(...)` | Khóa matchup |
| `team_tournament_publish_matchup(...)` | Công bố matchup |
| `team_tournament_save_sub_match_draft(...)` | Nháp KQ; yêu cầu published |
| `team_tournament_confirm_sub_match(...)` | Xác nhận KQ; cập nhật `matchup.result` |
| `team_tournament_get_standings(tournament_id)` | Đọc BXH cache |
| `team_tournament_upsert_standings(tournament_id, standings)` | Ghi BXH sau compute app |

Tất cả RPC trả `{ ok, code?, error?, ... }`.

## Validation trong RPC

- VĐV không thuộc 2 đội (trừ `settings.allowPlayerCrossTeam`)
- Captain phải là member (`team_tournament_team_members`)
- Lineup: đúng số người per discipline, VĐV thuộc đội
- Không sửa lineup sau `locked_at` / quá `lineup_lock_at`
- Không xem lineup đối thủ trước publish (RPC `get_setup`)
- Không nhập KQ nếu matchup chưa `published`
- Không sửa KQ đã `result_confirmed_at` (trừ BTC/admin)

> Validation giới tính (gender) vẫn do app engine (`lineupValidationEngine`) — RPC kiểm tra cấu trúc; app validate trước khi gọi RPC.

## Audit log

`team_tournament_audit_logs` ghi qua `team_tournament_write_audit()`:

| Action | Sự kiện |
|--------|---------|
| `team.create` / `team.update` | Tạo/sửa đội |
| `team.player_add` / `team.player_remove` | Gán/xóa VĐV |
| `team.captain_assign` | Gán đội trưởng |
| `team.lineup.draft` / `team.lineup.submit` | Lưu nháp/nộp |
| `team.lineup.lock` / `team.lineup.publish` | Khóa/công bố |
| `team.match.result.draft` / `team.match.result.confirm` | KQ |

Song song: `teamAuditService.js` vẫn ghi `audit_logs` chung qua `writeAuditLog()`.

## Service layer (JS)

| File | Vai trò |
|------|---------|
| `repositories/teamTournamentRepository.js` | Resolve store mode |
| `services/teamTournamentRpcService.js` | RPC client + `RPC_NOT_DEPLOYED` detection |
| `services/teamTournamentCloudSync.js` | Cloud adapter, `tryCloudMutation()`, standings sync |
| `services/teamTournamentService.js` | Blob persist + mirror cloud khi bật |

Luồng mutation:

1. Guard permission (app)
2. `tryCloudMutation()` → RPC nếu cloud bật
3. Nếu RPC lỗi thật → trả lỗi; nếu `RPC_NOT_DEPLOYED` → fallback blob
4. Luôn cập nhật blob local (offline/demo)
5. Sau confirm result → `cloudSyncStandingsAfterMutation()`

## Apply SQL (staging/production)

```text
1. supabase-multi-tenant-sprint2.sql
2. supabase-identity-v40-phaseC.sql (user_has_permission)
3. docs/v5/PHASE_23C_TEAM_TOURNAMENT_CLOUD_SYNC.sql
```

Verify RLS:

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public'
  and tablename like 'team_tournament%';
```

## Tests

```bash
node --test tests/team-tournament-cloud.test.js
```

Coverage:
- RPC not deployed → fallback blob
- Cross-tenant FORBIDDEN
- Captain scope (chỉ đội mình)
- Opponent lineup hidden before publish
- Referee blocked before publish
- Standings upsert after confirm

## Env checklist

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_TEAM_TOURNAMENT_SUPABASE=true   # bật cloud mode
# VITE_TEAM_TOURNAMENT_STORE_MODE=supabase  # ghi đè tùy chọn
```

## Triển khai tiếp

- [x] Seed staging — `scripts/seed-team-tournament-cloud.mjs` (Phase 23D, staging only)
- [x] Staging probe — `scripts/verify-team-tournament-cloud-staging.mjs` (Phase 23D)
- [x] Production SQL — V23-1→V23-5 PASS (Phase 23C evidence)
- [ ] **Phase 23E** — Preview bật `VITE_TEAM_TOURNAMENT_SUPABASE=true` → migrate blob thật (nếu cần) → Production GO — [`PHASE_23E_TEAM_TOURNAMENT_CLOUD_SYNC_RUNBOOK.md`](./PHASE_23E_TEAM_TOURNAMENT_CLOUD_SYNC_RUNBOOK.md)
- [ ] Realtime subscription trên `team_tournament_matchups`
- [ ] RefereeHub token-scoped (ngoài phạm vi 23C)
