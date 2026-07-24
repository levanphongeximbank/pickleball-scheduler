/**
 * Capability reference + section parsers (CM-04).
 * References only — never execute Competition Core engines.
 */

import {
  COMPETITION_CONFIGURATION_SECTION,
  COMPETITION_CONFIGURATION_SECTION_VALUES,
  isCompetitionConfigurationSection,
} from "../constants/sectionTypes.js";
import {
  COMPETITION_CONFIGURATION_CAPABILITY_OWNER,
  COMPETITION_CONFIGURATION_DEFERRED_CAPABILITY_OWNERS,
  isCompetitionConfigurationCapabilityOwner,
} from "../constants/capabilityOwners.js";
import {
  isCompetitionConfigurationParticipantMode,
} from "../constants/participantMode.js";
import {
  isCompetitionConfigurationOfficialMode,
} from "../constants/officialMode.js";
import { COMPETITION_CONFIGURATION_ERROR_CODE } from "../errors/errorCodes.js";
import { createFieldError } from "./validation.js";
import { deepFreeze, clonePlain, isNonEmptyString } from "./shared.js";

/**
 * @typedef {Object} CompetitionConfigurationCapabilityReference
 * @property {string} capabilityOwner
 * @property {string|null} referenceId
 * @property {string|number|null} [referenceVersion]
 * @property {"opaque_proposal"|"deferred_unsupported"|"resolved_identity"} resolutionStatus
 */

/**
 * @param {unknown} raw
 * @param {string} fieldPath
 * @param {{ allowDeferredWithoutId?: boolean, allowedOwners?: string[] }} [options]
 * @returns {{ value: CompetitionConfigurationCapabilityReference|null, error: object|null }}
 */
export function parseCapabilityReference(raw, fieldPath, options = {}) {
  if (raw == null) {
    return { value: null, error: null };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      value: null,
      error: createFieldError(
        fieldPath,
        COMPETITION_CONFIGURATION_ERROR_CODE.UNSUPPORTED_CAPABILITY_REFERENCE,
        "capability reference must be an object",
        { value: raw }
      ),
    };
  }

  const owner = /** @type {any} */ (raw).capabilityOwner;
  if (!isCompetitionConfigurationCapabilityOwner(owner)) {
    return {
      value: null,
      error: createFieldError(
        `${fieldPath}.capabilityOwner`,
        COMPETITION_CONFIGURATION_ERROR_CODE.UNSUPPORTED_CAPABILITY_REFERENCE,
        "unknown or unsupported capability owner",
        { value: owner }
      ),
    };
  }

  if (
    Array.isArray(options.allowedOwners) &&
    !options.allowedOwners.includes(owner)
  ) {
    return {
      value: null,
      error: createFieldError(
        `${fieldPath}.capabilityOwner`,
        COMPETITION_CONFIGURATION_ERROR_CODE.UNSUPPORTED_CAPABILITY_REFERENCE,
        "capability owner not allowed for this section",
        { value: owner, allowedOwners: options.allowedOwners }
      ),
    };
  }

  const resolutionStatus = /** @type {any} */ (raw).resolutionStatus;
  const allowedStatuses = [
    "opaque_proposal",
    "deferred_unsupported",
    "resolved_identity",
  ];
  if (!allowedStatuses.includes(resolutionStatus)) {
    return {
      value: null,
      error: createFieldError(
        `${fieldPath}.resolutionStatus`,
        COMPETITION_CONFIGURATION_ERROR_CODE.UNSUPPORTED_CAPABILITY_REFERENCE,
        "resolutionStatus must be opaque_proposal|deferred_unsupported|resolved_identity",
        { value: resolutionStatus }
      ),
    };
  }

  const referenceIdRaw = /** @type {any} */ (raw).referenceId;
  let referenceId = null;
  if (referenceIdRaw == null) {
    if (
      resolutionStatus !== "deferred_unsupported" &&
      options.allowDeferredWithoutId !== true
    ) {
      return {
        value: null,
        error: createFieldError(
          `${fieldPath}.referenceId`,
          COMPETITION_CONFIGURATION_ERROR_CODE.UNSUPPORTED_CAPABILITY_REFERENCE,
          "referenceId is required unless resolutionStatus is deferred_unsupported",
          {}
        ),
      };
    }
  } else if (!isNonEmptyString(referenceIdRaw)) {
    return {
      value: null,
      error: createFieldError(
        `${fieldPath}.referenceId`,
        COMPETITION_CONFIGURATION_ERROR_CODE.UNSUPPORTED_CAPABILITY_REFERENCE,
        "referenceId must be a non-empty string when provided",
        {}
      ),
    };
  } else {
    referenceId = String(referenceIdRaw).trim();
  }

  // Fail closed: deferred capability owners cannot claim resolved_identity.
  if (
    COMPETITION_CONFIGURATION_DEFERRED_CAPABILITY_OWNERS.includes(owner) &&
    resolutionStatus === "resolved_identity"
  ) {
    return {
      value: null,
      error: createFieldError(
        `${fieldPath}.resolutionStatus`,
        COMPETITION_CONFIGURATION_ERROR_CODE.UNSUPPORTED_CAPABILITY_REFERENCE,
        "deferred capability owner cannot use resolved_identity (no stable CORE catalog yet)",
        { capabilityOwner: owner }
      ),
    };
  }

  if (
    owner === COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED &&
    resolutionStatus !== "deferred_unsupported"
  ) {
    return {
      value: null,
      error: createFieldError(
        `${fieldPath}.resolutionStatus`,
        COMPETITION_CONFIGURATION_ERROR_CODE.UNSUPPORTED_CAPABILITY_REFERENCE,
        "capabilityOwner=deferred requires resolutionStatus=deferred_unsupported",
        {}
      ),
    };
  }

  const referenceVersion =
    /** @type {any} */ (raw).referenceVersion === undefined
      ? null
      : /** @type {any} */ (raw).referenceVersion;

  if (
    referenceVersion != null &&
    typeof referenceVersion !== "string" &&
    typeof referenceVersion !== "number"
  ) {
    return {
      value: null,
      error: createFieldError(
        `${fieldPath}.referenceVersion`,
        COMPETITION_CONFIGURATION_ERROR_CODE.UNSUPPORTED_CAPABILITY_REFERENCE,
        "referenceVersion must be string|number|null",
        {}
      ),
    };
  }

  return {
    value: deepFreeze({
      capabilityOwner: owner,
      referenceId,
      referenceVersion:
        typeof referenceVersion === "string"
          ? referenceVersion.trim()
          : referenceVersion,
      resolutionStatus,
    }),
    error: null,
  };
}

/**
 * @param {unknown} section
 * @param {string} expectedSectionId
 * @param {string} fieldPath
 * @returns {object|null}
 */
function requireSectionId(section, expectedSectionId, fieldPath) {
  if (!section || typeof section !== "object" || Array.isArray(section)) {
    return createFieldError(
      fieldPath,
      COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
      "section must be an object",
      {}
    );
  }
  if (section.sectionId !== expectedSectionId) {
    return createFieldError(
      `${fieldPath}.sectionId`,
      COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
      `sectionId must equal ${expectedSectionId}`,
      { value: section.sectionId }
    );
  }
  return null;
}

/**
 * Parse and validate a single section object.
 * @param {string} sectionId
 * @param {unknown} raw
 * @param {string} fieldPath
 * @returns {{ value: object|null, errors: object[] }}
 */
export function parseConfigurationSection(sectionId, raw, fieldPath) {
  /** @type {object[]} */
  const errors = [];

  if (!isCompetitionConfigurationSection(sectionId)) {
    errors.push(
      createFieldError(
        fieldPath,
        COMPETITION_CONFIGURATION_ERROR_CODE.UNKNOWN_SECTION,
        "unknown configuration section identity",
        { sectionId }
      )
    );
    return { value: null, errors };
  }

  switch (sectionId) {
    case COMPETITION_CONFIGURATION_SECTION.PARTICIPANT_MODE: {
      const idErr = requireSectionId(
        raw,
        COMPETITION_CONFIGURATION_SECTION.PARTICIPANT_MODE,
        fieldPath
      );
      if (idErr) return { value: null, errors: [idErr] };
      const mode = /** @type {any} */ (raw).participantMode;
      if (!isCompetitionConfigurationParticipantMode(mode)) {
        errors.push(
          createFieldError(
            `${fieldPath}.participantMode`,
            COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
            "participantMode must be individual|team|mixed",
            { value: mode }
          )
        );
        return { value: null, errors };
      }
      return {
        value: deepFreeze({
          sectionId: COMPETITION_CONFIGURATION_SECTION.PARTICIPANT_MODE,
          participantMode: mode,
        }),
        errors: [],
      };
    }

    case COMPETITION_CONFIGURATION_SECTION.FORMAT: {
      const idErr = requireSectionId(
        raw,
        COMPETITION_CONFIGURATION_SECTION.FORMAT,
        fieldPath
      );
      if (idErr) return { value: null, errors: [idErr] };
      const formatBlueprintId = /** @type {any} */ (raw).formatBlueprintId;
      if (!isNonEmptyString(formatBlueprintId)) {
        errors.push(
          createFieldError(
            `${fieldPath}.formatBlueprintId`,
            COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
            "formatBlueprintId must be a non-empty opaque string",
            {}
          )
        );
        return { value: null, errors };
      }
      return {
        value: deepFreeze({
          sectionId: COMPETITION_CONFIGURATION_SECTION.FORMAT,
          formatBlueprintId: String(formatBlueprintId).trim(),
        }),
        errors: [],
      };
    }

    case COMPETITION_CONFIGURATION_SECTION.REGISTRATION_POLICY: {
      const idErr = requireSectionId(
        raw,
        COMPETITION_CONFIGURATION_SECTION.REGISTRATION_POLICY,
        fieldPath
      );
      if (idErr) return { value: null, errors: [idErr] };
      const registrationDefaults = /** @type {any} */ (raw).registrationDefaults;
      if (
        !registrationDefaults ||
        typeof registrationDefaults !== "object" ||
        Array.isArray(registrationDefaults)
      ) {
        errors.push(
          createFieldError(
            `${fieldPath}.registrationDefaults`,
            COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
            "registrationDefaults must be a plain object (not registration window)",
            {}
          )
        );
        return { value: null, errors };
      }
      // Reject CM-01-owned window fields if smuggled into defaults.
      if (
        Object.prototype.hasOwnProperty.call(registrationDefaults, "opensAt") ||
        Object.prototype.hasOwnProperty.call(registrationDefaults, "closesAt")
      ) {
        errors.push(
          createFieldError(
            `${fieldPath}.registrationDefaults`,
            COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
            "registrationDefaults must not include opensAt/closesAt (CM-01 owns registrationWindow)",
            {}
          )
        );
        return { value: null, errors };
      }
      return {
        value: deepFreeze({
          sectionId: COMPETITION_CONFIGURATION_SECTION.REGISTRATION_POLICY,
          registrationDefaults: clonePlain(registrationDefaults),
        }),
        errors: [],
      };
    }

    case COMPETITION_CONFIGURATION_SECTION.ELIGIBILITY: {
      const idErr = requireSectionId(
        raw,
        COMPETITION_CONFIGURATION_SECTION.ELIGIBILITY,
        fieldPath
      );
      if (idErr) return { value: null, errors: [idErr] };
      const parsed = parseCapabilityReference(
        /** @type {any} */ (raw).eligibilityPolicyReference,
        `${fieldPath}.eligibilityPolicyReference`,
        {
          allowedOwners: [
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_ELIGIBILITY,
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED,
          ],
        }
      );
      if (parsed.error) return { value: null, errors: [parsed.error] };
      if (!parsed.value) {
        return {
          value: null,
          errors: [
            createFieldError(
              `${fieldPath}.eligibilityPolicyReference`,
              COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
              "eligibilityPolicyReference is required",
              {}
            ),
          ],
        };
      }
      return {
        value: deepFreeze({
          sectionId: COMPETITION_CONFIGURATION_SECTION.ELIGIBILITY,
          eligibilityPolicyReference: parsed.value,
        }),
        errors: [],
      };
    }

    case COMPETITION_CONFIGURATION_SECTION.DIVISION: {
      const idErr = requireSectionId(
        raw,
        COMPETITION_CONFIGURATION_SECTION.DIVISION,
        fieldPath
      );
      if (idErr) return { value: null, errors: [idErr] };
      const parsed = parseCapabilityReference(
        /** @type {any} */ (raw).divisionBlueprintReference,
        `${fieldPath}.divisionBlueprintReference`,
        {
          allowedOwners: [
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_DIVISION,
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED,
          ],
        }
      );
      if (parsed.error) return { value: null, errors: [parsed.error] };
      if (!parsed.value) {
        return {
          value: null,
          errors: [
            createFieldError(
              `${fieldPath}.divisionBlueprintReference`,
              COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
              "divisionBlueprintReference is required",
              {}
            ),
          ],
        };
      }
      return {
        value: deepFreeze({
          sectionId: COMPETITION_CONFIGURATION_SECTION.DIVISION,
          divisionBlueprintReference: parsed.value,
        }),
        errors: [],
      };
    }

    case COMPETITION_CONFIGURATION_SECTION.ROSTER: {
      const idErr = requireSectionId(
        raw,
        COMPETITION_CONFIGURATION_SECTION.ROSTER,
        fieldPath
      );
      if (idErr) return { value: null, errors: [idErr] };
      const parsed = parseCapabilityReference(
        /** @type {any} */ (raw).rosterPolicyReference,
        `${fieldPath}.rosterPolicyReference`,
        {
          allowedOwners: [
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_ROSTER,
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED,
          ],
        }
      );
      if (parsed.error) return { value: null, errors: [parsed.error] };
      if (!parsed.value) {
        return {
          value: null,
          errors: [
            createFieldError(
              `${fieldPath}.rosterPolicyReference`,
              COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
              "rosterPolicyReference is required",
              {}
            ),
          ],
        };
      }
      return {
        value: deepFreeze({
          sectionId: COMPETITION_CONFIGURATION_SECTION.ROSTER,
          rosterPolicyReference: parsed.value,
        }),
        errors: [],
      };
    }

    case COMPETITION_CONFIGURATION_SECTION.SEEDING: {
      const idErr = requireSectionId(
        raw,
        COMPETITION_CONFIGURATION_SECTION.SEEDING,
        fieldPath
      );
      if (idErr) return { value: null, errors: [idErr] };
      const parsed = parseCapabilityReference(
        /** @type {any} */ (raw).seedingPolicyReference,
        `${fieldPath}.seedingPolicyReference`,
        {
          allowedOwners: [
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_SEEDING,
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED,
          ],
        }
      );
      if (parsed.error) return { value: null, errors: [parsed.error] };
      if (!parsed.value) {
        return {
          value: null,
          errors: [
            createFieldError(
              `${fieldPath}.seedingPolicyReference`,
              COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
              "seedingPolicyReference is required",
              {}
            ),
          ],
        };
      }
      return {
        value: deepFreeze({
          sectionId: COMPETITION_CONFIGURATION_SECTION.SEEDING,
          seedingPolicyReference: parsed.value,
        }),
        errors: [],
      };
    }

    case COMPETITION_CONFIGURATION_SECTION.DRAW: {
      const idErr = requireSectionId(
        raw,
        COMPETITION_CONFIGURATION_SECTION.DRAW,
        fieldPath
      );
      if (idErr) return { value: null, errors: [idErr] };
      const parsed = parseCapabilityReference(
        /** @type {any} */ (raw).drawPolicyReference,
        `${fieldPath}.drawPolicyReference`,
        {
          allowedOwners: [
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_DRAW,
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED,
          ],
        }
      );
      if (parsed.error) return { value: null, errors: [parsed.error] };
      if (!parsed.value) {
        return {
          value: null,
          errors: [
            createFieldError(
              `${fieldPath}.drawPolicyReference`,
              COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
              "drawPolicyReference is required",
              {}
            ),
          ],
        };
      }
      return {
        value: deepFreeze({
          sectionId: COMPETITION_CONFIGURATION_SECTION.DRAW,
          drawPolicyReference: parsed.value,
        }),
        errors: [],
      };
    }

    case COMPETITION_CONFIGURATION_SECTION.MATCH_FORMAT: {
      const idErr = requireSectionId(
        raw,
        COMPETITION_CONFIGURATION_SECTION.MATCH_FORMAT,
        fieldPath
      );
      if (idErr) return { value: null, errors: [idErr] };
      const parsed = parseCapabilityReference(
        /** @type {any} */ (raw).matchFormatReference,
        `${fieldPath}.matchFormatReference`,
        {
          allowedOwners: [
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_FORMAT,
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CM04_LOCAL,
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED,
          ],
        }
      );
      if (parsed.error) return { value: null, errors: [parsed.error] };
      if (!parsed.value) {
        return {
          value: null,
          errors: [
            createFieldError(
              `${fieldPath}.matchFormatReference`,
              COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
              "matchFormatReference is required",
              {}
            ),
          ],
        };
      }
      return {
        value: deepFreeze({
          sectionId: COMPETITION_CONFIGURATION_SECTION.MATCH_FORMAT,
          matchFormatReference: parsed.value,
        }),
        errors: [],
      };
    }

    case COMPETITION_CONFIGURATION_SECTION.MATCH_GENERATION: {
      const idErr = requireSectionId(
        raw,
        COMPETITION_CONFIGURATION_SECTION.MATCH_GENERATION,
        fieldPath
      );
      if (idErr) return { value: null, errors: [idErr] };
      const parsed = parseCapabilityReference(
        /** @type {any} */ (raw).matchGenerationPolicyReference,
        `${fieldPath}.matchGenerationPolicyReference`,
        {
          allowedOwners: [
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_MATCH_GENERATION,
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED,
          ],
        }
      );
      if (parsed.error) return { value: null, errors: [parsed.error] };
      if (!parsed.value) {
        return {
          value: null,
          errors: [
            createFieldError(
              `${fieldPath}.matchGenerationPolicyReference`,
              COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
              "matchGenerationPolicyReference is required",
              {}
            ),
          ],
        };
      }
      return {
        value: deepFreeze({
          sectionId: COMPETITION_CONFIGURATION_SECTION.MATCH_GENERATION,
          matchGenerationPolicyReference: parsed.value,
        }),
        errors: [],
      };
    }

    case COMPETITION_CONFIGURATION_SECTION.SCHEDULING: {
      const idErr = requireSectionId(
        raw,
        COMPETITION_CONFIGURATION_SECTION.SCHEDULING,
        fieldPath
      );
      if (idErr) return { value: null, errors: [idErr] };
      const parsed = parseCapabilityReference(
        /** @type {any} */ (raw).schedulePolicyReference,
        `${fieldPath}.schedulePolicyReference`,
        {
          allowedOwners: [
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_SCHEDULE,
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED,
          ],
        }
      );
      if (parsed.error) return { value: null, errors: [parsed.error] };
      if (!parsed.value) {
        return {
          value: null,
          errors: [
            createFieldError(
              `${fieldPath}.schedulePolicyReference`,
              COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
              "schedulePolicyReference is required",
              {}
            ),
          ],
        };
      }
      return {
        value: deepFreeze({
          sectionId: COMPETITION_CONFIGURATION_SECTION.SCHEDULING,
          schedulePolicyReference: parsed.value,
        }),
        errors: [],
      };
    }

    case COMPETITION_CONFIGURATION_SECTION.COURT_ASSIGNMENT: {
      const idErr = requireSectionId(
        raw,
        COMPETITION_CONFIGURATION_SECTION.COURT_ASSIGNMENT,
        fieldPath
      );
      if (idErr) return { value: null, errors: [idErr] };
      const parsed = parseCapabilityReference(
        /** @type {any} */ (raw).courtAssignmentPolicyReference,
        `${fieldPath}.courtAssignmentPolicyReference`,
        {
          allowedOwners: [
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_COURT_ASSIGNMENT,
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED,
          ],
        }
      );
      if (parsed.error) return { value: null, errors: [parsed.error] };
      if (!parsed.value) {
        return {
          value: null,
          errors: [
            createFieldError(
              `${fieldPath}.courtAssignmentPolicyReference`,
              COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
              "courtAssignmentPolicyReference is required",
              {}
            ),
          ],
        };
      }
      const venueScopeHint = /** @type {any} */ (raw).venueScopeHint;
      if (
        venueScopeHint != null &&
        !isNonEmptyString(venueScopeHint)
      ) {
        errors.push(
          createFieldError(
            `${fieldPath}.venueScopeHint`,
            COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
            "venueScopeHint must be a non-empty string when provided",
            {}
          )
        );
        return { value: null, errors };
      }
      return {
        value: deepFreeze({
          sectionId: COMPETITION_CONFIGURATION_SECTION.COURT_ASSIGNMENT,
          courtAssignmentPolicyReference: parsed.value,
          venueScopeHint: venueScopeHint
            ? String(venueScopeHint).trim()
            : null,
        }),
        errors: [],
      };
    }

    case COMPETITION_CONFIGURATION_SECTION.REFEREE: {
      const idErr = requireSectionId(
        raw,
        COMPETITION_CONFIGURATION_SECTION.REFEREE,
        fieldPath
      );
      if (idErr) return { value: null, errors: [idErr] };
      const parsed = parseCapabilityReference(
        /** @type {any} */ (raw).refereePolicyReference,
        `${fieldPath}.refereePolicyReference`,
        {
          allowedOwners: [
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_REFEREE,
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED,
          ],
        }
      );
      if (parsed.error) return { value: null, errors: [parsed.error] };
      if (!parsed.value) {
        return {
          value: null,
          errors: [
            createFieldError(
              `${fieldPath}.refereePolicyReference`,
              COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
              "refereePolicyReference is required",
              {}
            ),
          ],
        };
      }
      return {
        value: deepFreeze({
          sectionId: COMPETITION_CONFIGURATION_SECTION.REFEREE,
          refereePolicyReference: parsed.value,
        }),
        errors: [],
      };
    }

    case COMPETITION_CONFIGURATION_SECTION.CONFLICT_RESOLUTION: {
      const idErr = requireSectionId(
        raw,
        COMPETITION_CONFIGURATION_SECTION.CONFLICT_RESOLUTION,
        fieldPath
      );
      if (idErr) return { value: null, errors: [idErr] };
      const parsed = parseCapabilityReference(
        /** @type {any} */ (raw).conflictResolutionPolicyReference,
        `${fieldPath}.conflictResolutionPolicyReference`,
        {
          allowedOwners: [
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_CONFLICT,
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED,
          ],
        }
      );
      if (parsed.error) return { value: null, errors: [parsed.error] };
      if (!parsed.value) {
        return {
          value: null,
          errors: [
            createFieldError(
              `${fieldPath}.conflictResolutionPolicyReference`,
              COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
              "conflictResolutionPolicyReference is required",
              {}
            ),
          ],
        };
      }
      return {
        value: deepFreeze({
          sectionId: COMPETITION_CONFIGURATION_SECTION.CONFLICT_RESOLUTION,
          conflictResolutionPolicyReference: parsed.value,
        }),
        errors: [],
      };
    }

    case COMPETITION_CONFIGURATION_SECTION.MATCH_LIFECYCLE: {
      const idErr = requireSectionId(
        raw,
        COMPETITION_CONFIGURATION_SECTION.MATCH_LIFECYCLE,
        fieldPath
      );
      if (idErr) return { value: null, errors: [idErr] };
      const parsed = parseCapabilityReference(
        /** @type {any} */ (raw).matchLifecyclePolicyReference,
        `${fieldPath}.matchLifecyclePolicyReference`,
        {
          allowedOwners: [
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_MATCH_LIFECYCLE,
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED,
          ],
        }
      );
      if (parsed.error) return { value: null, errors: [parsed.error] };
      if (!parsed.value) {
        return {
          value: null,
          errors: [
            createFieldError(
              `${fieldPath}.matchLifecyclePolicyReference`,
              COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
              "matchLifecyclePolicyReference is required",
              {}
            ),
          ],
        };
      }
      return {
        value: deepFreeze({
          sectionId: COMPETITION_CONFIGURATION_SECTION.MATCH_LIFECYCLE,
          matchLifecyclePolicyReference: parsed.value,
        }),
        errors: [],
      };
    }

    case COMPETITION_CONFIGURATION_SECTION.SCORING: {
      const idErr = requireSectionId(
        raw,
        COMPETITION_CONFIGURATION_SECTION.SCORING,
        fieldPath
      );
      if (idErr) return { value: null, errors: [idErr] };
      const parsed = parseCapabilityReference(
        /** @type {any} */ (raw).scoringPolicyReference,
        `${fieldPath}.scoringPolicyReference`,
        {
          allowedOwners: [
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_SCORING,
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED,
          ],
        }
      );
      if (parsed.error) return { value: null, errors: [parsed.error] };
      if (!parsed.value) {
        return {
          value: null,
          errors: [
            createFieldError(
              `${fieldPath}.scoringPolicyReference`,
              COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
              "scoringPolicyReference is required",
              {}
            ),
          ],
        };
      }
      return {
        value: deepFreeze({
          sectionId: COMPETITION_CONFIGURATION_SECTION.SCORING,
          scoringPolicyReference: parsed.value,
        }),
        errors: [],
      };
    }

    case COMPETITION_CONFIGURATION_SECTION.RESULT_VALIDATION: {
      const idErr = requireSectionId(
        raw,
        COMPETITION_CONFIGURATION_SECTION.RESULT_VALIDATION,
        fieldPath
      );
      if (idErr) return { value: null, errors: [idErr] };
      const parsed = parseCapabilityReference(
        /** @type {any} */ (raw).resultValidationPolicyReference,
        `${fieldPath}.resultValidationPolicyReference`,
        {
          allowedOwners: [
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_RESULT_VALIDATION,
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED,
          ],
        }
      );
      if (parsed.error) return { value: null, errors: [parsed.error] };
      if (!parsed.value) {
        return {
          value: null,
          errors: [
            createFieldError(
              `${fieldPath}.resultValidationPolicyReference`,
              COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
              "resultValidationPolicyReference is required",
              {}
            ),
          ],
        };
      }
      return {
        value: deepFreeze({
          sectionId: COMPETITION_CONFIGURATION_SECTION.RESULT_VALIDATION,
          resultValidationPolicyReference: parsed.value,
        }),
        errors: [],
      };
    }

    case COMPETITION_CONFIGURATION_SECTION.STANDINGS: {
      const idErr = requireSectionId(
        raw,
        COMPETITION_CONFIGURATION_SECTION.STANDINGS,
        fieldPath
      );
      if (idErr) return { value: null, errors: [idErr] };
      const standings = parseCapabilityReference(
        /** @type {any} */ (raw).standingsPolicyReference,
        `${fieldPath}.standingsPolicyReference`,
        {
          allowedOwners: [
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_STANDINGS,
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED,
          ],
        }
      );
      if (standings.error) return { value: null, errors: [standings.error] };
      if (!standings.value) {
        return {
          value: null,
          errors: [
            createFieldError(
              `${fieldPath}.standingsPolicyReference`,
              COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
              "standingsPolicyReference is required",
              {}
            ),
          ],
        };
      }
      let tieBreak = null;
      if (
        Object.prototype.hasOwnProperty.call(raw, "tieBreakPolicyReference") &&
        /** @type {any} */ (raw).tieBreakPolicyReference != null
      ) {
        const tb = parseCapabilityReference(
          /** @type {any} */ (raw).tieBreakPolicyReference,
          `${fieldPath}.tieBreakPolicyReference`,
          {
            allowedOwners: [
              COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_STANDINGS,
              COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED,
            ],
          }
        );
        if (tb.error) return { value: null, errors: [tb.error] };
        tieBreak = tb.value;
      }
      return {
        value: deepFreeze({
          sectionId: COMPETITION_CONFIGURATION_SECTION.STANDINGS,
          standingsPolicyReference: standings.value,
          tieBreakPolicyReference: tieBreak,
        }),
        errors: [],
      };
    }

    case COMPETITION_CONFIGURATION_SECTION.WORKFLOW: {
      const idErr = requireSectionId(
        raw,
        COMPETITION_CONFIGURATION_SECTION.WORKFLOW,
        fieldPath
      );
      if (idErr) return { value: null, errors: [idErr] };
      // Reject runtime workflow state smuggling.
      if (
        Object.prototype.hasOwnProperty.call(raw, "currentState") ||
        Object.prototype.hasOwnProperty.call(raw, "runtimeInstance") ||
        Object.prototype.hasOwnProperty.call(raw, "transitionHistory")
      ) {
        return {
          value: null,
          errors: [
            createFieldError(
              fieldPath,
              COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
              "workflow section must not contain runtime workflow state",
              {}
            ),
          ],
        };
      }
      const parsed = parseCapabilityReference(
        /** @type {any} */ (raw).workflowDefinitionReference,
        `${fieldPath}.workflowDefinitionReference`,
        {
          allowedOwners: [
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_WORKFLOW,
            COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED,
          ],
        }
      );
      if (parsed.error) return { value: null, errors: [parsed.error] };
      if (!parsed.value) {
        return {
          value: null,
          errors: [
            createFieldError(
              `${fieldPath}.workflowDefinitionReference`,
              COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
              "workflowDefinitionReference is required",
              {}
            ),
          ],
        };
      }
      return {
        value: deepFreeze({
          sectionId: COMPETITION_CONFIGURATION_SECTION.WORKFLOW,
          workflowDefinitionReference: parsed.value,
        }),
        errors: [],
      };
    }

    case COMPETITION_CONFIGURATION_SECTION.OFFICIAL_MODE: {
      const idErr = requireSectionId(
        raw,
        COMPETITION_CONFIGURATION_SECTION.OFFICIAL_MODE,
        fieldPath
      );
      if (idErr) return { value: null, errors: [idErr] };
      const officialMode = /** @type {any} */ (raw).officialMode;
      if (!isCompetitionConfigurationOfficialMode(officialMode)) {
        errors.push(
          createFieldError(
            `${fieldPath}.officialMode`,
            COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
            "officialMode must be official_open|official_ai_balance",
            { value: officialMode }
          )
        );
        return { value: null, errors };
      }
      return {
        value: deepFreeze({
          sectionId: COMPETITION_CONFIGURATION_SECTION.OFFICIAL_MODE,
          officialMode,
        }),
        errors: [],
      };
    }

    case COMPETITION_CONFIGURATION_SECTION.OPERATIONAL_LIMITS: {
      const idErr = requireSectionId(
        raw,
        COMPETITION_CONFIGURATION_SECTION.OPERATIONAL_LIMITS,
        fieldPath
      );
      if (idErr) return { value: null, errors: [idErr] };
      const limits = /** @type {any} */ (raw).limits;
      if (!limits || typeof limits !== "object" || Array.isArray(limits)) {
        return {
          value: null,
          errors: [
            createFieldError(
              `${fieldPath}.limits`,
              COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
              "limits must be a plain object of management thresholds",
              {}
            ),
          ],
        };
      }
      return {
        value: deepFreeze({
          sectionId: COMPETITION_CONFIGURATION_SECTION.OPERATIONAL_LIMITS,
          limits: clonePlain(limits),
        }),
        errors: [],
      };
    }

    default:
      return {
        value: null,
        errors: [
          createFieldError(
            fieldPath,
            COMPETITION_CONFIGURATION_ERROR_CODE.UNKNOWN_SECTION,
            "unknown configuration section identity",
            { sectionId }
          ),
        ],
      };
  }
}

/**
 * Parse sections map — rejects unknown keys and duplicates.
 * @param {unknown} rawSections
 * @returns {{ value: Record<string, object>|null, errors: object[] }}
 */
export function parseConfigurationSections(rawSections) {
  /** @type {object[]} */
  const errors = [];

  if (rawSections == null) {
    return { value: deepFreeze({}), errors: [] };
  }

  if (
    !rawSections ||
    typeof rawSections !== "object" ||
    Array.isArray(rawSections)
  ) {
    return {
      value: null,
      errors: [
        createFieldError(
          "sections",
          COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
          "sections must be a plain object map (empty object allowed for empty draft)",
          {}
        ),
      ],
    };
  }

  const keys = Object.keys(rawSections);
  const seen = new Set();
  /** @type {Record<string, object>} */
  const parsed = {};

  for (const key of keys.sort((a, b) => a.localeCompare(b, "en"))) {
    if (seen.has(key)) {
      errors.push(
        createFieldError(
          `sections.${key}`,
          COMPETITION_CONFIGURATION_ERROR_CODE.DUPLICATE_SECTION,
          "duplicate section identity",
          { sectionId: key }
        )
      );
      continue;
    }
    seen.add(key);

    if (!isCompetitionConfigurationSection(key)) {
      errors.push(
        createFieldError(
          `sections.${key}`,
          COMPETITION_CONFIGURATION_ERROR_CODE.UNKNOWN_SECTION,
          "unknown configuration section identity",
          { sectionId: key }
        )
      );
      continue;
    }

    const sectionResult = parseConfigurationSection(
      key,
      /** @type {any} */ (rawSections)[key],
      `sections.${key}`
    );
    errors.push(...sectionResult.errors);
    if (sectionResult.value) {
      parsed[key] = sectionResult.value;
    }
  }

  if (errors.length > 0) {
    return { value: null, errors };
  }

  // Deterministic key order
  /** @type {Record<string, object>} */
  const ordered = {};
  for (const key of COMPETITION_CONFIGURATION_SECTION_VALUES) {
    if (Object.prototype.hasOwnProperty.call(parsed, key)) {
      ordered[key] = parsed[key];
    }
  }

  return { value: deepFreeze(ordered), errors: [] };
}
