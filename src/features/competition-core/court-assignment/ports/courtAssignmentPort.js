/**
 * CORE-12 — CourtAssignmentPort (pure domain port + production factory).
 *
 * Canonical pure implementation: `assignCourtsDeterministic` (services/).
 * Port factory wires that implementation; it does not contain infrastructure.
 *
 * Test doubles live in `adapters/` and are NOT re-exported from the
 * capability-local production index.
 */

import {
  assignCourtsDeterministic,
} from "../services/assignCourtsDeterministic.js";
import { validateCourtAssignmentRequest } from "../services/validateCourtAssignmentRequest.js";
import { COURT_ASSIGNMENT_STATUS } from "../enums/status.js";
import { COURT_ASSIGNMENT_REJECTION_CODE } from "../enums/conflictCodes.js";
import {
  createCourtAssignmentConflict,
  createCourtAssignmentDiagnostics,
  createCourtAssignmentResult,
} from "../contracts/index.js";
import { CORE12_COURT_ASSIGNMENT_SCHEMA_V1, CORE12_ENGINE_VERSION } from "../constants/versions.js";
import { fingerprintValue } from "../deterministic/fingerprint.js";
import { CONFLICT_SEVERITY } from "../enums/constraintKind.js";

/**
 * @typedef {{
 *   assignCourts: (request: unknown) => object,
 *   validateRequest: (request: unknown) => object,
 * }} CourtAssignmentPort
 */

/**
 * Production port factory — pure, deterministic, no side effects.
 * @returns {CourtAssignmentPort}
 */
export function createCourtAssignmentPort() {
  return Object.freeze({
    assignCourts(request) {
      return assignCourtsDeterministic(request);
    },
    validateRequest(request) {
      return validateCourtAssignmentRequest(request);
    },
  });
}

/**
 * Fail-closed test double — always REJECTED. Not a production API.
 * @param {{ code?: string, message?: string }} [opts]
 * @returns {CourtAssignmentPort}
 */
export function createFailClosedCourtAssignmentPort(opts = {}) {
  const code =
    opts.code ?? COURT_ASSIGNMENT_REJECTION_CODE.INVALID_REQUEST;
  const message = opts.message ?? "Fail-closed court assignment port";
  return Object.freeze({
    assignCourts(request) {
      const obj =
        request && typeof request === "object"
          ? /** @type {Record<string, unknown>} */ (request)
          : {};
      const asId = (v, fallback) =>
        typeof v === "string" && v.trim() !== "" ? v.trim() : fallback;
      const scope = {
        requestId: asId(obj.requestId, "unknown-request"),
        tenantId: asId(obj.tenantId, "unknown-tenant"),
        clubId: asId(obj.clubId, "unknown-club"),
        venueId: asId(obj.venueId, "unknown-venue"),
        competitionId: asId(obj.competitionId, "unknown-competition"),
      };
      return createCourtAssignmentResult({
        schemaVersion: CORE12_COURT_ASSIGNMENT_SCHEMA_V1,
        status: COURT_ASSIGNMENT_STATUS.REJECTED,
        ...scope,
        assignments: [],
        unassigned: [],
        conflicts: [
          createCourtAssignmentConflict({
            conflictId: `reject:${code}`,
            code,
            severity: CONFLICT_SEVERITY.HARD,
            message,
          }),
        ],
        diagnostics: createCourtAssignmentDiagnostics({
          engineVersion: CORE12_ENGINE_VERSION,
          notes: ["Fail-closed test double"],
        }),
        resultFingerprint: fingerprintValue({
          status: COURT_ASSIGNMENT_STATUS.REJECTED,
          code,
          ...scope,
        }),
        failure: { code, message, details: {} },
        committable: false,
      });
    },
    validateRequest() {
      return {
        ok: false,
        code,
        message,
        details: {},
      };
    },
  });
}

/**
 * Fixed-result test double. Not a production API.
 * @param {object} fixedResult
 * @returns {CourtAssignmentPort}
 */
export function createFixedCourtAssignmentPort(fixedResult) {
  return Object.freeze({
    assignCourts() {
      return fixedResult;
    },
    validateRequest() {
      return { ok: true, request: null };
    },
  });
}
