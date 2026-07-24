/**
 * E2E-07 governance health certification.
 */

import {
  DEGRADED_CONTINUATION,
  RUNTIME_HEALTH_STATE,
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
export async function runGovernanceCertification(input = {}) {
  const fixture =
    input.fixture || createIndividualPoolKnockoutScenarioFixture(input.fixtureOverrides);
  const ports = createCertificationRuntimePorts(input.portDeps);
  const facade = createCompetitionGovernanceReliabilityFacade({ runtimePorts: ports });

  const readyRecord = buildGovernanceRecordFromFixture(fixture, {
    standingsReady: true,
    qualificationReady: true,
  });
  const ready = await facade.getGovernanceState(
    buildGovernanceQuery(fixture, { governanceRecord: readyRecord })
  );

  const blockedRecord = clonePlain(
    buildGovernanceRecordFromFixture(fixture, {
      standingsReady: true,
      qualificationReady: true,
    })
  );
  blockedRecord.audit = { evidencePresent: false, required: true };
  const blocked = await facade.getGovernanceState(
    buildGovernanceQuery(fixture, { governanceRecord: blockedRecord })
  );

  const degradedRecord = clonePlain(buildGovernanceRecordFromFixture(fixture));
  degradedRecord.dependencies = {
    ...degradedRecord.dependencies,
    ratingSnapshot: "UNAVAILABLE",
  };
  const degraded = await facade.createDegradedModeProjection(
    buildGovernanceQuery(fixture, { governanceRecord: degradedRecord })
  );

  const manifestA = await facade.buildReliabilityEvidence(
    buildGovernanceQuery(fixture, { governanceRecord: readyRecord })
  );
  const manifestB = await facade.buildReliabilityEvidence(
    buildGovernanceQuery(fixture, { governanceRecord: readyRecord })
  );

  const incident = await facade.createIncidentProjection(
    buildGovernanceQuery(fixture, { governanceRecord: blockedRecord })
  );

  const checks = Object.freeze([
    Object.freeze({
      id: "health-ready",
      ok: ready.result?.healthState === RUNTIME_HEALTH_STATE.READY,
      detail: String(ready.result?.healthState),
    }),
    Object.freeze({
      id: "health-blocked-mandatory-audit",
      ok: blocked.result?.healthState === RUNTIME_HEALTH_STATE.BLOCKED,
      detail: "missing audit evidence fail-closed",
    }),
    Object.freeze({
      id: "degraded-safe-partial",
      ok:
        degraded.result?.active === true &&
        degraded.result?.primaryContinuation === DEGRADED_CONTINUATION.CONTINUE_SAFE,
      detail: String(degraded.result?.primaryContinuation),
    }),
    Object.freeze({
      id: "evidence-manifest-deterministic",
      ok: manifestA.fingerprint === manifestB.fingerprint,
      detail: manifestA.fingerprint,
    }),
    Object.freeze({
      id: "no-platform-incident-duplication",
      ok: incident.result?.ownsPlatformIncidentManagement === false,
      detail: "competition-scoped incident projection only",
    }),
  ]);

  const ok = checks.every((c) => c.ok);
  const evidence = deepFreeze({
    scenarioId: fixture.scenarioId,
    readyHealth: ready.result?.healthState,
    blockedHealth: blocked.result?.healthState,
    manifestFingerprint: manifestA.fingerprint,
    sourceCommit: input.sourceCommit ?? null,
    generatedAt: input.generatedAt ?? null,
  });

  const deterministicFingerprint = computeCertificationFingerprint({
    kind: "governance-certification",
    ok,
    checks: checks.map((c) => ({ id: c.id, ok: c.ok })),
    evidence,
  });

  return deepFreeze({
    ok,
    checkId: CERTIFICATION_CHECK.GOVERNANCE_HEALTH,
    checks,
    evidence,
    warnings: Object.freeze([]),
    blockers: Object.freeze(
      ok
        ? []
        : [
            Object.freeze({
              code: CERTIFICATION_ERROR_CODE.GOVERNANCE_BLOCKED,
              message: "governance certification failed",
            }),
          ]
    ),
    deterministicFingerprint,
  });
}
