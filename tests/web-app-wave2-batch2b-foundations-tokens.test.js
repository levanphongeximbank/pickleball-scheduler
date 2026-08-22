/**
 * Wave 2 Batch 2B — canonical foundations & tokens lock.
 * Detects accidental semantic drift (primary/success/font/boundaries/breakpoints).
 * Node-safe: does not import MUI theme module (avoids DOM/MUI load in unit runner).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BREAKPOINTS,
  COLOR,
  COLOR_BOUNDARY,
  DESIGN_DIRECTION,
  ELEVATION,
  INTERACTION,
  LEGACY_DESIGN_DIRECTION,
  PALETTE,
  RADIUS,
  SHAPE,
  SHELL,
  SPACING,
  TYPOGRAPHY,
  Z_INDEX,
} from "../src/theme/designTokens.js";
import { FIGURE1_BREAKPOINTS, FIGURE1_PALETTE, FIGURE1_TOKENS } from "../src/theme/figure1Tokens.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

test("batch2b — Owner color lock: primary blue ≠ success green", () => {
  assert.equal(COLOR.primary.main, "#3B82F6");
  assert.equal(COLOR.success.main, "#10B981");
  assert.equal(PALETTE.primary.main, "#3B82F6");
  assert.equal(PALETTE.success.main, "#10B981");
  assert.notEqual(PALETTE.primary.main, PALETTE.success.main);
  assert.equal(COLOR_BOUNDARY.authWorkspacePrimary, "#3B82F6");
  assert.equal(COLOR_BOUNDARY.authSuccess, "#10B981");
});

test("batch2b — Public lime and Tournament primary are NOT workspace primary", () => {
  assert.equal(COLOR_BOUNDARY.publicLimeNotGlobal, "#C5E831");
  assert.equal(COLOR_BOUNDARY.tournamentPrimaryNotGlobal, "#2563EB");
  assert.notEqual(PALETTE.primary.main, COLOR_BOUNDARY.publicLimeNotGlobal);
  assert.notEqual(PALETTE.primary.main, COLOR_BOUNDARY.tournamentPrimaryNotGlobal);
  assert.equal(PALETTE.primary.main, "#3B82F6");
});

test("batch2b — semantic color groups available", () => {
  for (const key of [
    "primary",
    "secondary",
    "success",
    "warning",
    "error",
    "info",
    "neutral",
    "background",
    "surface",
    "border",
    "text",
    "disabled",
    "focus",
    "selected",
    "hover",
  ]) {
    assert.ok(COLOR[key], `missing COLOR.${key}`);
  }
  assert.equal(COLOR.focus.ring, "#3B82F6");
  assert.equal(COLOR.info.main, "#3B82F6");
});

test("batch2b — Inter is authenticated canonical font", () => {
  assert.match(TYPOGRAPHY.fontFamily, /^"Inter"/);
  assert.ok(TYPOGRAPHY.pageTitle);
  assert.ok(TYPOGRAPHY.sectionTitle);
  assert.ok(TYPOGRAPHY.body);
  assert.ok(TYPOGRAPHY.caption);
  assert.ok(TYPOGRAPHY.label);
  assert.ok(TYPOGRAPHY.button);
  assert.ok(TYPOGRAPHY.tableHeader);
  assert.ok(TYPOGRAPHY.tableBody);
  const themeSrc = read("src/theme/theme.js");
  assert.ok(themeSrc.includes("TYPOGRAPHY.fontFamily"));
});

test("batch2b — radius scale small/medium/large/pill; SHAPE aliases map safely", () => {
  assert.deepEqual(
    { small: RADIUS.small, medium: RADIUS.medium, large: RADIUS.large, pill: RADIUS.pill },
    { small: 8, medium: 10, large: 12, pill: 999 }
  );
  assert.equal(SHAPE.borderRadius, RADIUS.medium);
  assert.equal(SHAPE.borderRadiusLg, RADIUS.large);
  assert.equal(SHAPE.borderRadiusSm, RADIUS.small);
  assert.equal(SHAPE.borderRadiusPill, RADIUS.pill);
});

test("batch2b — single spacing system (MUI unit); elevation flat/raised/overlay", () => {
  assert.equal(SPACING.unit, 8);
  assert.equal(ELEVATION.flat, "none");
  assert.ok(ELEVATION.raised);
  assert.ok(ELEVATION.overlay);
  assert.ok(ELEVATION.raisedHover);
});

test("batch2b — touch target constant; frozen shell exception documented", () => {
  assert.equal(INTERACTION.touchTargetMin, 44);
  assert.equal(INTERACTION.frozenShellItemHeight, 40);
  assert.equal(INTERACTION.focusRing, "#3B82F6");
});

test("batch2b — Wave 1 breakpoints referenced, not redefined", () => {
  assert.equal(BREAKPOINTS.mobileMax, 899);
  assert.equal(BREAKPOINTS.tabletMin, 900);
  assert.equal(BREAKPOINTS.tabletMax, 1199);
  assert.equal(BREAKPOINTS.desktopMin, 1200);
  assert.equal(BREAKPOINTS.mobileMax, FIGURE1_BREAKPOINTS.mobileMax);
  assert.equal(BREAKPOINTS.desktopMin, FIGURE1_BREAKPOINTS.desktopMin);
  assert.equal(Z_INDEX.sidebar, 1200);
});

test("batch2b — Figure 1 shell tokens remain isolated and blue-accented", () => {
  assert.equal(FIGURE1_PALETTE.sidebarAccent, "#3B82F6");
  assert.equal(FIGURE1_PALETTE.focusRing, "#3B82F6");
  assert.equal(FIGURE1_TOKENS.palette.sidebarBg, "#0F1B2D");
  assert.equal(COLOR_BOUNDARY.figure1ShellAccent, "#3B82F6");
  const themeSrc = read("src/theme/theme.js");
  assert.ok(themeSrc.includes("theme.figure1 = FIGURE1_TOKENS"));
  assert.ok(themeSrc.includes("theme.canonicalNav = FIGURE1_TOKENS"));
});

test("batch2b — MUI theme palette primary/success lock + legacy aliases", () => {
  const themeSrc = read("src/theme/theme.js");
  assert.ok(themeSrc.includes("PALETTE.primary"));
  assert.ok(themeSrc.includes("PALETTE.success"));
  assert.ok(themeSrc.includes("info: PALETTE.info"));
  assert.equal(SHELL.primaryGreen, "#10B981");
  assert.equal(SHELL.sidebarAccent, "#3B82F6");
  assert.equal(SHELL.accentLight, "#ECFDF5");
  assert.equal(SHELL.primarySurface, COLOR.primary.surface);
  assert.equal(DESIGN_DIRECTION, "authenticated-workspace-v2");
  assert.equal(LEGACY_DESIGN_DIRECTION, "slate-enterprise");
});

test("batch2b — foundation focus-visible present in theme.js", () => {
  const themeSrc = read("src/theme/theme.js");
  assert.ok(themeSrc.includes("focus-visible"));
  assert.ok(themeSrc.includes("MuiButton"));
  assert.ok(themeSrc.includes("MuiIconButton"));
  assert.ok(themeSrc.includes("MuiLink"));
  assert.ok(themeSrc.includes("MuiCssBaseline"));
  assert.equal(/"\*:focus"\s*:\s*\{\s*outline:\s*"none"/.test(themeSrc), false);
});

test("batch2b — Inter loaded once at root; figure1Fonts has no CSS re-import", () => {
  const main = read("src/main.jsx");
  const fonts = read("src/features/canonical-shell/fonts/figure1Fonts.js");
  assert.ok(main.includes("@fontsource/inter/400.css"));
  assert.equal((main.match(/@fontsource\/inter\/400\.css/g) || []).length, 1);
  assert.equal(fonts.includes("@fontsource/inter/"), false);
});

test("batch2b — PublicLayout isolates DM Sans (public font unchanged)", () => {
  const layout = read("src/layouts/public/PublicLayout.jsx");
  assert.ok(layout.includes("publicFontFamily"));
  assert.ok(TYPOGRAPHY.publicFontFamily.includes("DM Sans"));
  assert.equal(TYPOGRAPHY.publicFontFamily.startsWith('"Inter"'), false);
});
