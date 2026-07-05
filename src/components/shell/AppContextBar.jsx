import { useState } from "react";
import { Box, Collapse, IconButton, Stack, Typography } from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import ClubSwitcher from "../ClubSwitcher.jsx";
import SeasonLeagueSwitcher from "../SeasonLeagueSwitcher.jsx";
import TenantSwitcher from "../TenantSwitcher.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import { useSeasonLeague } from "../../context/SeasonContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import { useIsMobile } from "../../features/mobile/hooks/useIsMobile.js";
import { SHELL_COLORS } from "./shellTokens.js";

export default function AppContextBar() {
  const isMobile = useIsMobile();
  const { activeClub } = useClub();
  const { activeSeason } = useSeasonLeague();
  const { isSuperAdmin } = useTenant();
  const [expanded, setExpanded] = useState(false);

  if (!isMobile) {
    return null;
  }

  return (
    <Box
      sx={{
        bgcolor: SHELL_COLORS.cardBg,
        borderBottom: `1px solid ${SHELL_COLORS.border}`,
        px: 1.5,
        py: 0.75,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="body2" fontWeight={600} noWrap sx={{ minWidth: 0, color: "text.secondary" }}>
          {activeClub?.name || "CLB"} • {activeSeason?.name || "Mùa hiện tại"}
        </Typography>
        <IconButton size="small" onClick={() => setExpanded((value) => !value)} aria-label="Mở bộ lọc ngữ cảnh">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Stack>
      <Collapse in={expanded}>
        <Stack spacing={1} sx={{ pt: 1, pb: 0.5 }}>
          {isSuperAdmin && <TenantSwitcher variant="context" />}
          <ClubSwitcher variant="context" />
          <SeasonLeagueSwitcher variant="context" />
        </Stack>
      </Collapse>
    </Box>
  );
}
