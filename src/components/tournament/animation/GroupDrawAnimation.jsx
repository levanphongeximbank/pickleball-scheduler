import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import GroupsIcon from "@mui/icons-material/Groups";
import { Box, Paper, Stack, Typography } from "@mui/material";

import DrawRevealCard from "./DrawRevealCard.jsx";
import GroupResultPanel from "./GroupResultPanel.jsx";
import PrizeWheel from "./PrizeWheel.jsx";
import { getGroupTheme, getScaledTiming, getSnakeFlowLabels, VISUAL_MODES } from "./animationConfig.js";
import { shuffleVisualOrder } from "./animationUtils.js";
import { buildWheelSegments } from "./wheelUtils.js";
import { playTeamPlaced, playWheelLand, playWheelSpinStart, startSpinTicks, stopSpinTicks } from "./wheelSounds.js";
import { DRAW_CONTROL_MODES, useDrawSequence } from "./useDrawSequence.js";
import AnimationControlBar, { ANIMATION_CONTROL_MODES } from "./shared/AnimationControlBar.jsx";
import ParticipantCard, { TEAM_WAITING_STATUS } from "./shared/ParticipantCard.jsx";
import ResultPanel from "./shared/ResultPanel.jsx";
import RevealStage from "./shared/RevealStage.jsx";
import TeamCard from "./shared/TeamCard.jsx";
import TournamentAnimationShell from "./shared/TournamentAnimationShell.jsx";
import WaitingListPanel from "./shared/WaitingListPanel.jsx";
import { FLOW_STEP_KEYS, isGuidedFlow } from "./shared/tournamentFlowConfig.js";
import {
  completeAnimationStep,
  resolveAnimationCompleteHandler,
} from "./shared/tournamentFlowHelpers.js";
import {
  playDingSound,
  playTickSound,
  playWhooshSound,
  setTournamentSoundEnabled,
} from "./shared/tournamentSounds.js";
import { usePresentationMode } from "./shared/usePresentationMode.js";

function getTeamDisplayName(teamName = "") {
  const parts = String(teamName)
    .split(/\s*\/\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return { name: teamName, subtitle: null };
  }

  return {
    name: parts.join(" / "),
    subtitle: `${parts.length} VĐV trong đội`,
  };
}

function getStatusText({ phase, currentStep, placedCount, totalCount, PHASES }) {
  if (placedCount >= totalCount || phase === PHASES.DONE) {
    return "Hoàn tất chia bảng";
  }

  if (phase === PHASES.SUMMARY) {
    return "Tổng kết kết quả";
  }

  if (phase === PHASES.SHUFFLE) {
    return "Đang chia bảng";
  }

  if (currentStep?.groupLabel) {
    return `Đang đưa vào Bảng ${currentStep.groupLabel}`;
  }

  return "Sẵn sàng chia bảng";
}

function SnakeFlowIndicator({ groupCount, activeLabel, drawType }) {
  if (drawType !== "snake") {
    return null;
  }

  const flow = getSnakeFlowLabels(groupCount).slice(0, groupCount * 2 - 1);

  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap justifyContent="center" sx={{ mt: 1.5 }}>
      {flow.map((label, index) => {
        const theme = getGroupTheme(label);
        const active = label === activeLabel;

        return (
          <Stack key={`${label}-${index}`} direction="row" alignItems="center" spacing={0.25}>
            <Box
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: 1,
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                bgcolor: active ? theme.light : "transparent",
                color: active ? theme.main : "text.secondary",
                border: active ? `1px solid ${theme.main}` : "1px solid #e2e8f0",
              }}
            >
              {label}
            </Box>
            {index < flow.length - 1 && <ArrowForwardIcon sx={{ fontSize: 14, color: "text.disabled" }} />}
          </Stack>
        );
      })}
    </Stack>
  );
}

function ClassicWheelStage({ steps, speed, started, onStepPlaced, onAllComplete, onActiveIndexChange }) {
  const stepCursorRef = useRef(0);
  const [spinToken, setSpinToken] = useState(0);
  const [targetIndex, setTargetIndex] = useState(-1);
  const [spinning, setSpinning] = useState(false);
  const timing = getScaledTiming(speed);
  const wheelSegments = useMemo(() => buildWheelSegments(steps), [steps]);

  const runFrom = useCallback(
    (index) => {
      if (index >= steps.length) {
        onAllComplete?.();
        return;
      }

      stepCursorRef.current = index;
      onActiveIndexChange?.(index);
      setSpinning(true);
      setTargetIndex(index);
      setSpinToken((value) => value + 1);
      playWheelSpinStart();
      startSpinTicks(timing.shuffleMs + timing.spotlightMs);
    },
    [steps.length, timing.shuffleMs, timing.spotlightMs, onAllComplete, onActiveIndexChange]
  );

  useEffect(() => {
    if (!started) {
      return;
    }

    stepCursorRef.current = 0;
    onStepPlaced?.(0);
    runFrom(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  const handleSpinEnd = () => {
    playWheelLand();
    const next = stepCursorRef.current + 1;
    onStepPlaced?.(next);
    playTeamPlaced();
    stopSpinTicks();

    setTimeout(() => {
      runFrom(next);
    }, timing.gapMs);
  };

  return (
    <PrizeWheel
      segments={wheelSegments}
      targetIndex={targetIndex}
      spinToken={spinToken}
      spinning={spinning}
      spinDurationMs={timing.shuffleMs + timing.spotlightMs}
      centerLabel={steps[targetIndex]?.team?.name || "Sẵn sàng"}
      onSpinEnd={handleSpinEnd}
    />
  );
}

function GroupResultsSidebar({ steps, placedCount, groups, highlightLabel }) {
  const groupLabels = groups.length
    ? groups.map((group) => group.label || group.name?.replace("Bảng ", "") || "A")
    : [...new Set(steps.map((step) => step.groupLabel))].filter(Boolean);

  const teamsByGroup = useMemo(() => {
    const map = {};
    groupLabels.forEach((label) => {
      map[label] = [];
    });

    steps.slice(0, placedCount).forEach((step) => {
      const label = step.groupLabel || "A";
      if (!map[label]) {
        map[label] = [];
      }
      map[label].push(step);
    });

    return map;
  }, [steps, placedCount, groupLabels]);

  return (
    <ResultPanel title="Kết quả bảng" emptyText="Chưa có đội trong bảng">
      {groupLabels.map((label) => {
        const theme = getGroupTheme(label);
        const items = teamsByGroup[label] || [];
        const highlighted = highlightLabel === label;

        return (
          <Paper
            key={label}
            variant="outlined"
            className={highlighted ? "tournament-group-glow" : undefined}
            sx={{
              p: 1,
              borderColor: highlighted ? theme.main : "#e2e8f0",
              borderWidth: highlighted ? 2 : 1,
              bgcolor: highlighted ? theme.light : "#fff",
            }}
          >
            <Typography variant="caption" fontWeight="bold" sx={{ color: theme.main }}>
              Bảng {label} ({items.length})
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
              {items.map((step, index) => (
                <Typography key={`${step.team.id}-${index}`} variant="body2" sx={{ wordBreak: "break-word" }}>
                  • {step.team.name}
                </Typography>
              ))}
            </Stack>
          </Paper>
        );
      })}
    </ResultPanel>
  );
}

export default function GroupDrawAnimation({
  steps = [],
  groups = [],
  drawType = "snake",
  title = "Chia bảng Snake",
  subtitle = "Thứ tự snake từ engine — animation chỉ trình chiếu",
  visualMode: initialVisualMode = VISUAL_MODES.PROFESSIONAL,
  speed: initialSpeed = "normal",
  autoStart = false,
  flowMode,
  onAnimationComplete,
  onSkip,
  onStepComplete,
  onStartMatchPairing,
  matchCount = 0,
}) {
  const [visualMode, setVisualMode] = useState(initialVisualMode);
  const [speed, setSpeed] = useState(initialSpeed);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [classicPlaced, setClassicPlaced] = useState(0);
  const [classicStarted, setClassicStarted] = useState(false);
  const [classicRunKey, setClassicRunKey] = useState(0);
  const [classicActiveIndex, setClassicActiveIndex] = useState(-1);
  const [queueOrder, setQueueOrder] = useState([]);
  const { presentationMode, togglePresentationMode } = usePresentationMode();
  const autoStartedRef = useRef(false);
  const guidedFlow = isGuidedFlow(flowMode);
  const showMatchPairingCta = onStartMatchPairing && !guidedFlow;

  const handleFlowComplete = resolveAnimationCompleteHandler({
    flowMode,
    onStepComplete,
    onAnimationComplete,
  });

  const groupCount = groups.length || [...new Set(steps.map((s) => s.groupLabel))].length || 4;

  const sequence = useDrawSequence({
    steps,
    speed,
    controlMode: DRAW_CONTROL_MODES.AUTO,
    onComplete: handleFlowComplete,
  });

  const startAutoRef = useRef(sequence.startAuto);
  startAutoRef.current = sequence.startAuto;

  useEffect(() => {
    if (!autoStart || autoStartedRef.current || !steps.length || visualMode === VISUAL_MODES.CLASSIC) {
      return;
    }

    autoStartedRef.current = true;
    startAutoRef.current();
  }, [autoStart, steps.length, visualMode]);

  const placedCount = visualMode === VISUAL_MODES.CLASSIC ? classicPlaced : sequence.placedCount;
  const totalCount = steps.length;
  const progress = totalCount ? Math.round((placedCount / totalCount) * 100) : 0;

  const pendingSteps = steps.slice(placedCount);
  const pendingById = useMemo(() => {
    const map = new Map();
    pendingSteps.forEach((step) => map.set(step.team.id, step));
    return map;
  }, [pendingSteps]);

  const reshuffleQueue = useCallback(() => {
    const ids = pendingSteps.map((step) => step.team.id);
    setQueueOrder(shuffleVisualOrder(ids));
  }, [pendingSteps]);

  useEffect(() => {
    reshuffleQueue();
  }, [reshuffleQueue]);

  useEffect(() => {
    if (visualMode === VISUAL_MODES.CLASSIC) {
      if (!classicStarted) {
        return undefined;
      }

      const timer = setInterval(reshuffleQueue, 4800);
      return () => clearInterval(timer);
    }

    if (sequence.phase !== sequence.PHASES.SHUFFLE || !sequence.playing) {
      return undefined;
    }

    const timer = setInterval(reshuffleQueue, 4800);
    return () => clearInterval(timer);
  }, [
    visualMode,
    classicStarted,
    sequence.phase,
    sequence.playing,
    reshuffleQueue,
    sequence.PHASES.SHUFFLE,
  ]);

  useEffect(() => {
    setTournamentSoundEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    if (!soundEnabled || visualMode === VISUAL_MODES.CLASSIC) {
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
  }, [sequence.phase, sequence.playing, placedCount, soundEnabled, visualMode, sequence.PHASES]);

  const displayQueue = useMemo(
    () => queueOrder.map((id) => pendingById.get(id)).filter(Boolean),
    [queueOrder, pendingById]
  );

  const selectedTeamId = useMemo(() => {
    if (visualMode === VISUAL_MODES.CLASSIC && classicStarted) {
      const index = classicActiveIndex >= 0 ? classicActiveIndex : classicPlaced;
      return steps[index]?.team?.id ?? null;
    }

    if (sequence.phase === sequence.PHASES.SPOTLIGHT || sequence.phase === sequence.PHASES.FLY) {
      return sequence.currentStep?.team?.id ?? null;
    }

    if (sequence.phase === sequence.PHASES.SHUFFLE && sequence.playing) {
      return steps[placedCount]?.team?.id ?? null;
    }

    return null;
  }, [
    visualMode,
    classicStarted,
    classicActiveIndex,
    classicPlaced,
    steps,
    placedCount,
    sequence.phase,
    sequence.playing,
    sequence.currentStep,
    sequence.PHASES,
  ]);

  const highlightSelected =
    visualMode === VISUAL_MODES.CLASSIC
      ? classicStarted && Boolean(selectedTeamId)
      : sequence.playing &&
        (sequence.phase === sequence.PHASES.SHUFFLE ||
          sequence.phase === sequence.PHASES.SPOTLIGHT ||
          sequence.phase === sequence.PHASES.FLY);

  const isQueueShuffling =
    (visualMode !== VISUAL_MODES.CLASSIC &&
      sequence.phase === sequence.PHASES.SHUFFLE &&
      sequence.playing) ||
    (visualMode === VISUAL_MODES.CLASSIC && classicStarted);

  const statusText = getStatusText({
    phase: sequence.phase,
    currentStep: sequence.currentStep,
    placedCount,
    totalCount,
    PHASES: sequence.PHASES,
  });

  const showSummary =
    (visualMode !== VISUAL_MODES.CLASSIC &&
      (sequence.phase === sequence.PHASES.SUMMARY || sequence.phase === sequence.PHASES.DONE)) ||
    (visualMode === VISUAL_MODES.CLASSIC && classicStarted && placedCount >= totalCount && totalCount > 0);

  const currentStep =
    visualMode === VISUAL_MODES.CLASSIC
      ? steps[classicActiveIndex >= 0 ? classicActiveIndex : Math.max(0, placedCount - 1)]
      : sequence.currentStep || steps[placedCount];

  const handleSkip = () => {
    stopSpinTicks();
    if (visualMode === VISUAL_MODES.CLASSIC) {
      setClassicPlaced(steps.length);
      completeAnimationStep({ flowMode, onStepComplete, onSkip, onAnimationComplete });
      return;
    }
    sequence.skip();
    completeAnimationStep({ flowMode, onStepComplete, onSkip, onAnimationComplete });
  };

  const handleViewResults = () => {
    handleSkip();
  };

  const handleStart = () => {
    if (visualMode === VISUAL_MODES.CLASSIC) {
      setClassicPlaced(0);
      setClassicActiveIndex(-1);
      setClassicRunKey((value) => value + 1);
      setClassicStarted(true);
      reshuffleQueue();
      return;
    }
    sequence.start();
  };

  const handleStartAuto = () => {
    if (visualMode === VISUAL_MODES.CLASSIC) {
      handleStart();
      return;
    }
    sequence.startAuto();
  };

  const handleReplay = () => {
    stopSpinTicks();
    setClassicPlaced(0);
    setClassicActiveIndex(-1);
    setClassicStarted(false);
    if (visualMode === VISUAL_MODES.CLASSIC) {
      setClassicRunKey((value) => value + 1);
      setClassicStarted(true);
      return;
    }
    sequence.replay();
  };

  const controlMode =
    sequence.controlMode === DRAW_CONTROL_MODES.AUTO
      ? ANIMATION_CONTROL_MODES.AUTO
      : ANIMATION_CONTROL_MODES.MANUAL;

  if (showSummary) {
    return (
      <TournamentAnimationShell
        title={title}
        subtitle={subtitle}
        activeFlowStep={FLOW_STEP_KEYS.DRAW}
        statusText="Hoàn tất chia bảng"
        progress={100}
        progressLabel={`${placedCount}/${totalCount} đội`}
        presentationMode={presentationMode}
        onTogglePresentation={togglePresentationMode}
        leftPanel={null}
        centerPanel={
          <GroupResultPanel
            steps={steps}
            placedCount={placedCount}
            groups={groups}
            showSummary
            matchCount={matchCount}
            onStartMatchPairing={showMatchPairingCta ? onStartMatchPairing : undefined}
          />
        }
        rightPanel={null}
        footer={
          showMatchPairingCta ? (
            <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{ mt: 2 }}>
              Bấm &quot;Ghép cặp thi đấu&quot; để tiếp tục • Bấm ra ngoài để thoát
            </Typography>
          ) : (
            <AnimationControlBar
              playing={false}
              paused={false}
              controlMode={controlMode}
              speed={speed}
              visualMode={visualMode}
              showVisualMode
              isComplete
              onStart={handleStart}
              onStartAuto={handleStartAuto}
              onSkip={handleSkip}
              onReplay={handleReplay}
              onViewResults={handleViewResults}
              onSpeedChange={setSpeed}
              onVisualModeChange={setVisualMode}
              soundEnabled={soundEnabled}
              onSoundToggle={setSoundEnabled}
              showDismissHint
            />
          )
        }
      />
    );
  }

  return (
    <TournamentAnimationShell
      title={title}
      subtitle={subtitle}
      activeFlowStep={FLOW_STEP_KEYS.DRAW}
      statusText={statusText}
      progress={progress}
      progressLabel={`${placedCount}/${totalCount} đội`}
      presentationMode={presentationMode}
      onTogglePresentation={togglePresentationMode}
      leftPanel={
        <WaitingListPanel
          title="Đội chờ bốc thăm"
          subtitle={
            sequence.phase === sequence.PHASES.IDLE && visualMode !== VISUAL_MODES.CLASSIC
              ? "Bấm Bắt đầu để chia bảng tự động"
              : "Thứ tự hiển thị chỉ là hiệu ứng — kết quả theo engine"
          }
          emptyText="Đã hết đội chờ"
        >
          {displayQueue.map((step) => {
            const isSelected = highlightSelected && step.team.id === selectedTeamId;
            const display = getTeamDisplayName(step.team.name);

            return (
              <ParticipantCard
                key={step.team.id}
                name={display.name}
                subtitle={display.subtitle}
                seed={step.seed}
                level={step.avgLevel}
                statusLabels={TEAM_WAITING_STATUS}
                isActive={isSelected}
                isDone={false}
                shaking={isQueueShuffling && isSelected}
                Icon={GroupsIcon}
              />
            );
          })}
        </WaitingListPanel>
      }
      centerPanel={
        visualMode === VISUAL_MODES.CLASSIC && classicStarted ? (
          <RevealStage statusTitle="Đang chia bảng" statusText={statusText} presentationMode={presentationMode}>
            <ClassicWheelStage
              key={classicRunKey}
              steps={steps}
              speed={speed}
              started={classicStarted}
              onStepPlaced={setClassicPlaced}
              onAllComplete={handleFlowComplete}
              onActiveIndexChange={setClassicActiveIndex}
            />
          </RevealStage>
        ) : visualMode === VISUAL_MODES.CLASSIC ? (
          <RevealStage statusTitle="Đang chia bảng" statusText="Bấm Bắt đầu để quay vòng Classic">
            <Typography variant="body1" color="text.secondary" align="center">
              Chế độ Classic — vòng quay trình chiếu theo thứ tự engine
            </Typography>
          </RevealStage>
        ) : (
          <RevealStage
            statusTitle="Đang chia bảng"
            statusText={statusText}
            badges={
              currentStep?.groupLabel
                ? [{ key: "target", label: `Đang đưa vào Bảng ${currentStep.groupLabel}`, tone: "active" }]
                : []
            }
            presentationMode={presentationMode}
          >
            {currentStep ? (
              <Stack spacing={2} alignItems="center" sx={{ width: "100%" }}>
                <TeamCard
                  title={currentStep.team?.name}
                  players={
                    String(currentStep.team?.name || "")
                      .split(/\s*\/\s*/)
                      .filter(Boolean).length > 1
                      ? String(currentStep.team.name).split(/\s*\/\s*/)
                      : [currentStep.team?.name]
                  }
                  seed={currentStep.seed}
                  avgLevel={currentStep.avgLevel}
                  visible
                  flying={sequence.phase === sequence.PHASES.FLY}
                />
                <Typography variant="h6" fontWeight={800} color="primary.main">
                  → Bảng {currentStep.groupLabel}
                </Typography>
                <SnakeFlowIndicator
                  groupCount={groupCount}
                  activeLabel={currentStep.groupLabel}
                  drawType={drawType}
                />
              </Stack>
            ) : (
              <DrawRevealCard
                name="Sẵn sàng chia bảng"
                statusText={statusText}
                visualMode={visualMode}
                phase="spotlight"
                compact
              />
            )}
          </RevealStage>
        )
      }
      rightPanel={
        <GroupResultsSidebar
          steps={steps}
          placedCount={placedCount}
          groups={groups}
          highlightLabel={sequence.currentStep?.groupLabel}
        />
      }
      footer={
        <AnimationControlBar
          playing={sequence.playing || (visualMode === VISUAL_MODES.CLASSIC && classicStarted)}
          paused={sequence.paused}
          controlMode={controlMode}
          speed={speed}
          visualMode={visualMode}
          showVisualMode
          isComplete={sequence.isComplete}
          canReveal={placedCount < totalCount}
          startButtonLabel="Bắt đầu"
          nextButtonLabel="Chia đội tiếp theo"
          onStart={handleStart}
          onRevealNext={sequence.revealNext}
          onStartAuto={handleStart}
          onPause={sequence.pause}
          onResume={sequence.resume}
          onSkip={handleSkip}
          onReplay={handleReplay}
          onViewResults={handleViewResults}
          onSpeedChange={setSpeed}
          onControlModeChange={(value) =>
            sequence.setControlMode(
              value === ANIMATION_CONTROL_MODES.AUTO ? DRAW_CONTROL_MODES.AUTO : DRAW_CONTROL_MODES.MANUAL
            )
          }
          onVisualModeChange={setVisualMode}
          soundEnabled={soundEnabled}
          onSoundToggle={setSoundEnabled}
        />
      }
    />
  );
}
