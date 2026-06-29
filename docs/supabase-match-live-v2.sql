-- Migration v2: Referee module polish (stage label + audit log)
-- Chạy sau docs/supabase-match-live.sql

alter table public.tournament_match_live
  add column if not exists stage_label text not null default '';

alter table public.tournament_match_live
  add column if not exists audit_log jsonb not null default '[]'::jsonb;

create index if not exists tournament_match_live_status_idx
  on public.tournament_match_live (status);
