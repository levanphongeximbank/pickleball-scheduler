/**
 * CORE-14 Phase 1D — availability finding evaluation.
 * Pure detector over normalized availability facts (form A).
 * Optional narrow AvailabilityPort (form B) may be used by orchestration
 * to produce facts via test doubles only — no production adapter here.
 */

import { compareUtf8Bytewise } from "../deterministic/compare.js";
import { serializeCanonicalResourceKey } from "../domain/CanonicalResourceKey.js";
import { createResourceFinding } from "../domain/ResourceFinding.js";
import { createInputDiagnostic } from "../domain/InputDiagnostic.js";
import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { AVAILABILITY_MODE } from "../enums/availabilityCertification.js";
import {
  AVAILABILITY_POLICY_VERSION,
  AVAILABILITY_STATUS,
  isAvailabilityStatus,
  resolveUnavailableFindingCode,
} from "../policy/availabilityPolicy.js";

/**
 * @param {unknown} fact
 * @returns {{ ok: true, value: object } | { ok: false, diagnostic: object }}
 */
function normalizeAvailabilityFact(fact) {
  if (fact == null || typeof fact !== "object" || Array.isArray(fact)) {
    return {
      ok: false,
      diagnostic: createInputDiagnostic({
        code: INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
        message: "availability fact must be an object",
        details: { reason: "INVALID_AVAILABILITY_FACT" },
      }),
    };
  }
  const raw = /** @type {Record<string, unknown>} */ (fact);
  let resourceKeyCanonical;
  try {
    resourceKeyCanonical = serializeCanonicalResourceKey(raw.resourceKey);
  } catch {
    return {
      ok: false,
      diagnostic: createInputDiagnostic({
        code: INPUT_DIAGNOSTIC_CODE.UNKNOWN_RESOURCE_TYPE,
        message: "availability fact resourceKey invalid",
        details: { reason: "INVALID_AVAILABILITY_RESOURCE_KEY" },
      }),
    };
  }
  if (!isAvailabilityStatus(raw.status)) {
    return {
      ok: false,
      diagnostic: createInputDiagnostic({
        code: INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
        message: "availability status must be AVAILABLE | UNAVAILABLE | UNKNOWN",
        details: { status: raw.status ?? null, resourceKeyCanonical },
      }),
    };
  }
  const startMs = raw.startMs;
  const endMs = raw.endMs;
  if (
    typeof startMs !== "number" ||
    !Number.isSafeInteger(startMs) ||
    typeof endMs !== "number" ||
    !Number.isSafeInteger(endMs) ||
    startMs >= endMs
  ) {
    return {
      ok: false,
      diagnostic: createInputDiagnostic({
        code: INPUT_DIAGNOSTIC_CODE.INVALID_TIME_INTERVAL,
        message: "availability fact interval must be safe integers with startMs < endMs",
        details: { startMs: startMs ?? null, endMs: endMs ?? null, resourceKeyCanonical },
      }),
    };
  }
  const providerVersion =
    typeof raw.providerVersion === "string" && raw.providerVersion.length > 0
      ? raw.providerVersion
      : "availability-fact-v1";

  return {
    ok: true,
    value: Object.freeze({
      resourceKey: raw.resourceKey,
      resourceKeyCanonical,
      occupancyId: typeof raw.occupancyId === "string" ? raw.occupancyId : null,
      startMs,
      endMs,
      status: /** @type {string} */ (raw.status),
      providerVersion,
    }),
  };
}

/**
 * Evaluate normalized availability facts against occupancies.
 * Unknown is never treated as available.
 *
 * @param {readonly object[]} occupancies
 * @param {readonly object[]} availabilityFacts
 * @param {{
 *   availabilityMode: string,
 *   policyVersion?: string,
 * }} options
 * @returns {{
 *   findings: object[],
 *   diagnostics: object[],
 *   authoritativeFailure: boolean,
 *   queriedCount: number,
 *   definitiveCount: number,
 *   unknownOrProviderFailureCount: number,
 *   providerVersions: string[],
 * }}
 */
export function detectAvailabilityFindings(occupancies, availabilityFacts, options) {
  const mode = options.availabilityMode || AVAILABILITY_MODE.AUTHORITATIVE;
  const policyVersion = options.policyVersion || AVAILABILITY_POLICY_VERSION;
  const list = Array.isArray(occupancies) ? occupancies : [];
  const factsIn = Array.isArray(availabilityFacts) ? availabilityFacts : [];

  /** @type {Map<string, object>} */
  const factByOccupancyId = new Map();
  /** @type {Map<string, object[]>} */
  const factsByResource = new Map();
  /** @type {object[]} */
  const diagnostics = [];
  /** @type {Set<string>} */
  const providerVersions = new Set();

  for (const raw of factsIn) {
    const normalized = normalizeAvailabilityFact(raw);
    if (!normalized.ok) {
      diagnostics.push(normalized.diagnostic);
      continue;
    }
    const fact = normalized.value;
    providerVersions.add(fact.providerVersion);
    if (fact.occupancyId) {
      factByOccupancyId.set(fact.occupancyId, fact);
    }
    const arr = factsByResource.get(fact.resourceKeyCanonical) || [];
    arr.push(fact);
    factsByResource.set(fact.resourceKeyCanonical, arr);
  }

  /** @type {object[]} */
  const findings = [];
  let queriedCount = 0;
  let definitiveCount = 0;
  let unknownOrProviderFailureCount = 0;
  let authoritativeFailure = false;

  for (const occ of list) {
    queriedCount += 1;
    const canonical = serializeCanonicalResourceKey(occ.resourceKey);
    let fact = factByOccupancyId.get(occ.occupancyId) || null;
    if (!fact) {
      const candidates = factsByResource.get(canonical) || [];
      // Prefer fact whose interval covers the occupancy interval.
      fact =
        candidates.find(
          (f) => f.startMs <= occ.startMs && f.endMs >= occ.endMs
        ) || null;
    }

    if (!fact || fact.status === AVAILABILITY_STATUS.UNKNOWN) {
      unknownOrProviderFailureCount += 1;
      diagnostics.push(
        createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.AVAILABILITY_DATA_UNAVAILABLE,
          message: "Availability data unavailable or unknown for occupancy interval",
          occupancyId: occ.occupancyId,
          resourceKey: occ.resourceKey,
          details: {
            resourceKeyCanonical: canonical,
            startMs: occ.startMs,
            endMs: occ.endMs,
            availabilityMode: mode,
            status: fact ? fact.status : null,
          },
        })
      );
      if (mode === AVAILABILITY_MODE.AUTHORITATIVE) {
        authoritativeFailure = true;
      }
      // Never treat unknown/missing as available.
      continue;
    }

    definitiveCount += 1;
    if (fact.status === AVAILABILITY_STATUS.AVAILABLE) {
      continue;
    }

    // UNAVAILABLE
    const code = resolveUnavailableFindingCode(occ.resourceKey.resourceKind);
    findings.push(
      createResourceFinding({
        code,
        resourceKey: occ.resourceKey,
        occupancyIds: [occ.occupancyId],
        assignmentIds: [
          occ.assignmentId,
          occ.activityId,
          occ.matchId,
        ].filter((v) => typeof v === "string" && v.length > 0),
        violationStartMs: occ.startMs,
        violationEndMs: occ.endMs,
        policyVersion,
        availabilityMode: mode,
        evidence: Object.freeze({
          resourceKeyCanonical: canonical,
          occupancyId: occ.occupancyId,
          evaluatedStartMs: occ.startMs,
          evaluatedEndMs: occ.endMs,
          availabilityStatus: fact.status,
          availabilityMode: mode,
          providerVersion: fact.providerVersion,
          policyVersion,
        }),
      })
    );
  }

  return {
    findings,
    diagnostics,
    authoritativeFailure,
    queriedCount,
    definitiveCount,
    unknownOrProviderFailureCount,
    providerVersions: [...providerVersions].sort(compareUtf8Bytewise),
  };
}

/**
 * Narrow AvailabilityPort contract — for test doubles only.
 * Production Venue & Court adapters are out of Phase 1D scope.
 *
 * @typedef {{
 *   getResourceAvailability: (query: {
 *     resourceKey: object,
 *     startMs: number,
 *     endMs: number,
 *     occupancyId: string,
 *     requestId?: string | null,
 *   }) => {
 *     status: string,
 *     providerVersion: string,
 *   }
 * }} AvailabilityPort
 */

/**
 * Materialize normalized facts from an injected AvailabilityPort (test doubles).
 * Does not mutate the request or port answers beyond reading fields.
 *
 * @param {readonly object[]} occupancies
 * @param {AvailabilityPort} port
 * @param {{ requestId?: string | null }} [options]
 * @returns {object[]}
 */
export function materializeAvailabilityFactsFromPort(occupancies, port, options = {}) {
  const list = Array.isArray(occupancies) ? occupancies : [];
  /** @type {object[]} */
  const facts = [];
  for (const occ of list) {
    const answer = port.getResourceAvailability({
      resourceKey: occ.resourceKey,
      startMs: occ.startMs,
      endMs: occ.endMs,
      occupancyId: occ.occupancyId,
      requestId: options.requestId ?? null,
    });
    facts.push(
      Object.freeze({
        resourceKey: occ.resourceKey,
        occupancyId: occ.occupancyId,
        startMs: occ.startMs,
        endMs: occ.endMs,
        status: answer?.status,
        providerVersion:
          typeof answer?.providerVersion === "string" && answer.providerVersion.length > 0
            ? answer.providerVersion
            : "availability-port-v1",
      })
    );
  }
  return facts;
}
