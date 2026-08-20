import AddIcon from "@mui/icons-material/Add";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Box, Button, Chip, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import {
  TOURNAMENT_COLOR,
  TOURNAMENT_ELEVATION,
  TOURNAMENT_TYPE,
  outlinedActionSx,
  primaryActionSx,
} from "./tournamentExperienceTokens.js";

export default function CenterPageHeader({
  title,
  subtitle,
  contextChips = [],
  onCreate,
  createDisabled = false,
}) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const chips = contextChips.filter(Boolean);

  const actions = (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
      <Button
        variant="contained"
        size="small"
        startIcon={<AddIcon />}
        onClick={onCreate}
        disabled={createDisabled}
        sx={primaryActionSx}
      >
        Tạo giải
      </Button>
      <Button
        component={RouterLink}
        to="/public/tournaments"
        variant="outlined"
        size="small"
        endIcon={<OpenInNewIcon />}
        sx={{ ...outlinedActionSx, display: { xs: "none", sm: "inline-flex" } }}
      >
        Xem trang công khai
      </Button>
    </Stack>
  );

  return (
    <Box
      data-testid="tournament-center-header"
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
          {chips.length ? (
            <Stack direction="row" spacing={0.5} useFlexGap sx={{ mt: 0.5, flexWrap: "wrap" }}>
              {chips.map((label) => (
                <Chip
                  key={label}
                  size="small"
                  label={label}
                  sx={{
                    height: 22,
                    fontSize: 11,
                    fontWeight: 600,
                    bgcolor: TOURNAMENT_COLOR.primarySurface,
                    color: TOURNAMENT_COLOR.primaryDark,
                  }}
                />
              ))}
            </Stack>
          ) : null}
        </Box>
        {isDesktop ? actions : null}
      </Box>
      {!isDesktop ? (
        <Stack data-testid="tournament-center-header-actions" sx={{ mt: 1, width: "100%" }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={onCreate}
            disabled={createDisabled}
            sx={{ ...primaryActionSx, width: "100%" }}
          >
            Tạo giải
          </Button>
        </Stack>
      ) : null}
    </Box>
  );
}
