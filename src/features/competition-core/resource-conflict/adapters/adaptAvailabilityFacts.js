/**
 * CORE-14 Phase 1F — dormant availability fact adapter (shape-only).
 * Translates caller-supplied availability answers into CORE-14 facts.
 * Does not import Venue & Court, inventory, operating hours, or bookings.
 */

import { EVALUATION_STATUS } from "../enums/evaluationStatus.js";
import { INPUT_DIAGNOSTIC_CODE, isInputDiagnosticCode } from "../enums/diagnosticCode.js";
import {
  AVAILABILITY_MODE,
  AVAILABILITY_CERTIFICATION,
} from "../enums/availabilityCertification.js";
import { createInputDiagnostic } from "../domain/InputDiagnostic.js";
import { serializeCanonicalResourceKey } from "../domain/CanonicalResourceKey.js";
import { createCanonicalResourceKey } from "../domain/CanonicalResourceKey.js";
import {
  AVAILABILITY_STATUS,
  isAvailabilityStatus,
  normalizeAvailabilityMode,
  deriveAvailabilityCertification,
} from "../policy/availabilityPolicy.js";
import { validateHalfOpenInterval } from "../time/interval.js";
import { compareUtf8Bytewise } from "../deterministic/compare.js";
import { createAdapterResult, createRejectedAdapterResult } from "./adapterResult.js";
import { optionalIdentity, requireSourceContractVersion } from "./shared.js";

/**
 * Map caller-supplied status aliases without converting UNKNOWN → AVAILABLE.
 * @param {unknown} status
 * @returns {string | null}
 */
function normalizeCallerStatus(status) {
  if (isAvailabilityStatus(status)) return /** @type {string} */ (status);
  if (status === "DATA_UNAVAILABLE") return AVAILABILITY_STATUS.UNKNOWN;
  if (status === "ERROR") return AVAILABILITY_STATUS.UNKNOWN;
  return null;
}

/**
 * @param {unknown} input
 * @returns {object} AdapterResult
 */
export function adaptAvailabilityAnswersToFacts(input) {
  const versionResult = requireSourceContractVersion(input);
  if (!versionResult.ok) {
    return createRejectedAdapterResult([versionResult.diagnostic], null);
  }
  const raw = /** @type {Record<string, unknown>} */ (input);
  const records = raw.records;
  if (!Array.isArray(records)) {
    return createRejectedAdapterResult(
      [
        createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.ADAPTER_RECORD_INVALID,
          message: "records must be an array",
          details: { fieldName: "records" },
        }),
      ],
      versionResult.value
    );
  }

  const modeResult = normalizeAvailabilityMode(raw.availabilityMode);
  if (!modeResult.ok) {
    return createRejectedAdapterResult(modeResult.diagnostics, versionResult.value);
  }
  const availabilityMode = modeResult.value;

  /** @type {object[]} */
  const facts = [];
  /** @type {object[]} */
  const diagnostics = [];
  let rejectedRecordCount = 0;
  let unknownCount = 0;
  let unavailableDataCount = 0;

  for (let i = 0; i < records.length; i += 1) {
    const path = `records[${i}]`;
    const record = records[i];
    if (record == null || typeof record !== "object" || Array.isArray(record)) {
      rejectedRecordCount += 1;
      diagnostics.push(
        createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.ADAPTER_RECORD_INVALID,
          message: "availability record must be an object",
          path,
          details: { recordIndex: i },
        })
      );
      continue;
    }
    const rec = /** @type {Record<string, unknown>} */ (record);

    let resourceKey;
    try {
      resourceKey = createCanonicalResourceKey(rec.resourceKey);
    } catch (err) {
      rejectedRecordCount += 1;
      const code =
        err && typeof err === "object" && isInputDiagnosticCode(err.code)
          ? err.code
          : INPUT_DIAGNOSTIC_CODE.RESOURCE_ID_MISSING;
      diagnostics.push(
        createInputDiagnostic({
          code,
          message: err && typeof err.message === "string" ? err.message : "invalid resourceKey",
          path,
          details: { reason: "AVAILABILITY_RESOURCE_KEY_INVALID" },
        })
      );
      continue;
    }

    const interval = validateHalfOpenInterval(rec.startMs ?? rec.evaluatedStartMs, rec.endMs ?? rec.evaluatedEndMs);
    if (!interval.ok) {
      rejectedRecordCount += 1;
      diagnostics.push(
        createInputDiagnostic({
          code:
            interval.reason === "TIME_WINDOW_MISSING"
              ? INPUT_DIAGNOSTIC_CODE.TIME_WINDOW_MISSING
              : INPUT_DIAGNOSTIC_CODE.INVALID_TIME_INTERVAL,
          message: "availability evaluation interval missing or invalid",
          path,
          details: {
            startMs: rec.startMs ?? rec.evaluatedStartMs ?? null,
            endMs: rec.endMs ?? rec.evaluatedEndMs ?? null,
          },
        })
      );
      continue;
    }

    const status = normalizeCallerStatus(rec.status);
    if (!status) {
      rejectedRecordCount += 1;
      diagnostics.push(
        createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
          message: "availability status must be AVAILABLE | UNAVAILABLE | UNKNOWN | DATA_UNAVAILABLE",
          path,
          details: { status: rec.status ?? null },
        })
      );
      continue;
    }

    if (status === AVAILABILITY_STATUS.UNKNOWN) {
      unknownCount += 1;
      unavailableDataCount += 1;
      diagnostics.push(
        createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.AVAILABILITY_DATA_UNAVAILABLE,
          message: "availability data unknown or unavailable; never treated as AVAILABLE",
          path,
          resourceKey,
          details: {
            status,
            availabilityMode,
            providerVersion: optionalIdentity(rec.providerVersion),
          },
        })
      );
    }

    const providerVersion =
      optionalIdentity(rec.providerVersion) ||
      optionalIdentity(raw.providerVersion) ||
      "caller-supplied-availability-v1";

    facts.push(
      Object.freeze({
        resourceKey,
        resourceKeyCanonical: serializeCanonicalResourceKey(resourceKey),
        occupancyId: optionalIdentity(rec.occupancyId),
        startMs: interval.startMs,
        endMs: interval.endMs,
        status,
        providerVersion,
        authoritative:
          typeof rec.authoritative === "boolean"
            ? rec.authoritative
            : availabilityMode === AVAILABILITY_MODE.AUTHORITATIVE,
      })
    );
  }

  facts.sort((a, b) => {
    const c1 = compareUtf8Bytewise(a.resourceKeyCanonical, b.resourceKeyCanonical);
    if (c1 !== 0) return c1;
    if (a.startMs !== b.startMs) return a.startMs < b.startMs ? -1 : 1;
    return compareUtf8Bytewise(a.status, b.status);
  });

  const certification = deriveAvailabilityCertification({
    availabilityCheckEnabled: records.length > 0,
    availabilityMode,
    authoritativeFailure:
      availabilityMode === AVAILABILITY_MODE.AUTHORITATIVE && unavailableDataCount > 0,
    queriedCount: facts.length,
    definitiveCount: facts.filter((f) => f.status !== AVAILABILITY_STATUS.UNKNOWN).length,
    unknownOrProviderFailureCount: unavailableDataCount,
  });

  let evaluationStatus = EVALUATION_STATUS.COMPLETED;
  if (records.length > 0 && facts.length === 0 && rejectedRecordCount > 0) {
    evaluationStatus = EVALUATION_STATUS.REJECTED_INVALID_INPUT;
  } else if (
    availabilityMode === AVAILABILITY_MODE.AUTHORITATIVE &&
    unavailableDataCount > 0
  ) {
    evaluationStatus = EVALUATION_STATUS.DATA_UNAVAILABLE;
  }

  return createAdapterResult({
    evaluationStatus,
    occupancies: [],
    normalizedAvailabilityFacts: facts,
    diagnostics,
    inputRecordCount: records.length,
    outputRecordCount: facts.length,
    rejectedRecordCount,
    sourceContractVersion: versionResult.value,
    metadata: {
      adapter: "adaptAvailabilityAnswersToFacts",
      availabilityMode,
      availabilityCertification: certification,
      unknownRemainsUnknown: true,
      inventoryRecreation: false,
      firstRecordScopeInference: false,
      partialAdaptation: rejectedRecordCount > 0 && facts.length > 0,
      unknownCount,
      // Future Integrator-owned Availability Port projects Venue answers here.
      adjacentContractNote: "ADJACENT_CONTRACT_SHAPE_ONLY",
    },
  });
}

export { AVAILABILITY_CERTIFICATION };
