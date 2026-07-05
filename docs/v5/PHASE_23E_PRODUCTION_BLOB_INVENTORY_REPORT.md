# Phase 23E — Production Blob Inventory Report

**Ngày:** 2026-07-05  
**Owner quyết định:** **A** — Chấp nhận Preview PARTIAL, tiếp tục inventory  
**Production project:** `expuvcohlcjzvrrauvud`  
**Phương pháp:** Supabase MCP `execute_sql` (read-only)

---

## Verdict inventory

| Verdict | ☑ **SKIP migrate** · ☐ CẦN migrate · ☐ REVIEW |
|---------|--------------------------------------------------|
| Production GO (bật flag)? | ⏳ **Sẵn sàng bước tiếp** — chờ owner ký GO (không auto-bật) |

**Kết luận:** Không có giải `team_tournament` trong blob Production · cloud table = 0 → **không cần migrate** trước khi bật `VITE_TEAM_TOURNAMENT_SUPABASE=true`.

---

## Kết quả SQL (2026-07-05)

### Q1 — `club_data_v3` có giải đồng đội?

```sql
select club_id, venue_id, synced_at
from public.club_data_v3
where data::text like '%"mode":"team_tournament"%'
   or data::text like '%"mode": "team_tournament"%'
order by synced_at desc;
```

| Kết quả |
|---------|
| **0 rows** |

### Q2 — `team_tournaments` cloud

```sql
select count(*) as cloud_team_tournament_rows from public.team_tournaments;
```

| cloud_team_tournament_rows |
|----------------------------|
| **0** |

---

## Inventory table

| club_id | venue_id | tournament_id | Migrate? |
|---------|----------|---------------|----------|
| *(không có)* | — | — | **Không** |

---

## Trạng thái an toàn Production

| Hạng mục | Trạng thái |
|----------|------------|
| `VITE_TEAM_TOURNAMENT_SUPABASE` Production | **OFF** |
| Redeploy Production | **Chưa** (chờ owner GO) |
| Migration blob → cloud | **SKIP** |

---

## Bước tiếp theo (khi owner sẵn sàng GO Production)

1. Owner ký: Preview PARTIAL + inventory SKIP ✅  
2. Vercel Production: `VITE_TEAM_TOURNAMENT_SUPABASE=true`  
3. Redeploy Production (ghi Deployment ID rollback)  
4. Smoke PROD-23E-1→5 (runbook §8)  
5. Giải đồng đội **mới** tạo sau GO sẽ sync cloud qua RPC

**Không** cần `PHASE_23E_PRODUCTION_BLOB_MIGRATION.md` dry-run / `--production-confirm`.

---

## Sign-off

| Role | Inventory | GO Production flag |
|------|-----------|-------------------|
| Owner | ☑ SKIP (MCP 2026-07-05) | ☑ GO 2026-07-05 |
| Engineering | ☑ Report cập nhật | ☑ `dpl_53CoU4LCf48ERhekZt2TVPrBuLD9` |
