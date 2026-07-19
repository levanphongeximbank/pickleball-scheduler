import { createCompetitionCategory } from "../categories/createCompetitionCategory.js";
import { GENDER_CLASS } from "../enums/genderClass.js";
import { ACCESS_MODE } from "../enums/accessMode.js";
import { createApplicability } from "../enums/applicability.js";
import { createEligibilityDescriptor } from "../contracts/eligibility.js";
import { CLASSIFICATION_ERROR_CODE } from "../errors/errorCodes.js";
import { classificationOk, classificationWarning } from "../errors/classificationError.js";

const DISCIPLINE_CATEGORY = Object.freeze({
  SINGLES: "singles",
  DOUBLES: "doubles",
  MIXED: "mixed",
});

const GENDER_REQUIREMENT = Object.freeze({
  MALE: "male",
  FEMALE: "female",
  ANY: "any",
  MIXED_PAIR: "mixed_pair",
});

/**
 * Pure map: TT discipline categoryType + genderRequirement → CompetitionCategory descriptor.
 * Does not import team-tournament engines.
 *
 * @param {{
 *   categoryType?: string,
 *   genderRequirement?: string,
 *   name?: string,
 *   tenantId?: string,
 *   competitionId?: string,
 *   tournamentId?: string,
 *   id?: string,
 *   [key: string]: unknown,
 * }} source
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function mapTtDisciplineToCategory(source = {}) {
  const warnings = [];
  const categoryType = String(source.categoryType || "")
    .trim()
    .toLowerCase();
  const genderRequirement = String(source.genderRequirement || "")
    .trim()
    .toLowerCase();

  const knownCategory = Object.values(DISCIPLINE_CATEGORY).includes(categoryType);
  const knownGender = Object.values(GENDER_REQUIREMENT).includes(genderRequirement);

  if (!knownCategory) {
    warnings.push(
      classificationWarning(
        CLASSIFICATION_ERROR_CODE.MAPPING_UNSUPPORTED,
        "categoryType",
        "Unsupported TT discipline categoryType",
        { categoryType: categoryType || null }
      )
    );
  }
  if (genderRequirement && !knownGender) {
    warnings.push(
      classificationWarning(
        CLASSIFICATION_ERROR_CODE.MAPPING_UNSUPPORTED,
        "genderRequirement",
        "Unsupported TT genderRequirement",
        { genderRequirement }
      )
    );
  }

  let genderClass = GENDER_CLASS.UNSPECIFIED;
  if (genderRequirement === GENDER_REQUIREMENT.MALE) genderClass = GENDER_CLASS.MALE;
  else if (genderRequirement === GENDER_REQUIREMENT.FEMALE) genderClass = GENDER_CLASS.FEMALE;
  else if (genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR) genderClass = GENDER_CLASS.MIXED;
  else if (genderRequirement === GENDER_REQUIREMENT.ANY) genderClass = GENDER_CLASS.OPEN;
  else if (categoryType === DISCIPLINE_CATEGORY.MIXED) genderClass = GENDER_CLASS.MIXED;

  const applicability = createApplicability({
    individual: categoryType === DISCIPLINE_CATEGORY.SINGLES,
    doubles:
      categoryType === DISCIPLINE_CATEGORY.DOUBLES || categoryType === DISCIPLINE_CATEGORY.MIXED,
    mixed: categoryType === DISCIPLINE_CATEGORY.MIXED,
    team: true,
  });

  const codeParts = [categoryType || "discipline", genderRequirement || "any"].filter(Boolean);
  const code = codeParts.join("_");

  const category = createCompetitionCategory({
    id: String(source.id || ""),
    tenantId: String(source.tenantId || ""),
    competitionId: String(source.competitionId || source.tournamentId || ""),
    code,
    name: String(source.name || code),
    genderClass,
    access: genderClass === GENDER_CLASS.OPEN ? ACCESS_MODE.OPEN : ACCESS_MODE.RESTRICTED,
    applicability,
    eligibilityDescriptor: createEligibilityDescriptor({
      genderClass,
      access: genderClass === GENDER_CLASS.OPEN ? ACCESS_MODE.OPEN : ACCESS_MODE.RESTRICTED,
      participantType: "team_discipline",
    }),
    extensions: {
      formatKey: "team_tournament",
      payload: {
        legacyCategoryType: categoryType || null,
        legacyGenderRequirement: genderRequirement || null,
        unknownFields: preserveUnknown(source, [
          "categoryType",
          "genderRequirement",
          "name",
          "tenantId",
          "competitionId",
          "tournamentId",
          "id",
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
