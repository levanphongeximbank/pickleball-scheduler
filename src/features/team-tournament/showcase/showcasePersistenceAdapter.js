/**
 * P1.5A Showcase — persistence adapter.
 * Uses existing team mirror + groups.replace / get_setup v7 only.
 * No blob authority; no fake success; idempotent confirm.
 */

import { applyAiGeneratedTeamsToTournament } from "../services/teamTournamentService.js";
import { DEFAULT_ENGINE_VERSION } from "../canonical/teamTournamentMutationEnvelope.js";
import { SHOWCASE_MODE } from "./showcaseConstants.js";

/**
 * @param {object} params
 * @param {object} params.session — frozen showcase session with teams + groups
 * @param {string} params.clubId
 * @param {string} params.tournamentId
 * @param {Function} params.persistSetupTeamData — from useTeamTournamentPage
 * @param {Function} [params.reload]
 * @param {string} params.rulesVersion — exact preview rulesVersion
 * @param {string} [params.idempotencyKey]
 * @param {boolean} [params.teamsAlreadyPersisted]
 * @param {object} [params.previousTeamData]
 * @param {number} [params.expectedTournamentVersion]
 */
export async function confirmShowcasePersistence(params = {}) {
  const {
    session,
    clubId,
    tournamentId,
    persistSetupTeamData,
    reload,
    rulesVersion,
    teamsAlreadyPersisted = false,
    previousTeamData = null,
    expectedTournamentVersion,
    confirmDestructive = true,
  } = params;

  if (session?.mode === SHOWCASE_MODE.REPLAY) {
    return {
      ok: false,
      code: "REPLAY_READ_ONLY",
      error: "Chế độ xem lại không ghi dữ liệu.",
      writeAttempted: false,
    };
  }

  if (!session?.teamData?.teams?.length || !session?.teamData?.groups?.length) {
    return {
      ok: false,
      code: "INCOMPLETE_SESSION",
      error: "Thiếu đội hoặc bảng cố định — không lưu.",
      writeAttempted: false,
    };
  }

  const resolvedRules = String(rulesVersion || session.rulesVersion || "").trim();
  if (!resolvedRules) {
    return {
      ok: false,
      code: "MISSING_RULES_VERSION",
      error: "Thiếu rulesVersion cho lệnh pairing.",
      writeAttempted: false,
    };
  }

  if (typeof persistSetupTeamData !== "function") {
    return {
      ok: false,
      code: "NO_PERSIST_ADAPTER",
      error: "Thiếu adapter persistence canonical.",
      writeAttempted: false,
    };
  }

  let writeCount = 0;
  let versionAfterTeams = expectedTournamentVersion;

  if (!teamsAlreadyPersisted) {
    const teamSave = await applyAiGeneratedTeamsToTournament(
      clubId,
      tournamentId,
      {
        ...session.teamData,
        groups: [],
        matchups: [],
      }
    );
    writeCount += 1;
    if (!teamSave?.ok) {
      return {
        ok: false,
        code: teamSave?.code || "TEAM_SAVE_FAILED",
        error: teamSave?.error || "Không lưu được danh sách đội.",
        writeAttempted: true,
        writeCount,
        previewRetained: true,
      };
    }
    if (typeof reload === "function") {
      const reloaded = await reload({ schemaVersion: 7, diagnostic: true });
      versionAfterTeams =
        reloaded?.version ??
        reloaded?.data?.version ??
        versionAfterTeams;
    }
  }

  const groupResult = await persistSetupTeamData(session.teamData, {
    rulesVersion: resolvedRules,
    confirmDestructive,
    expectedTournamentVersion: versionAfterTeams,
    previousTeamData: previousTeamData || undefined,
    engineVersion: session.engineVersion || DEFAULT_ENGINE_VERSION,
  });
  writeCount += 1;

  if (!groupResult?.ok) {
    return {
      ok: false,
      code: groupResult?.code || "GROUP_SAVE_FAILED",
      error: groupResult?.error || "Không lưu được chia bảng.",
      writeAttempted: true,
      writeCount,
      previewRetained: true,
    };
  }

  const readback = groupResult.readback || groupResult.reloadResult || groupResult.data;
  const persistedTeams =
    readback?.teamData?.teams ||
    groupResult.teamData?.teams ||
    groupResult.aggregate?.teamData?.teams ||
    [];
  const persistedGroups =
    readback?.teamData?.groups ||
    groupResult.teamData?.groups ||
    groupResult.aggregate?.teamData?.groups ||
    [];

  if (!persistedTeams.length || !persistedGroups.length) {
    // Success path requires read-back verification from orchestrator;
    // if adapter already set ok + reload, trust orchestrator result.
    if (!groupResult.reloadResult?.ok && !groupResult.readbackVerified) {
      return {
        ok: false,
        code: "READBACK_FAILED",
        error: "Lưu xong nhưng không đọc lại được đội/bảng từ get_setup v7.",
        writeAttempted: true,
        writeCount,
        previewRetained: true,
      };
    }
  }

  return {
    ok: true,
    writeAttempted: true,
    writeCount,
    rulesVersion: resolvedRules,
    savedAt: new Date().toISOString(),
    result: groupResult,
    persistedTeams,
    persistedGroups,
    usedBlob: false,
  };
}

/**
 * Persist matchups separately after explicit Owner action.
 */
export async function confirmShowcaseMatchupPersistence(params = {}) {
  const {
    session,
    matchupPreview,
    persistSetupTeamData,
    rulesVersion,
    expectedTournamentVersion,
    previousTeamData,
  } = params;

  if (session?.mode === SHOWCASE_MODE.REPLAY) {
    return {
      ok: false,
      code: "REPLAY_READ_ONLY",
      error: "Chế độ xem lại không ghi cặp đấu.",
      writeAttempted: false,
    };
  }

  const matchups = matchupPreview?.matchups || [];
  if (!matchups.length) {
    return {
      ok: false,
      code: "NO_MATCHUP_PREVIEW",
      error: "Chưa có preview cặp đấu.",
      writeAttempted: false,
    };
  }

  const resolvedRules = String(rulesVersion || session?.rulesVersion || "").trim();
  if (!resolvedRules) {
    return {
      ok: false,
      code: "MISSING_RULES_VERSION",
      error: "Thiếu rulesVersion cho lệnh matchup.",
      writeAttempted: false,
    };
  }

  if (typeof persistSetupTeamData !== "function") {
    return {
      ok: false,
      code: "NO_PERSIST_ADAPTER",
      error: "Thiếu adapter persistence canonical.",
      writeAttempted: false,
    };
  }

  const nextTeamData = {
    ...session.teamData,
    matchups,
  };

  const result = await persistSetupTeamData(nextTeamData, {
    rulesVersion: resolvedRules,
    confirmDestructive: Boolean(previousTeamData?.matchups?.length),
    expectedTournamentVersion,
    previousTeamData: previousTeamData || session.teamData,
    engineVersion: session.engineVersion,
  });

  if (!result?.ok) {
    return {
      ok: false,
      code: result?.code || "MATCHUP_SAVE_FAILED",
      error: result?.error || "Không lưu được cặp đấu.",
      writeAttempted: true,
    };
  }

  const readbackMatchups =
    result.readback?.teamData?.matchups ||
    result.teamData?.matchups ||
    result.aggregate?.teamData?.matchups ||
    [];

  if (!readbackMatchups.length && !result.readbackVerified) {
    return {
      ok: false,
      code: "READBACK_FAILED",
      error: "Lưu cặp đấu xong nhưng không đọc lại được từ get_setup v7.",
      writeAttempted: true,
    };
  }

  return {
    ok: true,
    writeAttempted: true,
    writeCount: 1,
    rulesVersion: resolvedRules,
    savedAt: new Date().toISOString(),
    result,
    persistedMatchups: readbackMatchups,
  };
}

/**
 * Guard: replay and animation paths must never call this.
 */
export function assertNoShowcaseWrite(context = {}) {
  if (context.writeAttempted) {
    throw new Error(`Showcase write forbidden in ${context.phase || "unknown"}`);
  }
  return true;
}
