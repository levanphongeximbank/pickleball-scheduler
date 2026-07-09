import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import { useEffect } from "react";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";

import { getCourtDisplayName } from "../../../../models/court.js";
import AnimationProgressBar from "./AnimationProgressBar.jsx";
import CountdownDisplay from "./CountdownDisplay.jsx";
import ParticipantCard from "./ParticipantCard.jsx";
import ResultPanel from "./ResultPanel.jsx";
import RevealStage from "./RevealStage.jsx";
import TournamentAnimationShell from "./TournamentAnimationShell.jsx";
import { useEffectPrelude } from "./useEffectPrelude.js";
import "./effectPrelude.css";
import "./tournamentAnimationTheme.css";

function PreludeSkeletonSummary() {
  return (
    <Stack spacing={1}>
      <Box className="effect-prelude-skeleton-line" sx={{ width: "80%" }} />
      <Box className="effect-prelude-skeleton-line" sx={{ width: "60%" }} />
      <Box className="effect-prelude-skeleton-line" sx={{ width: "70%" }} />
    </Stack>
  );
}

function CourtSchedulingPrelude({
  preset,
  secondsLeft,
  durationSec,
  progressPercent,
  statusText,
  badges,
  skippable,
  onSkip,
  onExit,
  courts = [],
  players = [],
}) {
  const previewCourts = courts.slice(0, 3);

  return (
    <Box className="tournament-anim-screen" sx={{ maxWidth: 480, mx: "auto", py: 2 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6" fontWeight={800}>
            Xếp sân AI
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {preset?.subline}
          </Typography>
        </Box>

        <AnimationProgressBar
          value={progressPercent}
          statusText={statusText || preset?.headline}
          label={`${secondsLeft}s`}
        />

        <RevealStage
          statusTitle="AI ENGINE"
          statusText={preset?.headline}
          badges={badges}
        >
          <Stack spacing={2} alignItems="center">
            <SportsTennisIcon sx={{ fontSize: 40, color: "#10B981" }} />
            <Typography variant="h6" fontWeight={800} align="center">
              {preset?.headline}
            </Typography>
            <CountdownDisplay
              secondsLeft={secondsLeft}
              totalSeconds={durationSec}
              size="medium"
            />
          </Stack>
        </RevealStage>

        <GridCourtPreview courts={previewCourts} />

        {players.length > 0 ? (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {players.slice(0, 12).map((player, index) => (
              <Chip
                key={player.id || player.name}
                className="effect-prelude-player-chip"
                label={player.name}
                size="small"
                sx={{ animationDelay: `${index * 0.05}s` }}
              />
            ))}
          </Stack>
        ) : null}

        <Stack direction="row" spacing={1} justifyContent="flex-end">
          {skippable ? (
            <Button variant="outlined" size="small" onClick={onSkip}>
              Bỏ qua
            </Button>
          ) : null}
          {onExit ? (
            <Button variant="text" color="inherit" size="small" onClick={onExit}>
              Thoát
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Box>
  );
}

function GridCourtPreview({ courts = [] }) {
  if (!courts.length) {
    return (
      <Stack direction="row" spacing={1}>
        {["Sân 1", "Sân 2", "Sân 3"].map((label) => (
          <Box key={label} className="effect-prelude-court-slot" sx={{ flex: 1, p: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
          </Box>
        ))}
      </Stack>
    );
  }

  return (
    <Stack direction="row" spacing={1}>
      {courts.map((court) => (
        <Box key={court.id} className="effect-prelude-court-slot" sx={{ flex: 1, p: 1 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            {getCourtDisplayName(court)}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

export default function EffectPreludeScreen({
  presetKey,
  context = {},
  active = true,
  onComplete,
  onSkip,
  onExit,
  participants = [],
  summaryTitle = "Tóm tắt",
  summarySubtitle,
  compact = false,
}) {
  const prelude = useEffectPrelude({
    presetKey,
    context,
    active,
    onComplete,
  });

  const {
    preset,
    secondsLeft,
    durationSec,
    progressPercent,
    statusText,
    badges,
    skip,
    skippable,
  } = prelude;

  const handleSkip = () => {
    skip();
    onSkip?.();
  };

  useEffect(() => {
    if (active && presetKey && !preset) {
      onComplete?.();
    }
  }, [active, presetKey, preset, onComplete]);

  if (!preset) {
    return null;
  }

  const isCompact = compact || preset.compact;

  if (isCompact) {
    return (
      <CourtSchedulingPrelude
        preset={preset}
        secondsLeft={secondsLeft}
        durationSec={durationSec}
        progressPercent={progressPercent}
        statusText={statusText}
        badges={badges}
        skippable={skippable}
        onSkip={handleSkip}
        onExit={onExit}
        courts={context.courts || []}
        players={context.players || participants}
      />
    );
  }

  return (
    <TournamentAnimationShell
      title={preset.headline}
      subtitle={preset.subline}
      activeFlowStep={preset.activeFlowStepKey}
      statusText={statusText || preset.headline}
      progress={progressPercent}
      progressLabel={`${secondsLeft}s`}
      showFlowProgress={Boolean(preset.activeFlowStepKey)}
      leftPanel={
        <ResultPanel title="Danh sách" subtitle="Đang phân tích">
          <Stack spacing={0.75}>
            {participants.length > 0
              ? participants.slice(0, 12).map((player) => (
                  <ParticipantCard
                    key={player.id || player.name}
                    name={player.name}
                    rating={player.rating ?? player.level}
                    gender={player.gender}
                    shaking
                    isActive
                  />
                ))
              : (
                <Typography variant="caption" color="text.secondary">
                  Đang tải dữ liệu...
                </Typography>
              )}
          </Stack>
        </ResultPanel>
      }
      centerPanel={
        <RevealStage statusTitle="AI ENGINE" statusText={preset.subline} badges={badges}>
          <Stack spacing={1} alignItems="center">
            <Typography variant="h5" fontWeight={800} align="center">
              {preset.headline}
            </Typography>
            <CountdownDisplay
              secondsLeft={secondsLeft}
              totalSeconds={durationSec}
              size="large"
            />
            <Typography variant="body2" color="text.secondary" align="center">
              {statusText}
            </Typography>
          </Stack>
        </RevealStage>
      }
      rightPanel={
        <ResultPanel title={summaryTitle} subtitle={summarySubtitle}>
          <PreludeSkeletonSummary />
        </ResultPanel>
      }
      footer={
        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 1.5 }}>
          {skippable ? (
            <Button variant="outlined" size="small" onClick={handleSkip}>
              Bỏ qua
            </Button>
          ) : null}
          {onExit ? (
            <Button variant="text" color="inherit" size="small" onClick={onExit}>
              Thoát trình chiếu
            </Button>
          ) : null}
        </Stack>
      }
    />
  );
}
