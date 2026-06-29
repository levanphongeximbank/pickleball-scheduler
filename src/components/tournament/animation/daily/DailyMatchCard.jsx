import { Box, Chip, Paper, Stack, Typography } from "@mui/material";

import {
  DAILY_MATCH_DISPLAY_LABELS,
  getFairnessTier,
  hasFairnessScore,
  resolveDailyMatchDisplayStatus,
} from "./dailyFairMatchUtils.js";

export default function DailyMatchCard({
  step,
  index = 0,
  revealedCount = 0,
  isLatest = false,
  isNew = false,
}) {
  const displayStatus = resolveDailyMatchDisplayStatus(step.match, index, revealedCount);
  const hasScore = hasFairnessScore(step.match);
  const tier = hasScore ? getFairnessTier(step.balancePercent) : null;

  return (
    <Paper
      variant="outlined"
      className={`daily-match-card${isLatest ? " daily-match-card--latest" : ""}${
        isNew ? " daily-match-card--new" : ""
      }`}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            {step.matchLabel}
          </Typography>
          <Typography variant="body2" fontWeight={800} sx={{ wordBreak: "break-word", mt: 0.25 }}>
            <span className="daily-match-team daily-match-team--a">
              {step.teamA?.label || step.left?.name}
            </span>
            <span className="daily-match-vs"> VS </span>
            <span className="daily-match-team daily-match-team--b">
              {step.teamB?.label || step.right?.name}
            </span>
          </Typography>

          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
            <Typography variant="caption" color="text.secondary">
              {step.courtLabel || "Chưa xếp sân"}
            </Typography>
            {step.estimatedStartTime ? (
              <Typography variant="caption" color="text.secondary">
                • {step.estimatedStartTime}
              </Typography>
            ) : null}
          </Stack>

          {tier && step.balancePercent != null ? (
            <Typography
              variant="caption"
              className={`daily-match-balance daily-match-balance--${tier.tone}`}
            >
              Cân bằng {step.balancePercent}% • {tier.label}
            </Typography>
          ) : null}
        </Box>

        <Chip
          size="small"
          label={DAILY_MATCH_DISPLAY_LABELS[displayStatus] || displayStatus}
          variant="outlined"
          className={`daily-match-status daily-match-status--${displayStatus}`}
        />
      </Stack>
    </Paper>
  );
}
