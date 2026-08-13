/**
 * Canonical AI pairing confirm → cloud persistence.
 *
 * CLOUD sole authority: team_tournament_commit_pairing (one transaction).
 *
 * RPC_MISSING / NO_SUPABASE / rpc_not_deployed → FAIL CLOSED.
 * Zero fallback to save_team / assign_member / set_captain / legacy group writer.
 *
 * Success requires canonical get_setup readback of teams, captains, and groups.
 * No local preview may be promoted to success.
 */

import {
  hasOrganizerConfiguredGroupCount,
  materializeExplicitGroupsFromTeams,
} from "../engines/teamGroupDivisionPolicy.js";
import { resolveFormatVenueDefaults } from "../engines/teamFormatVenueConfig.js";
import { deriveWorkflowStage } from "../engines/teamTournamentWorkflowStage.js";
import { preflightSetupMutationCapability } from "../setup/setupMutationFeatureGate.js";
import { rpcTeamTournamentCommitPairing } from "./teamTournamentRpcService.js";

export const PAIRING_UNAVAILABLE_CODES = Object.freeze([
  "RPC_MISSING",
  "rpc_not_deployed",
  "RPC_NOT_DEPLOYED",
  "NO_SUPABASE",
]);

const defaultDeps = Object.freeze({
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

export function isPairingAuthorityUnavailable(code) {
  return PAIRING_UNAVAILABLE_CODES.includes(String(code || ""));
}

function normalizeUnavailableCode(code) {
  const raw = String(code || "RPC_MISSING");
  if (raw === "RPC_NOT_DEPLOYED" || raw === "rpc_not_deployed") {
    return "rpc_not_deployed";
  }
  if (raw === "NO_SUPABASE") {
    return "NO_SUPABASE";
  }
  return "RPC_MISSING";
}

function extractReadbackTeamData(readback) {
  if (!readback || typeof readback !== "object") {
    return null;
  }
  if (readback.teamData && typeof readback.teamData === "object") {
    return readback.teamData;
  }
  if (readback.data?.teamData && typeof readback.data.teamData === "object") {
    return readback.data.teamData;
  }
  if (readback.tournament?.teamData && typeof readback.tournament.teamData === "object") {
    return readback.tournament.teamData;
  }
  return null;
}

/**
 * @param {object} params
 * @param {string} params.clubId
 * @param {string} params.tournamentId
 * @param {object} params.tournament
 * @param {object} params.nextTeamData
 * @param {Function} [params.reload]
 * @param {number} [params.expectedTournamentVersion]
 * @param {Record<string, string|undefined>} [params.envSource]
 */
export async function confirmAiPairingCloudPersistence(params = {}) {
  const {
    tournamentId,
    tournament = null,
    nextTeamData = null,
    reload = null,
    expectedTournamentVersion,
    envSource,
    commitPairing: commitPairingOverride,
  } = params;

  const teams = Array.isArray(nextTeamData?.teams) ? nextTeamData.teams : [];
  let groups = Array.isArray(nextTeamData?.groups) ? nextTeamData.groups : [];

  const finish = (result) => result;

  if (!tournamentId || !teams.length) {
    return finish({
      ok: false,
      code: "EMPTY_TEAMS",
      error: "Không có đội để lưu.",
      writeAttempted: false,
      partial: false,
    });
  }

  if (!tournament || String(tournament.id || "").trim() !== String(tournamentId).trim()) {
    return finish({
      ok: false,
      code: "NOT_FOUND",
      error: "Không tìm thấy giải đấu.",
      writeAttempted: false,
      partial: false,
    });
  }

  if (hasOrganizerConfiguredGroupCount(nextTeamData, tournament) && groups.length === 0) {
    const formatVenue = resolveFormatVenueDefaults(nextTeamData, tournament);
    const materialized = materializeExplicitGroupsFromTeams({
      teams,
      groupCount: formatVenue.groupCount,
      existingGroups: groups,
    });
    if (!materialized.ok) {
      return finish({
        ok: false,
        code: materialized.code || "GROUPS_REQUIRED",
        error:
          materialized.error ||
          "Thiếu chia bảng explicit — không xác nhận đội-only khi đã cấu hình số bảng.",
        writeAttempted: false,
        partial: false,
        groupsExpected: Math.max(1, Number(formatVenue.groupCount) || 1),
        groupsPersisted: 0,
      });
    }
    groups = materialized.groups;
  }

  const preflight = deps.preflightSetupMutationCapability({ envSource });
  if (!preflight.ok) {
    return finish({
      ...preflight,
      writeAttempted: false,
      partial: false,
      groupsExpected: groups.length,
      groupsPersisted: 0,
    });
  }

  const commitPairing = commitPairingOverride || deps.commitPairing;
  if (typeof commitPairing !== "function") {
    return finish({
      ok: false,
      code: "RPC_MISSING",
      error:
        "Thiếu RPC team_tournament_commit_pairing — không ghi đội/đội trưởng/bảng bằng writer phụ.",
      writeAttempted: false,
      partial: false,
    });
  }

  const atomic = await commitPairing({
    tournamentId,
    teams,
    groups,
    settingsPatch: {
      groupCount: Math.max(1, Number(nextTeamData?.settings?.groupCount) || groups.length || 1),
    },
    expectedVersion: expectedTournamentVersion,
  });

  if (!atomic?.ok) {
    const rawCode = String(atomic?.code || "PAIRING_COMMIT_FAILED");
    if (isPairingAuthorityUnavailable(rawCode)) {
      return finish({
        ok: false,
        code: normalizeUnavailableCode(rawCode),
        error:
          "team_tournament_commit_pairing không khả dụng. Không ghi đội/đội trưởng/bảng bằng writer phụ.",
        writeAttempted: false,
        partial: false,
      });
    }
    return finish({
      ok: false,
      code: rawCode,
      error: atomic?.error || "Không lưu được đội/đội trưởng/bảng trong một giao dịch.",
      writeAttempted: true,
      writeCount: 1,
      atomic: true,
      partial: false,
    });
  }

  if (typeof reload !== "function") {
    return finish({
      ok: false,
      code: "READBACK_FAILED",
      error:
        "RPC commit pairing thành công nhưng thiếu get_setup canonical — không xác nhận.",
      writeAttempted: true,
      writeCount: 1,
      atomic: true,
      partial: false,
    });
  }

  const readback = await reload({
    silent: true,
    schemaVersion: 7,
    applyUi: false,
    reason: "ai_pairing_atomic_readback",
  });
  if (!readback?.ok && readback?.ok !== undefined) {
    return finish({
      ok: false,
      code: "READBACK_FAILED",
      error:
        readback?.error ||
        "RPC commit pairing thành công nhưng get_setup không đọc lại được. Không coi là đã lưu.",
      writeAttempted: true,
      writeCount: 1,
      atomic: true,
      partial: false,
    });
  }

  const readTeamData = extractReadbackTeamData(readback);
  if (!readTeamData) {
    return finish({
      ok: false,
      code: "READBACK_FAILED",
      error:
        "RPC commit pairing thành công nhưng get_setup không trả teamData. Không coi là đã lưu.",
      writeAttempted: true,
      writeCount: 1,
      atomic: true,
      partial: false,
    });
  }

  const persistedTeams = Array.isArray(readTeamData.teams) ? readTeamData.teams : [];
  const persistedGroups = Array.isArray(readTeamData.groups) ? readTeamData.groups : [];

  if (!persistedTeams.length) {
    return finish({
      ok: false,
      code: "READBACK_FAILED",
      error: "RPC commit pairing thành công nhưng get_setup không có đội.",
      writeAttempted: true,
      writeCount: 1,
      atomic: true,
      partial: false,
    });
  }

  const expectedIds = new Set(teams.map((team) => String(team.id)));
  const visibleExpected = persistedTeams.filter((team) => expectedIds.has(String(team.id)));
  if (expectedIds.size > 0 && visibleExpected.length === 0) {
    return finish({
      ok: false,
      code: "READBACK_FAILED",
      error: "get_setup không chứa đội vừa xác nhận. Không coi là đã lưu.",
      writeAttempted: true,
      writeCount: 1,
      atomic: true,
      partial: false,
    });
  }

  const captainsExpected = teams.filter((team) =>
    String(team.captainPlayerId || "").trim()
  ).length;
  const captainsPersisted = persistedTeams.filter((team) =>
    String(team.captainPlayerId || "").trim()
  ).length;
  if (captainsExpected > 0 && captainsPersisted < captainsExpected) {
    return finish({
      ok: false,
      code: "READBACK_FAILED",
      error: `get_setup chỉ có ${captainsPersisted}/${captainsExpected} đội trưởng. Không coi là đã lưu.`,
      writeAttempted: true,
      writeCount: 1,
      atomic: true,
      partial: false,
      captainsExpected,
      captainsPersisted,
    });
  }

  if (groups.length > 0 && persistedGroups.length !== groups.length) {
    return finish({
      ok: false,
      code: "READBACK_FAILED",
      error: `get_setup trả về ${persistedGroups.length} bảng, kỳ vọng ${groups.length}. Không xác nhận.`,
      writeAttempted: true,
      writeCount: 1,
      atomic: true,
      partial: false,
      groupsExpected: groups.length,
      groupsPersisted: persistedGroups.length,
    });
  }

  const finalTeamData = {
    ...(nextTeamData || {}),
    ...readTeamData,
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
    captainsExpected,
    captainsPersisted,
    groupsExpected: groups.length,
    groupsPersisted: persistedGroups.length,
    persistedLocally: false,
    workflowStage: deriveWorkflowStage(finalTeamData, tournament),
    matchupsExpectedAtAiConfirm: false,
    matchupsEmptyValid: true,
    partial: false,
  });
}
