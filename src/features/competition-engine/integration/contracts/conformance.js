/**
 * Reusable conformance harness for the 14 Canonical Competition Adapter Contracts.
 */

import { getWorkstreamContractDefinition } from "./definitions.js";
import {
  assertCanonicalAdapterDoesNotOwnAuthority,
  assertCompetitionAdapter,
} from "./kernel/assertContract.js";
import {
  COMPETITION_ADAPTER_CONTRACT_LOCKED,
  COMPETITION_ADAPTER_CONTRACT_VERSION_V1,
  SHARED_ADAPTER_ERROR_CODE,
} from "./kernel/constants.js";
import { isCompetitionAdapterContractError } from "./kernel/errors.js";
import { freezeClone } from "./kernel/helpers.js";

function catchCode(fn) {
  try {
    const value = fn();
    if (value && typeof value.then === "function") {
      return value.then(
        () => ({ threw: false, code: null }),
        (err) => ({
          threw: true,
          code: isCompetitionAdapterContractError(err)
            ? err.code
            : err?.code || "UNKNOWN",
        })
      );
    }
    return { threw: false, code: null };
  } catch (err) {
    return {
      threw: true,
      code: isCompetitionAdapterContractError(err) ? err.code : err?.code || "UNKNOWN",
    };
  }
}

function record(id, ok, detail) {
  return freezeClone({ id, ok, detail: detail || null });
}

async function awaitCatch(fn) {
  const result = catchCode(fn);
  return result && typeof result.then === "function" ? result : result;
}

/**
 * @param {object} adapter
 * @param {object} [definition]
 * @param {{
 *   validContext?: object,
 *   crossTenantContext?: object,
 *   malformedContext?: object,
 *   fuzzyIdentityContext?: object,
 * }} [options]
 */
export async function runCompetitionAdapterConformance(
  adapter,
  definition,
  options = {}
) {
  const def =
    definition || getWorkstreamContractDefinition(adapter?.contractId);
  const results = [];
  if (!def) {
    return freezeClone({
      ok: false,
      contractId: adapter?.contractId || null,
      contractVersion: adapter?.contractVersion || null,
      results: [record("CONTRACT_DEFINITION", false, { reason: "unknown contract" })],
    });
  }

  try {
    assertCompetitionAdapter(adapter, def);
    results.push(
      record("CONTRACT_ID", adapter.contractId === def.contractId, {
        contractId: adapter.contractId,
      })
    );
    results.push(
      record(
        "CONTRACT_VERSION",
        adapter.contractVersion === COMPETITION_ADAPTER_CONTRACT_VERSION_V1,
        { contractVersion: adapter.contractVersion }
      )
    );
    results.push(
      record("LOCKED", adapter.locked === COMPETITION_ADAPTER_CONTRACT_LOCKED, {
        locked: adapter.locked,
      })
    );
  } catch (err) {
    results.push(record("CONTRACT_VERSION", false, { code: err.code }));
    return freezeClone({
      ok: false,
      contractId: def.contractId,
      contractVersion: def.contractVersion,
      results,
    });
  }

  const missingMethods = def.requiredMethods.filter(
    (method) => typeof adapter[method] !== "function"
  );
  results.push(
    record("REQUIRED_METHODS", missingMethods.length === 0, { missingMethods })
  );

  const kindsOk = (def.capabilities || []).every((cap) =>
    ["QUERY", "COMMAND", "EVENT"].includes(cap.kind)
  );
  results.push(record("QUERY_COMMAND_EVENT", kindsOk, def.capabilities));

  const forbidden = catchCode(() =>
    assertCanonicalAdapterDoesNotOwnAuthority(
      {
        ...adapter,
        scoringEngine: {},
      },
      def
    )
  );
  results.push(
    record(
      "FORBIDDEN_AUTHORITY",
      forbidden.threw &&
        forbidden.code === SHARED_ADAPTER_ERROR_CODE.FORBIDDEN_AUTHORITY,
      forbidden
    )
  );

  const metadataFrozen =
    Object.isFrozen(adapter) &&
    adapter.contractId === def.contractId &&
    adapter.locked === true;
  results.push(record("IMMUTABLE_METADATA", metadataFrozen, {
    frozen: Object.isFrozen(adapter),
  }));

  const validContext = options.validContext || {
    contractVersion: COMPETITION_ADAPTER_CONTRACT_VERSION_V1,
    tenantId: "tenant-1",
    competitionId: "comp-1",
    actorId: "actor-1",
    correlationId: "corr-1",
    participantId: "player-1",
    clubId: "club-1",
    matchId: "match-1",
    effectiveAt: "2026-01-01T00:00:00Z",
    idempotencyKey: "idem-1",
    role: "TOURNAMENT_DIRECTOR",
  };

  const firstMethod = def.requiredMethods[0];
  const malformed = await awaitCatch(() => adapter[firstMethod](options.malformedContext || {}));
  results.push(
    record(
      "MALFORMED_ADAPTER_OR_CONTEXT",
      malformed.threw &&
        (malformed.code === SHARED_ADAPTER_ERROR_CODE.MISSING_REQUIRED_CONTEXT ||
          malformed.code === SHARED_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER ||
          malformed.code === SHARED_ADAPTER_ERROR_CODE.NOT_CONFIGURED),
      malformed
    )
  );

  const cross = await awaitCatch(() =>
    adapter[firstMethod](
      options.crossTenantContext || { ...validContext, tenantId: "other-tenant" }
    )
  );
  const crossOk =
    cross.threw &&
    (cross.code === SHARED_ADAPTER_ERROR_CODE.CROSS_TENANT_CONTEXT ||
      cross.code === SHARED_ADAPTER_ERROR_CODE.NOT_CONFIGURED ||
      cross.code === SHARED_ADAPTER_ERROR_CODE.MISSING_CANONICAL_IDENTITY ||
      cross.code === SHARED_ADAPTER_ERROR_CODE.CAPABILITY_NOT_SUPPORTED);
  results.push(record("CROSS_TENANT_FAIL_CLOSED", crossOk, cross));

  const fuzzy = await awaitCatch(() =>
    adapter[firstMethod](
      options.fuzzyIdentityContext || {
        ...validContext,
        actorId: "person@example.com",
        participantId: "person@example.com",
        playerId: "person@example.com",
      }
    )
  );
  results.push(
    record(
      "CANONICAL_IDENTITY",
      fuzzy.threw &&
        (fuzzy.code === SHARED_ADAPTER_ERROR_CODE.FUZZY_IDENTITY_FORBIDDEN ||
          fuzzy.code === SHARED_ADAPTER_ERROR_CODE.NOT_CONFIGURED ||
          fuzzy.code === SHARED_ADAPTER_ERROR_CODE.DISPLAY_NAME_IS_NOT_IDENTITY),
      fuzzy
    )
  );

  if (def.productionBinding === "NOT_CONFIGURED") {
    const notConfigured = await awaitCatch(() => adapter[firstMethod](validContext));
    results.push(
      record(
        "NOT_CONFIGURED",
        notConfigured.threw &&
          notConfigured.code === SHARED_ADAPTER_ERROR_CODE.NOT_CONFIGURED,
        notConfigured
      )
    );
  } else {
    results.push(record("NOT_CONFIGURED", true, { skipped: "runtime present" }));
  }

  const ok = results.every((row) => row.ok === true);
  return freezeClone({
    ok,
    contractId: def.contractId,
    contractVersion: def.contractVersion,
    results,
  });
}
