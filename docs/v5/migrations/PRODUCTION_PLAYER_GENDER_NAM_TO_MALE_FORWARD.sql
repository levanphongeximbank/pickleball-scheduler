-- FORWARD — Nam -> male (idempotent). DO NOT APPLY without owner GO.
begin;

-- Snapshot ledger (optional; create once before first apply)
create table if not exists public._remediation_gender_nam_backup (
  id uuid primary key,
  gender text not null,
  backed_up_at timestamptz not null default now()
);

insert into public._remediation_gender_nam_backup (id, gender)
select id, gender
from public.profiles
where gender = 'Nam'
on conflict (id) do nothing;

update public.profiles
set
  gender = 'male',
  updated_at = now()
where gender = 'Nam';

do $$
declare
  has_gender_check boolean;
begin
  select exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'profiles'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%gender%'
  ) into has_gender_check;

  if not has_gender_check then
    alter table public.profiles
      add constraint profiles_gender_canonical_chk
      check (
        gender is null
        or gender in ('male', 'female', 'other')
      )
      not valid;
    alter table public.profiles
      validate constraint profiles_gender_canonical_chk;
  end if;
end $$;

commit;
