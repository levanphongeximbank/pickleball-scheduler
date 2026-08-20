import { Link as RouterLink, useNavigate } from "react-router-dom";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import { Alert, Box, Button, Stack } from "@mui/material";

import ClubAssignmentBanner from "../../../../components/auth/ClubAssignmentBanner.jsx";
import TournamentExperienceWorkspace from "../components/TournamentExperienceWorkspace.jsx";
import CenterRightRailCard from "../visual/CenterRightRailCard.jsx";
import ExperiencePageHeader from "../visual/ExperiencePageHeader.jsx";
import {
  TOURNAMENT_COLOR,
  outlinedActionSx,
  primaryActionSx,
} from "../visual/tournamentExperienceTokens.js";
import { buildTeamExperienceNav } from "./teamExperienceNav.js";

export function TeamExperiencePageFrame({
  tournamentId,
  title,
  subtitle,
  activeKey,
  message,
  error,
  loading,
  loadError,
  children,
  primaryAction = null,
}) {
  const navigate = useNavigate();
  const nav = buildTeamExperienceNav(tournamentId);

  if (loading) {
    return (
      <Box data-testid={`team-experience-${activeKey}`} sx={{ bgcolor: TOURNAMENT_COLOR.pageBg, minWidth: 0 }}>
        <ExperiencePageHeader title={title} subtitle={subtitle} />
        <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>
          <Alert severity="info">Đang tải…</Alert>
        </Box>
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box data-testid={`team-experience-${activeKey}`} sx={{ bgcolor: TOURNAMENT_COLOR.pageBg, minWidth: 0 }}>
        <ExperiencePageHeader title={title} subtitle={subtitle} />
        <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>
          <ClubAssignmentBanner />
          <Alert severity="warning" sx={{ mb: 1 }}>{loadError}</Alert>
          <Button component={RouterLink} to="/tournament" size="small" sx={outlinedActionSx}>
            Trung tâm giải đấu
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      data-testid={`team-experience-${activeKey}`}
      sx={{ width: "100%", minWidth: 0, overflowX: "hidden", bgcolor: TOURNAMENT_COLOR.pageBg }}
    >
      <ExperiencePageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Button
              size="small"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(`/tournaments/${encodeURIComponent(tournamentId)}/overview`)}
              sx={outlinedActionSx}
            >
              Tổng quan
            </Button>
            {primaryAction}
          </Stack>
        }
      />
      <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>
        <ClubAssignmentBanner />
        {error ? <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert> : null}
        {message ? <Alert severity="success" sx={{ mb: 1 }}>{message}</Alert> : null}
        <TournamentExperienceWorkspace
          rail={
            <CenterRightRailCard title="Điều hướng" icon={<SportsTennisIcon sx={{ fontSize: 16 }} />}>
              <Stack spacing={0.5}>
                {nav.map((item) => (
                  <Button
                    key={item.key}
                    component={RouterLink}
                    to={item.to}
                    size="small"
                    variant={item.key === activeKey ? "contained" : "text"}
                    sx={{
                      justifyContent: "flex-start",
                      textTransform: "none",
                      fontWeight: item.key === activeKey ? 700 : 500,
                      ...(item.key === activeKey ? primaryActionSx : {}),
                    }}
                  >
                    {item.label}
                    {!item.adopted ? " · chưa chuyển" : ""}
                  </Button>
                ))}
              </Stack>
            </CenterRightRailCard>
          }
        >
          {children}
        </TournamentExperienceWorkspace>
      </Box>
    </Box>
  );
}
