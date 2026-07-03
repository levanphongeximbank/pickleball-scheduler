import { useMemo, useState } from "react";
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import GroupsIcon from "@mui/icons-material/Groups";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import WbSunnyOutlinedIcon from "@mui/icons-material/WbSunnyOutlined";

import ClubSwitcher from "../ClubSwitcher.jsx";
import SeasonLeagueSwitcher from "../SeasonLeagueSwitcher.jsx";
import TenantSwitcher from "../TenantSwitcher.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import { useSeasonLeague } from "../../context/SeasonContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import { listVenues } from "../../domain/venueService.js";
import { loadActiveVenueId } from "../../data/venueSession.js";
import { isAiEngineEnabled } from "../../features/ai-assistant/constants/aiConfig.js";
import { buildVenueOpsMeta } from "../../utils/venueOpsMeta.js";
import { useIsMobile } from "../../features/mobile/hooks/useIsMobile.js";
import { SHELL_COLORS, SHELL_LAYOUT } from "./shellTokens.js";

function ContextItem({ icon: Icon, label, value, hideOnMobile = false }) {
  return (
    <Stack
      direction="row"
      spacing={0.75}
      alignItems="center"
      sx={{
        minWidth: 0,
        display: hideOnMobile ? { xs: "none", md: "flex" } : "flex",
      }}
    >
      {Icon && <Icon sx={{ fontSize: 16, color: SHELL_COLORS.primaryGreen, flexShrink: 0 }} />}
      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
        {label}:
      </Typography>
      <Typography variant="body2" fontWeight={700} color="text.primary" noWrap>
        {value}
      </Typography>
    </Stack>
  );
}

export default function AppContextBar() {
  const isMobile = useIsMobile();
  const { activeClubId, summary } = useClub();
  const { activeSeason, activeLeague } = useSeasonLeague();
  const { currentTenant, isSuperAdmin } = useTenant();
  const [expanded, setExpanded] = useState(false);

  const venueName = useMemo(() => {
    const venues = listVenues();
    const storedId = loadActiveVenueId();
    const venue = venues.find((item) => item.id === storedId) || venues[0];
    return venue?.name || currentTenant?.name || "Sân hiện tại";
  }, [currentTenant?.name]);

  const opsMeta = useMemo(
    () => buildVenueOpsMeta(activeClubId, summary),
    [activeClubId, summary]
  );

  const seasonLabel = activeSeason?.name || "Mùa hiện tại";
  const seasonYear = activeSeason?.year || new Date().getFullYear();
  const leagueLabel = activeLeague?.name || "Giao lưu cuối tuần";
  const aiReady = isAiEngineEnabled();
  const playingLabel =
    opsMeta.playingNow > 0
      ? `${opsMeta.playingNow} người đang chơi`
      : opsMeta.waitingNow > 0
        ? `${opsMeta.waitingNow} người đang chờ`
        : "0 người đang chơi";

  if (isMobile) {
    return (
      <Box
        sx={{
          bgcolor: SHELL_COLORS.mintBg,
          borderBottom: `1px solid ${SHELL_COLORS.border}`,
          px: 1.5,
          py: 0.75,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="body2" fontWeight={700} noWrap sx={{ minWidth: 0 }}>
            {venueName} • {seasonLabel}
          </Typography>
          <IconButton size="small" onClick={() => setExpanded((value) => !value)} aria-label="Mở context bar">
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Stack>
        <Collapse in={expanded}>
          <Stack spacing={1} sx={{ pt: 1, pb: 0.5 }}>
            <ContextItem icon={SportsTennisIcon} label="Giải" value={leagueLabel} />
            <ContextItem icon={AutoAwesomeIcon} label="AI" value={aiReady ? "AI sẵn sàng" : "AI tắt"} />
            <ContextItem icon={GroupsIcon} label="Sân" value={playingLabel} />
            <ClubSwitcher variant="context" />
            <SeasonLeagueSwitcher variant="context" />
          </Stack>
        </Collapse>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: "sticky",
        top: SHELL_LAYOUT.topbarHeight,
        zIndex: (theme) => theme.zIndex.drawer,
        bgcolor: SHELL_COLORS.mintBg,
        borderBottom: `1px solid ${SHELL_COLORS.border}`,
        minHeight: SHELL_LAYOUT.contextBarHeight,
        px: { md: 2.5, lg: 3 },
        py: 0.75,
      }}
    >
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        sx={{
          flexWrap: "nowrap",
          overflow: "hidden",
          minHeight: SHELL_LAYOUT.contextBarHeight - 12,
        }}
      >
        <ContextItem icon={LocationOnOutlinedIcon} label="Sân" value={venueName} />
        <ContextItem
          icon={WbSunnyOutlinedIcon}
          label="Mùa"
          value={`${seasonLabel} (${seasonYear})`}
        />
        <ContextItem icon={SportsTennisIcon} label="Giải" value={leagueLabel} />
        <Chip
          size="small"
          icon={<AutoAwesomeIcon sx={{ fontSize: "14px !important" }} />}
          label={aiReady ? "AI sẵn sàng" : "AI tắt"}
          sx={{
            height: 26,
            fontWeight: 700,
            bgcolor: "rgba(5, 150, 105, 0.12)",
            color: SHELL_COLORS.primaryGreen,
            flexShrink: 0,
            "& .MuiChip-icon": { color: SHELL_COLORS.primaryGreen },
          }}
        />
        <ContextItem icon={GroupsIcon} label="" value={playingLabel} hideOnMobile />

        <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
          {isSuperAdmin && <TenantSwitcher variant="context" />}
          <ClubSwitcher variant="context" />
          <SeasonLeagueSwitcher variant="context" />
        </Box>
      </Stack>
    </Box>
  );
}
