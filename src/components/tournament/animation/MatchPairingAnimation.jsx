import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Dialog, DialogContent, Paper, Stack, Typography } from "@mui/material";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";

import GroupSelectorPanel from "./pairing/GroupSelectorPanel.jsx";
import { PAIRING_CONTROL_MODES, PAIRING_PHASES, usePairingSequence } from "./pairing/usePairingSequence.js";
import AnimationControlBar, { ANIMATION_CONTROL_MODES } from "./shared/AnimationControlBar.jsx";
import MatchCard from "./shared/MatchCard.jsx";
import ResultPanel from "./shared/ResultPanel.jsx";
import RevealStage, { VsHub } from "./shared/RevealStage.jsx";
import TeamCard from "./shared/TeamCard.jsx";
import TournamentAnimationShell from "./shared/TournamentAnimationShell.jsx";
import { FLOW_STEP_KEYS } from "./shared/tournamentFlowConfig.js";
import {
  playDingSound,
  playWhooshSound,
  setTournamentSoundEnabled,
} from "./shared/tournamentSounds.js";
import { usePresentationMode } from "./shared/usePresentationMode.js";

function GroupCompleteBanner({ completedGroup, nextGroup, onNextGroup, totalMatches }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 1.5, bgcolor: "#e8f5e9", borderRadius: 3 }}>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        {completedGroup?.groupName || `Bảng ${completedGroup?.groupLabel}`} đã ghép xong
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Đã tạo {completedGroup?.matchCount || 0} trận trong bảng này • Tổng đã reveal: {totalMatches}
      </Typography>
      {nextGroup ? (
        <Button variant="contained" onClick={onNextGroup}>
          Sang Bảng {nextGroup.groupLabel}
        </Button>
      ) : null}
    </Paper>
  );
}

function FinalSummary({ totalMatches, onViewSchedule }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 1.5, borderRadius: 3 }}>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Hoàn tất ghép cặp thi đấu
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Đã tạo {totalMatches} trận vòng bảng theo kết quả engine.
      </Typography>
      <Button variant="contained" color="success" onClick={onViewSchedule}>
        Xem lịch thi đấu
      </Button>
    </Paper>
  );
}

function HelpDialog({ open, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogContent>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          Hướng dẫn ghép cặp thi đấu
        </Typography>
        <Stack spacing={1}>
          <Typography variant="body2">
            • <strong>Auto</strong> tự động reveal toàn bộ trận theo tốc độ đã chọn.
          </Typography>
          <Typography variant="body2">
            • <strong>Manual</strong> công bố từng trận bằng nút &quot;Reveal trận tiếp theo&quot;.
          </Typography>
          <Typography variant="body2">
            • Hết mỗi bảng sẽ dừng chờ bấm &quot;Sang Bảng ...&quot; (trừ khi bật Auto next group).
          </Typography>
          <Typography variant="body2">• Kết quả lấy từ engine — animation không random lại.</Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

export default function MatchPairingAnimation({
  tournamentName = "Giải đấu",
  groups = [],
  steps = [],
  entries = [],
  speed: initialSpeed = "normal",
  controlMode: initialControlMode = PAIRING_CONTROL_MODES.AUTO,
  autoNextGroup: initialAutoNextGroup = true,
  autoStart = true,
  onAnimationComplete,
  onSkip,
  onViewSchedule,
}) {
  const [speed, setSpeed] = useState(initialSpeed);
  const [helpOpen, setHelpOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const { presentationMode, togglePresentationMode } = usePresentationMode();
  const autoStartedRef = useRef(false);

  const sequence = usePairingSequence({
    steps,
    speed,
    controlMode: initialControlMode,
    autoNextGroup: initialAutoNextGroup,
    onComplete: onAnimationComplete,
  });

  const startAutoRef = useRef(sequence.startAuto);
  startAutoRef.current = sequence.startAuto;

  useEffect(() => {
    if (!autoStart || autoStartedRef.current || !steps.length) {
      return;
    }

    autoStartedRef.current = true;
    startAutoRef.current();
  }, [autoStart, steps]);

  useEffect(() => {
    setTournamentSoundEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    if (!soundEnabled) {
      return;
    }

    if (sequence.phase === PAIRING_PHASES.FLY) {
      playWhooshSound();
    }

    if (sequence.revealedCount > 0 && sequence.phase === PAIRING_PHASES.IDLE) {
      playDingSound();
    }
  }, [sequence.phase, sequence.revealedCount, soundEnabled]);

  const handleReplay = () => {
    sequence.replay();
    autoStartedRef.current = false;

    if (autoStart) {
      requestAnimationFrame(() => {
        autoStartedRef.current = true;
        startAutoRef.current();
      });
    }
  };

  const enrichedGroups = useMemo(
    () =>
      groups.map((group) => ({
        ...group,
        matchCount: steps.filter((step) => String(step.groupId) === String(group.id)).length,
      })),
    [groups, steps]
  );

  const activeGroupId = sequence.currentGroup?.id || enrichedGroups[0]?.id || null;

  const activeGroupEntries = useMemo(() => {
    const group = enrichedGroups.find((item) => String(item.id) === String(activeGroupId));
    if (!group) {
      return [];
    }

    if (group.entries?.length) {
      return group.entries;
    }

    const entryById = Object.fromEntries(entries.map((entry) => [String(entry.id), entry]));
    return (group.entryIds || []).map((id) => entryById[String(id)]).filter(Boolean);
  }, [activeGroupId, enrichedGroups, entries]);

  const selectedEntryIds = useMemo(() => {
    if (!sequence.currentStep) {
      return [];
    }

    return [sequence.currentStep.left?.id, sequence.currentStep.right?.id].filter(Boolean);
  }, [sequence.currentStep]);

  const progress = steps.length ? Math.round((sequence.revealedCount / steps.length) * 100) : 0;

  const groupProgressLabel = useMemo(() => {
    if (!sequence.currentGroup) {
      return "";
    }

    const range = sequence.ranges.find((item) => item.groupId === sequence.currentGroup.id);
    if (!range) {
      return "";
    }

    const inGroup = Math.max(0, sequence.revealedCount - range.start);
    return `${inGroup}/${range.matchCount} trận Bảng ${sequence.currentGroup.label}`;
  }, [sequence.currentGroup, sequence.ranges, sequence.revealedCount]);

  const statusText = useMemo(() => {
    if (sequence.isComplete) {
      return "Hoàn tất ghép cặp thi đấu";
    }

    if (sequence.waitingGroupAdvance) {
      return `Bảng ${sequence.completedGroupRange?.groupLabel} đã xong`;
    }

    if (sequence.phase === PAIRING_PHASES.SHUFFLE) {
      return sequence.currentGroup ? `Đang ghép Bảng ${sequence.currentGroup.label}` : "Đang chuẩn bị";
    }

    if (sequence.phase === PAIRING_PHASES.REVEAL || sequence.phase === PAIRING_PHASES.FLY) {
      return sequence.currentStep?.matchLabel || "Đang reveal trận đấu";
    }

    return sequence.currentGroup
      ? `Sẵn sàng ghép Bảng ${sequence.currentGroup.label}`
      : "Sẵn sàng ghép cặp";
  }, [sequence]);

  const handleSkip = () => {
    sequence.skip();
    onSkip?.();
  };

  const handleViewResults = () => {
    sequence.viewResultsNow();
    onSkip?.();
  };

  const handleViewSchedule = () => {
    onViewSchedule?.();
  };

  const showCards =
    sequence.currentStep &&
    (sequence.phase === PAIRING_PHASES.SHUFFLE ||
      sequence.phase === PAIRING_PHASES.REVEAL ||
      sequence.phase === PAIRING_PHASES.FLY);

  const controlMode =
    sequence.controlMode === PAIRING_CONTROL_MODES.AUTO
      ? ANIMATION_CONTROL_MODES.AUTO
      : ANIMATION_CONTROL_MODES.MANUAL;

  const revealedSteps = steps.slice(0, sequence.revealedCount);
  const filteredRevealed = activeGroupId
    ? revealedSteps.filter((step) => String(step.groupId) === String(activeGroupId))
    : revealedSteps;

  return (
    <>
      <TournamentAnimationShell
        title="Ghép cặp thi đấu"
        subtitle={`${tournamentName} — reveal từng trận theo bảng, dữ liệu từ engine`}
        activeFlowStep={FLOW_STEP_KEYS.MATCH_PAIRING}
        statusText={statusText}
        progress={progress}
        progressLabel={`${groupProgressLabel || `${sequence.revealedCount}/${sequence.totalCount} trận`}`}
        presentationMode={presentationMode}
        onTogglePresentation={togglePresentationMode}
        headerExtra={
          <Button size="small" variant="text" startIcon={<HelpOutlineOutlinedIcon />} onClick={() => setHelpOpen(true)}>
            Hướng dẫn
          </Button>
        }
        banners={
          <>
            {sequence.waitingGroupAdvance && sequence.completedGroupRange ? (
              <GroupCompleteBanner
                completedGroup={sequence.completedGroupRange}
                nextGroup={sequence.nextGroupRange}
                totalMatches={sequence.revealedCount}
                onNextGroup={sequence.goToNextGroup}
              />
            ) : null}
            {sequence.isComplete ? (
              <FinalSummary totalMatches={sequence.totalCount} onViewSchedule={handleViewSchedule} />
            ) : null}
          </>
        }
        leftPanel={
          <GroupSelectorPanel
            groups={enrichedGroups}
            activeGroupId={activeGroupId}
            activeGroupEntries={activeGroupEntries}
            selectedEntryId={selectedEntryIds[0]}
            shuffling={sequence.phase === PAIRING_PHASES.SHUFFLE}
          />
        }
        centerPanel={
          <RevealStage
            statusTitle={
              sequence.currentGroup
                ? `Đang ghép Bảng ${sequence.currentGroup.label}`
                : "Đang ghép cặp thi đấu"
            }
            statusText={sequence.currentStep?.matchLabel || statusText}
            presentationMode={presentationMode}
          >
            {showCards && sequence.currentStep ? (
              <Stack spacing={2} alignItems="center" sx={{ width: "100%" }}>
                <Box className="tournament-arena">
                  <TeamCard
                    title={sequence.currentStep.left?.name || "Đội A"}
                    players={[sequence.currentStep.left?.name || "Đội A"]}
                    seed={sequence.currentStep.left?.seed}
                    side="a"
                    visible
                    flying={sequence.phase === PAIRING_PHASES.FLY}
                  />
                  <VsHub
                    visible={
                      sequence.phase === PAIRING_PHASES.REVEAL || sequence.phase === PAIRING_PHASES.FLY
                    }
                    pulse={sequence.phase === PAIRING_PHASES.REVEAL}
                  />
                  <TeamCard
                    title={sequence.currentStep.right?.name || "Đội B"}
                    players={[sequence.currentStep.right?.name || "Đội B"]}
                    seed={sequence.currentStep.right?.seed}
                    side="b"
                    visible
                    flying={sequence.phase === PAIRING_PHASES.FLY}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" align="center">
                  {sequence.currentStep.groupLabel ? `Bảng ${sequence.currentStep.groupLabel}` : ""}
                  {sequence.currentStep.courtLabel ? ` • ${sequence.currentStep.courtLabel}` : " • Chưa xếp sân"}
                </Typography>
              </Stack>
            ) : (
              <Typography variant="body1" color="text.secondary" align="center">
                {statusText}
              </Typography>
            )}
          </RevealStage>
        }
        rightPanel={
          <ResultPanel title="Trận đã ghép" emptyText="Chưa có trận">
            {filteredRevealed.map((step, index) => {
              const isLatest = index === filteredRevealed.length - 1 && sequence.phase === PAIRING_PHASES.FLY;

              return (
                <MatchCard
                  key={step.match?.id || `${step.groupId}-${step.matchNumber}`}
                  matchLabel={step.matchLabel}
                  groupLabel={step.groupLabel}
                  leftName={step.left?.name}
                  rightName={step.right?.name}
                  courtName={step.courtLabel}
                  status={{ label: step.courtLabel ? "Đã ghép" : "Chưa xếp sân", tone: "success" }}
                  isLatest={isLatest}
                  isNew={isLatest}
                />
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
            isComplete={sequence.isComplete}
            canReveal={sequence.revealedCount < sequence.totalCount}
            waitingGroupAdvance={sequence.waitingGroupAdvance}
            nextGroupLabel={sequence.nextGroupRange?.groupLabel}
            startButtonLabel="Bắt đầu"
            nextButtonLabel="Reveal trận tiếp theo"
            onStart={sequence.revealNext}
            onRevealNext={sequence.revealNext}
            onStartAuto={sequence.startAuto}
            onPause={sequence.pause}
            onResume={sequence.resume}
            onSkip={handleSkip}
            onReplay={handleReplay}
            onViewResults={handleViewResults}
            onSpeedChange={setSpeed}
            onControlModeChange={sequence.setControlMode}
            onNextGroup={sequence.goToNextGroup}
            onViewSchedule={handleViewSchedule}
            soundEnabled={soundEnabled}
            onSoundToggle={setSoundEnabled}
            showDismissHint={sequence.isComplete}
          />
        }
      />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
