import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DRAW_CONTROL_MODES,
  DRAW_PHASES,
  getDrawSequenceTiming,
  getDrawTurnTotalMs,
  runDrawAutoChain,
  runDrawManualStep,
} from "../src/components/tournament/animation/drawSequenceLogic.js";

function createHarness(steps, controlMode = DRAW_CONTROL_MODES.AUTO) {
  const state = {
    placedCount: 0,
    currentIndex: -1,
    phase: DRAW_PHASES.IDLE,
    controlMode,
    running: false,
    playing: false,
  };

  return {
    getState: () => ({ ...state }),
    setState: (patch) => {
      Object.assign(state, patch);
    },
    state,
    wait: async () => {},
  };
}

describe("draw sequence timing", () => {
  it("keeps per-turn totals inside speed targets", () => {
    const fast = getDrawTurnTotalMs("fast");
    const normal = getDrawTurnTotalMs("normal");
    const slow = getDrawTurnTotalMs("slow");

    assert.ok(fast >= 600 && fast <= 850, `fast=${fast}`);
    assert.ok(normal >= 1000 && normal <= 1450, `normal=${normal}`);
    assert.ok(slow >= 1600 && slow <= 2250, `slow=${slow}`);
  });

  it("defaults to normal speed", () => {
    assert.equal(getDrawSequenceTiming().shuffleMs, getDrawSequenceTiming("normal").shuffleMs);
  });
});

describe("draw sequence auto mode", () => {
  it("runs through all steps without manual input", async () => {
    const steps = Array.from({ length: 5 }, (_, index) => ({ id: index }));
    const harness = createHarness(steps);
    let completed = false;

    await runDrawAutoChain({
      steps,
      timing: getDrawSequenceTiming("fast"),
      wait: harness.wait,
      getState: harness.getState,
      setState: harness.setState,
      onComplete: () => {
        completed = true;
      },
    });

    assert.equal(harness.state.placedCount, 5);
    assert.equal(harness.state.phase, DRAW_PHASES.DONE);
    assert.equal(completed, true);
  });

  it("manual mode reveals one step per call", async () => {
    const steps = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const harness = createHarness(steps, DRAW_CONTROL_MODES.MANUAL);
    const timing = getDrawSequenceTiming("fast");

    await runDrawManualStep({
      steps,
      timing,
      wait: harness.wait,
      getState: harness.getState,
      setState: harness.setState,
    });

    assert.equal(harness.state.placedCount, 1);
    assert.equal(harness.state.playing, false);

    await runDrawManualStep({
      steps,
      timing,
      wait: harness.wait,
      getState: harness.getState,
      setState: harness.setState,
    });

    assert.equal(harness.state.placedCount, 2);
  });

  it("skip equivalent leaves engine order intact", async () => {
    const steps = [
      { id: "a", order: 1 },
      { id: "b", order: 2 },
      { id: "c", order: 3 },
    ];
    const harness = createHarness(steps);

    await runDrawAutoChain({
      steps,
      timing: getDrawSequenceTiming("fast"),
      wait: harness.wait,
      getState: harness.getState,
      setState: harness.setState,
    });

    assert.deepEqual(
      steps.map((step) => step.order),
      [1, 2, 3]
    );
    assert.equal(harness.state.placedCount, steps.length);
  });

  it("replay auto chain resets progress then completes again", async () => {
    const steps = [{ id: 1 }, { id: 2 }];
    const harness = createHarness(steps);
    const timing = getDrawSequenceTiming("fast");

    await runDrawAutoChain({
      steps,
      timing,
      wait: harness.wait,
      getState: harness.getState,
      setState: harness.setState,
    });

    harness.setState({
      placedCount: 0,
      currentIndex: -1,
      phase: DRAW_PHASES.IDLE,
      running: false,
      playing: false,
    });

    await runDrawAutoChain({
      steps,
      timing,
      wait: harness.wait,
      getState: harness.getState,
      setState: harness.setState,
    });

    assert.equal(harness.state.placedCount, 2);
    assert.equal(harness.state.phase, DRAW_PHASES.DONE);
  });
});

describe("draw sequence pause simulation", () => {
  it("waits while paused then continues from same index", async () => {
    const steps = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const harness = createHarness(steps);
    let waitCalls = 0;
    let paused = false;

    const wait = async (ms) => {
      waitCalls += 1;

      if (waitCalls === 2) {
        paused = true;
        await new Promise((resolve) => setTimeout(resolve, 20));
        paused = false;
      }

      if (paused) {
        await new Promise((resolve) => {
          const tick = () => {
            if (!paused) {
              resolve();
              return;
            }
            setTimeout(tick, 10);
          };
          tick();
        });
      }

      void ms;
    };

    await runDrawAutoChain({
      steps,
      timing: getDrawSequenceTiming("fast"),
      wait,
      getState: harness.getState,
      setState: harness.setState,
    });

    assert.equal(harness.state.placedCount, 3);
  });
});
