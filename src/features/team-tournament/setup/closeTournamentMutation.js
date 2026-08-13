/**
 * tournament.close mutation contract (pure helpers).
 *
 * Close is a confirmed setup mutation like update_setup_config: it carries the
 * canonical snapshot package and must never be persisted from a preview-only
 * round trip. Awards/standings are server-derived — the client only sends the
 * close reason plus the snapshot it read.
 */

import { attachSnapshotPackageToPayload } from "./buildSetupMutationSnapshotPackage.js";
import { SETUP_MUTATION_CODES } from "./setupMutationCodes.js";

export const CLOSE_TOURNAMENT_COMMAND = "tournament.close";
export const CLOSE_DEFAULT_REASON = "tournament.close";
export const CLOSE_NOT_PERSISTED_CODE = "CLOSE_NOT_PERSISTED";

/**
 * Close payload = { reason } + snapshot fields. No client awards/standings.
 * @param {{ reason?: string }} [payload]
 * @param {object} [snapshotPackage]
 * @returns {object}
 */
export function buildCloseTournamentPayload(payload = {}, snapshotPackage = null) {
  const base = { reason: payload.reason || CLOSE_DEFAULT_REASON };
  if (!snapshotPackage) {
    return base;
  }
  return attachSnapshotPackageToPayload(base, snapshotPackage);
}

/**
 * A close round trip only counts when the RPC actually ran.
 * runSetupMutation returns ok:true for preview-only — that is NOT a close.
 * @param {object|null|undefined} result
 * @returns {boolean}
 */
export function isCloseMutationPersisted(result) {
  if (!result?.ok) {
    return false;
  }
  if (result.rpcCalled === false) {
    return false;
  }
  return String(result.code || "") !== SETUP_MUTATION_CODES.PREVIEW_ONLY;
}

/**
 * UI-facing outcome: preview-only / un-executed RPC must not celebrate.
 * @param {object|null|undefined} result
 * @returns {{ ok: boolean, code?: string, error?: string }}
 */
export function resolveCloseMutationOutcome(result) {
  if (!result?.ok) {
    return {
      ok: false,
      code: result?.code || CLOSE_NOT_PERSISTED_CODE,
      error: result?.error || "Đóng giải thất bại.",
    };
  }
  if (!isCloseMutationPersisted(result)) {
    return {
      ok: false,
      code: result.code || CLOSE_NOT_PERSISTED_CODE,
      error:
        "Chưa đóng giải: lệnh mới ở bước preview, server chưa ghi nhận (rpcCalled=false).",
    };
  }
  return { ok: true };
}
