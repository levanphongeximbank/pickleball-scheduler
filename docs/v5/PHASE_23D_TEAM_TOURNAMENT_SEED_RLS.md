# Phase 23D — Team Tournament Seed + Staging RLS Probe

## Mục tiêu

Migrate dữ liệu giải đồng đội từ club blob (`tournament.teamData`) lên Supabase cloud (`team_tournament_*` tables) một cách **idempotent**, và xác nhận RLS/RPC hoạt động đúng trên **staging** trước production.

**Phạm vi Phase 23D:**
- Script seed/migration blob → cloud
- Staging RLS/RPC probe
- npm scripts + tài liệu
- **Không** UI mới
- **Không** RefereeHub

## Kiến trúc

```
club_data_v3.data.tournaments[] (mode=team_tournament)
        │
        ▼
scripts/seed-team-tournament-cloud.mjs  (service_role, idempotent upsert)
        │
        ▼
team_tournaments → teams → members → disciplines → matchups
                 → lineups → lineup_entries → sub_matches → standings
        │
        ▼
scripts/verify-team-tournament-cloud-staging.mjs  (JWT probes)
```

## Prerequisites SQL (staging)

Apply theo thứ tự:

```text
1. docs/supabase-multi-tenant-sprint2.sql
2. docs/supabase-identity-v40-phaseC.sql
3. docs/v5/PHASE_23C_TEAM_TOURNAMENT_CLOUD_SYNC.sql
```

Verify tables + RLS:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename like 'team_tournament%';
```

## Env checklist

Thêm vào `.env.local` (không commit):

```env
# Supabase staging
VITE_SUPABASE_URL=https://qyewbxjsiiyufanzcjcq.supabase.co
VITE_SUPABASE_ANON_KEY=...

# Seed script (service role — chỉ dùng local/CI, không commit)
SUPABASE_SERVICE_ROLE_KEY=...

# Cloud mode app (sau khi seed xong)
VITE_TEAM_TOURNAMENT_SUPABASE=true

# Seed options (optional)
TEAM_TOURNAMENT_SEED_CLUB_ID=club-staging-demo
TEAM_TOURNAMENT_SEED_BLOB_PATH=tests/fixtures/team-tournament-blob-probe.json
TEAM_TOURNAMENT_SEED_TENANT_ID=venue-staging-a

# Verify staging accounts (passwords — không commit)
STAGING_OWNER_A_EMAIL=owner@staging.local
STAGING_OWNER_A_PASSWORD=...
STAGING_PLAYER_EMAIL=player@staging.local
STAGING_PLAYER_PASSWORD=...
STAGING_MANAGER_EMAIL=manager@staging.local
STAGING_MANAGER_PASSWORD=...
STAGING_OWNER_B_EMAIL=owner-b@staging.local
STAGING_OWNER_B_PASSWORD=...
```

## Bước 1 — Apply SQL staging probe helpers

SQL Editor staging → chạy:

[`PHASE_23D_TEAM_TOURNAMENT_STAGING_PROBE.sql`](./PHASE_23D_TEAM_TOURNAMENT_STAGING_PROBE.sql)

Script này:
- Gán `player_id = player-staging-a-1` cho `player@staging.local` (captain probe)
- Gán permissions `team.*` cho roles staging (idempotent)

## Bước 2 — Dry-run seed

```bash
npm run seed:team-tournament-cloud:dry-run
```

Hoặc chỉ định nguồn:

```bash
# Từ fixture JSON (khuyến nghị cho probe lần đầu)
npm run seed:team-tournament-cloud:dry-run -- --blob-path=tests/fixtures/team-tournament-blob-probe.json

# Từ club_data_v3 cloud (giải thật đã sync blob)
npm run seed:team-tournament-cloud:dry-run -- --club-id=YOUR_CLUB_ID

# Override tenant khi blob thiếu tenantId
npm run seed:team-tournament-cloud:dry-run -- --tenant-id=venue-staging-a
```

Dry-run **không ghi DB** — chỉ log số bản ghi `insert` / `update` / `skip`.

## Bước 3 — Seed thật

```bash
npm run seed:team-tournament-cloud -- --blob-path=tests/fixtures/team-tournament-blob-probe.json
```

Chạy lại nhiều lần **an toàn** — script so sánh dữ liệu hiện có theo unique keys và skip khi không đổi.

### Nguồn dữ liệu

| Nguồn | Cách dùng |
|-------|-----------|
| `club_data_v3` | Mặc định — đọc qua service role; filter `--club-id` |
| JSON export | `--blob-path=path/to/export.json` — full club blob hoặc 1 tournament |

### Blob → SQL mapping

| Blob (`teamData`) | Bảng Supabase |
|-------------------|---------------|
| `tournament.id` | `team_tournaments.tournament_id` |
| `clubId` / `tenantId` | `club_id` / `tenant_id` |
| `teamData.settings` | `team_tournaments.settings` |
| `teams[]` | `team_tournament_teams` + `team_tournament_team_members` |
| `disciplines[]` | `team_tournament_disciplines` |
| `matchups[]` + `subMatches[]` | `team_tournament_matchups` + `team_tournament_sub_matches` |
| `lineups["m::t"]` | `team_tournament_lineups` + `team_tournament_lineup_entries` |
| `standings[]` | `team_tournament_standings` |

## Bước 4 — Verify staging RLS/RPC

```bash
npm run verify:team-tournament-cloud
```

Script: [`scripts/verify-team-tournament-cloud-staging.mjs`](../../scripts/verify-team-tournament-cloud-staging.mjs)

**Guard:** chỉ chạy khi `VITE_SUPABASE_URL` chứa staging ref `qyewbxjsiiyufanzcjcq`.

### Probes

| Probe | Kỳ vọng |
|-------|---------|
| Anon đọc `team_tournament_*` | Blocked / 0 rows |
| BTC/admin `get_setup` | OK — thấy full giải |
| BTC `save_team` | OK |
| Captain A `get_setup` (viewer team A) | Thấy lineup đội mình |
| Captain A trước publish | **Không** thấy `selections` đối thủ |
| Captain A `save_lineup_draft` đội mình | OK |
| Captain A sửa lineup đội khác | `FORBIDDEN` |
| Referee trước publish | `VALIDATION` / `FORBIDDEN` |
| Admin `lock_matchup` + `publish_matchup` | OK (khi matchup `lineup_open`) |
| Referee sau publish | OK (cần `team.match.result.manage`) |
| Viewer `get_standings` | OK hoặc blocked theo permission |
| Owner tenant B `get_setup` giải tenant A | Blocked / cross-tenant |
| Owner B filter `tenant_id=venue-staging-a` | 0 rows / blocked |

Kết quả: `PASS` / `PARTIAL` / `FAIL`. Exit code 1 khi có `FAIL`.

### Probe tournament mặc định

Fixture: [`tests/fixtures/team-tournament-blob-probe.json`](../../tests/fixtures/team-tournament-blob-probe.json)

| Key | Value |
|-----|-------|
| `tournament_id` | `phase23d-probe-tournament` |
| Team A / B | `phase23d-team-a` / `phase23d-team-b` |
| Matchup | `phase23d-matchup-1` |
| Captain A player_id | `player-staging-a-1` |

Override qua env: `TEAM_TOURNAMENT_PROBE_TOURNAMENT_ID`, `TEAM_TOURNAMENT_PROBE_TEAM_A`, ...

## npm scripts

| Script | Mô tả |
|--------|-------|
| `npm run seed:team-tournament-cloud:dry-run` | Dry-run migration |
| `npm run seed:team-tournament-cloud` | Seed thật (service role) |
| `npm run verify:team-tournament-cloud` | Staging RLS/RPC probe |

## Unit tests

```bash
node --test tests/team-tournament-seed.test.js
node --test tests/team-tournament-cloud.test.js
```

## Troubleshooting

| Triệu chứng | Cách xử lý |
|-------------|------------|
| Seed: `Thiếu tenantId` | Thêm `--tenant-id=venue-staging-a` hoặc gán `tenantId` trên tournament blob |
| Seed: 0 giải | Kiểm tra `mode=team_tournament` và `teamData` trong blob; hoặc dùng `--blob-path` |
| Verify: `get_setup not found` | Chạy seed probe fixture trước |
| Captain FORBIDDEN | Chạy `PHASE_23D_TEAM_TOURNAMENT_STAGING_PROBE.sql`; kiểm tra `profiles.player_id` khớp captain |
| Referee FORBIDDEN sau publish | Gán `team.match.result.manage` cho MANAGER role |
| Cross-tenant FAIL | Re-apply PHASE_23C SQL; kiểm tra `team_tournament_assert_tenant()` |

## Production notes

- **Không** chạy `PHASE_23D_TEAM_TOURNAMENT_STAGING_PROBE.sql` trên Production.
- **Không** seed fixture/probe lên Production — xem [`PHASE_23E_PRODUCTION_BLOB_MIGRATION.md`](./PHASE_23E_PRODUCTION_BLOB_MIGRATION.md).
- Verify script **chặn** URL không phải staging — Production runtime enable: [`PHASE_23E_TEAM_TOURNAMENT_CLOUD_SYNC_RUNBOOK.md`](./PHASE_23E_TEAM_TOURNAMENT_CLOUD_SYNC_RUNBOOK.md).

## Files

| File | Vai trò |
|------|---------|
| `scripts/lib/team-tournament-seed-core.mjs` | Mapper + idempotent upsert |
| `scripts/seed-team-tournament-cloud.mjs` | CLI seed |
| `scripts/verify-team-tournament-cloud-staging.mjs` | Staging RLS probe |
| `tests/fixtures/team-tournament-blob-probe.json` | Probe fixture |
| `tests/team-tournament-seed.test.js` | Unit tests mapper |
| `docs/v5/PHASE_23D_TEAM_TOURNAMENT_STAGING_PROBE.sql` | Staging profile/permission helpers |
