/**
 * Captain-confirm UI transaction boundary.
 *
 * One mutation span:
 *   begin barrier
 *   → team / member / captain / groups writes
 *   → final canonical get_setup refresh (always)
 *   → commit React teamData from that refresh only
 *   → derive workflow stage / close dialog / optional tab advance
 *   → end barrier
 *
 * Intermediate group persistence snapshots must never substitute for the
 * final canonical refresh (refresh-skip gap after groups success = 0).
 */

import { deriveWorkflowStage } from "../engines/teamTournamentWorkflowStage.js";
import { confirmAiPairingCloudPersistence } from "./aiPairingCloudPersistence.js";

/**
 * @param {object} params
 * @param {() => void|number} params.beginMutationBarrier
 * @param {() => void} params.endMutationBarrier
 * @param {(opts?: object) => Promise<object>} params.refreshAfterMutation
 * @param {object} params.confirmParams — forwarded to confirmAiPairingCloudPersistence
 * @param {typeof confirmAiPairingCloudPersistence} [params.confirmFn]
 * @param {object} [params.nextTeamData] — expected teams/groups for verification
 */
export async function confirmAiPairingUiTransaction(params = {}) {
  const {
    beginMutationBarrier,
    endMutationBarrier,
    refreshAfterMutation,
    confirmParams = {},
    confirmFn = confirmAiPairingCloudPersistence,
    nextTeamData = confirmParams.nextTeamData || null,
  } = params;

  if (typeof beginMutationBarrier !== "function" || typeof endMutationBarrier !== "function") {
    return {
      ok: false,
      code: "MISSING_MUTATION_BARRIER",
      error: "Thiếu mutation barrier cho xác nhận đội trưởng.",
    };
  }
  if (typeof refreshAfterMutation !== "function") {
    return {
      ok: false,
      code: "MISSING_CANONICAL_REFRESH",
      error: "Thiếu refresh canonical get_setup sau xác nhận đội trưởng.",
    };
  }

  beginMutationBarrier();
  try {
    const result = await confirmFn(confirmParams);
    if (!result?.ok) {
      return {
        ok: false,
        ...result,
        code: result?.code || "CAPTAIN_CONFIRM_WRITE_FAILED",
      };
    }

    // Final canonical refresh MUST run once at the end — never skip because
    // commit_pairing already returned a snapshot.
    const reloaded = await refreshAfterMutation({
      reason: "captain_confirm",
      diagnostic: true,
    });

    if (!reloaded?.ok || reloaded?.applied !== true) {
      return {
        ok: false,
        code: "CANONICAL_REFRESH_NOT_APPLIED",
        error:
          reloaded?.error ||
          "Đã lưu cloud nhưng chưa gắn được trạng thái canonical vào UI (không F5).",
        writeAttempted: true,
        persistResult: result,
        reloaded,
      };
    }

    const committedTeamData =
      reloaded.teamData || reloaded.tournament?.teamData || null;
    const teamsAfterReload = Array.isArray(committedTeamData?.teams)
      ? committedTeamData.teams
      : [];
    const groupsAfterReload = Array.isArray(committedTeamData?.groups)
      ? committedTeamData.groups
      : [];

    if (teamsAfterReload.length === 0) {
      return {
        ok: false,
        code: "RELOAD_EMPTY_TEAMS",
        error:
          "Đã lưu đội nhưng danh sách trống sau get_setup canonical — không báo thành công.",
        writeAttempted: true,
        persistResult: result,
        reloaded,
      };
    }

    const expectedIds = new Set(
      (result.teamData?.teams || nextTeamData?.teams || []).map((team) =>
        String(team.id)
      )
    );
    const visibleExpected = teamsAfterReload.filter((team) =>
      expectedIds.has(String(team.id))
    );
    if (expectedIds.size > 0 && visibleExpected.length === 0) {
      return {
        ok: false,
        code: "RELOAD_MISSING_TEAMS",
        error:
          "Đã lưu đội nhưng React state canonical không có đội vừa tạo sau get_setup.",
        writeAttempted: true,
        persistResult: result,
        reloaded,
      };
    }

    const expectedGroups = Array.isArray(nextTeamData?.groups)
      ? nextTeamData.groups.length
      : Number(result.groupsExpected || 0);
    if (expectedGroups > 0 && groupsAfterReload.length < expectedGroups) {
      return {
        ok: false,
        code: "RELOAD_MISSING_GROUPS",
        error: `Đã lưu đội nhưng chưa đọc lại đủ bảng trên React state (${groupsAfterReload.length}/${expectedGroups}).`,
        writeAttempted: true,
        persistResult: result,
        reloaded,
      };
    }

    const workflowStage = deriveWorkflowStage(
      committedTeamData,
      reloaded.tournament || result.tournament || null
    );

    return {
      ok: true,
      code: "CAPTAIN_CONFIRM_CANONICAL_COMMITTED",
      writeAttempted: true,
      writeCount: result.writeCount,
      teamCount: teamsAfterReload.length,
      groupCount: groupsAfterReload.length,
      captainsPersisted: result.captainsPersisted,
      groupsPersisted: groupsAfterReload.length,
      teamData: committedTeamData,
      tournament: reloaded.tournament || result.tournament,
      workflowStage,
      reloaded,
      persistResult: result,
      // Explicit: success is React-committed canonical state, not RPC/synthetic.
      reactCanonicalCommitted: true,
      applied: true,
    };
  } finally {
    endMutationBarrier();
  }
}
