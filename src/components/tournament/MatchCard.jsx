import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";

import { touchButtonSx } from "./mobileUi.js";
import MatchRefereeStatusChip from "./MatchRefereeStatusChip.jsx";
import { matchCardSx, matchStatusBorderColor } from "./tournamentLayout.js";

export { buildDailyMatchCardProps, buildDirectorMatchCardProps } from "./matchCardProps.js";

export default function MatchCard({
  title,
  subtitle,
  badge,
  statusChip,
  matchStatus,
  actionLabel,
  onAction,
  actionColor = "primary",
  actionVariant = "contained",
  secondaryActionLabel,
  onSecondaryAction,
  tertiaryActionLabel,
  onTertiaryAction,
}) {
  const borderAccent = matchStatus ? matchStatusBorderColor(matchStatus) : undefined;

  return (
    <Paper
      variant="outlined"
      elevation={0}
      sx={{
        ...matchCardSx,
        p: { xs: 1.5, sm: 1.25 },
        borderLeft: borderAccent ? `3px solid ${borderAccent}` : undefined,
      }}
    >
      <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
        <Typography
          variant="body2"
          fontWeight={700}
          sx={{ lineHeight: 1.45, wordBreak: "break-word", flex: 1 }}
        >
          {title}
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {statusChip && (
            <MatchRefereeStatusChip match={statusChip.match} liveRow={statusChip.liveRow} />
          )}
          {badge ? <Chip size="small" label={badge} variant="outlined" /> : null}
        </Stack>
      </Stack>

      {subtitle ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 0.75, wordBreak: "break-word", display: "block" }}
        >
          {subtitle}
        </Typography>
      ) : null}

      {actionLabel && onAction && (
        <Box sx={{ mt: 1.25 }}>
          <Button
            fullWidth
            size="large"
            color={actionColor}
            variant={actionVariant}
            onClick={onAction}
            sx={touchButtonSx}
          >
            {actionLabel}
          </Button>
        </Box>
      )}

      {secondaryActionLabel && onSecondaryAction && (
        <Box sx={{ mt: 1 }}>
          <Button
            fullWidth
            size="large"
            color="secondary"
            variant="outlined"
            onClick={onSecondaryAction}
            sx={touchButtonSx}
          >
            {secondaryActionLabel}
          </Button>
        </Box>
      )}

      {tertiaryActionLabel && onTertiaryAction && (
        <Box sx={{ mt: 1 }}>
          <Button
            fullWidth
            size="small"
            color="warning"
            variant="text"
            onClick={onTertiaryAction}
          >
            {tertiaryActionLabel}
          </Button>
        </Box>
      )}
    </Paper>
  );
}
