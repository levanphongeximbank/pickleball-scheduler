-- Tournament broadcast VOD — Supabase Storage (staging/production)
-- Bucket: tournament-broadcast-vods
-- Path: {club_id}/{tournament_id}/trinh-chieu-{timestamp}.webm
-- Apply on staging AFTER supabase-rbac.sql (uses user_club_id, is_super_admin)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tournament-broadcast-vods',
  'tournament-broadcast-vods',
  false,
  524288000,
  array['video/webm', 'video/mp4']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "tournament_broadcast_vod_select" on storage.objects;
drop policy if exists "tournament_broadcast_vod_insert" on storage.objects;
drop policy if exists "tournament_broadcast_vod_delete" on storage.objects;

-- Đọc VOD thuộc CLB của user (folder đầu = club_id)
create policy "tournament_broadcast_vod_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'tournament-broadcast-vods'
    and (
      public.is_super_admin()
      or (storage.foldername(name))[1] = public.user_club_id()
    )
  );

-- Upload VOD — BTC / quản lý venue
create policy "tournament_broadcast_vod_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tournament-broadcast-vods'
    and (
      public.is_super_admin()
      or (
        (storage.foldername(name))[1] = public.user_club_id()
        and public.user_role() in (
          'SUPER_ADMIN',
          'CLUB_OWNER',
          'VENUE_OWNER',
          'VENUE_MANAGER',
          'COURT_OWNER',
          'COURT_MANAGER'
        )
      )
    )
  );

create policy "tournament_broadcast_vod_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'tournament-broadcast-vods'
    and (
      public.is_super_admin()
      or public.user_role() in ('SUPER_ADMIN', 'VENUE_OWNER', 'CLUB_OWNER')
    )
  );
