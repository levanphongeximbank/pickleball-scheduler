/**
 * Reusable CompetitionRefereeAdapterContract v1 conformance harness.
 * Future mode adapters must pass the same suite.
 */

import {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
  REFEREE_ADAPTER_ERROR_CODE,
} from "./constants.js";
import {
  assertAdapterDoesNotOwnAuthority,
  assertCompetitionRefereeAdapter,
  assertResultPropagationPayload,
  assertScoringRulesPayload,
} from "./contract.js";
import { isRefereeAdapterContractError } from "./errors.js";
import { freezeClone } from "./helpers.js";
import { createCompetitionRefereeAdapterRegistry } from "./registry.js";
import { createReferenceRefereeAdapter } from "./referenceAdapter.js";

function catchCode(fn) {
  try {
    fn();
    return { threw: false, code: null };
  } catch (err) {
    return {
      threw: true,
      code: isRefereeAdapterContractError(err) ? err.code : err?.code || "UNKNOWN",
    };
  }
}

function record(id, ok, detail) {
  return freezeClone({ id, ok, detail: detail || null });
}

/**
 * @param {object} adapter
 * @param {{
 *   registry?: ReturnType<typeof createCompetitionRefereeAdapterRegistry>,
 *   validRequest?: object,
 *   unknownMatchRequest?: object,
 *   crossTenantRequest?: object,
 *   malformedRequest?: object,
 * }} [options]
 */
export function runCompetitionRefereeAdapterConformance(adapter, options = {}) {
  const results = [];
  const validRequest = options.validRequest || {
    tenantId: "tenant-1",
    competitionId: "comp-ref-1",
    matchId: "match-1",
  };

  try {
    assertCompetitionRefereeAdapter(adapter);
    results.push(record("CONTRACT_VERSION", true, {
      contractId: adapter.contractId,
      contractVersion: adapter.contractVersion,
    }));
  } catch (err) {
    results.push(record("CONTRACT_VERSION", false, { code: err.code }));
    return freezeClone({
      ok: false,
      contractId: COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
      contractVersion: COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
      results,
    });
  }

  const matchContext = adapter.getMatchContext(validRequest);
  results.push(
    record(
      "MATCH_CONTEXT",
      Boolean(matchContext?.matchId) && matchContext.matchId === validRequest.matchId,
      matchContext
    )
  );

  const participants = adapter.getParticipants(validRequest);
  results.push(
    record(
      "PARTICIPANT_CONTEXT",
      Array.isArray(participants?.sides) && participants.sides.length === 2,
      participants
    )
  );

  try {
    const rules = assertScoringRulesPayload(adapter.getScoringRules(validRequest));
    results.push(record("SCORING_RULES", Boolean(rules.formatId), rules));
  } catch (err) {
    results.push(record("SCORING_RULES", false, { code: err.code }));
  }

  const lifecycle = adapter.getLifecyclePolicy(validRequest);
  results.push(
    record(
      "LIFECYCLE_POLICY",
      lifecycle?.standingsRequireAcceptedResult === true &&
        lifecycle?.requiresAssignment === true,
      lifecycle
    )
  );

  const capabilities = adapter.getCapabilities(validRequest);
  results.push(
    record(
      "CAPABILITIES",
      capabilities?.ownsScoringAuthority === false &&
        capabilities?.ownsResultAuthority === false &&
        capabilities?.ownsRefereeIdentity === false,
      capabilities
    )
  );

  const prestart = adapter.validatePreStart(validRequest);
  results.push(record("PRESTART_POLICY", prestart?.ok === true, prestart));

  try {
    const propagation = assertResultPropagationPayload(
      adapter.resolveResultPropagation(validRequest)
    );
    results.push(
      record(
        "RESULT_PROPAGATION",
        propagation.propagateOnlyIfAccepted === true,
        propagation
      )
    );
  } catch (err) {
    results.push(record("RESULT_PROPAGATION", false, { code: err.code }));
  }

  const registry =
    options.registry ||
    createCompetitionRefereeAdapterRegistry({ adapters: [adapter] });

  const unknownMode = catchCode(() => registry.resolve("UNKNOWN_MODE"));
  results.push(
    record(
      "UNKNOWN_MODE",
      unknownMode.threw &&
        unknownMode.code === REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MODE,
      unknownMode
    )
  );

  const unknownMatch = catchCode(() =>
    adapter.getMatchContext(
      options.unknownMatchRequest || { ...validRequest, matchId: "missing-match" }
    )
  );
  results.push(
    record(
      "UNKNOWN_MATCH",
      unknownMatch.threw &&
        unknownMatch.code === REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MATCH,
      unknownMatch
    )
  );

  const malformed = catchCode(() =>
    adapter.getCompetitionContext(options.malformedRequest || {})
  );
  results.push(
    record(
      "MALFORMED_CONTEXT",
      malformed.threw &&
        malformed.code === REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
      malformed
    )
  );

  const missingRulesAdapter =
    options.missingScoringRulesAdapter ||
    createReferenceRefereeAdapter({
      mode: adapter.competitionMode,
      adapterId: "reference-missing-scoring-rules",
      fixtures: {
        tenantId: validRequest.tenantId,
        competitionId: validRequest.competitionId,
        matches: {
          [validRequest.matchId]: {
            matchId: validRequest.matchId,
            status: "READY_TO_START",
            sides: [
              { sideKey: "A", entryId: "a", participantIds: ["p-a"] },
              { sideKey: "B", entryId: "b", participantIds: ["p-b"] },
            ],
            scoringRules: null,
          },
        },
      },
    });
  const missing = catchCode(() =>
    missingRulesAdapter.getScoringRules(validRequest)
  );
  results.push(
    record(
      "MISSING_SCORING_RULES",
      missing.threw &&
        missing.code === REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES,
      missing
    )
  );

  const crossTenant = catchCode(() =>
    adapter.getCompetitionContext(
      options.crossTenantRequest || { ...validRequest, tenantId: "other-tenant" }
    )
  );
  results.push(
    record(
      "CROSS_TENANT_CONTEXT",
      crossTenant.threw &&
        crossTenant.code === REFEREE_ADAPTER_ERROR_CODE.CROSS_TENANT_CONTEXT,
      crossTenant
    )
  );

  const scoreAuthority = catchCode(() =>
    assertAdapterDoesNotOwnAuthority({
      ...adapter,
      recordPoint() {
        return null;
      },
    })
  );
  results.push(
    record(
      "DIRECT_SCORE_AUTHORITY_FORBIDDEN",
      scoreAuthority.threw &&
        scoreAuthority.code ===
          REFEREE_ADAPTER_ERROR_CODE.DIRECT_SCORE_AUTHORITY_FORBIDDEN,
      scoreAuthority
    )
  );

  const resultAuthority = catchCode(() =>
    assertAdapterDoesNotOwnAuthority({
      ...adapter,
      acceptResult() {
        return null;
      },
    })
  );
  results.push(
    record(
      "DIRECT_RESULT_AUTHORITY_FORBIDDEN",
      resultAuthority.threw &&
        resultAuthority.code ===
          REFEREE_ADAPTER_ERROR_CODE.DIRECT_RESULT_AUTHORITY_FORBIDDEN,
      resultAuthority
    )
  );

  const refereeAuthority = catchCode(() =>
    assertAdapterDoesNotOwnAuthority({
      ...adapter,
      assignReferee() {
        return null;
      },
    })
  );
  results.push(
    record(
      "DIRECT_REFEREE_AUTHORITY_FORBIDDEN",
      refereeAuthority.threw &&
        refereeAuthority.code ===
          REFEREE_ADAPTER_ERROR_CODE.DIRECT_REFEREE_AUTHORITY_FORBIDDEN,
      refereeAuthority
    )
  );

  const ok = results.every((row) => row.ok === true);
  return freezeClone({
    ok,
    contractId: COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
    contractVersion: COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
    results,
  });
}
