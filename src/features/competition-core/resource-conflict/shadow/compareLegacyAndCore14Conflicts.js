/**
 * CORE-14 Phase 1F — shadow parity comparison (diagnostic only).
 * Does not alter CORE-14 plan status or suppress findings.
 */

import { CORE14_SHADOW_PARITY_V1 } from "../constants/versions.js";
import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { createInputDiagnostic } from "../domain/InputDiagnostic.js";
import { compareUtf8Bytewise } from "../deterministic/compare.js";
import { fingerprintCore14Material } from "../deterministic/fingerprint.js";
import { isPlainObject } from "../deterministic/serialize.js";
import {
  mapLegacyConflictCodeToCore14,
  mapLegacyConflictsToCore14,
} from "../legacy/mapLegacyConflicts.js";
import { LEGACY_CC09_UNMAPPED_WORKFLOW_CODES } from "../legacy/legacyConflictCodes.js";

export const SHADOW_PARITY_CATEGORY = Object.freeze({
  MATCHED: "MATCHED",
  CORE14_ONLY: "CORE14_ONLY",
  LEGACY_ONLY: "LEGACY_ONLY",
  SEMANTIC_MISMATCH: "SEMANTIC_MISMATCH",
  UNMAPPABLE_LEGACY_CODE: "UNMAPPABLE_LEGACY_CODE",
  INSUFFICIENT_LEGACY_EVIDENCE: "INSUFFICIENT_LEGACY_EVIDENCE",
});

export const SHADOW_PARITY_CATEGORY_VALUES = Object.freeze(Object.values(SHADOW_PARITY_CATEGORY));

const WORKFLOW_SET = new Set(LEGACY_CC09_UNMAPPED_WORKFLOW_CODES);

/**
 * @param {object} legacyMapped
 * @param {object} core14Finding
 */
function evidenceKey(legacyMapped, core14Finding) {
  const resourceId =
    legacyMapped?.resourceId ??
    core14Finding?.resourceKey?.resourceId ??
    "";
  const activity =
    legacyMapped?.assignmentId ||
    legacyMapped?.activityId ||
    (core14Finding?.occupancyIds || []).join(",") ||
    "";
  const code = legacyMapped?.core14Code || core14Finding?.code || "";
  return `${code}|${resourceId}|${activity}`;
}

/**
 * @param {unknown} input
 */
export function compareLegacyAndCore14Conflicts(input) {
  if (!isPlainObject(input)) {
    return Object.freeze({
      shadowParityVersion: CORE14_SHADOW_PARITY_V1,
      categories: Object.freeze([]),
      core14PlanStatusUnchanged: true,
      core14FindingsSuppressed: false,
      diagnostics: Object.freeze([
        createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.ADAPTER_RECORD_INVALID,
          message: "shadow parity input must be a plain object",
        }),
      ]),
      deterministicFingerprint: fingerprintCore14Material({ shadow: "invalid" }),
      metadata: Object.freeze({ diagnosticOnly: true }),
    });
  }

  const core14Findings = Array.isArray(input.core14Findings) ? [...input.core14Findings] : [];
  const core14PlanStatus = input.core14PlanStatus ?? null;
  const legacyMapping = mapLegacyConflictsToCore14({
    conflicts: input.legacyConflicts,
    restMode: input.restMode,
  });

  /** @type {object[]} */
  const categories = [];
  /** @type {object[]} */
  const diagnostics = [...legacyMapping.diagnostics];

  /** @type {Set<number>} */
  const matchedLegacyIndexes = new Set();
  /** @type {Set<string>} */
  const matchedCore14Ids = new Set();

  // Unmappable / insufficient evidence from legacy side first.
  const rawLegacy = Array.isArray(input.legacyConflicts) ? input.legacyConflicts : [];
  for (let i = 0; i < rawLegacy.length; i += 1) {
    const legacy = rawLegacy[i];
    const legacyCode =
      typeof legacy?.code === "string" ? legacy.code : typeof legacy?.type === "string" ? legacy.type : "";
    if (WORKFLOW_SET.has(legacyCode) || !mapLegacyConflictCodeToCore14(legacyCode, { restMode: input.restMode }).mapped) {
      const mapResult = mapLegacyConflictCodeToCore14(legacyCode, { restMode: input.restMode });
      categories.push(
        Object.freeze({
          category: SHADOW_PARITY_CATEGORY.UNMAPPABLE_LEGACY_CODE,
          legacyCode,
          core14Code: null,
          legacyIndex: i,
          core14FindingId: null,
          reason: mapResult.unmappedReason,
        })
      );
      continue;
    }
    const hasInterval =
      Number.isSafeInteger(legacy?.startMs) &&
      Number.isSafeInteger(legacy?.endMs) &&
      legacy.startMs < legacy.endMs;
    if (!hasInterval) {
      // Slot-key alone is not interval parity proof.
      categories.push(
        Object.freeze({
          category: SHADOW_PARITY_CATEGORY.INSUFFICIENT_LEGACY_EVIDENCE,
          legacyCode,
          core14Code: mapLegacyConflictCodeToCore14(legacyCode, { restMode: input.restMode }).core14Code,
          legacyIndex: i,
          core14FindingId: null,
          reason: legacy?.slotKey
            ? "SLOT_KEY_WITHOUT_INTERVAL"
            : "INTERVAL_EVIDENCE_MISSING",
        })
      );
      diagnostics.push(
        createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.LEGACY_EVIDENCE_INSUFFICIENT,
          message: "legacy conflict lacks interval evidence for parity",
          details: {
            legacyCode,
            slotKey: legacy?.slotKey ?? null,
            startMs: legacy?.startMs ?? null,
            endMs: legacy?.endMs ?? null,
          },
        })
      );
    }
  }

  for (const mapped of legacyMapping.mapped) {
    const legacyRaw = rawLegacy[mapped.index];
    const hasInterval =
      Number.isSafeInteger(mapped.startMs) &&
      Number.isSafeInteger(mapped.endMs) &&
      mapped.startMs < mapped.endMs;
    if (!hasInterval) {
      // Already categorized as INSUFFICIENT above; skip match attempts.
      continue;
    }

    const candidates = core14Findings.filter((f) => f?.code === mapped.core14Code);
    let best = null;
    for (const f of candidates) {
      if (matchedCore14Ids.has(f.findingId)) continue;
      const sameResource =
        mapped.resourceId == null ||
        mapped.resourceId === f?.resourceKey?.resourceId;
      if (!sameResource) continue;
      const fStart = f?.evidence?.violationStartMs ?? f?.violationStartMs ?? null;
      const fEnd = f?.evidence?.violationEndMs ?? f?.violationEndMs ?? null;
      const intervalCompatible =
        !Number.isSafeInteger(fStart) ||
        !Number.isSafeInteger(fEnd) ||
        (mapped.startMs < fEnd && fStart < mapped.endMs);
      if (!intervalCompatible) {
        best = { finding: f, mismatch: true };
        continue;
      }
      const severityMismatch =
        mapped.severity != null &&
        f.severity != null &&
        mapped.severity !== f.severity;
      if (severityMismatch || (mapped.planBlocking === true && f.severity !== "HARD")) {
        best = { finding: f, mismatch: true };
        continue;
      }
      best = { finding: f, mismatch: false };
      break;
    }

    if (!best) {
      categories.push(
        Object.freeze({
          category: SHADOW_PARITY_CATEGORY.LEGACY_ONLY,
          legacyCode: mapped.legacyCode,
          core14Code: mapped.core14Code,
          legacyIndex: mapped.index,
          core14FindingId: null,
          evidenceKey: evidenceKey(mapped, null),
        })
      );
      continue;
    }

    matchedLegacyIndexes.add(mapped.index);
    matchedCore14Ids.add(best.finding.findingId);
    categories.push(
      Object.freeze({
        category: best.mismatch
          ? SHADOW_PARITY_CATEGORY.SEMANTIC_MISMATCH
          : SHADOW_PARITY_CATEGORY.MATCHED,
        legacyCode: mapped.legacyCode,
        core14Code: mapped.core14Code,
        legacyIndex: mapped.index,
        core14FindingId: best.finding.findingId,
        evidenceKey: evidenceKey(mapped, best.finding),
        slotKeyIgnoredAsIntervalProof: Boolean(legacyRaw?.slotKey),
      })
    );
  }

  for (const f of core14Findings) {
    if (matchedCore14Ids.has(f?.findingId)) continue;
    categories.push(
      Object.freeze({
        category: SHADOW_PARITY_CATEGORY.CORE14_ONLY,
        legacyCode: null,
        core14Code: f?.code ?? null,
        legacyIndex: null,
        core14FindingId: f?.findingId ?? null,
        evidenceKey: evidenceKey(null, f),
      })
    );
  }

  categories.sort((a, b) => {
    const c1 = compareUtf8Bytewise(a.category, b.category);
    if (c1 !== 0) return c1;
    const c2 = compareUtf8Bytewise(a.legacyCode ?? "", b.legacyCode ?? "");
    if (c2 !== 0) return c2;
    return compareUtf8Bytewise(a.core14FindingId ?? "", b.core14FindingId ?? "");
  });

  return Object.freeze({
    shadowParityVersion: CORE14_SHADOW_PARITY_V1,
    categories: Object.freeze(categories),
    counts: Object.freeze({
      MATCHED: categories.filter((c) => c.category === SHADOW_PARITY_CATEGORY.MATCHED).length,
      CORE14_ONLY: categories.filter((c) => c.category === SHADOW_PARITY_CATEGORY.CORE14_ONLY).length,
      LEGACY_ONLY: categories.filter((c) => c.category === SHADOW_PARITY_CATEGORY.LEGACY_ONLY).length,
      SEMANTIC_MISMATCH: categories.filter((c) => c.category === SHADOW_PARITY_CATEGORY.SEMANTIC_MISMATCH).length,
      UNMAPPABLE_LEGACY_CODE: categories.filter((c) => c.category === SHADOW_PARITY_CATEGORY.UNMAPPABLE_LEGACY_CODE)
        .length,
      INSUFFICIENT_LEGACY_EVIDENCE: categories.filter(
        (c) => c.category === SHADOW_PARITY_CATEGORY.INSUFFICIENT_LEGACY_EVIDENCE
      ).length,
    }),
    core14PlanStatus: core14PlanStatus,
    core14PlanStatusUnchanged: true,
    core14FindingsSuppressed: false,
    diagnostics: Object.freeze(diagnostics),
    deterministicFingerprint: fingerprintCore14Material({
      shadowParityVersion: CORE14_SHADOW_PARITY_V1,
      categories: categories.map((c) => ({
        category: c.category,
        legacyCode: c.legacyCode,
        core14Code: c.core14Code,
        core14FindingId: c.core14FindingId,
      })),
    }),
    metadata: Object.freeze({
      diagnosticOnly: true,
      doesNotAlterPlanStatus: true,
      doesNotSuppressCore14Findings: true,
    }),
  });
}
