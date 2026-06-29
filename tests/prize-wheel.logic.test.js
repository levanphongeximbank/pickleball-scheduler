import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildWheelSegments,
  computeWheelRotation,
  getRadialLabelLayout,
} from "../src/components/tournament/animation/wheelUtils.js";

describe("prize wheel utils", () => {
  it("buildWheelSegments assigns unique colors", () => {
    const segments = buildWheelSegments([
      { team: { id: "a", name: "Team A" } },
      { team: { id: "b", name: "Team B" } },
    ]);

    assert.equal(segments.length, 2);
    assert.notEqual(segments[0].color, segments[1].color);
  });

  it("computeWheelRotation increases monotonically", () => {
    const first = computeWheelRotation(0, 0, 4);
    const second = computeWheelRotation(first, 1, 4);

    assert.ok(second > first);
  });

  it("getRadialLabelLayout points text from center outward", () => {
    const top = getRadialLabelLayout(0, 150, 150, 140);
    const right = getRadialLabelLayout(90, 150, 150, 140);

    assert.equal(top.textAnchor, "start");
    assert.equal(top.rotation, -90);
    assert.equal(right.rotation, 0);
  });
});
