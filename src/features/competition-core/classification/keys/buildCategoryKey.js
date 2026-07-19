import { normalizeClassificationCode } from "./normalizeCode.js";
import { CLASSIFICATION_ERROR_CODE } from "../errors/errorCodes.js";
import { classificationError, classificationFail, classificationOk } from "../errors/classificationError.js";
import { isNonEmptyString } from "../contracts/shared.js";

/**
 * categoryKey = `${competitionId}|category|${normalizedCategoryCode}`
 *
 * @param {string} competitionId
 * @param {string} categoryCode
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function buildCategoryKey(competitionId, categoryCode) {
  if (!isNonEmptyString(competitionId)) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.COMPETITION_ID_REQUIRED,
        "competitionId",
        "competitionId is required to build categoryKey"
      ),
    ]);
  }
  const codeResult = normalizeClassificationCode(categoryCode);
  if (!codeResult.ok) {
    return codeResult;
  }
  return classificationOk(`${String(competitionId).trim()}|category|${codeResult.value}`);
}
