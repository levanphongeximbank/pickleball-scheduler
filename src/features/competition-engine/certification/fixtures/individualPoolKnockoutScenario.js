/**
 * Deterministic IND Pool+Knockout scenario fixture for E2E-07 certification.
 */

import {
  E2E02_FORMAT_ID,
  E2E02_TEMPLATE_ID,
} from "../../composition/constants.js";
import { deepFreeze } from "../fingerprint.js";

const PLAYER_IDS = Object.freeze([
  "p1",
  "p2",
  "p3",
  "p4",
  "p5",
  "p6",
  "p7",
  "p8",
]);

/**
 * @param {object} [overrides]
 */
export function createIndividualPoolKnockoutScenarioFixture(overrides = {}) {
  const fixture = {
    certificationId: "cert-e2e07-ind-pool-ko-v1",
    scenarioId: "individual-pool-knockout-e2e07",
    tenantId: "tenant-e2e07",
    competitionId: "comp-e2e07",
    venueId: "venue-e2e07",
    deterministicSeed: "seed-e2e07-pool-knockout",
    clockIso: "2026-07-24T12:00:00.000Z",
    templateId: E2E02_TEMPLATE_ID,
    formatId: E2E02_FORMAT_ID,
    formatOverrides: Object.freeze({ poolCount: 2, qualifiersPerPool: 2 }),
    organizer: Object.freeze({
      actorId: "org-e2e07",
      role: "TOURNAMENT_MANAGER",
    }),
    players: PLAYER_IDS.map((participantId, index) =>
      Object.freeze({
        participantId,
        actorId: participantId,
        role: "PLAYER",
        playerId: participantId,
        seedNumber: index + 1,
        rating: 1500 - index * 25,
        displayName: `Player ${index + 1}`,
      })
    ),
    referees: Object.freeze([
      Object.freeze({
        actorId: "ref-1",
        role: "REFEREE",
        refereeId: "ref-1",
      }),
      Object.freeze({
        actorId: "ref-2",
        role: "REFEREE",
        refereeId: "ref-2",
      }),
    ]),
    courts: Object.freeze([
      Object.freeze({ courtId: "c1", courtName: "Court 1", number: 1 }),
      Object.freeze({ courtId: "c2", courtName: "Court 2", number: 2 }),
    ]),
    workflow: Object.freeze({
      workflowId: "wf-e2e07-pool-ko",
      eventId: "evt-e2e07-lifecycle",
      lifecycleRevision: "life-rev-e2e07-1",
    }),
    scoring: Object.freeze({
      rallyTarget: 11,
      winBy: 2,
      sideA: "SIDE_A",
    }),
    publication: Object.freeze({
      operationalRevision: "pub-op-e2e07-1",
      finalRevision: "pub-final-e2e07-1",
    }),
    schedule: Object.freeze({
      certified: true,
      fingerprint: "sched-fp-e2e07-1",
      assignmentCount: 12,
    }),
    courtAssignment: Object.freeze({
      complete: true,
      fingerprint: "court-fp-e2e07-1",
    }),
    governance: Object.freeze({
      replaySeed: "seed-e2e07-pool-knockout",
      replaySourceFingerprint: "src-fp-e2e07-1",
      recoveryCheckpointFingerprint: "cp-fp-e2e07-1",
      auditEvidencePresent: true,
    }),
    publicOverlay: Object.freeze({
      publicTitle: "E2E-07 IND Pool Knockout Certification",
      venueName: "E2E-07 Arena",
      timezone: "Asia/Ho_Chi_Minh",
      dates: Object.freeze({
        startDate: "2026-07-24",
        endDate: "2026-07-26",
        timezone: "Asia/Ho_Chi_Minh",
      }),
    }),
    ...overrides,
  };

  return deepFreeze(fixture);
}

export { PLAYER_IDS as E2E07_PLAYER_IDS };
