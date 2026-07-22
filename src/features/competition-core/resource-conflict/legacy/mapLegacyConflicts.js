/**
 * CORE-14 Phase 1F — CC-09 ↔ CORE-14 compatibility mapping (semantics-equivalent only).
 */

import { CORE14_LEGACY_MAP_V1 } from "../constants/versions.js";
import { RESOURCE_FINDING_CODE } from "../enums/findingCode.js";
import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { REST_MODE } from "../policy/restPolicy.js";
import { createInputDiagnostic } from "../domain/InputDiagnostic.js";
import { compareUtf8Bytewise } from "../deterministic/compare.js";
import { fingerprintCore14Material } from "../deterministic/fingerprint.js";
import { isPlainObject } from "../deterministic/serialize.js";
import {
  LEGACY_CC09_CONFLICT_CODE,
  LEGACY_CC09_UNMAPPED_WORKFLOW_CODES,
} from "./legacyConflictCodes.js";

const WORKFLOW_SET = new Set(LEGACY_CC09_UNMAPPED_WORKFLOW_CODES);

const DIRECT_LEGACY_TO_CORE14 = Object.freeze({
  [LEGACY_CC09_CONFLICT_CODE.PLAYER_TIME_CONFLICT]: RESOURCE_FINDING_CODE.PLAYER_TIME_OVERLAP,
  [LEGACY_CC09_CONFLICT_CODE.TEAM_TIME_CONFLICT]: RESOURCE_FINDING_CODE.TEAM_TIME_OVERLAP,
  [LEGACY_CC09_CONFLICT_CODE.COURT_TIME_CONFLICT]: RESOURCE_FINDING_CODE.COURT_TIME_OVERLAP,
  [LEGACY_CC09_CONFLICT_CODE.REFEREE_TIME_CONFLICT]: RESOURCE_FINDING_CODE.REFEREE_TIME_OVERLAP,
  [LEGACY_CC09_CONFLICT_CODE.COURT_UNAVAILABLE]: RESOURCE_FINDING_CODE.RESOURCE_UNAVAILABLE,
  [LEGACY_CC09_CONFLICT_CODE.VENUE_UNAVAILABLE]: RESOURCE_FINDING_CODE.VENUE_UNAVAILABLE,
  [LEGACY_CC09_CONFLICT_CODE.VENUE_TIME_CONFLICT]: RESOURCE_FINDING_CODE.LOCATION_TIME_OVERLAP,
});

const DIRECT_CORE14_TO_LEGACY = Object.freeze({
  [RESOURCE_FINDING_CODE.PLAYER_TIME_OVERLAP]: LEGACY_CC09_CONFLICT_CODE.PLAYER_TIME_CONFLICT,
  [RESOURCE_FINDING_CODE.TEAM_TIME_OVERLAP]: LEGACY_CC09_CONFLICT_CODE.TEAM_TIME_CONFLICT,
  [RESOURCE_FINDING_CODE.COURT_TIME_OVERLAP]: LEGACY_CC09_CONFLICT_CODE.COURT_TIME_CONFLICT,
  [RESOURCE_FINDING_CODE.REFEREE_TIME_OVERLAP]: LEGACY_CC09_CONFLICT_CODE.REFEREE_TIME_CONFLICT,
  [RESOURCE_FINDING_CODE.RESOURCE_UNAVAILABLE]: LEGACY_CC09_CONFLICT_CODE.COURT_UNAVAILABLE,
  [RESOURCE_FINDING_CODE.VENUE_UNAVAILABLE]: LEGACY_CC09_CONFLICT_CODE.VENUE_UNAVAILABLE,
  [RESOURCE_FINDING_CODE.LOCATION_TIME_OVERLAP]: LEGACY_CC09_CONFLICT_CODE.VENUE_TIME_CONFLICT,
});

/**
 * @param {string} legacyCode
 * @param {{ restMode?: string | null }} [options]
 * @returns {{
 *   mapped: boolean,
 *   core14Code: string | null,
 *   unmappedReason: string | null,
 *   diagnostic: object | null,
 * }}
 */
export function mapLegacyConflictCodeToCore14(legacyCode, options = {}) {
  if (typeof legacyCode !== "string" || legacyCode.length === 0) {
    return {
      mapped: false,
      core14Code: null,
      unmappedReason: "EMPTY_CODE",
      diagnostic: createInputDiagnostic({
        code: INPUT_DIAGNOSTIC_CODE.LEGACY_CONFLICT_CODE_UNMAPPED,
        message: "legacy conflict code missing",
        details: { legacyCode: legacyCode ?? null },
      }),
    };
  }
  if (WORKFLOW_SET.has(legacyCode)) {
    return {
      mapped: false,
      core14Code: null,
      unmappedReason: "WORKFLOW_DIAGNOSTIC",
      diagnostic: createInputDiagnostic({
        code: INPUT_DIAGNOSTIC_CODE.LEGACY_CONFLICT_CODE_UNMAPPED,
        message: "legacy workflow/diagnostic code is not a CORE-14 resource conflict",
        details: { legacyCode, category: "WORKFLOW" },
      }),
    };
  }
  if (legacyCode === LEGACY_CC09_CONFLICT_CODE.INSUFFICIENT_REST) {
    const restMode = options.restMode;
    if (restMode === REST_MODE.MANDATORY) {
      return {
        mapped: true,
        core14Code: RESOURCE_FINDING_CODE.MANDATORY_REST_VIOLATION,
        unmappedReason: null,
        diagnostic: null,
      };
    }
    if (restMode === REST_MODE.PREFERRED) {
      return {
        mapped: true,
        core14Code: RESOURCE_FINDING_CODE.PREFERRED_REST_WARNING,
        unmappedReason: null,
        diagnostic: null,
      };
    }
    return {
      mapped: false,
      core14Code: null,
      unmappedReason: "REST_POLICY_UNKNOWN",
      diagnostic: createInputDiagnostic({
        code: INPUT_DIAGNOSTIC_CODE.LEGACY_CONFLICT_CODE_UNMAPPED,
        message: "INSUFFICIENT_REST requires known restMode (MANDATORY|PREFERRED)",
        details: { legacyCode, restMode: restMode ?? null },
      }),
    };
  }
  const direct = DIRECT_LEGACY_TO_CORE14[legacyCode];
  if (direct) {
    return { mapped: true, core14Code: direct, unmappedReason: null, diagnostic: null };
  }
  return {
    mapped: false,
    core14Code: null,
    unmappedReason: "UNKNOWN_LEGACY_CODE",
    diagnostic: createInputDiagnostic({
      code: INPUT_DIAGNOSTIC_CODE.LEGACY_CONFLICT_CODE_UNMAPPED,
      message: "legacy conflict code has no CORE-14 resource-conflict equivalent",
      details: { legacyCode },
    }),
  };
}

/**
 * @param {string} core14Code
 * @returns {{ mapped: boolean, legacyCode: string | null }}
 */
export function mapCore14FindingCodeToLegacy(core14Code) {
  if (core14Code === RESOURCE_FINDING_CODE.MANDATORY_REST_VIOLATION) {
    return { mapped: true, legacyCode: LEGACY_CC09_CONFLICT_CODE.INSUFFICIENT_REST };
  }
  if (core14Code === RESOURCE_FINDING_CODE.PREFERRED_REST_WARNING) {
    return { mapped: true, legacyCode: LEGACY_CC09_CONFLICT_CODE.INSUFFICIENT_REST };
  }
  const legacyCode = DIRECT_CORE14_TO_LEGACY[core14Code] || null;
  return { mapped: legacyCode != null, legacyCode };
}

/**
 * Normalize a batch of legacy conflicts for shadow parity / tests.
 * @param {unknown} input
 */
export function mapLegacyConflictsToCore14(input) {
  if (!isPlainObject(input)) {
    return Object.freeze({
      legacyMapVersion: CORE14_LEGACY_MAP_V1,
      mapped: Object.freeze([]),
      unmapped: Object.freeze([]),
      diagnostics: Object.freeze([
        createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.ADAPTER_RECORD_INVALID,
          message: "legacy mapping input must be a plain object",
        }),
      ]),
      deterministicFingerprint: fingerprintCore14Material({ legacyMap: "invalid" }),
    });
  }
  const conflicts = Array.isArray(input.conflicts) ? input.conflicts : [];
  const restMode = input.restMode ?? null;
  /** @type {object[]} */
  const mapped = [];
  /** @type {object[]} */
  const unmapped = [];
  /** @type {object[]} */
  const diagnostics = [];

  for (let i = 0; i < conflicts.length; i += 1) {
    const c = conflicts[i];
    const code = typeof c?.code === "string" ? c.code : typeof c?.type === "string" ? c.type : "";
    const result = mapLegacyConflictCodeToCore14(code, { restMode });
    if (!result.mapped) {
      if (result.diagnostic) diagnostics.push(result.diagnostic);
      unmapped.push(
        Object.freeze({
          index: i,
          legacyCode: code,
          reason: result.unmappedReason,
        })
      );
      continue;
    }
    mapped.push(
      Object.freeze({
        index: i,
        legacyCode: code,
        core14Code: result.core14Code,
        resourceId: c?.resourceId ?? c?.playerId ?? c?.teamId ?? c?.courtId ?? c?.refereeId ?? null,
        assignmentId: c?.assignmentId ?? null,
        activityId: c?.activityId ?? c?.matchId ?? null,
        startMs: Number.isSafeInteger(c?.startMs) ? c.startMs : null,
        endMs: Number.isSafeInteger(c?.endMs) ? c.endMs : null,
        severity: c?.severity ?? null,
        planBlocking: c?.planBlocking === true || c?.severity === "HARD",
        slotKey: c?.slotKey ?? null,
      })
    );
  }

  mapped.sort((a, b) => {
    const c1 = compareUtf8Bytewise(a.legacyCode, b.legacyCode);
    if (c1 !== 0) return c1;
    return compareUtf8Bytewise(String(a.resourceId ?? ""), String(b.resourceId ?? ""));
  });
  unmapped.sort((a, b) => compareUtf8Bytewise(a.legacyCode, b.legacyCode));

  return Object.freeze({
    legacyMapVersion: CORE14_LEGACY_MAP_V1,
    mapped: Object.freeze(mapped),
    unmapped: Object.freeze(unmapped),
    diagnostics: Object.freeze(diagnostics),
    deterministicFingerprint: fingerprintCore14Material({
      legacyMapVersion: CORE14_LEGACY_MAP_V1,
      mapped: mapped.map((m) => ({ legacyCode: m.legacyCode, core14Code: m.core14Code })),
      unmapped: unmapped.map((u) => ({ legacyCode: u.legacyCode, reason: u.reason })),
    }),
  });
}

/**
 * CORE-14 → legacy projection for compatibility tests only.
 * @param {unknown} input
 */
export function projectCore14FindingsToLegacy(input) {
  const findings = Array.isArray(input?.findings) ? input.findings : [];
  /** @type {object[]} */
  const projected = [];
  for (const f of findings) {
    const mapped = mapCore14FindingCodeToLegacy(f?.code);
    if (!mapped.mapped) continue;
    projected.push(
      Object.freeze({
        code: mapped.legacyCode,
        core14Code: f.code,
        findingId: f.findingId ?? null,
        severity: f.severity ?? null,
        resourceId: f.resourceKey?.resourceId ?? null,
      })
    );
  }
  projected.sort((a, b) => compareUtf8Bytewise(a.code, b.code));
  return Object.freeze({
    legacyMapVersion: CORE14_LEGACY_MAP_V1,
    conflicts: Object.freeze(projected),
  });
}
