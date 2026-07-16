/**
 * P1.3 — deployed setup-domain RPC registry.
 */

import { SETUP_COMMAND_NAMES } from "../canonical/teamTournamentCanonicalRules.js";

/**
 * Owner-locked setup RPC names.
 */
export const SETUP_MUTATION_RPC_BY_COMMAND = Object.freeze({
  "discipline.save": "team_tournament_save_discipline",
  "discipline.remove": "team_tournament_remove_discipline",
  "discipline.reorder": "team_tournament_reorder_disciplines",
  "groups.replace": "team_tournament_replace_groups",
  "groups.clear": "team_tournament_clear_groups",
  "matchups.replace": "team_tournament_replace_matchups",
  "schedule.update": "team_tournament_update_matchup_schedule",
  "schedule.batch": "team_tournament_apply_schedule_batch",
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
  "tournament.save_draft": "team_tournament_save_draft",
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
 * P1.3 deploys discipline, groups, matchups, and schedule setup RPCs.
 * Later domains remain fail-closed until their owning phases deploy them.
 * @param {string} rpcName
 * @returns {boolean}
 */
export function isSetupMutationRpcDeployed(rpcName) {
  return new Set([
    SETUP_MUTATION_RPC_BY_COMMAND["discipline.save"],
    SETUP_MUTATION_RPC_BY_COMMAND["discipline.remove"],
    SETUP_MUTATION_RPC_BY_COMMAND["discipline.reorder"],
    SETUP_MUTATION_RPC_BY_COMMAND["groups.replace"],
    SETUP_MUTATION_RPC_BY_COMMAND["groups.clear"],
    SETUP_MUTATION_RPC_BY_COMMAND["matchups.replace"],
    SETUP_MUTATION_RPC_BY_COMMAND["schedule.update"],
    SETUP_MUTATION_RPC_BY_COMMAND["schedule.batch"],
    SETUP_MUTATION_RPC_BY_COMMAND["schedule.publish"],
    SETUP_MUTATION_RPC_BY_COMMAND["schedule.lock"],
    SETUP_MUTATION_RPC_BY_COMMAND["tournament.save_draft"],
  ]).has(String(rpcName || "").trim());
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
  return true;
}
