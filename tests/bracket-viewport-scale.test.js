import test from "node:test";
import assert from "node:assert/strict";

import { computeBracketViewportScale } from "../src/components/tournament/bracket/useBracketViewportScale.js";

test("computeBracketViewportScale fits wide bracket into viewport", () => {
  const scale = computeBracketViewportScale(1920, 900, 2400, 800, 24);
  assert.ok(scale < 1);
  assert.ok(scale > 0.28);
  assert.ok(2400 * scale <= 1920 - 24);
});

test("computeBracketViewportScale keeps scale at 1 for small bracket", () => {
  const scale = computeBracketViewportScale(1920, 900, 900, 400, 24);
  assert.equal(scale, 1);
});

test("computeBracketViewportScale respects height constraint for tall R16 tree", () => {
  const scale = computeBracketViewportScale(1600, 720, 2000, 1400, 24);
  assert.ok(1400 * scale <= 720 - 24);
});
