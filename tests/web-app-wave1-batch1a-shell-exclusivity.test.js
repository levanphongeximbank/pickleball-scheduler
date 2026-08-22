/**
 * Wave 1 Batch 1A — exclusive Canonical / Legacy app chrome lock (structural).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CANONICAL_APP_SHELL_FLAG,
  isCanonicalAppShellEnabled,
} from "../src/features/canonical-shell/flags.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

/** Intentional non-MainLayout surfaces (auth, public, referee token, access). */
const INTENTIONAL_OUTSIDE_MAINLAYOUT = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/change-password",
  "/403",
  "/referee/:token",
  "/tournament/:tournamentId/public",
  "/",
  "/home",
  "/public/tournaments",
  "/clubs",
  "/clubs/:publicId",
  "/courts",
  "/courts/:publicId",
  "/rankings",
  "/news",
  "/onboarding/pick-vn-rating",
];

test("batch1a flag — single shell decision flag, rollback default OFF", () => {
  assert.equal(CANONICAL_APP_SHELL_FLAG, "VITE_CANONICAL_APP_SHELL_ENABLED");
  assert.equal(isCanonicalAppShellEnabled({}), false);
  assert.equal(isCanonicalAppShellEnabled({ VITE_CANONICAL_APP_SHELL_ENABLED: "false" }), false);
  assert.equal(isCanonicalAppShellEnabled({ VITE_CANONICAL_APP_SHELL_ENABLED: "true" }), true);
  assert.equal(isCanonicalAppShellEnabled({ VITE_CANONICAL_APP_SHELL_ENABLED: "1" }), true);

  const flagsSrc = readSrc("src/features/canonical-shell/flags.js");
  assert.match(flagsSrc, /VITE_CANONICAL_APP_SHELL_ENABLED/);
  assert.equal((flagsSrc.match(/export const CANONICAL_APP_SHELL_FLAG/g) || []).length, 1);
  // No second shell-decision flag export in this module.
  assert.equal((flagsSrc.match(/export const \w+_FLAG/g) || []).length, 1);
});

test("batch1a MainLayout — exclusive Canonical XOR Legacy (never both)", () => {
  const layout = readSrc("src/layouts/MainLayout.jsx");

  assert.match(layout, /function LegacyMainLayoutContent/);
  assert.match(layout, /CanonicalAppShell/);
  assert.match(layout, /isCanonicalAppShellEnabled/);
  assert.match(layout, /data-testid="legacy-app-shell"/);
  assert.match(layout, /Batch 1A exclusivity lock/);

  // Single branch: if canonical → return Canonical; else → return Legacy.
  const contentFn = layout.match(
    /function MainLayoutContent\(\)\s*\{([\s\S]*?)\n\}/
  );
  assert.ok(contentFn, "MainLayoutContent present");
  const body = contentFn[1];
  assert.match(body, /if\s*\(\s*isCanonicalAppShellEnabled\(\)\s*\)/);
  assert.match(body, /return\s*<CanonicalAppShell\s*\/>/);
  assert.match(body, /return\s*<LegacyMainLayoutContent\s*\/>/);

  // No simultaneous render in the switch body (both JSX in one return).
  assert.equal(/return\s*\([\s\S]*CanonicalAppShell[\s\S]*LegacyMainLayoutContent/.test(body), false);
  assert.equal(/<>[\s\S]*CanonicalAppShell[\s\S]*LegacyMainLayoutContent/.test(body), false);

  // Rollback path preserved — LegacyMainLayoutContent not deleted.
  assert.match(layout, /LegacyMainLayoutContent/);
  assert.match(layout, /Sidebar/);
  assert.match(layout, /Header/);
  assert.match(layout, /MobileBottomNav/);
});

test("batch1a CanonicalAppShell — one chrome family; shared MobileBottomNav only inside shell", () => {
  const shell = readSrc("src/features/canonical-shell/components/CanonicalAppShell.jsx");
  assert.match(shell, /data-testid="canonical-app-shell"/);
  assert.match(shell, /CanonicalSidebar/);
  assert.match(shell, /CanonicalTopBar/);
  assert.match(shell, /CanonicalMobileDrawer/);
  assert.match(shell, /MobileBottomNav/);
  assert.doesNotMatch(shell, /LegacyMainLayoutContent|from ["'].*Sidebar["']|from ["'].*Header["']/);
});

test("batch1a router — authenticated business routes under MainLayout; intentional outsides listed", () => {
  const router = readSrc("src/router.jsx");
  assert.match(router, /element=\{<MainLayout\s*\/>\}/);

  const mainLayoutIdx = router.indexOf("element={<MainLayout />}");
  assert.ok(mainLayoutIdx > 0);

  const beforeMain = router.slice(0, mainLayoutIdx);
  const afterMainOpen = router.slice(mainLayoutIdx);

  // Intentional outsides appear before MainLayout group.
  for (const route of [
    'path="/login"',
    'path="/forgot-password"',
    'path="/reset-password"',
    'path="/change-password"',
    'path="/403"',
    'path="/referee/:token"',
    'path="/tournament/:tournamentId/public"',
  ]) {
    assert.ok(beforeMain.includes(route), `expected intentional outside: ${route}`);
  }
  assert.equal(
    beforeMain.includes('path="/coming-soon/:moduleKey"'),
    false,
    "coming-soon must not bypass MainLayout"
  );

  // Core authenticated business routes must be inside MainLayout group.
  for (const route of [
    'path="/coming-soon/:moduleKey"',
    'path="/dashboard"',
    'path="/tournament"',
    'path="/tournament/list"',
    'path="/settings"',
    'path="/players"',
    'path="/billing"',
    'path="/referee"',
    'path="/referee/match/:matchId"',
  ]) {
    assert.ok(afterMainOpen.includes(route), `expected under MainLayout: ${route}`);
    assert.ok(
      afterMainOpen.indexOf(route) < afterMainOpen.lastIndexOf("</Route>"),
      `route still nested under MainLayout: ${route}`
    );
  }

  assert.equal(
    INTENTIONAL_OUTSIDE_MAINLAYOUT.some((r) => r.includes("coming-soon")),
    false
  );
});

test("batch1a authenticated MainLayout bypass inventory — empty after Coming Soon adjudication", () => {
  const AUTHENTICATED_MAINLAYOUT_BYPASS_COUNT = 0;
  const AUTHENTICATED_MAINLAYOUT_BYPASS_ROUTES = [];
  assert.equal(AUTHENTICATED_MAINLAYOUT_BYPASS_COUNT, 0);
  assert.deepEqual(AUTHENTICATED_MAINLAYOUT_BYPASS_ROUTES, []);

  const router = readSrc("src/router.jsx");
  const mainIdx = router.indexOf("element={<MainLayout />}");
  const comingIdx = router.indexOf('path="/coming-soon/:moduleKey"');
  assert.ok(comingIdx > mainIdx, "coming-soon nested under MainLayout");

  // Auth contract for Coming Soon remains empty-permission (menu-gated), not redesigned.
  const menuAccess = readSrc("src/auth/menuAccess.js");
  assert.match(menuAccess, /pathname\.startsWith\("\/coming-soon"\)[\s\S]*?return \[\];/);
});

test("batch1a frozen Tournament Experience chrome files untouched by shell exclusivity", () => {
  const layout = readSrc("src/layouts/MainLayout.jsx");
  assert.doesNotMatch(layout, /ExperiencePageHeader|ExperienceBatchBFrame|ExperienceDrawRoomShell|TournamentExperienceWorkspace/);

  const flags = readSrc("src/features/canonical-shell/flags.js");
  assert.doesNotMatch(flags, /ExperiencePageHeader|tournament\/experience-a1/);
});

test("batch1a no Batch 1B/1C/1D chrome IA changes in MainLayout switch", () => {
  const layout = readSrc("src/layouts/MainLayout.jsx");
  // Help target / tablet rail / topbar relocation belong to later batches — not in exclusivity switch.
  assert.doesNotMatch(layout, /\/support|HELP_TARGET|tablet.?rail|sidebarWidthCollapsed/);
});
