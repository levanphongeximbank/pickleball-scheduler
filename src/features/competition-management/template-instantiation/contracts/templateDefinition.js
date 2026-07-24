/**
 * Canonical CompetitionTemplateDefinition contract (CM-02).
 *
 * Capability-local catalog entry. Does not own CM-01 CompetitionDefinition,
 * CORE execution, UI wizard state, or production persistence.
 */

import {
  COMPETITION_TYPE,
  COMPETITION_SCOPE,
  COMPETITION_VISIBILITY,
  COMPETITION_OWNER_TYPE,
  isCompetitionType,
  isCompetitionScope,
  isCompetitionVisibility,
  isCompetitionOwnerType,
} from "../../competition-definition/index.js";
import {
  COMPETITION_TEMPLATE_SCOPE,
  COMPETITION_TEMPLATE_AVAILABILITY,
  COMPETITION_TEMPLATE_NAME_MAX_LENGTH,
  COMPETITION_TEMPLATE_DESCRIPTION_MAX_LENGTH,
  COMPETITION_TEMPLATE_INITIAL_VERSION,
  isCompetitionTemplateScope,
  isCompetitionTemplateAvailability,
  isCompetitionTemplateParticipantMode,
  isCompetitionTemplateOwnershipTarget,
} from "../constants/index.js";
import { COMPETITION_TEMPLATE_ERROR_CODE } from "../errors/errorCodes.js";
import { createFieldError, validationOk, validationFail } from "./validation.js";
import { deepFreeze, isNonEmptyString, isPositiveInteger } from "./shared.js";

/**
 * @typedef {Object} CompetitionTemplateRequirements
 * @property {boolean} [requiresVenue]
 * @property {boolean} [requiresClub]
 * @property {readonly string[]} [allowedOwnerTypes]
 * @property {boolean} [requiresRegistrationWindow]
 * @property {boolean} [requiresPlannedPeriod]
 * @property {readonly string[]} [allowedVisibilities]
 * @property {readonly string[]} [requiredCapabilities]
 */

/**
 * @typedef {Object} CompetitionTemplateDefaults
 * @property {string|null} [visibility]
 * @property {{ ruleSetId: string }|null} [ruleSet]
 * @property {string|null} [divisionBlueprintId]
 * @property {string|null} [formatBlueprintId]
 * @property {string|null} [scheduleBlueprintId]
 * @property {string|null} [scoringBlueprintId]
 * @property {string|null} [standingsBlueprintId]
 * @property {object|null} [registrationDefaults]
 */

/**
 * @typedef {Object} CompetitionTemplateDefinition
 * @property {string} templateId
 * @property {number} templateVersion
 * @property {string} templateScope
 * @property {string|null} tenantId
 * @property {string} name
 * @property {string} description
 * @property {readonly string[]} supportedCompetitionTypes
 * @property {readonly string[]} supportedScopes
 * @property {string} participantMode
 * @property {string} availability
 * @property {CompetitionTemplateRequirements} requirements
 * @property {CompetitionTemplateDefaults} defaults
 * @property {readonly string[]} capabilityTags
 * @property {Record<string, unknown>} metadata
 */

/**
 * @param {unknown} input
 * @param {string} [fieldPrefix]
 * @returns {{ value?: Readonly<CompetitionTemplateRequirements>, errors: import("./validation.js").CompetitionTemplateFieldError[] }}
 */
export function parseTemplateRequirements(input, fieldPrefix = "requirements") {
  /** @type {import("./validation.js").CompetitionTemplateFieldError[]} */
  const errors = [];
  if (input == null) {
    return {
      value: deepFreeze({
        requiresVenue: false,
        requiresClub: false,
        allowedOwnerTypes: Object.freeze([]),
        requiresRegistrationWindow: false,
        requiresPlannedPeriod: false,
        allowedVisibilities: Object.freeze([]),
        requiredCapabilities: Object.freeze([]),
      }),
      errors,
    };
  }
  if (typeof input !== "object") {
    errors.push(
      createFieldError(
        fieldPrefix,
        COMPETITION_TEMPLATE_ERROR_CODE.INVALID_REQUIREMENTS,
        "requirements must be an object when provided",
        {}
      )
    );
    return { errors };
  }
  const raw = /** @type {Record<string, unknown>} */ (input);

  const boolKeys = [
    "requiresVenue",
    "requiresClub",
    "requiresRegistrationWindow",
    "requiresPlannedPeriod",
  ];
  for (const key of boolKeys) {
    if (raw[key] != null && typeof raw[key] !== "boolean") {
      errors.push(
        createFieldError(
          `${fieldPrefix}.${key}`,
          COMPETITION_TEMPLATE_ERROR_CODE.INVALID_REQUIREMENTS,
          `${key} must be a boolean when provided`,
          { value: raw[key] }
        )
      );
    }
  }

  /** @type {string[]} */
  const allowedOwnerTypes = [];
  if (raw.allowedOwnerTypes != null) {
    if (!Array.isArray(raw.allowedOwnerTypes)) {
      errors.push(
        createFieldError(
          `${fieldPrefix}.allowedOwnerTypes`,
          COMPETITION_TEMPLATE_ERROR_CODE.INVALID_REQUIREMENTS,
          "allowedOwnerTypes must be an array",
          {}
        )
      );
    } else {
      raw.allowedOwnerTypes.forEach((item, index) => {
        if (!isCompetitionOwnerType(item)) {
          errors.push(
            createFieldError(
              `${fieldPrefix}.allowedOwnerTypes[${index}]`,
              COMPETITION_TEMPLATE_ERROR_CODE.INVALID_REQUIREMENTS,
              "allowedOwnerTypes entry must be a CM-01 owner type",
              { value: item, allowed: Object.values(COMPETITION_OWNER_TYPE) }
            )
          );
        } else {
          allowedOwnerTypes.push(String(item));
        }
      });
    }
  }

  /** @type {string[]} */
  const allowedVisibilities = [];
  if (raw.allowedVisibilities != null) {
    if (!Array.isArray(raw.allowedVisibilities)) {
      errors.push(
        createFieldError(
          `${fieldPrefix}.allowedVisibilities`,
          COMPETITION_TEMPLATE_ERROR_CODE.INVALID_REQUIREMENTS,
          "allowedVisibilities must be an array",
          {}
        )
      );
    } else {
      raw.allowedVisibilities.forEach((item, index) => {
        if (!isCompetitionVisibility(item)) {
          errors.push(
            createFieldError(
              `${fieldPrefix}.allowedVisibilities[${index}]`,
              COMPETITION_TEMPLATE_ERROR_CODE.INVALID_REQUIREMENTS,
              "allowedVisibilities entry must be a CM-01 visibility",
              { value: item }
            )
          );
        } else {
          allowedVisibilities.push(String(item));
        }
      });
    }
  }

  /** @type {string[]} */
  const requiredCapabilities = [];
  if (raw.requiredCapabilities != null) {
    if (!Array.isArray(raw.requiredCapabilities)) {
      errors.push(
        createFieldError(
          `${fieldPrefix}.requiredCapabilities`,
          COMPETITION_TEMPLATE_ERROR_CODE.INVALID_REQUIREMENTS,
          "requiredCapabilities must be an array of strings",
          {}
        )
      );
    } else {
      raw.requiredCapabilities.forEach((item, index) => {
        if (!isNonEmptyString(item)) {
          errors.push(
            createFieldError(
              `${fieldPrefix}.requiredCapabilities[${index}]`,
              COMPETITION_TEMPLATE_ERROR_CODE.INVALID_REQUIREMENTS,
              "requiredCapabilities entry must be a non-empty string",
              {}
            )
          );
        } else {
          requiredCapabilities.push(String(item).trim());
        }
      });
    }
  }

  if (errors.length > 0) return { errors };

  return {
    value: deepFreeze({
      requiresVenue: Boolean(raw.requiresVenue),
      requiresClub: Boolean(raw.requiresClub),
      allowedOwnerTypes: Object.freeze([...allowedOwnerTypes]),
      requiresRegistrationWindow: Boolean(raw.requiresRegistrationWindow),
      requiresPlannedPeriod: Boolean(raw.requiresPlannedPeriod),
      allowedVisibilities: Object.freeze([...allowedVisibilities]),
      requiredCapabilities: Object.freeze([...requiredCapabilities]),
    }),
    errors,
  };
}

/**
 * @param {unknown} input
 * @param {string} [fieldPrefix]
 * @returns {{ value?: Readonly<CompetitionTemplateDefaults>, errors: import("./validation.js").CompetitionTemplateFieldError[] }}
 */
export function parseTemplateDefaults(input, fieldPrefix = "defaults") {
  /** @type {import("./validation.js").CompetitionTemplateFieldError[]} */
  const errors = [];
  if (input == null) {
    return {
      value: deepFreeze({
        visibility: null,
        ruleSet: null,
        divisionBlueprintId: null,
        formatBlueprintId: null,
        scheduleBlueprintId: null,
        scoringBlueprintId: null,
        standingsBlueprintId: null,
        registrationDefaults: null,
      }),
      errors,
    };
  }
  if (typeof input !== "object") {
    errors.push(
      createFieldError(
        fieldPrefix,
        COMPETITION_TEMPLATE_ERROR_CODE.INVALID_DEFAULTS,
        "defaults must be an object when provided",
        {}
      )
    );
    return { errors };
  }
  const raw = /** @type {Record<string, unknown>} */ (input);

  let visibility = null;
  if (raw.visibility != null) {
    if (!isCompetitionVisibility(raw.visibility)) {
      errors.push(
        createFieldError(
          `${fieldPrefix}.visibility`,
          COMPETITION_TEMPLATE_ERROR_CODE.INVALID_DEFAULTS,
          "defaults.visibility must be a CM-01 visibility when provided",
          { value: raw.visibility }
        )
      );
    } else {
      visibility = String(raw.visibility);
    }
  }

  let ruleSet = null;
  if (raw.ruleSet != null) {
    if (typeof raw.ruleSet !== "object" || !isNonEmptyString(/** @type {Record<string, unknown>} */ (raw.ruleSet).ruleSetId)) {
      errors.push(
        createFieldError(
          `${fieldPrefix}.ruleSet`,
          COMPETITION_TEMPLATE_ERROR_CODE.INVALID_DEFAULTS,
          "defaults.ruleSet must be { ruleSetId } when provided",
          {}
        )
      );
    } else {
      ruleSet = deepFreeze({
        ruleSetId: String(
          /** @type {Record<string, unknown>} */ (raw.ruleSet).ruleSetId
        ).trim(),
      });
    }
  }

  /**
   * @param {string} key
   * @returns {string|null}
   */
  function optionalBlueprintId(key) {
    if (raw[key] == null || raw[key] === "") return null;
    if (!isNonEmptyString(raw[key])) {
      errors.push(
        createFieldError(
          `${fieldPrefix}.${key}`,
          COMPETITION_TEMPLATE_ERROR_CODE.INVALID_DEFAULTS,
          `${key} must be a non-empty string when provided`,
          {}
        )
      );
      return null;
    }
    return String(raw[key]).trim();
  }

  const divisionBlueprintId = optionalBlueprintId("divisionBlueprintId");
  const formatBlueprintId = optionalBlueprintId("formatBlueprintId");
  const scheduleBlueprintId = optionalBlueprintId("scheduleBlueprintId");
  const scoringBlueprintId = optionalBlueprintId("scoringBlueprintId");
  const standingsBlueprintId = optionalBlueprintId("standingsBlueprintId");

  let registrationDefaults = null;
  if (raw.registrationDefaults != null) {
    if (typeof raw.registrationDefaults !== "object") {
      errors.push(
        createFieldError(
          `${fieldPrefix}.registrationDefaults`,
          COMPETITION_TEMPLATE_ERROR_CODE.INVALID_DEFAULTS,
          "registrationDefaults must be an object when provided",
          {}
        )
      );
    } else {
      registrationDefaults = deepFreeze({
        .../** @type {object} */ (raw.registrationDefaults),
      });
    }
  }

  if (errors.length > 0) return { errors };

  return {
    value: deepFreeze({
      visibility,
      ruleSet,
      divisionBlueprintId,
      formatBlueprintId,
      scheduleBlueprintId,
      scoringBlueprintId,
      standingsBlueprintId,
      registrationDefaults,
    }),
    errors,
  };
}

/**
 * Validate and normalize a CompetitionTemplateDefinition candidate.
 * Does not mutate input. Does not silently repair.
 *
 * @param {object} input
 * @returns {import("./validation.js").CompetitionTemplateValidationResult}
 */
export function validateCompetitionTemplateDefinition(input = {}) {
  /** @type {import("./validation.js").CompetitionTemplateFieldError[]} */
  const errors = [];
  const src = input && typeof input === "object" ? input : {};

  /** @type {string|undefined} */
  let templateId;
  if (!isNonEmptyString(src.templateId)) {
    errors.push(
      createFieldError(
        "templateId",
        COMPETITION_TEMPLATE_ERROR_CODE.INVALID_TEMPLATE_ID,
        "templateId is required",
        {}
      )
    );
  } else {
    templateId = String(src.templateId).trim();
  }

  /** @type {number|undefined} */
  let templateVersion;
  if (!isPositiveInteger(src.templateVersion)) {
    errors.push(
      createFieldError(
        "templateVersion",
        COMPETITION_TEMPLATE_ERROR_CODE.INVALID_TEMPLATE_VERSION,
        "templateVersion must be an integer >= 1",
        { value: src.templateVersion }
      )
    );
  } else {
    templateVersion = /** @type {number} */ (src.templateVersion);
  }

  /** @type {string|undefined} */
  let templateScope;
  if (!isCompetitionTemplateScope(src.templateScope)) {
    errors.push(
      createFieldError(
        "templateScope",
        COMPETITION_TEMPLATE_ERROR_CODE.INVALID_TEMPLATE_SCOPE,
        `templateScope must be one of: ${Object.values(COMPETITION_TEMPLATE_SCOPE).join(", ")}`,
        { value: src.templateScope }
      )
    );
  } else {
    templateScope = String(src.templateScope);
  }

  /** @type {string|null} */
  let tenantId = null;
  if (templateScope === COMPETITION_TEMPLATE_SCOPE.GLOBAL) {
    if (src.tenantId != null && src.tenantId !== "") {
      errors.push(
        createFieldError(
          "tenantId",
          COMPETITION_TEMPLATE_ERROR_CODE.INVALID_TEMPLATE_SCOPE,
          "global templates must not declare tenantId",
          { value: src.tenantId }
        )
      );
    }
  } else if (templateScope === COMPETITION_TEMPLATE_SCOPE.TENANT) {
    if (!isNonEmptyString(src.tenantId)) {
      errors.push(
        createFieldError(
          "tenantId",
          COMPETITION_TEMPLATE_ERROR_CODE.INVALID_IDENTIFIER,
          "tenant templates require explicit tenantId",
          {}
        )
      );
    } else {
      tenantId = String(src.tenantId).trim();
    }
  }

  /** @type {string|undefined} */
  let name;
  if (!isNonEmptyString(src.name)) {
    errors.push(
      createFieldError(
        "name",
        COMPETITION_TEMPLATE_ERROR_CODE.INVALID_TEMPLATE_NAME,
        "canonical name must be a non-empty string",
        {}
      )
    );
  } else {
    name = String(src.name).trim();
    if (name.length > COMPETITION_TEMPLATE_NAME_MAX_LENGTH) {
      errors.push(
        createFieldError(
          "name",
          COMPETITION_TEMPLATE_ERROR_CODE.INVALID_TEMPLATE_NAME,
          `canonical name must be at most ${COMPETITION_TEMPLATE_NAME_MAX_LENGTH} characters`,
          { length: name.length }
        )
      );
    }
  }

  let description = "";
  if (src.description == null) {
    description = "";
  } else if (typeof src.description !== "string") {
    errors.push(
      createFieldError(
        "description",
        COMPETITION_TEMPLATE_ERROR_CODE.INVALID_CONTRACT,
        "description must be a string when provided",
        {}
      )
    );
  } else {
    description = src.description;
    if (description.length > COMPETITION_TEMPLATE_DESCRIPTION_MAX_LENGTH) {
      errors.push(
        createFieldError(
          "description",
          COMPETITION_TEMPLATE_ERROR_CODE.INVALID_CONTRACT,
          `description must be at most ${COMPETITION_TEMPLATE_DESCRIPTION_MAX_LENGTH} characters`,
          { length: description.length }
        )
      );
    }
  }

  /** @type {string[]} */
  const supportedCompetitionTypes = [];
  if (!Array.isArray(src.supportedCompetitionTypes) || src.supportedCompetitionTypes.length === 0) {
    errors.push(
      createFieldError(
        "supportedCompetitionTypes",
        COMPETITION_TEMPLATE_ERROR_CODE.INVALID_SUPPORTED_TYPES,
        "supportedCompetitionTypes must be a non-empty array",
        {}
      )
    );
  } else {
    src.supportedCompetitionTypes.forEach((item, index) => {
      if (!isCompetitionType(item)) {
        errors.push(
          createFieldError(
            `supportedCompetitionTypes[${index}]`,
            COMPETITION_TEMPLATE_ERROR_CODE.INVALID_SUPPORTED_TYPES,
            "supportedCompetitionTypes entry must be a CM-01 competition type",
            { value: item, allowed: Object.values(COMPETITION_TYPE) }
          )
        );
      } else {
        supportedCompetitionTypes.push(String(item));
      }
    });
  }

  /** @type {string[]} */
  const supportedScopes = [];
  if (!Array.isArray(src.supportedScopes) || src.supportedScopes.length === 0) {
    errors.push(
      createFieldError(
        "supportedScopes",
        COMPETITION_TEMPLATE_ERROR_CODE.INVALID_SUPPORTED_SCOPES,
        "supportedScopes must be a non-empty array",
        {}
      )
    );
  } else {
    src.supportedScopes.forEach((item, index) => {
      if (!isCompetitionScope(item)) {
        errors.push(
          createFieldError(
            `supportedScopes[${index}]`,
            COMPETITION_TEMPLATE_ERROR_CODE.INVALID_SUPPORTED_SCOPES,
            "supportedScopes entry must be a CM-01 competition scope",
            { value: item, allowed: Object.values(COMPETITION_SCOPE) }
          )
        );
      } else {
        supportedScopes.push(String(item));
      }
    });
  }

  /** @type {string|undefined} */
  let participantMode;
  if (!isCompetitionTemplateParticipantMode(src.participantMode)) {
    errors.push(
      createFieldError(
        "participantMode",
        COMPETITION_TEMPLATE_ERROR_CODE.INVALID_PARTICIPANT_MODE,
        "participantMode is missing or invalid",
        { value: src.participantMode }
      )
    );
  } else {
    participantMode = String(src.participantMode);
  }

  /** @type {string|undefined} */
  let availability;
  if (!isCompetitionTemplateAvailability(src.availability)) {
    errors.push(
      createFieldError(
        "availability",
        COMPETITION_TEMPLATE_ERROR_CODE.INVALID_AVAILABILITY,
        `availability must be one of: ${Object.values(COMPETITION_TEMPLATE_AVAILABILITY).join(", ")}`,
        { value: src.availability }
      )
    );
  } else {
    availability = String(src.availability);
  }

  const requirementsParsed = parseTemplateRequirements(src.requirements);
  errors.push(...requirementsParsed.errors);
  const defaultsParsed = parseTemplateDefaults(src.defaults);
  errors.push(...defaultsParsed.errors);

  /** @type {string[]} */
  const capabilityTags = [];
  if (src.capabilityTags == null) {
    // empty ok
  } else if (!Array.isArray(src.capabilityTags)) {
    errors.push(
      createFieldError(
        "capabilityTags",
        COMPETITION_TEMPLATE_ERROR_CODE.INVALID_CONTRACT,
        "capabilityTags must be an array when provided",
        {}
      )
    );
  } else {
    src.capabilityTags.forEach((item, index) => {
      if (!isNonEmptyString(item)) {
        errors.push(
          createFieldError(
            `capabilityTags[${index}]`,
            COMPETITION_TEMPLATE_ERROR_CODE.INVALID_CONTRACT,
            "capabilityTags entry must be a non-empty string",
            {}
          )
        );
      } else {
        capabilityTags.push(String(item).trim());
      }
    });
  }

  let metadata = {};
  if (src.metadata != null) {
    if (typeof src.metadata !== "object" || Array.isArray(src.metadata)) {
      errors.push(
        createFieldError(
          "metadata",
          COMPETITION_TEMPLATE_ERROR_CODE.INVALID_CONTRACT,
          "metadata must be a plain object when provided",
          {}
        )
      );
    } else {
      metadata = { .../** @type {object} */ (src.metadata) };
    }
  }

  if (errors.length > 0) {
    return validationFail(errors);
  }

  /** @type {CompetitionTemplateDefinition} */
  const definition = {
    templateId: /** @type {string} */ (templateId),
    templateVersion: /** @type {number} */ (templateVersion),
    templateScope: /** @type {string} */ (templateScope),
    tenantId,
    name: /** @type {string} */ (name),
    description,
    supportedCompetitionTypes: Object.freeze([...supportedCompetitionTypes]),
    supportedScopes: Object.freeze([...supportedScopes]),
    participantMode: /** @type {string} */ (participantMode),
    availability: /** @type {string} */ (availability),
    requirements: /** @type {CompetitionTemplateRequirements} */ (
      requirementsParsed.value
    ),
    defaults: /** @type {CompetitionTemplateDefaults} */ (defaultsParsed.value),
    capabilityTags: Object.freeze([...capabilityTags]),
    metadata: deepFreeze(metadata),
  };

  return validationOk(deepFreeze(definition));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionTemplateDefinition(value) {
  if (!value || typeof value !== "object") return false;
  const result = validateCompetitionTemplateDefinition(
    /** @type {object} */ (value)
  );
  return result.ok === true;
}

export {
  COMPETITION_TYPE,
  COMPETITION_SCOPE,
  COMPETITION_VISIBILITY,
  COMPETITION_OWNER_TYPE,
  COMPETITION_TEMPLATE_INITIAL_VERSION,
  isCompetitionTemplateOwnershipTarget,
};
