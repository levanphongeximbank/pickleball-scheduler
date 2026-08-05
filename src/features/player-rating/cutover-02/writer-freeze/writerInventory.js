/**
 * Writer inventory matrix for CUTOVER-02 freeze rehearsal.
 */

import { CUTOVER_02_WRITER_ID } from "../constants/writerIds.js";

/**
 * @typedef {Object} WriterInventoryRow
 * @property {string} writer
 * @property {string} fileOrRpc
 * @property {boolean} writesPublishedSkill
 * @property {boolean} writesV5Shadow
 * @property {string} directCallBypassRisk
 * @property {boolean} stagingFreezeTarget
 * @property {string} productionStatus
 * @property {boolean} allowedDuringRehearsalObserve
 * @property {boolean} allowedDuringRehearsalEnforce
 * @property {string} rollbackMethod
 */

/** @type {ReadonlyArray<WriterInventoryRow>} */
export const CUTOVER_02_WRITER_INVENTORY = Object.freeze([
  Object.freeze({
    writer: CUTOVER_02_WRITER_ID.PICK_VN_SYNC_RATING_RPC,
    fileOrRpc: "pick_vn_sync_rating / pickVnRatingRpcService.rpcPickVnSyncRating",
    writesPublishedSkill: true,
    writesV5Shadow: false,
    directCallBypassRisk: "HIGH — authenticated GRANT remains; client guard alone insufficient",
    stagingFreezeTarget: true,
    productionStatus: "LIVE_DO_NOT_FREEZE_THIS_WORKSTREAM",
    allowedDuringRehearsalObserve: true,
    allowedDuringRehearsalEnforce: false,
    rollbackMethod: "Set VITE_RATING_V5_WRITER_FREEZE_MODE=OFF; drop staging SQL guard if applied",
  }),
  Object.freeze({
    writer: CUTOVER_02_WRITER_ID.V2_ASSESSMENT_PUBLISH,
    fileOrRpc: "pickVnRatingService.completePickVnOnboarding / saveSelfDeclaredRating",
    writesPublishedSkill: true,
    writesV5Shadow: false,
    directCallBypassRisk: "MED — app frozen; RPC sync still bypass",
    stagingFreezeTarget: true,
    productionStatus: "APP_FROZEN_RPC_RESIDUAL",
    allowedDuringRehearsalObserve: true,
    allowedDuringRehearsalEnforce: false,
    rollbackMethod: "Freeze mode OFF",
  }),
  Object.freeze({
    writer: CUTOVER_02_WRITER_ID.BLOB_SKILL_MIRROR,
    fileOrRpc: "skillLevelChangeService / syncCurrentRatingMirrors",
    writesPublishedSkill: true,
    writesV5Shadow: false,
    directCallBypassRisk: "HIGH — published-facing blob fields",
    stagingFreezeTarget: true,
    productionStatus: "RESIDUAL_LIVE",
    allowedDuringRehearsalObserve: true,
    allowedDuringRehearsalEnforce: false,
    rollbackMethod: "Freeze mode OFF",
  }),
  Object.freeze({
    writer: CUTOVER_02_WRITER_ID.LEGACY_ELO_PUBLIC_MIRROR,
    fileOrRpc: "tournament/engines/eloEngine.applyEloUpdatesToPlayers",
    writesPublishedSkill: true,
    writesV5Shadow: false,
    directCallBypassRisk: "HIGH when CC Rating V2 off",
    stagingFreezeTarget: true,
    productionStatus: "RESIDUAL_WHEN_CC_OFF",
    allowedDuringRehearsalObserve: true,
    allowedDuringRehearsalEnforce: false,
    rollbackMethod: "Freeze mode OFF",
  }),
  Object.freeze({
    writer: CUTOVER_02_WRITER_ID.LOCAL_V2_MIRROR,
    fileOrRpc: "pickVnRatingLocalStore",
    writesPublishedSkill: false,
    writesV5Shadow: false,
    directCallBypassRisk: "LOW — cache only",
    stagingFreezeTarget: false,
    productionStatus: "CACHE",
    allowedDuringRehearsalObserve: true,
    allowedDuringRehearsalEnforce: true,
    rollbackMethod: "n/a",
  }),
  Object.freeze({
    writer: CUTOVER_02_WRITER_ID.V5_START_ASSESSMENT,
    fileOrRpc: "rating_v5_start_assessment",
    writesPublishedSkill: false,
    writesV5Shadow: true,
    directCallBypassRisk: "LOW — pilot gated",
    stagingFreezeTarget: false,
    productionStatus: "SHADOW_PILOT",
    allowedDuringRehearsalObserve: true,
    allowedDuringRehearsalEnforce: true,
    rollbackMethod: "n/a — must remain allowed",
  }),
  Object.freeze({
    writer: CUTOVER_02_WRITER_ID.V5_PERSIST_ASSESSMENT,
    fileOrRpc: "rating_v5_service_persist_assessment_completion / Edge",
    writesPublishedSkill: false,
    writesV5Shadow: true,
    directCallBypassRisk: "LOW — service-role path",
    stagingFreezeTarget: false,
    productionStatus: "SHADOW_PILOT",
    allowedDuringRehearsalObserve: true,
    allowedDuringRehearsalEnforce: true,
    rollbackMethod: "n/a — must remain allowed",
  }),
  Object.freeze({
    writer: CUTOVER_02_WRITER_ID.V5_INVALIDATE,
    fileOrRpc: "rating_v5_invalidate_assessment / service invalidate",
    writesPublishedSkill: false,
    writesV5Shadow: true,
    directCallBypassRisk: "LOW",
    stagingFreezeTarget: false,
    productionStatus: "SHADOW_OPS",
    allowedDuringRehearsalObserve: true,
    allowedDuringRehearsalEnforce: true,
    rollbackMethod: "n/a",
  }),
  Object.freeze({
    writer: CUTOVER_02_WRITER_ID.V5_PILOT_ENROLLMENT,
    fileOrRpc: "rating_v5_admin_upsert_pilot_enrollment",
    writesPublishedSkill: false,
    writesV5Shadow: false,
    directCallBypassRisk: "LOW — admin",
    stagingFreezeTarget: false,
    productionStatus: "OWNER_GO_GATED",
    allowedDuringRehearsalObserve: true,
    allowedDuringRehearsalEnforce: true,
    rollbackMethod: "n/a",
  }),
  Object.freeze({
    writer: CUTOVER_02_WRITER_ID.CC02_COMPETITION_ELO,
    fileOrRpc: "competition-core ratingServiceV2 / competition_core_apply_match_rating_v2",
    writesPublishedSkill: false,
    writesV5Shadow: false,
    directCallBypassRisk: "MED if conflated with skill — policy separated",
    stagingFreezeTarget: false,
    productionStatus: "INTERNAL_ELO",
    allowedDuringRehearsalObserve: true,
    allowedDuringRehearsalEnforce: true,
    rollbackMethod: "n/a — must NOT block",
  }),
  Object.freeze({
    writer: CUTOVER_02_WRITER_ID.CLOUD_SYNC_CLUB_BLOB,
    fileOrRpc: "syncClubToCloud / club_data_v3",
    writesPublishedSkill: false,
    writesV5Shadow: false,
    directCallBypassRisk: "MED — may carry mirrored skill fields",
    stagingFreezeTarget: false,
    productionStatus: "MIRROR_TRANSPORT",
    allowedDuringRehearsalObserve: true,
    allowedDuringRehearsalEnforce: true,
    rollbackMethod: "n/a",
  }),
  Object.freeze({
    writer: CUTOVER_02_WRITER_ID.ADMIN_MANUAL_OVERRIDE,
    fileOrRpc: "admin/manual rating override paths",
    writesPublishedSkill: true,
    writesV5Shadow: false,
    directCallBypassRisk: "MED",
    stagingFreezeTarget: true,
    productionStatus: "RESTRICTED",
    allowedDuringRehearsalObserve: true,
    allowedDuringRehearsalEnforce: false,
    rollbackMethod: "Freeze mode OFF",
  }),
  Object.freeze({
    writer: CUTOVER_02_WRITER_ID.IMPORT_BACKFILL,
    fileOrRpc: "scripts/seed-tt-*.mjs / import jobs",
    writesPublishedSkill: true,
    writesV5Shadow: false,
    directCallBypassRisk: "HIGH on wrong env",
    stagingFreezeTarget: true,
    productionStatus: "BAN_ON_PRODUCTION_CUTOVER",
    allowedDuringRehearsalObserve: true,
    allowedDuringRehearsalEnforce: false,
    rollbackMethod: "Freeze mode OFF + script ban",
  }),
  Object.freeze({
    writer: CUTOVER_02_WRITER_ID.UNRELATED_PROFILE_WRITE,
    fileOrRpc: "identity/profile updates (non-rating)",
    writesPublishedSkill: false,
    writesV5Shadow: false,
    directCallBypassRisk: "N/A",
    stagingFreezeTarget: false,
    productionStatus: "UNRELATED",
    allowedDuringRehearsalObserve: true,
    allowedDuringRehearsalEnforce: true,
    rollbackMethod: "n/a — must NOT block",
  }),
]);

export function getWriterInventoryRow(writerId) {
  return (
    CUTOVER_02_WRITER_INVENTORY.find((row) => row.writer === writerId) || null
  );
}

export function listStagingFreezeTargets() {
  return CUTOVER_02_WRITER_INVENTORY.filter((row) => row.stagingFreezeTarget);
}
