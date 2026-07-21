/**
 * Explicit test stubs for CORE-07 integration ports (Phase 1F).
 * Not Production defaults.
 */

import { CORE07_ELIGIBILITY_PORT_VERSION } from "../../ports/EligibilityDecisionPort.js";
import { CORE07_RULE_EVALUATION_PORT_VERSION } from "../../ports/RuleEvaluationPort.js";
import { CORE07_SNAPSHOT_PROVIDER_PORT_VERSION } from "../../ports/RankingRatingSnapshotProviderPort.js";
import { CORE07_FINGERPRINT_PORT_VERSION } from "../../domain/constants.js";
import { ELIGIBILITY_STATUS } from "../../domain/constants.js";
import { deepFreeze } from "../../domain/deepFreeze.js";

/**
 * @param {{ decisionsByEntryId?: Record<string, object>, throwError?: Error }} [options]
 */
export function createEligibilityDecisionPortStub(options = {}) {
  const map = options.decisionsByEntryId || {};
  return {
    contractVersion: CORE07_ELIGIBILITY_PORT_VERSION,
    resolveDecisions(input) {
      if (options.throwError) throw options.throwError;
      /** @type {Record<string, object>} */
      const decisionsByEntryId = {};
      for (const entryId of input.entryIds || []) {
        const d = map[entryId];
        if (d) decisionsByEntryId[entryId] = deepFreeze({ ...d });
      }
      return {
        ok: true,
        decisionsByEntryId,
        reasonCodes: [],
      };
    },
  };
}

/**
 * @param {{ resultsByEntryId?: Record<string, object>, ok?: boolean, throwError?: Error, ruleSetId?: string, ruleSetVersion?: string }} [options]
 */
export function createRuleEvaluationPortStub(options = {}) {
  return {
    contractVersion: CORE07_RULE_EVALUATION_PORT_VERSION,
    evaluateSeedingRules() {
      if (options.throwError) throw options.throwError;
      return {
        ok: options.ok !== false,
        ruleSetId: options.ruleSetId || "rules-1",
        ruleSetVersion: options.ruleSetVersion || "1",
        resultsByEntryId: options.resultsByEntryId || {},
        decisionId: options.decisionId || "rule-dec-1",
        evaluatedAt: options.evaluatedAt || "2026-07-21T12:00:00.000Z",
      };
    },
  };
}

/**
 * @param {{ snapshot?: object, throwError?: Error }} [options]
 */
export function createSnapshotProviderPortStub(options = {}) {
  return {
    contractVersion: CORE07_SNAPSHOT_PROVIDER_PORT_VERSION,
    getSnapshot(input) {
      if (options.throwError) throw options.throwError;
      if (options.snapshot) return deepFreeze({ ...options.snapshot });
      return deepFreeze({
        snapshotId: "snap-stub-1",
        sourceSystem: "test",
        sourceVersion: "1",
        capturedAt: "2026-07-21T11:00:00.000Z",
        effectiveAt: input.effectiveAt,
        subjectValues: (input.entryIds || []).map((id) => ({
          entryId: id,
          rankingPosition: 1,
          ratingValue: 1000,
        })),
        completenessState: "COMPLETE",
        missingDataMetadata: null,
        checksum: "chk-stub-1",
        fingerprint: "fp-stub-1",
        scopeRef: input.seedingScope,
      });
    },
  };
}

/**
 * Deterministic fingerprint stub for integration tests.
 */
export function createFingerprintPortStub() {
  return {
    contractVersion: CORE07_FINGERPRINT_PORT_VERSION,
    fingerprint(canonicalPayload) {
      let h = 2166136261;
      const s = String(canonicalPayload);
      for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return `fnv1a32:${(h >>> 0).toString(16).padStart(8, "0")}`;
    },
  };
}

export { ELIGIBILITY_STATUS };
