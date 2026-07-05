import { FLOW_MODES } from "./tournamentFlowConfig.js";

export function isGuidedFlowMode(flowMode) {
  return flowMode === FLOW_MODES.GUIDED;
}

export function resolveAnimationCompleteHandler({
  flowMode,
  onStepComplete,
  onAnimationComplete,
}) {
  if (isGuidedFlowMode(flowMode)) {
    return onStepComplete;
  }

  return onAnimationComplete;
}

export function completeAnimationStep({ flowMode, onStepComplete, onSkip, onAnimationComplete }) {
  if (isGuidedFlowMode(flowMode)) {
    onStepComplete?.();
    return;
  }

  if (onSkip) {
    onSkip();
    return;
  }

  onAnimationComplete?.();
}
