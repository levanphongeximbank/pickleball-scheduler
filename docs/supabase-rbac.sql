-- Supabase schema: RBAC + multi-tenant venue (Pickleball Scheduler Pro v3.5.7)
-- Chạy SAU docs/supabase-club-v3.sql. Xem docs/SUPABASE-STAGING-CHECKLIST.md.

-- ─── Venues (tenant) ───────────────────────────────────────────────
create table if not exists public.venues (
  id text primary key,
  name text not null,
  slug text not null unique,
  owner_id uuid references auth.users (id) on delete set null,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  status text not null default 'trial'
    check (status in ('active', 'trial', 'suspended')),
  subscription_id text,
  note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Subscriptions (billing theo tháng) ──────────────────────────────
create table if not exists public.subscriptions (
  id text primary key,
  venue_id text not null references public.venues (id) on delete cascade,
  plan_id text not null default 'trial'
    check (plan_id in ('trial', 'basic', 'pro')),
  status text not null default 'trial'
    check (status in ('trial', 'active', 'past_due', 'cancelled')),
  billing_cycle text not null default 'monthly',
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_venue_id_idx
  on public.subscriptions (venue_id);

-- ─── Profiles (mở rộng auth.users) ─────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text default '',
  role text not null
    check (role in (
      'SUPER_ADMIN', 'VENUE_OWNER', 'VENUE_MANAGER', 'CASHIER',
      'ACCOUNTANT', 'CLUB_OWNER', 'PLAYER'
    )),
  venue_id text references public.venues (id) on delete set null,
  club_id text,
  player_id text,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'invited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_venue_id_idx on public.profiles (venue_id);
create index if not exists profiles_club_id_idx on public.profiles (club_id);

-- Club data: venue_id cho multi-tenant (chạy thêm supabase-club-v3-rls.sql)
alter table public.club_data_v3 add column if not exists venue_id text;

create index if not exists club_data_v3_venue_id_idx on public.club_data_v3 (venue_id);

-- ─── Helper: kiểm tra membership ───────────────────────────────────
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'SUPER_ADMIN'
      and p.status = 'active'
  );
$$;

create or replace function public.user_venue_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.venue_id from public.profiles p
  where p.id = auth.uid() and p.status = 'active'
  limit 1;
$$;

create or replace function public.user_club_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.club_id from public.profiles p
  where p.id = auth.uid() and p.status = 'active'
  limit 1;
$$;

create or replace function public.user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p
  where p.id = auth.uid() and p.status = 'active'
  limit 1;
$$;

create or replace function public.is_venue_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role in ('VENUE_OWNER', 'VENUE_MANAGER', 'CASHIER', 'ACCOUNTANT')
  );
$$;

create or replace function public.can_read_payment_events()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or public.user_role() in ('VENUE_OWNER', 'ACCOUNTANT', 'CASHIER');
$$;

-- ─── RLS venues ────────────────────────────────────────────────────
alter table public.venues enable row level security;
alter table public.subscriptions enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "venues_super_admin_all" on public.venues;
create policy "venues_super_admin_all"
  on public.venues for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "venues_owner_select" on public.venues;
create policy "venues_owner_select"
  on public.venues for select to authenticated
  using (id = public.user_venue_id() or owner_id = auth.uid());

drop policy if exists "subscriptions_venue_select" on public.subscriptions;
create policy "subscriptions_venue_select"
  on public.subscriptions for select to authenticated
  using (venue_id = public.user_venue_id() or public.is_super_admin());

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_super_admin());

drop policy if exists "profiles_venue_staff_select" on public.profiles;
create policy "profiles_venue_staff_select"
  on public.profiles for select to authenticated
  using (
    public.is_venue_staff()
    and venue_id = public.user_venue_id()
  );

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Trigger: user tự sửa chỉ display_name / player_id; role chỉ SUPER_ADMIN
create or replace function public.profiles_guard_privileged_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if not public.is_super_admin() then
      raise exception 'Only SUPER_ADMIN can change profile role';
    end if;
  end if;

  if auth.uid() = old.id and not public.is_super_admin() then
    if new.venue_id is distinct from old.venue_id
       or new.club_id is distinct from old.club_id
       or new.status is distinct from old.status then
      raise exception 'Cannot modify protected profile fields';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged_update_trg on public.profiles;
create trigger profiles_guard_privileged_update_trg
  before update on public.profiles
  for each row execute function public.profiles_guard_privileged_update();

-- ─── Trigger: tự tạo profile khi user đăng ký ─────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role, status)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    'PLAYER',
    'active'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Venue owner có thể mời staff (insert profile cho venue của mình)
drop policy if exists "profiles_venue_owner_insert" on public.profiles;
create policy "profiles_venue_owner_insert"
  on public.profiles for insert to authenticated
  with check (
    public.is_super_admin()
    or (
      venue_id = public.user_venue_id()
      and role in ('VENUE_MANAGER', 'CASHIER', 'ACCOUNTANT', 'CLUB_OWNER', 'PLAYER')
    )
  );

drop policy if exists "profiles_venue_owner_update" on public.profiles;
create policy "profiles_venue_owner_update"
  on public.profiles for update to authenticated
  using (public.is_super_admin() or venue_id = public.user_venue_id())
  with check (public.is_super_admin() or venue_id = public.user_venue_id());

-- ─── Payment events (webhook Stripe/VNPay) ─────────────────────────
create table if not exists public.payment_events (
  id text primary key,
  venue_id text not null references public.venues (id) on delete cascade,
  plan_id text not null,
  amount numeric not null default 0,
  currency text not null default 'VND',
  provider text not null default 'stripe',
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed', 'refunded')),
  external_id text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.payment_events enable row level security;

drop policy if exists "payment_events_super_admin" on public.payment_events;
create policy "payment_events_super_admin"
  on public.payment_events for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "payment_events_venue_select" on public.payment_events;
create policy "payment_events_venue_select"
  on public.payment_events for select to authenticated
  using (
    public.can_read_payment_events()
    and (venue_id = public.user_venue_id() or public.is_super_admin())
  );
