import SportsBaseballIcon from "@mui/icons-material/SportsBaseball";
import { Box, Chip, Paper, Stack, Typography } from "@mui/material";

import FairMatchTeamCard from "./FairMatchTeamCard.jsx";
import FairnessScoreBadge from "./FairnessScoreBadge.jsx";
import MatchCreationSteps from "./MatchCreationSteps.jsx";
import { FAIR_MATCH_PHASES, getPhaseStatusText } from "./dailyFairMatchUtils.js";

function isTeamAVisible(phase) {
  return [
    FAIR_MATCH_PHASES.TEAM_A,
    FAIR_MATCH_PHASES.TEAM_B,
    FAIR_MATCH_PHASES.VS,
    FAIR_MATCH_PHASES.FAIRNESS,
    FAIR_MATCH_PHASES.COURT,
    FAIR_MATCH_PHASES.CONFIRM,
    FAIR_MATCH_PHASES.FLY,
  ].includes(phase);
}

function isTeamBVisible(phase) {
  return [
    FAIR_MATCH_PHASES.TEAM_B,
    FAIR_MATCH_PHASES.VS,
    FAIR_MATCH_PHASES.FAIRNESS,
    FAIR_MATCH_PHASES.COURT,
    FAIR_MATCH_PHASES.CONFIRM,
    FAIR_MATCH_PHASES.FLY,
  ].includes(phase);
}

function isVsVisible(phase) {
  return [
    FAIR_MATCH_PHASES.VS,
    FAIR_MATCH_PHASES.FAIRNESS,
    FAIR_MATCH_PHASES.COURT,
    FAIR_MATCH_PHASES.CONFIRM,
    FAIR_MATCH_PHASES.FLY,
  ].includes(phase);
}

export default function FairMatchRevealStage({
  step = null,
  phase = FAIR_MATCH_PHASES.IDLE,
  revealedCount = 0,
  totalCount = 0,
}) {
  const flying = phase === FAIR_MATCH_PHASES.FLY;
  const showFairness =
    step &&
    [FAIR_MATCH_PHASES.FAIRNESS, FAIR_MATCH_PHASES.COURT, FAIR_MATCH_PHASES.CONFIRM, FAIR_MATCH_PHASES.FLY].includes(
      phase
    );
  const showCourt =
    step &&
    [FAIR_MATCH_PHASES.COURT, FAIR_MATCH_PHASES.CONFIRM, FAIR_MATCH_PHASES.FLY].includes(phase);
  const showConfirm = phase === FAIR_MATCH_PHASES.CONFIRM;
  const inFlow = step && phase !== FAIR_MATCH_PHASES.IDLE && phase !== FAIR_MATCH_PHASES.COMPLETE;
  const statusText = getPhaseStatusText(phase);

  if (!step && phase !== FAIR_MATCH_PHASES.COMPLETE) {
    return (
      <Paper variant="outlined" className="daily-fair-reveal-stage daily-fair-reveal-stage--empty">
        <Typography variant="body1" color="text.secondary" align="center">
          {statusText}
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" className="daily-fair-reveal-stage">
      <Box className="daily-fair-reveal-stage__glow" />

      <Stack spacing={2} sx={{ position: "relative", zIndex: 1, width: "100%" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="overline" color="primary.main" fontWeight="bold">
            {step?.matchLabel || "Trận đấu"}
          </Typography>
          <Chip
            size="small"
            label={`Trận ${Math.min(revealedCount + (inFlow ? 1 : 0), totalCount)}/${totalCount}`}
            color="primary"
            variant="outlined"
          />
        </Stack>

        <MatchCreationSteps phase={phase} />

        <Typography variant="body1" fontWeight={700} color="primary.main" className="daily-fair-status-line">
          {statusText}
        </Typography>

        {inFlow ? (
          <Box className={`daily-fair-arena${flying ? " daily-fair-arena--fly" : ""}`}>
            <FairMatchTeamCard
              team={step.teamA}
              side="a"
              visible={isTeamAVisible(phase)}
              active={phase === FAIR_MATCH_PHASES.TEAM_A}
              flying={flying}
            />

            <Box
              className={`daily-fair-vs-hub${
                isVsVisible(phase) ? " daily-fair-vs-hub--visible" : ""
              }${phase === FAIR_MATCH_PHASES.VS ? " daily-fair-vs-hub--pulse" : ""}`}
            >
              <SportsBaseballIcon className="daily-fair-vs-ball" />
              <Typography variant="h2" className="daily-fair-vs-text">
                VS
              </Typography>
            </Box>

            <FairMatchTeamCard
              team={step.teamB}
              side="b"
              visible={isTeamBVisible(phase)}
              active={phase === FAIR_MATCH_PHASES.TEAM_B}
              flying={flying}
            />
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 8 }}>
            {statusText}
          </Typography>
        )}

        <Stack spacing={1.25} alignItems="center">
          {showFairness && (
            <FairnessScoreBadge match={step.match} balancePercent={step.balancePercent} />
          )}

          {showCourt && (
            <Paper variant="outlined" className="daily-court-reveal">
              <Typography variant="caption" color="text.secondary">
                Sân dự kiến
              </Typography>
              <Typography variant="h6" fontWeight={700}>
                {step.courtLabel || "Chưa xếp sân"}
              </Typography>
              {step.estimatedStartTime ? (
                <Typography variant="body2" color="text.secondary">
                  Bắt đầu dự kiến {step.estimatedStartTime}
                </Typography>
              ) : null}
            </Paper>
          )}

          {showConfirm && (
            <Chip
              color="success"
              label="Tạo trận thành công"
              className="daily-confirm-chip"
            />
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
