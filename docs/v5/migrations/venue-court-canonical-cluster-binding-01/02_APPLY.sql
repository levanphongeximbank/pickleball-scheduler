-- Venue/Court canonical cluster membership binding.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO STAGING.
-- Additive RPC. Does not seed courts. Does not create a competition-specific writer.

BEGIN;

CREATE OR REPLACE FUNCTION public.bind_club_courts_to_cluster(
  p_request_id uuid,
  p_club_id text,
  p_venue_id text,
  p_cluster_id text,
  p_court_ids text[],
  p_expected_club_version integer,
  p_expected_blob_version integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cached jsonb;
  v_club public.clubs%ROWTYPE;
  v_blob public.club_data_v3%ROWTYPE;
  v_cluster public.court_clusters%ROWTYPE;
  v_club_id text := trim(coalesce(p_club_id, ''));
  v_venue_id text := trim(coalesce(p_venue_id, ''));
  v_cluster_id text := trim(coalesce(p_cluster_id, ''));
  v_requested text[] := ARRAY(
    SELECT DISTINCT trim(x)
    FROM unnest(coalesce(p_court_ids, ARRAY[]::text[])) AS x
    WHERE trim(coalesce(x, '')) <> ''
  );
  v_payload jsonb;
  v_courts jsonb;
  v_nested boolean := false;
  v_court jsonb;
  v_next_courts jsonb := '[]'::jsonb;
  v_court_id text;
  v_current_cluster text;
  v_found int;
  v_changed_courts text[] := ARRAY[]::text[];
  v_club_changed boolean := false;
  v_blob_changed boolean := false;
  v_club_current text;
  v_resp jsonb;
  v_blob_count int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  END IF;

  IF p_request_id IS NULL THEN
    RETURN public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.');
  END IF;

  v_cached := public.phase42_idempotency_get(p_request_id, 'bind_club_courts_to_cluster');
  IF v_cached IS NOT NULL THEN
    RETURN v_cached::json;
  END IF;

  IF v_club_id = '' THEN
    RETURN public.phase42_err('CLUB_REQUIRED', 'Thiếu clubId.');
  END IF;
  IF v_venue_id = '' THEN
    RETURN public.phase42_err('VENUE_REQUIRED', 'Thiếu venueId.');
  END IF;
  IF v_cluster_id = '' THEN
    RETURN public.phase42_err('CLUSTER_REQUIRED', 'Thiếu clusterId.');
  END IF;

  SELECT * INTO v_club
  FROM public.clubs
  WHERE id = v_club_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.phase42_err('CLUB_NOT_FOUND', 'Không tìm thấy CLB.');
  END IF;

  IF v_club.version IS DISTINCT FROM p_expected_club_version THEN
    RETURN public.phase42_err('VERSION_CONFLICT', 'Xung đột phiên bản CLB.');
  END IF;

  IF v_club.tenant_id IS DISTINCT FROM v_venue_id THEN
    RETURN public.phase42_err('CLUB_TENANT_MISMATCH', 'CLB không thuộc tổ chức này.');
  END IF;

  IF NOT public.phase42_can_update_club(v_club.id) THEN
    RETURN public.phase42_err('FORBIDDEN', 'Không có quyền gán cụm sân.');
  END IF;

  SELECT * INTO v_cluster
  FROM public.court_clusters
  WHERE id = v_cluster_id
  FOR SHARE;
  IF NOT FOUND THEN
    RETURN public.phase42_err('CLUSTER_NOT_FOUND', 'Không tìm thấy cụm sân.');
  END IF;
  IF v_cluster.status IS DISTINCT FROM 'active' THEN
    RETURN public.phase42_err('CLUSTER_INACTIVE', 'Cụm sân không còn hoạt động.');
  END IF;
  IF v_cluster.venue_id IS DISTINCT FROM v_venue_id THEN
    RETURN public.phase42_err('CLUSTER_VENUE_MISMATCH', 'Cụm sân không thuộc tổ chức này.');
  END IF;

  v_club_current := nullif(trim(coalesce(v_club.registered_cluster_id, '')), '');
  IF v_club_current IS NOT NULL AND v_club_current IS DISTINCT FROM v_cluster_id THEN
    RETURN public.phase42_err(
      'FOREIGN_CLUSTER',
      'CLB đã thuộc cụm khác. Không chuyển cụm im lặng.'
    );
  END IF;
  v_club_changed := v_club_current IS DISTINCT FROM v_cluster_id;

  SELECT count(*) INTO v_blob_count
  FROM public.club_data_v3
  WHERE club_id = v_club_id
    AND (
      venue_id IS NULL
      OR btrim(venue_id) = ''
      OR venue_id = v_venue_id
    );
  IF v_blob_count > 1 THEN
    RETURN public.phase42_err('AMBIGUOUS_CLUB_BLOB', 'Nhiều club_data_v3 rows — từ chối ghi.');
  END IF;

  SELECT * INTO v_blob
  FROM public.club_data_v3
  WHERE club_id = v_club_id
    AND (
      venue_id IS NULL
      OR btrim(venue_id) = ''
      OR venue_id = v_venue_id
    )
  FOR UPDATE;

  IF cardinality(v_requested) > 0 THEN
    IF NOT FOUND THEN
      RETURN public.phase42_err('CLUB_BLOB_MISSING', 'Chưa có inventory sân cloud của CLB.');
    END IF;
    IF v_blob.venue_id IS NOT NULL
       AND btrim(v_blob.venue_id) <> ''
       AND v_blob.venue_id IS DISTINCT FROM v_venue_id THEN
      RETURN public.phase42_err('CLUB_TENANT_MISMATCH', 'Blob sân thuộc tenant khác.');
    END IF;
    IF v_blob.version IS DISTINCT FROM coalesce(p_expected_blob_version, v_blob.version) THEN
      RETURN public.phase42_err('VERSION_CONFLICT', 'Xung đột phiên bản inventory sân.');
    END IF;

    v_payload := coalesce(v_blob.data, '{}'::jsonb);
    IF jsonb_typeof(v_payload->'data') = 'object'
       AND jsonb_typeof(v_payload->'data'->'courts') = 'array' THEN
      v_nested := true;
      v_courts := v_payload->'data'->'courts';
    ELSIF jsonb_typeof(v_payload->'courts') = 'array' THEN
      v_nested := false;
      v_courts := v_payload->'courts';
    ELSE
      RETURN public.phase42_err('COURT_NOT_FOUND', 'Sân được chọn không có trong inventory của CLB này.');
    END IF;

    FOREACH v_court_id IN ARRAY v_requested LOOP
      v_found := 0;
      FOR v_court IN SELECT value FROM jsonb_array_elements(v_courts)
      LOOP
        IF trim(coalesce(v_court->>'id', '')) = v_court_id THEN
          v_found := v_found + 1;
          IF nullif(trim(coalesce(v_court->>'clubId', v_court->>'club_id', '')), '') IS NOT NULL
             AND trim(coalesce(v_court->>'clubId', v_court->>'club_id', '')) IS DISTINCT FROM v_club_id THEN
            RETURN public.phase42_err('CROSS_CLUB_COURT', 'Không được gán sân của CLB khác.');
          END IF;
        END IF;
      END LOOP;
      IF v_found = 0 THEN
        RETURN public.phase42_err('COURT_NOT_FOUND', 'Sân được chọn không có trong inventory của CLB này.');
      END IF;
    END LOOP;

    FOR v_court IN SELECT value FROM jsonb_array_elements(v_courts)
    LOOP
      v_court_id := trim(coalesce(v_court->>'id', ''));
      IF v_court_id = ANY (v_requested) THEN
        v_current_cluster := nullif(trim(coalesce(v_court->>'clusterId', v_court->>'cluster_id', '')), '');
        IF v_current_cluster IS NOT NULL AND v_current_cluster IS DISTINCT FROM v_cluster_id THEN
          RETURN public.phase42_err(
            'FOREIGN_CLUSTER',
            'Sân đã thuộc cụm khác. Không chuyển cụm im lặng.'
          );
        END IF;
        IF v_current_cluster IS DISTINCT FROM v_cluster_id THEN
          v_court := v_court || jsonb_build_object('clusterId', v_cluster_id);
          IF v_court ? 'cluster_id' THEN
            v_court := v_court || jsonb_build_object('cluster_id', v_cluster_id);
          END IF;
          v_changed_courts := array_append(v_changed_courts, v_court_id);
          v_blob_changed := true;
        END IF;
      END IF;
      v_next_courts := v_next_courts || jsonb_build_array(v_court);
    END LOOP;

    IF v_blob_changed THEN
      IF v_nested THEN
        v_payload := jsonb_set(v_payload, '{data,courts}', v_next_courts, true);
      ELSE
        v_payload := jsonb_set(v_payload, '{courts}', v_next_courts, true);
      END IF;
      UPDATE public.club_data_v3
      SET data = v_payload,
          version = version + 1,
          synced_at = now()
      WHERE club_id = v_blob.club_id
        AND version = v_blob.version
        AND (venue_id IS NOT DISTINCT FROM v_blob.venue_id);
      IF NOT FOUND THEN
        RETURN public.phase42_err('VERSION_CONFLICT', 'Xung đột phiên bản inventory sân.');
      END IF;
    END IF;
  END IF;

  IF v_club_changed THEN
    UPDATE public.clubs
    SET registered_cluster_id = v_cluster_id,
        version = version + 1
    WHERE id = v_club.id
      AND version = v_club.version;
    IF NOT FOUND THEN
      RETURN public.phase42_err('VERSION_CONFLICT', 'Xung đột phiên bản CLB.');
    END IF;
  END IF;

  PERFORM public.phase42_write_audit(
    'club.update',
    'club',
    v_club.id,
    v_club.tenant_id,
    v_club.id,
    jsonb_build_object(
      'command', 'bind_club_courts_to_cluster',
      'request_id', p_request_id,
      'cluster_id', v_cluster_id,
      'court_ids', to_jsonb(v_requested),
      'changed_court_ids', to_jsonb(v_changed_courts),
      'club_changed', v_club_changed,
      'blob_changed', v_blob_changed
    )
  );

  v_resp := jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'clubId', v_club.id,
    'venueId', v_venue_id,
    'clusterId', v_cluster_id,
    'clubRegisteredClusterId', v_cluster_id,
    'changedCourtIds', to_jsonb(v_changed_courts),
    'clubChanged', v_club_changed,
    'courtsChanged', v_blob_changed,
    'alreadyBound', (NOT v_club_changed AND NOT v_blob_changed),
    'clubVersion', CASE WHEN v_club_changed THEN v_club.version + 1 ELSE v_club.version END,
    'blobVersion', CASE
      WHEN v_blob.club_id IS NULL THEN NULL
      WHEN v_blob_changed THEN v_blob.version + 1
      ELSE v_blob.version
    END
  );
  PERFORM public.phase42_idempotency_put(
    p_request_id, v_club.tenant_id, 'bind_club_courts_to_cluster', v_club.id, v_resp
  );
  RETURN v_resp::json;

EXCEPTION
  WHEN others THEN
    RETURN public.phase42_err('UPDATE_FAILED', coalesce(SQLERRM, 'Không gán được cụm sân.'));
END;
$$;

REVOKE ALL ON FUNCTION public.bind_club_courts_to_cluster(uuid, text, text, text, text[], integer, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bind_club_courts_to_cluster(uuid, text, text, text, text[], integer, integer)
  TO authenticated;

COMMIT;
