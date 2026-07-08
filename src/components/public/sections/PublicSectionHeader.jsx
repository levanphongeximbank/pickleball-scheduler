import { Link as RouterLink } from "react-router-dom";
import { alpha } from "@mui/material/styles";
import { Box, Button, Stack, Typography } from "@mui/material";

import { PUBLIC_COLORS } from "../publicPortalStyles.js";

export default function PublicSectionHeader({
  eyebrow,
  title,
  subtitle,
  actionLabel,
  actionTo,
  variant = "dark",
}) {
  const isLight = variant === "light";

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      justifyContent="space-between"
      alignItems={{ xs: "flex-start", sm: "flex-end" }}
      spacing={2}
      sx={{ mb: { xs: 3, md: 5 } }}
    >
      <Box>
        {eyebrow && (
          <Typography
            variant="overline"
            sx={{
              display: "block",
              mb: 1,
              fontWeight: 700,
              letterSpacing: 2,
              color: isLight ? PUBLIC_COLORS.primary : PUBLIC_COLORS.lime,
            }}
          >
            {eyebrow}
          </Typography>
        )}
        <Typography
          variant="h4"
          fontWeight={800}
          sx={{
            mb: 0.75,
            color: isLight ? PUBLIC_COLORS.textDark : PUBLIC_COLORS.text,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography
            variant="body1"
            sx={{ color: isLight ? PUBLIC_COLORS.textDarkMuted : PUBLIC_COLORS.textMuted, maxWidth: 560 }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>
      {actionLabel && actionTo && (
        <Button
          component={RouterLink}
          to={actionTo}
          sx={{
            color: isLight ? PUBLIC_COLORS.primary : PUBLIC_COLORS.lime,
            textTransform: "none",
            fontWeight: 600,
            flexShrink: 0,
            "&:hover": {
              bgcolor: isLight
                ? alpha(PUBLIC_COLORS.primary, 0.08)
                : alpha(PUBLIC_COLORS.lime, 0.1),
            },
          }}
        >
          {actionLabel} →
        </Button>
      )}
    </Stack>
  );
}
