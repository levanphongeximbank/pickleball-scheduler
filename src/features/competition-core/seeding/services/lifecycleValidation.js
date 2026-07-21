import { buildSeedingScopeKey } from "../domain/normalizeSeedingScope.js";
import {
  throwSeedingError,
  SEEDING_ERROR_CODE,
} from "../domain/normalizeHelpers.js";
import {
  invokeSeedingResultRepository,
  requireSeedingResultRepositoryPort,
} from "../ports/SeedingResultRepositoryPort.js";
import {
  appendLifecycleEventsThroughPort,
  requireSeedingLifecycleAuditPort,
} from "../ports/SeedingLifecycleAuditPort.js";
import { FINALIZATION_STATE } from "../domain/constants.js";

/**
 * @param {unknown} result
 */
export function assertSeedingResultShape(result) {
  if (!result || typeof result !== "object") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "SeedingResult is required"
    );
  }
  const r = /** @type {Record<string, unknown>} */ (result);
  if (!r.resultId || r.resultVersion == null || r.resultVersion === "") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "SeedingResult.resultId and resultVersion are required"
    );
  }
  if (!r.scope || typeof r.scope !== "object") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_SCOPE,
      "SeedingResult.scope is required"
    );
  }
  if (
    typeof r.deterministicFingerprint !== "string" ||
    r.deterministicFingerprint.length === 0
  ) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "SeedingResult.deterministicFingerprint is required"
    );
  }
}

/**
 * @param {Record<string, unknown>} result
 */
export function assertPolicyAndSnapshotProvenance(result) {
  const policy = result.policyProvenance;
  if (!policy || typeof policy !== "object") {
    throwSeedingError(
      SEEDING_ERROR_CODE.POLICY_REQUIRED,
      "policyProvenance is required for lifecycle transition"
    );
  }
  const p = /** @type {Record<string, unknown>} */ (policy);
  if (!p.policyId || p.policyVersion == null || p.policyVersion === "") {
    throwSeedingError(
      SEEDING_ERROR_CODE.POLICY_REQUIRED,
      "policyProvenance.policyId and policyVersion are required"
    );
  }
  const snap = result.snapshotProvenance;
  if (!snap || typeof snap !== "object") {
    throwSeedingError(
      SEEDING_ERROR_CODE.SNAPSHOT_REQUIRED,
      "snapshotProvenance is required for lifecycle transition"
    );
  }
  const s = /** @type {Record<string, unknown>} */ (snap);
  if (!s.snapshotId) {
    throwSeedingError(
      SEEDING_ERROR_CODE.SNAPSHOT_REQUIRED,
      "snapshotProvenance.snapshotId is required"
    );
  }
}

/**
 * Assignments must remain positive unique integers with unique entryIds.
 * Does not reallocate — validation only.
 *
 * @param {Record<string, unknown>} result
 */
export function assertAssignmentInvariants(result) {
  const assignments = Array.isArray(result.orderedAssignments)
    ? result.orderedAssignments
    : null;
  if (!assignments) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "orderedAssignments must be an array"
    );
  }
  const seedSet = new Set();
  const entrySet = new Set();
  for (let i = 0; i < assignments.length; i += 1) {
    const a = /** @type {Record<string, unknown>} */ (assignments[i] || {});
    const seed = a.seedNumber;
    const entryId = a.entryId;
    if (
      typeof seed !== "number" ||
      !Number.isInteger(seed) ||
      seed < 1 ||
      !Number.isFinite(seed)
    ) {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_REQUEST,
        "assignment seedNumber must be a positive integer",
        { entryId, seedNumber: seed }
      );
    }
    if (entryId == null || String(entryId).trim() === "") {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_REQUEST,
        "assignment entryId is required"
      );
    }
    const entryKey = String(entryId);
    if (seedSet.has(seed)) {
      throwSeedingError(
        SEEDING_ERROR_CODE.DUPLICATE_SEED_NUMBER,
        "duplicate seedNumber in assignments",
        { seedNumber: seed }
      );
    }
    if (entrySet.has(entryKey)) {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_REQUEST,
        "duplicate entryId in assignments",
        { entryId: entryKey }
      );
    }
    seedSet.add(seed);
    entrySet.add(entryKey);
  }
}

/**
 * @param {Record<string, unknown>} result
 * @param {{ resultId: string, expectedResultVersion: unknown, expectedFingerprint: string }} expected
 */
export function assertResultIdentityMatch(result, expected) {
  if (String(result.resultId) !== String(expected.resultId)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "resultId does not match request",
      {
        resultId: result.resultId,
        expectedResultId: expected.resultId,
      }
    );
  }
  if (
    String(result.resultVersion) !== String(expected.expectedResultVersion)
  ) {
    throwSeedingError(
      SEEDING_ERROR_CODE.RESULT_VERSION_MISMATCH,
      "resultVersion does not match expectedResultVersion",
      {
        resultVersion: result.resultVersion,
        expectedResultVersion: expected.expectedResultVersion,
      }
    );
  }
  if (
    String(result.deterministicFingerprint) !==
    String(expected.expectedFingerprint)
  ) {
    throwSeedingError(
      SEEDING_ERROR_CODE.RESULT_FINGERPRINT_MISMATCH,
      "fingerprint does not match expectedFingerprint",
      {
        fingerprint: result.deterministicFingerprint,
        expectedFingerprint: expected.expectedFingerprint,
      }
    );
  }
}

/**
 * @param {unknown} timestamp
 * @returns {string|number}
 */
export function timestampWireValue(timestamp) {
  if (
    timestamp &&
    typeof timestamp === "object" &&
    "value" in /** @type {object} */ (timestamp)
  ) {
    return /** @type {{ value: string|number }} */ (timestamp).value;
  }
  return /** @type {string|number} */ (timestamp);
}

/**
 * @param {import('../domain/normalizeLifecycleAuthorizationDecision.js').LifecycleAuthorizationDecision} decision
 */
export function authorizationProvenanceFromDecision(decision) {
  return {
    decisionId: decision.decisionId,
    decision: decision.decision,
    lifecycleAction: decision.lifecycleAction,
    actorId: decision.actor.id,
    authorizationPolicyId: decision.authorizationPolicyId,
    authorizationPolicyVersion: decision.authorizationPolicyVersion,
    scopeKey: buildSeedingScopeKey(decision.scope),
  };
}

/**
 * Interpret findAuthoritativeByScope by stable identity fields — never by
 * object reference equality.
 *
 * allowedResultIds: resultIds that are permitted to be the current authoritative
 * FINALIZED document for this SeedingScope (e.g. the draft being finalized, or
 * the prior result during superseding).
 *
 * @param {{
 *   repositoryPort?: unknown,
 *   requireRepositoryPort?: boolean,
 *   checkAuthoritativeConflict?: boolean,
 *   scope: import('../domain/normalizeSeedingScope.js').SeedingScope,
 *   allowedResultIds?: ReadonlyArray<string|number>,
 * }} args
 * @returns {Record<string, unknown>|null}
 */
export function assertAuthoritativeResultSemantics(args) {
  const required =
    args.requireRepositoryPort === true ||
    args.checkAuthoritativeConflict === true;
  if (!required && args.repositoryPort == null) {
    return null;
  }
  const port = requireSeedingResultRepositoryPort(
    args.repositoryPort,
    required
  );
  if (!port) return null;

  if (!args.scope || typeof args.scope !== "object") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_SCOPE,
      "scope is required for authoritative-result checks"
    );
  }

  const expectedScopeKey = buildSeedingScopeKey(args.scope);
  const authoritative = invokeSeedingResultRepository(
    port,
    "findAuthoritativeByScope",
    [args.scope]
  );
  if (authoritative == null) return null;
  if (typeof authoritative !== "object" || Array.isArray(authoritative)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
      "findAuthoritativeByScope returned invalid value"
    );
  }

  const auth = /** @type {Record<string, unknown>} */ (authoritative);
  if (!auth.scope || typeof auth.scope !== "object") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_SCOPE,
      "authoritative result is missing scope"
    );
  }
  const authScopeKey = buildSeedingScopeKey(
    /** @type {import('../domain/normalizeSeedingScope.js').SeedingScope} */ (
      auth.scope
    )
  );
  if (authScopeKey !== expectedScopeKey) {
    throwSeedingError(
      SEEDING_ERROR_CODE.AUTHORITATIVE_RESULT_CONFLICT,
      "Authoritative repository result scope does not match requested SeedingScope",
      { expectedScopeKey, authoritativeScopeKey: authScopeKey }
    );
  }

  if (auth.finalizationState !== FINALIZATION_STATE.FINALIZED) {
    return auth;
  }

  const authId = String(auth.resultId);
  const allowed = Array.isArray(args.allowedResultIds)
    ? args.allowedResultIds.map((id) => String(id))
    : [];
  if (allowed.includes(authId)) {
    return auth;
  }

  throwSeedingError(
    SEEDING_ERROR_CODE.AUTHORITATIVE_RESULT_CONFLICT,
    "Another authoritative FINALIZED result exists for this SeedingScope",
    {
      authoritativeResultId: auth.resultId,
      authoritativeResultVersion: auth.resultVersion,
      allowedResultIds: allowed,
    }
  );
}

/**
 * @deprecated Prefer assertAuthoritativeResultSemantics.
 * @param {{
 *   repositoryPort?: unknown,
 *   requireRepositoryPort?: boolean,
 *   checkAuthoritativeConflict?: boolean,
 *   result: Record<string, unknown>,
 *   allowSameResultId?: boolean,
 *   allowedResultIds?: ReadonlyArray<string|number>,
 * }} args
 */
export function assertNoAuthoritativeConflict(args) {
  const allowed = Array.isArray(args.allowedResultIds)
    ? args.allowedResultIds.slice()
    : [];
  if (args.allowSameResultId === true && args.result) {
    allowed.push(/** @type {string|number} */ (args.result.resultId));
  }
  return assertAuthoritativeResultSemantics({
    repositoryPort: args.repositoryPort,
    requireRepositoryPort: args.requireRepositoryPort,
    checkAuthoritativeConflict: args.checkAuthoritativeConflict,
    scope: /** @type {import('../domain/normalizeSeedingScope.js').SeedingScope} */ (
      args.result.scope
    ),
    allowedResultIds: allowed,
  });
}

/**
 * @param {unknown} auditPort
 * @param {boolean} required
 * @param {ReadonlyArray<unknown>} events
 */
export function maybeAppendLifecycleEvents(auditPort, required, events) {
  if (auditPort == null && !required) {
    return events;
  }
  requireSeedingLifecycleAuditPort(auditPort, true);
  return appendLifecycleEventsThroughPort(
    /** @type {import('../ports/SeedingLifecycleAuditPort.js').SeedingLifecycleAuditPort} */ (
      auditPort
    ),
    events
  );
}
