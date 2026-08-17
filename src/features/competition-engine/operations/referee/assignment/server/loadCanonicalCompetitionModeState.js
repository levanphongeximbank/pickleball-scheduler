/**
 * Project canonical tournament / team payload into Adapter B modeState.
 * Translation only — does not invent schedule timestamps or court identity.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function trimId(value) {
  const text = String(value || "").trim();
  return text || null;
}

function isPhysicalCourtId(value) {
  const id = trimId(value);
  if (!id) return null;
  if (/\s/.test(id)) return null;
  return id;
}

function collectMatches(node, acc) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) collectMatches(item, acc);
    return;
  }
  if (!isPlainObject(node)) return;

  const matchId = trimId(
    node.matchId || node.id || node.match_id || node.subMatchId
  );
  const looksLikeMatch =
    matchId &&
    (node.scheduledAt != null ||
      node.scheduledStart != null ||
      node.startAt != null ||
      node.courtId != null ||
      node.physicalCourtId != null ||
      node.entryAId != null ||
      node.entryBId != null ||
      node.teamAId != null ||
      node.teamBId != null ||
      node.status != null ||
      node.sides != null);

  if (looksLikeMatch && !acc.matches[matchId]) {
    acc.matches[matchId] = {
      ...node,
      matchId,
      scheduledAt:
        node.scheduledAt || node.scheduledStart || node.startAt || null,
      scheduledStart: node.scheduledStart || node.scheduledAt || node.startAt || null,
      scheduledEnd: node.scheduledEnd || node.endAt || null,
      courtId: node.physicalCourtId || node.courtId || node.court_id || null,
      physicalCourtId: node.physicalCourtId || node.physical_court_id || null,
      durationMinutes: node.durationMinutes || node.matchDurationMinutes || null,
    };
  }

  const matchupId = trimId(node.matchupId || (node.teamAId && node.teamBId ? node.id : null));
  if (matchupId && (node.teamAId || node.teamBId) && !acc.matchups[matchupId]) {
    acc.matchups[matchupId] = node;
  }

  const nestedKeys = [
    "matches",
    "matchups",
    "events",
    "groups",
    "brackets",
    "rounds",
    "sessions",
    "subMatches",
    "children",
    "schedule",
    "teamData",
    "payload",
  ];
  for (const key of nestedKeys) {
    if (node[key] != null) collectMatches(node[key], acc);
  }
}

/**
 * @param {object} [row]
 * @returns {object}
 */
export function extractCanonicalMatchIndex(row = {}) {
  const acc = { matches: {}, matchups: {} };
  collectMatches(row, acc);
  collectMatches(row?.payload, acc);
  return acc;
}

/**
 * @param {{
 *   tenantId: string,
 *   tournamentId: string,
 *   competitionMode: string,
 *   canonical?: object|null,
 *   teamHeader?: object|null,
 * }} input
 */
export function buildAdapterBModeState(input = {}) {
  const tenantId = String(input.tenantId || "").trim();
  const tournamentId = String(input.tournamentId || "").trim();
  const competitionMode = String(input.competitionMode || "INTERNAL")
    .trim()
    .toUpperCase();
  const index = extractCanonicalMatchIndex(input.canonical || input.teamHeader || {});
  const canonical = input.canonical || null;

  return Object.freeze({
    tenantId,
    competitionId: tournamentId,
    competitionMode:
      competitionMode === "OFFICIAL_OPEN" ? "OFFICIAL" : competitionMode,
    competitionType: canonical?.mode || null,
    venueId: trimId(canonical?.venue_id || canonical?.payload?.venueId) || null,
    clubId: trimId(canonical?.club_id || canonical?.payload?.clubId) || null,
    matches: Object.freeze({ ...index.matches }),
    matchups: Object.freeze({ ...index.matchups }),
    canonicalAssignmentAuthorityAvailable: true,
  });
}

export function resolvePhysicalCourtId(match = {}) {
  return (
    isPhysicalCourtId(match.physicalCourtId) ||
    isPhysicalCourtId(match.physical_court_id) ||
    isPhysicalCourtId(match.courtId) ||
    isPhysicalCourtId(match.court_id) ||
    null
  );
}

export function isUuid(value) {
  return UUID_RE.test(String(value || "").trim());
}

export { trimId };
