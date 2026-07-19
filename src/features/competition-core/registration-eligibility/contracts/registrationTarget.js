import {
  REGISTRATION_TARGET_TYPE,
  isRegistrationTargetType,
} from "../enums/registrationTargetType.js";
import { isNonEmptyString, requireNonEmptyString } from "./shared.js";

/**
 * RegistrationTarget — who/what is registering (INDIVIDUAL | PAIR | TEAM).
 *
 * @typedef {Object} RegistrationTarget
 * @property {string} targetType
 * @property {string|null} [participantId] — required for INDIVIDUAL
 * @property {string[]} [participantIds] — required for PAIR (exactly 2 distinct)
 * @property {string|null} [teamId] — required for TEAM
 * @property {string|null} [representativeParticipantId]
 */

/**
 * @param {Partial<RegistrationTarget>} partial
 * @param {{ failClosed?: boolean }} [options]
 * @returns {RegistrationTarget}
 */
export function createRegistrationTarget(partial = {}, options = {}) {
  const failClosed = options.failClosed !== false;
  const targetType = isRegistrationTargetType(partial.targetType)
    ? partial.targetType
    : null;

  if (failClosed && !targetType) {
    throw new TypeError("RegistrationTarget requires a valid targetType");
  }

  const participantIds = Array.isArray(partial.participantIds)
    ? partial.participantIds.map((id) => String(id).trim()).filter(Boolean)
    : [];

  const target = {
    targetType: targetType || REGISTRATION_TARGET_TYPE.INDIVIDUAL,
    participantId:
      partial.participantId != null && String(partial.participantId).trim() !== ""
        ? String(partial.participantId).trim()
        : null,
    participantIds,
    teamId:
      partial.teamId != null && String(partial.teamId).trim() !== ""
        ? String(partial.teamId).trim()
        : null,
    representativeParticipantId:
      partial.representativeParticipantId != null &&
      String(partial.representativeParticipantId).trim() !== ""
        ? String(partial.representativeParticipantId).trim()
        : null,
  };

  if (!failClosed) {
    return target;
  }

  return assertRegistrationTarget(target);
}

/**
 * Fail-closed structural validation for a target.
 * @param {RegistrationTarget} target
 * @returns {RegistrationTarget}
 */
export function assertRegistrationTarget(target) {
  if (!isRegistrationTargetType(target?.targetType)) {
    throw new TypeError("RegistrationTarget.targetType is invalid");
  }

  if (target.targetType === REGISTRATION_TARGET_TYPE.INDIVIDUAL) {
    requireNonEmptyString(target.participantId, "participantId");
    return Object.freeze({
      targetType: REGISTRATION_TARGET_TYPE.INDIVIDUAL,
      participantId: String(target.participantId).trim(),
      participantIds: [],
      teamId: null,
      representativeParticipantId: target.representativeParticipantId ?? null,
    });
  }

  if (target.targetType === REGISTRATION_TARGET_TYPE.PAIR) {
    const ids = (Array.isArray(target.participantIds) ? target.participantIds : [])
      .map((id) => String(id).trim())
      .filter(Boolean);
    if (ids.length !== 2) {
      throw new TypeError("PAIR RegistrationTarget requires exactly 2 participantIds");
    }
    if (ids[0] === ids[1]) {
      throw new TypeError("PAIR RegistrationTarget requires distinct participantIds");
    }
    const sorted = [...ids].sort();
    return Object.freeze({
      targetType: REGISTRATION_TARGET_TYPE.PAIR,
      participantId: null,
      participantIds: sorted,
      teamId: null,
      representativeParticipantId: target.representativeParticipantId ?? null,
    });
  }

  requireNonEmptyString(target.teamId, "teamId");
  return Object.freeze({
    targetType: REGISTRATION_TARGET_TYPE.TEAM,
    participantId: null,
    participantIds: [],
    teamId: String(target.teamId).trim(),
    representativeParticipantId: target.representativeParticipantId ?? null,
  });
}

/**
 * Deterministic stable identity material for duplicate / idempotency keys.
 * @param {RegistrationTarget} target
 * @returns {string}
 */
export function buildRegistrationTargetStableIdentity(target) {
  const t = assertRegistrationTarget(target);
  if (t.targetType === REGISTRATION_TARGET_TYPE.INDIVIDUAL) {
    return `INDIVIDUAL::${t.participantId}`;
  }
  if (t.targetType === REGISTRATION_TARGET_TYPE.PAIR) {
    return `PAIR::${t.participantIds.join("+")}`;
  }
  return `TEAM::${t.teamId}`;
}

/**
 * @param {RegistrationTarget|null|undefined} target
 * @returns {boolean}
 */
export function hasValidRegistrationTarget(target) {
  try {
    assertRegistrationTarget(/** @type {RegistrationTarget} */ (target));
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRegistrationTarget(value) {
  return (
    !!value &&
    typeof value === "object" &&
    isRegistrationTargetType(/** @type {any} */ (value).targetType) &&
    hasValidRegistrationTarget(/** @type {RegistrationTarget} */ (value))
  );
}

export { isNonEmptyString };
