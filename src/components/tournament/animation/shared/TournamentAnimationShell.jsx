import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import { Box, Button, Grid, Stack, Tab, Tabs, Typography } from "@mui/material";
import { useState } from "react";

import TournamentFlowProgress from "./TournamentFlowProgress.jsx";
import AnimationProgressBar from "./AnimationProgressBar.jsx";
import "./tournamentAnimationTheme.css";

export default function TournamentAnimationShell({
  title,
  subtitle,
  activeFlowStep,
  statusText,
  progress = 0,
  progressLabel,
  leftPanel,
  centerPanel,
  rightPanel,
  footer,
  presentationMode = false,
  onTogglePresentation,
  showFlowProgress = true,
  headerExtra,
  banners,
}) {
  const [mobileTab, setMobileTab] = useState(1);

  const content = (
    <Box className={`tournament-anim-screen${presentationMode ? " tournament-anim-screen--presentation" : ""}`}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight="bold">
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          {headerExtra}
          {onTogglePresentation ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={presentationMode ? <FullscreenExitIcon /> : <FullscreenIcon />}
              onClick={onTogglePresentation}
            >
              {presentationMode ? "Thoát trình chiếu" : "Trình chiếu toàn màn hình"}
            </Button>
          ) : null}
        </Stack>
      </Stack>

      {showFlowProgress ? <TournamentFlowProgress activeStepKey={activeFlowStep} /> : null}

      <AnimationProgressBar value={progress} statusText={statusText} label={progressLabel} />

      {banners}

      <Box sx={{ display: { xs: "block", md: "none" }, mb: 1 }}>
        <Tabs value={mobileTab} onChange={(_, value) => setMobileTab(value)} variant="fullWidth">
          <Tab label="Đầu vào" />
          <Tab label="Reveal" />
          <Tab label="Kết quả" />
        </Tabs>
      </Box>

      <Grid container spacing={1.5}>
        <Grid
          size={{ xs: 12, md: 2.75 }}
          sx={{ display: { xs: mobileTab === 0 ? "block" : "none", md: "block" } }}
        >
          {leftPanel}
        </Grid>
        <Grid
          size={{ xs: 12, md: 6.5 }}
          sx={{ display: { xs: mobileTab === 1 ? "block" : "none", md: "block" } }}
        >
          {centerPanel}
        </Grid>
        <Grid
          size={{ xs: 12, md: 2.75 }}
          sx={{ display: { xs: mobileTab === 2 ? "block" : "none", md: "block" } }}
        >
          {rightPanel}
        </Grid>
      </Grid>

      {footer}
    </Box>
  );

  return content;
}
