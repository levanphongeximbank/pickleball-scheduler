-- POSTCHECK — expect remaining_nam = 0 and non_canonical = 0

select count(*)::int as remaining_nam
from public.profiles
where gender = 'Nam';

select count(*)::int as non_canonical
from public.profiles
where gender is not null
  and btrim(gender::text) <> ''
  and lower(btrim(gender::text)) not in ('male', 'female', 'other');

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
