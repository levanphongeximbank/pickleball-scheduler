import { deepFreeze } from "../domain/deepFreeze.js";
import { FINALIZATION_STATE } from "../domain/constants.js";
import {
  throwSeedingError,
  SEEDING_ERROR_CODE,
  normalizeOpaqueId,
} from "../domain/normalizeHelpers.js";
import { normalizeSeedingIntegrationRequest } from "./normalizeSeedingIntegrationRequest.js";
import {
  applyEligibilityDecisions,
  applyRuleEvaluation,
  resolveIntegrationSnapshot,
} from "./applyIntegrationPorts.js";
import { createDraftSeedingResult } from "../services/createDraftSeedingResult.js";
import { finalizeSeedingResult } from "../services/finalizeSeedingResult.js";
import { supersedeSeedingResult } from "../services/supersedeSeedingResult.js";
import { cancelSeedingResult } from "../services/cancelSeedingResult.js";
import {
  invokeSeedingResultRepository,
  requireSeedingResultRepositoryPort,
} from "../ports/SeedingResultRepositoryPort.js";
import {
  projectAuthoritativeSeedingResult,
  mapAuthoritativeProjectionToDrawSeedRanking,
} from "./projectAuthoritativeSeedingResult.js";
import { compareLegacyAndCanonicalSeeding } from "./compareLegacyAndCanonicalSeeding.js";
import { LIFECYCLE_ACTION } from "../domain/constants.js";

/**
 * Capability-local orchestration facade. Composes Phase 1C/1D/1E services.
 * Does not recalculate ranking, rating, or eligibility.
 *
 * @param {{
 *   defaultPorts?: object,
 * }} [options]
 */
export function createSeedingIntegrationFacade(options = {}) {
  const defaults = options.defaultPorts || {};

  function mergePorts(requestPorts) {
    const r = requestPorts && typeof requestPorts === "object" ? requestPorts : {};
    const pick = (key) =>
      Object.prototype.hasOwnProperty.call(r, key) ? r[key] : defaults[key];
    return {
      fingerprintPort: pick("fingerprintPort") || null,
      eligibilityPort: pick("eligibilityPort") || null,
      ruleEvaluationPort: pick("ruleEvaluationPort") || null,
      snapshotProviderPort: pick("snapshotProviderPort") || null,
      repositoryPort: pick("repositoryPort") || null,
      auditPort: pick("auditPort") || null,
    };
  }

  /**
   * @param {object} rawRequest
   */
  function generateDraftSeedingResult(rawRequest) {
    const withPorts = {
      ...rawRequest,
      ports: mergePorts(rawRequest.ports),
    };
    const request = normalizeSeedingIntegrationRequest(withPorts);
    const effectiveAt = request.deterministicContext.effectiveAt;

    let candidates = request.candidates.slice();
    let eligibilityDecisions = null;
    if (request.requireEligibility) {
      const applied = applyEligibilityDecisions({
        candidates,
        scope: request.seedingScope,
        eligibilityPort: request.ports.eligibilityPort,
        effectiveAt,
        requireDefinite: true,
      });
      candidates = applied.candidates;
      eligibilityDecisions = applied.decisionsByEntryId;
    }

    let ruleProvenance = null;
    if (request.requireRuleEvaluation) {
      const applied = applyRuleEvaluation({
        scope: request.seedingScope,
        candidates,
        ruleEvaluationPort: request.ports.ruleEvaluationPort,
        effectiveAt,
      });
      candidates = applied.candidates;
      ruleProvenance = applied.ruleProvenance;
    }

    const snapshot = resolveIntegrationSnapshot({
      scope: request.seedingScope,
      entryIds: candidates.map((c) => String(c.entryId)),
      snapshotProviderPort: request.ports.snapshotProviderPort,
      rankingRatingSnapshot: request.rankingRatingSnapshot,
      effectiveAt,
      requireSnapshot: request.requireSnapshot,
      allowPartialSnapshot: request.allowPartialSnapshot,
    });

    const draft = createDraftSeedingResult({
      scope: request.seedingScope,
      candidates,
      policy: request.policy,
      manualOverrides: request.manualOverrides,
      rankingRatingSnapshot: snapshot,
      requireSnapshot: request.requireSnapshot,
      deterministicContext: request.deterministicContext,
      requestId: request.requestId,
      resultId: request.resultId,
      resultVersion: request.resultVersion,
      generatedAt: request.generatedAt.value,
      fingerprintPort: request.ports.fingerprintPort,
    });

    if (request.ports.repositoryPort) {
      invokeSeedingResultRepository(
        request.ports.repositoryPort,
        "saveDraft",
        [draft]
      );
    }

    return deepFreeze({
      result: draft,
      eligibilityDecisions,
      ruleProvenance,
      snapshotProvenance: draft.snapshotProvenance,
    });
  }

  function finalizeAuthoritativeSeedingResult(input) {
    if (!input || typeof input !== "object") {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_REQUEST,
        "finalizeAuthoritativeSeedingResult input is required"
      );
    }
    const ports = mergePorts(input.ports);
    if (!ports.repositoryPort && input.requireRepositoryPort !== false) {
      requireSeedingResultRepositoryPort(null, true);
    }
    const outcome = finalizeSeedingResult({
      result: input.result,
      request: input.request,
      repositoryPort: ports.repositoryPort,
      auditPort: ports.auditPort,
      requireRepositoryPort: input.requireRepositoryPort === true,
      requireAuditPort: input.requireAuditPort === true,
      checkAuthoritativeConflict: ports.repositoryPort != null,
    });
    return outcome;
  }

  function supersedeAuthoritativeSeedingResult(input) {
    if (!input || typeof input !== "object") {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_REQUEST,
        "supersedeAuthoritativeSeedingResult input is required"
      );
    }
    const ports = mergePorts(input.ports);
    // Persist replacement as non-authoritative companion before supersede promote.
    if (ports.repositoryPort) {
      invokeSeedingResultRepository(ports.repositoryPort, "saveFinalized", [
        input.replacementResult,
      ]);
    }
    return supersedeSeedingResult({
      priorResult: input.priorResult,
      replacementResult: input.replacementResult,
      request: input.request,
      repositoryPort: ports.repositoryPort,
      auditPort: ports.auditPort,
      requireRepositoryPort: input.requireRepositoryPort === true,
      requireAuditPort: input.requireAuditPort === true,
      checkAuthoritativeConflict: ports.repositoryPort != null,
    });
  }

  function cancelDraftSeedingResult(input) {
    if (!input || typeof input !== "object") {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_REQUEST,
        "cancelDraftSeedingResult input is required"
      );
    }
    const ports = mergePorts(input.ports);
    return cancelSeedingResult({
      result: input.result,
      request: input.request,
      repositoryPort: ports.repositoryPort,
      auditPort: ports.auditPort,
      requireRepositoryPort: input.requireRepositoryPort === true,
      requireAuditPort: input.requireAuditPort === true,
    });
  }

  function getAuthoritativeSeedingResult(input) {
    if (!input || typeof input !== "object" || !input.seedingScope) {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_SCOPE,
        "seedingScope is required"
      );
    }
    const ports = mergePorts(input.ports);
    const port = requireSeedingResultRepositoryPort(ports.repositoryPort, true);
    const found = invokeSeedingResultRepository(
      port,
      "findAuthoritativeByScope",
      [input.seedingScope]
    );
    if (found == null) {
      throwSeedingError(
        SEEDING_ERROR_CODE.AUTHORITATIVE_RESULT_NOT_FOUND,
        "No authoritative finalized result for SeedingScope"
      );
    }
    if (
      /** @type {{finalizationState?:string}} */ (found).finalizationState !==
      FINALIZATION_STATE.FINALIZED
    ) {
      throwSeedingError(
        SEEDING_ERROR_CODE.AUTHORITATIVE_RESULT_NOT_FINALIZED,
        "Authoritative repository result is not FINALIZED",
        {
          finalizationState:
            /** @type {{finalizationState?:string}} */ (found)
              .finalizationState,
        }
      );
    }
    return deepFreeze({ result: found });
  }

  function projectAuthoritativeSeedingForDraw(input) {
    const loaded =
      input && input.result
        ? { result: input.result }
        : getAuthoritativeSeedingResult(input);
    const projection = projectAuthoritativeSeedingResult(loaded.result);
    const seedRanking =
      mapAuthoritativeProjectionToDrawSeedRanking(projection);
    return deepFreeze({ projection, seedRanking });
  }

  return deepFreeze({
    generateDraftSeedingResult,
    finalizeAuthoritativeSeedingResult,
    supersedeAuthoritativeSeedingResult,
    cancelDraftSeedingResult,
    getAuthoritativeSeedingResult,
    projectAuthoritativeSeedingForDraw,
    compareLegacyAndCanonicalSeeding,
    LIFECYCLE_ACTION,
  });
}

export { normalizeOpaqueId };
