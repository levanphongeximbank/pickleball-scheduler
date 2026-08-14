/**
 * Deterministic Internal Tournament lifecycle resolver from canonical state (IT-E2E-007).
 * Never uses React local state as authority.
 */
import { TOURNAMENT_STATUS } from "../../../models/tournament/constants.js";
import { isGroupStageComplete, hasBracketGenerated } from "../../../tournament/engines/bracketEngine.js";
import { getRefereeSettings } from "../../../tournament/engines/refereeEngine.js";
import {
  isOneGroupInternalEvent,
  canFinishOneGroupInternal,
  resolveOneGroupChampionProjection,
  listGroupStageMatches,
} from "./internalTournamentOneGroupCompletion.js";
import { isTournamentClosed } from "../../individual-tournament/engines/tournamentClosingEngine.js";

export const INTERNAL_LIFECYCLE_STEPS = Object.freeze({
  SETUP: "SETUP",
  PARTICIPANTS: "PARTICIPANTS",
  DRAW: "DRAW",
  SCHEDULE: "SCHEDULE",
  REFEREE: "REFEREE",
  RESULTS: "RESULTS",
  STANDINGS_OR_KNOCKOUT: "STANDINGS_OR_KNOCKOUT",
  CHAMPION: "CHAMPION",
  AWARDS: "AWARDS",
  COMPLETED: "COMPLETED",
});

export const INTERNAL_LIFECYCLE_LABELS = Object.freeze({
  [INTERNAL_LIFECYCLE_STEPS.SETUP]: "Thiết lập",
  [INTERNAL_LIFECYCLE_STEPS.PARTICIPANTS]: "VĐV / Đội",
  [INTERNAL_LIFECYCLE_STEPS.DRAW]: "Bốc thăm / Chia bảng",
  [INTERNAL_LIFECYCLE_STEPS.SCHEDULE]: "Lịch thi đấu",
  [INTERNAL_LIFECYCLE_STEPS.REFEREE]: "Trọng tài",
  [INTERNAL_LIFECYCLE_STEPS.RESULTS]: "Kết quả",
  [INTERNAL_LIFECYCLE_STEPS.STANDINGS_OR_KNOCKOUT]: "Xếp hạng / Knock-out",
  [INTERNAL_LIFECYCLE_STEPS.CHAMPION]: "Chung kết / Nhà vô địch",
  [INTERNAL_LIFECYCLE_STEPS.AWARDS]: "Trao giải",
  [INTERNAL_LIFECYCLE_STEPS.COMPLETED]: "Hoàn tất",
});

function hasEntries(event) {
  return (event?.entries || []).length > 0;
}

function hasGroups(event) {
  return (event?.groups || []).length > 0;
}

function hasGroupSchedule(event) {
  return listGroupStageMatches(event).length > 0;
}

function hasAnyCompletedMatch(event) {
  return (event?.matches || []).some(
    (match) =>
      match?.status === "completed" ||
      match?.status === "forfeit"
  );
}

function hasAwardsAssigned(tournament) {
  const awards = tournament?.settings?.awards || {};
  const assignments =
    awards.assignments && typeof awards.assignments === "object"
      ? awards.assignments
      : {};
  if (
    String(assignments.champion || "").trim() &&
    String(assignments.runnerUp || "").trim()
  ) {
    return true;
  }
  const items = awards.items || awards.assigned;
  if (Array.isArray(items) && items.length > 0) return true;
  const assigned = awards.byKey;
  return Boolean(assigned && Object.keys(assigned).length > 0);
}

function resolveChampionReady(tournament, event, oneGroup) {
  if (oneGroup) {
    const projection = resolveOneGroupChampionProjection(tournament);
    return Boolean(projection.ok && projection.champion);
  }
  const finalMatch = (event?.matches || []).find(
    (match) => match?.stage === "final" || match?.stage === "Chung ket"
  );
  if (finalMatch?.winnerId) return true;
  const bracket = event?.bracket;
  return Boolean(bracket?.winnersByMatch && Object.keys(bracket.winnersByMatch).length);
}

/**
 * @param {object|null} tournament
 * @returns {{
 *   CURRENT_STEP: string,
 *   COMPLETED_STEPS: string[],
 *   NEXT_REQUIRED_ACTION: string,
 *   BLOCKING_REASON: string|null,
 *   PRIMARY_ACTION_LABEL: string,
 *   oneGroup: boolean,
 *   skipKnockout: boolean,
 *   steps: Array<{ id: string, label: string, status: 'done'|'current'|'pending'|'skipped' }>
 * }}
 */
export function resolveInternalTournamentLifecycle(tournament) {
  const event = tournament?.events?.[0] || null;
  const oneGroup = isOneGroupInternalEvent(event);
  const closed = isTournamentClosed(tournament) ||
    tournament?.status === TOURNAMENT_STATUS.COMPLETED;

  const completed = [];
  const mark = (step) => {
    if (!completed.includes(step)) completed.push(step);
  };

  // SETUP always present once tournament exists
  if (tournament?.id) mark(INTERNAL_LIFECYCLE_STEPS.SETUP);

  if (hasEntries(event)) mark(INTERNAL_LIFECYCLE_STEPS.PARTICIPANTS);
  if (hasGroups(event)) mark(INTERNAL_LIFECYCLE_STEPS.DRAW);
  if (hasGroupSchedule(event)) mark(INTERNAL_LIFECYCLE_STEPS.SCHEDULE);

  const refereeRoster = getRefereeSettings(tournament)?.roster || [];
  if (refereeRoster.length > 0) mark(INTERNAL_LIFECYCLE_STEPS.REFEREE);

  if (hasAnyCompletedMatch(event)) mark(INTERNAL_LIFECYCLE_STEPS.RESULTS);

  const groupComplete = event ? isGroupStageComplete(event) : false;
  if (oneGroup) {
    if (groupComplete) mark(INTERNAL_LIFECYCLE_STEPS.STANDINGS_OR_KNOCKOUT);
    const champ = resolveOneGroupChampionProjection(tournament);
    if (champ.ok && champ.champion) mark(INTERNAL_LIFECYCLE_STEPS.CHAMPION);
  } else {
    if (hasBracketGenerated(event) || groupComplete) {
      mark(INTERNAL_LIFECYCLE_STEPS.STANDINGS_OR_KNOCKOUT);
    }
    if (resolveChampionReady(tournament, event, false)) {
      mark(INTERNAL_LIFECYCLE_STEPS.CHAMPION);
    }
  }

  if (hasAwardsAssigned(tournament) || tournament?.settings?.resultsOps?.summary) {
    mark(INTERNAL_LIFECYCLE_STEPS.AWARDS);
  }
  if (closed) mark(INTERNAL_LIFECYCLE_STEPS.COMPLETED);

  let CURRENT_STEP = INTERNAL_LIFECYCLE_STEPS.SETUP;
  let NEXT_REQUIRED_ACTION = "Hoàn tất thiết lập giải.";
  let BLOCKING_REASON = null;
  let PRIMARY_ACTION_LABEL = "Tiếp tục thiết lập";

  if (closed) {
    CURRENT_STEP = INTERNAL_LIFECYCLE_STEPS.COMPLETED;
    NEXT_REQUIRED_ACTION = "Giải đã hoàn tất.";
    PRIMARY_ACTION_LABEL = "Xem kết quả";
  } else if (!hasEntries(event)) {
    CURRENT_STEP = INTERNAL_LIFECYCLE_STEPS.PARTICIPANTS;
    NEXT_REQUIRED_ACTION = "Chọn VĐV và tạo cặp/đơn tham dự.";
    PRIMARY_ACTION_LABEL = "Chọn VĐV";
    BLOCKING_REASON = "Chưa có danh sách tham dự.";
  } else if (!hasGroups(event)) {
    CURRENT_STEP = INTERNAL_LIFECYCLE_STEPS.DRAW;
    NEXT_REQUIRED_ACTION = "Bốc thăm / chia bảng và lưu kết quả.";
    PRIMARY_ACTION_LABEL = "Chia bảng";
    BLOCKING_REASON = "Chưa chia bảng.";
  } else if (!hasGroupSchedule(event)) {
    CURRENT_STEP = INTERNAL_LIFECYCLE_STEPS.SCHEDULE;
    NEXT_REQUIRED_ACTION = "Tạo lịch vòng bảng từ bảng đã lưu.";
    PRIMARY_ACTION_LABEL = "Tạo lịch thi đấu";
    BLOCKING_REASON = "Đã có bảng nhưng chưa có lịch trận.";
  } else if (!hasAnyCompletedMatch(event)) {
    CURRENT_STEP = INTERNAL_LIFECYCLE_STEPS.RESULTS;
    NEXT_REQUIRED_ACTION =
      refereeRoster.length === 0
        ? "Gán trọng tài (tuỳ chọn) hoặc nhập kết quả trận."
        : "Nhập kết quả các trận vòng bảng.";
    PRIMARY_ACTION_LABEL =
      refereeRoster.length === 0 ? "Gán trọng tài / Nhập kết quả" : "Nhập kết quả";
    if (refereeRoster.length === 0) {
      // Referee is optional — current step stays RESULTS but mention referee as soft tip
      CURRENT_STEP =
        completed.includes(INTERNAL_LIFECYCLE_STEPS.REFEREE)
          ? INTERNAL_LIFECYCLE_STEPS.RESULTS
          : INTERNAL_LIFECYCLE_STEPS.REFEREE;
    }
  } else if (oneGroup) {
    const finish = canFinishOneGroupInternal(tournament);
    if (!finish.ok) {
      CURRENT_STEP = INTERNAL_LIFECYCLE_STEPS.RESULTS;
      NEXT_REQUIRED_ACTION = finish.error || "Hoàn tất các trận vòng bảng.";
      PRIMARY_ACTION_LABEL = "Nhập kết quả còn lại";
      BLOCKING_REASON = finish.error;
    } else if (!hasAwardsAssigned(tournament) && !closed) {
      CURRENT_STEP = INTERNAL_LIFECYCLE_STEPS.AWARDS;
      NEXT_REQUIRED_ACTION = "Xác nhận podium / trao giải và đóng giải.";
      PRIMARY_ACTION_LABEL = "Trao giải & Hoàn tất";
    } else {
      CURRENT_STEP = INTERNAL_LIFECYCLE_STEPS.COMPLETED;
      NEXT_REQUIRED_ACTION = "Đóng giải để chuyển sang hoàn tất.";
      PRIMARY_ACTION_LABEL = "Đóng giải";
    }
  } else if (!hasBracketGenerated(event)) {
    CURRENT_STEP = INTERNAL_LIFECYCLE_STEPS.STANDINGS_OR_KNOCKOUT;
    if (!groupComplete) {
      NEXT_REQUIRED_ACTION = "Hoàn tất vòng bảng trước khi tạo knock-out.";
      PRIMARY_ACTION_LABEL = "Nhập kết quả vòng bảng";
      BLOCKING_REASON = "Vòng bảng chưa xong.";
    } else {
      NEXT_REQUIRED_ACTION = "Tạo bracket knock-out từ xếp hạng bảng.";
      PRIMARY_ACTION_LABEL = "Tạo knock-out";
    }
  } else if (!resolveChampionReady(tournament, event, false)) {
    CURRENT_STEP = INTERNAL_LIFECYCLE_STEPS.CHAMPION;
    NEXT_REQUIRED_ACTION = "Nhập kết quả knock-out đến trận chung kết.";
    PRIMARY_ACTION_LABEL = "Nhập kết quả knock-out";
  } else if (!closed) {
    CURRENT_STEP = INTERNAL_LIFECYCLE_STEPS.AWARDS;
    NEXT_REQUIRED_ACTION = "Trao giải và đóng giải.";
    PRIMARY_ACTION_LABEL = "Trao giải & Hoàn tất";
  }

  const ordered = Object.values(INTERNAL_LIFECYCLE_STEPS);
  const steps = ordered.map((id) => {
    if (oneGroup && id === INTERNAL_LIFECYCLE_STEPS.STANDINGS_OR_KNOCKOUT) {
      // Still shown as standings, not skipped — label differs in UI
    }
    let status = "pending";
    if (completed.includes(id) && id !== CURRENT_STEP) status = "done";
    if (id === CURRENT_STEP) status = "current";
    return {
      id,
      label:
        oneGroup && id === INTERNAL_LIFECYCLE_STEPS.STANDINGS_OR_KNOCKOUT
          ? "Xếp hạng vòng bảng"
          : oneGroup && id === INTERNAL_LIFECYCLE_STEPS.CHAMPION
            ? "Nhà vô địch"
            : INTERNAL_LIFECYCLE_LABELS[id],
      status,
    };
  });

  return {
    CURRENT_STEP,
    COMPLETED_STEPS: completed,
    NEXT_REQUIRED_ACTION,
    BLOCKING_REASON,
    PRIMARY_ACTION_LABEL,
    oneGroup,
    skipKnockout: oneGroup,
    steps,
  };
}
