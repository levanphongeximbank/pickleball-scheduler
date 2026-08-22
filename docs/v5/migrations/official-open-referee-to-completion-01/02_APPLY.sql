-- Official/Open referee-to-completion 01 APPLY.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO STAGING.
-- Does NOT mutate fixture rows. Does NOT touch court_reservations.
-- Does NOT apply Side-out runtime.
--
-- Referee token commit concurrency:
--   REFEREE_RESULT_CONCURRENCY_MODE=SERVER_ROW_LOCK_SERIALIZED
--   Locks live row FOR UPDATE, then canonical_tournaments FOR UPDATE,
--   re-reads match under that lock, version++. No client expected_version.
--   No full-payload stale overwrite. Canonical version remains the sole
--   Tournament revision authority.
-- Admin Organizer correction uses expected_version CAS.

BEGIN;

ALTER TABLE public.tournament_match_live
  ADD COLUMN IF NOT EXISTS live_revision bigint NOT NULL DEFAULT 1;
ALTER TABLE public.tournament_match_live
  ADD COLUMN IF NOT EXISTS scoring_target integer;
ALTER TABLE public.tournament_match_live
  ADD COLUMN IF NOT EXISTS scoring_method text NOT NULL DEFAULT 'rally';
ALTER TABLE public.tournament_match_live
  ADD COLUMN IF NOT EXISTS scheduled_start text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.official_open_lifecycle_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  club_id text NOT NULL,
  tournament_id uuid NOT NULL,
  command_type text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, club_id, tournament_id, command_type, idempotency_key)
);

ALTER TABLE public.official_open_lifecycle_commands ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.official_open_lifecycle_commands FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_json_err(p_code text, p_error text, p_extra jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object('ok', false, 'code', p_code, 'error', p_error) || COALESCE(p_extra, '{}'::jsonb);
$$;

REVOKE ALL ON FUNCTION public.official_open_json_err(text, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_entry_name(p_payload jsonb, p_entry_id text)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_event jsonb;
  v_entry jsonb;
  v_name text;
BEGIN
  IF p_entry_id IS NULL OR btrim(p_entry_id) = '' THEN
    RETURN '';
  END IF;
  FOR v_event IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'events', '[]'::jsonb))
  LOOP
    FOR v_entry IN SELECT value FROM jsonb_array_elements(COALESCE(v_event->'entries', '[]'::jsonb) || COALESCE(v_event->'drawEntries', '[]'::jsonb))
    LOOP
      IF v_entry->>'id' = p_entry_id THEN
        v_name := nullif(btrim(COALESCE(v_entry->>'name', '')), '');
        IF v_name IS NOT NULL THEN
          RETURN v_name;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  RETURN 'Cặp';
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_entry_name(jsonb, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_find_match(p_payload jsonb, p_match_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_event jsonb;
  v_match jsonb;
  v_ei int;
  v_mi int;
BEGIN
  IF p_match_id IS NULL OR btrim(p_match_id) = '' THEN
    RETURN NULL;
  END IF;
  IF jsonb_typeof(p_payload->'events') IS DISTINCT FROM 'array' THEN
    RETURN NULL;
  END IF;
  FOR v_ei IN 0 .. jsonb_array_length(p_payload->'events') - 1 LOOP
    v_event := p_payload->'events'->v_ei;
    IF jsonb_typeof(v_event->'matches') IS DISTINCT FROM 'array' THEN
      CONTINUE;
    END IF;
    FOR v_mi IN 0 .. jsonb_array_length(v_event->'matches') - 1 LOOP
      v_match := v_event->'matches'->v_mi;
      IF v_match->>'id' = p_match_id THEN
        RETURN jsonb_build_object(
          'eventIdx', v_ei,
          'matchIdx', v_mi,
          'eventId', COALESCE(v_event->>'id', ''),
          'event', v_event,
          'match', v_match
        );
      END IF;
    END LOOP;
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_find_match(jsonb, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_assignment_token(p_payload jsonb, p_match jsonb)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_token text;
  v_match_id text;
BEGIN
  v_match_id := COALESCE(p_match->>'id', '');
  v_token := nullif(btrim(COALESCE(p_match->'referee'->>'token', '')), '');
  IF v_token IS NOT NULL THEN
    RETURN v_token;
  END IF;
  v_token := nullif(btrim(COALESCE(p_payload->'settings'->'refereeAssignments'->v_match_id->>'token', '')), '');
  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_assignment_token(jsonb, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_round_target(p_payload jsonb, p_match jsonb)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_targets jsonb;
  v_stage text;
  v_bmid text;
  v_key text := 'group';
  v_val int;
BEGIN
  v_targets := COALESCE(p_payload->'settings'->'officialCompetition'->'roundTargets', '{}'::jsonb);
  v_stage := lower(COALESCE(p_match->>'stage', p_match->>'roundType', ''));
  v_bmid := COALESCE(p_match->>'bracketMatchId', '');
  IF v_stage IN ('final') THEN
    v_key := 'final';
  ELSIF v_stage IN ('semifinal') THEN
    v_key := 'semifinal';
  ELSIF v_stage IN ('quarterfinal') THEN
    v_key := 'quarterfinal';
  ELSIF v_stage IN ('round_of_16', 'roundof16') THEN
    v_key := 'round_of_16';
  ELSIF v_bmid <> '' THEN
    v_key := 'quarterfinal';
  ELSIF COALESCE(p_match->>'groupId', '') <> '' THEN
    v_key := 'group';
  END IF;
  v_val := NULLIF(v_targets->>v_key, '')::int;
  IF v_val IS NULL OR v_val < 1 THEN
    RETURN 11;
  END IF;
  RETURN v_val;
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_round_target(jsonb, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_validate_rally(p_score_a int, p_score_b int, p_target int)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_score_a IS NULL OR p_score_b IS NULL OR p_score_a < 0 OR p_score_b < 0 THEN
    RETURN public.official_open_json_err('INVALID_SCORE', 'Điểm không hợp lệ.');
  END IF;
  IF p_score_a = p_score_b THEN
    RETURN public.official_open_json_err('DRAW_NOT_ALLOWED', 'Trận không được hòa.');
  END IF;
  IF GREATEST(p_score_a, p_score_b) < COALESCE(p_target, 11) THEN
    RETURN public.official_open_json_err(
      'UNFINISHED_SCORE',
      format('Điểm thắng phải đạt ít nhất %s.', COALESCE(p_target, 11))
    );
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_validate_rally(int, int, int) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_is_closed(p_row public.canonical_tournaments)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF lower(COALESCE(p_row.status, '')) IN ('completed', 'cancelled') THEN
    RETURN true;
  END IF;
  IF COALESCE((p_row.payload->'settings'->'resultsOps'->>'closed')::boolean, false) THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_is_closed(public.canonical_tournaments) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_apply_match_result(
  p_payload jsonb,
  p_match_id text,
  p_score_a int,
  p_score_b int,
  p_winner_id text,
  p_loser_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_found jsonb;
  v_event jsonb;
  v_match jsonb;
  v_matches jsonb := '[]'::jsonb;
  v_events jsonb := '[]'::jsonb;
  v_ei int;
  v_mi int;
  v_bmid text;
  v_round int;
  v_mnum int;
  v_next_id text;
  v_next_slot text;
  v_side text;
  v_winner_entry jsonb;
  v_ri int;
  v_bi int;
  v_round_obj jsonb;
  v_bmatches jsonb;
  v_bm jsonb;
BEGIN
  v_found := public.official_open_find_match(p_payload, p_match_id);
  IF v_found IS NULL THEN
    RETURN p_payload;
  END IF;
  v_ei := (v_found->>'eventIdx')::int;
  v_event := v_found->'event';
  v_match := v_found->'match';
  v_bmid := COALESCE(v_match->>'bracketMatchId', '');
  v_side := CASE WHEN p_winner_id = v_match->>'entryAId' THEN 'home' ELSE 'away' END;
  v_winner_entry := jsonb_build_object(
    'id', p_winner_id,
    'name', public.official_open_entry_name(p_payload, p_winner_id)
  );

  v_next_id := NULL;
  IF v_bmid ~ '^R[0-9]+-M[0-9]+$' THEN
    v_round := substring(v_bmid from 'R([0-9]+)-')::int;
    v_mnum := substring(v_bmid from '-M([0-9]+)$')::int;
    v_next_id := format('R%s-M%s', v_round + 1, ceil(v_mnum / 2.0)::int);
    v_next_slot := CASE WHEN v_mnum % 2 = 1 THEN 'A' ELSE 'B' END;
  END IF;

  FOR v_mi IN 0 .. COALESCE(jsonb_array_length(v_event->'matches'), 0) - 1 LOOP
    v_match := v_event->'matches'->v_mi;
    IF v_match->>'id' = p_match_id THEN
      v_match := v_match || jsonb_build_object(
        'scoreA', p_score_a,
        'scoreB', p_score_b,
        'winnerId', p_winner_id,
        'loserId', p_loser_id,
        'status', 'completed',
        'completedAt', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      );
    ELSIF v_next_id IS NOT NULL AND COALESCE(v_match->>'bracketMatchId', '') = v_next_id THEN
      IF v_next_slot = 'A' THEN
        v_match := v_match || jsonb_build_object('entryAId', p_winner_id);
      ELSE
        v_match := v_match || jsonb_build_object('entryBId', p_winner_id);
      END IF;
    END IF;
    v_matches := v_matches || jsonb_build_array(v_match);
  END LOOP;
  v_event := jsonb_set(v_event, '{matches}', v_matches);

  IF v_bmid <> '' AND v_event->'bracket' IS NOT NULL THEN
    v_event := jsonb_set(
      v_event,
      ARRAY['bracket', 'winnersByMatch', v_bmid],
      to_jsonb(v_side)
    );
    IF v_next_id IS NOT NULL AND jsonb_typeof(v_event->'bracket'->'rounds') = 'array' THEN
      FOR v_ri IN 0 .. jsonb_array_length(v_event->'bracket'->'rounds') - 1 LOOP
        v_round_obj := v_event->'bracket'->'rounds'->v_ri;
        IF jsonb_typeof(v_round_obj->'matches') IS DISTINCT FROM 'array' THEN
          CONTINUE;
        END IF;
        v_bmatches := '[]'::jsonb;
        FOR v_bi IN 0 .. jsonb_array_length(v_round_obj->'matches') - 1 LOOP
          v_bm := v_round_obj->'matches'->v_bi;
          IF v_bm->>'id' = v_next_id THEN
            IF v_next_slot = 'A' THEN
              v_bm := jsonb_set(v_bm, '{home}', v_winner_entry);
            ELSE
              v_bm := jsonb_set(v_bm, '{away}', v_winner_entry);
            END IF;
          END IF;
          v_bmatches := v_bmatches || jsonb_build_array(v_bm);
        END LOOP;
        v_round_obj := jsonb_set(v_round_obj, '{matches}', v_bmatches);
        v_event := jsonb_set(v_event, ARRAY['bracket', 'rounds', v_ri::text], v_round_obj);
      END LOOP;
    END IF;
  END IF;

  FOR v_ei IN 0 .. jsonb_array_length(p_payload->'events') - 1 LOOP
    IF v_ei = (v_found->>'eventIdx')::int THEN
      v_events := v_events || jsonb_build_array(v_event);
    ELSE
      v_events := v_events || jsonb_build_array(p_payload->'events'->v_ei);
    END IF;
  END LOOP;
  RETURN jsonb_set(p_payload, '{events}', v_events);
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_apply_match_result(jsonb, text, int, int, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_qualifiers_per_group(p_payload jsonb)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_val int;
BEGIN
  v_val := NULLIF(p_payload->'settings'->'officialCompetition'->>'qualifiersPerGroup', '')::int;
  IF v_val IS NULL OR v_val < 1 THEN
    RETURN 2;
  END IF;
  RETURN v_val;
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_qualifiers_per_group(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_sporting_equal(p_a jsonb, p_b jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    COALESCE((p_a->>'matchPoints')::int, 0) = COALESCE((p_b->>'matchPoints')::int, 0)
    AND COALESCE((p_a->>'scoreDiff')::int, 0) = COALESCE((p_b->>'scoreDiff')::int, 0)
    AND COALESCE((p_a->>'pointsFor')::int, 0) = COALESCE((p_b->>'pointsFor')::int, 0)
    AND COALESCE((p_a->>'won')::int, 0) = COALESCE((p_b->>'won')::int, 0);
$$;

REVOKE ALL ON FUNCTION public.official_open_sporting_equal(jsonb, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_stat_add(
  p_stats jsonb,
  p_id text,
  p_played int,
  p_won int,
  p_lost int,
  p_draw int,
  p_points_for int,
  p_points_against int,
  p_match_points int
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_row jsonb;
  v_pf int;
  v_pa int;
BEGIN
  IF p_id IS NULL OR btrim(p_id) = '' OR p_stats->p_id IS NULL THEN
    RETURN p_stats;
  END IF;
  v_row := p_stats->p_id;
  v_pf := COALESCE((v_row->>'pointsFor')::int, 0) + COALESCE(p_points_for, 0);
  v_pa := COALESCE((v_row->>'pointsAgainst')::int, 0) + COALESCE(p_points_against, 0);
  RETURN jsonb_set(
    p_stats,
    ARRAY[p_id],
    v_row || jsonb_build_object(
      'played', COALESCE((v_row->>'played')::int, 0) + COALESCE(p_played, 0),
      'won', COALESCE((v_row->>'won')::int, 0) + COALESCE(p_won, 0),
      'lost', COALESCE((v_row->>'lost')::int, 0) + COALESCE(p_lost, 0),
      'draw', COALESCE((v_row->>'draw')::int, 0) + COALESCE(p_draw, 0),
      'pointsFor', v_pf,
      'pointsAgainst', v_pa,
      'scoreDiff', v_pf - v_pa,
      'matchPoints', COALESCE((v_row->>'matchPoints')::int, 0) + COALESCE(p_match_points, 0)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_stat_add(jsonb, text, int, int, int, int, int, int, int) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_event_qualification(p_payload jsonb, p_event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_q int;
  v_group jsonb;
  v_groups_out jsonb := '[]'::jsonb;
  v_eid text;
  v_stats jsonb;
  v_match jsonb;
  v_id_a text;
  v_id_b text;
  v_score_a int;
  v_score_b int;
  v_standing jsonb;
  v_qualified jsonb;
  v_n int;
  v_last jsonb;
  v_first_out jsonb;
  v_label text;
  v_group_id text;
BEGIN
  v_q := public.official_open_qualifiers_per_group(p_payload);

  FOR v_group IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_event->'groups', '[]'::jsonb))
  LOOP
    v_group_id := COALESCE(v_group->>'id', '');
    v_label := COALESCE(NULLIF(v_group->>'label', ''), NULLIF(v_group->>'name', ''), 'A');
    v_stats := '{}'::jsonb;
    FOR v_eid IN SELECT jsonb_array_elements_text(COALESCE(v_group->'entryIds', '[]'::jsonb))
    LOOP
      IF v_eid IS NULL OR btrim(v_eid) = '' THEN
        CONTINUE;
      END IF;
      v_stats := v_stats || jsonb_build_object(
        v_eid,
        jsonb_build_object(
          'id', v_eid,
          'name', public.official_open_entry_name(p_payload, v_eid),
          'played', 0,
          'won', 0,
          'lost', 0,
          'draw', 0,
          'pointsFor', 0,
          'pointsAgainst', 0,
          'scoreDiff', 0,
          'matchPoints', 0
        )
      );
    END LOOP;

    FOR v_match IN SELECT value FROM jsonb_array_elements(COALESCE(p_event->'matches', '[]'::jsonb))
    LOOP
      IF COALESCE(v_match->>'groupId', '') IS DISTINCT FROM v_group_id THEN
        CONTINUE;
      END IF;
      IF COALESCE(v_match->>'bracketMatchId', '') <> '' THEN
        CONTINUE;
      END IF;
      IF v_match->>'status' NOT IN ('completed', 'forfeit') THEN
        CONTINUE;
      END IF;
      v_id_a := COALESCE(v_match->>'entryAId', '');
      v_id_b := COALESCE(v_match->>'entryBId', '');
      IF v_stats->v_id_a IS NULL OR v_stats->v_id_b IS NULL THEN
        CONTINUE;
      END IF;

      IF v_match->>'status' = 'forfeit' THEN
        IF v_match->>'winnerId' = v_id_a THEN
          v_stats := public.official_open_stat_add(v_stats, v_id_a, 1, 1, 0, 0, 0, 0, 2);
          v_stats := public.official_open_stat_add(v_stats, v_id_b, 1, 0, 1, 0, 0, 0, 0);
        ELSIF v_match->>'winnerId' = v_id_b THEN
          v_stats := public.official_open_stat_add(v_stats, v_id_b, 1, 1, 0, 0, 0, 0, 2);
          v_stats := public.official_open_stat_add(v_stats, v_id_a, 1, 0, 1, 0, 0, 0, 0);
        END IF;
      ELSE
        v_score_a := COALESCE(NULLIF(v_match->>'scoreA', '')::int, 0);
        v_score_b := COALESCE(NULLIF(v_match->>'scoreB', '')::int, 0);
        IF v_score_a > v_score_b THEN
          v_stats := public.official_open_stat_add(v_stats, v_id_a, 1, 1, 0, 0, v_score_a, v_score_b, 2);
          v_stats := public.official_open_stat_add(v_stats, v_id_b, 1, 0, 1, 0, v_score_b, v_score_a, 1);
        ELSIF v_score_b > v_score_a THEN
          v_stats := public.official_open_stat_add(v_stats, v_id_b, 1, 1, 0, 0, v_score_b, v_score_a, 2);
          v_stats := public.official_open_stat_add(v_stats, v_id_a, 1, 0, 1, 0, v_score_a, v_score_b, 1);
        ELSE
          v_stats := public.official_open_stat_add(v_stats, v_id_a, 1, 0, 0, 1, v_score_a, v_score_b, 1);
          v_stats := public.official_open_stat_add(v_stats, v_id_b, 1, 0, 0, 1, v_score_b, v_score_a, 1);
        END IF;
      END IF;
    END LOOP;

    SELECT COALESCE(
      jsonb_agg(s.stat ORDER BY
        COALESCE((s.stat->>'matchPoints')::int, 0) DESC,
        COALESCE((s.stat->>'scoreDiff')::int, 0) DESC,
        COALESCE((s.stat->>'pointsFor')::int, 0) DESC,
        COALESCE((s.stat->>'won')::int, 0) DESC
      ),
      '[]'::jsonb
    )
    INTO v_standing
    FROM jsonb_each(v_stats) AS s(id, stat);

    v_n := jsonb_array_length(v_standing);
    IF v_n = 0 THEN
      CONTINUE;
    END IF;
    IF v_n <= v_q THEN
      v_qualified := v_standing;
    ELSE
      v_last := v_standing->(v_q - 1);
      v_first_out := v_standing->v_q;
      IF public.official_open_sporting_equal(v_last, v_first_out) THEN
        RETURN public.official_open_json_err(
          'QUALIFICATION_TIE_UNRESOLVED',
          format('Bảng %s hòa chỉ số thể thao tại ranh giới suất — không bốc KO.', v_label)
        );
      END IF;
      SELECT COALESCE(jsonb_agg(x.value ORDER BY x.ord), '[]'::jsonb)
      INTO v_qualified
      FROM jsonb_array_elements(v_standing) WITH ORDINALITY AS x(value, ord)
      WHERE x.ord <= v_q;
    END IF;

    v_groups_out := v_groups_out || jsonb_build_array(jsonb_build_object(
      'groupId', v_group_id,
      'group', v_label,
      'standing', v_standing,
      'qualified', v_qualified,
      'qualificationTieUnresolved', false,
      'qualifiersPerGroup', v_q
    ));
  END LOOP;

  SELECT COALESCE(jsonb_agg(g.value ORDER BY g.value->>'group'), '[]'::jsonb)
  INTO v_groups_out
  FROM jsonb_array_elements(v_groups_out) AS g(value);

  RETURN jsonb_build_object('ok', true, 'qualifiersPerGroup', v_q, 'standings', v_groups_out);
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_event_qualification(jsonb, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_ko_round_name(p_team_count int)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_team_count = 32 THEN
    RETURN 'Vong 1/16';
  ELSIF p_team_count = 16 THEN
    RETURN 'Vong 1/8';
  ELSIF p_team_count = 8 THEN
    RETURN 'Tu ket';
  ELSIF p_team_count = 4 THEN
    RETURN 'Ban ket';
  ELSIF p_team_count = 2 THEN
    RETURN 'Chung ket';
  END IF;
  RETURN format('Knockout %s', p_team_count);
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_ko_round_name(int) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_ko_stage(p_round_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_round_name = 'Chung ket' THEN
    RETURN 'final';
  ELSIF p_round_name = 'Ban ket' THEN
    RETURN 'semifinal';
  ELSIF p_round_name = 'Tu ket' THEN
    RETURN 'quarterfinal';
  ELSIF p_round_name IN ('Vong 1/8', 'Vong 1/16') THEN
    RETURN 'round_of_16';
  END IF;
  RETURN 'quarterfinal';
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_ko_stage(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_build_knockout(p_payload jsonb, p_event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_qual jsonb;
  v_q int;
  v_standings jsonb;
  v_n_groups int;
  v_i int;
  v_left jsonb;
  v_right jsonb;
  v_first jsonb;
  v_second jsonb;
  v_rounds jsonb := '[]'::jsonb;
  v_round jsonb;
  v_matches jsonb;
  v_prev jsonb;
  v_next_matches jsonb;
  v_mi int;
  v_left_m jsonb;
  v_right_m jsonb;
  v_round_idx int;
  v_team_count int;
  v_round_name text;
  v_stage text;
  v_ko_matches jsonb := '[]'::jsonb;
  v_group_matches jsonb := '[]'::jsonb;
  v_match jsonb;
  v_bm jsonb;
  v_seen jsonb := '{}'::jsonb;
  v_qid text;
  v_home jsonb;
  v_away jsonb;
  v_id text;
BEGIN
  v_qual := public.official_open_event_qualification(p_payload, p_event);
  IF COALESCE(v_qual->>'ok', 'false') <> 'true' THEN
    RETURN v_qual;
  END IF;
  v_q := COALESCE((v_qual->>'qualifiersPerGroup')::int, 2);
  v_standings := COALESCE(v_qual->'standings', '[]'::jsonb);
  v_n_groups := jsonb_array_length(v_standings);
  IF v_n_groups < 2 THEN
    RETURN public.official_open_json_err('KO_NEED_TWO_GROUPS', 'Cần ít nhất 2 bảng để tạo knockout.');
  END IF;
  IF v_n_groups % 2 <> 0 THEN
    RETURN public.official_open_json_err('KO_ODD_GROUP_COUNT', 'Số bảng phải là số chẵn (2/4/8/16).');
  END IF;

  v_matches := '[]'::jsonb;
  FOR v_i IN 0 .. v_n_groups - 1 BY 2 LOOP
    v_left := v_standings->v_i;
    v_right := v_standings->(v_i + 1);
    IF jsonb_array_length(COALESCE(v_left->'qualified', '[]'::jsonb)) < v_q
       OR jsonb_array_length(COALESCE(v_right->'qualified', '[]'::jsonb)) < v_q THEN
      RETURN public.official_open_json_err('QUALIFIERS_INCOMPLETE', 'Chưa đủ suất vượt bảng để tạo nhánh.');
    END IF;

    v_first := v_left->'qualified'->0;
    v_second := v_right->'qualified'->1;
    v_qid := v_first->>'id';
    IF v_qid IS NULL OR btrim(v_qid) = '' OR (v_seen -> v_qid) IS NOT NULL THEN
      RETURN public.official_open_json_err('DUPLICATE_OR_MISSING_QUALIFIER', 'Suất vượt bảng trùng hoặc thiếu.');
    END IF;
    v_seen := v_seen || jsonb_build_object(v_qid, true);
    v_qid := v_second->>'id';
    IF v_qid IS NULL OR btrim(v_qid) = '' OR (v_seen -> v_qid) IS NOT NULL THEN
      RETURN public.official_open_json_err('DUPLICATE_OR_MISSING_QUALIFIER', 'Suất vượt bảng trùng hoặc thiếu.');
    END IF;
    v_seen := v_seen || jsonb_build_object(v_qid, true);

    v_matches := v_matches || jsonb_build_array(jsonb_build_object(
      'id', format('R1-M%s', jsonb_array_length(v_matches) + 1),
      'home', jsonb_build_object('id', v_first->>'id', 'name', v_first->>'name'),
      'away', jsonb_build_object('id', v_second->>'id', 'name', v_second->>'name'),
      'homeSeed', format('%s1', v_left->>'group'),
      'awaySeed', format('%s2', v_right->>'group')
    ));

    v_first := v_left->'qualified'->1;
    v_second := v_right->'qualified'->0;
    v_qid := v_first->>'id';
    IF v_qid IS NULL OR btrim(v_qid) = '' OR (v_seen -> v_qid) IS NOT NULL THEN
      RETURN public.official_open_json_err('DUPLICATE_OR_MISSING_QUALIFIER', 'Suất vượt bảng trùng hoặc thiếu.');
    END IF;
    v_seen := v_seen || jsonb_build_object(v_qid, true);
    v_qid := v_second->>'id';
    IF v_qid IS NULL OR btrim(v_qid) = '' OR (v_seen -> v_qid) IS NOT NULL THEN
      RETURN public.official_open_json_err('DUPLICATE_OR_MISSING_QUALIFIER', 'Suất vượt bảng trùng hoặc thiếu.');
    END IF;
    v_seen := v_seen || jsonb_build_object(v_qid, true);

    v_matches := v_matches || jsonb_build_array(jsonb_build_object(
      'id', format('R1-M%s', jsonb_array_length(v_matches) + 1),
      'home', jsonb_build_object('id', v_first->>'id', 'name', v_first->>'name'),
      'away', jsonb_build_object('id', v_second->>'id', 'name', v_second->>'name'),
      'homeSeed', format('%s2', v_left->>'group'),
      'awaySeed', format('%s1', v_right->>'group')
    ));
  END LOOP;

  v_team_count := jsonb_array_length(v_matches) * 2;
  v_round_name := public.official_open_ko_round_name(v_team_count);
  v_rounds := jsonb_build_array(jsonb_build_object('name', v_round_name, 'matches', v_matches));
  v_prev := v_rounds->0;
  v_round_idx := 2;
  WHILE jsonb_array_length(COALESCE(v_prev->'matches', '[]'::jsonb)) > 1 LOOP
    v_next_matches := '[]'::jsonb;
    FOR v_mi IN 0 .. jsonb_array_length(v_prev->'matches') - 1 BY 2 LOOP
      v_left_m := v_prev->'matches'->v_mi;
      v_right_m := v_prev->'matches'->(v_mi + 1);
      IF v_left_m IS NULL OR v_right_m IS NULL THEN
        CONTINUE;
      END IF;
      v_next_matches := v_next_matches || jsonb_build_array(jsonb_build_object(
        'id', format('R%s-M%s', v_round_idx, jsonb_array_length(v_next_matches) + 1),
        'home', NULL,
        'away', NULL,
        'homeSeed', format('W(%s)', v_left_m->>'id'),
        'awaySeed', format('W(%s)', v_right_m->>'id')
      ));
    END LOOP;
    v_round_name := public.official_open_ko_round_name(jsonb_array_length(v_next_matches) * 2);
    v_round := jsonb_build_object('name', v_round_name, 'matches', v_next_matches);
    v_rounds := v_rounds || jsonb_build_array(v_round);
    v_prev := v_round;
    v_round_idx := v_round_idx + 1;
  END LOOP;

  FOR v_match IN SELECT value FROM jsonb_array_elements(COALESCE(p_event->'matches', '[]'::jsonb))
  LOOP
    IF COALESCE(v_match->>'bracketMatchId', '') = '' THEN
      v_group_matches := v_group_matches || jsonb_build_array(v_match);
    END IF;
  END LOOP;

  FOR v_i IN 0 .. jsonb_array_length(v_rounds) - 1 LOOP
    v_round := v_rounds->v_i;
    v_round_name := COALESCE(v_round->>'name', '');
    v_stage := public.official_open_ko_stage(v_round_name);
    FOR v_mi IN 0 .. jsonb_array_length(COALESCE(v_round->'matches', '[]'::jsonb)) - 1 LOOP
      v_bm := v_round->'matches'->v_mi;
      v_home := v_bm->'home';
      v_away := v_bm->'away';
      v_id := format('ko-%s', v_bm->>'id');
      v_ko_matches := v_ko_matches || jsonb_build_array(jsonb_build_object(
        'id', v_id,
        'tournamentId', COALESCE(p_event->>'tournamentId', ''),
        'eventId', COALESCE(p_event->>'id', ''),
        'groupId', '',
        'stage', v_stage,
        'round', COALESCE(NULLIF(substring(v_bm->>'id' from 'R([0-9]+)-'), '')::int, v_i + 1),
        'entryAId', COALESCE(v_home->>'id', ''),
        'entryBId', COALESCE(v_away->>'id', ''),
        'courtId', NULL,
        'status', 'waiting',
        'scoreA', NULL,
        'scoreB', NULL,
        'winnerId', '',
        'loserId', '',
        'startedAt', NULL,
        'completedAt', NULL,
        'bracketMatchId', v_bm->>'id',
        'referee', NULL,
        'scoreLog', '[]'::jsonb
      ));
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'event', p_event || jsonb_build_object(
      'matches', v_group_matches || v_ko_matches,
      'bracket', jsonb_build_object(
        'rounds', v_rounds,
        'winnersByMatch', '{}'::jsonb,
        'unlockedRounds', '{}'::jsonb,
        'qualifiersPerGroup', v_q,
        'generatedAt', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
    ),
    'knockoutMatchCount', jsonb_array_length(v_ko_matches),
    'qualifiersPerGroup', v_q,
    'roundCount', jsonb_array_length(v_rounds)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_build_knockout(jsonb, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_completion_check(p_row public.canonical_tournaments)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_event jsonb;
  v_match jsonb;
  v_group_total int := 0;
  v_group_done int := 0;
  v_ko_total int := 0;
  v_ko_done int := 0;
  v_final_done boolean := false;
  v_champion text := '';
  v_runner text := '';
  v_incomplete int := 0;
  v_has_groups boolean := false;
  v_qual jsonb;
BEGIN
  FOR v_event IN SELECT value FROM jsonb_array_elements(COALESCE(p_row.payload->'events', '[]'::jsonb))
  LOOP
    IF jsonb_array_length(COALESCE(v_event->'groups', '[]'::jsonb)) >= 1 THEN
      v_has_groups := true;
    END IF;
    FOR v_match IN SELECT value FROM jsonb_array_elements(COALESCE(v_event->'matches', '[]'::jsonb))
    LOOP
      IF COALESCE(v_match->>'bracketMatchId', '') = '' THEN
        v_group_total := v_group_total + 1;
        IF v_match->>'status' IN ('completed', 'forfeit') THEN
          v_group_done := v_group_done + 1;
        ELSE
          v_incomplete := v_incomplete + 1;
        END IF;
      ELSE
        v_ko_total := v_ko_total + 1;
        IF v_match->>'status' IN ('completed', 'forfeit') THEN
          v_ko_done := v_ko_done + 1;
        ELSE
          v_incomplete := v_incomplete + 1;
        END IF;
        IF lower(COALESCE(v_match->>'stage', '')) = 'final'
           AND v_match->>'status' IN ('completed', 'forfeit')
           AND COALESCE(v_match->>'winnerId', '') <> '' THEN
          v_final_done := true;
          v_champion := v_match->>'winnerId';
          v_runner := COALESCE(v_match->>'loserId', '');
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  IF v_group_total = 0 THEN
    RETURN public.official_open_json_err('NO_GROUP_MATCHES', 'Chưa có trận vòng bảng.');
  END IF;
  IF v_group_done < v_group_total THEN
    RETURN public.official_open_json_err(
      'GROUP_INCOMPLETE',
      format('Chưa hoàn tất vòng bảng (%s/%s).', v_group_done, v_group_total)
    );
  END IF;

  FOR v_event IN SELECT value FROM jsonb_array_elements(COALESCE(p_row.payload->'events', '[]'::jsonb))
  LOOP
    IF jsonb_array_length(COALESCE(v_event->'groups', '[]'::jsonb)) < 1 THEN
      CONTINUE;
    END IF;
    v_qual := public.official_open_event_qualification(p_row.payload, v_event);
    IF COALESCE(v_qual->>'ok', 'false') <> 'true' THEN
      RETURN v_qual;
    END IF;
  END LOOP;

  IF v_has_groups AND v_ko_total = 0 THEN
    RETURN public.official_open_json_err('KO_NOT_GENERATED', 'Chưa tạo vòng loại trực tiếp.');
  END IF;
  IF v_ko_total > 0 AND v_ko_done < v_ko_total THEN
    RETURN public.official_open_json_err(
      'KO_INCOMPLETE',
      format('Chưa hoàn tất knockout (%s/%s).', v_ko_done, v_ko_total)
    );
  END IF;
  IF v_ko_total > 0 AND NOT v_final_done THEN
    RETURN public.official_open_json_err('FINAL_INCOMPLETE', 'Chưa có kết quả Chung kết — chưa có vô địch.');
  END IF;
  IF v_incomplete > 0 THEN
    RETURN public.official_open_json_err(
      'INCOMPLETE_MATCHES',
      format('Còn %s trận chưa hoàn tất.', v_incomplete)
    );
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'championId', v_champion,
    'runnerUpId', v_runner,
    'championName', public.official_open_entry_name(p_row.payload, v_champion),
    'runnerUpName', public.official_open_entry_name(p_row.payload, v_runner)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_completion_check(public.canonical_tournaments) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_sanitize_public(p_row public.canonical_tournaments)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_event jsonb;
  v_match jsonb;
  v_group jsonb;
  v_entry jsonb;
  v_matches jsonb := '[]'::jsonb;
  v_groups jsonb := '[]'::jsonb;
  v_bracket jsonb;
  v_champion jsonb := NULL;
  v_runner jsonb := NULL;
  v_check jsonb;
BEGIN
  v_check := public.official_open_completion_check(p_row);
  IF COALESCE(v_check->>'ok', 'false') = 'true' THEN
    v_champion := jsonb_build_object(
      'entryId', v_check->>'championId',
      'name', v_check->>'championName'
    );
    v_runner := jsonb_build_object(
      'entryId', v_check->>'runnerUpId',
      'name', v_check->>'runnerUpName'
    );
  END IF;

  FOR v_event IN SELECT value FROM jsonb_array_elements(COALESCE(p_row.payload->'events', '[]'::jsonb))
  LOOP
    FOR v_group IN SELECT value FROM jsonb_array_elements(COALESCE(v_event->'groups', '[]'::jsonb))
    LOOP
      v_groups := v_groups || jsonb_build_array(jsonb_build_object(
        'id', v_group->>'id',
        'label', COALESCE(v_group->>'label', v_group->>'name', ''),
        'entryIds', COALESCE(v_group->'entryIds', '[]'::jsonb)
      ));
    END LOOP;
    FOR v_match IN SELECT value FROM jsonb_array_elements(COALESCE(v_event->'matches', '[]'::jsonb))
    LOOP
      v_matches := v_matches || jsonb_build_array(jsonb_build_object(
        'id', v_match->>'id',
        'stage', COALESCE(v_match->>'stage', ''),
        'groupId', COALESCE(v_match->>'groupId', ''),
        'bracketMatchId', COALESCE(v_match->>'bracketMatchId', ''),
        'entryAName', public.official_open_entry_name(p_row.payload, v_match->>'entryAId'),
        'entryBName', public.official_open_entry_name(p_row.payload, v_match->>'entryBId'),
        'scoreA', v_match->'scoreA',
        'scoreB', v_match->'scoreB',
        'winnerName', public.official_open_entry_name(p_row.payload, COALESCE(v_match->>'winnerId', '')),
        'status', COALESCE(v_match->>'status', ''),
        'courtId', COALESCE(v_match->>'courtId', ''),
        'scheduledStart', COALESCE(v_match->>'scheduledStart', '')
      ));
    END LOOP;
    v_bracket := v_event->'bracket';
    IF v_bracket IS NOT NULL THEN
      v_bracket := jsonb_build_object(
        'rounds', COALESCE(v_bracket->'rounds', '[]'::jsonb),
        'generatedAt', v_bracket->>'generatedAt'
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'tournamentId', p_row.id,
    'name', p_row.name,
    'status', p_row.status,
    'publicStatus', CASE WHEN public.official_open_is_closed(p_row) THEN 'completed' ELSE p_row.status END,
    'completed', public.official_open_is_closed(p_row),
    'scoringMethod', 'rally',
    'roundTargets', COALESCE(p_row.payload->'settings'->'officialCompetition'->'roundTargets', '{}'::jsonb),
    'qualifiersPerGroup', COALESCE((p_row.payload->'settings'->'officialCompetition'->>'qualifiersPerGroup')::int, 2),
    'groups', v_groups,
    'matches', v_matches,
    'bracket', v_bracket,
    'champion', v_champion,
    'runnerUp', v_runner
  );
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_sanitize_public(public.canonical_tournaments) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_commit_core(
  p_row public.canonical_tournaments,
  p_match_id text,
  p_score_a int,
  p_score_b int
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_found jsonb;
  v_match jsonb;
  v_status text;
  v_target int;
  v_valid jsonb;
  v_winner text;
  v_loser text;
  v_prev_a int;
  v_prev_b int;
  v_payload jsonb;
  v_next public.canonical_tournaments%ROWTYPE;
  v_bmid text;
  v_round_n int;
  v_mnum int;
  v_next_id text;
  v_next_slot text;
  v_round text;
BEGIN
  IF public.official_open_is_closed(p_row) THEN
    RETURN public.official_open_json_err('TOURNAMENT_COMPLETED', 'Giải đã đóng — không thể sửa kết quả.');
  END IF;
  v_found := public.official_open_find_match(p_row.payload, p_match_id);
  IF v_found IS NULL THEN
    RETURN public.official_open_json_err('MATCH_NOT_FOUND', 'Không tìm thấy trận trong giải này.');
  END IF;
  v_match := v_found->'match';
  v_status := lower(COALESCE(v_match->>'status', ''));
  v_prev_a := NULLIF(v_match->>'scoreA', '')::int;
  v_prev_b := NULLIF(v_match->>'scoreB', '')::int;
  v_round := COALESCE(NULLIF(v_match->>'stage', ''), NULLIF(v_match->>'roundType', ''), '');
  IF v_status IN ('completed', 'forfeit') THEN
    IF v_prev_a IS NOT DISTINCT FROM p_score_a AND v_prev_b IS NOT DISTINCT FROM p_score_b THEN
      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'tournamentId', p_row.id,
        'matchId', p_match_id,
        'status', v_match->>'status',
        'scoreA', p_score_a,
        'scoreB', p_score_b,
        'winnerId', v_match->>'winnerId',
        'tournamentVersion', p_row.version,
        'round', v_round,
        'progression', NULL
      );
    END IF;
    RETURN public.official_open_json_err('ALREADY_FINALIZED', 'Trận đã chốt — không nhận điểm khác.');
  END IF;
  v_target := public.official_open_round_target(p_row.payload, v_match);
  v_valid := public.official_open_validate_rally(p_score_a, p_score_b, v_target);
  IF COALESCE(v_valid->>'ok', 'false') <> 'true' THEN
    RETURN v_valid;
  END IF;
  IF p_score_a > p_score_b THEN
    v_winner := v_match->>'entryAId';
    v_loser := v_match->>'entryBId';
  ELSE
    v_winner := v_match->>'entryBId';
    v_loser := v_match->>'entryAId';
  END IF;
  IF COALESCE(v_winner, '') = '' OR COALESCE(v_loser, '') = '' OR v_winner = v_loser THEN
    RETURN public.official_open_json_err('WINNER_UNRESOLVED', 'Không xác định được đội thắng.');
  END IF;
  v_payload := public.official_open_apply_match_result(
    p_row.payload, p_match_id, p_score_a, p_score_b, v_winner, v_loser
  );
  v_bmid := COALESCE(v_match->>'bracketMatchId', '');
  v_next_id := NULL;
  v_next_slot := NULL;
  IF v_bmid ~ '^R[0-9]+-M[0-9]+$' THEN
    v_round_n := substring(v_bmid from 'R([0-9]+)-')::int;
    v_mnum := substring(v_bmid from '-M([0-9]+)$')::int;
    v_next_id := format('R%s-M%s', v_round_n + 1, ceil(v_mnum / 2.0)::int);
    v_next_slot := CASE WHEN v_mnum % 2 = 1 THEN 'A' ELSE 'B' END;
  END IF;
  UPDATE public.canonical_tournaments t
  SET payload = v_payload, version = t.version + 1, updated_at = now()
  WHERE t.id = p_row.id AND t.tenant_id = p_row.tenant_id AND t.club_id = p_row.club_id
  RETURNING * INTO v_next;
  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'tournamentId', v_next.id,
    'matchId', p_match_id,
    'status', 'completed',
    'scoreA', p_score_a,
    'scoreB', p_score_b,
    'winnerId', v_winner,
    'loserId', v_loser,
    'winnerName', public.official_open_entry_name(v_next.payload, v_winner),
    'tournamentVersion', v_next.version,
    'round', v_round,
    'progression', CASE
      WHEN v_next_id IS NULL THEN NULL
      ELSE jsonb_build_object('nextBracketMatchId', v_next_id, 'slot', v_next_slot)
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_commit_core(public.canonical_tournaments, text, int, int) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_ledger_replay(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid,
  p_command_type text,
  p_idempotency_key text,
  p_request_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_hash text;
  v_response jsonb;
BEGIN
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RETURN NULL;
  END IF;
  SELECT request_hash, response
  INTO v_hash, v_response
  FROM public.official_open_lifecycle_commands
  WHERE tenant_id = p_tenant_id
    AND club_id = p_club_id
    AND tournament_id = p_tournament_id
    AND command_type = p_command_type
    AND idempotency_key = btrim(p_idempotency_key)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_hash IS NOT DISTINCT FROM p_request_hash THEN
    RETURN v_response;
  END IF;
  RETURN public.official_open_json_err(
    'IDEMPOTENCY_CONFLICT',
    'Khóa idempotency đã dùng cho một yêu cầu khác.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_ledger_replay(text, text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_ledger_put(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid,
  p_command_type text,
  p_idempotency_key text,
  p_request_hash text,
  p_response jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_stored jsonb;
BEGIN
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RETURN p_response;
  END IF;
  INSERT INTO public.official_open_lifecycle_commands (
    tenant_id, club_id, tournament_id, command_type, idempotency_key, request_hash, response
  ) VALUES (
    p_tenant_id, p_club_id, p_tournament_id, p_command_type, btrim(p_idempotency_key), p_request_hash, p_response
  )
  ON CONFLICT (tenant_id, club_id, tournament_id, command_type, idempotency_key)
  DO UPDATE SET response = public.official_open_lifecycle_commands.response
  WHERE public.official_open_lifecycle_commands.request_hash IS NOT DISTINCT FROM EXCLUDED.request_hash
  RETURNING response INTO v_stored;
  IF v_stored IS NULL THEN
    RETURN public.official_open_json_err(
      'IDEMPOTENCY_CONFLICT',
      'Khóa idempotency đã dùng cho một yêu cầu khác.'
    );
  END IF;
  RETURN v_stored;
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_ledger_put(text, text, uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ─── Organizer: mint/refresh live execution row ─────────────────────────────

CREATE OR REPLACE FUNCTION public.official_open_ensure_match_live(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid,
  p_match_id text,
  p_labels jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.canonical_tournaments%ROWTYPE;
  v_found jsonb;
  v_match jsonb;
  v_token text;
  v_live public.tournament_match_live%ROWTYPE;
  v_id text;
  v_target int;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');

  SELECT * INTO v_row
  FROM public.canonical_tournaments t
  WHERE t.id = p_tournament_id AND t.tenant_id = p_tenant_id AND t.club_id = p_club_id
  FOR SHARE;
  IF NOT FOUND THEN
    RETURN public.official_open_json_err('TOURNAMENT_NOT_FOUND', 'Không tìm thấy giải.');
  END IF;
  IF v_row.mode IS DISTINCT FROM 'official_tournament' THEN
    RETURN public.official_open_json_err('NOT_OFFICIAL', 'RPC này chỉ dùng cho giải Official/Open.');
  END IF;
  v_found := public.official_open_find_match(v_row.payload, p_match_id);
  IF v_found IS NULL THEN
    RETURN public.official_open_json_err('MATCH_NOT_FOUND', 'Không tìm thấy trận trong giải này.');
  END IF;
  v_match := v_found->'match';
  v_token := public.official_open_assignment_token(v_row.payload, v_match);
  IF v_token IS NULL OR length(v_token) < 16 THEN
    RETURN public.official_open_json_err('NO_REFEREE_TOKEN', 'Trận chưa có token trọng tài.');
  END IF;
  v_target := public.official_open_round_target(v_row.payload, v_match);
  v_id := p_club_id || '::' || p_tournament_id::text || '::' || p_match_id;

  SELECT * INTO v_live
  FROM public.tournament_match_live
  WHERE id = v_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_live.status IN ('processed', 'locked') THEN
      RETURN jsonb_build_object('ok', true, 'created', false, 'id', v_live.id, 'status', v_live.status);
    END IF;
    UPDATE public.tournament_match_live
    SET
      referee_token = v_token,
      referee_name = COALESCE(NULLIF(p_labels->>'refereeName', ''), referee_name),
      tournament_name = COALESCE(NULLIF(p_labels->>'tournamentName', ''), NULLIF(v_row.name, ''), tournament_name),
      entry_a_label = COALESCE(NULLIF(p_labels->>'entryALabel', ''), official_open_entry_name(v_row.payload, v_match->>'entryAId'), entry_a_label),
      entry_b_label = COALESCE(NULLIF(p_labels->>'entryBLabel', ''), official_open_entry_name(v_row.payload, v_match->>'entryBId'), entry_b_label),
      court_label = COALESCE(NULLIF(p_labels->>'courtLabel', ''), court_label),
      stage_label = COALESCE(NULLIF(p_labels->>'stageLabel', ''), stage_label),
      scoring_method = 'rally',
      scoring_target = v_target,
      scheduled_start = COALESCE(NULLIF(p_labels->>'scheduledStart', ''), NULLIF(v_match->>'scheduledStart', ''), scheduled_start),
      updated_at = now()
    WHERE id = v_id
    RETURNING * INTO v_live;
    RETURN jsonb_build_object('ok', true, 'created', false, 'id', v_live.id, 'status', v_live.status);
  END IF;

  INSERT INTO public.tournament_match_live (
    id, club_id, tournament_id, event_id, match_id, referee_token, referee_name,
    tournament_name, entry_a_label, entry_b_label, court_label, stage_label,
    score_a, score_b, status, is_daily, audit_log, updated_at,
    live_revision, scoring_target, scoring_method, scheduled_start
  ) VALUES (
    v_id,
    p_club_id,
    p_tournament_id::text,
    COALESCE(v_found->>'eventId', ''),
    p_match_id,
    v_token,
    COALESCE(NULLIF(p_labels->>'refereeName', ''), COALESCE(v_match->'referee'->>'name', 'Trọng tài')),
    COALESCE(NULLIF(p_labels->>'tournamentName', ''), v_row.name, 'Giải Official'),
    COALESCE(NULLIF(p_labels->>'entryALabel', ''), public.official_open_entry_name(v_row.payload, v_match->>'entryAId'), 'Cặp A'),
    COALESCE(NULLIF(p_labels->>'entryBLabel', ''), public.official_open_entry_name(v_row.payload, v_match->>'entryBId'), 'Cặp B'),
    COALESCE(NULLIF(p_labels->>'courtLabel', ''), ''),
    COALESCE(NULLIF(p_labels->>'stageLabel', ''), ''),
    0, 0, 'playing', false, '[]'::jsonb, now(),
    1, v_target, 'rally',
    COALESCE(NULLIF(p_labels->>'scheduledStart', ''), COALESCE(v_match->>'scheduledStart', ''))
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING * INTO v_live;

  IF v_live.id IS NULL THEN
    SELECT * INTO v_live FROM public.tournament_match_live WHERE id = v_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'created', true, 'id', v_live.id, 'status', v_live.status);
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM IN ('TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') THEN
      RETURN public.official_open_json_err(SQLERRM, 'Không có quyền.');
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_ensure_match_live(text, text, uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.official_open_ensure_match_live(text, text, uuid, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.official_open_revoke_match_live(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid,
  p_match_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.canonical_tournaments%ROWTYPE;
  v_id text;
  v_new text;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');
  SELECT * INTO v_row
  FROM public.canonical_tournaments t
  WHERE t.id = p_tournament_id AND t.tenant_id = p_tenant_id AND t.club_id = p_club_id
  FOR SHARE;
  IF NOT FOUND THEN
    RETURN public.official_open_json_err('TOURNAMENT_NOT_FOUND', 'Không tìm thấy giải.');
  END IF;
  v_id := p_club_id || '::' || p_tournament_id::text || '::' || p_match_id;
  v_new := 'revoked-' || replace(gen_random_uuid()::text, '-', '');
  UPDATE public.tournament_match_live
  SET referee_token = v_new, updated_at = now()
  WHERE id = v_id;
  RETURN jsonb_build_object('ok', true, 'revoked', true, 'matchId', p_match_id);
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM IN ('TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') THEN
      RETURN public.official_open_json_err(SQLERRM, 'Không có quyền.');
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_revoke_match_live(text, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.official_open_revoke_match_live(text, text, uuid, text) TO authenticated;

-- ─── Token referee console ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.official_open_referee_get_match(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_live public.tournament_match_live%ROWTYPE;
  v_row public.canonical_tournaments%ROWTYPE;
  v_found jsonb;
  v_match jsonb;
  v_target int;
  v_canonical jsonb := NULL;
BEGIN
  IF p_token IS NULL OR length(btrim(p_token)) < 16 OR btrim(p_token) LIKE 'revoked-%' THEN
    RETURN public.official_open_json_err('INVALID_TOKEN', 'Liên kết trọng tài không hợp lệ.');
  END IF;
  SELECT * INTO v_live
  FROM public.tournament_match_live
  WHERE referee_token = btrim(p_token)
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN public.official_open_json_err('INVALID_TOKEN', 'Không tìm thấy trận cho liên kết này.');
  END IF;
  SELECT * INTO v_row
  FROM public.canonical_tournaments t
  WHERE t.id::text = v_live.tournament_id
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN public.official_open_json_err('TOURNAMENT_NOT_FOUND', 'Không tìm thấy giải.');
  END IF;
  v_found := public.official_open_find_match(v_row.payload, v_live.match_id);
  v_match := CASE WHEN v_found IS NULL THEN '{}'::jsonb ELSE v_found->'match' END;
  v_target := COALESCE(v_live.scoring_target, public.official_open_round_target(v_row.payload, v_match));
  IF v_match->>'status' IN ('completed', 'forfeit') THEN
    v_canonical := jsonb_build_object(
      'scoreA', NULLIF(v_match->>'scoreA', '')::int,
      'scoreB', NULLIF(v_match->>'scoreB', '')::int,
      'winnerName', public.official_open_entry_name(v_row.payload, COALESCE(v_match->>'winnerId', '')),
      'status', v_match->>'status'
    );
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'matchId', v_live.match_id,
    'tournamentName', COALESCE(NULLIF(v_live.tournament_name, ''), v_row.name),
    'stageLabel', COALESCE(NULLIF(v_live.stage_label, ''), ''),
    'entryALabel', COALESCE(NULLIF(v_live.entry_a_label, ''), 'Cặp A'),
    'entryBLabel', COALESCE(NULLIF(v_live.entry_b_label, ''), 'Cặp B'),
    'courtLabel', COALESCE(NULLIF(v_live.court_label, ''), ''),
    'scheduledStart', COALESCE(NULLIF(v_live.scheduled_start, ''), COALESCE(v_match->>'scheduledStart', '')),
    'scoringMethod', 'rally',
    'scoringMethodLabel', 'Rally',
    'targetScore', v_target,
    'scoreA', v_live.score_a,
    'scoreB', v_live.score_b,
    'status', v_live.status,
    'liveRevision', v_live.live_revision,
    'finalized', v_live.status IN ('processed', 'locked') OR COALESCE(v_match->>'status', '') IN ('completed', 'forfeit'),
    'canonicalResult', v_canonical
  );
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_referee_get_match(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.official_open_referee_get_match(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_adjust_live_score(
  p_token text,
  p_team text,
  p_delta int,
  p_expected_score_a int,
  p_expected_score_b int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_live public.tournament_match_live%ROWTYPE;
  v_team text;
  v_next_a int;
  v_next_b int;
BEGIN
  IF p_token IS NULL OR length(btrim(p_token)) < 16 OR btrim(p_token) LIKE 'revoked-%' THEN
    RETURN public.official_open_json_err('INVALID_TOKEN', 'Liên kết trọng tài không hợp lệ.');
  END IF;
  v_team := upper(btrim(COALESCE(p_team, '')));
  IF v_team NOT IN ('A', 'B') OR p_delta IS NULL OR p_delta NOT IN (1, -1) THEN
    RETURN public.official_open_json_err('INVALID_ADJUST', 'Chỉ Rally ±1.');
  END IF;
  SELECT * INTO v_live
  FROM public.tournament_match_live
  WHERE referee_token = btrim(p_token)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.official_open_json_err('INVALID_TOKEN', 'Không tìm thấy trận cho liên kết này.');
  END IF;
  IF v_live.status IS DISTINCT FROM 'playing' THEN
    RETURN public.official_open_json_err('LIVE_LOCKED', 'Trận đã khóa điểm live.');
  END IF;
  IF v_live.score_a IS DISTINCT FROM p_expected_score_a
     OR v_live.score_b IS DISTINCT FROM p_expected_score_b THEN
    RETURN public.official_open_json_err(
      'LIVE_VERSION_CONFLICT',
      'Điểm live đã đổi. Tải lại rồi chấm tiếp.',
      jsonb_build_object('scoreA', v_live.score_a, 'scoreB', v_live.score_b, 'liveRevision', v_live.live_revision)
    );
  END IF;
  IF v_team = 'A' THEN
    v_next_a := GREATEST(0, v_live.score_a + p_delta);
    v_next_b := v_live.score_b;
  ELSE
    v_next_a := v_live.score_a;
    v_next_b := GREATEST(0, v_live.score_b + p_delta);
  END IF;
  UPDATE public.tournament_match_live
  SET score_a = v_next_a,
      score_b = v_next_b,
      live_revision = live_revision + 1,
      updated_at = now()
  WHERE id = v_live.id
  RETURNING * INTO v_live;
  RETURN jsonb_build_object(
    'ok', true,
    'scoreA', v_live.score_a,
    'scoreB', v_live.score_b,
    'liveRevision', v_live.live_revision,
    'status', v_live.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_adjust_live_score(text, text, int, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.official_open_adjust_live_score(text, text, int, int, int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_commit_match_result(
  p_token text,
  p_score_a int,
  p_score_b int,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_live public.tournament_match_live%ROWTYPE;
  v_row public.canonical_tournaments%ROWTYPE;
  v_replay jsonb;
  v_result jsonb;
  v_hash text;
BEGIN
  IF p_token IS NULL OR length(btrim(p_token)) < 16 OR btrim(p_token) LIKE 'revoked-%' THEN
    RETURN public.official_open_json_err('INVALID_TOKEN', 'Liên kết trọng tài không hợp lệ.');
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RETURN public.official_open_json_err('IDEMPOTENCY_REQUIRED', 'Thiếu khóa idempotency.');
  END IF;
  SELECT * INTO v_live
  FROM public.tournament_match_live
  WHERE referee_token = btrim(p_token)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.official_open_json_err('INVALID_TOKEN', 'Không tìm thấy trận cho liên kết này.');
  END IF;
  SELECT * INTO v_row
  FROM public.canonical_tournaments t
  WHERE t.id::text = v_live.tournament_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.official_open_json_err('TOURNAMENT_NOT_FOUND', 'Không tìm thấy giải.');
  END IF;
  IF v_row.mode IS DISTINCT FROM 'official_tournament' THEN
    RETURN public.official_open_json_err('NOT_OFFICIAL', 'RPC này chỉ dùng cho giải Official/Open.');
  END IF;
  IF v_row.club_id IS DISTINCT FROM v_live.club_id THEN
    RETURN public.official_open_json_err('TENANT_MISMATCH', 'Trận không thuộc giải này.');
  END IF;
  v_hash := md5(v_live.match_id || ':' || p_score_a::text || ':' || p_score_b::text);
  v_replay := public.official_open_ledger_replay(
    v_row.tenant_id, v_row.club_id, v_row.id, 'commit_match_result', p_idempotency_key, v_hash
  );
  IF v_replay IS NOT NULL THEN
    RETURN v_replay;
  END IF;
  v_result := public.official_open_commit_core(v_row, v_live.match_id, p_score_a, p_score_b);
  IF COALESCE(v_result->>'ok', 'false') = 'true' THEN
    UPDATE public.tournament_match_live
    SET score_a = p_score_a,
        score_b = p_score_b,
        status = 'processed',
        live_revision = live_revision + 1,
        updated_at = now()
    WHERE id = v_live.id;
    v_result := v_result || jsonb_build_object('liveStatus', 'processed');
    v_result := public.official_open_ledger_put(
      v_row.tenant_id, v_row.club_id, v_row.id, 'commit_match_result', p_idempotency_key, v_hash, v_result
    );
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_commit_match_result(text, int, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.official_open_commit_match_result(text, int, int, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_admin_commit_match_result(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid,
  p_match_id text,
  p_score_a int,
  p_score_b int,
  p_expected_version bigint,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.canonical_tournaments%ROWTYPE;
  v_replay jsonb;
  v_result jsonb;
  v_hash text;
  v_id text;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RETURN public.official_open_json_err('IDEMPOTENCY_REQUIRED', 'Thiếu khóa idempotency.');
  END IF;
  SELECT * INTO v_row
  FROM public.canonical_tournaments t
  WHERE t.id = p_tournament_id AND t.tenant_id = p_tenant_id AND t.club_id = p_club_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.official_open_json_err('TOURNAMENT_NOT_FOUND', 'Không tìm thấy giải.');
  END IF;
  IF v_row.mode IS DISTINCT FROM 'official_tournament' THEN
    RETURN public.official_open_json_err('NOT_OFFICIAL', 'RPC này chỉ dùng cho giải Official/Open.');
  END IF;
  v_hash := md5(p_match_id || ':' || p_score_a::text || ':' || p_score_b::text);
  v_replay := public.official_open_ledger_replay(
    p_tenant_id, p_club_id, p_tournament_id, 'commit_match_result', p_idempotency_key, v_hash
  );
  IF v_replay IS NOT NULL THEN
    RETURN v_replay;
  END IF;
  IF p_expected_version IS NULL OR p_expected_version IS DISTINCT FROM v_row.version THEN
    RETURN public.official_open_json_err(
      'VERSION_CONFLICT',
      'Giải đã được cập nhật. Tải lại rồi thử lại.',
      jsonb_build_object('expectedVersion', p_expected_version, 'actualVersion', v_row.version)
    );
  END IF;
  v_result := public.official_open_commit_core(v_row, p_match_id, p_score_a, p_score_b);
  IF COALESCE(v_result->>'ok', 'false') = 'true' THEN
    v_id := p_club_id || '::' || p_tournament_id::text || '::' || p_match_id;
    UPDATE public.tournament_match_live
    SET score_a = p_score_a,
        score_b = p_score_b,
        status = 'processed',
        live_revision = live_revision + 1,
        updated_at = now()
    WHERE id = v_id;
    v_result := public.official_open_ledger_put(
      p_tenant_id, p_club_id, p_tournament_id, 'commit_match_result', p_idempotency_key, v_hash, v_result
    );
  END IF;
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM IN ('TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') THEN
      RETURN public.official_open_json_err(SQLERRM, 'Không có quyền.');
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_admin_commit_match_result(text, text, uuid, text, int, int, bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.official_open_admin_commit_match_result(text, text, uuid, text, int, int, bigint, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.official_open_complete_tournament(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid,
  p_expected_version bigint,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.canonical_tournaments%ROWTYPE;
  v_replay jsonb;
  v_check jsonb;
  v_payload jsonb;
  v_next public.canonical_tournaments%ROWTYPE;
  v_result jsonb;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RETURN public.official_open_json_err('IDEMPOTENCY_REQUIRED', 'Thiếu khóa idempotency.');
  END IF;
  SELECT * INTO v_row
  FROM public.canonical_tournaments t
  WHERE t.id = p_tournament_id AND t.tenant_id = p_tenant_id AND t.club_id = p_club_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.official_open_json_err('TOURNAMENT_NOT_FOUND', 'Không tìm thấy giải.');
  END IF;
  IF v_row.mode IS DISTINCT FROM 'official_tournament' THEN
    RETURN public.official_open_json_err('NOT_OFFICIAL', 'RPC này chỉ dùng cho giải Official/Open.');
  END IF;
  v_replay := public.official_open_ledger_replay(
    p_tenant_id, p_club_id, p_tournament_id, 'complete_tournament', p_idempotency_key, md5('complete_tournament')
  );
  IF v_replay IS NOT NULL THEN
    RETURN v_replay;
  END IF;
  IF public.official_open_is_closed(v_row) THEN
    v_result := jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'alreadyCompleted', true,
      'tournamentId', v_row.id,
      'status', v_row.status,
      'tournamentVersion', v_row.version,
      'championId', COALESCE(v_row.payload->'settings'->'resultsOps'->>'championId', ''),
      'runnerUpId', COALESCE(v_row.payload->'settings'->'resultsOps'->>'runnerUpId', '')
    );
    v_result := public.official_open_ledger_put(
      p_tenant_id, p_club_id, p_tournament_id, 'complete_tournament', p_idempotency_key, md5('complete_tournament'), v_result
    );
    RETURN v_result;
  END IF;
  IF p_expected_version IS NULL OR p_expected_version IS DISTINCT FROM v_row.version THEN
    RETURN public.official_open_json_err(
      'VERSION_CONFLICT',
      'Giải đã được cập nhật. Tải lại rồi thử lại.',
      jsonb_build_object('expectedVersion', p_expected_version, 'actualVersion', v_row.version)
    );
  END IF;
  v_check := public.official_open_completion_check(v_row);
  IF COALESCE(v_check->>'ok', 'false') <> 'true' THEN
    RETURN v_check;
  END IF;
  v_payload := jsonb_set(
    COALESCE(v_row.payload, '{}'::jsonb),
    '{settings,resultsOps}',
    COALESCE(v_row.payload->'settings'->'resultsOps', '{}'::jsonb) || jsonb_build_object(
      'closed', true,
      'resultsLocked', true,
      'closedAt', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'championId', v_check->>'championId',
      'runnerUpId', v_check->>'runnerUpId'
    )
  );
  UPDATE public.canonical_tournaments t
  SET
    payload = v_payload,
    status = 'completed',
    version = t.version + 1,
    updated_at = now()
  WHERE t.id = p_tournament_id AND t.tenant_id = p_tenant_id AND t.club_id = p_club_id
  RETURNING * INTO v_next;
  v_result := jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'tournamentId', v_next.id,
    'status', v_next.status,
    'tournamentVersion', v_next.version,
    'championId', v_check->>'championId',
    'championName', v_check->>'championName',
    'runnerUpId', v_check->>'runnerUpId',
    'runnerUpName', v_check->>'runnerUpName'
  );
  v_result := public.official_open_ledger_put(
    p_tenant_id, p_club_id, p_tournament_id, 'complete_tournament', p_idempotency_key, md5('complete_tournament'), v_result
  );
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM IN ('TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') THEN
      RETURN public.official_open_json_err(SQLERRM, 'Không có quyền.');
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_complete_tournament(text, text, uuid, bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.official_open_complete_tournament(text, text, uuid, bigint, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.official_open_generate_knockout(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid,
  p_event_id text,
  p_expected_version bigint,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.canonical_tournaments%ROWTYPE;
  v_replay jsonb;
  v_hash text;
  v_event jsonb;
  v_ei int;
  v_found int := -1;
  v_match jsonb;
  v_group_total int := 0;
  v_group_done int := 0;
  v_built jsonb;
  v_next_event jsonb;
  v_events jsonb := '[]'::jsonb;
  v_payload jsonb;
  v_next public.canonical_tournaments%ROWTYPE;
  v_result jsonb;
  v_q int;
  v_has_bracket boolean := false;
  v_ko_started boolean := false;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  PERFORM public.canonical_tournament_assert_permission('tournament.update');
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RETURN public.official_open_json_err('IDEMPOTENCY_REQUIRED', 'Thiếu khóa idempotency.');
  END IF;
  SELECT * INTO v_row
  FROM public.canonical_tournaments t
  WHERE t.id = p_tournament_id AND t.tenant_id = p_tenant_id AND t.club_id = p_club_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.official_open_json_err('TOURNAMENT_NOT_FOUND', 'Không tìm thấy giải.');
  END IF;
  IF v_row.mode IS DISTINCT FROM 'official_tournament' THEN
    RETURN public.official_open_json_err('NOT_OFFICIAL', 'RPC này chỉ dùng cho giải Official/Open.');
  END IF;

  v_q := public.official_open_qualifiers_per_group(v_row.payload);
  v_hash := md5(COALESCE(p_event_id, '') || ':' || v_q::text);
  v_replay := public.official_open_ledger_replay(
    p_tenant_id, p_club_id, p_tournament_id, 'generate_knockout', p_idempotency_key, v_hash
  );
  IF v_replay IS NOT NULL THEN
    RETURN v_replay;
  END IF;
  IF public.official_open_is_closed(v_row) THEN
    RETURN public.official_open_json_err('TOURNAMENT_COMPLETED', 'Giải đã đóng — không thể tạo knockout.');
  END IF;
  IF p_expected_version IS NULL OR p_expected_version IS DISTINCT FROM v_row.version THEN
    RETURN public.official_open_json_err(
      'VERSION_CONFLICT',
      'Giải đã được cập nhật. Tải lại rồi thử lại.',
      jsonb_build_object('expectedVersion', p_expected_version, 'actualVersion', v_row.version)
    );
  END IF;

  IF jsonb_typeof(v_row.payload->'events') IS DISTINCT FROM 'array' THEN
    RETURN public.official_open_json_err('NO_EVENT', 'Thiếu nội dung thi đấu.');
  END IF;
  FOR v_ei IN 0 .. jsonb_array_length(v_row.payload->'events') - 1 LOOP
    v_event := v_row.payload->'events'->v_ei;
    IF p_event_id IS NULL OR btrim(p_event_id) = '' OR v_event->>'id' = p_event_id THEN
      v_found := v_ei;
      EXIT;
    END IF;
  END LOOP;
  IF v_found < 0 THEN
    RETURN public.official_open_json_err('NO_EVENT', 'Thiếu nội dung thi đấu.');
  END IF;
  v_event := v_row.payload->'events'->v_found;

  FOR v_match IN SELECT value FROM jsonb_array_elements(COALESCE(v_event->'matches', '[]'::jsonb))
  LOOP
    IF COALESCE(v_match->>'bracketMatchId', '') = '' THEN
      v_group_total := v_group_total + 1;
      IF v_match->>'status' IN ('completed', 'forfeit') THEN
        v_group_done := v_group_done + 1;
      END IF;
    ELSE
      IF v_match->>'status' IN ('completed', 'forfeit')
         OR v_match->>'scoreA' IS NOT NULL
         OR v_match->>'scoreB' IS NOT NULL
         OR COALESCE(v_match->>'winnerId', '') <> '' THEN
        v_ko_started := true;
      END IF;
    END IF;
  END LOOP;
  IF v_group_total = 0 OR v_group_done < v_group_total THEN
    RETURN public.official_open_json_err('GROUP_INCOMPLETE', 'Cần hoàn tất vòng bảng trước khi tạo knockout.');
  END IF;
  v_has_bracket := jsonb_typeof(v_event->'bracket'->'rounds') = 'array'
    AND jsonb_array_length(v_event->'bracket'->'rounds') > 0;
  IF v_has_bracket AND v_ko_started THEN
    RETURN public.official_open_json_err('KO_ALREADY_STARTED', 'Knockout đã bắt đầu — không tạo lại nhánh.');
  END IF;
  IF v_has_bracket THEN
    RETURN public.official_open_json_err('KO_ALREADY_GENERATED', 'Bracket knockout đã tồn tại.');
  END IF;

  v_built := public.official_open_build_knockout(v_row.payload, v_event);
  IF COALESCE(v_built->>'ok', 'false') <> 'true' THEN
    RETURN v_built;
  END IF;
  v_next_event := v_built->'event';
  FOR v_ei IN 0 .. jsonb_array_length(v_row.payload->'events') - 1 LOOP
    IF v_ei = v_found THEN
      v_events := v_events || jsonb_build_array(v_next_event);
    ELSE
      v_events := v_events || jsonb_build_array(v_row.payload->'events'->v_ei);
    END IF;
  END LOOP;
  v_payload := jsonb_set(v_row.payload, '{events}', v_events);
  UPDATE public.canonical_tournaments t
  SET payload = v_payload, version = t.version + 1, updated_at = now()
  WHERE t.id = p_tournament_id AND t.tenant_id = p_tenant_id AND t.club_id = p_club_id
  RETURNING * INTO v_next;
  v_result := jsonb_build_object(
    'ok', true,
    'tournamentId', v_next.id,
    'eventId', COALESCE(v_next_event->>'id', ''),
    'tournamentVersion', v_next.version,
    'knockoutMatchCount', COALESCE((v_built->>'knockoutMatchCount')::int, 0),
    'qualifiersPerGroup', COALESCE((v_built->>'qualifiersPerGroup')::int, v_q),
    'roundCount', COALESCE((v_built->>'roundCount')::int, 0)
  );
  v_result := public.official_open_ledger_put(
    p_tenant_id, p_club_id, p_tournament_id, 'generate_knockout', p_idempotency_key, v_hash, v_result
  );
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM IN ('TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') THEN
      RETURN public.official_open_json_err(SQLERRM, 'Không có quyền.');
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_generate_knockout(text, text, uuid, text, bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.official_open_generate_knockout(text, text, uuid, text, bigint, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.official_open_assert_unused_for_rollback()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_ledger int := 0;
  v_live int := 0;
BEGIN
  IF to_regclass('public.official_open_lifecycle_commands') IS NOT NULL THEN
    SELECT count(*)::int INTO v_ledger FROM public.official_open_lifecycle_commands;
  END IF;
  IF v_ledger > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK_BLOCKED: official_open_lifecycle_commands has % row(s). Package runtime has been used — refusing destructive rollback.',
      v_ledger;
  END IF;
  IF to_regclass('public.tournament_match_live') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'tournament_match_live' AND column_name = 'scoring_target'
     ) THEN
    SELECT count(*)::int INTO v_live
    FROM public.tournament_match_live
    WHERE live_revision > 1
       OR scoring_target IS NOT NULL;
  END IF;
  IF v_live > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK_BLOCKED: tournament_match_live has % row(s) using package runtime fields. Refusing destructive rollback.',
      v_live;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_assert_unused_for_rollback() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.official_open_get_public_results(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.canonical_tournaments%ROWTYPE;
BEGIN
  PERFORM public.canonical_tournament_assert_tenant(p_tenant_id);
  SELECT * INTO v_row
  FROM public.canonical_tournaments t
  WHERE t.id = p_tournament_id AND t.tenant_id = p_tenant_id AND t.club_id = p_club_id;
  IF NOT FOUND THEN
    RETURN public.official_open_json_err('TOURNAMENT_NOT_FOUND', 'Không tìm thấy giải.');
  END IF;
  IF v_row.mode IS DISTINCT FROM 'official_tournament' THEN
    RETURN public.official_open_json_err('NOT_OFFICIAL', 'RPC này chỉ dùng cho giải Official/Open.');
  END IF;
  RETURN public.official_open_sanitize_public(v_row);
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM IN ('TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') THEN
      RETURN public.official_open_json_err(SQLERRM, 'Không có quyền.');
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.official_open_get_public_results(text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.official_open_get_public_results(text, text, uuid) TO authenticated;

COMMIT;
