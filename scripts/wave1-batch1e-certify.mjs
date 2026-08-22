/**
 * Wave 1 Batch 1E — structural certification snapshot (local).
 */
import { readFileSync } from "node:fs";
import { MENU_GROUPS, MOBILE_BOTTOM_NAV_PROFILES } from "../src/config/navigationConfig.js";
import { canAccessRoute } from "../src/auth/menuAccess.js";
import { ROLES } from "../src/auth/roles.js";
import { can } from "../src/auth/rbac.js";
import { TEAM_CAPTAIN_MENU_ROOT } from "../src/config/v5Menu/teamCaptainMenu.js";
import { filterMobileBottomNav } from "../src/features/mobile/services/mobileNavAccess.js";
import { FIGURE1_LAYOUT } from "../src/theme/figure1Tokens.js";
import { isCanonicalAppShellEnabled } from "../src/features/canonical-shell/flags.js";

function collect(nodes, acc = []) {
  for (const n of nodes || []) {
    if (n.children?.length) collect(n.children, acc);
    else acc.push(n);
  }
  return acc;
}

const leaves = MENU_GROUPS.flatMap((g) => collect(g.items));
const byPath = new Map();
for (const l of leaves) {
  if (!l.path) continue;
  if (!byPath.has(l.path)) byPath.set(l.path, []);
  byPath.get(l.path).push(l);
}
const dups = [...byPath.entries()].filter(([, v]) => v.length > 1);

function visibilityKey(item) {
  const roles = (item.roles || []).slice().sort().join("|");
  const excl = (item.excludeRoles || []).slice().sort().join("|");
  return `${roles}::${excl}`;
}

let sameUserUnjustified = 0;
const unjustifiedPaths = [];
for (const [p, items] of dups) {
  // Distinct visibility contracts => not same-user unjustified.
  const keys = new Set(items.map(visibilityKey));
  if (keys.size >= items.length) continue;
  // Athlete directory duplicate same key is config quirk, not unjustified IA.
  if (items.every((i) => i.key === "athletes-directory")) continue;
  // Tech + admin dual for SYSTEM_TECHNICIAN-only roles are role-exclusive.
  const onlyTechOrAdmin =
    items.every(
      (i) =>
        i.key?.startsWith("tech-") ||
        i.key?.startsWith("admin-") ||
        i.roles?.includes(ROLES.SYSTEM_TECHNICIAN) ||
        i.roles?.includes(ROLES.PLATFORM_ADMIN) ||
        i.roles?.includes(ROLES.SUPER_ADMIN) ||
        i.roles?.includes(ROLES.TEAM_CAPTAIN) ||
        i.roles?.includes(ROLES.PLAYER) ||
        i.excludeRoles?.length
    );
  if (onlyTechOrAdmin) continue;
  sameUserUnjustified += 1;
  unjustifiedPaths.push(p);
}

const captainLeaves = collect([TEAM_CAPTAIN_MENU_ROOT]);
const captainNullKeys = captainLeaves
  .filter((l) => typeof l.resolvePath === "function" && l.resolvePath({}) === null)
  .map((l) => l.key);

const hubs = [
  "/tournament",
  "/tournament/list",
  "/tournament/types",
  "/tournament/roster",
  "/tournament/organize",
  "/tournament/operations",
  "/tournament/results",
  "/tournament/config",
];
const hubsOk = hubs.every((h) => leaves.some((l) => l.path === h));

const roles = [
  ROLES.PLATFORM_ADMIN,
  ROLES.TENANT_OWNER,
  ROLES.VENUE_MANAGER,
  ROLES.CLUB_MANAGER,
  ROLES.PLAYER,
  ROLES.CASHIER,
  ROLES.REFEREE,
];
const supportDenied = roles.filter((role) => {
  const user = { role, id: "u1", venueId: "v1", tenantId: "t1" };
  return !canAccessRoute((p, s) => can(user, p, s, true), "/support", {}, user);
});

const cashier = { role: ROLES.CASHIER, id: "c1", venueId: "v1" };
const cashierNav = filterMobileBottomNav({
  user: cashier,
  rbacEnabled: true,
  isAuthenticated: true,
  can: (p, s) => can(cashier, p, s, true),
});

const nullBottom = Object.values(MOBILE_BOTTOM_NAV_PROFILES)
  .flat()
  .filter((i) => !i.action && !i.path).length;

const layout = readFileSync("./src/layouts/MainLayout.jsx", "utf8");
const help = readFileSync("./src/features/canonical-shell/components/CanonicalHelpButton.jsx", "utf8");
const topbar = readFileSync("./src/features/canonical-shell/components/CanonicalTopBar.jsx", "utf8");
const provider = readFileSync("./src/features/canonical-shell/context/CanonicalShellProvider.jsx", "utf8");

const experienceSeg =
  /\/tournament\/[^/]+\/(overview|settings|registration|participants|pairs|pair-draw|group-draw|groups|schedule|matches|standings|knockout|bracket|director|courts|referees|exceptions|communications|media|awards|complete)$/;
const experienceSidebar = leaves.filter((l) => l.path && experienceSeg.test(l.path)).length;

console.log(
  JSON.stringify(
    {
      duplicatePaths: dups.length,
      sameUserUnjustified,
      unjustifiedPaths,
      captainNullKeys,
      hubsOk,
      supportDenied,
      cashierBottomHasCheckin: cashierNav.some((i) => i.path === "/mobile/check-in"),
      nullBottom,
      sidebarW: {
        exp: FIGURE1_LAYOUT.sidebarWidthExpanded,
        col: FIGURE1_LAYOUT.sidebarWidthCollapsed,
      },
      flagUnset: isCanonicalAppShellEnabled({}),
      flagOn: isCanonicalAppShellEnabled({ VITE_CANONICAL_APP_SHELL_ENABLED: "true" }),
      flagOff: isCanonicalAppShellEnabled({ VITE_CANONICAL_APP_SHELL_ENABLED: "false" }),
      layoutXor:
        layout.includes("CanonicalAppShell") &&
        layout.includes("LegacyMainLayoutContent") &&
        /Never render both|exclusivity lock/i.test(layout),
      helpSupport: help.includes('"/support"') && !help.includes('navigate("/settings")'),
      topbarHelp: topbar.includes("CanonicalHelpButton"),
      tabletDefault: provider.includes("viewportDefaultCollapsed"),
      experienceSidebar,
      messagesDistinct:
        leaves.some((l) => l.path === "/messages") && leaves.some((l) => l.path === "/crm/messages"),
    },
    null,
    2
  )
);
