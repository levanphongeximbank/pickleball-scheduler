import { Box, Chip, Stack, Typography } from "@mui/material";

import { TOURNAMENT_LAYOUT } from "./tournamentLayout.js";

export default function TournamentPageHeader({
  title,
  description,
  contextLine,
  badge,
  badgeColor = "default",
  action,
}) {
  return (
    <Box sx={{ mb: TOURNAMENT_LAYOUT.sectionGap }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={1}
        sx={{ mb: description || contextLine ? 0.75 : 0 }}
      >
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography
            component="h1"
            sx={{
              fontSize: 28,
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
              color: "text.primary",
            }}
          >
            {title}
          </Typography>
          {badge != null ? (
            <Chip size="small" label={badge} color={badgeColor} variant="outlined" />
          ) : null}
        </Stack>
        {action ? <Box sx={{ minWidth: 0, maxWidth: "100%", width: { xs: "100%", sm: "auto" } }}>{action}</Box> : null}
      </Stack>
      {description ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontSize: 14, lineHeight: 1.5, mb: contextLine ? 0.5 : 0, maxWidth: 720 }}
        >
          {description}
        </Typography>
      ) : null}
      {contextLine ? (
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 14, lineHeight: 1.5 }}>
          {contextLine}
        </Typography>
      ) : null}
    </Box>
  );
}
