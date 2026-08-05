-- PRECHECK — Production player gender remediation (SELECT only)
-- Expected: nam_rows = 4

select
  case
    when gender is null then '__NULL__'
    when btrim(gender::text) = '' then '__BLANK__'
    else gender::text
  end as gender,
  count(*)::int as n
from public.profiles
group by 1
order by n desc, gender;

select count(*)::int as nam_rows
from public.profiles
where gender = 'Nam';
