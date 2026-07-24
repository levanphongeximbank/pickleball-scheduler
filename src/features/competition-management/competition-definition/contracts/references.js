/**
 * Reference value objects for Competition Definition (CM-01).
 * All are reference-only — CM-01 does not own venue/club/template/rule-set aggregates.
 */

import { COMPETITION_DEFINITION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  COMPETITION_OWNER_TYPE,
  isCompetitionOwnerType,
} from "../constants/ownerTypes.js";
import { createFieldError } from "./validation.js";
import { deepFreeze, isNonEmptyString } from "./shared.js";

/**
 * @typedef {Object} CompetitionOwnerReference
 * @property {string} ownerId
 * @property {string} ownerType
 */

/**
 * @typedef {Object} CompetitionVenueReference
 * @property {string} venueId
 */

/**
 * @typedef {Object} CompetitionClubReference
 * @property {string} clubId
 */

/**
 * @typedef {Object} CompetitionTemplateReference
 * @property {string} templateId
 */

/**
 * @typedef {Object} CompetitionRuleSetReference
 * @property {string} ruleSetId
 */

/**
 * @param {unknown} input
 * @param {string} [fieldPrefix]
 * @returns {{ value?: Readonly<CompetitionOwnerReference>, error?: import("./validation.js").CompetitionDefinitionFieldError }}
 */
export function parseOwnerReference(input, fieldPrefix = "owner") {
  if (!input || typeof input !== "object") {
    return {
      error: createFieldError(
        fieldPrefix,
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_OWNER_REFERENCE,
        "Owner/organizer reference is required and must be an object",
        {}
      ),
    };
  }
  const raw = /** @type {Record<string, unknown>} */ (input);
  if (!isNonEmptyString(raw.ownerId)) {
    return {
      error: createFieldError(
        `${fieldPrefix}.ownerId`,
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_OWNER_REFERENCE,
        "ownerId is required",
        {}
      ),
    };
  }
  if (!isCompetitionOwnerType(raw.ownerType)) {
    return {
      error: createFieldError(
        `${fieldPrefix}.ownerType`,
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_OWNER_REFERENCE,
        `ownerType must be one of: ${Object.values(COMPETITION_OWNER_TYPE).join(", ")}`,
        { value: raw.ownerType, allowed: Object.values(COMPETITION_OWNER_TYPE) }
      ),
    };
  }
  return {
    value: deepFreeze({
      ownerId: String(raw.ownerId).trim(),
      ownerType: String(raw.ownerType),
    }),
  };
}

/**
 * @param {unknown} input
 * @param {string} [fieldPrefix]
 * @returns {{ value?: Readonly<CompetitionVenueReference>, error?: import("./validation.js").CompetitionDefinitionFieldError }}
 */
export function parseVenueReference(input, fieldPrefix = "venues") {
  if (!input || typeof input !== "object") {
    return {
      error: createFieldError(
        fieldPrefix,
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_VENUE_REFERENCE,
        "Venue reference must be an object with venueId",
        {}
      ),
    };
  }
  const raw = /** @type {Record<string, unknown>} */ (input);
  if (!isNonEmptyString(raw.venueId)) {
    return {
      error: createFieldError(
        `${fieldPrefix}.venueId`,
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_VENUE_REFERENCE,
        "venueId is required",
        {}
      ),
    };
  }
  return {
    value: deepFreeze({ venueId: String(raw.venueId).trim() }),
  };
}

/**
 * @param {unknown} input
 * @param {string} [fieldPrefix]
 * @returns {{ value?: Readonly<CompetitionClubReference>, error?: import("./validation.js").CompetitionDefinitionFieldError }}
 */
export function parseClubReference(input, fieldPrefix = "clubs") {
  if (!input || typeof input !== "object") {
    return {
      error: createFieldError(
        fieldPrefix,
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_CLUB_REFERENCE,
        "Club reference must be an object with clubId",
        {}
      ),
    };
  }
  const raw = /** @type {Record<string, unknown>} */ (input);
  if (!isNonEmptyString(raw.clubId)) {
    return {
      error: createFieldError(
        `${fieldPrefix}.clubId`,
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_CLUB_REFERENCE,
        "clubId is required",
        {}
      ),
    };
  }
  return {
    value: deepFreeze({ clubId: String(raw.clubId).trim() }),
  };
}

/**
 * @param {unknown} input
 * @param {string} [field]
 * @returns {{ value?: Readonly<CompetitionTemplateReference>|null, error?: import("./validation.js").CompetitionDefinitionFieldError }}
 */
export function parseTemplateReference(input, field = "template") {
  if (input == null) return { value: null };
  if (typeof input !== "object") {
    return {
      error: createFieldError(
        field,
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_TEMPLATE_REFERENCE,
        "template reference must be an object with templateId",
        {}
      ),
    };
  }
  const raw = /** @type {Record<string, unknown>} */ (input);
  if (!isNonEmptyString(raw.templateId)) {
    return {
      error: createFieldError(
        `${field}.templateId`,
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_TEMPLATE_REFERENCE,
        "templateId is required when template is provided",
        {}
      ),
    };
  }
  return {
    value: deepFreeze({ templateId: String(raw.templateId).trim() }),
  };
}

/**
 * @param {unknown} input
 * @param {string} [field]
 * @returns {{ value?: Readonly<CompetitionRuleSetReference>|null, error?: import("./validation.js").CompetitionDefinitionFieldError }}
 */
export function parseRuleSetReference(input, field = "ruleSet") {
  if (input == null) return { value: null };
  if (typeof input !== "object") {
    return {
      error: createFieldError(
        field,
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_RULE_SET_REFERENCE,
        "ruleSet reference must be an object with ruleSetId",
        {}
      ),
    };
  }
  const raw = /** @type {Record<string, unknown>} */ (input);
  if (!isNonEmptyString(raw.ruleSetId)) {
    return {
      error: createFieldError(
        `${field}.ruleSetId`,
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_RULE_SET_REFERENCE,
        "ruleSetId is required when ruleSet is provided",
        {}
      ),
    };
  }
  return {
    value: deepFreeze({ ruleSetId: String(raw.ruleSetId).trim() }),
  };
}
