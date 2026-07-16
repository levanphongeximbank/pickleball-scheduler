/**
 * P1.2 S1-D — future setup-domain RPC registry (names only).
 * No domain RPC is deployed in this milestone.
 */

import { SETUP_COMMAND_NAMES } from "../canonical/teamTournamentCanonicalRules.js";

/**
 * Locked future RPC names — registered for fail-closed transport.
 * Deployed flag stays false until Discipline+ SQL lands.
 */
export const SETUP_MUTATION_RPC_BY_COMMAND = Object.freeze({
  "discipline.save": "team_tournament_save_discipline",
  "discipline.remove": "team_tournament_remove_discipline",
  "discipline.reorder": "team_tournament_reorder_disciplines",
  "groups.replace": "team_tournament_replace_groups",
  "groups.clear": "team_tournament_clear_groups",
  "matchups.replace": "team_tournament_replace_matchups",
  "schedule.update": "team_tournament_update_schedule",
  "schedule.batch": "team_tournament_batch_schedule",
  "schedule.publish": "team_tournament_publish_schedule",
  "schedule.lock": "team_tournament_lock_schedule",
  "deputies.set": "team_tournament_set_deputies",
  "dreambreaker.order_submit": "team_tournament_submit_dreambreaker_order",
  "dreambreaker.order_lock": "team_tournament_lock_dreambreaker_order",
  "dreambreaker.point": "team_tournament_record_dreambreaker_point",
  "dreambreaker.sync": "team_tournament_sync_dreambreaker",
  "awards.update": "team_tournament_update_awards",
  "awards.assign": "team_tournament_assign_award",
  "awards.auto_assign": "team_tournament_auto_assign_awards",
  "tournament.close": "team_tournament_close_tournament",
  "snapshot.restore": "team_tournament_restore_setup_snapshot",
});

export const SETUP_MUTATION_RPC_NAMES = Object.freeze(
  Object.values(SETUP_MUTATION_RPC_BY_COMMAND)
);

/**
 * @param {string} commandName
 * @returns {string|null}
 */
export function resolveSetupMutationRpcName(commandName) {
  const key = String(commandName || "").trim();
  return SETUP_MUTATION_RPC_BY_COMMAND[key] || null;
}

/**
 * S1-D/S1-E: no setup domain RPC is deployed.
 * Future: gate via env / migration catalog — never silent success.
 * @param {string} [_rpcName]
 * @returns {boolean}
 */
export function isSetupMutationRpcDeployed() {
  return false;
}

/**
 * @returns {string[]}
 */
export function listRegisteredSetupCommands() {
  return [...SETUP_COMMAND_NAMES];
}

/**
 * @returns {boolean}
 */
export function isSetupDomainWriteMethodActive() {
  return false;
}
