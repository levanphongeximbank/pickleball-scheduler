/**
 * CORE-13 canonical scoring-activity evidence.
 *
 * last_event_sequence > 0 is NOT scoring evidence. START_MATCH / timeout /
 * pause / switch-ends increment sequence without a rally.
 *
 * Scoring activity is proven only by:
 *   canonical score > 0
 *   OR Referee V5 rally/scoring command (TEAM_A_WON_RALLY / TEAM_B_WON_RALLY)
 *   OR POINT_AWARDED in generated domain events
 *
 * Once a rally/scoring command has occurred, the match remains scoring-active
 * even if a later UNDO is appended.
 */

export const EVENT_SEQUENCE_ALONE_AS_SCORING_ACTIVE = "DENY";
export const SCORING_ACTIVE_REFINEMENT_ONLY_FOR_IN_PROGRESS = "YES";

export const CANONICAL_SCORING_COMMAND_TYPES = Object.freeze([
  "TEAM_A_WON_RALLY",
  "TEAM_B_WON_RALLY",
]);

export const CANONICAL_SCORING_DOMAIN_EVENT_TYPES = Object.freeze([
  "POINT_AWARDED",
]);

function upper(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function eventCommandType(event = {}) {
  return upper(
    event.commandType ||
      event.command_type ||
      event.eventType ||
      event.event_type ||
      event.type
  );
}

function generatedEventTypes(event = {}) {
  const raw = event.generatedEvents || event.generated_events || [];
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => upper(item)).filter(Boolean);
}

export function eventHasCanonicalScoringActivity(event = {}) {
  const command = eventCommandType(event);
  if (CANONICAL_SCORING_COMMAND_TYPES.includes(command)) return true;
  return generatedEventTypes(event).some(
    (type) =>
      CANONICAL_SCORING_COMMAND_TYPES.includes(type) ||
      CANONICAL_SCORING_DOMAIN_EVENT_TYPES.includes(type)
  );
}

export function eventsHaveCanonicalScoringActivity(events = []) {
  return (events || []).some((event) => eventHasCanonicalScoringActivity(event));
}

export function readCanonicalLiveScores(row = null) {
  if (!row) return { teamA: 0, teamB: 0 };
  const payload = row.state_payload || row.statePayload || row.payload || {};
  const teams = payload.teams || {};
  const columnA = Number(row.team_a_score ?? row.teamAScore ?? 0);
  const columnB = Number(row.team_b_score ?? row.teamBScore ?? 0);
  const payloadA = Number(
    teams.teamA?.score ?? teams.a?.score ?? payload.scoreA ?? 0
  );
  const payloadB = Number(
    teams.teamB?.score ?? teams.b?.score ?? payload.scoreB ?? 0
  );
  return {
    teamA: Math.max(
      Number.isFinite(columnA) ? columnA : 0,
      Number.isFinite(payloadA) ? payloadA : 0
    ),
    teamB: Math.max(
      Number.isFinite(columnB) ? columnB : 0,
      Number.isFinite(payloadB) ? payloadB : 0
    ),
  };
}

export function hasCanonicalNumericScore(row = null) {
  const scores = readCanonicalLiveScores(row);
  return scores.teamA > 0 || scores.teamB > 0;
}

/**
 * @param {{
 *   liveRow?: object|null,
 *   events?: object[],
 *   eventsReadable?: boolean,
 * }} input
 */
export function classifyCanonicalScoringActivity(input = {}) {
  const liveRow = input.liveRow || null;
  const events = Array.isArray(input.events) ? input.events : [];
  const eventsReadable = input.eventsReadable !== false;
  const sequence = Number(
    liveRow?.last_event_sequence ?? liveRow?.lastEventSequence ?? 0
  );
  const numericScore = hasCanonicalNumericScore(liveRow);
  const scoringCommand = eventsHaveCanonicalScoringActivity(events);
  const scoringActive = numericScore === true || scoringCommand === true;
  const evidenceRequired =
    Boolean(liveRow) &&
    numericScore !== true &&
    Number.isFinite(sequence) &&
    sequence > 0;

  if (evidenceRequired && eventsReadable !== true) {
    return Object.freeze({
      scoringActive: null,
      evidenceRequired: true,
      evidenceAvailable: false,
      numericScore,
      scoringCommand: false,
      sequence: Number.isFinite(sequence) ? sequence : 0,
      EVENT_SEQUENCE_ALONE_AS_SCORING_ACTIVE,
    });
  }

  return Object.freeze({
    scoringActive,
    evidenceRequired,
    evidenceAvailable: evidenceRequired ? eventsReadable === true : true,
    numericScore,
    scoringCommand,
    sequence: Number.isFinite(sequence) ? sequence : 0,
    EVENT_SEQUENCE_ALONE_AS_SCORING_ACTIVE,
  });
}
