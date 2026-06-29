-- Supabase schema for Pickleball Scheduler Pro v3.0 club sync
-- Chay toan bo file trong Supabase SQL Editor (Project > SQL)

create table if not exists public.club_data_v3 (
  club_id text primary key,
  data jsonb not null,
  synced_at timestamptz not null default now()
);

create index if not exists club_data_v3_synced_at_idx
  on public.club_data_v3 (synced_at desc);

-- Legacy table (fallback khi app cu hon)
create table if not exists public.club_ai_data (
  club_id text primary key,
  data jsonb not null,
  synced_at timestamptz not null default now()
);

-- Row Level Security: app dung anon key, khong co dang nhap user.
-- Phu hop CLB nho; neu can bao mat cao hon hay them Supabase Auth.
alter table public.club_data_v3 enable row level security;
alter table public.club_ai_data enable row level security;

drop policy if exists "club_data_v3_anon_select" on public.club_data_v3;
drop policy if exists "club_data_v3_anon_insert" on public.club_data_v3;
drop policy if exists "club_data_v3_anon_update" on public.club_data_v3;
drop policy if exists "club_ai_data_anon_select" on public.club_ai_data;
drop policy if exists "club_ai_data_anon_insert" on public.club_ai_data;
drop policy if exists "club_ai_data_anon_update" on public.club_ai_data;

create policy "club_data_v3_anon_select"
  on public.club_data_v3 for select to anon using (true);

create policy "club_data_v3_anon_insert"
  on public.club_data_v3 for insert to anon with check (true);

create policy "club_data_v3_anon_update"
  on public.club_data_v3 for update to anon using (true) with check (true);

create policy "club_ai_data_anon_select"
  on public.club_ai_data for select to anon using (true);

create policy "club_ai_data_anon_insert"
  on public.club_ai_data for insert to anon with check (true);

create policy "club_ai_data_anon_update"
  on public.club_ai_data for update to anon using (true) with check (true);
