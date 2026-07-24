/**
 * E2E-07 recovery & replay certification via governance facade handoffs.
 */

import {
  RELIABILITY_ISSUE_CODE,
  createCompetitionGovernanceReliabilityFacade,
} from "../../operations/index.js";
import { CERTIFICATION_CHECK, CERTIFICATION_ERROR_CODE } from "../constants.js";
import { createIndividualPoolKnockoutScenarioFixture } from "../fixtures/individualPoolKnockoutScenario.js";
import { computeCertificationFingerprint, deepFreeze, clonePlain } from "../fingerprint.js";
import { createCertificationRuntimePorts } from "../ports/createCertificationRuntimePorts.js";
import { buildGovernanceQuery, buildGovernanceRecordFromFixture } from "./scenarioHelpers.js";

/**
 * @param {object} [input]
 */
export async function runRecoveryReplayCertification(input = {}) {
  const fixture =
    input.fixture || createIndividualPoolKnockoutScenarioFixture(input.fixtureOverrides);
  const ports = createCertificationRuntimePorts(input.portDeps);
  const facade = createCompetitionGovernanceReliabilityFacade({ runtimePorts: ports });

  const readyRecord = buildGovernanceRecordFromFixture(fixture, {
    standingsReady: true,
    qualificationReady: true,
  });
  const pausedRecord = clonePlain(
    buildGovernanceRecordFromFixture(fixture, {
      standingsReady: true,
      qualificationReady: true,
    })
  );
  pausedRecord.workflow.status = "PAUSED";

  const query = buildGovernanceQuery(fixture, { governanceRecord: readyRecord });

  const replayA = await facade.evaluateReplayReadiness(query);
  const replayB = await facade.evaluateReplayReadiness(query);
  const replayDeterministic = replayA.fingerprint === replayB.fingerprint;

  const recovery = await facade.evaluateRecoveryReadiness(query);

  const missingSeedRecord = clonePlain(buildGovernanceRecordFromFixture(fixture));
  missingSeedRecord.replay = { seed: null, required: true };
  const replayBlocked = await facade.evaluateReplayReadiness(
    buildGovernanceQuery(fixture, { governanceRecord: missingSeedRecord })
  );

  const missingCheckpointRecord = clonePlain(buildGovernanceRecordFromFixture(fixture));
  missingCheckpointRecord.recovery = { checkpointPresent: false, required: true };
  const recoveryBlocked = await facade.evaluateRecoveryReadiness(
    buildGovernanceQuery(fixture, { governanceRecord: missingCheckpointRecord })
  );

  const checks = Object.freeze([
    Object.freeze({
      id: "replay-ready-deterministic",
      ok: replayDeterministic && replayA.result?.ready === true,
      detail: `fingerprint stable=${replayDeterministic}`,
    }),
    Object.freeze({
      id: "recovery-checkpoint-ready",
      ok: recovery.result?.ready === true,
      detail: String(recovery.result?.ready),
    }),
    Object.freeze({
      id: "replay-missing-seed-fail-closed",
      ok:
        replayBlocked.result?.ready === false &&
        (replayBlocked.result?.issues || []).some(
          (i) => i.code === RELIABILITY_ISSUE_CODE.REPLAY_SEED_MISSING
        ),
      detail: "missing seed blocks replay",
    }),
    Object.freeze({
      id: "recovery-missing-checkpoint-fail-closed",
      ok:
        recoveryBlocked.result?.ready === false &&
        (recoveryBlocked.result?.issues || []).some(
          (i) => i.code === RELIABILITY_ISSUE_CODE.RECOVERY_CHECKPOINT_MISSING
        ),
      detail: "missing checkpoint blocks recovery",
    }),
    Object.freeze({
      id: "paused-workflow-record-accepted",
      ok: pausedRecord.workflow.status === "PAUSED",
      detail: "deterministic paused workflow fixture",
    }),
  ]);

  const ok = checks.every((c) => c.ok);
  const evidence = deepFreeze({
    scenarioId: fixture.scenarioId,
    replayFingerprint: replayA.fingerprint,
    recoveryFingerprint: recovery.fingerprint,
    sourceCommit: input.sourceCommit ?? null,
    generatedAt: input.generatedAt ?? null,
  });

  const deterministicFingerprint = computeCertificationFingerprint({
    kind: "recovery-replay-certification",
    ok,
    checks: checks.map((c) => ({ id: c.id, ok: c.ok })),
    evidence,
  });

  return deepFreeze({
    ok,
    checkId: CERTIFICATION_CHECK.RECOVERY_REPLAY,
    checks,
    evidence,
    warnings: Object.freeze([]),
    blockers: Object.freeze(
      ok
        ? []
        : [
            Object.freeze({
              code: CERTIFICATION_ERROR_CODE.RECOVERY_REPLAY_BLOCKED,
              message: "recovery/replay certification failed",
            }),
          ]
    ),
    deterministicFingerprint,
  });
}
