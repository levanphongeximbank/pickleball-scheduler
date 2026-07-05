-- Phase 23E — Production blob inventory (read-only)
-- Project: expuvcohlcjzvrrauvud (Production ONLY — không chạy trên staging)
-- SQL Editor → New query → paste → Run

-- Q1: CLB có giải đồng đội trong blob local/cloud sync?
select club_id, venue_id, synced_at
from public.club_data_v3
where data::text like '%"mode":"team_tournament"%'
   or data::text like '%"mode": "team_tournament"%'
order by synced_at desc;

-- Q2: Đã có row trên bảng cloud chưa? (kỳ vọng = 0 trước migrate)
select count(*) as cloud_team_tournament_rows
from public.team_tournaments;

-- Q3 (nếu Q1 có row): chi tiết từng giải trong blob
-- Thay YOUR_CLUB_ID bằng club_id từ Q1
/*
select
  t.value ->> 'id' as tournament_id,
  t.value ->> 'name' as name,
  t.value ->> 'status' as status,
  jsonb_array_length(coalesce(t.value -> 'teamData' -> 'teams', '[]'::jsonb)) as teams,
  jsonb_array_length(coalesce(t.value -> 'teamData' -> 'matchups', '[]'::jsonb)) as matchups
from public.club_data_v3 c,
     jsonb_array_elements(coalesce(c.data -> 'tournaments', '[]'::jsonb)) as t(value)
where c.club_id = 'YOUR_CLUB_ID'
  and t.value ->> 'mode' = 'team_tournament';
*/

-- Kết luận nhanh:
-- Q1 = 0 rows  → SKIP migrate — khi GO chỉ bật flag, giải mới sync cloud
-- Q1 >= 1 row → CẦN migrate (xem PHASE_23E_PRODUCTION_BLOB_MIGRATION.md) trước GO
