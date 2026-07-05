import { useCallback, useRef } from "react";

import { ANIMATION_MODES } from "./animationUtils.js";
import {
  ANIMATION_TO_FLOW_KEY,
  FLOW_MODES,
  getFlowPreparationMessage,
  resolveGuidedPipeline,
} from "./shared/tournamentFlowConfig.js";

export function useTournamentFlowOrchestrator(anim, adapters) {
  const flowRef = useRef({
    ctx: null,
    stepIndex: 0,
    pipeline: [],
  });

  const handleStepComplete = useCallback(() => {
    const state = flowRef.current;
    const mode = state.pipeline[state.stepIndex];

    if (!mode || !state.ctx) {
      return;
    }

    const persistResult = adapters.persist(mode, state.ctx);
    if (persistResult === false) {
      return;
    }

    adapters.afterPersist?.(mode, state.ctx);

    const isLast = state.stepIndex >= state.pipeline.length - 1;
    if (isLast) {
      adapters.onFlowComplete?.(state.ctx);
      if (mode === ANIMATION_MODES.BRACKET_REVEAL) {
        anim.enterBracketReview();
      } else {
        anim.dismiss();
      }
      return;
    }

    const nextMode = state.pipeline[state.stepIndex + 1];
    const nextStepKey = ANIMATION_TO_FLOW_KEY[nextMode];
    anim.showHandoff({
      completedStepKey: ANIMATION_TO_FLOW_KEY[mode],
      nextStepKey,
      summary: adapters.getHandoffSummary(mode, state.ctx),
      preparationMessage: getFlowPreparationMessage(nextStepKey),
    });
  }, [adapters, anim]);

  const advanceToNextStep = useCallback(() => {
    const state = flowRef.current;
    if (!state.ctx || state.stepIndex >= state.pipeline.length - 1) {
      return;
    }

    state.stepIndex += 1;
    anim.clearHandoff();

    const mode = state.pipeline[state.stepIndex];
    const payload = adapters.buildPayload(mode, state.ctx);

    anim.transitionAnimation({
      ...payload,
      flowMode: FLOW_MODES.GUIDED,
      onStepComplete: handleStepComplete,
    });
  }, [adapters, anim, handleStepComplete]);

  const startFlow = useCallback(
    (ctx, options = {}) => {
      const validation = adapters.validateStart?.(ctx);
      if (validation && validation.ok === false) {
        return validation;
      }

      const pipeline =
        options.pipeline ||
        resolveGuidedPipeline({ includeBracket: ctx.includeBracket !== false });

      if (!pipeline.length) {
        return { ok: false, error: "Không có bước trình chiếu." };
      }

      flowRef.current = {
        ctx,
        stepIndex: 0,
        pipeline,
      };

      const firstMode = pipeline[0];
      const payload = adapters.buildPayload(firstMode, ctx);

      anim.showAnimation(
        {
          ...payload,
          flowMode: FLOW_MODES.GUIDED,
          onStepComplete: handleStepComplete,
        },
        null
      );

      return { ok: true };
    },
    [adapters, anim, handleStepComplete]
  );

  const exitFlow = useCallback(() => {
    flowRef.current = { ctx: null, stepIndex: 0, pipeline: [] };
    anim.dismiss();
  }, [anim]);

  return {
    startFlow,
    advanceToNextStep,
    exitFlow,
    dialogProps: {
      ...anim.dialogProps,
      onStepComplete: handleStepComplete,
      onFlowContinue: advanceToNextStep,
      onFlowExit: exitFlow,
    },
  };
}

export function shouldIncludeBracketStep(event) {
  if (!event?.groups?.length) {
    return false;
  }

  if (event.groups.length < 2 || event.groups.length % 2 !== 0) {
    return false;
  }

  return true;
}

export { ANIMATION_MODES, resolveGuidedPipeline };
