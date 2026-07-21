-- =============================================================================
-- Phase 1I-B — Public Player Directory durable read model (SQL authoring)
-- Branch: feature/player-phase-1i-b-directory-sql
-- Design: docs/player-management/phase-1i/05..09 + Phase 1I-A remediation
-- App contract: searchPublicDirectoryPlayers / getPublicDirectoryPlayer
--
-- APPLY: Staging only after separate Owner token AUTHORIZE_PHASE_1I_B_STAGING_APPLY.
--        DO NOT apply from this authoring task. DO NOT connect Staging/Production here.
-- Rollback: docs/v5/PHASE_1I_B_PLAYER_DIRECTORY_READ_MODEL_ROLLBACK.sql
-- Verify:   docs/v5/PHASE_1I_B_PLAYER_DIRECTORY_READ_MODEL_VERIFY.sql
--
-- Properties:
--   - additive, reversible (DROP FUNCTION / DROP INDEX)
--   - SECURITY DEFINER RPCs with SET search_path = pg_catalog, public
--   - authenticated EXECUTE only; no anon / PUBLIC execute
--   - no profiles SELECT policy expansion; no raw table exposure
--   - strict Directory-safe JSON only (no privacy_settings / raw verification / status)
--   - activity_region emitted as text|null (Phase 1I-A Owner remediation; not jsonb)
--   - p_region argument is text|null (Phase 1I-A; not jsonb)
--   - opaque pd1.* cursor encode/decode aligned with src/features/player/utils/directoryCursor.js
-- =============================================================================

begin;

-- ─── 1. Internal helpers (not granted to authenticated / anon) ───────────────

-- Format stored jsonb activity_region → Directory display text.
-- Allow-listed keys only (matches formatActivityRegionDisplay order):
--   provinceName, city, district, countryCode
-- Malformed / non-object / empty → NULL (fail closed for emission).
create or replace function public.player_directory_format_activity_region(
  p_activity_region jsonb
)
returns text
language plpgsql
immutable
parallel safe
set search_path = pg_catalog, public
as $$
declare
  v_parts text[];
  v_part text;
  v_keys text[] := array['provinceName', 'city', 'district', 'countryCode'];
  v_key text;
begin
  if p_activity_region is null
     or jsonb_typeof(p_activity_region) is distinct from 'object' then
    return null;
  end if;

  v_parts := array[]::text[];
  foreach v_key in array v_keys loop
    v_part := nullif(trim(coalesce(p_activity_region ->> v_key, '')), '');
    if v_part is not null then
      v_parts := v_parts || v_part;
    end if;
  end loop;

  if coalesce(array_length(v_parts, 1), 0) = 0 then
    return null;
  end if;

  return array_to_string(v_parts, ', ');
end;
$$;

comment on function public.player_directory_format_activity_region(jsonb) is
  'Phase 1I-B internal: jsonb activity_region → Directory text|null. Not for client EXECUTE.';

-- Encode opaque cursor: pd1. + base64url(UTF-8 JSON {"v":1,"n":...,"p":...})
-- Must match src/features/player/utils/directoryCursor.js exactly.
create or replace function public.player_directory_encode_cursor(
  p_normalized_display_name text,
  p_player_id text
)
returns text
language plpgsql
immutable
parallel safe
set search_path = pg_catalog, public
as $$
declare
  v_n text := lower(trim(coalesce(p_normalized_display_name, '')));
  v_p text := trim(coalesce(p_player_id, ''));
  v_json text;
  v_b64 text;
begin
  if v_n = '' or v_p = '' then
    return null;
  end if;

  -- Key order locked to JS JSON.stringify({ v, n, p }).
  v_json := format(
    '{"v":1,"n":%s,"p":%s}',
    to_json(v_n),
    to_json(v_p)
  );

  v_b64 := encode(convert_to(v_json, 'UTF8'), 'base64');
  v_b64 := rtrim(translate(v_b64, '+/', '-_'), '=');

  return 'pd1.' || v_b64;
end;
$$;

comment on function public.player_directory_encode_cursor(text, text) is
  'Phase 1I-B internal: encode pd1.* opaque directory cursor. Not for client EXECUTE.';

-- Decode / validate opaque cursor. Returns jsonb:
--   { "ok": true, "n": "<normalized>", "p": "<player_id>" }
--   { "ok": false, "code": "INVALID_CURSOR", "message": "..." }
create or replace function public.player_directory_decode_cursor(
  p_cursor text
)
returns jsonb
language plpgsql
stable
parallel safe
set search_path = pg_catalog, public
as $$
declare
  v_token text;
  v_body text;
  v_b64 text;
  v_pad int;
  v_json_text text;
  v_payload jsonb;
  v_n text;
  v_p text;
  v_key text;
  v_has_extra boolean := false;
begin
  if p_cursor is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_CURSOR',
      'message', 'Cursor is empty'
    );
  end if;

  v_token := trim(p_cursor);
  if v_token = '' then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_CURSOR',
      'message', 'Cursor is empty'
    );
  end if;

  if left(v_token, 4) is distinct from 'pd1.' then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_CURSOR',
      'message', 'Unsupported or malformed cursor token'
    );
  end if;

  v_body := substr(v_token, 5);
  if v_body = '' or v_body !~ '^[A-Za-z0-9_-]+$' then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_CURSOR',
      'message', 'Cursor token is not URL-safe base64'
    );
  end if;

  begin
    v_b64 := translate(v_body, '-_', '+/');
    v_pad := (4 - (length(v_b64) % 4)) % 4;
    if v_pad > 0 then
      v_b64 := v_b64 || repeat('=', v_pad);
    end if;
    v_json_text := convert_from(decode(v_b64, 'base64'), 'UTF8');
    v_payload := v_json_text::jsonb;
  exception
    when others then
      return jsonb_build_object(
        'ok', false,
        'code', 'INVALID_CURSOR',
        'message', 'Cursor payload could not be decoded'
      );
  end;

  if v_payload is null or jsonb_typeof(v_payload) is distinct from 'object' then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_CURSOR',
      'message', 'Cursor payload must be an object'
    );
  end if;

  if (v_payload -> 'v') is distinct from to_jsonb(1) then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_CURSOR',
      'message', 'Unsupported cursor version'
    );
  end if;

  for v_key in select jsonb_object_keys(v_payload) loop
    if v_key not in ('v', 'n', 'p') then
      v_has_extra := true;
      exit;
    end if;
  end loop;

  if v_has_extra then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_CURSOR',
      'message', 'Cursor contains unsupported fields'
    );
  end if;

  if jsonb_typeof(v_payload -> 'n') is distinct from 'string'
     or jsonb_typeof(v_payload -> 'p') is distinct from 'string' then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_CURSOR',
      'message', 'Cursor sort keys must be strings'
    );
  end if;

  v_n := lower(trim(coalesce(v_payload ->> 'n', '')));
  if v_n = '' then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_CURSOR',
      'message', 'Cursor is missing the sort name key'
    );
  end if;

  v_p := trim(coalesce(v_payload ->> 'p', ''));
  if v_p = '' then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_CURSOR',
      'message', 'Cursor is missing a valid playerId'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'n', v_n,
    'p', v_p
  );
end;
$$;

comment on function public.player_directory_decode_cursor(text) is
  'Phase 1I-B internal: decode/validate pd1.* opaque directory cursor. Not for client EXECUTE.';

-- Build one strict Directory row (server-side masking). Never emit privacy/verification/status.
create or replace function public.player_directory_project_row(
  p_player_id text,
  p_display_name text,
  p_avatar_url text,
  p_activity_region jsonb,
  p_gender text,
  p_handedness text,
  p_privacy_settings jsonb
)
returns jsonb
language plpgsql
immutable
parallel safe
set search_path = pg_catalog, public
as $$
declare
  v_show_region boolean := (p_privacy_settings ->> 'showActivityRegion') = 'true';
  v_show_gender boolean := (p_privacy_settings ->> 'showGender') = 'true';
  v_show_handedness boolean := (p_privacy_settings ->> 'showHandedness') = 'true';
  v_region_text text := null;
  v_gender text := null;
  v_handedness text := null;
begin
  if v_show_region then
    v_region_text := public.player_directory_format_activity_region(p_activity_region);
  end if;

  if v_show_gender then
    v_gender := nullif(trim(coalesce(p_gender, '')), '');
  end if;

  if v_show_handedness then
    v_handedness := nullif(trim(coalesce(p_handedness, '')), '');
  end if;

  return jsonb_build_object(
    'player_id', trim(p_player_id),
    'display_name', trim(p_display_name),
    'is_verified', true,
    'avatar_url', nullif(trim(coalesce(p_avatar_url, '')), ''),
    'activity_region', to_jsonb(v_region_text),
    'gender', to_jsonb(v_gender),
    'handedness', to_jsonb(v_handedness)
  );
end;
$$;

comment on function public.player_directory_project_row(text, text, text, jsonb, text, text, jsonb) is
  'Phase 1I-B internal: strict Directory row projector with server-side masking. Not for client EXECUTE.';

-- ─── 2. Search RPC ───────────────────────────────────────────────────────────

create or replace function public.player_directory_search(
  p_query text default null,
  p_region text default null,
  p_cursor text default null,
  p_limit integer default 20
)
returns json
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_limit int;
  v_query text;
  v_region text;
  v_cursor_raw text;
  v_decoded jsonb;
  v_cursor_n text := null;
  v_cursor_p text := null;
  v_pattern text;
  v_rows jsonb := '[]'::jsonb;
  v_count int := 0;
  v_next text := null;
  v_last jsonb;
begin
  if auth.uid() is null then
    return json_build_object(
      'ok', false,
      'data', '[]'::json,
      'meta', json_build_object('nextCursor', null, 'limit', 0, 'count', 0),
      'code', 'NOT_AUTHENTICATED',
      'message', 'Authentication required'
    );
  end if;

  if p_limit is null or p_limit <= 0 then
    v_limit := 20;
  else
    v_limit := least(p_limit, 50);
  end if;

  v_query := nullif(trim(coalesce(p_query, '')), '');
  if v_query is not null and char_length(v_query) < 2 then
    return json_build_object(
      'ok', false,
      'data', '[]'::json,
      'meta', json_build_object('nextCursor', null, 'limit', v_limit, 'count', 0),
      'code', 'INVALID_REQUEST',
      'message', 'Search query must be at least 2 characters'
    );
  end if;

  v_region := nullif(trim(coalesce(p_region, '')), '');

  v_cursor_raw := nullif(trim(coalesce(p_cursor, '')), '');
  if v_cursor_raw is not null then
    v_decoded := public.player_directory_decode_cursor(v_cursor_raw);
    if coalesce((v_decoded ->> 'ok')::boolean, false) is not true then
      return json_build_object(
        'ok', false,
        'data', '[]'::json,
        'meta', json_build_object('nextCursor', null, 'limit', v_limit, 'count', 0),
        'code', 'INVALID_CURSOR',
        'message', coalesce(v_decoded ->> 'message', 'Invalid directory cursor')
      );
    end if;
    v_cursor_n := v_decoded ->> 'n';
    v_cursor_p := v_decoded ->> 'p';
  end if;

  if v_query is not null then
    v_pattern := '%'
      || replace(replace(replace(v_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_')
      || '%';
  end if;

  select coalesce(jsonb_agg(q.row_json order by q.sort_name, q.player_id), '[]'::jsonb)
  into v_rows
  from (
    select
      public.player_directory_project_row(
        p.player_id,
        p.display_name,
        p.avatar_url,
        p.activity_region,
        p.gender,
        p.handedness,
        p.privacy_settings
      ) as row_json,
      lower(trim(p.display_name)) as sort_name,
      trim(p.player_id) as player_id
    from public.profiles as p
    where
      -- Eligibility (fail closed)
      p.player_id is not null
      and length(trim(p.player_id)) > 0
      and nullif(trim(p.display_name), '') is not null
      and p.identity_verification_status = 'verified'
      and p.privacy_settings is not null
      and jsonb_typeof(p.privacy_settings) = 'object'
      and (p.privacy_settings ->> 'publicProfileEnabled') = 'true'
      and p.status is distinct from 'suspended'
      -- Optional display-name search
      and (
        v_query is null
        or p.display_name ilike v_pattern escape E'\\'
      )
      -- Optional normalized activity-region filter (text equality on allow-listed values / label)
      and (
        v_region is null
        or (
          (p.privacy_settings ->> 'showActivityRegion') = 'true'
          and p.activity_region is not null
          and jsonb_typeof(p.activity_region) = 'object'
          and (
            lower(trim(coalesce(p.activity_region ->> 'provinceName', ''))) = lower(v_region)
            or lower(trim(coalesce(p.activity_region ->> 'provinceCode', ''))) = lower(v_region)
            or lower(trim(coalesce(p.activity_region ->> 'city', ''))) = lower(v_region)
            or lower(trim(coalesce(p.activity_region ->> 'district', ''))) = lower(v_region)
            or lower(trim(coalesce(p.activity_region ->> 'countryCode', ''))) = lower(v_region)
            or lower(coalesce(public.player_directory_format_activity_region(p.activity_region), ''))
                 = lower(v_region)
          )
        )
      )
      -- Keyset pagination after opaque cursor
      and (
        v_cursor_n is null
        or lower(trim(p.display_name)) > v_cursor_n
        or (
          lower(trim(p.display_name)) = v_cursor_n
          and trim(p.player_id) > v_cursor_p
        )
      )
    order by lower(trim(p.display_name)) asc, trim(p.player_id) asc
    limit (v_limit + 1)
  ) as q;

  v_count := jsonb_array_length(v_rows);

  if v_count > v_limit then
    v_last := v_rows -> (v_limit - 1);
    v_next := public.player_directory_encode_cursor(
      v_last ->> 'display_name',
      v_last ->> 'player_id'
    );
    v_rows := (
      select coalesce(jsonb_agg(elem order by ord), '[]'::jsonb)
      from jsonb_array_elements(v_rows) with ordinality as t(elem, ord)
      where ord <= v_limit
    );
    v_count := v_limit;
  end if;

  return json_build_object(
    'ok', true,
    'data', v_rows,
    'meta', json_build_object(
      'nextCursor', v_next,
      'limit', v_limit,
      'count', v_count
    ),
    'code', null,
    'message', null
  );
end;
$$;

comment on function public.player_directory_search(text, text, text, integer) is
  'Phase 1I-B: authenticated Public Player Directory search. Strict Directory-safe JSON only.';

-- ─── 3. Detail RPC ───────────────────────────────────────────────────────────

create or replace function public.player_directory_get(
  p_player_id text
)
returns json
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_player_id text := nullif(trim(coalesce(p_player_id, '')), '');
  v_row jsonb;
begin
  if auth.uid() is null then
    return json_build_object(
      'ok', false,
      'data', null,
      'code', 'NOT_AUTHENTICATED',
      'message', 'Authentication required'
    );
  end if;

  if v_player_id is null then
    return json_build_object(
      'ok', false,
      'data', null,
      'code', 'INVALID_REQUEST',
      'message', 'playerId is required'
    );
  end if;

  select public.player_directory_project_row(
    p.player_id,
    p.display_name,
    p.avatar_url,
    p.activity_region,
    p.gender,
    p.handedness,
    p.privacy_settings
  )
  into v_row
  from public.profiles as p
  where trim(p.player_id) = v_player_id
    and p.player_id is not null
    and length(trim(p.player_id)) > 0
    and nullif(trim(p.display_name), '') is not null
    and p.identity_verification_status = 'verified'
    and p.privacy_settings is not null
    and jsonb_typeof(p.privacy_settings) = 'object'
    and (p.privacy_settings ->> 'publicProfileEnabled') = 'true'
    and p.status is distinct from 'suspended'
  limit 1;

  -- Missing, ineligible, suspended, privacy-off, unverified → indistinguishable null.
  return json_build_object(
    'ok', true,
    'data', v_row,
    'code', null,
    'message', null
  );
end;
$$;

comment on function public.player_directory_get(text) is
  'Phase 1I-B: authenticated Public Player Directory detail. Generic null when hidden/missing.';

-- ─── 4. Indexes (additive, reversible) ───────────────────────────────────────

-- Primary directory browse / search / cursor order covering eligibility.
create index if not exists profiles_directory_eligible_name_id_idx
  on public.profiles (
    lower(trim(display_name)),
    player_id
  )
  where identity_verification_status = 'verified'
    and privacy_settings is not null
    and jsonb_typeof(privacy_settings) = 'object'
    and (privacy_settings ->> 'publicProfileEnabled') = 'true'
    and status is distinct from 'suspended'
    and player_id is not null
    and length(trim(player_id)) > 0
    and nullif(trim(display_name), '') is not null;

-- Detail lookup by canonical player_id (non-null only; not unique historically).
create index if not exists profiles_directory_player_id_idx
  on public.profiles (player_id)
  where player_id is not null
    and length(trim(player_id)) > 0;

-- ─── 5. Grants / revokes ─────────────────────────────────────────────────────

-- Helpers: revoke broadly (internal only).
revoke all on function public.player_directory_format_activity_region(jsonb) from public;
revoke all on function public.player_directory_format_activity_region(jsonb) from anon;
revoke all on function public.player_directory_format_activity_region(jsonb) from authenticated;

revoke all on function public.player_directory_encode_cursor(text, text) from public;
revoke all on function public.player_directory_encode_cursor(text, text) from anon;
revoke all on function public.player_directory_encode_cursor(text, text) from authenticated;

revoke all on function public.player_directory_decode_cursor(text) from public;
revoke all on function public.player_directory_decode_cursor(text) from anon;
revoke all on function public.player_directory_decode_cursor(text) from authenticated;

revoke all on function public.player_directory_project_row(text, text, text, jsonb, text, text, jsonb) from public;
revoke all on function public.player_directory_project_row(text, text, text, jsonb, text, text, jsonb) from anon;
revoke all on function public.player_directory_project_row(text, text, text, jsonb, text, text, jsonb) from authenticated;

-- Public RPCs: authenticated EXECUTE only.
revoke all on function public.player_directory_search(text, text, text, integer) from public;
revoke all on function public.player_directory_search(text, text, text, integer) from anon;
grant execute on function public.player_directory_search(text, text, text, integer) to authenticated;

revoke all on function public.player_directory_get(text) from public;
revoke all on function public.player_directory_get(text) from anon;
grant execute on function public.player_directory_get(text) to authenticated;

commit;
