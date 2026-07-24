/**
 * Registration window and planned competition period (CM-01).
 * Timezone is NOT owned — values are absolute instants (ISO-8601 string or epoch ms).
 */

import { COMPETITION_DEFINITION_ERROR_CODE } from "../errors/errorCodes.js";
import { createFieldError } from "./validation.js";
import {
  deepFreeze,
  isValidTimestamp,
  timestampSortValue,
} from "./shared.js";

/**
 * @typedef {Object} CompetitionRegistrationWindow
 * @property {string|number} opensAt
 * @property {string|number} closesAt
 */

/**
 * @typedef {Object} CompetitionPlannedPeriod
 * @property {string|number} startsAt
 * @property {string|number} endsAt
 */

/**
 * @param {unknown} input
 * @param {string} [field]
 * @returns {{ value?: Readonly<CompetitionRegistrationWindow>|null, errors: import("./validation.js").CompetitionDefinitionFieldError[] }}
 */
export function parseRegistrationWindow(input, field = "registrationWindow") {
  if (input == null) return { value: null, errors: [] };
  if (typeof input !== "object") {
    return {
      errors: [
        createFieldError(
          field,
          COMPETITION_DEFINITION_ERROR_CODE.INVALID_REGISTRATION_WINDOW,
          "registrationWindow must be an object with opensAt and closesAt",
          {}
        ),
      ],
    };
  }
  const raw = /** @type {Record<string, unknown>} */ (input);
  /** @type {import("./validation.js").CompetitionDefinitionFieldError[]} */
  const errors = [];
  if (!isValidTimestamp(raw.opensAt)) {
    errors.push(
      createFieldError(
        `${field}.opensAt`,
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_REGISTRATION_WINDOW,
        "opensAt must be a valid timestamp",
        { value: raw.opensAt }
      )
    );
  }
  if (!isValidTimestamp(raw.closesAt)) {
    errors.push(
      createFieldError(
        `${field}.closesAt`,
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_REGISTRATION_WINDOW,
        "closesAt must be a valid timestamp",
        { value: raw.closesAt }
      )
    );
  }
  if (errors.length > 0) return { errors };

  const opensAt = /** @type {string|number} */ (raw.opensAt);
  const closesAt = /** @type {string|number} */ (raw.closesAt);
  if (timestampSortValue(opensAt) > timestampSortValue(closesAt)) {
    errors.push(
      createFieldError(
        field,
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_REGISTRATION_WINDOW,
        "registration opensAt must not be after closesAt",
        { opensAt, closesAt }
      )
    );
    return { errors };
  }

  return {
    value: deepFreeze({ opensAt, closesAt }),
    errors: [],
  };
}

/**
 * @param {unknown} input
 * @param {string} [field]
 * @returns {{ value?: Readonly<CompetitionPlannedPeriod>|null, errors: import("./validation.js").CompetitionDefinitionFieldError[] }}
 */
export function parsePlannedPeriod(input, field = "plannedPeriod") {
  if (input == null) return { value: null, errors: [] };
  if (typeof input !== "object") {
    return {
      errors: [
        createFieldError(
          field,
          COMPETITION_DEFINITION_ERROR_CODE.INVALID_PLANNED_PERIOD,
          "plannedPeriod must be an object with startsAt and endsAt",
          {}
        ),
      ],
    };
  }
  const raw = /** @type {Record<string, unknown>} */ (input);
  /** @type {import("./validation.js").CompetitionDefinitionFieldError[]} */
  const errors = [];
  if (!isValidTimestamp(raw.startsAt)) {
    errors.push(
      createFieldError(
        `${field}.startsAt`,
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_PLANNED_PERIOD,
        "startsAt must be a valid timestamp",
        { value: raw.startsAt }
      )
    );
  }
  if (!isValidTimestamp(raw.endsAt)) {
    errors.push(
      createFieldError(
        `${field}.endsAt`,
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_PLANNED_PERIOD,
        "endsAt must be a valid timestamp",
        { value: raw.endsAt }
      )
    );
  }
  if (errors.length > 0) return { errors };

  const startsAt = /** @type {string|number} */ (raw.startsAt);
  const endsAt = /** @type {string|number} */ (raw.endsAt);
  if (timestampSortValue(startsAt) > timestampSortValue(endsAt)) {
    errors.push(
      createFieldError(
        field,
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_PLANNED_PERIOD,
        "plannedPeriod startsAt must not be after endsAt",
        { startsAt, endsAt }
      )
    );
    return { errors };
  }

  return {
    value: deepFreeze({ startsAt, endsAt }),
    errors: [],
  };
}

/**
 * Domain rule: registration must close at or before competition planned start when both present.
 * @param {CompetitionRegistrationWindow|null|undefined} registrationWindow
 * @param {CompetitionPlannedPeriod|null|undefined} plannedPeriod
 * @returns {import("./validation.js").CompetitionDefinitionFieldError[]}
 */
export function validateRegistrationAgainstPlannedPeriod(
  registrationWindow,
  plannedPeriod
) {
  if (!registrationWindow || !plannedPeriod) return [];
  if (
    timestampSortValue(registrationWindow.closesAt) >
    timestampSortValue(plannedPeriod.startsAt)
  ) {
    return [
      createFieldError(
        "registrationWindow.closesAt",
        COMPETITION_DEFINITION_ERROR_CODE.REGISTRATION_PERIOD_CONFLICT,
        "registration closesAt must not be after plannedPeriod startsAt",
        {
          closesAt: registrationWindow.closesAt,
          startsAt: plannedPeriod.startsAt,
        }
      ),
    ];
  }
  return [];
}
