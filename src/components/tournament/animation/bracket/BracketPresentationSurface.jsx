import { useCallback, useEffect, useMemo, useRef } from "react";
import { Box, Button, Typography } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";

import BracketTree from "../../bracket/BracketTree.jsx";
import { buildBracketTreeLayout } from "../../bracket/bracketLayoutEngine.js";
import { buildBracketRevealPlan, buildBracketViewModel } from "../../bracket/bracketScreenUtils.js";
import { useBracketSequence } from "../../bracket/useBracketSequence.js";
import { useBracketViewportScale } from "../../bracket/useBracketViewportScale.js";
import { prefersReducedMotion } from "../animationUtils.js";
import {
  completeAnimationStep,
  isGuidedFlowMode,
  resolveAnimationCompleteHandler,
} from "../shared/tournamentFlowHelpers.js";
import "../../bracket/tournamentBracket.css";

function isRoundOf16View(viewModel) {
  const firstRound = viewModel?.rounds?.[0];
  return firstRound?.engineName === "Vong 1/16" || (viewModel?.teamCount || 0) >= 32;
}

export default function BracketPresentationSurface({
  bracket,
  event = null,
  courts = [],
  knockoutMatchesByBracketId = {},
  autoStart = false,
  bracketReviewMode = false,
  flowMode,
  onAnimationComplete,
  onSkip,
  onStepComplete,
  onFlowExit,
}) {
  const viewportRef = useRef(null);
  const treeScrollRef = useRef(null);
  const autoStartedRef = useRef(false);

  const viewModel = useMemo(
    () =>
      buildBracketViewModel({
        progress: bracket,
        knockoutMatchesByBracketId,
        courts,
        event,
      }),
    [bracket, knockoutMatchesByBracketId, courts, event]
  );

  const revealPlan = useMemo(() => buildBracketRevealPlan(viewModel), [viewModel]);

  const layoutSize = useMemo(() => {
    const layout = buildBracketTreeLayout(viewModel.rounds);
    return { width: layout.width, height: layout.height };
  }, [viewModel.rounds]);

  const fitScale = useBracketViewportScale(viewportRef, layoutSize);

  const handleFlowComplete = useCallback(() => {
    completeAnimationStep({ flowMode, onStepComplete, onSkip, onAnimationComplete });
  }, [flowMode, onStepComplete, onSkip, onAnimationComplete]);

  const flowCompleteHandler = useMemo(
    () =>
      resolveAnimationCompleteHandler({
        flowMode,
        onStepComplete,
        onAnimationComplete,
      }),
    [flowMode, onStepComplete, onAnimationComplete]
  );

  const sequence = useBracketSequence({
    revealPlan,
    speed: "normal",
    onComplete: () => {
      if (!bracketReviewMode) {
        flowCompleteHandler?.();
      }
    },
  });

  const isR16 = isRoundOf16View(viewModel);
  const guidedReview = bracketReviewMode && isGuidedFlowMode(flowMode);
  const treeClassName = [
    "tournament-bracket-tree--flow-pro",
    "tournament-bracket-tree--fit-viewport",
    isR16 ? "tournament-bracket-tree--r16" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const isRoundVisible = useCallback(
    (roundIndex) => bracketReviewMode || sequence.isRoundVisible(roundIndex),
    [bracketReviewMode, sequence.isRoundVisible]
  );

  const isMatchVisible = useCallback(
    (roundIndex, matchIndex) =>
      bracketReviewMode || sequence.isMatchVisible(roundIndex, matchIndex),
    [bracketReviewMode, sequence.isMatchVisible]
  );

  const connectorReveal = bracketReviewMode ? 1 : sequence.connectorReveal;

  useEffect(() => {
    if (!autoStart || autoStartedRef.current || !revealPlan.length || bracketReviewMode) {
      return;
    }

    autoStartedRef.current = true;

    if (prefersReducedMotion()) {
      handleFlowComplete();
      return;
    }

    sequence.start();
  }, [autoStart, revealPlan.length, bracketReviewMode, sequence, handleFlowComplete]);

  return (
    <Box
      className="bracket-presentation-surface"
      sx={{
        height: "100%",
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#F8FAFC",
        px: { xs: 1, sm: 2 },
        py: 2,
        overflow: "hidden",
      }}
    >
      <Typography
        variant="h5"
        align="center"
        fontWeight={700}
        sx={{
          mb: 1.5,
          flexShrink: 0,
          color: "text.primary",
          letterSpacing: "-0.02em",
        }}
      >
        Sơ đồ thi đấu
      </Typography>

      <Box
        ref={viewportRef}
        className="bracket-presentation-surface__viewport"
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Box
          className="bracket-presentation-surface__scaler"
          sx={{
            width: layoutSize.width * fitScale,
            height: layoutSize.height * fitScale,
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              width: layoutSize.width,
              height: layoutSize.height,
              transform: `scale(${fitScale})`,
              transformOrigin: "top left",
            }}
          >
            <BracketTree
              viewModel={viewModel}
              isRoundVisible={isRoundVisible}
              isMatchVisible={isMatchVisible}
              connectorReveal={connectorReveal}
              treeScrollRef={treeScrollRef}
              className={treeClassName}
            />
          </Box>
        </Box>
      </Box>

      {guidedReview ? (
        <Box
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 1500,
          }}
        >
          <Button
            variant="contained"
            size="large"
            startIcon={<ExitToAppIcon />}
            endIcon={<ChevronRightIcon />}
            onClick={onFlowExit}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 2,
              px: 3,
              bgcolor: "#84CC16",
              color: "#0F172A",
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
              "&:hover": { bgcolor: "#65A30D" },
            }}
          >
            Thoát trình chiếu
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}
