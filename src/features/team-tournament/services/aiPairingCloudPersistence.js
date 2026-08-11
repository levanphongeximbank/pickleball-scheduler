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
import {
  hasOrganizerConfiguredGroupCount,
  materializeExplicitGroupsFromTeams,
} from "../engines/teamGroupDivisionPolicy.js";
import { resolveFormatVenueDefaults } from "../engines/teamFormatVenueConfig.js";
import { deriveWorkflowStage } from "../engines/teamTournamentWorkflowStage.js";
import { preflightSetupMutationCapability } from "../setup/setupMutationFeatureGate.js";
import { applyAiGeneratedTeamsToTournament } from "./teamTournamentService.js";
import { rpcTeamTournamentCommitPairing } from "./teamTournamentRpcService.js";
import {
  TT412_CAPTAIN_CONFIRM_DIAG,
  tt412CaptainConfirmDiag,
} from "./tt412CaptainConfirmDiagnostics.js";

const defaultDeps = Object.freeze({
  applyAiGeneratedTeamsToTournament,
  preflightSetupMutationCapability,
  commitPairing: rpcTeamTournamentCommitPairing,
});

let deps = { ...defaultDeps };

/** @internal */
export function __setConfirmAiPairingCloudPersistenceDepsForTests(next = {}) {
  deps = { ...defaultDeps, ...next };
}

/** @internal */
export function __resetConfirmAiPairingCloudPersistenceDepsForTests() {
  deps = { ...defaultDeps };
}

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
  let groups = Array.isArray(nextTeamData?.groups) ? nextTeamData.groups : [];
  const incomingGroupsLength = groups.length;
  let materializedGroupsLength = 0;

  const finish = (result) => {
    tt412CaptainConfirmDiag(TT412_CAPTAIN_CONFIRM_DIAG.RESULT, {
      ok: result?.ok === true,
      partial: result?.partial === true,
      errorCode: result?.code || null,
      errorMessage: result?.error || null,
    });
    return result;
  };

  if (!tournamentId || !teams.length) {
    return finish({
      ok: false,
      code: "EMPTY_TEAMS",
      error: "Không có đội để lưu.",
      writeAttempted: false,
    });
  }

  if (!tournament || String(tournament.id || "").trim() !== String(tournamentId).trim()) {
    return finish({
      ok: false,
      code: "NOT_FOUND",
      error: "Không tìm thấy giải đấu.",
      writeAttempted: false,
    });
  }

  // Owner "1 bảng" / configured groupCount>=1: never succeed teams-only with groups=[].
  if (hasOrganizerConfiguredGroupCount(nextTeamData, tournament) && groups.length === 0) {
    const formatVenue = resolveFormatVenueDefaults(nextTeamData, tournament);
    const materialized = materializeExplicitGroupsFromTeams({
      teams,
      groupCount: formatVenue.groupCount,
      existingGroups: groups,
    });
    if (!materialized.ok) {
      tt412CaptainConfirmDiag(TT412_CAPTAIN_CONFIRM_DIAG.REPLACE_GROUPS_SKIPPED, {
        reason: "materialize_failed",
        errorCode: materialized.code || "GROUPS_REQUIRED",
        configuredGroupCount: Number(formatVenue.groupCount) || null,
        incomingGroupsLength,
      });
      return finish({
        ok: false,
        code: materialized.code || "GROUPS_REQUIRED",
        error:
          materialized.error ||
          "Thiếu chia bảng explicit — không xác nhận đội-only khi đã cấu hình số bảng.",
        writeAttempted: false,
        groupsExpected: Math.max(1, Number(formatVenue.groupCount) || 1),
        groupsPersisted: 0,
      });
    }
    groups = materialized.groups;
    materializedGroupsLength = groups.length;
  }

  const formatVenueForDiag = resolveFormatVenueDefaults(nextTeamData, tournament);
  const configuredGroupCount = Number(formatVenueForDiag.groupCount) || null;
  const shouldPersistGroups = groups.length > 0;
  tt412CaptainConfirmDiag(TT412_CAPTAIN_CONFIRM_DIAG.GROUP_PERSIST_DECISION, {
    configuredGroupCount,
    effectiveGroupsLength: groups.length,
    materializedGroupsLength,
    incomingGroupsLength,
    shouldPersistGroups,
    groupIds: groups.map((group) => group?.id || null),
    teamIdsPerGroup: groups.map((group) =>
      Array.isArray(group?.teamIds) ? group.teamIds.map(String) : []
    ),
  });

  // V7 preflight BEFORE team/captain writes when groups must persist —
  // no captains-only partial success if group persistence is required.
  if (groups.length > 0) {
    const preflight = deps.preflightSetupMutationCapability({ envSource });
    if (!preflight.ok) {
      tt412CaptainConfirmDiag(TT412_CAPTAIN_CONFIRM_DIAG.REPLACE_GROUPS_SKIPPED, {
        reason: "preflight_failed",
        errorCode: preflight.code || null,
        configuredGroupCount,
        effectiveGroupsLength: groups.length,
      });
      return finish({
        ...preflight,
        groupsExpected: groups.length,
        groupsPersisted: 0,
      });
    }
    if (typeof persistSetupTeamData !== "function") {
      tt412CaptainConfirmDiag(TT412_CAPTAIN_CONFIRM_DIAG.REPLACE_GROUPS_SKIPPED, {
        reason: "no_persist_adapter",
        configuredGroupCount,
        effectiveGroupsLength: groups.length,
      });
      return finish({
        ok: false,
        code: "NO_GROUP_PERSIST_ADAPTER",
        error:
          "Thiếu adapter ghi bảng (groups.replace). Không ghi đội trước khi nhóm sẵn sàng.",
        writeAttempted: false,
        groupsExpected: groups.length,
        groupsPersisted: 0,
      });
    }
  }

  if (typeof deps.commitPairing === "function") {
    const atomic = await deps.commitPairing({
      tournamentId,
      teams,
      groups,
      settingsPatch: {
        groupCount: Math.max(1, Number(nextTeamData?.settings?.groupCount) || groups.length || 1),
      },
    });
    if (atomic?.ok) {
      let readback = null;
      if (typeof reload === "function") {
        readback = await reload({
          silent: true,
          schemaVersion: 7,
          applyUi: false,
          reason: "ai_pairing_atomic_readback",
        });
      }
      const readTeamData =
        readback?.teamData ||
        readback?.data?.teamData ||
        readback?.tournament?.teamData ||
        null;
      const persistedTeams = Array.isArray(readTeamData?.teams)
        ? readTeamData.teams
        : teams;
      const persistedGroups = Array.isArray(readTeamData?.groups)
        ? readTeamData.groups
        : groups;
      if (groups.length > 0 && persistedGroups.length !== groups.length) {
        return finish({
          ok: false,
          code: "GROUPS_READBACK_INCOMPLETE",
          error: `get_setup trả về ${persistedGroups.length} bảng, kỳ vọng ${groups.length}.`,
          writeAttempted: true,
          writeCount: 1,
          atomic: true,
          groupsExpected: groups.length,
          groupsPersisted: persistedGroups.length,
          partial: true,
        });
      }
      if (!persistedTeams.length) {
        return finish({
          ok: false,
          code: "RELOAD_EMPTY_TEAMS",
          error: "RPC commit pairing thành công nhưng get_setup không có đội.",
          writeAttempted: true,
          writeCount: 1,
          atomic: true,
        });
      }
      const captainsPersisted = persistedTeams.filter((team) =>
        String(team.captainPlayerId || "").trim()
      ).length;
      const finalTeamData = {
        ...(nextTeamData || {}),
        ...(readTeamData || {}),
        teams: persistedTeams,
        groups: persistedGroups,
        matchups: [],
      };
      return finish({
        ok: true,
        writeAttempted: true,
        writeCount: 1,
        atomic: true,
        teamSave: atomic,
        groupResult: atomic,
        teamData: finalTeamData,
        tournament: readback?.tournament || tournament,
        teamCount: persistedTeams.length,
        captainsExpected: teams.filter((team) => String(team.captainPlayerId || "").trim()).length,
        captainsPersisted,
        groupsExpected: groups.length,
        groupsPersisted: persistedGroups.length,
        workflowStage: deriveWorkflowStage(finalTeamData, tournament),
        matchupsExpectedAtAiConfirm: false,
        matchupsEmptyValid: true,
      });
    }
    const atomicUnavailable = new Set([
      "RPC_MISSING",
      "rpc_not_deployed",
      "NO_SUPABASE",
    ]);
    if (atomic?.code && !atomicUnavailable.has(String(atomic.code))) {
      return finish({
        ok: false,
        code: atomic.code || "PAIRING_COMMIT_FAILED",
        error: atomic.error || "Không lưu được đội/đội trưởng/bảng trong một giao dịch.",
        writeAttempted: true,
        writeCount: 1,
        atomic: true,
      });
    }
  }

  const teamSave = await deps.applyAiGeneratedTeamsToTournament(
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
    return finish({
      ok: false,
      code: teamSave?.code || "TEAM_SAVE_FAILED",
      error: teamSave?.error || "Không lưu được danh sách đội.",
      writeAttempted: true,
      writeCount: 1,
      teamSave,
    });
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
    return finish({
      ok: false,
      code: "CAPTAINS_INCOMPLETE",
      error: `Chỉ lưu được ${captainsPersisted}/${captainsExpected} đội trưởng.`,
      writeAttempted: true,
      writeCount: 1,
      teamSave,
      captainsExpected,
      captainsPersisted,
    });
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

    tt412CaptainConfirmDiag(TT412_CAPTAIN_CONFIRM_DIAG.REPLACE_GROUPS_CALL, {
      tournamentId,
      configuredGroupCount,
      groupsLength: groups.length,
      groupIds: groups.map((group) => group?.id || null),
      expectedTournamentVersion: versionAfterTeams ?? null,
    });

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
      return finish({
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
      });
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
      return finish({
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
      });
    }
  } else {
    tt412CaptainConfirmDiag(TT412_CAPTAIN_CONFIRM_DIAG.REPLACE_GROUPS_SKIPPED, {
      reason: "effective_groups_empty_after_materialize_gate",
      configuredGroupCount,
      incomingGroupsLength,
      materializedGroupsLength,
      effectiveGroupsLength: 0,
      shouldPersistGroups: false,
    });
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

  return finish({
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
  });
}
