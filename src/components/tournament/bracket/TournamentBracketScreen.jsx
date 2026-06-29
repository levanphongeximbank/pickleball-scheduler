import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Tab, Tabs } from "@mui/material";

import TournamentFlowProgress from "../animation/shared/TournamentFlowProgress.jsx";
import { FLOW_STEP_KEYS } from "../animation/shared/tournamentFlowConfig.js";
import { usePresentationMode } from "../animation/shared/usePresentationMode.js";
import {
  playDingSound,
  setTournamentSoundEnabled,
} from "../animation/shared/tournamentSounds.js";
import "../animation/shared/tournamentAnimationTheme.css";
import BracketControlBar from "./BracketControlBar.jsx";
import BracketHeader from "./BracketHeader.jsx";
import BracketRightPanel from "./BracketRightPanel.jsx";
import BracketSidebar from "./BracketSidebar.jsx";
import BracketTree from "./BracketTree.jsx";
import { buildBracketRevealPlan, buildBracketViewModel } from "./bracketScreenUtils.js";
import { getColumnScrollLeft } from "./bracketLayoutEngine.js";
import { useBracketSequence } from "./useBracketSequence.js";
import "./tournamentBracket.css";

export default function TournamentBracketScreen({
  tournament,
  event,
  progress,
  knockoutMatchesByBracketId = {},
  courts = [],
  categoryLabel = "",
  onBack,
  onOpenResults,
  onOpenDetails,
  autoPlayReveal = false,
}) {
  const [speed, setSpeed] = useState("normal");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [activeRoundKey, setActiveRoundKey] = useState("");
  const [mobileTab, setMobileTab] = useState(0);
  const treeScrollRef = useRef(null);
  const roundRefs = useRef({});
  const { presentationMode, togglePresentationMode } = usePresentationMode();

  const viewModel = useMemo(
    () =>
      buildBracketViewModel({
        progress,
        knockoutMatchesByBracketId,
        courts,
        event,
      }),
    [progress, knockoutMatchesByBracketId, courts, event]
  );

  const revealPlan = useMemo(() => buildBracketRevealPlan(viewModel), [viewModel]);

  const sequence = useBracketSequence({
    revealPlan,
    speed,
    onComplete: () => {
      if (soundEnabled) {
        playDingSound();
      }
    },
  });

  const autoStartedRef = useRef(false);

  useEffect(() => {
    setTournamentSoundEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    if (!viewModel.rounds.length) {
      return;
    }

    if (!activeRoundKey) {
      setActiveRoundKey(viewModel.rounds[0].key);
    }
  }, [viewModel.rounds, activeRoundKey]);

  useEffect(() => {
    if (!autoPlayReveal || autoStartedRef.current || !revealPlan.length) {
      return;
    }

    autoStartedRef.current = true;
    sequence.start();
  }, [autoPlayReveal, revealPlan.length, sequence]);

  const handleSelectRound = useCallback(
    (roundKey) => {
      setActiveRoundKey(roundKey);
      const roundIndex = viewModel.rounds.findIndex((round) => round.key === roundKey);

      if (roundIndex >= 0) {
        setMobileTab(roundIndex);
        const scrollNode = treeScrollRef.current;
        if (scrollNode) {
          scrollNode.scrollTo({
            left: getColumnScrollLeft(roundIndex),
            behavior: "smooth",
          });
        }
      }

      const mobileNode = document.getElementById(`bracket-round-${roundKey}`);
      mobileNode?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [viewModel.rounds]
  );

  const content = (
    <Box
      className={`tournament-bracket-screen${
        presentationMode ? " tournament-bracket-screen--presentation" : ""
      }`}
    >
      <BracketHeader
        tournamentName={tournament?.name || "Giải đấu"}
        categoryLabel={categoryLabel}
        presentationMode={presentationMode}
        soundEnabled={soundEnabled}
        onBack={onBack}
        onTogglePresentation={togglePresentationMode}
        onToggleSound={setSoundEnabled}
        onOpenResults={onOpenResults}
      />

      <TournamentFlowProgress activeStepKey={FLOW_STEP_KEYS.BRACKET} />

      <Box className="tournament-bracket-mobile-tabs">
        <Tabs
          value={mobileTab}
          onChange={(_, value) => {
            setMobileTab(value);
            const round = viewModel.rounds[value];
            if (round) {
              handleSelectRound(round.key);
            }
          }}
          variant="scrollable"
          scrollButtons="auto"
        >
          {viewModel.rounds.map((round) => (
            <Tab key={round.key} label={round.shortLabel || round.displayName} />
          ))}
        </Tabs>
      </Box>

      <Box className="tournament-bracket-layout">
        <Box sx={{ display: { xs: "none", lg: "block" } }}>
          <BracketSidebar
            rounds={viewModel.rounds}
            teamCount={viewModel.teamCount}
            formatLabel={viewModel.formatLabel}
            startDate={tournament?.startDate || event?.startDate || ""}
            venue={tournament?.venue || tournament?.location || ""}
            activeRoundKey={activeRoundKey}
            onSelectRound={handleSelectRound}
            onOpenDetails={onOpenDetails}
          />
        </Box>

        <BracketTree
          viewModel={viewModel}
          isRoundVisible={sequence.isRoundVisible}
          isMatchVisible={sequence.isMatchVisible}
          activeRoundKey={activeRoundKey}
          connectorReveal={sequence.connectorReveal}
          onRoundRef={(key, node) => {
            roundRefs.current[key] = node;
          }}
          onViewSummary={onOpenResults}
          treeScrollRef={treeScrollRef}
        />

        <Box sx={{ display: { xs: "none", lg: "block" } }}>
          <BracketRightPanel
            pendingMatches={viewModel.pendingMatches}
            advancingTeams={viewModel.advancingTeams}
          />
        </Box>
      </Box>

      <BracketControlBar
        playing={sequence.playing}
        paused={sequence.paused}
        controlMode={sequence.mode}
        speed={speed}
        isComplete={sequence.isComplete}
        onStart={sequence.start}
        onRevealNext={sequence.revealNext}
        onPause={sequence.pause}
        onResume={sequence.resume}
        onReplay={sequence.replay}
        onSkip={sequence.skip}
        onSpeedChange={setSpeed}
        onControlModeChange={sequence.setMode}
      />
    </Box>
  );

  return content;
}
