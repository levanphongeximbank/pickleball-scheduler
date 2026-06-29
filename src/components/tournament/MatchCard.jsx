import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";

import { touchButtonSx } from "./mobileUi.js";
import MatchRefereeStatusChip from "./MatchRefereeStatusChip.jsx";

export { buildDailyMatchCardProps, buildDirectorMatchCardProps } from "./matchCardProps.js";

export default function MatchCard({
  title,
  subtitle,
  badge,
  statusChip,
  actionLabel,
  onAction,
  actionColor = "primary",
  actionVariant = "contained",
  secondaryActionLabel,
  onSecondaryAction,
  tertiaryActionLabel,
  onTertiaryAction,
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 1.5, sm: 1.25 },
        borderRadius: 1.5,
      }}
    >
        <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
        <Typography
          variant="body2"
          fontWeight="bold"
          sx={{ lineHeight: 1.45, wordBreak: "break-word", flex: 1 }}
        >
          {title}
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
          {statusChip && (
            <MatchRefereeStatusChip match={statusChip.match} liveRow={statusChip.liveRow} />
          )}
          {badge && <Chip size="small" label={badge} />}
        </Stack>
      </Stack>

      {subtitle && (
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ mt: 0.75, wordBreak: "break-word" }}
        >
          {subtitle}
        </Typography>
      )}

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
