/**
 * GOV-08 performance benchmark runner — wall-clock excluded from fingerprints.
 */

import process from "node:process";
import { performance } from "node:perf_hooks";

import { createInMemoryTemplateCatalog } from "../../../competition-management/template-instantiation/index.js";
import { createPoolKnockoutRuntimeComposition } from "../../application/createPoolKnockoutRuntimeComposition.js";
import {
  ENTRY_OPS_STATUS,
  createInMemoryOrganizerOperationsStore,
  createOrganizerOperationsFacade,
} from "../../operations/index.js";
import { GOV08_MVP_LOCAL_BUDGETS } from "./gov08Budgets.js";
import { CERTIFICATION_CHECK } from "../constants.js";
import { createIndividualPoolKnockoutScenarioFixture } from "../fixtures/individualPoolKnockoutScenario.js";
import { computeCertificationFingerprint, deepFreeze } from "../fingerprint.js";
import { createCertificationRuntimePorts } from "../ports/createCertificationRuntimePorts.js";
import { buildOrganizerCommand } from "../scenarios/scenarioHelpers.js";
import { buildStandingsRowsFromPoolGrouping } from "../scenarios/scenarioHelpers.js";
import { runHappyPathCertification } from "../scenarios/runHappyPathCertification.js";

/**
 * @param {number[]} values
 * @returns {number}
 */
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * @param {number} size
 */
function participantsForSize(size) {
  return Array.from({ length: size }, (_, i) => `p${i + 1}`);
}

/**
 * @param {object} [input]
 */
export async function runGov08PerformanceBenchmark(input = {}) {
  const budgets = input.budgets || GOV08_MVP_LOCAL_BUDGETS;
  const fixture = createIndividualPoolKnockoutScenarioFixture({
    ...input.fixtureOverrides,
    formatOverrides: { poolCount: 2, qualifiersPerPool: 2 },
  });
  const catalog = createInMemoryTemplateCatalog();
  const ports = createCertificationRuntimePorts(input.portDeps);

  /** @type {Record<number, object>} */
  const bySize = {};

  for (const size of budgets.sizes) {
    const participants = participantsForSize(size);
    /** @type {number[]} */
    const poolMs = [];
    /** @type {number[]} */
    const knockoutMs = [];
    /** @type {number[]} */
    const fullMs = [];

    const totalRuns = budgets.warmUpRuns + budgets.measuredRuns;
    for (let run = 0; run < totalRuns; run += 1) {
      const poolStart = performance.now();
      const poolOnly = createPoolKnockoutRuntimeComposition({
        tenantId: fixture.tenantId,
        competitionId: `${fixture.competitionId}-${size}`,
        participants,
        deterministicSeed: `${fixture.deterministicSeed}-${size}`,
        catalog,
        formatOverrides: { poolCount: 2, qualifiersPerPool: 2 },
        includeKnockout: false,
        requireRuntimePorts: false,
      });
      void poolOnly;
      const poolElapsed = performance.now() - poolStart;

      const koStart = performance.now();
      const poolForKo = createPoolKnockoutRuntimeComposition({
        tenantId: fixture.tenantId,
        competitionId: `${fixture.competitionId}-pool-${size}`,
        participants,
        deterministicSeed: `${fixture.deterministicSeed}-pool-${size}`,
        catalog,
        formatOverrides: { poolCount: 2, qualifiersPerPool: 2 },
        includeKnockout: false,
        requireRuntimePorts: false,
      });
      const poolStandingsRows = buildStandingsRowsFromPoolGrouping(
        poolForKo.composition?.stages?.pool
      );
      createPoolKnockoutRuntimeComposition({
        tenantId: fixture.tenantId,
        competitionId: `${fixture.competitionId}-ko-${size}`,
        participants,
        deterministicSeed: `${fixture.deterministicSeed}-ko-${size}`,
        catalog,
        formatOverrides: { poolCount: 2, qualifiersPerPool: 2 },
        poolStageComplete: true,
        includeKnockout: true,
        poolStandingsRows,
        requireRuntimePorts: false,
      });
      const koElapsed = performance.now() - koStart;

      let fullElapsed = 0;
      if (size === 8) {
        const fullStart = performance.now();
        const store = createInMemoryOrganizerOperationsStore({ clockIso: fixture.clockIso });
        const organizer = createOrganizerOperationsFacade({
          clockIso: fixture.clockIso,
          runtimePorts: ports,
          store,
        });
        const organizerCmd = buildOrganizerCommand(fixture, {
          competitionId: `${fixture.competitionId}-bench-${size}`,
        });
        const prepareCmd = {
          ...organizerCmd,
          entries: participants.map((id) => ({
            participantId: id,
            status: ENTRY_OPS_STATUS.ELIGIBLE,
          })),
        };
        await organizer.prepareCompetitionOperations(prepareCmd);
        await organizer.lockParticipantField(organizerCmd);
        await organizer.preparePoolStage({
          ...organizerCmd,
          catalog,
          formatOverrides: fixture.formatOverrides,
        });
        fullElapsed = performance.now() - fullStart;
      }

      if (run >= budgets.warmUpRuns) {
        poolMs.push(poolElapsed);
        knockoutMs.push(koElapsed);
        if (size === 8) fullMs.push(fullElapsed);
      }
    }

    const poolMedian = median(poolMs);
    const knockoutMedian = median(knockoutMs);
    const fullMedian = size === 8 && fullMs.length ? median(fullMs) : null;

    const poolBudget = budgets.thresholdsMs.poolCompositionMedian[size];
    const koBudget = budgets.thresholdsMs.knockoutCompositionMedian[size];
    const fullBudget = budgets.thresholdsMs.fullCertificationScenarioMedian[size];

    bySize[size] = {
      size,
      measuredRuns: budgets.measuredRuns,
      poolCompositionMedianMs: poolMedian,
      knockoutCompositionMedianMs: knockoutMedian,
      fullCertificationScenarioMedianMs: fullMedian,
      poolWithinBudget: poolMedian <= poolBudget,
      knockoutWithinBudget: knockoutMedian <= koBudget,
      fullWithinBudget: fullMedian == null ? true : fullMedian <= fullBudget,
    };
  }

  const regressionDetected = Object.values(bySize).some(
    (row) =>
      row.poolWithinBudget === false ||
      row.knockoutWithinBudget === false ||
      row.fullWithinBudget === false
  );

  const performanceResults = deepFreeze({
    budgetVersion: budgets.budgetVersion,
    budgetClass: budgets.budgetClass,
    productionSlaClaimForbidden: budgets.productionSlaClaimForbidden,
    environment: Object.freeze({
      nodeVersion: process.version,
      platform: process.platform,
    }),
    sizes: Object.freeze(
      budgets.sizes.map((size) => Object.freeze(bySize[size]))
    ),
    regressionDetected,
    gatePassed: !regressionDetected,
  });

  const deterministicFingerprint = computeCertificationFingerprint({
    kind: "performance-certification",
    checkId: CERTIFICATION_CHECK.GOV08_BENCHMARK,
    gatePassed: !regressionDetected,
    budgetVersion: budgets.budgetVersion,
    sizeGateSummary: budgets.sizes.map((size) => ({
      size,
      poolWithinBudget: bySize[size].poolWithinBudget,
      knockoutWithinBudget: bySize[size].knockoutWithinBudget,
      fullWithinBudget: bySize[size].fullWithinBudget,
    })),
  });

  if (input.includeHappyPathBench === true && budgets.sizes.includes(8)) {
    const happy = await runHappyPathCertification({
      ...input,
      fixtureOverrides: {
        competitionId: `${fixture.competitionId}-full-bench`,
      },
    });
    void happy;
  }

  return deepFreeze({
    ok: !regressionDetected,
    checkId: CERTIFICATION_CHECK.GOV08_BENCHMARK,
    performanceResults,
    deterministicFingerprint,
    checks: Object.freeze([
      Object.freeze({
        id: CERTIFICATION_CHECK.GOV08_BENCHMARK,
        ok: !regressionDetected,
        detail: regressionDetected ? "budget regression detected" : "within MVP local budgets",
      }),
    ]),
  });
}
