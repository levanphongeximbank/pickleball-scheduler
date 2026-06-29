import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";

import DailyMatchListPanel from "./DailyMatchListPanel.jsx";
import DailyPlayerPoolPanel from "./DailyPlayerPoolPanel.jsx";
import DailyStatsBar from "./DailyStatsBar.jsx";
import FairMatchControlBar from "./FairMatchControlBar.jsx";
import FairMatchRevealStage from "./FairMatchRevealStage.jsx";
import {
  buildDailyFairMatchPlayerPool,
  FAIR_MATCH_PHASES,
  getPhaseStatusText,
} from "./dailyFairMatchUtils.js";
import {
  FAIR_MATCH_CONTROL_MODES,
  useFairMatchSequence,
} from "./useFairMatchSequence.js";
import "./dailyFairMatch.css";

function HelpDialog({ open, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogContent>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          Hướng dẫn Tạo trận công bằng
        </Typography>
        <Stack spacing={1}>
          <Typography variant="body2">
            • <strong>Auto</strong> (mặc định) — tự động tạo lần lượt các trận đã được engine tính sẵn.
          </Typography>
          <Typography variant="body2">
            • <strong>Manual</strong> — bấm &quot;Tạo trận&quot; để công bố từng trận.
          </Typography>
          <Typography variant="body2">
            • Kết quả lấy từ Fair Match Engine — animation chỉ trình chiếu.
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

function formatPlayDate(playDate) {
  if (!playDate) {
    return new Date().toLocaleDateString("vi-VN");
  }

  return new Date(playDate).toLocaleDateString("vi-VN");
}

function formatCurrentTime() {
  return new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export default function DailyFairMatchScreen({
  clubName = "CLB",
  fairMatches = [],
  steps = [],
  players: sourcePlayers = [],
  waitingPlayers = [],
  playDate,
  totalPlayers = 0,
  matchCount = 0,
  courtsInUse = 0,
  estimatedMinutes = 0,
  speed: initialSpeed = "normal",
  controlMode: initialControlMode = FAIR_MATCH_CONTROL_MODES.AUTO,
  autoStart = true,
  onAnimationComplete,
  onSkip,
}) {
  const [speed, setSpeed] = useState(initialSpeed);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState(1);
  const [currentTime, setCurrentTime] = useState(formatCurrentTime);
  const autoStartedRef = useRef(false);

  const sequence = useFairMatchSequence({
    steps,
    speed,
    controlMode: initialControlMode,
    onComplete: onAnimationComplete,
  });

  const startAutoRef = useRef(sequence.startAuto);
  startAutoRef.current = sequence.startAuto;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(formatCurrentTime()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current || !steps.length) {
      return;
    }

    if (initialControlMode !== FAIR_MATCH_CONTROL_MODES.AUTO) {
      return;
    }

    autoStartedRef.current = true;
    startAutoRef.current();
  }, [autoStart, steps, initialControlMode]);

  const playerPool = useMemo(
    () =>
      buildDailyFairMatchPlayerPool({
        players: sourcePlayers,
        matches: fairMatches,
        waitingPlayers,
        revealedCount: sequence.revealedCount,
        currentMatchIndex: sequence.currentMatchIndex,
        phase: sequence.phase,
      }),
    [
      sourcePlayers,
      fairMatches,
      waitingPlayers,
      sequence.revealedCount,
      sequence.currentMatchIndex,
      sequence.phase,
    ]
  );

  const highlightTeamAIds = useMemo(() => {
    if (!sequence.currentStep) {
      return [];
    }

    const ids = (sequence.currentStep.teamA?.players || []).map((player) => player.id);

    if (
      sequence.phase === FAIR_MATCH_PHASES.ANALYZE ||
      sequence.phase === FAIR_MATCH_PHASES.TEAM_A
    ) {
      return ids;
    }

    return [];
  }, [sequence.currentStep, sequence.phase]);

  const highlightTeamBIds = useMemo(() => {
    if (!sequence.currentStep) {
      return [];
    }

    if (sequence.phase === FAIR_MATCH_PHASES.TEAM_B) {
      return (sequence.currentStep.teamB?.players || []).map((player) => player.id);
    }

    return [];
  }, [sequence.currentStep, sequence.phase]);

  const progress = steps.length
    ? Math.round((sequence.revealedCount / steps.length) * 100)
    : 0;

  const statusText = useMemo(() => {
    if (sequence.isComplete) {
      return "Hoàn tất tạo trận";
    }

    if (steps.length === 0) {
      return "Không đủ người chơi để tạo trận";
    }

    return getPhaseStatusText(sequence.phase);
  }, [sequence.isComplete, sequence.phase, steps.length]);

  const stats = {
    totalPlayers: totalPlayers || playerPool.length,
    matchCount: matchCount || fairMatches.length,
    courtsInUse,
    estimatedMinutes: estimatedMinutes || matchCount * 15,
  };

  const handleReplay = () => {
    sequence.replay();
    autoStartedRef.current = false;

    if (autoStart && sequence.controlMode === FAIR_MATCH_CONTROL_MODES.AUTO) {
      requestAnimationFrame(() => {
        autoStartedRef.current = true;
        startAutoRef.current();
      });
    }
  };

  const handleSkip = () => {
    sequence.skip();
    onSkip?.();
  };

  const handleViewResults = () => {
    sequence.viewResultsNow();
    onSkip?.();
  };

  const insufficientPlayers = steps.length === 0;
  const shuffling = sequence.phase === FAIR_MATCH_PHASES.ANALYZE;

  return (
    <Box className="daily-fair-match-screen" sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Paper variant="outlined" className="daily-fair-header" sx={{ p: 1.5, mb: 1.5 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={1}
        >
          <Box>
            <Typography variant="caption" color="text.secondary">
              {clubName}
            </Typography>
            <Typography variant="h5" fontWeight="bold" color="primary.main">
              Tạo trận công bằng
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Hệ thống đang tạo trận cân bằng — vào sân ngay
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {currentTime} • Ngày chơi {formatPlayDate(playDate)}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<HelpOutlineOutlinedIcon />}
              onClick={() => setHelpOpen(true)}
            >
              Hướng dẫn
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <DailyStatsBar {...stats} />

      <Paper variant="outlined" className="daily-fair-progress" sx={{ p: 1.25, mb: 1.5, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
          <Typography variant="body2" fontWeight="bold" color="primary.main">
            {statusText}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {sequence.revealedCount}/{steps.length || 0} trận
          </Typography>
        </Stack>
        <LinearProgress variant="determinate" value={progress} sx={{ mt: 1, height: 10, borderRadius: 1 }} />
      </Paper>

      {insufficientPlayers && (
        <Paper variant="outlined" sx={{ p: 2, mb: 1.5, bgcolor: "#fff8e1" }}>
          <Typography variant="body2">
            Không đủ người chơi để tạo trận. Cần ít nhất 4 VĐV check-in cho trận đôi hoặc 2 VĐV cho trận đơn.
          </Typography>
        </Paper>
      )}

      <Box sx={{ display: { xs: "block", lg: "none" }, mb: 1 }}>
        <Tabs value={mobileTab} onChange={(_, value) => setMobileTab(value)} variant="fullWidth">
          <Tab label="Reveal" />
          <Tab label="Người chơi" />
          <Tab label="Trận" />
        </Tabs>
      </Box>

      <Grid container spacing={1.5} className="daily-fair-layout">
        <Grid
          size={{ xs: 12, lg: 2 }}
          sx={{ display: { xs: mobileTab === 1 ? "block" : "none", lg: "block" }, order: { xs: 2, lg: 1 } }}
        >
          <DailyPlayerPoolPanel
            players={playerPool}
            shuffling={shuffling}
            highlightTeamAIds={highlightTeamAIds}
            highlightTeamBIds={highlightTeamBIds}
          />
        </Grid>

        <Grid
          size={{ xs: 12, lg: 8 }}
          sx={{ display: { xs: mobileTab === 0 ? "block" : "none", lg: "block" }, order: { xs: 1, lg: 2 } }}
        >
          <FairMatchRevealStage
            step={sequence.currentStep}
            phase={sequence.phase}
            revealedCount={sequence.revealedCount}
            totalCount={sequence.totalCount}
          />
        </Grid>

        <Grid
          size={{ xs: 12, lg: 2 }}
          sx={{ display: { xs: mobileTab === 2 ? "block" : "none", lg: "block" }, order: { xs: 3, lg: 3 } }}
        >
          <DailyMatchListPanel steps={steps} revealedCount={sequence.revealedCount} />
        </Grid>
      </Grid>

      <FairMatchControlBar
        playing={sequence.playing}
        paused={sequence.paused}
        controlMode={sequence.controlMode}
        speed={speed}
        isComplete={sequence.isComplete}
        canReveal={sequence.revealedCount < sequence.totalCount}
        onPause={sequence.pause}
        onResume={sequence.resume}
        onRevealNext={sequence.revealNext}
        onStartAuto={sequence.startAuto}
        onSkip={handleSkip}
        onReplay={handleReplay}
        onViewResults={handleViewResults}
        onSpeedChange={setSpeed}
        onControlModeChange={sequence.setControlMode}
        showDismissHint={sequence.isComplete}
      />

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </Box>
  );
}
