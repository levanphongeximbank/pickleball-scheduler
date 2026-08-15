import { Box, Chip, Paper, Stack, Typography } from "@mui/material";

import {
  DAILY_MATCH_DISPLAY_LABELS,
  getFairnessTier,
  hasFairnessScore,
  resolveDailyMatchDisplayStatus,
} from "./dailyFairMatchUtils.js";

/**
 * Fair-match revealed card — status chip never competes with team labels
 * in the same narrow horizontal flex row (DP-11).
 */
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
  const teamA = step.teamA?.label || step.left?.name || "TBD";
  const teamB = step.teamB?.label || step.right?.name || "TBD";

  return (
    <Paper
      variant="outlined"
      className={`daily-match-card${isLatest ? " daily-match-card--latest" : ""}${
        isNew ? " daily-match-card--new" : ""
      }`}
      sx={{ minWidth: 0, width: "100%" }}
    >
      <Stack spacing={0.75} sx={{ minWidth: 0 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={1}
          sx={{ minWidth: 0 }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={700}
            sx={{ minWidth: 0, overflowWrap: "break-word", wordBreak: "normal" }}
          >
            {step.matchLabel}
          </Typography>
          <Chip
            size="small"
            label={DAILY_MATCH_DISPLAY_LABELS[displayStatus] || displayStatus}
            variant="outlined"
            className={`daily-match-status daily-match-status--${displayStatus}`}
            sx={{ flexShrink: 0 }}
          />
        </Stack>

        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="body2"
            fontWeight={800}
            className="daily-match-team daily-match-team--a"
            sx={{
              wordBreak: "normal",
              overflowWrap: "break-word",
              lineHeight: 1.35,
            }}
          >
            {teamA}
          </Typography>
          <Typography
            variant="caption"
            className="daily-match-vs"
            sx={{ display: "block", textAlign: "center", my: 0.25, fontWeight: 700 }}
          >
            VS
          </Typography>
          <Typography
            variant="body2"
            fontWeight={800}
            className="daily-match-team daily-match-team--b"
            sx={{
              wordBreak: "normal",
              overflowWrap: "break-word",
              lineHeight: 1.35,
            }}
          >
            {teamB}
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
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
      </Stack>
    </Paper>
  );
}
