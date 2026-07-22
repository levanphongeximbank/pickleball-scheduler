/**
 * CORE-10 Phase 1H — CandidateSourcePort contract.
 * Synchronous deterministic source boundary only.
 * No candidate generation algorithms, search, ranking, evaluation, budgets,
 * IO, timers, randomness, or orchestration entry-point invocation.
 * Raw producer remains private in a closure — not exposed as a property.
 */

import { CORE10_CANDIDATE_SOURCE_PORT_V1 } from "../constants/versions.js";
import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { compareStableString } from "../deterministic/compare.js";
import { isPlainObject } from "../deterministic/canonicalize.js";
import { createCandidateBatch } from "../contracts/candidateBatch.js";
import { rejectUnknownFields, requireStableId } from "../contracts/shared.js";

const FAIL = OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST;

const PORT_ALLOWED = Object.freeze(["portId", "portVersion", "produce"]);

const FIXED_PORT_ALLOWED = Object.freeze([
  "portId",
  "portVersion",
  "batch",
]);

const PORT_PUBLIC_KEYS = Object.freeze(["portId", "portVersion", "produce"]);

/**
 * @param {object} obj
 * @param {string} key
 * @returns {unknown}
 */
function ownValue(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isThenable(value) {
  return (
    value != null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof /** @type {{ then?: unknown }} */ (value).then === "function"
  );
}

/**
 * Rebuild a createCandidateBatch partial from an already-validated batch.
 * Always allocates fresh nested structures so produce() never aliases output.
 *
 * @param {Readonly<object>} batch
 * @returns {object}
 */
function batchToPartial(batch) {
  /** @type {object} */
  const partial = {
    candidates: /** @type {ReadonlyArray<object>} */ (batch.candidates).map(
      (candidate) => ({
        candidateId: candidate.candidateId,
        assignments: /** @type {ReadonlyArray<object>} */ (
          candidate.assignments
        ).map((assignment) => ({
          variableId: assignment.variableId,
          valueId: assignment.valueId,
        })),
      })
    ),
    decisionVariables: /** @type {ReadonlyArray<unknown>} */ (
      batch.decisionVariables
    ).map((dv) => {
      if (!isPlainObject(dv)) return dv;
      const domainRaw = ownValue(/** @type {object} */ (dv), "domain");
      return {
        variableId: ownValue(/** @type {object} */ (dv), "variableId"),
        domain: Array.isArray(domainRaw) ? domainRaw.slice() : domainRaw,
        required: ownValue(/** @type {object} */ (dv), "required"),
      };
    }),
    objectiveExecutionSpecs: /** @type {ReadonlyArray<unknown>} */ (
      batch.objectiveExecutionSpecs
    ).map((spec) =>
      isPlainObject(spec) ? { .../** @type {object} */ (spec) } : spec
    ),
    authorityValues: /** @type {ReadonlyArray<unknown>} */ (
      batch.authorityValues
    ).slice(),
  };
  if (Object.prototype.hasOwnProperty.call(batch, "context")) {
    const context = /** @type {object} */ (batch.context);
    const snapshotRefsRaw = ownValue(context, "snapshotRefs");
    const metadataRaw = ownValue(context, "metadata");
    partial.context = {
      tenantId: ownValue(context, "tenantId"),
      competitionId: ownValue(context, "competitionId"),
      snapshotRefs: Array.isArray(snapshotRefsRaw)
        ? snapshotRefsRaw.map((ref) =>
            ref && typeof ref === "object" && !Array.isArray(ref)
              ? {
                  snapshotId: /** @type {object} */ (ref).snapshotId,
                  snapshotVersion: /** @type {object} */ (ref).snapshotVersion,
                  fingerprint: /** @type {object} */ (ref).fingerprint,
                  kind: /** @type {object} */ (ref).kind,
                }
              : ref
          )
        : snapshotRefsRaw,
      metadata:
        metadataRaw &&
        typeof metadataRaw === "object" &&
        !Array.isArray(metadataRaw)
          ? { .../** @type {object} */ (metadataRaw) }
          : metadataRaw,
    };
  }
  return partial;
}

/**
 * Internal / public guard for CandidateSourcePort wrappers.
 * @param {unknown} port
 * @returns {boolean}
 */
export function isCandidateSourcePort(port) {
  if (port == null || typeof port !== "object" || Array.isArray(port)) {
    return false;
  }
  if (!Object.isFrozen(port)) return false;
  const expectedKeys = [...PORT_PUBLIC_KEYS].sort(compareStableString);
  const keys = Object.keys(/** @type {object} */ (port)).sort(
    compareStableString
  );
  if (keys.length !== expectedKeys.length) return false;
  for (let i = 0; i < expectedKeys.length; i += 1) {
    if (keys[i] !== expectedKeys[i]) return false;
  }
  const portId = ownValue(/** @type {object} */ (port), "portId");
  const portVersion = ownValue(/** @type {object} */ (port), "portVersion");
  const produce = ownValue(/** @type {object} */ (port), "produce");
  return (
    typeof portId === "string" &&
    portId.trim() !== "" &&
    typeof portVersion === "string" &&
    portVersion.trim() !== "" &&
    typeof produce === "function"
  );
}

/**
 * Create a frozen CandidateSourcePort wrapping a synchronous producer.
 * The raw producer is closed over and is not exposed as a port property.
 *
 * produce(request, sourceContext) → CandidateBatch
 *
 * @param {object} [partial]
 * @returns {Readonly<{
 *   portId: string,
 *   portVersion: string,
 *   produce: (request?: unknown, sourceContext?: unknown) => Readonly<object>,
 * }>}
 */
export function createCandidateSourcePort(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateSourcePort must be a plain object",
      {}
    );
  }

  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    PORT_ALLOWED,
    "CandidateSourcePort",
    FAIL
  );

  const portId = requireStableId(
    ownValue(partial, "portId"),
    "CandidateSourcePort.portId",
    FAIL
  );
  const portVersion = requireStableId(
    ownValue(partial, "portVersion") ?? CORE10_CANDIDATE_SOURCE_PORT_V1,
    "CandidateSourcePort.portVersion",
    FAIL
  );

  const producer = ownValue(partial, "produce");
  if (typeof producer !== "function") {
    throw new OptimizerContractError(
      FAIL,
      "CandidateSourcePort.produce must be a function",
      { portId }
    );
  }

  /**
   * Controlled produce method — not the raw producer reference.
   * @param {unknown} [request]
   * @param {unknown} [sourceContext]
   */
  function produce(request, sourceContext) {
    if (isThenable(request)) {
      throw new OptimizerContractError(
        FAIL,
        "CandidateSourcePort.produce request must not be a Promise/thenable",
        { portId, portVersion }
      );
    }
    if (isThenable(sourceContext)) {
      throw new OptimizerContractError(
        FAIL,
        "CandidateSourcePort.produce sourceContext must not be a Promise/thenable",
        { portId, portVersion }
      );
    }

    let rawResult;
    try {
      rawResult = /** @type {Function} */ (producer)(request, sourceContext);
    } catch (err) {
      if (err instanceof OptimizerContractError) {
        throw err;
      }
      throw new OptimizerContractError(
        FAIL,
        "Candidate source port threw an exception",
        { portId, portVersion }
      );
    }

    if (isThenable(rawResult)) {
      throw new OptimizerContractError(
        FAIL,
        "Async candidate source ports are unsupported in Phase 1H",
        { portId, portVersion }
      );
    }

    return createCandidateBatch(rawResult);
  }

  return Object.freeze({
    portId,
    portVersion,
    produce,
  });
}

/**
 * Fixed / supplied Candidate Source helper for tests and deterministic doubles.
 * Wraps a pre-validated CandidateBatch and returns a fresh immutable batch
 * on every produce() call. No strategy or domain behavior.
 *
 * @param {object} [partial]
 * @returns {Readonly<{
 *   portId: string,
 *   portVersion: string,
 *   produce: (request?: unknown, sourceContext?: unknown) => Readonly<object>,
 * }>}
 */
export function createFixedCandidateSourcePort(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new OptimizerContractError(
      FAIL,
      "FixedCandidateSourcePort must be a plain object",
      {}
    );
  }

  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    FIXED_PORT_ALLOWED,
    "FixedCandidateSourcePort",
    FAIL
  );

  const portId = requireStableId(
    ownValue(partial, "portId"),
    "FixedCandidateSourcePort.portId",
    FAIL
  );
  const portVersion = requireStableId(
    ownValue(partial, "portVersion") ?? CORE10_CANDIDATE_SOURCE_PORT_V1,
    "FixedCandidateSourcePort.portVersion",
    FAIL
  );

  if (!Object.prototype.hasOwnProperty.call(partial, "batch")) {
    throw new OptimizerContractError(
      FAIL,
      "FixedCandidateSourcePort.batch is required",
      { portId }
    );
  }

  const template = createCandidateBatch(ownValue(partial, "batch"));

  return createCandidateSourcePort({
    portId,
    portVersion,
    produce() {
      return batchToPartial(template);
    },
  });
}
