import { normalizeClassificationCode } from "./normalizeCode.js";
import { CLASSIFICATION_ERROR_CODE } from "../errors/errorCodes.js";
import { classificationError, classificationFail, classificationOk } from "../errors/classificationError.js";
import { isNonEmptyString } from "../contracts/shared.js";

/**
 * divisionCategoryKey =
 * `${competitionId}|division-category|${normalizedDivisionCode}|${normalizedCategoryCode}`
 *
 * @param {string} competitionId
 * @param {string} divisionCode
 * @param {string} categoryCode
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function buildDivisionCategoryKey(competitionId, divisionCode, categoryCode) {
  if (!isNonEmptyString(competitionId)) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.COMPETITION_ID_REQUIRED,
        "competitionId",
        "competitionId is required to build divisionCategoryKey"
      ),
    ]);
  }
  const divCode = normalizeClassificationCode(divisionCode);
  if (!divCode.ok) {
    return divCode;
  }
  const catCode = normalizeClassificationCode(categoryCode);
  if (!catCode.ok) {
    return catCode;
  }
  return classificationOk(
    `${String(competitionId).trim()}|division-category|${divCode.value}|${catCode.value}`
  );
}
