-- Phase 42B — Club Storage SSOT schema (Staging)
-- tenant_id = venues.id (Phase A decision)
-- Does NOT drop auth.users / billing / venues / profiles rows

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- tenant_members
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.venues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_code text not null check (role_code in ('tenant_owner', 'tenant_staff')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  version int not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tenant_members_active_uniq
  on public.tenant_members (tenant_id, user_id)
  where status = 'active';

create index if not exists tenant_members_tenant_idx on public.tenant_members (tenant_id);
create index if not exists tenant_members_user_idx on public.tenant_members (user_id);

-- ---------------------------------------------------------------------------
-- clubs
-- ---------------------------------------------------------------------------
create table if not exists public.clubs (
  id text primary key,
  tenant_id text not null references public.venues(id) on delete restrict,
  name text not null,
  code text null,
  description text not null default '',
  status text not null default 'active'
    check (status in ('pending_setup', 'pending_approval', 'active', 'inactive')),
  registered_cluster_id text null,
  version int not null default 1 check (version >= 1),
  created_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists clubs_tenant_idx on public.clubs (tenant_id);
create index if not exists clubs_status_idx on public.clubs (status);
create unique index if not exists clubs_tenant_code_uniq
  on public.clubs (tenant_id, code)
  where code is not null and deleted_at is null;

-- ---------------------------------------------------------------------------
-- athletes
-- ---------------------------------------------------------------------------
create table if not exists public.athletes (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.venues(id) on delete restrict,
  display_name text not null,
  phone text null,
  user_id uuid null references auth.users(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  version int not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists athletes_tenant_idx on public.athletes (tenant_id);
create index if not exists athletes_user_idx on public.athletes (user_id);

-- ---------------------------------------------------------------------------
-- club_members
-- ---------------------------------------------------------------------------
create table if not exists public.club_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.venues(id) on delete restrict,
  club_id text not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  athlete_id uuid null references public.athletes(id) on delete set null,
  membership_type text not null default 'regular',
  status text not null default 'active' check (status in ('active', 'left', 'removed')),
  joined_at timestamptz not null default now(),
  left_at timestamptz null,
  version int not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists club_members_active_uniq
  on public.club_members (club_id, user_id)
  where status = 'active';

create index if not exists club_members_tenant_idx on public.club_members (tenant_id);
create index if not exists club_members_club_idx on public.club_members (club_id);
create index if not exists club_members_user_idx on public.club_members (user_id);

-- ---------------------------------------------------------------------------
-- club_governance_assignments
-- ---------------------------------------------------------------------------
create table if not exists public.club_governance_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.venues(id) on delete restrict,
  club_id text not null references public.clubs(id) on delete cascade,
  club_member_id uuid not null references public.club_members(id) on delete cascade,
  role_code text not null check (role_code in ('club_owner', 'president', 'vice_president')),
  status text not null default 'active' check (status in ('active', 'ended')),
  effective_from timestamptz not null default now(),
  effective_to timestamptz null,
  version int not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists club_gov_one_owner_active
  on public.club_governance_assignments (club_id)
  where status = 'active' and role_code = 'club_owner';

create unique index if not exists club_gov_one_president_active
  on public.club_governance_assignments (club_id)
  where status = 'active' and role_code = 'president';

create index if not exists club_gov_club_idx on public.club_governance_assignments (club_id);
create index if not exists club_gov_member_idx on public.club_governance_assignments (club_member_id);

-- ---------------------------------------------------------------------------
-- club_membership_requests_v42 (new contract; old table truncated separately)
-- ---------------------------------------------------------------------------
create table if not exists public.club_membership_requests_v42 (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.venues(id) on delete restrict,
  club_id text not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  review_note text null,
  version int not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists club_membership_requests_v42_pending_uniq
  on public.club_membership_requests_v42 (club_id, user_id)
  where status = 'pending';

create index if not exists club_membership_requests_v42_club_idx
  on public.club_membership_requests_v42 (club_id);

-- ---------------------------------------------------------------------------
-- idempotency_requests
-- ---------------------------------------------------------------------------
create table if not exists public.idempotency_requests (
  request_id uuid not null,
  tenant_id text null,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  rpc_name text not null,
  request_hash text not null default '',
  response_json jsonb not null,
  created_at timestamptz not null default now(),
  primary key (actor_user_id, request_id)
);

create index if not exists idempotency_requests_created_idx
  on public.idempotency_requests (created_at);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_tenant_members_updated on public.tenant_members;
create trigger trg_tenant_members_updated
  before update on public.tenant_members
  for each row execute function public.set_updated_at();

drop trigger if exists trg_clubs_updated on public.clubs;
create trigger trg_clubs_updated
  before update on public.clubs
  for each row execute function public.set_updated_at();

drop trigger if exists trg_athletes_updated on public.athletes;
create trigger trg_athletes_updated
  before update on public.athletes
  for each row execute function public.set_updated_at();

drop trigger if exists trg_club_members_updated on public.club_members;
create trigger trg_club_members_updated
  before update on public.club_members
  for each row execute function public.set_updated_at();

drop trigger if exists trg_club_gov_updated on public.club_governance_assignments;
create trigger trg_club_gov_updated
  before update on public.club_governance_assignments
  for each row execute function public.set_updated_at();

drop trigger if exists trg_club_req_v42_updated on public.club_membership_requests_v42;
create trigger trg_club_req_v42_updated
  before update on public.club_membership_requests_v42
  for each row execute function public.set_updated_at();
