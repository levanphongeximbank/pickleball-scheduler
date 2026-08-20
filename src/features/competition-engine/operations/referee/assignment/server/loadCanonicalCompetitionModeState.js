/**
 * Project canonical tournament / team payload into Adapter B modeState.
 * Translation only — does not invent schedule timestamps or court identity.
 *
 * Match identity is collected only from known canonical match containers.
 * Daily Play matches live at payload.settings.dailyPlay.matches (Adapter B
 * mapDailyMatches consumes the same location). This indexer does not recurse
 * arbitrary payload keys and does not treat the tournament root as a match.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MATCH_CONTAINER_KEYS = Object.freeze(["matches", "subMatches", "schedule"]);
const MATCHUP_CONTAINER_KEYS = Object.freeze(["matchups"]);
const STRUCTURE_CONTAINER_KEYS = Object.freeze([
  "payload",
  "teamData",
  "settings",
  "dailyPlay",
  "events",
  "groups",
  "brackets",
  "rounds",
  "sessions",
  "children",
]);

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

function provenMatchIdentity(node) {
  if (!isPlainObject(node)) return null;
  return trimId(node.matchId || node.id || node.match_id);
}

function indexMatch(node, matchId, acc) {
  if (!matchId || acc.matches[matchId]) return;
  acc.matches[matchId] = {
    ...node,
    matchId,
    scheduledAt: node.scheduledAt || node.scheduledStart || node.startAt || null,
    scheduledStart: node.scheduledStart || node.scheduledAt || node.startAt || null,
    scheduledEnd: node.scheduledEnd || node.endAt || null,
    courtId: node.physicalCourtId || node.courtId || node.court_id || null,
    physicalCourtId: node.physicalCourtId || node.physical_court_id || null,
    durationMinutes: node.durationMinutes || node.matchDurationMinutes || null,
  };
}

function collectFromMatchContainer(node, acc) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) collectFromMatchContainer(item, acc);
    return;
  }
  if (!isPlainObject(node)) return;

  const matchId = provenMatchIdentity(node);
  if (matchId) {
    indexMatch(node, matchId, acc);
    if (node.subMatches != null) collectFromMatchContainer(node.subMatches, acc);
    if (node.matches != null) collectFromMatchContainer(node.matches, acc);
    return;
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      collectFromMatchContainer(value, acc);
    } else if (isPlainObject(value) && provenMatchIdentity(value)) {
      collectFromMatchContainer(value, acc);
    }
  }
}

function collectFromMatchupContainer(node, acc) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) collectFromMatchupContainer(item, acc);
    return;
  }
  if (!isPlainObject(node)) return;

  const matchupId = trimId(
    node.matchupId || (node.teamAId && node.teamBId ? node.id : null)
  );
  if (matchupId && (node.teamAId || node.teamBId) && !acc.matchups[matchupId]) {
    acc.matchups[matchupId] = node;
  }
  const matchId = provenMatchIdentity(node);
  if (matchId) indexMatch(node, matchId, acc);
  if (matchupId || matchId) {
    if (node.matches != null) collectFromMatchContainer(node.matches, acc);
    if (node.subMatches != null) collectFromMatchContainer(node.subMatches, acc);
    return;
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value) || isPlainObject(value)) {
      collectFromMatchupContainer(value, acc);
    }
  }
}

function visitKnownCanonicalContainers(node, acc) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) visitKnownCanonicalContainers(item, acc);
    return;
  }
  if (!isPlainObject(node)) return;

  for (const key of MATCH_CONTAINER_KEYS) {
    if (node[key] != null) collectFromMatchContainer(node[key], acc);
  }
  for (const key of MATCHUP_CONTAINER_KEYS) {
    if (node[key] != null) collectFromMatchupContainer(node[key], acc);
  }
  for (const key of STRUCTURE_CONTAINER_KEYS) {
    if (node[key] != null) visitKnownCanonicalContainers(node[key], acc);
  }
}

/**
 * @param {object} [row]
 * @returns {object}
 */
export function extractCanonicalMatchIndex(row = {}) {
  const acc = { matches: {}, matchups: {} };
  visitKnownCanonicalContainers(row, acc);
  visitKnownCanonicalContainers(row?.payload, acc);
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
