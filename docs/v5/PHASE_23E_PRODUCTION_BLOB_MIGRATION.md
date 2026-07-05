# Phase 23E — Production Blob → Cloud Migration (Giải thật)

**Phạm vi:** Migrate dữ liệu giải đồng đội **thật** từ `club_data_v3` lên bảng `team_tournament_*` trên Production.  
**Không** dùng fixture staging. **Không** apply SQL Phase 23D.

**Production project:** `expuvcohlcjzvrrauvud`  
**Prerequisite:** Phase 23C ✅ PASS · `VITE_TEAM_TOURNAMENT_SUPABASE=false` trên Production (chưa bật runtime cloud)

---

## 1. Khi nào cần migration?

| Tình huống | Cần migration? |
|------------|----------------|
| Venue chưa từng tạo giải `team_tournament` trên Production | **Không** — bật flag § runbook; giải mới sync qua RPC |
| Đã có giải đang vận hành trên blob (`club_data_v3.data.tournaments[]`) | **Có** — migrate **trước** khi set `VITE_TEAM_TOURNAMENT_SUPABASE=true` |
| Chỉ test / probe | **Không** — dùng staging + Phase 23D |

---

## 2. Ràng buộc an toàn

| ⛔ Cấm | Thay vào |
|--------|----------|
| `--blob-path=tests/fixtures/...` | Đọc từ `club_data_v3` theo `--club-id` |
| `PHASE_23D_TEAM_TOURNAMENT_STAGING_PROBE.sql` | Gán captain qua UI admin / SQL venue-specific (không copy staging probe) |
| Seed không dry-run trên Production | Luôn dry-run trước; cần `--production-confirm` khi ghi |
| Chạy khi Preview chưa PASS | Hoàn tất Preview smoke trước (runbook §6) |

Script `seed-team-tournament-cloud.mjs` **chặn** fixture path và write Production không có `--production-confirm`.

---

## 3. Chuẩn bị (owner + engineering)

### 3.1 Inventory giải cần migrate

SQL Editor Production:

```sql
-- Liệt kê CLB có giải team_tournament trong blob (cần service role hoặc admin tool)
select club_id, venue_id, synced_at
from public.club_data_v3
where data::text like '%"mode":"team_tournament"%'
   or data::text like '%"mode": "team_tournament"%'
order by synced_at desc;
```

Ghi nhận từng cặp:

| club_id | tenant_id (venue_id) | tournament_id | Trạng thái giải | Migrate? |
|---------|----------------------|-----------------|-----------------|----------|
| | | | | |

### 3.2 Captain / player_id

Production **không** dùng staging probe SQL. Trước migrate:

- [ ] Mỗi captain có tài khoản đăng nhập
- [ ] `profiles.player_id` khớp `captainPlayerId` trong blob team
- [ ] Role PLAYER (hoặc tương đương) có `team.lineup.submit`

Kiểm tra mẫu:

```sql
select id, email, venue_id, player_id, role
from public.profiles
where player_id is not null
  and venue_id = 'YOUR_VENUE_ID';
```

---

## 4. Migration workflow (local — service role)

> Chạy trên máy engineering. **Không** commit `.env.local`.

### Bước 1 — Env local

```env
VITE_SUPABASE_URL=https://expuvcohlcjzvrrauvud.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...   # Dashboard → Settings → API — KHÔNG commit

# Một CLB / một lần (khuyến nghị)
TEAM_TOURNAMENT_SEED_CLUB_ID=your-production-club-id
TEAM_TOURNAMENT_SEED_TENANT_ID=your-venue-id   # nếu blob thiếu tenantId
```

### Bước 2 — Dry-run (bắt buộc)

```bash
npm run seed:team-tournament-cloud:dry-run -- --club-id=YOUR_CLUB_ID --tenant-id=YOUR_VENUE_ID
```

Kỳ vọng log:

- Số giải `team_tournament` tìm thấy ≥ 1
- Stats `insert` / `update` / `skip` per bảng
- **Không** reference `phase23d-*` hay fixture path

Lưu output dry-run vào ticket / report.

### Bước 3 — Plan-only (tùy chọn, không cần service role ghi)

```bash
node scripts/seed-team-tournament-cloud.mjs --plan-only --club-id=YOUR_CLUB_ID
```

### Bước 4 — Write Production (owner GO)

```bash
npm run seed:team-tournament-cloud -- \
  --club-id=YOUR_CLUB_ID \
  --tenant-id=YOUR_VENUE_ID \
  --production-confirm
```

Chạy lại **một lần nữa** sau write — kỳ vọng chủ yếu `skip` (idempotent).

### Bước 5 — Verify SQL (Production)

```sql
select tt.tournament_id, tt.tenant_id, tt.club_id, tt.status,
  (select count(*) from public.team_tournament_teams t where t.team_tournament_id = tt.id) as teams,
  (select count(*) from public.team_tournament_matchups m where m.team_tournament_id = tt.id) as matchups
from public.team_tournaments tt
where tt.club_id = 'YOUR_CLUB_ID'
order by tt.created_at desc;
```

So sánh số đội / matchup với blob UI hoặc export JSON.

---

## 5. Sau migration

1. **Chưa** bật `VITE_TEAM_TOURNAMENT_SUPABASE=true` trên Production ngay — hoàn tất Preview smoke trước  
2. Manual JWT test (owner account): gọi RPC `team_tournament_get_setup` với `tournament_id` đã migrate  
3. Tiếp runbook §8 — Production enable

---

## 6. Rollback dữ liệu

Seed script **upsert idempotent** — không có auto-delete toàn giải.

| Mức | Hành động |
|-----|-----------|
| Runtime | Set `VITE_TEAM_TOURNAMENT_SUPABASE=false` → app dùng blob |
| Cloud rows sai | Engineering review + targeted SQL delete theo `tournament_id` — **không** tự xóa hàng loạt |

Liên hệ engineering trước khi `DELETE FROM team_tournament_*`.

---

## 7. Export blob backup (khuyến nghị)

Trước migrate, export row `club_data_v3` cho `club_id` qua Supabase Dashboard hoặc:

```sql
select club_id, venue_id, data
from public.club_data_v3
where club_id = 'YOUR_CLUB_ID';
```

Lưu JSON offline — rollback thủ công nếu cần.

---

## 8. Mapping (tham chiếu)

Giống Phase 23D — xem bảng trong [`PHASE_23D_TEAM_TOURNAMENT_SEED_RLS.md`](./PHASE_23D_TEAM_TOURNAMENT_SEED_RLS.md) § Blob → SQL mapping.

Engine: [`scripts/lib/team-tournament-seed-core.mjs`](../../scripts/lib/team-tournament-seed-core.mjs)
