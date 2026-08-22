/**
 * Wave 2 Batch 2B — foundation a11y targeted (focus-visible foundation).
 * Node-safe source + token assertions (no MUI runtime).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { INTERACTION } from "../src/theme/designTokens.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

test("batch2b a11y — focus ring tokens defined", () => {
  assert.equal(INTERACTION.focusRing, "#3B82F6");
  assert.equal(INTERACTION.focusRingWidth, 2);
  assert.equal(INTERACTION.focusRingOffset, 2);
});

test("batch2b a11y — theme wires focus-visible on core interactives", () => {
  const src = read("src/theme/theme.js");
  for (const needle of [
    "MuiButton",
    "MuiIconButton",
    "MuiLink",
    "MuiToggleButton",
    "MuiBottomNavigationAction",
    "focus-visible",
  ]) {
    assert.ok(src.includes(needle), `missing ${needle}`);
  }
  assert.equal(/"\*:focus"\s*:\s*\{\s*outline:\s*"none"/.test(src), false);
});

test("batch2b a11y — CssBaseline includes focus-visible for native interactives", () => {
  const src = read("src/theme/theme.js");
  assert.ok(src.includes("button:focus-visible"));
  assert.ok(src.includes("a:focus-visible"));
  assert.ok(src.includes("input:focus-visible"));
});

test("batch2b a11y — touch target constant for new primitives (shell exception frozen)", () => {
  assert.equal(INTERACTION.touchTargetMin, 44);
  assert.equal(INTERACTION.frozenShellItemHeight, 40);
  const themeSrc = read("src/theme/theme.js");
  assert.equal(themeSrc.includes("sidebarItemHeight"), false);
  const figure1 = read("src/theme/figure1Tokens.js");
  assert.ok(figure1.includes("sidebarItemHeight: 40"));
  assert.ok(figure1.includes("touchTargetMin: 44"));
});
