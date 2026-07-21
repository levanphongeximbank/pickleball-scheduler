/**
 * CORE-06 Phase 1F — capability-local certification utility.
 * Totals are computed from validateParityCatalog + summarizeParityCatalog.
 * Fixture adapter / in-memory TX are TEST_ONLY doubles used for contract checks.
 */

import {
  createLineupCertificationReport,
  LINEUP_CERT_AXIS,
} from "../contracts/certificationReport.js";
import { isLineupFormatAdapter } from "../contracts/lineupFormatAdapter.js";
import { matchesLineupPersistenceTransactionPort } from "../contracts/persistenceTransaction.js";
import { createFixtureLineupFormatAdapter } from "../adapters/createFixtureLineupFormatAdapter.js";
import { createInMemoryLineupPersistenceTransactionPort } from "../persistence/createInMemoryPersistenceTransaction.js";
import {
  summarizeParityCatalog,
  validateParityCatalog,
  LINEUP_PARITY_SCENARIOS,
} from "./parityScenarios.js";
import { createDefaultLineupHardeningPolicy } from "../contracts/lineupHardeningPolicy.js";
import { evaluateDeadlinePhase } from "../deadlines/evaluateDeadline.js";
import { assertExpectedVersion } from "../concurrency/assertExpectedVersion.js";
import { projectLineupForViewer } from "../visibility/projectLineupForViewer.js";
import { LINEUP_VISIBILITY_STATE } from "../contracts/lineupVisibilityState.js";
import { createLineupDeadlineTimestamps } from "../contracts/lineupDeadlinePhase.js";
import { LINEUP_ACCEPTED_DIFFERENCE_CODE } from "../contracts/acceptedDifferences.js";
import { LINEUP_RANDOM_ALGORITHM } from "../random/algorithm.js";

/**
 * Run CORE-06 Phase 1F certification checks (capability-local).
 * @param {object} [options]
 */
export function certifyCore06Phase1F(options = {}) {
  try {
    const scenarios = options.scenarios || LINEUP_PARITY_SCENARIOS;
    const catalogValidation = validateParityCatalog(scenarios);
    const parityScenarios = summarizeParityCatalog(scenarios);

    const adapter =
      options.adapter && isLineupFormatAdapter(options.adapter)
        ? options.adapter
        : createFixtureLineupFormatAdapter();
    const persistence =
      options.persistence &&
      matchesLineupPersistenceTransactionPort(options.persistence)
        ? options.persistence
        : createInMemoryLineupPersistenceTransactionPort();

    const adapterBoundary = isLineupFormatAdapter(adapter)
      ? LINEUP_CERT_AXIS.PASS
      : LINEUP_CERT_AXIS.FAIL;

    const sample = {
      tenantId: "tenant-1",
      tournamentId: "comp-1",
      matchupId: "mu-1",
      teamId: "team-1",
      status: "draft",
      actorId: "a1",
      actorRole: "CAPTAIN",
      evaluatedAt: "2026-07-21T12:00:00.000Z",
      expectedVersion: 1,
      idempotencyKey: "cert-1",
      selections: [
        { discipline: "md", index: 0, playerId: "p-1" },
        { discipline: "md", index: 1, playerId: "p-2" },
      ],
      lineupLockAt: "2026-07-21T18:00:00.000Z",
    };

    const legacyMap = adapter.mapCreateCommand(sample);
    const legacyMapping = legacyMap.ok
      ? LINEUP_CERT_AXIS.PASS
      : LINEUP_CERT_AXIS.FAIL;

    const roundTrip = adapter.mapCanonicalResultToFormat({
      ok: true,
      value: {
        tenantId: "tenant-1",
        competitionId: "comp-1",
        contextId: "mu-1",
        teamId: "team-1",
        status: "DRAFT",
        revision: 1,
        visibilityState: LINEUP_VISIBILITY_STATE.PRIVATE,
        slots: [],
        requiresRepublish: false,
      },
      details: {
        mutationPhase: "OPEN",
        revealEligible: false,
        revealPhase: null,
      },
    });
    const canonicalMapping = roundTrip.ok
      ? LINEUP_CERT_AXIS.PASS
      : LINEUP_CERT_AXIS.FAIL;

    const persistenceContract = matchesLineupPersistenceTransactionPort(
      persistence
    )
      ? LINEUP_CERT_AXIS.PASS
      : LINEUP_CERT_AXIS.FAIL;

    const versionCheck = assertExpectedVersion({
      expectedVersion: 2,
      currentVersion: 2,
      required: true,
    });
    const concurrencyReadiness = versionCheck.ok
      ? LINEUP_CERT_AXIS.PASS
      : LINEUP_CERT_AXIS.FAIL;

    const idemCtx = adapter.mapIdempotencyContext({
      ...sample,
      commandType: "submit",
    });
    const idempotencyReadiness =
      idemCtx.ok && idemCtx.value.aggregateIdentity
        ? LINEUP_CERT_AXIS.PASS
        : LINEUP_CERT_AXIS.FAIL;

    const hidden = projectLineupForViewer({
      lineup: {
        tenantId: "tenant-1",
        competitionId: "comp-1",
        teamId: "team-1",
        visibilityState: LINEUP_VISIBILITY_STATE.PRIVATE,
        slots: [{ person: { id: "secret" } }],
      },
      relationship: "OPPONENT",
      viewerScope: {
        tenantId: "tenant-1",
        competitionId: "comp-1",
        teamId: "team-2",
        role: "CAPTAIN",
      },
      competitionScope: { tenantId: "tenant-1", competitionId: "comp-1" },
      evaluatedAt: "2026-07-21T12:00:00.000Z",
    });
    const visibilityReadiness =
      hidden.visible === false && hidden.projectedLineup == null
        ? LINEUP_CERT_AXIS.PASS
        : LINEUP_CERT_AXIS.FAIL;

    const deadline = evaluateDeadlinePhase({
      timestamps: createLineupDeadlineTimestamps({
        opensAt: "2026-07-21T00:00:00.000Z",
        submitBy: "2026-07-21T10:00:00.000Z",
        lockAt: "2026-07-21T11:00:00.000Z",
        revealAt: "2026-07-21T12:00:00.000Z",
      }),
      evaluatedAt: "2026-07-21T12:00:00.000Z",
    });
    const deadlineReadiness =
      deadline.ok &&
      deadline.mutationPhase === "LOCKED" &&
      deadline.revealEligible === true
        ? LINEUP_CERT_AXIS.PASS
        : LINEUP_CERT_AXIS.FAIL;

    const hardening = createDefaultLineupHardeningPolicy();
    const auditReadiness =
      hardening.allowsLockedCorrection() === false
        ? LINEUP_CERT_AXIS.PASS
        : LINEUP_CERT_AXIS.FAIL;

    return createLineupCertificationReport({
      adapterBoundary,
      legacyMapping,
      canonicalMapping,
      persistenceContract,
      concurrencyReadiness,
      idempotencyReadiness,
      visibilityReadiness,
      deadlineReadiness,
      auditReadiness,
      parityScenarios,
      writerCutoverReadiness: LINEUP_CERT_AXIS.BLOCKED_PENDING_RNG_DECISION,
      legacyRetirementReadiness: LINEUP_CERT_AXIS.BLOCKED,
      details: {
        adapterId: adapter.id,
        adapterKind: "TEST_ONLY_FIXTURE",
        persistenceKind: "TEST_ONLY_IN_MEMORY",
        catalogValidationOk: catalogValidation.ok,
        evaluatedScenarioCount: parityScenarios.total,
        rngDifferenceCode: LINEUP_ACCEPTED_DIFFERENCE_CODE.RNG_SEMANTIC_ONLY,
        canonicalAlgorithmId: LINEUP_RANDOM_ALGORITHM.id,
        canonicalAlgorithmVersion: LINEUP_RANDOM_ALGORITHM.version,
        legacyAlgorithmId: null,
        legacyAlgorithmVersion: null,
        rngParityClass: "SEMANTIC_ONLY",
        note:
          "Same seed may not produce identical participant assignments across TT and CORE-06 engines. Owner approval required before canonical writer cutover.",
      },
    });
  } catch (err) {
    return createLineupCertificationReport({
      adapterBoundary: LINEUP_CERT_AXIS.FAIL,
      legacyMapping: LINEUP_CERT_AXIS.FAIL,
      canonicalMapping: LINEUP_CERT_AXIS.FAIL,
      persistenceContract: LINEUP_CERT_AXIS.FAIL,
      concurrencyReadiness: LINEUP_CERT_AXIS.FAIL,
      idempotencyReadiness: LINEUP_CERT_AXIS.FAIL,
      visibilityReadiness: LINEUP_CERT_AXIS.FAIL,
      deadlineReadiness: LINEUP_CERT_AXIS.FAIL,
      auditReadiness: LINEUP_CERT_AXIS.FAIL,
      capabilityReadiness: LINEUP_CERT_AXIS.FAIL,
      adapterImplementationReadiness: LINEUP_CERT_AXIS.FAIL,
      shadowReadiness: LINEUP_CERT_AXIS.FAIL,
      writerCutoverReadiness: LINEUP_CERT_AXIS.BLOCKED_PENDING_RNG_DECISION,
      legacyRetirementReadiness: LINEUP_CERT_AXIS.BLOCKED,
      parityScenarios: {
        total: 0,
        matched: 0,
        acceptedDifferences: 0,
        blockingDifferences: 1,
        insufficientData: 0,
        validation: { ok: false, issues: [{ code: "EXCEPTION" }] },
      },
      details: {
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
}
