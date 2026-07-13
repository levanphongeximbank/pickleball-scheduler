import { hashTeamTournamentPayload } from "../repositories/teamTournamentIdempotency.js";

export const ENVELOPE_ERROR_CODES = Object.freeze({
  INVALID_EVENT: "invalid_event",
  INVALID_SCOPE: "invalid_scope",
  INVALID_VERSION: "invalid_version",
});

const REQUIRED_SCOPE_FIELDS = ["tenantId", "tournamentId"];

/**
 * @typedef {object} TeamTournamentRealtimeEvent
 * @property {string} eventId
 * @property {string} eventType
 * @property {string} tenantId
 * @property {string} tournamentId
 * @property {string} [matchupId]
 * @property {string} [subMatchId]
 * @property {string} [externalSubMatchId]
 * @property {string} entityType
 * @property {string} entityId
 * @property {number} entityVersion
 * @property {string} occurredAt
 * @property {string} [correlationId]
 * @property {string} source
 * @property {string} payloadHash
 * @property {Record<string, unknown>} payload
 */

/**
 * @param {Partial<TeamTournamentRealtimeEvent>} input
 * @returns {{ ok: true, event: TeamTournamentRealtimeEvent } | { ok: false, code: string, error: string }}
 */
export function validateRealtimeEventEnvelope(input) {
  if (!input || typeof input !== "object") {
    return { ok: false, code: ENVELOPE_ERROR_CODES.INVALID_EVENT, error: "Envelope missing." };
  }
  if (!input.eventId || typeof input.eventId !== "string") {
    return { ok: false, code: ENVELOPE_ERROR_CODES.INVALID_EVENT, error: "Missing eventId." };
  }
  for (const field of REQUIRED_SCOPE_FIELDS) {
    if (!input[field]) {
      return { ok: false, code: ENVELOPE_ERROR_CODES.INVALID_SCOPE, error: `Missing ${field}.` };
    }
  }
  const version = Number(input.entityVersion);
  if (!Number.isFinite(version) || version < 0) {
    return { ok: false, code: ENVELOPE_ERROR_CODES.INVALID_VERSION, error: "Invalid entityVersion." };
  }
  if (!input.entityType || !input.entityId || !input.eventType) {
    return { ok: false, code: ENVELOPE_ERROR_CODES.INVALID_EVENT, error: "Missing entity metadata." };
  }
  if (!input.source || !input.payloadHash) {
    return { ok: false, code: ENVELOPE_ERROR_CODES.INVALID_EVENT, error: "Missing source or payloadHash." };
  }
  return {
    ok: true,
    event: {
      eventId: input.eventId,
      eventType: input.eventType,
      tenantId: String(input.tenantId),
      tournamentId: String(input.tournamentId),
      matchupId: input.matchupId ? String(input.matchupId) : undefined,
      subMatchId: input.subMatchId ? String(input.subMatchId) : undefined,
      externalSubMatchId: input.externalSubMatchId ? String(input.externalSubMatchId) : undefined,
      entityType: String(input.entityType),
      entityId: String(input.entityId),
      entityVersion: version,
      occurredAt: input.occurredAt || new Date().toISOString(),
      correlationId: input.correlationId ? String(input.correlationId) : undefined,
      source: String(input.source),
      payloadHash: String(input.payloadHash),
      payload: input.payload && typeof input.payload === "object" ? input.payload : {},
    },
  };
}

/**
 * Build stable eventId — timestamp is NOT part of identity.
 * @param {object} params
 */
export function buildEventId({ source, table, entityId, entityVersion, payloadHash }) {
  const hashPrefix = String(payloadHash || "").slice(0, 8);
  return `${source}:${table}:${entityId}:${entityVersion}:${hashPrefix}`;
}

/**
 * Minimal payload from matchup row — no lineup selections.
 * @param {object} row
 * @param {string} [source]
 */
export function envelopeFromMatchupRow(row, source = "postgres_changes") {
  if (!row || typeof row !== "object") {
    return null;
  }
  const entityId = String(row.id ?? "");
  const entityVersion = Number(row.version ?? row.matchup_version ?? 0);
  const payload = {
    status: row.status ?? null,
    version: entityVersion,
  };
  const payloadHash = hashTeamTournamentPayload(payload);
  return {
    eventId: buildEventId({
      source: "pg",
      table: "team_tournament_matchups",
      entityId,
      entityVersion,
      payloadHash,
    }),
    eventType: "matchup.status_changed",
    tenantId: String(row.tenant_id ?? ""),
    tournamentId: String(row.tournament_id ?? ""),
    matchupId: entityId,
    entityType: "matchup",
    entityId,
    entityVersion,
    occurredAt: row.updated_at ?? new Date().toISOString(),
    source,
    payloadHash,
    payload,
  };
}

/**
 * Minimal payload from sub-match row.
 * @param {object} row
 * @param {string} [source]
 */
export function envelopeFromSubMatchRow(row, source = "postgres_changes") {
  if (!row || typeof row !== "object") {
    return null;
  }
  const entityId = String(row.id ?? "");
  const entityVersion = Number(row.version ?? row.sub_match_version ?? 0);
  const payload = {
    status: row.status ?? null,
    version: entityVersion,
    winnerTeamId: row.winner_team_id ?? null,
  };
  const payloadHash = hashTeamTournamentPayload(payload);
  return {
    eventId: buildEventId({
      source: "pg",
      table: "team_tournament_sub_matches",
      entityId,
      entityVersion,
      payloadHash,
    }),
    eventType: "sub_match.result_updated",
    tenantId: String(row.tenant_id ?? ""),
    tournamentId: String(row.tournament_id ?? ""),
    matchupId: row.matchup_id ? String(row.matchup_id) : undefined,
    subMatchId: entityId,
    externalSubMatchId: row.external_sub_match_id ? String(row.external_sub_match_id) : undefined,
    entityType: "sub_match",
    entityId,
    entityVersion,
    occurredAt: row.updated_at ?? new Date().toISOString(),
    source,
    payloadHash,
    payload,
  };
}

/**
 * Bridge link status hint — no sensitive sync payload.
 * @param {object} row
 * @param {string} [source]
 */
export function envelopeFromBridgeRow(row, source = "postgres_changes") {
  if (!row || typeof row !== "object") {
    return null;
  }
  const entityId = String(row.id ?? "");
  const entityVersion = Number(row.version ?? row.link_version ?? 0);
  const payload = {
    integrationStatus: row.status ?? row.integration_status ?? null,
    syncError: row.sync_error ? "present" : null,
    version: entityVersion,
  };
  const payloadHash = hashTeamTournamentPayload(payload);
  return {
    eventId: buildEventId({
      source: "pg",
      table: "team_sub_match_referee_links",
      entityId,
      entityVersion,
      payloadHash,
    }),
    eventType: "bridge.status_changed",
    tenantId: String(row.tenant_id ?? ""),
    tournamentId: String(row.tournament_id ?? ""),
    matchupId: row.matchup_id ? String(row.matchup_id) : undefined,
    subMatchId: row.sub_match_id ? String(row.sub_match_id) : undefined,
    externalSubMatchId: row.referee_match_id ? String(row.referee_match_id) : undefined,
    entityType: "bridge",
    entityId,
    entityVersion,
    occurredAt: row.updated_at ?? new Date().toISOString(),
    source,
    payloadHash,
    payload,
  };
}

/**
 * Referee V5 notification → TT envelope (adapter path).
 * @param {object} note
 * @param {object} scope
 */
export function envelopeFromRefereeV5Notification(note, scope) {
  if (!note || !scope) {
    return null;
  }
  const entityVersion = Number(note.stateVersion ?? 0);
  const payload = {
    stateVersion: entityVersion,
    eventSequence: Number(note.eventSequence ?? 0),
    status: note.status ?? null,
  };
  const payloadHash = hashTeamTournamentPayload(payload);
  const matchId = String(note.matchId ?? scope.externalSubMatchId ?? "");
  return {
    eventId: buildEventId({
      source: "v5",
      table: "match_live_states",
      entityId: matchId,
      entityVersion,
      payloadHash,
    }),
    eventType: "referee_match.version_bumped",
    tenantId: String(scope.tenantId ?? note.tenantId ?? ""),
    tournamentId: String(scope.tournamentId ?? ""),
    externalSubMatchId: matchId,
    entityType: "referee_match",
    entityId: matchId,
    entityVersion,
    occurredAt: note.updatedAt ?? new Date().toISOString(),
    source: "referee_v5",
    payloadHash,
    payload,
  };
}

/**
 * Synthetic polling envelope when snapshot version unchanged externally.
 * @param {object} params
 */
export function envelopeFromPollingSnapshot(params) {
  const {
    tenantId,
    tournamentId,
    entityType,
    entityId,
    entityVersion,
    scopeKey,
  } = params;
  const payload = { scopeKey, version: entityVersion };
  const payloadHash = hashTeamTournamentPayload(payload);
  return {
    eventId: buildEventId({
      source: "poll",
      table: scopeKey,
      entityId,
      entityVersion,
      payloadHash,
    }),
    eventType: "snapshot.polled",
    tenantId: String(tenantId),
    tournamentId: String(tournamentId),
    entityType,
    entityId: String(entityId),
    entityVersion: Number(entityVersion),
    occurredAt: new Date().toISOString(),
    source: "polling",
    payloadHash,
    payload,
  };
}
