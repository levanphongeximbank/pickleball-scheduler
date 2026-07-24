/**
 * Canonical CompetitionDefinition aggregate contract (CM-01).
 *
 * Persistence-agnostic, UI-agnostic. Does not include match/runtime/payment/notification state.
 */

import {
  COMPETITION_DEFINITION_NAME_MAX_LENGTH,
  COMPETITION_DEFINITION_DESCRIPTION_MAX_LENGTH,
  COMPETITION_DEFINITION_STATUS,
  COMPETITION_SCOPE,
  isCompetitionType,
  isCompetitionScope,
  isCompetitionVisibility,
  isCompetitionDefinitionStatus,
  isValidCompetitionDefinitionRevision,
  COMPETITION_DEFINITION_INITIAL_REVISION,
} from "../constants/index.js";
import { COMPETITION_DEFINITION_ERROR_CODE } from "../errors/errorCodes.js";
import { createFieldError, validationOk, validationFail } from "./validation.js";
import {
  parseOwnerReference,
  parseVenueReference,
  parseClubReference,
  parseTemplateReference,
  parseRuleSetReference,
} from "./references.js";
import {
  parseRegistrationWindow,
  parsePlannedPeriod,
  validateRegistrationAgainstPlannedPeriod,
} from "./periods.js";
import { deepFreeze, isNonEmptyString, isValidTimestamp } from "./shared.js";

/**
 * @typedef {Object} CompetitionDefinition
 * @property {string} competitionId
 * @property {string} tenantId
 * @property {import("./references.js").CompetitionOwnerReference} owner
 * @property {string} name
 * @property {string} description
 * @property {string} competitionType
 * @property {string} scope
 * @property {string} visibility
 * @property {string} status
 * @property {number} revision
 * @property {readonly import("./references.js").CompetitionVenueReference[]} venues
 * @property {readonly import("./references.js").CompetitionClubReference[]} clubs
 * @property {import("./periods.js").CompetitionRegistrationWindow|null} registrationWindow
 * @property {import("./periods.js").CompetitionPlannedPeriod|null} plannedPeriod
 * @property {import("./references.js").CompetitionTemplateReference|null} template
 * @property {import("./references.js").CompetitionRuleSetReference|null} ruleSet
 * @property {string|number} createdAt
 * @property {string|number} updatedAt
 */

/**
 * Collect scope ↔ club/venue association errors (fail-closed, no inference).
 * @param {string|undefined} scope
 * @param {readonly import("./references.js").CompetitionClubReference[]} clubs
 * @param {readonly import("./references.js").CompetitionVenueReference[]} venues
 * @returns {import("./validation.js").CompetitionDefinitionFieldError[]}
 */
export function collectScopeAssociationErrors(scope, clubs, venues) {
  /** @type {import("./validation.js").CompetitionDefinitionFieldError[]} */
  const errors = [];
  if (!isCompetitionScope(scope)) return errors;

  if (scope === COMPETITION_SCOPE.CLUB) {
    if (clubs.length !== 1) {
      errors.push(
        createFieldError(
          "clubs",
          COMPETITION_DEFINITION_ERROR_CODE.SCOPE_ASSOCIATION_CONFLICT,
          "scope=club requires exactly one club reference",
          { clubCount: clubs.length }
        )
      );
    }
  } else if (scope === COMPETITION_SCOPE.MULTI_CLUB) {
    if (clubs.length < 2) {
      errors.push(
        createFieldError(
          "clubs",
          COMPETITION_DEFINITION_ERROR_CODE.SCOPE_ASSOCIATION_CONFLICT,
          "scope=multi_club requires at least two club references",
          { clubCount: clubs.length }
        )
      );
    }
  } else if (scope === COMPETITION_SCOPE.TENANT) {
    // Clubs optional; venues optional. No silent venue/club inference.
  } else if (scope === COMPETITION_SCOPE.OPEN) {
    // Open competitions may omit club associations; venues remain optional references.
    if (clubs.length > 0) {
      errors.push(
        createFieldError(
          "clubs",
          COMPETITION_DEFINITION_ERROR_CODE.SCOPE_ASSOCIATION_CONFLICT,
          "scope=open must not include club associations",
          { clubCount: clubs.length }
        )
      );
    }
  }

  // Duplicate club/venue ids are conflicts (deterministic).
  const clubIds = clubs.map((c) => c.clubId);
  if (new Set(clubIds).size !== clubIds.length) {
    errors.push(
      createFieldError(
        "clubs",
        COMPETITION_DEFINITION_ERROR_CODE.SCOPE_ASSOCIATION_CONFLICT,
        "duplicate clubId in clubs",
        {}
      )
    );
  }
  const venueIds = venues.map((v) => v.venueId);
  if (new Set(venueIds).size !== venueIds.length) {
    errors.push(
      createFieldError(
        "venues",
        COMPETITION_DEFINITION_ERROR_CODE.SCOPE_ASSOCIATION_CONFLICT,
        "duplicate venueId in venues",
        {}
      )
    );
  }

  return errors;
}

/**
 * Validate and normalize a CompetitionDefinition candidate (no mutation of input).
 * Does not silently repair invalid fields.
 *
 * @param {object} input
 * @param {{ requireDraftStatus?: boolean }} [options]
 * @returns {import("./validation.js").CompetitionDefinitionValidationResult}
 */
export function validateCompetitionDefinitionInput(input = {}, options = {}) {
  /** @type {import("./validation.js").CompetitionDefinitionFieldError[]} */
  const errors = [];
  const src = input && typeof input === "object" ? input : {};

  /** @type {string|undefined} */
  let competitionId;
  if (!isNonEmptyString(src.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_IDENTIFIER,
        "competitionId is required",
        {}
      )
    );
  } else {
    competitionId = String(src.competitionId).trim();
  }

  /** @type {string|undefined} */
  let tenantId;
  if (!isNonEmptyString(src.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_IDENTIFIER,
        "tenantId is required",
        {}
      )
    );
  } else {
    tenantId = String(src.tenantId).trim();
  }

  const ownerParsed = parseOwnerReference(src.owner, "owner");
  if (ownerParsed.error) errors.push(ownerParsed.error);

  /** @type {string|undefined} */
  let name;
  if (!isNonEmptyString(src.name)) {
    errors.push(
      createFieldError(
        "name",
        COMPETITION_DEFINITION_ERROR_CODE.EMPTY_NAME,
        "canonical name must be a non-empty string",
        {}
      )
    );
  } else {
    name = String(src.name).trim();
    if (name.length > COMPETITION_DEFINITION_NAME_MAX_LENGTH) {
      errors.push(
        createFieldError(
          "name",
          COMPETITION_DEFINITION_ERROR_CODE.EMPTY_NAME,
          `canonical name must be at most ${COMPETITION_DEFINITION_NAME_MAX_LENGTH} characters`,
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
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_DESCRIPTION,
        "description must be a string when provided",
        {}
      )
    );
  } else {
    description = src.description;
    if (description.length > COMPETITION_DEFINITION_DESCRIPTION_MAX_LENGTH) {
      errors.push(
        createFieldError(
          "description",
          COMPETITION_DEFINITION_ERROR_CODE.INVALID_DESCRIPTION,
          `description must be at most ${COMPETITION_DEFINITION_DESCRIPTION_MAX_LENGTH} characters`,
          { length: description.length }
        )
      );
    }
  }

  /** @type {string|undefined} */
  let competitionType;
  if (!isCompetitionType(src.competitionType)) {
    errors.push(
      createFieldError(
        "competitionType",
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_COMPETITION_TYPE,
        "competitionType is missing or not in the CM-01 allowlist",
        { value: src.competitionType }
      )
    );
  } else {
    competitionType = String(src.competitionType);
  }

  /** @type {string|undefined} */
  let scope;
  if (!isCompetitionScope(src.scope)) {
    errors.push(
      createFieldError(
        "scope",
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_SCOPE,
        "scope is missing or not in the CM-01 allowlist",
        { value: src.scope }
      )
    );
  } else {
    scope = String(src.scope);
  }

  /** @type {string|undefined} */
  let visibility;
  if (!isCompetitionVisibility(src.visibility)) {
    errors.push(
      createFieldError(
        "visibility",
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_VISIBILITY,
        "visibility is missing or not in the CM-01 allowlist",
        { value: src.visibility }
      )
    );
  } else {
    visibility = String(src.visibility);
  }

  const status =
    src.status == null ? COMPETITION_DEFINITION_STATUS.DRAFT : src.status;
  if (!isCompetitionDefinitionStatus(status)) {
    errors.push(
      createFieldError(
        "status",
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_STATUS,
        "status is not a valid Competition Management lifecycle value",
        { value: status }
      )
    );
  }
  if (options.requireDraftStatus && status !== COMPETITION_DEFINITION_STATUS.DRAFT) {
    errors.push(
      createFieldError(
        "status",
        COMPETITION_DEFINITION_ERROR_CODE.NOT_DRAFT,
        "operation requires draft status",
        { status }
      )
    );
  }

  const revision =
    src.revision == null
      ? COMPETITION_DEFINITION_INITIAL_REVISION
      : src.revision;
  if (!isValidCompetitionDefinitionRevision(revision)) {
    errors.push(
      createFieldError(
        "revision",
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_REVISION,
        "revision must be an integer >= 1",
        { value: revision }
      )
    );
  }

  /** @type {import("./references.js").CompetitionVenueReference[]} */
  const venues = [];
  if (src.venues == null) {
    // empty ok
  } else if (!Array.isArray(src.venues)) {
    errors.push(
      createFieldError(
        "venues",
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_VENUE_REFERENCE,
        "venues must be an array when provided",
        {}
      )
    );
  } else {
    src.venues.forEach((item, index) => {
      const parsed = parseVenueReference(item, `venues[${index}]`);
      if (parsed.error) errors.push(parsed.error);
      else if (parsed.value) venues.push(parsed.value);
    });
  }

  /** @type {import("./references.js").CompetitionClubReference[]} */
  const clubs = [];
  if (src.clubs == null) {
    // empty
  } else if (!Array.isArray(src.clubs)) {
    errors.push(
      createFieldError(
        "clubs",
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_CLUB_REFERENCE,
        "clubs must be an array when provided",
        {}
      )
    );
  } else {
    src.clubs.forEach((item, index) => {
      const parsed = parseClubReference(item, `clubs[${index}]`);
      if (parsed.error) errors.push(parsed.error);
      else if (parsed.value) clubs.push(parsed.value);
    });
  }

  errors.push(...collectScopeAssociationErrors(scope, clubs, venues));

  const regParsed = parseRegistrationWindow(src.registrationWindow);
  errors.push(...regParsed.errors);
  const plannedParsed = parsePlannedPeriod(src.plannedPeriod);
  errors.push(...plannedParsed.errors);
  if (regParsed.value && plannedParsed.value) {
    errors.push(
      ...validateRegistrationAgainstPlannedPeriod(
        regParsed.value,
        plannedParsed.value
      )
    );
  }

  const templateParsed = parseTemplateReference(src.template);
  if (templateParsed.error) errors.push(templateParsed.error);
  const ruleSetParsed = parseRuleSetReference(src.ruleSet);
  if (ruleSetParsed.error) errors.push(ruleSetParsed.error);

  /** @type {string|number|undefined} */
  let createdAt;
  if (!isValidTimestamp(src.createdAt)) {
    errors.push(
      createFieldError(
        "createdAt",
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_CONTRACT,
        "createdAt must be a valid timestamp",
        { value: src.createdAt }
      )
    );
  } else {
    createdAt = /** @type {string|number} */ (src.createdAt);
  }

  /** @type {string|number|undefined} */
  let updatedAt;
  if (!isValidTimestamp(src.updatedAt)) {
    errors.push(
      createFieldError(
        "updatedAt",
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_CONTRACT,
        "updatedAt must be a valid timestamp",
        { value: src.updatedAt }
      )
    );
  } else {
    updatedAt = /** @type {string|number} */ (src.updatedAt);
  }

  // Reject UI-specific / runtime keys if present as owned canonical fields.
  // (We ignore unknown keys rather than copying them into the canonical output.)

  if (errors.length > 0) {
    return validationFail(errors);
  }

  /** @type {CompetitionDefinition} */
  const definition = {
    competitionId: /** @type {string} */ (competitionId),
    tenantId: /** @type {string} */ (tenantId),
    owner: /** @type {import("./references.js").CompetitionOwnerReference} */ (
      ownerParsed.value
    ),
    name: /** @type {string} */ (name),
    description,
    competitionType: /** @type {string} */ (competitionType),
    scope: /** @type {string} */ (scope),
    visibility: /** @type {string} */ (visibility),
    status: String(status),
    revision: /** @type {number} */ (revision),
    venues: Object.freeze([...venues]),
    clubs: Object.freeze([...clubs]),
    registrationWindow: regParsed.value ?? null,
    plannedPeriod: plannedParsed.value ?? null,
    template: templateParsed.value ?? null,
    ruleSet: ruleSetParsed.value ?? null,
    createdAt: /** @type {string|number} */ (createdAt),
    updatedAt: /** @type {string|number} */ (updatedAt),
  };

  return validationOk(deepFreeze(definition));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionDefinition(value) {
  if (!value || typeof value !== "object") return false;
  const result = validateCompetitionDefinitionInput(
    /** @type {object} */ (value)
  );
  return result.ok === true;
}
