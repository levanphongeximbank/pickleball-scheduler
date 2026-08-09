import {
  LINEUP_STATUS,
  MATCHUP_STATUS,
  SUB_MATCH_STATUS,
} from "../../../features/team-tournament/constants.js";
import { countDreambreakerPendingMatchups } from "../../../features/team-tournament/engines/matchupTieEngine.js";
import { getLineup } from "../../../features/team-tournament/models/index.js";
import {
  buildWorkflowStageProjection,
  deriveDraftStatusLabel,
  deriveNextWorkflowAction,
  deriveWorkflowStage,
  WORKFLOW_STAGE,
  WORKFLOW_STAGE_LABELS,
  WORKFLOW_STAGE_ORDER,
} from "../../../features/team-tournament/engines/teamTournamentWorkflowStage.js";
import {
  hasExplicitGroups,
  tournamentRequiresExplicitGroups,
} from "../../../features/team-tournament/engines/teamGroupDivisionPolicy.js";

export {
  deriveWorkflowStage,
  deriveDraftStatusLabel,
  deriveNextWorkflowAction,
  buildWorkflowStageProjection,
  WORKFLOW_STAGE,
  WORKFLOW_STAGE_LABELS,
  WORKFLOW_STAGE_ORDER,
};

/** UI stepper — Format & Venue before Teams/Groups. */
export const WORKFLOW_STEPS = [
  { id: "format", label: "Format & Venue" },
  { id: "teams", label: "Đội" },
  { id: "groups", label: "Chia bảng" },
  { id: "disciplines", label: "Nội dung" },
  { id: "matchups", label: "Cặp đấu" },
  { id: "schedule", label: "Lịch" },
  { id: "lineups", label: "Đội hình" },
  { id: "results", label: "Kết quả" },
];

const LINEUP_PHASE_DONE_MATCHUP_STATUSES = new Set([
  MATCHUP_STATUS.PUBLISHED,
  MATCHUP_STATUS.IN_PROGRESS,
  MATCHUP_STATUS.COMPLETED,
]);

function isLineupPublishedForTeam(teamData, matchupId, teamId) {
  const lineup = getLineup(teamData, matchupId, teamId);
  return lineup?.status === LINEUP_STATUS.PUBLISHED;
}

export function isLineupPhaseDone(teamData, matchup) {
  if (LINEUP_PHASE_DONE_MATCHUP_STATUSES.has(matchup.status)) {
    return true;
  }

  return (
    isLineupPublishedForTeam(teamData, matchup.id, matchup.teamAId) &&
    isLineupPublishedForTeam(teamData, matchup.id, matchup.teamBId)
  );
}

function hasResultsActivity(matchup) {
  if (
    matchup.status === MATCHUP_STATUS.IN_PROGRESS ||
    matchup.status === MATCHUP_STATUS.COMPLETED
  ) {
    return true;
  }

  return (matchup.subMatches || []).some(
    (subMatch) =>
      subMatch.status === SUB_MATCH_STATUS.PLAYING ||
      subMatch.status === SUB_MATCH_STATUS.COMPLETED ||
      subMatch.status === SUB_MATCH_STATUS.FORFEIT
  );
}

export function computeTeamTournamentWorkflow(teamData, tournament = null) {
  const teams = teamData?.teams?.length || 0;
  const disciplines = teamData?.disciplines?.length || 0;
  const matchups = teamData?.matchups || [];
  const needsGroups = tournamentRequiresExplicitGroups(teams, teamData);
  const groupsReady = !needsGroups || hasExplicitGroups(teamData);
  const hasMatchups = matchups.length > 0;
  const hasSchedule = matchups.some(
    (matchup) =>
      Boolean(matchup.scheduledAt) ||
      Boolean(matchup.courtLabel) ||
      Boolean(matchup.courtId)
  );
  const formatReady = Boolean(
    teamData?.settings?.formatPreset ||
      (teams > 0) // legacy tournaments already past format
  );

  const lineupDoneCount = matchups.filter((matchup) =>
    isLineupPhaseDone(teamData, matchup)
  ).length;

  const resultsDoneCount = matchups.filter(
    (matchup) => matchup.status === MATCHUP_STATUS.COMPLETED
  ).length;

  const resultsStarted = matchups.some(hasResultsActivity);

  const stepComplete = [
    formatReady,
    teams >= 2,
    groupsReady,
    disciplines >= 1,
    hasMatchups,
    hasMatchups && hasSchedule,
    hasMatchups && lineupDoneCount === matchups.length,
    hasMatchups && resultsDoneCount === matchups.length,
  ];

  const dreambreakerPending = countDreambreakerPendingMatchups(teamData) > 0;
  const stageProjection = buildWorkflowStageProjection(teamData, tournament);
  const nextAction = stageProjection.nextAction;

  const hints = [];
  if (!stepComplete[0]) {
    hints.push("Cấu hình Format & Venue (MLP 4 / tùy chỉnh, bảng, sân) trước khi thêm đội.");
  } else if (!stepComplete[1]) {
    hints.push("Thêm ít nhất 2 đội (MLP: 4 VĐV/đội, 2 nam + 2 nữ).");
  } else if (!stepComplete[2]) {
    hints.push("Chia bảng đấu trước khi tạo cặp đấu / lịch thi đấu (hỗ trợ 1 bảng).");
  } else if (!stepComplete[3]) {
    hints.push("Cấu hình ít nhất 1 nội dung thi đấu.");
  } else if (!stepComplete[4]) {
    hints.push("Tạo cặp đấu / lịch vòng tròn theo bảng đã chia.");
  } else if (!stepComplete[5]) {
    hints.push("Gắn giờ và sân cho các cặp đấu, rồi kiểm tra sơ đồ.");
  } else if (!stepComplete[6] && lineupDoneCount === 0) {
    hints.push("Xem tab Sơ đồ để duyệt lịch trước khi khóa đội hình.");
  } else if (!stepComplete[6]) {
    if (lineupDoneCount > 0) {
      hints.push(
        `Đã công bố đội hình ${lineupDoneCount}/${matchups.length} lượt. Khóa và công bố các lượt còn lại.`
      );
    } else {
      hints.push("Mời đội trưởng nộp đội hình qua portal, sau đó khóa và công bố.");
    }
  } else if (dreambreakerPending) {
    hints.push(
      "Tỷ số trận con 2–2 — bước Dreambreaker (đấu đơn luân lưu): nộp thứ tự đội trưởng, trọng tài ghi điểm."
    );
  } else if (!stepComplete[7]) {
    if (resultsStarted) {
      hints.push(
        `Đang nhập kết quả (${resultsDoneCount}/${matchups.length} lượt hoàn tất). Tiếp tục trên portal trọng tài.`
      );
    } else {
      hints.push("Mở portal trọng tài để nhập kết quả trận con.");
    }
  }

  const currentStep = stepComplete.findIndex((done) => !done);
  const activeStep = currentStep === -1 ? WORKFLOW_STEPS.length - 1 : currentStep;

  return {
    steps: WORKFLOW_STEPS,
    stepComplete,
    currentStep: activeStep,
    hints: hints.length ? hints : stageProjection.hints,
    allComplete: stepComplete.every(Boolean),
    progress: {
      lineups: { done: lineupDoneCount, total: matchups.length },
      results: { done: resultsDoneCount, total: matchups.length },
    },
    stage: stageProjection.stage,
    draftStatusLabel: stageProjection.draftStatusLabel,
    nextAction,
  };
}
