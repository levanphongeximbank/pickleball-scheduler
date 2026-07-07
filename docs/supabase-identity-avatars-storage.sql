-- Identity avatars — Supabase Storage (staging/production)
-- Bucket: user-avatars
-- Path: {user_id}/avatar.{ext}
-- Apply AFTER supabase-rbac.sql / identity phase B

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-avatars',
  'user-avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "user_avatars_select" on storage.objects;
drop policy if exists "user_avatars_select_anon" on storage.objects;
drop policy if exists "user_avatars_insert" on storage.objects;
drop policy if exists "user_avatars_update" on storage.objects;
drop policy if exists "user_avatars_delete" on storage.objects;

-- Public bucket — authenticated users can read all avatars
create policy "user_avatars_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'user-avatars');

-- Anonymous read for public bucket display (img src without auth header)
create policy "user_avatars_select_anon"
  on storage.objects for select to anon
  using (bucket_id = 'user-avatars');

create policy "user_avatars_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "user_avatars_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "user_avatars_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
