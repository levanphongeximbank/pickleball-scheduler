const AUDIT_ACTIONS = Object.freeze({
  "START_MATCH": "referee.match.started",
  "TEAM_A_WON_RALLY": "referee.rally.recorded",
  "TEAM_B_WON_RALLY": "referee.rally.recorded",
  "SWITCH_ENDS": "referee.ends.switched",
  "UNDO_LAST_EVENT": "referee.event.reverted",
  "PAUSE_MATCH": "referee.match.paused",
  "RESUME_MATCH": "referee.match.resumed",
  "DECLARE_FORFEIT": "referee.forfeit.declared",
  "FINALIZE_MATCH": "referee.result.confirmed",
  "OVERRIDE_RESULT": "referee.result.overridden",
});

export function buildAuditEntry({
  tenantId,
  tournamentId,
  matchId,
  actorId,
  actorRole,
  commandType,
  beforeVersion,
  afterVersion,
  reason = null,
}) {
  return {
    action: AUDIT_ACTIONS[commandType] || `referee.command.${String(commandType).toLowerCase()}`,
    tenant_id: tenantId,
    tournament_id: tournamentId,
    match_id: matchId,
    actor_id: actorId,
    actor_role: actorRole,
    command_type: commandType,
    before_version: beforeVersion,
    after_version: afterVersion,
    reason,
    created_at: new Date().toISOString(),
  };
}

export { AUDIT_ACTIONS };
