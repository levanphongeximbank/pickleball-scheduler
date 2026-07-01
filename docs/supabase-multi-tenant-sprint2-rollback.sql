-- Rollback Sprint 2 multi-tenant view (không xóa venues — dữ liệu production)
drop view if exists public.tenants;

alter table public.venues drop constraint if exists venues_status_check;
alter table public.venues add constraint venues_status_check
  check (status in ('active', 'trial', 'suspended'));
