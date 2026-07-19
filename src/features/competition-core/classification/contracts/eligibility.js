import { ACCESS_MODE, isAccessMode } from "../enums/accessMode.js";
import { GENDER_CLASS, isGenderClass } from "../enums/genderClass.js";
import { toNullableNumber } from "./shared.js";

/**
 * Eligibility descriptor — configuration data only.
 * Core-04 never evaluates these fields against participants.
 *
 * @typedef {Object} AgeBandDescriptor
 * @property {number|null} [minAge]
 * @property {number|null} [maxAge]
 * @property {string|null} [asOfPolicyRef]
 */

/**
 * @typedef {Object} RatingBandDescriptor
 * @property {number|null} [min]
 * @property {number|null} [max]
 * @property {string|null} [sourceHint]
 */

/**
 * @typedef {Object} SkillBandDescriptor
 * @property {number|null} [min]
 * @property {number|null} [max]
 * @property {string|null} [sourceHint]
 */

/**
 * @typedef {Object} EligibilityDescriptor
 * @property {string|null} [participantType]
 * @property {string} [genderClass]
 * @property {AgeBandDescriptor|null} [ageBand]
 * @property {RatingBandDescriptor|null} [ratingBand]
 * @property {SkillBandDescriptor|null} [skillBand]
 * @property {number|null} [teamSize]
 * @property {number|null} [rosterSize]
 * @property {string} [access]
 * @property {string|null} [eligibilityPolicyRef]
 * @property {string|null} [restrictionPolicyRef]
 */

/**
 * @param {Partial<AgeBandDescriptor>|null|undefined} partial
 * @returns {AgeBandDescriptor|null}
 */
export function createAgeBandDescriptor(partial) {
  if (!partial || typeof partial !== "object") {
    return null;
  }
  return {
    minAge: toNullableNumber(partial.minAge),
    maxAge: toNullableNumber(partial.maxAge),
    asOfPolicyRef: partial.asOfPolicyRef != null ? String(partial.asOfPolicyRef) : null,
  };
}

/**
 * @param {Partial<RatingBandDescriptor>|null|undefined} partial
 * @returns {RatingBandDescriptor|null}
 */
export function createRatingBandDescriptor(partial) {
  if (!partial || typeof partial !== "object") {
    return null;
  }
  return {
    min: toNullableNumber(partial.min),
    max: toNullableNumber(partial.max),
    sourceHint: partial.sourceHint != null ? String(partial.sourceHint) : null,
  };
}

/**
 * @param {Partial<SkillBandDescriptor>|null|undefined} partial
 * @returns {SkillBandDescriptor|null}
 */
export function createSkillBandDescriptor(partial) {
  if (!partial || typeof partial !== "object") {
    return null;
  }
  return {
    min: toNullableNumber(partial.min),
    max: toNullableNumber(partial.max),
    sourceHint: partial.sourceHint != null ? String(partial.sourceHint) : null,
  };
}

/**
 * @param {Partial<EligibilityDescriptor>|null|undefined} partial
 * @returns {EligibilityDescriptor}
 */
export function createEligibilityDescriptor(partial = {}) {
  const genderClass = isGenderClass(partial?.genderClass)
    ? partial.genderClass
    : GENDER_CLASS.UNSPECIFIED;
  const access = isAccessMode(partial?.access) ? partial.access : ACCESS_MODE.OPEN;

  return {
    participantType: partial?.participantType != null ? String(partial.participantType) : null,
    genderClass,
    ageBand: createAgeBandDescriptor(partial?.ageBand),
    ratingBand: createRatingBandDescriptor(partial?.ratingBand),
    skillBand: createSkillBandDescriptor(partial?.skillBand),
    teamSize: toNullableNumber(partial?.teamSize),
    rosterSize: toNullableNumber(partial?.rosterSize),
    access,
    eligibilityPolicyRef:
      partial?.eligibilityPolicyRef != null ? String(partial.eligibilityPolicyRef) : null,
    restrictionPolicyRef:
      partial?.restrictionPolicyRef != null ? String(partial.restrictionPolicyRef) : null,
  };
}
