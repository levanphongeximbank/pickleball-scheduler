import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Paper, Stack, Typography } from "@mui/material";

import { VISUAL_MODES } from "./animationConfig.js";
import {
  getRevealedPlayerIds,
  shuffleVisualOrder,
} from "./animationUtils.js";
import { DRAW_CONTROL_MODES, useDrawSequence } from "./useDrawSequence.js";
import AnimationControlBar, { ANIMATION_CONTROL_MODES } from "./shared/AnimationControlBar.jsx";
import ParticipantCard from "./shared/ParticipantCard.jsx";
import ResultPanel from "./shared/ResultPanel.jsx";
import RevealStage, { PlusHub } from "./shared/RevealStage.jsx";
import TeamCard from "./shared/TeamCard.jsx";
import TournamentAnimationShell from "./shared/TournamentAnimationShell.jsx";
import WaitingListPanel from "./shared/WaitingListPanel.jsx";
import { FLOW_STEP_KEYS } from "./shared/tournamentFlowConfig.js";
import {
  playDingSound,
  playTickSound,
  playWhooshSound,
  setTournamentSoundEnabled,
} from "./shared/tournamentSounds.js";
import { usePresentationMode } from "./shared/usePresentationMode.js";

function buildFallbackWaitingPlayers(steps = []) {
  const players = [];
  const seen = new Set();

  steps.forEach((step) => {
    [step.left, step.right].forEach((side) => {
      if (!side?.name || side.name === "—") {
        return;
      }

      const playerId = String(side.id || side.name);
      if (seen.has(playerId)) {
        return;
      }

      seen.add(playerId);
      players.push({
        id: playerId,
        name: side.name,
        seed: side.seed,
        rating: side.rating ?? side.level,
        gender: side.gender,
      });
    });
  });

  return players;
}

function getPairBalanceNote(step) {
  const score = step?.balanceScore ?? step?.pairing?.balanceScore;
  if (score != null && score >= 75) {
    return "Cặp cân bằng tốt";
  }

  return "Đề xuất phù hợp";
}

function getRevealBadges(phase, PHASES) {
  if (phase === PHASES.SHUFFLE) {
    return [{ key: "analyze", label: "Đang phân tích", tone: "active" }];
  }

  if (phase === PHASES.SPOTLIGHT) {
    return [{ key: "balance", label: "Đánh giá độ cân bằng", tone: "active" }];
  }

  if (phase === PHASES.FLY) {
    return [{ key: "success", label: "Đề xuất cặp thành công", tone: "success" }];
  }

  return [];
}

function getAvgLevel(step) {
  const left = Number(step?.left?.rating ?? step?.left?.level ?? 0);
  const right = Number(step?.right?.rating ?? step?.right?.level ?? 0);
  const values = [left, right].filter((value) => value > 0);

  if (!values.length) {
    return step?.avgLevel ?? step?.pairing?.avgLevel ?? null;
  }

  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export default function PairSuggestionAnimation({
  steps = [],
  waitingPlayers = [],
  title = "Đề xuất ghép cặp",
  subtitle = "AI đề xuất cặp dựa trên dữ liệu engine — animation chỉ trình chiếu",
  revealItemLabel = "Cặp",
  visualMode: initialVisualMode = VISUAL_MODES.PROFESSIONAL,
  speed: initialSpeed = "normal",
  onAnimationComplete,
  onSkip,
}) {
  const [speed, setSpeed] = useState(initialSpeed);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [queueOrder, setQueueOrder] = useState([]);
  const { presentationMode, togglePresentationMode } = usePresentationMode();

  const normalizedSteps = useMemo(
    () =>
      steps.map((step) => ({
        ...step,
        left: step.left || { name: step.team?.name || step.pairing?.name || "—" },
        right: step.right || { name: "—" },
      })),
    [steps]
  );

  const sequence = useDrawSequence({
    steps: normalizedSteps,
    speed,
    controlMode: DRAW_CONTROL_MODES.AUTO,
    onComplete: onAnimationComplete,
  });

  const placedCount = sequence.placedCount;
  const totalCount = normalizedSteps.length;
  const progress = totalCount ? Math.round((placedCount / totalCount) * 100) : 0;
  const revealed = normalizedSteps.slice(0, placedCount);
  const current = sequence.currentStep;

  const revealedPlayerIds = useMemo(
    () => getRevealedPlayerIds(normalizedSteps, placedCount),
    [normalizedSteps, placedCount]
  );

  const pendingIndividuals = useMemo(() => {
    const pool = waitingPlayers.length > 0 ? waitingPlayers : buildFallbackWaitingPlayers(normalizedSteps);
    return pool.filter((player) => !revealedPlayerIds.has(String(player.id)));
  }, [waitingPlayers, normalizedSteps, revealedPlayerIds]);

  const reshuffleQueue = useCallback(() => {
    const ids = pendingIndividuals.map((player) => player.id);
    setQueueOrder(shuffleVisualOrder(ids));
  }, [pendingIndividuals]);

  useEffect(() => {
    reshuffleQueue();
  }, [reshuffleQueue]);

  useEffect(() => {
    if (sequence.phase !== sequence.PHASES.SHUFFLE || !sequence.playing) {
      return undefined;
    }

    const timer = setInterval(reshuffleQueue, 4800);
    return () => clearInterval(timer);
  }, [sequence.phase, sequence.playing, reshuffleQueue, sequence.PHASES.SHUFFLE]);

  useEffect(() => {
    setTournamentSoundEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    if (!soundEnabled) {
      return;
    }

    if (sequence.phase === sequence.PHASES.SHUFFLE && sequence.playing) {
      playTickSound();
    }

    if (sequence.phase === sequence.PHASES.FLY) {
      playWhooshSound();
    }

    if (placedCount > 0 && sequence.phase === sequence.PHASES.SHUFFLE && !sequence.playing) {
      playDingSound();
    }
  }, [sequence.phase, sequence.playing, placedCount, soundEnabled, sequence.PHASES]);

  const pendingById = useMemo(
    () => Object.fromEntries(pendingIndividuals.map((player) => [String(player.id), player])),
    [pendingIndividuals]
  );

  const displayQueue = useMemo(
    () => queueOrder.map((id) => pendingById[String(id)]).filter(Boolean),
    [queueOrder, pendingById]
  );

  const selectedPlayerIds = useMemo(() => {
    if (!current) {
      return new Set();
    }

    return new Set(
      [current.left?.id, current.right?.id].filter(Boolean).map((playerId) => String(playerId))
    );
  }, [current]);

  const highlightSelected =
    sequence.playing &&
    (sequence.phase === sequence.PHASES.SHUFFLE ||
      sequence.phase === sequence.PHASES.SPOTLIGHT ||
      sequence.phase === sequence.PHASES.FLY);

  const statusText =
    placedCount >= totalCount || sequence.phase === sequence.PHASES.DONE
      ? "Hoàn tất đề xuất ghép cặp"
      : sequence.phase === sequence.PHASES.SHUFFLE
        ? "Đang đề xuất cặp"
        : `Đang reveal ${revealItemLabel.toLowerCase()} ${Math.min(placedCount + 1, totalCount)}`;

  const showCards =
    current &&
    (sequence.phase === sequence.PHASES.SPOTLIGHT ||
      sequence.phase === sequence.PHASES.FLY ||
      sequence.phase === sequence.PHASES.SHUFFLE);

  const handleSkip = () => {
    sequence.skip();
    onSkip?.();
  };

  const handleViewResults = () => {
    sequence.viewResultsNow();
    onSkip?.();
  };

  const controlMode =
    sequence.controlMode === DRAW_CONTROL_MODES.AUTO
      ? ANIMATION_CONTROL_MODES.AUTO
      : ANIMATION_CONTROL_MODES.MANUAL;

  return (
    <TournamentAnimationShell
      title={title}
      subtitle={subtitle}
      activeFlowStep={FLOW_STEP_KEYS.PAIRING}
      statusText={statusText}
      progress={progress}
      progressLabel={`${placedCount}/${totalCount} ${revealItemLabel.toLowerCase()} • ${pendingIndividuals.length} VĐV chờ`}
      presentationMode={presentationMode}
      onTogglePresentation={togglePresentationMode}
      leftPanel={
        <WaitingListPanel
          title="VĐV chờ ghép"
          subtitle={
            sequence.phase === sequence.PHASES.IDLE
              ? "Bấm Bắt đầu hoặc Auto để reveal từng cặp"
              : "Thứ tự hiển thị chỉ là hiệu ứng — kết quả theo engine"
          }
          emptyText="Đã hết VĐV chờ ghép"
        >
          {displayQueue.map((player) => {
            const isSelected = highlightSelected && selectedPlayerIds.has(String(player.id));
            const isDone = revealedPlayerIds.has(String(player.id));

            return (
              <ParticipantCard
                key={player.id}
                name={player.name}
                gender={player.gender}
                rating={player.rating}
                level={player.level}
                seed={player.seed}
                isActive={isSelected}
                isDone={isDone}
                shaking={
                  isSelected &&
                  sequence.phase === sequence.PHASES.SHUFFLE &&
                  sequence.playing &&
                  !isDone
                }
              />
            );
          })}
        </WaitingListPanel>
      }
      centerPanel={
        <RevealStage
          statusTitle="Đang đề xuất cặp"
          statusText={statusText}
          badges={getRevealBadges(sequence.phase, sequence.PHASES)}
          presentationMode={presentationMode}
        >
          {showCards && current ? (
            <Stack spacing={2} alignItems="center" sx={{ width: "100%" }}>
              <Box className="tournament-arena tournament-arena--pair">
                <TeamCard
                  title="VĐV 1"
                  players={[current.left.name]}
                  seed={current.left.seed}
                  side="a"
                  visible={sequence.phase !== sequence.PHASES.IDLE}
                  flying={sequence.phase === sequence.PHASES.FLY}
                />
                <PlusHub visible={sequence.phase === sequence.PHASES.SPOTLIGHT || sequence.phase === sequence.PHASES.FLY} />
                {current.right?.name && current.right.name !== "—" ? (
                  <TeamCard
                    title="VĐV 2"
                    players={[current.right.name]}
                    seed={current.right.seed}
                    side="b"
                    visible={sequence.phase !== sequence.PHASES.IDLE}
                    flying={sequence.phase === sequence.PHASES.FLY}
                  />
                ) : null}
              </Box>

              {sequence.phase === sequence.PHASES.FLY || sequence.phase === sequence.PHASES.SHUFFLE ? (
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, bgcolor: "#f8fafc", width: "100%" }}>
                  <Typography variant="subtitle2" fontWeight={800} align="center">
                    {current.pairing?.name || current.team?.name || `${revealItemLabel} ${placedCount + 1}`}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 0.5 }}>
                    {getPairBalanceNote(current)}
                    {getAvgLevel(current) != null ? ` • TB Level ${getAvgLevel(current)}` : ""}
                  </Typography>
                </Paper>
              ) : null}
            </Stack>
          ) : (
            <Typography variant="body1" color="text.secondary" align="center">
              Bấm Bắt đầu để đề xuất cặp đầu tiên
            </Typography>
          )}
        </RevealStage>
      }
      rightPanel={
        <ResultPanel title="Cặp đã đề xuất" emptyText="Chưa có cặp">
          {revealed.map((step, index) => {
            const isLatest = index === revealed.length - 1 && sequence.phase === sequence.PHASES.FLY;

            return (
              <Box
                key={step.pairing?.id || index}
                className={`tournament-result-card${isLatest ? " tournament-result-card--latest tournament-result-card--new" : ""}`}
              >
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  {revealItemLabel} {index + 1}
                </Typography>
                <Typography variant="body2" fontWeight={700} sx={{ wordBreak: "break-word" }}>
                  {step.left.name}
                  {step.right?.name && step.right.name !== "—" ? ` + ${step.right.name}` : ""}
                </Typography>
                {getAvgLevel(step) != null ? (
                  <Typography variant="caption" color="text.secondary">
                    TB Level {getAvgLevel(step)}
                  </Typography>
                ) : null}
              </Box>
            );
          })}
        </ResultPanel>
      }
      footer={
        <AnimationControlBar
          playing={sequence.playing}
          paused={sequence.paused}
          controlMode={controlMode}
          speed={speed}
          visualMode={initialVisualMode}
          showVisualMode={false}
          isComplete={sequence.isComplete}
          canReveal={placedCount < totalCount}
          startButtonLabel="Bắt đầu"
          nextButtonLabel="Đề xuất cặp tiếp theo"
          onStart={sequence.start}
          onRevealNext={sequence.revealNext}
          onStartAuto={sequence.start}
          onPause={sequence.pause}
          onResume={sequence.resume}
          onSkip={handleSkip}
          onReplay={sequence.replay}
          onViewResults={handleViewResults}
          onSpeedChange={setSpeed}
          onControlModeChange={(value) =>
            sequence.setControlMode(
              value === ANIMATION_CONTROL_MODES.AUTO ? DRAW_CONTROL_MODES.AUTO : DRAW_CONTROL_MODES.MANUAL
            )
          }
          soundEnabled={soundEnabled}
          onSoundToggle={setSoundEnabled}
          showDismissHint={sequence.isComplete}
        />
      }
    />
  );
}
