-- REFEREE V5-D.2 staging seed (isolated QA)

insert into public.match_live_states (
  id, tenant_id, tournament_id, match_id, team_a_id, team_b_id,
  state_payload, state_version, version, state_hash, status, last_event_sequence
) values (
  'REFEREE_V5_TEST_TENANT_A::REFEREE_V5_TEST_TOURNAMENT_A::REFEREE_V5_TEST_MATCH_DOUBLES', 'REFEREE_V5_TEST_TENANT_A', 'REFEREE_V5_TEST_TOURNAMENT_A', 'REFEREE_V5_TEST_MATCH_DOUBLES', 'team-a', 'team-b',
  '{"matchId":"REFEREE_V5_TEST_MATCH_DOUBLES","stateSchemaVersion":1,"matchType":"doubles","status":"not_started","version":0,"scoringFormat":"side_out","bestOf":1,"pointsToWin":11,"winBy":2,"maximumScore":null,"currentGameNumber":1,"teams":{"teamA":{"teamId":"team-a","courtEnd":"NEAR_END","score":0,"players":[{"playerId":"A","logicalServiceSide":"RIGHT_SERVICE_COURT"},{"playerId":"B","logicalServiceSide":"LEFT_SERVICE_COURT"}]},"teamB":{"teamId":"team-b","courtEnd":"FAR_END","score":0,"players":[{"playerId":"C","logicalServiceSide":"LEFT_SERVICE_COURT"},{"playerId":"D","logicalServiceSide":"RIGHT_SERVICE_COURT"}]}},"servingTeamId":"team-a","servingPlayerId":"A","receivingTeamId":"team-b","receivingPlayerId":"D","serverNumber":1,"games":[],"lastEventSequence":0}'::jsonb, 0, 0, 'h5c33887a', 'not_started', 0
) on conflict (id) do update set
  state_payload = excluded.state_payload,
  state_version = excluded.state_version,
  version = excluded.version,
  state_hash = excluded.state_hash,
  status = excluded.status,
  last_event_sequence = excluded.last_event_sequence;

insert into public.match_live_states (
  id, tenant_id, tournament_id, match_id, team_a_id, team_b_id,
  state_payload, state_version, version, state_hash, status, last_event_sequence
) values (
  'REFEREE_V5_TEST_TENANT_A::REFEREE_V5_TEST_TOURNAMENT_A::REFEREE_V5_TEST_MATCH_SINGLES', 'REFEREE_V5_TEST_TENANT_A', 'REFEREE_V5_TEST_TOURNAMENT_A', 'REFEREE_V5_TEST_MATCH_SINGLES', 'team-a', 'team-b',
  '{"matchId":"REFEREE_V5_TEST_MATCH_SINGLES","stateSchemaVersion":1,"matchType":"singles","status":"not_started","version":0,"scoringFormat":"side_out","bestOf":1,"pointsToWin":11,"winBy":2,"maximumScore":null,"currentGameNumber":1,"teams":{"teamA":{"teamId":"team-a","courtEnd":"NEAR_END","score":0,"players":[{"playerId":"P1","logicalServiceSide":"RIGHT_SERVICE_COURT"}]},"teamB":{"teamId":"team-b","courtEnd":"FAR_END","score":0,"players":[{"playerId":"P2","logicalServiceSide":"LEFT_SERVICE_COURT"}]}},"servingTeamId":"team-a","servingPlayerId":"P1","receivingTeamId":"team-b","receivingPlayerId":"P2","serverNumber":null,"games":[],"lastEventSequence":0}'::jsonb, 0, 0, 'h1363385c', 'not_started', 0
) on conflict (id) do update set
  state_payload = excluded.state_payload,
  state_version = excluded.state_version,
  version = excluded.version,
  state_hash = excluded.state_hash,
  status = excluded.status,
  last_event_sequence = excluded.last_event_sequence;

insert into public.match_live_states (
  id, tenant_id, tournament_id, match_id, team_a_id, team_b_id,
  state_payload, state_version, version, state_hash, status, last_event_sequence
) values (
  'REFEREE_V5_TEST_TENANT_B::REFEREE_V5_TEST_TOURNAMENT_B::REFEREE_V5_TEST_MATCH_DOUBLES', 'REFEREE_V5_TEST_TENANT_B', 'REFEREE_V5_TEST_TOURNAMENT_B', 'REFEREE_V5_TEST_MATCH_DOUBLES', 'team-a', 'team-b',
  '{"matchId":"REFEREE_V5_TEST_MATCH_DOUBLES","stateSchemaVersion":1,"matchType":"doubles","status":"not_started","version":0,"scoringFormat":"side_out","bestOf":1,"pointsToWin":11,"winBy":2,"maximumScore":null,"currentGameNumber":1,"teams":{"teamA":{"teamId":"team-a","courtEnd":"NEAR_END","score":0,"players":[{"playerId":"A","logicalServiceSide":"RIGHT_SERVICE_COURT"},{"playerId":"B","logicalServiceSide":"LEFT_SERVICE_COURT"}]},"teamB":{"teamId":"team-b","courtEnd":"FAR_END","score":0,"players":[{"playerId":"C","logicalServiceSide":"LEFT_SERVICE_COURT"},{"playerId":"D","logicalServiceSide":"RIGHT_SERVICE_COURT"}]}},"servingTeamId":"team-a","servingPlayerId":"A","receivingTeamId":"team-b","receivingPlayerId":"D","serverNumber":1,"games":[],"lastEventSequence":0}'::jsonb, 0, 0, 'h5c33887a', 'not_started', 0
) on conflict (id) do update set
  state_payload = excluded.state_payload,
  state_version = excluded.state_version,
  version = excluded.version,
  state_hash = excluded.state_hash,
  status = excluded.status,
  last_event_sequence = excluded.last_event_sequence;


insert into public.referee_assignments (
  tenant_id, tournament_id, match_id, referee_user_id, referee_display_name,
  role, status, expires_at, revoked_at
) values (
  'REFEREE_V5_TEST_TENANT_A', 'REFEREE_V5_TEST_TOURNAMENT_A', 'REFEREE_V5_TEST_MATCH_DOUBLES', '13e0968b-53c5-4ba6-8ae0-dce12b1faf9c', 'Referee V5 QA',
  'REFEREE', 'active', '2026-08-11T10:56:20.778Z', null
) on conflict (tenant_id, tournament_id, match_id, role, referee_user_id) do update set
  status = excluded.status,
  expires_at = excluded.expires_at,
  revoked_at = excluded.revoked_at;

insert into public.referee_assignments (
  tenant_id, tournament_id, match_id, referee_user_id, referee_display_name,
  role, status, expires_at, revoked_at
) values (
  'REFEREE_V5_TEST_TENANT_A', 'REFEREE_V5_TEST_TOURNAMENT_A', 'REFEREE_V5_TEST_MATCH_SINGLES', '13e0968b-53c5-4ba6-8ae0-dce12b1faf9c', 'Referee V5 QA',
  'REFEREE', 'active', '2026-08-11T10:56:20.778Z', null
) on conflict (tenant_id, tournament_id, match_id, role, referee_user_id) do update set
  status = excluded.status,
  expires_at = excluded.expires_at,
  revoked_at = excluded.revoked_at;

insert into public.referee_assignments (
  tenant_id, tournament_id, match_id, referee_user_id, referee_display_name,
  role, status, expires_at, revoked_at
) values (
  'REFEREE_V5_TEST_TENANT_A', 'REFEREE_V5_TEST_TOURNAMENT_A', 'REFEREE_V5_TEST_MATCH_DOUBLES', '7b381912-2190-415c-b099-6b1e87567b7a', 'Referee V5 QA',
  'REFEREE', 'revoked', null, '2026-07-12T10:56:20.779Z'
) on conflict (tenant_id, tournament_id, match_id, role, referee_user_id) do update set
  status = excluded.status,
  expires_at = excluded.expires_at,
  revoked_at = excluded.revoked_at;

insert into public.referee_assignments (
  tenant_id, tournament_id, match_id, referee_user_id, referee_display_name,
  role, status, expires_at, revoked_at
) values (
  'REFEREE_V5_TEST_TENANT_A', 'REFEREE_V5_TEST_TOURNAMENT_A', 'REFEREE_V5_TEST_MATCH_SINGLES', '13e0968b-53c5-4ba6-8ae0-dce12b1faf9c', 'Referee V5 QA',
  'REFEREE', 'active', '2026-07-12T09:56:20.778Z', null
) on conflict (tenant_id, tournament_id, match_id, role, referee_user_id) do update set
  status = excluded.status,
  expires_at = excluded.expires_at,
  revoked_at = excluded.revoked_at;

insert into public.referee_assignments (
  tenant_id, tournament_id, match_id, referee_user_id, referee_display_name,
  role, status, expires_at, revoked_at
) values (
  'REFEREE_V5_TEST_TENANT_B', 'REFEREE_V5_TEST_TOURNAMENT_B', 'REFEREE_V5_TEST_MATCH_DOUBLES', 'e54abeac-6619-477a-9eb4-b64b05c1ddba', 'Referee V5 QA',
  'REFEREE', 'active', '2026-08-11T10:56:20.778Z', null
) on conflict (tenant_id, tournament_id, match_id, role, referee_user_id) do update set
  status = excluded.status,
  expires_at = excluded.expires_at,
  revoked_at = excluded.revoked_at;;
