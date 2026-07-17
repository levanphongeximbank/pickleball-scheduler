import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import { useEffect, useState } from "react";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";

import { getCourtDisplayName } from "../../../../models/court.js";
import { ANIMATION_MODES } from "../animationUtils.js";
import AnimationProgressBar from "./AnimationProgressBar.jsx";
import CountdownDisplay from "./CountdownDisplay.jsx";
import { EFFECT_PRELUDE_SCOPE } from "./effectPreludeConfig.js";
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

function playerInitials(name = "") {
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

function resolvePlayerAvatarUrl(player) {
  return String(
    player?.avatarUrl ||
      player?.avatar_url ||
      player?.photoUrl ||
      player?.photo_url ||
      player?.imageUrl ||
      ""
  ).trim();
}

function resolvePlayerRating(player) {
  const value = Number(
    player?.ratingValue ?? player?.rating ?? player?.level ?? player?.avgLevel
  );
  return Number.isFinite(value) && value > 0 ? value : null;
}

function AthletePortraitCard({ player, index }) {
  const name = String(player?.name || player?.displayName || `VĐV ${index + 1}`);
  const avatarUrl = resolvePlayerAvatarUrl(player);
  const rating = resolvePlayerRating(player);
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(avatarUrl) && !imageFailed;

  return (
    <Box
      className="effect-prelude-portrait-card"
      sx={{ animationDelay: `${index * 0.08}s` }}
    >
      <Box className="effect-prelude-portrait-avatar">
        {showImage ? (
          <Box
            component="img"
            src={avatarUrl}
            alt=""
            className="effect-prelude-portrait-img"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Typography className="effect-prelude-portrait-initials" component="span">
            {playerInitials(name)}
          </Typography>
        )}
      </Box>
      <Typography className="effect-prelude-portrait-name" noWrap title={name}>
        {name}
      </Typography>
      {rating != null ? (
        <Typography className="effect-prelude-portrait-rating" component="span">
          {rating}
        </Typography>
      ) : null}
    </Box>
  );
}

function AthletePortraitRow({ players = [] }) {
  const portraits = players.slice(0, 4);
  while (portraits.length < 4) {
    portraits.push({ id: `placeholder-${portraits.length}`, name: "…" });
  }

  return (
    <Stack direction="row" spacing={1} className="effect-prelude-portrait-row">
      {portraits.map((player, index) => (
        <AthletePortraitCard
          key={player.id || player.athleteId || `${player.name}-${index}`}
          player={player}
          index={index}
        />
      ))}
    </Stack>
  );
}

function TeamPairingPrelude({
  preset,
  secondsLeft,
  durationSec,
  progressPercent,
  statusText,
  badges,
  skippable,
  onSkip,
  onExit,
  players = [],
  title = "Lễ bốc thăm AI",
}) {
  return (
    <Box className="effect-prelude-dark-compact" sx={{ maxWidth: 520, mx: "auto", py: 2 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6" fontWeight={800} sx={{ color: "#f4f7fb" }}>
            {title}
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(244,247,251,0.72)" }}>
            {preset?.subline}
          </Typography>
        </Box>

        <AnimationProgressBar
          value={progressPercent}
          statusText={statusText || preset?.headline}
          label={`${secondsLeft}s`}
        />

        <RevealStage statusTitle="AI ENGINE" statusText={preset?.headline} badges={badges}>
          <Stack spacing={2} alignItems="center">
            <SportsTennisIcon sx={{ fontSize: 40, color: "#7CFFB2" }} />
            <Typography variant="h6" fontWeight={800} align="center" sx={{ color: "#f4f7fb" }}>
              {preset?.headline}
            </Typography>
            <CountdownDisplay
              secondsLeft={secondsLeft}
              totalSeconds={durationSec}
              size="medium"
            />
          </Stack>
        </RevealStage>

        <AthletePortraitRow players={players} />

        {players.length > 4 ? (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {players.slice(4, 16).map((player, index) => (
              <Chip
                key={player.id || player.name || index}
                className="effect-prelude-player-chip effect-prelude-player-chip--dark"
                label={player.name || player.displayName || player.id}
                size="small"
                sx={{ animationDelay: `${index * 0.05}s` }}
              />
            ))}
          </Stack>
        ) : null}

        <Stack direction="row" spacing={1} justifyContent="flex-start">
          {skippable ? (
            <Button
              variant="contained"
              size="small"
              onClick={onSkip}
              sx={{
                bgcolor: "#7CFFB2",
                color: "#061018",
                fontWeight: 800,
                textTransform: "none",
                "&:hover": { bgcolor: "#9affc6" },
              }}
            >
              Bỏ qua
            </Button>
          ) : null}
          {onExit ? (
            <Button
              variant="outlined"
              size="small"
              onClick={onExit}
              sx={{
                color: "rgba(244,247,251,0.9)",
                borderColor: "rgba(244,247,251,0.4)",
                textTransform: "none",
              }}
            >
              Thoát
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Box>
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

        <RevealStage statusTitle="AI ENGINE" statusText={preset?.headline} badges={badges}>
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

function isTeamCeremonyPreset(presetKey) {
  return (
    presetKey === ANIMATION_MODES.PAIRING_REVEAL ||
    presetKey === ANIMATION_MODES.SNAKE_GROUP
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
  const players = context.players || participants;

  if (isCompact && isTeamCeremonyPreset(presetKey)) {
    return (
      <TeamPairingPrelude
        preset={preset}
        secondsLeft={secondsLeft}
        durationSec={durationSec}
        progressPercent={progressPercent}
        statusText={statusText}
        badges={badges}
        skippable={skippable}
        onSkip={handleSkip}
        onExit={onExit}
        players={players}
        title={
          presetKey === ANIMATION_MODES.SNAKE_GROUP
            ? "Lễ chia bảng AI"
            : "Lễ bốc thăm AI"
        }
      />
    );
  }

  if (isCompact || presetKey === EFFECT_PRELUDE_SCOPE.COURT_SCHEDULING) {
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
        players={players}
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
            {participants.length > 0 ? (
              participants.slice(0, 12).map((player) => (
                <ParticipantCard
                  key={player.id || player.name}
                  name={player.name}
                  rating={player.rating ?? player.level}
                  gender={player.gender}
                  shaking
                  isActive
                />
              ))
            ) : (
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
