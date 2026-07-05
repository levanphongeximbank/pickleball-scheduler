import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";

import { ANIMATION_MODES } from "./animationUtils.js";
import TournamentDrawBoard from "./TournamentDrawBoard.jsx";
import PairingRevealBoard from "./PairingRevealBoard.jsx";
import MatchPairingAnimation from "./MatchPairingAnimation.jsx";
import DailyFairMatchScreen from "./daily/DailyFairMatchScreen.jsx";
import BracketRevealAnimation from "./BracketRevealAnimation.jsx";
import FlowStepHandoff from "./shared/FlowStepHandoff.jsx";
import { VISUAL_MODES } from "./animationConfig.js";

const COMPONENTS = {
  [ANIMATION_MODES.RANDOM_DRAW]: TournamentDrawBoard,
  [ANIMATION_MODES.SNAKE_GROUP]: TournamentDrawBoard,
  [ANIMATION_MODES.PAIRING_REVEAL]: PairingRevealBoard,
  [ANIMATION_MODES.MATCH_REVEAL]: PairingRevealBoard,
  [ANIMATION_MODES.DAILY_FAIR_MATCH]: DailyFairMatchScreen,
  [ANIMATION_MODES.GROUP_MATCH_PAIRING]: MatchPairingAnimation,
  [ANIMATION_MODES.BRACKET_REVEAL]: BracketRevealAnimation,
  [ANIMATION_MODES.BRACKET_ADVANCE]: BracketRevealAnimation,
};

function resolveBoardProps(animationMode, payload) {
  if (animationMode === ANIMATION_MODES.SNAKE_GROUP) {
    return {
      drawType: "snake",
      title: payload.title || "Chia bảng Snake",
      subtitle: payload.subtitle || "Professional Draw Board — thứ tự snake từ engine",
    };
  }

  if (animationMode === ANIMATION_MODES.RANDOM_DRAW) {
    return {
      drawType: "random",
      title: payload.title || "Bốc thăm chia bảng",
      subtitle: payload.subtitle || "Professional Draw Board — kết quả random từ engine",
    };
  }

  return {
    visualMode: payload.visualMode || VISUAL_MODES.PROFESSIONAL,
    speed: payload.speed || "normal",
  };
}

export default function TournamentAnimationDialog({
  open,
  animationMode,
  onAnimationComplete,
  onSkip,
  onDismiss,
  handoff,
  onFlowContinue,
  onFlowExit,
  onStepComplete,
  flowMode,
  bracketReviewMode = false,
  ...payload
}) {
  if (handoff) {
    return (
      <Dialog
        open={Boolean(open)}
        onClose={onFlowExit || onDismiss}
        disableEscapeKeyDown
        fullWidth
        maxWidth="md"
        scroll="paper"
        PaperProps={{
          sx: { bgcolor: "#f8fafc" },
        }}
      >
        <DialogContent sx={{ p: { xs: 1, sm: 2 } }}>
          <FlowStepHandoff
            completedStepKey={handoff.completedStepKey}
            nextStepKey={handoff.nextStepKey}
            summary={handoff.summary}
            preparationMessage={handoff.preparationMessage}
            countdownSeconds={handoff.countdownSeconds}
            onContinue={onFlowContinue}
            onExit={onFlowExit || onDismiss}
          />
        </DialogContent>
      </Dialog>
    );
  }

  const Component = COMPONENTS[animationMode];
  const boardProps = resolveBoardProps(animationMode, payload);
  const guidedBracketReview =
    bracketReviewMode && isGuidedFlow(flowMode) && animationMode === ANIMATION_MODES.BRACKET_REVEAL;

  return (
    <Dialog
      open={Boolean(open && Component)}
      onClose={guidedBracketReview ? undefined : onDismiss}
      disableEscapeKeyDown={guidedBracketReview}
      fullWidth
      maxWidth={
        animationMode === ANIMATION_MODES.GROUP_MATCH_PAIRING ||
        animationMode === ANIMATION_MODES.DAILY_FAIR_MATCH ||
        animationMode === ANIMATION_MODES.PAIRING_REVEAL ||
        animationMode === ANIMATION_MODES.MATCH_REVEAL ||
        animationMode === ANIMATION_MODES.SNAKE_GROUP ||
        animationMode === ANIMATION_MODES.RANDOM_DRAW
          ? false
          : "lg"
      }
      scroll="paper"
      PaperProps={{
        sx: { bgcolor: "#f8fafc" },
      }}
    >
      <DialogContent sx={{ p: { xs: 1, sm: 2 } }}>
        {Component ? (
          <Component
            animationMode={animationMode}
            flowMode={flowMode}
            bracketReviewMode={bracketReviewMode}
            onAnimationComplete={onAnimationComplete}
            onSkip={onSkip}
            onStepComplete={onStepComplete}
            onFlowExit={onFlowExit || onDismiss}
            onViewSchedule={onDismiss}
            {...payload}
            {...boardProps}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

