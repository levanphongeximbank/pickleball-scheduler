/*
==================================================
Schedule Persist Layer
Commits session, waiting, and history after user confirms.
==================================================
*/

import { saveSession } from "./session.js";
import { commitWaitingFromResult } from "./waiting.js";
import { commitHistoryFromCourts } from "./history.js";
import { autoSyncAfterScheduleCommit } from "./autoCloudSync.js";
import { getActiveClubId } from "../data/club.js";

export function commitScheduleResult(result, meta = {}) {
  if (!result || !Array.isArray(result.courts)) {
    return { ok: false, error: "Không có kết quả xếp sân để lưu." };
  }

  commitWaitingFromResult(result);
  commitHistoryFromCourts(result.courts);
  saveSession({
    courts: result.courts,
    waiting: result.waiting || [],
    aiScore: result.aiScore || null,
    meta: {
      ...(result.meta || {}),
      ...meta,
    },
  });

  const clubId = meta.clubId || getActiveClubId();
  void autoSyncAfterScheduleCommit(clubId);

  return { ok: true };
}
