/**
 * Shared Team Tournament post-mutation canonical refresh contract.
 *
 * successful cloud mutation
 *   → single get_setup refresh (or commit of verified reload payload)
 *   → local state replaced only from canonical response
 *   → in-flight older silent reloads (poll/realtime) cannot overwrite newer state
 *
 * No window.location.reload. No localStorage authority. No optimistic stage fakes.
 */

/**
 * @typedef {object} CanonicalSetupRefreshController
 * @property {() => number} beginReload
 * @property {(generation: number) => boolean} shouldApplyReload
 * @property {() => number} invalidateInFlight
 * @property {() => number} beginMutationBarrier
 * @property {() => void} endMutationBarrier
 * @property {() => boolean} isMutationBarrierActive
 * @property {() => number} getGeneration
 */

/**
 * Pure controller — unit-testable without React.
 * @returns {CanonicalSetupRefreshController}
 */
export function createCanonicalSetupRefreshController() {
  let generation = 0;
  let mutationDepth = 0;

  return {
    beginReload() {
      generation += 1;
      return generation;
    },

    shouldApplyReload(candidateGeneration) {
      return Number(candidateGeneration) === generation;
    },

    /** Bump generation so any in-flight reload apply is ignored. */
    invalidateInFlight() {
      generation += 1;
      return generation;
    },

    /**
     * Call before a multi-step mutation. Background poll/realtime reloads that
     * started earlier (or during the barrier) lose the apply race on purpose.
     */
    beginMutationBarrier() {
      mutationDepth += 1;
      generation += 1;
      return generation;
    },

    endMutationBarrier() {
      mutationDepth = Math.max(0, mutationDepth - 1);
    },

    isMutationBarrierActive() {
      return mutationDepth > 0;
    },

    getGeneration() {
      return generation;
    },
  };
}

/**
 * Decide whether a completed reload may replace React teamData.
 * @param {CanonicalSetupRefreshController} controller
 * @param {number} generation
 * @param {{ applyUi?: boolean }} [options]
 */
export function resolveCanonicalReloadApply(controller, generation, options = {}) {
  if (options.applyUi === false) {
    return {
      apply: false,
      reason: "peek_only",
      stale: false,
      generation,
    };
  }
  if (
    typeof controller.isMutationBarrierActive === "function" &&
    controller.isMutationBarrierActive()
  ) {
    return {
      apply: false,
      reason: "mutation_barrier",
      stale: true,
      generation,
    };
  }
  if (!controller.shouldApplyReload(generation)) {
    return {
      apply: false,
      reason: "stale_generation",
      stale: true,
      generation,
    };
  }
  return {
    apply: true,
    reason: "latest",
    stale: false,
    generation,
  };
}

/**
 * Commit a verified canonical load payload into UI state.
 * Invalidates in-flight silent reloads first so they cannot clobber this commit.
 *
 * @param {CanonicalSetupRefreshController} controller
 * @param {(result: object) => void} applyLoadResult
 * @param {object} loadResult
 * @returns {{ applied: boolean, generation: number, ok: boolean }}
 */
export function commitCanonicalSetupLoad(controller, applyLoadResult, loadResult) {
  if (!loadResult?.ok) {
    return {
      applied: false,
      generation: controller.getGeneration(),
      ok: false,
    };
  }
  const generation = controller.invalidateInFlight();
  applyLoadResult(loadResult);
  return {
    applied: true,
    generation,
    ok: true,
  };
}

/**
 * Shared post-mutation primitive:
 * bump barrier → load get_setup → apply only if this load is still latest.
 *
 * @param {object} params
 * @param {CanonicalSetupRefreshController} params.controller
 * @param {(opts?: object) => Promise<object>} params.loadSetup
 * @param {(result: object) => void} params.applyLoadResult
 * @param {object} [params.loadOptions]
 */
export async function refreshCanonicalSetupAfterMutation(params = {}) {
  const {
    controller,
    loadSetup,
    applyLoadResult,
    loadOptions = {},
  } = params;

  if (!controller || typeof loadSetup !== "function" || typeof applyLoadResult !== "function") {
    return {
      ok: false,
      code: "MISSING_REFRESH_PRIMITIVE",
      error: "Thiếu canonical setup refresh primitive.",
      applied: false,
    };
  }

  // Intentional post-mutation load: bump generation so older polls lose, then
  // commit via commitCanonicalSetupLoad (works inside an active mutation barrier;
  // silent poll/realtime applies remain blocked by resolveCanonicalReloadApply).
  const generation = controller.beginReload();
  const result = await loadSetup({
    silent: true,
    schemaVersion: 7,
    ...loadOptions,
  });

  if (loadOptions.applyUi === false) {
    return {
      ...result,
      ok: result?.ok === true,
      applied: false,
      stale: false,
      refreshReason: "peek_only",
      generation,
    };
  }

  // Superseded by a newer intentional reload/barrier bump — do not clobber.
  if (!controller.shouldApplyReload(generation)) {
    return {
      ...result,
      ok: result?.ok === true,
      applied: false,
      stale: true,
      refreshReason: "stale_generation",
      generation,
    };
  }

  if (!result?.ok) {
    applyLoadResult(result);
    return {
      ...result,
      applied: true,
      stale: false,
      refreshReason: "latest_error",
      generation,
    };
  }

  const committed = commitCanonicalSetupLoad(controller, applyLoadResult, result);
  return {
    ...result,
    applied: committed.applied,
    stale: false,
    refreshReason: "post_mutation",
    generation: committed.generation,
  };
}
