/**
 * Canonical AI pairing confirm → cloud persistence.
 *
 * Sequence:
 * 1) applyAiGeneratedTeamsToTournament (save_team + assign_member + set_captain)
 * 2) persistSetupTeamData groups.replace when groups are present
 * 3) caller reloads get_setup and advances only on verified state
 *
 * Mid-sequence version peeks must use reload({ applyUi: false }) so intermediate
 * get_setup responses do not clobber React teamData. Final UI refresh is owned by
 * confirmAiPairingUiTransaction (always refreshAfterMutation — never skip via
 * intermediate group snapshots).
 *
 * No legacy blob authority. Matchups stay empty (later workflow stage).
 */

import { PRIVATE_PAIRING_RUNTIME_VERSION } from "../../private-pairing-rules/runtime/runtimeCodes.js";
import { DEFAULT_ENGINE_VERSION } from "../canonical/teamTournamentMutationEnvelope.js";
import { deriveWorkflowStage } from "../engines/teamTournamentWorkflowStage.js";
import { preflightSetupMutationCapability } from "../setup/setupMutationFeatureGate.js";
import { applyAiGeneratedTeamsToTournament } from "./teamTournamentService.js";

/**
 * @param {object} params
 * @param {string} params.clubId
 * @param {string} params.tournamentId
 * @param {object} params.tournament — cloud-loaded Team tournament
 * @param {object} params.nextTeamData — teams (+ optional groups)
 * @param {string|null} [params.currentTenantId]
 * @param {Function} [params.persistSetupTeamData]
 * @param {Function} [params.reload] — may support { applyUi: false } peek
 * @param {string} [params.rulesVersion]
 * @param {number} [params.expectedTournamentVersion]
 * @param {Record<string, string|undefined>} [params.envSource]
 */
export async function confirmAiPairingCloudPersistence(params = {}) {
  const {
    clubId,
    tournamentId,
    tournament = null,
    nextTeamData = null,
    currentTenantId = null,
    persistSetupTeamData = null,
    reload = null,
    rulesVersion = "",
    expectedTournamentVersion,
    envSource,
  } = params;

  const teams = Array.isArray(nextTeamData?.teams) ? nextTeamData.teams : [];
  const groups = Array.isArray(nextTeamData?.groups) ? nextTeamData.groups : [];

  if (!tournamentId || !teams.length) {
    return {
      ok: false,
      code: "EMPTY_TEAMS",
      error: "Không có đội để lưu.",
      writeAttempted: false,
    };
  }

  if (!tournament || String(tournament.id || "").trim() !== String(tournamentId).trim()) {
    return {
      ok: false,
      code: "NOT_FOUND",
      error: "Không tìm thấy giải đấu.",
      writeAttempted: false,
    };
  }

  // V7 preflight BEFORE team/captain writes when groups must persist —
  // no captains-only partial success if group persistence is required.
  if (groups.length > 0) {
    const preflight = preflightSetupMutationCapability({ envSource });
    if (!preflight.ok) {
      return {
        ...preflight,
        groupsExpected: groups.length,
        groupsPersisted: 0,
      };
    }
    if (typeof persistSetupTeamData !== "function") {
      return {
        ok: false,
        code: "NO_GROUP_PERSIST_ADAPTER",
        error:
          "Thiếu adapter ghi bảng (groups.replace). Không ghi đội trước khi nhóm sẵn sàng.",
        writeAttempted: false,
        groupsExpected: groups.length,
        groupsPersisted: 0,
      };
    }
  }

  const teamSave = await applyAiGeneratedTeamsToTournament(
    clubId,
    tournamentId,
    {
      ...nextTeamData,
      teams,
      // Team RPC path does not write groups; groups go through setup mutation next.
      groups: [],
      matchups: [],
    },
    {
      tournament,
      currentTenantId,
    }
  );

  if (!teamSave?.ok) {
    return {
      ok: false,
      code: teamSave?.code || "TEAM_SAVE_FAILED",
      error: teamSave?.error || "Không lưu được danh sách đội.",
      writeAttempted: true,
      writeCount: 1,
      teamSave,
    };
  }

  const captainsExpected = teams.filter((team) =>
    String(team.captainPlayerId || "").trim()
  ).length;
  const captainsPersisted =
    teamSave.captainsPersisted ??
    (teamSave.teamData?.teams || []).filter((team) =>
      String(team.captainPlayerId || "").trim()
    ).length;

  if (captainsExpected > 0 && captainsPersisted < captainsExpected) {
    return {
      ok: false,
      code: "CAPTAINS_INCOMPLETE",
      error: `Chỉ lưu được ${captainsPersisted}/${captainsExpected} đội trưởng.`,
      writeAttempted: true,
      writeCount: 1,
      teamSave,
      captainsExpected,
      captainsPersisted,
    };
  }

  let versionAfterTeams = expectedTournamentVersion;
  if (typeof reload === "function") {
    // Peek only — do not apply intermediate (teams without groups) into React state.
    const reloaded = await reload({
      silent: true,
      schemaVersion: 7,
      applyUi: false,
      reason: "ai_pairing_version_peek",
    });
    versionAfterTeams =
      reloaded?.version ??
      reloaded?.data?.version ??
      versionAfterTeams;
  }

  let groupResult = null;
  let groupsPersisted = 0;

  if (groups.length > 0) {
    const resolvedRules = String(
      rulesVersion ||
        nextTeamData?.settings?.rulesVersion ||
        PRIVATE_PAIRING_RUNTIME_VERSION
    ).trim();

    const teamDataForGroups = {
      ...(teamSave.teamData || nextTeamData || {}),
      teams: teamSave.teamData?.teams || teams,
      groups,
      matchups: [],
    };

    groupResult = await persistSetupTeamData(teamDataForGroups, {
      rulesVersion: resolvedRules,
      confirmDestructive: true,
      expectedTournamentVersion: versionAfterTeams,
      previousTeamData: {
        ...(teamSave.teamData || {}),
        teams: teamSave.teamData?.teams || teams,
        groups: [],
        matchups: [],
      },
      engineVersion: DEFAULT_ENGINE_VERSION,
      envSource,
    });

    if (!groupResult?.ok) {
      return {
        ok: false,
        code: groupResult?.code || "GROUP_SAVE_FAILED",
        error:
          groupResult?.error ||
          "Đã lưu đội/đội trưởng nhưng không lưu được chia bảng.",
        writeAttempted: true,
        writeCount: 2,
        teamSave,
        groupResult,
        captainsExpected,
        captainsPersisted,
        groupsExpected: groups.length,
        groupsPersisted: 0,
        partial: true,
      };
    }

    const readback =
      groupResult.readback || groupResult.reloadResult || groupResult.data;
    const persistedGroups =
      readback?.teamData?.groups ||
      groupResult.teamData?.groups ||
      groupResult.aggregate?.teamData?.groups ||
      [];
    groupsPersisted = Array.isArray(persistedGroups) ? persistedGroups.length : 0;

    if (groupsPersisted !== groups.length) {
      return {
        ok: false,
        code: "GROUPS_READBACK_INCOMPLETE",
        error: `get_setup trả về ${groupsPersisted} bảng, kỳ vọng ${groups.length}. Không advance workflow / không F5.`,
        writeAttempted: true,
        writeCount: 2,
        teamSave,
        groupResult,
        captainsExpected,
        captainsPersisted,
        groupsExpected: groups.length,
        groupsPersisted,
        partial: true,
        requiresF5: false,
      };
    }
  }

  const finalTeamData = {
    ...(teamSave.teamData || {}),
    teams:
      groupResult?.teamData?.teams ||
      teamSave.teamData?.teams ||
      teams,
    groups:
      groupResult?.teamData?.groups ||
      (groups.length ? groups : teamSave.teamData?.groups || []),
    matchups: [],
  };
  const workflowStage = deriveWorkflowStage(finalTeamData, tournament);

  return {
    ok: true,
    writeAttempted: true,
    writeCount: groups.length > 0 ? 2 : 1,
    teamSave,
    groupResult,
    teamData: finalTeamData,
    tournament: groupResult?.tournament || teamSave.tournament,
    teamCount: teams.length,
    captainsExpected,
    captainsPersisted,
    groupsExpected: groups.length,
    groupsPersisted: groups.length > 0 ? groupsPersisted : 0,
    persistedLocally: Boolean(teamSave.persistedLocally),
    workflowStage,
    matchupsExpectedAtAiConfirm: false,
    matchupsEmptyValid: true,
  };
}
