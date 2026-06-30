-- Rollback RLS staging — Pickleball Scheduler Pro v3.5.5
-- Chỉ dùng khi staging lỗi và cần khôi phục anon-open tạm thời.
-- KHÔNG chạy trên production đã có user thật nếu không hiểu rủi ro.

-- ─── club_data_v3: khôi phục anon-open (dev/staging emergency) ───
drop policy if exists "club_data_v3_member_select" on public.club_data_v3;
drop policy if exists "club_data_v3_member_write" on public.club_data_v3;
drop policy if exists "club_data_v3_member_update" on public.club_data_v3;
drop policy if exists "club_data_v3_member_delete" on public.club_data_v3;

create policy "club_data_v3_anon_select"
  on public.club_data_v3 for select to anon using (true);
create policy "club_data_v3_anon_insert"
  on public.club_data_v3 for insert to anon with check (true);
create policy "club_data_v3_anon_update"
  on public.club_data_v3 for update to anon using (true) with check (true);

-- ─── tournament_match_live: khôi phục anon-open ─────────────────
drop policy if exists "match_live_staff_select" on public.tournament_match_live;
drop policy if exists "match_live_staff_insert" on public.tournament_match_live;
drop policy if exists "match_live_staff_update" on public.tournament_match_live;
drop policy if exists "match_live_staff_delete" on public.tournament_match_live;
drop policy if exists "match_live_referee_anon_select" on public.tournament_match_live;
drop policy if exists "match_live_referee_anon_insert" on public.tournament_match_live;
drop policy if exists "match_live_referee_anon_update" on public.tournament_match_live;

create policy "tournament_match_live_anon_select"
  on public.tournament_match_live for select to anon using (true);
create policy "tournament_match_live_anon_insert"
  on public.tournament_match_live for insert to anon with check (true);
create policy "tournament_match_live_anon_update"
  on public.tournament_match_live for update to anon using (true) with check (true);
create policy "tournament_match_live_anon_delete"
  on public.tournament_match_live for delete to anon using (true);

drop function if exists public.referee_update_match_score(text, jsonb);
drop function if exists public.referee_get_match_by_token(text);
