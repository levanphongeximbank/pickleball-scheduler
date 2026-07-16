/**
 * Canonical Team Tournament V6 workflow stage + draft status.
 * Reconstructable from persisted setup data (get_setup v7) — not tab selection.
 */

import { MATCHUP_STATUS } from "../constants.js";
import {
  hasExplicitGroups,
  MIN_TEAMS_FOR_EXPLICIT_GROUPS,
  tournamentRequiresExplicitGroups,
} from "./teamGroupDivisionPolicy.js";

export const WORKFLOW_STAGE = Object.freeze({
  TEAMS: "teams",
  GROUPS: "groups",
  DISCIPLINES: "disciplines",
  MATCHUPS: "matchups",
  SCHEDULE: "schedule",
  LINEUP: "lineup",
  RESULTS: "results",
  CLOSED: "closed",
});

export const WORKFLOW_STAGE_ORDER = Object.freeze([
  WORKFLOW_STAGE.TEAMS,
  WORKFLOW_STAGE.GROUPS,
  WORKFLOW_STAGE.DISCIPLINES,
  WORKFLOW_STAGE.MATCHUPS,
  WORKFLOW_STAGE.SCHEDULE,
  WORKFLOW_STAGE.LINEUP,
  WORKFLOW_STAGE.RESULTS,
  WORKFLOW_STAGE.CLOSED,
]);

export const WORKFLOW_STAGE_LABELS = Object.freeze({
  [WORKFLOW_STAGE.TEAMS]: "Đội",
  [WORKFLOW_STAGE.GROUPS]: "Chia bảng",
  [WORKFLOW_STAGE.DISCIPLINES]: "Nội dung",
  [WORKFLOW_STAGE.MATCHUPS]: "Cặp đấu",
  [WORKFLOW_STAGE.SCHEDULE]: "Lịch",
  [WORKFLOW_STAGE.LINEUP]: "Đội hình",
  [WORKFLOW_STAGE.RESULTS]: "Kết quả",
  [WORKFLOW_STAGE.CLOSED]: "Đóng giải",
});

const DRAFT_STATUS = Object.freeze({
  NO_TEAMS: "Nháp — chưa có đội",
  HAS_TEAMS: "Nháp — đã có đội",
  HAS_GROUPS: "Nháp — đã chia bảng",
  HAS_DISCIPLINES: "Nháp — đã có nội dung",
  HAS_MATCHUPS: "Nháp — đã tạo cặp đấu",
  HAS_SCHEDULE: "Nháp — đã tạo lịch",
  PUBLISHED: "Đã công bố",
});

function hasScheduledMatchups(matchups = []) {
  return matchups.some(
    (matchup) =>
      Boolean(matchup.scheduledAt) ||
      Boolean(matchup.courtLabel) ||
      Boolean(matchup.scheduleMeta?.scheduledAt)
  );
}

function isSchedulePublished(teamData) {
  const publish =
    teamData?.schedulePublish || teamData?.settings?.schedulePublish || {};
  return publish.status === "published" || publish.status === "locked";
}

function isTournamentClosed(teamData, tournament) {
  const status = String(tournament?.status || teamData?.settings?.status || "").toLowerCase();
  return status === "closed" || status === "completed" || teamData?.settings?.closed === true;
}

function hasResults(matchups = []) {
  return matchups.some(
    (matchup) =>
      matchup.status === MATCHUP_STATUS.IN_PROGRESS ||
      matchup.status === MATCHUP_STATUS.COMPLETED
  );
}

function hasPublishedLineups(matchups = []) {
  return matchups.some(
    (matchup) =>
      matchup.status === MATCHUP_STATUS.PUBLISHED ||
      matchup.status === MATCHUP_STATUS.IN_PROGRESS ||
      matchup.status === MATCHUP_STATUS.COMPLETED
  );
}

/**
 * Derive canonical workflow stage from persisted teamData (+ optional tournament header).
 * @param {object} teamData
 * @param {object} [tournament]
 * @returns {string}
 */
export function deriveWorkflowStage(teamData, tournament = null) {
  if (isTournamentClosed(teamData, tournament)) {
    return WORKFLOW_STAGE.CLOSED;
  }

  const teams = teamData?.teams || [];
  const groupsReady = hasExplicitGroups(teamData);
  const disciplines = teamData?.disciplines || [];
  const matchups = teamData?.matchups || [];
  const needsGroups = tournamentRequiresExplicitGroups(teams.length);

  if (teams.length < 2) {
    return WORKFLOW_STAGE.TEAMS;
  }

  if (needsGroups && !groupsReady) {
    return WORKFLOW_STAGE.GROUPS;
  }

  if (disciplines.length < 1) {
    return WORKFLOW_STAGE.DISCIPLINES;
  }

  if (matchups.length < 1) {
    return WORKFLOW_STAGE.MATCHUPS;
  }

  if (!hasScheduledMatchups(matchups) && !isSchedulePublished(teamData)) {
    return WORKFLOW_STAGE.SCHEDULE;
  }

  if (hasResults(matchups)) {
    return WORKFLOW_STAGE.RESULTS;
  }

  if (hasPublishedLineups(matchups) || isSchedulePublished(teamData)) {
    return WORKFLOW_STAGE.LINEUP;
  }

  return WORKFLOW_STAGE.SCHEDULE;
}

/**
 * Human-readable draft / publish status for BTC.
 * Highest completed milestone — reconstructable from get_setup v7 domain rows.
 * @param {object} teamData
 * @param {object} [tournament]
 */
export function deriveDraftStatusLabel(teamData, tournament = null) {
  if (isSchedulePublished(teamData) || String(tournament?.status || "").toLowerCase() === "published") {
    return DRAFT_STATUS.PUBLISHED;
  }
  if (isTournamentClosed(teamData, tournament)) {
    return DRAFT_STATUS.PUBLISHED;
  }

  const teams = teamData?.teams || [];
  const matchups = teamData?.matchups || [];
  const disciplines = teamData?.disciplines || [];
  const groupsReady = hasExplicitGroups(teamData);

  if (hasScheduledMatchups(matchups)) {
    return DRAFT_STATUS.HAS_SCHEDULE;
  }
  if (matchups.length > 0) {
    return DRAFT_STATUS.HAS_MATCHUPS;
  }
  if (groupsReady && disciplines.length > 0) {
    return DRAFT_STATUS.HAS_DISCIPLINES;
  }
  if (groupsReady) {
    return DRAFT_STATUS.HAS_GROUPS;
  }
  if (teams.length > 0) {
    return DRAFT_STATUS.HAS_TEAMS;
  }
  return DRAFT_STATUS.NO_TEAMS;
}

/**
 * Canonical draft-state payload persisted by the tournament.save_draft mutation.
 * Reconstructable from get_setup v7 — never a blob copy of domain data.
 * @param {object} teamData
 * @param {object} [tournament]
 * @param {{ engineVersion?: string, rulesVersion?: string, setupVersion?: number }} [meta]
 */
export function buildTeamTournamentDraftState(teamData, tournament = null, meta = {}) {
  const stage = deriveWorkflowStage(teamData, tournament);
  const stageIndex = WORKFLOW_STAGE_ORDER.indexOf(stage);
  const lastCompletedStage =
    stageIndex > 0 ? WORKFLOW_STAGE_ORDER[stageIndex - 1] : null;
  const next = deriveNextWorkflowAction(teamData, tournament);

  return {
    draftStatus: deriveDraftStatusLabel(teamData, tournament),
    workflowStage: stage,
    lastCompletedStage,
    nextRequiredStage: stage,
    nextActionId: next.actionId || null,
    nextActionLabel: next.label || null,
    engineVersion: meta.engineVersion || null,
    rulesVersion: meta.rulesVersion || null,
    setupVersion:
      meta.setupVersion != null ? Number(meta.setupVersion) : null,
  };
}

/**
 * Next CTA for resume / after team creation.
 * @param {object} teamData
 * @param {object} [tournament]
 */
export function deriveNextWorkflowAction(teamData, tournament = null) {
  const stage = deriveWorkflowStage(teamData, tournament);
  const teams = teamData?.teams || [];
  const needsGroups = tournamentRequiresExplicitGroups(teams.length);
  const teamsInsufficient =
    teams.length > 0 && teams.length < MIN_TEAMS_FOR_EXPLICIT_GROUPS && needsGroups === false
      ? false
      : teams.length < MIN_TEAMS_FOR_EXPLICIT_GROUPS &&
        tournamentRequiresExplicitGroups(MIN_TEAMS_FOR_EXPLICIT_GROUPS);

  switch (stage) {
    case WORKFLOW_STAGE.TEAMS:
      return {
        stage,
        actionId: "add_teams",
        label: "Thêm đội",
        hint:
          teams.length < MIN_TEAMS_FOR_EXPLICIT_GROUPS
            ? `Cần ít nhất ${MIN_TEAMS_FOR_EXPLICIT_GROUPS} đội để chia bảng.`
            : "Tiếp tục thêm / chỉnh đội.",
        groupActionsEnabled: false,
        groupActionsDisabledReason:
          teams.length < MIN_TEAMS_FOR_EXPLICIT_GROUPS
            ? `Cần ít nhất ${MIN_TEAMS_FOR_EXPLICIT_GROUPS} đội để chia bảng.`
            : null,
      };
    case WORKFLOW_STAGE.GROUPS:
      return {
        stage,
        actionId: "divide_groups",
        label: "Chia bảng",
        hint: "Chia bảng đấu trước khi tạo cặp đấu / lịch.",
        groupActionsEnabled: teams.length >= MIN_TEAMS_FOR_EXPLICIT_GROUPS,
        groupActionsDisabledReason:
          teams.length < MIN_TEAMS_FOR_EXPLICIT_GROUPS
            ? `Cần ít nhất ${MIN_TEAMS_FOR_EXPLICIT_GROUPS} đội để chia bảng.`
            : null,
      };
    case WORKFLOW_STAGE.DISCIPLINES:
      return {
        stage,
        actionId: "configure_disciplines",
        label: "Cấu hình nội dung",
        hint: "Thêm nội dung thi đấu trước khi tạo cặp đấu.",
        groupActionsEnabled: true,
        groupActionsDisabledReason: null,
      };
    case WORKFLOW_STAGE.MATCHUPS:
      return {
        stage,
        actionId: "create_matchups",
        label: "Tạo cặp đấu",
        hint: "Tạo cặp đấu / lịch vòng tròn theo bảng đã chia.",
        groupActionsEnabled: true,
        groupActionsDisabledReason: null,
      };
    case WORKFLOW_STAGE.SCHEDULE:
      return {
        stage,
        actionId: "create_or_review_schedule",
        label: hasScheduledMatchups(teamData?.matchups || [])
          ? "Kiểm tra và công bố"
          : "Tạo lịch",
        hint: hasScheduledMatchups(teamData?.matchups || [])
          ? "Kiểm tra lịch nháp rồi công bố."
          : "Gắn giờ / sân cho các cặp đấu.",
        groupActionsEnabled: true,
        groupActionsDisabledReason: null,
      };
    case WORKFLOW_STAGE.LINEUP:
      return {
        stage,
        actionId: "manage_lineups",
        label: "Quản lý đội hình",
        hint: "Khóa / công bố đội hình các lượt.",
        groupActionsEnabled: false,
        groupActionsDisabledReason: "Lịch đã công bố — không chia lại bảng.",
      };
    case WORKFLOW_STAGE.RESULTS:
      return {
        stage,
        actionId: "enter_results",
        label: "Nhập kết quả",
        hint: "Mở portal trọng tài để nhập điểm.",
        groupActionsEnabled: false,
        groupActionsDisabledReason: "Giải đang có kết quả — không chia lại bảng.",
      };
    case WORKFLOW_STAGE.CLOSED:
      return {
        stage,
        actionId: "closed",
        label: "Đã đóng giải",
        hint: "Giải đã đóng.",
        groupActionsEnabled: false,
        groupActionsDisabledReason: "Giải đã đóng.",
      };
    default:
      return {
        stage,
        actionId: "continue_setup",
        label: "Tiếp tục thiết lập",
        hint: "Tiếp tục thiết lập giải.",
        groupActionsEnabled: !teamsInsufficient,
        groupActionsDisabledReason: null,
      };
  }
}

/**
 * Stepper-compatible projection used by TeamTournamentWorkflowBar.
 */
export function buildWorkflowStageProjection(teamData, tournament = null) {
  const stage = deriveWorkflowStage(teamData, tournament);
  const stageIndex = WORKFLOW_STAGE_ORDER.indexOf(stage);
  const stepComplete = WORKFLOW_STAGE_ORDER.map((_, index) => index < stageIndex);
  const next = deriveNextWorkflowAction(teamData, tournament);

  return {
    stages: WORKFLOW_STAGE_ORDER.map((id) => ({
      id,
      label: WORKFLOW_STAGE_LABELS[id],
    })),
    stage,
    stageIndex: stageIndex < 0 ? 0 : stageIndex,
    stepComplete,
    draftStatusLabel: deriveDraftStatusLabel(teamData, tournament),
    nextAction: next,
    hints: next.hint ? [next.hint] : [],
  };
}
