import { Box, Button, Stack, Tab, Tabs } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { useIsMobile } from "../../features/mobile/hooks/useIsMobile.js";
import TournamentPageHeader from "./TournamentPageHeader.jsx";
import { TournamentStatusChip } from "./TournamentStatusChip.jsx";
import { TOURNAMENT_LAYOUT } from "./tournamentLayout.js";

export default function TournamentSetupShell({
  tournament,
  title,
  description,
  onBack,
  backLabel = "Quay lại Giải đấu",
  alerts,
  setupTab,
  onSetupTabChange,
  showAiTab = false,
  headerActions,
  stickyActions,
  children,
}) {
  const isMobile = useIsMobile();

  return (
    <Box sx={{ pb: stickyActions?.length ? 10 : 0, minWidth: 0 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={onBack}
        sx={{ mb: 2, ...(isMobile ? { minHeight: 44, py: 1.25 } : {}) }}
      >
        {backLabel}
      </Button>

      <TournamentPageHeader
        title={title || tournament?.name}
        description={description}
        badge={tournament?.status ? <TournamentStatusChip status={tournament.status} /> : null}
        action={headerActions}
      />

      {alerts}

      {showAiTab ? (
        <Tabs value={setupTab} onChange={onSetupTabChange} sx={{ mb: TOURNAMENT_LAYOUT.sectionGap }}>
          <Tab label="Thiết lập" />
          <Tab label="AI Assistant" />
        </Tabs>
      ) : null}

      {children}

      {stickyActions?.length ? (
        <Box
          sx={{
            position: "fixed",
            bottom: isMobile
              ? "calc(64px + env(safe-area-inset-bottom, 0px))"
              : 0,
            left: 0,
            right: 0,
            zIndex: 1100,
            bgcolor: "background.paper",
            borderTop: "1px solid",
            borderColor: "divider",
            boxShadow: "0 -4px 12px rgba(15, 23, 42, 0.06)",
            px: { xs: 2, sm: 3 },
            py: 1.5,
            pb: isMobile ? "calc(12px + env(safe-area-inset-bottom, 0px))" : 1.5,
          }}
        >
          <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
            {stickyActions}
          </Stack>
        </Box>
      ) : null}
    </Box>
  );
}
