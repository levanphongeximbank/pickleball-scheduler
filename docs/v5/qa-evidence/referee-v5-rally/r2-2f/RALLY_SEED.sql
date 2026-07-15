-- REFEREE_V5_RALLY_TEST_* R2-2F seed
set session_replication_role = replica;

delete from public.match_sync_mutations where match_state_id = 'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_DOUBLES';
delete from public.match_events where match_state_id = 'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_DOUBLES';
delete from public.match_integration_outbox where match_state_id = 'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_DOUBLES';
delete from public.match_result_revisions where match_id = 'REFEREE_V5_RALLY_TEST_MATCH_DOUBLES';
insert into public.match_live_states (
  id, tenant_id, tournament_id, match_id, team_a_id, team_b_id,
  state_payload, state_version, version, state_hash, status, last_event_sequence
) values (
  'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_DOUBLES', 'REFEREE_V5_RALLY_TEST_TENANT', 'REFEREE_V5_RALLY_TEST_TOURNAMENT', 'REFEREE_V5_RALLY_TEST_MATCH_DOUBLES', 'team-a', 'team-b',
  '{"matchId":"REFEREE_V5_RALLY_TEST_MATCH_DOUBLES","stateSchemaVersion":1,"matchType":"doubles","status":"not_started","version":0,"scoringFormat":"rally","bestOf":1,"pointsToWin":11,"winBy":2,"maximumScore":null,"currentGameNumber":1,"teams":{"teamA":{"teamId":"team-a","courtEnd":"NEAR_END","score":0,"players":[{"playerId":"A","logicalServiceSide":"RIGHT_SERVICE_COURT"},{"playerId":"B","logicalServiceSide":"LEFT_SERVICE_COURT"}]},"teamB":{"teamId":"team-b","courtEnd":"FAR_END","score":0,"players":[{"playerId":"C","logicalServiceSide":"LEFT_SERVICE_COURT"},{"playerId":"D","logicalServiceSide":"RIGHT_SERVICE_COURT"}]}},"servingTeamId":"team-a","servingPlayerId":"A","receivingTeamId":"team-b","receivingPlayerId":"D","serverNumber":1,"games":[],"lastEventSequence":0,"scoringSystem":"RALLY","scoringVariant":"USAP_2026_PROVISIONAL_RALLY","ruleSetId":"rally_usap_2026_provisional_doubles_v1","freezeRule":"NONE","serverNumberRule":"NONE"}'::jsonb, 0, 0, 'h5cfe7670', 'not_started', 0
) on conflict (id) do update set
  state_payload = excluded.state_payload,
  state_version = 0,
  version = 0,
  state_hash = excluded.state_hash,
  status = 'not_started',
  last_event_sequence = 0,
  locked_at = null,
  locked_by = null;

delete from public.match_sync_mutations where match_state_id = 'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_MISSING_FORMAT';
delete from public.match_events where match_state_id = 'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_MISSING_FORMAT';
delete from public.match_integration_outbox where match_state_id = 'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_MISSING_FORMAT';
delete from public.match_result_revisions where match_id = 'REFEREE_V5_RALLY_TEST_MATCH_MISSING_FORMAT';
insert into public.match_live_states (
  id, tenant_id, tournament_id, match_id, team_a_id, team_b_id,
  state_payload, state_version, version, state_hash, status, last_event_sequence
) values (
  'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_MISSING_FORMAT', 'REFEREE_V5_RALLY_TEST_TENANT', 'REFEREE_V5_RALLY_TEST_TOURNAMENT', 'REFEREE_V5_RALLY_TEST_MATCH_MISSING_FORMAT', 'team-a', 'team-b',
  '{"matchId":"REFEREE_V5_RALLY_TEST_MATCH_MISSING_FORMAT","stateSchemaVersion":1,"matchType":"doubles","status":"not_started","version":0,"scoringFormat":"rally","bestOf":1,"pointsToWin":11,"winBy":2,"maximumScore":null,"currentGameNumber":1,"teams":{"teamA":{"teamId":"team-a","courtEnd":"NEAR_END","score":0,"players":[{"playerId":"A","logicalServiceSide":"RIGHT_SERVICE_COURT"},{"playerId":"B","logicalServiceSide":"LEFT_SERVICE_COURT"}]},"teamB":{"teamId":"team-b","courtEnd":"FAR_END","score":0,"players":[{"playerId":"C","logicalServiceSide":"LEFT_SERVICE_COURT"},{"playerId":"D","logicalServiceSide":"RIGHT_SERVICE_COURT"}]}},"servingTeamId":"team-a","servingPlayerId":"A","receivingTeamId":"team-b","receivingPlayerId":"D","serverNumber":1,"games":[],"lastEventSequence":0,"scoringSystem":"RALLY","freezeRule":"NONE","serverNumberRule":"NONE"}'::jsonb, 0, 0, 'h18f27aa2', 'not_started', 0
) on conflict (id) do update set
  state_payload = excluded.state_payload,
  state_version = 0,
  version = 0,
  state_hash = excluded.state_hash,
  status = 'not_started',
  last_event_sequence = 0,
  locked_at = null,
  locked_by = null;

delete from public.match_sync_mutations where match_state_id = 'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_BAD_VARIANT';
delete from public.match_events where match_state_id = 'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_BAD_VARIANT';
delete from public.match_integration_outbox where match_state_id = 'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_BAD_VARIANT';
delete from public.match_result_revisions where match_id = 'REFEREE_V5_RALLY_TEST_MATCH_BAD_VARIANT';
insert into public.match_live_states (
  id, tenant_id, tournament_id, match_id, team_a_id, team_b_id,
  state_payload, state_version, version, state_hash, status, last_event_sequence
) values (
  'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_BAD_VARIANT', 'REFEREE_V5_RALLY_TEST_TENANT', 'REFEREE_V5_RALLY_TEST_TOURNAMENT', 'REFEREE_V5_RALLY_TEST_MATCH_BAD_VARIANT', 'team-a', 'team-b',
  '{"matchId":"REFEREE_V5_RALLY_TEST_MATCH_BAD_VARIANT","stateSchemaVersion":1,"matchType":"doubles","status":"not_started","version":0,"scoringFormat":"rally","bestOf":1,"pointsToWin":11,"winBy":2,"maximumScore":null,"currentGameNumber":1,"teams":{"teamA":{"teamId":"team-a","courtEnd":"NEAR_END","score":0,"players":[{"playerId":"A","logicalServiceSide":"RIGHT_SERVICE_COURT"},{"playerId":"B","logicalServiceSide":"LEFT_SERVICE_COURT"}]},"teamB":{"teamId":"team-b","courtEnd":"FAR_END","score":0,"players":[{"playerId":"C","logicalServiceSide":"LEFT_SERVICE_COURT"},{"playerId":"D","logicalServiceSide":"RIGHT_SERVICE_COURT"}]}},"servingTeamId":"team-a","servingPlayerId":"A","receivingTeamId":"team-b","receivingPlayerId":"D","serverNumber":1,"games":[],"lastEventSequence":0,"scoringSystem":"RALLY","scoringVariant":"DREAMBREAKER_V1","freezeRule":"NONE","serverNumberRule":"NONE"}'::jsonb, 0, 0, 'h22106610', 'not_started', 0
) on conflict (id) do update set
  state_payload = excluded.state_payload,
  state_version = 0,
  version = 0,
  state_hash = excluded.state_hash,
  status = 'not_started',
  last_event_sequence = 0,
  locked_at = null,
  locked_by = null;

delete from public.match_sync_mutations where match_state_id = 'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_SINGLES';
delete from public.match_events where match_state_id = 'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_SINGLES';
delete from public.match_integration_outbox where match_state_id = 'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_SINGLES';
delete from public.match_result_revisions where match_id = 'REFEREE_V5_RALLY_TEST_MATCH_SINGLES';
insert into public.match_live_states (
  id, tenant_id, tournament_id, match_id, team_a_id, team_b_id,
  state_payload, state_version, version, state_hash, status, last_event_sequence
) values (
  'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_SINGLES', 'REFEREE_V5_RALLY_TEST_TENANT', 'REFEREE_V5_RALLY_TEST_TOURNAMENT', 'REFEREE_V5_RALLY_TEST_MATCH_SINGLES', 'team-a', 'team-b',
  '{"matchId":"REFEREE_V5_RALLY_TEST_MATCH_SINGLES","stateSchemaVersion":1,"matchType":"singles","status":"not_started","version":0,"scoringFormat":"rally","bestOf":1,"pointsToWin":11,"winBy":2,"maximumScore":null,"currentGameNumber":1,"teams":{"teamA":{"teamId":"team-a","courtEnd":"NEAR_END","score":0,"players":[{"playerId":"P1","logicalServiceSide":"RIGHT_SERVICE_COURT"}]},"teamB":{"teamId":"team-b","courtEnd":"FAR_END","score":0,"players":[{"playerId":"P2","logicalServiceSide":"LEFT_SERVICE_COURT"}]}},"servingTeamId":"team-a","servingPlayerId":"P1","receivingTeamId":"team-b","receivingPlayerId":"P2","serverNumber":null,"games":[],"lastEventSequence":0,"scoringSystem":"RALLY","scoringVariant":"USAP_2026_PROVISIONAL_RALLY","freezeRule":"NONE","serverNumberRule":"NONE"}'::jsonb, 0, 0, 'h7747ec6a', 'not_started', 0
) on conflict (id) do update set
  state_payload = excluded.state_payload,
  state_version = 0,
  version = 0,
  state_hash = excluded.state_hash,
  status = 'not_started',
  last_event_sequence = 0,
  locked_at = null,
  locked_by = null;

delete from public.match_sync_mutations where match_state_id = 'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_EXPIRED';
delete from public.match_events where match_state_id = 'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_EXPIRED';
delete from public.match_integration_outbox where match_state_id = 'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_EXPIRED';
delete from public.match_result_revisions where match_id = 'REFEREE_V5_RALLY_TEST_MATCH_EXPIRED';
insert into public.match_live_states (
  id, tenant_id, tournament_id, match_id, team_a_id, team_b_id,
  state_payload, state_version, version, state_hash, status, last_event_sequence
) values (
  'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_EXPIRED', 'REFEREE_V5_RALLY_TEST_TENANT', 'REFEREE_V5_RALLY_TEST_TOURNAMENT', 'REFEREE_V5_RALLY_TEST_MATCH_EXPIRED', 'team-a', 'team-b',
  '{"matchId":"REFEREE_V5_RALLY_TEST_MATCH_EXPIRED","stateSchemaVersion":1,"matchType":"doubles","status":"not_started","version":0,"scoringFormat":"rally","bestOf":1,"pointsToWin":11,"winBy":2,"maximumScore":null,"currentGameNumber":1,"teams":{"teamA":{"teamId":"team-a","courtEnd":"NEAR_END","score":0,"players":[{"playerId":"A","logicalServiceSide":"RIGHT_SERVICE_COURT"},{"playerId":"B","logicalServiceSide":"LEFT_SERVICE_COURT"}]},"teamB":{"teamId":"team-b","courtEnd":"FAR_END","score":0,"players":[{"playerId":"C","logicalServiceSide":"LEFT_SERVICE_COURT"},{"playerId":"D","logicalServiceSide":"RIGHT_SERVICE_COURT"}]}},"servingTeamId":"team-a","servingPlayerId":"A","receivingTeamId":"team-b","receivingPlayerId":"D","serverNumber":1,"games":[],"lastEventSequence":0,"scoringSystem":"RALLY","scoringVariant":"USAP_2026_PROVISIONAL_RALLY","ruleSetId":"rally_usap_2026_provisional_doubles_v1","freezeRule":"NONE","serverNumberRule":"NONE"}'::jsonb, 0, 0, 'h1e33796d', 'not_started', 0
) on conflict (id) do update set
  state_payload = excluded.state_payload,
  state_version = 0,
  version = 0,
  state_hash = excluded.state_hash,
  status = 'not_started',
  last_event_sequence = 0,
  locked_at = null,
  locked_by = null;

delete from public.match_sync_mutations where match_state_id = 'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_REVOKED_HOST';
delete from public.match_events where match_state_id = 'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_REVOKED_HOST';
delete from public.match_integration_outbox where match_state_id = 'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_REVOKED_HOST';
delete from public.match_result_revisions where match_id = 'REFEREE_V5_RALLY_TEST_MATCH_REVOKED_HOST';
insert into public.match_live_states (
  id, tenant_id, tournament_id, match_id, team_a_id, team_b_id,
  state_payload, state_version, version, state_hash, status, last_event_sequence
) values (
  'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_REVOKED_HOST', 'REFEREE_V5_RALLY_TEST_TENANT', 'REFEREE_V5_RALLY_TEST_TOURNAMENT', 'REFEREE_V5_RALLY_TEST_MATCH_REVOKED_HOST', 'team-a', 'team-b',
  '{"matchId":"REFEREE_V5_RALLY_TEST_MATCH_REVOKED_HOST","stateSchemaVersion":1,"matchType":"doubles","status":"not_started","version":0,"scoringFormat":"rally","bestOf":1,"pointsToWin":11,"winBy":2,"maximumScore":null,"currentGameNumber":1,"teams":{"teamA":{"teamId":"team-a","courtEnd":"NEAR_END","score":0,"players":[{"playerId":"A","logicalServiceSide":"RIGHT_SERVICE_COURT"},{"playerId":"B","logicalServiceSide":"LEFT_SERVICE_COURT"}]},"teamB":{"teamId":"team-b","courtEnd":"FAR_END","score":0,"players":[{"playerId":"C","logicalServiceSide":"LEFT_SERVICE_COURT"},{"playerId":"D","logicalServiceSide":"RIGHT_SERVICE_COURT"}]}},"servingTeamId":"team-a","servingPlayerId":"A","receivingTeamId":"team-b","receivingPlayerId":"D","serverNumber":1,"games":[],"lastEventSequence":0,"scoringSystem":"RALLY","scoringVariant":"USAP_2026_PROVISIONAL_RALLY","ruleSetId":"rally_usap_2026_provisional_doubles_v1","freezeRule":"NONE","serverNumberRule":"NONE"}'::jsonb, 0, 0, 'hbe65461', 'not_started', 0
) on conflict (id) do update set
  state_payload = excluded.state_payload,
  state_version = 0,
  version = 0,
  state_hash = excluded.state_hash,
  status = 'not_started',
  last_event_sequence = 0,
  locked_at = null,
  locked_by = null;

delete from public.match_sync_mutations where match_state_id = 'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_UNASSIGNED';
delete from public.match_events where match_state_id = 'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_UNASSIGNED';
delete from public.match_integration_outbox where match_state_id = 'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_UNASSIGNED';
delete from public.match_result_revisions where match_id = 'REFEREE_V5_RALLY_TEST_MATCH_UNASSIGNED';
insert into public.match_live_states (
  id, tenant_id, tournament_id, match_id, team_a_id, team_b_id,
  state_payload, state_version, version, state_hash, status, last_event_sequence
) values (
  'REFEREE_V5_RALLY_TEST_TENANT::REFEREE_V5_RALLY_TEST_TOURNAMENT::REFEREE_V5_RALLY_TEST_MATCH_UNASSIGNED', 'REFEREE_V5_RALLY_TEST_TENANT', 'REFEREE_V5_RALLY_TEST_TOURNAMENT', 'REFEREE_V5_RALLY_TEST_MATCH_UNASSIGNED', 'team-a', 'team-b',
  '{"matchId":"REFEREE_V5_RALLY_TEST_MATCH_UNASSIGNED","stateSchemaVersion":1,"matchType":"doubles","status":"not_started","version":0,"scoringFormat":"rally","bestOf":1,"pointsToWin":11,"winBy":2,"maximumScore":null,"currentGameNumber":1,"teams":{"teamA":{"teamId":"team-a","courtEnd":"NEAR_END","score":0,"players":[{"playerId":"A","logicalServiceSide":"RIGHT_SERVICE_COURT"},{"playerId":"B","logicalServiceSide":"LEFT_SERVICE_COURT"}]},"teamB":{"teamId":"team-b","courtEnd":"FAR_END","score":0,"players":[{"playerId":"C","logicalServiceSide":"LEFT_SERVICE_COURT"},{"playerId":"D","logicalServiceSide":"RIGHT_SERVICE_COURT"}]}},"servingTeamId":"team-a","servingPlayerId":"A","receivingTeamId":"team-b","receivingPlayerId":"D","serverNumber":1,"games":[],"lastEventSequence":0,"scoringSystem":"RALLY","scoringVariant":"USAP_2026_PROVISIONAL_RALLY","ruleSetId":"rally_usap_2026_provisional_doubles_v1","freezeRule":"NONE","serverNumberRule":"NONE"}'::jsonb, 0, 0, 'h2b95e37d', 'not_started', 0
) on conflict (id) do update set
  state_payload = excluded.state_payload,
  state_version = 0,
  version = 0,
  state_hash = excluded.state_hash,
  status = 'not_started',
  last_event_sequence = 0,
  locked_at = null,
  locked_by = null;


insert into public.referee_assignments (
  tenant_id, tournament_id, match_id, referee_user_id, referee_display_name,
  role, status, assigned_at, expires_at, revoked_at
) values (
  'REFEREE_V5_RALLY_TEST_TENANT', 'REFEREE_V5_RALLY_TEST_TOURNAMENT', 'REFEREE_V5_RALLY_TEST_MATCH_DOUBLES', '13e0968b-53c5-4ba6-8ae0-dce12b1faf9c', 'Rally V5 QA',
  'REFEREE', 'active', now(), '2026-08-13T00:51:39.345Z', null
) on conflict (tenant_id, tournament_id, match_id, role, referee_user_id) do update set
  status = excluded.status,
  assigned_at = excluded.assigned_at,
  expires_at = excluded.expires_at,
  revoked_at = excluded.revoked_at;

insert into public.referee_assignments (
  tenant_id, tournament_id, match_id, referee_user_id, referee_display_name,
  role, status, assigned_at, expires_at, revoked_at
) values (
  'REFEREE_V5_RALLY_TEST_TENANT', 'REFEREE_V5_RALLY_TEST_TOURNAMENT', 'REFEREE_V5_RALLY_TEST_MATCH_MISSING_FORMAT', '13e0968b-53c5-4ba6-8ae0-dce12b1faf9c', 'Rally V5 QA',
  'REFEREE', 'active', now(), '2026-08-13T00:51:39.345Z', null
) on conflict (tenant_id, tournament_id, match_id, role, referee_user_id) do update set
  status = excluded.status,
  assigned_at = excluded.assigned_at,
  expires_at = excluded.expires_at,
  revoked_at = excluded.revoked_at;

insert into public.referee_assignments (
  tenant_id, tournament_id, match_id, referee_user_id, referee_display_name,
  role, status, assigned_at, expires_at, revoked_at
) values (
  'REFEREE_V5_RALLY_TEST_TENANT', 'REFEREE_V5_RALLY_TEST_TOURNAMENT', 'REFEREE_V5_RALLY_TEST_MATCH_BAD_VARIANT', '13e0968b-53c5-4ba6-8ae0-dce12b1faf9c', 'Rally V5 QA',
  'REFEREE', 'active', now(), '2026-08-13T00:51:39.345Z', null
) on conflict (tenant_id, tournament_id, match_id, role, referee_user_id) do update set
  status = excluded.status,
  assigned_at = excluded.assigned_at,
  expires_at = excluded.expires_at,
  revoked_at = excluded.revoked_at;

insert into public.referee_assignments (
  tenant_id, tournament_id, match_id, referee_user_id, referee_display_name,
  role, status, assigned_at, expires_at, revoked_at
) values (
  'REFEREE_V5_RALLY_TEST_TENANT', 'REFEREE_V5_RALLY_TEST_TOURNAMENT', 'REFEREE_V5_RALLY_TEST_MATCH_SINGLES', '13e0968b-53c5-4ba6-8ae0-dce12b1faf9c', 'Rally V5 QA',
  'REFEREE', 'active', now(), '2026-08-13T00:51:39.345Z', null
) on conflict (tenant_id, tournament_id, match_id, role, referee_user_id) do update set
  status = excluded.status,
  assigned_at = excluded.assigned_at,
  expires_at = excluded.expires_at,
  revoked_at = excluded.revoked_at;

insert into public.referee_assignments (
  tenant_id, tournament_id, match_id, referee_user_id, referee_display_name,
  role, status, assigned_at, expires_at, revoked_at
) values (
  'REFEREE_V5_RALLY_TEST_TENANT', 'REFEREE_V5_RALLY_TEST_TOURNAMENT', 'REFEREE_V5_RALLY_TEST_MATCH_EXPIRED', '13e0968b-53c5-4ba6-8ae0-dce12b1faf9c', 'Rally V5 QA',
  'REFEREE', 'active', '2026-07-13T22:51:39.345Z', '2026-07-13T23:51:39.345Z', null
) on conflict (tenant_id, tournament_id, match_id, role, referee_user_id) do update set
  status = excluded.status,
  assigned_at = excluded.assigned_at,
  expires_at = excluded.expires_at,
  revoked_at = excluded.revoked_at;

insert into public.referee_assignments (
  tenant_id, tournament_id, match_id, referee_user_id, referee_display_name,
  role, status, assigned_at, expires_at, revoked_at
) values (
  'REFEREE_V5_RALLY_TEST_TENANT', 'REFEREE_V5_RALLY_TEST_TOURNAMENT', 'REFEREE_V5_RALLY_TEST_MATCH_REVOKED_HOST', '13e0968b-53c5-4ba6-8ae0-dce12b1faf9c', 'Rally V5 QA',
  'REFEREE', 'revoked', '2026-07-13T23:51:39.345Z', null, '2026-07-14T00:51:39.345Z'
) on conflict (tenant_id, tournament_id, match_id, role, referee_user_id) do update set
  status = excluded.status,
  assigned_at = excluded.assigned_at,
  expires_at = excluded.expires_at,
  revoked_at = excluded.revoked_at;

insert into public.referee_assignments (
  tenant_id, tournament_id, match_id, referee_user_id, referee_display_name,
  role, status, assigned_at, expires_at, revoked_at
) values (
  'REFEREE_V5_RALLY_TEST_TENANT', 'REFEREE_V5_RALLY_TEST_TOURNAMENT', 'REFEREE_V5_RALLY_TEST_MATCH_DOUBLES', '7b381912-2190-415c-b099-6b1e87567b7a', 'Rally V5 QA',
  'REFEREE', 'revoked', '2026-07-13T23:51:39.345Z', null, '2026-07-14T00:51:39.345Z'
) on conflict (tenant_id, tournament_id, match_id, role, referee_user_id) do update set
  status = excluded.status,
  assigned_at = excluded.assigned_at,
  expires_at = excluded.expires_at,
  revoked_at = excluded.revoked_at;
set session_replication_role = origin;
