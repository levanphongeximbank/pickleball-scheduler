import {
  LINEUP_STATUS,
  MATCHUP_STATUS,
  SUB_MATCH_STATUS,
} from "../../../features/team-tournament/constants.js";
import { countDreambreakerPendingMatchups } from "../../../features/team-tournament/engines/matchupTieEngine.js";
import { getLineup } from "../../../features/team-tournament/models/index.js";

export const WORKFLOW_STEPS = [
  { id: "teams", label: "Đội" },
  { id: "disciplines", label: "Nội dung" },
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

export function computeTeamTournamentWorkflow(teamData) {
  const teams = teamData?.teams?.length || 0;
  const disciplines = teamData?.disciplines?.length || 0;
  const matchups = teamData?.matchups || [];

  const lineupDoneCount = matchups.filter((matchup) =>
    isLineupPhaseDone(teamData, matchup)
  ).length;

  const resultsDoneCount = matchups.filter(
    (matchup) => matchup.status === MATCHUP_STATUS.COMPLETED
  ).length;

  const resultsStarted = matchups.some(hasResultsActivity);

  const stepComplete = [
    teams >= 2,
    disciplines >= 1,
    matchups.length > 0,
    matchups.length > 0 && lineupDoneCount === matchups.length,
    matchups.length > 0 && resultsDoneCount === matchups.length,
  ];

  const dreambreakerPending = countDreambreakerPendingMatchups(teamData) > 0;

  const hints = [];
  if (!stepComplete[0]) {
    hints.push("Thêm ít nhất 2 đội (MLP: 4 VĐV/đội, 2 nam + 2 nữ).");
  } else if (!stepComplete[1]) {
    hints.push("Cấu hình ít nhất 1 nội dung thi đấu.");
  } else if (!stepComplete[2]) {
    hints.push("Tạo lịch vòng tròn để mở giai đoạn nộp đội hình.");
  } else if (!stepComplete[3] && lineupDoneCount === 0) {
    hints.push("Xem tab Sơ đồ để duyệt lịch trước khi khóa đội hình.");
  } else if (!stepComplete[3]) {
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
  } else if (!stepComplete[4]) {
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
    hints,
    allComplete: stepComplete.every(Boolean),
    progress: {
      lineups: { done: lineupDoneCount, total: matchups.length },
      results: { done: resultsDoneCount, total: matchups.length },
    },
  };
}
