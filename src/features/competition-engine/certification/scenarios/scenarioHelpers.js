/**
 * Shared helpers for E2E-07 certification scenarios.
 */

import {
  computeCertificationFingerprint,
  deepFreeze,
} from "../fingerprint.js";

/**
 * @param {object} fixture
 * @param {object} [overrides]
 */
export function buildOrganizerCommand(fixture, overrides = {}) {
  return {
    tenantId: fixture.tenantId,
    competitionId: fixture.competitionId,
    venueId: fixture.venueId,
    actor: fixture.organizer,
    deterministicSeed: fixture.deterministicSeed,
    ...overrides,
  };
}

/**
 * @param {object} fixture
 * @param {object} player
 * @param {object} [overrides]
 */
export function buildPlayerCommand(fixture, player, overrides = {}) {
  return {
    tenantId: fixture.tenantId,
    competitionId: fixture.competitionId,
    venueId: fixture.venueId,
    actor: {
      actorId: player.actorId,
      role: player.role,
      playerId: player.playerId,
    },
    playerId: player.playerId,
    ...overrides,
  };
}

/**
 * @param {object} fixture
 * @param {object} referee
 * @param {object} [overrides]
 */
export function buildRefereeCommand(fixture, referee, overrides = {}) {
  return {
    tenantId: fixture.tenantId,
    competitionId: fixture.competitionId,
    venueId: fixture.venueId,
    actor: {
      actorId: referee.actorId,
      role: referee.role,
      refereeId: referee.refereeId,
    },
    ...overrides,
  };
}

/**
 * @param {object} fixture
 * @param {object} [overrides]
 */
export function buildGovernanceQuery(fixture, overrides = {}) {
  return {
    tenantId: fixture.tenantId,
    competitionId: fixture.competitionId,
    actor: fixture.organizer,
    ...overrides,
  };
}

/**
 * @param {string} stageId
 * @param {boolean} ok
 * @param {unknown} snippet
 * @param {object[]} [blockers]
 */
export function recordStage(stageId, ok, snippet, blockers = []) {
  return deepFreeze({
    stageId,
    ok,
    fingerprintSnippet: computeCertificationFingerprint(
      { stageId, ok, snippet },
      "e2e07-stage"
    ),
    blockers: Object.freeze(blockers),
  });
}

/**
 * @param {object} poolStage
 * @returns {object[]}
 */
export function buildStandingsRowsFromPoolGrouping(poolStage) {
  const groups =
    poolStage?.grouping?.groups ||
    poolStage?.groups ||
    [];
  return groups.map((g) => ({
    groupId: g.groupId,
    rows: (g.participantIds || []).map((id, i) => ({
      entryId: id,
      rank: i + 1,
      points: 20 - i,
    })),
  }));
}

/**
 * @param {object} composition
 * @returns {{ matchId: string, entries: object[] }|null}
 */
export function pickFirstPoolMatch(composition) {
  const poolStage = composition?.composition?.stages?.pool || composition?.stages?.pool;
  const logicalMatches =
    poolStage?.matchPlan?.logicalMatches ||
    poolStage?.matchPlan?.logicalMatches ||
    [];
  const played = logicalMatches.filter((m) => m && m.isByeMatch !== true);
  const first = played[0];
  if (!first) return null;
  const matchId = first.logicalMatchKey || first.matchId || "pool-m1";
  const a = first.participantSlotA?.participantId || first.participantA;
  const b = first.participantSlotB?.participantId || first.participantB;
  return {
    matchId,
    entries: [
      { entryId: `entry-${a}`, participantId: a },
      { entryId: `entry-${b}`, participantId: b },
    ],
  };
}

/**
 * @param {object} composition
 * @returns {string[]}
 */
export function pickKnockoutMatchIds(composition) {
  const koStage =
    composition?.composition?.stages?.knockout || composition?.stages?.knockout;
  const logicalMatches = koStage?.matchPlan?.logicalMatches || [];
  return logicalMatches
    .filter((m) => m && m.isByeMatch !== true)
    .map((m) => m.logicalMatchKey || m.matchId)
    .filter(Boolean);
}

/**
 * @param {object} fixture
 * @param {object} happyPathEvidence
 */
export function buildGovernanceRecordFromFixture(fixture, happyPathEvidence = {}) {
  return deepFreeze({
    tenantId: fixture.tenantId,
    competitionId: fixture.competitionId,
    definition: {
      version: "def-e2e07-1",
      ruleSetVersion: "rules-e2e07-v1",
      configurationFingerprint: "cfg-e2e07-1",
    },
    publication: {
      state: happyPathEvidence.finalPublished ? "FINAL_RESULT_PUBLISHED" : "OPERATIONAL_PLAN_PUBLISHED",
      revision: happyPathEvidence.finalPublished
        ? fixture.publication.finalRevision
        : fixture.publication.operationalRevision,
      consistent: true,
      ready: true,
    },
    lifecycle: {
      state: happyPathEvidence.lifecycleState || "ACTIVE",
      revision: fixture.workflow.lifecycleRevision,
      consistent: true,
    },
    workflow: { status: "RUNNING", revision: "wf-e2e07-1", consistent: true },
    participantLock: { locked: true, required: false },
    scheduleCourt: { certified: true, required: false },
    checkIn: { ready: true },
    refereeAssignment: { ready: true },
    scoring: { ready: true, required: false },
    resultValidation: { ready: true, revision: "rv-e2e07-1" },
    standings: {
      ready: happyPathEvidence.standingsReady === true,
      fingerprint: happyPathEvidence.standingsFingerprint || "stand-e2e07-1",
      required: false,
    },
    qualification: { ready: happyPathEvidence.qualificationReady === true, required: false },
    finalResult: { ready: happyPathEvidence.finalPublished === true, required: false },
    archive: { ready: happyPathEvidence.archiveReady === true },
    audit: { evidencePresent: fixture.governance.auditEvidencePresent, required: true },
    replay: {
      seed: fixture.governance.replaySeed,
      sourceFingerprint: fixture.governance.replaySourceFingerprint,
      target: "pool-knockout",
      required: false,
    },
    importExport: {
      ready: true,
      schemaVersion: "core22-v1",
      exportChecksum: "export-e2e07-1",
      importChecksum: "import-e2e07-1",
    },
    recovery: {
      checkpointPresent: true,
      checkpointFingerprint: fixture.governance.recoveryCheckpointFingerprint,
      required: false,
    },
    publicVisibility: { ready: true },
    dependencies: {
      identity: "AVAILABLE",
      workflow: "AVAILABLE",
      audit: "AVAILABLE",
      replay: "AVAILABLE",
      recovery: "AVAILABLE",
      recoveryCheckpoint: "AVAILABLE",
      ratingSnapshot: "AVAILABLE",
      venueCourt: "AVAILABLE",
      auditPersistence: "AVAILABLE",
      publicProjection: "AVAILABLE",
      importExport: "AVAILABLE",
    },
    evidenceRefs: ["ev-e2e07-1"],
  });
}
