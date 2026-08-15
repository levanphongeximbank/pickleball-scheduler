import { officialOpenLifecycleService } from "./officialOpenLifecycleService.js";

export async function listMyOfficialRefereeAssignmentsCommand() {
  return officialOpenLifecycleService.listMyRefereeAssignments();
}

export async function openMyOfficialRefereeMatchCommand(input) {
  return officialOpenLifecycleService.openMyRefereeMatch(input);
}

export async function ensureOfficialMatchLiveCommand(input) {
  return officialOpenLifecycleService.ensureMatchLive(input);
}

export async function revokeOfficialMatchLiveCommand(input) {
  return officialOpenLifecycleService.revokeMatchLive(input);
}

export async function officialRefereeGetMatchCommand(token) {
  return officialOpenLifecycleService.refereeGetMatch(token);
}

export async function officialAdjustLiveScoreCommand(input) {
  return officialOpenLifecycleService.adjustLiveScore(input);
}

export async function officialCommitMatchResultCommand(input) {
  return officialOpenLifecycleService.commitMatchResult(input);
}

export async function officialAdminCommitMatchResultCommand(input) {
  return officialOpenLifecycleService.adminCommitMatchResult(input);
}

export async function officialGenerateKnockoutCommand(input) {
  return officialOpenLifecycleService.generateKnockout(input);
}

export async function officialCompleteTournamentCommand(input) {
  return officialOpenLifecycleService.completeTournament(input);
}

export async function officialGetPublicResultsCommand(input) {
  return officialOpenLifecycleService.getPublicResults(input);
}
