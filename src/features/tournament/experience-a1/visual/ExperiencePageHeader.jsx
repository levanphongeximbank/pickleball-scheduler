import { Box, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";

import {
  TOURNAMENT_COLOR,
  TOURNAMENT_ELEVATION,
  TOURNAMENT_TYPE,
} from "./tournamentExperienceTokens.js";

export default function ExperiencePageHeader({
  title,
  subtitle,
  contextLine,
  actions,
  testId = "tournament-experience-header",
}) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  return (
    <Box
      data-testid={testId}
      sx={{
        mb: 1.5,
        px: { xs: 1.5, md: 2 },
        py: 1,
        bgcolor: TOURNAMENT_COLOR.cardBg,
        borderBottom: `1px solid ${TOURNAMENT_COLOR.divider}`,
        boxShadow: TOURNAMENT_ELEVATION.header,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          minHeight: 52,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: 18, md: TOURNAMENT_TYPE.pageTitle.size },
              fontWeight: TOURNAMENT_TYPE.pageTitle.weight,
              lineHeight: 1.15,
              color: TOURNAMENT_COLOR.text,
            }}
          >
            {title}
          </Typography>
          {subtitle ? (
            <Typography sx={{ fontSize: TOURNAMENT_TYPE.pageSubtitle.size, color: TOURNAMENT_COLOR.textMuted }}>
              {subtitle}
            </Typography>
          ) : null}
          {contextLine ? (
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: TOURNAMENT_COLOR.text, mt: 0.35 }}>
              {contextLine}
            </Typography>
          ) : null}
        </Box>
        {isDesktop && actions ? (
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
            {actions}
          </Stack>
        ) : null}
      </Box>
      {!isDesktop && actions ? (
        <Stack
          data-testid={`${testId}-actions`}
          direction="row"
          spacing={0.75}
          useFlexGap
          sx={{ mt: 1, alignItems: "center", flexWrap: "wrap" }}
        >
          {actions}
        </Stack>
      ) : null}
    </Box>
  );
}
