import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";

import { ANIMATION_MODES } from "./animationUtils.js";
import TournamentDrawBoard from "./TournamentDrawBoard.jsx";
import PairingRevealBoard from "./PairingRevealBoard.jsx";
import MatchPairingAnimation from "./MatchPairingAnimation.jsx";
import DailyFairMatchScreen from "./daily/DailyFairMatchScreen.jsx";
import BracketRevealAnimation from "./BracketRevealAnimation.jsx";
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
  ...payload
}) {
  const Component = COMPONENTS[animationMode];
  const boardProps = resolveBoardProps(animationMode, payload);

  return (
    <Dialog
      open={Boolean(open && Component)}
      onClose={onDismiss}
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
            onAnimationComplete={onAnimationComplete}
            onSkip={onSkip}
            onViewSchedule={onDismiss}
            {...payload}
            {...boardProps}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

