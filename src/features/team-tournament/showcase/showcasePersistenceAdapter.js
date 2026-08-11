/**
 * P1.5A Showcase — persistence adapter.
 * Teams+groups confirm uses team_tournament_commit_pairing only.
 * Missing RPC / NO_SUPABASE → fail closed. No save_team / legacy group writer.
 */

import {
  isPairingAuthorityUnavailable,
} from "../services/aiPairingCloudPersistence.js";
import { rpcTeamTournamentCommitPairing } from "../services/teamTournamentRpcService.js";
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
    tournamentId,
    reload,
    rulesVersion,
    expectedTournamentVersion,
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

  const commitPairing = params.commitPairing || rpcTeamTournamentCommitPairing;
  if (typeof commitPairing !== "function") {
    return {
      ok: false,
      code: "RPC_MISSING",
      error:
        "Thiếu RPC team_tournament_commit_pairing — không ghi đội/bảng bằng writer phụ.",
      writeAttempted: false,
      previewRetained: true,
    };
  }

  const atomic = await commitPairing({
    tournamentId,
    teams: session.teamData.teams,
    groups: session.teamData.groups,
    settingsPatch: {
      groupCount: Math.max(1, Number(session.teamData.settings?.groupCount) || session.teamData.groups.length || 1),
    },
    expectedVersion: expectedTournamentVersion,
  });

  if (!atomic?.ok) {
    const rawCode = String(atomic?.code || "PAIRING_COMMIT_FAILED");
    if (isPairingAuthorityUnavailable(rawCode)) {
      return {
        ok: false,
        code: rawCode === "NO_SUPABASE" ? "NO_SUPABASE" : rawCode === "rpc_not_deployed" || rawCode === "RPC_NOT_DEPLOYED" ? "rpc_not_deployed" : "RPC_MISSING",
        error:
          "team_tournament_commit_pairing không khả dụng. Không ghi đội/bảng bằng writer phụ.",
        writeAttempted: false,
        previewRetained: true,
      };
    }
    return {
      ok: false,
      code: rawCode,
      error: atomic?.error || "Không lưu được đội/bảng trong một giao dịch.",
      writeAttempted: true,
      writeCount: 1,
      previewRetained: true,
    };
  }

  let readTeamData = atomic.teamData || null;
  if (typeof reload === "function") {
    const readback = await reload({
      schemaVersion: 7,
      diagnostic: true,
      applyUi: false,
      reason: "showcase_atomic_readback",
    });
    readTeamData =
      readback?.teamData ||
      readback?.data?.teamData ||
      readback?.tournament?.teamData ||
      readTeamData;
  }

  const persistedTeams = Array.isArray(readTeamData?.teams) ? readTeamData.teams : [];
  const persistedGroups = Array.isArray(readTeamData?.groups) ? readTeamData.groups : [];
  if (!persistedTeams.length || !persistedGroups.length) {
    return {
      ok: false,
      code: "READBACK_FAILED",
      error: "Lưu xong nhưng không đọc lại được đội/bảng từ get_setup v7.",
      writeAttempted: true,
      writeCount: 1,
      previewRetained: true,
    };
  }

  return {
    ok: true,
    writeAttempted: true,
    writeCount: 1,
    rulesVersion: resolvedRules,
    savedAt: new Date().toISOString(),
    result: atomic,
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
