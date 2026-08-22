/**
 * AuthLoadingState — authenticated section/page loading (Wave 2 Batch 2D).
 * Not button loading — use MUI Button `loading` for that.
 *
 * @ownership AUTHENTICATED_SHARED
 */

import { Box, CircularProgress, Stack, Typography } from "@mui/material";

/**
 * @param {object} props
 * @param {string} [props.label]
 * @param {'section'|'page'} [props.variant]
 */
export default function AuthLoadingState({
  label = "Dang tai…",
  variant = "section",
  sx = {},
}) {
  return (
    <Box
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="auth-loading-state"
      sx={{
        py: variant === "page" ? 8 : 4,
        px: 2,
        display: "flex",
        justifyContent: "center",
        ...sx,
      }}
    >
      <Stack spacing={1.5} alignItems="center">
        <CircularProgress size={variant === "page" ? 40 : 28} aria-hidden />
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Stack>
    </Box>
  );
}
