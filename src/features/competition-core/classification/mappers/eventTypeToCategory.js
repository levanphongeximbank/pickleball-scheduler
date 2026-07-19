import { createCompetitionCategory } from "../categories/createCompetitionCategory.js";
import { GENDER_CLASS } from "../enums/genderClass.js";
import { ACCESS_MODE } from "../enums/accessMode.js";
import { createApplicability } from "../enums/applicability.js";
import { createEligibilityDescriptor } from "../contracts/eligibility.js";
import { CLASSIFICATION_ERROR_CODE } from "../errors/errorCodes.js";
import { classificationOk, classificationWarning } from "../errors/classificationError.js";

/** Known legacy EVENT_TYPE values (Individual / Internal / Official). */
export const LEGACY_EVENT_TYPE = Object.freeze({
  MEN_SINGLE: "men_single",
  WOMEN_SINGLE: "women_single",
  MEN_DOUBLE: "men_double",
  WOMEN_DOUBLE: "women_double",
  MIXED_DOUBLE: "mixed_double",
  OPEN_DOUBLE: "open_double",
});

const EVENT_TYPE_MAP = Object.freeze({
  [LEGACY_EVENT_TYPE.MEN_SINGLE]: {
    genderClass: GENDER_CLASS.MALE,
    access: ACCESS_MODE.RESTRICTED,
    applicability: { individual: true, doubles: false, mixed: false, team: false },
  },
  [LEGACY_EVENT_TYPE.WOMEN_SINGLE]: {
    genderClass: GENDER_CLASS.FEMALE,
    access: ACCESS_MODE.RESTRICTED,
    applicability: { individual: true, doubles: false, mixed: false, team: false },
  },
  [LEGACY_EVENT_TYPE.MEN_DOUBLE]: {
    genderClass: GENDER_CLASS.MALE,
    access: ACCESS_MODE.RESTRICTED,
    applicability: { individual: false, doubles: true, mixed: false, team: false },
  },
  [LEGACY_EVENT_TYPE.WOMEN_DOUBLE]: {
    genderClass: GENDER_CLASS.FEMALE,
    access: ACCESS_MODE.RESTRICTED,
    applicability: { individual: false, doubles: true, mixed: false, team: false },
  },
  [LEGACY_EVENT_TYPE.MIXED_DOUBLE]: {
    genderClass: GENDER_CLASS.MIXED,
    access: ACCESS_MODE.RESTRICTED,
    applicability: { individual: false, doubles: true, mixed: true, team: false },
  },
  [LEGACY_EVENT_TYPE.OPEN_DOUBLE]: {
    genderClass: GENDER_CLASS.OPEN,
    access: ACCESS_MODE.OPEN,
    applicability: { individual: false, doubles: true, mixed: false, team: false },
  },
});

/**
 * Pure map: EVENT_TYPE → CompetitionCategory descriptor.
 * Does not write data or call eligibility engines.
 *
 * @param {{
 *   eventType?: string,
 *   tenantId?: string,
 *   competitionId?: string,
 *   tournamentId?: string,
 *   id?: string,
 *   eventId?: string,
 *   name?: string,
 *   label?: string,
 *   [key: string]: unknown,
 * }} source
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function mapEventTypeToCategory(source = {}) {
  const warnings = [];
  const raw = String(source.eventType || source.code || "")
    .trim()
    .toLowerCase();
  const mapped = EVENT_TYPE_MAP[raw];
  const unknown = !mapped;

  if (unknown) {
    warnings.push(
      classificationWarning(
        CLASSIFICATION_ERROR_CODE.MAPPING_UNSUPPORTED,
        "eventType",
        "Unsupported EVENT_TYPE; mapped with unspecified genderClass",
        { eventType: raw || null }
      )
    );
  }

  const facet = mapped || {
    genderClass: GENDER_CLASS.UNSPECIFIED,
    access: ACCESS_MODE.OPEN,
    applicability: { individual: false, doubles: false, mixed: false, team: false },
  };

  const code = unknown ? raw || "unknown_event_type" : raw;
  const category = createCompetitionCategory({
    id: String(source.id || source.eventId || ""),
    tenantId: String(source.tenantId || ""),
    competitionId: String(source.competitionId || source.tournamentId || ""),
    code,
    name: String(source.name || source.label || code),
    label: source.label != null ? String(source.label) : null,
    genderClass: facet.genderClass,
    access: facet.access,
    applicability: createApplicability(facet.applicability),
    eligibilityDescriptor: createEligibilityDescriptor({
      genderClass: facet.genderClass,
      access: facet.access,
    }),
    extensions: {
      formatKey: "individual_tournament",
      payload: {
        legacyEventType: raw || null,
        unknownFields: preserveUnknown(source, [
          "eventType",
          "code",
          "tenantId",
          "competitionId",
          "tournamentId",
          "id",
          "eventId",
          "name",
          "label",
        ]),
      },
    },
  });

  return classificationOk(category, warnings);
}

/**
 * @param {Record<string, unknown>} source
 * @param {string[]} knownKeys
 * @returns {Record<string, unknown>}
 */
function preserveUnknown(source, knownKeys) {
  const known = new Set(knownKeys);
  const out = {};
  for (const key of Object.keys(source || {}).sort()) {
    if (!known.has(key)) {
      out[key] = source[key];
    }
  }
  return out;
}
