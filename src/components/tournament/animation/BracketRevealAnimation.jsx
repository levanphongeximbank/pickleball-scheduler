import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Paper, Stack, Typography } from "@mui/material";

import TournamentAnimationControls from "./TournamentAnimationControls.jsx";
import {
  ANIMATION_MODES,
  ANIMATION_TIMING,
  buildBracketRevealSteps,
  prefersReducedMotion,
} from "./animationUtils.js";
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
  onAnimationComplete,
  onSkip,
}) {
  const steps = useMemo(() => buildBracketRevealSteps(bracket), [bracket]);
  const [phase, setPhase] = useState({ round: -1, match: -1 });
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef(null);

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
      onAnimationComplete?.();
      return undefined;
    }

    timerRef.current = setTimeout(() => onAnimationComplete?.(), ADVANCE_MS);
    return clearTimer;
  }, [animationMode, advanceHint, onAnimationComplete]);

  const run = useCallback(() => {
    clearTimer();
    setPhase({ round: -1, match: -1 });

    if (steps.length === 0) {
      onAnimationComplete?.();
      return;
    }

    setPlaying(true);
    let roundIndex = 0;
    let matchIndex = 0;

    const tick = () => {
      if (roundIndex >= steps.length) {
        setPlaying(false);
        onAnimationComplete?.();
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
  }, [steps, onAnimationComplete]);

  useEffect(() => {
    if (animationMode === ANIMATION_MODES.BRACKET_ADVANCE) {
      return undefined;
    }

    if (prefersReducedMotion()) {
      onAnimationComplete?.();
    }

    return clearTimer;
  }, [animationMode, onAnimationComplete]);

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

  const isRoundVisible = (roundIndex) => phase.round >= roundIndex;
  const isMatchVisible = (roundIndex, matchIndex) =>
    phase.round > roundIndex || (phase.round === roundIndex && phase.match >= matchIndex);

  return (
    <Box className="tournament-anim" sx={{ p: 2 }}>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Sơ đồ knock-out
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

      <TournamentAnimationControls
        playing={playing}
        onStart={run}
        onSkip={onSkip}
        onShowNow={onSkip}
        onReplay={run}
        canReplay={steps.length > 0}
      />
    </Box>
  );
}
