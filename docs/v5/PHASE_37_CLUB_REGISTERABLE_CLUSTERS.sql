-- Phase 37 — List active court clusters for club registration (all authenticated users)
-- Chạy SAU: PHASE_33_COURT_CLAIM_REQUESTS.sql
-- Production: expuvcohlcjzvrrauvud

create or replace function public.court_list_registerable_clusters(
  p_search text default '',
  p_limit int default 100
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_rows json;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_rows
  from (
    select
      c.id,
      c.venue_id,
      c.name,
      c.slug,
      c.status,
      coalesce(c.court_count, 0) as court_count,
      coalesce(c.address, '') as address,
      coalesce(c.google_maps_url, '') as google_maps_url,
      coalesce(v.name, c.venue_id) as venue_name
    from public.court_clusters c
    left join public.venues v on v.id = c.venue_id
    where c.status = 'active'
      and (
        coalesce(p_search, '') = ''
        or c.name ilike '%' || p_search || '%'
        or coalesce(c.address, '') ilike '%' || p_search || '%'
        or coalesce(v.name, '') ilike '%' || p_search || '%'
      )
    order by c.name asc
    limit v_limit
  ) t;

  return json_build_object('ok', true, 'clusters', coalesce(v_rows, '[]'::json));
end;
$$;

grant execute on function public.court_list_registerable_clusters(text, int) to authenticated;
