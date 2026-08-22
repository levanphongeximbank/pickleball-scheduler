/**
 * AuthEmptyState — authenticated empty pattern (Wave 2 Batch 2D).
 *
 * Domain supplies all copy. No hardcoded club/tournament strings.
 *
 * @ownership AUTHENTICATED_SHARED
 */

import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import { Box, Button, Stack, Typography } from "@mui/material";

/**
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {import('react').ElementType} [props.icon]
 * @param {string} [props.primaryActionLabel]
 * @param {() => void} [props.onPrimaryAction]
 * @param {string} [props.secondaryActionLabel]
 * @param {() => void} [props.onSecondaryAction]
 */
export default function AuthEmptyState({
  title,
  description,
  icon: Icon = InboxOutlinedIcon,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  sx = {},
}) {
  return (
    <Box
      role="status"
      data-testid="auth-empty-state"
      aria-label={title}
      sx={{
        py: 5,
        px: 2,
        textAlign: "center",
        borderRadius: 2,
        border: "1px dashed",
        borderColor: "divider",
        bgcolor: "background.default",
        ...sx,
      }}
    >
      {Icon ? <Icon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} aria-hidden /> : null}
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        {title}
      </Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, mx: "auto" }}>
          {description}
        </Typography>
      ) : null}
      {(primaryActionLabel && onPrimaryAction) || (secondaryActionLabel && onSecondaryAction) ? (
        <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
          {primaryActionLabel && onPrimaryAction ? (
            <Button variant="contained" onClick={onPrimaryAction}>
              {primaryActionLabel}
            </Button>
          ) : null}
          {secondaryActionLabel && onSecondaryAction ? (
            <Button variant="outlined" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          ) : null}
        </Stack>
      ) : null}
    </Box>
  );
}
