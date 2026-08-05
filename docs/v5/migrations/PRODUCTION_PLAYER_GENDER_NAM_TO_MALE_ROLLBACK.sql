-- ROLLBACK — restore Nam from backup ledger; drop optional CHECK.
-- Only restores IDs captured in _remediation_gender_nam_backup.

begin;

update public.profiles p
set
  gender = b.gender,
  updated_at = now()
from public._remediation_gender_nam_backup b
where p.id = b.id
  and b.gender = 'Nam';

alter table public.profiles
  drop constraint if exists profiles_gender_canonical_chk;

commit;
