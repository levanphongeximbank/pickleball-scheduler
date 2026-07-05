import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";

import TournamentAnimationControls from "./TournamentAnimationControls.jsx";
import {
  ANIMATION_MODES,
  ANIMATION_TIMING,
  buildBracketRevealSteps,
  prefersReducedMotion,
} from "./animationUtils.js";
import {
  completeAnimationStep,
  isGuidedFlowMode,
  resolveAnimationCompleteHandler,
} from "./shared/tournamentFlowHelpers.js";
import "./tournamentAnimation.css";

const ROUND_MS = ANIMATION_TIMING.bracketRoundMs;
const MATCH_MS = ANIMATION_TIMING.bracketMatchMs;
const ADVANCE_MS = ANIMATION_TIMING.bracketAdvanceMs;

function formatMatchLabel(match) {
  const home = match?.home?.name || match?.homeSeed || "TBD";
  const away = match?.away?.name || match?.awaySeed || "TBD";
  return `${home} vs ${away}`;
}

export default function BracketRevealAnimation({
  bracket,
  animationMode = ANIMATION_MODES.BRACKET_REVEAL,
  advanceHint = null,
  autoStart = false,
  flowMode,
  bracketReviewMode = false,
  onAnimationComplete,
  onSkip,
  onStepComplete,
  onFlowExit,
}) {
  const steps = useMemo(() => buildBracketRevealSteps(bracket), [bracket]);
  const [phase, setPhase] = useState({ round: -1, match: -1 });
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef(null);
  const autoStartedRef = useRef(false);

  const handleFlowComplete = resolveAnimationCompleteHandler({
    flowMode,
    onStepComplete,
    onAnimationComplete,
  });

  const finishAnimation = useCallback(() => {
    completeAnimationStep({ flowMode, onStepComplete, onSkip, onAnimationComplete });
  }, [flowMode, onStepComplete, onSkip, onAnimationComplete]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    if (animationMode !== ANIMATION_MODES.BRACKET_ADVANCE || !advanceHint) {
      return undefined;
    }

    if (prefersReducedMotion()) {
      handleFlowComplete?.();
      return undefined;
    }

    timerRef.current = setTimeout(() => handleFlowComplete?.(), ADVANCE_MS);
    return clearTimer;
  }, [animationMode, advanceHint, handleFlowComplete]);

  const run = useCallback(() => {
    clearTimer();
    setPhase({ round: -1, match: -1 });

    if (steps.length === 0) {
      handleFlowComplete?.();
      return;
    }

    setPlaying(true);
    let roundIndex = 0;
    let matchIndex = 0;

    const tick = () => {
      if (roundIndex >= steps.length) {
        setPlaying(false);
        handleFlowComplete?.();
        return;
      }

      const round = steps[roundIndex];
      setPhase({ round: roundIndex, match: matchIndex });

      if (matchIndex < round.matches.length - 1) {
        matchIndex += 1;
        timerRef.current = setTimeout(tick, MATCH_MS);
        return;
      }

      roundIndex += 1;
      matchIndex = 0;
      timerRef.current = setTimeout(tick, ROUND_MS);
    };

    timerRef.current = setTimeout(tick, MATCH_MS);
  }, [steps, handleFlowComplete]);

  useEffect(() => {
    if (!bracketReviewMode || !steps.length) {
      return;
    }

    clearTimer();
    setPlaying(false);
    setPhase({
      round: steps.length - 1,
      match: steps[steps.length - 1].matches.length - 1,
    });
  }, [bracketReviewMode, steps]);

  useEffect(() => {
    if (animationMode === ANIMATION_MODES.BRACKET_ADVANCE) {
      return undefined;
    }

    if (prefersReducedMotion()) {
      handleFlowComplete?.();
    }

    return clearTimer;
  }, [animationMode, handleFlowComplete]);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current || animationMode === ANIMATION_MODES.BRACKET_ADVANCE) {
      return;
    }

    autoStartedRef.current = true;
    run();
  }, [autoStart, animationMode, run]);

  if (animationMode === ANIMATION_MODES.BRACKET_ADVANCE && advanceHint) {
    return (
      <Box className="tournament-anim" sx={{ p: 1.5 }}>
        <Paper className="bracket-advance__chip" variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            Đội đi tiếp
          </Typography>
          <Typography fontWeight="bold">{advanceHint.winnerName}</Typography>
        </Paper>
      </Box>
    );
  }

  const isRoundVisible = (roundIndex) =>
    bracketReviewMode || phase.round >= roundIndex;
  const isMatchVisible = (roundIndex, matchIndex) =>
    bracketReviewMode ||
    phase.round > roundIndex ||
    (phase.round === roundIndex && phase.match >= matchIndex);
  const guidedReview = bracketReviewMode && isGuidedFlowMode(flowMode);

  return (
    <Box className="tournament-anim" sx={{ p: 2 }}>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        {guidedReview ? "Sơ đồ knock-out — xem và thoát khi sẵn sàng" : "Sơ đồ knock-out"}
      </Typography>

      <Stack direction="row" spacing={2} sx={{ overflowX: "auto", pb: 1 }}>
        {steps.map((round, roundIndex) => (
          <Paper
            key={round.roundName}
            className={`bracket-round${isRoundVisible(roundIndex) ? " bracket-round--visible" : ""}`}
            variant="outlined"
            sx={{ p: 1, minWidth: 200 }}
          >
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
              {round.roundName}
            </Typography>
            <Stack spacing={0.75}>
              {round.matches.map((match, matchIndex) => (
                <Paper
                  key={match.id}
                  className={`bracket-match${isMatchVisible(roundIndex, matchIndex) ? " bracket-match--visible" : ""}`}
                  sx={{
                    p: 1,
                    opacity: isMatchVisible(roundIndex, matchIndex) ? 1 : 0.15,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {match.id}
                  </Typography>
                  <Typography variant="body2">{formatMatchLabel(match)}</Typography>
                </Paper>
              ))}
            </Stack>
          </Paper>
        ))}
      </Stack>

      {!guidedReview ? (
        <TournamentAnimationControls
          playing={playing}
          onStart={run}
          onSkip={finishAnimation}
          onShowNow={finishAnimation}
          onReplay={run}
          canReplay={steps.length > 0}
        />
      ) : (
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<ExitToAppIcon />}
            onClick={onFlowExit}
          >
            Thoát trình chiếu
          </Button>
        </Stack>
      )}
    </Box>
  );
}
