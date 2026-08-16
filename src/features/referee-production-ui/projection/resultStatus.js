/**
 * CORE-17 result-status distinction — projection only.
 * CALCULATED SCORE != MATCH COMPLETED != ACCEPTED OFFICIAL RESULT
 */

import { MATCH_STATUS } from "../../competition-core/matches/index.js";
import { REFEREE_VALIDATION_OPS_STATUS } from "../../competition-engine/operations/referee/constants.js";
import { RESULT_STATUS } from "../constants.js";

/**
 * @param {{
 *   matchStatus?: string|null,
 *   validationStatus?: string|null,
 *   scoreProjection?: object|null,
 * }} input
 */
export function projectResultStatus(input = {}) {
  const validation = String(input.validationStatus || "").toUpperCase();
  const matchStatus = String(input.matchStatus || "").toUpperCase();
  const projection = input.scoreProjection || null;
  const calculatedComplete = Boolean(
    projection?.calculatedMatchComplete || projection?.scoringState?.matchComplete
  );
  const calculatedWinner =
    projection?.calculatedWinnerSide ||
    projection?.scoringState?.calculatedWinnerSide ||
    null;

  if (validation === REFEREE_VALIDATION_OPS_STATUS.ACCEPTED) {
    return Object.freeze({
      resultStatus: RESULT_STATUS.ACCEPTED_OFFICIAL,
      officialWinner: true,
      calculatedWinnerSide: calculatedWinner,
      officialWinnerSide: calculatedWinner,
      label: "Kết quả chính thức (CORE-17)",
      calculatedScoreOnly: false,
      matchCompleted: true,
      acceptedOfficialResult: true,
    });
  }
  if (validation === REFEREE_VALIDATION_OPS_STATUS.CORRECTION_REQUIRED) {
    return Object.freeze({
      resultStatus: RESULT_STATUS.CORRECTION_REQUIRED,
      officialWinner: false,
      calculatedWinnerSide: calculatedWinner,
      officialWinnerSide: null,
      label: "Cần correction — chưa phải kết quả chính thức",
      calculatedScoreOnly: true,
      matchCompleted: matchStatus === MATCH_STATUS.COMPLETED,
      acceptedOfficialResult: false,
    });
  }
  if (validation === REFEREE_VALIDATION_OPS_STATUS.REJECTED) {
    return Object.freeze({
      resultStatus: RESULT_STATUS.REJECTED,
      officialWinner: false,
      calculatedWinnerSide: calculatedWinner,
      officialWinnerSide: null,
      label: "Kết quả bị từ chối",
      calculatedScoreOnly: true,
      matchCompleted: matchStatus === MATCH_STATUS.COMPLETED,
      acceptedOfficialResult: false,
    });
  }
  if (validation === REFEREE_VALIDATION_OPS_STATUS.PENDING) {
    return Object.freeze({
      resultStatus: RESULT_STATUS.PENDING_ACCEPTANCE,
      officialWinner: false,
      calculatedWinnerSide: calculatedWinner,
      officialWinnerSide: null,
      label: "Đã tính tỷ số — chờ CORE-17 chấp nhận",
      calculatedScoreOnly: true,
      matchCompleted: matchStatus === MATCH_STATUS.COMPLETED || calculatedComplete,
      acceptedOfficialResult: false,
    });
  }
  if (matchStatus === MATCH_STATUS.COMPLETED) {
    return Object.freeze({
      resultStatus: RESULT_STATUS.MATCH_COMPLETED,
      officialWinner: false,
      calculatedWinnerSide: calculatedWinner,
      officialWinnerSide: null,
      label: "Trận đã hoàn tất — chưa có kết quả chính thức",
      calculatedScoreOnly: true,
      matchCompleted: true,
      acceptedOfficialResult: false,
    });
  }
  if (calculatedComplete) {
    return Object.freeze({
      resultStatus: RESULT_STATUS.CALCULATED_SCORE,
      officialWinner: false,
      calculatedWinnerSide: calculatedWinner,
      officialWinnerSide: null,
      label: "Tỷ số tính toán — chưa hoàn tất / chưa chấp nhận",
      calculatedScoreOnly: true,
      matchCompleted: false,
      acceptedOfficialResult: false,
    });
  }
  return Object.freeze({
    resultStatus: RESULT_STATUS.NONE,
    officialWinner: false,
    calculatedWinnerSide: null,
    officialWinnerSide: null,
    label: "Chưa có kết quả",
    calculatedScoreOnly: true,
    matchCompleted: false,
    acceptedOfficialResult: false,
  });
}
