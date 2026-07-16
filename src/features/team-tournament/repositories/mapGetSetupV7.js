/**
 * Map team_tournament_get_setup v7 envelope into repository-friendly fields.
 * Read-path only — no mutation wiring.
 */

/**
 * @param {object} payload
 * @returns {boolean}
 */
export function isGetSetupV7Payload(payload) {
  return Number(payload?.schemaVersion) === 7;
}

/**
 * Normalize tournament object for mapTournamentToAggregate.
 * V7 may expose flat collections; ensure teamData nest exists for legacy mapper.
 * @param {object} tournament
 * @returns {object}
 */
export function normalizeV7TournamentForAggregate(tournament = {}) {
  const teamData = tournament.teamData && typeof tournament.teamData === "object"
    ? tournament.teamData
    : {
        teams: tournament.teams || [],
        matchups: tournament.matchups || [],
        lineups: tournament.lineups || {},
        standings: tournament.standings || [],
        disciplines: tournament.disciplines || [],
        groups: tournament.groups || [],
        settings: tournament.settings || {},
      };

  return {
    ...tournament,
    settings: {
      ...(tournament.settings || {}),
      awards: tournament.awards,
      schedulePublish: tournament.schedulePublish,
      closed: tournament.closing?.closed,
      closedAt: tournament.closing?.closedAt,
      closedBy: tournament.closing?.closedBy,
      resultsLocked: tournament.closing?.resultsLocked,
      formatPreset: tournament.formatPreset,
      rosterRules: tournament.rosterRules,
    },
    teamData: {
      ...teamData,
      groups: teamData.groups || tournament.groups || [],
      disciplines: teamData.disciplines || tournament.disciplines || [],
      teams: teamData.teams || tournament.teams || [],
      matchups: teamData.matchups || tournament.matchups || [],
      lineups: teamData.lineups || tournament.lineups || {},
      standings: teamData.standings || tournament.standings || [],
      dreambreaker: tournament.dreambreaker || {},
    },
  };
}

/**
 * @param {object|null|undefined} snapshot
 * @returns {object|null}
 */
export function mapSetupSnapshotMetadata(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }
  return {
    snapshotId: snapshot.snapshotId || null,
    snapshotVersion: snapshot.snapshotVersion ?? null,
    snapshotHash: snapshot.snapshotHash || null,
    normalizedReadHash: snapshot.normalizedReadHash || null,
    engineInputHash: snapshot.engineInputHash || null,
    engineOutputHash: snapshot.engineOutputHash || null,
    engineVersion: snapshot.engineVersion || null,
    rulesVersion: snapshot.rulesVersion || null,
    commandName: snapshot.commandName || null,
    createdAt: snapshot.createdAt || null,
  };
}

/**
 * @param {object|null|undefined} diagnostic
 * @returns {object|null}
 */
export function mapSetupDiagnostic(diagnostic) {
  if (!diagnostic || typeof diagnostic !== "object") {
    return null;
  }
  return {
    driftDetected: diagnostic.driftDetected === true,
    driftCode: diagnostic.driftCode || null,
    latestSnapshotHash: diagnostic.latestSnapshotHash || null,
    latestNormalizedReadHash: diagnostic.latestNormalizedReadHash || null,
    currentNormalizedHash: diagnostic.currentNormalizedHash || null,
    engineVersionMismatch: diagnostic.engineVersionMismatch === true,
    rulesVersionMismatch: diagnostic.rulesVersionMismatch === true,
  };
}

/**
 * @param {object} payload get_setup RPC payload
 * @returns {{
 *   schemaVersion: number|null,
 *   snapshot: object|null,
 *   diagnostic: object|null,
 *   setupBlocked: boolean,
 *   driftDetected: boolean,
 *   viewer: object|null,
 *   permissions: object|null,
 *   operations: object|null,
 * }}
 */
export function mapGetSetupV7Meta(payload = {}) {
  if (!isGetSetupV7Payload(payload)) {
    return {
      schemaVersion: null,
      snapshot: null,
      diagnostic: null,
      setupBlocked: false,
      driftDetected: false,
      viewer: null,
      permissions: null,
      operations: null,
    };
  }

  const diagnostic = mapSetupDiagnostic(payload.diagnostic);
  const driftDetected = diagnostic?.driftDetected === true;
  const setupBlocked =
    driftDetected &&
    (diagnostic?.driftCode === "NORMALIZED_READ_DRIFT" ||
      diagnostic?.driftCode === "SNAPSHOT_NOT_INITIALIZED");

  return {
    schemaVersion: 7,
    snapshot: mapSetupSnapshotMetadata(payload.snapshot),
    diagnostic,
    setupBlocked,
    driftDetected,
    viewer: payload.viewer || null,
    permissions: payload.permissions || null,
    operations: payload.operations || null,
  };
}
