/**
 * P1.2 S1-D — drift + engine-version policy (OD-F / Engine Version Lock).
 * No silent repair. No automatic regeneration.
 */

import { DEFAULT_ENGINE_VERSION } from "../canonical/teamTournamentMutationEnvelope.js";
import { SETUP_MUTATION_CODES } from "./setupMutationCodes.js";

/**
 * @param {object} params
 * @param {string} params.dataMode
 * @param {boolean} [params.driftDetected]
 * @param {object|null} [params.diagnostic]
 * @param {boolean} [params.confirmDestructive]
 * @param {boolean} [params.reloadAcknowledged] BTC reloaded/reviewed after warn
 * @returns {{
 *   allow: boolean,
 *   warn: boolean,
 *   code: string|null,
 *   error: string|null,
 *   setupBlocked: boolean,
 *   setupBlockCode: string|null
 * }}
 */
export function evaluateSetupDriftPolicy(params = {}) {
  const mode = String(params.dataMode || "").trim();
  const diagnostic = params.diagnostic && typeof params.diagnostic === "object"
    ? params.diagnostic
    : null;
  const driftDetected =
    params.driftDetected === true ||
    diagnostic?.driftDetected === true ||
    diagnostic?.driftCode === "NORMALIZED_READ_DRIFT" ||
    diagnostic?.driftCode === "SNAPSHOT_NOT_INITIALIZED";

  if (!driftDetected) {
    return {
      allow: true,
      warn: false,
      code: null,
      error: null,
      setupBlocked: false,
      setupBlockCode: null,
    };
  }

  if (mode === "cloud_only") {
    return {
      allow: false,
      warn: true,
      code: SETUP_MUTATION_CODES.DRIFT_BLOCK,
      error:
        "Phát hiện drift snapshot — cloud_only chặn mọi setup mutation. Tải lại và review trước khi tiếp tục.",
      setupBlocked: true,
      setupBlockCode: SETUP_MUTATION_CODES.DRIFT_BLOCK,
    };
  }

  if (mode === "cloud_primary") {
    const destructive = params.confirmDestructive === true;
    if (destructive && params.reloadAcknowledged !== true) {
      return {
        allow: false,
        warn: true,
        code: SETUP_MUTATION_CODES.DRIFT_BLOCK,
        error:
          "Phát hiện drift snapshot — chặn setup mutation phá hủy cho đến khi BTC reload/review.",
        setupBlocked: true,
        setupBlockCode: SETUP_MUTATION_CODES.DRIFT_BLOCK,
      };
    }
    return {
      allow: !destructive || params.reloadAcknowledged === true,
      warn: true,
      code: SETUP_MUTATION_CODES.DRIFT_WARN,
      error:
        "Cảnh báo drift snapshot (cloud_primary). Không tự sửa. Hãy reload/review trước thao tác phá hủy.",
      setupBlocked: destructive && params.reloadAcknowledged !== true,
      setupBlockCode:
        destructive && params.reloadAcknowledged !== true
          ? SETUP_MUTATION_CODES.DRIFT_BLOCK
          : SETUP_MUTATION_CODES.DRIFT_WARN,
    };
  }

  // legacy / shadow / unknown — foundation still surfaces warn; block confirmed writes
  return {
    allow: false,
    warn: true,
    code: SETUP_MUTATION_CODES.DRIFT_BLOCK,
    error: "Phát hiện drift snapshot — setup mutation foundation chặn ghi cho đến khi review.",
    setupBlocked: true,
    setupBlockCode: SETUP_MUTATION_CODES.DRIFT_BLOCK,
  };
}

/**
 * @param {object} params
 * @param {string|null|undefined} params.snapshotEngineVersion
 * @param {string|null|undefined} [params.currentEngineVersion]
 * @param {boolean} [params.allowRebuild]
 * @param {boolean} [params.phase] 'read' | 'confirm'
 * @returns {{
 *   allowRead: boolean,
 *   allowConfirm: boolean,
 *   warn: boolean,
 *   code: string|null,
 *   error: string|null
 * }}
 */
export function evaluateEngineVersionPolicy(params = {}) {
  const current = String(params.currentEngineVersion || DEFAULT_ENGINE_VERSION).trim();
  const snapshot = params.snapshotEngineVersion == null || params.snapshotEngineVersion === ""
    ? null
    : String(params.snapshotEngineVersion).trim();

  if (!snapshot || snapshot === current) {
    return {
      allowRead: true,
      allowConfirm: true,
      warn: false,
      code: null,
      error: null,
    };
  }

  const allowRebuild = params.allowRebuild === true;
  return {
    allowRead: true,
    allowConfirm: allowRebuild,
    warn: true,
    code: SETUP_MUTATION_CODES.ENGINE_VERSION_MISMATCH,
    error: allowRebuild
      ? `engineVersion lệch (snapshot=${snapshot}, current=${current}) — rebuild đã được approve tường minh.`
      : `engineVersion lệch (snapshot=${snapshot}, current=${current}). Cho phép đọc; chặn confirm rebuild trừ khi approve tường minh.`,
  };
}
