-- Supabase schema: live match scores for Referee Mode (Hướng B)
-- Chạy trong Supabase SQL Editor sau khi đã có club_data_v3

create table if not exists public.tournament_match_live (
  id text primary key,
  club_id text not null,
  tournament_id text not null,
  event_id text not null default '',
  match_id text not null,
  referee_token text not null unique,
  referee_name text not null default '',
  tournament_name text not null default '',
  entry_a_label text not null default 'Đội A',
  entry_b_label text not null default 'Đội B',
  court_label text not null default '',
  score_a integer not null default 0,
  score_b integer not null default 0,
  status text not null default 'playing',
  is_daily boolean not null default false,
  stage_label text not null default '',
  audit_log jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists tournament_match_live_club_tournament_idx
  on public.tournament_match_live (club_id, tournament_id);

create index if not exists tournament_match_live_token_idx
  on public.tournament_match_live (referee_token);

alter table public.tournament_match_live enable row level security;

drop policy if exists "tournament_match_live_anon_select" on public.tournament_match_live;
drop policy if exists "tournament_match_live_anon_insert" on public.tournament_match_live;
drop policy if exists "tournament_match_live_anon_update" on public.tournament_match_live;
drop policy if exists "tournament_match_live_anon_delete" on public.tournament_match_live;

create policy "tournament_match_live_anon_select"
  on public.tournament_match_live for select to anon using (true);

create policy "tournament_match_live_anon_insert"
  on public.tournament_match_live for insert to anon with check (true);

create policy "tournament_match_live_anon_update"
  on public.tournament_match_live for update to anon using (true) with check (true);

create policy "tournament_match_live_anon_delete"
  on public.tournament_match_live for delete to anon using (true);

-- Bật Realtime cho bảng này (Supabase Dashboard > Database > Replication)
-- Hoặc chạy:
-- alter publication supabase_realtime add table tournament_match_live;
