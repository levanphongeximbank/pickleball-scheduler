/**
 * Explicit read-only legacy tournament → CM-04 configuration projector.
 *
 * Partial projection only. No write to legacy objects.
 * No full safe mapping of the entire settings blob.
 */

import {
  COMPETITION_CONFIGURATION_SECTION,
} from "../constants/sectionTypes.js";
import {
  COMPETITION_CONFIGURATION_OFFICIAL_MODE_VALUES,
  isCompetitionConfigurationOfficialMode,
} from "../constants/officialMode.js";
import { COMPETITION_CONFIGURATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createFieldError,
  validationOk,
  validationFail,
  snapshotInput,
} from "../contracts/validation.js";
import { deepFreeze, clonePlain, isNonEmptyString } from "../contracts/shared.js";

export const LEGACY_CONFIGURATION_COMPATIBILITY = Object.freeze({
  mode: "partial-projection",
  writesLegacy: false,
  fullSafeMapping: false,
  note:
    "no safe full legacy configuration mapping — only explicit field projections with typed issues for ambiguous/unsupported fields",
});

/**
 * Project legacy tournament blob fragments into CM-04 section proposals.
 *
 * Requires explicit tenantId + competitionId (never inferred).
 *
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   legacyTournament: object,
 * }} command
 * @returns {import("../contracts/validation.js").CompetitionConfigurationValidationResult}
 */
export function projectLegacyTournamentToConfigurationSections(command = {}) {
  const snap = snapshotInput(command);
  void snap;

  /** @type {object[]} */
  const errors = [];
  /** @type {object[]} */
  const issues = [];
  const cmd = command && typeof command === "object" ? command : {};

  if (!isNonEmptyString(cmd.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_CONFIGURATION_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required (never inferred from legacy blob)",
        {}
      )
    );
  }
  if (!isNonEmptyString(cmd.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_CONFIGURATION_ERROR_CODE.MISSING_COMPETITION,
        "explicit competitionId is required (never inferred from legacy blob)",
        {}
      )
    );
  }

  const raw = cmd.legacyTournament;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    errors.push(
      createFieldError(
        "legacyTournament",
        COMPETITION_CONFIGURATION_ERROR_CODE.MALFORMED_LEGACY_CONFIGURATION,
        "legacyTournament must be a plain object",
        {}
      )
    );
  }

  if (errors.length > 0) return validationFail(errors);

  /** @type {Record<string, object>} */
  const sections = {};
  const unsupportedFields = [];

  // officialMode — safe CM-04 mapping when valid
  if (Object.prototype.hasOwnProperty.call(raw, "officialMode")) {
    if (isCompetitionConfigurationOfficialMode(raw.officialMode)) {
      sections[COMPETITION_CONFIGURATION_SECTION.OFFICIAL_MODE] = {
        sectionId: COMPETITION_CONFIGURATION_SECTION.OFFICIAL_MODE,
        officialMode: raw.officialMode,
      };
    } else if (raw.officialMode != null) {
      issues.push(
        createFieldError(
          "legacyTournament.officialMode",
          COMPETITION_CONFIGURATION_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
          "officialMode value is not a known CM-04 official mode",
          {
            value: raw.officialMode,
            allowed: COMPETITION_CONFIGURATION_OFFICIAL_MODE_VALUES,
          }
        )
      );
    }
  }

  const settings =
    raw.settings && typeof raw.settings === "object" ? raw.settings : null;

  if (settings) {
    // registration window is CM-01 — do not project into CM-04
    if (settings.registration) {
      unsupportedFields.push({
        path: "settings.registration",
        reason: "owned_by_cm01_registration_window",
      });
    }

    // regulations / registrationPolicy copy → CM-05 branding territory
    if (settings.regulations) {
      unsupportedFields.push({
        path: "settings.regulations",
        reason: "deferred_to_cm05_branding",
      });
    }
    if (settings.registrationPolicy) {
      unsupportedFields.push({
        path: "settings.registrationPolicy",
        reason: "deferred_to_cm05_branding",
      });
    }

    // Runtime / execution artifacts — never configuration
    if (settings.aiBalance) {
      unsupportedFields.push({
        path: "settings.aiBalance",
        reason: "runtime_execution_artifact",
      });
    }
    if (settings.openDraw) {
      unsupportedFields.push({
        path: "settings.openDraw",
        reason: "runtime_execution_artifact",
      });
    }
  }

  // Team tournament settings nested under settings or top-level — ambiguous without
  // explicit product ownership assignment for rosterRules/dreambreaker etc.
  const teamSettingsCandidate =
    (settings && settings.teamTournament) ||
    raw.teamTournamentSettings ||
    null;
  if (teamSettingsCandidate && typeof teamSettingsCandidate === "object") {
    issues.push(
      createFieldError(
        "legacyTournament.teamTournamentSettings",
        COMPETITION_CONFIGURATION_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
        "team tournament settings cannot be safely mapped without explicit ownership assignment",
        { keys: Object.keys(teamSettingsCandidate).sort() }
      )
    );
  }

  // Fail closed on ambiguous mappings (typed issues become errors for projector)
  if (issues.length > 0) {
    return validationFail(issues);
  }

  return validationOk(
    deepFreeze({
      tenantId: String(cmd.tenantId).trim(),
      competitionId: String(cmd.competitionId).trim(),
      sections: clonePlain(sections),
      unsupportedFields: Object.freeze(
        unsupportedFields
          .map((f) => deepFreeze(f))
          .sort((a, b) => String(a.path).localeCompare(String(b.path), "en"))
      ),
      compatibility: LEGACY_CONFIGURATION_COMPATIBILITY,
    }),
    {
      summary: "Legacy tournament partially projected to CM-04 sections.",
      reasons: Object.freeze([
        `sectionCount=${Object.keys(sections).length}`,
        `unsupportedFieldCount=${unsupportedFields.length}`,
        "noFullSafeMapping",
        "legacyNotMutated",
      ]),
    }
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isLegacyConfigurationProjectionResult(value) {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    /** @type {any} */ (value).compatibility === LEGACY_CONFIGURATION_COMPATIBILITY
  );
}
