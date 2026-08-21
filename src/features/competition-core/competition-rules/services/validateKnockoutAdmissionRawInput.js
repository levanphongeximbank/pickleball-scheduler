/**
 * Narrow raw-input integrity validation for knockout admission /
 * extended qualification fields.
 *
 * OMITTED → canonical default may apply (no issue here).
 * EXPLICIT VALID → normalization may apply.
 * EXPLICIT INVALID → MUST FAIL CLOSED (do not let enumOr / numeric
 * helpers erase the raw value before validation).
 *
 * Scope is limited to NEW admission / qualification extension fields.
 * Does not redesign historic Competition Rules normalization.
 */

import { COMPETITION_RULES_ERROR_CODE } from "../constants/errorCodes.js";
import {
  KNOCKOUT_ENTRY_ROUND,
  DIRECT_KNOCKOUT_ENTRY_SOURCE,
  BYE_POLICY,
  KNOCKOUT_BYE_ALLOCATION_SHAPE,
} from "../constants/enums.js";

function issue(code, message, details = {}) {
  return Object.freeze({ code, message, details: Object.freeze({ ...details }) });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(obj, key) {
  return isPlainObject(obj) && Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Explicit positive integer (1..). Rejects floats, strings that are not
 * decimal integers, negatives, zero, NaN, Infinity.
 * @param {unknown} value
 * @returns {boolean}
 */
function isExplicitPositiveInt(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 1;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const t = value.trim();
    if (!/^\d+$/.test(t)) return false;
    const n = Number(t);
    return Number.isInteger(n) && n >= 1;
  }
  return false;
}

/**
 * Explicit non-negative integer (0..).
 * @param {unknown} value
 * @returns {boolean}
 */
function isExplicitNonNegInt(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const t = value.trim();
    if (!/^\d+$/.test(t)) return false;
    const n = Number(t);
    return Number.isInteger(n) && n >= 0;
  }
  return false;
}

/**
 * @param {unknown} value
 * @param {Record<string, string>} allowed
 * @returns {boolean}
 */
function isExplicitEnumMember(value, allowed) {
  if (value == null) return false;
  const raw = String(value).trim().toUpperCase();
  return Object.values(allowed).includes(raw);
}

/**
 * Resolve canonical entry identity from an explicit entrant element.
 * Returns null when identity cannot be resolved (caller must reject).
 * @param {unknown} raw
 * @returns {{ entryId: string }|null}
 */
function resolveExplicitEntrantIdentity(raw) {
  if (typeof raw === "string") {
    const entryId = raw.trim();
    return entryId ? { entryId } : null;
  }
  if (!isPlainObject(raw)) return null;
  if (
    raw.displayName != null &&
    raw.entryId == null &&
    raw.participantId == null
  ) {
    return null;
  }
  const entryId = String(raw.entryId ?? raw.participantId ?? "").trim();
  return entryId ? { entryId } : null;
}

/**
 * Validate explicitly supplied knockout admission / qualification raw fields.
 * @param {unknown} raw
 * @returns {ReadonlyArray<{ code: string, message: string, details: object }>}
 */
export function validateKnockoutAdmissionRawInput(raw) {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return Object.freeze([]);
  }

  /** @type {Array<{ code: string, message: string, details: object }>} */
  const issues = [];

  // --- qualification extended fields ---
  if (hasOwn(raw, "qualification") && raw.qualification != null) {
    if (!isPlainObject(raw.qualification)) {
      issues.push(
        issue(
          COMPETITION_RULES_ERROR_CODE.INVALID_QUALIFICATION,
          "qualification must be a plain object when supplied",
          { qualification: raw.qualification }
        )
      );
    } else {
      const q = raw.qualification;
      if (hasOwn(q, "totalKnockoutSlots")) {
        if (!isExplicitPositiveInt(q.totalKnockoutSlots)) {
          issues.push(
            issue(
              COMPETITION_RULES_ERROR_CODE.INVALID_QUALIFICATION,
              "qualification.totalKnockoutSlots must be a positive integer when supplied",
              { totalKnockoutSlots: q.totalKnockoutSlots }
            )
          );
        }
      }
      if (hasOwn(q, "totalQualifiers")) {
        if (!isExplicitPositiveInt(q.totalQualifiers)) {
          issues.push(
            issue(
              COMPETITION_RULES_ERROR_CODE.INVALID_QUALIFICATION,
              "qualification.totalQualifiers must be a positive integer when supplied",
              { totalQualifiers: q.totalQualifiers }
            )
          );
        }
      }
      if (hasOwn(q, "directKnockoutEntryCount")) {
        if (!isExplicitNonNegInt(q.directKnockoutEntryCount)) {
          issues.push(
            issue(
              COMPETITION_RULES_ERROR_CODE.INVALID_QUALIFICATION,
              "qualification.directKnockoutEntryCount must be a non-negative integer when supplied",
              { directKnockoutEntryCount: q.directKnockoutEntryCount }
            )
          );
        }
      }
      if (hasOwn(q, "directQualifiersPerGroup")) {
        if (!isExplicitNonNegInt(q.directQualifiersPerGroup)) {
          issues.push(
            issue(
              COMPETITION_RULES_ERROR_CODE.INVALID_QUALIFICATION,
              "qualification.directQualifiersPerGroup must be a non-negative integer when supplied",
              { directQualifiersPerGroup: q.directQualifiersPerGroup }
            )
          );
        }
      }
    }
  }

  // --- knockoutAdmission ---
  if (!hasOwn(raw, "knockoutAdmission")) {
    return Object.freeze(issues);
  }
  if (raw.knockoutAdmission == null) {
    return Object.freeze(issues);
  }
  if (!isPlainObject(raw.knockoutAdmission)) {
    issues.push(
      issue(
        COMPETITION_RULES_ERROR_CODE.INVALID_KNOCKOUT_ADMISSION,
        "knockoutAdmission must be a plain object when supplied",
        { knockoutAdmission: raw.knockoutAdmission }
      )
    );
    return Object.freeze(issues);
  }

  const admission = raw.knockoutAdmission;

  // groupStageBypass
  if (hasOwn(admission, "groupStageBypass") && admission.groupStageBypass != null) {
    if (!isPlainObject(admission.groupStageBypass)) {
      issues.push(
        issue(
          COMPETITION_RULES_ERROR_CODE.INVALID_GROUP_STAGE_BYPASS,
          "knockoutAdmission.groupStageBypass must be a plain object when supplied",
          {}
        )
      );
    } else {
      const bypass = admission.groupStageBypass;
      if (hasOwn(bypass, "enabled") && typeof bypass.enabled !== "boolean") {
        issues.push(
          issue(
            COMPETITION_RULES_ERROR_CODE.INVALID_GROUP_STAGE_BYPASS,
            "knockoutAdmission.groupStageBypass.enabled must be boolean when supplied",
            { enabled: bypass.enabled }
          )
        );
      }
      if (hasOwn(bypass, "entrants")) {
        if (!Array.isArray(bypass.entrants)) {
          issues.push(
            issue(
              COMPETITION_RULES_ERROR_CODE.INVALID_GROUP_STAGE_BYPASS,
              "knockoutAdmission.groupStageBypass.entrants must be an array when supplied",
              {}
            )
          );
        } else {
          bypass.entrants.forEach((item, index) => {
            issues.push(
              ...validateExplicitEntrantElement(item, {
                path: `knockoutAdmission.groupStageBypass.entrants[${index}]`,
                requireSource: false,
                requireTargetStage: false,
              })
            );
          });
        }
      }
    }
  }

  // directKnockoutEntry
  if (
    hasOwn(admission, "directKnockoutEntry") &&
    admission.directKnockoutEntry != null
  ) {
    if (!isPlainObject(admission.directKnockoutEntry)) {
      issues.push(
        issue(
          COMPETITION_RULES_ERROR_CODE.INVALID_DIRECT_KNOCKOUT_ENTRY,
          "knockoutAdmission.directKnockoutEntry must be a plain object when supplied",
          {}
        )
      );
    } else {
      const direct = admission.directKnockoutEntry;
      if (hasOwn(direct, "enabled") && typeof direct.enabled !== "boolean") {
        issues.push(
          issue(
            COMPETITION_RULES_ERROR_CODE.INVALID_DIRECT_KNOCKOUT_ENTRY,
            "knockoutAdmission.directKnockoutEntry.enabled must be boolean when supplied",
            { enabled: direct.enabled }
          )
        );
      }
      if (hasOwn(direct, "count") && !isExplicitNonNegInt(direct.count)) {
        issues.push(
          issue(
            COMPETITION_RULES_ERROR_CODE.INVALID_DIRECT_KNOCKOUT_ENTRY,
            "knockoutAdmission.directKnockoutEntry.count must be a non-negative integer when supplied",
            { count: direct.count }
          )
        );
      }
      if (
        hasOwn(direct, "sourceCategory") &&
        !isExplicitEnumMember(direct.sourceCategory, DIRECT_KNOCKOUT_ENTRY_SOURCE)
      ) {
        issues.push(
          issue(
            COMPETITION_RULES_ERROR_CODE.INVALID_DIRECT_KNOCKOUT_ENTRY,
            "knockoutAdmission.directKnockoutEntry.sourceCategory is invalid when supplied",
            { sourceCategory: direct.sourceCategory }
          )
        );
      }
      if (
        hasOwn(direct, "targetStage") &&
        !isExplicitEnumMember(direct.targetStage, KNOCKOUT_ENTRY_ROUND)
      ) {
        issues.push(
          issue(
            COMPETITION_RULES_ERROR_CODE.INVALID_DIRECT_KNOCKOUT_ENTRY,
            "knockoutAdmission.directKnockoutEntry.targetStage is invalid when supplied",
            { targetStage: direct.targetStage }
          )
        );
      }
      if (hasOwn(direct, "entrants")) {
        if (!Array.isArray(direct.entrants)) {
          issues.push(
            issue(
              COMPETITION_RULES_ERROR_CODE.INVALID_DIRECT_KNOCKOUT_ENTRY,
              "knockoutAdmission.directKnockoutEntry.entrants must be an array when supplied",
              {}
            )
          );
        } else {
          direct.entrants.forEach((item, index) => {
            issues.push(
              ...validateExplicitEntrantElement(item, {
                path: `knockoutAdmission.directKnockoutEntry.entrants[${index}]`,
                requireSource: false,
                requireTargetStage: false,
                allowSeedNumber: true,
              })
            );
          });
        }
      }
    }
  }

  // bye
  if (hasOwn(admission, "bye") && admission.bye != null) {
    if (!isPlainObject(admission.bye)) {
      issues.push(
        issue(
          COMPETITION_RULES_ERROR_CODE.INVALID_BYE_POLICY,
          "knockoutAdmission.bye must be a plain object when supplied",
          {}
        )
      );
    } else {
      const bye = admission.bye;
      if (
        hasOwn(bye, "byePolicy") &&
        !isExplicitEnumMember(bye.byePolicy, BYE_POLICY)
      ) {
        issues.push(
          issue(
            COMPETITION_RULES_ERROR_CODE.INVALID_BYE_POLICY,
            "knockoutAdmission.bye.byePolicy is invalid when supplied",
            { byePolicy: bye.byePolicy }
          )
        );
      }
      if (hasOwn(bye, "allocationShape")) {
        // Explicit null is allowed (dormant). Explicit invalid string/object rejects.
        if (
          bye.allocationShape != null &&
          !isExplicitEnumMember(bye.allocationShape, KNOCKOUT_BYE_ALLOCATION_SHAPE)
        ) {
          issues.push(
            issue(
              COMPETITION_RULES_ERROR_CODE.INVALID_BYE_POLICY,
              "knockoutAdmission.bye.allocationShape is invalid when supplied",
              { allocationShape: bye.allocationShape }
            )
          );
        }
      }
    }
  }

  return Object.freeze(issues);
}

/**
 * @param {unknown} item
 * @param {{
 *   path: string,
 *   requireSource?: boolean,
 *   requireTargetStage?: boolean,
 *   allowSeedNumber?: boolean,
 * }} opts
 */
function validateExplicitEntrantElement(item, opts) {
  /** @type {Array<{ code: string, message: string, details: object }>} */
  const issues = [];
  const path = opts.path;

  if (isPlainObject(item) && hasOwn(item, "displayName")) {
    const hasCanonical =
      (hasOwn(item, "entryId") && String(item.entryId || "").trim() !== "") ||
      (hasOwn(item, "participantId") &&
        String(item.participantId || "").trim() !== "");
    if (!hasCanonical) {
      issues.push(
        issue(
          COMPETITION_RULES_ERROR_CODE.DISPLAY_NAME_IDENTITY_FORBIDDEN,
          `${path}: displayName is not a canonical entrant identity`,
          { displayName: item.displayName, path }
        )
      );
      return issues;
    }
  }

  const identity = resolveExplicitEntrantIdentity(item);
  if (!identity) {
    issues.push(
      issue(
        COMPETITION_RULES_ERROR_CODE.MISSING_ENTRANT_IDENTITY,
        `${path}: canonical entryId (or participantId synonym) required`,
        { entrant: item, path }
      )
    );
    return issues;
  }

  if (!isPlainObject(item)) {
    // string entrant ref — identity already validated
    return issues;
  }

  if (
    hasOwn(item, "sourceCategory") &&
    !isExplicitEnumMember(item.sourceCategory, DIRECT_KNOCKOUT_ENTRY_SOURCE)
  ) {
    issues.push(
      issue(
        COMPETITION_RULES_ERROR_CODE.INVALID_DIRECT_KNOCKOUT_ENTRY,
        `${path}.sourceCategory is invalid when supplied`,
        { sourceCategory: item.sourceCategory, path }
      )
    );
  }

  if (
    hasOwn(item, "targetStage") &&
    !isExplicitEnumMember(item.targetStage, KNOCKOUT_ENTRY_ROUND)
  ) {
    issues.push(
      issue(
        COMPETITION_RULES_ERROR_CODE.INVALID_DIRECT_KNOCKOUT_ENTRY,
        `${path}.targetStage is invalid when supplied`,
        { targetStage: item.targetStage, path }
      )
    );
  }

  if (opts.allowSeedNumber && hasOwn(item, "seedNumber")) {
    if (!isExplicitNonNegInt(item.seedNumber)) {
      issues.push(
        issue(
          COMPETITION_RULES_ERROR_CODE.INVALID_KNOCKOUT_ADMISSION,
          `${path}.seedNumber must be a non-negative integer when supplied`,
          { seedNumber: item.seedNumber, path }
        )
      );
    }
  }

  return issues;
}
