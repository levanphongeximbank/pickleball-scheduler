import { normalizeClassificationCode } from "./normalizeCode.js";
import { CLASSIFICATION_ERROR_CODE } from "../errors/errorCodes.js";
import { classificationError, classificationFail, classificationOk } from "../errors/classificationError.js";
import { isNonEmptyString } from "../contracts/shared.js";

/**
 * divisionKey = `${competitionId}|division|${normalizedDivisionCode}`
 *
 * @param {string} competitionId
 * @param {string} divisionCode
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function buildDivisionKey(competitionId, divisionCode) {
  if (!isNonEmptyString(competitionId)) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.COMPETITION_ID_REQUIRED,
        "competitionId",
        "competitionId is required to build divisionKey"
      ),
    ]);
  }
  const codeResult = normalizeClassificationCode(divisionCode);
  if (!codeResult.ok) {
    return codeResult;
  }
  return classificationOk(`${String(competitionId).trim()}|division|${codeResult.value}`);
}
